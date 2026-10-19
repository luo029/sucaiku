/* js / items.js · 素材增删改：回收站 / 标签管理 / 待上传图 / 拖拽分类 */
/* =========================================================
   回收站
   ========================================================= */
function moveToTrash(ids){
  const set=new Set(ids);const now=Date.now();const moved=[];
  db.items=db.items.filter(i=>{
    if(set.has(i.id)){moved.push({...i,deletedAt:now});return false;}
    return true;
  });
  db.trash.unshift(...moved);return moved.length;
}
function restoreFromTrash(id){
  const idx=db.trash.findIndex(i=>i.id===id);
  if(idx<0)return;
  const item=db.trash.splice(idx,1)[0];
  delete item.deletedAt;
  if(db.items.some(x=>x.id===item.id))item.id=uid();
  db.items.push(item);
  db.items.sort((a,b)=>b.createdAt-a.createdAt);
  save();render();renderTrash();toast('已恢复');
}
function purgeTrashItem(id){db.trash=db.trash.filter(i=>i.id!==id);save();renderTrash();}
function renderTrash(){
  const list=$('trashList');
  const days=Math.max(1,Math.min(365,Number(db.settings.trashTtlDays)||30));
  $('trashDesc').textContent=`删除的素材会保留 ${days} 天，可随时恢复。`;
  if(!db.trash.length){list.innerHTML=`<div class="sp-empty">回收站是空的</div>`;return;}
  list.innerHTML=db.trash.map(i=>{
    const c=catColor(i.type);
    const txt=i.text ? (i.text.length>120?i.text.slice(0,120)+'…':i.text) : `（图片素材 ${i.images ? i.images.length : 0} 张）`;
    return `<div class="trash-item">
      <div class="trash-head">
        <span class="tag${i.type===IMG_TYPE?' tag-img':''}" style="${i.type===IMG_TYPE?'':`background:${c.bg};color:${c.fg}`}">${esc(i.type)}</span>
        ${i.source?`<span class="src" style="max-width:none">${esc(i.source)}</span>`:''}
        <span class="date" style="margin-left:auto">${fmtDate(i.deletedAt)} 删除</span>
      </div>
      <div class="trash-text">${esc(txt)}</div>
      <div class="trash-ops">
        <button class="btn tiny" data-restore="${i.id}">恢复</button>
        <button class="btn tiny danger" data-purge="${i.id}">彻底删除</button>
      </div>
    </div>`;
  }).join('');
}

/* =========================================================
   标签管理
   ========================================================= */
function renderTagManager(){
  const counts=collectTags();
  const tags=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b,'zh'));
  const list=$('tagManageList');
  if(!tags.length){list.innerHTML=`<div class="sp-empty">还没有标签</div>`;return;}
  list.innerHTML=tags.map(t=>{
    const isFixed=db.fixedTags.includes(t);const pinFill=isFixed?'currentColor':'none';
    return `<div class="cat-row" style="gap:10px">
      <span class="dot" style="background:var(--accent)"></span>
      <input class="cat-name" data-tag-old="${esc(t)}" value="${esc(t)}" maxlength="20">
      <span class="cat-n">${counts[t]}</span>
      <button class="btn tiny" data-tag-pin="${esc(t)}" title="${isFixed?'取消固定':'固定为默认标签'}" style="padding:4px 8px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>
      </button>
      <button class="btn tiny danger" data-tag-del="${esc(t)}">删除</button>
    </div>`;
  }).join('');
}
function renameTag(oldName,newName){
  newName=newName.trim();
  if(!newName||newName===oldName){renderTagManager();return;}
  const existed=db.items.some(i=>(i.tags||[]).includes(newName));
  db.items.forEach(i=>{
    if(!Array.isArray(i.tags))i.tags=[];
    if(i.tags.includes(oldName)){
      i.tags=[...new Set(i.tags.map(t=>t===oldName?newName:t))];
      i.updatedAt=Date.now();
    }
  });
  const fi=db.fixedTags.indexOf(oldName);
  if(fi>=0)db.fixedTags[fi]=newName;
  db.fixedTags=[...new Set(db.fixedTags)];
  if(currentTag===oldName)currentTag=newName;
  save();render();renderTagManager();
  toast(existed?`已合并到「${newName}」`:'已重命名标签');
}
function delTag(name){
  const n=db.items.filter(i=>(i.tags||[]).includes(name)).length;
  if(!confirm(`确定要删除标签「${name}」吗？\n${n} 条素材会移除该标签。`))return;
  db.items.forEach(i=>{
    if(Array.isArray(i.tags)&&i.tags.includes(name)){
      i.tags=i.tags.filter(t=>t!==name);i.updatedAt=Date.now();
    }
  });
  db.fixedTags=db.fixedTags.filter(t=>t!==name);
  if(currentTag===name)currentTag='';
  save();render();renderTagManager();toast('已删除标签');
}

