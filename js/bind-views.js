// js/bind-views.js · 完整文件
// ★ 修复：图床批量修改卡顿。去掉了深拷贝，使用 copyIndexItem 并统一刷新索引。

var safeBind = function (id, event, fn) { var el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

window.showCustomPrompt = function (options) {
  var mask = $('customPromptMask'); if (!mask) return;
  $('cpTitle').textContent = options.title || '输入';
  $('cpDesc').textContent = options.desc || '';
  $('cpInput').value = options.value || '';
  $('cpInput').placeholder = options.placeholder || '';
  var sugBox = $('cpSuggestions');
  if (options.suggestions && options.suggestions.length) { sugBox.style.display = 'flex'; sugBox.innerHTML = options.suggestions.map(function (s) { return '<span class="tag-suggestion-chip" data-val="' + esc(s) + '">' + esc(s) + '</span>'; }).join(''); } else { sugBox.style.display = 'none'; sugBox.innerHTML = ''; }
  mask.classList.add('show');
  setTimeout(function () { $('cpInput').focus(); $('cpInput').select(); }, 50);
  var newConfirm = $('cpConfirm').cloneNode(true); $('cpConfirm').parentNode.replaceChild(newConfirm, $('cpConfirm'));
  var newCancel = $('cpCancel').cloneNode(true); $('cpCancel').parentNode.replaceChild(newCancel, $('cpCancel'));
  newConfirm.addEventListener('click', function () { var val = $('cpInput').value; mask.classList.remove('show'); if (options.onConfirm) options.onConfirm(val); });
  newCancel.addEventListener('click', function () { mask.classList.remove('show'); });
  $('cpInput').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); newConfirm.click(); } if (e.key === 'Escape') newCancel.click(); };
  mask.onclick = function (e) { if (e.target === mask) newCancel.click(); };
  if (options.suggestions && options.suggestions.length) { sugBox.onclick = function (e) { var chip = e.target.closest('.tag-suggestion-chip'); if (chip) { $('cpInput').value = chip.dataset.val; $('cpInput').focus(); } }; }
};

window.showCustomConfirm = function (options) {
  if (typeof options === 'string') options = { desc: options, onConfirm: arguments[1] };
  var mask = $('customConfirmMask'); if (!mask) return;
  $('ccTitle').textContent = options.title || '确认操作';
  $('ccDesc').textContent = options.desc || '确定要执行此操作吗？';
  var confirmBtn = $('ccConfirm'), iconEl = $('ccIcon');
  if (options.isDanger !== false) { confirmBtn.className = 'btn danger-solid'; iconEl.className = 'modal-icon'; }
  else { confirmBtn.className = 'primary'; iconEl.className = 'modal-icon export-icon'; }
  mask.classList.add('show');
  var newConfirm = confirmBtn.cloneNode(true); confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  var newCancel = $('ccCancel').cloneNode(true); $('ccCancel').parentNode.replaceChild(newCancel, $('ccCancel'));
  newConfirm.addEventListener('click', function () { mask.classList.remove('show'); if (options.onConfirm) options.onConfirm(); });
  newCancel.addEventListener('click', function () { mask.classList.remove('show'); });
  mask.onclick = function (e) { if (e.target === mask) mask.classList.remove('show'); };
};

safeBind('batchExportBtn', 'click', function () { if (!selectedIds.size) { toast('请先选择素材'); return; } openExportModal('__selected__'); });
safeBind('layoutBtn', 'click', function () { if (layoutMode === 'sidebar') setLayout('compact'); else setLayout('sidebar'); });
safeBind('sidebarCollapseBtn', 'click', function () { setLayout('compact'); });
safeBind('themeToggleBtn', 'click', function () { setTheme(themeMode === 'light' ? 'dark' : 'light'); });
safeBind('zenBtn', 'click', function () { setZen(true); });
safeBind('zenExitBtn', 'click', function () { setZen(false); });
safeBind('focusBtn', 'click', function () { setFocus(true); });
safeBind('imgViewBtn', 'click', openImgView);
safeBind('imgViewClose', 'click', closeImgView);
safeBind('imgCatTabs', 'click', function (e) { var t = e.target.closest('.ic-tab'); if (!t) return; currentImgViewCat = t.dataset.ic; renderImgView(); });
safeBind('imgMasonry', 'click', function (e) { var img = e.target.closest('[data-open-img]'); if (img) window.open(img.dataset.openImg, '_blank', 'noopener'); });
safeBind('randomContent', 'click', function (e) { var img = e.target.closest('[data-open-img]'); if (img) window.open(img.dataset.openImg, '_blank', 'noopener'); });

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  
  var openMasks = document.querySelectorAll('.modal-mask.show');
  if (openMasks.length > 0) {
    var lastMask = openMasks[openMasks.length - 1];
    if (lastMask.id === 'modalMask') { closeModal(); return; }
    lastMask.classList.remove('show');
    return;
  }

  if (typeof closeImgView === 'function' && $('imgView') && !$('imgView').hidden) { closeImgView(); return; }
  
  if ($('imgManagerView') && !$('imgManagerView').hidden) { if (imgMgrSelectMode) exitImgMgrSelectMode(); else { $('imgManagerView').hidden = true; document.body.style.overflow = ''; } return; }

  if (focusMode) { setFocus(false); return; }
  if (zenMode) { setZen(false); return; }
});

safeBind('menuBtn', 'click', openSidebar);
safeBind('sidebarOverlay', 'click', closeSidebar);
safeBind('modalCancel', 'click', closeModal);
safeBind('modalConfirm', 'click', function () { if ($('noRemind') && $('noRemind').checked) localStorage.setItem(SKIP_KEY, '1'); var fn = pendingConfirm; closeModal(); if (fn) fn(); });
safeBind('modalMask', 'click', function (e) { if (e.target === $('modalMask')) closeModal(); });

