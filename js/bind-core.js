// js/bind-core.js · 完整文件
// ★ 本次改动：
//   修复了：在极简模式的面板内部滚动（例如查看分类列表）时，面板被误关闭的问题。

addBtn.addEventListener('click', addOrUpdate);
cancelBtn.addEventListener('click', cancelEdit);

inputEl.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var isCtrl = e.ctrlKey || e.metaKey;
  var shortcut = db.settings.saveShortcut || 'ctrl-enter';
  if (shortcut === 'enter') { if (!e.shiftKey) { e.preventDefault(); addOrUpdate(); } }
  else { if (isCtrl) { e.preventDefault(); addOrUpdate(); } }
});

function handleIncomingImages(files) {
  if (!files.length) return;
  if (focusMode && db.settings.focusImgAutoUpload !== false) {
    pendingUploadFiles = files;
    var cats = db.imageCategories.length ? db.imageCategories : DEFAULT_IMG_CATS;
    pendingUploadCat = cats.indexOf(db.settings.focusImgDefaultCat) >= 0 ? db.settings.focusImgDefaultCat : cats[0];
    if ($('imgUploadTags')) $('imgUploadTags').value = '';
    startUploadPending();
  } else { openImgCatChooser(files); }
}

inputEl.addEventListener('paste', function (e) {
  var items = (e.clipboardData || e.originalEvent.clipboardData).items;
  var files = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.kind === 'file' && it.type.indexOf('image/') === 0) files.push(it.getAsFile());
  }
  if (files.length) { e.preventDefault(); handleIncomingImages(files); }
});

$('imgBtn').addEventListener('click', function () {
  var cfg = loadGH();
  if (!ghReady(cfg)) { toast('请先在设置中配置 GitHub'); return; }
  $('imgFileInput').click();
});
$('imgFileInput').addEventListener('change', function (e) {
  var files = Array.from(e.target.files || []);
  e.target.value = '';
  handleIncomingImages(files);
});

document.addEventListener('paste', function (e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  if (document.querySelector('.modal-mask.show') ||
      (document.getElementById('imgView') && !document.getElementById('imgView').hidden) ||
      (document.getElementById('imgManagerView') && !document.getElementById('imgManagerView').hidden)) return;
  if (document.body.classList.contains('zen-mode') || document.body.classList.contains('guest-mode')) return;
  var clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;
  var text = clipboardData.getData('text/plain');
  if (!text || !text.trim()) return;
  e.preventDefault();
  if (inputEl.value.trim()) inputEl.value += '\n' + text;
  else inputEl.value = text;
  scrollTop(); inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  if (!document.body.classList.contains('focus-mode')) toast('已自动吸入剪贴板');
});

$('imgCatList').addEventListener('click', function (e) {
  var opt = e.target.closest('.img-cat-opt'); if (!opt) return;
  pendingUploadCat = opt.dataset.cat;
  $('imgCatList').querySelectorAll('.img-cat-opt').forEach(function (el) { el.classList.toggle('active', el.dataset.cat === pendingUploadCat); });
});
$('imgCatCancel').addEventListener('click', function () {
  if (uploadInProgress) return;
  $('imgCatMask').classList.remove('show');
  pendingUploadFiles = [];
});
$('imgCatConfirm').addEventListener('click', function () { startUploadPending(); });
$('imgCatMask').addEventListener('click', function (e) {
  if (e.target === $('imgCatMask') && !uploadInProgress) { $('imgCatMask').classList.remove('show'); pendingUploadFiles = []; }
});

pendingImgsEl.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-rm-img]'); if (!btn) return;
  var idx = parseInt(btn.dataset.rmImg, 10);
  if (idx >= 0 && idx < pendingImages.length) { pendingImages.splice(idx, 1); renderPendingImgs(); }
});

$('sourceToggle').addEventListener('click', function (e) {
  e.stopPropagation(); closeTagPanel();
  if (sourcePanel.hidden) openSourcePanel(); else closeSourcePanel();
});
spSearch.addEventListener('input', function () { renderSourcePanelList(spSearch.value); });
spSearch.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSourcePanel(); });
spList.addEventListener('click', function (e) {
  var pinEl = e.target.closest('.sp-pin');
  if (pinEl) { e.stopPropagation(); setFixedSource(pinEl.dataset.pin); return; }
  var item = e.target.closest('.sp-item'); if (!item) return;
  var s = item.dataset.pick || '';
  sourceEl.value = s; updateSourcePickerUI(); closeSourcePanel(); sourceEl.focus();
});

