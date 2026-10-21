// js/github.js
var STORE_VERSION = 4; var GH_INDEX_PATH = 'index.json'; var GH_TRASH_PATH = 'trash.json'; var GH_LOG_PATH = 'push-log.json'; var GH_DEVICES_PATH = 'devices.json'; var SHARD_PREFIX = 'data-'; var SHARD_MAX_BYTES = 800 * 1024; var FETCH_CONCURRENCY = 8; var PUSH_BATCH_DELAY = 500;
var _shardSnapshots = {}; var _trashSnapshot = ''; var _metaSnapshot = ''; var _pushInFlight = false; var _pushQueued = false;

function loadGH() { var cfg = {}; try { cfg = JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { cfg = {}; } return { token: cfg.token || '', owner: cfg.owner || '', repo: cfg.repo || '', branch: cfg.branch || 'main', dataPath: cfg.dataPath || 'material-library.json', siteBase: cfg.siteBase || '', autoSync: !!cfg.autoSync, autoPull: cfg.autoPull !== false, autoPushDelay: Math.max(1, Math.min(60, Number(cfg.autoPushDelay) || 2)), imgOwner: cfg.imgOwner || '', imgRepo: cfg.imgRepo || '', imgBranch: cfg.imgBranch || '', imgPath: cfg.imgPath || 'images', imgSite: cfg.imgSite || '', imgToken: cfg.imgToken || '', isPrivate: !!cfg.isPrivate, dataDir: cfg.dataDir || (db.settings.dataDir || 'material-library'), shardSubdir: cfg.shardSubdir || (db.settings.shardSubdir || 'data') }; }
function saveGH(cfg) { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); }
function ghReady(cfg) { return !!(cfg.token && cfg.owner && cfg.repo); }
function ghRepoConfig(kind) { var cfg = loadGH(); if (kind === 'img') { var useIndependent = !!(cfg.imgOwner && cfg.imgRepo); return { token: cfg.imgToken || cfg.token, owner: useIndependent ? cfg.imgOwner : cfg.owner, repo: useIndependent ? cfg.imgRepo : cfg.repo, branch: cfg.imgBranch || cfg.branch || 'main', path: cfg.imgPath || 'images', siteBase: cfg.imgSite || '' }; } return { token: cfg.token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main', path: '', siteBase: cfg.siteBase || '' }; }

function ghApiUrl(rc, path) { var p = String(path).split('/').map(encodeURIComponent).join('/'); return 'https://api.github.com/repos/' + encodeURIComponent(rc.owner) + '/' + encodeURIComponent(rc.repo) + '/contents/' + p; }
function ghGetRaw(rc, path) { if (!rc.owner || !rc.repo) return Promise.reject(new Error('未配置 GitHub')); var headers = { Accept: 'application/vnd.github+json' }; if (rc.token) headers.Authorization = 'Bearer ' + rc.token; return fetch(ghApiUrl(rc, path) + '?ref=' + encodeURIComponent(rc.branch) + '&t=' + Date.now(), { headers: headers }).then(function (res) { if (res.status === 404) return null; if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); }); return res.json(); }); }
function ghPutRaw(rc, path, base64, sha, message) { if (!rc.token || !rc.owner || !rc.repo) return Promise.reject(new Error('未配置 GitHub 或缺少 Token')); var body = { message: message || ('update ' + path), content: base64, branch: rc.branch }; if (sha) body.sha = sha; return fetch(ghApiUrl(rc, path), { method: 'PUT', headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 160)); }); return res.json(); }); }
function ghDeleteRaw(rc, path, sha, message) { return fetch(ghApiUrl(rc, path), { method: 'DELETE', headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message || ('delete ' + path), sha: sha, branch: rc.branch }) }).then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 160)); }); return res.json(); }); }

