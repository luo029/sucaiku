/* js / imgbed.js · 图床管理：仓库图片列表 / 删除 / 清理 / 多维筛选 / 批量操作 */
// ★ 改动：修复批量管理按钮图标与文字没有对齐的问题，优化了 SVG 的尺寸与 flex 居中对齐

(function() {
  var imgMgrCurrentCat = 'all';
  var imgMgrCurrentTime = 'all';

  var imgMgrFilteredFiles = [];
  var imgMgrRenderedCount = 0;
  var imgMgrObserver = null;
  var IMG_MGR_BATCH_SIZE = 60;

  function parseCatFromFilename(filename) {
    var cats = (db.imageCategories || []).slice().sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      var safe = sanitizeFilename(c);
      if (safe && filename.indexOf(safe + '-') === 0) return c;
    }
    return '其他';
  }

  function openImgManager() {
    var cfg = loadGH();
    if (!ghReady(cfg)) {
      toast('请先在设置中配置 GitHub');
      return;
    }
    $('imgManagerView').hidden = false;
    document.body.style.overflow = 'hidden';
    
    var rc = ghRepoConfig('img');
    $('imgMgrRepoName').textContent = rc.owner + '/' + rc.repo;
    
    ensureMgrUI();

    if (db.items.length === 0) {
      $('imgMgrGrid').innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-3);">本地素材库为空，正在尝试从云端同步素材以匹配引用关系...</div>';
      ghPull(true).then(function() { loadRepoImages(); });
    } else {
      loadRepoImages();
    }
  }

  function ensureMgrUI() {
    if (document.getElementById('imgMgrToolbar')) return;

    var oldStats = document.getElementById('imgMgrStatsPanel');
    if (oldStats) oldStats.remove();
    
    var oldTabs = document.getElementById('imgMgrFilterTabs');
    if (oldTabs && oldTabs.parentElement) oldTabs.parentElement.remove();

    var toolbar = document.createElement('div');
    toolbar.id = 'imgMgrToolbar';
    toolbar.style.cssText = 'display:flex; justify-content:center; margin-bottom:24px;';
    
    toolbar.innerHTML = ''
      + '<div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; background:var(--card); border:1px solid var(--line); padding:10px 20px; border-radius:14px; box-shadow:var(--sh-1); max-width:100%;">'
      + '  <div id="imgMgrPills" style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px; max-width:500px;"></div>'
      + '  <div style="width:1px; height:20px; background:var(--line); flex-shrink:0;"></div>'
      + '  <select id="imgMgrTimeSel" class="page-size" style="height:34px; padding:0 30px 0 12px; border-radius:8px; font-size:13px; border-color:var(--line); background-color:var(--bg); color:var(--text-2); cursor:pointer; flex-shrink:0;">'
      + '    <option value="all">全部时间</option>'
      + '  </select>'
      + '  <button class="btn danger" id="imgMgrCleanBtn" style="display:none; padding:0 14px; font-size:13px; height:34px; border-radius:8px; flex-shrink:0;">清理未引用</button>'
      + '</div>';

    var grid = document.getElementById('imgMgrGrid');
    grid.parentElement.insertBefore(toolbar, grid);

    document.getElementById('imgMgrPills').addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-cat]');
      if (!btn) return;
      imgMgrCurrentCat = btn.dataset.cat;
      imgMgrCurrentFilter = btn.dataset.filter || 'all';
      renderImgMgrUI();
    });

    document.getElementById('imgMgrTimeSel').addEventListener('change', function(e) {
      imgMgrCurrentTime = e.target.value;
      renderImgMgrUI();
    });

    document.getElementById('imgMgrCleanBtn').addEventListener('click', cleanAllUnusedImages);
  }

  function loadRepoImages() {
    var rc = ghRepoConfig('img');
    var grid = $('imgMgrGrid');
    var status = $('imgMgrStatus');
    
    grid.innerHTML = '';
    status.innerHTML = '<svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:8px;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> 正在拉取仓库文件列表...';

    var url = 'https://api.github.com/repos/' + encodeURIComponent(rc.owner) + '/' + encodeURIComponent(rc.repo) + '/git/trees/' + encodeURIComponent(rc.branch) + '?recursive=1';
    
    fetch(url, {
      headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json' }
    }).then(function(res) {
      if (res.status === 404) {
        repoImagesCache = [];
        renderImgMgrUI();
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(data) {
      if (!data) return;
      var prefix = rc.path ? rc.path + '/' : '';
      var files = (data.tree || []).filter(function(f) { 
        return f.type === 'blob' && f.path.indexOf(prefix) === 0 && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.path);
      });

      var refMap = new Map();
      var filenameMap = new Map();
      db.items.forEach(function(item) {
        (item.images || []).forEach(function(im) {
          if (!im.path) return;
          var ip = String(im.path).trim();
          var fn = ip.split('/').pop();
          if (!refMap.has(ip)) refMap.set(ip, { cat: null, tags: new Set() });
          var entry = refMap.get(ip);
          if (im.cat) entry.cat = im.cat;
          if (Array.isArray(im.tags)) im.tags.forEach(function(t) { entry.tags.add(t); });

          if (!filenameMap.has(fn)) filenameMap.set(fn, []);
          if (filenameMap.get(fn).indexOf(ip) < 0) filenameMap.get(fn).push(ip);
        });
      });

      var usedPathsArr = Array.from(refMap.keys());

      function findRef(relPath, filename) {
        if (refMap.has(relPath)) return refMap.get(relPath);
        var candidates = filenameMap.get(filename);
        if (candidates) {
          for (var i = 0; i < candidates.length; i++) {
            var ip = candidates[i];
            if (ip === relPath || ip.endsWith(relPath) || relPath.endsWith(ip) || ip.indexOf(filename) >= 0) {
              return refMap.get(ip);
            }
          }
        }
        for (var j = 0; j < usedPathsArr.length; j++) {
          var ip2 = usedPathsArr[j];
          if (ip2.endsWith(relPath) || relPath.endsWith(ip2)) {
            return refMap.get(ip2);
          }
        }
        return null;
      }

      repoImagesCache = files.map(function(f) {
        var relPath = f.path.substring(prefix.length);
        var filename = f.path.split('/').pop();
        
        var ref = findRef(relPath, filename);
        var isUsed = !!ref;
        var cat = (ref && ref.cat) || parseCatFromFilename(filename);
        var tags = ref ? Array.from(ref.tags) : [];
        
        var parts = relPath.split('/');
        var yearMonth = '';
        if (parts.length >= 3) yearMonth = parts[0] + '年' + parts[1] + '月';
        else if (parts.length === 2) yearMonth = parts[0] + '年';

        return { path: f.path, sha: f.sha, size: f.size, relPath: relPath, filename: filename, cat: cat, tags: tags, isUsed: isUsed, yearMonth: yearMonth };
      }).sort(function(a, b) { return b.path.localeCompare(a.path); });

      renderImgMgrUI();
    }).catch(function(err) {
      console.error(err);
      status.innerHTML = '<div style="color:var(--danger); font-size:14px; font-weight:500; line-height:1.6; max-width:600px; margin:0 auto;">加载失败：' + err.message + '</div>';
    });
  }

  function renderImgMgrUI() {
    var status = $('imgMgrStatus');
    var grid = $('imgMgrGrid');
    
    // ★ 修复：强制按钮使用 inline-flex 布局，解决图标和文字上下不对齐的问题
    var selectBtn = $('imgMgrSelectBtn');
    if (selectBtn) {
      selectBtn.style.display = 'inline-flex';
      selectBtn.style.alignItems = 'center';
      selectBtn.style.justifyContent = 'center';
      selectBtn.style.gap = '6px'; // 图标与文字的间距

      if (imgMgrSelectMode) {
        selectBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg> <span>退出批量</span>';
        selectBtn.style.color = 'var(--danger)';
        selectBtn.style.borderColor = 'var(--danger)';
        selectBtn.style.background = 'var(--danger-soft)';
      } else {
        selectBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></svg> <span>批量管理</span>';
        selectBtn.style.color = '';
        selectBtn.style.borderColor = '';
        selectBtn.style.background = '';
      }
    }

    if (repoImagesCache.length === 0) {
      if (status.innerHTML.indexOf('正在拉取') >= 0) status.innerHTML = '';
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 60px 20px; color: var(--text-3);">'
        + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin-bottom:12px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
        + '<div style="font-size:15px; font-weight:500; color:var(--text-2);">仓库里还没有图片</div>'
        + '</div>';
    } else {
      status.innerHTML = '';
    }

    var total = repoImagesCache.length;
    var unusedFiles = repoImagesCache.filter(function(f) { return !f.isUsed; });
    var unusedCount = unusedFiles.length;

    var allCatsNow = [];
    repoImagesCache.forEach(function(f) { if (allCatsNow.indexOf(f.cat) < 0) allCatsNow.push(f.cat); });
    
    if (imgMgrCurrentCat !== 'all' && allCatsNow.indexOf(imgMgrCurrentCat) < 0) {
      imgMgrCurrentCat = 'all';
    }
    
    var allTimesNow = [];
    repoImagesCache.forEach(function(f) { if (f.yearMonth && allTimesNow.indexOf(f.yearMonth) < 0) allTimesNow.push(f.yearMonth); });
    if (imgMgrCurrentTime !== 'all' && allTimesNow.indexOf(imgMgrCurrentTime) < 0) {
      imgMgrCurrentTime = 'all';
    }
    if (imgMgrCurrentFilter === 'unused' && unusedCount === 0) {
      imgMgrCurrentFilter = 'all';
    }

    var headCount = $('imgMgrHeadCount');
    if (headCount) headCount.textContent = '共 ' + total + ' 张';

    var cleanBtn = $('imgMgrCleanBtn');
    if (cleanBtn) {
      cleanBtn.style.display = (unusedCount > 0 && imgMgrCurrentFilter !== 'unused') ? 'block' : 'none';
      if (unusedCount > 0) cleanBtn.textContent = '清理 ' + unusedCount + ' 张未引用';
    }

    var pillsEl = $('imgMgrPills');
    if (pillsEl) {
      var allCats = allCatsNow.sort();
      var html = '';
      
      var isAllActive = imgMgrCurrentCat === 'all' && imgMgrCurrentFilter === 'all';
      html += '<button data-cat="all" data-filter="all" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ' + (isAllActive?'var(--accent)':'transparent') + '; background:' + (isAllActive?'var(--accent-soft)':'transparent') + '; color:' + (isAllActive?'var(--accent)':'var(--text-2)') + '; cursor:pointer; white-space:nowrap; font-weight:' + (isAllActive?'600':'500') + '; transition:all .15s;">全部 <span style="opacity:0.6; margin-left:2px;">' + total + '</span></button>';
      
      if (unusedCount > 0) {
        var isUnusedActive = imgMgrCurrentFilter === 'unused';
        html += '<button data-cat="all" data-filter="unused" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ' + (isUnusedActive?'var(--danger)':'transparent') + '; background:' + (isUnusedActive?'var(--danger-soft)':'transparent') + '; color:' + (isUnusedActive?'var(--danger)':'var(--text-2)') + '; cursor:pointer; white-space:nowrap; font-weight:' + (isUnusedActive?'600':'500') + '; transition:all .15s;">未引用 <span style="opacity:0.6; margin-left:2px;">' + unusedCount + '</span></button>';
      }

      allCats.forEach(function(c) {
        var count = repoImagesCache.filter(function(f) { return f.cat === c; }).length;
        var idx = db.imageCategories.indexOf(c);
        if (idx < 0) idx = 0;
        var palette = PALETTE[idx % PALETTE.length];
        
        var isActive = imgMgrCurrentCat === c && imgMgrCurrentFilter !== 'unused';
        var bg = isActive ? palette.bg : 'transparent';
        var color = isActive ? palette.fg : 'var(--text-2)';
        var border = isActive ? palette.fg : 'transparent';
        var fontWeight = isActive ? '600' : '500';
        
        html += '<button data-cat="' + esc(c) + '" data-filter="all" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ' + border + '; background:' + bg + '; color:' + color + '; cursor:pointer; white-space:nowrap; font-weight:' + fontWeight + '; transition:all .15s;">' + esc(c) + ' <span style="opacity:0.6; margin-left:2px;">' + count + '</span></button>';
      });
      
      pillsEl.innerHTML = html;
    }

    var timeSel = $('imgMgrTimeSel');
    if (timeSel) {
      var allTimes = allTimesNow.slice().sort().reverse();
      var options = '<option value="all">全部时间</option>';
      allTimes.forEach(function(t) { options += '<option value="' + esc(t) + '">' + esc(t) + '</option>'; });
      timeSel.innerHTML = options;
      if (allTimes.indexOf(imgMgrCurrentTime) >= 0) timeSel.value = imgMgrCurrentTime;
      else { timeSel.value = 'all'; imgMgrCurrentTime = 'all'; }
    }

    var displayFiles = repoImagesCache;
    if (imgMgrCurrentFilter === 'unused') displayFiles = displayFiles.filter(function(f) { return !f.isUsed; });
    if (imgMgrCurrentCat !== 'all') displayFiles = displayFiles.filter(function(f) { return f.cat === imgMgrCurrentCat; });
    if (imgMgrCurrentTime !== 'all') displayFiles = displayFiles.filter(function(f) { return f.yearMonth === imgMgrCurrentTime; });

    if (!displayFiles.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-3); padding:60px;">没有符合当前筛选条件的图片</div>';
      return;
    }

    imgMgrFilteredFiles = displayFiles;
    imgMgrRenderedCount = 0;
    if (imgMgrObserver) {
      imgMgrObserver.disconnect();
      imgMgrObserver = null;
    }

    grid.innerHTML = '';
    
    var warningHtml = '';
    if (db.items.length === 0 && total > 0) {
      warningHtml = '<div style="grid-column: 1 / -1; text-align:center; color:var(--danger); padding:10px; font-size:13px; background:var(--danger-soft); border-radius:8px; margin-bottom:10px;">提示：当前本地素材库为空（可能是无痕模式或拉取失败），所以图片均显示为未引用。</div>';
    }
    if (warningHtml) grid.innerHTML = warningHtml;

    renderImgMgrBatch();
    updateImgMgrBatchBar();
  }

  function renderImgMgrBatch() {
    var grid = $('imgMgrGrid');
    if (!grid) return;
    
    var oldSentinel = document.getElementById('imgMgrSentinel');
    if (oldSentinel) oldSentinel.remove();

    var nextFiles = imgMgrFilteredFiles.slice(imgMgrRenderedCount, imgMgrRenderedCount + IMG_MGR_BATCH_SIZE);
    
    requestAnimationFrame(function() {
      var html = nextFiles.map(function(f) {
        var url = imageUrlFromPath(f.relPath);
        var sizeStr = fmtSize(f.size);
        var usedBadge = f.isUsed 
          ? '<span class="mgr-badge used">已引用</span>' 
          : '<span class="mgr-badge unused">未引用</span>';

        var idx = db.imageCategories.indexOf(f.cat);
        if (idx < 0) idx = 0;
        var palette = PALETTE[idx % PALETTE.length];

        var tagsHtml = (f.tags && f.tags.length) 
          ? '<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; justify-content:center;">' + f.tags.map(function(t) { return ''
              + '<span class="tag-chip" style="font-size:10px; padding:2px 6px; display:inline-flex; align-items:center; gap:4px; cursor:default;">'
              + '  #' + esc(t)
              + '  <span data-rm-tag="' + esc(t) + '" data-rel-path="' + esc(f.relPath) + '" style="cursor:pointer; opacity:0.6; font-size:12px; line-height:1; padding:0 2px; transition:opacity 0.15s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" title="移除该标签">✕</span>'
              + '</span>';
          }).join('') + '</div>' 
          : '';

        var isSelected = imgMgrSelectedIds.has(f.relPath);
        var checkHtml = imgMgrSelectMode ? '<div class="mgr-select-check" style="position:absolute; top:8px; left:8px; z-index:10; background:' + (isSelected?'var(--accent)':'rgba(0,0,0,0.4)') + '; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#fff; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="' + (isSelected?'':'display:none;') + '"><path d="M20 6 9 17l-5-5"/></svg></div>' : '';

        return '<div class="mgr-card ' + (isSelected?'selected':'') + '" data-rel-path="' + esc(f.relPath) + '" style="position:relative; ' + (isSelected?'border-color:var(--accent); box-shadow:0 0 0 2px var(--accent-soft);':'') + '">'
          + '<div class="mgr-img-wrap" ' + (imgMgrSelectMode?'':'data-open-img="'+esc(url)+'"') + ' data-img-path="' + esc(f.relPath) + '">'
          + '  ' + checkHtml
          + '  <img src="' + esc(url) + '" loading="lazy" data-img-path="' + esc(f.relPath) + '">'
          + '  ' + (imgMgrSelectMode?'':'<button class="mgr-del-btn" data-del-img-mgr="' + esc(f.relPath) + '" data-sha="' + esc(f.sha) + '" title="彻底删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>')
          + '</div>'
          + '<div class="mgr-info">'
          + '  <div class="mgr-info-top">'
          + '    <span class="tag" style="background:' + palette.bg + '; color:' + palette.fg + '; border:none; padding:2px 10px; border-radius:6px; font-size:12px; letter-spacing:0;">' + esc(f.cat) + '</span>'
          + '    ' + usedBadge
          + '  </div>'
          + '  ' + tagsHtml
          + '  <div class="mgr-info-bottom">'
          + '    <span>' + sizeStr + '</span>'
          + '    ' + (f.yearMonth ? '<span style="opacity:0.6; font-size:11px;">' + esc(f.yearMonth) + '</span>' : '')
          + '  </div>'
          + '</div>'
          + '</div>';
      }).join('');
      
      grid.insertAdjacentHTML('beforeend', html);
      imgMgrRenderedCount += nextFiles.length;

      if (imgMgrRenderedCount < imgMgrFilteredFiles.length) {
        var sentinel = document.createElement('div');
        sentinel.id = 'imgMgrSentinel';
        sentinel.style.cssText = 'grid-column: 1 / -1; height: 40px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px;';
        sentinel.textContent = '正在加载更多图片...';
        grid.appendChild(sentinel);

        if (!imgMgrObserver) {
          var scrollContainer = document.querySelector('#imgManagerView > div[style*="overflow-y:auto"]') || document.querySelector('#imgManagerView > div:nth-child(2)');
          imgMgrObserver = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
              setTimeout(function() { renderImgMgrBatch(); }, 30);
            }
          }, { root: scrollContainer, rootMargin: '400px' });
        }
        imgMgrObserver.disconnect();
        imgMgrObserver.observe(sentinel);
      }
      
      updateImgMgrBatchBar();
    });
  }

  function deleteRepoImage(relPath, sha) {
    window.showCustomConfirm({
      title: '彻底删除图片',
      desc: '确定要从 GitHub 图床彻底删除这张图片吗？\n\n注意：删除后不可恢复！如果该图片被素材引用，相关素材里的这张图也会被同步清理。',
      isDanger: true,
      onConfirm: function() {
        var rc = ghRepoConfig('img');
        var fullPath = rc.path + '/' + relPath;
        
        var url = ghApiUrl(rc, fullPath);
        fetch(url, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'delete ' + relPath, sha: sha, branch: rc.branch })
        }).then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          
          repoImagesCache = repoImagesCache.filter(function(f) { return f.relPath !== relPath; });
          
          var affectedIds = new Set();
          var removedImagesCount = 0;
          
          db.items.forEach(function(item) {
            if (item.images) {
              var beforeLen = item.images.length;
              item.images = item.images.filter(function(im) {
                if (!im.path) return true;
                var ip = String(im.path).trim();
                var rp = String(relPath).trim();
                var isMatch = ip === rp || ip.endsWith(rp) || rp.endsWith(ip);
                if (isMatch) {
                  removedImagesCount++;
                  return false;
                }
                return true;
              });
              if (item.images.length !== beforeLen) {
                affectedIds.add(item.id);
              }
            }
          });
          
          var removedItemsCount = 0;
          if (affectedIds.size > 0) {
            var beforeCount = db.items.length;
            db.items = db.items.filter(function(i) {
              if (!affectedIds.has(i.id)) return true;
              return i.text || (i.images && i.images.length > 0);
            });
            removedItemsCount = beforeCount - db.items.length;
            
            save();
            render();
          }
          
          if (removedItemsCount > 0) {
            toast('图片已删，并清理了 ' + removedItemsCount + ' 条失去所有内容的空素材');
          } else if (removedImagesCount > 0) {
            toast('图片已删，并从素材中移除了 ' + removedImagesCount + ' 处引用');
          } else {
            toast('已彻底删除物理图片');
          }
          
          renderImgMgrUI();
          
        }).catch(function(err) {
          console.error(err);
          toast('删除失败：' + err.message);
        });
      }
    });
  }

  function cleanAllUnusedImages() {
    var unused = repoImagesCache.filter(function(f) { return !f.isUsed; });
    if (!unused.length) return;
    
    window.showCustomConfirm({
      title: '清理未引用图片',
      desc: '确定要一键清理这 ' + unused.length + ' 张未被引用的图片吗？\n\n这会直接向 GitHub 发送 ' + unused.length + ' 个删除请求，不可恢复！',
      isDanger: true,
      onConfirm: function() {
        var btn = $('imgMgrCleanBtn');
        var originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '正在清理...';

        var rc = ghRepoConfig('img');
        var success = 0;
        var fail = 0;

        function loopDelete(index) {
          if (index >= unused.length) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            toast('清理完成：成功 ' + success + ' 张，失败 ' + fail + ' 张');
            loadRepoImages();
            return;
          }

          var f = unused[index];
          var fullPath = rc.path + '/' + f.relPath;
          var url = ghApiUrl(rc, fullPath);
          
          fetch(url, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + rc.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'delete unused ' + f.relPath, sha: f.sha, branch: rc.branch })
          }).then(function(res) {
            if (res.ok) success++;
            else fail++;
          }).catch(function(e) {
            fail++;
          }).then(function() {
            setTimeout(function() { loopDelete(index + 1); }, 300);
          });
        }
        
        loopDelete(0);
      }
    });
  }

  function updateImgMgrBatchBar() {
    var bar = $('imgMgrBatchBar');
    if (!bar) return;
    
    if (imgMgrSelectMode) {
      bar.classList.add('show');
      $('imgMgrBatchNum').textContent = imgMgrSelectedIds.size;
    } else {
      bar.classList.remove('show');
    }
  }

  function toggleSelectImgMgr(relPath) {
    if (imgMgrSelectedIds.has(relPath)) imgMgrSelectedIds.delete(relPath);
    else imgMgrSelectedIds.add(relPath);
    
    var card = document.querySelector('.mgr-card[data-rel-path="' + relPath + '"]');
    if (card) {
      card.classList.toggle('selected', imgMgrSelectedIds.has(relPath));
      card.style.borderColor = imgMgrSelectedIds.has(relPath) ? 'var(--accent)' : '';
      card.style.boxShadow = imgMgrSelectedIds.has(relPath) ? '0 0 0 2px var(--accent-soft)' : '';
      
      var check = card.querySelector('.mgr-select-check');
      if (check) {
        check.style.background = imgMgrSelectedIds.has(relPath) ? 'var(--accent)' : 'rgba(0,0,0,0.4)';
        var svg = check.querySelector('svg');
        if (svg) svg.style.display = imgMgrSelectedIds.has(relPath) ? 'block' : 'none';
      }
    }
    updateImgMgrBatchBar();
  }

  function exitImgMgrSelectMode() {
    imgMgrSelectMode = false;
    imgMgrSelectedIds.clear();
    renderImgMgrUI();
  }

  // 暴露给全局使用的函数
  window.openImgManager = openImgManager;
  window.loadRepoImages = loadRepoImages;
  window.deleteRepoImage = deleteRepoImage;
  window.cleanAllUnusedImages = cleanAllUnusedImages;
  window.renderImgMgrUI = renderImgMgrUI;
  window.renderImgMgrBatch = renderImgMgrBatch;
  window.updateImgMgrBatchBar = updateImgMgrBatchBar;
  window.toggleSelectImgMgr = toggleSelectImgMgr;
  window.exitImgMgrSelectMode = exitImgMgrSelectMode;

})();