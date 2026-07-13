const MODE_LABELS = {
  openai_responses: 'OpenAI Responses',
  openai_chat: 'OpenAI Chat Completions',
  openai_custom: 'OpenAI 兼容（完整 URL）',
  anthropic_messages: 'Anthropic Messages',
  gemini_generate: 'Google Gemini',
  ollama_chat: 'Ollama'
};

export async function requestModel(config, messages, onlyIndex) {
  const endpoints = Number.isInteger(onlyIndex)
    ? config.endpoints.slice(onlyIndex, onlyIndex + 1)
    : config.endpoints;

  if (!endpoints.length) throw new Error('没有可用线路，请先填写 URL、模型和服务所需的 API Key。');

  const failures = [];
  endpointLoop: for (const endpoint of endpoints) {
    validateEndpoint(endpoint);
    const modes = getModeCandidates(endpoint.apiUrl, endpoint.apiMode);
    const models = getModelCandidates(endpoint.model);

    for (const model of models) {
      for (const mode of modes) {
        const url = buildEndpoint(endpoint.apiUrl, mode, model);
        let result;
        try {
          result = await requestOnce({
            url,
            headers: buildHeaders(mode, endpoint.apiKey),
            payload: buildPayload(mode, model, messages, config.temperature),
            timeoutMs: config.requestTimeoutMs
          });
        } catch (error) {
          failures.push(`• ${endpoint.name} · ${MODE_LABELS[mode]}：${error.message}`);
          continue endpointLoop;
        }

        if (result.ok) {
          const content = extractModelContent(result.raw);
          if (content) return { ...result, content, mode, model, url, endpointName: endpoint.name };
          failures.push(formatFailure(endpoint.name, mode, model, result.status, '响应成功但正文为空'));
          continue;
        }

        failures.push(formatFailure(endpoint.name, mode, model, result.status, readableBody(result.raw)));
        if ([401, 403, 407, 429].includes(result.status) || result.status >= 500) continue endpointLoop;
        if (![404, 405, 415, 422].includes(result.status)) break;
      }
    }
  }

  throw new Error(`接口请求失败：\n${failures.join('\n')}`);
}

