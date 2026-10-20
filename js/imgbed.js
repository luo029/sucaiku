/* js / imgbed.js · 图床管理：仓库图片列表 / 删除 / 清理 / 多维筛选 */
let imgMgrCurrentCat = 'all';
let imgMgrCurrentTime = 'all';

let imgMgrFilteredFiles = [];
let imgMgrRenderedCount = 0;
let imgMgrObserver = null;
const IMG_MGR_BATCH_SIZE = 60;

function parseCatFromFilename(filename) {
  const cats = (db.imageCategories || []).slice().sort((a, b) => b.length - a.length);
  for (const c of cats) {
    const safe = sanitizeFilename(c);
    if (safe && filename.startsWith(safe + '-')) return c;
  }
  return filename.split('-')[0] || '图片';
}

async function openImgManager() {
  const cfg = loadGH();
  if (!ghReady(cfg)) {
    toast('请先在设置中配置 GitHub');
    return;
  }
  $('imgManagerView').hidden = false;
  document.body.style.overflow = 'hidden';
  
  const rc = ghRepoConfig('img');
  $('imgMgrRepoName').textContent = `${rc.owner}/${rc.repo}`;
  
  ensureMgrUI();

  if (db.items.length === 0) {
    $('imgMgrGrid').innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-3);">本地素材库为空，正在尝试从云端同步素材以匹配引用关系...</div>';
    await ghPull(true);
  }

  await loadRepoImages();
}

function ensureMgrUI() {
  if (document.getElementById('imgMgrToolbar')) return;

  const oldStats = document.getElementById('imgMgrStatsPanel');
  if (oldStats) oldStats.remove();
  
  const oldTabs = document.getElementById('imgMgrFilterTabs');
  if (oldTabs && oldTabs.parentElement) oldTabs.parentElement.remove();

  const toolbar = document.createElement('div');
  toolbar.id = 'imgMgrToolbar';
  toolbar.style.cssText = 'display:flex; justify-content:center; margin-bottom:24px;';
  
  toolbar.innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; background:var(--card); border:1px solid var(--line); padding:10px 20px; border-radius:14px; box-shadow:var(--sh-1); max-width:100%;">
      <div id="imgMgrPills" style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px; max-width:500px;"></div>
      <div style="width:1px; height:20px; background:var(--line); flex-shrink:0;"></div>
      <select id="imgMgrTimeSel" class="page-size" style="height:34px; padding:0 30px 0 12px; border-radius:8px; font-size:13px; border-color:var(--line); background-color:var(--bg); color:var(--text-2); cursor:pointer; flex-shrink:0;">
        <option value="all">全部时间</option>
      </select>
      <button class="btn danger" id="imgMgrCleanBtn" style="display:none; padding:0 14px; font-size:13px; height:34px; border-radius:8px; flex-shrink:0;">清理未引用</button>
    </div>
  `;

  const grid = document.getElementById('imgMgrGrid');
  grid.parentElement.insertBefore(toolbar, grid);

  document.getElementById('imgMgrPills').addEventListener('click', e => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    imgMgrCurrentCat = btn.dataset.cat;
    imgMgrCurrentFilter = btn.dataset.filter || 'all';
    renderImgMgrUI();
  });

  document.getElementById('imgMgrTimeSel').addEventListener('change', e => {
    imgMgrCurrentTime = e.target.value;
    renderImgMgrUI();
  });

  document.getElementById('imgMgrCleanBtn').addEventListener('click', cleanAllUnusedImages);
}

async function loadRepoImages() {
  const rc = ghRepoConfig('img');
  const grid = $('imgMgrGrid');
  const status = $('imgMgrStatus');
  
  grid.innerHTML = '';
  status.innerHTML = '<svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:8px;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> 正在拉取仓库文件列表...';

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(rc.owner)}/${encodeURIComponent(rc.repo)}/git/trees/${encodeURIComponent(rc.branch)}?recursive=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${rc.token}`, Accept: 'application/vnd.github+json' }
    });
    
    if (res.status === 404) {
      repoImagesCache = [];
      renderImgMgrUI();
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    
    const data = await res.json();
    const prefix = rc.path ? rc.path + '/' : '';
    const files = (data.tree || []).filter(f => 
      f.type === 'blob' && f.path.startsWith(prefix) && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.path)
    );

    repoImagesCache = files.map(f => {
      const relPath = f.path.substring(prefix.length);
      const filename = f.path.split('/').pop();
      const cat = parseCatFromFilename(filename);
      
      const isUsed = db.items.some(item => 
        item.images && item.images.some(im => {
          if (!im.path) return false;
          const ip = String(im.path).trim();
          const rp = String(relPath).trim();
          return ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.includes(filename);
        })
      );
      
      const parts = relPath.split('/');
      let yearMonth = '';
      if (parts.length >= 3) yearMonth = parts[0] + '年' + parts[1] + '月';
      else if (parts.length === 2) yearMonth = parts[0] + '年';

      return { ...f, relPath, filename, cat, isUsed, yearMonth };
    }).sort((a, b) => b.path.localeCompare(a.path));

    renderImgMgrUI();
    
  } catch (err) {
    console.error(err);
    status.innerHTML = `<div style="color:var(--danger); font-size:14px; font-weight:500; line-height:1.6; max-width:600px; margin:0 auto;">加载失败：${err.message}</div>`;
  }
}

