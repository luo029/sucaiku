// js/render.js - 渲染管线：侧栏 / 标签 / 页签 / 列表 / 分页 / 选择器面板

var tagExpanded = false;
var catExpanded = false;
var srcExpanded = false;

function _isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function render() {
  draggedItemId = null;
  normalize();
  if (currentSource !== ALL_SOURCES && db.sources.indexOf(currentSource) < 0) {
    currentSource = ALL_SOURCES;
  }
  var allTypes = new Set(['全部', IMG_TYPE].concat(db.cats));
  if (db.items.some(function (i) { return i.type === UNCAT; })) allTypes.add(UNCAT);
  if (!allTypes.has(currentType)) currentType = '全部';

  renderSidebar();
  renderTags();
  renderSourceFilter();
  renderHeader();
  renderList();
  renderCatFilter();
  refreshTypeSelect();
  updateSourcePickerUI();
  updateTagPickerUI();
  if (catManager && !catManager.hidden) renderCatManager();
}

function renderSidebar() {
  var catCounts = {};
  db.items.forEach(function (i) { catCounts[i.type] = (catCounts[i.type] || 0) + 1; });
  var sourceCounts = {};
  db.items.forEach(function (i) {
    if (i.source) sourceCounts[i.source] = (sourceCounts[i.source] || 0) + 1;
  });

  var catLimit = db.settings.catLimit || 3;
  var srcLimit = db.settings.srcLimit || 3;

  var catHasMore = db.cats.length > catLimit;
  var displayCats = (!catExpanded && catHasMore) ? db.cats.slice(0, catLimit) : db.cats.slice();
  if (!catExpanded && catHasMore && currentType && displayCats.indexOf(currentType) < 0 && db.cats.indexOf(currentType) >= 0) {
    displayCats[displayCats.length - 1] = currentType;
  }

  var html = '<button class="nav-item nav-all ' + (currentType === '全部' ? 'active' : '') + '" data-type="全部" draggable="false">'
    + '<span class="nav-dot"></span><span class="nav-name">全部素材</span><span class="nav-count">' + formatCount(db.items.length) + '</span>'
    + '</button>';

  if ((catCounts[IMG_TYPE] || 0) > 0) {
    html += '<button class="nav-item nav-img ' + (currentType === IMG_TYPE ? 'active' : '') + '" data-type="' + IMG_TYPE + '" draggable="false">'
      + '<span class="nav-dot"></span><span class="nav-name">图片</span><span class="nav-count">' + formatCount(catCounts[IMG_TYPE]) + '</span>'
      + '</button>';
  }

  displayCats.forEach(function (c) {
    var col = catColor(c);
    html += '<button class="nav-item ' + (currentType === c ? 'active' : '') + '" data-type="' + esc(c) + '" draggable="false">'
      + '<span class="nav-dot" style="background:' + col.fg + '"></span><span class="nav-name">' + esc(c) + '</span><span class="nav-count">' + formatCount(catCounts[c] || 0) + '</span>'
      + '</button>';
  });

  if ((catCounts[UNCAT] || 0) > 0) {
    html += '<button class="nav-item ' + (currentType === UNCAT ? 'active' : '') + '" data-type="' + UNCAT + '" draggable="false">'
      + '<span class="nav-dot" style="background:#94a3b8"></span><span class="nav-name">' + UNCAT + '</span><span class="nav-count">' + formatCount(catCounts[UNCAT]) + '</span>'
      + '</button>';
  }

  if (catHasMore) {
    html += '<button class="nav-item nav-manage" id="toggleCatsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">'
      + (catExpanded ? '收起分类' : '展开更多分类 (' + (db.cats.length - catLimit) + ')')
      + '</button>';
  }
  $('catNav').innerHTML = html;
  if (catHasMore) {
    var tc = document.getElementById('toggleCatsBtn');
    if (tc) tc.addEventListener('click', function () {
      catExpanded = !catExpanded;
      renderSidebar();
    });
  }

  var bookIcon = '<svg class="nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  var pinIcon = '<svg class="nav-fixed-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>';
  var delIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var srcHasMore = db.sources.length > srcLimit;
  var displaySrcs = (!srcExpanded && srcHasMore) ? db.sources.slice(0, srcLimit) : db.sources.slice();
  if (!srcExpanded && srcHasMore && currentSource && currentSource !== ALL_SOURCES && displaySrcs.indexOf(currentSource) < 0) {
    displaySrcs[displaySrcs.length - 1] = currentSource;
  }

  var srcHtml = '<button class="nav-item ' + (currentSource === ALL_SOURCES ? 'active' : '') + '" data-source="' + ALL_SOURCES + '" draggable="false">'
    + bookIcon + '<span class="nav-name">全部来源</span><span class="nav-count">' + formatCount(db.sources.length) + '</span>'
    + '</button>';

  if (!db.sources.length) {
    srcHtml += '<div class="nav-empty">还没有保存来源</div>';
  } else {
    displaySrcs.forEach(function (s) {
      var isFixed = db.fixedSource === s;
      srcHtml += '<button class="nav-item ' + (currentSource === s ? 'active' : '') + '" data-source="' + esc(s) + '" draggable="false">'
        + bookIcon + '<span class="nav-name" title="' + esc(s) + '">' + esc(s) + '</span>'
        + (isFixed ? pinIcon : '')
        + '<span class="nav-count" style="' + (isFixed ? 'margin-right:2px' : '') + '">' + formatCount(sourceCounts[s] || 0) + '</span>'
        + '<span class="nav-del-btn" data-del-source="' + esc(s) + '" title="删除来源">' + delIcon + '</span>'
        + '</button>';
    });
  }

  if (srcHasMore) {
    srcHtml += '<button class="nav-item nav-manage" id="toggleSrcsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">'
      + (srcExpanded ? '收起来源' : '展开更多来源 (' + (db.sources.length - srcLimit) + ')')
      + '</button>';
  }
  $('sourceNav').innerHTML = srcHtml;
  if (srcHasMore) {
    var ts = document.getElementById('toggleSrcsBtn');
    if (ts) ts.addEventListener('click', function () {
      srcExpanded = !srcExpanded;
      renderSidebar();
    });
  }
}

