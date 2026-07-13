const DEFAULT_ENDPOINT = { name: '', apiUrl: '', apiKey: '', model: '', apiMode: 'auto' };
const DEFAULT_CONFIG = { endpoints: [], minChars: 20, temperature: 0.7, targetLang: 'en', requestTimeoutMs: 30000, theme: 'system' };
const MODES = new Set(['auto', 'openai_responses', 'openai_chat', 'openai_custom', 'anthropic_messages', 'gemini_generate', 'ollama_chat']);

const $ = (id) => document.getElementById(id);
const elements = {
  form: $('endpointForm'), toggleEditor: $('toggleEditorBtn'), cancelEditor: $('cancelEditorBtn'), saveEndpoint: $('saveEndpointBtn'),
  name: $('epName'), url: $('epUrl'), key: $('epKey'), model: $('epModel'), mode: $('epMode'), toggleKey: $('toggleKeyBtn'),
  list: $('endpointList'), testAll: $('testAllBtn'), result: $('testResult'), save: $('saveBtn'), export: $('exportBtn'),
  import: $('importBtn'), importFile: $('importFile'), minChars: $('minChars'), temperature: $('temperature'),
  targetLang: $('targetLang'), timeout: $('requestTimeout'), theme: $('themeSelect'), toast: $('toast')
};

let endpoints = [];
let editingIndex = -1;
let toastTimer;

bindEvents();
initialize().catch((error) => showToast(error.message, true));

async function initialize() {
  const stored = await getExtensionStorage().get(null);
  applyTheme(stored.theme || 'system');
  endpoints = normalizeEndpoints(stored.endpoints, stored);
  elements.minChars.value = clamp(stored.minChars, 20, 2000, DEFAULT_CONFIG.minChars);
  elements.temperature.value = clamp(stored.temperature, 0, 2, DEFAULT_CONFIG.temperature);
  elements.targetLang.value = stored.targetLang || DEFAULT_CONFIG.targetLang;
  elements.timeout.value = clamp(Number(stored.requestTimeoutMs) / 1000, 5, 120, 30);
  renderEndpoints();
}

function bindEvents() {
  elements.toggleEditor.addEventListener('click', () => elements.form.classList.contains('hidden') ? openEditor() : closeEditor());
  elements.cancelEditor.addEventListener('click', closeEditor);
  elements.form.addEventListener('submit', saveEndpoint);
  elements.toggleKey.addEventListener('click', () => {
    const visible = elements.key.type === 'text';
    elements.key.type = visible ? 'password' : 'text';
    elements.toggleKey.textContent = visible ? '显示' : '隐藏';
  });
  elements.list.addEventListener('click', handleEndpointAction);
  elements.testAll.addEventListener('click', testAllEndpoints);
  elements.save.addEventListener('click', saveConfig);
  elements.export.addEventListener('click', exportConfig);
  elements.import.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', importConfig);
  elements.theme.addEventListener('change', async () => {
    applyTheme(elements.theme.value);
    try { await getExtensionStorage().set({ theme: elements.theme.value }); }
    catch (error) { showToast(`主题保存失败：${error.message}`, true); }
  });
}

function openEditor(index = -1) {
  editingIndex = index;
  const endpoint = index >= 0 ? endpoints[index] : DEFAULT_ENDPOINT;
  elements.name.value = endpoint?.name || '';
  elements.url.value = endpoint?.apiUrl || '';
  elements.key.value = endpoint?.apiKey || '';
  elements.model.value = endpoint?.model || DEFAULT_ENDPOINT.model;
  elements.mode.value = endpoint?.apiMode || DEFAULT_ENDPOINT.apiMode;
  elements.form.classList.remove('hidden');
  elements.toggleEditor.textContent = '收起';
  elements.saveEndpoint.textContent = index >= 0 ? '更新线路' : '保存线路';
  elements.name.focus();
}

function closeEditor() {
  editingIndex = -1;
  elements.form.reset();
  elements.model.value = DEFAULT_ENDPOINT.model;
  elements.form.classList.add('hidden');
  elements.toggleEditor.textContent = '添加线路';
  elements.key.type = 'password';
  elements.toggleKey.textContent = '显示';
}

function saveEndpoint(event) {
  event.preventDefault();
  try {
    const wasEditing = editingIndex >= 0;
    const endpoint = sanitizeEndpoint({ name: elements.name.value, apiUrl: elements.url.value, apiKey: elements.key.value, model: elements.model.value, apiMode: elements.mode.value }, editingIndex >= 0 ? editingIndex : endpoints.length);
    validateEndpoint(endpoint);
    if (editingIndex >= 0) endpoints[editingIndex] = endpoint;
    else endpoints.push(endpoint);
    closeEditor();
    renderEndpoints();
    showToast(wasEditing ? '线路已更新' : '线路已添加');
  } catch (error) { showToast(error.message, true); }
}

function handleEndpointAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || !endpoints[index]) return;
  if (button.dataset.action === 'edit') openEditor(index);
  if (button.dataset.action === 'move-up') moveEndpoint(index, -1);
  if (button.dataset.action === 'move-down') moveEndpoint(index, 1);
  if (button.dataset.action === 'delete') {
    endpoints.splice(index, 1);
    renderEndpoints();
    showToast('线路已删除，点击“保存配置”后生效');
  }
  if (button.dataset.action === 'test') testEndpoint(index, button);
}

function renderEndpoints() {
  if (!endpoints.length) {
    elements.list.innerHTML = '<div class="empty">还没有线路。添加一条 API 线路后即可开始使用。</div>';
    elements.testAll.disabled = true;
    return;
  }
  elements.testAll.disabled = false;
  elements.list.innerHTML = endpoints.map((endpoint, index) => `
    <article class="endpoint">
      <div><div class="endpoint-title"><span class="status-dot"></span>${escapeHtml(endpoint.name)}</div>
      <div class="endpoint-url" title="${escapeHtml(endpoint.apiUrl)}">${escapeHtml(endpoint.apiUrl)}</div>
      <div class="chips"><span class="chip">${escapeHtml(endpoint.model)}</span><span class="chip">${modeLabel(endpoint.apiMode)}</span><span class="chip">${maskKey(endpoint.apiKey)}</span></div></div>
      <div class="endpoint-actions"><div class="order-buttons"><button class="icon-button order-button" data-action="move-up" data-index="${index}" title="上移" aria-label="上移 ${escapeHtml(endpoint.name)}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button order-button" data-action="move-down" data-index="${index}" title="下移" aria-label="下移 ${escapeHtml(endpoint.name)}" ${index === endpoints.length - 1 ? 'disabled' : ''}>↓</button></div><button class="icon-button" data-action="test" data-index="${index}">测试</button><button class="icon-button" data-action="edit" data-index="${index}">编辑</button><button class="icon-button danger" data-action="delete" data-index="${index}">删除</button></div>
    </article>`).join('');
}

function moveEndpoint(index, offset) {
  const targetIndex = index + offset;
  if (!endpoints[index] || targetIndex < 0 || targetIndex >= endpoints.length) return;
  [endpoints[index], endpoints[targetIndex]] = [endpoints[targetIndex], endpoints[index]];
  if (editingIndex === index) editingIndex = targetIndex;
  else if (editingIndex === targetIndex) editingIndex = index;
  renderEndpoints();
  showToast(`“${endpoints[targetIndex].name}”已${offset < 0 ? '上移' : '下移'}，保存配置后生效`);
}

async function testEndpoint(index, button) {
  button.disabled = true;
  button.textContent = '测试中…';
  try {
    const response = await requestTest(index);
    showResult(formatTestResult(endpoints[index].name, response), response?.ok ? 'success' : 'error');
  } finally {
    button.disabled = false;
    button.textContent = '测试';
  }
}

async function testAllEndpoints() {
  elements.testAll.disabled = true;
  const lines = [];
  let successes = 0;
  try {
    for (let index = 0; index < endpoints.length; index += 1) {
      elements.testAll.textContent = `正在测试 ${index + 1}/${endpoints.length}…`;
      const response = await requestTest(index);
      if (response?.ok) successes += 1;
      lines.push(formatTestResult(endpoints[index].name, response));
    }
    showResult(`完成：${successes}/${endpoints.length} 条线路可用\n\n${lines.join('\n\n')}`, successes === endpoints.length ? 'success' : 'error');
  } finally {
    elements.testAll.disabled = false;
    elements.testAll.textContent = '测试全部线路';
  }
}

