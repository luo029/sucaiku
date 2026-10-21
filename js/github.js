// js/github.js · 完整文件（语法修复版）
var STORE_VERSION = 4; var GH_INDEX_PATH = 'index.json'; var GH_TRASH_PATH = 'trash.json';
var GH_LOG_PATH = 'push-log.json'; var GH_DEVICES_PATH = 'devices.json';
var SHARD_PREFIX = 'data-'; var FETCH_CONCURRENCY = 8;
var _shardSnapshots = {}; var _trashSnapshot = ''; var _metaSnapshot = '';
var _pushInFlight = false; var _pushQueued = false;

function loadGH() {
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { cfg = {}; }
  return {
    token: cfg.token || '', owner: cfg.owner || '', repo: cfg.repo || '',
    branch: cfg.branch || 'main', dataPath: cfg.dataPath || 'material-library.json',
    siteBase: cfg.siteBase || '', autoSync: !!cfg.autoSync,
    autoPull: cfg.autoPull !== false,
    autoPushDelay: Math.max(1, Math.min(60, Number(cfg.autoPushDelay) || 2)),
    imgOwner: cfg.imgOwner || '', imgRepo: cfg.imgRepo || '', imgBranch: cfg.imgBranch || '',
    imgPath: cfg.imgPath || 'images', imgSite: cfg.imgSite || '', imgToken: cfg.imgToken || '',
    isPrivate: !!cfg.isPrivate,
    dataDir: cfg.dataDir || (db.settings.dataDir || 'material-library'),
    shardSubdir: cfg.shardSubdir || (db.settings.shardSubdir || 'data')
  };
}
function saveGH(cfg) { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); }
function ghReady(cfg) { return !!(cfg.token && cfg.owner && cfg.repo); }
function ghRepoConfig(kind) {
  var cfg = loadGH();
  if (kind === 'img') {
    var useIndependent = !!(cfg.imgOwner && cfg.imgRepo);
    return {
      token: cfg.imgToken || cfg.token,
      owner: useIndependent ? cfg.imgOwner : cfg.owner,
      repo: useIndependent ? cfg.imgRepo : cfg.repo,
      branch: cfg.imgBranch || cfg.branch || 'main',
      path: cfg.imgPath || 'images', siteBase: cfg.imgSite || ''
    };
  }
  return { token: cfg.token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main', path: '', siteBase: cfg.siteBase || '' };
}
function ghApiUrl(rc, path) { var p = String(path).split('/').map(encodeURIComponent).join('/'); return 'https://api.github.com/repos/' + encodeURIComponent(rc.owner) + '/' + encodeURIComponent(rc.repo) + '/contents/' + p; }
function ghTreeUrl(rc) { return 'https://api.github.com/repos/' + encodeURIComponent(rc.owner) + '/' + encodeURIComponent(rc.repo) + '/git/trees/' + encodeURIComponent(rc.branch) + '?recursive=1'; }

function ghGetRaw(rc, path) {
  if (!rc.owner || !rc.repo) return Promise.reject(new Error('未配置 GitHub'));
  var headers = { Accept: 'application/vnd.github+json' };
  if (rc.token) headers.Authorization = 'Bearer ' + rc.token;
  return fetch(ghApiUrl(rc, path) + '?ref=' + encodeURIComponent(rc.branch) + '&t=' + Date.now(), { headers: headers }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); });
    return res.json();
  });
}
function ghTreeAll(rc) {
  return fetch(ghTreeUrl(rc) + '&t=' + Date.now(), { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json' } }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('Tree HTTP ' + res.status + ' ' + t.slice(0, 120)); });
    return res.json();
  }).then(function (data) {
    var map = {};
    (data.tree || []).forEach(function (f) { if (f.type === 'blob') map[f.path] = f.sha; });
    return map;
  });
}
function ghPutRaw(rc, path, base64, sha, message) {
  if (!rc.token || !rc.owner || !rc.repo) return Promise.reject(new Error('未配置 GitHub 或缺少 Token'));
  var body = { message: message || ('update ' + path), content: base64, branch: rc.branch };
  if (sha) body.sha = sha;
  return fetch(ghApiUrl(rc, path), {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 160)); });
    return res.json();
  });
}
function ghDeleteRaw(rc, path, sha, message) {
  return fetch(ghApiUrl(rc, path), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || ('delete ' + path), sha: sha, branch: rc.branch })
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 160)); });
    return res.json();
  });
}

function getShardKey(item) { return _shardKeyOfItem(item); }
function getYearFromKey(key) { return key.split('-')[0]; }
function groupItemsByShard(items) { return _groupItemsByShard(items); }

function _pathForIndex(cfg) { return cfg.dataDir + '/' + GH_INDEX_PATH; }
function _pathForYearIndex(cfg, year) { return cfg.dataDir + '/index-' + year + '.json'; }
function _pathForShard(cfg, key, part) { var name = SHARD_PREFIX + key + (part && part > 1 ? '-' + part : '') + '.json'; return cfg.dataDir + '/' + cfg.shardSubdir + '/' + name; }
function _pathForTrash(cfg) { return cfg.dataDir + '/' + GH_TRASH_PATH; }
function _pathForLog(cfg) { return cfg.dataDir + '/' + GH_LOG_PATH; }
function _pathForDevices(cfg) { return cfg.dataDir + '/' + GH_DEVICES_PATH; }

