// js/store.js · 完整文件
// ★ 本次改动：修复节流清理回收站时的重复 save() 问题（增加 noSave 参数控制）

var IDB_NAME = 'material-library-db';
var IDB_STORE = 'kv';
var IDB_META_KEY = 'meta';
var IDB_SHARD_PREFIX = 'shard:';
var IDB_LEGACY_KEY = 'main';
var IDB_SCHEMA = 2;
var _idb = null;

// ★ 本地日期格式化（避免 toISOString 的 UTC 偏移问题）
function _localDateStr(ts) {
  var d = new Date(ts || Date.now());
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
window._localDateStr = _localDateStr;

// ★ 回收站节流清理
var _TRASH_CLEAN_KEY = 'material-library.last-trash-clean';
var _lastTrashClean = 0;
try { _lastTrashClean = Number(localStorage.getItem(_TRASH_CLEAN_KEY) || 0) || 0; } catch (e) {}
var _trashCleanInProgress = false;
function _maybeCleanTrash() {
  if (_trashCleanInProgress) return;
  var now = Date.now();
  if (now - _lastTrashClean < 3600000) return;
  _lastTrashClean = now;
  try { localStorage.setItem(_TRASH_CLEAN_KEY, String(now)); } catch (e) {}
  _trashCleanInProgress = true;
  try { 
    // ★ 修复：传入 true，表示内部不直接 save，由外部统一决定
    var beforeLen = db.trash.length;
    cleanTrash(true); 
    if (db.trash.length !== beforeLen) {
      save(); 
    }
  } catch (e) { console.warn('回收站清理失败', e); }
  _trashCleanInProgress = false;
}

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; }
    var req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = function (e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
    };
    req.onsuccess = function (e) { _idb = e.target.result; resolve(_idb); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

function _shardKeyOfItem(item) {
  var d = new Date(item.createdAt || Date.now());
  var useUTC = db.settings.timezoneMode === 'utc';
  var y = useUTC ? d.getUTCFullYear() : d.getFullYear();
  var m = String((useUTC ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
  var day = String(useUTC ? d.getUTCDate() : d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function _groupItemsByShard(items) {
  var groups = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it || !it.id) continue;
    var k = _shardKeyOfItem(it);
    if (!groups[k]) groups[k] = [];
    groups[k].push(it);
  }
  return groups;
}

var _dirtyShards = new Set();
var _metaDirty = false;
function markItemDirty(item) { if (!item) return; _dirtyShards.add(_shardKeyOfItem(item)); }
function markItemsDirty(items) { if (!items) return; for (var i = 0; i < items.length; i++) markItemDirty(items[i]); }
function markShardDirty(key) { if (typeof key === 'string' && key) _dirtyShards.add(key); }
function markAllShardsDirty() {
  var groups = _groupItemsByShard(db.items);
  Object.keys(groups).forEach(function (k) { _dirtyShards.add(k); });
  _metaDirty = true;
}

function _idbTx(mode) { return openIDB().then(function (d) { return d.transaction(IDB_STORE, mode); }); }
function idbGet(key) {
  return _idbTx('readonly').then(function (tx) {
    return new Promise(function (resolve, reject) {
      var req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}
function idbPutMany(entries) {
  if (!entries.length) return Promise.resolve();
  return _idbTx('readwrite').then(function (tx) {
    return new Promise(function (resolve, reject) {
      var store = tx.objectStore(IDB_STORE);
      entries.forEach(function (e) { store.put(e.value, e.key); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}
function idbDeleteMany(keys) {
  if (!keys.length) return Promise.resolve();
  return _idbTx('readwrite').then(function (tx) {
    return new Promise(function (resolve, reject) {
      var store = tx.objectStore(IDB_STORE);
      keys.forEach(function (k) { store.delete(k); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function _buildMeta() {
  return {
    _schema: IDB_SCHEMA, _rev: db._rev,
    cats: db.cats, colors: db.colors, sources: db.sources,
    fixedSource: db.fixedSource, fixedTags: db.fixedTags,
    imageCategories: db.imageCategories, settings: db.settings, tagColors: db.tagColors,
    trash: db.trash, _shardSnapshots: db._shardSnapshots,
    _trashSnapshot: db._trashSnapshot, _metaSnapshot: db._metaSnapshot,
    _loadedShardKeys: db._loadedShardKeys, _allShardKeys: db._allShardKeys,
    catVersion: db.catVersion || 0
  };
}
function _applyMeta(m) {
  if (!m) return;
  if (Array.isArray(m.cats)) db.cats = m.cats.filter(function (c) { return typeof c === 'string' && c.trim() && c !== UNCAT && c !== IMG_TYPE; });
  if (m.colors && typeof m.colors === 'object') db.colors = m.colors;
  if (Array.isArray(m.sources)) db.sources = m.sources.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (typeof m.fixedSource === 'string') db.fixedSource = m.fixedSource;
  if (Array.isArray(m.fixedTags)) db.fixedTags = m.fixedTags.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (Array.isArray(m.imageCategories) && m.imageCategories.length) db.imageCategories = m.imageCategories.filter(function (s) { return typeof s === 'string' && s.trim(); });
  if (Array.isArray(m.trash)) db.trash = m.trash.filter(function (i) { return i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)); });
  if (m.settings && typeof m.settings === 'object') {
    var merged = {}; var k;
    for (k in db.settings) if (db.settings.hasOwnProperty(k)) merged[k] = db.settings[k];
    for (k in m.settings) if (m.settings.hasOwnProperty(k)) merged[k] = m.settings[k];
    merged.statsDims = {};
    for (k in db.settings.statsDims) if (db.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = db.settings.statsDims[k];
    if (m.settings.statsDims) for (k in m.settings.statsDims) if (m.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = m.settings.statsDims[k];
    db.settings = merged;
  }
  if (m.tagColors && typeof m.tagColors === 'object') db.tagColors = m.tagColors;
  if (m._shardSnapshots && typeof m._shardSnapshots === 'object') db._shardSnapshots = m._shardSnapshots;
  if (typeof m._trashSnapshot === 'string') db._trashSnapshot = m._trashSnapshot;
  if (typeof m._metaSnapshot === 'string') db._metaSnapshot = m._metaSnapshot;
  if (Array.isArray(m._loadedShardKeys)) db._loadedShardKeys = m._loadedShardKeys.slice();
  if (Array.isArray(m._allShardKeys)) db._allShardKeys = m._allShardKeys.slice();
  if (typeof m.catVersion === 'number') db.catVersion = m.catVersion;
  db._rev = Number(m._rev) || 0;
}

var suppressPush = false;
var _filterCacheKey = '';
var _filterCacheResult = [];
var _pendingSave = false;
var _needNormalize = true;
var _idbSaveTimer = null;
var _warningShown = false;

function showStorageWarning(size) {
  if (_warningShown) return;
  _warningShown = true;
  var bar = document.getElementById('storageWarningBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'storageWarningBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:10px 16px;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '<span>⚠️ 数据已达 ' + (size / 1024 / 1024).toFixed(2) + ' MB，请定期导出备份或开启云端推送</span><button style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;" onclick="document.getElementById(\'storageWarningBar\').remove()">知道了</button>';
}

function markNeedNormalize() { _needNormalize = true; }
function clearFilterCache() { _filterCacheKey = ''; }

function save() {
  clearFilterCache();
  db._rev = (db._rev || 0) + 1;
  _metaDirty = true;
  _pendingSave = true;
  if (typeof _recordSnapshotChange === 'function') { try { _recordSnapshotChange(); } catch (e) {} }
  _scheduleSaveIDB();
  if (!suppressPush && typeof scheduleAutoPush === 'function') scheduleAutoPush();
  _maybeCleanTrash();
}

function _scheduleSaveIDB() {
  clearTimeout(_idbSaveTimer);
  _idbSaveTimer = setTimeout(function () { _doSaveIDB(false); }, 800);
}

function _doSaveIDB(forceAll) {
  var dirtyShards = Array.from(_dirtyShards);
  var metaDirty = _metaDirty;
  _dirtyShards.clear();
  _metaDirty = false;
  if (!forceAll && !metaDirty && dirtyShards.length === 0) { _pendingSave = false; return Promise.resolve(); }
  var groups = _groupItemsByShard(db.items);
  var entries = [];
  if (metaDirty || forceAll) entries.push({ key: IDB_META_KEY, value: _buildMeta() });
  if (forceAll) {
    Object.keys(groups).forEach(function (k) { entries.push({ key: IDB_SHARD_PREFIX + k, value: groups[k] }); });
  } else {
    dirtyShards.forEach(function (k) { entries.push({ key: IDB_SHARD_PREFIX + k, value: groups[k] || [] }); });
  }
  return idbPutMany(entries).then(function () {
    _pendingSave = false;
    var size = JSON.stringify(entries).length;
    if (size > 4 * 1024 * 1024) showStorageWarning(size);
  }).catch(function (e) {
    dirtyShards.forEach(function (k) { _dirtyShards.add(k); });
    if (metaDirty) _metaDirty = true;
    console.error('分层保存失败', e);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); _pendingSave = false; toast('已降级保存到 localStorage'); }
    catch (e2) { toast('保存失败！请立即导出备份'); }
  });
}

function saveImmediate() {
  clearTimeout(_idbSaveTimer);
  db._rev = (db._rev || 0) + 1;
  clearFilterCache();
  return _doSaveIDB(true);
}

function _flushPendingToLocalStorage() {
  if (!_pendingSave) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
}

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden' && _pendingSave) { _flushPendingToLocalStorage(); _doSaveIDB(false); }
});
window.addEventListener('beforeunload', _flushPendingToLocalStorage);
window.addEventListener('pagehide', _flushPendingToLocalStorage);

async function loadStore() {
  var d = await openIDB();
  var meta = null, allKeys = [];
  await new Promise(function (resolve, reject) {
    var tx = d.transaction(IDB_STORE, 'readonly');
    var store = tx.objectStore(IDB_STORE);
    var metaReq = store.get(IDB_META_KEY);
    var keysReq = store.getAllKeys();
    tx.oncomplete = function () { meta = metaReq.result; allKeys = keysReq.result || []; resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
  if (meta && meta._schema === IDB_SCHEMA) {
    var shardKeys = allKeys.filter(function (k) { return typeof k === 'string' && k.indexOf(IDB_SHARD_PREFIX) === 0; });
    var items = [];
    if (shardKeys.length > 0) {
      await new Promise(function (resolve, reject) {
        var tx = d.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var results = new Array(shardKeys.length);
        shardKeys.forEach(function (k, i) { var r = store.get(k); r.onsuccess = function () { results[i] = r.result || []; }; });
        tx.oncomplete = function () { results.forEach(function (arr) { if (Array.isArray(arr)) items = items.concat(arr); }); resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }
    _applyMeta(meta);
    db.items = items.filter(function (i) { return i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)); });
  } else {
    var legacyData = null;
    await new Promise(function (resolve, reject) {
      var tx = d.transaction(IDB_STORE, 'readonly');
      var store = tx.objectStore(IDB_STORE);
      var req = store.get(IDB_LEGACY_KEY);
      tx.oncomplete = function () { legacyData = req.result; resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
    if (legacyData && typeof legacyData === 'object') {
      applyLoadedData(legacyData);
      console.log('🔄 检测到旧格式数据，正在迁移到分层格式…');
      await _doSaveIDB(true);
      await idbDeleteMany([IDB_LEGACY_KEY]).catch(function () {});
      console.log('✅ 迁移完成');
    }
  }
  db.items.forEach(function (i) {
    if (i.source && db.sources.indexOf(i.source) < 0) db.sources.push(i.source);
    if (!i.tags) i.tags = [];
    i.images = normalizeImages(i.images);
  });
  markIndexDirty(); _indexEnsure();
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
  if (o.settings && typeof o.settings === 'object') {
    var merged = {}; var k;
    for (k in db.settings) if (db.settings.hasOwnProperty(k)) merged[k] = db.settings[k];
    for (k in o.settings) if (o.settings.hasOwnProperty(k)) merged[k] = o.settings[k];
    merged.statsDims = {};
    for (k in db.settings.statsDims) if (db.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = db.settings.statsDims[k];
    if (o.settings.statsDims) for (k in o.settings.statsDims) if (o.settings.statsDims.hasOwnProperty(k)) merged.statsDims[k] = o.settings.statsDims[k];
    db.settings = merged;
  }
  if (o.tagColors && typeof o.tagColors === 'object') db.tagColors = o.tagColors;
  if (typeof o.catVersion === 'number') db.catVersion = o.catVersion;
  db._rev = Number(o._rev) || 0;
  db._shardSnapshots = o._shardSnapshots || {};
  db._trashSnapshot = o._trashSnapshot || '';
  db._metaSnapshot = o._metaSnapshot || '';
  if (Array.isArray(o._loadedShardKeys)) db._loadedShardKeys = o._loadedShardKeys.slice();
  if (Array.isArray(o._allShardKeys)) db._allShardKeys = o._allShardKeys.slice();
  markNeedNormalize(); markIndexDirty(); markAllShardsDirty();
}

function normalizeImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function (img) {
    if (typeof img === 'string') return { url: img, path: '', cat: '其他', tags: [], size: 0, origSize: 0 };
    if (img && (img.path || img.url)) {
      return {
        path: img.path || '', url: img.url || '', cat: img.cat || '其他',
        tags: Array.isArray(img.tags) ? Array.from(new Set(img.tags.map(function (t) { return String(t).trim(); }).filter(Boolean))) : [],
        size: Number(img.size) || 0, origSize: Number(img.origSize) || 0
      };
    }
    return null;
  }).filter(Boolean);
}

// ★ 修复：增加 noSave 参数
function cleanTrash(noSave) {
  var now = Date.now();
  var ttl = trashTtlMs();
  var before = db.trash.length;
  db.trash = db.trash.filter(function (i) { return (i.deletedAt || now) > now - ttl; });
  var threshold = Math.max(100, Math.min(100000, Number(db.settings.trashAutoCleanupThreshold) || 1000));
  if (db.trash.length > threshold) {
    db.trash.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
    db.trash = db.trash.slice(0, threshold);
  }
  if (db.trash.length !== before && !noSave) save();
}

function ensureColors() {
  if (!db.colors || typeof db.colors !== 'object') db.colors = {};
  var dirty = false;
  var catSet = new Set(db.cats);
  Object.keys(db.colors).forEach(function (k) { if (!catSet.has(k) || typeof db.colors[k] !== 'number') { delete db.colors[k]; dirty = true; } });
  var used = new Set(Object.values(db.colors));
  db.cats.forEach(function (c) {
    if (!(c in db.colors)) { var i = 0; while (used.has(i)) i++; db.colors[c] = i; used.add(i); dirty = true; }
  });
  return dirty;
}

function normalize() {
  if (!_needNormalize) { if (ensureColors()) save(); return; }
  var catSet = new Set(db.cats);
  var sourceSet = new Set(db.sources);
  var dirty = false;
  db.items.forEach(function (i) {
    if (i.type !== IMG_TYPE && !i.text && Array.isArray(i.images) && i.images.length > 0) { i.type = IMG_TYPE; dirty = true; markItemDirty(i); }
    if (i.type !== UNCAT && i.type !== IMG_TYPE && !catSet.has(i.type)) { catSet.add(i.type); dirty = true; }
    if (i.source && !sourceSet.has(i.source)) { db.sources.push(i.source); sourceSet.add(i.source); dirty = true; }
    if (!Array.isArray(i.tags)) { i.tags = []; dirty = true; markItemDirty(i); }
    else {
      var t = Array.from(new Set(i.tags.map(function (x) { return String(x).trim(); }).filter(Boolean)));
      if (t.length !== i.tags.length) { i.tags = t; dirty = true; markItemDirty(i); }
    }
    var ni = normalizeImages(i.images);
    if (JSON.stringify(ni) !== JSON.stringify(i.images || [])) { i.images = ni; dirty = true; markItemDirty(i); }
  });
  if (dirty) db.cats = Array.from(catSet);
  if (db.fixedSource && db.sources.indexOf(db.fixedSource) < 0) { db.fixedSource = ''; dirty = true; }
  if (ensureColors()) dirty = true;
  _needNormalize = false;
  if (dirty) { markIndexDirty(); save(); }
}

function cleanupSources() {
  var activeSources = new Set(db.items.map(function (i) { return i.source; }).filter(Boolean));
  var changed = false;
  db.sources = db.sources.filter(function (s) {
    if (!activeSources.has(s)) { if (db.fixedSource === s) db.fixedSource = ''; changed = true; return false; }
    return true;
  });
  if (currentSource !== ALL_SOURCES && db.sources.indexOf(currentSource) < 0) { currentSource = ALL_SOURCES; changed = true; }
  if (changed) { markIndexDirty(); save(); }
}

function catColor(name) {
  if (name === UNCAT) return { bg: '#f1f5f9', fg: '#64748b' };
  if (name === IMG_TYPE) return { bg: '#f5f3ff', fg: '#a855f7' };
  var idx = db.colors[name];
  if (typeof idx !== 'number') return PALETTE[0];
  if (idx < PALETTE.length) return PALETTE[idx];
  var hue = Math.round((idx * 137.508) % 360);
  return { bg: 'hsl(' + hue + ', 70%, 95%)', fg: 'hsl(' + hue + ', 60%, 40%)' };
}

function collectTags() {
  var counts = {};
  db.items.forEach(function (i) {
    var tSet = new Set(i.tags || []);
    (i.images || []).forEach(function (im) { (im.tags || []).forEach(function (t) { tSet.add(t); }); });
    tSet.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });
  return counts;
}

var _index = { cat: new Map(), source: new Map(), tag: new Map() };
var _itemById = new Map();
var _indexDirty = true;

function _indexClear() { _index.cat.clear(); _index.source.clear(); _index.tag.clear(); _itemById.clear(); }
function _indexAddToMaps(item) {
  var id = item.id; if (!id) return;
  var cat = item.type || UNCAT;
  var catSet = _index.cat.get(cat); if (!catSet) { catSet = new Set(); _index.cat.set(cat, catSet); } catSet.add(id);
  if (item.source) { var srcSet = _index.source.get(item.source); if (!srcSet) { srcSet = new Set(); _index.source.set(item.source, srcSet); } srcSet.add(id); }
  var tags = new Set(item.tags || []);
  (item.images || []).forEach(function (im) { (im.tags || []).forEach(function (t) { tags.add(t); }); });
  tags.forEach(function (t) { var tSet = _index.tag.get(t); if (!tSet) { tSet = new Set(); _index.tag.set(t, tSet); } tSet.add(id); });
}
function _indexRemoveFromMaps(item) {
  var id = item.id; if (!id) return;
  var cat = item.type || UNCAT;
  var catSet = _index.cat.get(cat); if (catSet) { catSet.delete(id); if (catSet.size === 0) _index.cat.delete(cat); }
  if (item.source) { var srcSet = _index.source.get(item.source); if (srcSet) { srcSet.delete(id); if (srcSet.size === 0) _index.source.delete(item.source); } }
  var tags = new Set(item.tags || []);
  (item.images || []).forEach(function (im) { (im.tags || []).forEach(function (t) { tags.add(t); }); });
  tags.forEach(function (t) { var tSet = _index.tag.get(t); if (tSet) { tSet.delete(id); if (tSet.size === 0) _index.tag.delete(t); } });
  _itemById.delete(id);
}
function _indexRebuild() { _indexClear(); for (var i = 0; i < db.items.length; i++) { var it = db.items[i]; _indexAddToMaps(it); _itemById.set(it.id, it); } _indexDirty = false; }
function _indexEnsure() { if (_indexDirty) _indexRebuild(); }
function markIndexDirty() { _indexDirty = true; }
function rebuildIndex() { _indexRebuild(); clearFilterCache(); toast('索引已重建'); }
function _indexAddItem(item) { if (!item || !item.id) return; if (_indexDirty) return; _indexAddToMaps(item); _itemById.set(item.id, item); }
function _indexRemoveItem(item) { if (!item || !item.id) return; if (_indexDirty) return; _indexRemoveFromMaps(item); }
function _indexUpdateItem(oldItem, newItem) {
  if (_indexDirty) return;
  if (oldItem && oldItem.id) _indexRemoveFromMaps(oldItem);
  if (newItem && newItem.id) { _indexAddToMaps(newItem); _itemById.set(newItem.id, newItem); }
}

var _statsCache = { rev: -1, catCounts: {}, sourceCounts: {}, tagCounts: {} };
function getSidebarStats() {
  if (_statsCache.rev === db._rev && !_indexDirty) return _statsCache;
  _indexEnsure();
  var cc = {}, sc = {}, tc = {};
  _index.cat.forEach(function (set, cat) { cc[cat] = set.size; });
  _index.source.forEach(function (set, src) { sc[src] = set.size; });
  _index.tag.forEach(function (set, tag) { tc[tag] = set.size; });
  _statsCache = { rev: db._rev, catCounts: cc, sourceCounts: sc, tagCounts: tc };
  return _statsCache;
}

function getFilteredItems() {
  var tagKey = currentTags && currentTags.size > 0 ? Array.from(currentTags).sort().join(',') : '';
  var cacheKey = currentType + '|' + currentSource + '|' + tagKey + '|' + keyword + '|' + (db.settings.tagFilterLogic || 'and') + '|' + (db._rev || 0) + '|' + (_indexDirty ? '1' : '0');
  if (_filterCacheKey === cacheKey && _filterCacheResult) return _filterCacheResult;
  _indexEnsure();
  var terms = getSearchTerms();
  var tagArr = currentTags ? Array.from(currentTags) : [];
  var tagLogic = db.settings.tagFilterLogic || 'and';
  var idSet = null;
  if (currentType !== '全部') { idSet = _index.cat.get(currentType) || new Set(); if (idSet.size === 0) { _filterCacheKey = cacheKey; _filterCacheResult = []; return []; } }
  if (currentSource !== ALL_SOURCES) {
    var srcSet = _index.source.get(currentSource) || new Set();
    if (srcSet.size === 0) { _filterCacheKey = cacheKey; _filterCacheResult = []; return []; }
    if (idSet) { var n1 = new Set(); idSet.forEach(function (x) { if (srcSet.has(x)) n1.add(x); }); idSet = n1; }
    else idSet = srcSet;
    if (idSet.size === 0) { _filterCacheKey = cacheKey; _filterCacheResult = []; return []; }
  }
  if (tagArr.length > 0) {
    var tagSets = tagArr.map(function (t) { return _index.tag.get(t) || null; });
    if (tagLogic === 'and') {
      if (tagSets.some(function (s) { return !s; })) { _filterCacheKey = cacheKey; _filterCacheResult = []; return []; }
      if (idSet) { var n2 = new Set(); idSet.forEach(function (x) { if (tagSets.every(function (s) { return s.has(x); })) n2.add(x); }); idSet = n2; }
      else { var base = tagSets[0], n3 = new Set(); base.forEach(function (x) { if (tagSets.every(function (s) { return s.has(x); })) n3.add(x); }); idSet = n3; }
    } else {
      var union = new Set();
      tagSets.forEach(function (s) { if (s) s.forEach(function (x) { union.add(x); }); });
      if (idSet) { var n4 = new Set(); idSet.forEach(function (x) { if (union.has(x)) n4.add(x); }); idSet = n4; }
      else idSet = union;
    }
    if (idSet.size === 0) { _filterCacheKey = cacheKey; _filterCacheResult = []; return []; }
  }
  var arr;
  if (idSet) { arr = []; idSet.forEach(function (id) { var it = _itemById.get(id); if (it) arr.push(it); }); }
  else arr = db.items.slice();
  if (terms.length) {
    arr = arr.filter(function (i) {
      var imgHay = (i.images || []).map(function (im) { return (im.cat || '') + ' ' + (im.tags || []).join(' '); }).join(' ');
      var hay = ((i.text || '') + ' ' + (i.source || '') + ' ' + i.type + ' ' + (i.tags || []).join(' ') + ' ' + imgHay).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) >= 0; });
    });
  }
  arr.sort(function (a, b) { return b.createdAt - a.createdAt; });
  _filterCacheKey = cacheKey;
  _filterCacheResult = arr;
  return arr;
}

window.save = save; window.loadStore = loadStore; window.applyLoadedData = applyLoadedData;
window.normalize = normalize; window.normalizeImages = normalizeImages;
window.cleanTrash = cleanTrash; window.cleanupSources = cleanupSources;
window.ensureColors = ensureColors; window.catColor = catColor; window.collectTags = collectTags;
window.getFilteredItems = getFilteredItems; window.saveImmediate = saveImmediate;
window.markNeedNormalize = markNeedNormalize; window.clearFilterCache = clearFilterCache;
window.saveSettings = saveSettings; window.getSidebarStats = getSidebarStats;
window.markItemDirty = markItemDirty; window.markItemsDirty = markItemsDirty;
window.markShardDirty = markShardDirty; window.markAllShardsDirty = markAllShardsDirty;
window._shardKeyOfItem = _shardKeyOfItem;
window.markIndexDirty = markIndexDirty; window.rebuildIndex = rebuildIndex;
window._indexAddItem = _indexAddItem; window._indexRemoveItem = _indexRemoveItem; window._indexUpdateItem = _indexUpdateItem;
window.__index = _index; window.__itemById = _itemById; window.__indexEnsure = _indexEnsure; window.__dirtyShards = _dirtyShards;
window._maybeCleanTrash = _maybeCleanTrash;