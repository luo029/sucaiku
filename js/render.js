/* js / render.js · 渲染管线：侧栏 / 标签 / 页签 / 列表 / 分页 / 选择器面板 */
let tagExpanded = false;
let catExpanded = false;
let srcExpanded = false;

function render(){
  normalize();
  if(currentSource!==ALL_SOURCES&&!db.sources.includes(currentSource))currentSource=ALL_SOURCES;
  const allTypes=new Set(['全部',IMG_TYPE,...db.cats]);
  if(db.items.some(i=>i.type===UNCAT))allTypes.add(UNCAT);
  if(!allTypes.has(currentType))currentType='全部';

  renderSidebar();renderTags();renderSourceFilter();renderHeader();renderList();
  renderCatFilter(); // 渲染新的分类下拉
  refreshTypeSelect();updateSourcePickerUI();updateTagPickerUI();
  if(!catManager.hidden)renderCatManager();
}

function renderSidebar(){
  const catCounts={};
  db.items.forEach(i=>catCounts[i.type]=(catCounts[i.type]||0)+1);
  const sourceCounts={};
  db.items.forEach(i=>{if(i.source)sourceCounts[i.source]=(sourceCounts[i.source]||0)+1;});

  const catLimit = db.settings.catLimit || 3;
  const srcLimit = db.settings.srcLimit || 3;

  const catHasMore = db.cats.length > catLimit;
  let displayCats = (!catExpanded && catHasMore) ? db.cats.slice(0, catLimit) : db.cats;
  if (!catExpanded && catHasMore && currentType && !displayCats.includes(currentType) && db.cats.includes(currentType)) {
    displayCats[displayCats.length - 1] = currentType;
  }

  let html=`
    <button class="nav-item nav-all ${currentType==='全部'?'active':''}" data-type="全部" draggable="false">
      <span class="nav-dot"></span><span class="nav-name">全部素材</span><span class="nav-count">${formatCount(db.items.length)}</span>
    </button>`;

  if((catCounts[IMG_TYPE]||0) > 0){
    html += `<button class="nav-item nav-img ${currentType===IMG_TYPE?'active':''}" data-type="${IMG_TYPE}" draggable="false">
      <span class="nav-dot"></span><span class="nav-name">图片</span><span class="nav-count">${formatCount(catCounts[IMG_TYPE])}</span>
    </button>`;
  }

  displayCats.forEach(c=>{
    const col=catColor(c);
    html+=`<button class="nav-item ${currentType===c?'active':''}" data-type="${esc(c)}" draggable="false">
      <span class="nav-dot" style="background:${col.fg}"></span><span class="nav-name">${esc(c)}</span><span class="nav-count">${formatCount(catCounts[c]||0)}</span>
    </button>`;
  });
  if((catCounts[UNCAT]||0)>0){
    html+=`<button class="nav-item ${currentType===UNCAT?'active':''}" data-type="${UNCAT}" draggable="false">
      <span class="nav-dot" style="background:#94a3b8"></span><span class="nav-name">${UNCAT}</span><span class="nav-count">${formatCount(catCounts[UNCAT])}</span>
    </button>`;
  }

  if (catHasMore) {
    html += `<button class="nav-item nav-manage" id="toggleCatsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">
      ${catExpanded ? '收起分类' : `展开更多分类 (${db.cats.length - catLimit})`}
    </button>`;
  }
  $('catNav').innerHTML=html;
  if (catHasMore) {
    document.getElementById('toggleCatsBtn').addEventListener('click', () => {
      catExpanded = !catExpanded;
      renderSidebar();
    });
  }

  const bookIcon=`<svg class="nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
  const pinIcon=`<svg class="nav-fixed-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>`;
  const delIcon=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

  const srcHasMore = db.sources.length > srcLimit;
  let displaySrcs = (!srcExpanded && srcHasMore) ? db.sources.slice(0, srcLimit) : db.sources;
  if (!srcExpanded && srcHasMore && currentSource && currentSource !== ALL_SOURCES && !displaySrcs.includes(currentSource)) {
    displaySrcs[displaySrcs.length - 1] = currentSource;
  }

  let srcHtml=`
    <button class="nav-item ${currentSource===ALL_SOURCES?'active':''}" data-source="${ALL_SOURCES}" draggable="false">
      ${bookIcon}<span class="nav-name">全部来源</span><span class="nav-count">${formatCount(db.sources.length)}</span>
    </button>`;
  
  if(!db.sources.length){
    srcHtml+=`<div class="nav-empty">还没有保存来源</div>`;
  } else {
    displaySrcs.forEach(s=>{
      const isFixed=db.fixedSource===s;
      srcHtml+=`<button class="nav-item ${currentSource===s?'active':''}" data-source="${esc(s)}" draggable="false">
        ${bookIcon}<span class="nav-name" title="${esc(s)}">${esc(s)}</span>
        ${isFixed?pinIcon:''}
        <span class="nav-count" style="${isFixed?'margin-right:2px':''}">${formatCount(sourceCounts[s]||0)}</span>
        <span class="nav-del-btn" data-del-source="${esc(s)}" title="删除来源">${delIcon}</span>
      </button>`;
    });
  }

  if (srcHasMore) {
    srcHtml += `<button class="nav-item nav-manage" id="toggleSrcsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">
      ${srcExpanded ? '收起来源' : `展开更多来源 (${db.sources.length - srcLimit})`}
    </button>`;
  }
  $('sourceNav').innerHTML=srcHtml;
  if (srcHasMore) {
    document.getElementById('toggleSrcsBtn').addEventListener('click', () => {
      srcExpanded = !srcExpanded;
      renderSidebar();
    });
  }
}