function splitShardIfNeeded(key, items) {
  var limit = (Number(db.settings.shardMaxSizeKB) || 650) * 1024;
  if (!db.settings.shardSplitEnabled || items.length === 0) { return [items]; }
  var parts = []; var buf = []; var bufSize = 0;
  for (var i = 0; i < items.length; i++) {
    var s = JSON.stringify(items[i]).length;
    if (bufSize + s > limit && buf.length > 0) { parts.push(buf); buf = []; bufSize = 0; }
    buf.push(items[i]); bufSize += s;
  }
  if (buf.length) parts.push(buf);
  return parts;
}
function _recalcShardCatMap(items) {
  var cats = {};
  items.forEach(function (i) { var t = i.type || '未分类'; cats[t] = (cats[t] || 0) + 1; });
  return cats;
}

function loadIndex(rc) {
  var cfg = loadGH();
  return ghGetRaw(rc, _pathForIndex(cfg)).then(function (file) {
    if (!file) return null;
    try { return { data: JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))), sha: file.sha }; }
    catch (e) { throw new Error('index.json 格式错误'); }
  });
}
function loadYearIndex(rc, year) {
  var cfg = loadGH();
  return ghGetRaw(rc, _pathForYearIndex(cfg, year)).then(function (file) {
    if (!file) return null;
    try { return JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); } catch (e) { return null; }
  });
}

function buildImageBaseUrl(rc) { if (rc.siteBase) return rc.siteBase.replace(/\/$/, ''); return 'https://raw.githubusercontent.com/' + rc.owner + '/' + rc.repo + '/' + rc.branch; }
function imageUrlFromPath(filepath) { var rc = ghRepoConfig('img'); return encodeURI(buildImageBaseUrl(rc) + '/' + rc.path + '/' + filepath); }
function imageSrc(im) {
  if (!im) return '';
  var url = '';
  if (im.path) url = imageUrlFromPath(im.path);
  else url = im.url || '';
  if (!/^(https?:|data:image\/|blob:)/i.test(url)) return '';
  return url;
}
var imgBlobCache = new Map(); var IMG_BLOB_CACHE_MAX = 300;
function fetchImageBlobUrl(relPath) {
  if (imgBlobCache.has(relPath)) return Promise.resolve(imgBlobCache.get(relPath));
  var rc = ghRepoConfig('img');
  if (!rc.token || !rc.owner || !rc.repo) return Promise.reject(new Error('未配置'));
  var full = (rc.path + '/' + relPath).split('/').map(encodeURIComponent).join('/');
  var url = 'https://api.github.com/repos/' + rc.owner + '/' + rc.repo + '/contents/' + full + '?ref=' + encodeURIComponent(rc.branch);
  return fetch(url, { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github.raw' } }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.blob();
  }).then(function (blob) {
    var objUrl = URL.createObjectURL(blob);
    if (imgBlobCache.size >= IMG_BLOB_CACHE_MAX) {
      var firstKey = imgBlobCache.keys().next().value;
      try { URL.revokeObjectURL(imgBlobCache.get(firstKey)); } catch (e) {}
      imgBlobCache.delete(firstKey);
    }
    imgBlobCache.set(relPath, objUrl);
    return objUrl;
  });
}

function ghSetStatus(msg) { var el = $('ghStatus'); if (el) el.textContent = msg || ''; }
function ghImgSetStatus(msg) { var el = $('ghImgStatus'); if (el) el.textContent = msg || ''; }
function _setSnap(key, json) { _shardSnapshots[key] = json; db._shardSnapshots = db._shardSnapshots || {}; db._shardSnapshots[key] = json; }
function _delSnap(key) { delete _shardSnapshots[key]; if (db._shardSnapshots) delete db._shardSnapshots[key]; }
function _setTrash(json) { _trashSnapshot = json; db._trashSnapshot = json; }
function _setMeta(json) { _metaSnapshot = json; db._metaSnapshot = json; }

function appendLog(entry) {
  if (!db.settings.enableLog) return;
  try {
    var logs = JSON.parse(localStorage.getItem('material-library.push-log') || '[]');
    var dev = getDeviceDisplay();
    logs.unshift({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(), deviceId: dev.id, deviceName: dev.name, deviceIcon: dev.icon,
      deviceType: dev.type, action: entry.action || 'push', status: entry.status || 'success',
      summary: entry.summary || '', shards: entry.shards || [], itemCount: entry.itemCount || 0,
      duration: entry.duration || 0, details: entry.details || ''
    });
    var mode = db.settings.logCleanupMode; var maxCount = db.settings.logMaxCount;
    if (mode === 'count' && logs.length > maxCount) logs = logs.slice(0, maxCount);
    if (db.settings.logHardLimitEnabled && logs.length > db.settings.logHardLimitCount) logs = logs.slice(0, db.settings.logHardLimitCount);
    localStorage.setItem('material-library.push-log', JSON.stringify(logs));
  } catch (e) {}
}
function loadLogs() { try { return JSON.parse(localStorage.getItem('material-library.push-log') || '[]'); } catch (e) { return []; } }
function registerDevice(pushOrPull) {
  try {
    var dev = getOrCreateDevice(); var now = Date.now();
    var devices = JSON.parse(localStorage.getItem('material-library.devices-cache') || '{}');
    if (!devices[dev.id]) devices[dev.id] = { id: dev.id, name: dev.name, icon: dev.icon, type: dev.type, createdAt: dev.createdAt || now, pushCount: 0, pullCount: 0 };
    if (pushOrPull === 'push') { devices[dev.id].lastPushAt = now; devices[dev.id].pushCount = (devices[dev.id].pushCount || 0) + 1; }
    else if (pushOrPull === 'pull') { devices[dev.id].lastPullAt = now; devices[dev.id].pullCount = (devices[dev.id].pullCount || 0) + 1; }
    devices[dev.id].lastSeenAt = now;
    localStorage.setItem('material-library.devices-cache', JSON.stringify(devices));
  } catch (e) {}
}
function loadDevices() { try { return JSON.parse(localStorage.getItem('material-library.devices-cache') || '{}'); } catch (e) { return {}; } }