function getShardKey(item) { var d = new Date(item.createdAt || Date.now()); var useUTC = db.settings.timezoneMode === 'utc'; var y = useUTC ? d.getUTCFullYear() : d.getFullYear(); var m = String((useUTC ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0'); var day = String(useUTC ? d.getUTCDate() : d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + day; }
function getYearFromKey(key) { return key.split('-')[0]; }
function groupItemsByShard(items) { var groups = {}; items.forEach(function (item) { var k = getShardKey(item); if (!groups[k]) groups[k] = []; groups[k].push(item); }); return groups; }

function _pathForIndex(cfg) { return cfg.dataDir + '/' + GH_INDEX_PATH; }
function _pathForYearIndex(cfg, year) { return cfg.dataDir + '/index-' + year + '.json'; }
function _pathForShard(cfg, key, part) { var name = SHARD_PREFIX + key + (part && part > 1 ? '-' + part : '') + '.json'; return cfg.dataDir + '/' + cfg.shardSubdir + '/' + name; }
function _pathForTrash(cfg) { return cfg.dataDir + '/' + GH_TRASH_PATH; }
function _pathForLog(cfg) { return cfg.dataDir + '/' + GH_LOG_PATH; }
function _pathForDevices(cfg) { return cfg.dataDir + '/' + GH_DEVICES_PATH; }
function loadIndex(rc) { var cfg = loadGH(); return ghGetRaw(rc, _pathForIndex(cfg)).then(function (file) { if (!file) return null; var idx; try { idx = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); } catch (e) { throw new Error('index.json 格式错误'); } return { data: idx, sha: file.sha }; }); }
function loadYearIndex(rc, year) { var cfg = loadGH(); return ghGetRaw(rc, _pathForYearIndex(cfg, year)).then(function (file) { if (!file) return null; try { return JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); } catch (e) { return null; } }); }

function buildImageBaseUrl(rc) { if (rc.siteBase) return rc.siteBase.replace(/\/$/, ''); return 'https://raw.githubusercontent.com/' + rc.owner + '/' + rc.repo + '/' + rc.branch; }
function imageUrlFromPath(filepath) { var rc = ghRepoConfig('img'); return encodeURI(buildImageBaseUrl(rc) + '/' + rc.path + '/' + filepath); }
function imageSrc(im) { if (!im) return ''; var url = ''; if (im.path) url = imageUrlFromPath(im.path); else url = im.url || ''; if (!/^(https?:|data:image\/|blob:)/i.test(url)) return ''; return url; }
var imgBlobCache = new Map(); var IMG_BLOB_CACHE_MAX = 300;
function fetchImageBlobUrl(relPath) { if (imgBlobCache.has(relPath)) return Promise.resolve(imgBlobCache.get(relPath)); var rc = ghRepoConfig('img'); if (!rc.token || !rc.owner || !rc.repo) return Promise.reject(new Error('未配置')); var full = (rc.path + '/' + relPath).split('/').map(encodeURIComponent).join('/'); var url = 'https://api.github.com/repos/' + rc.owner + '/' + rc.repo + '/contents/' + full + '?ref=' + encodeURIComponent(rc.branch); return fetch(url, { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github.raw' } }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.blob(); }).then(function (blob) { var objUrl = URL.createObjectURL(blob); if (imgBlobCache.size >= IMG_BLOB_CACHE_MAX) { var firstKey = imgBlobCache.keys().next().value; try { URL.revokeObjectURL(imgBlobCache.get(firstKey)); } catch (e) {} imgBlobCache.delete(firstKey); } imgBlobCache.set(relPath, objUrl); return objUrl; }); }

function ghSetStatus(msg) { var el = $('ghStatus'); if (el) el.textContent = msg || ''; }
function ghImgSetStatus(msg) { var el = $('ghImgStatus'); if (el) el.textContent = msg || ''; }
function _setSnap(key, json) { _shardSnapshots[key] = json; db._shardSnapshots = db._shardSnapshots || {}; db._shardSnapshots[key] = json; }
function _delSnap(key) { delete _shardSnapshots[key]; if (db._shardSnapshots) delete db._shardSnapshots[key]; }
function _setTrash(json) { _trashSnapshot = json; db._trashSnapshot = json; }
function _setMeta(json) { _metaSnapshot = json; db._metaSnapshot = json; }

function appendLog(entry) { if (!db.settings.enableLog) return; try { var logs = JSON.parse(localStorage.getItem('material-library.push-log') || '[]'); var dev = getDeviceDisplay(); logs.unshift({ id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), timestamp: Date.now(), deviceId: dev.id, deviceName: dev.name, deviceIcon: dev.icon, deviceType: dev.type, action: entry.action || 'push', status: entry.status || 'success', summary: entry.summary || '', shards: entry.shards || [], itemCount: entry.itemCount || 0, duration: entry.duration || 0, details: entry.details || '' }); var mode = db.settings.logCleanupMode; var maxCount = db.settings.logMaxCount; if (mode === 'count' && logs.length > maxCount) logs = logs.slice(0, maxCount); if (db.settings.logHardLimitEnabled && logs.length > db.settings.logHardLimitCount) logs = logs.slice(0, db.settings.logHardLimitCount); localStorage.setItem('material-library.push-log', JSON.stringify(logs)); } catch (e) {} }
function loadLogs() { try { return JSON.parse(localStorage.getItem('material-library.push-log') || '[]'); } catch (e) { return []; } }
function registerDevice(pushOrPull) { try { var dev = getOrCreateDevice(); var now = Date.now(); var devices = JSON.parse(localStorage.getItem('material-library.devices-cache') || '{}'); if (!devices[dev.id]) devices[dev.id] = { id: dev.id, name: dev.name, icon: dev.icon, type: dev.type, createdAt: dev.createdAt || now, pushCount: 0, pullCount: 0 }; if (pushOrPull === 'push') { devices[dev.id].lastPushAt = now; devices[dev.id].pushCount = (devices[dev.id].pushCount || 0) + 1; } else if (pushOrPull === 'pull') { devices[dev.id].lastPullAt = now; devices[dev.id].pullCount = (devices[dev.id].pullCount || 0) + 1; } devices[dev.id].lastSeenAt = now; localStorage.setItem('material-library.devices-cache', JSON.stringify(devices)); } catch (e) {} }
function loadDevices() { try { return JSON.parse(localStorage.getItem('material-library.devices-cache') || '{}'); } catch (e) { return {}; } }

async function ghPush(silent, force) {
  silent = !!silent; force = !!force; var cfg = loadGH(); if (!ghReady(cfg)) { if (!silent) toast('请先配置 GitHub'); return false; }
  if (_pushInFlight) { _pushQueued = true; return false; } _pushInFlight = true;
  var startTime = Date.now(); var rc = ghRepoConfig('data'); var groups = groupItemsByShard(db.items); var currentKeys = Object.keys(groups).sort();
  if (!silent) ghSetStatus('推送中…');
  var oversized = []; currentKeys.forEach(function (k) { var size = JSON.stringify(groups[k]).length; if (size > SHARD_MAX_BYTES) oversized.push({ key: k, size: size }); }); if (oversized.length > 0) console.warn('[ghPush] 超限分片:', oversized);
  var toPush = []; currentKeys.forEach(function (k) { var json = JSON.stringify(groups[k]); if (force || _shardSnapshots[k] !== json) toPush.push(k); });
  var toDelete = Object.keys(_shardSnapshots).filter(function (k) { return currentKeys.indexOf(k) < 0; });
  var pushedCount = 0; var yearIndexDirty = {};
  try {
    for (var i = 0; i < toPush.length; i++) {
      var k = toPush[i]; if (!silent) ghSetStatus('推送中… ' + (i + 1) + '/' + toPush.length + ' 分片');
      var shardData = { _rev: 1, date: k, items: groups[k] }; var content = JSON.stringify(shardData, null, 2); var path = _pathForShard(cfg, k, 1);
      var existing = await ghGetRaw(rc, path); var b64 = utf8ToBase64(content); await ghPutRaw(rc, path, b64, existing ? existing.sha : null, 'sync ' + path);
      _setSnap(k, JSON.stringify(groups[k])); pushedCount++; yearIndexDirty[getYearFromKey(k)] = true;
      if ((i + 1) % 30 === 0 && i + 1 < toPush.length) await new Promise(function (r) { setTimeout(r, PUSH_BATCH_DELAY); });
    }
    for (var j = 0; j < toDelete.length; j++) { var dk = toDelete[j]; var dpath = _pathForShard(cfg, dk, 1); try { var dexisting = await ghGetRaw(rc, dpath); if (dexisting) await ghDeleteRaw(rc, dpath, dexisting.sha, 'delete ' + dpath); _delSnap(dk); } catch (e) {} }
    var trashJson = JSON.stringify(db.trash); if (force || _trashSnapshot !== trashJson) { var tContent = JSON.stringify({ trash: db.trash, updatedAt: new Date().toISOString() }, null, 2); var tB64 = utf8ToBase64(tContent); var tExisting = await ghGetRaw(rc, _pathForTrash(cfg)); await ghPutRaw(rc, _pathForTrash(cfg), tB64, tExisting ? tExisting.sha : null, 'sync trash'); _setTrash(trashJson); }
    var yearsToUpdate = Object.keys(yearIndexDirty); var currentYears = {}; currentKeys.forEach(function (ck) { currentYears[getYearFromKey(ck)] = true; }); Object.keys(currentYears).forEach(function (y) { if (yearsToUpdate.indexOf(y) < 0) yearsToUpdate.push(y); });
    for (var yi = 0; yi < yearsToUpdate.length; yi++) {
      var year = yearsToUpdate[yi]; var yearShards = {}; currentKeys.forEach(function (ck) { if (getYearFromKey(ck) === year) yearShards[ck] = { count: groups[ck].length, size: JSON.stringify(groups[ck]).length }; });
      if (Object.keys(yearShards).length === 0) { var ypath = _pathForYearIndex(cfg, year); try { var yexisting = await ghGetRaw(rc, ypath); if (yexisting) await ghDeleteRaw(rc, ypath, yexisting.sha, 'delete ' + ypath); } catch (e) {} }
      else { var yContent = JSON.stringify({ year: year, shards: yearShards }, null, 2); var yB64 = utf8ToBase64(yContent); var ypath2 = _pathForYearIndex(cfg, year); try { var yexisting2 = await ghGetRaw(rc, ypath2); await ghPutRaw(rc, ypath2, yB64, yexisting2 ? yexisting2.sha : null, 'sync index-' + year); } catch (e) {} }
    }
    var yearSummary = {}; Object.keys(currentYears).forEach(function (cy) { var count = 0, shardCount = 0; currentKeys.forEach(function (ck) { if (getYearFromKey(ck) === cy) { count += groups[ck].length; shardCount++; } }); yearSummary[cy] = { count: count, shardCount: shardCount }; });
    var meta = { cats: db.cats, colors: db.colors, sources: db.sources, fixedSource: db.fixedSource, fixedTags: db.fixedTags, imageCategories: db.imageCategories, settings: db.settings, tagColors: db.tagColors || {} };
    var metaSig = JSON.stringify(meta) + JSON.stringify(yearSummary);
    if (force || _metaSnapshot !== metaSig) {
      var oldIndex = await loadIndex(rc); var oldRev = oldIndex && oldIndex.data ? (oldIndex.data._rev || 0) : 0;
      var newIndex = { _rev: oldRev + 1, version: STORE_VERSION, updatedAt: new Date().toISOString(), indexShards: yearSummary, meta: meta };
      var iContent = JSON.stringify(newIndex, null, 2); var iB64 = utf8ToBase64(iContent); var ipath = _pathForIndex(cfg);
      var iExisting = await ghGetRaw(rc, ipath); await ghPutRaw(rc, ipath, iB64, iExisting ? iExisting.sha : null, 'sync index'); _setMeta(metaSig);
    }
    registerDevice('push'); appendLog({ action: 'push', status: 'success', summary: pushedCount > 0 ? ('推送 ' + pushedCount + ' 个分片') : '无变化', shards: toPush, itemCount: db.items.length, duration: Date.now() - startTime });
    if (!silent) { toast(pushedCount > 0 ? ('已同步 ' + pushedCount + ' 个分片') : '无变化'); ghSetStatus('推送成功'); } return true;
  } catch (err) {
    console.error('[ghPush] 失败', err); appendLog({ action: 'push', status: 'error', summary: '推送失败：' + err.message });
    if (err.message && err.message.indexOf('409') >= 0) { if (force) { _pushInFlight = false; await new Promise(function (r) { setTimeout(r, 1000); }); return ghPush(silent, false); } if (silent) return false; if (confirm('⚠️ 版本冲突！是否强制覆盖？')) { _pushInFlight = false; return ghPush(false, true); } return false; }
    if (!silent) toast('推送失败：' + err.message); ghSetStatus('推送失败：' + err.message); return false;
  } finally { _pushInFlight = false; if (_pushQueued) { _pushQueued = false; setTimeout(function () { scheduleAutoPush(); }, 1000); } }
}

function ghPull(silent, pullMore) {
  silent = !!silent; pullMore = !!pullMore;
  var cfg = loadGH(); if (!cfg.owner || !cfg.repo) { if (!silent) toast('请先配置 GitHub 仓库'); return Promise.resolve(false); }
  var startTime = Date.now(); var rc = ghRepoConfig('data');
  if (!silent) ghSetStatus(pullMore ? '加载历史中…' : '拉取中…');
  return loadIndex(rc).then(function (indexResult) {
    if (!indexResult) { return migrateFromLegacy(rc, silent).then(function (ok) { if (ok) return true; throw new Error('远程数据不存在'); }); }
    var index = indexResult.data; var yearSummary = index.indexShards || {}; var meta = index.meta || {};
    var totalSize = 0; Object.keys(yearSummary).forEach(function (y) { totalSize += (yearSummary[y].count || 0) * 500; });
    var loadMode = db.settings.loadMode; var thresholdMB = db.settings.smartThresholdMB || 5; var shouldLoadAll = false; var daysToLoad = 0;
    if (loadMode === 'smart') { if ((totalSize / 1024 / 1024) <= thresholdMB) shouldLoadAll = true; else daysToLoad = 90; } 
    else { var range = db.settings.manualRangeDays; if (range === 'all' || range === 0) shouldLoadAll = true; else daysToLoad = range || 90; }
    var years = Object.keys(yearSummary);
    return Promise.all(years.map(function (y) { return loadYearIndex(rc, y); })).then(function (yearIndexes) {
      var allShards = {}; yearIndexes.forEach(function (yi) { if (yi && yi.shards) Object.keys(yi.shards).forEach(function (k) { allShards[k] = yi.shards[k]; }); });
      var shardKeys = Object.keys(allShards).sort(); var toLoad = [];
      
      if (pullMore) {
        // 如果是加载更多，基于已加载的最后日期向前推
        var oldestLoaded = db._loadedShardKeys && db._loadedShardKeys.length > 0 ? db._loadedShardKeys[db._loadedShardKeys.length - 1] : '9999-12-31';
        var unloaded = shardKeys.filter(function (k) { return db._loadedShardKeys.indexOf(k) < 0 && k < oldestLoaded; });
        var batchSize = db.settings.lazyLoadBatchSize || 30;
        toLoad = unloaded.slice(-batchSize);
        if (!toLoad.length) { if (!silent) toast('没有更早的数据了'); return false; }
      } else {
        if (shouldLoadAll) { toLoad = shardKeys; } 
        else {
          var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - daysToLoad);
          var cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
          toLoad = shardKeys.filter(function (k) { return k >= cutoffStr; });
        }
      }

      if (pullMore) {
        // 增量合并逻辑
        var newLoaded = (db._loadedShardKeys || []).concat(toLoad).sort();
        db._loadedShardKeys = newLoaded;
        db._allShardKeys = shardKeys;
      } else {
        db._allShardKeys = shardKeys; db._loadedShardKeys = toLoad;
      }

      return fetchShardsBatch(rc, toLoad).then(function (dataMap) {
        var newItems = []; var newSnapshots = {};
        toLoad.forEach(function (k) { if (dataMap[k] && dataMap[k].items) { newItems = newItems.concat(dataMap[k].items); newSnapshots[k] = JSON.stringify(dataMap[k].items); } });
        
        // 合并数据
        if (pullMore) {
          var currentIds = new Set(db.items.map(function(i){ return i.id; }));
          newItems.forEach(function(i) { if(!currentIds.has(i.id)) db.items.push(i); });
        } else {
          db.items = newItems;
        }

        if (!pullMore) {
          return ghGetRaw(rc, _pathForTrash(cfg)).catch(function () { return null; }).then(function (trashFile) {
            var trashItems = []; var trashSnap = '';
            if (trashFile) { try { var td = JSON.parse(base64ToUtf8(trashFile.content.replace(/\n/g, ''))); trashItems = td.trash || []; trashSnap = JSON.stringify(trashItems); } catch (e) {} }
            return ghGetRaw(rc, _pathForDevices(cfg)).catch(function () { return null; }).then(function (devFile) {
              if (devFile) { try { var dd = JSON.parse(base64ToUtf8(devFile.content.replace(/\n/g, ''))); if (dd.devices) localStorage.setItem('material-library.devices-cache', JSON.stringify(dd.devices)); } catch (e) {} }
              return ghGetRaw(rc, _pathForLog(cfg)).catch(function () { return null; }).then(function (logFile) {
                if (logFile && db.settings.logSyncCloud) { try { var ld = JSON.parse(base64ToUtf8(logFile.content.replace(/\n/g, ''))); if (Array.isArray(ld.logs)) localStorage.setItem('material-library.push-log', JSON.stringify(ld.logs)); } catch (e) {} }
                
                suppressPush = true; applyLoadedData({ items: dedupeItems(db.items), cats: meta.cats || DEFAULT_CATS, colors: meta.colors || {}, sources: meta.sources || [], fixedSource: meta.fixedSource || '', fixedTags: meta.fixedTags || [], imageCategories: meta.imageCategories || DEFAULT_IMG_CATS, settings: meta.settings || {}, tagColors: meta.tagColors || {}, trash: trashItems, _rev: index._rev || 0 });
                _shardSnapshots = newSnapshots; db._shardSnapshots = {}; Object.keys(newSnapshots).forEach(function (k) { db._shardSnapshots[k] = newSnapshots[k]; });
                _trashSnapshot = trashSnap; db._trashSnapshot = trashSnap;
                _metaSnapshot = JSON.stringify(meta) + JSON.stringify(yearSummary); db._metaSnapshot = _metaSnapshot;
                db.items.forEach(function (i) { i.images = normalizeImages(i.images); }); saveSettings(); markNeedNormalize(); normalize();
                return saveImmediate().then(function () { suppressPush = false; registerDevice('pull'); render(); updateTinyUsageUI(); applySettingsToUI(); if (!silent) toast('已拉取 ' + db.items.length + ' 条素材'); ghSetStatus('拉取成功'); return true; });
              });
            });
          });
        } else {
          // pullMore 成功的逻辑
          toLoad.forEach(function(k){ _setSnap(k, newSnapshots[k]); });
          markNeedNormalize(); normalize();
          return saveImmediate().then(function() {
            render(); if (!silent) toast('已加载更早的 ' + newItems.length + ' 条素材'); return true;
          });
        }
      });
    });
  }).catch(function (err) { suppressPush = false; console.error('[ghPull] 失败', err); if (!silent) toast('拉取失败：' + err.message); ghSetStatus('拉取失败'); return false; });
}

function dedupeItems(items) { var map = {}; items.forEach(function (item) { if (!item || !item.id) return; if (!map[item.id]) map[item.id] = item; else if ((item.updatedAt || 0) > (map[item.id].updatedAt || 0)) map[item.id] = item; }); return Object.keys(map).map(function (k) { return map[k]; }); }
function fetchShardsBatch(rc, keys, concurrency) { concurrency = concurrency || db.settings.pullConcurrency || FETCH_CONCURRENCY; var results = {}; var idx = 0; function worker() { if (idx >= keys.length) return Promise.resolve(); var k = keys[idx++]; var cfg = loadGH(); var path = _pathForShard(cfg, k, 1); return ghGetRaw(rc, path).then(function (file) { if (!file) { results[k] = null; return; } try { results[k] = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); } catch (e) { results[k] = null; } }).catch(function (e) { results[k] = null; }).then(function () { return worker(); }); } var workers = []; var n = Math.min(concurrency, keys.length); for (var i = 0; i < n; i++) workers.push(worker()); return Promise.all(workers).then(function () { return results; }); }

function migrateFromLegacy(rc, silent) { var cfg = loadGH(); var legacyPath = cfg.dataPath || 'material-library.json'; return ghGetRaw(rc, legacyPath).then(function (file) { if (!file) return false; if (!silent) toast('检测到旧数据，正在迁移到分片格式...'); ghSetStatus('迁移中...'); try { var data = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); if (!data || !Array.isArray(data.items)) return false; suppressPush = true; applyLoadedData(data); db.items.forEach(function (i) { i.images = normalizeImages(i.images); }); markNeedNormalize(); normalize(); suppressPush = false; _shardSnapshots = {}; _trashSnapshot = ''; _metaSnapshot = ''; db._shardSnapshots = {}; db._trashSnapshot = ''; db._metaSnapshot = ''; return ghPush(silent, true).then(function (ok) { if (ok) { if (!silent) toast('迁移完成'); ghSetStatus('迁移完成'); appendLog({ action: 'migrate', status: 'success', summary: '迁移完成', itemCount: db.items.length }); return true; } return false; }); } catch (e) { console.error('迁移失败', e); if (!silent) toast('迁移失败'); ghSetStatus('迁移失败'); return false; } }).catch(function () { return false; }); }