/* =========================================================
   待上传图片
   ========================================================= */
function renderPendingImgs(){
  if(!pendingImages.length){pendingImgsEl.innerHTML='';return;}
  pendingImgsEl.innerHTML=pendingImages.map((im,idx)=>{
    const src=imageSrc(im);
    return `<div class="pi"><img src="${esc(src)}" alt="" data-img-path="${esc(im.path||'')}"><button data-rm-img="${idx}" title="移除">✕</button><span class="pi-cat">${esc(im.cat||'')}</span></div>`;
  }).join('');
}
function setPendingImages(list){pendingImages=(list||[]).map(x=>typeof x==='string'?{url:x,path:'',cat:'其他',size:0,origSize:0}:x);renderPendingImgs();}

/* =========================================================
   增删改
   ========================================================= */
function addOrUpdate(){
  const text=inputEl.value.trim();
  const hasImgs=pendingImages.length>0;
  if(!text&&!hasImgs){toast('内容不能为空');inputEl.focus();return;}

  const type=typeEl.value||UNCAT;
  let source=sourceEl.value.trim();
  const tagsRaw=tagsEl.value.trim();
  const tags=tagsRaw?tagsRaw.split(/[,，\s]+/).filter(Boolean):[];

  if(!source&&currentSource!==ALL_SOURCES)source=currentSource;
  if(!source&&db.fixedSource)source=db.fixedSource;
  if(!tags.length&&db.fixedTags.length)tags.push(...db.fixedTags);

  if(editingId){
    const item=db.items.find(i=>i.id===editingId);
    if(item){
      item.text=text;item.type=type;item.source=source;
      item.tags=[...new Set(tags)];
      item.images=pendingImages.slice();
      item.updatedAt=Date.now();
    }
    cancelEdit();toast('已更新');
  }else{
    db.items.unshift({id:uid(),text,type,source,tags:[...new Set(tags)],images:pendingImages.slice(),createdAt:Date.now()});
    inputEl.value='';
    tagsEl.value=db.fixedTags.length?db.fixedTags.join(', '):'';
    sourceEl.value=db.fixedSource||'';
    setPendingImages([]);
    updateSourcePickerUI();updateTagPickerUI();
    toast('已加入素材库');currentPage=1;
  }

  if(source&&!db.sources.includes(source))db.sources.push(source);
  if(currentSource!==ALL_SOURCES&&source!==currentSource)currentSource=ALL_SOURCES;

  save();render();inputEl.focus();
}

function startEdit(id){
  const item=db.items.find(i=>i.id===id);
  if(!item)return;
  editingId=id;
  inputEl.value=item.text;
  refreshTypeSelect(item.type);
  sourceEl.value=item.source||'';
  tagsEl.value=item.tags?item.tags.join(', '):'';
  setPendingImages(item.images||[]);
  updateSourcePickerUI();updateTagPickerUI();
  addBtn.textContent='更新';cancelBtn.style.display='';
  inputEl.focus();scrollTop();
}
function cancelEdit(){
  editingId=null;
  addBtn.textContent='保存';cancelBtn.style.display='none';
  inputEl.value='';
  tagsEl.value=db.fixedTags.length?db.fixedTags.join(', '):'';
  sourceEl.value=db.fixedSource||'';
  setPendingImages([]);
  updateSourcePickerUI();updateTagPickerUI();
  refreshTypeSelect(db.cats[0]||'');
}

