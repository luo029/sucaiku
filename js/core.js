// js/core.js · 完整文件
// ★ Bug C 修复：applySettingsToUI 末尾补上 applyFontSize 调用，让"全局字号"真正生效

var UNCAT = '未分类'; var IMG_TYPE = '图片'; var ALL_SOURCES = '__all__';
var DEFAULT_CATS = ['句子', '段落', '梗', '情话', '吐槽', '点子'];
var DEFAULT_IMG_CATS = ['梗图', '情节', '插画', '其他'];
var STORE_KEY = 'material-library'; var SKIP_KEY = 'material-library.skip-confirm';
var LAYOUT_KEY = 'material-library.layout'; var THEME_KEY = 'material-library.theme';
var SETTINGS_KEY = 'material-library.settings'; var ZEN_KEY = 'material-library.zen';
var GH_KEY = 'material-library.github'; var TINY_KEY = 'material-library.tinypng';
var DEVICE_KEY = 'material-library.device';

var AVAILABLE_STYLES = [{ id: 'modern', name: '现代' }, { id: 'retro', name: '复古墨水' }, { id: 'bento', name: '便当盒' }];

var DEFAULT_SETTINGS = {
  copyWithSource: false, copySourceFormat: '—— {source}', trashTtlDays: 30,
  statsDims: { cat: true, source: true, tag: true }, statsLimit: 8,
  compressMode: 'local', tinypngKey: '', tinypngProxy: '',
  catLimit: 3, srcLimit: 3, tagLimit: 3, defaultType: '', collapseLimit: 150, defaultPageSize: 12,
  showHitokoto: true, enableAnim: true, fontSizeMode: 'normal', syncCheckInterval: 60,
  autoCheckUpdate: true, useRelativeTime: false, sidebarShowCat: true, sidebarShowSrc: true, sidebarShowTag: true,
  inputPlaceholder: '粘贴句子、段落（Ctrl+Enter保存）。用【文字】可高亮。可直接粘贴图片。',
  cardSpacing: 'standard', listStyle: 'card', zenFontSize: 'normal', uiStyle: 'modern',
  zenAutoClosePanel: true,
  focusModeCat: '收件箱', saveShortcut: 'ctrl-enter', enableMarkdown: true,
  copyWithoutMarks: true, copyKeepBlankLines: true, focusImgAutoUpload: true, focusImgDefaultCat: '其他',
  imgNamingTemplate: '{cat}-{timestamp}-{rand}',
  dataDir: 'material-library', shardSubdir: 'data', shardMode: 'daily', enableYearIndex: true,
  loadMode: 'smart', smartThresholdMB: 5, manualRangeDays: 90, customRangeDays: 90,
  historyLoadMode: 'auto', lazyLoadBatchSize: 30, startupAutoPull: true, cloudCheckEnabled: true,
  checkIntervalSeconds: 60, pullConcurrency: 8, searchScope: 'local', unloadedSearch: 'ask',
  enableFullTextIndex: false, searchHistoryEnabled: true, searchDebounceMs: 180,
  autoPush: true, pushDelayMs: 2000, pushConcurrency: 3, pushBatchDelay: 500,
  conflictAction: 'prompt', maxShardSizeKB: 800, forceConfirm: true, snapshotBeforePush: true,
  shardMaxSizeKB: 650, shardSplitEnabled: true, gitTreeBatchEnabled: true,
  pushRetryCount: 3, pushRetryDelaySec: 10, syncStatusIcon: true, showSyncProgress: true,
  snapshotEnabled: true, snapshotDailyKeep: 3, snapshotWeeklyKeep: 4, snapshotMonthlyKeep: 3,
  snapshotManualKeep: 10, snapshotMaxAgeDays: 180, snapshotChangeThreshold: 100, snapshotForceDays: 7,
  snapshotCompress: true, snapshotPath: 'snapshots/', snapshotAutoCleanup: true, lastSnapshotAt: 0,
  catSyncAction: 'ask', catConflictMode: 'last-write',
  trashAutoCleanupThreshold: 1000, repoVisibility: 'public', showPrivacyNotice: false,
  enableLog: true, logCleanupMode: 'count', logMaxCount: 500, logMaxSizeKB: 100, logMaxDays: 30,
  logHardLimitEnabled: true, logHardLimitCount: 1000, logRecordPush: true, logRecordPull: true,
  logRecordConflict: true, logRecordAutoPull: false, logRecordSettings: false, logRecordShardSha: true,
  logDisplayCount: 50, logSyncCloud: true, deviceName: '', deviceIcon: '', deviceStatus: 'active',
  autoCleanDevices: true, deviceCleanupDays: 30, strictReadonly: false, syncCats: true, syncSettings: true,
  syncTrash: true, syncLog: true, syncDevices: true, shardSyncMode: 'all', shardSyncYears: [],
  autoSnapshot: true, snapshotCount: 3, exportReminderDays: 30, storageWarningPct: 85, autoCleanup: false,
  enableMigrationResume: true, rollbackLimit: 50, rollbackEnabled: true, tagColorMode: 'dot',
  tagAutoColor: false, tagFilterLogic: 'and', autoCompleteChars: 1, autoCompleteMax: 10,
  importDefaultAction: 'ask', timezoneMode: 'local', showProgressBar: true,
  integrityCheckMode: 'weekly', maxSplitParts: 10, autoDeleteEmptyShard: true,
  enableShortcuts: true, shortcutSearch: '/', shortcutNew: 'n', shortcutPush: 'ctrl+s',
  maxTagsInHeader: 3, enableContextMenu: true
};