var pushTimer = null; function scheduleAutoPush() { var cfg = loadGH(); if (!cfg.autoSync || !ghReady(cfg)) return; if (!db.settings.autoPush) return; clearTimeout(pushTimer); var delay = Math.max(1, Math.min(60, Number(cfg.autoPushDelay) || 2)) * 1000; pushTimer = setTimeout(function () { ghPush(true); }, delay); }

function ghTest() { var cfg = loadGH(); if (!ghReady(cfg)) { toast('请填写 token / owner / repo'); return; } ghSetStatus('测试中…'); return fetch('https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo), { headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' } }).then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); }); return res.json(); }).then(function (info) { var isPrivate = info.private === true; var oldCfg = loadGH(); oldCfg.isPrivate = isPrivate; saveGH(oldCfg); ghSetStatus('连接成功'); toast('连接成功'); var imgRc = ghRepoConfig('img'); if (imgRc.owner !== cfg.owner || imgRc.repo !== cfg.repo) { return fetch('https://api.github.com/repos/' + encodeURIComponent(imgRc.owner) + '/' + encodeURIComponent(imgRc.repo), { headers: { Authorization: 'Bearer ' + imgRc.token, Accept: 'application/vnd.github+json' } }).then(function (r2) { if (r2.ok) ghImgSetStatus('图片仓库连接成功'); else ghImgSetStatus('图片仓库无法访问'); }).catch(function (e) { ghImgSetStatus('图片仓库检查失败'); }); } else ghImgSetStatus('图片使用主仓库'); }).catch(function (err) { ghSetStatus('连接失败：' + err.message); toast('连接失败'); }); }