function renderImgMgrUI() {
  const status = $('imgMgrStatus');
  const grid = $('imgMgrGrid');

  if (repoImagesCache.length === 0) {
    if (status.innerHTML.includes('正在拉取')) status.innerHTML = '';
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 60px 20px; color: var(--text-3);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin-bottom:12px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <div style="font-size:15px; font-weight:500; color:var(--text-2);">仓库里还没有图片</div>
    </div>`;
  } else {
    status.innerHTML = '';
  }

  const total = repoImagesCache.length;
  const unusedFiles = repoImagesCache.filter(f => !f.isUsed);
  const unusedCount = unusedFiles.length;

  const headCount = $('imgMgrHeadCount');
  if (headCount) headCount.textContent = `共 ${total} 张`;

  const cleanBtn = $('imgMgrCleanBtn');
  if (cleanBtn) {
    cleanBtn.style.display = (unusedCount > 0 && imgMgrCurrentFilter !== 'unused') ? 'block' : 'none';
    if (unusedCount > 0) cleanBtn.textContent = `清理 ${unusedCount} 张未引用`;
  }

  const pillsEl = $('imgMgrPills');
  if (pillsEl) {
    const allCats = [...new Set(repoImagesCache.map(f => f.cat))].sort();
    let html = '';
    
    const isAllActive = imgMgrCurrentCat === 'all' && imgMgrCurrentFilter === 'all';
    html += `<button data-cat="all" data-filter="all" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ${isAllActive?'var(--accent)':'transparent'}; background:${isAllActive?'var(--accent-soft)':'transparent'}; color:${isAllActive?'var(--accent)':'var(--text-2)'}; cursor:pointer; white-space:nowrap; font-weight:${isAllActive?'600':'500'}; transition:all .15s;">全部 <span style="opacity:0.6; margin-left:2px;">${total}</span></button>`;
    
    if (unusedCount > 0) {
      const isUnusedActive = imgMgrCurrentFilter === 'unused';
      html += `<button data-cat="all" data-filter="unused" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ${isUnusedActive?'var(--danger)':'transparent'}; background:${isUnusedActive?'var(--danger-soft)':'transparent'}; color:${isUnusedActive?'var(--danger)':'var(--text-2)'}; cursor:pointer; white-space:nowrap; font-weight:${isUnusedActive?'600':'500'}; transition:all .15s;">未引用 <span style="opacity:0.6; margin-left:2px;">${unusedCount}</span></button>`;
    }

    allCats.forEach(c => {
      const count = repoImagesCache.filter(f => f.cat === c).length;
      // ★ 修复：直接按数组索引取色
      let idx = db.imageCategories.indexOf(c);
      if (idx < 0) idx = 0;
      const palette = PALETTE[idx % PALETTE.length];
      
      const isActive = imgMgrCurrentCat === c && imgMgrCurrentFilter !== 'unused';
      const bg = isActive ? palette.bg : 'transparent';
      const color = isActive ? palette.fg : 'var(--text-2)';
      const border = isActive ? palette.fg : 'transparent';
      const fontWeight = isActive ? '600' : '500';
      
      html += `<button data-cat="${esc(c)}" data-filter="all" style="padding:6px 14px; border-radius:99px; font-size:13px; border:1px solid ${border}; background:${bg}; color:${color}; cursor:pointer; white-space:nowrap; font-weight:${fontWeight}; transition:all .15s;">${esc(c)} <span style="opacity:0.6; margin-left:2px;">${count}</span></button>`;
    });
    
    pillsEl.innerHTML = html;
  }

  const timeSel = $('imgMgrTimeSel');
  if (timeSel) {
    const allTimes = [...new Set(repoImagesCache.map(f => f.yearMonth).filter(Boolean))].sort().reverse();
    let options = `<option value="all">全部时间</option>`;
    allTimes.forEach(t => options += `<option value="${esc(t)}">${esc(t)}</option>`);
    timeSel.innerHTML = options;
    if (allTimes.includes(imgMgrCurrentTime)) timeSel.value = imgMgrCurrentTime;
    else { timeSel.value = 'all'; imgMgrCurrentTime = 'all'; }
  }

  let displayFiles = repoImagesCache;
  if (imgMgrCurrentFilter === 'unused') displayFiles = displayFiles.filter(f => !f.isUsed);
  if (imgMgrCurrentCat !== 'all') displayFiles = displayFiles.filter(f => f.cat === imgMgrCurrentCat);
  if (imgMgrCurrentTime !== 'all') displayFiles = displayFiles.filter(f => f.yearMonth === imgMgrCurrentTime);

  if (!displayFiles.length) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:var(--text-3); padding:60px;">没有符合当前筛选条件的图片</div>`;
    return;
  }

  imgMgrFilteredFiles = displayFiles;
  imgMgrRenderedCount = 0;
  if (imgMgrObserver) {
    imgMgrObserver.disconnect();
    imgMgrObserver = null;
  }

  grid.innerHTML = '';
  
  let warningHtml = '';
  if (db.items.length === 0 && total > 0) {
    warningHtml = `<div style="grid-column: 1 / -1; text-align:center; color:var(--danger); padding:10px; font-size:13px; background:var(--danger-soft); border-radius:8px; margin-bottom:10px;">提示：当前本地素材库为空（可能是无痕模式或拉取失败），所以图片均显示为未引用。</div>`;
  }
  if (warningHtml) grid.innerHTML = warningHtml;

  renderImgMgrBatch();
}

