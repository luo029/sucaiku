// js/store.js
var IDB_NAME = 'material-library-db'; var IDB_STORE = 'kv'; var IDB_KEY = 'main'; var _idb = null;
function openIDB() { if (_idb) return Promise.resolve(_idb); return new Promise(function (resolve, reject) { if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; } var req = indexedDB.open(IDB_NAME, 1); req.onupgradeneeded = function (e) { var d = e.target.result; if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE); }; req.onsuccess = function (e) { _idb = e.target.result; resolve(_idb); }; req.onerror = function (e) { reject(e.target.error); }; }); }
function idbGet(key) { return openIDB().then(function (d) { return new Promise(function (resolve, reject) { var tx = d.transaction(IDB_STORE, 'readonly'); var req = tx.objectStore(IDB_STORE).get(key); req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); }; }); }); }
function idbPut(key, value) { return openIDB().then(function (d) { return new Promise(function (resolve, reject) { var tx = d.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(value, key); tx.oncomplete = function () { resolve(); }; tx.onerror = function () { reject(tx.error); }; }); }); }

var _warningShown = false; function showStorageWarning(size) { if (_warningShown) return; _warningShown = true; var bar = document.getElementById('storageWarningBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'storageWarningBar'; bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:10px 16px;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;'; document.body.appendChild(bar); } bar.innerHTML = '<span>⚠️ 数据已达 ' + (size / 1024 / 1024).toFixed(2) + ' MB，请定期导出备份或开启云端推送</span><button style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;" onclick="document.getElementById(\'storageWarningBar\').remove()">知道了</button>'; }

var suppressPush = false; var _filterCacheKey = ''; var _filterCacheResult = []; var _pendingSave = false; var _needNormalize = true;
function markNeedNormalize() { _needNormalize = true; }
function clearFilterCache() { _filterCacheKey = ''; }
var _idbSaveTimer = null;

function save() { clearFilterCache(); db._rev = (db._rev || 0) + 1; _pendingSave = true; _scheduleSaveIDB(); if (!suppressPush && typeof scheduleAutoPush === 'function') scheduleAutoPush(); }
function _scheduleSaveIDB() { clearTimeout(_idbSaveTimer); _idbSaveTimer = setTimeout(function () { idbPut(IDB_KEY, db).then(function () { _pendingSave = false; var size = JSON.stringify(db).length; if (size > 4 * 1024 * 1024) showStorageWarning(size); }).catch(function (e) { console.error('IndexedDB 保存失败', e); try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); _pendingSave = false; toast('已降级保存到 localStorage'); } catch (e2) { toast('保存失败！请立即导出备份'); } }); }, 300); }
function saveImmediate() { clearTimeout(_idbSaveTimer); db._rev = (db._rev || 0) + 1; clearFilterCache(); return idbPut(IDB_KEY, db).then(function () { _pendingSave = false; var size = JSON.stringify(db).length; if (size > 4 * 1024 * 1024) showStorageWarning(size); }).catch(function (e) { console.error('IndexedDB 立即保存失败', e); try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); _pendingSave = false; } catch (e2) { toast('保存失败！请立即导出备份'); } }); }
function _flushPendingToLocalStorage() { if (!_pendingSave) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {} }
window.addEventListener('beforeunload', _flushPendingToLocalStorage); window.addEventListener('pagehide', _flushPendingToLocalStorage);

function loadStore() {
  var idbData = null; var lsData = null;
  return idbGet(IDB_KEY).then(function (d) { if (d && typeof d === 'object') idbData = d; }).catch(function (e) { console.warn('IndexedDB 读取失败', e); }).then(function () {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) { var parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') lsData = parsed; } } catch (e) {}
    var idbRev = Number(idbData && idbData._rev) || 0; var lsRev = Number(lsData && lsData._rev) || 0; var data = null;
    if (idbData && lsData) { if (lsRev > idbRev) { data = lsData; idbPut(IDB_KEY, lsData).catch(function () {}); console.log('✅ 从 localStorage 兜底恢复到 IndexedDB'); } else { data = idbData; } try { localStorage.removeItem(STORE_KEY); } catch (e) {} } 
    else if (idbData) { data = idbData; } 
    else if (lsData) { data = lsData; return idbPut(IDB_KEY, lsData).then(function () { localStorage.removeItem(STORE_KEY); console.log('✅ 已将 localStorage 数据迁移到 IndexedDB'); }).catch(function (e2) { console.warn('迁移到 IndexedDB 失败', e2); }).then(function () { if (data && typeof data === 'object') applyLoadedData(data); }); }
    if (data && typeof data === 'object') applyLoadedData(data);
    db.items.forEach(function (i) { if (i.source && db.sources.indexOf(i.source) < 0) db.sources.push(i.source); if (!i.tags) i.tags = []; i.images = normalizeImages(i.images); });
  });
}

