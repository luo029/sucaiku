// js/items.js · 完整文件
// ★ 本次改动：addOrUpdate 成功后调用 clearOrphanImage 清理孤儿图片记录；其余逻辑保留

var zenQueue = []; var isProcessingInbox = false;

// ============ 回收站 ============
function moveToTrash(ids) {
  var set = new Set(ids), now = Date.now(), moved = [];
  db.items = db.items.filter(function (i) {
    if (set.has(i.id)) { var c = {}; for (var k in i) if (i.hasOwnProperty(k)) c[k] = i[k]; c.deletedAt = now; moved.push(c); _indexRemoveItem(i); return false; }
    return true;
  });
  for (var m = moved.length - 1; m >= 0; m--) db.trash.push(moved[m]);
  return moved.length;
}
function restoreFromTrash(id) {
  var idx = db.trash.findIndex(function (i) { return i.id === id; });
  if (idx < 0) return;
  var item = db.trash.splice(idx, 1)[0]; delete item.deletedAt;
  if (db.items.some(function (x) { return x.id === item.id; })) item.id = uid();
  db.items.push(item); markItemDirty(item); _indexAddItem(item);
  save(); render(); renderTrash(); toast('已恢复');
}
function purgeTrashItem(id) { db.trash = db.trash.filter(function (i) { return i.id !== id; }); save(); renderTrash(); }
function renderTrash() {
  var list = $('trashList'), days = Math.max(1, Math.min(365, Number(db.settings.trashTtlDays) || 30));
  $('trashDesc').textContent = '删除的素材会保留 ' + days + ' 天，可随时恢复。';
  if (!db.trash.length) { list.innerHTML = '<div class="sp-empty">回收站是空的</div>'; return; }
  var sorted = db.trash.slice().sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
  list.innerHTML = sorted.map(function (i) {
    var c = catColor(i.type);
    var txt = i.text ? (i.text.length > 120 ? i.text.slice(0, 120) + '…' : i.text) : '（图片素材 ' + (i.images ? i.images.length : 0) + ' 张）';
    return '<div class="trash-item"><div class="trash-head"><span class="tag' + (i.type === IMG_TYPE ? ' tag-img' : '') + '" style="' + (i.type === IMG_TYPE ? '' : 'background:' + c.bg + ';color:' + c.fg) + '">' + esc(i.type) + '</span>' + (i.source ? '<span class="src" style="max-width:none">' + esc(i.source) + '</span>' : '') + '<span class="date" style="margin-left:auto">' + fmtDate(i.deletedAt) + ' 删除</span></div><div class="trash-text">' + esc(txt) + '</div><div class="trash-ops"><button class="btn tiny" data-restore="' + i.id + '">恢复</button><button class="btn tiny danger" data-purge="' + i.id + '">彻底删除</button></div></div>';
  }).join('');
}

