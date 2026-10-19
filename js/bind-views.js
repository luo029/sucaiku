/* js / bind-views.js · 事件绑定：视图切换 / 各弹窗 / 设置表单 */
const safeBind = (id, event, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
};

safeBind('batchExportBtn', 'click', () => {
  if(!selectedIds.size){toast('请先选择素材');return;}
  openExportModal('__selected__');
});

safeBind('layoutBtn', 'click', () => {
  if(layoutMode==='sidebar')setLayout('compact');else setLayout('sidebar');
});
safeBind('sidebarCollapseBtn', 'click', () => setLayout('compact'));
safeBind('themeToggleBtn', 'click', () => {
  setTheme(themeMode==='light'?'dark':'light');
});
safeBind('zenBtn', 'click', () => setZen(true));
safeBind('zenExitBtn', 'click', () => setZen(false));

// ★ 新增：首页安心输入按钮
safeBind('focusBtn', 'click', () => setFocus(true));

safeBind('imgViewBtn', 'click', openImgView);
safeBind('imgViewClose', 'click', closeImgView);

safeBind('imgCatTabs', 'click', e => {
  const t=e.target.closest('.ic-tab');if(!t)return;
  currentImgViewCat=t.dataset.ic;
  renderImgView();
});
safeBind('imgMasonry', 'click', e => {
  const img=e.target.closest('[data-open-img]');
  if(img)window.open(img.dataset.openImg,'_blank','noopener');
});

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(focusMode){setFocus(false);return;}
  if(zenMode){setZen(false);return;}
  if(!$('imgView').hidden){closeImgView();return;}
  if(!$('imgManagerView').hidden){$('imgManagerView').hidden=true;document.body.style.overflow='';return;}
  const openMask=document.querySelector('.modal-mask.show');
  if(openMask){
    if(openMask.id==='modalMask'){closeModal();return;}
    openMask.classList.remove('show');
    return;
  }
});

safeBind('menuBtn', 'click', openSidebar);
safeBind('sidebarOverlay', 'click', closeSidebar);

safeBind('modalCancel', 'click', closeModal);
safeBind('modalConfirm', 'click', () => {
  if($('noRemind').checked)localStorage.setItem(SKIP_KEY,'1');
  const fn=pendingConfirm;closeModal();if(fn)fn();
});
safeBind('modalMask', 'click', e => {if(e.target===$('modalMask'))closeModal();});

safeBind('menuRandomBtn', 'click', () => {
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
});
safeBind('randomCloseBtn', 'click', () => $('randomMask').classList.remove('show'));
safeBind('randomAgainBtn', 'click', () => $('menuRandomBtn').click());
safeBind('randomMask', 'click', e => {if(e.target===$('randomMask'))$('randomMask').classList.remove('show');});

safeBind('menuDupBtn', 'click', checkDuplicates);
safeBind('dupCloseBtn', 'click', () => $('dupMask').classList.remove('show'));
safeBind('dupMask', 'click', e => {if(e.target===$('dupMask'))$('dupMask').classList.remove('show');});
safeBind('dupList', 'click', e => {
  const delBtn=e.target.closest('[data-del-dup]');
  if(delBtn){
    const id=delBtn.dataset.delDup;
    moveToTrash([id]);save();render();toast('已移入回收站');checkDuplicates();
  }
});

safeBind('menuStatsBtn', 'click', openStats);
safeBind('statsCloseBtn', 'click', () => $('statsMask').classList.remove('show'));
safeBind('statsMask', 'click', e => {if(e.target===$('statsMask'))$('statsMask').classList.remove('show');});

safeBind('menuHealthBtn', 'click', openHealth);
safeBind('healthCloseBtn', 'click', () => $('healthMask').classList.remove('show'));
safeBind('healthMask', 'click', e => {if(e.target===$('healthMask'))$('healthMask').classList.remove('show');});
safeBind('healthList', 'click', e => {
  const row=e.target.closest('[data-edit]');if(!row)return;
  const id=row.dataset.edit;
  $('healthMask').classList.remove('show');
  if(db.items.some(i=>i.id===id))startEdit(id);
  else toast('该素材已不存在');
});