// 进度条（简化安全版）
var _syncProgress = { active: false, total: 0, done: 0, failed: 0, startAt: 0 };
function _showSyncProgress(total) {
  if (!db.settings.showSyncProgress || total <= 3) return;
  _syncProgress = { active: true, total: total, done: 0, failed: 0, startAt: Date.now() };
  _renderSyncProgress();
}
function _updateSyncProgress() {
  if (!_syncProgress.active) return;
  _renderSyncProgress();
}
function _hideSyncProgress() {
  _syncProgress.active = false;
  var el = document.getElementById('syncProgressPanel');
  if (el) {
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }
}
function _renderSyncProgress() {
  var el = document.getElementById('syncProgressPanel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncProgressPanel';
    el.style.cssText = 'position:fixed; bottom:24px; right:24px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 18px; box-shadow:var(--sh-3); z-index:200; min-width:240px; transition:opacity .3s;';
    document.body.appendChild(el);
  }
  var pct = 0;
  if (_syncProgress.total > 0) pct = Math.round(_syncProgress.done / _syncProgress.total * 100);
  var elapsed = Math.round((Date.now() - _syncProgress.startAt) / 1000);
  var eta = 0;
  if (_syncProgress.done > 0) eta = Math.round(elapsed / _syncProgress.done * (_syncProgress.total - _syncProgress.done));
  var p1 = '<div style="font-weight:600; font-size:14px; margin-bottom:8px;">🔄 正在同步</div>';
  var p2 = '<div style="height:6px; background:var(--line); border-radius:3px; overflow:hidden; margin-bottom:8px;"><div style="height:100%; width:' + pct + '%; background:var(--accent);"></div></div>';
  var p3 = '<div style="font-size:12.5px; color:var(--text-2); display:flex; justify-content:space-between;"><span>' + _syncProgress.done + ' / ' + _syncProgress.total + '</span><span>' + pct + '%';
  if (eta > 0) p3 += ' · 约 ' + eta + 's';
  p3 += '</span></div>';
  var p4 = '';
  if (_syncProgress.failed > 0) p4 = '<div style="font-size:12px; color:var(--danger); margin-top:4px;">失败 ' + _syncProgress.failed + ' 个</div>';
  el.innerHTML = p1 + p2 + p3 + p4;
}

// 单个分片推送（去掉 async/await，用 Promise 链）
function _pushOneShard(rc, cfg, key, items, existingShaMap) {
  var retryCount = Number(db.settings.pushRetryCount) || 3;
  var retryDelay = (Number(db.settings.pushRetryDelaySec) || 10) * 1000;
  var parts = splitShardIfNeeded(key, items);
  var chain = Promise.resolve();
  var allOk = true;
  parts.forEach(function (buf, index) {
    chain = chain.then(function () {
      if (!allOk) return;
      var part = index + 1;
      var path = _pathForShard(cfg, key, part);
      var content = JSON.stringify({ _rev: 1, date: key, part: part, items: buf }, null, 2);
      var b64 = utf8ToBase64(content);
      var existingSha = existingShaMap[path] || null;
      var attempt = 0;
      
      function tryOnce() {
        return ghPutRaw(rc, path, b64, existingSha, 'sync ' + path).then(function () {
          return true;
        }).catch(function (e) {
          // 修复Bug 2：如果是 422 或 409，且没有 existingSha，可能是文件已存在但树没拉到，去拿 sha 再重试
          var isConflict = e.message && (e.message.indexOf('422') >= 0 || e.message.indexOf('409') >= 0);
          if (isConflict && !existingSha) {
             return ghGetRaw(rc, path).then(function(file) {
                 if (file && file.sha) {
                     existingSha = file.sha;
                     return ghPutRaw(rc, path, b64, existingSha, 'sync ' + path).then(function(){ return true; });
                 }
                 throw e;
             });
          }
          attempt++;
          if (attempt <= retryCount) {
            return new Promise(function (r) { setTimeout(r, retryDelay); }).then(function () { return tryOnce(); });
          }
          return false;
        });
      }
      return tryOnce().then(function (ok) { if (!ok) allOk = false; });
    });
  });
  return chain.then(function () { return { ok: allOk, key: key }; });
}

