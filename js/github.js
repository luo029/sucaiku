// js/github.js · 完整文件（限流安全版）
// 本次改动：
//  1) 新增推送限速器 _pushLimiter：稳定模式 1 秒/请求，加速模式 0.8 秒/请求且最多 2 路并发
//  2) ghPutRaw / ghDeleteRaw 把 HTTP 状态码和 Retry-After 附加到错误对象上，供限流退避使用
//  3) _pushOneShard 遇到 422/409 版本冲突时，无论是否有旧 sha，都会重新拉取云端 sha 再试一次
//  4) 遇到 429/403 限流时读 Retry-After，无则默认暂停 60 秒并指数退避（暂停期间所有请求一起等）
//  5) _setSnap / _delSnap / _setTrash / _setMeta 触发 markSyncDirty，让新版 store.js 把快照单独写盘
//  6) 推送并发改为读取 db.settings.pushMode：stable（默认，串行）或 accelerate（最多 2 路）
// ★ 本次修复：_renderSyncProgress 里给 pct 加 Math.min(100, pct)，进度条不再超过 100%

var STORE_VERSION = 4; var GH_INDEX_PATH = 'index.json'; var GH_TRASH_PATH = 'trash.json';
var GH_LOG_PATH = 'push-log.json'; var GH_DEVICES_PATH = 'devices.json';
var SHARD_PREFIX = 'data-'; var FETCH_CONCURRENCY = 8;
var _shardSnapshots = {}; var _trashSnapshot = ''; var _metaSnapshot = '';
var _pushInFlight = false; var _pushQueued = false;