function fillGHForm() { var cfg = loadGH(); if ($('ghToken')) $('ghToken').value = cfg.token; if ($('ghOwner')) $('ghOwner').value = cfg.owner; if ($('ghRepo')) $('ghRepo').value = cfg.repo; if ($('ghBranch')) $('ghBranch').value = cfg.branch; if ($('ghDataPath')) $('ghDataPath').value = cfg.dataPath; if ($('ghSiteBase')) $('ghSiteBase').value = cfg.siteBase; if ($('ghAuto')) $('ghAuto').checked = cfg.autoSync; if ($('ghAutoPull')) $('ghAutoPull').checked = cfg.autoPull; if ($('autoPushDelay')) $('autoPushDelay').value = cfg.autoPushDelay; if ($('ghImgOwner')) $('ghImgOwner').value = cfg.imgOwner; if ($('ghImgRepo')) $('ghImgRepo').value = cfg.imgRepo; if ($('ghImgBranch')) $('ghImgBranch').value = cfg.imgBranch; if ($('ghImgPath')) $('ghImgPath').value = cfg.imgPath; if ($('ghImgSite')) $('ghImgSite').value = cfg.imgSite; if ($('ghImgToken')) $('ghImgToken').value = cfg.imgToken; if ($('ghDataDir')) $('ghDataDir').value = cfg.dataDir; if ($('ghShardSubdir')) $('ghShardSubdir').value = cfg.shardSubdir; if (typeof window.renderImgCatsEditor === 'function') window.renderImgCatsEditor(); }
function collectGHForm() { var old = loadGH(); var cfg = { token: $('ghToken') ? $('ghToken').value.trim() : '', owner: $('ghOwner') ? $('ghOwner').value.trim() : '', repo: $('ghRepo') ? $('ghRepo').value.trim() : '', branch: $('ghBranch') ? ($('ghBranch').value.trim() || 'main') : 'main', dataPath: $('ghDataPath') ? ($('ghDataPath').value.trim() || 'material-library.json') : 'material-library.json', siteBase: $('ghSiteBase') ? $('ghSiteBase').value.trim() : '', autoSync: $('ghAuto') ? $('ghAuto').checked : false, autoPull: $('ghAutoPull') ? $('ghAutoPull').checked : true, autoPushDelay: $('autoPushDelay') ? Math.max(1, Math.min(60, parseInt($('autoPushDelay').value, 10) || 2)) : 2, imgOwner: $('ghImgOwner') ? $('ghImgOwner').value.trim() : '', imgRepo: $('ghImgRepo') ? $('ghImgRepo').value.trim() : '', imgBranch: $('ghImgBranch') ? $('ghImgBranch').value.trim() : '', imgPath: $('ghImgPath') ? ($('ghImgPath').value.trim() || 'images') : 'images', imgSite: $('ghImgSite') ? $('ghImgSite').value.trim() : '', imgToken: $('ghImgToken') ? $('ghImgToken').value.trim() : '', isPrivate: old.isPrivate, dataDir: $('ghDataDir') ? ($('ghDataDir').value.trim() || 'material-library') : (old.dataDir || 'material-library'), shardSubdir: $('ghShardSubdir') ? ($('ghShardSubdir').value.trim() || 'data') : (old.shardSubdir || 'data') }; saveGH(cfg); return cfg; }