$('tagToggle').addEventListener('click', function (e) {
  e.stopPropagation(); closeSourcePanel();
  if (tagPanel.hidden) openTagPanel(); else closeTagPanel();
});
tpSearch.addEventListener('input', function () { renderTagPanelList(tpSearch.value); });
tpSearch.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTagPanel(); });
tpList.addEventListener('click', function (e) {
  var pinEl = e.target.closest('.sp-pin');
  if (pinEl) { e.stopPropagation(); toggleFixedTag(pinEl.dataset.pin); return; }
  var item = e.target.closest('.sp-item'); if (!item) return;
  var t = item.dataset.pick || '';
  var cur = tagsEl.value.trim().split(/[,，\s]+/).filter(Boolean);
  if (cur.indexOf(t) >= 0) cur = cur.filter(function (x) { return x !== t; });
  else cur.push(t);
  tagsEl.value = cur.join(', ');
  updateTagPickerUI(); renderTagPanelList(tpSearch.value); tagsEl.focus();
});

document.addEventListener('click', function (e) {
  if (!sourcePanel.hidden && !sourcePicker.contains(e.target)) closeSourcePanel();
  if (!tagPanel.hidden && !tagPicker.contains(e.target)) closeTagPanel();
  if ($('sourceFilterPanel') && !$('sourceFilterPanel').hidden && !$('sourceFilterWrap').contains(e.target)) $('sourceFilterPanel').hidden = true;
  if ($('catFilterPanel') && !$('catFilterPanel').hidden && !$('catFilterWrap').contains(e.target)) $('catFilterPanel').hidden = true;
  var zenPanel = document.getElementById('zenFilterPanel');
  if (zenPanel && !zenPanel.contains(e.target) && !e.target.closest('.zen-filter-btn')) zenPanel.remove();
});

$('hitokotoRefresh').addEventListener('click', fetchHitokoto);

// ★ 极简模式下，向下滑动页面自动隐藏顶部筛选栏；向上滑动恢复
var lastZenScroll = window.scrollY || 0;
window.addEventListener('scroll', function() {
  if (!document.body.classList.contains('zen-mode')) return;
  if (db.settings && db.settings.zenAutoClosePanel === false) {
    document.body.classList.remove('zen-hide-bar');
    return;
  }
  var y = window.scrollY || window.pageYOffset;
  if (y > lastZenScroll && y > 60) {
    document.body.classList.add('zen-hide-bar');
  } else if (y < lastZenScroll - 10 || y <= 60) {
    document.body.classList.remove('zen-hide-bar');
  }
  lastZenScroll = y;
}, { passive: true });

var searchDebounceTimer = null;
searchEl.addEventListener('input', function () {
  clearTimeout(searchDebounceTimer);
  var delay = Math.max(80, Math.min(500, Number(db.settings.searchDebounceMs) || 180));
  searchDebounceTimer = setTimeout(function () {
    keyword = searchEl.value; currentPage = 1; clearFilterCache(); renderList(); renderHeader();
  }, delay);
});

if ($('catFilterBtn')) {
  $('catFilterBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    var panel = $('catFilterPanel');
    if (panel.hidden) {
      $('catFilterSearch').value = ''; renderCatFilterList(); panel.hidden = false;
      setTimeout(function () { $('catFilterSearch').focus(); }, 50);
    } else panel.hidden = true;
  });
}
if ($('catFilterSearch')) {
  $('catFilterSearch').addEventListener('input', renderCatFilterList);
  $('catFilterSearch').addEventListener('keydown', function (e) { if (e.key === 'Escape') $('catFilterPanel').hidden = true; });
}
if ($('catFilterList')) {
  $('catFilterList').addEventListener('click', function (e) {
    var item = e.target.closest('.sp-item'); if (!item) return;
    var val = item.dataset.pick;
    currentType = val === '__all__' ? '全部' : val;
    currentPage = 1; render(); $('catFilterPanel').hidden = true;
  });
}