var PALETTE = [
  { bg: '#eef2ff', fg: '#4f46e5' }, { bg: '#ecfdf5', fg: '#059669' }, { bg: '#fff7ed', fg: '#ea580c' },
  { bg: '#fdf2f8', fg: '#db2777' }, { bg: '#eff6ff', fg: '#2563eb' }, { bg: '#fefce8', fg: '#ca8a04' },
  { bg: '#f5f3ff', fg: '#7c3aed' }, { bg: '#f0fdfa', fg: '#0d9488' }, { bg: '#fef2f2', fg: '#dc2626' },
  { bg: '#f1f5f9', fg: '#475569' }, { bg: '#fff0f5', fg: '#e11d48' }, { bg: '#f3e8ff', fg: '#9333ea' },
  { bg: '#e0f2fe', fg: '#0284c7' }, { bg: '#dcfce7', fg: '#16a34a' }, { bg: '#fef08a', fg: '#854d0e' },
  { bg: '#ffedd5', fg: '#c2410c' }, { bg: '#fce7f3', fg: '#be185d' }, { bg: '#e0e7ff', fg: '#3730a3' },
  { bg: '#ccfbf1', fg: '#0f766e' }, { bg: '#fee2e2', fg: '#b91c1c' }
];

var db = {
  items: [], cats: DEFAULT_CATS.slice(), colors: {}, sources: [], fixedSource: '', fixedTags: [],
  imageCategories: DEFAULT_IMG_CATS.slice(), settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  trash: [], tagColors: {}, _rev: 0, _shardSnapshots: {}, _trashSnapshot: '', _metaSnapshot: '',
  _deviceId: '', _loadedShardKeys: [], _allShardKeys: [], catVersion: 0, _indexRev: -1
};

var currentType = '全部'; var currentSource = ALL_SOURCES; var currentTag = '';
var currentTags = new Set(); var keyword = ''; var editingId = null; var selectMode = false;
var selectedIds = new Set(); var pendingConfirm = null; var exportFormat = 'json';
var currentPage = 1; var pageSize = 12; var layoutMode = 'sidebar'; var themeMode = 'light';
var zenMode = false; var focusMode = false; var pendingImages = []; var pendingUploadFiles = [];
var pendingUploadCat = ''; var expandedIds = new Set(); var draggedItemId = null;
var currentImgViewCat = '全部'; var repoImagesCache = []; var imgMgrCurrentFilter = 'all';
var imgMgrSelectMode = false; var imgMgrSelectedIds = new Set();