safeBind('catManageCloseBtn', 'click', function () { $('catManageMask').classList.remove('show'); });
safeBind('catManageMask', 'click', function (e) { if (e.target === $('catManageMask')) $('catManageMask').classList.remove('show'); });
safeBind('addCatBtnModal', 'click', function () { window.showCustomPrompt({ title: '新建分类', desc: '输入新分类的名称：', placeholder: '分类名称', onConfirm: function (val) { if (val && val.trim()) addCat(val.trim()); } }); });
safeBind('catManageList', 'change', function (e) { var inp = e.target.closest('.cat-name'); if (!inp) return; renameCat(Number(inp.dataset.idx), inp.value); });
safeBind('catManageList', 'keydown', function (e) { if (e.target.classList.contains('cat-name') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
safeBind('catManageList', 'click', function (e) { var btn = e.target.closest('[data-cat-del]'); if (!btn) return; delCat(Number(btn.dataset.catDel)); });
safeBind('catManagePagination', 'click', function (e) { if (e.target.id === 'catPagePrev') { catManagerPage--; renderCatManager(); } else if (e.target.id === 'catPageNext') { catManagerPage++; renderCatManager(); } });

var randomAnimating = false, randomFilterValue = 'all', autoFlipTimer = null;
var randomFontSize = localStorage.getItem('random-font-size') || '20px';
function applyRandomFontSize() { if ($('randomContent')) $('randomContent').style.fontSize = randomFontSize; }
safeBind('randomFontSizeBtn', 'click', function (e) { e.stopPropagation(); if (randomFontSize === '20px') randomFontSize = '24px'; else if (randomFontSize === '24px') randomFontSize = '28px'; else randomFontSize = '20px'; localStorage.setItem('random-font-size', randomFontSize); applyRandomFontSize(); $('randomFontSizeBtn').textContent = randomFontSize === '20px' ? 'Aa' : (randomFontSize === '24px' ? 'Aa+' : 'Aa++'); });
function getRandomPool() {
  if (randomFilterValue === 'all') return db.items;
  if (randomFilterValue === 'text') return db.items.filter(function (i) { return i.text && i.text.trim(); });
  if (randomFilterValue === 'image') return db.items.filter(function (i) { return i.images && i.images.length > 0; });
  if (randomFilterValue.indexOf('cat:') === 0) { var c = randomFilterValue.slice(4); return db.items.filter(function (i) { return i.type === c; }); }
  if (randomFilterValue.indexOf('src:') === 0) { var s = randomFilterValue.slice(4); return db.items.filter(function (i) { return i.source === s; }); }
  if (randomFilterValue.indexOf('tag:') === 0) { var t = randomFilterValue.slice(4); return db.items.filter(function (i) { return (i.tags || []).indexOf(t) >= 0 || (i.images || []).some(function (im) { return (im.tags || []).indexOf(t) >= 0; }); }); }
  return db.items;
}
function renderRandomFilterList() {
  var q = $('randomFilterSearch').value.trim().toLowerCase(); var html = '';
  if (!q) { html += '<div class="sp-item ' + (randomFilterValue === 'all' ? 'sp-selected' : '') + '" data-val="all"><span class="sp-name">全随机</span></div><div class="sp-item ' + (randomFilterValue === 'text' ? 'sp-selected' : '') + '" data-val="text"><span class="sp-name">仅文字素材</span></div><div class="sp-item ' + (randomFilterValue === 'image' ? 'sp-selected' : '') + '" data-val="image"><span class="sp-name">仅图片素材</span></div>'; }
  var cats = db.cats.filter(function (c) { return !q || c.toLowerCase().indexOf(q) >= 0; });
  if (cats.length) { html += '<div class="nav-label" style="padding:8px 12px 4px;font-size:12px;color:var(--text-3);">分类</div>'; cats.forEach(function (c) { html += '<div class="sp-item ' + (randomFilterValue === 'cat:' + c ? 'sp-selected' : '') + '" data-val="cat:' + esc(c) + '"><span class="sp-name">' + esc(c) + '</span></div>'; }); }
  var srcs = db.sources.filter(function (s) { return !q || s.toLowerCase().indexOf(q) >= 0; });
  if (srcs.length) { html += '<div class="nav-label" style="padding:8px 12px 4px;font-size:12px;color:var(--text-3);">来源</div>'; srcs.forEach(function (s) { html += '<div class="sp-item ' + (randomFilterValue === 'src:' + s ? 'sp-selected' : '') + '" data-val="src:' + esc(s) + '"><span class="sp-name">' + esc(s) + '</span></div>'; }); }
  var tags = Object.keys(collectTags()).filter(function (t) { return !q || t.toLowerCase().indexOf(q) >= 0; });
  if (tags.length) { html += '<div class="nav-label" style="padding:8px 12px 4px;font-size:12px;color:var(--text-3);">标签</div>'; tags.forEach(function (t) { html += '<div class="sp-item ' + (randomFilterValue === 'tag:' + t ? 'sp-selected' : '') + '" data-val="tag:' + esc(t) + '"><span class="sp-name">#' + esc(t) + '</span></div>'; }); }
  if (!html) html = '<div class="sp-empty">没有匹配的选项</div>';
  $('randomFilterList').innerHTML = html;
}
safeBind('randomFilterBtn', 'click', function (e) { e.stopPropagation(); $('randomAutoFlipPanel').hidden = true; var panel = $('randomFilterPanel'); if (panel.hidden) { $('randomFilterSearch').value = ''; renderRandomFilterList(); panel.hidden = false; setTimeout(function () { $('randomFilterSearch').focus(); }, 50); } else panel.hidden = true; });
safeBind('randomFilterSearch', 'input', renderRandomFilterList);
safeBind('randomFilterSearch', 'keydown', function (e) { if (e.key === 'Escape') $('randomFilterPanel').hidden = true; });
safeBind('randomFilterList', 'click', function (e) { var item = e.target.closest('.sp-item'); if (!item) return; randomFilterValue = item.dataset.val; var btnText = '全随机'; if (randomFilterValue === 'text') btnText = '仅文字'; else if (randomFilterValue === 'image') btnText = '仅图片'; else if (randomFilterValue.indexOf('cat:') === 0) btnText = '分类: ' + randomFilterValue.slice(4); else if (randomFilterValue.indexOf('src:') === 0) btnText = '来源: ' + randomFilterValue.slice(4); else if (randomFilterValue.indexOf('tag:') === 0) btnText = '标签: #' + randomFilterValue.slice(4); $('randomFilterText').textContent = btnText; var btn = $('randomFilterBtn'); if (randomFilterValue !== 'all') { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; } else { btn.style.borderColor = ''; btn.style.color = ''; } $('randomFilterPanel').hidden = true; drawRandomBox(); });
safeBind('randomAutoFlipToggleBtn', 'click', function (e) { e.stopPropagation(); $('randomFilterPanel').hidden = true; var panel = $('randomAutoFlipPanel'); if (panel.hidden) { $('randomAutoFlipCheck').checked = !!autoFlipTimer; panel.hidden = false; } else panel.hidden = true; });
document.addEventListener('click', function (e) { var fp = $('randomFilterPanel'); if (fp && !fp.hidden && !$('randomFilterBtn').contains(e.target) && !fp.contains(e.target)) fp.hidden = true; var ap = $('randomAutoFlipPanel'); if (ap && !ap.hidden && !$('randomAutoFlipToggleBtn').contains(e.target) && !ap.contains(e.target)) ap.hidden = true; });
function stopAutoFlip() { if (autoFlipTimer) { clearInterval(autoFlipTimer); autoFlipTimer = null; } if ($('randomAutoFlipCheck')) $('randomAutoFlipCheck').checked = false; }
function startAutoFlip() { if (autoFlipTimer) { clearInterval(autoFlipTimer); autoFlipTimer = null; } var check = $('randomAutoFlipCheck'); if (!check || !check.checked) return; var sec = parseInt($('randomAutoFlipTime').value, 10); if (isNaN(sec) || sec < 5) sec = 5; if (sec > 300) sec = 300; $('randomAutoFlipTime').value = sec; autoFlipTimer = setInterval(function () { if (!$('randomMask').classList.contains('show')) { stopAutoFlip(); return; } drawRandomBox(); }, sec * 1000); }
function drawRandomBox() {
  if (randomAnimating) return; if (!db.items.length) { toast('还没有素材'); return; }
  var pool = getRandomPool(); if (pool.length === 0) { toast('当前筛选条件下没有素材'); stopAutoFlip(); return; }
  var item = pool[Math.floor(Math.random() * pool.length)]; var c = catColor(item.type);
  var rc = function () { return '<div style="display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:16px;flex-wrap:wrap;"><span class="tag' + (item.type === IMG_TYPE ? ' tag-img' : '') + '" style="' + (item.type === IMG_TYPE ? '' : 'background:' + c.bg + ';color:' + c.fg) + '">' + esc(item.type) + '</span>' + (item.source ? '<span style="font-size:13.5px;">' + esc(item.source) + '</span>' : '') + (item.tags && item.tags.length ? item.tags.map(function (t) { return '<span class="tag-chip" style="font-size:11.5px;">#' + esc(t) + '</span>'; }).join('') : '') + '</div>' + (item.text ? '<div style="color:var(--text); white-space:pre-wrap; text-align:center;">' + formatText(item.text) + '</div>' : '') + (item.images && item.images.length ? '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;justify-content:center;">' + item.images.map(function (im) { var src = imageSrc(im); return '<img src="' + esc(src) + '" data-open-img="' + esc(src) + '" style="max-width:100%;max-height:260px;border-radius:12px;border:1px solid var(--line);cursor:zoom-in;">'; }).join('') + '</div>' : ''); };
  if (!$('randomMask').classList.contains('show')) { $('randomContent').innerHTML = rc(); $('randomMask').classList.add('show'); $('randomFontSizeBtn').textContent = randomFontSize === '20px' ? 'Aa' : (randomFontSize === '24px' ? 'Aa+' : 'Aa++'); applyRandomFontSize(); return; }
  if (db.settings.enableAnim === false) { $('randomContent').innerHTML = rc(); return; }
  randomAnimating = true; var el = $('randomContent'); el.style.transition = 'all 0.2s ease'; el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
  setTimeout(function () { el.innerHTML = rc(); el.style.transform = 'translateY(-20px)'; el.style.transition = 'none'; void el.offsetWidth; el.style.transition = 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1.15)'; el.style.transform = 'translateY(0)'; el.style.opacity = '1'; setTimeout(function () { randomAnimating = false; }, 350); }, 200);
}
safeBind('menuRandomBtn', 'click', function () { stopAutoFlip(); randomFilterValue = 'all'; $('randomFilterText').textContent = '全随机'; var btn = $('randomFilterBtn'); btn.style.borderColor = ''; btn.style.color = ''; var savedTime = localStorage.getItem('random-auto-flip-time') || '30'; $('randomAutoFlipTime').value = savedTime; $('randomAutoFlipPanel').hidden = true; $('randomFilterPanel').hidden = true; drawRandomBox(); });
safeBind('randomAutoFlipCheck', 'change', function (e) { if (e.target.checked) startAutoFlip(); else stopAutoFlip(); });
safeBind('randomAutoFlipTime', 'change', function (e) { var sec = parseInt(e.target.value, 10); if (isNaN(sec) || sec < 5) sec = 5; if (sec > 300) sec = 300; e.target.value = sec; localStorage.setItem('random-auto-flip-time', sec); if (autoFlipTimer) startAutoFlip(); });
safeBind('randomCloseBtn', 'click', function () { stopAutoFlip(); $('randomMask').classList.remove('show'); });
safeBind('randomAgainBtn', 'click', function () { drawRandomBox(); if (autoFlipTimer) startAutoFlip(); });
safeBind('randomMask', 'click', function (e) { if (e.target === $('randomMask')) { stopAutoFlip(); $('randomMask').classList.remove('show'); } });

safeBind('menuDupBtn', 'click', checkDuplicates);
safeBind('dupCloseBtn', 'click', function () { $('dupMask').classList.remove('show'); });
safeBind('dupMask', 'click', function (e) { if (e.target === $('dupMask')) $('dupMask').classList.remove('show'); });
safeBind('dupList', 'click', function (e) { var btn = e.target.closest('[data-del-dup]'); if (btn) { moveToTrash([btn.dataset.delDup]); save(); render(); toast('已移入回收站'); checkDuplicates(); } });
safeBind('menuStatsBtn', 'click', openStats);
safeBind('statsCloseBtn', 'click', function () { $('statsMask').classList.remove('show'); });
safeBind('statsMask', 'click', function (e) { if (e.target === $('statsMask')) $('statsMask').classList.remove('show'); });
safeBind('menuHealthBtn', 'click', openHealth);
safeBind('healthCloseBtn', 'click', function () { $('healthMask').classList.remove('show'); });
safeBind('healthMask', 'click', function (e) { if (e.target === $('healthMask')) $('healthMask').classList.remove('show'); });
safeBind('healthList', 'click', function (e) { var row = e.target.closest('[data-edit]'); if (!row) return; var id = row.dataset.edit; $('healthMask').classList.remove('show'); if (db.items.some(function (i) { return i.id === id; })) startEdit(id); else toast('该素材已不存在'); });
safeBind('menuTrashBtn', 'click', function () { cleanTrash(); renderTrash(); $('trashMask').classList.add('show'); });
safeBind('trashCloseBtn', 'click', function () { $('trashMask').classList.remove('show'); });
safeBind('trashMask', 'click', function (e) { if (e.target === $('trashMask')) $('trashMask').classList.remove('show'); });
safeBind('trashClearBtn', 'click', function () { if (!db.trash.length) { toast('回收站已经是空的'); return; } window.showCustomConfirm({ title: '清空回收站', desc: '确定清空回收站吗？' + db.trash.length + ' 条素材将被彻底删除。', isDanger: true, onConfirm: function () { db.trash = []; save(); renderTrash(); toast('已清空回收站'); } }); });
safeBind('trashList', 'click', function (e) { var r = e.target.closest('[data-restore]'); if (r) { restoreFromTrash(r.dataset.restore); return; } var p = e.target.closest('[data-purge]'); if (p) { window.showCustomConfirm({ title: '彻底删除', desc: '确定彻底删除这条素材吗？此操作不可恢复。', isDanger: true, onConfirm: function () { purgeTrashItem(p.dataset.purge); toast('已彻底删除'); } }); } });

safeBind('menuImgManagerBtn', 'click', function () { $('menu').classList.remove('show'); openImgManager(); });
safeBind('imgMgrCloseBtn', 'click', function () { if (imgMgrSelectMode) exitImgMgrSelectMode(); $('imgManagerView').hidden = true; document.body.style.overflow = ''; });
safeBind('imgMgrRefreshBtn', 'click', loadRepoImages);
safeBind('imgMgrSelectBtn', 'click', function () { imgMgrSelectMode = !imgMgrSelectMode; imgMgrSelectedIds.clear(); renderImgMgrUI(); }); 
safeBind('imgMgrBatchExit', 'click', function () { exitImgMgrSelectMode(); });

safeBind('imgMgrSelectAllBtn', 'click', function () {
  if (typeof window.getImgMgrFilteredFiles !== 'function') {
    toast('图床模块未就绪，请刷新页面');
    return;
  }
  var files = window.getImgMgrFilteredFiles() || [];
  if (!files.length) return;
  var allSel = files.every(function (f) { return imgMgrSelectedIds.has(f.relPath); });
  if (allSel) {
    files.forEach(function (f) { imgMgrSelectedIds.delete(f.relPath); });
  } else {
    files.forEach(function (f) { imgMgrSelectedIds.add(f.relPath); });
  }
  renderImgMgrUI();
});

safeBind('imgMgrBatchCatBtn', 'click', function () { if (!imgMgrSelectedIds.size) return toast('请先选择图片'); $('imgMgrBatchEditTitle').textContent = '批量修改分类'; $('imgMgrBatchEditCount').textContent = imgMgrSelectedIds.size; $('imgMgrBatchCatWrap').style.display = 'block'; $('imgMgrBatchTagWrap').style.display = 'none'; var cats = (db.imageCategories.length ? db.imageCategories : DEFAULT_IMG_CATS); var grid = $('imgMgrBatchCatGrid'); grid.innerHTML = cats.map(function (c) { return '<div class="batch-cat-item" data-cat="' + esc(c) + '">' + esc(c) + '</div>'; }).join(''); var first = grid.querySelector('.batch-cat-item'); if (first) { first.classList.add('active'); grid.dataset.selected = first.dataset.cat; } $('imgMgrBatchEditMask').classList.add('show'); });
$('imgMgrBatchCatGrid') && $('imgMgrBatchCatGrid').addEventListener('click', function (e) { var item = e.target.closest('.batch-cat-item'); if (!item) return; var grid = $('imgMgrBatchCatGrid'); grid.querySelectorAll('.batch-cat-item').forEach(function (el) { el.classList.remove('active'); }); item.classList.add('active'); grid.dataset.selected = item.dataset.cat; });
var selectedBatchTags = new Set();
safeBind('imgMgrBatchTagBtn', 'click', function () { if (!imgMgrSelectedIds.size) return toast('请先选择图片'); $('imgMgrBatchEditTitle').textContent = '批量修改标签'; $('imgMgrBatchEditCount').textContent = imgMgrSelectedIds.size; $('imgMgrBatchCatWrap').style.display = 'none'; $('imgMgrBatchTagWrap').style.display = 'block'; $('imgMgrBatchTagNewInput').value = ''; $('imgMgrBatchTagSearch').value = ''; $('imgMgrBatchTagPoolWrap').style.display = 'none'; selectedBatchTags.clear(); repoImagesCache.forEach(function (f) { if (imgMgrSelectedIds.has(f.relPath)) (f.tags || []).forEach(function (t) { selectedBatchTags.add(t); }); }); renderBatchTagPool(); $('imgMgrBatchEditMask').classList.add('show'); });
function renderBatchTagPool() {
  var selectedWrap = $('imgMgrBatchSelectedTags');
  if (selectedWrap) { if (selectedBatchTags.size === 0) selectedWrap.innerHTML = '<span style="font-size:13px;color:var(--text-3);">暂无标签</span>'; else selectedWrap.innerHTML = Array.from(selectedBatchTags).map(function (t) { return '<span class="batch-tag-item active" style="cursor:default;padding:4px 10px;">#' + esc(t) + ' <span data-remove-tag="' + esc(t) + '" style="cursor:pointer;margin-left:4px;" title="移除">×</span></span>'; }).join(''); }
  var q = $('imgMgrBatchTagSearch').value.trim().toLowerCase(); var allTags = Object.keys(collectTags()).sort(function (a, b) { return a.localeCompare(b, 'zh'); }); var pool = $('imgMgrBatchTagPool');
  if (!allTags.length) { pool.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);">暂无标签</div>'; return; }
  var filtered = allTags.filter(function (t) { return !q || t.toLowerCase().indexOf(q) >= 0; });
  if (!filtered.length) { pool.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);">没有匹配</div>'; return; }
  pool.innerHTML = filtered.map(function (t) { var isSel = selectedBatchTags.has(t); return '<div class="batch-tag-item ' + (isSel ? 'active' : '') + '" data-tag="' + esc(t) + '">' + (isSel ? '✓ ' : '') + '#' + esc(t) + '</div>'; }).join('');
}
$('imgMgrBatchTagSearch') && $('imgMgrBatchTagSearch').addEventListener('input', renderBatchTagPool);
$('imgMgrBatchSelectedTags') && $('imgMgrBatchSelectedTags').addEventListener('click', function (e) { var btn = e.target.closest('[data-remove-tag]'); if (!btn) return; selectedBatchTags.delete(btn.dataset.removeTag); renderBatchTagPool(); });
$('imgMgrBatchTagPool') && $('imgMgrBatchTagPool').addEventListener('click', function (e) { var item = e.target.closest('.batch-tag-item'); if (!item) return; var t = item.dataset.tag; if (selectedBatchTags.has(t)) selectedBatchTags.delete(t); else selectedBatchTags.add(t); renderBatchTagPool(); });
safeBind('imgMgrBatchTagSearchBtn', 'click', function () { var wrap = $('imgMgrBatchTagPoolWrap'); if (wrap.style.display === 'none') { wrap.style.display = 'block'; $('imgMgrBatchTagSearch').focus(); } else { wrap.style.display = 'none'; $('imgMgrBatchTagSearch').value = ''; renderBatchTagPool(); } });
safeBind('imgMgrBatchTagAddBtn', 'click', function () { var val = $('imgMgrBatchTagNewInput').value.trim(); if (!val) return; val.split(/[,，\s]+/).filter(Boolean).forEach(function (t) { selectedBatchTags.add(t); }); $('imgMgrBatchTagNewInput').value = ''; renderBatchTagPool(); });
safeBind('imgMgrBatchTagNewInput', 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('imgMgrBatchTagAddBtn').click(); } });
safeBind('imgMgrBatchEditCancel', 'click', function () { $('imgMgrBatchEditMask').classList.remove('show'); });
safeBind('imgMgrBatchEditConfirm', 'click', function () {
  var isCat = $('imgMgrBatchEditTitle').textContent.indexOf('分类') >= 0; var updatedCount = 0;
  if (isCat) {
    var newCat = $('imgMgrBatchCatGrid').dataset.selected; if (!newCat) return toast('请选择分类');
    repoImagesCache.forEach(function (f) { if (imgMgrSelectedIds.has(f.relPath)) f.cat = newCat; });
    db.items.forEach(function (item) { if (item.images) item.images.forEach(function (im) { if (!im.path) return; var ip = String(im.path).trim(); imgMgrSelectedIds.forEach(function (relPath) { var rp = String(relPath).trim(); var fn = relPath.split('/').pop(); if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.indexOf(fn) >= 0) { im.cat = newCat; markItemDirty(item); updatedCount++; } }); }); });
  } else {
    var newTags = Array.from(selectedBatchTags);
    repoImagesCache.forEach(function (f) { if (imgMgrSelectedIds.has(f.relPath)) f.tags = newTags.slice(); });
    db.items.forEach(function (item) { if (item.images) item.images.forEach(function (im) { if (!im.path) return; var ip = String(im.path).trim(); imgMgrSelectedIds.forEach(function (relPath) { var rp = String(relPath).trim(); var fn = relPath.split('/').pop(); if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.indexOf(fn) >= 0) { im.tags = newTags.slice(); markItemDirty(item); updatedCount++; } }); }); });
  }
  if (updatedCount > 0) markIndexDirty();
  save(); $('imgMgrBatchEditMask').classList.remove('show'); exitImgMgrSelectMode();
});
safeBind('imgMgrBatchDelBtn', 'click', function () {
  if (!imgMgrSelectedIds.size) return toast('请先选择图片'); var count = imgMgrSelectedIds.size;
  window.showCustomConfirm({ title: '彻底删除图片', desc: '确定要彻底删除 ' + count + ' 张图片吗？不可恢复！', isDanger: true, onConfirm: async function () {
    var btn = $('imgMgrBatchDelBtn'), origText = btn.innerHTML; btn.disabled = true;
    var rc = ghRepoConfig('img'); var success = 0, fail = 0, done = 0;
    var toDelete = repoImagesCache.filter(function (f) { return imgMgrSelectedIds.has(f.relPath); });
    async function deleteOne(f) { try { var fullPath = rc.path + '/' + f.relPath; var res = await fetch(ghApiUrl(rc, fullPath), { method: 'DELETE', headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'delete ' + f.relPath, sha: f.sha, branch: rc.branch }) }); if (res.ok) { success++; repoImagesCache = repoImagesCache.filter(function (x) { return x.relPath !== f.relPath; }); } else fail++; } catch (e) { fail++; } finally { done++; btn.innerHTML = '删除中 ' + done + '/' + toDelete.length; } }
    try {
      var idx = 0; async function worker() { while (idx < toDelete.length) { var i = idx++; await deleteOne(toDelete[i]); await new Promise(function (r) { setTimeout(r, 200); }); } }
      await Promise.all(Array.from({ length: Math.min(3, toDelete.length) }, function () { return worker(); }));
      var affected = new Set();
      db.items.forEach(function (item) { if (item.images) { var before = item.images.length; item.images = item.images.filter(function (im) { if (!im.path) return true; var ip = String(im.path).trim(); return !toDelete.some(function (f) { var rp = String(f.relPath).trim(); return ip === rp || ip.endsWith(rp) || rp.endsWith(ip); }); }); if (item.images.length !== before) { affected.add(item.id); markItemDirty(item); _indexUpdateItem(item, item); } } });
      if (affected.size > 0) { db.items = db.items.filter(function (i) { if (!affected.has(i.id)) return true; return i.text || (i.images && i.images.length > 0); }); markIndexDirty(); save(); render(); }
      toast('清理完成：成功 ' + success + '，失败 ' + fail);
    } finally { btn.disabled = false; btn.innerHTML = origText; exitImgMgrSelectMode(); }
  } });
});
safeBind('imgMgrGrid', 'click', function (e) {
  var rmTagBtn = e.target.closest('[data-rm-tag]');
  if (rmTagBtn) { e.stopPropagation(); var relPath = rmTagBtn.dataset.relPath; var tag = rmTagBtn.dataset.rmTag; var imgItem = repoImagesCache.find(function (x) { return x.relPath === relPath; }); if (imgItem) imgItem.tags = (imgItem.tags || []).filter(function (t) { return t !== tag; }); db.items.forEach(function (item) { if (item.images) item.images.forEach(function (im) { if (!im.path) return; var ip = String(im.path).trim(); var rp = String(relPath).trim(); var fn = relPath.split('/').pop(); if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.indexOf(fn) >= 0) { if (im.tags) im.tags = im.tags.filter(function (t) { return t !== tag; }); markItemDirty(item); _indexUpdateItem(item, item); } }); }); save(); renderImgMgrUI(); return; }
  if (imgMgrSelectMode) { var card = e.target.closest('.mgr-card'); if (card && card.dataset.relPath) toggleSelectImgMgr(card.dataset.relPath); return; }
  var delBtn = e.target.closest('[data-del-img-mgr]'); if (delBtn) { e.stopPropagation(); deleteRepoImage(delBtn.dataset.delImgMgr, delBtn.dataset.sha); return; }
  var img = e.target.closest('[data-open-img]'); if (img) window.open(img.dataset.openImg, '_blank', 'noopener');
});