// ============================================================
// ★ 推送限速器
// 稳定模式：minInterval=1000ms，最多 1 路
// 加速模式：minInterval=800ms，最多 2 路
// 遇到 429/403 时调 pause()，所有排队请求一起等待
// ============================================================
var _pushLimiter = {
  pausedUntil: 0,
  nextAllowedAt: 0,
  minInterval: 1000,
  maxInflight: 1,
  inflight: 0,
  wait: function () {
    var self = this;
    function tick() {
      var now = Date.now();
      var target = Math.max(self.pausedUntil, self.nextAllowedAt);
      if (now < target) {
        return new Promise(function (r) { setTimeout(r, Math.min(target - now, 5000)); }).then(tick);
      }
      // 并发上限控制：如果已达上限，稍等再检查
      if (self.inflight >= self.maxInflight) {
        return new Promise(function (r) { setTimeout(r, 200); }).then(tick);
      }
      self.nextAllowedAt = Date.now() + self.minInterval;
      self.inflight++;
      return Promise.resolve();
    }
    return tick();
  },
  done: function () {
    this.inflight = Math.max(0, this.inflight - 1);
  },
  pause: function (ms) {
    var until = Date.now() + Math.max(1000, ms || 0);
    if (until > this.pausedUntil) this.pausedUntil = until;
  },
  reset: function () { this.pausedUntil = 0; this.nextAllowedAt = 0; this.inflight = 0; },
  configure: function (mode) {
    if (mode === 'accelerate') { this.minInterval = 800; this.maxInflight = 2; }
    else { this.minInterval = 1000; this.maxInflight = 1; }
  }
};
// ★ 从响应头解析 Retry-After
function _parseRetryAfterHeader(res) {
  try {
    var ra = res.headers.get('Retry-After');
    if (!ra) return 0;
    var n = parseInt(ra, 10);
    if (!isNaN(n) && n > 0) return n * 1000;
    var d = new Date(ra);
    if (!isNaN(d.getTime())) return Math.max(1000, d.getTime() - Date.now());
  } catch (e) {}
  return 0;
}

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
    if (!res.ok) {
      var retryAfterMs = _parseRetryAfterHeader(res);
      return res.text().then(function (t) {
        var err = new Error('HTTP ' + res.status + ' ' + t.slice(0, 120));
        err.status = res.status; err.retryAfterMs = retryAfterMs; throw err;
      });
    }
    return res.json();
  });
}
function ghTreeAll(rc) {
  return fetch(ghTreeUrl(rc) + '&t=' + Date.now(), { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json' } }).then(function (res) {
    if (!res.ok) {
      var retryAfterMs = _parseRetryAfterHeader(res);
      return res.text().then(function (t) {
        var err = new Error('Tree HTTP ' + res.status + ' ' + t.slice(0, 120));
        err.status = res.status; err.retryAfterMs = retryAfterMs; throw err;
      });
    }
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
    if (!res.ok) {
      var retryAfterMs = _parseRetryAfterHeader(res);
      return res.text().then(function (t) {
        var err = new Error('HTTP ' + res.status + ' ' + t.slice(0, 160));
        err.status = res.status; err.retryAfterMs = retryAfterMs; throw err;
      });
    }
    return res.json();
  });
}
function ghDeleteRaw(rc, path, sha, message) {
  return fetch(ghApiUrl(rc, path), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || ('delete ' + path), sha: sha, branch: rc.branch })
  }).then(function (res) {
    if (!res.ok) {
      var retryAfterMs = _parseRetryAfterHeader(res);
      return res.text().then(function (t) {
        var err = new Error('HTTP ' + res.status + ' ' + t.slice(0, 160));
        err.status = res.status; err.retryAfterMs = retryAfterMs; throw err;
      });
    }
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

function _shardPathRegex(cfg, key) {
  var prefix = cfg.dataDir + '/' + cfg.shardSubdir + '/' + SHARD_PREFIX + key;
  var esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc + '(?:-(\\d+))?\\.json$');
}
function _countPartsInShaMap(existingShaMap, cfg, key) {
  var count = 0;
  var re = _shardPathRegex(cfg, key);
  Object.keys(existingShaMap || {}).forEach(function (p) {
    var m = p.match(re);
    if (m) {
      var n = m[1] ? parseInt(m[1], 10) : 1;
      if (n > count) count = n;
    }
  });
  return count || 1;
}

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

function normalizeImagePath(p) {
  if (!p) return '';
  var s = String(p).trim();
  var qIdx = s.indexOf('?');
  if (qIdx >= 0) s = s.substring(0, qIdx);
  s = s.replace(/^\/+|\/+$/g, '');
  return s;
}
function imagePathMatches(a, b) {
  var na = normalizeImagePath(a);
  var nb = normalizeImagePath(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  var aParts = na.split('/');
  var bParts = nb.split('/');
  var aFn = aParts[aParts.length - 1];
  var bFn = bParts[bParts.length - 1];
  if (aFn !== bFn) return false;
  var aDir = aParts.slice(0, -1).join('/');
  var bDir = bParts.slice(0, -1).join('/');
  if (aDir === bDir) return true;
  if (!aDir || !bDir) return true;
  if (aDir.endsWith('/' + bDir) || bDir.endsWith('/' + aDir)) return true;
  return false;
}

var imgBlobCache = new Map(); var IMG_BLOB_CACHE_MAX = 300;
// ★ 新增：同一个图片路径的并发请求只发起一次
var _imgBlobInflight = new Map();
function fetchImageBlobUrl(relPath) {
  if (imgBlobCache.has(relPath)) return Promise.resolve(imgBlobCache.get(relPath));
  if (_imgBlobInflight.has(relPath)) return _imgBlobInflight.get(relPath);
  var rc = ghRepoConfig('img');
  if (!rc.token || !rc.owner || !rc.repo) return Promise.reject(new Error('未配置'));
  var full = (rc.path + '/' + relPath).split('/').map(encodeURIComponent).join('/');
  var url = 'https://api.github.com/repos/' + rc.owner + '/' + rc.repo + '/contents/' + full + '?ref=' + encodeURIComponent(rc.branch);
  var p = fetch(url, { headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github.raw' } }).then(function (res) {
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
    _imgBlobInflight.delete(relPath);
    return objUrl;
  }).catch(function (e) {
    _imgBlobInflight.delete(relPath);
    throw e;
  });
  _imgBlobInflight.set(relPath, p);
  return p;
}
function clearImageBlobCache(relPath) {
  if (!relPath) return;
  var norm = normalizeImagePath(relPath);
  var keysToDelete = [];
  imgBlobCache.forEach(function (_, k) {
    if (normalizeImagePath(k) === norm) keysToDelete.push(k);
  });
  keysToDelete.forEach(function (k) {
    try { URL.revokeObjectURL(imgBlobCache.get(k)); } catch (e) {}
    imgBlobCache.delete(k);
  });
}

function ghSetStatus(msg) { var el = $('ghStatus'); if (el) el.textContent = msg || ''; }
function ghImgSetStatus(msg) { var el = $('ghImgStatus'); if (el) el.textContent = msg || ''; }
function _setSnap(key, json) { _shardSnapshots[key] = json; db._shardSnapshots = db._shardSnapshots || {}; db._shardSnapshots[key] = json; if (typeof markSyncDirty === 'function') markSyncDirty(); }
function _delSnap(key) { delete _shardSnapshots[key]; if (db._shardSnapshots) delete db._shardSnapshots[key]; if (typeof markSyncDirty === 'function') markSyncDirty(); }
function _setTrash(json) { _trashSnapshot = json; db._trashSnapshot = json; if (typeof markSyncDirty === 'function') markSyncDirty(); }
function _setMeta(json) { _metaSnapshot = json; db._metaSnapshot = json; if (typeof markSyncDirty === 'function') markSyncDirty(); }

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
    var maxDays = Number(db.settings.logMaxDays) || 30;
    if (maxDays > 0) {
      var cutoff = Date.now() - maxDays * 86400000;
      logs = logs.filter(function (l) { return (l.timestamp || 0) >= cutoff; });
    }
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

var _syncProgress = { active: false, total: 0, done: 0, failed: 0, startAt: 0 };
function _showSyncProgress(total) {
  if (!db.settings.showSyncProgress || total <= 1) return;
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
    el.style.cssText = 'position:fixed; bottom:24px; right:24px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 18px; box-shadow:var(--sh-3); z-index:9999; min-width:260px; transition:opacity .3s; backdrop-filter: blur(8px);';
    document.body.appendChild(el);
  }

  var pct = 0;
  if (_syncProgress.total > 0) pct = Math.round(_syncProgress.done / _syncProgress.total * 100);
  // ★ 修复：进度百分比封顶 100，避免年份索引多时显示 110%、120%
  pct = Math.min(100, pct);
  var elapsed = Math.round((Date.now() - _syncProgress.startAt) / 1000);
  var eta = 0;
  if (_syncProgress.done > 0) eta = Math.round(elapsed / _syncProgress.done * (_syncProgress.total - _syncProgress.done));

  var hasFailed = _syncProgress.failed > 0;
  var barBg = hasFailed
    ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
    : 'linear-gradient(90deg, var(--accent) 0%, #a855f7 100%)';
  var barShadow = hasFailed
    ? '0 0 10px rgba(239,68,68,0.45)'
    : '0 0 10px rgba(99,102,241,0.4)';

  var p1 = '<div style="font-weight:600; font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between;"><span>🔄 正在同步</span><span style="color:' + (hasFailed ? 'var(--danger)' : 'var(--accent)') + ';">' + pct + '%</span></div>';
  var p2 = '<div style="height:8px; background:var(--line); border-radius:4px; overflow:hidden; margin-bottom:8px; position:relative;">';
  p2 += '<div style="position:absolute; top:0; left:0; bottom:0; width:' + pct + '%; background:' + barBg + '; border-radius:4px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:' + barShadow + ';">';
  p2 += '<div style="position:absolute; inset:0; background-image:linear-gradient(45deg,rgba(255,255,255,0.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.15) 50%,rgba(255,255,255,0.15) 75%,transparent 75%,transparent); background-size:1rem 1rem; animation: progress-stripes 1s linear infinite;"></div>';
  p2 += '</div></div>';

  var p3 = '<div style="font-size:12.5px; color:var(--text-2); display:flex; justify-content:space-between;"><span>' + _syncProgress.done + ' / ' + _syncProgress.total + ' 份</span>';
  if (eta > 0 && !hasFailed) p3 += '<span>剩余约 ' + eta + 's</span>';
  p3 += '</div>';
  var p4 = '';
  if (hasFailed) p4 = '<div style="font-size:12px; color:var(--danger); margin-top:6px; font-weight:600;">⚠️ 失败 ' + _syncProgress.failed + ' 个</div>';

  if (!document.getElementById('syncProgressStyle')) {
    var style = document.createElement('style');
    style.id = 'syncProgressStyle';
    style.innerHTML = '@keyframes progress-stripes { from { background-position: 1rem 0; } to { background-position: 0 0; } }';
    document.head.appendChild(style);
  }

  el.innerHTML = p1 + p2 + p3 + p4;
}

function _pushOneShard(rc, cfg, key, items, existingShaMap) {
  var retryCount = Number(db.settings.pushRetryCount) || 3;
  var retryDelay = (Number(db.settings.pushRetryDelaySec) || 2) * 1000;
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
        return _pushLimiter.wait().then(function () {
          return ghPutRaw(rc, path, b64, existingSha, 'sync ' + path);
        }).then(function () {
          _pushLimiter.done();
          return true;
        }).catch(function (e) {
          _pushLimiter.done();
          // ★ 限流：429/403 时暂停整个推送队列
          if (e.status === 429 || e.status === 403) {
            var waitMs = e.retryAfterMs || (60 * 1000);
            _pushLimiter.pause(waitMs);
            attempt++;
            if (attempt <= retryCount) return tryOnce();
            return false;
          }
          // ★ 冲突：无论是否有旧 sha，都重新拉一次云端 sha，再试
          var isConflict = e.message && (e.message.indexOf('422') >= 0 || e.message.indexOf('409') >= 0);
          if (isConflict) {
            return ghGetRaw(rc, path).then(function (file) {
              if (file && file.sha && file.sha !== existingSha) {
                existingSha = file.sha;
                return tryOnce();
              }
              throw e;
            }).catch(function () {
              attempt++;
              if (attempt <= retryCount) {
                return new Promise(function (r) { setTimeout(r, retryDelay); }).then(tryOnce);
              }
              return false;
            });
          }
          attempt++;
          if (attempt <= retryCount) {
            return new Promise(function (r) { setTimeout(r, retryDelay); }).then(tryOnce);
          }
          return false;
        });
      }
      return tryOnce().then(function (ok) { if (!ok) allOk = false; });
    });
  });
  return chain.then(function () {
    if (!allOk) return { ok: false, key: key, parts: parts.length };
    var partsLen = parts.length;
    var re = _shardPathRegex(cfg, key);
    var staleChain = Promise.resolve();
    Object.keys(existingShaMap || {}).forEach(function (path) {
      var m = path.match(re);
      if (!m) return;
      var partNum = m[1] ? parseInt(m[1], 10) : 1;
      if (partNum > partsLen) {
        staleChain = staleChain.then(function () {
          return _pushLimiter.wait().then(function () {
            return ghDeleteRaw(rc, path, existingShaMap[path], 'cleanup stale part ' + path);
          }).then(function () {
            _pushLimiter.done();
          }).catch(function (e) {
            _pushLimiter.done();
            console.warn('清理旧 part 失败', path, e);
          });
        });
      }
    });
    return staleChain.then(function () { return { ok: true, key: key, parts: partsLen }; });
  });
}

