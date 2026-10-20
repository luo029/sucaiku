/* js / github.js · GitHub 同步：配置 / 拉取 / 推送 */
function loadGH(){
  let cfg={};
  try{cfg=JSON.parse(localStorage.getItem(GH_KEY))||{};}catch(e){cfg={};}
  return {
    token:cfg.token||'',
    owner:cfg.owner||'',
    repo:cfg.repo||'',
    branch:cfg.branch||'main',
    dataPath:cfg.dataPath||'material-library.json', // ★ 已修改
    siteBase:cfg.siteBase||'',
    autoSync:!!cfg.autoSync,
    autoPull:cfg.autoPull!==false,
    autoPushDelay:Math.max(1,Math.min(60,Number(cfg.autoPushDelay)||2)),
    imgOwner:cfg.imgOwner||'',
    imgRepo:cfg.imgRepo||'',
    imgBranch:cfg.imgBranch||'',
    imgPath:cfg.imgPath||'images',
    imgSite:cfg.imgSite||'',
    imgToken:cfg.imgToken||''
  };
}
function saveGH(cfg){localStorage.setItem(GH_KEY,JSON.stringify(cfg));}
function ghReady(cfg){return !!(cfg.token&&cfg.owner&&cfg.repo);}

function ghRepoConfig(kind){
  const cfg=loadGH();
  if(kind==='img'){
    const useIndependent=!!(cfg.imgOwner&&cfg.imgRepo);
    return {
      token:cfg.imgToken||cfg.token,
      owner:useIndependent?cfg.imgOwner:cfg.owner,
      repo:useIndependent?cfg.imgRepo:cfg.repo,
      branch:cfg.imgBranch||cfg.branch||'main',
      path:cfg.imgPath||'images',
      siteBase:cfg.imgSite||''
    };
  }
  return {
    token:cfg.token,
    owner:cfg.owner,
    repo:cfg.repo,
    branch:cfg.branch||'main',
    path:cfg.dataPath||'material-library.json', // ★ 已修改
    siteBase:cfg.siteBase||''
  };
}

function ghApiUrl(rc,path){
  const p=String(path).split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(rc.owner)}/${encodeURIComponent(rc.repo)}/contents/${p}`;
}

async function ghGetRaw(rc,path){
  if(!rc.owner||!rc.repo)throw new Error('未配置 GitHub');
  const headers = { Accept: 'application/vnd.github+json' };
  if (rc.token) headers.Authorization = `Bearer ${rc.token}`;
  
  const res=await fetch(`${ghApiUrl(rc,path)}?ref=${encodeURIComponent(rc.branch)}&t=${Date.now()}`, { headers });
  if(res.status===404)return null;
  if(!res.ok){const t=await res.text();throw new Error(`HTTP ${res.status} ${t.slice(0,120)}`);}
  return res.json();
}

async function ghPutRaw(rc,path,base64,sha,message){
  if(!rc.token||!rc.owner||!rc.repo)throw new Error('未配置 GitHub 或缺少 Token');
  const body={message:message||`update ${path}`,content:base64,branch:rc.branch};
  if(sha)body.sha=sha;
  const res=await fetch(ghApiUrl(rc,path),{
    method:'PUT',
    headers:{Authorization:`Bearer ${rc.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok){const t=await res.text();throw new Error(`HTTP ${res.status} ${t.slice(0,160)}`);}
  return res.json();
}