function addCat(name){
  name=name.trim();
  if(!name){newCatInput.focus();return;}
  if(name===UNCAT||name===IMG_TYPE){toast(`「${name}」是系统保留名`);return;}
  if(db.cats.includes(name)){toast('分类已存在');return;}
  db.cats.push(name);ensureColors();save();render();newCatInput.value='';
  toast(`已添加分类「${name}」`);
}
function renameCat(idx,newName){
  const oldName=db.cats[idx];
  if(oldName===undefined)return;
  newName=newName.trim();
  if(!newName){toast('名称不能为空');renderCatManager();return;}
  if(newName===oldName)return;
  if(newName===UNCAT||newName===IMG_TYPE){toast(`「${newName}」是系统保留名`);renderCatManager();return;}
  if(db.cats.some((c,i)=>i!==idx&&c===newName)){toast('已存在同名分类');renderCatManager();return;}
  db.cats[idx]=newName;
  db.items.forEach(i=>{if(i.type===oldName)i.type=newName;});
  if(db.colors[oldName]!==undefined){db.colors[newName]=db.colors[oldName];delete db.colors[oldName];}
  if(currentType===oldName)currentType=newName;
  save();render();toast('已重命名');
}
function delCat(idx){
  const name=db.cats[idx];if(name===undefined)return;
  const n=db.items.filter(i=>i.type===name).length;
  const msg=n?`删除分类「${name}」？其中 ${n} 条素材会移到「${UNCAT}」。`:`删除分类「${name}」？`;
  if(!confirm(msg))return;
  db.cats.splice(idx,1);
  db.items.forEach(i=>{if(i.type===name)i.type=UNCAT;});
  delete db.colors[name];
  if(currentType===name)currentType='全部';
  ensureColors();save();render();toast('已删除分类');
}

/* =========================================================
   拖拽移动分类
   ========================================================= */
function bindDragEvents(){
  const cards=listEl.querySelectorAll('.card');
  cards.forEach(card=>{
    card.addEventListener('dragstart',e=>{
      if(selectMode||zenMode){e.preventDefault();return;}
      draggedItemId=card.dataset.id;
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',draggedItemId);
      setTimeout(()=>card.style.opacity='0.4',0);
    });
    card.addEventListener('dragend',()=>{card.style.opacity='1';draggedItemId=null;});
  });
}
function setupDropZones(){
  $('catNav').addEventListener('dragover',e=>{
    const target=e.target.closest('.nav-item[data-type]');
    if(target){e.preventDefault();target.classList.add('drag-over');}
  });
  $('catNav').addEventListener('dragleave',e=>{
    const target=e.target.closest('.nav-item[data-type]');
    if(target)target.classList.remove('drag-over');
  });
  $('catNav').addEventListener('drop',e=>{
    const target=e.target.closest('.nav-item[data-type]');
    if(target&&draggedItemId){e.preventDefault();target.classList.remove('drag-over');moveItemCategory(draggedItemId,target.dataset.type);}
  });
  tabsEl.addEventListener('dragover',e=>{
    const target=e.target.closest('.tab[data-type]');
    if(target){e.preventDefault();target.classList.add('drag-over');}
  });
  tabsEl.addEventListener('dragleave',e=>{
    const target=e.target.closest('.tab[data-type]');
    if(target)target.classList.remove('drag-over');
  });
  tabsEl.addEventListener('drop',e=>{
    const target=e.target.closest('.tab[data-type]');
    if(target&&draggedItemId){e.preventDefault();target.classList.remove('drag-over');moveItemCategory(draggedItemId,target.dataset.type);}
  });
}
function moveItemCategory(itemId,newType){
  const item=db.items.find(i=>i.id===itemId);
  if(item&&item.type!==newType){
    item.type=newType;item.updatedAt=Date.now();save();render();toast(`已移动至「${newType}」`);
  }
}
