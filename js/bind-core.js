/* js / bind-core.js · 事件绑定：输入区 / 选择器 / 搜索 / 导航 / 图片兜底 */
/* =========================================================
   事件绑定
   ========================================================= */
addBtn.addEventListener('click',addOrUpdate);
cancelBtn.addEventListener('click',cancelEdit);
inputEl.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addOrUpdate();}
});

inputEl.addEventListener('paste',e=>{
  const items=(e.clipboardData||e.originalEvent.clipboardData).items;
  const files=[];
  for(let i=0;i<items.length;i++){
    const it=items[i];
    if(it.kind==='file'&&it.type.startsWith('image/')){files.push(it.getAsFile());}
  }
  if(files.length){
    e.preventDefault();
    openImgCatChooser(files);
  }
});

$('imgBtn').addEventListener('click',()=>{
  const cfg=loadGH();
  if(!ghReady(cfg)){toast('请先在设置中配置 GitHub');return;}
  $('imgFileInput').click();
});
$('imgFileInput').addEventListener('change',e=>{
  const files=Array.from(e.target.files||[]);
  e.target.value='';
  if(!files.length)return;
  openImgCatChooser(files);
});

$('imgCatList').addEventListener('click',e=>{
  const opt=e.target.closest('.img-cat-opt');if(!opt)return;
  pendingUploadCat=opt.dataset.cat;
  $('imgCatList').querySelectorAll('.img-cat-opt').forEach(el=>{
    el.classList.toggle('active',el.dataset.cat===pendingUploadCat);
  });
});
$('imgCatCancel').addEventListener('click',()=>{
  if(uploadInProgress)return;
  $('imgCatMask').classList.remove('show');
  pendingUploadFiles=[];
});
$('imgCatConfirm').addEventListener('click',()=>startUploadPending());
$('imgCatMask').addEventListener('click',e=>{
  if(e.target===$('imgCatMask')&&!uploadInProgress){
    $('imgCatMask').classList.remove('show');
    pendingUploadFiles=[];
  }
});

pendingImgsEl.addEventListener('click',e=>{
  const btn=e.target.closest('[data-rm-img]');if(!btn)return;
  const idx=parseInt(btn.dataset.rmImg,10);
  if(idx>=0&&idx<pendingImages.length){pendingImages.splice(idx,1);renderPendingImgs();}
});

$('sourceToggle').addEventListener('click',e=>{
  e.stopPropagation();closeTagPanel();
  if(sourcePanel.hidden)openSourcePanel();else closeSourcePanel();
});
spSearch.addEventListener('input',()=>renderSourcePanelList(spSearch.value));
spSearch.addEventListener('keydown',e=>{if(e.key==='Escape')closeSourcePanel();});
spList.addEventListener('click',e=>{
  const pinEl=e.target.closest('.sp-pin');
  if(pinEl){e.stopPropagation();setFixedSource(pinEl.dataset.pin);return;}
  const item=e.target.closest('.sp-item');if(!item)return;
  const s=item.dataset.pick||'';
  sourceEl.value=s;updateSourcePickerUI();closeSourcePanel();sourceEl.focus();
});

$('tagToggle').addEventListener('click',e=>{
  e.stopPropagation();closeSourcePanel();
  if(tagPanel.hidden)openTagPanel();else closeTagPanel();
});
tpSearch.addEventListener('input',()=>renderTagPanelList(tpSearch.value));
tpSearch.addEventListener('keydown',e=>{if(e.key==='Escape')closeTagPanel();});
tpList.addEventListener('click',e=>{
  const pinEl=e.target.closest('.sp-pin');
  if(pinEl){e.stopPropagation();toggleFixedTag(pinEl.dataset.pin);return;}
  const item=e.target.closest('.sp-item');if(!item)return;
  const t=item.dataset.pick||'';
  let cur=tagsEl.value.trim().split(/[,，\s]+/).filter(Boolean);
  if(cur.includes(t))cur=cur.filter(x=>x!==t);else cur.push(t);
  tagsEl.value=cur.join(', ');
  updateTagPickerUI();renderTagPanelList(tpSearch.value);tagsEl.focus();
});

