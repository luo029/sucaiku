/* js / bind-views.js · 事件绑定：视图切换 / 各弹窗 / 设置表单 */
const safeBind = (id, event, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
};

safeBind('batchExportBtn', 'click', () => {
  if(!selectedIds.size){toast('请先选择素材');return;}
  openExportModal('__selected__');
});

safeBind('layoutBtn', 'click', () => {
  if(layoutMode==='sidebar')setLayout('compact');else setLayout('sidebar');
});
safeBind('sidebarCollapseBtn', 'click', () => setLayout('compact'));
safeBind('themeToggleBtn', 'click', () => {
  setTheme(themeMode==='light'?'dark':'light');
});
safeBind('zenBtn', 'click', () => setZen(true));
safeBind('zenExitBtn', 'click', () => setZen(false));

safeBind('focusBtn', 'click', () => setFocus(true));

safeBind('imgViewBtn', 'click', openImgView);
safeBind('imgViewClose', 'click', closeImgView);

safeBind('imgCatTabs', 'click', e => {
  const t=e.target.closest('.ic-tab');if(!t)return;
  currentImgViewCat=t.dataset.ic;
  renderImgView();
});
safeBind('imgMasonry', 'click', e => {
  const img=e.target.closest('[data-open-img]');
  if(img)window.open(img.dataset.openImg,'_blank','noopener');
});

// ★ 盲盒内的图片点击放大
safeBind('randomContent', 'click', e => {
  const img = e.target.closest('[data-open-img]');
  if(img) window.open(img.dataset.openImg,'_blank','noopener');
});

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(focusMode){setFocus(false);return;}
  if(zenMode){setZen(false);return;}
  if(!$('imgView').hidden){closeImgView();return;}
  if(!$('imgManagerView').hidden){
    if (imgMgrSelectMode) {
      exitImgMgrSelectMode();
    } else {
      $('imgManagerView').hidden=true;document.body.style.overflow='';
    }
    return;
  }
  const openMask=document.querySelector('.modal-mask.show');
  if(openMask){
    if(openMask.id==='modalMask'){closeModal();return;}
    openMask.classList.remove('show');
    return;
  }
});

safeBind('menuBtn', 'click', openSidebar);
safeBind('sidebarOverlay', 'click', closeSidebar);

safeBind('modalCancel', 'click', closeModal);
safeBind('modalConfirm', 'click', () => {
  if($('noRemind').checked)localStorage.setItem(SKIP_KEY,'1');
  const fn=pendingConfirm;closeModal();if(fn)fn();
});
safeBind('modalMask', 'click', e => {if(e.target===$('modalMask'))closeModal();});

// ★ 随机盲盒核心逻辑升级
let randomAnimating = false;
let randomFilterValue = 'all';
let autoFlipTimer = null; 
let randomFontSize = localStorage.getItem('random-font-size') || '20px';

function applyRandomFontSize() {
  if ($('randomContent')) {
    $('randomContent').style.fontSize = randomFontSize;
  }
}

safeBind('randomFontSizeBtn', 'click', e => {
  e.stopPropagation();
  if (randomFontSize === '20px') {
    randomFontSize = '24px';
  } else if (randomFontSize === '24px') {
    randomFontSize = '28px';
  } else {
    randomFontSize = '20px';
  }
  localStorage.setItem('random-font-size', randomFontSize);
  applyRandomFontSize();
  $('randomFontSizeBtn').textContent = randomFontSize === '20px' ? 'Aa' : (randomFontSize === '24px' ? 'Aa+' : 'Aa++');
});

function getRandomPool() {
  if (randomFilterValue === 'all') return db.items;
  if (randomFilterValue === 'text') return db.items.filter(i => i.text && i.text.trim());
  if (randomFilterValue === 'image') return db.items.filter(i => i.images && i.images.length > 0);
  
  if (randomFilterValue.startsWith('cat:')) {
    const c = randomFilterValue.slice(4);
    return db.items.filter(i => i.type === c);
  }
  if (randomFilterValue.startsWith('src:')) {
    const s = randomFilterValue.slice(4);
    return db.items.filter(i => i.source === s);
  }
  if (randomFilterValue.startsWith('tag:')) {
    const t = randomFilterValue.slice(4);
    return db.items.filter(i => (i.tags || []).includes(t) || (i.images||[]).some(im => (im.tags||[]).includes(t)));
  }
  return db.items;
}

function renderRandomFilterList() {
  const q = $('randomFilterSearch').value.trim().toLowerCase();
  const listEl = $('randomFilterList');
  
  let html = '';
  
  if (!q) {
    html += `<div class="sp-item ${randomFilterValue === 'all' ? 'sp-selected' : ''}" data-val="all"><span class="sp-name">全随机</span></div>`;
    html += `<div class="sp-item ${randomFilterValue === 'text' ? 'sp-selected' : ''}" data-val="text"><span class="sp-name">仅文字素材</span></div>`;
    html += `<div class="sp-item ${randomFilterValue === 'image' ? 'sp-selected' : ''}" data-val="image"><span class="sp-name">仅图片素材</span></div>`;
  }
  
  const cats = db.cats.filter(c => !q || c.toLowerCase().includes(q));
  if (cats.length) {
    html += `<div class="nav-label" style="margin-top:8px; margin-bottom:4px; padding-left:12px; font-size:12px; color:var(--text-3);">分类</div>`;
    cats.forEach(c => {
      html += `<div class="sp-item ${randomFilterValue === 'cat:' + c ? 'sp-selected' : ''}" data-val="cat:${esc(c)}">
        <span class="sp-name">${esc(c)}</span>
      </div>`;
    });
  }

  const srcs = db.sources.filter(s => !q || s.toLowerCase().includes(q));
  if (srcs.length) {
    html += `<div class="nav-label" style="margin-top:8px; margin-bottom:4px; padding-left:12px; font-size:12px; color:var(--text-3);">来源</div>`;
    srcs.forEach(s => {
      html += `<div class="sp-item ${randomFilterValue === 'src:' + s ? 'sp-selected' : ''}" data-val="src:${esc(s)}">
        <span class="sp-name">${esc(s)}</span>
      </div>`;
    });
  }

  const tags = Object.keys(collectTags()).filter(t => !q || t.toLowerCase().includes(q));
  if (tags.length) {
    html += `<div class="nav-label" style="margin-top:8px; margin-bottom:4px; padding-left:12px; font-size:12px; color:var(--text-3);">标签</div>`;
    tags.forEach(t => {
      html += `<div class="sp-item ${randomFilterValue === 'tag:' + t ? 'sp-selected' : ''}" data-val="tag:${esc(t)}">
        <span class="sp-name">#${esc(t)}</span>
      </div>`;
    });
  }

  if (!html) {
    html = `<div class="sp-empty">没有匹配的选项</div>`;
  }
  
  listEl.innerHTML = html;
}

