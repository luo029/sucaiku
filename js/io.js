/* js / io.js · 极简模式 / 专注模式 / 导入导出 / 侧边栏开关 */
/* =========================================================
   极简模式
   ========================================================= */
function setZen(on){
  zenMode=on;
  document.body.classList.toggle('zen-mode',on);
  localStorage.setItem(ZEN_KEY,on?'1':'0');
  if(on){closeSidebar();selectMode=false;selectedIds.clear();closeImgView();setFocus(false);}
  renderList();
  if(on)scrollTop();
}

/* =========================================================
   专注模式
   ========================================================= */
function setFocus(on) {
  focusMode = on;
  document.body.classList.toggle('focus-mode', on);
  if (on) {
    setZen(false);
    closeSidebar();
    inputEl.focus();
  }
  renderList();
}

/* =========================================================
   导入 / 导出
   ========================================================= */
function openExportModal(preset){
  const filtered=getFilteredItems();
  const counts={};db.items.forEach(i=>counts[i.type]=(counts[i.type]||0)+1);
  const opts=[`<option value="__all__">全部素材（${db.items.length} 条）</option>`];
  if(filtered.length!==db.items.length)opts.push(`<option value="__filtered__">当前筛选结果（${filtered.length} 条）</option>`);
  if(selectedIds.size)opts.push(`<option value="__selected__">已选中（${selectedIds.size} 条）</option>`);
  db.cats.forEach(c=>opts.push(`<option value="${esc(c)}">${esc(c)}（${counts[c]||0} 条）</option>`));
  if((counts[IMG_TYPE]||0)>0)opts.push(`<option value="${esc(IMG_TYPE)}">${IMG_TYPE}（${counts[IMG_TYPE]} 条）</option>`);
  if((counts[UNCAT]||0)>0)opts.push(`<option value="${esc(UNCAT)}">${UNCAT}（${counts[UNCAT]} 条）</option>`);
  $('exportScope').innerHTML=opts.join('');
  if(preset&&[...$('exportScope').options].some(o=>o.value===preset))$('exportScope').value=preset;
  exportFormat='json';
  $('exportFormat').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fmt==='json');});
  $('exportMask').classList.add('show');
}
function closeExportModal(){$('exportMask').classList.remove('show');}

function doExport(){
  const scope=$('exportScope').value;
  const isAll=scope==='__all__';
  let items;
  if(isAll)items=db.items.slice();
  else if(scope==='__filtered__')items=getFilteredItems().slice();
  else if(scope==='__selected__')items=db.items.filter(i=>selectedIds.has(i.id));
  else items=db.items.filter(i=>i.type===scope);
  if(!items.length){toast('该范围没有素材');return;}

  const dateStr=fmtDateOnly(Date.now());
  const scopeName=isAll?'全库':scope==='__filtered__'?'筛选结果':scope==='__selected__'?'已选中':scope;

  if(exportFormat==='json'){
    const payload=isAll?db:{items,cats:db.cats.slice(),colors:{...db.colors},sources:db.sources.slice(),imageCategories:db.imageCategories.slice()};
    const fname=isAll?`素材库备份-${dateStr}.json`:`素材库-${scopeName}-${dateStr}.json`;
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),fname);
    toast('已导出备份');
  }else if(exportFormat==='md'){
    let out=`# 素材库 ${dateStr}\n\n`;
    if(!isAll)out=`# ${scopeName} · 素材 ${dateStr}（${items.length} 条）\n\n`;
    const groups={};items.forEach(i=>(groups[i.type]=groups[i.type]||[]).push(i));
    Object.keys(groups).forEach(t=>{
      const g=groups[t];out+=`## ${t}（${g.length}）\n\n`;
      g.forEach(i=>{
        if(i.text) out+=i.text.split('\n').map(line=>`> ${line}`).join('\n')+'\n\n';
        if(i.images&&i.images.length)out+=i.images.map(im=>`![${im.cat||''}](${imageSrc(im)})`).join('\n')+'\n\n';
        if(i.source)out+=`—— ${i.source}\n\n`;
        if(i.tags&&i.tags.length)out+=`标签：${i.tags.map(t=>'#'+t).join(' ')}\n\n`;
      });
    });
    const fname=isAll?`素材库-${dateStr}.md`:`素材库-${scopeName}-${dateStr}.md`;
    download(new Blob([out],{type:'text/markdown;charset=utf-8'}),fname);
    toast('已导出 Markdown');
  }else{
    let out='';
    if(isAll){
      out=`素材库 ${dateStr}\n\n`;
      [...db.cats,IMG_TYPE,UNCAT].forEach(t=>{
        const g=items.filter(i=>i.type===t);if(!g.length)return;
        out+=`========== ${t}（${g.length}） ==========\n\n`;
        g.forEach(i=>{if(i.text)out+=i.text+'\n';if(i.source)out+=`——${i.source}\n`;out+='\n';});
      });
    }else{
      out=`${scopeName} · 素材 ${dateStr}（${items.length} 条）\n\n`;
      items.forEach(i=>{if(i.text)out+=i.text+'\n';if(i.source)out+=`——${i.source}\n`;out+='\n';});
    }
    const fname=isAll?`素材库-${dateStr}.txt`:`素材库-${scopeName}-${dateStr}.txt`;
    download(new Blob([out],{type:'text/plain;charset=utf-8'}),fname);
    toast('已导出 TXT');
  }
  closeExportModal();
}

function handleImportFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      let incomingItems=[],incomingCats=[],incomingColors={},incomingSources=[],incomingTrash=[],incomingFixedTags=[],incomingImgCats=[];
      if(Array.isArray(data))incomingItems=data;
      else if(data&&Array.isArray(data.items)){
        incomingItems=data.items;
        incomingCats=Array.isArray(data.cats)?data.cats:[];
        incomingColors=(data.colors&&typeof data.colors==='object')?data.colors:{};
        incomingSources=Array.isArray(data.sources)?data.sources:[];
        incomingTrash=Array.isArray(data.trash)?data.trash:[];
        incomingFixedTags=Array.isArray(data.fixedTags)?data.fixedTags:[];
        incomingImgCats=Array.isArray(data.imageCategories)?data.imageCategories:[];
      }else throw new Error('bad');

      let added=0;
      incomingItems.forEach(i=>{
        if(!i||typeof i.text!=='string')return;
        if(!i.text&&(!Array.isArray(i.images)||i.images.length===0))return;
        if(i.id&&db.items.some(x=>x.id===i.id))return;
        db.items.push({
          id:i.id||uid(),text:i.text,type:i.type||UNCAT,source:i.source||'',
          tags:Array.isArray(i.tags)?[...new Set(i.tags)]:[],
          images:normalizeImages(i.images),
          createdAt:i.createdAt||Date.now(),updatedAt:i.updatedAt||undefined
        });
        if(i.source&&!db.sources.includes(i.source))db.sources.push(i.source);
        added++;
      });
      incomingTrash.forEach(i=>{
        if(!i||typeof i.text!=='string')return;
        if(!i.text&&(!Array.isArray(i.images)||i.images.length===0))return;
        if(i.id&&db.trash.some(x=>x.id===i.id))return;
        db.trash.push({
          id:i.id||uid(),text:i.text,type:i.type||UNCAT,source:i.source||'',
          tags:Array.isArray(i.tags)?[...new Set(i.tags)]:[],
          images:normalizeImages(i.images),
          createdAt:i.createdAt||Date.now(),updatedAt:i.updatedAt||undefined,
          deletedAt:i.deletedAt||Date.now()
        });
      });
      incomingCats.forEach(c=>{if(typeof c==='string'&&c.trim()&&c!==UNCAT&&c!==IMG_TYPE&&!db.cats.includes(c))db.cats.push(c);});
      incomingSources.forEach(s=>{if(typeof s==='string'&&s.trim()&&!db.sources.includes(s))db.sources.push(s);});
      incomingFixedTags.forEach(s=>{if(typeof s==='string'&&s.trim()&&!db.fixedTags.includes(s))db.fixedTags.push(s);});
      incomingImgCats.forEach(s=>{if(typeof s==='string'&&s.trim()&&!db.imageCategories.includes(s))db.imageCategories.push(s);});

      const used=new Set(Object.values(db.colors));
      Object.keys(incomingColors).forEach(c=>{
        if(db.cats.includes(c)&&!(c in db.colors)){
          const idx=incomingColors[c];
          if(typeof idx==='number'&&!used.has(idx)){db.colors[c]=idx;used.add(idx);}
        }
      });
      normalize();
      db.items.sort((a,b)=>b.createdAt-a.createdAt);
      save();render();toast(`导入 ${added} 条`);
    }catch(err){
      alert('导入失败：请选择本工具导出的 JSON 备份文件');
    }
  };
  reader.readAsText(file);
}

/* =========================================================
   侧边栏
   ========================================================= */
function openSidebar(){$('sidebar').classList.add('open');$('sidebarOverlay').classList.add('show');document.body.style.overflow='hidden';}
function closeSidebar(){$('sidebar').classList.remove('open');$('sidebarOverlay').classList.remove('show');document.body.style.overflow='';}
function closeSidebarIfMobile(){if(window.innerWidth<=960)closeSidebar();}