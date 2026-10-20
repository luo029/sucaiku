/* js / images.js · 图片压缩 / 上传流程 / 瀑布流浏览（分批加载） */
/* =========================================================
   图片压缩
   ========================================================= */
let webpSupported = false;
try{webpSupported = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;}catch(e){}

async function tinifyCompress(file,apiKey,proxyUrl){
  const auth='Basic '+btoa('api:'+apiKey);
  const target='https://api.tinify.com/shrink';
  const proxy=(proxyUrl||'').trim();
  const url = proxy || target;
  
  const res=await fetch(url,{
    method:'POST',
    headers:{Authorization:auth,'Content-Type':file.type||'application/octet-stream'},
    body:file
  });

  if(!res.ok){
    if(res.status===429)throw new Error('TinyPNG 本月额度已用完');
    if(res.status===401)throw new Error('TinyPNG API Key 无效');
    throw new Error('TinyPNG HTTP '+res.status);
  }

  if(proxy){
    const blob = await res.blob();
    if(!blob.type.startsWith('image/')){
      const text = await blob.text();
      throw new Error('代理返回非图片内容: ' + text.slice(0, 50));
    }
    return {blob, origSize: file.size, newSize: blob.size, via:'tinypng'};
  } 
  
  const location=res.headers.get('Location');
  const body=await res.json().catch(()=>({}));
  const outUrl=location||(body&&body.output&&body.output.url);
  if(!outUrl)throw new Error('TinyPNG 未返回压缩地址');
  const outRes=await fetch(outUrl);
  if(!outRes.ok)throw new Error('下载压缩图失败 HTTP '+outRes.status);
  const blob=await outRes.blob();
  return{blob,origSize:file.size,newSize:blob.size,via:'tinypng'};
}

function canvasCompress(file,maxDim=1920,quality=0.85){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const {width:origW, height:origH} = img;
      const shortSide = Math.min(origW, origH);
      const longSide  = Math.max(origW, origH);
      const aspect    = longSide / shortSide;

      const isLongImage = aspect >= 2;
      let scale = 1;

      if (isLongImage) {
        const SHORT_MIN  = 720;
        const LONG_MAX   = 12000;
        const MAX_PIXELS = 12 * 1000 * 1000;

        if (longSide > LONG_MAX) {
          scale = Math.min(scale, LONG_MAX / longSide);
        }
        if (origW * origH * scale * scale > MAX_PIXELS) {
          scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (origW * origH)));
        }
        if (shortSide >= SHORT_MIN && shortSide * scale < SHORT_MIN) {
          const minScaleForShort = SHORT_MIN / shortSide;
          const maxScaleForLong  = longSide > LONG_MAX ? LONG_MAX / longSide : 1;
          scale = Math.min(minScaleForShort, maxScaleForLong);
        }
      } else {
        if (longSide > maxDim) {
          scale = maxDim / longSide;
        }
      }

      const width  = Math.round(origW * scale);
      const height = Math.round(origH * scale);

      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,width,height);

      const tryBlob=(type,q,fallback)=>{
        canvas.toBlob(blob=>{
          if(blob){
            URL.revokeObjectURL(img.src);
            resolve({blob,origSize:file.size,newSize:blob.size,via:'canvas-'+(type.split('/')[1]||'')});
          }else if(fallback){
            fallback();
          }else{
            URL.revokeObjectURL(img.src);
            reject(new Error('canvas 压缩失败'));
          }
        },type,q);
      };
      if(webpSupported){
        tryBlob('image/webp',quality,()=>tryBlob('image/jpeg',quality));
      }else{
        tryBlob('image/jpeg',quality);
      }
    };
    img.onerror=()=>{URL.revokeObjectURL(img.src);reject(new Error('图片加载失败'));};
    img.src=URL.createObjectURL(file);
  });
}

