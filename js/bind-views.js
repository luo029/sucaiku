/* js / bind-views.js · 事件绑定：视图切换 / 各弹窗 / 设置表单 */
$('batchExportBtn').addEventListener('click',()=>{
  if(!selectedIds.size){toast('请先选择素材');return;}
  openExportModal('__selected__');
});

$('layoutBtn').addEventListener('click',()=>{
  if(layoutMode==='sidebar')setLayout('compact');else setLayout('sidebar');
});
$('sidebarCollapseBtn').addEventListener('click',()=>setLayout('compact'));
$('themeToggleBtn').addEventListener('click',()=>{
  setTheme(themeMode==='light'?'dark':'light');
});
$('zenBtn').addEventListener('click',()=>setZen(true));
$('zenExitBtn').addEventListener('click',()=>setZen(false));
$('imgViewBtn').addEventListener('click',openImgView);
$('imgViewClose').addEventListener('click',closeImgView);

$('imgCatTabs').addEventListener('click',e=>{
  const t=e.target.closest('.ic-tab');if(!t)return;
  currentImgViewCat=t.dataset.ic;
  renderImgView();
});
$('imgMasonry').addEventListener('click',e=>{
  const img=e.target.closest('[data-open-img]');
  if(img)window.open(img.dataset.openImg,'_blank','noopener');
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(zenMode){setZen(false);return;}
    if(!$('imgView').hidden){closeImgView();return;}
    if(!$('imgManagerView').hidden){$('imgManagerView').hidden=true;document.body.style.overflow='';return;}
  }
});

$('menuBtn').addEventListener('click',openSidebar);
$('sidebarOverlay').addEventListener('click',closeSidebar);

$('modalCancel').addEventListener('click',closeModal);
$('modalConfirm').addEventListener('click',()=>{
  if($('noRemind').checked)localStorage.setItem(SKIP_KEY,'1');
  const fn=pendingConfirm;closeModal();if(fn)fn();
});
$('modalMask').addEventListener('click',e=>{if(e.target===$('modalMask'))closeModal();});

function openRandomBox(){
  if(!db.items.length){toast('还没有素材，先添加一些吧');return;}
  const randomIndex=Math.floor(Math.random()*db.items.length);
  const item=db.items[randomIndex];
  const c=catColor(item.type);
  $('randomContent').innerHTML=`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <span class="tag${item.type===IMG_TYPE?' tag-img':''}" style="${item.type===IMG_TYPE?'':`background:${c.bg};color:${c.fg}`}">${esc(item.type)}</span>
      ${item.source?`<span style="font-size:13px;color:var(--text-3);">${esc(item.source)}</span>`:''}
    </div>
    ${item.text?`<div style="color:var(--text);">${formatText(item.text)}</div>`:''}
    ${item.images&&item.images.length?`<div class="card-imgs" style="margin-top:12px;">${item.images.map(im=>{
      const src=imageSrc(im);
      return `<span class="ci"><img src="${esc(src)}" data-open-img="${esc(src)}" data-img-path="${esc(im.path||'')}">${imgCatBadge(im)}</span>`;
    }).join('')}</div>`:''}
  `;
  $('randomMask').classList.add('show');
}
$('menuRandomBtn').addEventListener('click',openRandomBox);
$('randomCloseBtn').addEventListener('click',()=>$('randomMask').classList.remove('show'));
$('randomAgainBtn').addEventListener('click',openRandomBox);
$('randomMask').addEventListener('click',e=>{if(e.target===$('randomMask'))$('randomMask').classList.remove('show');});

$('menuDupBtn').addEventListener('click',checkDuplicates);
$('dupCloseBtn').addEventListener('click',()=>$('dupMask').classList.remove('show'));
$('dupMask').addEventListener('click',e=>{if(e.target===$('dupMask'))$('dupMask').classList.remove('show');});
$('dupList').addEventListener('click',e=>{
  const delBtn=e.target.closest('[data-del-dup]');
  if(delBtn){
    const id=delBtn.dataset.delDup;
    moveToTrash([id]);save();render();toast('已移入回收站');checkDuplicates();
  }
});

$('menuStatsBtn').addEventListener('click',openStats);
$('statsCloseBtn').addEventListener('click',()=>$('statsMask').classList.remove('show'));
$('statsMask').addEventListener('click',e=>{if(e.target===$('statsMask'))$('statsMask').classList.remove('show');});

$('menuHealthBtn').addEventListener('click',openHealth);
$('healthCloseBtn').addEventListener('click',()=>$('healthMask').classList.remove('show'));
$('healthMask').addEventListener('click',e=>{if(e.target===$('healthMask'))$('healthMask').classList.remove('show');});
$('healthList').addEventListener('click',e=>{
  const row=e.target.closest('[data-edit]');if(!row)return;
  const id=row.dataset.edit;
  $('healthMask').classList.remove('show');
  if(db.items.some(i=>i.id===id))startEdit(id);
  else toast('该素材已不存在');
});

