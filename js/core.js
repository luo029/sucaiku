/* js / core.js · 常量 / 状态 / DOM 缓存 / 工具函数 / 一言 / 布局·主题·设置 */
const UNCAT='未分类';
const IMG_TYPE='图片';
const ALL_SOURCES='__all__';
const DEFAULT_CATS=['句子','段落','梗','情话','吐槽','点子'];
const DEFAULT_IMG_CATS=['梗图','情节','插画','其他'];
const STORE_KEY='material-library';
const SKIP_KEY='material-library.skip-confirm';
const LAYOUT_KEY='material-library.layout';
const THEME_KEY='material-library.theme';
const SETTINGS_KEY='material-library.settings';
const ZEN_KEY='material-library.zen';
const GH_KEY='material-library.github';
const TINY_KEY='material-library.tinypng';

const AVAILABLE_STYLES = [
  { id: 'modern', name: '现代' },
  { id: 'retro', name: '复古墨水' },
  { id: 'bento', name: '便当盒' }
];

const DEFAULT_SETTINGS={
  copyWithSource:false,
  copySourceFormat:'—— {source}',
  trashTtlDays:30,statsDims:{cat:true,source:true,tag:true},statsLimit:8,
  compressMode:'local',tinypngKey:'',tinypngProxy:'',
  catLimit:3, srcLimit:3, tagLimit:3,
  defaultType:'',
  collapseLimit:150,
  defaultPageSize:12,
  showHitokoto:true,
  enableAnim:true,
  fontSizeMode:'normal',
  syncCheckInterval:60, 
  autoCheckUpdate:true,
  useRelativeTime:false,
  sidebarShowCat:true,
  sidebarShowSrc:true,
  sidebarShowTag:true,
  inputPlaceholder:'粘贴句子、段落（Ctrl+Enter保存）。用【文字】可高亮。可直接粘贴图片。',
  cardSpacing:'standard', 
  listStyle:'card', 
  zenFontSize:'normal',
  uiStyle:'modern',
  focusModeCat:'收件箱',
  saveShortcut:'ctrl-enter',
  enableMarkdown:true,
  copyWithoutMarks:true,
  copyKeepBlankLines:true,
  focusImgAutoUpload:true,
  focusImgDefaultCat:'其他'
};

const PALETTE=[
  {bg:'#eef2ff',fg:'#4f46e5'},{bg:'#ecfdf5',fg:'#059669'},{bg:'#fff7ed',fg:'#ea580c'},
  {bg:'#fdf2f8',fg:'#db2777'},{bg:'#eff6ff',fg:'#2563eb'},{bg:'#fefce8',fg:'#ca8a04'},
  {bg:'#f5f3ff',fg:'#7c3aed'},{bg:'#f0fdfa',fg:'#0d9488'},{bg:'#fef2f2',fg:'#dc2626'},
  {bg:'#f1f5f9',fg:'#475569'},{bg:'#fff0f5',fg:'#e11d48'},{bg:'#f3e8ff',fg:'#9333ea'},
  {bg:'#e0f2fe',fg:'#0284c7'},{bg:'#dcfce7',fg:'#16a34a'},{bg:'#fef08a',fg:'#854d0e'},
  {bg:'#ffedd5',fg:'#c2410c'},{bg:'#fce7f3',fg:'#be185d'},{bg:'#e0e7ff',fg:'#3730a3'},
  {bg:'#ccfbf1',fg:'#0f766e'},{bg:'#fee2e2',fg:'#b91c1c'}
];

const db={
  items:[],cats:DEFAULT_CATS.slice(),colors:{},sources:[],fixedSource:'',fixedTags:[],
  imageCategories:DEFAULT_IMG_CATS.slice(),
  settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),trash:[]
};

let currentType='全部';
let currentSource=ALL_SOURCES;
let currentTag='';
let keyword='';
let editingId=null;
let selectMode=false;
const selectedIds=new Set();
let pendingConfirm=null;
let exportFormat='json';
let currentPage=1;
let pageSize=12;

let layoutMode='sidebar';
let themeMode='light';
let zenMode=false;
let focusMode=false;

let pendingImages=[];
let pendingUploadFiles=[];
let pendingUploadCat='';

const expandedIds=new Set();
let draggedItemId=null;