function applyLoadedData(o) {
  if (Array.isArray(o.items)) db.items = o.items.filter(function (i) { return i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)); });
  if (Array.isArray(o.cats)) db.cats = o.cats.filter(function (c) { return typeof c === 'string' && c.trim() && c !== UNCAT && c !== IMG_TYPE; });
  if (o.colors && typeof o.colors === 'object') db.colors = o.colors;
  if (Array.isArray(o.sources)) db.sources = o.sources.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (typeof o.fixedSource === 'string') db.fixedSource = o.fixedSource;
  if (Array.isArray(o.fixedTags)) db.fixedTags = o.fixedTags.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (Array.isArray(o.trash)) db.trash = o.trash.filter(function (i) { return i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)); });
  if (Array.isArray(o.imageCategories) && o.imageCategories.length) db.imageCategories = o.imageCategories.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (o.settings && typeof o.settings === 'object') { var merged = {}; var k; for (k in db.settings) if (db.settings.hasOwnProperty(k)) merged[k] = db.settings[k]; for (k in o.settings) if (o.settings.hasOwnProperty(k)) merged[k] = o.settings[k]; merged.statsDims = {}; for (k in db.settings.statsDims) if (db.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = db.settings.statsDims[k]; if (o.settings.statsDims) for (k in o.settings.statsDims) if (o.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = o.settings.statsDims[k]; db.settings = merged; }
  if (o.tagColors && typeof o.tagColors === 'object') db.tagColors = o.tagColors;
  db._rev = Number(o._rev) || 0;
  db._shardSnapshots = o._shardSnapshots || {}; db._trashSnapshot = o._trashSnapshot || ''; db._metaSnapshot = o._metaSnapshot || '';
  markNeedNormalize();
}

function normalizeImages(arr) { if (!Array.isArray(arr)) return []; return arr.map(function (img) { if (typeof img === 'string') return { url: img, path: '', cat: '其他', tags: [], size: 0, origSize: 0 }; if (img && (img.path || img.url)) return { path: img.path || '', url: img.url || '', cat: img.cat || '其他', tags: Array.isArray(img.tags) ? Array.from(new Set(img.tags.map(function (t) { return String(t).trim(); }).filter(Boolean))) : [], size: Number(img.size) || 0, origSize: Number(img.origSize) || 0 }; return null; }).filter(Boolean); }
function cleanTrash() { var now = Date.now(); var ttl = trashTtlMs(); var before = db.trash.length; db.trash = db.trash.filter(function (i) { return (i.deletedAt || now) > now - ttl; }); if (db.trash.length !== before) save(); }
function ensureColors() { if (!db.colors || typeof db.colors !== 'object') db.colors = {}; var dirty = false; var catSet = new Set(db.cats); Object.keys(db.colors).forEach(function (k) { if (!catSet.has(k) || typeof db.colors[k] !== 'number') { delete db.colors[k]; dirty = true; } }); var used = new Set(Object.values(db.colors)); db.cats.forEach(function (c) { if (!(c in db.colors)) { var i = 0; while (used.has(i)) i++; db.colors[c] = i; used.add(i); dirty = true; } }); return dirty; }

function normalize() {
  if (!_needNormalize) { if (ensureColors()) save(); return; }
  var catSet = new Set(db.cats); var sourceSet = new Set(db.sources); var dirty = false;
  db.items.forEach(function (i) {
    if (i.type !== IMG_TYPE && !i.text && Array.isArray(i.images) && i.images.length > 0) { i.type = IMG_TYPE; dirty = true; }
    if (i.type !== UNCAT && i.type !== IMG_TYPE && !catSet.has(i.type)) { catSet.add(i.type); dirty = true; }
    if (i.source && !sourceSet.has(i.source)) { db.sources.push(i.source); sourceSet.add(i.source); dirty = true; }
    if (!Array.isArray(i.tags)) { i.tags = []; dirty = true; } else { var t = Array.from(new Set(i.tags.map(function (x) { return String(x).trim(); }).filter(Boolean))); if (t.length !== i.tags.length) { i.tags = t; dirty = true; } }
    var ni = normalizeImages(i.images); if (JSON.stringify(ni) !== JSON.stringify(i.images || [])) { i.images = ni; dirty = true; }
  });
  if (dirty) db.cats = Array.from(catSet);
  if (db.fixedSource && db.sources.indexOf(db.fixedSource) < 0) { db.fixedSource = ''; dirty = true; }
  if (ensureColors()) dirty = true;
  _needNormalize = false; if (dirty) save();
}

function cleanupSources() { var activeSources = new Set(db.items.map(function (i) { return i.source; }).filter(Boolean)); var changed = false; db.sources = db.sources.filter(function (s) { if (!activeSources.has(s)) { if (db.fixedSource === s) db.fixedSource = ''; changed = true; return false; } return true; }); if (currentSource !== ALL_SOURCES && db.sources.indexOf(currentSource) < 0) { currentSource = ALL_SOURCES; changed = true; } if (changed) save(); }
function catColor(name) { if (name === UNCAT) return { bg: '#f1f5f9', fg: '#64748b' }; if (name === IMG_TYPE) return { bg: '#f5f3ff', fg: '#a855f7' }; var idx = db.colors[name]; if (typeof idx !== 'number') return PALETTE[0]; if (idx < PALETTE.length) return PALETTE[idx]; var hue = Math.round((idx * 137.508) % 360); return { bg: 'hsl(' + hue + ', 70%, 95%)', fg: 'hsl(' + hue + ', 60%, 40%)' }; }
function collectTags() { var counts = {}; db.items.forEach(function (i) { var tSet = new Set(i.tags || []); (i.images || []).forEach(function (im) { (im.tags || []).forEach(function (t) { tSet.add(t); }); }); tSet.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); }); return counts; }