function trashTtlMs() { return Math.max(1, Math.min(365, Number(db.settings.trashTtlDays) || 30)) * 86400000; }
function fmtSize(n) { if (!n || n < 0) return '0 B'; if (n < 1024) return n + ' B'; if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'; return (n / 1024 / 1024).toFixed(2) + ' MB'; }
function $(id) { return document.getElementById(id); }

var inputEl = $('input'), typeEl = $('type'), sourceEl = $('source'), tagsEl = $('tags');
var addBtn = $('addBtn'), cancelBtn = $('cancelBtn'), listEl = $('list'), searchEl = $('search');
var batchBar = $('batchBar'), sourcePicker = $('sourcePicker'), sourcePanel = $('sourcePanel');
var spList = $('spList'), spSearch = $('spSearch'), tagPicker = $('tagPicker');
var tagPanel = $('tagPanel'), tpList = $('tpList'), tpSearch = $('tpSearch');
var tabsEl = $('tabs'), pendingImgsEl = $('pendingImgs'), zenBarEl = $('zenBar');

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function getSearchTerms() { return keyword.trim().toLowerCase().split(/\s+/).filter(Boolean); }
function formatCount(num) { return num > 99 ? '99+' : num; }

var _MARKUP_RE = /\u3010([\s\S]*?)\u3011|==([\s\S]*?)==|\*\*([\s\S]*?)\*\*/g;
var _hlRegexCache = new Map();
var _HL_CACHE_MAX = 60;

function highlightEscaped(escaped, kws) {
  var list = (kws || []).filter(Boolean); if (!list.length) return escaped;
  var pat = list.map(function (k) { return esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
  if (!pat) return escaped;
  var re = _hlRegexCache.get(pat);
  if (!re) {
    try { re = new RegExp('(' + pat + ')', 'gi'); } catch (e) { return escaped; }
    if (_hlRegexCache.size >= _HL_CACHE_MAX) _hlRegexCache.clear();
    _hlRegexCache.set(pat, re);
  }
  try { return escaped.replace(re, '<mark class="kw">$1</mark>'); } catch (e) { return escaped; }
}

function formatText(text, kws) {
  var raw = String(text == null ? '' : text); var enableMD = db.settings.enableMarkdown !== false;
  _MARKUP_RE.lastIndex = 0;
  var out = '', last = 0, m;
  while ((m = _MARKUP_RE.exec(raw))) {
    out += highlightEscaped(esc(raw.slice(last, m.index)), kws);
    if (typeof m[1] == 'string') out += '<mark class="hl">' + esc(m[1]) + '</mark>';
    else if (typeof m[2] == 'string') out += '<mark class="hl">' + esc(m[2]) + '</mark>';
    else if (typeof m[3] == 'string') out += enableMD ? '<strong>' + esc(m[3]) + '</strong>' : esc(m[0]);
    last = m.index + m[0].length;
  }
  out += highlightEscaped(esc(raw.slice(last)), kws); return out;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(ts) {
  if (!ts) return '';
  if (db.settings.useRelativeTime) {
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 86400000 * 30) return Math.floor(diff / 86400000) + ' 天前';
  }
  var d = new Date(ts || Date.now()); var now = new Date();
  var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  if (d.getFullYear() === now.getFullYear()) return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
}
function fmtDateOnly(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fmtFull(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }

var toastTimer;
var toastQueue = [];
var isToasting = false;

function toast(msg) {
  if (!msg) return;
  if (toastQueue.length >= 3) {
    toastQueue.shift();
  }
  toastQueue.push(msg);
  if (!isToasting) {
    processToastQueue();
  }
}

function processToastQueue() {
  var el = $('toast');
  if (!el) return;
  
  if (toastQueue.length === 0) {
    isToasting = false;
    el.classList.remove('show');
    return;
  }

  isToasting = true;
  var currentMsg = toastQueue.shift();
  el.textContent = currentMsg;
  
  var imgMgrBar = $('imgMgrBatchBar');
  el.classList.toggle('raised', (batchBar && batchBar.classList.contains('show')) || (imgMgrBar && imgMgrBar.classList.contains('show')));
  el.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    processToastQueue();
  }, 2400);
}

function copyText(text, source) {
  var finalText = String(text || ''); if (db.settings.copyWithoutMarks !== false) finalText = finalText.replace(/【([\s\S]*?)】/g, '$1').replace(/==([\s\S]*?)==/g, '$1').replace(/\*\*([\s\S]*?)\*\*/g, '$1');
  if (db.settings.copyKeepBlankLines === false) finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();
  if (db.settings.copyWithSource) { var fmt = db.settings.copySourceFormat; if (fmt) { var suffix = fmt.indexOf('{source}') >= 0 ? fmt.replace(/\{source\}/g, source || '') : fmt; if (suffix.trim()) finalText += '\n' + suffix; } }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(finalText).then(function () { toast('已复制'); }).catch(function () { fallbackCopy(finalText); }); else fallbackCopy(finalText);
}
function fallbackCopy(t) { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请手动选择'); } ta.remove(); }
function download(blob, filename) { var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }
function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function base64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64))); }
function blobToBase64(blob) { return new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { var s = String(r.result); resolve(s.split(',')[1] || ''); }; r.onerror = reject; r.readAsDataURL(blob); }); }