async function compressImage(file,onProgress){
  const mode = db.settings.compressMode || 'local';
  if (mode === 'none') {
    return { blob: file, origSize: file.size, newSize: file.size, via: 'none' };
  }
  if (mode === 'tinypng') {
    const key = (db.settings.tinypngKey || '').trim();
    const proxy = (db.settings.tinypngProxy || '').trim();
    if (key && proxy) {
      try {
        onProgress && onProgress('TinyPNG 压缩中…');
        const r = await tinifyCompress(file, key, proxy);
        bumpTinyCount();
        return r;
      } catch (err) {
        console.warn('TinyPNG 失败', err);
        toast('TinyPNG 失败：' + err.message + '，改用本地压缩');
      }
    } else {
      toast('TinyPNG 未配置 Key 或代理，改用本地压缩');
    }
  }
  onProgress && onProgress('本地压缩中…');
  try { return await canvasCompress(file); }
  catch (err) {
    console.warn('本地压缩失败', err);
    return { blob: file, origSize: file.size, newSize: file.size, via: 'none' };
  }
}

/* =========================================================
   图片上传流程
   ========================================================= */
let uploadInProgress=false;

function renderImgCatChooser(){
  const list=$('imgCatList');
  const cats=db.imageCategories.length?db.imageCategories:DEFAULT_IMG_CATS;
  list.innerHTML=cats.map(c=>`<div class="img-cat-opt" data-cat="${esc(c)}">${esc(c)}</div>`).join('');
  if(!pendingUploadCat||!cats.includes(pendingUploadCat))pendingUploadCat=cats[0];
  list.querySelectorAll('.img-cat-opt').forEach(el=>{
    el.classList.toggle('active',el.dataset.cat===pendingUploadCat);
  });
}

function openImgCatChooser(files){
  pendingUploadFiles=files.slice();
  pendingUploadCat=db.imageCategories[0]||DEFAULT_IMG_CATS[0];
  $('imgCatCount').textContent=files.length;
  $('imgUploadStatus').textContent='';
  
  if ($('imgUploadTags')) $('imgUploadTags').value = '';

  $('imgProgressWrap').style.display = 'none';
  $('imgProgressBar').style.width = '0%';
  $('imgProgressBar').style.background = 'var(--accent)';
  $('imgProgressText').textContent = '准备中...';
  $('imgProgressPercent').textContent = '0%';

  renderImgCatChooser();
  $('imgCatMask').classList.add('show');
}

