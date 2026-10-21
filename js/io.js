// js/io.js · 完整文件
// 修复内容：
//  - P1-6：handleImportFile 支持导入 tagColors，并做白名单校验，防止 CSS 注入

function setZen(on) {
  zenMode = on;
  document.body.classList.toggle('zen-mode', on);
  localStorage.setItem(ZEN_KEY, on ? '1' : '0');
  if (on) { closeSidebar(); selectMode = false; selectedIds.clear(); closeImgView(); setFocus(false); }
  renderList(); scrollTop();
}

function setFocus(on) {
  focusMode = on;
  document.body.classList.toggle('focus-mode', on);
  if (on) { setZen(false); closeSidebar(); inputEl.focus(); }
  renderList(); scrollTop();
}

function openExportModal(preset) {
  var filtered = getFilteredItems();
  var counts = {};
  db.items.forEach(function (i) { counts[i.type] = (counts[i.type] || 0) + 1; });
  var opts = ['<option value="__all__">全部素材（' + db.items.length + ' 条）</option>'];
  if (filtered.length !== db.items.length) opts.push('<option value="__filtered__">当前筛选结果（' + filtered.length + ' 条）</option>');
  if (selectedIds.size) opts.push('<option value="__selected__">已选中（' + selectedIds.size + ' 条）</option>');
  db.cats.forEach(function (c) { opts.push('<option value="' + esc(c) + '">' + esc(c) + '（' + (counts[c] || 0) + ' 条）</option>'); });
  if ((counts[IMG_TYPE] || 0) > 0) opts.push('<option value="' + esc(IMG_TYPE) + '">' + IMG_TYPE + '（' + counts[IMG_TYPE] + ' 条）</option>');
  if ((counts[UNCAT] || 0) > 0) opts.push('<option value="' + esc(UNCAT) + '">' + UNCAT + '（' + counts[UNCAT] + ' 条）</option>');
  $('exportScope').innerHTML = opts.join('');
  if (preset && Array.prototype.some.call($('exportScope').options, function (o) { return o.value === preset; })) $('exportScope').value = preset;
  exportFormat = 'json';
  $('exportFormat').querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.dataset.fmt === 'json'); });
  $('exportMask').classList.add('show');
}
function closeExportModal() { $('exportMask').classList.remove('show'); }