async function requestTest(index) {
  try {
    return await sendRuntimeMessage({ type: 'TEST_CONNECTION', payload: { ...collectConfig(), testIndex: index } });
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function formatTestResult(name, response) {
  return response?.ok
    ? `✓ ${name}\nHTTP ${response.status} · ${modeLabel(response.mode)} · ${response.model}\n${response.preview}`
    : `✕ ${name}\n${response?.error || '未知错误'}`;
}

async function saveConfig() {
  try {
    const config = collectConfig();
    await getExtensionStorage().set(config);
    showToast('配置已保存');
  } catch (error) { showToast(error.message, true); }
}

function collectConfig() {
  endpoints.forEach(validateEndpoint);
  return {
    endpoints: endpoints.map(sanitizeEndpoint),
    minChars: clamp(elements.minChars.value, 20, 2000, 20),
    temperature: clamp(elements.temperature.value, 0, 2, 0.7),
    targetLang: elements.targetLang.value || 'en',
    theme: elements.theme.value || 'system',
    requestTimeoutMs: clamp(elements.timeout.value, 5, 120, 30) * 1000
  };
}

function exportConfig() {
  try {
    const payload = { version: 2, exportedAt: new Date().toISOString(), config: collectConfig() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `textpolish-${payload.exportedAt.slice(0, 10)}.json` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('配置已导出（文件包含 API Key，请妥善保管）');
  } catch (error) { showToast(error.message, true); }
}

async function importConfig(event) {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const config = parsed.config || parsed;
    endpoints = normalizeEndpoints(config.endpoints, config);
    elements.minChars.value = clamp(config.minChars, 20, 2000, 20);
    elements.temperature.value = clamp(config.temperature, 0, 2, 0.7);
    elements.targetLang.value = config.targetLang || 'en';
    applyTheme(config.theme || 'system');
    elements.timeout.value = clamp(Number(config.requestTimeoutMs) / 1000, 5, 120, 30);
    renderEndpoints();
    showToast('配置已导入，检查后请点击“保存配置”');
  } catch (error) { showToast(`导入失败：${error.message}`, true); }
  finally { elements.importFile.value = ''; }
}

function normalizeEndpoints(value, legacy = {}) {
  const list = Array.isArray(value) ? value : String(legacy.apiUrls || legacy.apiUrl || '').split(/\r?\n/).filter(Boolean).map((apiUrl) => ({ apiUrl, apiKey: legacy.apiKey, model: legacy.model, apiMode: legacy.apiMode }));
  return list.map(sanitizeEndpoint);
}

function sanitizeEndpoint(endpoint = {}, index = 0) {
  const mode = String(endpoint.apiMode || 'auto');
  return { name: String(endpoint.name || `线路 ${index + 1}`).trim(), apiUrl: String(endpoint.apiUrl || '').trim(), apiKey: String(endpoint.apiKey || '').trim(), model: String(endpoint.model || '').trim(), apiMode: MODES.has(mode) ? mode : 'auto' };
}

function validateEndpoint(endpoint) {
  if (!endpoint.apiUrl) throw new Error('请填写接口 URL');
  try { const url = new URL(endpoint.apiUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new Error(`线路“${endpoint.name}”的 URL 无效`); }
  if (!endpoint.apiKey && endpoint.apiMode !== 'ollama_chat') throw new Error(`线路“${endpoint.name}”缺少 API Key`);
  if (!endpoint.model) throw new Error(`线路“${endpoint.name}”缺少模型`);
}

function modeLabel(mode) { return ({ auto: '自动识别', openai_responses: 'Responses', openai_chat: 'Chat Completions', openai_custom: 'OpenAI 自定义', anthropic_messages: 'Anthropic', gemini_generate: 'Gemini', ollama_chat: 'Ollama' })[mode] || mode; }
function applyTheme(theme) { const value = ['system', 'light', 'dark'].includes(theme) ? theme : 'system'; elements.theme.value = value; if (value === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = value; }
function getExtensionStorage() {
  const storage = globalThis.chrome?.storage?.sync;
  if (!storage) throw new Error('当前配置页的扩展环境已失效。请关闭此页面，然后点击扩展图标重新打开配置页。');
  return storage;
}
async function sendRuntimeMessage(message) {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) {
    throw new Error('当前配置页无法连接扩展后台。请关闭此页面，然后点击扩展图标重新打开配置页。');
  }
  try {
    return await runtime.sendMessage(message);
  } catch (error) {
    const detail = String(error?.message || error);
    if (/context invalidated|receiving end does not exist|message port closed/i.test(detail)) {
      throw new Error('扩展刚刚被重新加载，当前页面连接已失效。请刷新网页和配置页后重试。');
    }
    throw new Error(`无法连接扩展后台：${detail}`);
  }
}
function maskKey(key) { const value = String(key || ''); return value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : '••••••••'; }
function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }

function showResult(text, type) { elements.result.textContent = text; elements.result.className = `result ${type}`; }
function showToast(text, isError = false) { clearTimeout(toastTimer); elements.toast.textContent = text; elements.toast.className = `toast${isError ? ' error' : ''}`; toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 3200); }
