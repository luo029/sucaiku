// js/io.js · 完整文件
// ★ 本次更新：重构了导入 Readest 笔记时的【发现笔记更新】弹窗 UI。
//   现在改为动态生成全新的卡片式设计：顶部显示原文划线，下方左右分栏（红色旧版 vs 绿色新版）。
//   同时适配手机端（极窄屏幕自动折行上下对比），不再依赖 modals.js 里的旧版丑样式。
//
// ★ 上轮保留：
//   1) 增加严格的划线提取逻辑
//   2) 导入的素材在回收站里存在时，会自动将其从回收站彻底抹除，并作为新素材重新导入

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

      if (incomingTrash.length > 0 && typeof markTrashDirty === 'function') markTrashDirty();

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

// ==========================================
// ★ 核心：Readest Markdown 解析逻辑
// ==========================================
function importReadestMarkdown(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var text = e.target.result;
    var lines = text.split('\n');
    
    var bookName = '未知书籍';
    var newItemsData = [];     // 待新增
    var updateCandidates = []; // 待对比更新的

    var currentQuote = [];
    var currentNotes = [];
    var currentTags = new Set();
    var currentTimestamp = Date.now();

    // 结算当前这一组
    function flush() {
      // 如果没有原文划线（比如只是文件表头），直接丢弃这组数据！
      if (currentQuote.length === 0) {
        currentQuote = [];
        currentNotes = [];
        currentTags = new Set();
        currentTimestamp = Date.now();
        return;
      }

      var quoteText = currentQuote.join('\n').trim();
      var noteText = currentNotes.join('\n').trim();
      
      // 组装最终文本：原文 + 分割线 + 笔记
      var finalText = quoteText;
      if (noteText) {
        finalText += '\n\n---\n\n' + noteText;
      }
      
      if (finalText) {
        newItemsData.push({
          quoteText: quoteText,
          fullText: finalText,
          tags: Array.from(currentTags),
          timestamp: currentTimestamp
        });
      }
      
      // 清空，准备迎接下一组
      currentQuote = [];
      currentNotes = [];
      currentTags = new Set();
      currentTimestamp = Date.now();
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      
      // 1. 遇到分割线，结算上一段
      if (line === '---' || line === '* * *' || line === '***') {
        flush();
        continue;
      }
      
      if (!line) continue; // 空行不影响合并

      // 2. 匹配书名 (# 书名)
      if (line.startsWith('# ')) {
        flush();
        bookName = line.substring(2).trim();
      } 
      // 3. 匹配章节 (### 章节名) - 直接忽略
      else if (line.startsWith('### ')) {
        flush();
      }
      // 4. 匹配高亮原文 (> 划线内容)
      else if (line.startsWith('> ')) {
        currentQuote.push(line.substring(2).trim());
      }
      // 5. 匹配时间 (*时间： xxx*)
      else if (line.indexOf('*时间：') === 0 || line.indexOf('*时间:') === 0) {
        var timeStr = line.replace(/^\*时间[：:]\s*/, '').replace(/\*$/, '').trim();
        var safeTimeStr = timeStr.replace(/\//g, '-').replace(' ', 'T');
        var parsedTime = new Date(safeTimeStr).getTime();
        if (!isNaN(parsedTime)) currentTimestamp = parsedTime;
      }
      // 6. 其他普通文本（笔记/标签）
      else {
        // 如果当前还没读到 > 划线，说明这些是文件表头说明，直接无视。
        if (currentQuote.length === 0) continue;

        // 砍掉前缀
        var cleanLine = line;
        if (cleanLine.indexOf('**笔记**:') === 0) cleanLine = cleanLine.replace('**笔记**:', '').trim();
        else if (cleanLine.indexOf('**上下文**:') === 0) cleanLine = cleanLine.replace('**上下文**:', '').trim();

        // 提取标签 (匹配中英文数字和底线)
        var tagMatches = cleanLine.match(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g);
        if (tagMatches) {
          tagMatches.forEach(function(t) {
            currentTags.add(t.substring(1)); // 去掉 # 号
          });
          // 从正文删掉标签
          cleanLine = cleanLine.replace(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g, '').trim();
        }

        if (cleanLine) currentNotes.push(cleanLine);
      }
    }
    flush(); // 处理末尾

    if (newItemsData.length === 0) {
      toast('未在文件中解析到有效的高亮或笔记');
      return;
    }

    // ==========================================
    // 开始全库比对
    // ==========================================
    var inboxCat = db.settings.focusModeCat || '收件箱';
    if (db.cats.indexOf(inboxCat) < 0) { db.cats.push(inboxCat); ensureColors(); }
    if (bookName !== '未知书籍' && db.sources.indexOf(bookName) < 0) db.sources.push(bookName);

    var addedCount = 0;
    var skippedCount = 0;

    // ★ 核心逻辑更新：如果待导入的素材在回收站里，直接从回收站抹除，并作为新素材加回来
    var incomingQuotes = new Set(newItemsData.map(function(d) { return d.quoteText; }));
    var trashRemoved = false;
    db.trash = db.trash.filter(function(tItem) {
      var originQuote = tItem.text.split('\n\n---\n\n')[0].trim();
      if (incomingQuotes.has(originQuote)) {
        trashRemoved = true;
        return false; // 从回收站彻底删除
      }
      return true;
    });
    if (trashRemoved && typeof markTrashDirty === 'function') {
      markTrashDirty(); // 更新存储
    }

    var existingMap = new Map();
    db.items.forEach(function(item) {
      if (item.source === bookName) {
        var originQuote = item.text.split('\n\n---\n\n')[0].trim();
        existingMap.set(originQuote, item);
      }
    });

    newItemsData.forEach(function (data) {
      var existingItem = existingMap.get(data.quoteText);

      if (existingItem) {
        if (existingItem.text.trim() === data.fullText.trim()) {
          skippedCount++;
        } else {
          updateCandidates.push({
            oldItem: existingItem,
            newText: data.fullText,
            newTags: data.tags,
            newTime: data.timestamp
          });
        }
      } else {
        var newItem = {
          id: uid(),
          text: data.fullText,
          type: inboxCat,
          source: bookName,
          tags: data.tags,
          images: [],
          createdAt: data.timestamp
        };
        db.items.unshift(newItem);
        markItemDirty(newItem);
        _indexAddItem(newItem);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      markIndexDirty();
      save();
      render();
      if (typeof updateReviewBtnState === 'function') updateReviewBtnState();
    }

    if (updateCandidates.length > 0) {
      openNoteDiffModal(updateCandidates, addedCount, skippedCount, bookName, inboxCat);
    } else {
      showMarkdownResult(addedCount, skippedCount, bookName, inboxCat);
    }
  };
  reader.readAsText(file);
}

function showMarkdownResult(added, skipped, bookName, inboxCat) {
  var msg = '成功从《' + bookName + '》解析出 ' + added + ' 条新素材，已放入【' + inboxCat + '】。';
  if (skipped > 0) msg += '\n(自动跳过了 ' + skipped + ' 条旧素材)';
  
  window.showCustomConfirm({
    title: added > 0 ? '导入成功' : '没有新素材',
    desc: msg + '\n\n是否立即推送到云端？',
    isDanger: false,
    onConfirm: function () {
      if (typeof ghPush === 'function') {
        toast('正在推送...');
        ghPush(false);
      }
    }
  });
}

// ★ 全新设计的卡片式对比弹窗
function openNoteDiffModal(candidates, added, skipped, bookName, inboxCat) {
  // 先移除可能存在的旧弹窗（原 modals.js 里的旧版）
  var oldMask = document.getElementById('noteDiffMask');
  if (oldMask) oldMask.remove();

  // 动态构建全新设计的弹窗 HTML
  var modalHtml = '<div class="modal-mask" id="noteDiffMask" style="z-index: 250;">' +
    '<div class="modal" style="max-width: 680px; width: 95%; border-radius: 16px;">' +
      '<div style="margin-bottom: 16px;">' +
        '<h3 class="modal-title" style="margin:0 0 8px 0; display:flex; align-items:center; gap:8px;">' +
          '<span style="font-size:20px;">📝</span> 发现笔记更新' +
        '</h3>' +
        '<p class="modal-desc" style="margin:0; font-size:14px;">划线原文未变动，但笔记内容被修改了。请确认是否覆盖旧笔记：</p>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">' +
        '<label style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13.5px; font-weight:500; color:var(--text-2);">' +
          '<input type="checkbox" id="noteDiffSelectAll" checked style="width:16px; height:16px; accent-color:var(--accent); margin:0;"> 全选所有更新' +
        '</label>' +
        '<span style="font-size:12.5px; color:var(--text-3); background:var(--bg); padding:2px 10px; border-radius:99px;" id="noteDiffCount"></span>' +
      '</div>' +
      '<div id="noteDiffList" style="max-height: 50vh; overflow-y: auto; display:flex; flex-direction:column; gap:12px; padding-right:4px; margin-bottom: 20px;"></div>' +
      '<div class="modal-actions" style="margin-top:0;">' +
        '<button class="btn" id="noteDiffCancel">放弃更新</button>' +
        '<button class="primary" id="noteDiffConfirm">应用勾选</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  var listEl = document.getElementById('noteDiffList');
  var selectAllCb = document.getElementById('noteDiffSelectAll');
  var countEl = document.getElementById('noteDiffCount');
  var confirmBtn = document.getElementById('noteDiffConfirm');
  var cancelBtn = document.getElementById('noteDiffCancel');
  var mask = document.getElementById('noteDiffMask');

  var renderList = candidates.slice(0, 50);
  
  listEl.innerHTML = renderList.map(function(c, idx) {
    var oldParts = c.oldItem.text.split('\n\n---\n\n');
    var oldNote = oldParts.length > 1 ? oldParts[1].trim() : '（无笔记）';
    var newParts = c.newText.split('\n\n---\n\n');
    var newNote = newParts.length > 1 ? newParts[1].trim() : '（无笔记）';
    var quoteText = oldParts[0].slice(0, 60) + (oldParts[0].length > 60 ? '...' : '');

    return '<div style="background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.02); transition:all .2s;">' +
      '<div style="display:flex; gap:10px; padding:12px 14px; background:var(--bg); border-bottom:1px solid var(--line); align-items:flex-start;">' +
        '<input type="checkbox" class="note-diff-cb" data-idx="' + idx + '" checked style="margin-top:2px; width:16px; height:16px; accent-color:var(--accent); cursor:pointer; flex:none;">' +
        '<div style="flex:1; min-width:0; font-size:13px; color:var(--text-2); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">' +
          '<span style="color:var(--text-3); font-weight:600; margin-right:4px;">原文划线：</span>' +
          esc(quoteText) +
        '</div>' +
      '</div>' +
      '<div style="display:flex; gap:1px; background:var(--line); flex-wrap:wrap;">' +
        '<div style="flex:1; min-width:200px; background:var(--card); padding:12px 14px;">' +
          '<div style="display:flex; align-items:center; gap:4px; margin-bottom:8px; font-size:12px; color:var(--danger); font-weight:600;">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>旧版笔记' +
          '</div>' +
          '<div style="font-size:13.5px; color:var(--text-2); line-height:1.6; word-break:break-word; white-space:pre-wrap;">' + esc(oldNote) + '</div>' +
        '</div>' +
        '<div style="flex:1; min-width:200px; background:#f0fdf4; padding:12px 14px;">' +
          '<div style="display:flex; align-items:center; gap:4px; margin-bottom:8px; font-size:12px; color:#10b981; font-weight:600;">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>新版笔记' +
          '</div>' +
          '<div style="font-size:13.5px; color:#047857; line-height:1.6; word-break:break-word; white-space:pre-wrap;">' + esc(newNote) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  if (candidates.length > 50) {
    listEl.innerHTML += '<div style="padding:10px; text-align:center; color:var(--text-3); font-size:12px;">...还有 ' + (candidates.length - 50) + ' 条未显示，点击应用将一并处理。</div>';
  }

  countEl.textContent = '共 ' + candidates.length + ' 条更新';
  selectAllCb.checked = true;
  selectAllCb.onchange = function() {
    listEl.querySelectorAll('.note-diff-cb').forEach(function(cb) { cb.checked = selectAllCb.checked; });
  };

  confirmBtn.onclick = function() {
    var selectedIndexes = [];
    listEl.querySelectorAll('.note-diff-cb').forEach(function(cb) {
      if (cb.checked) selectedIndexes.push(parseInt(cb.dataset.idx, 10));
    });

    if (selectedIndexes.length === 0 && candidates.length <= 50) { toast('没有勾选任何更新'); return; }

    var updatedCount = 0;
    selectedIndexes.forEach(function(idx) {
      var c = candidates[idx];
      var item = c.oldItem;
      var oldCopy = JSON.parse(JSON.stringify(item));
      
      item.text = c.newText;
      item.tags = c.newTags;
      item.updatedAt = c.newTime;
      
      markItemDirty(item);
      if (typeof _indexUpdateItem === 'function') _indexUpdateItem(oldCopy, item);
      updatedCount++;
    });

    if (candidates.length > 50) {
      for (var i = 50; i < candidates.length; i++) {
        var c = candidates[i];
        var item = c.oldItem;
        var oldCopy = JSON.parse(JSON.stringify(item));
        item.text = c.newText;
        item.tags = c.newTags;
        item.updatedAt = c.newTime;
        markItemDirty(item);
        if (typeof _indexUpdateItem === 'function') _indexUpdateItem(oldCopy, item);
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      markIndexDirty();
      save();
      render();
    }

    mask.classList.remove('show');
    showMarkdownResult(added, skipped + (candidates.length - selectedIndexes.length), bookName, inboxCat);
  };

  cancelBtn.onclick = function() {
    mask.classList.remove('show');
    showMarkdownResult(added, skipped + candidates.length, bookName, inboxCat);
  };

  mask.classList.add('show');
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
window.importReadestMarkdown = importReadestMarkdown;