$('menuTrashBtn').addEventListener('click',()=>{
  cleanTrash();renderTrash();$('trashMask').classList.add('show');
});
$('trashCloseBtn').addEventListener('click',()=>$('trashMask').classList.remove('show'));
$('trashMask').addEventListener('click',e=>{if(e.target===$('trashMask'))$('trashMask').classList.remove('show');});
$('trashClearBtn').addEventListener('click',()=>{
  if(!db.trash.length){toast('回收站已经是空的');return;}
  if(!confirm(`确定清空回收站吗？${db.trash.length} 条素材将被彻底删除，不可恢复。`))return;
  db.trash=[];save();renderTrash();toast('已清空回收站');
});
$('trashList').addEventListener('click',e=>{
  const r=e.target.closest('[data-restore]');
  if(r){restoreFromTrash(r.dataset.restore);return;}
  const p=e.target.closest('[data-purge]');
  if(p){
    if(!confirm('彻底删除这条素材？不可恢复。'))return;
    purgeTrashItem(p.dataset.purge);toast('已彻底删除');
  }
});

$('menuImgManagerBtn').addEventListener('click', () => {
  $('menu').classList.remove('show');
  openImgManager();
});
$('imgMgrCloseBtn').addEventListener('click', () => {
  $('imgManagerView').hidden = true;
  document.body.style.overflow = '';
});
$('imgMgrRefreshBtn').addEventListener('click', loadRepoImages);
$('imgMgrCleanUnusedBtn').addEventListener('click', cleanAllUnusedImages);

$('imgMgrFilterTabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-filter]');
  if (!b) return;
  $('imgMgrFilterTabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
  imgMgrCurrentFilter = b.dataset.filter;
  renderImgMgrUI();
});

$('imgMgrGrid').addEventListener('click', e => {
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

$('imgMgrGrid').addEventListener('error', async (e) => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  const path = img.dataset.imgPath;
  if (!path || img.dataset.fallbackDone) return;
  img.dataset.fallbackDone = '1';
  try {
    const url = await fetchImageBlobUrl(path);
    img.src = url;
  } catch (err) {
    img.style.opacity = '.4';
    img.title = '图片加载失败';
  }
}, true);

$('menuExportBtn').addEventListener('click',()=>openExportModal());
$('menuImportBtn').addEventListener('click',()=>$('fileInput').click());
$('moreBtn').addEventListener('click',e=>{
  e.stopPropagation();$('menu').classList.toggle('show');
});
document.addEventListener('click',()=>$('menu').classList.remove('show'));
$('menu').addEventListener('click',e=>{
  if(e.target.closest('button'))$('menu').classList.remove('show');
});
$('sidebarExportBtn').addEventListener('click',()=>{
  if(!db.items.length){toast('还没有素材');return;}
  openExportModal();
});
$('exportCancel').addEventListener('click',closeExportModal);
$('exportConfirm').addEventListener('click',doExport);
$('exportMask').addEventListener('click',e=>{if(e.target===$('exportMask'))closeExportModal();});
$('exportFormat').addEventListener('click',e=>{
  const b=e.target.closest('button[data-fmt]');if(!b)return;
  exportFormat=b.dataset.fmt;
  $('exportFormat').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);});
});
$('sidebarImportBtn').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  handleImportFile(f);e.target.value='';
});

/* 设置 */
$('copyWithSource').addEventListener('change',e=>{
  db.settings.copyWithSource=e.target.checked;saveSettings();
  toast(e.target.checked?'已开启复制附带来源':'已关闭');
});
$('trashTtlInput').addEventListener('change',e=>{
  const v=Math.max(1,Math.min(365,parseInt(e.target.value,10)||30));
  e.target.value=v;db.settings.trashTtlDays=v;saveSettings();cleanTrash();renderTrash();
  toast(`回收站保留 ${v} 天`);
});
$('statDimCat').addEventListener('change',e=>{db.settings.statsDims.cat=e.target.checked;saveSettings();});
$('statDimSource').addEventListener('change',e=>{db.settings.statsDims.source=e.target.checked;saveSettings();});
$('statDimTag').addEventListener('change',e=>{db.settings.statsDims.tag=e.target.checked;saveSettings();});
$('statLimitInput').addEventListener('change',e=>{
  const v=Math.max(3,Math.min(30,parseInt(e.target.value,10)||8));
  e.target.value=v;db.settings.statsLimit=v;saveSettings();
});
$('compressMode').addEventListener('click',e=>{
  const b=e.target.closest('button[data-mode]');if(!b)return;
  db.settings.compressMode=b.dataset.mode;
  saveSettings();
  applySettingsToUI();
  toast('压缩方式：'+({none:'不压缩',local:'本地压缩',tinypng:'TinyPNG'}[db.settings.compressMode]));
});
$('tinypngKey').addEventListener('change',e=>{
  db.settings.tinypngKey=e.target.value.trim();
  saveSettings();toast('已保存 TinyPNG Key');
});
$('tinypngProxy').addEventListener('change',e=>{
  db.settings.tinypngProxy=e.target.value.trim();
  saveSettings();toast('已保存 TinyPNG 代理');
});
$('settingCloseBtn').addEventListener('click',()=>$('settingMask').classList.remove('show'));
$('settingMask').addEventListener('click',e=>{if(e.target===$('settingMask'))$('settingMask').classList.remove('show');});