safeBind('menuTrashBtn', 'click', () => {
  cleanTrash();renderTrash();$('trashMask').classList.add('show');
});
safeBind('trashCloseBtn', 'click', () => $('trashMask').classList.remove('show'));
safeBind('trashMask', 'click', e => {if(e.target===$('trashMask'))$('trashMask').classList.remove('show');});
safeBind('trashClearBtn', 'click', () => {
  if(!db.trash.length){toast('回收站已经是空的');return;}
  if(!confirm(`确定清空回收站吗？${db.trash.length} 条素材将被彻底删除，不可恢复。`))return;
  db.trash=[];save();renderTrash();toast('已清空回收站');
});
safeBind('trashList', 'click', e => {
  const r=e.target.closest('[data-restore]');
  if(r){restoreFromTrash(r.dataset.restore);return;}
  const p=e.target.closest('[data-purge]');
  if(p){
    if(!confirm('彻底删除这条素材？不可恢复。'))return;
    purgeTrashItem(p.dataset.purge);toast('已彻底删除');
  }
});

safeBind('menuImgManagerBtn', 'click', () => {
  $('menu').classList.remove('show');
  openImgManager();
});
safeBind('imgMgrCloseBtn', 'click', () => {
  $('imgManagerView').hidden = true;
  document.body.style.overflow = '';
});
safeBind('imgMgrRefreshBtn', 'click', loadRepoImages);
safeBind('imgMgrCleanUnusedBtn', 'click', cleanAllUnusedImages);

safeBind('imgMgrGrid', 'click', e => {
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

safeBind('menuExportBtn', 'click', () => openExportModal());
safeBind('menuImportBtn', 'click', () => $('fileInput').click());
safeBind('moreBtn', 'click', e => {
  e.stopPropagation();$('menu').classList.toggle('show');
});
document.addEventListener('click',()=>$('menu').classList.remove('show'));
safeBind('menu', 'click', e => {
  if(e.target.closest('button'))$('menu').classList.remove('show');
});
safeBind('sidebarExportBtn', 'click', () => {
  if(!db.items.length){toast('还没有素材');return;}
  openExportModal();
});
safeBind('exportCancel', 'click', closeExportModal);
safeBind('exportConfirm', 'click', doExport);
safeBind('exportMask', 'click', e => {if(e.target===$('exportMask'))closeExportModal();});
safeBind('exportFormat', 'click', e => {
  const b=e.target.closest('button[data-fmt]');if(!b)return;
  exportFormat=b.dataset.fmt;
  $('exportFormat').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);});
});
safeBind('sidebarImportBtn', 'click', () => $('fileInput').click());
safeBind('fileInput', 'change', e => {
  const f=e.target.files[0];if(!f)return;
  handleImportFile(f);e.target.value='';
});

/* 设置面板 */
safeBind('settingCloseBtn', 'click', () => {
  const mask = $('settingMask');
  if (mask) mask.classList.remove('show');
});
safeBind('settingMask', 'click', e => {
  if(e.target===$('settingMask')) $('settingMask').classList.remove('show');
});

safeBind('settingTabs', 'click', e => {
  const btn = e.target.closest('.st-tab');
  if (!btn) return;
  $('settingTabs').querySelectorAll('.st-tab').forEach(b => {
    b.style.color = 'var(--text-2)'; b.style.background = 'transparent'; b.style.fontWeight = '500';
    b.classList.remove('active');
  });
  btn.style.color = 'var(--accent)'; btn.style.background = 'var(--accent-soft)'; btn.style.fontWeight = '600';
  btn.classList.add('active');
  const target = btn.dataset.target;
  document.querySelectorAll('.st-scroll .st-card').forEach(card => {
    card.style.display = (card.dataset.group === target) ? 'block' : 'none';
  });
});

function openSettings() {
  renderStyleOptions();
  applySettingsToUI();
  fillGHForm();
  updateTinyUsageUI();
  renderSettingsOverview();
  $('settingMask').classList.add('show');
}
safeBind('menuSettingBtn', 'click', openSettings);
safeBind('gearBtn', 'click', openSettings);

// 安心输入模式
safeBind('focusModeCatInput', 'change', e => {
  db.settings.focusModeCat = e.target.value.trim() || '收件箱';
  saveSettings();
  toast(`专注模式默认分类设为「${db.settings.focusModeCat}」`);
});

safeBind('openFocusModeBtn', 'click', () => {
  $('settingMask').classList.remove('show');
  setFocus(true);
});

safeBind('focusExitBtn', 'click', () => {
  setFocus(false);
});

safeBind('themeDarkToggle', 'change', e => {
  setTheme(e.target.checked ? 'dark' : 'light');
});
safeBind('useRelativeTimeToggle', 'change', e => {
  db.settings.useRelativeTime = e.target.checked;
  saveSettings();
  renderList();
  toast(e.target.checked ? '已切换为相对时间' : '已切换为绝对时间');
});