// 主 push
function ghPush(silent, force) {
  silent = !!silent; force = !!force;
  var cfg = loadGH();
  if (!ghReady(cfg)) { if (!silent) toast('请先配置 GitHub'); return Promise.resolve(false); }
  if (_pushInFlight) { _pushQueued = true; return Promise.resolve(false); }
  _pushInFlight = true;
  var startTime = Date.now();
  var rc = ghRepoConfig('data');
  var groups = groupItemsByShard(db.items);
  var currentKeys = Object.keys(groups).sort();

  if (!silent) ghSetStatus('推送中…');

  var toPush = [];
  currentKeys.forEach(function (k) {
    var json = JSON.stringify(groups[k]);
    if (force || _shardSnapshots[k] !== json) toPush.push(k);
  });
  var toDelete = Object.keys(_shardSnapshots).filter(function (k) { return currentKeys.indexOf(k) < 0; });

  _showSyncProgress(toPush.length + toDelete.length + 2);

  var pushedCount = 0; var failedShards = [];
  var yearIndexDirty = {};

  return Promise.resolve().then(function () {
    if (!db.settings.gitTreeBatchEnabled) return {};
    return ghTreeAll(rc).catch(function (e) { console.warn('Tree API 失败，回退到逐个 GET', e); return {}; });
  }).then(function (existingShaMap) {
    var concurrency = Math.max(1, Math.min(10, Number(db.settings.pushConcurrency) || 3));
    var idx = 0;
    function pushWorker() {
      if (idx >= toPush.length) return Promise.resolve();
      var k = toPush[idx++];
      return _pushOneShard(rc, cfg, k, groups[k], existingShaMap).then(function (result) {
        if (result.ok) {
          _setSnap(k, JSON.stringify(groups[k]));
          pushedCount++;
          yearIndexDirty[getYearFromKey(k)] = true;
          _syncProgress.done++;
        } else {
          failedShards.push(k);
          _syncProgress.failed++;
        }
        _updateSyncProgress();
        return pushWorker();
      });
    }
    var workers = [];
    for (var w = 0; w < concurrency; w++) workers.push(pushWorker());
    return Promise.all(workers).then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
    // 修复Bug 1：删除旧分片，支持清理残缺的多个 part
    var deleteChain = Promise.resolve();
    toDelete.forEach(function (dk) {
      deleteChain = deleteChain.then(function () {
        // 找出所有属于这个 dk 的路径，无论有几个 part
        var pathsToDelete = Object.keys(existingShaMap).filter(function(p) {
            return p.indexOf('/data-' + dk) >= 0 && p.endsWith('.json');
        });
        if (pathsToDelete.length === 0) {
            _delSnap(dk); _syncProgress.done++; _updateSyncProgress(); 
            return; 
        }
        var pChain = Promise.resolve();
        pathsToDelete.forEach(function(dpath) {
            var sha = existingShaMap[dpath];
            pChain = pChain.then(function() {
                return ghDeleteRaw(rc, dpath, sha, 'delete ' + dpath)
                    .catch(function (e) { console.warn('删除分片失败', dpath, e); });
            });
        });
        return pChain.then(function() {
            _delSnap(dk); 
            _syncProgress.done++; 
            _updateSyncProgress();
        });
      });
    });
    return deleteChain.then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
    // 回收站
    var trashJson = JSON.stringify(db.trash);
    if (!force && _trashSnapshot === trashJson) return existingShaMap;
    var tContent = JSON.stringify({ trash: db.trash, updatedAt: new Date().toISOString() }, null, 2);
    var tB64 = utf8ToBase64(tContent);
    var tSha = existingShaMap[_pathForTrash(cfg)] || null;
    return ghPutRaw(rc, _pathForTrash(cfg), tB64, tSha, 'sync trash').then(function () { _setTrash(trashJson); }).catch(function (e) { console.warn('trash 推送失败', e); }).then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
    // yearIndex（含分类摘要）
    var yearsToUpdate = Object.keys(yearIndexDirty);
    var currentYears = {};
    currentKeys.forEach(function (ck) { currentYears[getYearFromKey(ck)] = true; });
    Object.keys(currentYears).forEach(function (y) { if (yearsToUpdate.indexOf(y) < 0) yearsToUpdate.push(y); });

    var yearChain = Promise.resolve();
    yearsToUpdate.forEach(function (year) {
      yearChain = yearChain.then(function () {
        var yearShards = {};
        currentKeys.forEach(function (ck) {
          if (getYearFromKey(ck) === year) {
            yearShards[ck] = { count: groups[ck].length, size: JSON.stringify(groups[ck]).length, cats: _recalcShardCatMap(groups[ck]) };
          }
        });
        var ypath = _pathForYearIndex(cfg, year);
        if (Object.keys(yearShards).length === 0) {
          var yeSha = existingShaMap[ypath];
          if (yeSha) return ghDeleteRaw(rc, ypath, yeSha, 'delete ' + ypath).catch(function () {});
          return;
        }
        var yContent = JSON.stringify({ year: year, shards: yearShards }, null, 2);
        return ghPutRaw(rc, ypath, utf8ToBase64(yContent), existingShaMap[ypath] || null, 'sync index-' + year).catch(function (e) { console.warn('yearIndex 推送失败', year, e); });
      });
    });
    return yearChain.then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
    // index.json
    var yearSummary = {};
    Object.keys(currentYears_helper(currentKeys)).forEach(function (cy) {
      var count = 0; var shardCount = 0;
      currentKeys.forEach(function (ck) { if (getYearFromKey(ck) === cy) { count += groups[ck].length; shardCount++; } });
      yearSummary[cy] = { count: count, shardCount: shardCount };
    });
    var meta = { cats: db.cats, colors: db.colors, sources: db.sources, fixedSource: db.fixedSource, fixedTags: db.fixedTags, imageCategories: db.imageCategories, settings: db.settings, tagColors: db.tagColors || {}, catVersion: db.catVersion || 0 };
    var metaSig = JSON.stringify(meta) + JSON.stringify(yearSummary);
    if (!force && _metaSnapshot === metaSig) return;
    return loadIndex(rc).then(function (oldIndex) {
      var oldRev = (oldIndex && oldIndex.data) ? (oldIndex.data._rev || 0) : 0;
      var newIndex = { _rev: oldRev + 1, version: STORE_VERSION, updatedAt: new Date().toISOString(), indexShards: yearSummary, meta: meta };
      var iContent = JSON.stringify(newIndex, null, 2);
      var iSha = existingShaMap[_pathForIndex(cfg)] || null;
      return ghPutRaw(rc, _pathForIndex(cfg), utf8ToBase64(iContent), iSha, 'sync index').then(function () { _setMeta(metaSig); });
    });
  }).then(function () {
    registerDevice('push');
    appendLog({ action: 'push', status: failedShards.length === 0 ? 'success' : 'error', summary: pushedCount > 0 ? ('推送 ' + pushedCount + ' 个分片' + (failedShards.length ? '，失败 ' + failedShards.length : '')) : '无变化', shards: toPush, itemCount: db.items.length, duration: Date.now() - startTime });
    failedShards.forEach(function (k) { _dirtyShards.add(k); });
    _hideSyncProgress();
    if (!silent) {
      if (failedShards.length === 0) { toast(pushedCount > 0 ? ('已同步 ' + pushedCount + ' 个分片') : '无变化'); ghSetStatus('推送成功'); }
      else { toast('成功 ' + pushedCount + '，失败 ' + failedShards.length + '（下次自动重试）'); ghSetStatus('部分失败'); }
    }
    if (db.settings.snapshotEnabled && typeof maybeCreateSnapshot === 'function') {
      maybeCreateSnapshot().catch(function (e) { console.warn('快照失败', e); });
    }
    return failedShards.length === 0;
  }).catch(function (err) {
    console.error('[ghPush] 失败', err);
    appendLog({ action: 'push', status: 'error', summary: '推送失败：' + err.message });
    failedShards.forEach(function (k) { _dirtyShards.add(k); });
    _hideSyncProgress();
    if (err.message && err.message.indexOf('409') >= 0 && !force) {
      if (silent) return false;
      if (confirm('⚠️ 版本冲突！是否强制覆盖？')) { _pushInFlight = false; return ghPush(false, true); }
      return false;
    }
    if (!silent) toast('推送失败：' + err.message);
    ghSetStatus('推送失败：' + err.message);
    return false;
  }).then(function (result) {
    _pushInFlight = false;
    if (_pushQueued) { _pushQueued = false; setTimeout(function () { scheduleAutoPush(); }, 1000); }
    return result;
  }, function (err) {
    _pushInFlight = false;
    if (_pushQueued) { _pushQueued = false; setTimeout(function () { scheduleAutoPush(); }, 1000); }
    throw err;
  });
}