// ============ 标签侧栏 ============
function renderTags() {
  var counts = collectTags();
  var allTags = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || a.localeCompare(b, 'zh');
  });

  // 清理已经被删除的标签
  if (currentTags) {
    var toDelete = [];
    currentTags.forEach(function (t) {
      if (allTags.indexOf(t) < 0) toDelete.push(t);
    });
    toDelete.forEach(function (t) { currentTags.delete(t); });
  }
  if (currentTag && allTags.indexOf(currentTag) < 0) currentTag = '';

  var nav = $('tagNav');
  
  // ★★★ 核心：渲染“全部标签”按钮 ★★★
  var html = '<button class="nav-item nav-all ' + (currentTags.size === 0 ? 'active' : '') + '" data-tag="__all__" draggable="false">'
    + '<svg class="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>'
    + '<span class="nav-name">全部标签</span><span class="nav-count">' + formatCount(db.items.length) + '</span>'
    + '</button>';

  if (!allTags.length) {
    html += '<div class="nav-empty" style="margin-top:8px;">还没有标签</div>';
    nav.innerHTML = html;
    return;
  }

  var tagLimit = db.settings.tagLimit || 3;
  var hasMore = allTags.length > tagLimit;
  var displayTags = (!tagExpanded && hasMore) ? allTags.slice(0, tagLimit) : allTags.slice();

  // 这里不再强行插入 currentTag，因为可能选了多个

  var tagIcon = '<svg class="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
  var pinIcon = '<svg class="nav-fixed-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>';

  html += displayTags.map(function (t) {
    var isFixed = db.fixedTags.indexOf(t) >= 0;
    var isActive = currentTags.has(t); // 多选状态
    return '<button class="nav-item ' + (isActive ? 'active' : '') + '" data-tag="' + esc(t) + '" draggable="false">'
      + tagIcon + '<span class="nav-name" title="' + esc(t) + '">' + esc(t) + '</span>'
      + (isFixed ? pinIcon : '') + '<span class="nav-count">' + formatCount(counts[t]) + '</span>'
      + '</button>';
  }).join('');

  if (hasMore) {
    html += '<button class="nav-item nav-manage" id="toggleTagsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">'
      + (tagExpanded ? '收起标签' : '展开更多标签 (' + (allTags.length - tagLimit) + ')')
      + '</button>';
  }
  nav.innerHTML = html;

  if (hasMore) {
    var tt = document.getElementById('toggleTagsBtn');
    if (tt) tt.addEventListener('click', function () {
      tagExpanded = !tagExpanded;
      renderTags();
    });
  }
}