function fetchHitokoto() { var txtEl = $('hitokotoText'), fromEl = $('hitokotoFrom'); if (!txtEl) return; txtEl.textContent = '正在获取...'; if (fromEl) fromEl.textContent = ''; fetch('https://v1.hitokoto.cn/').then(function (r) { return r.json(); }).then(function (data) { if (data.hitokoto) { txtEl.textContent = data.hitokoto; var fromStr = data.from ? '—— ' + data.from : ''; if (data.from_who) fromStr += ' · ' + data.from_who; if (fromEl) fromEl.textContent = fromStr; } }).catch(function () { txtEl.textContent = '获取失败'; }); }

function applyLayout() { document.body.classList.toggle('layout-sidebar', layoutMode === 'sidebar'); document.body.classList.toggle('layout-compact', layoutMode === 'compact'); updateLayoutBtn(); }
function updateLayoutBtn() {
  var btn = $('layoutBtn'); if (!btn) return;
  if (layoutMode === 'sidebar') { btn.title = '收起侧栏'; btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><path d="m10 9 3 3-3 3"/></svg>'; }
  else { btn.title = '展开侧栏'; btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><path d="m13 9-3 3 3 3"/></svg>'; }
}
function setLayout(mode) { layoutMode = mode; localStorage.setItem(LAYOUT_KEY, mode); applyLayout(); closeSidebar(); renderSourceFilter(); }
function setTheme(mode, persist) { if (typeof persist === 'undefined') persist = true; themeMode = mode; document.documentElement.setAttribute('data-theme', mode); if (persist) localStorage.setItem(THEME_KEY, mode); var sun = $('themeIconSun'), moon = $('themeIconMoon'); if (sun) sun.style.display = mode === 'dark' ? 'none' : 'block'; if (moon) moon.style.display = mode === 'dark' ? 'block' : 'none'; }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(db.settings)); if (typeof save === 'function') save(); if (typeof scheduleAutoPush === 'function' && !window.suppressPush) scheduleAutoPush(); }

function getOrCreateDevice() { var stored = null; try { stored = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); } catch (e) { stored = null; } if (stored && stored.id) return stored; var id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); var auto = detectDevice(); var device = { id: id, name: auto.name, icon: auto.icon, type: auto.type, createdAt: Date.now() }; try { localStorage.setItem(DEVICE_KEY, JSON.stringify(device)); } catch (e) {} return device; }
function detectDevice() { var ua = navigator.userAgent || ''; var screenW = (window.screen && window.screen.width) ? window.screen.width : 1024; var isMobileUA = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua); var isTabletUA = /iPad|Android(?!.*Mobile)/i.test(ua); var isMac = /Macintosh|Mac OS X/i.test(ua); var isWindows = /Windows/i.test(ua); var isLinux = /Linux/i.test(ua) && !/Android/i.test(ua); if (isTabletUA || (!isMobileUA && screenW >= 768 && screenW < 1024)) return { name: isMac ? 'iPad' : '平板', icon: '📱', type: 'tablet' }; if (isMobileUA || screenW < 768) { if (/iPhone/i.test(ua)) return { name: 'iPhone', icon: '📱', type: 'mobile' }; if (/Android/i.test(ua)) return { name: 'Android 手机', icon: '📱', type: 'mobile' }; return { name: '手机', icon: '📱', type: 'mobile' }; } if (isMac) return { name: 'MacBook', icon: '💻', type: 'desktop' }; if (isWindows) return { name: 'Windows PC', icon: '💻', type: 'desktop' }; if (isLinux) return { name: 'Linux PC', icon: '💻', type: 'desktop' }; return { name: '电脑', icon: '💻', type: 'desktop' }; }
function getDeviceDisplay() { var dev = getOrCreateDevice(); return { id: dev.id, name: db.settings.deviceName || dev.name, icon: db.settings.deviceIcon || dev.icon, type: dev.type }; }

function setSegmentedActive(containerId, attribute, value) {
  var el = $(containerId);
  if (!el) return;
  el.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute(attribute) === String(value));
  });
}