function sanitizeFilename(s){
  return String(s||'').replace(/[\\/:*?"<>|#%\s]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'img';
}

async function startUploadPending(){
  if(!pendingUploadFiles.length||uploadInProgress)return;
  const cfg=loadGH();
  if(!ghReady(cfg)){toast('请先在设置中配置 GitHub');return;}
  uploadInProgress=true;
  const cat=pendingUploadCat||'其他';
  
  const tagsRaw = $('imgUploadTags') ? $('imgUploadTags').value.trim() : '';
  const imgTags = tagsRaw ? tagsRaw.split(/[,，\s]+/).filter(Boolean) : [];

  const statusEl=$('imgUploadStatus');
  const rc=ghRepoConfig('img');
  const files=pendingUploadFiles.slice();
  let success=0,fail=0;

  $('imgProgressWrap').style.display = 'block';

  try{
    for(let i=0;i<files.length;i++){
      const file=files[i];
      try{
        const baseProgress = (i / files.length) * 100;
        $('imgProgressBar').style.width = baseProgress + '%';
        $('imgProgressPercent').textContent = Math.floor(baseProgress) + '%';
        $('imgProgressText').textContent = `[${i+1}/${files.length}] 压缩中...`;
        $('imgProgressBar').style.background = 'var(--accent)';

        statusEl.textContent=`[${i+1}/${files.length}] 压缩中…`;
        const comp=await compressImage(file,msg=>{statusEl.textContent=`[${i+1}/${files.length}] ${msg}`;});
        const ratio=comp.origSize>0?(1-comp.newSize/comp.origSize)*100:0;
        
        $('imgProgressBar').style.background = '#3b82f6';
        statusEl.textContent=`[${i+1}/${files.length}] 压缩 ${fmtSize(comp.origSize)} → ${fmtSize(comp.newSize)}（${ratio>0?'-'+ratio.toFixed(0)+'%':'无变化'}），上传中…`;
        $('imgProgressText').textContent = `[${i+1}/${files.length}] 上传中...`;

        const now=new Date();
        const year=now.getFullYear();
        const month=String(now.getMonth()+1).padStart(2,'0');
        const ts=`${year}${month}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        const rand=Math.random().toString(36).slice(2,8);
        const safeCat=sanitizeFilename(cat);
        let ext=(file.name.split('.').pop()||'jpg').toLowerCase();
        if(comp.blob && comp.blob.type){
          if(comp.blob.type==='image/webp') ext='webp';
          else if(comp.blob.type==='image/jpeg') ext='jpg';
          else if(comp.blob.type==='image/png') ext='png';
        }
        const filename=`${safeCat}-${ts}-${rand}.${ext}`;
        const relPath=`${year}/${month}/${filename}`;
        const fullPath=`${rc.path}/${relPath}`;

        const b64=await blobToBase64(comp.blob);
        await ghPutRaw(rc,fullPath,b64,null,`upload ${relPath}`);

        pendingImages.push({path:relPath,url:'',cat,tags:imgTags.slice(),size:comp.newSize,origSize:comp.origSize});
        renderPendingImgs();
        success++;
        statusEl.textContent=`[${i+1}/${files.length}] 完成：${fmtSize(comp.origSize)} → ${fmtSize(comp.newSize)}（${comp.via||''}）`;

        const doneProgress = ((i + 1) / files.length) * 100;
        $('imgProgressBar').style.width = doneProgress + '%';
        $('imgProgressPercent').textContent = Math.floor(doneProgress) + '%';
      }catch(err){
        console.error(err);
        fail++;
        statusEl.textContent=`[${i+1}/${files.length}] 失败：${err.message}`;
        $('imgProgressText').textContent = `[${i+1}/${files.length}] 失败`;
        $('imgProgressBar').style.background = 'var(--danger)';
      }
    }

    $('imgProgressBar').style.background = fail > 0 ? 'var(--danger)' : '#10b981';
    $('imgProgressText').textContent = fail > 0 ? '部分失败' : '全部完成';
    
    if(fail===0){
      const isEditing=!!editingId;
      const hasText = inputEl.value.trim().length > 0;
      if(!isEditing && !hasText){
        let source=sourceEl.value.trim();
        if(!source && currentSource!==ALL_SOURCES) source=currentSource;
        if(!source && db.fixedSource) source=db.fixedSource;
        const tagsRawStr=tagsEl.value.trim();
        const itemTags=tagsRawStr?tagsRawStr.split(/[,，\s]+/).filter(Boolean):[];
        if(!itemTags.length && db.fixedTags.length) itemTags.push(...db.fixedTags);

        db.items.unshift({
          id:uid(), text:'', type:IMG_TYPE, source,
          tags:[...new Set(itemTags)],
          images:pendingImages.slice(),
          createdAt:Date.now()
        });
        if(source && !db.sources.includes(source)) db.sources.push(source);
        pendingImages=[];
        renderPendingImgs();
        tagsEl.value=db.fixedTags.length?db.fixedTags.join(', '):'';
        sourceEl.value=db.fixedSource||'';
        updateSourcePickerUI();updateTagPickerUI();
        currentPage=1;
        save();render();
        statusEl.textContent=`上传成功 ${success} 张，已自动保存到素材库`;
        toast(`已上传 ${success} 张图片并自动保存`);
        setTimeout(()=>{ $('imgCatMask').classList.remove('show'); }, 800);
      }else{
        statusEl.textContent=`上传成功 ${success} 张，点击「保存」加入素材库`;
        toast(`已上传 ${success} 张图片，点保存加入素材库`);
        setTimeout(()=>{ $('imgCatMask').classList.remove('show'); }, 800);
      }
    }else{
      statusEl.textContent=`完成：成功 ${success}，失败 ${fail}`;
      toast(`上传 ${success} 张，失败 ${fail} 张`);
    }
  }finally{
    uploadInProgress=false;
    pendingUploadFiles=[];
  }
}

/* =========================================================
   图片浏览（瀑布流）· 分批加载
   ========================================================= */
const IMG_VIEW_BATCH_SIZE = 60;
let _imgViewFiltered = [];
let _imgViewRendered = 0;
let _imgViewObserver = null;

function collectAllImages(){
  const arr=[];
  db.items.forEach(item=>{
    (item.images||[]).forEach(im=>{
      arr.push({
        im,
        src: imageSrc(im),
        path: im.path||'',
        cat: im.cat||'其他',
        tags: im.tags||[],
        itemId: item.id,
        itemText: item.text||''
      });
    });
  });
  return arr;
}

function _renderMasonryBatch(){
  if (_imgViewRendered >= _imgViewFiltered.length) {
    if (_imgViewObserver) {
      _imgViewObserver.disconnect();
      _imgViewObserver = null;
    }
    const sentinel = document.getElementById('imgMasonrySentinel');
    if (sentinel) sentinel.style.display = 'none';
    return;
  }
  const next = _imgViewFiltered.slice(_imgViewRendered, _imgViewRendered + IMG_VIEW_BATCH_SIZE);
  const html = next.map(x => {
    const cap = (x.itemText || '').slice(0, 40);
    return `<div class="mi">
      <img src="${esc(x.src)}" alt="" loading="lazy" data-open-img="${esc(x.src)}" data-img-path="${esc(x.path)}">
      <span class="mi-cat">${esc(x.cat)}</span>
      ${cap ? `<div class="mi-cap">${esc(cap)}${x.itemText.length > 40 ? '…' : ''}</div>` : ''}
    </div>`;
  }).join('');
  $('imgMasonry').insertAdjacentHTML('beforeend', html);
  _imgViewRendered += next.length;

  const wrap = document.querySelector('.img-masonry-wrap');
  if (wrap && _imgViewRendered < _imgViewFiltered.length && wrap.scrollHeight <= wrap.clientHeight) {
    _renderMasonryBatch();
  }
}

function _setupMasonryObserver(){
  if (_imgViewObserver) _imgViewObserver.disconnect();

  let sentinel = document.getElementById('imgMasonrySentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'imgMasonrySentinel';
    sentinel.style.cssText = 'height:1px;width:100%;';
    document.querySelector('.img-masonry-wrap').appendChild(sentinel);
  }
  sentinel.style.display = 'block';

  const wrap = document.querySelector('.img-masonry-wrap');
  _imgViewObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      _renderMasonryBatch();
    }
  }, { root: wrap, rootMargin: '300px' });

  _imgViewObserver.observe(sentinel);
}

function renderImgView(){
  const all=collectAllImages();
  const counts={};
  all.forEach(x=>counts[x.cat]=(counts[x.cat]||0)+1);
  const catList=['全部',...Object.keys(counts).sort((a,b)=>counts[b]-counts[a])];
  if(!catList.includes(currentImgViewCat))currentImgViewCat='全部';

  $('imgCatTabs').innerHTML=catList.map(c=>{
    const n=c==='全部'?all.length:(counts[c]||0);
    return `<div class="ic-tab ${currentImgViewCat===c?'active':''}" data-ic="${esc(c)}">${esc(c)}<span class="n">${n}</span></div>`;
  }).join('');

  const filtered = currentImgViewCat === '全部' ? all : all.filter(x => x.cat === currentImgViewCat);
  $('imgViewCount').textContent = `${filtered.length} 张`;

  if(!filtered.length){
    $('imgMasonry').innerHTML = `<div class="img-view-empty">还没有图片</div>`;
    const s = document.getElementById('imgMasonrySentinel');
    if (s) s.style.display = 'none';
    if (_imgViewObserver) { _imgViewObserver.disconnect(); _imgViewObserver = null; }
    return;
  }

  _imgViewFiltered = filtered;
  _imgViewRendered = 0;
  $('imgMasonry').innerHTML = '';
  _renderMasonryBatch();
  _setupMasonryObserver();
}

function openImgView(){
  currentImgViewCat='全部';
  renderImgView();
  $('imgView').hidden=false;
  document.body.style.overflow='hidden';
  const wrap = document.querySelector('.img-masonry-wrap');
  if (wrap) wrap.scrollTop = 0;
}

function closeImgView(){
  $('imgView').hidden=true;
  document.body.style.overflow='';
  if (_imgViewObserver) { _imgViewObserver.disconnect(); _imgViewObserver = null; }
}