function renderCatFilter() {
  var isEmpty = currentType === '全部';
  var emptyLabel = _isMobileViewport() ? '分类' : '全部分类';
  if ($('catFilterText')) $('catFilterText').textContent = isEmpty ? emptyLabel : currentType;
  if ($('catFilterBtn')) {
    $('catFilterBtn').classList.toggle('active-filter', !isEmpty);
    $('catFilterBtn').title = isEmpty ? '按分类筛选' : '当前筛选：' + currentType;
  }
  if ($('catFilterPanel') && !$('catFilterPanel').hidden) renderCatFilterList();
}

function renderCatFilterList() {
  if (!document.getElementById('catFilterList')) return;
  var q = ($('catFilterSearch') ? $('catFilterSearch').value : '').trim().toLowerCase();

  var catCounts = {};
  db.items.forEach(function (i) { catCounts[i.type] = (catCounts[i.type] || 0) + 1; });

  var catSet = new Set(['全部', IMG_TYPE].concat(db.cats));
  if ((catCounts[UNCAT] || 0) > 0) catSet.add(UNCAT);

  var list = Array.from(catSet).filter(function (c) {
    return (catCounts[c] || 0) > 0 || c === '全部' || c === IMG_TYPE;
  });
  if (q) list = list.filter(function (s) { return s.toLowerCase().indexOf(q) >= 0; });

  var html = '<div class="sp-item ' + (currentType === '全部' ? 'sp-selected' : '') + '" data-pick="__all__">'
    + '<span class="sp-name">全部分类</span>'
    + '</div>';

  list.forEach(function (c) {
    if (c === '全部') return;
    var n = catCounts[c] || 0;
    html += '<div class="sp-item ' + (currentType === c ? 'sp-selected' : '') + '" data-pick="' + esc(c) + '">'
      + '<span class="sp-name">' + esc(c) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span>'
      + '</div>';
  });
  $('catFilterList').innerHTML = html;
}

function renderSourceFilter() {
  var isEmpty = currentSource === ALL_SOURCES;
  var emptyLabel = _isMobileViewport() ? '来源' : '全部来源';
  if ($('sourceFilterText')) $('sourceFilterText').textContent = isEmpty ? emptyLabel : currentSource;
  if ($('sourceFilterBtn')) {
    $('sourceFilterBtn').classList.toggle('active-filter', !isEmpty);
    $('sourceFilterBtn').title = isEmpty ? '按来源筛选' : '当前筛选：' + currentSource;
  }
  if ($('sourceFilterPanel') && !$('sourceFilterPanel').hidden) renderSourceFilterList();
}