safeBind('menuExportBtn', 'click', function () { openExportModal(); });
safeBind('menuImportBtn', 'click', function () { $('fileInput').click(); });
safeBind('moreBtn', 'click', function (e) { e.stopPropagation(); $('menu').classList.toggle('show'); });
document.addEventListener('click', function () { if ($('menu')) $('menu').classList.remove('show'); });
safeBind('menu', 'click', function (e) { if (e.target.closest('button')) $('menu').classList.remove('show'); });
safeBind('sidebarExportBtn', 'click', function () { if (!db.items.length) { toast('还没有素材'); return; } openExportModal(); });
safeBind('exportCancel', 'click', closeExportModal);
safeBind('exportConfirm', 'click', doExport);
safeBind('exportMask', 'click', function (e) { if (e.target === $('exportMask')) closeExportModal(); });
safeBind('exportFormat', 'click', function (e) { var b = e.target.closest('button[data-fmt]'); if (!b) return; exportFormat = b.dataset.fmt; $('exportFormat').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); }); });
safeBind('sidebarImportBtn', 'click', function () { $('fileInput').click(); });
safeBind('fileInput', 'change', function (e) { var f = e.target.files[0]; if (!f) return; handleImportFile(f); e.target.value = ''; });

safeBind('settingCloseBtn', 'click', function () { if ($('settingMask')) $('settingMask').classList.remove('show'); });
safeBind('settingMask', 'click', function (e) { if (e.target === $('settingMask')) $('settingMask').classList.remove('show'); });
safeBind('settingTabs', 'click', function (e) {
  var btn = e.target.closest('.st-tab'); if (!btn) return;
  $('settingTabs').querySelectorAll('.st-tab').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active');
  var target = btn.dataset.target;
  document.querySelectorAll('.st-scroll .st-card').forEach(function (card) { card.style.display = (card.dataset.group === target) ? 'block' : 'none'; });
  if (target === 'logs') renderLogView(); if (target === 'devices') renderDeviceList(); if (target === 'sync') refreshStorageInfo(); if (target === 'data' && typeof renderSnapshotsList === 'function') renderSnapshotsList();
});
function resetSettingsTabs() { var tabs = document.querySelectorAll('#settingTabs .st-tab'); tabs.forEach(function (b) { b.classList.toggle('active', b.dataset.target === 'general'); }); document.querySelectorAll('.st-scroll .st-card').forEach(function (card) { card.style.display = (card.dataset.group === 'general') ? 'block' : 'none'; }); }
function openSettings() { renderStyleOptions(); applySettingsToUI(); fillGHForm(); updateTinyUsageUI(); renderSettingsOverview(); resetSettingsTabs(); var sc = document.querySelector('.st-scroll'); if (sc) sc.scrollTop = 0; $('settingMask').classList.add('show'); if (typeof window.updateImgNamingPreview === 'function') setTimeout(function () { window.updateImgNamingPreview(); }, 50); }
safeBind('menuSettingBtn', 'click', openSettings); safeBind('gearBtn', 'click', openSettings);