document.addEventListener('click',e=>{
  if(!sourcePanel.hidden&&!sourcePicker.contains(e.target))closeSourcePanel();
  if(!tagPanel.hidden&&!tagPicker.contains(e.target))closeTagPanel();
  if ($('sourceFilterPanel') && !$('sourceFilterPanel').hidden && !$('sourceFilterWrap').contains(e.target)) {
    $('sourceFilterPanel').hidden = true;
  }
  const zenPanel = document.getElementById('zenFilterPanel');
  if (zenPanel && !zenPanel.contains(e.target) && !e.target.closest('.zen-filter-btn')) {
    zenPanel.remove();
  }
});

$('hitokotoRefresh').addEventListener('click',fetchHitokoto);
searchEl.addEventListener('input',()=>{
  keyword=searchEl.value;currentPage=1;
  clearFilterCache();
  renderList();renderHeader();
});

if ($('sourceFilterBtn')) {
  $('sourceFilterBtn').addEventListener('click', e => {
    e.stopPropagation();
    const panel = $('sourceFilterPanel');
    if (panel.hidden) {
      $('sourceFilterSearch').value = '';
      renderSourceFilterList();
      panel.hidden = false;
      setTimeout(() => $('sourceFilterSearch').focus(), 50);
    } else {
      panel.hidden = true;
    }
  });
}
if ($('sourceFilterSearch')) {
  $('sourceFilterSearch').addEventListener('input', renderSourceFilterList);
  $('sourceFilterSearch').addEventListener('keydown', e => { if (e.key === 'Escape') $('sourceFilterPanel').hidden = true; });
}
if ($('sourceFilterList')) {
  $('sourceFilterList').addEventListener('click', e => {
    const item = e.target.closest('.sp-item'); if (!item) return;
    const val = item.dataset.pick;
    currentSource = val === '__all__' ? ALL_SOURCES : val;
    currentPage = 1;
    render();
    $('sourceFilterPanel').hidden = true;
  });
}