function currentYears_helper(keys) {
  var m = {};
  keys.forEach(function (k) { m[getYearFromKey(k)] = true; });
  return m;
}

// pull（原样，未改）
function ghPull(silent, pullMore) {
  silent = !!silent; pullMore = !!pullMore;
  var cfg = loadGH();
  if (!cfg.owner || !cfg.repo) { if (!silent) toast('请先配置 GitHub 仓库'); return Promise.resolve(false); }
  var startTime = Date.now();
  var rc = ghRepoConfig('data');
  if (!silent) ghSetStatus(pullMore ? '加载历史中…' : '拉取中…');

  return loadIndex(rc).then(function (indexResult) {
    if (!indexResult) return migrateFromLegacy(rc, silent).then(function (ok) { if (ok) return true; throw new Error('远程数据不存在'); });
    var index = indexResult.data;
    var yearSummary = index.indexShards || {};
    var meta = index.meta || {};
    var remoteCatVersion = meta.catVersion || 0;
    var localCatVersion = db.catVersion || 0;
    if (!pullMore && remoteCatVersion > localCatVersion && db.settings.catSyncAction === 'ask' && !silent) {
      setTimeout(function () {
        window.showCustomConfirm({
          title: '分类结构已更新',
          desc: '云端分类已更新（v' + localCatVersion + ' → v' + remoteCatVersion + '），是否重新拉取？',
          isDanger: false,
          onConfirm: function () { ghPull(false); }
        });
      }, 100);
    }
    var totalSize = 0;
    Object.keys(yearSummary).forEach(function (y) { totalSize += (yearSummary[y].count || 0) * 500; });
    var loadMode = db.settings.loadMode; var thresholdMB = db.settings.smartThresholdMB || 5;
    var shouldLoadAll = false; var daysToLoad = 0;
    if (loadMode === 'smart') { if ((totalSize / 1024 / 1024) <= thresholdMB) shouldLoadAll = true; else daysToLoad = 90; }
    else { var range = db.settings.manualRangeDays; if (range === 'all' || range === 0) shouldLoadAll = true; else daysToLoad = range || 90; }
    var years = Object.keys(yearSummary);
    return Promise.all(years.map(function (y) { return loadYearIndex(rc, y); })).then(function (yearIndexes) {
      var allShards = {};
      yearIndexes.forEach(function (yi) { if (yi && yi.shards) Object.keys(yi.shards).forEach(function (k) { allShards[k] = yi.shards[k]; }); });
      var shardKeys = Object.keys(allShards).sort();
      var toLoad = [];
      if (pullMore) {
        var oldestLoaded = db._loadedShardKeys && db._loadedShardKeys.length > 0 ? db._loadedShardKeys[db._loadedShardKeys.length - 1] : '9999-12-31';
        var unloaded = shardKeys.filter(function (k) { return db._loadedShardKeys.indexOf(k) < 0 && k < oldestLoaded; });
        var batchSize = db.settings.lazyLoadBatchSize || 30;
        toLoad = unloaded.slice(-batchSize);
        if (!toLoad.length) { if (!silent) toast('没有更早的数据了'); return false; }
      } else {
        if (shouldLoadAll) toLoad = shardKeys;
        else {
          var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - daysToLoad);
          var cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
          toLoad = shardKeys.filter(function (k) { return k >= cutoffStr; });
        }
      }
      if (pullMore) { db._loadedShardKeys = (db._loadedShardKeys || []).concat(toLoad).sort(); db._allShardKeys = shardKeys; }
      else { db._allShardKeys = shardKeys; db._loadedShardKeys = toLoad; }
      return fetchShardsBatch(rc, toLoad).then(function (dataMap) {
        var newItems = []; var newSnapshots = {};
        toLoad.forEach(function (k) {
          if (dataMap[k] && dataMap[k].items) { newItems = newItems.concat(dataMap[k].items); newSnapshots[k] = JSON.stringify(dataMap[k].items); }
        });
        if (pullMore) {
          var currentIds = new Set(db.items.map(function (i) { return i.id; }));
          newItems.forEach(function (i) { if (!currentIds.has(i.id)) db.items.push(i); });
        } else { db.items = newItems; }
        if (!pullMore) {
          return ghGetRaw(rc, _pathForTrash(cfg)).catch(function () { return null; }).then(function (trashFile) {
            var trashItems = []; var trashSnap = '';
            if (trashFile) { try { var td = JSON.parse(base64ToUtf8(trashFile.content.replace(/\n/g, ''))); trashItems = td.trash || []; trashSnap = JSON.stringify(trashItems); } catch (e) {} }
            return ghGetRaw(rc, _pathForDevices(cfg)).catch(function () { return null; }).then(function (devFile) {
              if (devFile) { try { var dd = JSON.parse(base64ToUtf8(devFile.content.replace(/\n/g, ''))); if (dd.devices) localStorage.setItem('material-library.devices-cache', JSON.stringify(dd.devices)); } catch (e) {} }
              return ghGetRaw(rc, _pathForLog(cfg)).catch(function () { return null; }).then(function (logFile) {
                if (logFile && db.settings.logSyncCloud) { try { var ld = JSON.parse(base64ToUtf8(logFile.content.replace(/\n/g, ''))); if (Array.isArray(ld.logs)) localStorage.setItem('material-library.push-log', JSON.stringify(ld.logs)); } catch (e) {} }
                suppressPush = true;
                applyLoadedData({ items: dedupeItems(db.items), cats: meta.cats || DEFAULT_CATS, colors: meta.colors || {}, sources: meta.sources || [], fixedSource: meta.fixedSource || '', fixedTags: meta.fixedTags || [], imageCategories: meta.imageCategories || DEFAULT_IMG_CATS, settings: meta.settings || {}, tagColors: meta.tagColors || {}, trash: trashItems, _rev: index._rev || 0, catVersion: meta.catVersion || 0, _loadedShardKeys: db._loadedShardKeys, _allShardKeys: db._allShardKeys });
                _shardSnapshots = newSnapshots; db._shardSnapshots = {}; Object.keys(newSnapshots).forEach(function (k) { db._shardSnapshots[k] = newSnapshots[k]; });
                _trashSnapshot = trashSnap; db._trashSnapshot = trashSnap;
                _metaSnapshot = JSON.stringify(meta) + JSON.stringify(yearSummary); db._metaSnapshot = _metaSnapshot;
                db.items.forEach(function (i) { i.images = normalizeImages(i.images); });
                saveSettings(); markNeedNormalize(); normalize();
                return saveImmediate().then(function () { suppressPush = false; registerDevice('pull'); render(); updateTinyUsageUI(); applySettingsToUI(); if (!silent) toast('已拉取 ' + db.items.length + ' 条素材'); ghSetStatus('拉取成功'); return true; });
              });
            });
          });
        } else {
          toLoad.forEach(function (k) { _setSnap(k, newSnapshots[k]); });
          markNeedNormalize(); normalize();
          return saveImmediate().then(function () { render(); if (!silent) toast('已加载更早的 ' + newItems.length + ' 条素材'); return true; });
        }
      });
    });
  }).catch(function (err) {
    suppressPush = false;
    console.error('[ghPull] 失败', err);
    if (!silent) toast('拉取失败：' + err.message);
    ghSetStatus('拉取失败');
    return false;
  });
}