safeBind('runSelfTestBtn', 'click', function () {
  if (typeof window.runSelfTest === 'function') {
    $('settingMask').classList.remove('show');
    window.runSelfTest();
  } else {
    toast('自检模块未加载，请刷新页面或检查 selftest.js');
  }
});

safeBind('focusModeCatInput', 'change', function (e) { db.settings.focusModeCat = e.target.value.trim() || '收件箱'; saveSettings(); toast('安心输入分类设为「' + db.settings.focusModeCat + '」'); });
safeBind('openFocusModeBtn', 'click', function () { $('settingMask').classList.remove('show'); setFocus(true); });
safeBind('focusExitBtn', 'click', function () { setFocus(false); });
safeBind('themeDarkToggle', 'change', function (e) { setTheme(e.target.checked ? 'dark' : 'light'); });
safeBind('useRelativeTimeToggle', 'change', function (e) { db.settings.useRelativeTime = e.target.checked; saveSettings(); renderList(); toast(e.target.checked ? '已切换为相对时间' : '已切换为绝对时间'); });
safeBind('saveShortcut', 'click', function (e) { var b = e.target.closest('button[data-shortcut]'); if (!b) return; db.settings.saveShortcut = b.dataset.shortcut; saveSettings(); applySettingsToUI(); toast('保存快捷键已更新'); });
safeBind('uiStyleMode', 'click', function (e) { var b = e.target.closest('button[data-style]'); if (!b) return; db.settings.uiStyle = b.dataset.style; saveSettings(); renderStyleOptions(); applySettingsToUI(); var name = AVAILABLE_STYLES.find(function (s) { return s.id === db.settings.uiStyle; }); toast('已切换至「' + (name ? name.name : '新风格') + '」'); });
safeBind('listStyleMode', 'click', function (e) { var b = e.target.closest('button[data-style]'); if (!b) return; db.settings.listStyle = b.dataset.style; saveSettings(); applySettingsToUI(); toast('列表排版已调整'); });
safeBind('zenFontSize', 'click', function (e) { var b = e.target.closest('button[data-zfs]'); if (!b) return; db.settings.zenFontSize = b.dataset.zfs; saveSettings(); applySettingsToUI(); toast('极简模式字号已调整'); });

safeBind('zenAutoClosePanel', 'change', function (e) {
  db.settings.zenAutoClosePanel = e.target.checked;
  saveSettings();
  toast(e.target.checked ? '✅ 已开启：滑动页面时面板自动收起' : '❌ 已关闭：滑动时面板不收起');
});

