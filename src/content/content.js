(() => {
  const TRIGGER_INTERVAL = 360;
  let lastSpaceAt = 0;
  let spaceCount = 0;
  let pendingTimer = null;
  let busy = false;

  document.addEventListener('keydown', handleKeydown, true);

  function handleKeydown(event) {
    if (event.code !== 'Space' || event.repeat || busy || !isEditable(event.target)) return;

    const now = Date.now();
    spaceCount = now - lastSpaceAt <= TRIGGER_INTERVAL ? spaceCount + 1 : 1;
    lastSpaceAt = now;

    if (spaceCount === 2) {
      const text = readText(event.target).trim();
      if (text.length < 2) return resetTrigger();
      event.preventDefault();
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => runAction(event.target, text, 'OPTIMIZE_TEXT'), TRIGGER_INTERVAL);
    } else if (spaceCount === 3) {
      const text = readText(event.target).trim();
      event.preventDefault();
      clearTimeout(pendingTimer);
      pendingTimer = null;
      resetTrigger();
      if (text) runAction(event.target, text, 'TRANSLATE_TEXT');
    }
  }

  async function runAction(element, text, type) {
    resetTrigger();
    busy = true;
    showToast(type === 'OPTIMIZE_TEXT' ? '正在优化…' : '正在翻译…', 'loading');

    try {
      const response = await sendRuntimeMessage({ type, payload: { text } });
      if (!response?.ok) throw new Error(response?.error || '扩展后台未返回结果');
      const result = String(response.content || '').trim();
      if (!result) throw new Error('接口返回内容为空');
      writeText(element, result);
      showToast('处理完成', 'success');
    } catch (error) {
      console.error('[TextPolish]', error);
      showToast(`请求失败：${error.message}`, 'error', 7000);
    } finally {
      busy = false;
    }
  }

  function isEditable(element) {
    if (!element || element.disabled || element.readOnly) return false;
    if (element.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA'].includes(element.tagName) && !['button', 'checkbox', 'radio', 'submit'].includes(element.type);
  }

  function readText(element) {
    return element.isContentEditable ? element.innerText : element.value;
  }

  function writeText(element, text) {
    if (element.isContentEditable) element.innerText = text;
    else {
      const setter = Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
      setter ? setter.call(element, text) : (element.value = text);
    }
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetTrigger() {
    lastSpaceAt = 0;
    spaceCount = 0;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  async function sendRuntimeMessage(message) {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      throw new Error('扩展连接已失效，请刷新当前网页后重试');
    }
    try {
      return await runtime.sendMessage(message);
    } catch (error) {
      const detail = String(error?.message || error);
      if (/context invalidated|receiving end does not exist|message port closed/i.test(detail)) {
        throw new Error('扩展刚刚被重新加载，请刷新当前网页后重试');
      }
      throw error;
    }
  }

  function showToast(message, type, duration = 2600) {
    document.getElementById('textpolish-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'textpolish-toast';
    toast.textContent = message;
    const color = type === 'error' ? '#b42318' : type === 'success' ? '#067647' : '#344054';
    Object.assign(toast.style, {
      position: 'fixed', zIndex: '2147483647', right: '20px', bottom: '20px', maxWidth: '420px',
      padding: '11px 14px', borderRadius: '10px', background: '#fff', color,
      border: `1px solid ${color}33`, boxShadow: '0 8px 28px rgba(16,24,40,.18)',
      font: '13px/1.5 system-ui, sans-serif', whiteSpace: 'pre-wrap'
    });
    document.documentElement.appendChild(toast);
    if (type !== 'loading') setTimeout(() => toast.remove(), duration);
  }
})();