function renderSourceFilterList() {
  if (!document.getElementById('sourceFilterList')) return;
  var q = ($('sourceFilterSearch') ? $('sourceFilterSearch').value : '').trim().toLowerCase();
  var counts = {};
  db.items.forEach(function (i) { if (i.source) counts[i.source] = (counts[i.source] || 0) + 1; });
  var list = db.sources.slice();
  if (q) list = list.filter(function (s) { return s.toLowerCase().indexOf(q) >= 0; });

  var html = '<div class="sp-item ' + (currentSource === ALL_SOURCES ? 'sp-selected' : '') + '" data-pick="__all__"><span class="sp-name">全部来源</span></div>';
  if (!list.length && q) {
    html += '<div class="sp-empty">没有匹配的来源</div>';
  } else {
    list.forEach(function (s) {
      var n = counts[s] || 0;
      var fixedMark = db.fixedSource === s ? ' 📌' : '';
      html += '<div class="sp-item ' + (currentSource === s ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '">'
        + '<span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + fixedMark + '</span>'
        + '</div>';
    });
  }
  $('sourceFilterList').innerHTML = html;
}

function renderHeader() {
  var title = currentType === '全部' ? '全部素材' : currentType;
  if (currentSource !== ALL_SOURCES) title = currentSource + ' · ' + title;

  // 支持多选展示
  var tagArr = currentTags && currentTags.size > 0 ? Array.from(currentTags) : (currentTag ? [currentTag] : []);
  if (tagArr.length > 0) {
    title = tagArr.map(function (t) { return '#' + t; }).join(' ') + ' · ' + title;
  }

  $('pageTitle').textContent = title;

  var parts = [];
  if (currentSource !== ALL_SOURCES) parts.push('来自《' + currentSource + '》');
  if (tagArr.length > 0) parts.push('标签 ' + tagArr.map(function (t) { return '#' + t; }).join(' '));
  if (currentType !== '全部') parts.push(currentType);

  var loadedCount = db._loadedShardKeys ? db._loadedShardKeys.length : 0;
  var totalCount = db._allShardKeys ? db._allShardKeys.length : 0;
  if (totalCount > 0 && loadedCount < totalCount) {
    parts.push('📦 已加载 ' + loadedCount + '/' + totalCount + ' 分片');
  }

  $('pageSub').textContent = parts.length ? parts.join(' · ') : '选择分类、来源或标签进行筛选';
}

function imgCatBadge(img) {
  return img && img.cat ? '<span class="ci-cat">' + esc(img.cat) + '</span>' : '';
}

function renderZenBar() {
  var typeTxt = currentType === '全部' ? '全部分类' : currentType;
  var srcTxt = currentSource === ALL_SOURCES ? '全部来源' : currentSource;
  var tagTxt = currentTag ? '#' + currentTag : '全部标签';

  var html = ''
    + '<div class="zb zen-filter-btn ' + (currentType !== '全部' ? 'active' : '') + '" id="zenTypeBtn">'
    + esc(typeTxt) + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>'
    + '</div>'
    + '<div class="zb zen-filter-btn ' + (currentSource !== ALL_SOURCES ? 'active' : '') + '" id="zenSrcBtn">'
    + esc(srcTxt) + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>'
    + '</div>'
    + '<div class="zb zen-filter-btn ' + (currentTag ? 'active' : '') + '" id="zenTagBtn">'
    + esc(tagTxt) + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>'
    + '</div>';

  zenBarEl.innerHTML = html;
}

function renderSettingsOverview() {
  if (!$('ovTotal')) return;
  var imgCount = 0;
  db.items.forEach(function (i) { imgCount += (i.images ? i.images.length : 0); });
  var chars = db.items.reduce(function (s, i) { return s + i.text.length; }, 0);
  var tags = Object.keys(collectTags()).length;
  $('ovTotal').textContent = db.items.length;
  $('ovChars').textContent = chars > 9999 ? (chars / 1000).toFixed(1) + 'k' : chars;
  $('ovImgs').textContent = imgCount;
  $('ovTags').textContent = tags;
}

function renderStyleOptions() {
  var container = document.getElementById('uiStyleMode');
  if (!container) return;
  container.innerHTML = AVAILABLE_STYLES.map(function (style) {
    var active = db.settings.uiStyle === style.id ? 'active' : '';
    return '<button type="button" data-style="' + style.id + '" class="' + active + '">' + style.name + '</button>';
  }).join('');
}

var _formatCache = new Map();
function getCachedFormat(text, terms) {
  var key = text.length + ':' + (terms || []).join(',') + ':' + text.slice(0, 100);
  if (_formatCache.has(key)) return _formatCache.get(key);
  var html = formatText(text, terms);
  if (_formatCache.size > 200) _formatCache.clear();
  _formatCache.set(key, html);
  return html;
}

function renderList() {
  if (zenMode) {
    renderZenBar();
    var filteredZen = getFilteredItems().filter(function (i) { return i.text; });
    if (!filteredZen.length) {
      listEl.innerHTML = '<div class="empty"><p>没有找到符合条件的内容</p></div>';
    } else {
      listEl.innerHTML = filteredZen.map(function (i) {
        return '<article class="card" data-id="' + i.id + '"><div class="content">' + getCachedFormat(i.text, []) + '</div></article>';
      }).join('');
    }
    $('pagination').innerHTML = '';
    batchBar.classList.remove('show');
    return;
  }

  var filtered = getFilteredItems();
  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  var start = (currentPage - 1) * pageSize;
  var pageItems = filtered.slice(start, start + pageSize);
  var terms = getSearchTerms();
  var collapseLimit = db.settings.collapseLimit || 150;

  if (!pageItems.length) {
    if (!db.items.length) {
      listEl.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg><p>还没有素材，把喜欢的句子粘到上面吧</p></div>';
    } else {
      listEl.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><p>没有找到匹配的素材</p></div>';
    }
    $('pagination').innerHTML = '';
    updateBatchBar([]);
    return;
  }

  listEl.innerHTML = pageItems.map(function (i) {
    var c = catColor(i.type);
    var sel = selectedIds.has(i.id);
    var isImgItem = (i.type === IMG_TYPE);
    var isLongText = i.text && (i.text.length > collapseLimit || i.text.split('\n').length > 5);
    var isExpanded = expandedIds.has(i.id);
    var contentClass = isLongText ? (isExpanded ? '' : 'collapsed') : '';
    var expandBtn = isLongText ? '<div class="expand-btn" data-expand="' + i.id + '">' + (isExpanded ? '收起' : '展开全文') + '</div>' : '';

    var itemTagSet = new Set(i.tags || []);
    (i.images || []).forEach(function (im) {
      (im.tags || []).forEach(function (t) { itemTagSet.add(t); });
    });
    var tagsHtml = Array.from(itemTagSet).map(function (t) {
      return '<span class="tag-chip" data-tag="' + esc(t) + '">#' + esc(t) + '</span>';
    }).join('');

    var imgsHtml = (i.images && i.images.length) ? '<div class="card-imgs">' + i.images.map(function (im) {
      var src = imageSrc(im);
      return '<span class="ci"><img src="' + esc(src) + '" alt="" loading="lazy" data-open-img="' + esc(src) + '" data-img-path="' + esc(im.path || '') + '">' + imgCatBadge(im) + '</span>';
    }).join('') + '</div>' : '';

    var dateTitle = '创建：' + fmtFull(i.createdAt) + (i.updatedAt ? '\n更新：' + fmtFull(i.updatedAt) : '');
    var contentHtml = i.text ? '<div class="content ' + contentClass + '">' + getCachedFormat(i.text, terms) + '</div>' + expandBtn : '';

    return '<article class="card' + (isImgItem ? ' card-img' : '') + (selectMode ? ' selectable' : '') + (sel ? ' selected' : '') + '" data-id="' + i.id + '" style="--cat-fg:' + c.fg + '" draggable="' + (!selectMode) + '">'
      + (selectMode ? '<div class="card-check"><span class="check-circle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div>' : '')
      + '<div class="card-main">'
      + '<div class="card-top">'
      + '<span class="tag' + (isImgItem ? ' tag-img' : '') + '" style="' + (isImgItem ? '' : 'background:' + c.bg + ';color:' + c.fg) + '">' + esc(i.type) + '</span>'
      + (i.source ? '<span class="src src-clickable" data-source="' + esc(i.source) + '" title="点击筛选自《' + esc(i.source) + '》">' + esc(i.source) + '</span>' : '')
      + tagsHtml
      + '<span class="date" title="' + esc(dateTitle) + '">' + fmtDate(i.createdAt) + '</span>'
      + '</div>'
      + contentHtml
      + imgsHtml
      + (selectMode ? '' : '<div class="ops">'
        + '<button data-act="copy" data-id="' + i.id + '">复制</button>'
        + '<button data-act="edit" data-id="' + i.id + '">编辑</button>'
        + '<button data-act="del" data-id="' + i.id + '" class="danger">删除</button>'
        + '</div>')
      + '</div>'
      + '</article>';
  }).join('');

  renderPagination(total, totalPages, start, pageItems.length);
  updateBatchBar(pageItems);
}

function renderPagination(total, totalPages, start, pageCount) {
  if (totalPages <= 1) {
    $('pagination').innerHTML = '';
    return;
  }
  var end = start + pageCount;
  var pages = [];
  if (totalPages <= 7) {
    for (var i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 4) pages = [1, 2, 3, 4, 5, '...', totalPages];
    else if (currentPage >= totalPages - 3) pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    else pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }
  var nav = '<button class="page-btn" data-page="prev" ' + (currentPage === 1 ? 'disabled' : '') + '>‹</button>';
  pages.forEach(function (p) {
    if (p === '...') nav += '<span class="page-btn dots">…</span>';
    else nav += '<button class="page-btn ' + (p === currentPage ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
  });
  nav += '<button class="page-btn" data-page="next" ' + (currentPage === totalPages ? 'disabled' : '') + '>›</button>';

  $('pagination').innerHTML = '<div class="page-info">第 <b>' + (start + 1) + '</b>-<b>' + end + '</b> 条，共 <b>' + total + '</b> 条</div>'
    + '<div class="page-nav">' + nav + '</div>'
    + '<select class="page-size" id="pageSizeSelect">'
    + '<option value="12" ' + (pageSize === 12 ? 'selected' : '') + '>12 条/页</option>'
    + '<option value="24" ' + (pageSize === 24 ? 'selected' : '') + '>24 条/页</option>'
    + '<option value="48" ' + (pageSize === 48 ? 'selected' : '') + '>48 条/页</option>'
    + '<option value="100" ' + (pageSize === 100 ? 'selected' : '') + '>100 条/页</option>'
    + '</select>';
}

function updateSourcePickerUI() {
  var v = sourceEl.value.trim();
  sourcePicker.classList.toggle('has-fixed', !!db.fixedSource && v === db.fixedSource);
}

function updateTagPickerUI() {
  var v = tagsEl.value.trim();
  var first = v.split(/[,，\s]+/).filter(Boolean)[0] || '';
  tagPicker.classList.toggle('has-fixed', db.fixedTags.indexOf(first) >= 0);
}

function openSourcePanel() {
  spSearch.value = '';
  renderSourcePanelList('');
  sourcePanel.hidden = false;
  setTimeout(function () { spSearch.focus(); }, 30);
}
function closeSourcePanel() { sourcePanel.hidden = true; }
function openTagPanel() {
  tpSearch.value = '';
  renderTagPanelList('');
  tagPanel.hidden = false;
  setTimeout(function () { tpSearch.focus(); }, 30);
}
function closeTagPanel() { tagPanel.hidden = true; }

function renderSourcePanelList(query) {
  var q = query.trim().toLowerCase();
  var counts = {};
  db.items.forEach(function (i) { if (i.source) counts[i.source] = (counts[i.source] || 0) + 1; });
  var list = db.sources.slice();
  if (q) list = list.filter(function (s) { return s.toLowerCase().indexOf(q) >= 0; });
  if (!db.sources.length) {
    spList.innerHTML = '<div class="sp-empty">还没有保存过来源，直接在输入框里输入新来源即可</div>';
    return;
  }
  if (!list.length) {
    spList.innerHTML = '<div class="sp-empty">没有匹配的来源</div>';
    return;
  }
  var currentVal = sourceEl.value.trim();
  var html = '<button class="sp-item sp-none ' + (!currentVal ? 'sp-selected' : '') + '" data-pick=""><span class="sp-name">— 不设置来源 —</span></button>';
  list.forEach(function (s) {
    var isFixed = db.fixedSource === s;
    var isSelected = currentVal === s;
    var n = counts[s] || 0;
    var pinFill = isFixed ? 'currentColor' : 'none';
    html += '<div class="sp-item ' + (isSelected ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '">'
      + '<span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span>'
      + '<span class="sp-pin ' + (isFixed ? 'active' : '') + '" data-pin="' + esc(s) + '" title="' + (isFixed ? '取消固定' : '固定为默认来源') + '">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + pinFill + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>'
      + '</span>'
      + '</div>';
  });
  spList.innerHTML = html;
}

function renderTagPanelList(query) {
  var q = query.trim().toLowerCase();
  var counts = collectTags();
  var list = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || a.localeCompare(b, 'zh');
  });
  if (q) list = list.filter(function (s) { return s.toLowerCase().indexOf(q) >= 0; });
  if (!Object.keys(counts).length) {
    tpList.innerHTML = '<div class="sp-empty">还没有标签，直接在输入框里输入新标签即可</div>';
    return;
  }
  if (!list.length) {
    tpList.innerHTML = '<div class="sp-empty">没有匹配的标签</div>';
    return;
  }
  var currentVal = tagsEl.value.trim();
  var currentTagsArr = currentVal ? currentVal.split(/[,，\s]+/).filter(Boolean) : [];
  var html = '';
  list.forEach(function (s) {
    var isFixed = db.fixedTags.indexOf(s) >= 0;
    var isSelected = currentTagsArr.indexOf(s) >= 0;
    var n = counts[s] || 0;
    var pinFill = isFixed ? 'currentColor' : 'none';
    html += '<div class="sp-item ' + (isSelected ? 'sp-selected' : '') + '" data-pick="' + esc(s) + '">'
      + '<span class="sp-name">' + esc(s) + (n ? '<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">' + formatCount(n) + '</span>' : '') + '</span>'
      + '<span class="sp-pin ' + (isFixed ? 'active' : '') + '" data-pin="' + esc(s) + '" title="' + (isFixed ? '取消固定' : '固定为默认标签') + '">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + pinFill + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>'
      + '</span>'
      + '</div>';
  });
  tpList.innerHTML = html;
}

function setFixedSource(source) {
  if (db.fixedSource === source) {
    db.fixedSource = '';
    toast('已取消固定来源');
  } else {
    db.fixedSource = source;
    toast('已固定来源「' + source + '」');
  }
  save();
  renderSourcePanelList(spSearch.value);
  renderSidebar();
  renderSourceFilter();
  updateSourcePickerUI();
}

function toggleFixedTag(tag) {
  var i = db.fixedTags.indexOf(tag);
  if (i >= 0) { db.fixedTags.splice(i, 1); toast('已取消固定标签'); }
  else { db.fixedTags.push(tag); toast('已固定标签「' + tag + '」'); }
  save();
  renderTagPanelList(tpSearch.value);
  renderTags();
  updateTagPickerUI();
}

function deleteSource(sourceName) {
  if (!confirm('确定要删除来源「' + sourceName + '」吗？\n该来源下的所有素材将变为无来源，此操作不可撤销。')) return;
  db.sources = db.sources.filter(function (s) { return s !== sourceName; });
  if (db.fixedSource === sourceName) db.fixedSource = '';
  db.items.forEach(function (i) { if (i.source === sourceName) i.source = ''; });
  if (currentSource === sourceName) currentSource = ALL_SOURCES;
  save();
  render();
  toast('已删除来源');
}

function renderCatManager() {
  if (!db.cats.length) {
    catListEl.innerHTML = '<div class="cat-empty">还没有分类，在下面输入框添加吧</div>';
    return;
  }
  catListEl.innerHTML = db.cats.map(function (c, idx) {
    var col = catColor(c);
    var n = db.items.filter(function (i) { return i.type === c; }).length;
    return '<div class="cat-row">'
      + '<span class="dot" style="background:' + col.fg + '"></span>'
      + '<input class="cat-name" data-idx="' + idx + '" value="' + esc(c) + '" maxlength="12">'
      + '<span class="cat-n">' + formatCount(n) + '</span>'
      + '<button class="btn tiny danger" data-cat-del="' + idx + '">删除</button>'
      + '</div>';
  }).join('');
}

function refreshTypeSelect(keep) {
  var cur = keep !== undefined ? keep : typeEl.value;
  var opts = db.cats.slice();
  if (cur === IMG_TYPE) opts.unshift(IMG_TYPE);
  if (!opts.length) opts = [UNCAT];
  if (cur === UNCAT && opts.indexOf(UNCAT) < 0) opts.push(UNCAT);
  else if (cur && opts.indexOf(cur) < 0) opts.unshift(cur);
  typeEl.innerHTML = opts.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  if (cur && opts.indexOf(cur) >= 0) typeEl.value = cur;
}

function getPageItems() {
  var filtered = getFilteredItems();
  var start = (currentPage - 1) * pageSize;
  return filtered.slice(start, start + pageSize);
}

function updateBatchBar(pageItems) {
  batchBar.classList.toggle('show', selectMode);
  $('selectBtn').classList.toggle('active', selectMode);
  if (!selectMode) return;
  $('batchNum').textContent = selectedIds.size;
  if (!pageItems.length) { $('selectAllBtn').textContent = '全选本页'; return; }
  var allSel = pageItems.every(function (i) { return selectedIds.has(i.id); });
  $('selectAllBtn').textContent = allSel ? '取消全选本页' : '全选本页';
}

function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  var card = listEl.querySelector('.card[data-id="' + id + '"]');
  if (card) card.classList.toggle('selected', selectedIds.has(id));
  updateBatchBar(getPageItems());
}

