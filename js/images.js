// js/images.js · 完整文件
// ★ Bug G 修复：上传 promise 链末尾加 .catch/.finally，即使中间某步抛错也能复位 uploadInProgress

var webpSupported = false;
try { webpSupported = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) {}

var ORPHAN_KEY = 'material-library.orphan-imgs';

function recordOrphanImage(path) {
  if (!path) return;
  try {
    var list = JSON.parse(localStorage.getItem(ORPHAN_KEY) || '[]');
    list = list.filter(function (x) { return x && x.path !== path; });
    list.push({ path: path, time: Date.now() });
    if (list.length > 500) list = list.slice(list.length - 500);
    localStorage.setItem(ORPHAN_KEY, JSON.stringify(list));
  } catch (e) { console.warn('记录孤儿图片失败', e); }
}

function clearOrphanImage(paths) {
  if (!paths || !paths.length) return;
  try {
    var set = new Set(paths.map(function (p) { return String(p || '').trim(); }).filter(Boolean));
    if (!set.size) return;
    var list = JSON.parse(localStorage.getItem(ORPHAN_KEY) || '[]');
    list = list.filter(function (x) { return x && !set.has(String(x.path || '').trim()); });
    localStorage.setItem(ORPHAN_KEY, JSON.stringify(list));
  } catch (e) { console.warn('清理孤儿图片失败', e); }
}

window.recordOrphanImage = recordOrphanImage;
window.clearOrphanImage = clearOrphanImage;

function tinifyCompress(file, apiKey, proxyUrl) {
  var auth = 'Basic ' + btoa('api:' + apiKey);
  var target = 'https://api.tinify.com/shrink';
  var proxy = (proxyUrl || '').trim();
  var url = proxy || target;
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  }).then(function (res) {
    if (!res.ok) {
      if (res.status === 429) throw new Error('TinyPNG 本月额度已用完');
      if (res.status === 401) throw new Error('TinyPNG API Key 无效');
      throw new Error('TinyPNG HTTP ' + res.status);
    }
    if (proxy) {
      return res.blob().then(function (blob) {
        if (blob.type.indexOf('image/') !== 0) {
          return blob.text().then(function (text) { throw new Error('代理返回非图片内容: ' + text.slice(0, 50)); });
        }
        return { blob: blob, origSize: file.size, newSize: blob.size, via: 'tinypng' };
      });
    }
    var location = res.headers.get('Location');
    return res.json().catch(function () { return {}; }).then(function (body) {
      var outUrl = location || (body && body.output && body.output.url);
      if (!outUrl) throw new Error('TinyPNG 未返回压缩地址');
      return fetch(outUrl).then(function (outRes) {
        if (!outRes.ok) throw new Error('下载压缩图失败 HTTP ' + outRes.status);
        return outRes.blob();
      }).then(function (blob) { return { blob: blob, origSize: file.size, newSize: blob.size, via: 'tinypng' }; });
    });
  });
}

function canvasCompress(file, maxDim, quality) {
  maxDim = maxDim || 1920; quality = quality || 0.85;
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      var origW = img.width, origH = img.height;
      var shortSide = Math.min(origW, origH), longSide = Math.max(origW, origH);
      var aspect = longSide / shortSide, isLongImage = aspect >= 2, scale = 1;
      if (isLongImage) {
        var SHORT_MIN = 720, LONG_MAX = 12000, MAX_PIXELS = 12 * 1000 * 1000;
        if (longSide > LONG_MAX) scale = Math.min(scale, LONG_MAX / longSide);
        if (origW * origH * scale * scale > MAX_PIXELS) scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (origW * origH)));
        if (shortSide >= SHORT_MIN && shortSide * scale < SHORT_MIN) {
          var minScaleForShort = SHORT_MIN / shortSide;
          var maxScaleForLong = longSide > LONG_MAX ? LONG_MAX / longSide : 1;
          scale = Math.min(minScaleForShort, maxScaleForLong);
        }
      } else { if (longSide > maxDim) scale = maxDim / longSide; }
      var width = Math.round(origW * scale), height = Math.round(origH * scale);
      var canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      function tryBlob(type, q, fallback) {
        canvas.toBlob(function (blob) {
          if (blob) { URL.revokeObjectURL(img.src); resolve({ blob: blob, origSize: file.size, newSize: blob.size, via: 'canvas-' + (type.split('/')[1] || '') }); }
          else if (fallback) fallback();
          else { URL.revokeObjectURL(img.src); reject(new Error('canvas 压缩失败')); }
        }, type, q);
      }
      if (webpSupported) tryBlob('image/webp', quality, function () { tryBlob('image/jpeg', quality); });
      else tryBlob('image/jpeg', quality);
    };
    img.onerror = function () { URL.revokeObjectURL(img.src); reject(new Error('图片加载失败')); };
    img.src = URL.createObjectURL(file);
  });
}

