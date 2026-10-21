// js/snapshots.js · 完整文件
// ★ 本次改动：_shouldCreateSnapshot 里的 lastDate 改用本地时区格式化（原来用 toISOString 是 UTC，
//   会导致"距上次快照天数"判断在非 UTC 时区出错，例如北京时间比 UTC 早 8 小时）
//   其余逻辑保留

// ★ 本地日期格式化（优先用 store.js 暴露的 window._localDateStr，兼容旧版本）
function _fmtLocalDate(ts) {
  if (typeof window._localDateStr === 'function') return window._localDateStr(ts);
  var d = new Date(ts || Date.now());
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _shouldCreateSnapshot() {
  if (!db.settings.snapshotEnabled) return false;
  var now = new Date();
  var lastAt = Number(db.settings.lastSnapshotAt) || 0;
  var daysSinceLast = (Date.now() - lastAt) / 86400000;

  // 1. 距上次超过强制天数
  var forceDays = Math.max(1, Number(db.settings.snapshotForceDays) || 7);
  if (lastAt === 0 || daysSinceLast >= forceDays) return 'force';

  // 2. 今天变更超过阈值
  var today = _fmtLocalDate(Date.now());
  var lastDate = lastAt ? _fmtLocalDate(lastAt) : '';
  var changesToday = 0;
  try {
    var changeLog = JSON.parse(localStorage.getItem('material-library.snapshot-changes') || '{}');
    changesToday = changeLog[today] || 0;
  } catch (e) {}
  var threshold = Math.max(10, Number(db.settings.snapshotChangeThreshold) || 100);
  if (changesToday >= threshold && lastDate !== today) return 'threshold';

  // 3. 周日 / 周一 / 1 号
  if (now.getDay() === 0 && lastDate !== today) return 'weekly';
  if (now.getDate() === 1 && lastDate !== today) return 'monthly';

  return false;
}

// 记录当天变更数（在 save() 时调用）
function _recordSnapshotChange() {
  try {
    var dayStr = _fmtLocalDate(Date.now());
    var changeLog = JSON.parse(localStorage.getItem('material-library.snapshot-changes') || '{}');
    changeLog[dayStr] = (changeLog[dayStr] || 0) + 1;
    // 只保留最近 30 天
    var keys = Object.keys(changeLog).sort();
    if (keys.length > 30) {
      keys.slice(0, keys.length - 30).forEach(function (k) { delete changeLog[k]; });
    }
    localStorage.setItem('material-library.snapshot-changes', JSON.stringify(changeLog));
  } catch (e) {}
}

// 主入口：判断是否需要打快照
async function maybeCreateSnapshot() {
  var reason = _shouldCreateSnapshot();
  if (!reason) return null;
  return createSnapshot(reason);
}

// ============================================================
// 创建快照
// ============================================================
async function createSnapshot(kind) {
  kind = kind || 'manual';
  if (!db.items.length) { toast('没有素材，跳过快照'); return null; }
  var cfg = loadGH();
  if (!ghReady(cfg)) { toast('请先配置 GitHub'); return null; }

  var rc = ghRepoConfig('data');
  var path = await _buildSnapshotPath(cfg, kind);
  var payload = _buildSnapshotPayload(kind);
  var jsonStr = JSON.stringify(payload);

  toast('正在创建快照 (' + _fmtSnapshotKind(kind) + ')…');

  var content, ext;
  if (db.settings.snapshotCompress) {
    var compressed = await _gzipString(jsonStr);
    if (compressed) { content = compressed; ext = '.json.gz'; }
    else { content = jsonStr; ext = '.json'; }
  } else { content = jsonStr; ext = '.json'; }

  var fullPath = path + ext;

  try {
    // 检查已存在
    var existing = await ghGetRaw(rc, fullPath);
    var b64;
    if (typeof content === 'string') b64 = utf8ToBase64(content);
    else b64 = await _arrayBufferToBase64(content);

    await ghPutRaw(rc, fullPath, b64, existing ? existing.sha : null, 'snapshot ' + kind + ' ' + fullPath);
    db.settings.lastSnapshotAt = Date.now();
    saveSettings();
    appendLog({ action: 'snapshot', status: 'success', summary: '创建快照（' + _fmtSnapshotKind(kind) + '）：' + fullPath, itemCount: db.items.length });
    toast('✅ 快照已创建：' + fullPath);
    // 清理过期快照
    if (db.settings.snapshotAutoCleanup) cleanupOldSnapshots().catch(function (e) { console.warn('快照清理失败', e); });
    return fullPath;
  } catch (e) {
    console.error('快照创建失败', e);
    appendLog({ action: 'snapshot', status: 'error', summary: '快照失败：' + e.message });
    toast('快照失败：' + e.message);
    return null;
  }
}

function _buildSnapshotPath(cfg, kind) {
  var base = (db.settings.snapshotPath || 'snapshots/').replace(/\/$/, '') + '/';
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var hms = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  var name;
  if (kind === 'manual') name = 'manual-' + y + m + d + '-' + hms;
  else name = kind + '-' + y + m + d + (kind === 'force' ? '-' + hms : '');
  return cfg.dataDir + '/' + base + name;
}

function _buildSnapshotPayload(kind) {
  return {
    _schema: 'snapshot-v1',
    kind: kind,
    createdAt: Date.now(),
    rev: db._rev,
    catVersion: db.catVersion || 0,
    items: db.items,
    cats: db.cats,
    colors: db.colors,
    sources: db.sources,
    fixedSource: db.fixedSource,
    fixedTags: db.fixedTags,
    imageCategories: db.imageCategories,
    tagColors: db.tagColors || {},
    trash: db.trash
  };
}

function _fmtSnapshotKind(kind) {
  return { daily: '日快照', weekly: '周快照', monthly: '月快照', manual: '手动', force: '强制' }[kind] || kind;
}

// ============================================================
// gzip 压缩（用 CompressionStream，不支持则回退不压缩）
// ============================================================
function _gzipString(str) {
  if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
  try {
    var blob = new Blob([str], { type: 'application/json' });
    var stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  } catch (e) { return Promise.resolve(null); }
}

function _gunzipBuffer(buf) {
  if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
  try {
    var blob = new Blob([buf]);
    var stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  } catch (e) { return Promise.resolve(null); }
}

function _arrayBufferToBase64(buf) {
  return new Promise(function (resolve, reject) {
    var blob = new Blob([buf]);
    var r = new FileReader();
    r.onload = function () { var s = String(r.result); resolve(s.split(',')[1] || ''); };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function _base64ToArrayBuffer(b64) {
  var bin = atob(b64);
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ============================================================
// 列出所有快照
// ============================================================
async function listSnapshots() {
  var cfg = loadGH();
  if (!ghReady(cfg)) return [];
  var rc = ghRepoConfig('data');
  var base = (db.settings.snapshotPath || 'snapshots/').replace(/\/$/, '') + '/';
  var fullBase = cfg.dataDir + '/' + base;

  try {
    var shaMap = await ghTreeAll(rc);
    var files = Object.keys(shaMap).filter(function (p) {
      return p.indexOf(fullBase) === 0 && /\.json(\.gz)?$/.test(p);
    });
    return files.map(function (p) {
      var name = p.substring(fullBase.length);
      var m = name.match(/^(daily|weekly|monthly|manual|force)-(\d{4})(\d{2})(\d{2})(?:-(\d{2})(\d{2})(\d{2}))?/);
      var kind = m ? m[1] : 'unknown';
      var dateStr = m ? (m[2] + '-' + m[3] + '-' + m[4] + (m[5] ? ' ' + m[5] + ':' + m[6] + ':' + m[7] : '')) : '';
      return { path: p, name: name, kind: kind, date: dateStr, sha: shaMap[p], compressed: name.endsWith('.gz') };
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  } catch (e) {
    console.error('列出快照失败', e);
    return [];
  }
}

// ============================================================
// 清理过期快照
// ============================================================
async function cleanupOldSnapshots() {
  if (!db.settings.snapshotAutoCleanup) return 0;
  var all = await listSnapshots();
  if (!all.length) return 0;

  var cfg = loadGH();
  var rc = ghRepoConfig('data');
  var maxAgeDays = Math.max(30, Number(db.settings.snapshotMaxAgeDays) || 180);
  var cutoff = Date.now() - maxAgeDays * 86400000;

  var byKind = { daily: [], weekly: [], monthly: [], manual: [], force: [], unknown: [] };
  all.forEach(function (s) { (byKind[s.kind] || byKind.unknown).push(s); });

  var toDelete = [];
  var keepMap = {
    daily: Math.max(0, Number(db.settings.snapshotDailyKeep) || 0),
    weekly: Math.max(0, Number(db.settings.snapshotWeeklyKeep) || 0),
    monthly: Math.max(0, Number(db.settings.snapshotMonthlyKeep) || 0),
    manual: Math.max(0, Number(db.settings.snapshotManualKeep) || 10),
    force: Math.max(0, Number(db.settings.snapshotManualKeep) || 10),
    unknown: 3
  };

  Object.keys(byKind).forEach(function (kind) {
    var list = byKind[kind];
    var keep = keepMap[kind] || 0;
    list.forEach(function (s, idx) {
      if (idx >= keep) toDelete.push(s);
      else {
        var t = new Date(s.date.replace(' ', 'T')).getTime();
        if (t && t < cutoff) toDelete.push(s);
      }
    });
  });

  // 每次最多删 20 个
  toDelete = toDelete.slice(0, 20);
  var deleted = 0;
  for (var i = 0; i < toDelete.length; i++) {
    try {
      await ghDeleteRaw(rc, toDelete[i].path, toDelete[i].sha, 'cleanup snapshot ' + toDelete[i].name);
      deleted++;
      await new Promise(function (r) { setTimeout(r, 200); });
    } catch (e) { console.warn('删除快照失败', toDelete[i].path, e); }
  }
  if (deleted > 0) {
    appendLog({ action: 'snapshot', status: 'success', summary: '清理 ' + deleted + ' 份过期快照' });
    console.log('[snapshot] 清理了', deleted, '份过期快照');
  }
  return deleted;
}

// ============================================================
// 恢复快照
// ============================================================
async function restoreSnapshot(path) {
  var cfg = loadGH();
  var rc = ghRepoConfig('data');
  var file = await ghGetRaw(rc, path);
  if (!file) throw new Error('快照文件不存在');

  var rawStr;
  if (path.endsWith('.gz')) {
    var buf = _base64ToArrayBuffer(file.content.replace(/\n/g, ''));
    rawStr = await _gunzipBuffer(buf);
    if (!rawStr) throw new Error('浏览器不支持 gzip 解压，请用 Chrome/Safari 16.4+');
  } else {
    rawStr = base64ToUtf8(file.content.replace(/\n/g, ''));
  }

  var payload = JSON.parse(rawStr);
  if (!payload || !Array.isArray(payload.items)) throw new Error('快照格式错误');

  suppressPush = true;
  applyLoadedData({
    items: payload.items,
    cats: payload.cats || DEFAULT_CATS,
    colors: payload.colors || {},
    sources: payload.sources || [],
    fixedSource: payload.fixedSource || '',
    fixedTags: payload.fixedTags || [],
    imageCategories: payload.imageCategories || DEFAULT_IMG_CATS,
    tagColors: payload.tagColors || {},
    trash: payload.trash || [],
    _rev: payload.rev || 0,
    catVersion: payload.catVersion || 0
  });
  db.items.forEach(function (i) { i.images = normalizeImages(i.images); });
  markNeedNormalize(); normalize();
  markIndexDirty(); markAllShardsDirty();
  await saveImmediate();
  suppressPush = false;
  render();
  appendLog({ action: 'snapshot', status: 'success', summary: '从快照恢复：' + path, itemCount: db.items.length });
  toast('✅ 已恢复到快照（' + new Date(payload.createdAt).toLocaleString() + '）');
}

// ============================================================
// UI：快照列表视图
// ============================================================
async function openSnapshotListView() {
  var mask = document.getElementById('snapshotListMask');
  if (!mask) return;
  mask.classList.add('show');
  renderSnapshotsList();
}

async function renderSnapshotsList() {
  var content = document.getElementById('snapshotListContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-3);">正在加载快照列表…</div>';
  var list = await listSnapshots();
  if (!list.length) {
    content.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-3);">还没有快照，可点击设置中「立即打快照」创建</div>';
    return;
  }
  content.innerHTML = list.map(function (s) {
    return '<div style="border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:10px; background:var(--bg);">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">'
      + '<div><span class="tag" style="background:var(--accent-soft); color:var(--accent); font-size:11px; padding:2px 8px; border-radius:6px; margin-right:8px;">' + _fmtSnapshotKind(s.kind) + '</span>'
      + '<span style="font-size:13px; color:var(--text-2);">' + esc(s.date || s.name) + (s.compressed ? ' <span style="opacity:0.6; font-size:11px;">gz</span>' : '') + '</span></div>'
      + '<div style="display:flex; gap:8px;"><button class="btn tiny" data-restore-snap="' + esc(s.path) + '">恢复</button><button class="btn tiny danger" data-del-snap="' + esc(s.path) + '" data-sha="' + esc(s.sha) + '">删除</button></div>'
      + '</div>'
      + '<div style="font-size:11.5px; color:var(--text-3); margin-top:6px; word-break:break-all;">' + esc(s.path) + '</div>'
      + '</div>';
  }).join('');

  content.querySelectorAll('[data-restore-snap]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var path = btn.dataset.restoreSnap;
      window.showCustomConfirm({
        title: '恢复快照',
        desc: '这会用快照覆盖当前所有素材。\n\n快照：' + path + '\n\n确定继续？',
        isDanger: true,
        onConfirm: async function () {
          try { await restoreSnapshot(path); document.getElementById('snapshotListMask').classList.remove('show'); }
          catch (e) { toast('恢复失败：' + e.message); }
        }
      });
    });
  });
  content.querySelectorAll('[data-del-snap]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var path = btn.dataset.delSnap, sha = btn.dataset.sha;
      window.showCustomConfirm({
        title: '删除快照', desc: '确定删除快照 ' + path + '？', isDanger: true,
        onConfirm: async function () {
          try {
            var rc = ghRepoConfig('data');
            await ghDeleteRaw(rc, path, sha, 'delete snapshot ' + path);
            toast('已删除');
            renderSnapshotsList();
          } catch (e) { toast('删除失败：' + e.message); }
        }
      });
    });
  });
}

// ============================================================
// 事件绑定
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  var closeBtn = document.getElementById('snapshotListClose');
  if (closeBtn) closeBtn.addEventListener('click', function () { document.getElementById('snapshotListMask').classList.remove('show'); });
  var refreshBtn = document.getElementById('snapshotRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', renderSnapshotsList);
});

window.maybeCreateSnapshot = maybeCreateSnapshot;
window.createSnapshot = createSnapshot;
window.listSnapshots = listSnapshots;
window.cleanupOldSnapshots = cleanupOldSnapshots;
window.restoreSnapshot = restoreSnapshot;
window.openSnapshotListView = openSnapshotListView;
window.renderSnapshotsList = renderSnapshotsList;
window._recordSnapshotChange = _recordSnapshotChange;