function doExport() {
  var scope = $('exportScope').value;
  var isAll = scope === '__all__';
  var items;
  if (isAll) items = db.items.slice();
  else if (scope === '__filtered__') items = getFilteredItems().slice();
  else if (scope === '__selected__') items = db.items.filter(function (i) { return selectedIds.has(i.id); });
  else items = db.items.filter(function (i) { return i.type === scope; });
  if (!items.length) { toast('该范围没有素材'); return; }

  var dateStr = fmtDateOnly(Date.now());
  var scopeName = isAll ? '全库' : scope === '__filtered__' ? '筛选结果' : scope === '__selected__' ? '已选中' : scope;

  if (exportFormat === 'json') {
    var payload = isAll ? db : { items: items, cats: db.cats.slice(), colors: Object.assign({}, db.colors), sources: db.sources.slice(), imageCategories: db.imageCategories.slice() };
    var fname = isAll ? '素材库备份-' + dateStr + '.json' : '素材库-' + scopeName + '-' + dateStr + '.json';
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), fname);
    toast('已导出备份');
  } else if (exportFormat === 'md') {
    var out = isAll ? ('# 素材库 ' + dateStr + '\n\n') : ('# ' + scopeName + ' · 素材 ' + dateStr + '（' + items.length + ' 条）\n\n');
    var groups = {};
    items.forEach(function (i) { (groups[i.type] = groups[i.type] || []).push(i); });
    Object.keys(groups).forEach(function (t) {
      var g = groups[t];
      out += '## ' + t + '（' + g.length + '）\n\n';
      g.forEach(function (i) {
        if (i.text) out += i.text.split('\n').map(function (line) { return '> ' + line; }).join('\n') + '\n\n';
        if (i.images && i.images.length) out += i.images.map(function (im) { return '![' + (im.cat || '') + '](' + imageSrc(im) + ')'; }).join('\n') + '\n\n';
        if (i.source) out += '—— ' + i.source + '\n\n';
        if (i.tags && i.tags.length) out += '标签：' + i.tags.map(function (t) { return '#' + t; }).join(' ') + '\n\n';
      });
    });
    var fname2 = isAll ? '素材库-' + dateStr + '.md' : '素材库-' + scopeName + '-' + dateStr + '.md';
    download(new Blob([out], { type: 'text/markdown;charset=utf-8' }), fname2);
    toast('已导出 Markdown');
  } else if (exportFormat === 'csv') {
    var outCsv = '\uFEFF';
    outCsv += '分类,来源,标签,内容,创建时间,图片链接\n';
    items.forEach(function (i) {
      var type = (i.type || '').replace(/"/g, '""');
      var source = (i.source || '').replace(/"/g, '""');
      var tags = (i.tags || []).join(',').replace(/"/g, '""');
      var text = (i.text || '').replace(/"/g, '""');
      var date = "'" + fmtFull(i.createdAt);
      var imgs = (i.images || []).map(function (im) { return imageSrc(im); }).join(' | ').replace(/"/g, '""');
      outCsv += '"' + type + '","' + source + '","' + tags + '","' + text + '","' + date + '","' + imgs + '"\n';
    });
    var fname3 = isAll ? '素材库-' + dateStr + '.csv' : '素材库-' + scopeName + '-' + dateStr + '.csv';
    download(new Blob([outCsv], { type: 'text/csv;charset=utf-8' }), fname3);
    toast('已导出 CSV，可用 Excel 打开');
  } else {
    var outTxt = '';
    if (isAll) {
      outTxt = '素材库 ' + dateStr + '\n\n';
      db.cats.concat([IMG_TYPE, UNCAT]).forEach(function (t) {
        var g = items.filter(function (i) { return i.type === t; });
        if (!g.length) return;
        outTxt += '========== ' + t + '（' + g.length + '） ==========\n\n';
        g.forEach(function (i) {
          if (i.text) outTxt += i.text + '\n';
          if (i.source) outTxt += '——' + i.source + '\n';
          outTxt += '\n';
        });
      });
    } else {
      outTxt = scopeName + ' · 素材 ' + dateStr + '（' + items.length + ' 条）\n\n';
      items.forEach(function (i) {
        if (i.text) outTxt += i.text + '\n';
        if (i.source) outTxt += '——' + i.source + '\n';
        outTxt += '\n';
      });
    }
    var fname4 = isAll ? '素材库-' + dateStr + '.txt' : '素材库-' + scopeName + '-' + dateStr + '.txt';
    download(new Blob([outTxt], { type: 'text/plain;charset=utf-8' }), fname4);
    toast('已导出 TXT');
  }
  try { localStorage.setItem('material-library.last-export', String(Date.now())); } catch (e) {}
  closeExportModal();
}

function checkExportReminder() {
  var last = 0;
  try { last = Number(localStorage.getItem('material-library.last-export') || 0); } catch (e) {}
  if (!last) return;
  var days = Number(db.settings.exportReminderDays) || 30;
  if ((Date.now() - last) > days * 86400000) {
    toast('⏰ 距离上次导出已超过 ' + days + ' 天，建议导出备份');
  }
}

function handleImportFile(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      var incomingItems = [], incomingCats = [], incomingColors = {}, incomingSources = [], incomingTrash = [], incomingFixedTags = [], incomingImgCats = [], incomingTagColors = {};
      if (Array.isArray(data)) incomingItems = data;
      else if (data && Array.isArray(data.items)) {
        incomingItems = data.items;
        incomingCats = Array.isArray(data.cats) ? data.cats : [];
        incomingColors = (data.colors && typeof data.colors === 'object') ? data.colors : {};
        incomingSources = Array.isArray(data.sources) ? data.sources : [];
        incomingTrash = Array.isArray(data.trash) ? data.trash : [];
        incomingFixedTags = Array.isArray(data.fixedTags) ? data.fixedTags : [];
        incomingImgCats = Array.isArray(data.imageCategories) ? data.imageCategories : [];
        // ★ P1-6：支持导入 tagColors（原来不导入）
        incomingTagColors = (data.tagColors && typeof data.tagColors === 'object') ? data.tagColors : {};
      } else throw new Error('bad');

      var added = 0, skipped = 0, monthsTouched = {};
      incomingItems.forEach(function (i) {
        if (!i || typeof i.text !== 'string') return;
        if (!i.text && (!Array.isArray(i.images) || i.images.length === 0)) return;
        if (i.id && db.items.some(function (x) { return x.id === i.id; })) { skipped++; return; }
        var newItem = {
          id: i.id || uid(), text: i.text, type: i.type || UNCAT,
          source: i.source || '', tags: Array.isArray(i.tags) ? Array.from(new Set(i.tags)) : [],
          images: normalizeImages(i.images), createdAt: i.createdAt || Date.now(), updatedAt: i.updatedAt || undefined
        };
        db.items.push(newItem);
        markItemDirty(newItem);
        if (i.source && db.sources.indexOf(i.source) < 0) db.sources.push(i.source);
        var d = new Date(newItem.createdAt);
        var monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthsTouched[monthKey] = (monthsTouched[monthKey] || 0) + 1;
        added++;
      });
      incomingTrash.forEach(function (i) {
        if (!i || typeof i.text !== 'string') return;
        if (!i.text && (!Array.isArray(i.images) || i.images.length === 0)) return;
        if (i.id && db.trash.some(function (x) { return x.id === i.id; })) return;
        db.trash.push({
          id: i.id || uid(), text: i.text, type: i.type || UNCAT,
          source: i.source || '', tags: Array.isArray(i.tags) ? Array.from(new Set(i.tags)) : [],
          images: normalizeImages(i.images), createdAt: i.createdAt || Date.now(),
          updatedAt: i.updatedAt || undefined, deletedAt: i.deletedAt || Date.now()
        });
      });
      incomingCats.forEach(function (c) { if (typeof c === 'string' && c.trim() && c !== UNCAT && c !== IMG_TYPE && db.cats.indexOf(c) < 0) db.cats.push(c); });
      incomingSources.forEach(function (s) { if (typeof s === 'string' && s.trim() && db.sources.indexOf(s) < 0) db.sources.push(s); });
      incomingFixedTags.forEach(function (s) { if (typeof s === 'string' && s.trim() && db.fixedTags.indexOf(s) < 0) db.fixedTags.push(s); });
      incomingImgCats.forEach(function (s) { if (typeof s === 'string' && s.trim() && db.imageCategories.indexOf(s) < 0) db.imageCategories.push(s); });

      // ★ P1-6：tagColors 校验后合并
      var safeTagColors = (typeof window.sanitizeTagColors === 'function') ? window.sanitizeTagColors(incomingTagColors) : {};
      if (!db.tagColors) db.tagColors = {};
      Object.keys(safeTagColors).forEach(function (k) { db.tagColors[k] = safeTagColors[k]; });

      var used = new Set(Object.values(db.colors));
      Object.keys(incomingColors).forEach(function (c) {
        if (db.cats.indexOf(c) >= 0 && !(c in db.colors)) {
          var idx = incomingColors[c];
          if (typeof idx === 'number' && isFinite(idx) && idx >= 0 && !used.has(idx)) { db.colors[c] = idx; used.add(idx); }
        }
      });

      markNeedNormalize();
      normalize();
      markIndexDirty();
      markAllShardsDirty();
      db.items.sort(function (a, b) { return b.createdAt - a.createdAt; });

      save();
      render();
      showImportResultModal(added, skipped, Object.keys(monthsTouched));
    } catch (err) { toast('导入失败：请选择本工具导出的 JSON 备份文件'); }
  };
  reader.readAsText(file);
}

function showImportResultModal(added, skipped, months) {
  var old = document.getElementById('importResultMask');
  if (old) old.remove();
  var monthsPreview = months.length > 3 ? months.slice(0, 3).join('、') + ' 等 ' + months.length + ' 个月' : months.join('、');
  var html = '<div class="modal-mask" id="importResultMask" style="z-index: 200;"><div class="modal" style="max-width: 440px;"><div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><h3 class="modal-title">导入成功</h3><p class="modal-desc">共导入 <b>' + added + '</b> 条素材' + (skipped > 0 ? '，跳过 ' + skipped + ' 条（ID 重复）' : '') + '</p>' + (months.length > 0 ? '<p style="font-size:13px; color:var(--text-3); margin:0 0 20px; line-height:1.6;">覆盖 ' + esc(monthsPreview) + '</p>' : '') + '<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;"><button class="primary" id="importPushNow" style="width:100%; padding:12px;">立即推送到云端</button><button class="btn" id="importPushLater" style="width:100%; padding:12px; text-align:left; display:flex; flex-direction:column; align-items:flex-start; gap:4px;"><span style="font-weight:600;">稍后自动推送</span><span style="font-size:12px; color:var(--text-3);">2 秒后自动推送（与日常保存一致）</span></button><button class="btn" id="importOnlyLocal" style="width:100%; padding:12px; text-align:left; display:flex; flex-direction:column; align-items:flex-start; gap:4px;"><span style="font-weight:600;">仅本地</span><span style="font-size:12px; color:var(--text-3);">暂不推送，但后续修改会一起推送</span></button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  var mask = document.getElementById('importResultMask');
  function close() { mask.remove(); }
  document.getElementById('importPushNow').addEventListener('click', function () {
    close();
    if (typeof ghPush === 'function') { toast('正在推送...'); ghPush(false).then(function (ok) { if (ok) toast('推送成功'); else toast('推送失败，请检查网络'); }); }
  });
  document.getElementById('importPushLater').addEventListener('click', function () { close(); if (typeof scheduleAutoPush === 'function') { scheduleAutoPush(); toast('将在 2 秒后自动推送'); } });
  document.getElementById('importOnlyLocal').addEventListener('click', function () { close(); toast('已保留在本地，后续修改会自动推送'); });
  mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
}

function openSidebar() { $('sidebar').classList.add('open'); $('sidebarOverlay').classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('show'); document.body.style.overflow = ''; }
function closeSidebarIfMobile() { if (window.innerWidth <= 960) closeSidebar(); }

window.setZen = setZen; window.setFocus = setFocus;
window.openExportModal = openExportModal; window.closeExportModal = closeExportModal;
window.doExport = doExport; window.handleImportFile = handleImportFile;
window.showImportResultModal = showImportResultModal;
window.openSidebar = openSidebar; window.closeSidebar = closeSidebar;
window.closeSidebarIfMobile = closeSidebarIfMobile;
window.checkExportReminder = checkExportReminder;