function dedupeItems(items) {
  var map = {};
  items.forEach(function (item) {
    if (!item || !item.id) return;
    if (!map[item.id]) map[item.id] = item;
    else if ((item.updatedAt || 0) > (map[item.id].updatedAt || 0)) map[item.id] = item;
  });
  return Object.keys(map).map(function (k) { return map[k]; });
}
function fetchShardsBatch(rc, keys, concurrency) {
  concurrency = concurrency || db.settings.pullConcurrency || FETCH_CONCURRENCY;
  var results = {}; var idx = 0;
  function worker() {
    if (idx >= keys.length) return Promise.resolve();
    var k = keys[idx++];
    var cfg = loadGH();
    var path = _pathForShard(cfg, k, 1);
    return ghGetRaw(rc, path).then(function (file) {
      if (!file) { results[k] = null; return; }
      try { results[k] = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, ''))); } catch (e) { results[k] = null; }
    }).catch(function () { results[k] = null; }).then(function () { return worker(); });
  }
  var workers = [];
  var n = Math.min(concurrency, keys.length);
  for (var i = 0; i < n; i++) workers.push(worker());
  return Promise.all(workers).then(function () { return results; });
}
function migrateFromLegacy(rc, silent) {
  var cfg = loadGH();
  var legacyPath = cfg.dataPath || 'material-library.json';
  return ghGetRaw(rc, legacyPath).then(function (file) {
    if (!file) return false;
    if (!silent) toast('检测到旧数据，正在迁移到分片格式...');
    ghSetStatus('迁移中...');
    try {
      var data = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, '')));
      if (!data || !Array.isArray(data.items)) return false;
      suppressPush = true;
      applyLoadedData(data);
      db.items.forEach(function (i) { i.images = normalizeImages(i.images); });
      markNeedNormalize(); normalize();
      suppressPush = false;
      _shardSnapshots = {}; _trashSnapshot = ''; _metaSnapshot = '';
      db._shardSnapshots = {}; db._trashSnapshot = ''; db._metaSnapshot = '';
      return ghPush(silent, true).then(function (ok) {
        if (ok) { if (!silent) toast('迁移完成'); ghSetStatus('迁移完成'); appendLog({ action: 'migrate', status: 'success', summary: '迁移完成', itemCount: db.items.length }); return true; }
        return false;
      });
    } catch (e) { console.error('迁移失败', e); if (!silent) toast('迁移失败'); ghSetStatus('迁移失败'); return false; }
  }).catch(function () { return false; });
}