async function requestOnce({ url, headers, payload, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    return { ok: response.ok, status: response.status, raw: await response.text() };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）：${url}`);
    throw new Error(
      `网络请求未能发出：${url}\n` +
      '请检查接口地址、网络/代理、HTTPS 证书以及服务端是否允许扩展访问。' +
      (error?.message ? `\n底层错误：${error.message}` : '')
    );
  } finally {
    clearTimeout(timer);
  }
}

function validateEndpoint(endpoint) {
  try {
    const url = new URL(endpoint.apiUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`线路“${endpoint.name}”的 URL 格式无效。`);
  }
  if (!endpoint.apiKey && endpoint.apiMode !== 'ollama_chat') throw new Error(`线路“${endpoint.name}”缺少 API Key。`);
  if (!getModelCandidates(endpoint.model).length) throw new Error(`线路“${endpoint.name}”缺少模型名称。`);
}

function getModeCandidates(apiUrl, apiMode) {
  if (apiMode && apiMode !== 'auto') return [apiMode];
  const url = new URL(apiUrl);
  const path = url.pathname.toLowerCase();
  if (url.hostname === 'generativelanguage.googleapis.com' || path.includes(':generatecontent')) return ['gemini_generate'];
  if (path.endsWith('/api/chat') || ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '11434') return ['ollama_chat'];
  if (path.endsWith('/messages')) return ['anthropic_messages', 'openai_responses', 'openai_chat'];
  if (path.endsWith('/chat/completions')) return ['openai_chat', 'openai_responses', 'anthropic_messages'];
  return ['openai_responses', 'openai_chat', 'anthropic_messages'];
}

function buildEndpoint(rawUrl, mode, model) {
  const url = new URL(rawUrl);
  if (mode === 'openai_custom') return url.toString();

  if (mode === 'gemini_generate') {
    if (/:(generateContent|streamGenerateContent)$/i.test(url.pathname)) return url.toString();
    const cleanModel = String(model).replace(/^models\//i, '');
    const basePath = url.pathname.replace(/\/+$/, '').replace(/\/(v1|v1beta)\/models$/i, '');
    url.pathname = `${basePath}/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`.replace(/\/{2,}/g, '/');
    return url.toString();
  }

  if (mode === 'ollama_chat') {
    const basePath = url.pathname.replace(/\/+$/, '').replace(/\/api\/chat$/i, '');
    url.pathname = `${basePath}/api/chat`.replace(/\/{2,}/g, '/');
    return url.toString();
  }

  const cleanPath = url.pathname.replace(/\/+$/, '');
  const basePath = cleanPath.replace(/\/v1\/(responses|chat\/completions|messages)$/i, '');
  const suffix = mode === 'anthropic_messages'
    ? '/v1/messages'
    : mode === 'openai_chat' ? '/v1/chat/completions' : '/v1/responses';
  url.pathname = `${basePath}${suffix}`.replace(/\/{2,}/g, '/');
  return url.toString();
}

function buildHeaders(mode, apiKey) {
  if (mode === 'anthropic_messages') {
    return { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  }
  if (mode === 'gemini_generate') return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
  if (mode === 'ollama_chat') {
    return apiKey
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
      : { 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
}

function buildPayload(mode, model, messages, temperature) {
  const system = messages.find((message) => message.role === 'system')?.content || '';
  const input = messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n\n');

  if (mode === 'gemini_generate') {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: input }] }],
      systemInstruction: system ? { parts: [{ text: system }] } : undefined
    };
    if (Number.isFinite(Number(temperature))) payload.generationConfig = { temperature: Number(temperature) };
    return payload;
  }

  if (mode === 'ollama_chat') {
    const payload = { model, messages, stream: false };
    if (Number.isFinite(Number(temperature))) payload.options = { temperature: Number(temperature) };
    return payload;
  }

  if (mode === 'anthropic_messages') {
    return withTemperature({ model, system: system || undefined, messages: [{ role: 'user', content: input }], max_tokens: 2048, stream: false }, mode, model, temperature);
  }

  if (mode === 'openai_chat' || mode === 'openai_custom') {
    return withTemperature({ model, messages, stream: false }, mode, model, temperature);
  }

  return withTemperature({ model, instructions: system || undefined, input, stream: false }, mode, model, temperature);
}

function withTemperature(payload, mode, model, temperature) {
  const value = Number(temperature);
  const reasoningModel = /^(o[134](?:-|$)|gpt-5(?:[.-]|$))/i.test(String(model));
  if (Number.isFinite(value) && (mode === 'anthropic_messages' || !reasoningModel)) payload.temperature = value;
  return payload;
}

function getModelCandidates(value) {
  return [...new Set(String(value || '').split(/[,\r\n]/).map((item) => item.trim()).filter(Boolean))];
}

function extractModelContent(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return ''; }
  const direct = [
    data?.output_text,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.candidates?.[0]?.content?.parts,
    data?.message?.content,
    data?.response,
    data?.content,
    data?.output
  ];
  return direct.map(valueToText).find((text) => text.trim())?.trim() || '';
}

function valueToText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(valueToText).join('');
  if (!value || typeof value !== 'object') return '';
  return valueToText(value.text) || valueToText(value.output_text) || valueToText(value.content) || valueToText(value.value);
}

function readableBody(raw) {
  const text = String(raw || '').trim();
  if (!text) return '服务器未返回错误详情';
  try {
    const data = JSON.parse(text);
    return String(data?.error?.message || data?.message || data?.error || text).slice(0, 240);
  } catch {
    return text.replace(/\s+/g, ' ').slice(0, 240);
  }
}

function formatFailure(name, mode, model, status, detail) {
  return `• ${name} · ${MODE_LABELS[mode] || mode} · ${model} · HTTP ${status || '未知'}：${detail}`;
}
