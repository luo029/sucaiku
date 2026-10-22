// js/readest.js · 完整独立文件
// 专门负责 Readest 笔记导入的所有逻辑：按钮绑定、Markdown 解析、对比弹窗 UI。

(function() {
  // 绑定按钮事件
  var btn = document.getElementById('importNoteBtn');
  var fileInput = document.getElementById('noteFileInput');
  
  if (btn && fileInput) {
    btn.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (!f) return;
      if (typeof importReadestMarkdown === 'function') {
        importReadestMarkdown(f);
      }
      e.target.value = '';
    });
  }
})();

// ==========================================
// Readest Markdown 解析逻辑
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

    // 如果待导入的素材在回收站里，直接从回收站抹除，并作为新素材加回来
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

// 全新设计的卡片式对比弹窗
function openNoteDiffModal(candidates, added, skipped, bookName, inboxCat) {
  // 先移除可能存在的旧弹窗（如果有）
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