/* js / bind-list.js · 事件绑定：列表 / 分页 / 分类管理 / 批量操作 */
listEl.addEventListener('click',e=>{
  const img=e.target.closest('[data-open-img]');
  if(img){window.open(img.dataset.openImg,'_blank','noopener');return;}
  if(zenMode){
    const card=e.target.closest('.card');
    if(card){
      const item=db.items.find(i=>i.id===card.dataset.id);
      if(item)copyText(item.text,item.source);
    }
    return;
  }
  const tagEl=e.target.closest('.tag-chip');
  if(tagEl&&!selectMode){
    const t=tagEl.dataset.tag;currentTag=(currentTag===t)?'':t;
    currentPage=1;render();scrollTop();return;
  }
  const expandEl=e.target.closest('.expand-btn');
  if(expandEl){
    const id=expandEl.dataset.expand;
    if(expandedIds.has(id))expandedIds.delete(id);else expandedIds.add(id);
    renderList();return;
  }
  const srcEl=e.target.closest('.src-clickable');
  if(srcEl&&!selectMode){
    const s=srcEl.dataset.source;
    if(s&&db.sources.includes(s)){
      currentSource=(currentSource===s)?ALL_SOURCES:s;currentPage=1;render();scrollTop();
    }
    return;
  }
  if(selectMode){
    const card=e.target.closest('.card');if(card)toggleSelect(card.dataset.id);return;
  }
  const btn=e.target.closest('button[data-act]');if(!btn)return;
  const id=btn.dataset.id,act=btn.dataset.act;
  const item=db.items.find(i=>i.id===id);if(!item)return;

  if(act==='copy')copyText(item.text||'',item.source);
  if(act==='edit')startEdit(id);
  if(act==='del'){
    requestDeleteConfirm(1,()=>{
      moveToTrash([id]);
      if(editingId===id)cancelEdit();
      cleanupSources();save();
      const totalPages=Math.max(1,Math.ceil(getFilteredItems().length/pageSize));
      if(currentPage>totalPages)currentPage=totalPages;
      render();toast('已移入回收站');
    });
  }
});

$('pagination').addEventListener('click',e=>{
  const btn=e.target.closest('.page-btn[data-page]');
  if(!btn||btn.disabled)return;
  const p=btn.dataset.page;
  const filtered=getFilteredItems();
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  if(p==='prev')currentPage=Math.max(1,currentPage-1);
  else if(p==='next')currentPage=Math.min(totalPages,currentPage+1);
  else currentPage=parseInt(p,10);
  renderList();scrollTop();
});
$('pagination').addEventListener('change',e=>{
  if(e.target.id==='pageSizeSelect'){
    pageSize=parseInt(e.target.value,10);currentPage=1;renderList();
  }
});

catListEl.addEventListener('change',e=>{
  const inp=e.target.closest('.cat-name');if(!inp)return;
  renameCat(Number(inp.dataset.idx),inp.value);
});
catListEl.addEventListener('keydown',e=>{
  if(e.target.classList.contains('cat-name')&&e.key==='Enter'){e.preventDefault();e.target.blur();}
});
catListEl.addEventListener('click',e=>{
  const btn=e.target.closest('[data-cat-del]');if(!btn)return;
  delCat(Number(btn.dataset.catDel));
});
$('addCatBtn').addEventListener('click',()=>addCat(newCatInput.value));
newCatInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();addCat(newCatInput.value);}
});

$('selectBtn').addEventListener('click',()=>{
  selectMode=!selectMode;if(!selectMode)selectedIds.clear();renderList();
});
$('batchExit').addEventListener('click',()=>{selectMode=false;selectedIds.clear();renderList();});
$('selectAllBtn').addEventListener('click',()=>{
  const pageItems=getPageItems();if(!pageItems.length)return;
  const allSel=pageItems.every(i=>selectedIds.has(i.id));
  if(allSel)pageItems.forEach(i=>selectedIds.delete(i.id));
  else pageItems.forEach(i=>selectedIds.add(i.id));
  renderList();
});
$('batchDel').addEventListener('click',()=>{
  if(!selectedIds.size){toast('请先选择素材');return;}
  requestDeleteConfirm(selectedIds.size,()=>{
    moveToTrash([...selectedIds]);
    selectedIds.clear();selectMode=false;
    cleanupSources();save();
    const totalPages=Math.max(1,Math.ceil(getFilteredItems().length/pageSize));
    if(currentPage>totalPages)currentPage=totalPages;
    render();toast('已移入回收站');
  });
});
$('batchMoveBtn').addEventListener('click',()=>{
  if(!selectedIds.size){toast('请先选择素材');return;}
  $('moveCount').textContent=selectedIds.size;
  let opts=db.cats.slice();
  if(db.items.some(i=>i.type===UNCAT))opts.push(UNCAT);
  if(!opts.length)opts=[UNCAT];
  $('moveCatSelect').innerHTML=opts.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('moveMask').classList.add('show');
});
$('moveCancel').addEventListener('click',()=>$('moveMask').classList.remove('show'));
$('moveMask').addEventListener('click',e=>{if(e.target===$('moveMask'))$('moveMask').classList.remove('show');});
$('moveConfirm').addEventListener('click',()=>{
  const t=$('moveCatSelect').value;let n=0;
  db.items.forEach(i=>{if(selectedIds.has(i.id)&&i.type!==t){i.type=t;i.updatedAt=Date.now();n++;}});
  $('moveMask').classList.remove('show');
  selectedIds.clear();selectMode=false;
  save();render();
  toast(n?`已移动 ${n} 条到「${t}」`:'没有需要移动的素材');
});
$('batchTagBtn').addEventListener('click',()=>{
  if(!selectedIds.size){toast('请先选择素材');return;}
  $('tagAddCount').textContent=selectedIds.size;
  $('tagAddInput').value='';$('tagAddMask').classList.add('show');
  setTimeout(()=>$('tagAddInput').focus(),60);
});
$('tagAddCancel').addEventListener('click',()=>$('tagAddMask').classList.remove('show'));
$('tagAddMask').addEventListener('click',e=>{if(e.target===$('tagAddMask'))$('tagAddMask').classList.remove('show');});
$('tagAddInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('tagAddConfirm').click();}});
$('tagAddConfirm').addEventListener('click',()=>{
  const raw=$('tagAddInput').value.trim();
  const tags=raw?raw.split(/[,，\s]+/).filter(Boolean):[];
  if(!tags.length){toast('请输入标签');return;}
  let n=0;
  db.items.forEach(i=>{
    if(selectedIds.has(i.id)){
      const set=new Set(i.tags||[]);tags.forEach(t=>set.add(t));
      i.tags=[...set];i.updatedAt=Date.now();n++;
    }
  });
  $('tagAddMask').classList.remove('show');
  save();render();toast(`已为 ${n} 条素材添加标签`);
});