let currentImgViewCat='全部';
let repoImagesCache = [];
let imgMgrCurrentFilter = 'all';
let imgMgrSelectMode = false;
let imgMgrSelectedIds = new Set();

function trashTtlMs(){
  const d=Number(db.settings.trashTtlDays)||30;
  return Math.max(1,Math.min(365,d))*86400000;
}
function fmtSize(n){
  if(!n||n<0)return '0 B';
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}

const $=id=>document.getElementById(id);
const inputEl=$('input'),typeEl=$('type'),sourceEl=$('source'),tagsEl=$('tags');
const addBtn=$('addBtn'),cancelBtn=$('cancelBtn');
const listEl=$('list'),searchEl=$('search');
const catManager=$('catManager'),catListEl=$('catList');
const newCatInput=$('newCatInput');
const batchBar=$('batchBar');
const sourcePicker=$('sourcePicker'),sourcePanel=$('sourcePanel'),spList=$('spList'),spSearch=$('spSearch');
const tagPicker=$('tagPicker'),tagPanel=$('tagPanel'),tpList=$('tpList'),tpSearch=$('tpSearch');
const tabsEl=$('tabs');
const pendingImgsEl=$('pendingImgs');
const zenBarEl=$('zenBar');

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function getSearchTerms(){return keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);}

function formatCount(num) {
  return num > 99 ? '99+' : num;
}

function highlightEscaped(escaped,kws){
  const list=(kws||[]).filter(Boolean);
  if(!list.length)return escaped;
  const pat=list.map(k=>esc(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  if(!pat)return escaped;
  try{return escaped.replace(new RegExp('('+pat+')','gi'),'<mark class="kw">$1</mark>');}
  catch(e){return escaped;}
}

function formatText(text,kws){
  const raw=String(text==null?'':text);
  const enableMD = db.settings.enableMarkdown !== false;
  const re=/(\*\*|==|【)([\s\S]*?)(\*\*|==|】)/g;
  let out='',last=0,m;
  
  while((m=re.exec(raw))){
    const startSym = m[1];
    const endSym = m[3];
    const content = m[2];
    let isValid = false;
    let isBold = false;
    
    if (startSym === '【' && endSym === '】') isValid = true;
    else if (startSym === '==' && endSym === '==') isValid = true;
    else if (startSym === '**' && endSym === '**') { isValid = true; if (enableMD) isBold = true; }
    
    if(!isValid) continue;
    
    out+=highlightEscaped(esc(raw.slice(last,m.index)),kws);
    
    if (isBold) out += `<strong>${esc(content)}</strong>`;
    else out += `<mark class="hl">${esc(content)}</mark>`;
    
    last=m.index+m[0].length;
  }
  out+=highlightEscaped(esc(raw.slice(last)),kws);
  return out;
}

function pad2(n){return String(n).padStart(2,'0');}

function fmtDate(ts){
  if(!ts) return '';
  if(db.settings.useRelativeTime){
    const diff = Date.now() - ts;
    if(diff < 60000) return '刚刚';
    if(diff < 3600000) return Math.floor(diff/60000) + ' 分钟前';
    if(diff < 86400000) return Math.floor(diff/3600000) + ' 小时前';
    if(diff < 86400000*30) return Math.floor(diff/86400000) + ' 天前';
  }
  const d=new Date(ts||Date.now());const now=new Date();
  const hm=`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if(d.getFullYear()===now.getFullYear())return `${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${hm}`;
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${hm}`;
}
function fmtDateOnly(ts){const d=new Date(ts||Date.now());return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
function fmtFull(ts){const d=new Date(ts||Date.now());return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;}

let toastTimer;
function toast(msg){
  const el=$('toast');el.textContent=msg;
  el.classList.toggle('raised',batchBar.classList.contains('show') || ($('imgMgrBatchBar') && $('imgMgrBatchBar').classList.contains('show')));
  el.classList.add('show');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
}

function copyText(text,source){
  let finalText=String(text||'');
  
  if (db.settings.copyWithoutMarks !== false) {
    finalText = finalText
      .replace(/【([\s\S]*?)】/g, '$1')
      .replace(/==([\s\S]*?)==/g, '$1')
      .replace(/\*\*([\s\S]*?)\*\*/g, '$1');
  }

  if (db.settings.copyKeepBlankLines === false) {
    finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();
  }

  if(db.settings.copyWithSource){
    const fmt = db.settings.copySourceFormat; 
    if (fmt) {
      let suffix = '';
      if (fmt.includes('{source}')) suffix = fmt.replace(/\{source\}/g, source || '');
      else suffix = fmt;
      if(suffix.trim()) finalText += '\n' + suffix;
    }
  }
  
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(finalText).then(()=>toast('已复制')).catch(()=>fallbackCopy(finalText));
  }else fallbackCopy(finalText);
}

function fallbackCopy(t){
  const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('已复制');}catch(e){toast('复制失败，请手动选择');}
  ta.remove();
}
function download(blob,filename){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function scrollTop(){window.scrollTo({top:0,behavior:'smooth'});}
function utf8ToBase64(str){return btoa(unescape(encodeURIComponent(str)));}
function base64ToUtf8(b64){return decodeURIComponent(escape(atob(b64)));}
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{const s=String(r.result);resolve(s.split(',')[1]||'');};
    r.onerror=reject;
    r.readAsDataURL(blob);
  });
}