// ============ 标签管理 ============
function renderTagManager() {
  var counts = collectTags();
  var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'zh'); });
  var list = $('tagManageList');
  if (!tags.length) { list.innerHTML = '<div class="sp-empty">还没有标签</div>'; return; }
  list.innerHTML = tags.map(function (t) {
    var isFixed = db.fixedTags.indexOf(t) >= 0, pinFill = isFixed ? 'currentColor' : 'none';
    return '<div class="cat-row" style="gap:10px"><span class="dot" style="background:var(--accent)"></span><input class="cat-name" data-tag-old="' + esc(t) + '" value="' + esc(t) + '" maxlength="20"><span class="cat-n">' + counts[t] + '</span><button class="btn tiny" data-tag-pin="' + esc(t) + '" title="' + (isFixed ? '取消固定' : '固定为默认标签') + '" style="padding:4px 8px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="' + pinFill + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg></button><button class="btn tiny danger" data-tag-del="' + esc(t) + '">删除</button></div>';
  }).join('');
}
function renameTag(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) { renderTagManager(); return; }
  var existed = db.items.some(function (i) { return (i.tags || []).indexOf(newName) >= 0; });
  db.items.forEach(function (i) {
    if (!Array.isArray(i.tags)) i.tags = [];
    if (i.tags.indexOf(oldName) >= 0) { i.tags = Array.from(new Set(i.tags.map(function (t) { return t === oldName ? newName : t; }))); i.updatedAt = Date.now(); markItemDirty(i); _indexUpdateItem(i, i); }
  });
  var fi = db.fixedTags.indexOf(oldName); if (fi >= 0) db.fixedTags[fi] = newName;
  db.fixedTags = Array.from(new Set(db.fixedTags));
  if (currentTag === oldName) currentTag = newName;
  if (currentTags && currentTags.has && currentTags.has(oldName)) { currentTags.delete(oldName); currentTags.add(newName); }
  save(); render(); renderTagManager();
  toast(existed ? '已合并到「' + newName + '」' : '已重命名标签');
}
function delTag(name) {
  var n = db.items.filter(function (i) { return (i.tags || []).indexOf(name) >= 0; }).length;
  window.showCustomConfirm({
    title: '删除标签', desc: '确定要删除标签「' + name + '」吗？\n' + n + ' 条素材会移除该标签。', isDanger: true,
    onConfirm: function () {
      db.items.forEach(function (i) {
        if (Array.isArray(i.tags) && i.tags.indexOf(name) >= 0) { i.tags = i.tags.filter(function (t) { return t !== name; }); i.updatedAt = Date.now(); markItemDirty(i); _indexUpdateItem(i, i); }
      });
      db.fixedTags = db.fixedTags.filter(function (t) { return t !== name; });
      if (currentTag === name) currentTag = '';
      if (currentTags && currentTags.has) currentTags.delete(name);
      save(); render(); renderTagManager(); toast('已删除标签');
    }
  });
}

// ============ 待上传图片 ============
function renderPendingImgs() {
  if (!pendingImages.length) { pendingImgsEl.innerHTML = ''; return; }
  pendingImgsEl.innerHTML = pendingImages.map(function (im, idx) {
    var src = imageSrc(im);
    return '<div class="pi"><img src="' + esc(src) + '" alt="" data-img-path="' + esc(im.path || '') + '"><button data-rm-img="' + idx + '" title="移除">✕</button><span class="pi-cat">' + esc(im.cat || '') + '</span></div>';
  }).join('');
}
function setPendingImages(list) {
  pendingImages = (list || []).map(function (x) { return typeof x === 'string' ? { url: x, path: '', cat: '其他', size: 0, origSize: 0 } : x; });
  renderPendingImgs();
}