if ($('sourceFilterBtn')) {
  $('sourceFilterBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    var panel = $('sourceFilterPanel');
    if (panel.hidden) {
      $('sourceFilterSearch').value = ''; renderSourceFilterList(); panel.hidden = false;
      setTimeout(function () { $('sourceFilterSearch').focus(); }, 50);
    } else panel.hidden = true;
  });
}
if ($('sourceFilterSearch')) {
  $('sourceFilterSearch').addEventListener('input', renderSourceFilterList);
  $('sourceFilterSearch').addEventListener('keydown', function (e) { if (e.key === 'Escape') $('sourceFilterPanel').hidden = true; });
}
if ($('sourceFilterList')) {
  $('sourceFilterList').addEventListener('click', function (e) {
    var item = e.target.closest('.sp-item'); if (!item) return;
    var val = item.dataset.pick;
    currentSource = val === '__all__' ? ALL_SOURCES : val;
    currentPage = 1; render(); $('sourceFilterPanel').hidden = true;
  });
}

$('catNav').addEventListener('click', function (e) {
  var btn = e.target.closest('.nav-item[data-type]'); if (!btn) return;
  currentType = btn.dataset.type; currentPage = 1;
  render(); closeSidebarIfMobile(); scrollTop();
});
$('sourceNav').addEventListener('click', function (e) {
  var delBtn = e.target.closest('[data-del-source]');
  if (delBtn) { e.stopPropagation(); deleteSource(delBtn.dataset.delSource); return; }
  var btn = e.target.closest('.nav-item[data-source]'); if (!btn) return;
  currentSource = btn.dataset.source; currentPage = 1;
  render(); closeSidebarIfMobile(); scrollTop();
});

$('tagNav').addEventListener('click', function (e) {
  var btn = e.target.closest('.nav-item[data-tag]'); if (!btn) return;
  var t = btn.dataset.tag;
  if (t === '__all__') currentTags.clear();
  else { if (currentTags.has(t)) currentTags.delete(t); else currentTags.add(t); }
  currentTag = currentTags.size > 0 ? Array.from(currentTags)[0] : '';
  currentPage = 1;
  render(); closeSidebarIfMobile(); scrollTop();
});

$('manageCatBtn').addEventListener('click', function () {
  renderCatManager(); $('catManageMask').classList.add('show'); closeSidebarIfMobile();
});

