import { DEFAULT_CONFIG, initializeConfig, loadConfig, normalizeConfig } from './config.js';
import { requestModel } from './api-client.js';

chrome.runtime.onInstalled.addListener(() => initializeConfig());
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

async function handleMessage(message) {
  if (message?.type === 'TEST_CONNECTION') return testConnection(message.payload || {});
  if (!['OPTIMIZE_TEXT', 'TRANSLATE_TEXT'].includes(message?.type)) throw new Error('未知请求类型。');

  const text = String(message.payload?.text || '').trim();
  if (!text) throw new Error('请输入需要处理的文本。');
  const config = await loadConfig();
  const messages = message.type === 'TRANSLATE_TEXT'
    ? buildTranslationMessages(text, config.targetLang)
    : buildOptimizationMessages(text, config.minChars);
  const result = await requestModel(config, messages);
  if (!result.content) throw new Error('接口返回成功，但没有可用正文。');
  return { content: result.content };
}

async function testConnection(input) {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...input });
  const result = await requestModel(config, [{ role: 'user', content: 'Reply with exactly: OK' }], input.testIndex);
  return {
    status: result.status,
    endpointName: result.endpointName,
    mode: result.mode,
    model: result.model,
    preview: result.content.slice(0, 200)
  };
}

function buildOptimizationMessages(text, minChars) {
  return [
    { role: 'system', content: '你是专业中文文案优化助手，擅长自然、准确、简洁的中文表达。' },
    {
      role: 'user',
      content: `请优化下面的中文内容。保持原意，表达自然，避免套话和 AI 腔；必要时适度扩写，结果不少于 ${minChars} 个中文字符。只输出最终正文。\n\n原文：\n${text}`
    }
  ];
}

function buildTranslationMessages(text, targetLang) {
  const languages = { en: '英语', ja: '日语', ko: '韩语', fr: '法语', de: '德语' };
  const language = languages[targetLang] || languages.en;
  return [
    { role: 'system', content: `你是专业的中文到${language}翻译。` },
    { role: 'user', content: `把下面内容翻译成${language}，只输出译文：\n\n${text}` }
  ];
}