/* GitHub 表单 */
['ghToken','ghOwner','ghRepo','ghBranch','ghDataPath','ghSiteBase','ghImgOwner','ghImgRepo','ghImgBranch','ghImgPath','ghImgSite','ghImgToken'].forEach(id=>{
  $(id).addEventListener('change',()=>collectGHForm());
});
$('ghAuto').addEventListener('change',()=>collectGHForm());
$('ghAutoPull').addEventListener('change',()=>collectGHForm());
$('autoPushDelay').addEventListener('change',()=>{
  const v=Math.max(1,Math.min(60,parseInt($('autoPushDelay').value,10)||2));
  $('autoPushDelay').value=v;
  collectGHForm();
  toast(`自动推送间隔 ${v} 秒`);
});
$('ghTestBtn').addEventListener('click',()=>{collectGHForm();ghTest();});
$('ghPullBtn').addEventListener('click',async()=>{
  collectGHForm();
  if(!confirm('拉取会用远程数据覆盖本地数据，确定继续？'))return;
  await ghPull(false);
});
$('ghPushBtn').addEventListener('click',async()=>{
  collectGHForm();
  await ghPush(false);
});

/* =========================================================
   🌟 图片分类 UI 美化（标签胶囊输入）
   ========================================================= */
// 1. 偷梁换柱，把原来的 input 和按钮替换成新的容器
const oldImgCatsInput = document.getElementById('imgCatsInput');
if (oldImgCatsInput) {
  const parent = oldImgCatsInput.parentElement.parentElement; // .st-card-body
  parent.innerHTML = `
    <div id="imgCatsEditor" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:34px; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:var(--r-sm);"></div>
    <div style="display:flex; gap:10px;">
      <input type="text" id="newImgCatInput" placeholder="输入新分类，按回车添加" autocomplete="off" style="flex:1; border:1px solid var(--line); border-radius:var(--r-sm); padding:9px 12px; font-size:14px; color:var(--text); background:var(--card); outline:none;">
    </div>
  `;

  // 2. 编写渲染函数，挂载到 window 方便其他文件调用
  window.renderImgCatsEditor = function() {
    const editor = document.getElementById('imgCatsEditor');
    if (!editor) return;
    editor.innerHTML = db.imageCategories.map(c => {
      let idx = db.imageCategories.indexOf(c);
      let hash = 0; for (let i = 0; i < c.length; i++) hash = c.charCodeAt(i) + ((hash << 5) - hash);
      idx = Math.abs(hash);
      const palette = PALETTE[idx % PALETTE.length];

      return `
        <div style="display:inline-flex; align-items:center; gap:6px; background:${palette.bg}; color:${palette.fg}; padding:4px 10px 4px 12px; border-radius:99px; font-size:13px; font-weight:600; border:1px solid ${palette.fg};">
          ${esc(c)}
          <button data-del-img-cat="${esc(c)}" style="width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.05); color:${palette.fg}; cursor:pointer; transition:all 0.15s;" title="删除">✕</button>
        </div>
      `;
    }).join('');
  };

  // 3. 绑定事件（删除、添加）
  document.getElementById('imgCatsEditor').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-img-cat]');
    if (!btn) return;
    const cat = btn.dataset.delImgCat;
    if (db.imageCategories.length <= 1) {
      toast('至少需要保留一个图片分类');
      return;
    }
    db.imageCategories = db.imageCategories.filter(c => c !== cat);
    save();
    window.renderImgCatsEditor();
    toast('分类已删除');
  });

  document.getElementById('newImgCatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val) return;
      if (db.imageCategories.includes(val)) {
        toast('该分类已存在');
        return;
      }
      if (db.imageCategories.length >= 15) {
        toast('最多只能设置 15 个图片分类');
        return;
      }
      db.imageCategories.push(val);
      save();
      e.target.value = '';
      window.renderImgCatsEditor();
      toast('已添加分类');
    }
  });
  
  window.renderImgCatsEditor();
}

/* 动态按钮：设置 */
const gearBtn=document.createElement('button');
gearBtn.className='foot-btn';
gearBtn.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> 设置`;
gearBtn.style.borderRight='none';
gearBtn.addEventListener('click',()=>{
  fillGHForm();updateTinyUsageUI();
  $('settingMask').classList.add('show');
});
document.querySelector('.sidebar-footer').appendChild(gearBtn);

const menuSettingBtn=document.createElement('button');
menuSettingBtn.textContent='⚙️ 设置';
menuSettingBtn.id='menuSettingBtn';
$('menu').insertBefore(menuSettingBtn,$('menu').firstChild);
menuSettingBtn.addEventListener('click',()=>{
  fillGHForm();updateTinyUsageUI();
  $('settingMask').classList.add('show');
});