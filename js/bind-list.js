// js/bind-list.js - 事件绑定：列表 / 分页 / 分类管理 / 批量操作 / 右键菜单

listEl.addEventListener('click', function (e) {
  var img = e.target.closest('[data-open-img]');
  if (img) { window.open(img.dataset.openImg, '_blank', 'noopener'); return; }

  if (zenMode) {
    var card = e.target.closest('.card');
    if (card) {
      var item = db.items.find(function (i) { return i.id === card.dataset.id; });
      if (item) copyText(item.text, item.source);
    }
    return;
  }

  var tagEl = e.target.closest('.tag-chip');
  if (tagEl && !selectMode) {
    var t = tagEl.dataset.tag;
    if (currentTags.has(t)) {
      currentTags.delete(t);
    } else {
      currentTags.add(t);
    }
    currentTag = currentTags.size > 0 ? Array.from(currentTags)[0] : '';
    currentPage = 1; render(); scrollTop(); return;
  }

  var expandEl = e.target.closest('.expand-btn');
  if (expandEl) {
    var id = expandEl.dataset.expand;
    if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
    renderList(); return;
  }

  var srcEl = e.target.closest('.src-clickable');
  if (srcEl && !selectMode) {
    var s = srcEl.dataset.source;
    if (s && db.sources.indexOf(s) >= 0) {
      currentSource = (currentSource === s) ? ALL_SOURCES : s;
      currentPage = 1; render(); scrollTop();
    }
    return;
  }

  if (selectMode) {
    var card2 = e.target.closest('.card');
    if (card2) toggleSelect(card2.dataset.id);
    return;
  }

  var btn = e.target.closest('button[data-act]'); if (!btn) return;
  var act = btn.dataset.act;
  var item2 = db.items.find(function (i) { return i.id === btn.dataset.id; });
  if (!item2) return;

  if (act === 'copy') copyText(item2.text || '', item2.source);
  if (act === 'edit') startEdit(item2.id);
  if (act === 'del') {
    requestDeleteConfirm(1, function () {
      moveToTrash([item2.id]);
      if (editingId === item2.id) cancelEdit();
      cleanupSources(); save();
      var totalPages = Math.max(1, Math.ceil(getFilteredItems().length / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      render(); toast('已移入回收站');
    });
  }
});

$('pagination').addEventListener('click', function (e) {
  // ★ 优先处理「加载更早历史素材」（由 bind-core.js 中的全局委托处理）
  var loadMoreBtn = e.target.closest('#loadMoreShardsBtn');
  if (loadMoreBtn) return; // 交给 bind-core.js 的 document 委托处理

  var btn = e.target.closest('.page-btn[data-page]');
  if (!btn || btn.disabled) return;
  var p = btn.dataset.page;
  var filtered = getFilteredItems();
  var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
  else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
  else currentPage = parseInt(p, 10);
  renderList(); scrollTop();
});
$('pagination').addEventListener('change', function (e) {
  if (e.target.id === 'pageSizeSelect') {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    renderList();
  }
});

catListEl.addEventListener('change', function (e) {
  var inp = e.target.closest('.cat-name'); if (!inp) return;
  renameCat(Number(inp.dataset.idx), inp.value);
});
catListEl.addEventListener('keydown', function (e) {
  if (e.target.classList.contains('cat-name') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
catListEl.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-cat-del]'); if (!btn) return;
  delCat(Number(btn.dataset.catDel));
});
$('addCatBtn').addEventListener('click', function () { addCat(newCatInput.value); });
newCatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); addCat(newCatInput.value); }
});