function compressImage(file, onProgress) {
  var mode = db.settings.compressMode || 'local';
  if (mode === 'none') return Promise.resolve({ blob: file, origSize: file.size, newSize: file.size, via: 'none' });
  if (mode === 'tinypng') {
    var key = (db.settings.tinypngKey || '').trim();
    var proxy = (db.settings.tinypngProxy || '').trim();
    if (key && proxy) {
      if (onProgress) onProgress('TinyPNG 压缩中…');
      return tinifyCompress(file, key, proxy).then(function (r) { bumpTinyCount(); return r; }).catch(function (err) {
        console.warn('TinyPNG 失败', err);
        toast('TinyPNG 失败：' + err.message + '，改用本地压缩');
        if (onProgress) onProgress('本地压缩中…');
        return canvasCompress(file).catch(function (err2) { console.warn('本地压缩失败', err2); return { blob: file, origSize: file.size, newSize: file.size, via: 'none' }; });
      });
    } else toast('TinyPNG 未配置 Key 或代理，改用本地压缩');
  }
  if (onProgress) onProgress('本地压缩中…');
  return canvasCompress(file).catch(function (err) { console.warn('本地压缩失败', err); return { blob: file, origSize: file.size, newSize: file.size, via: 'none' }; });
}

function formatImageFilename(template, ctx) {
  ctx = ctx || {};
  var now = new Date();
  function pad(n, w) { return String(n).padStart(w || 2, '0'); }
  var yyyy = String(now.getFullYear()), MM = pad(now.getMonth() + 1), dd = pad(now.getDate());
  var HH = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
  var ms = pad(now.getMilliseconds(), 3);
  var date = yyyy + MM + dd, time = HH + mm + ss, datetime = date + time, timestamp = datetime + ms;
  var rand = Math.random().toString(36).slice(2, 8);
  var result = String(template || '');
  var map = {
    '{cat}': ctx.cat || '', '{filename}': ctx.filename || '', '{index}': String(ctx.index || 1),
    '{total}': String(ctx.total || 1), '{yyyy}': yyyy, '{MM}': MM, '{dd}': dd, '{HH}': HH, '{mm}': mm,
    '{ss}': ss, '{date}': date, '{time}': time, '{datetime}': datetime, '{timestamp}': timestamp, '{rand}': rand
  };
  Object.keys(map).forEach(function (k) { result = result.split(k).join(map[k]); });
  result = result.replace(/[\\/:*?"<>|#%\s]+/g, '_').replace(/^[._]+|[._]+$/g, '').replace(/_{2,}/g, '_').slice(0, 100);
  return result || 'img';
}

window.updateImgNamingPreview = function () {
  var tplEl = document.getElementById('imgNamingTemplate');
  var previewEl = document.getElementById('imgNamingPreview');
  var warnEl = document.getElementById('imgNamingWarn');
  if (!tplEl || !previewEl) return;
  var tpl = (tplEl.value || '').trim() || '{cat}-{timestamp}-{rand}';
  var preview = formatImageFilename(tpl, { cat: '梗图', filename: 'example', index: 1, total: 1 }) + '.jpg';
  previewEl.textContent = preview;
  var hasUnique = /\{(timestamp|datetime|time|rand|index|ss|mm|HH)\}/.test(tpl);
  if (warnEl) warnEl.style.display = hasUnique ? 'none' : 'block';
};

var uploadInProgress = false;

function renderImgCatChooser() {
  var list = $('imgCatList');
  var cats = db.imageCategories.length ? db.imageCategories : DEFAULT_IMG_CATS;
  list.innerHTML = cats.map(function (c) { return '<div class="img-cat-opt" data-cat="' + esc(c) + '">' + esc(c) + '</div>'; }).join('');
  if (!pendingUploadCat || cats.indexOf(pendingUploadCat) < 0) pendingUploadCat = cats[0];
  list.querySelectorAll('.img-cat-opt').forEach(function (el) { el.classList.toggle('active', el.dataset.cat === pendingUploadCat); });
}

function openImgCatChooser(files) {
  pendingUploadFiles = files.slice();
  pendingUploadCat = db.imageCategories[0] || DEFAULT_IMG_CATS[0];
  $('imgCatCount').textContent = files.length;
  $('imgUploadStatus').textContent = '';
  if ($('imgUploadTags')) $('imgUploadTags').value = '';
  $('imgProgressWrap').style.display = 'none';
  $('imgProgressBar').style.width = '0%';
  $('imgProgressBar').style.background = 'var(--accent)';
  $('imgProgressText').textContent = '准备中...';
  $('imgProgressPercent').textContent = '0%';
  renderImgCatChooser();
  $('imgCatMask').classList.add('show');
}

function sanitizeFilename(s) { return String(s || '').replace(/[\\/:*?"<>|#%\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'img'; }

function startUploadPending() {
  if (!pendingUploadFiles.length || uploadInProgress) return;
  var cfg = loadGH();
  if (!ghReady(cfg)) { toast('请先在设置中配置 GitHub'); return; }
  uploadInProgress = true;
  var cat = pendingUploadCat || '其他';
  var tagsRaw = $('imgUploadTags') ? $('imgUploadTags').value.trim() : '';
  var imgTags = tagsRaw ? tagsRaw.split(/[,，\s]+/).filter(Boolean) : [];
  var statusEl = $('imgUploadStatus');
  var rc = ghRepoConfig('img');
  var files = pendingUploadFiles.slice();
  var success = 0, fail = 0, done = 0;
  $('imgProgressWrap').style.display = 'block';
  $('imgProgressText').textContent = '共 ' + files.length + ' 张，并发上传中...';
  var namingTemplate = (db.settings.imgNamingTemplate || '{cat}-{timestamp}-{rand}').trim();

  function makeFilename(file, comp, index) {
    var now = new Date();
    var year = now.getFullYear(), month = String(now.getMonth() + 1).padStart(2, '0');
    var origBase = String(file.name || '').replace(/\.[^.]+$/, '');
    var safeCat = sanitizeFilename(cat);
    var baseName = formatImageFilename(namingTemplate, { cat: safeCat, filename: origBase, index: index + 1, total: files.length });
    if (!baseName || !baseName.trim()) baseName = 'img';
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    if (comp.blob && comp.blob.type) {
      if (comp.blob.type === 'image/webp') ext = 'webp';
      else if (comp.blob.type === 'image/jpeg') ext = 'jpg';
      else if (comp.blob.type === 'image/png') ext = 'png';
    }
    return { year: year, month: month, filename: baseName + '.' + ext };
  }

  function uploadOne(file, idx) {
    return compressImage(file, function (msg) { statusEl.textContent = '[' + (idx + 1) + '/' + files.length + '] ' + msg; }).then(function (comp) {
      var ratio = comp.origSize > 0 ? (1 - comp.newSize / comp.origSize) * 100 : 0;
      statusEl.textContent = '[' + (idx + 1) + '/' + files.length + '] 压缩 ' + fmtSize(comp.origSize) + ' → ' + fmtSize(comp.newSize) + '（' + (ratio > 0 ? '-' + ratio.toFixed(0) + '%' : '无变化') + '），上传中…';
      var f = makeFilename(file, comp, idx);
      var relPath = f.year + '/' + f.month + '/' + f.filename;
      var fullPath = rc.path + '/' + relPath;
      return blobToBase64(comp.blob).then(function (b64) { return ghPutRaw(rc, fullPath, b64, null, 'upload ' + relPath); }).then(function () {
        pendingImages.push({ path: relPath, url: '', cat: cat, tags: imgTags.slice(), size: comp.newSize, origSize: comp.origSize });
        recordOrphanImage(relPath);
        renderPendingImgs();
        success++;
        statusEl.textContent = '[' + (idx + 1) + '/' + files.length + '] 完成：' + f.filename;
      });
    }).catch(function (err) {
      console.error(err); fail++;
      statusEl.textContent = '[' + (idx + 1) + '/' + files.length + '] 失败：' + err.message;
    }).then(function () {
      done++;
      var pct = (done / files.length) * 100;
      $('imgProgressBar').style.width = pct + '%';
      $('imgProgressPercent').textContent = Math.floor(pct) + '%';
      if (fail > 0 && done < files.length) $('imgProgressBar').style.background = 'var(--danger)';
      else if (done < files.length) $('imgProgressBar').style.background = 'var(--accent)';
    });
  }

  var CONCURRENCY = Math.min(3, files.length), cursor = 0;
  function worker() {
    if (cursor >= files.length) return Promise.resolve();
    var i = cursor++;
    return uploadOne(files[i], i).then(function () { return new Promise(function (r) { setTimeout(r, 150); }); }).then(function () { return worker(); });
  }
  var workers = [];
  for (var w = 0; w < CONCURRENCY; w++) workers.push(worker());

  // ★ Bug G 修复：加 .catch + .finally，保证 uploadInProgress 一定复位
  Promise.all(workers).then(function () {
    $('imgProgressBar').style.background = fail > 0 ? 'var(--danger)' : '#10b981';
    $('imgProgressText').textContent = fail > 0 ? '部分失败' : '全部完成';
    if (fail === 0) {
      var isEditing = !!editingId;
      var hasText = inputEl.value.trim().length > 0;
      if (!isEditing && !hasText) {
        var source = sourceEl.value.trim();
        if (!source && currentSource !== ALL_SOURCES) source = currentSource;
        if (!source && db.fixedSource) source = db.fixedSource;
        var tagsRawStr = tagsEl.value.trim();
        var itemTags = tagsRawStr ? tagsRawStr.split(/[,，\s]+/).filter(Boolean) : [];
        if (!itemTags.length && db.fixedTags.length) itemTags.push.apply(itemTags, db.fixedTags);
        var newItem = { id: uid(), text: '', type: IMG_TYPE, source: source, tags: Array.from(new Set(itemTags)), images: pendingImages.slice(), createdAt: Date.now() };
        db.items.push(newItem);
        markItemDirty(newItem); _indexAddItem(newItem);
        if (source && db.sources.indexOf(source) < 0) db.sources.push(source);
        clearOrphanImage(pendingImages.map(function (x) { return x.path; }).filter(Boolean));
        pendingImages = [];
        renderPendingImgs();
        tagsEl.value = db.fixedTags.length ? db.fixedTags.join(', ') : '';
        sourceEl.value = db.fixedSource || '';
        updateSourcePickerUI(); updateTagPickerUI();
        currentPage = 1;
        save(); render();
        statusEl.textContent = '上传成功 ' + success + ' 张，已自动保存到素材库';
        toast('已上传 ' + success + ' 张图片并自动保存');
        setTimeout(function () { $('imgCatMask').classList.remove('show'); }, 800);
      } else {
        statusEl.textContent = '上传成功 ' + success + ' 张，点击「保存」加入素材库';
        toast('已上传 ' + success + ' 张图片，点保存加入素材库');
        setTimeout(function () { $('imgCatMask').classList.remove('show'); }, 800);
      }
    } else {
      statusEl.textContent = '完成：成功 ' + success + '，失败 ' + fail;
      toast('上传 ' + success + ' 张，失败 ' + fail + ' 张');
    }
  }).catch(function (e) {
    console.error('[upload] 异常', e);
    toast('上传异常：' + (e && e.message || '未知错误'));
  }).finally(function () {
    // finally 在现代浏览器都支持；即使不支持也会因为 catch 兜底而不死
    uploadInProgress = false;
    pendingUploadFiles = [];
  });
}

var _allImagesCache = { rev: -1, result: [] };
function collectAllImages() {
  if (_allImagesCache.rev === db._rev) return _allImagesCache.result;
  var arr = [];
  db.items.forEach(function (item) {
    (item.images || []).forEach(function (im) {
      arr.push({ im: im, src: imageSrc(im), path: im.path || '', cat: im.cat || '其他', tags: im.tags || [], itemId: item.id, itemText: item.text || '' });
    });
  });
  _allImagesCache = { rev: db._rev, result: arr };
  return arr;
}

var IMG_VIEW_BATCH_SIZE = 60;
var _imgViewFiltered = [];
var _imgViewRendered = 0;
var _imgViewObserver = null;

function _renderMasonryBatch() {
  if (_imgViewRendered >= _imgViewFiltered.length) {
    if (_imgViewObserver) { _imgViewObserver.disconnect(); _imgViewObserver = null; }
    var sentinel = document.getElementById('imgMasonrySentinel');
    if (sentinel) sentinel.style.display = 'none';
    return;
  }
  var next = _imgViewFiltered.slice(_imgViewRendered, _imgViewRendered + IMG_VIEW_BATCH_SIZE);
  var html = next.map(function (x) {
    var cap = (x.itemText || '').slice(0, 40);
    return '<div class="mi"><img src="' + esc(x.src) + '" alt="" loading="lazy" data-open-img="' + esc(x.src) + '" data-img-path="' + esc(x.path) + '"><span class="mi-cat">' + esc(x.cat) + '</span>' + (cap ? '<div class="mi-cap">' + esc(cap) + (x.itemText.length > 40 ? '…' : '') + '</div>' : '') + '</div>';
  }).join('');
  $('imgMasonry').insertAdjacentHTML('beforeend', html);
  _imgViewRendered += next.length;
  var wrap = document.querySelector('.img-masonry-wrap');
  if (wrap && _imgViewRendered < _imgViewFiltered.length && wrap.scrollHeight <= wrap.clientHeight) _renderMasonryBatch();
}

function _setupMasonryObserver() {
  if (_imgViewObserver) _imgViewObserver.disconnect();
  var sentinel = document.getElementById('imgMasonrySentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'imgMasonrySentinel';
    sentinel.style.cssText = 'height:1px;width:100%;';
    document.querySelector('.img-masonry-wrap').appendChild(sentinel);
  }
  sentinel.style.display = 'block';
  var wrap = document.querySelector('.img-masonry-wrap');
  _imgViewObserver = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting) _renderMasonryBatch(); }, { root: wrap, rootMargin: '300px' });
  _imgViewObserver.observe(sentinel);
}

function renderImgView() {
  var all = collectAllImages();
  var counts = {};
  all.forEach(function (x) { counts[x.cat] = (counts[x.cat] || 0) + 1; });
  var catList = ['全部'].concat(Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }));
  if (catList.indexOf(currentImgViewCat) < 0) currentImgViewCat = '全部';
  $('imgCatTabs').innerHTML = catList.map(function (c) {
    var n = c === '全部' ? all.length : (counts[c] || 0);
    return '<div class="ic-tab ' + (currentImgViewCat === c ? 'active' : '') + '" data-ic="' + esc(c) + '">' + esc(c) + '<span class="n">' + n + '</span></div>';
  }).join('');
  var filtered = currentImgViewCat === '全部' ? all : all.filter(function (x) { return x.cat === currentImgViewCat; });
  $('imgViewCount').textContent = filtered.length + ' 张';
  if (!filtered.length) {
    $('imgMasonry').innerHTML = '<div class="img-view-empty">还没有图片</div>';
    var s = document.getElementById('imgMasonrySentinel');
    if (s) s.style.display = 'none';
    if (_imgViewObserver) { _imgViewObserver.disconnect(); _imgViewObserver = null; }
    return;
  }
  _imgViewFiltered = filtered; _imgViewRendered = 0;
  $('imgMasonry').innerHTML = '';
  _renderMasonryBatch();
  _setupMasonryObserver();
}

function openImgView() {
  currentImgViewCat = '全部';
  renderImgView();
  $('imgView').hidden = false;
  document.body.style.overflow = 'hidden';
  var wrap = document.querySelector('.img-masonry-wrap');
  if (wrap) wrap.scrollTop = 0;
}
function closeImgView() {
  $('imgView').hidden = true;
  document.body.style.overflow = '';
  if (_imgViewObserver) { _imgViewObserver.disconnect(); _imgViewObserver = null; }
}

window.formatImageFilename = formatImageFilename;
window.renderImgCatChooser = renderImgCatChooser;
window.openImgCatChooser = openImgCatChooser;
window.startUploadPending = startUploadPending;
window.renderImgView = renderImgView;
window.openImgView = openImgView;
window.closeImgView = closeImgView;
window.collectAllImages = collectAllImages;