function renderTags(){
  const counts=collectTags();
  const allTags=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b,'zh'));
  if(currentTag&&!allTags.includes(currentTag))currentTag='';
  const nav=$('tagNav');
  if(!allTags.length){nav.innerHTML=`<div class="nav-empty">还没有标签</div>`;return;}

  const tagLimit = db.settings.tagLimit || 3;
  const hasMore = allTags.length > tagLimit;
  let displayTags = (!tagExpanded && hasMore) ? allTags.slice(0, tagLimit) : allTags;
  
  if (!tagExpanded && currentTag && !displayTags.includes(currentTag)) {
      displayTags[displayTags.length - 1] = currentTag;
  }

  const tagIcon=`<svg class="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`;
  const pinIcon=`<svg class="nav-fixed-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>`;
  
  let html = displayTags.map(t=>{
    const isFixed=db.fixedTags.includes(t);
    return `<button class="nav-item ${currentTag===t?'active':''}" data-tag="${esc(t)}" draggable="false">
      ${tagIcon}<span class="nav-name" title="${esc(t)}">${esc(t)}</span>
      ${isFixed?pinIcon:''}<span class="nav-count">${formatCount(counts[t])}</span>
    </button>`;
  }).join('');

  if (hasMore) {
    html += `<button class="nav-item nav-manage" id="toggleTagsBtn" style="margin-top:4px; padding:6px 12px; font-size:12px; justify-content:center;">
      ${tagExpanded ? '收起标签' : `展开更多标签 (${allTags.length - tagLimit})`}
    </button>`;
  }
  nav.innerHTML = html;

  if (hasMore) {
    document.getElementById('toggleTagsBtn').addEventListener('click', () => {
      tagExpanded = !tagExpanded;
      renderTags();
    });
  }
}

// ★ 新增：全部分类下拉的渲染
function renderCatFilter(){
  if ($('catFilterText')) {
    $('catFilterText').textContent = currentType === '全部' ? '全部分类' : currentType;
  }
  if ($('catFilterBtn')) {
    $('catFilterBtn').classList.toggle('active-filter', currentType !== '全部');
  }
  if ($('catFilterPanel') && !$('catFilterPanel').hidden) {
    renderCatFilterList();
  }
}

function renderCatFilterList() {
  if (!document.getElementById('catFilterList')) return;
  const q = ($('catFilterSearch') ? $('catFilterSearch').value : '').trim().toLowerCase();
  
  const catCounts={};
  db.items.forEach(i=>catCounts[i.type]=(catCounts[i.type]||0)+1);
  
  const allCats = ['全部', IMG_TYPE, ...db.cats];
  if((catCounts[UNCAT]||0)>0) allCats.push(UNCAT);

  let list = allCats.filter(c => (catCounts[c]||0) > 0 || c === '全部' || c === IMG_TYPE);
  if (q) list = list.filter(s => s.toLowerCase().includes(q));

  let html = `<div class="sp-item ${currentType === '全部' ? 'sp-selected' : ''}" data-pick="__all__">
    <span class="sp-name">全部分类</span>
  </div>`;
  
  list.forEach(c => {
    if (c === '全部') return;
    const n = catCounts[c] || 0;
    html += `<div class="sp-item ${currentType === c ? 'sp-selected' : ''}" data-pick="${esc(c)}">
      <span class="sp-name">${esc(c)}${n ? `<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>` : ''}</span>
    </div>`;
  });
  $('catFilterList').innerHTML = html;
}