safeBind('randomFilterBtn', 'click', e => {
  e.stopPropagation();
  $('randomAutoFlipPanel').hidden = true; // 关闭另一个面板
  const panel = $('randomFilterPanel');
  if (panel.hidden) {
    $('randomFilterSearch').value = '';
    renderRandomFilterList();
    panel.hidden = false;
    setTimeout(() => $('randomFilterSearch').focus(), 50);
  } else {
    panel.hidden = true;
  }
});

safeBind('randomFilterSearch', 'input', renderRandomFilterList);
safeBind('randomFilterSearch', 'keydown', e => {
  if (e.key === 'Escape') $('randomFilterPanel').hidden = true;
});

safeBind('randomFilterList', 'click', e => {
  const item = e.target.closest('.sp-item');
  if (!item) return;
  
  randomFilterValue = item.dataset.val;
  
  let btnText = '全随机';
  if (randomFilterValue === 'text') btnText = '仅文字';
  else if (randomFilterValue === 'image') btnText = '仅图片';
  else if (randomFilterValue.startsWith('cat:')) btnText = '分类: ' + randomFilterValue.slice(4);
  else if (randomFilterValue.startsWith('src:')) btnText = '来源: ' + randomFilterValue.slice(4);
  else if (randomFilterValue.startsWith('tag:')) btnText = '标签: #' + randomFilterValue.slice(4);
  
  $('randomFilterText').textContent = btnText;
  
  const btn = $('randomFilterBtn');
  if (randomFilterValue !== 'all') {
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    btn.style.background = 'var(--accent-soft)';
  } else {
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.style.background = '';
  }
  
  $('randomFilterPanel').hidden = true;
  drawRandomBox();
});

// 自动翻动面板控制
safeBind('randomAutoFlipToggleBtn', 'click', e => {
  e.stopPropagation();
  $('randomFilterPanel').hidden = true; // 关闭另一个面板
  const panel = $('randomAutoFlipPanel');
  if (panel.hidden) {
    $('randomAutoFlipCheck').checked = !!autoFlipTimer; // 同步状态
    panel.hidden = false;
  } else {
    panel.hidden = true;
  }
});

// 点击外部关闭面板
document.addEventListener('click', e => {
  const filterPanel = $('randomFilterPanel');
  if (filterPanel && !filterPanel.hidden && !$('randomFilterBtn').contains(e.target) && !filterPanel.contains(e.target)) {
    filterPanel.hidden = true;
  }
  
  const autoPanel = $('randomAutoFlipPanel');
  if (autoPanel && !autoPanel.hidden && !$('randomAutoFlipToggleBtn').contains(e.target) && !autoPanel.contains(e.target)) {
    autoPanel.hidden = true;
  }
});

function stopAutoFlip() {
  if (autoFlipTimer) {
    clearInterval(autoFlipTimer);
    autoFlipTimer = null;
  }
  if ($('randomAutoFlipCheck')) $('randomAutoFlipCheck').checked = false;
}

function startAutoFlip() {
  if (autoFlipTimer) {
    clearInterval(autoFlipTimer);
    autoFlipTimer = null;
  }
  const check = $('randomAutoFlipCheck');
  if (!check || !check.checked) return;
  
  let sec = parseInt($('randomAutoFlipTime').value, 10);
  if (isNaN(sec) || sec < 5) sec = 5;
  if (sec > 300) sec = 300;
  $('randomAutoFlipTime').value = sec;
  localStorage.setItem('random-auto-flip-time', sec);

  autoFlipTimer = setInterval(() => {
    if (!$('randomMask').classList.contains('show')) {
      stopAutoFlip();
      return;
    }
    drawRandomBox();
  }, sec * 1000);
}