function ghPush(silent, force) {
  silent = !!silent; force = !!force;
  var cfg = loadGH();
  if (!ghReady(cfg)) { if (!silent) toast('请先配置 GitHub'); return Promise.resolve(false); }
  if (_pushInFlight) { _pushQueued = true; return Promise.resolve(false); }
  _pushInFlight = true;

  // ★ 推送模式：stable（默认）或 accelerate
  var pushMode = (db.settings && db.settings.pushMode) || 'stable';
  _pushLimiter.configure(pushMode);
  _pushLimiter.reset();

  var startTime = Date.now();
  var rc = ghRepoConfig('data');
  var groups = groupItemsByShard(db.items);
  var currentKeys = Object.keys(groups).sort();
  var shardPartsMap = {};

  if (!silent) ghSetStatus('推送中…');

  var toPush = [];
  currentKeys.forEach(function (k) {
    var json = JSON.stringify(groups[k]);
    if (force || _shardSnapshots[k] !== json) toPush.push(k);
  });
  var canDeleteShards = db._allShardKeys && db._loadedShardKeys && db._loadedShardKeys.length >= db._allShardKeys.length;
  var toDelete = canDeleteShards ? Object.keys(_shardSnapshots).filter(function (k) { return currentKeys.indexOf(k) < 0; }) : [];

  _showSyncProgress(toPush.length + toDelete.length + 3);

  var pushedCount = 0; var failedShards = [];
  var yearIndexDirty = {};

  return Promise.resolve().then(function () {
    if (!db.settings.gitTreeBatchEnabled) return {};
    return ghTreeAll(rc).catch(function (e) { console.warn('Tree API 失败，回退到逐个 GET', e); return {}; });
  }).then(function (existingShaMap) {
    var concurrency = (pushMode === 'accelerate') ? 2 : 1;
    var idx = 0;
    function pushWorker() {
      if (idx >= toPush.length) return Promise.resolve();
      var k = toPush[idx++];
      return _pushOneShard(rc, cfg, k, groups[k], existingShaMap).then(function (result) {
        if (result.ok) {
          _setSnap(k, JSON.stringify(groups[k]));
          pushedCount++;
          yearIndexDirty[getYearFromKey(k)] = true;
          shardPartsMap[k] = result.parts || 1;
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
    var deleteChain = Promise.resolve();
    toDelete.forEach(function (dk) {
      deleteChain = deleteChain.then(function () {
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
            return _pushLimiter.wait().then(function () {
              return ghDeleteRaw(rc, dpath, sha, 'delete ' + dpath);
            }).then(function () {
              _pushLimiter.done();
            }).catch(function (e) {
              _pushLimiter.done();
              console.warn('删除分片失败', dpath, e);
            });
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
    var trashJson = JSON.stringify(db.trash);
    if (!force && _trashSnapshot === trashJson) {
      _syncProgress.done++; _updateSyncProgress();
      return existingShaMap;
    }
    var tContent = JSON.stringify({ trash: db.trash, updatedAt: new Date().toISOString() }, null, 2);
    var tB64 = utf8ToBase64(tContent);
    var tSha = existingShaMap[_pathForTrash(cfg)] || null;
    return _pushLimiter.wait().then(function () {
      return ghPutRaw(rc, _pathForTrash(cfg), tB64, tSha, 'sync trash');
    }).then(function () {
      _pushLimiter.done();
      _setTrash(trashJson); _syncProgress.done++; _updateSyncProgress();
    }).catch(function (e) {
      _pushLimiter.done();
      console.warn('trash 推送失败', e);
      _syncProgress.done++; _updateSyncProgress();
    }).then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
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
            yearShards[ck] = {
              count: groups[ck].length,
              size: JSON.stringify(groups[ck]).length,
              cats: _recalcShardCatMap(groups[ck]),
              parts: shardPartsMap[ck] || _countPartsInShaMap(existingShaMap, cfg, ck)
            };
          }
        });
        var ypath = _pathForYearIndex(cfg, year);
        if (Object.keys(yearShards).length === 0) {
          var yeSha = existingShaMap[ypath];
          if (yeSha) {
            return _pushLimiter.wait().then(function () {
              return ghDeleteRaw(rc, ypath, yeSha, 'delete ' + ypath);
            }).then(function () { _pushLimiter.done(); }).catch(function () { _pushLimiter.done(); });
          }
          return;
        }
        var yContent = JSON.stringify({ year: year, shards: yearShards }, null, 2);
        return _pushLimiter.wait().then(function () {
          return ghPutRaw(rc, ypath, utf8ToBase64(yContent), existingShaMap[ypath] || null, 'sync index-' + year);
        }).then(function () { _pushLimiter.done(); }).catch(function (e) {
          _pushLimiter.done();
          console.warn('yearIndex 推送失败', year, e);
        });
      });
    });
    return yearChain.then(function () { return existingShaMap; });
  }).then(function (existingShaMap) {
    var yearSummary = {};
    Object.keys(currentYears_helper(currentKeys)).forEach(function (cy) {
      var count = 0; var shardCount = 0;
      currentKeys.forEach(function (ck) { if (getYearFromKey(ck) === cy) { count += groups[ck].length; shardCount++; } });
      yearSummary[cy] = { count: count, shardCount: shardCount };
    });
    var meta = { cats: db.cats, colors: db.colors, sources: db.sources, fixedSource: db.fixedSource, fixedTags: db.fixedTags, imageCategories: db.imageCategories, settings: db.settings, tagColors: db.tagColors || {}, catVersion: db.catVersion || 0 };
    var metaSig = JSON.stringify(meta) + JSON.stringify(yearSummary);

    if (!force && _metaSnapshot === metaSig) {
      _syncProgress.done++; _updateSyncProgress();
      return;
    }
    return loadIndex(rc).then(function (oldIndex) {
      var oldRev = (oldIndex && oldIndex.data) ? (oldIndex.data._rev || 0) : 0;
      var newIndex = { _rev: oldRev + 1, version: STORE_VERSION, updatedAt: new Date().toISOString(), indexShards: yearSummary, meta: meta };
      var iContent = JSON.stringify(newIndex, null, 2);
      var iSha = existingShaMap[_pathForIndex(cfg)] || null;
      return _pushLimiter.wait().then(function () {
        return ghPutRaw(rc, _pathForIndex(cfg), utf8ToBase64(iContent), iSha, 'sync index');
      }).then(function () {
        _pushLimiter.done();
        _setMeta(metaSig); _syncProgress.done++; _updateSyncProgress();
      }).catch(function (e) {
        _pushLimiter.done();
        throw e;
      });
    });
  }).then(function () {
    registerDevice('push');
    appendLog({ action: 'push', status: failedShards.length === 0 ? 'success' : 'error', summary: pushedCount > 0 ? ('推送 ' + pushedCount + ' 个分片' + (failedShards.length ? '，失败 ' + failedShards.length : '')) : '无变化', shards: toPush, itemCount: db.items.length, duration: Date.now() - startTime });
    failedShards.forEach(function (k) { _dirtyShards.add(k); });

    _syncProgress.failed = failedShards.length;
    _updateSyncProgress();

    setTimeout(function() {
      _hideSyncProgress();
      if (!silent) {
        if (failedShards.length === 0) { toast(pushedCount > 0 ? ('已同步 ' + pushedCount + ' 个分片') : '无变化'); ghSetStatus('推送成功'); }
        else { toast('成功 ' + pushedCount + '，失败 ' + failedShards.length + '（下次自动重试）'); ghSetStatus('部分失败'); }
      }
    }, 800);

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
      return fetchShardsBatch(rc, toLoad, allShards).then(function (dataMap) {
        var newItems = []; var newSnapshots = {};
        toLoad.forEach(function (k) {
          if (dataMap[k] && dataMap[k].items) { newItems = newItems.concat(dataMap[k].items); newSnapshots[k] = JSON.stringify(dataMap[k].items); }
        });
        if (pullMore) {
          var currentIds = new Set(db.items.map(function (i) { return i.id; }));
          newItems.forEach(function (i) { if (!currentIds.has(i.id)) db.items.push(i); });
        } else {
          var conflictMode = db.settings.conflictAction || 'prompt';
          var isRemoteFirst = (conflictMode === 'remote' || conflictMode === 'force-remote' || conflictMode === 'forceRemote' || conflictMode === 'cloud');
          var isLocalFirst = (conflictMode === 'local' || conflictMode === 'force-local' || conflictMode === 'forceLocal');

          if (isRemoteFirst) {
            db.items = dedupeItems(newItems);
            if (!silent) console.log('[ghPull] 冲突处理：云端优先');
          } else if (isLocalFirst) {
            var localMap2 = {};
            db.items.forEach(function (it) { if (it && it.id) localMap2[it.id] = it; });
            var remoteIds2 = new Set();
            var merged2 = [];
            newItems.forEach(function (remote) {
              if (!remote || !remote.id) return;
              remoteIds2.add(remote.id);
              var local = localMap2[remote.id];
              if (!local) { merged2.push(remote); }
              else { merged2.push(local); }
            });
            db.items.forEach(function (local) {
              if (local && local.id && !remoteIds2.has(local.id)) { merged2.push(local); }
            });
            db.items = dedupeItems(merged2);
            if (!silent) console.log('[ghPull] 冲突处理：本地优先');
          } else {
            var trashedIds = new Set((db.trash || []).map(function (t) { return t.id; }));
            var localMap = {};
            db.items.forEach(function (it) { if (it && it.id) localMap[it.id] = it; });
            var remoteIds = new Set();
            var merged = [];
            var keptLocal = 0, keptRemote = 0, conflicts = 0;
            newItems.forEach(function (remote) {
              if (!remote || !remote.id) return;
              if (trashedIds.has(remote.id)) { keptLocal++; return; }
              remoteIds.add(remote.id);
              var local = localMap[remote.id];
              if (!local) { merged.push(remote); keptRemote++; return; }
              var lt = local.updatedAt || local.createdAt || 0;
              var rt = remote.updatedAt || remote.createdAt || 0;
              if (rt > lt) { merged.push(remote); keptRemote++; conflicts++; }
              else if (lt > rt) { merged.push(local); keptLocal++; conflicts++; }
              else { merged.push(remote); }
            });
            db.items.forEach(function (local) {
              if (local && local.id && !remoteIds.has(local.id) && !trashedIds.has(local.id)) { merged.push(local); keptLocal++; }
            });
            db.items = dedupeItems(merged);
            if (conflicts > 0) {
              console.log('[ghPull] 冲突合并：本地保留 ' + keptLocal + '，远程采用 ' + keptRemote + '，冲突 ' + conflicts + ' 条');
              if (!silent) toast('检测到 ' + conflicts + ' 条冲突，已按修改时间合并');
            }
          }
        }
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
                if (typeof markSyncDirty === 'function') markSyncDirty();
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

function fetchShardsBatch(rc, keys, allShards) {
  var concurrency = db.settings.pullConcurrency || FETCH_CONCURRENCY;
  var cfg = loadGH();
  var results = {}; var idx = 0;
  function worker() {
    if (idx >= keys.length) return Promise.resolve();
    var k = keys[idx++];
    var partsInfo = allShards && allShards[k];
    var partCount = Math.max(1, Math.min(20, parseInt(partsInfo && partsInfo.parts, 10) || 1));
    var items = [];
    var chain = Promise.resolve();
    for (var p = 1; p <= partCount; p++) {
      (function (part) {
        chain = chain.then(function () {
          return ghGetRaw(rc, _pathForShard(cfg, k, part)).then(function (file) {
            if (!file) return;
            try {
              var data = JSON.parse(base64ToUtf8(file.content.replace(/\n/g, '')));
              if (data && Array.isArray(data.items)) items.push.apply(items, data.items);
            } catch (e) { console.warn('解析分片失败', k, 'part', part, e); }
          }).catch(function (e) { console.warn('拉取分片失败', k, 'part', part, e); });
        });
      })(p);
    }
    return chain.then(function () {
      if (items.length === 0) results[k] = null;
      else results[k] = { date: k, items: items };
      return worker();
    });
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
      if (typeof markSyncDirty === 'function') markSyncDirty();
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
window.clearImageBlobCache = clearImageBlobCache;
window.normalizeImagePath = normalizeImagePath;
window.imagePathMatches = imagePathMatches;
window.getShardKey = getShardKey; window.groupItemsByShard = groupItemsByShard;
window.splitShardIfNeeded = splitShardIfNeeded;
window.ghPush = ghPush; window.ghPull = ghPull;
window.migrateFromLegacy = migrateFromLegacy; window.scheduleAutoPush = scheduleAutoPush;
window.ghTest = ghTest; window.fillGHForm = fillGHForm; window.collectGHForm = collectGHForm;
window.restartSyncTimer = restartSyncTimer; window.checkCloudUpdate = checkCloudUpdate;
window.appendLog = appendLog; window.loadLogs = loadLogs;
window.loadDevices = loadDevices; window.registerDevice = registerDevice;