var _lastKnownSha = null; var _syncTimer = null;
function checkCloudUpdate() { var cfg = loadGH(); if (!ghReady(cfg) || !cfg.autoPull || !db.settings.autoCheckUpdate) return; var rc = ghRepoConfig('data'); fetch(ghApiUrl(rc, _pathForIndex(cfg)) + '?ref=' + encodeURIComponent(rc.branch) + '&t=' + Date.now(), { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json' } }).then(function (res) { if (!res.ok) return; return res.json(); }).then(function (data) { if (!data) return; var currentSha = data.sha; if (_lastKnownSha && _lastKnownSha !== currentSha) { _lastKnownSha = currentSha; var hasUnsaved = (inputEl && inputEl.value.trim()) || editingId; if (hasUnsaved) { toast('⚠️ 云端已更新，你有未保存内容'); return; } if (confirm('⚠️ 检测到另一台设备更新了数据！点击确定刷新。')) window.location.reload(); } _lastKnownSha = currentSha; }).catch(function () {}); }
function restartSyncTimer() { if (_syncTimer) clearInterval(_syncTimer); if (!db.settings.autoCheckUpdate) return; var sec = db.settings.checkIntervalSeconds || 60; _syncTimer = setInterval(checkCloudUpdate, sec * 1000); }
setTimeout(function () { var cfg = loadGH(); if (ghReady(cfg)) { var rc = ghRepoConfig('data'); ghGetRaw(rc, _pathForIndex(cfg)).then(function (f) { if (f) _lastKnownSha = f.sha; else { var legacy = cfg.dataPath || 'material-library.json'; return ghGetRaw(rc, legacy).then(function (f2) { if (f2) _lastKnownSha = f2.sha; }); } }).catch(function () {}); } restartSyncTimer(); }, 3000);

window.loadGH = loadGH; window.saveGH = saveGH; window.ghReady = ghReady; window.ghRepoConfig = ghRepoConfig; window.ghApiUrl = ghApiUrl; window.ghGetRaw = ghGetRaw; window.ghPutRaw = ghPutRaw; window.ghDeleteRaw = ghDeleteRaw; window.imageSrc = imageSrc; window.imageUrlFromPath = imageUrlFromPath; window.fetchImageBlobUrl = fetchImageBlobUrl; window.getShardKey = getShardKey; window.groupItemsByShard = groupItemsByShard; window.ghPush = ghPush; window.ghPull = ghPull; window.migrateFromLegacy = migrateFromLegacy; window.scheduleAutoPush = scheduleAutoPush; window.ghTest = ghTest; window.fillGHForm = fillGHForm; window.collectGHForm = collectGHForm; window.restartSyncTimer = restartSyncTimer; window.checkCloudUpdate = checkCloudUpdate; window.appendLog = appendLog; window.loadLogs = loadLogs; window.loadDevices = loadDevices; window.registerDevice = registerDevice;