function applySettingsToUI() {
  var s = db.settings;
  document.documentElement.setAttribute('data-style', s.uiStyle || 'modern'); document.body.setAttribute('data-style', s.uiStyle || 'modern');
  if ($('copyWithSource')) $('copyWithSource').checked = !!s.copyWithSource;
  if ($('copySourceFormat')) { $('copySourceFormat').value = s.copySourceFormat !== undefined ? s.copySourceFormat : '—— {source}'; if ($('copySourceFormatWrap')) $('copySourceFormatWrap').style.display = s.copyWithSource ? 'block' : 'none'; }
  if ($('enableMarkdown')) $('enableMarkdown').checked = s.enableMarkdown !== false;
  if ($('copyWithoutMarks')) $('copyWithoutMarks').checked = s.copyWithoutMarks !== false;
  if ($('copyKeepBlankLines')) $('copyKeepBlankLines').checked = s.copyKeepBlankLines !== false;
  if ($('trashTtlInput')) $('trashTtlInput').value = Number(s.trashTtlDays) || 30;
  if ($('statDimCat')) $('statDimCat').checked = !s.statsDims || s.statsDims.cat !== false;
  if ($('statDimSource')) $('statDimSource').checked = !s.statsDims || s.statsDims.source !== false;
  if ($('statDimTag')) $('statDimTag').checked = !s.statsDims || s.statsDims.tag !== false;
  if ($('statLimitInput')) $('statLimitInput').value = Number(s.statsLimit) || 8;
  if ($('tinypngKey')) $('tinypngKey').value = s.tinypngKey || ''; if ($('tinypngProxy')) $('tinypngProxy').value = s.tinypngProxy || '';
  if ($('syncCheckIntervalInput')) $('syncCheckIntervalInput').value = Number(s.syncCheckInterval) || 60;
  if ($('autoCheckUpdateToggle')) $('autoCheckUpdateToggle').checked = s.autoCheckUpdate !== false;
  if ($('useRelativeTimeToggle')) $('useRelativeTimeToggle').checked = s.useRelativeTime === true;
  if ($('themeDarkToggle')) $('themeDarkToggle').checked = themeMode === 'dark';
  if ($('zenAutoClosePanel')) $('zenAutoClosePanel').checked = s.zenAutoClosePanel !== false;
  if ($('focusModeCatInput')) $('focusModeCatInput').value = s.focusModeCat || '收件箱';
  if ($('sidebarShowCat')) $('sidebarShowCat').checked = s.sidebarShowCat !== false; if ($('sidebarShowSrc')) $('sidebarShowSrc').checked = s.sidebarShowSrc !== false; if ($('sidebarShowTag')) $('sidebarShowTag').checked = s.sidebarShowTag !== false;
  
  var catGroup = $('catNav') && $('catNav').closest ? $('catNav').closest('.nav-group') : null; var srcGroup = $('sourceNav') && $('sourceNav').closest ? $('sourceNav').closest('.nav-group') : null; var tagGroup = $('tagNav') && $('tagNav').closest ? $('tagNav').closest('.nav-group') : null;
  if (catGroup) catGroup.style.display = s.sidebarShowCat !== false ? '' : 'none'; if (srcGroup) srcGroup.style.display = s.sidebarShowSrc !== false ? '' : 'none'; if (tagGroup) tagGroup.style.display = s.sidebarShowTag !== false ? '' : 'none';
  
  if (inputEl) { var hint = s.saveShortcut === 'enter' ? '（Enter 保存，Shift+Enter 换行）' : '（Ctrl+Enter 保存）'; var isCustom = s.inputPlaceholder && s.inputPlaceholder !== DEFAULT_SETTINGS.inputPlaceholder; if (isCustom) inputEl.placeholder = s.inputPlaceholder; else inputEl.placeholder = '粘贴句子、段落' + hint + '。用【文字】可高亮。可直接粘贴图片。'; }
  if ($('inputPlaceholder')) $('inputPlaceholder').value = s.inputPlaceholder || DEFAULT_SETTINGS.inputPlaceholder;
  document.body.classList.remove('layout-strip'); if (s.listStyle === 'strip') document.body.classList.add('layout-strip');
  
  setSegmentedActive('saveShortcut', 'data-shortcut', s.saveShortcut || 'ctrl-enter');
  setSegmentedActive('listStyleMode', 'data-style', s.listStyle || 'card');
  setSegmentedActive('zenFontSize', 'data-zfs', s.zenFontSize || 'normal');
  setSegmentedActive('fontSizeMode', 'data-size', s.fontSizeMode || 'normal');
  setSegmentedActive('compressMode', 'data-mode', s.compressMode || 'local');
  setSegmentedActive('loadMode', 'data-mode', s.loadMode || 'smart');
  setSegmentedActive('historyLoadMode', 'data-mode', s.historyLoadMode || 'auto');
  setSegmentedActive('conflictAction', 'data-act', s.conflictAction || 'prompt');
  setSegmentedActive('searchScope', 'data-scope', s.searchScope || 'local');
  setSegmentedActive('unloadedSearch', 'data-act', s.unloadedSearch || 'ask');
  setSegmentedActive('tagColorMode', 'data-mode', s.tagColorMode || 'dot');
  setSegmentedActive('tagFilterLogic', 'data-logic', s.tagFilterLogic || 'and');
  setSegmentedActive('importDefaultAction', 'data-action', s.importDefaultAction || 'ask');
  setSegmentedActive('shardMode', 'data-mode', s.shardMode || 'daily');
  setSegmentedActive('timezoneMode', 'data-mode', s.timezoneMode || 'local');
  setSegmentedActive('shardSyncMode', 'data-mode', s.shardSyncMode || 'all');
  setSegmentedActive('deviceStatus', 'data-status', s.deviceStatus || 'active');
  setSegmentedActive('logCleanupMode', 'data-mode', s.logCleanupMode || 'count');
  setSegmentedActive('catSyncAction', 'data-act', s.catSyncAction || 'ask');
  setSegmentedActive('catConflictMode', 'data-mode', s.catConflictMode || 'last-write');

  if ($('catLimitInput')) $('catLimitInput').value = Number(s.catLimit) || 3; if ($('srcLimitInput')) $('srcLimitInput').value = Number(s.srcLimit) || 3; if ($('tagLimitInput')) $('tagLimitInput').value = Number(s.tagLimit) || 3; if ($('collapseLimitInput')) $('collapseLimitInput').value = Number(s.collapseLimit) || 150;
  if ($('showHitokoto')) $('showHitokoto').checked = s.showHitokoto !== false; if ($('enableAnim')) $('enableAnim').checked = s.enableAnim !== false; if ($('defaultPageSizeSelect')) $('defaultPageSizeSelect').value = String(s.defaultPageSize) || '12';
  
  if ($('defaultTypeSelect')) { var sel = $('defaultTypeSelect'); sel.innerHTML = '<option value="">跟随系统（无）</option>' + db.cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join(''); sel.value = s.defaultType || ''; }
  if ($('tinypngFields')) $('tinypngFields').style.display = (s.compressMode === 'tinypng') ? 'block' : 'none';
  document.body.classList.toggle('no-anim', s.enableAnim === false);
  var hitokotoBox = document.querySelector('.hitokoto-box'); if (hitokotoBox) hitokotoBox.style.display = (s.showHitokoto !== false) ? 'flex' : 'none';
  
  if ($('focusImgAutoUpload')) $('focusImgAutoUpload').checked = s.focusImgAutoUpload !== false; if ($('focusImgCatWrap')) $('focusImgCatWrap').style.display = (s.focusImgAutoUpload !== false) ? 'block' : 'none';
  if ($('focusImgDefaultCat')) { var selCat = $('focusImgDefaultCat'); selCat.innerHTML = db.imageCategories.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join(''); selCat.value = s.focusImgDefaultCat || '其他'; }
  if ($('imgNamingTemplate')) $('imgNamingTemplate').value = s.imgNamingTemplate || '{cat}-{timestamp}-{rand}'; if (typeof window.updateImgNamingPreview === 'function') window.updateImgNamingPreview();

  if ($('enableShortcuts')) $('enableShortcuts').checked = s.enableShortcuts !== false;
  if ($('shortcutSearch')) $('shortcutSearch').value = s.shortcutSearch || '/';
  if ($('shortcutNew')) $('shortcutNew').value = s.shortcutNew || 'n';
  if ($('maxTagsInHeader')) $('maxTagsInHeader').value = Number(s.maxTagsInHeader) || 3;
  if ($('enableContextMenu')) $('enableContextMenu').checked = s.enableContextMenu !== false;

  if ($('snapshotEnabled')) $('snapshotEnabled').checked = s.snapshotEnabled !== false;
  if ($('snapshotDailyKeep')) $('snapshotDailyKeep').value = Number(s.snapshotDailyKeep) || 0;
  if ($('snapshotWeeklyKeep')) $('snapshotWeeklyKeep').value = Number(s.snapshotWeeklyKeep) || 0;
  if ($('snapshotMonthlyKeep')) $('snapshotMonthlyKeep').value = Number(s.snapshotMonthlyKeep) || 0;
  if ($('snapshotManualKeep')) $('snapshotManualKeep').value = Number(s.snapshotManualKeep) || 10;
  if ($('snapshotMaxAgeDays')) $('snapshotMaxAgeDays').value = Number(s.snapshotMaxAgeDays) || 180;
  if ($('snapshotChangeThreshold')) $('snapshotChangeThreshold').value = Number(s.snapshotChangeThreshold) || 100;
  if ($('snapshotForceDays')) $('snapshotForceDays').value = Number(s.snapshotForceDays) || 7;
  if ($('snapshotCompress')) $('snapshotCompress').checked = s.snapshotCompress !== false;
  if ($('snapshotAutoCleanup')) $('snapshotAutoCleanup').checked = s.snapshotAutoCleanup !== false;
  if ($('snapshotPath')) $('snapshotPath').value = s.snapshotPath || 'snapshots/';

  if ($('shardMaxSizeKB')) $('shardMaxSizeKB').value = Number(s.shardMaxSizeKB) || 650;
  if ($('shardSplitEnabled')) $('shardSplitEnabled').checked = s.shardSplitEnabled !== false;
  if ($('gitTreeBatchEnabled')) $('gitTreeBatchEnabled').checked = s.gitTreeBatchEnabled !== false;
  if ($('pushRetryCount')) $('pushRetryCount').value = Number(s.pushRetryCount) || 3;
  if ($('pushRetryDelaySec')) $('pushRetryDelaySec').value = Number(s.pushRetryDelaySec) || 10;
  if ($('syncStatusIcon')) $('syncStatusIcon').checked = s.syncStatusIcon !== false;
  if ($('showSyncProgress')) $('showSyncProgress').checked = s.showSyncProgress !== false;
  if ($('trashAutoCleanupThreshold')) $('trashAutoCleanupThreshold').value = Number(s.trashAutoCleanupThreshold) || 1000;

  updateTinyUsageUI(); if (typeof window.renderImgCatsEditor === 'function') window.renderImgCatsEditor(); if (typeof renderStyleOptions === 'function') renderStyleOptions();

  // ★ Bug C 修复：让"全局字号"设置真正生效
  applyFontSize(s.fontSizeMode || 'normal');
}