var pushTimer = null;
function scheduleAutoPush() {
  var cfg = loadGH();
  if (!cfg.autoSync || !ghReady(cfg)) return;
  if (!db.settings.autoPush) return;
  clearTimeout(pushTimer);
  var delay = Math.max(1, Math.min(60, Number(cfg.autoPushDelay) || 2)) * 1000;
  pushTimer = setTimeout(function () { ghPush(true); }, delay);
}

function ghTest() {
  var cfg = loadGH();
  if (!ghReady(cfg)) { toast('请填写 token / owner / repo'); return; }
  ghSetStatus('测试中…');
  return fetch('https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo), { headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' } }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); });
    return res.json();
  }).then(function (info) {
    var isPrivate = info.private === true;
    var oldCfg = loadGH(); oldCfg.isPrivate = isPrivate; saveGH(oldCfg);
    db.settings.repoVisibility = isPrivate ? 'private' : 'public'; saveSettings();
    ghSetStatus('连接成功'); toast('连接成功');
    var imgRc = ghRepoConfig('img');
    if (imgRc.owner !== cfg.owner || imgRc.repo !== cfg.repo) {
      return fetch('https://api.github.com/repos/' + encodeURIComponent(imgRc.owner) + '/' + encodeURIComponent(imgRc.repo), { headers: { Authorization: 'Bearer ' + imgRc.token, Accept: 'application/vnd.github+json' } }).then(function (r2) { if (r2.ok) ghImgSetStatus('图片仓库连接成功'); else ghImgSetStatus('图片仓库无法访问'); }).catch(function () { ghImgSetStatus('图片仓库检查失败'); });
    } else ghImgSetStatus('图片使用主仓库');
  }).catch(function (err) { ghSetStatus('连接失败：' + err.message); toast('连接失败'); });
}