/* 图片 URL 工具 */
function buildImageBaseUrl(rc){
  if(rc.siteBase) return rc.siteBase.replace(/\/$/, '');
  return `https://raw.githubusercontent.com/${rc.owner}/${rc.repo}/${rc.branch}`;
}
function imageUrlFromPath(filepath){
  const rc = ghRepoConfig('img');
  const full = `${rc.path}/${filepath}`;
  return encodeURI(`${buildImageBaseUrl(rc)}/${full}`);
}
function imageSrc(im){
  if(!im) return '';
  if(im.path) return imageUrlFromPath(im.path);
  return im.url || '';
}
const imgBlobCache = new Map();
const IMG_BLOB_CACHE_MAX = 300;
async function fetchImageBlobUrl(relPath){
  if(imgBlobCache.has(relPath)) return imgBlobCache.get(relPath);
  const rc = ghRepoConfig('img');
  if(!rc.token || !rc.owner || !rc.repo) throw new Error('未配置');
  const full = `${rc.path}/${relPath}`.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${rc.owner}/${rc.repo}/contents/${full}?ref=${encodeURIComponent(rc.branch)}`;
  const res = await fetch(url, {
    headers: { Authorization:`Bearer ${rc.token}`, Accept:'application/vnd.github.raw' }
  });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  if (imgBlobCache.size >= IMG_BLOB_CACHE_MAX) {
    const firstKey = imgBlobCache.keys().next().value;
    try { URL.revokeObjectURL(imgBlobCache.get(firstKey)); } catch(e) {}
    imgBlobCache.delete(firstKey);
  }
  imgBlobCache.set(relPath, objUrl);
  return objUrl;
}

function ghSetStatus(msg){const el=$('ghStatus');if(el)el.textContent=msg||'';}
function ghImgSetStatus(msg){const el=$('ghImgStatus');if(el)el.textContent=msg||'';}

async function ghPull(silent){
  const cfg=loadGH();
  if(!cfg.owner || !cfg.repo){if(!silent)toast('请先配置 GitHub 仓库');return false;}
  
  try{
    if(!silent)ghSetStatus('拉取中…');
    const rc=ghRepoConfig('data');
    const file=await ghGetRaw(rc,rc.path);
    if(!file){if(!silent)toast('远程数据文件不存在');ghSetStatus('远程数据文件不存在');return false;}
    const txt=base64ToUtf8(file.content.replace(/\n/g,''));
    const data=JSON.parse(txt);
    if(!data||typeof data!=='object')throw new Error('数据格式不正确');
    suppressPush=true;
    db.items=Array.isArray(data.items)?data.items.filter(i=>i&&typeof i.text==='string'&&(i.text||(Array.isArray(i.images)&&i.images.length>0))):[];
    db.cats=Array.isArray(data.cats)?data.cats.filter(c=>typeof c==='string'&&c.trim()&&c!==UNCAT&&c!==IMG_TYPE):DEFAULT_CATS.slice();
    db.colors=(data.colors&&typeof data.colors==='object')?data.colors:{};
    db.sources=Array.isArray(data.sources)?data.sources.filter(s=>typeof s==='string'&&s.trim()):[];
    db.fixedSource=typeof data.fixedSource==='string'?data.fixedSource:'';
    db.fixedTags=Array.isArray(data.fixedTags)?data.fixedTags.filter(s=>typeof s==='string'&&s.trim()):[];
    db.trash=Array.isArray(data.trash)?data.trash.filter(i=>i&&typeof i.text==='string'&&(i.text||(Array.isArray(i.images)&&i.images.length>0))):[];
    if(Array.isArray(data.imageCategories)&&data.imageCategories.length){
      db.imageCategories=data.imageCategories.filter(s=>typeof s==='string'&&s.trim());
    }
    if(data.settings&&typeof data.settings==='object'){
      db.settings={...db.settings,...data.settings,statsDims:{...db.settings.statsDims,...(data.settings.statsDims||{})}};
    }
    db.items.forEach(i=>{i.images=normalizeImages(i.images);});
    saveSettings();
    markNeedNormalize();
    normalize();
    await saveImmediate();
    suppressPush=false;
    render();updateTinyUsageUI();applySettingsToUI();
    if(!silent){toast('已拉取远程数据');ghSetStatus('拉取成功 · '+new Date().toLocaleTimeString());}
    return true;
  }catch(err){
    suppressPush=false;console.error(err);
    if(!silent)toast('拉取失败：'+err.message);
    ghSetStatus('拉取失败：'+err.message);
    return false;
  }
}

async function ghPush(silent, force = false){
  const cfg=loadGH();
  if(!ghReady(cfg)){if(!silent)toast('请先在设置中配置 GitHub Token');return false;}
  try{
    if(!silent)ghSetStatus('推送中…');
    const rc=ghRepoConfig('data');
    const existing=await ghGetRaw(rc,rc.path);
    const sha=existing?existing.sha:null;
    const payload=JSON.stringify(db,null,2);
    const b64=utf8ToBase64(payload);
    await ghPutRaw(rc,rc.path,b64,sha,`sync materials ${new Date().toISOString()}`);
    if(!silent){toast('已推送');ghSetStatus('推送成功 · '+new Date().toLocaleTimeString());}
    return true;
  }catch(err){
    console.error(err);
    
    if(err.message && err.message.includes('409')){
      if(force) {
        if(!silent) ghSetStatus('正在强制覆盖云端...');
        try {
          await new Promise(r => setTimeout(r, 1000));
          const rc=ghRepoConfig('data');
          const existing=await ghGetRaw(rc,rc.path);
          const newSha=existing?existing.sha:null;
          const payload=JSON.stringify(db,null,2);
          const b64=utf8ToBase64(payload);
          await ghPutRaw(rc,rc.path,b64,newSha,`force sync ${new Date().toISOString()}`);
          if(!silent){toast('已强制覆盖云端');ghSetStatus('强制推送成功 · '+new Date().toLocaleTimeString());}
          return true;
        } catch(retryErr) {
          console.error('强制重试失败', retryErr);
          if(!silent)toast('强制推送失败：'+retryErr.message);
          ghSetStatus('强制推送失败');
          return false;
        }
      }
      
      if (silent) {
        ghSetStatus('冲突：云端已更新，后台静默推送已中止');
        return false;
      }
      
      if (confirm('⚠️ 版本冲突：云端数据已被其他设备修改！\n\n是否要以本地数据为准，强制覆盖云端？（这会丢失其他设备在此期间修改的数据）')) {
        return ghPush(false, true);
      } else {
        ghSetStatus('推送已中止');
        return false;
      }
    }
    
    if(!silent)toast('推送失败：'+err.message);
    ghSetStatus('推送失败：'+err.message);
    return false;
  }
}

let pushTimer=null;
function scheduleAutoPush(){
  const cfg=loadGH();
  if(!cfg.autoSync||!ghReady(cfg))return;
  clearTimeout(pushTimer);
  const delay=Math.max(1,Math.min(60,Number(cfg.autoPushDelay)||2))*1000;
  pushTimer=setTimeout(()=>{ghPush(true);},delay);
}

async function ghTest(){
  const cfg=loadGH();
  if(!ghReady(cfg)){toast('请填写 token / owner / repo');return;}
  ghSetStatus('测试中…');
  try{
    const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`,{
      headers:{Authorization:`Bearer ${cfg.token}`,Accept:'application/vnd.github+json'}
    });
    if(!res.ok){const t=await res.text();throw new Error(`HTTP ${res.status} ${t.slice(0,120)}`);}
    const info=await res.json();
    ghSetStatus(`主仓库连接成功 · ${info.full_name}（${info.private?'私有':'公开'}）`);
    const imgRc=ghRepoConfig('img');
    if(imgRc.owner!==cfg.owner||imgRc.repo!==cfg.repo){
      try{
        const r2=await fetch(`https://api.github.com/repos/${encodeURIComponent(imgRc.owner)}/${encodeURIComponent(imgRc.repo)}`,{
          headers:{Authorization:`Bearer ${imgRc.token}`,Accept:'application/vnd.github+json'}
        });
        if(r2.ok){ghImgSetStatus(`图片仓库连接成功 · ${imgRc.owner}/${imgRc.repo}`);}
        else{ghImgSetStatus(`图片仓库 ${imgRc.owner}/${imgRc.repo} 无法访问（HTTP ${r2.status}）`);}
      }catch(e){ghImgSetStatus('图片仓库检查失败：'+e.message);}
    }else{
      ghImgSetStatus('图片使用主仓库');
    }
    toast('连接成功');
  }catch(err){
    console.error(err);
    ghSetStatus('连接失败：'+err.message);
    toast('连接失败');
  }
}

