export const DEFAULT_CONFIG = Object.freeze({
  endpoints: [],
  minChars: 20,
  temperature: 0.7,
  targetLang: 'en',
  requestTimeoutMs: 30000
});

export const API_MODES = new Set([
  'auto',
  'openai_responses',
  'openai_chat',
  'openai_custom',
  'anthropic_messages',
  'gemini_generate',
  'ollama_chat'
]);

export async function initializeConfig() {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const missing = {};

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    if (current[key] === undefined || current[key] === null) missing[key] = value;
  }

  if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
}

export async function loadConfig() {
  const stored = await chrome.storage.sync.get(null);
  return normalizeConfig({ ...DEFAULT_CONFIG, ...stored });
}

export function normalizeConfig(input = {}) {
  const endpoints = Array.isArray(input.endpoints)
    ? input.endpoints
    : migrateLegacyEndpoints(input);

  return {
    endpoints: endpoints.map(normalizeEndpoint).filter((endpoint) => endpoint.apiUrl && endpoint.model && (endpoint.apiKey || endpoint.apiMode === 'ollama_chat')),
    minChars: clampNumber(input.minChars, 20, 2000, DEFAULT_CONFIG.minChars),
    temperature: clampNumber(input.temperature, 0, 2, DEFAULT_CONFIG.temperature),
    targetLang: String(input.targetLang || DEFAULT_CONFIG.targetLang),
    requestTimeoutMs: clampNumber(input.requestTimeoutMs, 5000, 120000, DEFAULT_CONFIG.requestTimeoutMs)
  };
}

export function normalizeEndpoint(endpoint = {}, index = 0) {
  const apiMode = String(endpoint.apiMode || 'auto').trim();
  return {
    name: String(endpoint.name || `线路 ${index + 1}`).trim(),
    apiUrl: String(endpoint.apiUrl || '').trim(),
    apiKey: String(endpoint.apiKey || '').trim(),
    model: String(endpoint.model || '').trim(),
    apiMode: API_MODES.has(apiMode) ? apiMode : 'auto'
  };
}

function migrateLegacyEndpoints(input) {
  return String(input.apiUrls || input.apiUrl || '')
    .split(/\r?\n/)
    .map((apiUrl, index) => normalizeEndpoint({
      name: `线路 ${index + 1}`,
      apiUrl,
      apiKey: input.apiKey,
      model: input.model,
      apiMode: input.apiMode
    }, index));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