safeBind('uiStyleMode', 'click', e => {
  const b = e.target.closest('button[data-style]'); if(!b) return;
  db.settings.uiStyle = b.dataset.style;
  saveSettings(); 
  renderStyleOptions();
  applySettingsToUI();
  const styleName = AVAILABLE_STYLES.find(s => s.id === db.settings.uiStyle)?.name || '新风格';
  toast('已切换至「' + styleName + '」');
});

safeBind('cardSpacing', 'click', e => {
  const b = e.target.closest('button[data-spacing]'); if(!b) return;
  db.settings.cardSpacing = b.dataset.spacing; 
  saveSettings(); applySettingsToUI();
  toast('卡片间距已调整');
});

safeBind('zenFontSize', 'click', e => {
  const b = e.target.closest('button[data-zfs]'); if(!b) return;
  db.settings.zenFontSize = b.dataset.zfs; 
  saveSettings(); applySettingsToUI();
  toast('极简模式字号已调整');
});

safeBind('sidebarShowCat', 'change', e => {
  db.settings.sidebarShowCat = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示分类' : '已隐藏分类');
});
safeBind('sidebarShowSrc', 'change', e => {
  db.settings.sidebarShowSrc = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示来源' : '已隐藏来源');
});
safeBind('sidebarShowTag', 'change', e => {
  db.settings.sidebarShowTag = e.target.checked;
  saveSettings(); applySettingsToUI();
  toast(e.target.checked ? '已显示标签' : '已隐藏标签');
});

safeBind('copyWithSource', 'change', e => {
  db.settings.copyWithSource=e.target.checked;saveSettings();
  toast(e.target.checked?'已开启复制附带来源':'已关闭');
});
safeBind('trashTtlInput', 'change', e => {
  const v=Math.max(1,Math.min(365,parseInt(e.target.value,10)||30));
  e.target.value=v;db.settings.trashTtlDays=v;saveSettings();cleanTrash();renderTrash();
  toast(`回收站保留 ${v} 天`);
});
safeBind('statDimCat', 'change', e => {db.settings.statsDims.cat=e.target.checked;saveSettings();});
safeBind('statDimSource', 'change', e => {db.settings.statsDims.source=e.target.checked;saveSettings();});
safeBind('statDimTag', 'change', e => {db.settings.statsDims.tag=e.target.checked;saveSettings();});
safeBind('statLimitInput', 'change', e => {
  const v=Math.max(3,Math.min(30,parseInt(e.target.value,10)||8));
  e.target.value=v;db.settings.statsLimit=v;saveSettings();
});

safeBind('catLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.catLimit = v; saveSettings(); renderSidebar();
  toast(`分类最多显示 ${v} 个`);
});
safeBind('srcLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.srcLimit = v; saveSettings(); renderSidebar();
  toast(`来源最多显示 ${v} 个`);
});
safeBind('tagLimitInput', 'change', e => {
  const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 3));
  e.target.value = v; db.settings.tagLimit = v; saveSettings(); renderTags();
  toast(`标签最多显示 ${v} 个`);
});

safeBind('defaultTypeSelect', 'change', e => {
  db.settings.defaultType = e.target.value;
  saveSettings();
  refreshTypeSelect(db.settings.defaultType || db.cats[0] || '');
  toast('已设置默认分类');
});
safeBind('collapseLimitInput', 'change', e => {
  const v = Math.max(50, Math.min(9999, parseInt(e.target.value, 10) || 150));
  e.target.value = v; db.settings.collapseLimit = v; saveSettings(); renderList();
  toast(`折叠阈值改为 ${v} 字`);
});
safeBind('defaultPageSizeSelect', 'change', e => {
  const v = parseInt(e.target.value, 10);
  db.settings.defaultPageSize = v; pageSize = v; currentPage = 1; saveSettings(); renderList();
  toast(`默认每页 ${v} 条`);
});

safeBind('showHitokoto', 'change', e => {
  db.settings.showHitokoto = e.target.checked; saveSettings(); applySettingsToUI();
});
safeBind('enableAnim', 'change', e => {
  db.settings.enableAnim = e.target.checked; saveSettings(); applySettingsToUI();
});
safeBind('fontSizeMode', 'click', e => {
  const b = e.target.closest('button[data-size]'); if(!b) return;
  db.settings.fontSizeMode = b.dataset.size; saveSettings(); applySettingsToUI();
  toast('字号已调整');
});