function fetchHitokoto(){
  $('hitokotoText').textContent='正在获取...';$('hitokotoFrom').textContent='';
  fetch('https://v1.hitokoto.cn/').then(r=>r.json()).then(data=>{
    if(data.hitokoto){
      $('hitokotoText').textContent=data.hitokoto;
      let fromStr=data.from?`—— ${data.from}`:'';
      if(data.from_who)fromStr+=` · ${data.from_who}`;
      $('hitokotoFrom').textContent=fromStr;
    }
  }).catch(()=>{$('hitokotoText').textContent='获取失败';});
}

function applyLayout(){
  document.body.classList.toggle('layout-sidebar',layoutMode==='sidebar');
  document.body.classList.toggle('layout-compact',layoutMode==='compact');
  updateLayoutBtn();
}
function updateLayoutBtn(){
  const btn=$('layoutBtn');
  if(layoutMode==='sidebar'){
    btn.title='收起侧栏';
    btn.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><path d="m10 9 3 3-3 3"/></svg>`;
  }else{
    btn.title='展开侧栏';
    btn.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><path d="m13 9-3 3 3 3"/></svg>`;
  }
}
function setLayout(mode){
  layoutMode=mode;localStorage.setItem(LAYOUT_KEY,mode);
  applyLayout();closeSidebar();catManager.hidden=true;
  renderSourceFilter();
}

/* ★ 修复：新增 persist 参数，系统跟随切换时不写入 localStorage */
function setTheme(mode, persist = true){
  themeMode=mode;
  document.documentElement.setAttribute('data-theme',mode);
  if (persist) localStorage.setItem(THEME_KEY,mode);
  $('themeIconSun').style.display=mode==='dark'?'none':'block';
  $('themeIconMoon').style.display=mode==='dark'?'block':'none';
}
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(db.settings));
  if(typeof scheduleAutoPush==='function' && !suppressPush) scheduleAutoPush();
}

