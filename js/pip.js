/* js / pip.js · 浮动便签（最终微调版） */
(function() {
  const pipBtn = document.getElementById('pipBtn');
  if (!pipBtn) return;

  if (!('documentPictureInPicture' in window)) {
    pipBtn.style.display = 'none';
    return;
  }

  let pipWindow = null;

  /* ★ 修复：安全生成带 alpha 的颜色（兼容 hex 6位/3位，其它格式兜底），不再拼字符串后缀 */
  function alphaColor(color, alpha) {
    const c = String(color || '#888888').trim();
    const aHex = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c + aHex;
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return '#' + c[1]+c[1] + c[2]+c[2] + c[3]+c[3] + aHex;
    }
    // 兜底：灰色半透明（不会报错，不会丢滚动条）
    return `rgba(136,136,136,${alpha})`;
  }

  pipBtn.addEventListener('click', async () => {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    try {
      pipWindow = await documentPictureInPicture.requestWindow({
        width: 380,
        height: 420,
        copyStyleSheets: true, 
      });
    } catch (err) {
      toast('浮动便签打开失败：' + err.message);
      pipWindow = null;
      return;
    }

    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const style = document.documentElement.getAttribute('data-style') || 'modern';
    pipWindow.document.documentElement.setAttribute('data-theme', theme);
    pipWindow.document.documentElement.setAttribute('data-style', style);
    
    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--bg').trim() || '#f3f4f8';
    const cardColor = computedStyle.getPropertyValue('--card').trim() || '#ffffff';
    const textColor = computedStyle.getPropertyValue('--text').trim() || '#181924';
    const text3Color = computedStyle.getPropertyValue('--text-3').trim() || '#8c8f9e';
    const lineColor = computedStyle.getPropertyValue('--line').trim() || '#e8eaf0';
    const accentColor = computedStyle.getPropertyValue('--accent').trim() || '#5b6ef5';
    const accentSoft = computedStyle.getPropertyValue('--accent-soft').trim() || '#eef1ff';
    const fontMain = computedStyle.getPropertyValue('--font-main').trim() || 'system-ui, -apple-system, sans-serif';

    pipWindow.document.body.style.margin = '0';
    pipWindow.document.body.style.overflow = 'hidden';

    const shortcut = db.settings.saveShortcut || 'ctrl-enter';
    const shortcutHint = shortcut === 'enter' ? 'Enter 保存，Shift+Enter 换行' : 'Ctrl+Enter 快速保存';

    const pipStyle = pipWindow.document.createElement('style');
    pipStyle.textContent = `
      ::-webkit-scrollbar { width: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${alphaColor(text3Color, 0.25)}; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: ${alphaColor(text3Color, 0.44)}; }
      
      * { box-sizing: border-box; }
      
      .pip-wrapper {
        display: flex; flex-direction: column; height: 100vh;
        background: ${cardColor}; color: ${textColor}; font-family: ${fontMain};
      }
      
      .pip-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 18px; 
        border-bottom: 1px solid ${lineColor};
        background: ${bgColor}; flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        z-index: 10;
      }
      .pip-title {
        font-size: 14.5px; font-weight: 700; color: ${textColor};
        display: flex; align-items: center; gap: 6px;
        letter-spacing: 0.5px;
      }
      
      .pip-save-btn {
        padding: 6px 16px; border-radius: 6px; border: none;
        background: ${accentColor}; color: #fff; font-weight: 600; font-size: 13px;
        cursor: pointer; transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); font-family: inherit;
        box-shadow: 0 2px 6px ${accentSoft};
      }
      .pip-save-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
      .pip-save-btn:active:not(:disabled) { transform: translateY(0); }
      .pip-save-btn.success { background: #10b981 !important; box-shadow: 0 2px 6px rgba(16,185,129,0.2); }
      .pip-save-btn:disabled { background: transparent; color: ${text3Color}; border: 1px solid ${lineColor}; cursor: not-allowed; box-shadow: none; }
      
      .pip-input-area {
        flex: 1; position: relative; display: flex; flex-direction: column; background: ${cardColor};
      }
      .pip-textarea {
        flex: 1; width: 100%; border: none; outline: none; resize: none;
        padding: 22px 24px; font-family: inherit; font-size: 15px; line-height: 1.85;
        background: transparent; color: ${textColor};
      }
      .pip-textarea::placeholder { color: ${text3Color}; opacity: 0.7; }
      
      .pip-footer {
        padding: 10px 18px; font-size: 11.5px; color: ${text3Color};
        text-align: right; border-top: 1px dashed ${lineColor};
        background: ${bgColor}; flex-shrink: 0; user-select: none;
        letter-spacing: 0.3px; opacity: 0.8;
      }
    `;
    pipWindow.document.head.appendChild(pipStyle);

    pipWindow.document.body.innerHTML = `
      <div class="pip-wrapper">
        <div class="pip-header">
          <div class="pip-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            快捷速记
          </div>
          <button id="pipSave" class="pip-save-btn" disabled>保存</button>
        </div>
        <div class="pip-input-area">
          <textarea id="pipInput" class="pip-textarea" placeholder="此时此地的灵感…"></textarea>
        </div>
        <div class="pip-footer" id="pipFooter">
          ${shortcutHint}
        </div>
      </div>
    `;

    const pipInput = pipWindow.document.getElementById('pipInput');
    const pipSave = pipWindow.document.getElementById('pipSave');
    const originalBtnText = pipSave.textContent;

    pipInput.focus();

    pipInput.addEventListener('input', () => {
      pipSave.disabled = pipInput.value.trim().length === 0;
    });

    const doSave = () => {
      const text = pipInput.value.trim();
      if (!text) return;
      
      saveFromPip(text);
      pipInput.value = '';
      pipSave.disabled = true;
      
      pipSave.classList.add('success');
      pipSave.textContent = '已保存 ✓';
      setTimeout(() => {
        pipSave.classList.remove('success');
        pipSave.textContent = originalBtnText;
        pipInput.focus();
      }, 1500);
    };

    pipInput.addEventListener('keydown', (e) => {
      if (shortcut === 'enter') {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if(!pipSave.disabled) doSave();
        }
      } else {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if(!pipSave.disabled) doSave();
        }
      }
    });

    pipSave.addEventListener('click', doSave);

    pipWindow.addEventListener('pagehide', () => {
      pipWindow = null;
    });
  });
})();

function saveFromPip(text) {
  const focusCat = db.settings.focusModeCat || '收件箱';
  if (!db.cats.includes(focusCat)) {
    db.cats.push(focusCat);
    ensureColors();
  }
  db.items.unshift({
    id: uid(),
    text: text,
    type: focusCat,
    source: '',
    tags: [],
    images: [],
    createdAt: Date.now()
  });
  save();
  render();
  toast('已存入「' + focusCat + '」');
}