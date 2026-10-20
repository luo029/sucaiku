/* js / store.js · 本地存储：IndexedDB 主存储 / localStorage 自动迁移 / 数据规范化 / 筛选 */

/* =========================================================
   IndexedDB 辅助
   ========================================================= */
const IDB_NAME = 'material-library-db';
const IDB_STORE = 'kv';
const IDB_KEY = 'main';
let _idb = null;

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = e => reject(e.target.error);
  });
}

async function idbGet(key) {
  const d = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const d = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================================================
   容量警告
   ========================================================= */
let _warningShown = false;
function showStorageWarning(size) {
  if (_warningShown) return;
  _warningShown = true;
  let bar = document.getElementById('storageWarningBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'storageWarningBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:10px 16px;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span>⚠️ 数据已达 ${(size/1024/1024).toFixed(2)} MB，请定期导出备份或开启云端推送</span><button style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;" onclick="document.getElementById('storageWarningBar').remove()">知道了</button>`;
}

/* =========================================================
   存储主逻辑
   ========================================================= */
let suppressPush = false;
let _filterCacheKey = '';
let _filterCacheResult = [];

function clearFilterCache() {
  _filterCacheKey = '';
}

let _idbSaveTimer = null;

function save(){
  clearFilterCache();
  db._rev = (db._rev || 0) + 1;
  _scheduleSaveIDB();
  // ★ 修复：加 typeof 保护，避免 github.js 尚未加载时 ReferenceError
  if(!suppressPush && typeof scheduleAutoPush === 'function') scheduleAutoPush();
}

function _scheduleSaveIDB(){
  clearTimeout(_idbSaveTimer);
  _idbSaveTimer = setTimeout(async () => {
    try {
      await idbPut(IDB_KEY, db);
      const size = JSON.stringify(db).length;
      if (size > 4 * 1024 * 1024) showStorageWarning(size);
    } catch(e) {
      console.error('IndexedDB 保存失败', e);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(db));
        toast('已降级保存到 localStorage');
      } catch(e2) {
        toast('保存失败！请立即导出备份');
      }
    }
  }, 300);
}

async function saveImmediate(){
  clearTimeout(_idbSaveTimer);
  db._rev = (db._rev || 0) + 1;
  clearFilterCache();
  try {
    await idbPut(IDB_KEY, db);
    const size = JSON.stringify(db).length;
    if (size > 4 * 1024 * 1024) showStorageWarning(size);
  } catch(e) {
    console.error('IndexedDB 立即保存失败', e);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch(e2) {
      toast('保存失败！请立即导出备份');
    }
  }
}

async function loadStore(){
  let data = null;

  // 1. 优先从 IndexedDB 读
  try {
    const idbData = await idbGet(IDB_KEY);
    if (idbData && typeof idbData === 'object') data = idbData;
  } catch(e) {
    console.warn('IndexedDB 读取失败', e);
  }

  // 2. 首次启动：从 localStorage 读取并迁移
  if (!data) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          data = parsed;
          try {
            await idbPut(IDB_KEY, parsed);
            localStorage.removeItem(STORE_KEY);
            console.log('✅ 已将 localStorage 数据迁移到 IndexedDB');
          } catch(e2) {
            console.warn('迁移到 IndexedDB 失败', e2);
          }
        }
      }
    } catch(e) {}
  }

  // 3. 应用数据
  if (data && typeof data === 'object') {
    applyLoadedData(data);
  }

  // 4. 数据规范化
  db.items.forEach(i => {
    if (i.source && !db.sources.includes(i.source)) db.sources.push(i.source);
    if (!i.tags) i.tags = [];
    i.images = normalizeImages(i.images);
  });
}

function applyLoadedData(o) {
  if (Array.isArray(o.items)) db.items = o.items.filter(i => i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)));
  if (Array.isArray(o.cats)) db.cats = o.cats.filter(c => typeof c === 'string' && c.trim() && c !== UNCAT && c !== IMG_TYPE);
  if (o.colors && typeof o.colors === 'object') db.colors = o.colors;
  if (Array.isArray(o.sources)) db.sources = o.sources.filter(s => typeof s === 'string' && s.trim());
  if (typeof o.fixedSource === 'string') db.fixedSource = o.fixedSource;
  if (Array.isArray(o.fixedTags)) db.fixedTags = o.fixedTags.filter(s => typeof s === 'string' && s.trim());
  if (Array.isArray(o.trash)) db.trash = o.trash.filter(i => i && typeof i.text === 'string' && (i.text || (Array.isArray(i.images) && i.images.length > 0)));
  if (Array.isArray(o.imageCategories) && o.imageCategories.length) {
    db.imageCategories = o.imageCategories.filter(s => typeof s === 'string' && s.trim());
  }
  // ★ 修复：恢复时合并 settings，确保云端或本地的主题、配置不会丢
  if (o.settings && typeof o.settings === 'object') {
    db.settings = { ...db.settings, ...o.settings, statsDims: { ...db.settings.statsDims, ...(o.settings.statsDims || {}) } };
  }
  db._rev = Number(o._rev) || 0;
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
  const cacheKey = `${currentType}|${currentSource}|${currentTag}|${keyword}|${db._rev || 0}`;
  if (_filterCacheKey === cacheKey && _filterCacheResult) {
    return _filterCacheResult;
  }
  
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
  }).sort((a,b)=>b.createdAt-a.createdAt);

  _filterCacheKey = cacheKey;
  _filterCacheResult = arr;
  return arr;
}