// ============ 增删改 ============
function addOrUpdate() {
  var text = inputEl.value.trim(), hasImgs = pendingImages.length > 0;
  if (!text && !hasImgs) { toast('内容不能为空'); inputEl.focus(); return; }
  var type = typeEl.value || UNCAT, source = sourceEl.value.trim(), tagsRaw = tagsEl.value.trim();
  if (focusMode) {
    type = db.settings.focusModeCat || '收件箱'; source = ''; tagsRaw = '';
    if (db.cats.indexOf(type) < 0) db.cats.push(type);
  }
  var tags = tagsRaw ? tagsRaw.split(/[,，\s]+/).filter(Boolean) : [];
  if (!source && currentSource !== ALL_SOURCES) source = currentSource;
  if (!source && db.fixedSource) source = db.fixedSource;
  if (!tags.length && db.fixedTags.length) tags.push.apply(tags, db.fixedTags);
  var wasEditingId = editingId;
  if (editingId) {
    var item = db.items.find(function (i) { return i.id === editingId; });
    if (item) {
      var oldCopy = JSON.parse(JSON.stringify(item));
      item.text = text; item.type = type; item.source = source;
      item.tags = Array.from(new Set(tags)); item.images = pendingImages.slice(); item.updatedAt = Date.now();
      markItemDirty(item); _indexUpdateItem(oldCopy, item);
    }
  } else {
    var newItem = { id: uid(), text: text, type: type, source: source, tags: Array.from(new Set(tags)), images: pendingImages.slice(), createdAt: Date.now() };
    db.items.push(newItem); markItemDirty(newItem); _indexAddItem(newItem);
  }
  if (source && db.sources.indexOf(source) < 0) db.sources.push(source);
  if (currentSource !== ALL_SOURCES && source !== currentSource) currentSource = ALL_SOURCES;
  save();
  // ★ 保存成功：清理这些图片的孤儿记录（在 cancelEdit 清空 pendingImages 之前）
  if (typeof clearOrphanImage === 'function') {
    try { clearOrphanImage(pendingImages.map(function (x) { return x.path; }).filter(Boolean)); } catch (e) {}
  }
  if (wasEditingId && isProcessingInbox) {
    var focusCat = db.settings.focusModeCat || '收件箱';
    while (zenQueue.length > 0) {
      var nextId = zenQueue.shift();
      var candidate = db.items.find(function (i) { return i.id === nextId; });
      if (candidate && candidate.type === focusCat) {
        keyword = ''; if (searchEl) searchEl.value = '';
        currentType = '全部'; currentPage = 1; render(); startEdit(nextId);
        toast('已保存，自动跳至下一条收件箱'); return;
      }
    }
    cancelEdit(); render(); toast('收件箱已全部处理完毕！'); return;
  }
  cancelEdit();
  toast(wasEditingId ? '已更新素材' : '已加入素材库');
  currentPage = 1; save(); render();
  if (!focusMode) inputEl.focus();
}
function startEdit(id) {
  var item = db.items.find(function (i) { return i.id === id; });
  if (!item) return;
  var focusCat = db.settings.focusModeCat || '收件箱';
  if (editingId !== id) {
    zenQueue = []; isProcessingInbox = (item.type === focusCat);
    if (isProcessingInbox) {
      var sameCats = db.items.filter(function (i) { return i.type === focusCat; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).map(function (i) { return i.id; });
      var idx = sameCats.indexOf(id);
      if (idx !== -1) zenQueue = sameCats.slice(idx + 1).concat(sameCats.slice(0, idx));
    }
  }
  editingId = id;
  inputEl.value = item.text; refreshTypeSelect(item.type);
  sourceEl.value = item.source || ''; tagsEl.value = item.tags ? item.tags.join(', ') : '';
  setPendingImages(item.images || []);
  updateSourcePickerUI(); updateTagPickerUI();
  addBtn.textContent = '更新'; cancelBtn.style.display = '';
  inputEl.focus(); scrollTop();
}
function cancelEdit() {
  editingId = null; zenQueue = []; isProcessingInbox = false;
  addBtn.textContent = '保存'; cancelBtn.style.display = 'none';
  inputEl.value = ''; tagsEl.value = db.fixedTags.length ? db.fixedTags.join(', ') : '';
  sourceEl.value = db.fixedSource || '';
  setPendingImages([]); updateSourcePickerUI(); updateTagPickerUI();
  refreshTypeSelect(db.cats[0] || '');
}

// ============ 分类管理（含确认弹窗 + catVersion） ============
function addCat(name) {
  name = name.trim(); if (!name) return;
  if (name === UNCAT || name === IMG_TYPE) { toast('「' + name + '」是系统保留名'); return; }
  if (db.cats.indexOf(name) >= 0) { toast('分类已存在'); return; }
  db.cats.push(name); ensureColors();
  db.catVersion = (db.catVersion || 0) + 1;
  save(); render(); toast('已添加分类「' + name + '」');
}
function renameCat(idx, newName) {
  var oldName = db.cats[idx];
  if (oldName === undefined) return;
  newName = newName.trim();
  if (!newName) { toast('名称不能为空'); renderCatManager(); return; }
  if (newName === oldName) return;
  if (newName === UNCAT || newName === IMG_TYPE) { toast('「' + newName + '」是系统保留名'); renderCatManager(); return; }
  if (db.cats.some(function (c, i) { return i !== idx && c === newName; })) { toast('已存在同名分类'); renderCatManager(); return; }
  var affected = db.items.filter(function (i) { return i.type === oldName; });
  var shardSet = new Set(); affected.forEach(function (i) { shardSet.add(_shardKeyOfItem(i)); });
  var estSec = Math.max(1, Math.ceil(shardSet.size * 0.15));
  window.showCustomConfirm({
    title: '修改分类名称',
    desc: '即将把「' + oldName + '」改名为「' + newName + '」。\n\n影响范围：\n• 素材：' + affected.length + ' 条\n• 分片：' + shardSet.size + ' 个\n• 预计同步：约 ' + estSec + ' 秒',
    isDanger: false,
    onConfirm: function () {
      db.cats[idx] = newName;
      affected.forEach(function (i) { i.type = newName; i.updatedAt = Date.now(); markItemDirty(i); _indexUpdateItem(i, i); });
      if (db.colors[oldName] !== undefined) { db.colors[newName] = db.colors[oldName]; delete db.colors[oldName]; }
      if (currentType === oldName) currentType = newName;
      db.catVersion = (db.catVersion || 0) + 1;
      save(); render(); toast('已重命名');
    }
  });
}
function delCat(idx) {
  var name = db.cats[idx]; if (name === undefined) return;
  var affected = db.items.filter(function (i) { return i.type === name; });
  var shardSet = new Set(); affected.forEach(function (i) { shardSet.add(_shardKeyOfItem(i)); });
  var estSec = Math.max(1, Math.ceil(shardSet.size * 0.15));
  window.showCustomConfirm({
    title: '删除分类',
    desc: '即将删除「' + name + '」分类。\n\n影响范围：\n• ' + affected.length + ' 条素材将变为「' + UNCAT + '」\n• 涉及 ' + shardSet.size + ' 个分片\n• 预计同步：约 ' + estSec + ' 秒',
    isDanger: true,
    onConfirm: function () {
      db.cats.splice(idx, 1);
      affected.forEach(function (i) { i.type = UNCAT; i.updatedAt = Date.now(); markItemDirty(i); _indexUpdateItem(i, i); });
      delete db.colors[name];
      if (currentType === name) currentType = '全部';
      ensureColors();
      db.catVersion = (db.catVersion || 0) + 1;
      save(); render(); toast('已删除分类');
    }
  });
}

// ============ 拖拽移动分类 ============
function bindDragEvents() {}
function setupDropZones() {
  $('catNav').addEventListener('dragover', function (e) { var t = e.target.closest('.nav-item[data-type]'); if (t) { e.preventDefault(); t.classList.add('drag-over'); } });
  $('catNav').addEventListener('dragleave', function (e) { var t = e.target.closest('.nav-item[data-type]'); if (t) t.classList.remove('drag-over'); });
  $('catNav').addEventListener('drop', function (e) { var t = e.target.closest('.nav-item[data-type]'); if (t && draggedItemId) { e.preventDefault(); t.classList.remove('drag-over'); moveItemCategory(draggedItemId, t.dataset.type); } });
  listEl.addEventListener('dragstart', function (e) {
    if (selectMode || zenMode) { e.preventDefault(); return; }
    var card = e.target.closest('.card'); if (!card) return;
    draggedItemId = card.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', draggedItemId);
    setTimeout(function () { card.style.opacity = '0.4'; }, 0);
  });
  listEl.addEventListener('dragend', function (e) { var card = e.target.closest('.card'); if (card) card.style.opacity = '1'; draggedItemId = null; });
}
function moveItemCategory(itemId, newType) {
  var item = db.items.find(function (i) { return i.id === itemId; });
  if (item && item.type !== newType) {
    var oldCopy = JSON.parse(JSON.stringify(item));
    item.type = newType; item.updatedAt = Date.now();
    markItemDirty(item); _indexUpdateItem(oldCopy, item);
    save(); render(); toast('已移动至「' + newType + '」');
  }
}

// 全局暴露
window.moveToTrash = moveToTrash; window.restoreFromTrash = restoreFromTrash;
window.purgeTrashItem = purgeTrashItem; window.renderTrash = renderTrash;
window.renderTagManager = renderTagManager; window.renameTag = renameTag; window.delTag = delTag;
window.renderPendingImgs = renderPendingImgs; window.setPendingImages = setPendingImages;
window.addOrUpdate = addOrUpdate; window.startEdit = startEdit; window.cancelEdit = cancelEdit;
window.addCat = addCat; window.renameCat = renameCat; window.delCat = delCat;
window.setupDropZones = setupDropZones; window.moveItemCategory = moveItemCategory;