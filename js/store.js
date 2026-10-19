/* js / store.js · 本地存储：读写 / 数据规范化 / 筛选 */
/* =========================================================
   存储
   ========================================================= */
let suppressPush=false;
function save(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(db));}catch(e){toast('保存失败');}
  if(!suppressPush)scheduleAutoPush();
}
function loadStore(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return;
    const o=JSON.parse(raw);
    if(!o||typeof o!=='object')return;
    if(Array.isArray(o.items))db.items=o.items.filter(i=>i&&typeof i.text==='string'&&(i.text||(Array.isArray(i.images)&&i.images.length>0)));
    if(Array.isArray(o.cats))db.cats=o.cats.filter(c=>typeof c==='string'&&c.trim()&&c!==UNCAT&&c!==IMG_TYPE);
    if(o.colors&&typeof o.colors==='object')db.colors=o.colors;
    if(Array.isArray(o.sources))db.sources=o.sources.filter(s=>typeof s==='string'&&s.trim());
    if(typeof o.fixedSource==='string')db.fixedSource=o.fixedSource;
    if(Array.isArray(o.fixedTags))db.fixedTags=o.fixedTags.filter(s=>typeof s==='string'&&s.trim());
    if(Array.isArray(o.trash))db.trash=o.trash.filter(i=>i&&typeof i.text==='string'&&(i.text||(Array.isArray(i.images)&&i.images.length>0)));
    if(Array.isArray(o.imageCategories)&&o.imageCategories.length){
      db.imageCategories=o.imageCategories.filter(s=>typeof s==='string'&&s.trim());
    }
  }catch(e){}
  db.items.forEach(i=>{
    if(i.source&&!db.sources.includes(i.source))db.sources.push(i.source);
    if(!i.tags)i.tags=[];
    i.images=normalizeImages(i.images);
  });
}
function normalizeImages(arr){
  if(!Array.isArray(arr))return [];
  return arr.map(img=>{
    if(typeof img==='string')return {url:img,path:'',cat:'其他',size:0,origSize:0};
    if(img && (img.path || img.url)) return {
      path: img.path || '',
      url: img.url || '',
      cat: img.cat || '其他',
      size: Number(img.size) || 0,
      origSize: Number(img.origSize) || 0
    };
    return null;
  }).filter(Boolean);
}
function cleanTrash(){
  const now=Date.now();const ttl=trashTtlMs();const before=db.trash.length;
  db.trash=db.trash.filter(i=>(i.deletedAt||now)>now-ttl);
  if(db.trash.length!==before)save();
}
function ensureColors(){
  if(!db.colors||typeof db.colors!=='object')db.colors={};
  let dirty=false;const catSet=new Set(db.cats);
  Object.keys(db.colors).forEach(k=>{
    if(!catSet.has(k)||typeof db.colors[k]!=='number'){delete db.colors[k];dirty=true;}
  });
  const used=new Set(Object.values(db.colors));
  db.cats.forEach(c=>{
    if(!(c in db.colors)){
      let i=0;while(used.has(i))i++;
      db.colors[c]=i;used.add(i);dirty=true;
    }
  });
  return dirty;
}
function normalize(){
  const catSet=new Set(db.cats);let dirty=false;
  db.items.forEach(i=>{
    if(i.type !== IMG_TYPE && !i.text && Array.isArray(i.images) && i.images.length > 0){
      i.type = IMG_TYPE; dirty = true;
    }
    if(i.type !== UNCAT && i.type !== IMG_TYPE && !catSet.has(i.type)){catSet.add(i.type);dirty=true;}
    if(i.source&&!db.sources.includes(i.source)){db.sources.push(i.source);dirty=true;}
    if(!Array.isArray(i.tags)){i.tags=[];dirty=true;}
    else{const t=[...new Set(i.tags.map(x=>String(x).trim()).filter(Boolean))];if(t.length!==i.tags.length){i.tags=t;dirty=true;}}
    const ni=normalizeImages(i.images);
    if(JSON.stringify(ni)!==JSON.stringify(i.images||[])){i.images=ni;dirty=true;}
  });
  if(dirty)db.cats=[...catSet];
  if(db.fixedSource&&!db.sources.includes(db.fixedSource)){db.fixedSource='';dirty=true;}
  if(ensureColors())dirty=true;
  if(dirty)save();
}
function cleanupSources(){
  const activeSources=new Set(db.items.map(i=>i.source).filter(Boolean));
  let changed=false;
  db.sources=db.sources.filter(s=>{
    if(!activeSources.has(s)){if(db.fixedSource===s)db.fixedSource='';changed=true;return false;}
    return true;
  });
  if(currentSource!==ALL_SOURCES&&!db.sources.includes(currentSource)){currentSource=ALL_SOURCES;changed=true;}
  if(changed)save();
}
function catColor(name){
  if(name===UNCAT)return{bg:'#f1f5f9',fg:'#64748b'};
  if(name===IMG_TYPE)return{bg:'#f5f3ff',fg:'#a855f7'};
  const idx=db.colors[name];
  if(typeof idx!=='number')return PALETTE[0];
  if(idx<PALETTE.length)return PALETTE[idx];
  const hue=Math.round((idx*137.508)%360);
  return{bg:`hsl(${hue}, 70%, 95%)`,fg:`hsl(${hue}, 60%, 40%)`};
}
function collectTags(){
  const counts={};
  db.items.forEach(i=>(i.tags||[]).forEach(t=>{counts[t]=(counts[t]||0)+1;}));
  return counts;
}
function getFilteredItems(){
  const terms=getSearchTerms();
  const arr=db.items.filter(i=>{
    if(currentType!=='全部'&&i.type!==currentType)return false;
    if(currentSource!==ALL_SOURCES&&i.source!==currentSource)return false;
    if(currentTag&&!(i.tags||[]).includes(currentTag))return false;
    if(terms.length){
      const hay=((i.text||'')+' '+(i.source||'')+' '+i.type+' '+(i.tags||[]).join(' ')+' '+(i.images||[]).map(im=>im.cat||'').join(' ')).toLowerCase();
      if(!terms.every(t=>hay.includes(t)))return false;
    }
    return true;
  });
  return arr.sort((a,b)=>b.createdAt-a.createdAt);
}