function renderImgMgrBatch() {
  const grid = $('imgMgrGrid');
  if (!grid) return;
  
  const oldSentinel = document.getElementById('imgMgrSentinel');
  if (oldSentinel) oldSentinel.remove();

  const nextFiles = imgMgrFilteredFiles.slice(imgMgrRenderedCount, imgMgrRenderedCount + IMG_MGR_BATCH_SIZE);
  
  requestAnimationFrame(() => {
    const html = nextFiles.map(f => {
      const url = imageUrlFromPath(f.relPath);
      const sizeStr = fmtSize(f.size);
      const usedBadge = f.isUsed 
        ? '<span class="mgr-badge used">已引用</span>' 
        : '<span class="mgr-badge unused">未引用</span>';

      // ★ 修复：直接按数组索引取色
      let idx = db.imageCategories.indexOf(f.cat);
      if (idx < 0) idx = 0;
      const palette = PALETTE[idx % PALETTE.length];

      return `<div class="mgr-card">
        <div class="mgr-img-wrap" data-open-img="${esc(url)}" data-img-path="${esc(f.relPath)}">
          <img src="${esc(url)}" loading="lazy">
          <button class="mgr-del-btn" data-del-img-mgr="${esc(f.relPath)}" data-sha="${esc(f.sha)}" title="彻底删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
        <div class="mgr-info">
          <div class="mgr-info-top">
            <span class="tag" style="background:${palette.bg}; color:${palette.fg}; border:none; padding:2px 10px; border-radius:6px; font-size:12px; letter-spacing:0;">${esc(f.cat)}</span>
            ${usedBadge}
          </div>
          <div class="mgr-info-bottom">
            <span>${sizeStr}</span>
            ${f.yearMonth ? `<span style="opacity:0.6; font-size:11px;">${esc(f.yearMonth)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    
    grid.insertAdjacentHTML('beforeend', html);
    imgMgrRenderedCount += nextFiles.length;

    if (imgMgrRenderedCount < imgMgrFilteredFiles.length) {
      const sentinel = document.createElement('div');
      sentinel.id = 'imgMgrSentinel';
      sentinel.style.cssText = 'grid-column: 1 / -1; height: 40px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px;';
      sentinel.textContent = '正在加载更多图片...';
      grid.appendChild(sentinel);

      if (!imgMgrObserver) {
        const scrollContainer = document.querySelector('#imgManagerView > div:nth-child(2)');
        imgMgrObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            setTimeout(() => renderImgMgrBatch(), 30);
          }
        }, { root: scrollContainer, rootMargin: '400px' });
      }
      imgMgrObserver.disconnect();
      imgMgrObserver.observe(sentinel);
    }
  });
}

