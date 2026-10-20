/* js / init.js · 启动初始化 */

const PUBLIC_OWNER = 'luo029';          
const PUBLIC_REPO = 'sucaiku_data';          
const PUBLIC_IMG_REPO = 'sucaiku_pictures'; 
const PUBLIC_PATH = 'material-library.json'; 

(async function initApp(){
  try {
    try{
      const savedLayout=localStorage.getItem(LAYOUT_KEY);
      if(savedLayout==='sidebar'||savedLayout==='compact')layoutMode=savedLayout;
      const savedTheme=localStorage.getItem(THEME_KEY);
      if(savedTheme==='dark')themeMode='dark';
    }catch(e){}
    applyLayout();
    setTheme(themeMode);

    loadSettings();
    await loadStore();                     
    cleanTrash();
    refreshTypeSelect(db.settings.defaultType || db.cats[0] || '');
    setupDropZones();

    sourceEl.value=db.fixedSource||'';
    tagsEl.value=db.fixedTags.length?db.fixedTags.join(', '):'';

    render();
    updateSourcePickerUI();
    updateTagPickerUI();
    renderPendingImgs();
    fetchHitokoto();

    (function(){
      const cfg=loadGH();
      const isOwner = !!(cfg.token && cfg.owner && cfg.repo);

      if (isOwner) {
        document.body.classList.remove('guest-mode');
        if(!cfg.autoPull) return;
        const shouldPull = cfg.autoSync || db.items.length === 0;
        if(shouldPull){
          ghPull(true).then(ok => {
            if(!ok) console.warn('自动拉取失败');
          });
        }
        return;
      }

      const style = document.createElement('style');
      style.innerHTML = `
        body.guest-mode .composer { display: none !important; }
        body.guest-mode .ops { display: none !important; }
        body.guest-mode .card-check { display: none !important; }
        body.guest-mode #selectBtn, 
        body.guest-mode #sidebarImportBtn, 
        body.guest-mode #manageCatBtn, 
        body.guest-mode #manageTagBtn,
        body.guest-mode .menu button:not(#menuRandomBtn):not(#menuStatsBtn):not(#menuDupBtn) { display: none !important; }
        body.guest-mode .nav-del-btn { display: none !important; }
        body.guest-mode .layout-btn, 
        body.guest-mode #themeToggleBtn { display: none !important; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .owner-unlock-tip {
          background: var(--accent-soft);
          color: var(--accent);
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px dashed var(--accent);
        }
        .owner-unlock-btn {
          font-weight: bold;
          color: var(--accent);
          text-decoration: underline;
          cursor: pointer;
        }
        .owner-unlock-btn:hover { opacity: 0.8; }
      `;
      document.head.appendChild(style);
      document.body.classList.add('guest-mode');

      const pageHead = document.querySelector('.page-head');
      if (pageHead) {
        const tip = document.createElement('div');
        tip.className = 'owner-unlock-tip';
        tip.innerHTML = `<span>👀 当前为访客只读模式</span><span class="owner-unlock-btn" id="ownerUnlockBtn">我是主人，去填入 Token 解锁</span>`;
        pageHead.appendChild(tip);
        document.getElementById('ownerUnlockBtn').addEventListener('click', () => {
          const gearBtns = document.querySelectorAll('.sidebar-footer .foot-btn');
          if (gearBtns.length > 0) {
            gearBtns[gearBtns.length - 1].click();
          } else {
            document.getElementById('settingMask').classList.add('show');
          }
        });
      }

      if (PUBLIC_OWNER && PUBLIC_REPO) {
        if (db.items.length === 0) {
          listEl.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation: spin 2s linear infinite;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85 1 6.54 2.66L21 8"/><path d="M21 3v5h-5"/></svg><p>正在加载云端素材库...</p></div>`;
        }

        if (!cfg.owner || !cfg.repo) {
          const guestCfg = {
            token: '', owner: PUBLIC_OWNER, repo: PUBLIC_REPO, branch: 'main',
            dataPath: PUBLIC_PATH, siteBase: '', autoSync: false, autoPull: true, autoPushDelay: 2,
            imgOwner: PUBLIC_OWNER, imgRepo: PUBLIC_IMG_REPO, imgBranch: 'main', imgPath: 'images', imgSite: '', imgToken: ''
          };
          saveGH(guestCfg);
        }

        ghPull(true).then(ok => {
          if (!ok && db.items.length === 0) {
            listEl.innerHTML = `<div class="empty"><p>加载云端数据失败，请检查网络或配置</p></div>`;
          }
        });
      }
    })();
  } catch(err) {
    console.error('初始化失败', err);
  }
})();