function drawRandomBox() {
  if(randomAnimating) return;
  if(!db.items.length){toast('还没有素材，先添加一些吧');return;}
  
  const pool = getRandomPool();
  
  if (pool.length === 0) {
    toast('当前筛选条件下没有素材');
    stopAutoFlip();
    return;
  }
  
  const randomIndex=Math.floor(Math.random()*pool.length);
  const item=pool[randomIndex];
  const c=catColor(item.type);
  
  const renderContent = () => {
    // 使用 margin: auto 实现内容少时绝对居中，内容多时从顶部开始滚动
    return `
      <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center;">
        <div style="display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:16px;flex-wrap:wrap;width:100%;">
          <span class="tag${item.type===IMG_TYPE?' tag-img':''}" style="${item.type===IMG_TYPE?'':`background:${c.bg};color:${c.fg}`}">${esc(item.type)}</span>
          ${item.source?`<span style="font-size:13.5px;color:var(--text-2);font-weight:500;">${esc(item.source)}</span>`:''}
          ${item.tags && item.tags.length ? item.tags.map(t=>`<span class="tag-chip" style="pointer-events:none;font-size:11.5px;">#${esc(t)}</span>`).join('') : ''}
        </div>
        ${item.text?`<div style="color:var(--text); white-space:pre-wrap; word-break:break-word; text-align:center; width:100%;">${formatText(item.text)}</div>`:''}
        ${item.images&&item.images.length?`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;justify-content:center;width:100%;">${item.images.map(im=>{
          const src=imageSrc(im);
          return `<span class="ci" style="position:relative; display:inline-block; max-width:100%; line-height:0;">
            <img src="${esc(src)}" data-open-img="${esc(src)}" data-img-path="${esc(im.path||'')}" style="max-width:100%; max-height:260px; object-fit:contain; border-radius:12px; border:1px solid var(--line); box-shadow:0 4px 12px rgba(0,0,0,0.05); display:block; cursor:zoom-in; margin: 0 auto;">
            <span style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.65); color:#fff; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:600; backdrop-filter:blur(4px); letter-spacing:0.5px;">${esc(im.cat || '其他')}</span>
          </span>`;
        }).join('')}</div>`:''}
      </div>
    `;
  };

  if($('randomMask').classList.contains('show') === false) {
    $('randomContent').innerHTML = renderContent();
    $('randomMask').classList.add('show');
    $('randomFontSizeBtn').textContent = randomFontSize === '20px' ? 'Aa' : (randomFontSize === '24px' ? 'Aa+' : 'Aa++');
    applyRandomFontSize();
    return;
  }

  if (db.settings.enableAnim === false) {
    $('randomContent').innerHTML = renderContent();
    return;
  }

  randomAnimating = true;
  const contentEl = $('randomContent');
  
  contentEl.style.transition = 'all 0.2s ease';
  contentEl.style.transform = 'translateY(20px)';
  contentEl.style.opacity = '0';
  
  setTimeout(() => {
    contentEl.innerHTML = renderContent();
    contentEl.style.transform = 'translateY(-20px)';
    contentEl.style.transition = 'none';
    
    void contentEl.offsetWidth;
    
    contentEl.style.transition = 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1.15)';
    contentEl.style.transform = 'translateY(0)';
    contentEl.style.opacity = '1';
    
    setTimeout(() => { randomAnimating = false; }, 350);
  }, 200);
}

safeBind('menuRandomBtn', 'click', () => {
  randomFilterValue = 'all';
  $('randomFilterText').textContent = '全随机';
  const btn = $('randomFilterBtn');
  btn.style.borderColor = '';
  btn.style.color = '';
  btn.style.background = '';
  
  const savedTime = localStorage.getItem('random-auto-flip-time') || '30';
  $('randomAutoFlipTime').value = savedTime;
  $('randomAutoFlipCheck').checked = false;
  $('randomAutoFlipPanel').hidden = true;
  $('randomFilterPanel').hidden = true;
  
  drawRandomBox();
});

safeBind('randomAutoFlipCheck', 'change', e => {
  if (e.target.checked) {
    startAutoFlip();
  } else {
    stopAutoFlip();
  }
});

safeBind('randomAutoFlipTime', 'change', e => {
  let sec = parseInt(e.target.value, 10);
  if (isNaN(sec) || sec < 5) sec = 5;
  if (sec > 300) sec = 300;
  e.target.value = sec;
  localStorage.setItem('random-auto-flip-time', sec);
  
  if (autoFlipTimer) {
    startAutoFlip(); 
  }
});

safeBind('randomCloseBtn', 'click', () => {
  stopAutoFlip();
  $('randomMask').classList.remove('show');
});
safeBind('randomAgainBtn', 'click', () => {
  drawRandomBox();
  if (autoFlipTimer) {
    startAutoFlip(); 
  }
});
safeBind('randomMask', 'click', e => {
  if(e.target===$('randomMask')){
    stopAutoFlip();
    $('randomMask').classList.remove('show');
  }
});

safeBind('menuDupBtn', 'click', checkDuplicates);
safeBind('dupCloseBtn', 'click', () => $('dupMask').classList.remove('show'));
safeBind('dupMask', 'click', e => {if(e.target===$('dupMask'))$('dupMask').classList.remove('show');});
safeBind('dupList', 'click', e => {
  const delBtn=e.target.closest('[data-del-dup]');
  if(delBtn){
    const id=delBtn.dataset.delDup;
    moveToTrash([id]);save();render();toast('已移入回收站');checkDuplicates();
  }
});

safeBind('menuStatsBtn', 'click', openStats);
safeBind('statsCloseBtn', 'click', () => $('statsMask').classList.remove('show'));
safeBind('statsMask', 'click', e => {if(e.target===$('statsMask'))$('statsMask').classList.remove('show');});

safeBind('menuHealthBtn', 'click', openHealth);
safeBind('healthCloseBtn', 'click', () => $('healthMask').classList.remove('show'));
safeBind('healthMask', 'click', e => {if(e.target===$('healthMask'))$('healthMask').classList.remove('show');});
safeBind('healthList', 'click', e => {
  const row=e.target.closest('[data-edit]');if(!row)return;
  const id=row.dataset.edit;
  $('healthMask').classList.remove('show');
  if(db.items.some(i=>i.id===id))startEdit(id);
  else toast('该素材已不存在');
});

safeBind('menuTrashBtn', 'click', () => {
  cleanTrash();renderTrash();$('trashMask').classList.add('show');
});
safeBind('trashCloseBtn', 'click', () => $('trashMask').classList.remove('show'));
safeBind('trashMask', 'click', e => {if(e.target===$('trashMask'))$('trashMask').classList.remove('show');});
safeBind('trashClearBtn', 'click', () => {
  if(!db.trash.length){toast('回收站已经是空的');return;}
  if(!confirm(`确定清空回收站吗？${db.trash.length} 条素材将被彻底删除，不可恢复。`))return;
  db.trash=[];save();renderTrash();toast('已清空回收站');
});
safeBind('trashList', 'click', e => {
  const r=e.target.closest('[data-restore]');
  if(r){restoreFromTrash(r.dataset.restore);return;}
  const p=e.target.closest('[data-purge]');
  if(p){
    if(!confirm('彻底删除这条素材？不可恢复。'))return;
    purgeTrashItem(p.dataset.purge);toast('已彻底删除');
  }
});

safeBind('menuImgManagerBtn', 'click', () => {
  $('menu').classList.remove('show');
  openImgManager();
});
safeBind('imgMgrCloseBtn', 'click', () => {
  if (imgMgrSelectMode) exitImgMgrSelectMode();
  $('imgManagerView').hidden = true;
  document.body.style.overflow = '';
});
safeBind('imgMgrRefreshBtn', 'click', loadRepoImages);
safeBind('imgMgrCleanUnusedBtn', 'click', cleanAllUnusedImages);

// ★ 图床批量操作交互
safeBind('imgMgrSelectBtn', 'click', () => {
  imgMgrSelectMode = !imgMgrSelectMode;
  imgMgrSelectedIds.clear(); 
  renderImgMgrUI();
  if (imgMgrSelectMode) toast('已进入批量管理，请点击图片进行选择');
});

safeBind('imgMgrBatchExit', 'click', () => {
  exitImgMgrSelectMode();
});

safeBind('imgMgrSelectAllBtn', 'click', () => {
  const pageItems = imgMgrFilteredFiles.slice(0, imgMgrRenderedCount); 
  const allSel = pageItems.every(f => imgMgrSelectedIds.has(f.relPath));
  if (allSel) {
    pageItems.forEach(f => imgMgrSelectedIds.delete(f.relPath));
  } else {
    pageItems.forEach(f => imgMgrSelectedIds.add(f.relPath));
  }
  renderImgMgrUI();
});

safeBind('imgMgrBatchCatBtn', 'click', () => {
  if (!imgMgrSelectedIds.size) return toast('请先选择图片');
  $('imgMgrBatchEditTitle').textContent = '批量修改分类';
  $('imgMgrBatchEditCount').textContent = imgMgrSelectedIds.size;
  $('imgMgrBatchCatWrap').style.display = 'block';
  $('imgMgrBatchTagWrap').style.display = 'none';
  
  const cats = (db.imageCategories.length ? db.imageCategories : DEFAULT_IMG_CATS);
  const grid = $('imgMgrBatchCatGrid');
  grid.innerHTML = cats.map((c, i) => {
    const palette = PALETTE[i % PALETTE.length];
    return `<div class="batch-cat-item" data-cat="${esc(c)}">${esc(c)}</div>`;
  }).join('');
  
  const first = grid.querySelector('.batch-cat-item');
  if (first) {
    first.classList.add('active');
    grid.dataset.selected = first.dataset.cat;
  }
  
  $('imgMgrBatchEditMask').classList.add('show');
});

$('imgMgrBatchCatGrid').addEventListener('click', e => {
  const item = e.target.closest('.batch-cat-item');
  if (!item) return;
  const grid = $('imgMgrBatchCatGrid');
  grid.querySelectorAll('.batch-cat-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');
  grid.dataset.selected = item.dataset.cat;
});

let selectedBatchTags = new Set(); 

safeBind('imgMgrBatchTagBtn', 'click', () => {
  if (!imgMgrSelectedIds.size) return toast('请先选择图片');
  $('imgMgrBatchEditTitle').textContent = '批量修改标签';
  $('imgMgrBatchEditCount').textContent = imgMgrSelectedIds.size;
  $('imgMgrBatchCatWrap').style.display = 'none';
  $('imgMgrBatchTagWrap').style.display = 'block';
  
  $('imgMgrBatchTagNewInput').value = '';
  $('imgMgrBatchTagSearch').value = '';
  $('imgMgrBatchTagPoolWrap').style.display = 'none';
  selectedBatchTags.clear();
  
  repoImagesCache.forEach(f => {
    if (imgMgrSelectedIds.has(f.relPath)) {
      (f.tags || []).forEach(t => selectedBatchTags.add(t));
    }
  });
  
  renderBatchTagPool();
  $('imgMgrBatchEditMask').classList.add('show');
});

function renderBatchTagPool() {
  const selectedWrap = $('imgMgrBatchSelectedTags');
  if (selectedWrap) {
    if (selectedBatchTags.size === 0) {
      selectedWrap.innerHTML = '<span style="font-size:13px; color:var(--text-3);">暂无标签，可直接输入或点击右侧搜索添加</span>';
    } else {
      selectedWrap.innerHTML = Array.from(selectedBatchTags).map(t => `
        <span class="batch-tag-item active" style="cursor:default; padding:4px 10px;">
          #${esc(t)}
          <span data-remove-tag="${esc(t)}" style="cursor:pointer; font-size:16px; line-height:1; opacity:0.6; margin-left:4px; padding:0 2px; transition:opacity 0.15s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" title="移除">×</span>
        </span>
      `).join('');
    }
  }

  const q = $('imgMgrBatchTagSearch').value.trim().toLowerCase();
  const allTags = Object.keys(collectTags()).sort((a,b) => a.localeCompare(b,'zh'));
  const pool = $('imgMgrBatchTagPool');
  
  if (!allTags.length) {
    pool.innerHTML = '<div style="font-size:13px; color:var(--text-3); width:100%; text-align:center; padding:12px;">暂无标签，请直接输入</div>';
    return;
  }
  
  const filtered = allTags.filter(t => !q || t.toLowerCase().includes(q));
  
  if (!filtered.length) {
    pool.innerHTML = '<div style="font-size:13px; color:var(--text-3); width:100%; text-align:center; padding:12px;">没有找到匹配的标签</div>';
    return;
  }
  
  pool.innerHTML = filtered.map(t => {
    const isSel = selectedBatchTags.has(t);
    return `<div class="batch-tag-item ${isSel?'active':''}" data-tag="${esc(t)}">
      ${isSel?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>':''}
      #${esc(t)}
    </div>`;
  }).join('');
}

$('imgMgrBatchTagSearch').addEventListener('input', renderBatchTagPool);

$('imgMgrBatchSelectedTags').addEventListener('click', e => {
  const btn = e.target.closest('[data-remove-tag]');
  if (!btn) return;
  const t = btn.dataset.removeTag;
  selectedBatchTags.delete(t);
  renderBatchTagPool();
});

$('imgMgrBatchTagPool').addEventListener('click', e => {
  const item = e.target.closest('.batch-tag-item');
  if (!item) return;
  const t = item.dataset.tag;
  if (selectedBatchTags.has(t)) selectedBatchTags.delete(t);
  else selectedBatchTags.add(t);
  renderBatchTagPool();
});

safeBind('imgMgrBatchTagSearchBtn', 'click', () => {
  const wrap = $('imgMgrBatchTagPoolWrap');
  if (wrap.style.display === 'none') {
    wrap.style.display = 'block';
    $('imgMgrBatchTagSearch').focus();
  } else {
    wrap.style.display = 'none';
    $('imgMgrBatchTagSearch').value = '';
    renderBatchTagPool();
  }
});

safeBind('imgMgrBatchTagAddBtn', 'click', () => {
  const val = $('imgMgrBatchTagNewInput').value.trim();
  if (!val) return;
  const tags = val.split(/[,，\s]+/).filter(Boolean);
  tags.forEach(t => selectedBatchTags.add(t));
  $('imgMgrBatchTagNewInput').value = '';
  renderBatchTagPool();
});

safeBind('imgMgrBatchTagNewInput', 'keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('imgMgrBatchTagAddBtn').click();
  }
});

safeBind('imgMgrBatchEditCancel', 'click', () => {
  $('imgMgrBatchEditMask').classList.remove('show');
});

safeBind('imgMgrBatchEditConfirm', 'click', () => {
  const isCat = $('imgMgrBatchEditTitle').textContent.includes('分类');
  let updatedCount = 0;
  
  if (isCat) {
    const newCat = $('imgMgrBatchCatGrid').dataset.selected;
    if (!newCat) return toast('请选择一个分类');
    
    repoImagesCache.forEach(f => {
      if (imgMgrSelectedIds.has(f.relPath)) f.cat = newCat;
    });
    
    db.items.forEach(item => {
      if (item.images) {
        item.images.forEach(im => {
          if (!im.path) return;
          const ip = String(im.path).trim();
          for (const relPath of imgMgrSelectedIds) {
            const rp = String(relPath).trim();
            const filename = relPath.split('/').pop();
            if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.includes(filename)) {
              im.cat = newCat;
              updatedCount++;
              break;
            }
          }
        });
      }
    });
    toast(`已修改 ${imgMgrSelectedIds.size} 张图片的分类${updatedCount ? '，并同步了 '+updatedCount+' 处引用' : ''}`);
  } else {
    const newTags = Array.from(selectedBatchTags);
    repoImagesCache.forEach(f => {
      if (imgMgrSelectedIds.has(f.relPath)) f.tags = newTags.slice();
    });
    
    db.items.forEach(item => {
      if (item.images) {
        item.images.forEach(im => {
          if (!im.path) return;
          const ip = String(im.path).trim();
          for (const relPath of imgMgrSelectedIds) {
            const rp = String(relPath).trim();
            const filename = relPath.split('/').pop();
            if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.includes(filename)) {
              im.tags = newTags.slice();
              updatedCount++;
              break;
            }
          }
        });
      }
    });
    toast(`已修改 ${imgMgrSelectedIds.size} 张图片的标签${updatedCount ? '，并同步了 '+updatedCount+' 处引用' : ''}`);
  }
  
  save();
  $('imgMgrBatchEditMask').classList.remove('show');
  exitImgMgrSelectMode();
});

safeBind('imgMgrBatchDelBtn', 'click', async () => {
  if (!imgMgrSelectedIds.size) return toast('请先选择图片');
  const count = imgMgrSelectedIds.size;
  if (!confirm(`确定要彻底删除选中的 ${count} 张图片吗？\n\n这会直接向 GitHub 发送 ${count} 个删除请求，不可恢复！`)) return;
  
  const btn = $('imgMgrBatchDelBtn');
  const origText = btn.innerHTML;
  btn.disabled = true;
  
  const rc = ghRepoConfig('img');
  let success = 0;
  let fail = 0;
  let done = 0;
  
  const toDelete = repoImagesCache.filter(f => imgMgrSelectedIds.has(f.relPath));
  
  async function deleteOne(f) {
    try {
      const fullPath = `${rc.path}/${f.relPath}`;
      const url = ghApiUrl(rc, fullPath);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${rc.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `delete batch ${f.relPath}`, sha: f.sha, branch: rc.branch })
      });
      if (res.ok) {
        success++;
        repoImagesCache = repoImagesCache.filter(x => x.relPath !== f.relPath);
      } else {
        fail++;
      }
    } catch (e) {
      fail++;
    } finally {
      done++;
      btn.innerHTML = `正在删除 ${done}/${toDelete.length}...`;
    }
  }
  
  try {
    const CONCURRENCY = 3;
    let idx = 0;
    async function worker() {
      while (idx < toDelete.length) {
        const i = idx++;
        await deleteOne(toDelete[i]);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    await Promise.all(Array.from({length: Math.min(CONCURRENCY, toDelete.length)}, () => worker()));
    
    const affectedIds = new Set();
    let removedImagesCount = 0;
    db.items.forEach(item => {
      if (item.images) {
        const beforeLen = item.images.length;
        item.images = item.images.filter(im => {
          if (!im.path) return true;
          const ip = String(im.path).trim();
          for (const f of toDelete) {
            const rp = String(f.relPath).trim();
            if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip)) {
              removedImagesCount++;
              return false;
            }
          }
          return true;
        });
        if (item.images.length !== beforeLen) affectedIds.add(item.id);
      }
    });
    
    if (affectedIds.size > 0) {
      db.items = db.items.filter(i => {
        if (!affectedIds.has(i.id)) return true;
        return i.text || (i.images && i.images.length > 0);
      });
      save();
      render();
    }
    
    toast(`清理完成：成功 ${success} 张，失败 ${fail} 张`);
  } catch (e) {
    console.error(e);
    toast('批量删除出错：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    exitImgMgrSelectMode();
  }
});

safeBind('imgMgrGrid', 'click', e => {
  const rmTagBtn = e.target.closest('[data-rm-tag]');
  if (rmTagBtn) {
    e.stopPropagation();
    const relPath = rmTagBtn.dataset.relPath;
    const tag = rmTagBtn.dataset.rmTag;
    
    const imgItem = repoImagesCache.find(x => x.relPath === relPath);
    if (imgItem) {
      imgItem.tags = (imgItem.tags || []).filter(t => t !== tag);
    }
    
    db.items.forEach(item => {
      if (item.images) {
        item.images.forEach(im => {
          if (!im.path) return;
          const ip = String(im.path).trim();
          const rp = String(relPath).trim();
          const filename = relPath.split('/').pop();
          if (ip === rp || ip.endsWith(rp) || rp.endsWith(ip) || ip.includes(filename)) {
            if (im.tags) im.tags = im.tags.filter(t => t !== tag);
          }
        });
      }
    });
    
    save();
    renderImgMgrUI();
    return;
  }

  if (imgMgrSelectMode) {
    const card = e.target.closest('.mgr-card');
    if (card && card.dataset.relPath) {
      toggleSelectImgMgr(card.dataset.relPath);
    }
    return;
  }
  
  const delBtn = e.target.closest('[data-del-img-mgr]');
  if (delBtn) {
    e.stopPropagation();
    deleteRepoImage(delBtn.dataset.delImgMgr, delBtn.dataset.sha);
    return;
  }
  
  const img = e.target.closest('[data-open-img]');
  if (img) {
    window.open(img.dataset.openImg, '_blank', 'noopener');
  }
});

safeBind('menuExportBtn', 'click', () => openExportModal());
safeBind('menuImportBtn', 'click', () => $('fileInput').click());
safeBind('moreBtn', 'click', e => {
  e.stopPropagation();$('menu').classList.toggle('show');
});
document.addEventListener('click',()=>$('menu').classList.remove('show'));
safeBind('menu', 'click', e => {
  if(e.target.closest('button'))$('menu').classList.remove('show');
});
safeBind('sidebarExportBtn', 'click', () => {
  if(!db.items.length){toast('还没有素材');return;}
  openExportModal();
});
safeBind('exportCancel', 'click', closeExportModal);
safeBind('exportConfirm', 'click', doExport);
safeBind('exportMask', 'click', e => {if(e.target===$('exportMask'))closeExportModal();});
safeBind('exportFormat', 'click', e => {
  const b=e.target.closest('button[data-fmt]');if(!b)return;
  exportFormat=b.dataset.fmt;
  $('exportFormat').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);});
});
safeBind('sidebarImportBtn', 'click', () => $('fileInput').click());
safeBind('fileInput', 'change', e => {
  const f=e.target.files[0];if(!f)return;
  handleImportFile(f);e.target.value='';
});

safeBind('settingCloseBtn', 'click', () => {
  const mask = $('settingMask');
  if (mask) mask.classList.remove('show');
});
safeBind('settingMask', 'click', e => {
  if(e.target===$('settingMask')) $('settingMask').classList.remove('show');
});

safeBind('settingTabs', 'click', e => {
  const btn = e.target.closest('.st-tab');
  if (!btn) return;
  $('settingTabs').querySelectorAll('.st-tab').forEach(b => {
    b.style.color = 'var(--text-2)'; b.style.background = 'transparent'; b.style.fontWeight = '500';
    b.classList.remove('active');
  });
  btn.style.color = 'var(--accent)'; btn.style.background = 'var(--accent-soft)'; btn.style.fontWeight = '600';
  btn.classList.add('active');
  const target = btn.dataset.target;
  document.querySelectorAll('.st-scroll .st-card').forEach(card => {
    card.style.display = (card.dataset.group === target) ? 'block' : 'none';
  });
});

function resetSettingsTabs() {
  const tabs = document.querySelectorAll('#settingTabs .st-tab');
  tabs.forEach(b => {
    const isGen = b.dataset.target === 'general';
    b.classList.toggle('active', isGen);
    b.style.color = isGen ? 'var(--accent)' : 'var(--text-2)';
    b.style.background = isGen ? 'var(--accent-soft)' : 'transparent';
    b.style.fontWeight = isGen ? '600' : '500';
  });
  document.querySelectorAll('.st-scroll .st-card').forEach(card => {
    card.style.display = (card.dataset.group === 'general') ? 'block' : 'none';
  });
}

function openSettings() {
  renderStyleOptions();
  applySettingsToUI();
  fillGHForm();
  updateTinyUsageUI();
  renderSettingsOverview();
  resetSettingsTabs();
  
  const scrollEl = document.querySelector('.st-scroll');
  if (scrollEl) scrollEl.scrollTop = 0;
  
  $('settingMask').classList.add('show');
}
safeBind('menuSettingBtn', 'click', openSettings);
safeBind('gearBtn', 'click', openSettings);

safeBind('focusModeCatInput', 'change', e => {
  db.settings.focusModeCat = e.target.value.trim() || '收件箱';
  saveSettings();
  toast(`专注模式默认分类设为「${db.settings.focusModeCat}」`);
});

safeBind('openFocusModeBtn', 'click', () => {
  $('settingMask').classList.remove('show');
  setFocus(true);
});

safeBind('focusExitBtn', 'click', () => {
  setFocus(false);
});

safeBind('themeDarkToggle', 'change', e => {
  setTheme(e.target.checked ? 'dark' : 'light');
});
safeBind('useRelativeTimeToggle', 'change', e => {
  db.settings.useRelativeTime = e.target.checked;
  saveSettings();
  renderList();
  toast(e.target.checked ? '已切换为相对时间' : '已切换为绝对时间');
});

safeBind('saveShortcut', 'click', e => {
  const b = e.target.closest('button[data-shortcut]'); if(!b) return;
  db.settings.saveShortcut = b.dataset.shortcut; 
  saveSettings(); applySettingsToUI();
  toast('保存快捷键已更新');
});

safeBind('uiStyleMode', 'click', e => {
  const b = e.target.closest('button[data-style]'); if(!b) return;
  db.settings.uiStyle = b.dataset.style;
  saveSettings(); 
  renderStyleOptions();
  applySettingsToUI();
  const styleName = AVAILABLE_STYLES.find(s => s.id === db.settings.uiStyle)?.name || '新风格';
  toast('已切换至「' + styleName + '」');
});

safeBind('listStyleMode', 'click', e => {
  const b = e.target.closest('button[data-style]'); if(!b) return;
  db.settings.listStyle = b.dataset.style; 
  saveSettings(); applySettingsToUI();
  toast('列表排版已调整');
});

safeBind('zenFontSize', 'click', e => {
  const b = e.target.closest('button[data-zfs]'); if(!b) return;
  db.settings.zenFontSize = b.dataset.zfs; 
  saveSettings(); applySettingsToUI();
  toast('极简模式字号已调整');
});

safeBind('sidebarShowCat', 'change', e => {
  db.settings.sidebarShowCat = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示分类' : '已隐藏分类');
});
safeBind('sidebarShowSrc', 'change', e => {
  db.settings.sidebarShowSrc = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示来源' : '已隐藏来源');
});
safeBind('sidebarShowTag', 'change', e => {
  db.settings.sidebarShowTag = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示标签' : '已隐藏标签');
});

safeBind('copyWithSource', 'change', e => {
  db.settings.copyWithSource=e.target.checked;
  if($('copySourceFormatWrap')) $('copySourceFormatWrap').style.display = e.target.checked ? 'block' : 'none';
  saveSettings();
  toast(e.target.checked?'已开启复制附带后缀':'已关闭');
});
safeBind('copySourceFormat', 'change', e => {
  db.settings.copySourceFormat = e.target.value; 
  saveSettings();
  toast('自定义后缀格式已保存');
});

safeBind('enableMarkdown', 'change', e => {
  db.settings.enableMarkdown = e.target.checked;
  saveSettings();
  renderList();
  toast(e.target.checked ? '已启用 Markdown 格式' : '已关闭 Markdown 格式');
});

safeBind('copyWithoutMarks', 'change', e => {
  db.settings.copyWithoutMarks = e.target.checked;
  saveSettings();
  toast(e.target.checked ? '复制时将自动去除标记符号' : '复制时将保留标记符号');
});

safeBind('copyKeepBlankLines', 'change', e => {
  db.settings.copyKeepBlankLines = e.target.checked;
  saveSettings();
  toast(e.target.checked ? '复制时保留空行' : '复制时压缩空行');
});

safeBind('trashTtlInput', 'change', e => {
  const v=Math.max(1,Math.min(365,parseInt(e.target.value,10)||30));
  e.target.value=v;db.settings.trashTtlDays=v;saveSettings();cleanTrash();renderTrash();
  toast(`回收站保留 ${v} 天`);
});
safeBind('statDimCat', 'change', e => {db.settings.statsDims.cat=e.target.checked;saveSettings();});
safeBind('statDimSource', 'change', e => {db.settings.statsDims.source=e.target.checked;saveSettings();});
safeBind('statDimTag', 'change', e => {db.settings.statsDims.tag=e.target.checked;saveSettings();});
safeBind('statLimitInput', 'change', e => {
  const v=Math.max(3,Math.min(30,parseInt(e.target.value,10)||8));
  e.target.value=v;db.settings.statsLimit=v;saveSettings();
});

safeBind('catLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.catLimit = v; saveSettings(); renderSidebar();
  toast(`分类最多显示 ${v} 个`);
});
safeBind('srcLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.srcLimit = v; saveSettings(); renderSidebar();
  toast(`来源最多显示 ${v} 个`);
});
safeBind('tagLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.tagLimit = v; saveSettings(); renderTags();
  toast(`标签最多显示 ${v} 个`);
});

safeBind('defaultTypeSelect', 'change', e => {
  db.settings.defaultType = e.target.value;
  saveSettings();
  refreshTypeSelect(db.settings.defaultType || db.cats[0] || '');
  toast('已设置默认分类');
});
safeBind('collapseLimitInput', 'change', e => {
  const v = Math.max(50, Math.min(9999, parseInt(e.target.value, 10) || 150));
  e.target.value = v; db.settings.collapseLimit = v; saveSettings(); renderList();
  toast(`折叠阈值改为 ${v} 字`);
});
safeBind('defaultPageSizeSelect', 'change', e => {
  const v = parseInt(e.target.value, 10);
  db.settings.defaultPageSize = v; pageSize = v; currentPage = 1; saveSettings(); renderList();
  toast(`默认每页 ${v} 条`);
});

safeBind('showHitokoto', 'change', e => {
  db.settings.showHitokoto = e.target.checked; saveSettings(); applySettingsToUI();
});
safeBind('enableAnim', 'change', e => {
  db.settings.enableAnim = e.target.checked; saveSettings(); applySettingsToUI();
});
safeBind('fontSizeMode', 'click', e => {
  const b = e.target.closest('button[data-size]'); if(!b) return;
  db.settings.fontSizeMode = b.dataset.size; saveSettings(); applySettingsToUI();
  toast('字号已调整');
});

// ★ 设置面板：专注模式传图配置事件
safeBind('focusImgAutoUpload', 'change', e => {
  db.settings.focusImgAutoUpload = e.target.checked;
  saveSettings();
  if ($('focusImgCatWrap')) $('focusImgCatWrap').style.display = e.target.checked ? 'block' : 'none';
});
safeBind('focusImgDefaultCat', 'change', e => {
  db.settings.focusImgDefaultCat = e.target.value;
  saveSettings();
  toast(`专注模式默认传图分类设为「${e.target.value}」`);
});

safeBind('compressMode', 'click', e => {
  const b=e.target.closest('button[data-mode]');if(!b)return;
  db.settings.compressMode=b.dataset.mode;
  saveSettings(); applySettingsToUI();
  toast('压缩方式：'+({none:'不压缩',local:'本地压缩',tinypng:'TinyPNG'}[db.settings.compressMode]));
});
safeBind('tinypngKey', 'change', e => {
  db.settings.tinypngKey=e.target.value.trim();saveSettings();toast('已保存 TinyPNG Key');
});
safeBind('tinypngProxy', 'change', e => {
  db.settings.tinypngProxy=e.target.value.trim();saveSettings();toast('已保存 TinyPNG 代理');
});

['ghToken','ghOwner','ghRepo','ghBranch','ghDataPath','ghSiteBase','ghImgOwner','ghImgRepo','ghImgBranch','ghImgPath','ghImgSite','ghImgToken'].forEach(id=>{
  safeBind(id, 'change', () => collectGHForm());
});
safeBind('ghAuto', 'change', () => collectGHForm());
safeBind('ghAutoPull', 'change', () => collectGHForm());
safeBind('autoPushDelay', 'change', () => {
  const v=Math.max(1,Math.min(60,parseInt($('autoPushDelay').value,10)||2));
  $('autoPushDelay').value=v;
  collectGHForm();
  toast(`自动推送间隔 ${v} 秒`);
});

safeBind('syncCheckIntervalInput', 'change', e => {
  const v = Math.max(10, Math.min(3600, parseInt(e.target.value, 10) || 60));
  e.target.value = v;
  db.settings.syncCheckInterval = v;
  saveSettings();
  if(typeof restartSyncTimer === 'function') restartSyncTimer();
  toast(`检查间隔已设为 ${v} 秒`);
});

safeBind('autoCheckUpdateToggle', 'change', e => {
  db.settings.autoCheckUpdate = e.target.checked;
  saveSettings();
  if(typeof restartSyncTimer === 'function') restartSyncTimer();
  toast(e.target.checked ? '已开启云端巡检' : '已关闭云端巡检');
});

safeBind('ghTestBtn', 'click', () => {collectGHForm();ghTest();});
safeBind('ghPullBtn', 'click', async () => {
  collectGHForm();
  if(!confirm('拉取会用远程数据覆盖本地数据，确定继续？'))return;
  await ghPull(false);
});
safeBind('ghPushBtn', 'click', async () => {
  collectGHForm();
  await ghPush(false);
});

safeBind('ghForcePushBtn', 'click', async () => {
  if(!confirm('⚠️ 危险操作：强制推送将以你当前的本地数据为准，强行覆盖云端的所有数据！\n\n确定要继续吗？')) return;
  collectGHForm();
  const ok = await ghPush(false, true);
  if(ok) toast('已强制覆盖云端数据');
});

/* 图片分类 UI */
const oldImgCatsInput = document.getElementById('imgCatsInput');
if (oldImgCatsInput) {
  const parent = oldImgCatsInput.parentElement.parentElement;
  parent.innerHTML = `
    <div id="imgCatsEditor" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:34px; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:var(--r-sm);"></div>
    <div style="display:flex; gap:10px;">
      <input type="text" id="newImgCatInput" placeholder="输入新分类，按回车添加" autocomplete="off" style="flex:1; border:1px solid var(--line); border-radius:var(--r-sm); padding:9px 12px; font-size:14px; color:var(--text); background:var(--card); outline:none;">
    </div>
  `;

  window.renderImgCatsEditor = function() {
    const editor = document.getElementById('imgCatsEditor');
    if (!editor) return;
    editor.innerHTML = db.imageCategories.map((c, idx) => {
      const palette = PALETTE[idx % PALETTE.length];
      return `
        <div style="display:inline-flex; align-items:center; gap:6px; background:${palette.bg}; color:${palette.fg}; padding:4px 10px 4px 12px; border-radius:99px; font-size:13px; font-weight:600; border:1px solid ${palette.fg};">
          ${esc(c)}
          <button data-del-img-cat="${esc(c)}" style="width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.05); color:${palette.fg}; cursor:pointer; transition:all 0.15s;" title="删除">✕</button>
        </div>
      `;
    }).join('');
  };

  document.getElementById('imgCatsEditor').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-img-cat]');
    if (!btn) return;
    const cat = btn.dataset.delImgCat;
    if (db.imageCategories.length <= 1) {
      toast('至少需要保留一个图片分类');return;
    }
    db.imageCategories = db.imageCategories.filter(c => c !== cat);
    save(); window.renderImgCatsEditor(); toast('分类已删除');
  });

  document.getElementById('newImgCatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val) return;
      if (db.imageCategories.includes(val)) { toast('该分类已存在'); return; }
      if (db.imageCategories.length >= 15) { toast('最多只能设置 15 个图片分类'); return; }
      db.imageCategories.push(val); save(); e.target.value = ''; window.renderImgCatsEditor(); toast('已添加分类');
    }
  });
  
  window.renderImgCatsEditor();
}