function applySettingsToUI(){
  const s=db.settings;
  
  document.documentElement.setAttribute('data-style', s.uiStyle || 'modern');
  document.body.setAttribute('data-style', s.uiStyle || 'modern');
  
  if($('copyWithSource')) $('copyWithSource').checked=!!s.copyWithSource;
  if($('copySourceFormat')) {
    $('copySourceFormat').value = s.copySourceFormat !== undefined ? s.copySourceFormat : '—— {source}';
    if($('copySourceFormatWrap')) $('copySourceFormatWrap').style.display = s.copyWithSource ? 'block' : 'none';
  }
  
  if($('enableMarkdown')) $('enableMarkdown').checked = s.enableMarkdown !== false;
  if($('copyWithoutMarks')) $('copyWithoutMarks').checked = s.copyWithoutMarks !== false;
  if($('copyKeepBlankLines')) $('copyKeepBlankLines').checked = s.copyKeepBlankLines !== false;
  
  if($('trashTtlInput')) $('trashTtlInput').value=Number(s.trashTtlDays)||30;
  if($('statDimCat')) $('statDimCat').checked=!s.statsDims||s.statsDims.cat!==false;
  if($('statDimSource')) $('statDimSource').checked=!s.statsDims||s.statsDims.source!==false;
  if($('statDimTag')) $('statDimTag').checked=!s.statsDims||s.statsDims.tag!==false;
  if($('statLimitInput')) $('statLimitInput').value=Number(s.statsLimit)||8;
  if($('tinypngKey')) $('tinypngKey').value=s.tinypngKey||'';
  if($('tinypngProxy')) $('tinypngProxy').value=s.tinypngProxy||'';
  
  if($('syncCheckIntervalInput')) $('syncCheckIntervalInput').value=Number(s.syncCheckInterval)||60;
  if($('autoCheckUpdateToggle')) $('autoCheckUpdateToggle').checked = s.autoCheckUpdate !== false;
  if($('useRelativeTimeToggle')) $('useRelativeTimeToggle').checked = s.useRelativeTime === true;
  if($('themeDarkToggle')) $('themeDarkToggle').checked = themeMode === 'dark';
  if($('focusModeCatInput')) $('focusModeCatInput').value = s.focusModeCat || '收件箱';

  if($('sidebarShowCat')) $('sidebarShowCat').checked = s.sidebarShowCat !== false;
  if($('sidebarShowSrc')) $('sidebarShowSrc').checked = s.sidebarShowSrc !== false;
  if($('sidebarShowTag')) $('sidebarShowTag').checked = s.sidebarShowTag !== false;

  const catGroup = $('catNav')?.closest('.nav-group');
  const srcGroup = $('sourceNav')?.closest('.nav-group');
  const tagGroup = $('tagNav')?.closest('.nav-group');
  if(catGroup) catGroup.style.display = s.sidebarShowCat !== false ? '' : 'none';
  if(srcGroup) srcGroup.style.display = s.sidebarShowSrc !== false ? '' : 'none';
  if(tagGroup) tagGroup.style.display = s.sidebarShowTag !== false ? '' : 'none';

  if(inputEl) {
    const hint = s.saveShortcut === 'enter' ? '（Enter 保存，Shift+Enter 换行）' : '（Ctrl+Enter 保存）';
    const isCustom = s.inputPlaceholder && s.inputPlaceholder !== DEFAULT_SETTINGS.inputPlaceholder;
    if (isCustom) inputEl.placeholder = s.inputPlaceholder;
    else inputEl.placeholder = '粘贴句子、段落' + hint + '。用【文字】可高亮。可直接粘贴图片。';
  }
  
  if($('inputPlaceholder')) $('inputPlaceholder').value = s.inputPlaceholder || DEFAULT_SETTINGS.inputPlaceholder;

  document.body.classList.remove('layout-strip');
  if (s.listStyle === 'strip') document.body.classList.add('layout-strip');
  document.querySelectorAll('#listStyleMode button').forEach(b => {
    b.classList.toggle('active', b.dataset.style === (s.listStyle || 'card'));
  });

  document.querySelectorAll('#saveShortcut button').forEach(b => {
    b.classList.toggle('active', b.dataset.shortcut === (s.saveShortcut || 'ctrl-enter'));
  });

  document.body.classList.remove('zen-font-large', 'zen-font-xlarge');
  if (s.zenFontSize === 'large') document.body.classList.add('zen-font-large');
  if (s.zenFontSize === 'xlarge') document.body.classList.add('zen-font-xlarge');
  document.querySelectorAll('#zenFontSize button').forEach(b => {
    b.classList.toggle('active', b.dataset.zfs === (s.zenFontSize || 'normal'));
  });

  if ($('catLimitInput')) $('catLimitInput').value = Number(s.catLimit)||3;
  if ($('srcLimitInput')) $('srcLimitInput').value = Number(s.srcLimit)||3;
  if ($('tagLimitInput')) $('tagLimitInput').value = Number(s.tagLimit)||3;
  if ($('collapseLimitInput')) $('collapseLimitInput').value = Number(s.collapseLimit)||150;
  if ($('showHitokoto')) $('showHitokoto').checked = s.showHitokoto !== false;
  if ($('enableAnim')) $('enableAnim').checked = s.enableAnim !== false;
  if ($('defaultPageSizeSelect')) $('defaultPageSizeSelect').value = String(s.defaultPageSize)||'12';

  if ($('defaultTypeSelect')) {
    const sel = $('defaultTypeSelect');
    sel.innerHTML = `<option value="">跟随系统（无）</option>` + 
      db.cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value = s.defaultType || '';
  }

  const mode=s.compressMode||'local';
  document.querySelectorAll('#compressMode button').forEach(b=>{
    b.classList.toggle('active', b.dataset.mode===mode);
  });
  if($('tinypngFields')) $('tinypngFields').style.display = mode==='tinypng' ? 'block' : 'none';
  
  document.querySelectorAll('#fontSizeMode button').forEach(b=>{
    b.classList.toggle('active', b.dataset.size===(s.fontSizeMode||'normal'));
  });
  applyFontSize(s.fontSizeMode);

  document.body.classList.toggle('no-anim', s.enableAnim === false);
  
  const hitokotoBox = document.querySelector('.hitokoto-box');
  if (hitokotoBox) hitokotoBox.style.display = (s.showHitokoto !== false) ? 'flex' : 'none';

  if ($('focusImgAutoUpload')) $('focusImgAutoUpload').checked = s.focusImgAutoUpload !== false;
  if ($('focusImgCatWrap')) $('focusImgCatWrap').style.display = (s.focusImgAutoUpload !== false) ? 'block' : 'none';
  if ($('focusImgDefaultCat')) {
    const sel = $('focusImgDefaultCat');
    sel.innerHTML = db.imageCategories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value = s.focusImgDefaultCat || '其他';
  }

  updateTinyUsageUI();
  if (typeof window.renderImgCatsEditor === 'function') window.renderImgCatsEditor();
  if (typeof renderStyleOptions === 'function') renderStyleOptions();
}