$('manageTagBtn').addEventListener('click', function () {
  renderTagManager(); $('tagManageMask').classList.add('show'); closeSidebarIfMobile();
});
$('tagManageCloseBtn').addEventListener('click', function () { $('tagManageMask').classList.remove('show'); });
$('tagManageMask').addEventListener('click', function (e) { if (e.target === $('tagManageMask')) $('tagManageMask').classList.remove('show'); });
$('tagManageList').addEventListener('change', function (e) {
  var inp = e.target.closest('[data-tag-old]'); if (!inp) return;
  renameTag(inp.dataset.tagOld, inp.value);
});
$('tagManageList').addEventListener('keydown', function (e) {
  if (e.target.matches('[data-tag-old]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});

zenBarEl.addEventListener('click', function (e) {
  var t = e.target.closest('.zb'); if (!t) return;
  if (t.id === 'zenTypeBtn') { openZenFilterPanel('type'); return; }
  if (t.id === 'zenSrcBtn') { openZenFilterPanel('source'); return; }
  if (t.id === 'zenTagBtn') { openZenFilterPanel('tag'); return; }
});

function openZenFilterPanel(type) {
  var panel = document.getElementById('zenFilterPanel');
  if (panel) {
    if (panel.dataset.type === type && !panel.hidden) { panel.hidden = true; return; }
    panel.remove();
  }
  panel = document.createElement('div');
  panel.id = 'zenFilterPanel';
  panel.className = 'source-panel';
  panel.dataset.type = type;
  panel.style.cssText = 'position:absolute; width:240px; z-index:999; background:var(--card); border:1px solid var(--line); border-radius:12px; box-shadow:var(--sh-3);';
  panel.innerHTML = '<div class="sp-search-wrap"><input id="zenFilterSearch" placeholder="搜索..." autocomplete="off"></div><div class="sp-list" id="zenFilterList" style="max-height:260px;"></div>';
  document.body.appendChild(panel);
  var btnId = type === 'type' ? 'zenTypeBtn' : (type === 'source' ? 'zenSrcBtn' : 'zenTagBtn');
  var btn = document.getElementById(btnId);
  if (btn) {
    var rect = btn.getBoundingClientRect();
    panel.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    var left = rect.left + window.scrollX;
    var maxLeft = window.innerWidth - 240 - 20;
    if (left > maxLeft) left = maxLeft;
    panel.style.left = left + 'px';
  }

  // ★ 修复：如果是在面板内部滑动（比如搜索列表），不要关闭面板
  function closePanelOnScroll(e) {
    if (db.settings && db.settings.zenAutoClosePanel === false) return;
    if (e && e.target && panel.contains(e.target)) return;
    if (panel && panel.parentNode) {
      panel.remove();
      window.removeEventListener('scroll', closePanelOnScroll);
      window.removeEventListener('touchmove', closePanelOnScroll);
      window.removeEventListener('wheel', closePanelOnScroll);
    }
  }
  window.addEventListener('scroll', closePanelOnScroll, { passive: true });
  window.addEventListener('touchmove', closePanelOnScroll, { passive: true });
  window.addEventListener('wheel', closePanelOnScroll, { passive: true });

  var searchInput = document.getElementById('zenFilterSearch');
  setTimeout(function () { searchInput.focus(); }, 50);
  var renderZenList = function (q) {
    q = q || '';
    var listEl = document.getElementById('zenFilterList');
    if (!listEl) return;
    var lowerQ = q.toLowerCase();
    var html = '';
    if (type === 'type') {
      var textItems = db.items.filter(function (i) { return i.text; });
      var counts = {};
      textItems.forEach(function (i) { counts[i.type] = (counts[i.type] || 0) + 1; });
      var allCats = ['全部'].concat(db.cats);
      if ((counts[UNCAT] || 0) > 0) allCats.push(UNCAT);
      var list = allCats;
      if (lowerQ) list = list.filter(function (s) { return s.toLowerCase().indexOf(lowerQ) >= 0; });
      html += '<div class="sp-item ' + (currentType === '全部' ? 'sp-selected' : '') + '" data-pick="__all__"><span class="sp-name">全部分类</span></div>';
      list.forEach(function (s) {
        if (s === '全部') return;
        var n = counts[s] || 0;
        html += '<div class="sp-item ' + (currentType === s ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '"><span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span></div>';
      });
    } else if (type === 'source') {
      var sCounts = {};
      db.items.forEach(function (i) { if (i.source) sCounts[i.source] = (sCounts[i.source] || 0) + 1; });
      var sList = db.sources;
      if (lowerQ) sList = sList.filter(function (s) { return s.toLowerCase().indexOf(lowerQ) >= 0; });
      html += '<div class="sp-item ' + (currentSource === ALL_SOURCES ? 'sp-selected' : '') + '" data-pick="__all__"><span class="sp-name">全部来源</span></div>';
      sList.forEach(function (s) {
        var n = sCounts[s] || 0;
        html += '<div class="sp-item ' + (currentSource === s ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '"><span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span></div>';
      });
    } else {
      var tCounts = collectTags();
      var tList = Object.keys(tCounts).sort(function (a, b) { return tCounts[b] - tCounts[a] || a.localeCompare(b, 'zh'); });
      if (lowerQ) tList = tList.filter(function (s) { return s.toLowerCase().indexOf(lowerQ) >= 0; });
      html += '<div class="sp-item ' + (!currentTag ? 'sp-selected' : '') + '" data-pick=""><span class="sp-name">全部标签</span></div>';
      tList.forEach(function (s) {
        var n = tCounts[s] || 0;
        html += '<div class="sp-item ' + (currentTag === s ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '"><span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span></div>';
      });
    }
    listEl.innerHTML = html;
  };
  renderZenList();
  searchInput.addEventListener('input', function (e) { renderZenList(e.target.value); });
  panel.addEventListener('click', function (e) {
    var item = e.target.closest('.sp-item'); if (!item) return;
    e.stopPropagation();
    var val = item.dataset.pick;
    if (type === 'type') currentType = val === '__all__' ? '全部' : val;
    else if (type === 'source') currentSource = val === '__all__' ? ALL_SOURCES : val;
    else currentTag = val || '';
    currentPage = 1;
    renderList(); renderHeader();
    panel.hidden = true;
    window.removeEventListener('scroll', closePanelOnScroll);
    window.removeEventListener('touchmove', closePanelOnScroll);
    window.removeEventListener('wheel', closePanelOnScroll);
  });
}

// ★ 图片加载失败回退（新增：重试上限 3 次，防止死循环）
function handleImgFallback(e) {
  var img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  var path = img.dataset.imgPath;
  if (!path || img.dataset.fallbackDone) return;
  var retryCount = parseInt(img.dataset.retryCount || '0', 10);
  if (retryCount >= 3) {
    img.dataset.fallbackDone = '1';
    img.style.opacity = '.3';
    img.title = '图片加载失败（已重试 3 次）';
    return;
  }
  img.dataset.retryCount = String(retryCount + 1);
  fetchImageBlobUrl(path).then(function (url) {
    img.src = url;
    if (img.dataset.openImg) img.dataset.openImg = url;
  }).catch(function (err) {
    console.warn('图片加载失败', path, err);
    if (retryCount + 1 >= 3) {
      img.dataset.fallbackDone = '1';
      img.style.opacity = '.4';
      img.title = '图片加载失败（可能是 raw CDN 延迟或权限问题）';
    }
  });
}

[listEl, document.getElementById('imgMasonry'), pendingImgsEl, document.getElementById('imgMgrGrid')].forEach(function (el) {
  if (el) el.addEventListener('error', handleImgFallback, true);
});

// ★ 加载更多分片
document.addEventListener('click', function (e) {
  var loadMoreBtn = e.target.closest('#loadMoreShardsBtn');
  if (!loadMoreBtn) return;
  if (loadMoreBtn.disabled) return;
  e.preventDefault();
  loadMoreBtn.disabled = true;
  var oldText = loadMoreBtn.textContent;
  loadMoreBtn.textContent = '⏳ 正在加载更早的素材…';
  loadMoreBtn.style.opacity = '0.7';
  if (typeof ghPull !== 'function') { loadMoreBtn.disabled = false; loadMoreBtn.textContent = oldText; loadMoreBtn.style.opacity = ''; return; }
  Promise.resolve(ghPull(false, true)).then(function () {}).catch(function (err) {
    loadMoreBtn.disabled = false; loadMoreBtn.textContent = oldText; loadMoreBtn.style.opacity = '';
    toast('加载失败：' + (err && err.message || '未知错误'));
  });
});

// ★ 全局快捷键
document.addEventListener('keydown', function (e) {
  if (!db.settings || !db.settings.enableShortcuts) return;
  var t = e.target;
  var isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    var cfg = loadGH();
    if (!ghReady(cfg)) { toast('请先在设置中配置 GitHub'); return; }
    if (typeof ghPush !== 'function') { toast('推送模块未就绪'); return; }
    toast('正在强制推送云端…');
    Promise.resolve(ghPush(false)).then(function (ok) { if (ok) toast('✅ 已推送云端'); });
    return;
  }
  if (isTyping) return;
  if (document.querySelector('.modal-mask.show')) return;
  if (document.body.classList.contains('focus-mode')) return;
  if (document.body.classList.contains('zen-mode')) return;
  if (document.body.classList.contains('guest-mode')) return;
  if (e.altKey && e.key === 'Enter') {
    e.preventDefault();
    if ($('menuRandomBtn')) $('menuRandomBtn').click();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var searchKey = String(db.settings.shortcutSearch || '/').toLowerCase();
  var newKey = String(db.settings.shortcutNew || 'n').toLowerCase();
  var pressed = String(e.key || '').toLowerCase();
  if (pressed === searchKey) {
    if (searchKey === '/') e.preventDefault();
    if (searchEl) { scrollTop(); setTimeout(function () { searchEl.focus(); searchEl.select(); }, 60); }
    return;
  }
  if (pressed === newKey) {
    e.preventDefault();
    if (inputEl) { scrollTop(); setTimeout(function () { inputEl.focus(); }, 80); }
    return;
  }
});