// js/custom-select.js
// ★ 本次修复：
//   1) openPanel 里原来在 panel.hidden = true 的状态下读 panel.scrollHeight，
//      永远是 0，导致 panelHeight = 12，总是判定"下方空间够"，按钮在屏幕底部时
//      面板会被截断。现在改为先临时显示（visibility:hidden 保留占位）+ 读 offsetHeight
//   2) 每个浮动面板挂 _select 反向引用（原有）
//   3) cleanupOrphanPanels 清理孤儿面板（原有）

(function() {
  function initCustomSelect(select) {
    if (select.dataset.customized) return;
    select.dataset.customized = 'true';

    var wrap = document.createElement('div');
    wrap.className = 'custom-select-wrap';

    var cStyle = window.getComputedStyle(select);
    if (cStyle.maxWidth !== 'none') wrap.style.maxWidth = cStyle.maxWidth;
    if (select.style.width) wrap.style.width = select.style.width;
    if (select.style.flex) wrap.style.flex = select.style.flex;

    var display = document.createElement('div');
    display.className = 'custom-select-display';
    display.tabIndex = 0;

    var panel = document.createElement('div');
    panel.className = 'custom-select-panel';
    panel.hidden = true;

    wrap.appendChild(display);
    select.parentNode.insertBefore(wrap, select.nextSibling);
    select.style.display = 'none';

    document.body.appendChild(panel);

    display._panel = panel;
    display._select = select;
    panel._select = select;

    function sync() {
      var selectedOption = select.options[select.selectedIndex];
      display.innerHTML = '<span class="cs-text">' + (selectedOption ? selectedOption.textContent : '') + '</span>';

      panel.innerHTML = '';
      Array.from(select.options).forEach(function(opt, idx) {
        var item = document.createElement('div');
        item.className = 'custom-select-item' + (idx === select.selectedIndex ? ' active' : '');
        item.textContent = opt.textContent;
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          select.selectedIndex = idx;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync();
          closePanel();
        });
        panel.appendChild(item);
      });
    }

    function openPanel() {
      closeAllPanels();

      var rect = display.getBoundingClientRect();
      panel.style.width = rect.width + 'px';
      panel.style.left = rect.left + 'px';

      // ★ 修复：先显示（visibility: hidden）测量真实高度，再决定上/下开
      //   原代码在 hidden 状态下读 scrollHeight 恒为 0，导致 panelHeight 永远 = 12
      panel.style.visibility = 'hidden';
      panel.hidden = false;
      var measured = panel.offsetHeight;
      panel.hidden = true;
      panel.style.visibility = '';

      var panelHeight = measured > 0 ? Math.min(240, measured) : 240;
      var spaceBelow = window.innerHeight - rect.bottom;
      var spaceAbove = rect.top;

      if (spaceBelow < panelHeight + 10 && spaceAbove > spaceBelow) {
        // 上方空间更大：向上弹
        panel.style.top = 'auto';
        panel.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      } else {
        // 下方开
        panel.style.bottom = 'auto';
        panel.style.top = (rect.bottom + 6) + 'px';
      }

      panel.hidden = false;
      wrap.classList.add('open');

      var active = panel.querySelector('.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function closePanel() {
      panel.hidden = true;
      wrap.classList.remove('open');
    }

    display.addEventListener('click', function(e) {
      e.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });

    display.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        display.click();
      }
    });

    select.addEventListener('change', sync);
    var observer = new MutationObserver(function() { sync(); });
    observer.observe(select, { childList: true, subtree: true, attributes: true });

    sync();
  }

  function cleanupOrphanPanels() {
    var panels = document.querySelectorAll('.custom-select-panel');
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      var s = p._select;
      if (!s || !document.body.contains(s)) {
        if (p.parentNode) p.parentNode.removeChild(p);
      }
    }
  }

  function scanSelects() {
    cleanupOrphanPanels();
    document.querySelectorAll('select').forEach(initCustomSelect);
  }

  function closeAllPanels() {
    document.querySelectorAll('.custom-select-panel').forEach(function(p) { p.hidden = true; });
    document.querySelectorAll('.custom-select-wrap').forEach(function(w) { w.classList.remove('open'); });
  }

  var _scanTimer = null;
  var globalObserver = new MutationObserver(function(mutations) {
    var maybeHasSelect = false;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'SELECT' || (n.querySelector && n.querySelector('select'))) {
          maybeHasSelect = true;
          break;
        }
      }
      if (maybeHasSelect) break;
    }
    if (!maybeHasSelect) return;
    if (_scanTimer) clearTimeout(_scanTimer);
    _scanTimer = setTimeout(function() { _scanTimer = null; scanSelects(); }, 120);
  });

  window.addEventListener('DOMContentLoaded', function() {
    scanSelects();
    globalObserver.observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('click', function(e) {
    document.querySelectorAll('.custom-select-display').forEach(function(display) {
      var panel = display._panel;
      if (panel && !panel.hidden) {
        if (!display.contains(e.target) && !panel.contains(e.target)) {
          panel.hidden = true;
          display.parentNode.classList.remove('open');
        }
      }
    });
  });

  window.addEventListener('scroll', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.custom-select-panel')) return;
    closeAllPanels();
  }, { passive: true, capture: true });

})();