$('selectBtn').addEventListener('click', function () {
  selectMode = !selectMode;
  if (!selectMode) selectedIds.clear();
  renderList();
});
$('batchExit').addEventListener('click', function () {
  selectMode = false; selectedIds.clear(); renderList();
});
$('selectAllBtn').addEventListener('click', function () {
  var pageItems = getPageItems(); if (!pageItems.length) return;
  var allSel = pageItems.every(function (i) { return selectedIds.has(i.id); });
  if (allSel) pageItems.forEach(function (i) { selectedIds.delete(i.id); });
  else pageItems.forEach(function (i) { selectedIds.add(i.id); });
  renderList();
});
$('batchDel').addEventListener('click', function () {
  if (!selectedIds.size) { toast('请先选择素材'); return; }
  requestDeleteConfirm(selectedIds.size, function () {
    moveToTrash(Array.from(selectedIds));
    selectedIds.clear(); selectMode = false;
    cleanupSources(); save();
    var totalPages = Math.max(1, Math.ceil(getFilteredItems().length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    render(); toast('已移入回收站');
  });
});
$('batchMoveBtn').addEventListener('click', function () {
  if (!selectedIds.size) { toast('请先选择素材'); return; }
  $('moveCount').textContent = selectedIds.size;
  var opts = db.cats.slice();
  if (db.items.some(function (i) { return i.type === UNCAT; })) opts.push(UNCAT);
  if (!opts.length) opts = [UNCAT];
  $('moveCatSelect').innerHTML = opts.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  $('moveMask').classList.add('show');
});
$('moveCancel').addEventListener('click', function () { $('moveMask').classList.remove('show'); });
$('moveMask').addEventListener('click', function (e) { if (e.target === $('moveMask')) $('moveMask').classList.remove('show'); });
$('moveConfirm').addEventListener('click', function () {
  var t = $('moveCatSelect').value;
  var n = 0;
  db.items.forEach(function (i) {
    if (selectedIds.has(i.id) && i.type !== t) { i.type = t; i.updatedAt = Date.now(); n++; }
  });
  $('moveMask').classList.remove('show');
  selectedIds.clear(); selectMode = false;
  save(); render();
  toast(n ? '已移动 ' + n + ' 条到「' + t + '」' : '没有需要移动的素材');
});
$('batchTagBtn').addEventListener('click', function () {
  if (!selectedIds.size) { toast('请先选择素材'); return; }
  $('tagAddCount').textContent = selectedIds.size;
  $('tagAddInput').value = ''; $('tagAddMask').classList.add('show');
  setTimeout(function () { $('tagAddInput').focus(); }, 60);
});
$('tagAddCancel').addEventListener('click', function () { $('tagAddMask').classList.remove('show'); });
$('tagAddMask').addEventListener('click', function (e) { if (e.target === $('tagAddMask')) $('tagAddMask').classList.remove('show'); });
$('tagAddInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('tagAddConfirm').click(); } });
$('tagAddConfirm').addEventListener('click', function () {
  var raw = $('tagAddInput').value.trim();
  var tags = raw ? raw.split(/[,，\s]+/).filter(Boolean) : [];
  if (!tags.length) { toast('请输入标签'); return; }
  var n = 0;
  db.items.forEach(function (i) {
    if (selectedIds.has(i.id)) {
      var set = new Set(i.tags || []);
      tags.forEach(function (t) { set.add(t); });
      i.tags = Array.from(set); i.updatedAt = Date.now(); n++;
    }
  });
  $('tagAddMask').classList.remove('show');
  save(); render(); toast('已为 ' + n + ' 条素材添加标签');
});

var batchSourceBtn = $('batchSourceBtn');
if (batchSourceBtn) {
  batchSourceBtn.addEventListener('click', function () {
    if (!selectedIds.size) { toast('请先选择素材'); return; }
    $('batchSourceCount').textContent = selectedIds.size;
    $('batchSourceInput').value = '';
    $('batchSourceMask').classList.add('show');
    setTimeout(function () { $('batchSourceInput').focus(); }, 60);
  });
}

var batchSourceCancel = $('batchSourceCancel');
if (batchSourceCancel) {
  batchSourceCancel.addEventListener('click', function () { $('batchSourceMask').classList.remove('show'); });
}
var batchSourceMaskEl = $('batchSourceMask');
if (batchSourceMaskEl) {
  batchSourceMaskEl.addEventListener('click', function (e) {
    if (e.target === batchSourceMaskEl) batchSourceMaskEl.classList.remove('show');
  });
}
var batchSourceInputEl = $('batchSourceInput');
if (batchSourceInputEl) {
  batchSourceInputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('batchSourceConfirm').click(); }
  });
}
var batchSourceConfirmEl = $('batchSourceConfirm');
if (batchSourceConfirmEl) {
  batchSourceConfirmEl.addEventListener('click', function () {
    var newSource = $('batchSourceInput').value.trim();
    var n = 0;
    db.items.forEach(function (i) {
      if (selectedIds.has(i.id)) {
        i.source = newSource;
        i.updatedAt = Date.now();
        n++;
      }
    });
    if (newSource && db.sources.indexOf(newSource) < 0) db.sources.push(newSource);
    selectedIds.clear(); selectMode = false;
    save(); render();
    $('batchSourceMask').classList.remove('show');
    toast('已为 ' + n + ' 条素材设置来源');
  });
}

