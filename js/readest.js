// js/readest.js · 完整独立文件（新手友好·极致丝滑版）
// ★ 本次更新：
//   1) 解析时增加磨砂全屏 Loading 遮罩。
//   2) 自动将“已存在”的笔记折叠收纳，不再占据视觉空间。
//   3) 长文本自动折叠（点击展开）。
//   4) 确认导入后，自动重置筛选并跳转到“收件箱”，让新手直接看到成果。

(function() {
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
// ==========================================
function generateDiffHtml(oldStr, newStr) {
  if (oldStr.length > 2000 || newStr.length > 2000) {
    return { oldHtml: esc(oldStr), newHtml: esc(newStr) };
  }
  var matrix = [];
  var i, j;
  for (i = 0; i <= oldStr.length; i++) matrix[i] = [0];
  for (j = 0; j <= newStr.length; j++) matrix[0][j] = 0;
  for (i = 1; i <= oldStr.length; i++) {
    for (j = 1; j <= newStr.length; j++) {
      if (oldStr[i - 1] === newStr[j - 1]) matrix[i][j] = matrix[i - 1][j - 1] + 1;
      else matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
    }
  }
  var oldRes = [], newRes = [];
  var x = oldStr.length, y = newStr.length;
  while (x > 0 && y > 0) {
    if (oldStr[x - 1] === newStr[y - 1]) {
      oldRes.unshift(esc(oldStr[x - 1])); newRes.unshift(esc(newStr[y - 1]));
      x--; y--;
    } else if (matrix[x - 1][y] >= matrix[x][y - 1]) {
      oldRes.unshift('<span style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;padding:0 2px;border-radius:2px;">' + esc(oldStr[x - 1]) + '</span>');
      x--;
    } else {
      newRes.unshift('<span style="background:#dcfce7;color:#15803d;padding:0 2px;border-radius:2px;font-weight:600;">' + esc(newStr[y - 1]) + '</span>');
      y--;
    }
  }
  while (x > 0) { oldRes.unshift('<span style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;padding:0 2px;border-radius:2px;">' + esc(oldStr[x - 1]) + '</span>'); x--; }
  while (y > 0) { newRes.unshift('<span style="background:#dcfce7;color:#15803d;padding:0 2px;border-radius:2px;font-weight:600;">' + esc(newStr[y - 1]) + '</span>'); y--; }
  return { oldHtml: oldRes.join(''), newHtml: newRes.join('') };
}

// ==========================================
// Loading 遮罩层
// ==========================================
function showLoadingOverlay(text) {
  var old = document.getElementById('readestLoadingMask');
  if (old) old.remove();
  var html = '<div id="readestLoadingMask" style="position:fixed; inset:0; background:rgba(255,255,255,0.8); backdrop-filter:blur(4px); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: opacity 0.3s;">' +
    '<div style="width:40px; height:40px; border:4px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation: rs-spin 1s linear infinite;"></div>' +
    '<div style="margin-top:16px; font-size:14px; font-weight:600; color:var(--text);">' + text + '</div>' +
    '<style>@keyframes rs-spin { 100% { transform: rotate(360deg); } }</style>' +
  '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
function hideLoadingOverlay() {
  var el = document.getElementById('readestLoadingMask');
  if (el) {
    el.style.opacity = '0';
    setTimeout(function(){ el.remove(); }, 300);
  }
}

// ==========================================
// Readest Markdown 解析逻辑
// ==========================================
function importReadestMarkdown(file) {
  showLoadingOverlay('正在解析笔记数据...');
  
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var text = e.target.result;
      var lines = text.split('\n');
      
      var defaultBookName = file.name.replace(/\.md$/i, '').replace(/^《|》$/g, '').replace(/读后感|笔记|摘录/g, '').trim();
      var bookName = defaultBookName || '未知书籍';
      
      var newItemsData = [];
      var currentQuote = [];
      var currentNotes = [];
      var currentTags = new Set();
      var currentTimestamp = Date.now();

      function flush() {
        if (currentQuote.length === 0) {
          currentQuote = []; currentNotes = []; currentTags = new Set(); currentTimestamp = Date.now(); return;
        }
        var quoteText = currentQuote.join('\n').trim();
        var noteText = currentNotes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        var finalText = quoteText;
        if (noteText) finalText += '\n\n---\n\n' + noteText;
        
        if (finalText) {
          newItemsData.push({ quoteText: quoteText, fullText: finalText, tags: Array.from(currentTags), timestamp: currentTimestamp });
        }
        currentQuote = []; currentNotes = []; currentTags = new Set(); currentTimestamp = Date.now();
      }

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === '---' || line === '* * *' || line === '***') { flush(); continue; }
        if (!line) continue;

        if (line.startsWith('# ')) { flush(); bookName = line.substring(2).trim(); } 
        else if (line.startsWith('### ')) { flush(); }
        else if (line.startsWith('> ')) { currentQuote.push(line.substring(2).trim()); }
        else if (line.indexOf('*时间：') === 0 || line.indexOf('*时间:') === 0) {
          var timeStr = line.replace(/^\*时间[：:]\s*/, '').replace(/\*$/, '').trim();
          var safeTimeStr = timeStr.replace(/\//g, '-').replace(' ', 'T');
          var parsedTime = new Date(safeTimeStr).getTime();
          if (!isNaN(parsedTime)) currentTimestamp = parsedTime;
        }
        else {
          if (currentQuote.length === 0) continue;
          var cleanLine = line;
          if (cleanLine.indexOf('**笔记**:') === 0) cleanLine = cleanLine.replace('**笔记**:', '').trim();
          else if (cleanLine.indexOf('**上下文**:') === 0) cleanLine = '【上下文】' + cleanLine.replace('**上下文**:', '').trim();

          var tagMatches = cleanLine.match(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g);
          if (tagMatches) {
            tagMatches.forEach(function(t) { currentTags.add(t.substring(1)); });
            cleanLine = cleanLine.replace(/#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g, '').trim();
          }
          if (cleanLine) currentNotes.push(cleanLine);
        }
      }
      flush();

      hideLoadingOverlay();

      if (newItemsData.length === 0) {
        window.showCustomConfirm({
          title: '解析结果为空',
          desc: '未在文件中解析到有效的划线或笔记。\n\n请确认这是从 Readest 导出的 Markdown 文件，且包含 `> ` 格式的划线内容。',
          isDanger: true,
          onConfirm: function() {}
        });
        return;
      }

      var inboxCat = db.settings.focusModeCat || '收件箱';
      var existingMap = new Map();
      db.items.forEach(function(item) {
        if (item.source === bookName) {
          var originQuote = item.text.split('\n\n---\n\n')[0].trim();
          existingMap.set(originQuote, item);
        }
      });

      var previewData = newItemsData.map(function (data) {
        var existingItem = existingMap.get(data.quoteText);
        if (existingItem) {
          if (existingItem.text.trim() === data.fullText.trim()) {
            return { status: 'skip', quoteText: data.quoteText, fullText: data.fullText, tags: data.tags, timestamp: data.timestamp, oldItem: existingItem };
          } else {
            return { status: 'update', quoteText: data.quoteText, fullText: data.fullText, tags: data.tags, timestamp: data.timestamp, oldItem: existingItem };
          }
        } else {
          return { status: 'new', quoteText: data.quoteText, fullText: data.fullText, tags: data.tags, timestamp: data.timestamp };
        }
      });

      openImportPreviewModal(previewData, bookName, inboxCat);

    } catch (err) {
      hideLoadingOverlay();
      alert('解析过程发生错误，请截图反馈：\n' + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 导入预演弹窗 UI
// ==========================================
function openImportPreviewModal(items, bookName, inboxCat) {
  try {
    var oldMask = document.getElementById('importPreviewMask');
    if (oldMask) oldMask.remove();

    var newItems = items.filter(function(i) { return i.status === 'new'; });
    var updateItems = items.filter(function(i) { return i.status === 'update'; });
    var skipItems = items.filter(function(i) { return i.status === 'skip'; });

    var modalHtml = '<div class="modal-mask" id="importPreviewMask" style="z-index: 250; backdrop-filter: blur(4px); background: rgba(0,0,0,0.4);">' +
      '<div class="modal" style="max-width: 800px; width: 92%; border-radius: 16px; padding: 0; box-shadow: 0 24px 64px rgba(0,0,0,0.15); display:flex; flex-direction:column; max-height: 88vh; background: var(--card); overflow: hidden;">' +
        
        // Header
        '<div style="padding: 24px 24px 16px;">' +
          '<h3 style="margin:0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text); display:flex; align-items:center; gap:8px;">' +
            '📥 导入预演：' + esc(bookName) +
          '</h3>' +
          '<div style="font-size:13.5px; color:var(--text-3); display:flex; gap:12px; font-weight:500;">' +
            '<span style="color:#059669;">✨ 新增 ' + newItems.length + '</span>' +
            '<span style="color:#2563eb;">🔄 更新 ' + updateItems.length + '</span>' +
            '<span style="color:#6b7280;">👻 跳过 ' + skipItems.length + '</span>' +
          '</div>' +
        '</div>' +

        // Toolbar
        '<div style="padding: 10px 24px; background: var(--bg); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">' +
          '<label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; color:var(--text-2);">' +
            '<input type="checkbox" id="importSelectAll" checked style="width:16px; height:16px; accent-color:var(--accent); margin:0;"> 全选待导入内容' +
          '</label>' +
          '<span style="font-size:12.5px; color:var(--text-3); font-weight:500;" id="importSelectedCount"></span>' +
        '</div>' +

        // List
        '<div id="importPreviewList" style="flex:1; overflow-y: auto; padding: 0 24px;"></div>' +

        // Footer
        '<div style="padding: 16px 24px; border-top: 1px solid var(--line); background: var(--card); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-radius: 0 0 16px 16px;">' +
          '<label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13.5px; color:var(--text-2); font-weight:500;">' +
            '<div style="position:relative; display:inline-block; width:36px; height:20px;">' +
              '<input type="checkbox" id="importPushImmediately" style="opacity:0; width:0; height:0;">' +
              '<span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:var(--line-2); transition:.3s; border-radius:20px;"></span>' +
              '<span style="position:absolute; content:\'\'; height:16px; width:16px; left:2px; bottom:2px; background-color:white; transition:.3s; border-radius:50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>' +
            '</div>' +
            '立即同步到云端' +
          '</label>' +
          '<div style="display:flex; gap:12px;">' +
            '<button class="btn" id="importPreviewCancel" style="padding:8px 20px; border-radius:8px;">取消</button>' +
            '<button class="primary" id="importPreviewConfirm" style="padding:8px 24px; border-radius:8px;">确认写入</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Switch UI
    var switchInput = document.getElementById('importPushImmediately');
    var switchSpan = switchInput.nextElementSibling;
    var switchKnob = switchSpan.nextElementSibling;
    switchInput.addEventListener('change', function() {
      if (this.checked) {
        switchSpan.style.backgroundColor = 'var(--accent)';
        switchKnob.style.transform = 'translateX(16px)';
      } else {
        switchSpan.style.backgroundColor = 'var(--line-2)';
        switchKnob.style.transform = 'translateX(0)';
      }
    });

    var listEl = document.getElementById('importPreviewList');
    var selectAllCb = document.getElementById('importSelectAll');
    var countEl = document.getElementById('importSelectedCount');
    var confirmBtn = document.getElementById('importPreviewConfirm');
    var cancelBtn = document.getElementById('importPreviewCancel');
    var mask = document.getElementById('importPreviewMask');

    function updatePreviewSelectedCount() {
      var checked = listEl.querySelectorAll('.import-cb:checked').length;
      countEl.textContent = '已选 ' + checked + ' 条';
    }

    // 生成 HTML
    var html = '';
    
    // 渲染新增和更新
    items.forEach(function(item, idx) {
      if (item.status === 'skip') return; // 跳过的不在这里渲染

      var badge = '';
      var checked = 'checked';

      if (item.status === 'new') {
          badge = '<span style="color:#059669; font-size:12px; font-weight:600;">✨ 新增</span>';
      } else if (item.status === 'update') {
          badge = '<span style="color:#2563eb; font-size:12px; font-weight:600;">🔄 更新</span>';
      }

      var tagsHtml = item.tags.map(function(t) { return '<span style="color:var(--text-3); font-size:12px; margin-right:6px;">#' + esc(t) + '</span>'; }).join('');
      
      var contentHtml = '';
      if (item.status === 'update') {
          var oldParts = item.oldItem.text.split('\n\n---\n\n');
          var oldNote = oldParts.length > 1 ? oldParts[1].trim() : '（无笔记）';
          var newParts = item.fullText.split('\n\n---\n\n');
          var newNote = newParts.length > 1 ? newParts[1].trim() : '（无笔记）';
          var diff = generateDiffHtml(oldNote, newNote);
          
          contentHtml = '<div style="margin-top: 8px; display:flex; flex-direction:column; gap:8px;">' +
              '<div style="background:var(--bg); border-left:3px solid #ef4444; padding:10px 12px; border-radius:4px;">' +
                  '<div style="font-size:11px; color:#b91c1c; margin-bottom:4px; font-weight:600; letter-spacing:0.5px;">旧版笔记</div>' +
                  '<div style="font-size:13.5px; white-space:pre-wrap; color:var(--text); line-height:1.6;">' + diff.oldHtml + '</div>' +
              '</div>' +
              '<div style="background:var(--bg); border-left:3px solid #10b981; padding:10px 12px; border-radius:4px;">' +
                  '<div style="font-size:11px; color:#047857; margin-bottom:4px; font-weight:600; letter-spacing:0.5px;">新版笔记</div>' +
                  '<div style="font-size:13.5px; white-space:pre-wrap; color:var(--text); line-height:1.6;">' + diff.newHtml + '</div>' +
              '</div>' +
          '</div>';
      } else {
          // 新增，增加折叠类
          contentHtml = '<div class="expandable-text" style="margin-top:8px; font-size:13.5px; line-height:1.7; color:var(--text-2); white-space:pre-wrap; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; cursor:pointer;" title="点击展开/收起">' + formatText(item.fullText) + '</div>';
      }

      html += '<div class="import-preview-item" style="padding: 16px 0; border-bottom: 1px dashed var(--line);">' +
          '<div style="display:flex; align-items:flex-start; gap:12px;">' +
              '<input type="checkbox" class="import-cb" data-idx="' + idx + '" ' + checked + ' style="margin-top:2px; width:16px; height:16px; accent-color:var(--accent); cursor:pointer;">' +
              '<div style="flex:1; min-width:0;">' +
                  '<div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">' +
                      badge +
                      '<span style="font-size:12px; color:var(--text-3);">📖 《' + esc(bookName) + '》</span>' +
                      '<span style="background:var(--accent-soft); color:var(--accent); padding:1px 6px; border-radius:4px; font-size:11px;">' + esc(inboxCat) + '</span>' +
                      '<div style="display:flex; flex-wrap:wrap;">' + tagsHtml + '</div>' +
                  '</div>' +
                  contentHtml +
              '</div>' +
          '</div>' +
      '</div>';
    });

    // 如果有跳过的，底部折叠显示
    if (skipItems.length > 0) {
        html += '<details style="margin: 16px 0;">' +
            '<summary style="cursor:pointer; font-size:13px; color:var(--text-3); font-weight:500; outline:none; user-select:none;">👻 查看 ' + skipItems.length + ' 条已存在（默认跳过）</summary>' +
            '<div style="padding-top:12px; opacity:0.6;">';
        skipItems.slice(0, 20).forEach(function(item) {
             html += '<div style="padding: 8px 0; border-bottom: 1px dashed var(--line); font-size:13px; color:var(--text-2); line-height:1.5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(item.fullText.slice(0, 60)) + '</div>';
        });
        if (skipItems.length > 20) html += '<div style="padding-top:8px; font-size:12px; color:var(--text-3);">... 以及另外 ' + (skipItems.length - 20) + ' 条</div>';
        html += '</div></details>';
    }

    listEl.innerHTML = html;
    if (skipItems.length === 0) listEl.lastElementChild.style.borderBottom = 'none';

    // 事件绑定
    updatePreviewSelectedCount();
    
    // 长文本展开/收起
    listEl.querySelectorAll('.expandable-text').forEach(function(el) {
        el.addEventListener('click', function() {
            if (el.style.webkitLineClamp === 'unset') {
                el.style.webkitLineClamp = '3';
                el.style.display = '-webkit-box';
            } else {
                el.style.webkitLineClamp = 'unset';
                el.style.display = 'block';
            }
        });
    });

    listEl.querySelectorAll('.import-cb').forEach(function(cb) {
      cb.addEventListener('change', updatePreviewSelectedCount);
    });

    selectAllCb.checked = true;
    selectAllCb.onchange = function() {
      listEl.querySelectorAll('.import-cb').forEach(function(cb) {
        cb.checked = selectAllCb.checked;
      });
      updatePreviewSelectedCount();
    };

    confirmBtn.onclick = function() {
      var selectedIndexes = [];
      listEl.querySelectorAll('.import-cb').forEach(function(cb) {
        if (cb.checked) selectedIndexes.push(parseInt(cb.dataset.idx, 10));
      });

      if (selectedIndexes.length === 0) {
         toast('没有勾选任何笔记');
         return;
      }

      var addedCount = 0;
      var updatedCount = 0;
      
      var allSelectedItems = selectedIndexes.map(function(idx) { return items[idx]; });
      var selectedQuotes = new Set(allSelectedItems.map(function(x) { return x.quoteText; }));

      var trashRemoved = false;
      db.trash = db.trash.filter(function(tItem) {
        var originQuote = tItem.text.split('\n\n---\n\n')[0].trim();
        if (selectedQuotes.has(originQuote)) {
          trashRemoved = true;
          return false;
        }
        return true;
      });
      if (trashRemoved && typeof markTrashDirty === 'function') markTrashDirty();

      allSelectedItems.forEach(function(item) {
        if (item.status === 'new') {
          var newItem = {
            id: uid(), text: item.fullText, type: inboxCat, source: bookName, tags: item.tags, images: [], createdAt: item.timestamp
          };
          db.items.unshift(newItem);
          markItemDirty(newItem); _indexAddItem(newItem);
          addedCount++;
        } else if (item.status === 'update') {
           var oldCopy = JSON.parse(JSON.stringify(item.oldItem));
           item.oldItem.text = item.fullText;
           item.oldItem.tags = item.tags;
           item.oldItem.updatedAt = item.timestamp;
           markItemDirty(item.oldItem);
           if (typeof _indexUpdateItem === 'function') _indexUpdateItem(oldCopy, item.oldItem);
           updatedCount++;
        }
      });

      if (addedCount > 0 || updatedCount > 0) {
        markIndexDirty(); save();
        
        // ★ 强制跳到收件箱，让用户看到成果
        currentType = inboxCat;
        currentSource = ALL_SOURCES;
        currentTags.clear();
        keyword = '';
        if (typeof searchEl !== 'undefined' && searchEl) searchEl.value = '';
        currentPage = 1;
        
        render();
        if (typeof updateReviewBtnState === 'function') updateReviewBtnState();
      }

      mask.classList.remove('show');

      var shouldPush = switchInput.checked;
      
      var msg = '成功处理 ' + (addedCount + updatedCount) + ' 条素材！';
      if (addedCount > 0) msg += ' (新增 ' + addedCount;
      if (updatedCount > 0) msg += (addedCount > 0 ? ', ' : ' (') + '更新 ' + updatedCount;
      if (addedCount > 0 || updatedCount > 0) msg += ')';
      
      if (shouldPush) {
        if (typeof ghPush === 'function') {
          toast('☁️ ' + msg + '，正在推送到云端...');
          ghPush(false);
        }
      } else {
        if (typeof scheduleAutoPush === 'function') {
          toast('💾 ' + msg + '，已存本地（稍后自动同步）');
          scheduleAutoPush();
        } else {
          toast('💾 ' + msg);
        }
      }
    };

    cancelBtn.onclick = function() {
      mask.classList.remove('show');
      if (typeof toast === 'function') toast('已取消导入');
    };

    mask.classList.add('show');
  } catch (err) {
    hideLoadingOverlay();
    alert('弹窗生成错误：\n' + err.message);
    console.error(err);
  }
}