function fillGHForm(){
  const cfg=loadGH();
  $('ghToken').value=cfg.token;
  $('ghOwner').value=cfg.owner;
  $('ghRepo').value=cfg.repo;
  $('ghBranch').value=cfg.branch;
  $('ghDataPath').value=cfg.dataPath;
  $('ghSiteBase').value=cfg.siteBase;
  $('ghAuto').checked=cfg.autoSync;
  $('ghAutoPull').checked=cfg.autoPull;
  $('autoPushDelay').value=cfg.autoPushDelay;
  $('ghImgOwner').value=cfg.imgOwner;
  $('ghImgRepo').value=cfg.imgRepo;
  $('ghImgBranch').value=cfg.imgBranch;
  $('ghImgPath').value=cfg.imgPath;
  $('ghImgSite').value=cfg.imgSite;
  $('ghImgToken').value=cfg.imgToken;
  
  if (typeof window.renderImgCatsEditor === 'function') {
    window.renderImgCatsEditor();
  }
}
function collectGHForm(){
  const cfg={
    token:$('ghToken').value.trim(),
    owner:$('ghOwner').value.trim(),
    repo:$('ghRepo').value.trim(),
    branch:($('ghBranch').value.trim()||'main'),
    dataPath:($('ghDataPath').value.trim()||'material-library.json'), // ★ 已修改
    siteBase:$('ghSiteBase').value.trim(),
    autoSync:$('ghAuto').checked,
    autoPull:$('ghAutoPull').checked,
    autoPushDelay:Math.max(1,Math.min(60,parseInt($('autoPushDelay').value,10)||2)),
    imgOwner:$('ghImgOwner').value.trim(),
    imgRepo:$('ghImgRepo').value.trim(),
    imgBranch:$('ghImgBranch').value.trim(),
    imgPath:($('ghImgPath').value.trim()||'images'),
    imgSite:$('ghImgSite').value.trim(),
    imgToken:$('ghImgToken').value.trim()
  };
  saveGH(cfg);
  return cfg;
}