function fillGHForm() {
  var cfg = loadGH();
  if ($('ghToken')) $('ghToken').value = cfg.token;
  if ($('ghOwner')) $('ghOwner').value = cfg.owner;
  if ($('ghRepo')) $('ghRepo').value = cfg.repo;
  if ($('ghBranch')) $('ghBranch').value = cfg.branch;
  if ($('ghDataPath')) $('ghDataPath').value = cfg.dataPath;
  if ($('ghSiteBase')) $('ghSiteBase').value = cfg.siteBase;
  if ($('ghAuto')) $('ghAuto').checked = cfg.autoSync;
  if ($('ghAutoPull')) $('ghAutoPull').checked = cfg.autoPull;
  if ($('autoPushDelay')) $('autoPushDelay').value = cfg.autoPushDelay;
  if ($('ghImgOwner')) $('ghImgOwner').value = cfg.imgOwner;
  if ($('ghImgRepo')) $('ghImgRepo').value = cfg.imgRepo;
  if ($('ghImgBranch')) $('ghImgBranch').value = cfg.imgBranch;
  if ($('ghImgPath')) $('ghImgPath').value = cfg.imgPath;
  if ($('ghImgSite')) $('ghImgSite').value = cfg.imgSite;
  if ($('ghImgToken')) $('ghImgToken').value = cfg.imgToken;
  if ($('ghDataDir')) $('ghDataDir').value = cfg.dataDir;
  if ($('ghShardSubdir')) $('ghShardSubdir').value = cfg.shardSubdir;
  if (typeof window.renderImgCatsEditor === 'function') window.renderImgCatsEditor();
}
function collectGHForm() {
  var old = loadGH();
  var cfg = {
    token: $('ghToken') ? $('ghToken').value.trim() : '',
    owner: $('ghOwner') ? $('ghOwner').value.trim() : '',
    repo: $('ghRepo') ? $('ghRepo').value.trim() : '',
    branch: $('ghBranch') ? ($('ghBranch').value.trim() || 'main') : 'main',
    dataPath: $('ghDataPath') ? ($('ghDataPath').value.trim() || 'material-library.json') : 'material-library.json',
    siteBase: $('ghSiteBase') ? $('ghSiteBase').value.trim() : '',
    autoSync: $('ghAuto') ? $('ghAuto').checked : false,
    autoPull: $('ghAutoPull') ? $('ghAutoPull').checked : true,
    autoPushDelay: $('autoPushDelay') ? Math.max(1, Math.min(60, parseInt($('autoPushDelay').value, 10) || 2)) : 2,
    imgOwner: $('ghImgOwner') ? $('ghImgOwner').value.trim() : '',
    imgRepo: $('ghImgRepo') ? $('ghImgRepo').value.trim() : '',
    imgBranch: $('ghImgBranch') ? $('ghImgBranch').value.trim() : '',
    imgPath: $('ghImgPath') ? ($('ghImgPath').value.trim() || 'images') : 'images',
    imgSite: $('ghImgSite') ? $('ghImgSite').value.trim() : '',
    imgToken: $('ghImgToken') ? $('ghImgToken').value.trim() : '',
    isPrivate: old.isPrivate,
    dataDir: $('ghDataDir') ? ($('ghDataDir').value.trim() || 'material-library') : (old.dataDir || 'material-library'),
    shardSubdir: $('ghShardSubdir') ? ($('ghShardSubdir').value.trim() || 'data') : (old.shardSubdir || 'data')
  };
  saveGH(cfg);
  return cfg;
}

var _lastKnownSha = null;
var _syncTimer = null;
function checkCloudUpdate() {
  var cfg = loadGH();
  if (!ghReady(cfg) || !cfg.autoPull || !db.settings.autoCheckUpdate) return;
  var rc = ghRepoConfig('data');
  fetch(ghApiUrl(rc, _pathForIndex(cfg)) + '?ref=' + encodeURIComponent(rc.branch) + '&t=' + Date.now(), { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json' } }).then(function (res) {
    if (!res.ok) return null;
    return res.json();
  }).then(function (data) {
    if (!data) return;
    var currentSha = data.sha;
    if (_lastKnownSha && _lastKnownSha !== currentSha) {
      _lastKnownSha = currentSha;
      var hasUnsaved = (inputEl && inputEl.value.trim()) || editingId;
      if (hasUnsaved) { toast('⚠️ 云端已更新，你有未保存内容'); return; }
      if (confirm('⚠️ 检测到另一台设备更新了数据！点击确定刷新。')) window.location.reload();
    }
    _lastKnownSha = currentSha;
  }).catch(function () {});
}
function restartSyncTimer() {
  if (_syncTimer) clearInterval(_syncTimer);
  if (!db.settings.autoCheckUpdate) return;
  var sec = db.settings.checkIntervalSeconds || 60;
  _syncTimer = setInterval(checkCloudUpdate, sec * 1000);
}
setTimeout(function () {
  var cfg = loadGH();
  if (ghReady(cfg)) {
    var rc = ghRepoConfig('data');
    ghGetRaw(rc, _pathForIndex(cfg)).then(function (f) { if (f) _lastKnownSha = f.sha; }).catch(function () {});
  }
  restartSyncTimer();
}, 3000);

window.loadGH = loadGH; window.saveGH = saveGH; window.ghReady = ghReady;
window.ghRepoConfig = ghRepoConfig; window.ghApiUrl = ghApiUrl;
window.ghGetRaw = ghGetRaw; window.ghPutRaw = ghPutRaw; window.ghDeleteRaw = ghDeleteRaw;
window.ghTreeAll = ghTreeAll;
window.imageSrc = imageSrc; window.imageUrlFromPath = imageUrlFromPath;
window.fetchImageBlobUrl = fetchImageBlobUrl;
window.getShardKey = getShardKey; window.groupItemsByShard = groupItemsByShard;
window.splitShardIfNeeded = splitShardIfNeeded;
window.ghPush = ghPush; window.ghPull = ghPull;
window.migrateFromLegacy = migrateFromLegacy; window.scheduleAutoPush = scheduleAutoPush;
window.ghTest = ghTest; window.fillGHForm = fillGHForm; window.collectGHForm = collectGHForm;
window.restartSyncTimer = restartSyncTimer; window.checkCloudUpdate = checkCloudUpdate;
window.appendLog = appendLog; window.loadLogs = loadLogs;
window.loadDevices = loadDevices; window.registerDevice = registerDevice;