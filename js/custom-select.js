// js/custom-select.js
// ★ 本次改动：
//   1) 每个浮动面板挂 _select 反向引用
//   2) 新增 cleanupOrphanPanels()：扫描 body 上所有 .custom-select-panel，
//      如果它对应的 <select> 已经不在 DOM 里，就把面板移除
//   3) scanSelects() 开头先 cleanupOrphanPanels()，翻页后旧面板会被自动清掉

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
    panel._select = select;  // ★ 新增：反向引用，用于清理孤儿面板

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

  // ★ 新增：清理"对应的 <select> 已经不在 DOM 里"的孤儿面板
  //   场景：翻页时 pagination 整体重建，旧的 <select> 被移除，
  //         但它挂在 body 上的浮动面板还留着 → 这里统一清掉
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
    cleanupOrphanPanels();  // ★ 先清孤儿，再初始化新 select
    document.querySelectorAll('select').forEach(initCustomSelect);
  }

  function closeAllPanels() {
    document.querySelectorAll('.custom-select-panel').forEach(function(p) { p.hidden = true; });
    document.querySelectorAll('.custom-select-wrap').forEach(function(w) { w.classList.remove('open'); });
  }

  // ★ 只有当新加入的节点里确实含 <select> 时才触发扫描
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

  // ★ P0-3 修复：面板内部滚动不关闭，只有外部滚动才关闭
  window.addEventListener('scroll', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.custom-select-panel')) return;
    closeAllPanels();
  }, { passive: true, capture: true });

})();