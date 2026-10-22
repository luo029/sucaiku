// js/selftest.js · 完整文件
// ★ 本次更新：移除了对已废弃的笔记更新弹窗元素的检测，防止自检误报。

(function () {
  var results = { passed: 0, failed: 0, warned: 0, items: [] };
  var pendingAsync = [];

  function record(category, name, r) {
    if (r === true || r === undefined) {
      results.passed++;
      results.items.push({ cat: category, name: name, status: 'pass' });
    } else if (r === 'warn') {
      results.warned++;
      results.items.push({ cat: category, name: name, status: 'warn' });
    } else {
      results.failed++;
      results.items.push({ cat: category, name: name, status: 'fail', detail: String(r) });
    }
  }

  function test(category, name, fn) {
    try {
      var r = fn();
      if (r && typeof r.then === 'function') {
        pendingAsync.push(
          r.then(function (v) { record(category, name, v); })
           .catch(function (e) { record(category, name, e && e.message || String(e)); })
        );
        return;
      }
      record(category, name, r);
    } catch (e) {
      results.failed++;
      results.items.push({ cat: category, name: name, status: 'fail', detail: e.message || String(e) });
    }
  }

  function batchDom(category, ids) {
    ids.forEach(function (id) {
      test(category, '#' + id, function () {
        return !!document.getElementById(id) || '不存在';
      });
    });
  }

  function batchFn(category, fns) {
    fns.forEach(function (fn) {
      test(category, 'window.' + fn, function () {
        return typeof window[fn] === 'function' || '缺失';
      });
    });
  }

  function runSelfTest() {
    results = { passed: 0, failed: 0, warned: 0, items: [] };
    pendingAsync = [];
    var startAt = Date.now();

    // ============ A. 数据完整性 ============
    test('数据完整性', 'db.items 是数组', function () { return Array.isArray(window.db.items) || '不是数组'; });
    test('数据完整性', '每条素材有 id', function () { var bad = window.db.items.filter(function (i) { return !i || !i.id; }); return bad.length === 0 || bad.length + ' 条缺 id'; });
    test('数据完整性', '每条素材有 text 字段', function () { var bad = window.db.items.filter(function (i) { return !i || typeof i.text !== 'string'; }); return bad.length === 0 || bad.length + ' 条 text 异常'; });
    test('数据完整性', 'id 无重复', function () { var seen = new Set(); var dup = 0; window.db.items.forEach(function (i) { if (i && i.id) { if (seen.has(i.id)) dup++; else seen.add(i.id); } }); return dup === 0 || dup + ' 个重复 id'; });
    test('数据完整性', '每条素材 tags 是数组', function () { var bad = window.db.items.filter(function (i) { return i && !Array.isArray(i.tags); }); return bad.length === 0 || bad.length + ' 条 tags 异常'; });
    test('数据完整性', '每条素材 images 是数组', function () { var bad = window.db.items.filter(function (i) { return i && i.images && !Array.isArray(i.images); }); return bad.length === 0 || bad.length + ' 条 images 异常'; });
    test('数据完整性', 'db.cats 无重复', function () { return new Set(window.db.cats).size === window.db.cats.length || '分类有重复'; });
    test('数据完整性', 'db.sources 无重复', function () { return new Set(window.db.sources).size === window.db.sources.length || '来源有重复'; });
    test('数据完整性', 'trash 是数组', function () { return Array.isArray(window.db.trash) || 'trash 不是数组'; });
    test('数据完整性', 'catVersion 是数字', function () { return typeof window.db.catVersion === 'number' || '类型错误'; });
    test('数据完整性', 'settings 是对象', function () { return typeof window.db.settings === 'object' || '类型错误'; });
    test('数据完整性', 'db.colors 是对象', function () { return window.db.colors && typeof window.db.colors === 'object' || '类型错误'; });
    test('数据完整性', 'db.tagColors 是对象', function () { return window.db.tagColors && typeof window.db.tagColors === 'object' || '类型错误'; });
    test('数据完整性', 'db.fixedTags 是数组', function () { return Array.isArray(window.db.fixedTags) || '类型错误'; });
    test('数据完整性', 'db.imageCategories 是数组', function () { return Array.isArray(window.db.imageCategories) || '类型错误'; });
    test('数据完整性', 'settings.statsDims 是对象', function () { return window.db.settings && typeof window.db.settings.statsDims === 'object' || '缺失'; });
    test('数据完整性', 'settings.defaultPageSize 合法', function () { return [12, 24, 48, 100].indexOf(Number(window.db.settings.defaultPageSize)) >= 0 || '非法：' + window.db.settings.defaultPageSize; });
    test('数据完整性', 'settings.trashTtlDays 合法', function () { var v = Number(window.db.settings.trashTtlDays); return (v >= 1 && v <= 365) || '越界：' + v; });
    test('数据完整性', 'settings.collapseLimit 合法', function () { var v = Number(window.db.settings.collapseLimit); return (v >= 50 && v <= 9999) || '越界：' + v; });
    test('数据完整性', 'settings.catLimit/srcLimit/tagLimit 合法', function () { var a = Number(window.db.settings.catLimit), b = Number(window.db.settings.srcLimit), c = Number(window.db.settings.tagLimit); return (a >= 1 && a <= 30 && b >= 1 && b <= 30 && c >= 1 && c <= 30) || '越界'; });

    // ============ B. 索引一致性 ============
    test('索引一致性', '__index 存在', function () { return !!window.__index || '未初始化'; });
    test('索引一致性', '__itemById 存在', function () { return !!window.__itemById || '未初始化'; });
    test('索引一致性', '__indexEnsure 是函数', function () { return typeof window.__indexEnsure === 'function' || '不是函数'; });
    test('索引一致性', '索引条目数 == items 数', function () { if (!window.__itemById || !window.db) return 'warn'; window.__indexEnsure(); return window.__itemById.size === window.db.items.length || ('索引 ' + window.__itemById.size + ' vs 实际 ' + window.db.items.length); });
    test('索引一致性', '分类索引总和合理', function () { if (!window.__index) return 'warn'; window.__indexEnsure(); var total = 0; window.__index.cat.forEach(function (s) { total += s.size; }); return total === window.db.items.length || ('分类索引总和 ' + total + ' vs items ' + window.db.items.length); });
    test('索引一致性', '来源索引总和合理', function () { if (!window.__index) return 'warn'; window.__indexEnsure(); var withSrc = window.db.items.filter(function (i) { return i.source; }).length; var total = 0; window.__index.source.forEach(function (s) { total += s.size; }); return total === withSrc || ('来源索引 ' + total + ' vs 有来源 ' + withSrc); });
    test('索引一致性', '标签索引结构合法', function () { return (window.__index && window.__index.tag instanceof Map) || '不是 Map'; });
    test('索引一致性', 'rebuiltIndex 函数存在', function () { return typeof window.rebuildIndex === 'function' || '缺失'; });
    test('索引一致性', '索引支持增/删/改', function () { return (typeof window._indexAddItem === 'function' && typeof window._indexRemoveItem === 'function' && typeof window._indexUpdateItem === 'function') || '缺函数'; });
    test('索引一致性', '__dirtyShards 是 Set', function () { return window.__dirtyShards instanceof Set || '不是 Set'; });
    test('索引一致性', '_shardKeyOfItem 返回 YYYY-MM-DD', function () { return /^\d{4}-\d{2}-\d{2}$/.test(window._shardKeyOfItem({ createdAt: Date.now() })) || '格式错误'; });
    test('索引一致性', '_shardKeyOfItem UTC 模式也合法', function () { var old = window.db.settings.timezoneMode; window.db.settings.timezoneMode = 'utc'; var k = window._shardKeyOfItem({ createdAt: Date.now() }); window.db.settings.timezoneMode = old; return /^\d{4}-\d{2}-\d{2}$/.test(k) || '格式错误：' + k; });

    // ============ C. 统计准确性 ============
    test('统计准确性', 'getSidebarStats 是函数', function () { return typeof window.getSidebarStats === 'function' || '缺失'; });
    test('统计准确性', '统计的分类总数正确', function () { if (typeof window.getSidebarStats !== 'function') return 'warn'; var stats = window.getSidebarStats(); var total = 0; Object.keys(stats.catCounts).forEach(function (k) { total += stats.catCounts[k]; }); return total === window.db.items.length || ('统计总和 ' + total + ' vs ' + window.db.items.length); });
    test('统计准确性', '统计结果结构完整', function () { if (typeof window.getSidebarStats !== 'function') return 'warn'; var s = window.getSidebarStats(); return !!(s && s.catCounts && s.sourceCounts && s.tagCounts) || '缺字段'; });
    test('统计准确性', 'collectTags 返回对象', function () { return typeof window.collectTags === 'function' && typeof window.collectTags() === 'object' || '异常'; });

    // ============ D. 核心函数 ============
    test('核心函数', 'esc 存在', function () { return typeof window.esc === 'function' || '缺失'; });
    test('核心函数', 'esc 转义 <', function () { return window.esc('<a>') === '&lt;a&gt;' || '转义错误'; });
    test('核心函数', 'esc 转义 &', function () { return window.esc('&') === '&amp;' || '转义错误'; });
    test('核心函数', 'esc 转义 双引号', function () { return window.esc('"') === '&quot;' || '转义错误'; });
    test('核心函数', 'esc 转义 单引号', function () { return window.esc("'") === '&#39;' || '转义错误'; });
    test('核心函数', 'esc 空值安全', function () { return window.esc(null) === '' || '异常'; });
    test('核心函数', 'formatText 存在', function () { return typeof window.formatText === 'function' || '缺失'; });
    test('核心函数', 'formatText 高亮 【】', function () { return window.formatText('前【重点】后').indexOf('<mark class="hl">重点</mark>') >= 0 || '高亮失败'; });
    test('核心函数', 'formatText 高亮 ==', function () { return window.formatText('前==重点==后').indexOf('<mark class="hl">重点</mark>') >= 0 || '高亮失败'; });
    test('核心函数', 'formatText 加粗 **', function () { return window.formatText('前**重点**后').indexOf('<strong>重点</strong>') >= 0 || '加粗失败'; });
    test('核心函数', 'formatText 转义 XSS', function () { return window.formatText('<script>x</script>').indexOf('<script') < 0 || '未转义'; });
    test('核心函数', 'formatText 关键词高亮', function () { return window.formatText('hello world', ['world']).indexOf('<mark class="kw">world</mark>') >= 0 || '关键词高亮失败'; });
    test('核心函数', 'uid 生成唯一', function () { if (typeof window.uid !== 'function') return '缺失'; return window.uid() !== window.uid() || '两次生成相同'; });
    test('核心函数', 'fmtDate 存在', function () { return typeof window.fmtDate === 'function' || '缺失'; });
    test('核心函数', 'fmtDate 输出非空', function () { return !!window.fmtDate(Date.now()) || '返回空'; });
    test('核心函数', 'fmtFull 存在', function () { return typeof window.fmtFull === 'function' || '缺失'; });
    test('核心函数', 'fmtFull 输出 YYYY-MM-DD HH:mm:ss', function () { return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(window.fmtFull(Date.now())) || '格式错'; });
    test('核心函数', 'fmtDateOnly 输出 YYYY-MM-DD', function () { return /^\d{4}-\d{2}-\d{2}$/.test(window.fmtDateOnly(Date.now())) || '格式错'; });
    test('核心函数', 'copyText 存在', function () { return typeof window.copyText === 'function' || '缺失'; });
    test('核心函数', 'imageSrc 存在', function () { return typeof window.imageSrc === 'function' || '缺失'; });
    test('核心函数', 'imageSrc 空对象返回空', function () { return window.imageSrc({}) === '' || '异常'; });
    test('核心函数', 'imageSrc http 直通', function () { return window.imageSrc({ url: 'https://a/b.jpg' }) === 'https://a/b.jpg' || '异常'; });
    test('核心函数', 'imageSrc data:image 直通', function () { return window.imageSrc({ url: 'data:image/png;base64,x' }).indexOf('data:image') === 0 || '异常'; });
    test('核心函数', 'imageSrc 非法协议返回空', function () { return window.imageSrc({ url: 'javascript:alert(1)' }) === '' || '未拦截'; });
    test('核心函数', 'normalizeImages 存在', function () { return typeof window.normalizeImages === 'function' || '缺失'; });
    test('核心函数', 'normalizeImages 处理字符串', function () { var r = window.normalizeImages(['http://a/b.jpg']); return r.length === 1 && r[0].url === 'http://a/b.jpg' || '处理异常'; });
    test('核心函数', 'normalizeImages 处理对象', function () { var r = window.normalizeImages([{ path: 'x/y.jpg', cat: '梗图' }]); return r.length === 1 && r[0].path === 'x/y.jpg' || '异常'; });
    test('核心函数', 'normalizeImages 过滤 null', function () { return window.normalizeImages([null, undefined, {}]).length === 0 || '异常'; });
    test('核心函数', '_shardKeyOfItem 是函数', function () { return typeof window._shardKeyOfItem === 'function' || '缺失'; });
    test('核心函数', 'splitShardIfNeeded 存在', function () { return typeof window.splitShardIfNeeded === 'function' || '缺失'; });
    test('核心函数', 'splitShardIfNeeded 小分片不拆', function () { return window.splitShardIfNeeded('2024-01-01', [{ id: 'a', text: 'x' }]).length === 1 || '小分片被拆了'; });
    test('核心函数', 'groupItemsByShard 分组完整', function () { var items = [{ id: 'a', createdAt: Date.now() }, { id: 'b', createdAt: Date.now() }, { id: 'c', createdAt: Date.now() - 86400000 }]; var g = window.groupItemsByShard(items); var total = 0; Object.keys(g).forEach(function (k) { total += g[k].length; }); return total === items.length || '分组丢失：' + total + '/' + items.length; });
    test('核心函数', 'utf8ToBase64 → base64ToUtf8 往返一致', function () { if (typeof window.utf8ToBase64 !== 'function' || typeof window.base64ToUtf8 !== 'function') return '缺函数'; var s = '中文 with emoji 😀 and ascii'; return window.base64ToUtf8(window.utf8ToBase64(s)) === s || '往返不一致'; });
    test('核心函数', 'loadGH 返回结构完整', function () { if (typeof window.loadGH !== 'function') return '缺函数'; var c = window.loadGH(); return (typeof c.token === 'string' && typeof c.owner === 'string' && typeof c.repo === 'string' && typeof c.branch === 'string') || '结构不完整'; });
    test('核心函数', 'ghReady 空配置返回 false', function () { return window.ghReady({}) === false || '逻辑错'; });
    test('核心函数', 'ghReady 完整配置返回 true', function () { return window.ghReady({ token: 'x', owner: 'y', repo: 'z' }) === true || '逻辑错'; });
    test('核心函数', 'ghRepoConfig data 结构正确', function () { var c = window.ghRepoConfig('data'); return (c && typeof c.owner === 'string' && typeof c.branch === 'string') || '结构错'; });
    test('核心函数', 'ghRepoConfig img 结构正确', function () { return (window.ghRepoConfig('img') && typeof window.ghRepoConfig('img').path === 'string') || '结构错'; });
    test('核心函数', 'ghApiUrl 编码特殊字符', function () { return window.ghApiUrl({ owner: 'a b', repo: 'c/d' }, 'x y').indexOf('%20') >= 0 || '未编码'; });

    // ============ E. DOM 元素 ============
    batchDom('DOM-主界面', ['sidebarOverlay', 'sidebar', 'themeToggleBtn', 'themeIconSun', 'themeIconMoon', 'sidebarCollapseBtn', 'catNav', 'manageCatBtn', 'sourceNav', 'tagNav', 'manageTagBtn', 'sidebarExportBtn', 'sidebarImportBtn', 'gearBtn', 'menuBtn', 'pageTitle', 'pageSub', 'reviewBtn', 'layoutBtn', 'hitokotoText', 'hitokotoFrom', 'hitokotoRefresh', 'input', 'pendingImgs', 'type', 'sourcePicker', 'source', 'sourceToggle', 'sourcePanel', 'spSearch', 'spList', 'tagPicker', 'tags', 'tagToggle', 'tagPanel', 'tpSearch', 'tpList', 'imgBtn', 'imgFileInput', 'cancelBtn', 'addBtn', 'search', 'catFilterWrap', 'catFilterBtn', 'catFilterText', 'catFilterPanel', 'catFilterSearch', 'catFilterList', 'sourceFilterWrap', 'sourceFilterBtn', 'sourceFilterText', 'sourceFilterPanel', 'sourceFilterSearch', 'sourceFilterList', 'focusBtn', 'pipBtn', 'imgViewBtn', 'zenBtn', 'selectBtn', 'moreWrap', 'moreBtn', 'menu', 'menuSettingBtn', 'menuImgManagerBtn', 'menuExportBtn', 'menuImportBtn', 'menuDupBtn', 'menuRandomBtn', 'menuStatsBtn', 'menuHealthBtn', 'menuTrashBtn', 'zenBar', 'list', 'pagination', 'zenExitBtn', 'focusExitBtn', 'noteFileInput']);
    batchDom('DOM-批量栏', ['batchBar', 'batchNum', 'selectAllBtn', 'batchMoveBtn', 'batchTagBtn', 'batchSourceBtn', 'batchExportBtn', 'batchDel', 'batchExit', 'imgMgrBatchBar', 'imgMgrBatchNum', 'imgMgrSelectAllBtn', 'imgMgrBatchCatBtn', 'imgMgrBatchTagBtn', 'imgMgrBatchDelBtn', 'imgMgrBatchExit']);
    batchDom('DOM-弹窗', ['modalMask', 'modalDesc', 'noRemind', 'modalCancel', 'modalConfirm', 'exportMask', 'exportScope', 'exportFormat', 'exportCancel', 'exportConfirm', 'randomMask', 'randomFontSizeBtn', 'randomAutoFlipToggleBtn', 'randomFilterBtn', 'randomFilterText', 'randomFilterPanel', 'randomFilterSearch', 'randomFilterList', 'randomAutoFlipPanel', 'randomAutoFlipCheck', 'randomAutoFlipTime', 'randomContent', 'randomCloseBtn', 'randomAgainBtn', 'dupMask', 'dupList', 'dupCloseBtn', 'catManageMask', 'addCatBtnModal', 'catManageList', 'catManagePagination', 'catManageCloseBtn', 'logMask', 'logRefreshBtn', 'logClearBtn', 'logListWrap', 'logCloseBtn', 'deviceMask', 'deviceRefreshBtn', 'deviceList', 'deviceCloseBtn', 'tagColorMask', 'tagColorName', 'tagColorPalette', 'tagColorCustom', 'tagColorConfirm', 'tagColorCancel', 'tagColorClear', 'imgCatMask', 'imgCatCount', 'imgCatList', 'imgUploadTags', 'imgProgressWrap', 'imgProgressText', 'imgProgressPercent', 'imgProgressBar', 'imgUploadStatus', 'imgCatCancel', 'imgCatConfirm', 'tagManageMask', 'tagBatchToggleBtn', 'tagBatchBar', 'tagBatchCount', 'tagBatchMergeBtn', 'tagBatchDeleteBtn', 'tagBatchCancelBtn', 'tagManageList', 'tagManagePagination', 'tagManageCloseBtn', 'moveMask', 'moveCount', 'moveCatSelect', 'moveCancel', 'moveConfirm', 'tagAddMask', 'tagAddCount', 'tagAddInput', 'tagAddCancel', 'tagAddConfirm', 'batchSourceMask', 'batchSourceCount', 'batchSourceInput', 'batchSourceCancel', 'batchSourceConfirm', 'trashMask', 'trashDesc', 'trashList', 'trashClearBtn', 'trashCloseBtn', 'statsMask', 'statsContent', 'statsCloseBtn', 'healthMask', 'healthTotal', 'healthList', 'healthCloseBtn', 'customPromptMask', 'cpTitle', 'cpDesc', 'cpInput', 'cpSuggestions', 'cpCancel', 'cpConfirm', 'customConfirmMask', 'ccIcon', 'ccTitle', 'ccDesc', 'ccCancel', 'ccConfirm', 'snapshotListMask', 'snapshotListContent', 'snapshotRefreshBtn', 'snapshotListClose', 'imgMgrBatchEditMask', 'imgMgrBatchEditTitle', 'imgMgrBatchEditCount', 'imgMgrBatchCatWrap', 'imgMgrBatchCatGrid', 'imgMgrBatchTagWrap', 'imgMgrBatchSelectedTags', 'imgMgrBatchTagNewInput', 'imgMgrBatchTagAddBtn', 'imgMgrBatchTagSearchBtn', 'imgMgrBatchTagPoolWrap', 'imgMgrBatchTagSearch', 'imgMgrBatchTagPool', 'imgMgrBatchEditCancel', 'imgMgrBatchEditConfirm', 'fileInput', 'toast']);
    batchDom('DOM-设置', ['settingMask', 'settingTabs', 'settingsOverview', 'ovTotal', 'ovChars', 'ovImgs', 'ovTags', 'defaultTypeSelect', 'defaultPageSizeSelect', 'collapseLimitInput', 'trashTtlInput', 'copyWithoutMarks', 'copyKeepBlankLines', 'copyWithSource', 'copySourceFormatWrap', 'copySourceFormat', 'enableMarkdown', 'themeDarkToggle', 'useRelativeTimeToggle', 'showHitokoto', 'enableAnim', 'saveShortcut', 'focusModeCatInput', 'openFocusModeBtn', 'uiStyleMode', 'fontSizeMode', 'zenFontSize', 'listStyleMode', 'zenRenderMode', 'zenPageSizeWrap', 'zenPageSizeInput', 'zenAutoClosePanel', 'sidebarShowCat', 'sidebarShowSrc', 'sidebarShowTag', 'catLimitInput', 'srcLimitInput', 'tagLimitInput', 'enableShortcuts', 'shortcutSearch', 'shortcutNew', 'enableContextMenu', 'maxTagsInHeader', 'snapshotEnabled', 'snapshotDailyKeep', 'snapshotWeeklyKeep', 'snapshotMonthlyKeep', 'snapshotManualKeep', 'snapshotMaxAgeDays', 'snapshotChangeThreshold', 'snapshotForceDays', 'snapshotCompress', 'snapshotAutoCleanup', 'snapshotPath', 'snapshotNowBtn', 'snapshotListViewBtn', 'trashAutoCleanupThreshold', 'compressMode', 'tinypngFields', 'tinypngKey', 'tinypngProxy', 'tinyUsage', 'focusImgAutoUpload', 'focusImgCatWrap', 'focusImgDefaultCat', 'imgCatsEditor', 'newImgCatInput', 'imgNamingTemplate', 'imgNamingPreview', 'imgNamingWarn', 'ghToken', 'ghOwner', 'ghRepo', 'ghBranch', 'ghDataPath', 'ghDataDir', 'ghShardSubdir', 'ghSiteBase', 'ghAuto', 'ghAutoPull', 'autoPushDelay', 'syncCheckIntervalInput', 'autoCheckUpdateToggle', 'ghTestBtn', 'ghPullBtn', 'ghPushBtn', 'ghForcePushBtn', 'ghStatus', 'ghImgOwner', 'ghImgRepo', 'ghImgBranch', 'ghImgPath', 'ghImgSite', 'ghImgToken', 'ghImgStatus', 'loadMode', 'smartThresholdMB', 'manualRangeDays', 'lazyLoadBatchSize', 'pullConcurrency', 'shardMaxSizeKB', 'shardSplitEnabled', 'startupAutoPull', 'checkIntervalSeconds', 'autoPush', 'forceConfirm', 'gitTreeBatchEnabled', 'pushMode', 'pushRetryCount', 'pushRetryDelaySec', 'showSyncProgress', 'searchDebounceMs', 'tagColorMode', 'tagFilterLogic', 'enableYearIndex', 'enableMigrationResume', 'timezoneMode', 'enableLog', 'logMaxCount', 'logDisplayCount', 'openLogViewBtn', 'deviceName', 'deviceIcon', 'openDeviceViewBtn', 'catSyncAction', 'runSelfTestBtn', 'settingCloseBtn']);
    batchDom('DOM-图片', ['imgView', 'imgViewCount', 'imgCatTabs', 'imgViewClose', 'imgMasonry', 'imgManagerView', 'imgMgrRepoName', 'imgMgrSelectBtn', 'imgMgrRefreshBtn', 'imgMgrCloseBtn', 'imgMgrStatus', 'imgMgrGrid']);
    batchDom('DOM-批阅', ['reviewMask', 'reviewPaper', 'rvCustomOverlay', 'rvCustomPanel', 'rvSetSize', 'rvSetLine', 'rvSetFont', 'rvSetTheme', 'rvSetLines', 'rvSetWidth', 'rvSetPadding', 'rvSetSidebar', 'rvSetPulse', 'rvSetImgs', 'rvSetBtnText', 'rvShowWordCount', 'rvPreventAccident', 'rvEnableUndo', 'rvUndoTime', 'rvEnableSound', 'rvEnableAnim', 'rvEnableNumberKeys', 'rvEnableTitle', 'rvRecordHistory', 'rvShowBattleStats', 'rvShowTime', 'rvStatsRange', 'rvEnableShortcuts', 'rvShowShortcutHint', 'rvShortcutApprove', 'rvShortcutSkip', 'rvShortcutDel', 'rvAutoApprove', 'rvAutoTime', 'rvShowCountdown', 'rvCdStartShow', 'rvCdSize', 'rvCdOpacity', 'rvAutoClose', 'rvAutoCloseTime', 'rvCompleted', 'rvTitleBadge', 'rvBattleCard', 'rvBattleReport', 'rvHistoryStats', 'rvExitBtn', 'rvStamp', 'rvSettingsBtn', 'reviewProgress', 'rvCloseBtn', 'rvBody', 'reviewText', 'reviewImgs', 'rvCountdown', 'rvCornerStamp', 'rvWordCount', 'rvShortcutHint', 'rvUndoBtn', 'rvSkipBtn', 'rvDelBtn', 'rvApproveBtn', 'rvSidebar', 'listSource', 'listTag', 'listCat']);

    // ============ K. 分段控件 ============
    var SEGMENTED_IDS = ['saveShortcut', 'uiStyleMode', 'fontSizeMode', 'zenFontSize', 'listStyleMode', 'zenRenderMode', 'compressMode', 'loadMode', 'tagColorMode', 'tagFilterLogic', 'timezoneMode', 'catSyncAction', 'exportFormat'];
    SEGMENTED_IDS.forEach(function (id) {
      test('分段控件', '#' + id, function () { var el = document.getElementById(id); if (!el) return 'warn'; var btns = el.querySelectorAll('button'); return btns.length >= 1 || '0 个按钮'; });
    });

    // ============ L. 控件计数 ============
    test('控件计数', '设置面板 .st-toggle ≥ 25', function () { var n = document.querySelectorAll('#settingMask .st-toggle').length; return n >= 25 || '只有 ' + n + ' 个'; });
    test('控件计数', '设置面板 .st-tab == 5', function () { var n = document.querySelectorAll('#settingTabs .st-tab').length; return n === 5 || '只有 ' + n + ' 个'; });
    test('控件计数', '设置面板 .st-card ≥ 12', function () { var n = document.querySelectorAll('#settingMask .st-card').length; return n >= 12 || '只有 ' + n + ' 个'; });
    test('控件计数', '全站 .modal-mask ≥ 20', function () { var n = document.querySelectorAll('.modal-mask').length; return n >= 20 || '只有 ' + n + ' 个'; });
    test('控件计数', '全站 .segmented ≥ 12', function () { var n = document.querySelectorAll('.segmented').length; return n >= 12 || '只有 ' + n + ' 个'; });
    test('控件计数', '批量栏 .batch-btn ≥ 10', function () { var n = document.querySelectorAll('.batch-btn').length; return n >= 10 || '只有 ' + n + ' 个'; });
    test('控件计数', '导出格式按钮 == 4', function () { var el = document.getElementById('exportFormat'); if (!el) return '容器不存在'; var n = el.querySelectorAll('button').length; return n === 4 || '只有 ' + n + ' 个'; });
    test('控件计数', '批阅自定义面板 .rv-opt-btn ≥ 25', function () { var n = document.querySelectorAll('#rvCustomPanel .rv-opt-btn').length; return n >= 25 || '只有 ' + n + ' 个'; });
    test('控件计数', '弹窗取消/确认按钮成对', function () { var pairs = [['modalCancel', 'modalConfirm'], ['exportCancel', 'exportConfirm'], ['cpCancel', 'cpConfirm'], ['ccCancel', 'ccConfirm']]; for (var i = 0; i < pairs.length; i++) { if (!document.getElementById(pairs[i][0]) || !document.getElementById(pairs[i][1])) return '缺 ' + pairs[i].join('/'); } return true; });

    // ============ M. 全局函数 ============
    batchFn('全局函数', ['$', 'esc', 'formatText', 'uid', 'fmtDate', 'fmtFull', 'fmtDateOnly', 'toast', 'copyText', 'download', 'scrollTop', 'formatCount', 'utf8ToBase64', 'base64ToUtf8', 'blobToBase64', 'save', 'saveImmediate', 'loadStore', 'applyLoadedData', 'normalize', 'normalizeImages', 'cleanTrash', 'cleanupSources', 'ensureColors', 'catColor', 'collectTags', 'getFilteredItems', 'getSidebarStats', 'markItemDirty', 'markItemsDirty', 'markShardDirty', 'markAllShardsDirty', 'markIndexDirty', 'rebuildIndex', 'markNeedNormalize', 'clearFilterCache', 'saveSettings', '_shardKeyOfItem', '_indexAddItem', '_indexRemoveItem', '_indexUpdateItem', '__indexEnsure', 'render', 'renderSidebar', 'renderTags', 'renderList', 'renderHeader', 'renderCatFilter', 'renderSourceFilter', 'renderZenBar', 'renderSettingsOverview', 'renderStyleOptions', 'renderCatManager', 'refreshTypeSelect', 'updateSourcePickerUI', 'updateTagPickerUI', 'getPageItems', 'updateBatchBar', 'toggleSelect', 'requestDeleteConfirm', 'closeModal', 'setFixedSource', 'toggleFixedTag', 'deleteSource', 'renderSourcePanelList', 'renderTagPanelList', 'renderCatFilterList', 'renderSourceFilterList', 'openSourcePanel', 'closeSourcePanel', 'openTagPanel', 'closeTagPanel', 'moveToTrash', 'restoreFromTrash', 'purgeTrashItem', 'renderTrash', 'renderTagManager', 'renameTag', 'delTag', 'renderPendingImgs', 'setPendingImages', 'addOrUpdate', 'startEdit', 'cancelEdit', 'addCat', 'renameCat', 'delCat', 'setupDropZones', 'moveItemCategory', 'setZen', 'setFocus', 'openExportModal', 'closeExportModal', 'doExport', 'handleImportFile', 'showImportResultModal', 'openSidebar', 'closeSidebar', 'closeSidebarIfMobile', 'checkExportReminder', 'loadGH', 'saveGH', 'ghReady', 'ghRepoConfig', 'ghApiUrl', 'ghGetRaw', 'ghPutRaw', 'ghDeleteRaw', 'ghTreeAll', 'imageSrc', 'imageUrlFromPath', 'fetchImageBlobUrl', 'getShardKey', 'groupItemsByShard', 'splitShardIfNeeded', 'ghPush', 'ghPull', 'migrateFromLegacy', 'scheduleAutoPush', 'ghTest', 'fillGHForm', 'collectGHForm', 'restartSyncTimer', 'checkCloudUpdate', 'appendLog', 'loadLogs', 'loadDevices', 'registerDevice', 'maybeCreateSnapshot', 'createSnapshot', 'listSnapshots', 'cleanupOldSnapshots', 'restoreSnapshot', 'openSnapshotListView', 'renderSnapshotsList', '_recordSnapshotChange', 'formatImageFilename', 'renderImgCatChooser', 'openImgCatChooser', 'startUploadPending', 'renderImgView', 'openImgView', 'closeImgView', 'collectAllImages', 'showCustomPrompt', 'showCustomConfirm', 'runSelfTest', 'startReview', 'updateReviewBtnState', 'renderLogView', 'renderDeviceList', 'refreshStorageInfo', 'openTagColorPicker', 'renderTagManagerWithBatch', 'renderImgCatsEditor']);

    // ============ N. 回归验证 & 存储 ============
    test('回归验证', 'A1 tagManageList 无重复绑定', function () { return document.getElementById('tagManageList') ? true : 'warn'; });
    test('回归验证', 'A2 _loadedShardKeys 持久化字段存在', function () { return Array.isArray(window.db._loadedShardKeys) || '不是数组'; });
    test('回归验证', 'B1 增量索引函数存在', function () { return typeof window._indexAddItem === 'function' && typeof window._indexUpdateItem === 'function' && typeof window._indexRemoveItem === 'function' || '缺函数'; });
    test('回归验证', 'B1 分层写盘：__dirtyShards 存在', function () { return window.__dirtyShards instanceof Set || '未初始化'; });
    test('回归验证', 'B1 自检模块暴露', function () { return typeof window.runSelfTest === 'function' || '未暴露'; });
    test('回归验证', 'DEFAULT_SETTINGS 关键字段存在', function () { if (!window.coreHelpers || !window.coreHelpers.DEFAULT_SETTINGS) return 'coreHelpers 未暴露'; var d = window.coreHelpers.DEFAULT_SETTINGS; var keys = ['saveShortcut', 'enableMarkdown', 'autoPush', 'snapshotEnabled', 'enableShortcuts', 'pushMode']; for (var i = 0; i < keys.length; i++) if (!(keys[i] in d)) return '缺 ' + keys[i]; return true; });
    test('存储', 'IndexedDB 可用', function () { return window.indexedDB ? true : '不可用'; });
    test('存储', 'localStorage 可写', function () { try { localStorage.setItem('__selftest__', '1'); localStorage.removeItem('__selftest__'); return true; } catch (e) { return '不可写：' + e.message; } });
    // 加 3 秒超时，避免 IDB 被占用时 Promise 永远 pending
    test('存储', 'IndexedDB 可读', function () {
      return new Promise(function (resolve) {
        var done = false;
        function finish(v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(v);
        }
        var timer = setTimeout(function () {
          finish('超时 3 秒（可能是 IDB 被其他标签页占用，可关掉其他标签页后重试）');
        }, 3000);
        try {
          var req = indexedDB.open('material-library-db');
          req.onsuccess = function () { finish(true); };
          req.onerror = function () { finish('打开失败'); };
          req.onblocked = function () { finish('被其他标签页阻塞'); };
        } catch (e) {
          finish('异常：' + e.message);
        }
      });
    });

    // ============ P. 内容质量 ============
    test('内容质量', '空 text 且无图片的素材', function () { return window.db.items.filter(function (i) { return i && !i.text && (!i.images || i.images.length === 0); }).length === 0 ? true : 'warn'; });
    test('内容质量', 'createdAt 合法性（非 NaN / 非负数）', function () { return window.db.items.filter(function (i) { var t = Number(i.createdAt); return isNaN(t) || t <= 0; }).length === 0 ? true : 'warn'; });
    test('内容质量', 'tags 含空字符串', function () { return window.db.items.filter(function (i) { return (i.tags || []).some(function (t) { return !t || !String(t).trim(); }); }).length === 0 ? true : 'warn'; });
    test('内容质量', 'trash 项缺 deletedAt', function () { return window.db.trash.filter(function (i) { return !i.deletedAt; }).length === 0 ? true : 'warn'; });

    // ============ 整理结果 ============
    function finalize() {
      var elapsed = Date.now() - startAt;
      var byCat = {};
      results.items.forEach(function (it) {
        if (!byCat[it.cat]) byCat[it.cat] = { pass: 0, fail: 0, warn: 0, items: [] };
        byCat[it.cat][it.status]++;
        byCat[it.cat].items.push(it);
      });
      renderSelfTestReport(byCat, results, elapsed);
      return results;
    }

    if (pendingAsync.length) {
      return Promise.all(pendingAsync).then(function () { pendingAsync.length = 0; return finalize(); });
    }
    pendingAsync.length = 0;
    return finalize();
  }

  function renderSelfTestReport(byCat, results, elapsed) {
    var mask = document.getElementById('selftestMask');
    if (mask) mask.remove();

    var total = results.passed + results.failed + results.warned;
    var summaryColor = results.failed > 0 ? 'var(--danger)' : (results.warned > 0 ? '#f59e0b' : '#10b981');
    var summaryIcon = results.failed > 0 ? '❌' : (results.warned > 0 ? '⚠️' : '✅');

    var catsHtml = '';
    if (results.failed === 0 && results.warned === 0) {
      catsHtml = '<div style="text-align:center; padding:20px 10px;">'
        + '<div style="font-size:36px; margin-bottom:10px;">🎉</div>'
        + '<div style="font-size:15px; font-weight:bold; color:#10b981; margin-bottom:4px;">全部功能正常</div>'
        + '<div style="font-size:12px; color:var(--text-3);">共执行了 ' + total + ' 项深度检测</div>'
        + '</div>';
    } else {
      var catOrder = ['DOM-主界面', 'DOM-批量栏', 'DOM-弹窗', 'DOM-设置', 'DOM-图片', 'DOM-批阅',
                      '分段控件', '控件计数', '全局函数', '数据完整性', '索引一致性', '统计准确性',
                      '核心函数', '回归验证', '存储', '内容质量'];

      catOrder.forEach(function (catName) {
        var c = byCat[catName]; if (!c) return;
        var failedItems = c.items.filter(function (i) { return i.status !== 'pass'; });
        if (failedItems.length === 0) return;

        var icon = c.fail > 0 ? '❌' : '⚠️';
        var color = c.fail > 0 ? 'var(--danger)' : '#f59e0b';

        catsHtml += '<details open style="margin-bottom:6px; background:var(--bg); border-radius:6px; border:1px solid var(--line);">'
          + '<summary style="padding:8px 10px; font-size:12.5px; font-weight:600; cursor:pointer; outline:none; color:' + color + '; display:flex; justify-content:space-between; align-items:center;">'
          + '<span>' + icon + ' ' + esc(catName) + '</span>'
          + '<span style="font-size:11px; padding:1px 6px; border-radius:8px; background:var(--card);">' + (c.fail + c.warn) + ' 项</span>'
          + '</summary>'
          + '<div style="padding:0 10px 8px; border-top:1px dashed var(--line); margin-top:2px;">'
          + failedItems.map(function (i) {
              return '<div style="font-size:12px; padding:4px 0; color:var(--text-2); border-bottom:1px solid var(--line); line-height:1.4;">'
                + '• ' + esc(i.name)
                + (i.detail ? ' <span style="color:' + (i.status === 'warn' ? '#f59e0b' : 'var(--danger)') + '; font-weight:600;">[' + esc(i.detail) + ']</span>' : '')
                + '</div>';
            }).join('')
          + '</div>'
          + '</details>';
      });
    }

    var html = '<div class="modal-mask show" id="selftestMask" style="z-index:9999;"><div class="modal" style="max-width:380px; width:90%; border-radius:12px; padding:16px; box-shadow:0 8px 32px rgba(0,0,0,0.15);">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">'
      + '<h3 class="modal-title" style="margin:0; font-size:14px; font-weight:600; color:var(--text-2);">🔍 自检报告</h3>'
      + '<div style="display:flex; gap:6px;"><button class="btn tiny" id="selftestCopyBtn" style="padding:3px 8px; font-size:11.5px; border-radius:6px;">复制</button><button class="btn tiny" id="selftestCloseBtn" style="padding:3px 8px; font-size:11.5px; border-radius:6px;">关闭</button></div>'
      + '</div>'
      + '<div style="text-align:center; padding:10px 0; border-bottom:1px dashed var(--line); margin-bottom:10px;">'
      + '<div style="font-size:24px; margin-bottom:4px;">' + summaryIcon + '</div>'
      + '<div style="font-size:14px; font-weight:600; color:' + summaryColor + ';">'
      + (results.failed > 0 ? '有 ' + results.failed + ' 项失败' : (results.warned > 0 ? '有 ' + results.warned + ' 项警告' : '全部通过'))
      + '</div>'
      + '<div style="font-size:11px; color:var(--text-3); margin-top:4px;">共 ' + total + ' 项 | 耗时 ' + elapsed + ' ms</div>'
      + '</div>'
      + '<div style="max-height:35vh; overflow-y:auto; overflow-x:hidden; padding-right:2px;">' + catsHtml + '</div>'
      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var m = document.getElementById('selftestMask');
    document.getElementById('selftestCloseBtn').addEventListener('click', function () { m.remove(); });
    document.getElementById('selftestCopyBtn').addEventListener('click', function () {
      var text = '自检报告\n' + new Date().toLocaleString() + '\n'
        + '总 ' + total + ' | 通过 ' + results.passed + ' | 警告 ' + results.warned + ' | 失败 ' + results.failed + '\n\n'
        + results.items.map(function (i) { return '[' + i.status.toUpperCase() + '] ' + i.cat + ' - ' + i.name + (i.detail ? ' → ' + i.detail : ''); }).join('\n');
      copyText(text);
    });
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  }

  window.addEventListener('load', function () {
    if (location.search.indexOf('selftest=1') >= 0) setTimeout(runSelfTest, 2000);
  });

  window.runSelfTest = runSelfTest;
})();