function applyFontSize(mode) { document.documentElement.classList.remove('font-large', 'font-xlarge'); if (mode === 'large') document.documentElement.classList.add('font-large'); if (mode === 'xlarge') document.documentElement.classList.add('font-xlarge'); }
function loadSettings() {
  try { var s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if (s && typeof s === 'object') { var merged = {}; var k; for (k in DEFAULT_SETTINGS) if (DEFAULT_SETTINGS.hasOwnProperty(k)) merged[k] = DEFAULT_SETTINGS[k]; for (k in s) if (s.hasOwnProperty(k)) merged[k] = s[k]; merged.statsDims = {}; for (k in DEFAULT_SETTINGS.statsDims) merged.statsDims[k] = DEFAULT_SETTINGS.statsDims[k]; if (s.statsDims) for (k in s.statsDims) merged.statsDims[k] = s.statsDims[k]; db.settings = merged; } } catch (e) {}
  db.settings.trashTtlDays = Math.max(1, Math.min(365, Number(db.settings.trashTtlDays) || 30)); db.settings.statsLimit = Math.max(3, Math.min(30, Number(db.settings.statsLimit) || 8)); db.settings.catLimit = Math.max(1, Math.min(30, Number(db.settings.catLimit) || 3)); db.settings.srcLimit = Math.max(1, Math.min(30, Number(db.settings.srcLimit) || 3)); db.settings.tagLimit = Math.max(1, Math.min(30, Number(db.settings.tagLimit) || 3)); db.settings.collapseLimit = Math.max(50, Math.min(9999, Number(db.settings.collapseLimit) || 150)); db.settings.defaultPageSize = Number(db.settings.defaultPageSize) || 12; db.settings.syncCheckInterval = Math.max(10, Math.min(3600, Number(db.settings.syncCheckInterval) || 60));
  if (['none', 'local', 'tinypng'].indexOf(db.settings.compressMode) < 0) db.settings.compressMode = 'local'; if (['normal', 'large', 'xlarge'].indexOf(db.settings.fontSizeMode) < 0) db.settings.fontSizeMode = 'normal';
  if (['ask', 'auto', 'never'].indexOf(db.settings.catSyncAction) < 0) db.settings.catSyncAction = 'ask';
  if (['last-write', 'merge'].indexOf(db.settings.catConflictMode) < 0) db.settings.catConflictMode = 'last-write';
  if (typeof db.settings.imgNamingTemplate !== 'string' || !db.settings.imgNamingTemplate.trim()) db.settings.imgNamingTemplate = DEFAULT_SETTINGS.imgNamingTemplate;
  if (typeof db.settings.dataDir !== 'string') db.settings.dataDir = DEFAULT_SETTINGS.dataDir; if (typeof db.settings.shardSubdir !== 'string') db.settings.shardSubdir = DEFAULT_SETTINGS.shardSubdir;
  if (typeof db.settings.snapshotPath !== 'string' || !db.settings.snapshotPath) db.settings.snapshotPath = 'snapshots/';
  db.settings.shardMaxSizeKB = Math.max(200, Math.min(2000, Number(db.settings.shardMaxSizeKB) || 650));
  db.settings.snapshotDailyKeep = Math.max(0, Math.min(30, Number(db.settings.snapshotDailyKeep) || 0)); db.settings.snapshotWeeklyKeep = Math.max(0, Math.min(26, Number(db.settings.snapshotWeeklyKeep) || 0)); db.settings.snapshotMonthlyKeep = Math.max(0, Math.min(24, Number(db.settings.snapshotMonthlyKeep) || 0));
  db.settings.snapshotManualKeep = Math.max(0, Math.min(99, Number(db.settings.snapshotManualKeep) || 10)); db.settings.snapshotMaxAgeDays = Math.max(30, Math.min(3650, Number(db.settings.snapshotMaxAgeDays) || 180));
  db.settings.snapshotChangeThreshold = Math.max(10, Math.min(10000, Number(db.settings.snapshotChangeThreshold) || 100)); db.settings.snapshotForceDays = Math.max(1, Math.min(365, Number(db.settings.snapshotForceDays) || 7));
  db.settings.pushRetryCount = Math.max(0, Math.min(10, Number(db.settings.pushRetryCount) || 3)); db.settings.pushRetryDelaySec = Math.max(1, Math.min(120, Number(db.settings.pushRetryDelaySec) || 10)); db.settings.trashAutoCleanupThreshold = Math.max(100, Math.min(100000, Number(db.settings.trashAutoCleanupThreshold) || 1000));
  pageSize = db.settings.defaultPageSize; applySettingsToUI();
}