function applyFontSize(mode) {
  document.documentElement.classList.remove('font-large', 'font-xlarge');
  if (mode === 'large') document.documentElement.classList.add('font-large');
  if (mode === 'xlarge') document.documentElement.classList.add('font-xlarge');
}

function loadSettings(){
  try{
    const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if(s&&typeof s==='object'){
      db.settings={...DEFAULT_SETTINGS,...s,statsDims:{...DEFAULT_SETTINGS.statsDims,...(s.statsDims||{})}};
    }
  }catch(e){}
  db.settings.trashTtlDays=Math.max(1,Math.min(365,Number(db.settings.trashTtlDays)||30));
  db.settings.statsLimit=Math.max(3,Math.min(30,Number(db.settings.statsLimit)||8));
  db.settings.catLimit=Math.max(1,Math.min(30,Number(db.settings.catLimit)||3));
  db.settings.srcLimit=Math.max(1,Math.min(30,Number(db.settings.srcLimit)||3));
  db.settings.tagLimit=Math.max(1,Math.min(30,Number(db.settings.tagLimit)||3));
  db.settings.collapseLimit=Math.max(50,Math.min(9999,Number(db.settings.collapseLimit)||150));
  db.settings.defaultPageSize=Number(db.settings.defaultPageSize)||12;
  db.settings.syncCheckInterval=Math.max(10,Math.min(3600,Number(db.settings.syncCheckInterval)||60));
  if(!['none','local','tinypng'].includes(db.settings.compressMode)) db.settings.compressMode='local';
  if(!['normal','large','xlarge'].includes(db.settings.fontSizeMode)) db.settings.fontSizeMode='normal';
  
  pageSize = db.settings.defaultPageSize;
  applySettingsToUI();
}

function currentMonth(){const n=new Date();return `${n.getFullYear()}-${pad2(n.getMonth()+1)}`;}
function loadTinyCount(){
  try{
    const d=JSON.parse(localStorage.getItem(TINY_KEY))||{};
    if(d.month!==currentMonth())return{month:currentMonth(),count:0};
    return{month:d.month,count:Number(d.count)||0};
  }catch(e){return{month:currentMonth(),count:0};}
}
function bumpTinyCount(){
  const d=loadTinyCount();d.count+=1;
  localStorage.setItem(TINY_KEY,JSON.stringify(d));
  updateTinyUsageUI();
  return d;
}
function updateTinyUsageUI(){
  const d=loadTinyCount();
  const el=$('tinyUsage');
  if(el)el.innerHTML=`本月（${d.month}）已用 <b>${d.count}</b> / 500 次`;
}