safeBind('sidebarShowCat', 'change', function (e) { db.settings.sidebarShowCat = e.target.checked; saveSettings(); applySettingsToUI(); });
safeBind('sidebarShowSrc', 'change', function (e) { db.settings.sidebarShowSrc = e.target.checked; saveSettings(); applySettingsToUI(); });
safeBind('sidebarShowTag', 'change', function (e) { db.settings.sidebarShowTag = e.target.checked; saveSettings(); applySettingsToUI(); });
safeBind('copyWithSource', 'change', function (e) { db.settings.copyWithSource = e.target.checked; if ($('copySourceFormatWrap')) $('copySourceFormatWrap').style.display = e.target.checked ? 'block' : 'none'; saveSettings(); });
safeBind('copySourceFormat', 'change', function (e) { db.settings.copySourceFormat = e.target.value; saveSettings(); });
safeBind('enableMarkdown', 'change', function (e) { db.settings.enableMarkdown = e.target.checked; saveSettings(); renderList(); });
safeBind('copyWithoutMarks', 'change', function (e) { db.settings.copyWithoutMarks = e.target.checked; saveSettings(); });
safeBind('copyKeepBlankLines', 'change', function (e) { db.settings.copyKeepBlankLines = e.target.checked; saveSettings(); });
safeBind('trashTtlInput', 'change', function (e) { var v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 30)); e.target.value = v; db.settings.trashTtlDays = v; saveSettings(); cleanTrash(); renderTrash(); });
safeBind('statLimitInput', 'change', function (e) { var v = Math.max(3, Math.min(30, parseInt(e.target.value, 10) || 8)); e.target.value = v; db.settings.statsLimit = v; saveSettings(); });
safeBind('statDimCat', 'change', function (e) { db.settings.statsDims.cat = e.target.checked; saveSettings(); });
safeBind('statDimSource', 'change', function (e) { db.settings.statsDims.source = e.target.checked; saveSettings(); });
safeBind('statDimTag', 'change', function (e) { db.settings.statsDims.tag = e.target.checked; saveSettings(); });
safeBind('catLimitInput', 'change', function (e) { var v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.catLimit = v; saveSettings(); renderSidebar(); });
safeBind('srcLimitInput', 'change', function (e) { var v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.srcLimit = v; saveSettings(); renderSidebar(); });
safeBind('tagLimitInput', 'change', function (e) { var v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.tagLimit = v; saveSettings(); renderTags(); });
safeBind('defaultTypeSelect', 'change', function (e) { db.settings.defaultType = e.target.value; saveSettings(); refreshTypeSelect(db.settings.defaultType || db.cats[0] || ''); });
safeBind('collapseLimitInput', 'change', function (e) { var v = Math.max(50, Math.min(9999, parseInt(e.target.value, 10) || 150)); e.target.value = v; db.settings.collapseLimit = v; saveSettings(); renderList(); });
safeBind('defaultPageSizeSelect', 'change', function (e) { var v = parseInt(e.target.value, 10); db.settings.defaultPageSize = v; pageSize = v; currentPage = 1; saveSettings(); renderList(); });
safeBind('showHitokoto', 'change', function (e) { db.settings.showHitokoto = e.target.checked; saveSettings(); applySettingsToUI(); });
safeBind('enableAnim', 'change', function (e) { db.settings.enableAnim = e.target.checked; saveSettings(); applySettingsToUI(); });
safeBind('fontSizeMode', 'click', function (e) { var b = e.target.closest('button[data-size]'); if (!b) return; db.settings.fontSizeMode = b.dataset.size; saveSettings(); applySettingsToUI(); });
safeBind('focusImgAutoUpload', 'change', function (e) { db.settings.focusImgAutoUpload = e.target.checked; saveSettings(); if ($('focusImgCatWrap')) $('focusImgCatWrap').style.display = e.target.checked ? 'block' : 'none'; });
safeBind('focusImgDefaultCat', 'change', function (e) { db.settings.focusImgDefaultCat = e.target.value; saveSettings(); });
safeBind('compressMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.compressMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('tinypngKey', 'change', function (e) { db.settings.tinypngKey = e.target.value.trim(); saveSettings(); });
safeBind('tinypngProxy', 'change', function (e) { db.settings.tinypngProxy = e.target.value.trim(); saveSettings(); });

safeBind('enableShortcuts', 'change', function (e) { db.settings.enableShortcuts = e.target.checked; saveSettings(); toast(e.target.checked ? '已开启全局快捷键' : '已关闭全局快捷键'); });
safeBind('shortcutSearch', 'change', function (e) { var v = (e.target.value || '').trim(); if (!v) v = '/'; v = v.charAt(0); db.settings.shortcutSearch = v; e.target.value = v; saveSettings(); toast('搜索快捷键已设为 ' + v); });
safeBind('shortcutSearch', 'input', function (e) { if (e.target.value.length > 1) e.target.value = e.target.value.charAt(0); });
safeBind('shortcutNew', 'change', function (e) { var v = (e.target.value || '').trim().toLowerCase(); if (!v) v = 'n'; v = v.charAt(0); db.settings.shortcutNew = v; e.target.value = v; saveSettings(); toast('新建快捷键已设为 ' + v.toUpperCase()); });
safeBind('shortcutNew', 'input', function (e) { if (e.target.value.length > 1) e.target.value = e.target.value.charAt(0); });
safeBind('enableContextMenu', 'change', function (e) { db.settings.enableContextMenu = e.target.checked; saveSettings(); toast(e.target.checked ? '已开启右键/长按菜单' : '已关闭右键/长按菜单'); });
safeBind('maxTagsInHeader', 'change', function (e) { var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.maxTagsInHeader = v; saveSettings(); renderHeader(); toast('标签折叠阈值已设为 ' + v + ' 个'); });

safeBind('shardMaxSizeKB', 'change', function (e) { var v = Math.max(200, Math.min(2000, parseInt(e.target.value, 10) || 650)); e.target.value = v; db.settings.shardMaxSizeKB = v; saveSettings(); });
safeBind('shardSplitEnabled', 'change', function (e) { db.settings.shardSplitEnabled = e.target.checked; saveSettings(); });
safeBind('gitTreeBatchEnabled', 'change', function (e) { db.settings.gitTreeBatchEnabled = e.target.checked; saveSettings(); });
safeBind('pushRetryCount', 'change', function (e) { var v = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.pushRetryCount = v; saveSettings(); });
safeBind('pushRetryDelaySec', 'change', function (e) { var v = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 10)); e.target.value = v; db.settings.pushRetryDelaySec = v; saveSettings(); });
safeBind('syncStatusIcon', 'change', function (e) { db.settings.syncStatusIcon = e.target.checked; saveSettings(); if (typeof updateSyncStatusIcon === 'function') updateSyncStatusIcon(); });
safeBind('showSyncProgress', 'change', function (e) { db.settings.showSyncProgress = e.target.checked; saveSettings(); });

safeBind('catSyncAction', 'click', function (e) { var b = e.target.closest('button[data-act]'); if (!b) return; db.settings.catSyncAction = b.dataset.act; saveSettings(); applySettingsToUI(); toast('分类同步策略已更新'); });
safeBind('catConflictMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.catConflictMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });

safeBind('snapshotEnabled', 'change', function (e) { db.settings.snapshotEnabled = e.target.checked; saveSettings(); });
safeBind('snapshotDailyKeep', 'change', function (e) { var v = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)); e.target.value = v; db.settings.snapshotDailyKeep = v; saveSettings(); });
safeBind('snapshotWeeklyKeep', 'change', function (e) { var v = Math.max(0, Math.min(26, parseInt(e.target.value, 10) || 0)); e.target.value = v; db.settings.snapshotWeeklyKeep = v; saveSettings(); });
safeBind('snapshotMonthlyKeep', 'change', function (e) { var v = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)); e.target.value = v; db.settings.snapshotMonthlyKeep = v; saveSettings(); });
safeBind('snapshotManualKeep', 'change', function (e) { var v = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 10)); e.target.value = v; db.settings.snapshotManualKeep = v; saveSettings(); });
safeBind('snapshotMaxAgeDays', 'change', function (e) { var v = Math.max(30, Math.min(3650, parseInt(e.target.value, 10) || 180)); e.target.value = v; db.settings.snapshotMaxAgeDays = v; saveSettings(); });
safeBind('snapshotChangeThreshold', 'change', function (e) { var v = Math.max(10, Math.min(10000, parseInt(e.target.value, 10) || 100)); e.target.value = v; db.settings.snapshotChangeThreshold = v; saveSettings(); });
safeBind('snapshotForceDays', 'change', function (e) { var v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 7)); e.target.value = v; db.settings.snapshotForceDays = v; saveSettings(); });
safeBind('snapshotCompress', 'change', function (e) { db.settings.snapshotCompress = e.target.checked; saveSettings(); });
safeBind('snapshotAutoCleanup', 'change', function (e) { db.settings.snapshotAutoCleanup = e.target.checked; saveSettings(); });
safeBind('snapshotPath', 'change', function (e) { db.settings.snapshotPath = e.target.value.trim() || 'snapshots/'; saveSettings(); });
safeBind('snapshotNowBtn', 'click', function () { if (typeof createSnapshot === 'function') { createSnapshot('manual').then(function () { toast('快照已创建'); if (typeof renderSnapshotsList === 'function') renderSnapshotsList(); }).catch(function (e) { toast('创建失败：' + e.message); }); } });
safeBind('snapshotListViewBtn', 'click', function () { if (typeof openSnapshotListView === 'function') openSnapshotListView(); });
safeBind('trashAutoCleanupThreshold', 'change', function (e) { var v = Math.max(100, Math.min(100000, parseInt(e.target.value, 10) || 1000)); e.target.value = v; db.settings.trashAutoCleanupThreshold = v; saveSettings(); });