function currentMonth() { var n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth() + 1); }
function loadTinyCount() { try { var d = JSON.parse(localStorage.getItem(TINY_KEY)) || {}; if (d.month !== currentMonth()) return { month: currentMonth(), count: 0 }; return { month: d.month, count: Number(d.count) || 0 }; } catch (e) { return { month: currentMonth(), count: 0 }; } }
function bumpTinyCount() { var d = loadTinyCount(); d.count += 1; localStorage.setItem(TINY_KEY, JSON.stringify(d)); updateTinyUsageUI(); return d; }
function updateTinyUsageUI() { var d = loadTinyCount(); var el = $('tinyUsage'); if (el) el.innerHTML = '本月（' + d.month + '）已用 <b>' + d.count + '</b> / 500 次'; }

window.coreHelpers = { DEFAULT_SETTINGS: DEFAULT_SETTINGS, PALETTE: PALETTE, AVAILABLE_STYLES: AVAILABLE_STYLES };
window.db = db; window.$ = $; window.toast = toast; window.esc = esc; window.formatText = formatText; window.uid = uid; window.fmtDate = fmtDate; window.fmtFull = fmtFull; window.fmtDateOnly = fmtDateOnly; window.utf8ToBase64 = utf8ToBase64; window.base64ToUtf8 = base64ToUtf8; window.blobToBase64 = blobToBase64; window.download = download; window.copyText = copyText; window.scrollTop = scrollTop; window.formatCount = formatCount;