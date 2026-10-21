// js/bind-list.js - 事件绑定：列表 / 分页 / 分类管理 / 批量操作

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
    // ★ 卡片上的标签也支持多选切换
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