async function deleteRepoImage(relPath, sha) {
  if (!confirm(`确定要从 GitHub 图床彻底删除这张图片吗？\n\n注意：删除后不可恢复！如果该图片被素材引用，相关素材里的这张图也会被同步清理。`)) return;
  
  const rc = ghRepoConfig('img');
  const fullPath = `${rc.path}/${relPath}`;
  
  try {
    const url = ghApiUrl(rc, fullPath);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${rc.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `delete ${relPath}`, sha: sha, branch: rc.branch })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    
    repoImagesCache = repoImagesCache.filter(f => f.relPath !== relPath);
    
    const affectedIds = new Set();
    let removedImagesCount = 0;
    
    db.items.forEach(item => {
      if (item.images) {
        const beforeLen = item.images.length;
        item.images = item.images.filter(im => {
          if (!im.path) return true;
          const ip = String(im.path).trim();
          const rp = String(relPath).trim();
          const isMatch = ip === rp || ip.endsWith(rp) || rp.endsWith(ip);
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
    
    let removedItemsCount = 0;
    if (affectedIds.size > 0) {
      const beforeCount = db.items.length;
      db.items = db.items.filter(i => {
        if (!affectedIds.has(i.id)) return true;
        return i.text || (i.images && i.images.length > 0);
      });
      removedItemsCount = beforeCount - db.items.length;
      
      save();
      render();
    }
    
    if (removedItemsCount > 0) {
      toast(`图片已删，并清理了 ${removedItemsCount} 条失去所有内容的空素材`);
    } else if (removedImagesCount > 0) {
      toast(`图片已删，并从素材中移除了 ${removedImagesCount} 处引用`);
    } else {
      toast('已彻底删除物理图片');
    }
    
    renderImgMgrUI();
    
  } catch (err) {
    console.error(err);
    toast('删除失败：' + err.message);
  }
}

async function cleanAllUnusedImages() {
  const unused = repoImagesCache.filter(f => !f.isUsed);
  if (!unused.length) return;
  
  if (!confirm(`确定要一键清理这 ${unused.length} 张未被引用的图片吗？\n\n这会直接向 GitHub 发送 ${unused.length} 个删除请求，不可恢复！`)) return;

  const btn = $('imgMgrCleanBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '正在清理...';

  const rc = ghRepoConfig('img');
  let success = 0;
  let fail = 0;

  for (const f of unused) {
    try {
      const fullPath = `${rc.path}/${f.relPath}`;
      const url = ghApiUrl(rc, fullPath);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${rc.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `delete unused ${f.relPath}`, sha: f.sha, branch: rc.branch })
      });
      if (res.ok) success++;
      else fail++;
    } catch (e) {
      fail++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  btn.disabled = false;
  btn.innerHTML = originalText;
  
  toast(`清理完成：成功 ${success} 张，失败 ${fail} 张`);
  await loadRepoImages();
}