// ★ 新增：侧边栏统计缓存（极大优化性能）
var _statsCache = { rev: -1, catCounts: {}, sourceCounts: {}, tagCounts: {} };
function getSidebarStats() {
  if (db.settings.enableStatsCache === false) {
    // 如果关闭了缓存，则实时计算
    var c = {}, s = {}, t = {};
    db.items.forEach(function (i) { c[i.type] = (c[i.type] || 0) + 1; if (i.source) s[i.source] = (s[i.source] || 0) + 1; var tSet = new Set(i.tags || []); (i.images || []).forEach(function (im) { (im.tags || []).forEach(function (tg) { tSet.add(tg); }); }); tSet.forEach(function (tg) { t[tg] = (t[tg] || 0) + 1; }); });
    return { catCounts: c, sourceCounts: s, tagCounts: t };
  }
  if (_statsCache.rev === db._rev) return _statsCache;
  var cc = {}, sc = {}, tc = {};
  db.items.forEach(function (i) {
    cc[i.type] = (cc[i.type] || 0) + 1;
    if (i.source) sc[i.source] = (sc[i.source] || 0) + 1;
    var tSet = new Set(i.tags || []);
    (i.images || []).forEach(function (im) { (im.tags || []).forEach(function (tg) { tSet.add(tg); }); });
    tSet.forEach(function (tg) { tc[tg] = (tc[tg] || 0) + 1; });
  });
  _statsCache = { rev: db._rev, catCounts: cc, sourceCounts: sc, tagCounts: tc };
  return _statsCache;
}

function getFilteredItems() {
  var tagKey = currentTags && currentTags.size > 0 ? Array.from(currentTags).sort().join(',') : '';
  var cacheKey = currentType + '|' + currentSource + '|' + tagKey + '|' + keyword + '|' + (db.settings.tagFilterLogic || 'and') + '|' + (db._rev || 0);
  if (_filterCacheKey === cacheKey && _filterCacheResult) return _filterCacheResult;
  var terms = getSearchTerms(); var tagArr = currentTags ? Array.from(currentTags) : []; var tagLogic = db.settings.tagFilterLogic || 'and';
  var arr = db.items.filter(function (i) {
    if (currentType !== '全部' && i.type !== currentType) return false;
    if (currentSource !== ALL_SOURCES && i.source !== currentSource) return false;
    if (tagArr.length > 0) { var itemTags = new Set(i.tags || []); (i.images || []).forEach(function (im) { (im.tags || []).forEach(function (t) { itemTags.add(t); }); }); if (tagLogic === 'or') { if (!tagArr.some(function (t) { return itemTags.has(t); })) return false; } else { if (!tagArr.every(function (t) { return itemTags.has(t); })) return false; } }
    if (terms.length) { var imgHay = (i.images || []).map(function (im) { return (im.cat || '') + ' ' + (im.tags || []).join(' '); }).join(' '); var hay = ((i.text || '') + ' ' + (i.source || '') + ' ' + i.type + ' ' + (i.tags || []).join(' ') + ' ' + imgHay).toLowerCase(); if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return false; }
    return true;
  }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  _filterCacheKey = cacheKey; _filterCacheResult = arr; return arr;
}

window.save = save; window.loadStore = loadStore; window.applyLoadedData = applyLoadedData; window.normalize = normalize; window.normalizeImages = normalizeImages; window.cleanTrash = cleanTrash; window.cleanupSources = cleanupSources; window.ensureColors = ensureColors; window.catColor = catColor; window.collectTags = collectTags; window.getFilteredItems = getFilteredItems; window.saveImmediate = saveImmediate; window.markNeedNormalize = markNeedNormalize; window.clearFilterCache = clearFilterCache; window.saveSettings = saveSettings; window.getSidebarStats = getSidebarStats;