// ============================================================
// ★ 新增：卡片右键 / 长按快捷菜单
//    受 db.settings.enableContextMenu 控制
// ============================================================
(function () {
  // 注入样式
  if (!document.getElementById('ctxMenuStyle')) {
    var st = document.createElement('style');
    st.id = 'ctxMenuStyle';
    st.textContent = ''
      + '.card-ctx-menu{position:fixed;z-index:300;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px;box-shadow:var(--sh-3);min-width:180px;animation:dropdownIn .15s;}'
      + '.card-ctx-menu button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 14px;border-radius:6px;font-size:14px;color:var(--text-2);background:transparent;border:none;cursor:pointer;transition:background .12s;font-family:inherit;}'
      + '.card-ctx-menu button:hover{background:var(--line);color:var(--text);}'
      + '.card-ctx-menu button.danger{color:var(--danger);}'
      + '.card-ctx-menu button.danger:hover{background:var(--danger-soft);}'
      + '.card-ctx-menu .ctx-divider{height:1px;background:var(--line);margin:4px 6px;}';
    document.head.appendChild(st);
  }

  var ctxMenu = null;
  function closeCtxMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }

  function showCtxMenu(x, y, itemId) {
    closeCtxMenu();
    var item = db.items.find(function (i) { return i.id === itemId; });
    if (!item) return;

    ctxMenu = document.createElement('div');
    ctxMenu.className = 'card-ctx-menu';
    ctxMenu.innerHTML = ''
      + '<button data-ctx="copy">📋 复制内容</button>'
      + '<button data-ctx="edit">✏️ 编辑</button>'
      + '<div class="ctx-divider"></div>'
      + '<button data-ctx="move">📁 移动到分类</button>'
      + '<button data-ctx="tag">🏷 添加标签</button>'
      + '<button data-ctx="source">📚 设置来源</button>'
      + '<div class="ctx-divider"></div>'
      + '<button data-ctx="del" class="danger">🗑 删除（可恢复）</button>';
    document.body.appendChild(ctxMenu);

    // 边界修正
    var rect = ctxMenu.getBoundingClientRect();
    var px = x, py = y;
    if (px + rect.width > window.innerWidth - 8) px = window.innerWidth - rect.width - 8;
    if (py + rect.height > window.innerHeight - 8) py = window.innerHeight - rect.height - 8;
    if (px < 8) px = 8;
    if (py < 8) py = 8;
    ctxMenu.style.left = px + 'px';
    ctxMenu.style.top = py + 'px';

    ctxMenu.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-ctx]');
      if (!btn) return;
      var act = btn.dataset.ctx;
      closeCtxMenu();

      if (act === 'copy') {
        copyText(item.text || '', item.source);
      } else if (act === 'edit') {
        startEdit(item.id);
      } else if (act === 'del') {
        requestDeleteConfirm(1, function () {
          moveToTrash([item.id]);
          if (editingId === item.id) cancelEdit();
          cleanupSources(); save();
          var totalPages = Math.max(1, Math.ceil(getFilteredItems().length / pageSize));
          if (currentPage > totalPages) currentPage = totalPages;
          render(); toast('已移入回收站');
        });
      } else if (act === 'move') {
        var cats = db.cats.slice();
        if (!cats.length) { toast('还没有分类'); return; }
        var target = prompt('移动到分类（输入其中一个）：\n' + cats.join(' / '), item.type);
        if (target && target.trim() && cats.indexOf(target.trim()) >= 0 && target.trim() !== item.type) {
          item.type = target.trim();
          item.updatedAt = Date.now();
          save(); render();
          toast('已移动到「' + target.trim() + '」');
        } else if (target && target.trim() && cats.indexOf(target.trim()) < 0) {
          toast('分类不存在：' + target.trim());
        }
      } else if (act === 'tag') {
        var t = prompt('添加/修改标签（逗号分隔，留空则清空）:', (item.tags || []).join(', '));
        if (t !== null) {
          var cur = t.split(/[,，\s]+/).filter(Boolean);
          item.tags = Array.from(new Set(cur));
          item.updatedAt = Date.now();
          save(); render();
          toast('标签已更新');
        }
      } else if (act === 'source') {
        var s = prompt('设置来源（留空则清空）:', item.source || '');
        if (s !== null) {
          item.source = s.trim();
          if (item.source && db.sources.indexOf(item.source) < 0) db.sources.push(item.source);
          item.updatedAt = Date.now();
          save(); render();
          toast('来源已更新');
        }
      }
    });
  }

  // 桌面端：右键
  document.addEventListener('contextmenu', function (e) {
    if (!db.settings || db.settings.enableContextMenu === false) return;
    var card = e.target.closest('#list .card');
    if (!card) return;
    if (selectMode || zenMode) return;
    if (document.body.classList.contains('focus-mode')) return;
    if (document.body.classList.contains('guest-mode')) return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, card.dataset.id);
  });

  // 移动端：长按 600ms
  var lpTimer = null;
  var lpCard = null;
  var lpX = 0, lpY = 0;
  document.addEventListener('touchstart', function (e) {
    if (!db.settings || db.settings.enableContextMenu === false) return;
    var card = e.target.closest('#list .card');
    if (!card) return;
    if (selectMode || zenMode) return;
    if (document.body.classList.contains('focus-mode')) return;
    if (document.body.classList.contains('guest-mode')) return;
    var touch = e.touches[0];
    lpCard = card;
    lpX = touch.clientX;
    lpY = touch.clientY;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(function () {
      if (lpCard === card) {
        showCtxMenu(lpX, lpY, card.dataset.id);
        lpCard = null;
      }
    }, 600);
  }, { passive: true });
  document.addEventListener('touchend', function () {
    clearTimeout(lpTimer);
    lpCard = null;
  });
  document.addEventListener('touchmove', function (e) {
    if (!lpCard) return;
    var touch = e.touches[0];
    if (Math.abs(touch.clientX - lpX) > 10 || Math.abs(touch.clientY - lpY) > 10) {
      clearTimeout(lpTimer);
      lpCard = null;
    }
  }, { passive: true });

  // 点击外部 / 滚动关闭
  document.addEventListener('click', function (e) {
    if (ctxMenu && !ctxMenu.contains(e.target)) closeCtxMenu();
  });
  document.addEventListener('scroll', closeCtxMenu, { passive: true });
  window.addEventListener('resize', closeCtxMenu);
})();