/* =========================================================
   云端变更巡检
   ========================================================= */
let _lastKnownCloudSha = null;
let _syncTimer = null;

async function checkCloudUpdate() {
  const cfg = loadGH();
  if (!ghReady(cfg) || !cfg.autoPull || !db.settings.autoCheckUpdate) return;

  try {
    const rc = ghRepoConfig('data');
    const res = await fetch(`${ghApiUrl(rc, rc.path)}?ref=${encodeURIComponent(rc.branch)}&t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${rc.token}`, Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    const currentSha = data.sha;

    if (_lastKnownCloudSha && _lastKnownCloudSha !== currentSha) {
      _lastKnownCloudSha = currentSha;
      
      const hasUnsaved = (typeof inputEl !== 'undefined' && inputEl && inputEl.value.trim()) || (typeof editingId !== 'undefined' && editingId);
      if (hasUnsaved) {
        toast('⚠️ 云端已更新，你有未保存内容，请先保存或手动刷新页面');
        return;
      }
      
      if (confirm('⚠️ 检测到另一台设备更新了数据！\n\n点击"确定"立即刷新拉取最新数据。\n点击"取消"继续浏览（注意：如果继续编辑并推送，可能会产生冲突）。')) {
        window.location.reload();
      }
    }
    _lastKnownCloudSha = currentSha;
  } catch(e) {}
}

function restartSyncTimer() {
  if (_syncTimer) clearInterval(_syncTimer);
  if (!db.settings.autoCheckUpdate) return;
  const sec = db.settings.syncCheckInterval || 60;
  _syncTimer = setInterval(checkCloudUpdate, sec * 1000);
}

setTimeout(() => {
  const cfg = loadGH();
  if (ghReady(cfg)) {
    ghGetRaw(ghRepoConfig('data'), ghRepoConfig('data').path).then(f => {
      if(f) _lastKnownCloudSha = f.sha;
    }).catch(()=>{});
  }
  restartSyncTimer();
}, 3000);