safeBind('compressMode', 'click', e => {
  const b=e.target.closest('button[data-mode]');if(!b)return;
  db.settings.compressMode=b.dataset.mode;
  saveSettings(); applySettingsToUI();
  toast('压缩方式：'+({none:'不压缩',local:'本地压缩',tinypng:'TinyPNG'}[db.settings.compressMode]));
});
safeBind('tinypngKey', 'change', e => {
  db.settings.tinypngKey=e.target.value.trim();saveSettings();toast('已保存 TinyPNG Key');
});
safeBind('tinypngProxy', 'change', e => {
  db.settings.tinypngProxy=e.target.value.trim();saveSettings();toast('已保存 TinyPNG 代理');
});

/* GitHub 表单 */
['ghToken','ghOwner','ghRepo','ghBranch','ghDataPath','ghSiteBase','ghImgOwner','ghImgRepo','ghImgBranch','ghImgPath','ghImgSite','ghImgToken'].forEach(id=>{
  safeBind(id, 'change', () => collectGHForm());
});
safeBind('ghAuto', 'change', () => collectGHForm());
safeBind('ghAutoPull', 'change', () => collectGHForm());
safeBind('autoPushDelay', 'change', () => {
  const v=Math.max(1,Math.min(60,parseInt($('autoPushDelay').value,10)||2));
  $('autoPushDelay').value=v;
  collectGHForm();
  toast(`自动推送间隔 ${v} 秒`);
});

safeBind('syncCheckIntervalInput', 'change', e => {
  const v = Math.max(10, Math.min(3600, parseInt(e.target.value, 10) || 60));
  e.target.value = v;
  db.settings.syncCheckInterval = v;
  saveSettings();
  if(typeof restartSyncTimer === 'function') restartSyncTimer();
  toast(`检查间隔已设为 ${v} 秒`);
});

safeBind('autoCheckUpdateToggle', 'change', e => {
  db.settings.autoCheckUpdate = e.target.checked;
  saveSettings();
  if(typeof restartSyncTimer === 'function') restartSyncTimer();
  toast(e.target.checked ? '已开启云端巡检' : '已关闭云端巡检');
});

safeBind('ghTestBtn', 'click', () => {collectGHForm();ghTest();});
safeBind('ghPullBtn', 'click', async () => {
  collectGHForm();
  if(!confirm('拉取会用远程数据覆盖本地数据，确定继续？'))return;
  await ghPull(false);
});
safeBind('ghPushBtn', 'click', async () => {
  collectGHForm();
  await ghPush(false);
});

safeBind('ghForcePushBtn', 'click', async () => {
  if(!confirm('⚠️ 危险操作：强制推送将以你当前的本地数据为准，强行覆盖云端的所有数据！\n\n确定要继续吗？')) return;
  collectGHForm();
  const ok = await ghPush(false, true);
  if(ok) toast('已强制覆盖云端数据');
});

/* 图片分类 UI */
const oldImgCatsInput = document.getElementById('imgCatsInput');
if (oldImgCatsInput) {
  const parent = oldImgCatsInput.parentElement.parentElement;
  parent.innerHTML = `
    <div id="imgCatsEditor" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:34px; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:var(--r-sm);"></div>
    <div style="display:flex; gap:10px;">
      <input type="text" id="newImgCatInput" placeholder="输入新分类，按回车添加" autocomplete="off" style="flex:1; border:1px solid var(--line); border-radius:var(--r-sm); padding:9px 12px; font-size:14px; color:var(--text); background:var(--card); outline:none;">
    </div>
  `;

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

  document.getElementById('imgCatsEditor').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-img-cat]');
    if (!btn) return;
    const cat = btn.dataset.delImgCat;
    if (db.imageCategories.length <= 1) {
      toast('至少需要保留一个图片分类');return;
    }
    db.imageCategories = db.imageCategories.filter(c => c !== cat);
    save(); window.renderImgCatsEditor(); toast('分类已删除');
  });

  document.getElementById('newImgCatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val) return;
      if (db.imageCategories.includes(val)) { toast('该分类已存在'); return; }
      if (db.imageCategories.length >= 15) { toast('最多只能设置 15 个图片分类'); return; }
      db.imageCategories.push(val); save(); e.target.value = ''; window.renderImgCatsEditor(); toast('已添加分类');
    }
  });
  
  window.renderImgCatsEditor();
}