function renderSourceFilter(){
  if ($('sourceFilterText')) {
    $('sourceFilterText').textContent = currentSource === ALL_SOURCES ? '全部来源' : currentSource;
  }
  if ($('sourceFilterBtn')) {
    $('sourceFilterBtn').classList.toggle('active-filter', currentSource !== ALL_SOURCES);
  }
  if ($('sourceFilterPanel') && !$('sourceFilterPanel').hidden) {
    renderSourceFilterList();
  }
}

function renderSourceFilterList() {
  if (!document.getElementById('sourceFilterList')) return;
  const q = ($('sourceFilterSearch') ? $('sourceFilterSearch').value : '').trim().toLowerCase();
  const counts={};db.items.forEach(i=>{if(i.source)counts[i.source]=(counts[i.source]||0)+1;});
  let list = db.sources.slice();
  if (q) list = list.filter(s => s.toLowerCase().includes(q));

  let html = `<div class="sp-item ${currentSource === ALL_SOURCES ? 'sp-selected' : ''}" data-pick="__all__"><span class="sp-name">全部来源</span></div>`;
  if (!list.length && q) {
    html += `<div class="sp-empty">没有匹配的来源</div>`;
  } else {
    list.forEach(s => {
      const n = counts[s] || 0;
      const fixedMark = db.fixedSource === s ? ' 📌' : '';
      html += `<div class="sp-item ${currentSource === s ? 'sp-selected' : ''}" data-pick="${esc(s)}">
        <span class="sp-name">${esc(s)}${n ? `<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>` : ''}${fixedMark}</span>
      </div>`;
    });
  }
  $('sourceFilterList').innerHTML = html;
}

function renderHeader(){
  const filtered=getFilteredItems();
  let title=currentType==='全部'?'全部素材':currentType;
  if(currentSource!==ALL_SOURCES)title=currentSource+' · '+title;
  if(currentTag)title='#'+currentTag+' · '+title;
  $('pageTitle').textContent=title;

  const parts=[];
  if(currentSource!==ALL_SOURCES)parts.push(`来自《${currentSource}》`);
  if(currentTag)parts.push(`标签 #${currentTag}`);
  if(currentType!=='全部')parts.push(currentType);
  $('pageSub').textContent=parts.length?parts.join(' · '):'选择分类、来源或标签进行筛选';
}

function imgCatBadge(img){return img&&img.cat?`<span class="ci-cat">${esc(img.cat)}</span>`:'';}

function renderZenBar(){
  const typeTxt = currentType === '全部' ? '全部分类' : currentType;
  const srcTxt = currentSource === ALL_SOURCES ? '全部来源' : currentSource;
  const tagTxt = currentTag ? '#'+currentTag : '全部标签';

  let html = `
    <div class="zb zen-filter-btn ${currentType!=='全部'?'active':''}" id="zenTypeBtn">
      ${esc(typeTxt)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>
    </div>
    <div class="zb zen-filter-btn ${currentSource!==ALL_SOURCES?'active':''}" id="zenSrcBtn">
      ${esc(srcTxt)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>
    </div>
    <div class="zb zen-filter-btn ${currentTag?'active':''}" id="zenTagBtn">
      ${esc(tagTxt)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>
    </div>
  `;

  zenBarEl.innerHTML = html;
}

function renderSettingsOverview(){
  if(!$('ovTotal')) return;
  let imgCount = 0;
  db.items.forEach(i => imgCount += (i.images ? i.images.length : 0));
  const chars = db.items.reduce((s,i)=>s+i.text.length,0);
  const tags = Object.keys(collectTags()).length;
  $('ovTotal').textContent = db.items.length;
  $('ovChars').textContent = chars > 9999 ? (chars/1000).toFixed(1)+'k' : chars;
  $('ovImgs').textContent = imgCount;
  $('ovTags').textContent = tags;
}

function renderStyleOptions() {
  const container = document.getElementById('uiStyleMode');
  if (!container) return;
  container.innerHTML = AVAILABLE_STYLES.map(style => {
    const active = db.settings.uiStyle === style.id ? 'active' : '';
    return `<button type="button" data-style="${style.id}" class="${active}">${style.name}</button>`;
  }).join('');
}

