// js/readest.js · 完整文件
// ★ 本次改动：彻底移除了预览界面的行数截断限制，长段落将完整展示（支持内部滚动），方便确认内容。

(function() {
  var importBtn = document.getElementById('importNoteBtn');
  var fileInput = document.getElementById('noteFileInput');

  if (!importBtn || !fileInput) {
    console.warn('[readest] 未找到元素');
    return;
  }

  importBtn.addEventListener('click', function() {
    fileInput.value = ''; 
    fileInput.click();
  });

  fileInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      processMarkdown(ev.target.result, file.name);
    };
    reader.readAsText(file);
  });

  function processMarkdown(text, filename) {
    var lines = text.split('\n');
    var notes = [];
    var bookTitle = filename.replace(/\.md$/i, '');

    var titleMatch = text.match(/^#\s+(.+)$/m);
    if (titleMatch) bookTitle = titleMatch[1].trim();

    var currentQuote = '';
    var currentTime = null;
    var timeRegex = /时间[：:\s]+([\d\/\.\-]+\s+[\d:]+)/;

    function saveNote() {
      if (currentQuote.trim()) {
        notes.push({
          text: currentQuote.trim(),
          originalTime: currentTime
        });
      }
      currentQuote = '';
      currentTime = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimLine = line.trim();

      if (trimLine.startsWith('>')) {
        var content = trimLine.substring(1).trim();
        if (content) {
          currentQuote += (currentQuote ? '\n' : '') + content;
        }
      } else if (trimLine.includes('时间') && timeRegex.test(trimLine)) {
        var match = trimLine.match(timeRegex);
        if (match) {
          currentTime = match[1]; 
        }
      } else if (trimLine.startsWith('#')) {
        saveNote();
      } else {
        if (currentQuote) saveNote();
      }
    }
    saveNote();

    if (notes.length === 0) {
      toast('未从笔记中解析到任何内容（请确认笔记里有 > 引用内容）');
      return;
    }

    showPreview(notes, bookTitle);
  }

  function showPreview(notes, bookTitle) {
    var oldMask = document.getElementById('readestPreviewMask');
    if (oldMask) oldMask.remove();

    var defaultCat = db.settings.focusModeCat || '收件箱';
    var defaultPush = db.settings.readestDefaultPush === true;
    var PAGE_SIZE = 50;

    var html = '<div class="modal-mask show" id="readestPreviewMask" style="z-index: 250;">'
      + '<div class="modal" style="max-width: 480px; padding: 20px;">'
      + '<div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">'
      + '<div class="modal-icon export-icon" style="margin-bottom:0; width:40px; height:40px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>'
      + '<div><h3 class="modal-title" style="margin:0; font-size:16px;">笔记导入预览</h3><p style="margin:2px 0 0; font-size:12px; color:var(--text-3);">《' + esc(bookTitle) + '》 · 共 ' + notes.length + ' 条</p></div>'
      + '</div>'
      + '<div id="readestListContainer" style="max-height: 40vh; overflow-y: auto; background: var(--bg); border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; border: 1px solid var(--line);"></div>';

    html += '<div style="margin-bottom: 12px;">'
      + '<label style="display:block; font-size:12px; color:var(--text-3); margin-bottom:6px;">导入到分类</label>'
      + '<select id="readestCatSelect" class="page-size" style="width: 100%; padding: 8px 10px;">'
      + db.cats.map(function(c) { return '<option value="' + esc(c) + '" ' + (c === defaultCat ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('')
      + '</select>'
      + '</div>';

    html += '<label class="modal-check" style="margin-top: 4px; padding: 8px 10px;">'
      + '<input type="checkbox" id="readestPushCheck" ' + (defaultPush ? 'checked' : '') + '>'
      + '<span style="font-size:13px;">导入完成后立即同步到云端</span>'
      + '</label>';

    html += '<div class="modal-actions" style="margin-top: 16px;">'
      + '<button class="btn" id="readestCancelBtn">取消</button>'
      + '<button class="primary" id="readestConfirmBtn">确认导入 (' + notes.length + ')</button>'
      + '</div>';

    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var renderedCount = 0;
    var listContainer = document.getElementById('readestListContainer');
    
    function renderMore() {
      var nextNotes = notes.slice(renderedCount, renderedCount + PAGE_SIZE);
      var listHtml = '';
      
      nextNotes.forEach(function(n, i) {
        var actualIndex = renderedCount + i;
        var timeBadge = n.originalTime ? '<span style="font-size:11px; color:var(--text-3); background:var(--line); padding:1px 6px; border-radius:4px; margin-left:8px; user-select:none;">' + esc(n.originalTime) + '</span>' : '';
        
        // ★ 核心修复：移除了 line-clamp，加入 white-space: pre-wrap 保留原换行，word-break: break-word 防止长单词撑破
        listHtml += '<div style="font-size: 13px; color: var(--text-2); padding: 10px 0; border-bottom: 1px dashed var(--line); white-space: pre-wrap; word-break: break-word; line-height: 1.6;">'
          + '<span style="color: var(--accent); margin-right: 4px; font-weight: bold;">' + (actualIndex + 1) + '.</span>' 
          + esc(n.text) + timeBadge
          + '</div>';
      });
      
      listContainer.insertAdjacentHTML('beforeend', listHtml);
      renderedCount += nextNotes.length;

      var oldBtn = document.getElementById('readestLoadMoreBtn');
      if (oldBtn) oldBtn.remove();

      if (renderedCount < notes.length) {
        var btnHtml = '<div id="readestLoadMoreBtn" style="text-align:center; padding:12px 0; cursor:pointer; color:var(--accent); font-size:13px; font-weight:600;">'
          + '继续加载剩余 ' + (notes.length - renderedCount) + ' 条... <svg style="vertical-align:-2px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></div>';
        listContainer.insertAdjacentHTML('beforeend', btnHtml);
        
        document.getElementById('readestLoadMoreBtn').addEventListener('click', function() {
          renderMore();
        });
      }
    }
    
    renderMore();

    var mask = document.getElementById('readestPreviewMask');
    document.getElementById('readestCancelBtn').addEventListener('click', function() { mask.remove(); });
    mask.addEventListener('click', function(e) { if (e.target === mask) mask.remove(); });

    document.getElementById('readestConfirmBtn').addEventListener('click', function() {
      var targetCat = document.getElementById('readestCatSelect').value;
      var doPush = document.getElementById('readestPushCheck').checked;
      mask.remove();
      executeImport(notes, bookTitle, targetCat, doPush);
    });
  }

  function executeImport(notes, bookTitle, targetCat, doPush) {
    var now = Date.now();
    var added = 0;

    notes.forEach(function(n) {
      var originalTs = null;
      if (n.originalTime) {
        var parsed = new Date(n.originalTime.replace(/-/g, '/')).getTime();
        if (!isNaN(parsed)) originalTs = parsed;
      }

      var newItem = {
        id: uid(),
        text: n.text,
        type: targetCat,
        source: bookTitle,
        tags: [],
        images: [],
        createdAt: now, 
        originalCreatedAt: originalTs || undefined, 
      };
      db.items.push(newItem);
      markItemDirty(newItem);
      added++;
    });

    if (db.sources.indexOf(bookTitle) < 0) db.sources.push(bookTitle);
    if (db.cats.indexOf(targetCat) < 0) {
      db.cats.push(targetCat);
      ensureColors();
      db.catVersion = (db.catVersion || 0) + 1;
    }

    markIndexDirty();
    save(); 

    toast('✅ 成功导入 ' + added + ' 条笔记到「' + targetCat + '」');

    if (doPush && typeof ghPush === 'function') {
      toast('正在推送到云端...');
      ghPush(false).then(function(ok) { if (ok) toast('✅ 云端同步成功'); });
    }

    if (db.settings.readestAutoJump !== false) {
      currentType = targetCat;
      currentSource = ALL_SOURCES;
      currentTags.clear();
      currentPage = 1;
    }
    render();
  }

})();