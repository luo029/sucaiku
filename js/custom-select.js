// js/custom-select.js
// ★ 本次修复：
//   1) 原来 globalObserver 监听整个 body 的 childList，每次页面任何变化都 debounce 120ms
//      然后 scanSelects() 全量 document.querySelectorAll('select')，白扫一大片
//   2) 现在改为：只处理 MutationObserver 回调里新增的节点
//      - 新增节点本身是 SELECT → 初始化
//      - 新增节点里含 SELECT → 遍历它们初始化
//      - 其他（比如只是加了个按钮/div）→ 直接忽略，不再全量扫描
//   3) cleanupOrphanPanels 保留，改为在 MutationObserver 里顺手做（O(panels)，通常 <50，可忽略）
//   4) 初始 DOMContentLoaded 时仍走一次全量 scanSelects()，保证页面已有的 select 都能美化
//
// ★ 上轮已修但本轮未动：
//   - openPanel 里"先显示（visibility:hidden）测量真实高度，再决定上/下开"
//   - 每个浮动面板挂 _select 反向引用
//   - 按钮在屏幕底部时自动向上弹

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

      // ★ 先显示（visibility: hidden）测量真实高度，再决定上/下开
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

  // ★ 清理孤儿面板：select 已从 DOM 里消失，它对应挂到 body 上的 panel 也要删掉
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

  // 全量扫描：只在页面初始化时调用一次（保证页面一开始就有的 select 都被美化）
  function scanAllSelects() {
    cleanupOrphanPanels();
    document.querySelectorAll('select').forEach(initCustomSelect);
  }

  function closeAllPanels() {
    document.querySelectorAll('.custom-select-panel').forEach(function(p) { p.hidden = true; });
    document.querySelectorAll('.custom-select-wrap').forEach(function(w) { w.classList.remove('open'); });
  }

  // ★ 核心修复：只处理新增节点，不再全量扫描
  //   处理完顺手清一下孤儿面板（O(panels)，通常 <50，性能可忽略）
  function handleAddedNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'SELECT') {
      initCustomSelect(node);
      return;
    }
    if (node.querySelectorAll) {
      var selects = node.querySelectorAll('select');
      if (selects.length) {
        for (var i = 0; i < selects.length; i++) initCustomSelect(selects[i]);
      }
    }
  }

  var _scanTimer = null;
  var globalObserver = new MutationObserver(function(mutations) {
    var addedNodes = [];
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        addedNodes.push(added[j]);
      }
    }
    if (!addedNodes.length) return;

    // 先用 debounce 聚合这一波 DOM 变动，避免连续多次插入时反复跑
    if (_scanTimer) clearTimeout(_scanTimer);
    _scanTimer = setTimeout(function() {
      _scanTimer = null;
      // 处理新节点
      for (var k = 0; k < addedNodes.length; k++) handleAddedNode(addedNodes[k]);
      // 顺手清一下已经消失的 select 对应的面板
      cleanupOrphanPanels();
    }, 80);
  });

  window.addEventListener('DOMContentLoaded', function() {
    scanAllSelects();
    globalObserver.observe(document.body, { childList: true, subtree: true });
  });

  // 页面要关闭时，把排队的处理先冲一遍（避免最后一批 select 没初始化）
  window.addEventListener('pagehide', function() {
    if (_scanTimer) {
      clearTimeout(_scanTimer);
      _scanTimer = null;
      cleanupOrphanPanels();
    }
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