safeBind('loadMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.loadMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('smartThresholdMB', 'change', function (e) { var v = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5)); e.target.value = v; db.settings.smartThresholdMB = v; saveSettings(); });
safeBind('manualRangeDays', 'change', function (e) { db.settings.manualRangeDays = parseInt(e.target.value, 10) || 90; saveSettings(); });
safeBind('historyLoadMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.historyLoadMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('lazyLoadBatchSize', 'change', function (e) { db.settings.lazyLoadBatchSize = parseInt(e.target.value, 10) || 30; saveSettings(); });
safeBind('pullConcurrency', 'change', function (e) { var v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 8)); e.target.value = v; db.settings.pullConcurrency = v; saveSettings(); });
safeBind('maxShardSizeKB', 'change', function (e) { var v = Math.max(500, Math.min(2048, parseInt(e.target.value, 10) || 800)); e.target.value = v; db.settings.maxShardSizeKB = v; saveSettings(); });
safeBind('startupAutoPull', 'change', function (e) { db.settings.startupAutoPull = e.target.checked; saveSettings(); });
safeBind('cloudCheckEnabled', 'change', function (e) { db.settings.cloudCheckEnabled = e.target.checked; saveSettings(); if (typeof restartSyncTimer === 'function') restartSyncTimer(); });
safeBind('checkIntervalSeconds', 'change', function (e) { var v = Math.max(10, Math.min(3600, parseInt(e.target.value, 10) || 60)); e.target.value = v; db.settings.checkIntervalSeconds = v; saveSettings(); if (typeof restartSyncTimer === 'function') restartSyncTimer(); });
safeBind('autoPush', 'change', function (e) { db.settings.autoPush = e.target.checked; saveSettings(); });
safeBind('forceConfirm', 'change', function (e) { db.settings.forceConfirm = e.target.checked; saveSettings(); });
safeBind('snapshotBeforePush', 'change', function (e) { db.settings.snapshotBeforePush = e.target.checked; saveSettings(); });
safeBind('pushDelayMs', 'change', function (e) { var v = Math.max(500, Math.min(60000, parseInt(e.target.value, 10) || 2000)); e.target.value = v; db.settings.pushDelayMs = v; saveSettings(); });
safeBind('pushConcurrency', 'change', function (e) { var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.pushConcurrency = v; saveSettings(); });
safeBind('pushBatchDelay', 'change', function (e) { var v = Math.max(200, Math.min(5000, parseInt(e.target.value, 10) || 500)); e.target.value = v; db.settings.pushBatchDelay = v; saveSettings(); });
safeBind('conflictAction', 'click', function (e) { var b = e.target.closest('button[data-act]'); if (!b) return; db.settings.conflictAction = b.dataset.act; saveSettings(); applySettingsToUI(); });
safeBind('searchScope', 'click', function (e) { var b = e.target.closest('button[data-scope]'); if (!b) return; db.settings.searchScope = b.dataset.scope; saveSettings(); applySettingsToUI(); });
safeBind('unloadedSearch', 'click', function (e) { var b = e.target.closest('button[data-act]'); if (!b) return; db.settings.unloadedSearch = b.dataset.act; saveSettings(); applySettingsToUI(); });
safeBind('searchDebounceMs', 'change', function (e) { var v = Math.max(80, Math.min(500, parseInt(e.target.value, 10) || 180)); e.target.value = v; db.settings.searchDebounceMs = v; saveSettings(); });
safeBind('autoCompleteChars', 'change', function (e) { var v = Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)); e.target.value = v; db.settings.autoCompleteChars = v; saveSettings(); });
safeBind('autoCompleteMax', 'change', function (e) { var v = Math.max(5, Math.min(30, parseInt(e.target.value, 10) || 10)); e.target.value = v; db.settings.autoCompleteMax = v; saveSettings(); });
safeBind('searchHistoryEnabled', 'change', function (e) { db.settings.searchHistoryEnabled = e.target.checked; saveSettings(); });
safeBind('enableFullTextIndex', 'change', function (e) { db.settings.enableFullTextIndex = e.target.checked; saveSettings(); });
safeBind('tagColorMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.tagColorMode = b.dataset.mode; saveSettings(); applySettingsToUI(); render(); });
safeBind('tagFilterLogic', 'click', function (e) { var b = e.target.closest('button[data-logic]'); if (!b) return; db.settings.tagFilterLogic = b.dataset.logic; saveSettings(); applySettingsToUI(); render(); });
safeBind('tagAutoColor', 'change', function (e) { db.settings.tagAutoColor = e.target.checked; saveSettings(); });
safeBind('importDefaultAction', 'click', function (e) { var b = e.target.closest('button[data-action]'); if (!b) return; db.settings.importDefaultAction = b.dataset.action; saveSettings(); applySettingsToUI(); });
safeBind('shardMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.shardMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('enableYearIndex', 'change', function (e) { db.settings.enableYearIndex = e.target.checked; saveSettings(); });
safeBind('enableMigrationResume', 'change', function (e) { db.settings.enableMigrationResume = e.target.checked; saveSettings(); });
safeBind('rollbackEnabled', 'change', function (e) { db.settings.rollbackEnabled = e.target.checked; saveSettings(); });
safeBind('rollbackLimit', 'change', function (e) { var v = Math.max(10, Math.min(200, parseInt(e.target.value, 10) || 50)); e.target.value = v; db.settings.rollbackLimit = v; saveSettings(); });
safeBind('maxSplitParts', 'change', function (e) { var v = Math.max(3, Math.min(20, parseInt(e.target.value, 10) || 10)); e.target.value = v; db.settings.maxSplitParts = v; saveSettings(); });
safeBind('autoDeleteEmptyShard', 'change', function (e) { db.settings.autoDeleteEmptyShard = e.target.checked; saveSettings(); });
safeBind('timezoneMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.timezoneMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });

safeBind('enableLog', 'change', function (e) { db.settings.enableLog = e.target.checked; saveSettings(); });
safeBind('logSyncCloud', 'change', function (e) { db.settings.logSyncCloud = e.target.checked; saveSettings(); });
safeBind('logRecordPush', 'change', function (e) { db.settings.logRecordPush = e.target.checked; saveSettings(); });
safeBind('logRecordPull', 'change', function (e) { db.settings.logRecordPull = e.target.checked; saveSettings(); });
safeBind('logRecordConflict', 'change', function (e) { db.settings.logRecordConflict = e.target.checked; saveSettings(); });
safeBind('logRecordAutoPull', 'change', function (e) { db.settings.logRecordAutoPull = e.target.checked; saveSettings(); });
safeBind('logRecordSettings', 'change', function (e) { db.settings.logRecordSettings = e.target.checked; saveSettings(); });
safeBind('logRecordShardSha', 'change', function (e) { db.settings.logRecordShardSha = e.target.checked; saveSettings(); });
safeBind('logCleanupMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.logCleanupMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('logMaxCount', 'change', function (e) { var v = Math.max(10, Math.min(5000, parseInt(e.target.value, 10) || 500)); e.target.value = v; db.settings.logMaxCount = v; saveSettings(); });
safeBind('logMaxSizeKB', 'change', function (e) { var v = Math.max(10, Math.min(1000, parseInt(e.target.value, 10) || 100)); e.target.value = v; db.settings.logMaxSizeKB = v; saveSettings(); });
safeBind('logMaxDays', 'change', function (e) { var v = Math.max(1, Math.min(3650, parseInt(e.target.value, 10) || 30)); e.target.value = v; db.settings.logMaxDays = v; saveSettings(); });
safeBind('logHardLimitEnabled', 'change', function (e) { db.settings.logHardLimitEnabled = e.target.checked; saveSettings(); });
safeBind('logHardLimitCount', 'change', function (e) { var v = Math.max(10, Math.min(10000, parseInt(e.target.value, 10) || 1000)); e.target.value = v; db.settings.logHardLimitCount = v; saveSettings(); });
safeBind('logDisplayCount', 'change', function (e) { var v = Math.max(10, Math.min(500, parseInt(e.target.value, 10) || 50)); e.target.value = v; db.settings.logDisplayCount = v; saveSettings(); });
safeBind('clearLogBtn', 'click', function () { window.showCustomConfirm({ title: '清空日志', desc: '确定清空所有日志？不可恢复。', isDanger: true, onConfirm: function () { localStorage.setItem('material-library.push-log', '[]'); toast('日志已清空'); renderLogView(); } }); });

safeBind('deviceName', 'change', function (e) { db.settings.deviceName = e.target.value.trim(); saveSettings(); });
safeBind('deviceIcon', 'change', function (e) { db.settings.deviceIcon = e.target.value.trim(); saveSettings(); });
safeBind('deviceStatus', 'click', function (e) { var b = e.target.closest('button[data-status]'); if (!b) return; db.settings.deviceStatus = b.dataset.status; saveSettings(); applySettingsToUI(); });
safeBind('autoCleanDevices', 'change', function (e) { db.settings.autoCleanDevices = e.target.checked; saveSettings(); });
safeBind('deviceCleanupDays', 'change', function (e) { var v = Math.max(7, Math.min(365, parseInt(e.target.value, 10) || 30)); e.target.value = v; db.settings.deviceCleanupDays = v; saveSettings(); });
safeBind('strictReadonly', 'change', function (e) { db.settings.strictReadonly = e.target.checked; saveSettings(); });
safeBind('syncCats', 'change', function (e) { db.settings.syncCats = e.target.checked; saveSettings(); });
safeBind('syncSettings', 'change', function (e) { db.settings.syncSettings = e.target.checked; saveSettings(); });
safeBind('syncTrash', 'change', function (e) { db.settings.syncTrash = e.target.checked; saveSettings(); });
safeBind('syncLog', 'change', function (e) { db.settings.syncLog = e.target.checked; saveSettings(); });
safeBind('syncDevices', 'change', function (e) { db.settings.syncDevices = e.target.checked; saveSettings(); });
safeBind('shardSyncMode', 'click', function (e) { var b = e.target.closest('button[data-mode]'); if (!b) return; db.settings.shardSyncMode = b.dataset.mode; saveSettings(); applySettingsToUI(); });
safeBind('autoSnapshot', 'change', function (e) { db.settings.autoSnapshot = e.target.checked; saveSettings(); });
safeBind('autoCleanup', 'change', function (e) { db.settings.autoCleanup = e.target.checked; saveSettings(); });
safeBind('snapshotCount', 'change', function (e) { var v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)); e.target.value = v; db.settings.snapshotCount = v; saveSettings(); });
safeBind('exportReminderDays', 'change', function (e) { var v = Math.max(7, Math.min(60, parseInt(e.target.value, 10) || 30)); e.target.value = v; db.settings.exportReminderDays = v; saveSettings(); });
safeBind('storageWarningPct', 'change', function (e) { var v = Math.max(50, Math.min(95, parseInt(e.target.value, 10) || 85)); e.target.value = v; db.settings.storageWarningPct = v; saveSettings(); });

safeBind('openLogViewBtn', 'click', function () { renderLogView(); $('logMask').classList.add('show'); });
safeBind('logCloseBtn', 'click', function () { $('logMask').classList.remove('show'); });
safeBind('logMask', 'click', function (e) { if (e.target === $('logMask')) $('logMask').classList.remove('show'); });
safeBind('logRefreshBtn', 'click', function () { renderLogView(); toast('已刷新'); });
safeBind('logClearBtn', 'click', function () { window.showCustomConfirm({ title: '清空日志', desc: '确定清空所有日志？', isDanger: true, onConfirm: function () { localStorage.setItem('material-library.push-log', '[]'); renderLogView(); toast('已清空'); } }); });
function renderLogView() {
  var logs = loadLogs(); var wrap = $('logListWrap'); if (!wrap) return;
  if (!logs.length) { wrap.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-3);">还没有日志</div>'; return; }
  var displayCount = db.settings.logDisplayCount || 50; var list = logs.slice(0, displayCount);
  wrap.innerHTML = list.map(function (log) { var timeStr = fmtFull(log.timestamp); var statusIcon = log.status === 'success' ? '✓' : (log.status === 'error' ? '✗' : '⚠️'); var statusColor = log.status === 'success' ? '#10b981' : (log.status === 'error' ? 'var(--danger)' : '#f59e0b'); var actionName = { push: '推送', pull: '拉取', conflict: '冲突', migrate: '迁移', rollback: '回滚', snapshot: '快照' }[log.action] || log.action; return '<div style="border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:10px; background:var(--bg);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;"><div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:13px;"><span>' + (log.deviceIcon || '💻') + '</span><span>' + esc(log.deviceName || '未知设备') + '</span><span style="color:' + statusColor + '; font-weight:700;">' + statusIcon + ' ' + actionName + '</span></div><span style="font-size:12px; color:var(--text-3);">' + timeStr + '</span></div><div style="font-size:13px; color:var(--text-2);">' + esc(log.summary || '') + '</div>' + (log.itemCount ? '<div style="font-size:12px; color:var(--text-3); margin-top:4px;">共 ' + log.itemCount + ' 条素材</div>' : '') + (log.duration ? '<div style="font-size:12px; color:var(--text-3);">耗时 ' + (log.duration > 1000 ? (log.duration / 1000).toFixed(1) + ' 秒' : log.duration + ' ms') + '</div>' : '') + '</div>'; }).join('');
}

safeBind('openDeviceViewBtn', 'click', function () { renderDeviceList(); $('deviceMask').classList.add('show'); });
safeBind('deviceCloseBtn', 'click', function () { $('deviceMask').classList.remove('show'); });
safeBind('deviceMask', 'click', function (e) { if (e.target === $('deviceMask')) $('deviceMask').classList.remove('show'); });
safeBind('deviceRefreshBtn', 'click', function () { renderDeviceList(); toast('已刷新'); });
function renderDeviceList() {
  var devices = loadDevices(); var myDev = getOrCreateDevice(); var wrap = $('deviceList'); if (!wrap) return;
  var list = Object.keys(devices).map(function (k) { return devices[k]; });
  if (!list.length) { wrap.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-3);">还没有设备记录</div>'; return; }
  list.sort(function (a, b) { return (b.lastSeenAt || 0) - (a.lastSeenAt || 0); });
  wrap.innerHTML = list.map(function (d) { var isMe = d.id === myDev.id; var lastSeen = d.lastSeenAt ? fmtFull(d.lastSeenAt) : '未知'; var statusLabel = d.status === 'readonly' ? '只读' : (d.status === 'disabled' ? '禁用' : '活跃'); var statusColor = d.status === 'readonly' ? '#f59e0b' : (d.status === 'disabled' ? 'var(--danger)' : '#10b981'); return '<div style="border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:10px; background:' + (isMe ? 'var(--accent-soft)' : 'var(--bg)') + ';"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;"><div style="display:flex; align-items:center; gap:8px;"><span style="font-size:16px;">' + (d.icon || '💻') + '</span><span style="font-weight:600;">' + esc(d.name || '未知') + (isMe ? '（当前设备）' : '') + '</span><span style="font-size:11px; padding:2px 8px; border-radius:99px; background:' + statusColor + '15; color:' + statusColor + '; font-weight:600;">' + statusLabel + '</span></div></div><div style="font-size:12px; color:var(--text-3); margin-bottom:8px;">最后活跃：' + lastSeen + ' · 推送 ' + (d.pushCount || 0) + ' 次 · 拉取 ' + (d.pullCount || 0) + ' 次</div>' + (isMe ? '' : '<div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn tiny" data-device-rename="' + d.id + '">重命名</button><button class="btn tiny" data-device-status="' + d.id + '" data-status="readonly">' + (d.status === 'readonly' ? '恢复活跃' : '设为只读') + '</button><button class="btn tiny danger" data-device-remove="' + d.id + '">移除</button></div>') + '</div>'; }).join('');
  wrap.querySelectorAll('[data-device-rename]').forEach(function (btn) { btn.addEventListener('click', function () { var id = btn.dataset.deviceRename; var devs = loadDevices(); var d = devs[id]; if (!d) return; window.showCustomPrompt({ title: '重命名设备', desc: '输入新的设备名称：', value: d.name, onConfirm: function (name) { if (!name || !name.trim()) return; d.name = name.trim(); localStorage.setItem('material-library.devices-cache', JSON.stringify(devs)); renderDeviceList(); } }); }); });
  wrap.querySelectorAll('[data-device-status]').forEach(function (btn) { btn.addEventListener('click', function () { var id = btn.dataset.deviceStatus; var devs = loadDevices(); var d = devs[id]; if (!d) return; d.status = d.status === 'readonly' ? 'active' : 'readonly'; localStorage.setItem('material-library.devices-cache', JSON.stringify(devs)); renderDeviceList(); }); });
  wrap.querySelectorAll('[data-device-remove]').forEach(function (btn) { btn.addEventListener('click', function () { var id = btn.dataset.deviceRemove; window.showCustomConfirm({ title: '移除设备', desc: '确定移除该设备？', isDanger: true, onConfirm: function () { var devs = loadDevices(); delete devs[id]; localStorage.setItem('material-library.devices-cache', JSON.stringify(devs)); renderDeviceList(); } }); }); });
}
function refreshStorageInfo() { if (!navigator.storage || !navigator.storage.estimate) return; navigator.storage.estimate().then(function (est) { var el = $('storageInfo'); if (!el) return; var used = est.usage || 0, quota = est.quota || 0; var pct = quota > 0 ? (used / quota * 100).toFixed(1) : 0; el.innerHTML = '<div style="display:flex; justify-content:space-between;"><span>本地已用：' + fmtSize(used) + '</span><span>' + pct + '%</span></div><div style="margin-top:6px; height:6px; background:var(--line); border-radius:3px; overflow:hidden;"><div style="height:100%; width:' + pct + '%; background:var(--accent);"></div></div><div style="margin-top:6px; font-size:12px;">总配额：' + fmtSize(quota) + '</div>'; }).catch(function () {}); }

var _tagColorCurrentName = null;
function openTagColorPicker(tagName) {
  _tagColorCurrentName = tagName; $('tagColorName').textContent = tagName; var currentColor = (db.tagColors && db.tagColors[tagName]) || ''; if ($('tagColorCustom')) $('tagColorCustom').value = currentColor || '#5b6ef5';
  var palette = $('tagColorPalette'); if (palette) { palette.innerHTML = PALETTE.map(function (p) { return '<div style="background:' + p.fg + '; height:32px; border-radius:6px; cursor:pointer; border:2px solid ' + (currentColor === p.fg ? 'var(--text)' : 'transparent') + ';" data-color="' + p.fg + '"></div>'; }).join(''); palette.querySelectorAll('[data-color]').forEach(function (el) { el.addEventListener('click', function () { palette.querySelectorAll('[data-color]').forEach(function (e) { e.style.border = '2px solid transparent'; }); el.style.border = '2px solid var(--text)'; if ($('tagColorCustom')) $('tagColorCustom').value = el.dataset.color; }); }); }
  $('tagColorMask').classList.add('show');
}
safeBind('tagColorConfirm', 'click', function () { if (!_tagColorCurrentName) return; var color = $('tagColorCustom').value || ''; if (!db.tagColors) db.tagColors = {}; if (color) db.tagColors[_tagColorCurrentName] = color; else delete db.tagColors[_tagColorCurrentName]; save(); render(); $('tagColorMask').classList.remove('show'); if (typeof renderTagManager === 'function') renderTagManager(); toast('颜色已保存'); });
safeBind('tagColorCancel', 'click', function () { $('tagColorMask').classList.remove('show'); });
safeBind('tagColorClear', 'click', function () { if (!_tagColorCurrentName) return; if (db.tagColors) delete db.tagColors[_tagColorCurrentName]; save(); render(); $('tagColorMask').classList.remove('show'); if (typeof renderTagManager === 'function') renderTagManager(); toast('颜色已清除'); });
safeBind('tagColorMask', 'click', function (e) { if (e.target === $('tagColorMask')) $('tagColorMask').classList.remove('show'); });

var _tagBatchMode = false; var _tagBatchSelected = new Set();
safeBind('tagBatchToggleBtn', 'click', function () { _tagBatchMode = !_tagBatchMode; _tagBatchSelected.clear(); $('tagBatchBar').style.display = _tagBatchMode ? 'flex' : 'none'; $('tagBatchToggleBtn').textContent = _tagBatchMode ? '退出批量' : '批量选择'; renderTagManagerWithBatch(); });
safeBind('tagBatchCancelBtn', 'click', function () { _tagBatchMode = false; _tagBatchSelected.clear(); $('tagBatchBar').style.display = 'none'; $('tagBatchToggleBtn').textContent = '批量选择'; renderTagManagerWithBatch(); });
safeBind('tagBatchDeleteBtn', 'click', function () { if (!_tagBatchSelected.size) return toast('请先选择标签'); window.showCustomConfirm({ title: '批量删除标签', desc: '确定删除选中的 ' + _tagBatchSelected.size + ' 个标签？', isDanger: true, onConfirm: function () { var toDel = Array.from(_tagBatchSelected); db.items.forEach(function (i) { if (Array.isArray(i.tags) && i.tags.some(function (t) { return toDel.indexOf(t) >= 0; })) { var old = window.copyIndexItem(i); i.tags = i.tags.filter(function (t) { return toDel.indexOf(t) < 0; }); i.updatedAt = Date.now(); markItemDirty(i); _indexUpdateItem(old, i); } }); toDel.forEach(function (t) { db.fixedTags = db.fixedTags.filter(function (x) { return x !== t; }); if (db.tagColors) delete db.tagColors[t]; if (currentTag === t) currentTag = ''; if (currentTags && currentTags.has) currentTags.delete(t); }); _tagBatchSelected.clear(); save(); render(); renderTagManagerWithBatch(); toast('已删除 ' + toDel.length + ' 个标签'); } }); });
safeBind('tagBatchMergeBtn', 'click', function () { if (_tagBatchSelected.size < 2) return toast('至少选择 2 个标签才能合并'); var def = Array.from(_tagBatchSelected)[0]; window.showCustomPrompt({ title: '合并标签', desc: '将选中的 ' + _tagBatchSelected.size + ' 个标签合并到：', value: def, onConfirm: function (target) { if (!target || !target.trim()) return; target = target.trim(); var sources = Array.from(_tagBatchSelected).filter(function (t) { return t !== target; }); db.items.forEach(function (i) { if (Array.isArray(i.tags) && i.tags.some(function (t) { return sources.indexOf(t) >= 0; })) { var old = window.copyIndexItem(i); i.tags = Array.from(new Set(i.tags.map(function (t) { return sources.indexOf(t) >= 0 ? target : t; }))); markItemDirty(i); _indexUpdateItem(old, i); } }); sources.forEach(function (t) { db.fixedTags = db.fixedTags.filter(function (x) { return x !== t; }); if (db.tagColors && db.tagColors[t] && !db.tagColors[target]) db.tagColors[target] = db.tagColors[t]; if (db.tagColors) delete db.tagColors[t]; }); _tagBatchSelected.clear(); save(); render(); renderTagManagerWithBatch(); toast('已合并到「' + target + '」'); } }); });
safeBind('tagManagePagination', 'click', function (e) { if (e.target.id === 'tagPagePrev') { tagManagerPage--; renderTagManagerWithBatch(); } else if (e.target.id === 'tagPageNext') { tagManagerPage++; renderTagManagerWithBatch(); } });

function renderTagManagerWithBatch() {
  var counts = collectTags(); var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'zh'); }); var list = $('tagManageList'), pagEl = $('tagManagePagination'); if (!list) return;
  if (!tags.length) { list.innerHTML = '<div class="sp-empty" style="text-align:center; padding:40px; color:var(--text-3);">还没有标签</div>'; if (pagEl) pagEl.innerHTML = ''; return; }
  var totalPages = Math.ceil(tags.length / TAG_PAGE_SIZE); if (tagManagerPage > totalPages) tagManagerPage = totalPages; if (tagManagerPage < 1) tagManagerPage = 1;
  var start = (tagManagerPage - 1) * TAG_PAGE_SIZE; var slice = tags.slice(start, start + TAG_PAGE_SIZE);
  list.innerHTML = slice.map(function (t) { var isFixed = db.fixedTags.indexOf(t) >= 0; var pinFill = isFixed ? 'currentColor' : 'none'; var color = (db.tagColors && db.tagColors[t]) || ''; var isSel = _tagBatchSelected.has(t); return '<div class="cat-row" style="gap:10px;">' + (_tagBatchMode ? '<input type="checkbox" data-tag-check="' + esc(t) + '" ' + (isSel ? 'checked' : '') + ' style="width:18px; height:18px; cursor:pointer;">' : '') + '<span class="dot" style="background:' + (color || 'var(--accent)') + '; cursor:pointer;" data-tag-color="' + esc(t) + '" title="点击设置颜色"></span><input class="cat-name" data-tag-old="' + esc(t) + '" value="' + esc(t) + '" maxlength="20"><span class="cat-n">' + counts[t] + '</span>' + (_tagBatchMode ? '' : '<button class="btn tiny" data-tag-pin="' + esc(t) + '" style="padding:4px 8px;" title="' + (isFixed ? '取消固定' : '固定为默认标签') + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="' + pinFill + '" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg></button><button class="btn tiny danger" data-tag-del="' + esc(t) + '">删除</button>') + '</div>'; }).join('');
  if (pagEl) { if (totalPages <= 1) pagEl.innerHTML = ''; else pagEl.innerHTML = '<button class="btn tiny" id="tagPagePrev" ' + (tagManagerPage === 1 ? 'disabled' : '') + '>上一页</button><span>第 <b>' + tagManagerPage + '</b> / ' + totalPages + ' 页</span><button class="btn tiny" id="tagPageNext" ' + (tagManagerPage === totalPages ? 'disabled' : '') + '>下一页</button>'; }
  list.querySelectorAll('[data-tag-color]').forEach(function (el) { el.addEventListener('click', function () { openTagColorPicker(el.dataset.tagColor); }); });
  list.querySelectorAll('[data-tag-check]').forEach(function (el) { el.addEventListener('change', function () { if (el.checked) _tagBatchSelected.add(el.dataset.tagCheck); else _tagBatchSelected.delete(el.dataset.tagCheck); $('tagBatchCount').textContent = _tagBatchSelected.size; }); });
  list.querySelectorAll('[data-tag-pin]').forEach(function (btn) { btn.addEventListener('click', function () { toggleFixedTag(btn.dataset.tagPin); renderTagManagerWithBatch(); }); });
  list.querySelectorAll('[data-tag-del]').forEach(function (btn) { btn.addEventListener('click', function () { delTag(btn.dataset.tagDel); }); });
  $('tagBatchCount').textContent = _tagBatchSelected.size;
}
window.renderTagManager = renderTagManagerWithBatch;

['ghToken','ghOwner','ghRepo','ghBranch','ghDataPath','ghDataDir','ghShardSubdir','ghSiteBase','ghImgOwner','ghImgRepo','ghImgBranch','ghImgPath','ghImgSite','ghImgToken'].forEach(function (id) { safeBind(id, 'change', function () { collectGHForm(); }); });
safeBind('ghAuto', 'change', function () { collectGHForm(); });
safeBind('ghAutoPull', 'change', function () { collectGHForm(); });
safeBind('autoPushDelay', 'change', function () { var v = Math.max(1, Math.min(60, parseInt($('autoPushDelay').value, 10) || 2)); $('autoPushDelay').value = v; collectGHForm(); });
safeBind('syncCheckIntervalInput', 'change', function (e) { var v = Math.max(10, Math.min(3600, parseInt(e.target.value, 10) || 60)); e.target.value = v; db.settings.syncCheckInterval = v; saveSettings(); if (typeof restartSyncTimer === 'function') restartSyncTimer(); });
safeBind('autoCheckUpdateToggle', 'change', function (e) { db.settings.autoCheckUpdate = e.target.checked; saveSettings(); if (typeof restartSyncTimer === 'function') restartSyncTimer(); });
safeBind('ghTestBtn', 'click', function () { collectGHForm(); ghTest(); });
safeBind('ghPullBtn', 'click', function () { collectGHForm(); window.showCustomConfirm({ title: '拉取覆盖', desc: '拉取会用远程数据覆盖本地数据，确定继续？', isDanger: true, onConfirm: function () { ghPull(false); } }); });
safeBind('ghPushBtn', 'click', function () { collectGHForm(); ghPush(false); });
safeBind('ghForcePushBtn', 'click', function () { window.showCustomConfirm({ title: '强制覆盖云端', desc: '⚠️ 危险操作：强制覆盖云端所有数据！确定？', isDanger: true, onConfirm: function () { collectGHForm(); ghPush(false, true).then(function (ok) { if (ok) toast('已强制覆盖云端数据'); }); } }); });

safeBind('imgNamingTemplate', 'input', function () { var tpl = $('imgNamingTemplate').value; db.settings.imgNamingTemplate = (tpl || '').trim() || '{cat}-{timestamp}-{rand}'; saveSettings(); if (typeof window.updateImgNamingPreview === 'function') window.updateImgNamingPreview(); });
document.addEventListener('click', function (e) { var btn = e.target.closest('[data-naming-tpl]'); if (!btn) return; var tpl = btn.getAttribute('data-naming-tpl'); if (!tpl) return; if ($('imgNamingTemplate')) { $('imgNamingTemplate').value = tpl; db.settings.imgNamingTemplate = tpl; saveSettings(); if (typeof window.updateImgNamingPreview === 'function') window.updateImgNamingPreview(); } });

var oldImgCatsInput = document.getElementById('imgCatsInput'); if (oldImgCatsInput) { var parent = oldImgCatsInput.parentElement; if (parent) parent.style.display = 'none'; }
window.renderImgCatsEditor = function () { var editor = document.getElementById('imgCatsEditor'); if (!editor) return; editor.innerHTML = db.imageCategories.map(function (c, idx) { var palette = PALETTE[idx % PALETTE.length]; return '<div style="display:inline-flex; align-items:center; gap:6px; background:' + palette.bg + '; color:' + palette.fg + '; padding:4px 10px; border-radius:99px; font-size:13px; font-weight:600; border:1px solid ' + palette.fg + ';">' + esc(c) + ' <button data-del-img-cat="' + esc(c) + '" style="width:16px; height:16px; border-radius:50%; background:rgba(0,0,0,0.05); color:' + palette.fg + '; cursor:pointer;">✕</button></div>'; }).join(''); editor.querySelectorAll('[data-del-img-cat]').forEach(function (btn) { btn.addEventListener('click', function () { var cat = btn.dataset.delImgCat; if (db.imageCategories.length <= 1) return toast('至少保留一个分类'); db.imageCategories = db.imageCategories.filter(function (c) { return c !== cat; }); save(); renderImgCatsEditor(); }); }); };
safeBind('newImgCatInput', 'keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); var val = e.target.value.trim(); if (!val) return; if (db.imageCategories.indexOf(val) >= 0) return toast('已存在'); if (db.imageCategories.length >= 15) return toast('最多 15 个'); db.imageCategories.push(val); save(); e.target.value = ''; renderImgCatsEditor(); });
if (typeof window.renderImgCatsEditor === 'function') window.renderImgCatsEditor();

window.renderLogView = renderLogView; window.renderDeviceList = renderDeviceList; window.refreshStorageInfo = refreshStorageInfo; window.openTagColorPicker = openTagColorPicker; window.renderTagManagerWithBatch = renderTagManagerWithBatch;