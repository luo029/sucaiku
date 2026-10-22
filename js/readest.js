// js/readest.js · 完整独立文件（终极美化修复版）
// 专门负责 Readest 笔记导入的所有逻辑：按钮绑定、Markdown 解析、对比弹窗 UI。
// 
// ★ 本次修复：去除了笔记前面自作主张加的 '> ' 前缀，修复多出 '>' 的问题，并清理多余空行。

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
// 核心 Diff 算法（LCS 最长公共子序列）
// 用于逐字对比新旧笔记，生成带颜色高亮的 HTML
// ==========================================
function generateDiffHtml(oldStr, newStr) {
  // 如果文本太长，为了防止卡顿，放弃逐字对比，直接显示纯文本
  if (oldStr.length > 2000 || newStr.length > 2000) {
    return { oldHtml: esc(oldStr), newHtml: esc(newStr) };
  }

  var matrix = [];
  var i, j;
  for (i = 0; i <= oldStr.length; i++) matrix[i] = [0];
  for (j = 0; j <= newStr.length; j++) matrix[0][j] = 0;

  for (i = 1; i <= oldStr.length; i++) {
    for (j = 1; j <= newStr.length; j++) {
      if (oldStr[i - 1] === newStr[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  var oldRes = [], newRes = [];
  var x = oldStr.length, y = newStr.length;

  while (x > 0 && y > 0) {
    if (oldStr[x - 1] === newStr[y - 1]) {
      oldRes.unshift(esc(oldStr[x - 1]));
      newRes.unshift(esc(newStr[y - 1]));
      x--; y--;
    } else if (matrix[x - 1][y] >= matrix[x][y - 1]) {
      oldRes.unshift('<span style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;padding:0 2px;border-radius:2px;margin:0 1px;">' + esc(oldStr[x - 1]) + '</span>');
      x--;
    } else {
      newRes.unshift('<span style="background:#dcfce7;color:#15803d;text-decoration:none;padding:0 2px;border-radius:2px;margin:0 1px;font-weight:600;">' + esc(newStr[y - 1]) + '</span>');
      y--;
    }
  }
  while (x > 0) {
    oldRes.unshift('<span style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;padding:0 2px;border-radius:2px;margin:0 1px;">' + esc(oldStr[x - 1]) + '</span>');
    x--;
  }
  while (y > 0) {
    newRes.unshift('<span style="background:#dcfce7;color:#15803d;text-decoration:none;padding:0 2px;border-radius:2px;margin:0 1px;font-weight:600;">' + esc(newStr[y - 1]) + '</span>');
    y--;
  }

  return {
    oldHtml: oldRes.join(''),
    newHtml: newRes.join('')
  };
}

// ==========================================
// Readest Markdown 解析逻辑
// ==========================================
function importReadestMarkdown(file) {
  var reader = new FileReader();
  
  // 增加等待提示
  if (typeof toast === 'function') toast('🔍 正在解析并比对笔记...');

  reader.onload = function (e) {
    var text = e.target.result;
    var lines = text.split('\n');
    
    // ★ 优化 1：智能识别书名
    var defaultBookName = file.name.replace(/\.md$/i, '').replace(/^《|》$/g, '').replace(/读后感|笔记|摘录/g, '').trim();
    var bookName = defaultBookName || '未知书籍';
    
    var newItemsData = [];     // 待新增
    var updateCandidates = []; // 待对比更新的

    var currentQuote = [];
    var currentNotes = [];
    var currentTags = new Set();
    var currentTimestamp = Date.now();

    // 结算当前这一组
    function flush() {
      if (currentQuote.length === 0) {
        currentQuote = [];
        currentNotes = [];
        currentTags = new Set();
        currentTimestamp = Date.now();
        return;
      }

      var quoteText = currentQuote.join('\n').trim();
      // ★ 修复：清理掉由于解析导致的过多空行
      var noteText = currentNotes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      
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
      
      currentQuote = [];
      currentNotes = [];
      currentTags = new Set();
      currentTimestamp = Date.now();
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      
      if (line === '---' || line === '* * *' || line === '***') {
        flush();
        continue;
      }
      
      if (!line) continue;

      // 如果 Markdown 里有 # 书名，以这个为准
      if (line.startsWith('# ')) {
        flush();
        bookName = line.substring(2).trim();
      } 
      else if (line.startsWith('### ')) {
        flush();
      }
      else if (line.startsWith('> ')) {
        currentQuote.push(line.substring(2).trim());
      }
      else if (line.indexOf('*时间：') === 0 || line.indexOf('*时间:') === 0) {
        var timeStr = line.replace(/^\*时间[：:]\s*/, '').replace(/\*$/, '').trim();
        var safeTimeStr = timeStr.replace(/\//g, '-').replace(' ', 'T');
        var parsedTime = new Date(safeTimeStr).getTime();
        if (!isNaN(parsedTime)) currentTimestamp = parsedTime;
      }
      else {
        if (currentQuote.length === 0) continue;

        var cleanLine = line;
        // ★ 修复：去掉自作聪明的 '> '，干干净净提取
        if (cleanLine.indexOf('**笔记**:') === 0) {
          cleanLine = cleanLine.replace('**笔记**:', '').trim();
        } else if (cleanLine.indexOf('**上下文**:') === 0) {
          cleanLine = '【上下文】' + cleanLine.replace('**上下文**:', '').trim();
        }

        var tagMatches = cleanLine.match(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g);
        if (tagMatches) {
          tagMatches.forEach(function(t) {
            currentTags.add(t.substring(1));
          });
          cleanLine = cleanLine.replace(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g, '').trim();
        }

        if (cleanLine) currentNotes.push(cleanLine);
      }
    }
    flush();

    if (newItemsData.length === 0) {
      if (typeof toast === 'function') toast('未在文件中解析到有效的高亮或笔记');
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

    // 检查回收站
    var incomingQuotes = new Set(newItemsData.map(function(d) { return d.quoteText; }));
    var trashRemoved = false;
    db.trash = db.trash.filter(function(tItem) {
      var originQuote = tItem.text.split('\n\n---\n\n')[0].trim();
      if (incomingQuotes.has(originQuote)) {
        trashRemoved = true;
        return false;
      }
      return true;
    });
    if (trashRemoved && typeof markTrashDirty === 'function') {
      markTrashDirty();
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

// ==========================================
// 全新设计的卡片式对比弹窗（带字级 Diff）
// ==========================================
function openNoteDiffModal(candidates, added, skipped, bookName, inboxCat) {
  var oldMask = document.getElementById('noteDiffMask');
  if (oldMask) oldMask.remove();

  var modalHtml = '<div class="modal-mask" id="noteDiffMask" style="z-index: 250; backdrop-filter: blur(4px);">' +
    '<div class="modal" style="max-width: 720px; width: 95%; border-radius: 16px; padding: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.2);">' +
      '<div style="margin-bottom: 20px;">' +
        '<h3 class="modal-title" style="margin:0 0 8px 0; display:flex; align-items:center; gap:8px; font-size: 20px;">' +
          '<span style="font-size:22px;">📝</span> 发现笔记更新' +
        '</h3>' +
        '<p class="modal-desc" style="margin:0; font-size:14px; color:var(--text-3);">划线原文未变动，但笔记内容被修改了。请确认是否覆盖旧笔记（<span style="color:#b91c1c;text-decoration:line-through;">红色为删除</span>，<span style="color:#15803d;">绿色为新增</span>）：</p>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px; background:var(--bg); border-radius:8px; padding:10px 14px;">' +
        '<label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; color:var(--text-2);">' +
          '<input type="checkbox" id="noteDiffSelectAll" checked style="width:16px; height:16px; accent-color:var(--accent); margin:0;"> 全选所有更新' +
        '</label>' +
        '<span style="font-size:12.5px; color:var(--text-3);" id="noteDiffCount"></span>' +
      '</div>' +
      '<div id="noteDiffList" style="max-height: 52vh; overflow-y: auto; display:flex; flex-direction:column; gap:16px; padding-right:4px; margin-bottom: 24px;"></div>' +
      '<div class="modal-actions" style="margin-top:0;">' +
        '<button class="btn" id="noteDiffCancel" style="flex:1;">放弃更新</button>' +
        '<button class="primary" id="noteDiffConfirm" style="flex:2;">应用勾选</button>' +
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
    
    // 生成 Diff HTML
    var diff = generateDiffHtml(oldNote, newNote);

    return '<div style="background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.04); transition:all .2s;">' +
      // 划线部分
      '<div style="display:flex; gap:10px; padding:12px 16px; background:var(--bg); border-bottom:1px solid var(--line); align-items:flex-start;">' +
        '<input type="checkbox" class="note-diff-cb" data-idx="' + idx + '" checked style="margin-top:2px; width:16px; height:16px; accent-color:var(--accent); cursor:pointer; flex:none;">' +
        '<div style="flex:1; min-width:0; font-size:13px; color:var(--text-3); line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">' +
          '<span style="font-weight:600; margin-right:4px;">划线：</span>' +
          esc(oldParts[0]) +
        '</div>' +
      '</div>' +
      // 对比部分
      '<div style="display:flex; gap:1px; background:var(--line); flex-wrap:wrap;">' +
        // 旧版
        '<div style="flex:1; min-width:240px; background:#fffafb; padding:14px 16px; border-left:3px solid #ef4444;">' +
          '<div style="display:flex; align-items:center; gap:6px; margin-bottom:10px; font-size:12.5px; color:#b91c1c; font-weight:700;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>旧版内容' +
          '</div>' +
          '<div style="font-size:13.5px; color:#333; line-height:1.7; word-break:break-word; white-space:pre-wrap;">' + diff.oldHtml + '</div>' +
        '</div>' +
        // 新版
        '<div style="flex:1; min-width:240px; background:#f0fdf4; padding:14px 16px; border-left:3px solid #10b981;">' +
          '<div style="display:flex; align-items:center; gap:6px; margin-bottom:10px; font-size:12.5px; color:#047857; font-weight:700;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>新版内容' +
          '</div>' +
          '<div style="font-size:13.5px; color:#064e3b; line-height:1.7; word-break:break-word; white-space:pre-wrap;">' + diff.newHtml + '</div>' +
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