function requestDeleteConfirm(count, onConfirm) {
  if (localStorage.getItem(SKIP_KEY) === '1') { onConfirm(); return; }
  pendingConfirm = onConfirm;
  $('modalDesc').textContent = count === 1 ? '确定要删除这条素材吗？删除后可在回收站恢复。' : '确定要删除选中的 ' + count + ' 条素材吗？删除后可在回收站恢复。';
  $('noRemind').checked = false;
  $('modalMask').classList.add('show');
}

function closeModal() {
  $('modalMask').classList.remove('show');
  pendingConfirm = null;
}

var _lastIsMobile = _isMobileViewport();
window.addEventListener('resize', function () {
  var now = _isMobileViewport();
  if (now !== _lastIsMobile) {
    _lastIsMobile = now;
    renderCatFilter();
    renderSourceFilter();
    if (zenMode) renderZenBar();
  }
}, { passive: true });

// 全局暴露
window.render = render;
window.renderSidebar = renderSidebar;
window.renderTags = renderTags;
window.renderList = renderList;
window.renderHeader = renderHeader;
window.renderCatFilter = renderCatFilter;
window.renderSourceFilter = renderSourceFilter;
window.renderZenBar = renderZenBar;
window.renderSettingsOverview = renderSettingsOverview;
window.renderStyleOptions = renderStyleOptions;
window.renderCatManager = renderCatManager;
window.refreshTypeSelect = refreshTypeSelect;
window.updateSourcePickerUI = updateSourcePickerUI;
window.updateTagPickerUI = updateTagPickerUI;
window.getPageItems = getPageItems;
window.updateBatchBar = updateBatchBar;
window.toggleSelect = toggleSelect;
window.requestDeleteConfirm = requestDeleteConfirm;
window.closeModal = closeModal;
window.setFixedSource = setFixedSource;
window.toggleFixedTag = toggleFixedTag;
window.deleteSource = deleteSource;
window.renderSourcePanelList = renderSourcePanelList;
window.renderTagPanelList = renderTagPanelList;
window.renderCatFilterList = renderCatFilterList;
window.renderSourceFilterList = renderSourceFilterList;
window.openSourcePanel = openSourcePanel;
window.closeSourcePanel = closeSourcePanel;
window.openTagPanel = openTagPanel;
window.closeTagPanel = closeTagPanel;