function renderList(){
  if(zenMode){
    renderZenBar();
    const filtered=getFilteredItems().filter(i=>i.text);
    if(!filtered.length){
      listEl.innerHTML=`<div class="empty"><p>没有找到符合条件的内容</p></div>`;
    }else{
      listEl.innerHTML=filtered.map(i=>`<article class="card" data-id="${i.id}"><div class="content">${formatText(i.text)}</div></article>`).join('');
    }
    $('pagination').innerHTML='';
    batchBar.classList.remove('show');
    return;
  }

  const filtered=getFilteredItems();
  const total=filtered.length;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  if(currentPage>totalPages)currentPage=totalPages;
  if(currentPage<1)currentPage=1;
  const start=(currentPage-1)*pageSize;
  const pageItems=filtered.slice(start,start+pageSize);
  const terms=getSearchTerms();
  const collapseLimit = db.settings.collapseLimit || 150;

  if(!pageItems.length){
    if(!db.items.length){
      listEl.innerHTML=`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg><p>还没有素材，把喜欢的句子粘到上面吧</p></div>`;
    }else{
      listEl.innerHTML=`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><p>没有找到匹配的素材</p></div>`;
    }
    $('pagination').innerHTML='';updateBatchBar([]);return;
  }

  listEl.innerHTML=pageItems.map(i=>{
    const c=catColor(i.type);const sel=selectedIds.has(i.id);
    const isImgItem = (i.type === IMG_TYPE);
    const isLongText=i.text && (i.text.length>collapseLimit||i.text.split('\n').length>5);
    const isExpanded=expandedIds.has(i.id);
    const contentClass=isLongText?(isExpanded?'':'collapsed'):'';
    const expandBtn=isLongText?`<div class="expand-btn" data-expand="${i.id}">${isExpanded?'收起':'展开全文'}</div>`:'';
    const tagsHtml=(i.tags&&i.tags.length)?i.tags.map(t=>`<span class="tag-chip" data-tag="${esc(t)}">#${esc(t)}</span>`).join(''):'';
    
    const imgsHtml=(i.images&&i.images.length)?`<div class="card-imgs">${i.images.map(im=>{
      const src=imageSrc(im);
      return `<span class="ci"><img src="${esc(src)}" alt="" loading="lazy" data-open-img="${esc(src)}" data-img-path="${esc(im.path||'')}">${imgCatBadge(im)}</span>`;
    }).join('')}</div>`:'';
    const dateTitle=`创建：${fmtFull(i.createdAt)}`+(i.updatedAt?`\n更新：${fmtFull(i.updatedAt)}`:'');
    const contentHtml = i.text ? `<div class="content ${contentClass}">${formatText(i.text,terms)}</div>${expandBtn}` : '';

    return `<article class="card${isImgItem?' card-img':''}${selectMode?' selectable':''}${sel?' selected':''}" data-id="${i.id}" style="--cat-fg:${c.fg}" draggable="${!selectMode}">
      ${selectMode?`<div class="card-check"><span class="check-circle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></div>`:''}
      <div class="card-main">
        <div class="card-top">
          <span class="tag${isImgItem?' tag-img':''}" style="${isImgItem?'':`background:${c.bg};color:${c.fg}`}">${esc(i.type)}</span>
          ${i.source?`<span class="src src-clickable" data-source="${esc(i.source)}" title="点击筛选自《${esc(i.source)}》">${esc(i.source)}</span>`:''}
          ${tagsHtml}
          <span class="date" title="${esc(dateTitle)}">${fmtDate(i.createdAt)}</span>
        </div>
        ${contentHtml}
        ${imgsHtml}
        ${selectMode?'':`<div class="ops">
          <button data-act="copy" data-id="${i.id}">复制</button>
          <button data-act="edit" data-id="${i.id}">编辑</button>
          <button data-act="del" data-id="${i.id}" class="danger">删除</button>
        </div>`}
      </div>
    </article>`;
  }).join('');

  renderPagination(total,totalPages,start,pageItems.length);
  updateBatchBar(pageItems);
  bindDragEvents();
}

function renderPagination(total,totalPages,start,pageCount){
  if(totalPages<=1){$('pagination').innerHTML='';return;}
  const end=start+pageCount;let pages=[];
  if(totalPages<=7){for(let i=1;i<=totalPages;i++)pages.push(i);}
  else{
    if(currentPage<=4)pages=[1,2,3,4,5,'...',totalPages];
    else if(currentPage>=totalPages-3)pages=[1,'...',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    else pages=[1,'...',currentPage-1,currentPage,currentPage+1,'...',totalPages];
  }
  let nav=`<button class="page-btn" data-page="prev" ${currentPage===1?'disabled':''}>‹</button>`;
  pages.forEach(p=>{
    if(p==='...')nav+=`<span class="page-btn dots">…</span>`;
    else nav+=`<button class="page-btn ${p===currentPage?'active':''}" data-page="${p}">${p}</button>`;
  });
  nav+=`<button class="page-btn" data-page="next" ${currentPage===totalPages?'disabled':''}>›</button>`;
  $('pagination').innerHTML=`
    <div class="page-info">第 <b>${start+1}</b>-<b>${end}</b> 条，共 <b>${total}</b> 条</div>
    <div class="page-nav">${nav}</div>
    <select class="page-size" id="pageSizeSelect">
      <option value="12" ${pageSize===12?'selected':''}>12 条/页</option>
      <option value="24" ${pageSize===24?'selected':''}>24 条/页</option>
      <option value="48" ${pageSize===48?'selected':''}>48 条/页</option>
      <option value="100" ${pageSize===100?'selected':''}>100 条/页</option>
    </select>`;
}

function updateSourcePickerUI(){
  const v=sourceEl.value.trim();
  sourcePicker.classList.toggle('has-fixed',!!db.fixedSource&&v===db.fixedSource);
}
function updateTagPickerUI(){
  const v=tagsEl.value.trim();
  const first=v.split(/[,，\s]+/).filter(Boolean)[0]||'';
  tagPicker.classList.toggle('has-fixed',db.fixedTags.includes(first));
}
function openSourcePanel(){spSearch.value='';renderSourcePanelList('');sourcePanel.hidden=false;setTimeout(()=>spSearch.focus(),30);}
function closeSourcePanel(){sourcePanel.hidden=true;}
function openTagPanel(){tpSearch.value='';renderTagPanelList('');tagPanel.hidden=false;setTimeout(()=>tpSearch.focus(),30);}
function closeTagPanel(){tagPanel.hidden=true;}

function renderSourcePanelList(query){
  const q=query.trim().toLowerCase();
  const counts={};db.items.forEach(i=>{if(i.source)counts[i.source]=(counts[i.source]||0)+1;});
  let list=db.sources.slice();
  if(q)list=list.filter(s=>s.toLowerCase().includes(q));
  if(!db.sources.length){spList.innerHTML=`<div class="sp-empty">还没有保存过来源，直接在输入框里输入新来源即可</div>`;return;}
  if(!list.length){spList.innerHTML=`<div class="sp-empty">没有匹配的来源</div>`;return;}
  const currentVal=sourceEl.value.trim();
  let html=`<button class="sp-item sp-none ${!currentVal?'sp-selected':''}" data-pick=""><span class="sp-name">— 不设置来源 —</span></button>`;
  list.forEach(s=>{
    const isFixed=db.fixedSource===s;const isSelected=currentVal===s;const n=counts[s]||0;
    const pinFill=isFixed?'currentColor':'none';
    html+=`<div class="sp-item ${isSelected?'sp-selected':''}" data-pick="${esc(s)}">
      <span class="sp-name">${esc(s)}${n?`<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>`:''}</span>
      <span class="sp-pin ${isFixed?'active':''}" data-pin="${esc(s)}" title="${isFixed?'取消固定':'固定为默认来源'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>
      </span>
    </div>`;
  });
  spList.innerHTML=html;
}

function renderTagPanelList(query){
  const q=query.trim().toLowerCase();const counts=collectTags();
  let list=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b,'zh'));
  if(q)list=list.filter(s=>s.toLowerCase().includes(q));
  if(!Object.keys(counts).length){tpList.innerHTML=`<div class="sp-empty">还没有标签，直接在输入框里输入新标签即可</div>`;return;}
  if(!list.length){tpList.innerHTML=`<div class="sp-empty">没有匹配的标签</div>`;return;}
  const currentVal=tagsEl.value.trim();
  const currentTags=currentVal?currentVal.split(/[,，\s]+/).filter(Boolean):[];
  let html='';
  list.forEach(s=>{
    const isFixed=db.fixedTags.includes(s);const isSelected=currentTags.includes(s);const n=counts[s]||0;
    const pinFill=isFixed?'currentColor':'none';
    html+=`<div class="sp-item ${isSelected?'sp-selected':''}" data-pick="${esc(s)}">
      <span class="sp-name">${esc(s)}${n?`<span style="color:var(--text-3);font-size:12px;font-weight:400;margin-left:6px">${formatCount(n)}</span>`:''}</span>
      <span class="sp-pin ${isFixed?'active':''}" data-pin="${esc(s)}" title="${isFixed?'取消固定':'固定为默认标签'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>
      </span>
    </div>`;
  });
  tpList.innerHTML=html;
}

function setFixedSource(source){
  if(db.fixedSource===source){db.fixedSource='';toast('已取消固定来源');}
  else{db.fixedSource=source;toast(`已固定来源「${source}」`);}
  save();renderSourcePanelList(spSearch.value);renderSidebar();renderSourceFilter();updateSourcePickerUI();
}
function toggleFixedTag(tag){
  const i=db.fixedTags.indexOf(tag);
  if(i>=0){db.fixedTags.splice(i,1);toast('已取消固定标签');}
  else{db.fixedTags.push(tag);toast(`已固定标签「${tag}」`);}
  save();renderTagPanelList(tpSearch.value);renderTags();updateTagPickerUI();
}
function deleteSource(sourceName){
  if(!confirm(`确定要删除来源「${sourceName}」吗？\n该来源下的所有素材将变为无来源，此操作不可撤销。`))return;
  db.sources=db.sources.filter(s=>s!==sourceName);
  if(db.fixedSource===sourceName)db.fixedSource='';
  db.items.forEach(i=>{if(i.source===sourceName)i.source='';});
  if(currentSource===sourceName)currentSource=ALL_SOURCES;
  save();render();toast('已删除来源');
}

function renderCatManager(){
  if(!db.cats.length){catListEl.innerHTML=`<div class="cat-empty">还没有分类，在下面输入框添加吧</div>`;return;}
  catListEl.innerHTML=db.cats.map((c,idx)=>{
    const col=catColor(c);const n=db.items.filter(i=>i.type===c).length;
    return `<div class="cat-row">
      <span class="dot" style="background:${col.fg}"></span>
      <input class="cat-name" data-idx="${idx}" value="${esc(c)}" maxlength="12">
      <span class="cat-n">${formatCount(n)}</span>
      <button class="btn tiny danger" data-cat-del="${idx}">删除</button>
    </div>`;
  }).join('');
}

function refreshTypeSelect(keep){
  const cur=keep!==undefined?keep:typeEl.value;
  let opts=db.cats.slice();
  if(cur===IMG_TYPE) opts.unshift(IMG_TYPE);
  if(!opts.length)opts=[UNCAT];
  if(cur===UNCAT&&!opts.includes(UNCAT))opts.push(UNCAT);
  else if(cur&&!opts.includes(cur))opts.unshift(cur);
  typeEl.innerHTML=opts.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cur&&opts.includes(cur))typeEl.value=cur;
}

function getPageItems(){
  const filtered=getFilteredItems();
  const start=(currentPage-1)*pageSize;
  return filtered.slice(start,start+pageSize);
}
function updateBatchBar(pageItems){
  batchBar.classList.toggle('show',selectMode);
  $('selectBtn').classList.toggle('active',selectMode);
  if(!selectMode)return;
  $('batchNum').textContent=selectedIds.size;
  if(!pageItems.length){$('selectAllBtn').textContent='全选本页';return;}
  const allSel=pageItems.every(i=>selectedIds.has(i.id));
  $('selectAllBtn').textContent=allSel?'取消全选本页':'全选本页';
}
function toggleSelect(id){
  if(selectedIds.has(id))selectedIds.delete(id);
  else selectedIds.add(id);
  const card=listEl.querySelector(`.card[data-id="${id}"]`);
  if(card)card.classList.toggle('selected',selectedIds.has(id));
  updateBatchBar(getPageItems());
}

function requestDeleteConfirm(count,onConfirm){
  if(localStorage.getItem(SKIP_KEY)==='1'){onConfirm();return;}
  pendingConfirm=onConfirm;
  $('modalDesc').textContent=count===1?'确定要删除这条素材吗？删除后可在回收站恢复。':`确定要删除选中的 ${count} 条素材吗？删除后可在回收站恢复。`;
  $('noRemind').checked=false;$('modalMask').classList.add('show');
}
function closeModal(){$('modalMask').classList.remove('show');pendingConfirm=null;}