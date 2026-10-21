// js/custom-select.js
// 修复内容：
//  - P0-3：滚动监听会把正在操作的下拉面板关掉 → 面板内部滚动不关闭，只有外部滚动才关闭
//  - 顺手：MutationObserver 加 120ms 防抖，避免 DOM 频繁变动时反复全量扫描 select

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

      var spaceBelow = window.innerHeight - rect.bottom;
      var panelHeight = Math.min(240, panel.scrollHeight + 12);

      if (spaceBelow < panelHeight && rect.top > panelHeight) {
        panel.style.top = 'auto';
        panel.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      } else {
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

  function scanSelects() {
    document.querySelectorAll('select').forEach(initCustomSelect);
  }

  function closeAllPanels() {
    document.querySelectorAll('.custom-select-panel').forEach(function(p) { p.hidden = true; });
    document.querySelectorAll('.custom-select-wrap').forEach(function(w) { w.classList.remove('open'); });
  }

  var _scanTimer = null;
  var globalObserver = new MutationObserver(function(mutations) {
    var hasAddedNodes = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) { hasAddedNodes = true; break; }
    }
    if (!hasAddedNodes) return;
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

  // ★ P0-3 修复：面板内部滚动不关闭，只有外部滚动才关闭
  window.addEventListener('scroll', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.custom-select-panel')) return;
    closeAllPanels();
  }, { passive: true, capture: true });

})();