$('catNav').addEventListener('click',e=>{
  const btn=e.target.closest('.nav-item[data-type]');if(!btn)return;
  currentType=btn.dataset.type;currentPage=1;
  render();closeSidebarIfMobile();scrollTop();
});
$('tagNav').addEventListener('click',e=>{
  const btn=e.target.closest('.nav-item[data-tag]');if(!btn)return;
  const t=btn.dataset.tag;currentTag=(currentTag===t)?'':t;
  currentPage=1;render();closeSidebarIfMobile();scrollTop();
});
$('sourceNav').addEventListener('click',e=>{
  const delBtn=e.target.closest('[data-del-source]');
  if(delBtn){e.stopPropagation();deleteSource(delBtn.dataset.delSource);return;}
  const btn=e.target.closest('.nav-item[data-source]');if(!btn)return;
  currentSource=btn.dataset.source;currentPage=1;
  render();closeSidebarIfMobile();scrollTop();
});
$('manageCatBtn').addEventListener('click',()=>{
  catManager.hidden=!catManager.hidden;
  if(!catManager.hidden){
    renderCatManager();newCatInput.focus();closeSidebarIfMobile();
    setTimeout(()=>catManager.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }
});
$('closeCatManagerBtn').addEventListener('click',()=>{catManager.hidden=true;});
$('manageTagBtn').addEventListener('click',()=>{
  renderTagManager();$('tagManageMask').classList.add('show');closeSidebarIfMobile();
});
$('tagManageCloseBtn').addEventListener('click',()=>$('tagManageMask').classList.remove('show'));
$('tagManageMask').addEventListener('click',e=>{if(e.target===$('tagManageMask'))$('tagManageMask').classList.remove('show');});
$('tagManageList').addEventListener('change',e=>{
  const inp=e.target.closest('[data-tag-old]');if(!inp)return;
  renameTag(inp.dataset.tagOld,inp.value);
});
$('tagManageList').addEventListener('keydown',e=>{
  if(e.target.matches('[data-tag-old]')&&e.key==='Enter'){e.preventDefault();e.target.blur();}
});
$('tagManageList').addEventListener('click',e=>{
  const pinBtn=e.target.closest('[data-tag-pin]');
  if(pinBtn){toggleFixedTag(pinBtn.dataset.tagPin);renderTagManager();return;}
  const btn=e.target.closest('[data-tag-del]');if(!btn)return;
  delTag(btn.dataset.tagDel);
});

tabsEl.addEventListener('click',e=>{
  const b=e.target.closest('.tab');if(!b)return;
  currentType=b.dataset.type;currentPage=1;render();scrollTop();
});

zenBarEl.addEventListener('click',e=>{
  const t=e.target.closest('.zb');if(!t)return;
  
  if (t.id === 'zenSrcBtn') {
    openZenFilterPanel('source');
    return;
  }
  if (t.id === 'zenTagBtn') {
    openZenFilterPanel('tag');
    return;
  }
  
  if (t.dataset.zt) {
    currentType = t.dataset.zt; currentPage = 1;
    renderList(); renderHeader();
  }
});

function openZenFilterPanel(type) {
  let panel = document.getElementById('zenFilterPanel');
  if (panel) {
    if (panel.dataset.type === type && !panel.hidden) {
      panel.hidden = true;
      return;
    }
    panel.remove();
  }
  
  panel = document.createElement('div');
  panel.id = 'zenFilterPanel';
  panel.className = 'source-panel';
  panel.dataset.type = type;
  panel.style.cssText = 'position:absolute; width:240px; z-index:999; background:var(--card); border:1px solid var(--line); border-radius:12px; box-shadow:var(--sh-3);';
  
  panel.innerHTML = `
    <div class="sp-search-wrap"><input id="zenFilterSearch" placeholder="搜索..." autocomplete="off"></div>
    <div class="sp-list" id="zenFilterList" style="max-height:260px;"></div>
  `;
  
  document.body.appendChild(panel);
  
  const btn = document.getElementById(type === 'source' ? 'zenSrcBtn' : 'zenTagBtn');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    panel.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    let left = rect.left + window.scrollX;
    const maxLeft = window.innerWidth - 240 - 20; 
    if (left > maxLeft) left = maxLeft;
    panel.style.left = left + 'px';
  }
  
  const searchInput = document.getElementById('zenFilterSearch');
  setTimeout(() => searchInput.focus(), 50);
  
  const renderZenList = (q='') => {
    const listEl = document.getElementById('zenFilterList');
    if (!listEl) return;
    const lowerQ = q.toLowerCase();
    let html = '';
    
    if (type === 'source') {
      const counts={};db.items.forEach(i=>{if(i.source)counts[i.source]=(counts[i.source]||0)+1;});
      let list = db.sources;
      if (lowerQ) list = list.filter(s => s.toLowerCase().includes(lowerQ));
      
      html += `<div class="sp-item ${currentSource===ALL_SOURCES?'sp-selected':''}" data-pick="__all__"><span class="sp-name">全部来源</span></div>`;
      list.forEach(s => {
        const n = counts[s] || 0;
        html += `<div class="sp-item ${currentSource===s?'sp-selected':''}" data-pick="${esc(s)}">
          <span class="sp-name">${esc(s)}${n ? `<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>` : ''}</span>
        </div>`;
      });
    } else {
      const counts=collectTags();
      let list=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b,'zh'));
      if (lowerQ) list=list.filter(s=>s.toLowerCase().includes(lowerQ));
      
      html += `<div class="sp-item ${!currentTag?'sp-selected':''}" data-pick=""><span class="sp-name">全部标签</span></div>`;
      list.forEach(s => {
        const n = counts[s] || 0;
        html += `<div class="sp-item ${currentTag===s?'sp-selected':''}" data-pick="${esc(s)}">
          <span class="sp-name">${esc(s)}${n ? `<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>` : ''}</span>
        </div>`;
      });
    }
    listEl.innerHTML = html;
  };
  
  renderZenList();
  
  searchInput.addEventListener('input', e => renderZenList(e.target.value));
  
  panel.addEventListener('click', e => {
    const item = e.target.closest('.sp-item'); if(!item) return;
    e.stopPropagation();
    
    const val = item.dataset.pick;
    if (type === 'source') {
      currentSource = val === '__all__' ? ALL_SOURCES : val;
    } else {
      currentTag = val || '';
    }
    
    currentPage = 1;
    renderList(); renderHeader();
    panel.hidden = true;
  });
}

function handleImgFallback(e) {
  const img = e.target;
  if(!img || img.tagName !== 'IMG') return;
  const path = img.dataset.imgPath;
  if(!path || img.dataset.fallbackDone) return;
  
  img.dataset.fallbackDone = '1';
  fetchImageBlobUrl(path).then(url => {
    img.src = url;
    if (img.dataset.openImg) img.dataset.openImg = url;
  }).catch(err => {
    console.warn('图片加载失败', err);
    img.style.opacity = '.4';
    img.title = '图片加载失败（可能是 raw CDN 延迟或权限问题）';
  });
}

[listEl, document.getElementById('imgMasonry'), pendingImgsEl].forEach(el => {
  if (el) el.addEventListener('error', handleImgFallback, true);
});