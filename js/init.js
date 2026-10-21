// js/init.js - 启动初始化
// 适配新版 github.js 的分片存储接口 + 首次部署自动推送

var PUBLIC_OWNER = 'luo029';
var PUBLIC_REPO = 'sucaiuk_data';
var PUBLIC_IMG_REPO = 'sucaiuk_pictures';
var PUBLIC_PATH = 'material-library.json';

(function initApp() {
  try {
    try {
      var savedLayout = localStorage.getItem(LAYOUT_KEY);
      if (savedLayout === 'sidebar' || savedLayout === 'compact') layoutMode = savedLayout;

      var savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        themeMode = savedTheme;
      } else {
        themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {}

    applyLayout();
    setTheme(themeMode, false);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? 'dark' : 'light', false);
      }
    });

    loadSettings();

    // 初始化分片相关的字段
    if (!db._shardSnapshots) db._shardSnapshots = {};
    if (!db._trashSnapshot) db._trashSnapshot = '';
    if (!db._metaSnapshot) db._metaSnapshot = '';
    if (!db._allShardKeys) db._allShardKeys = [];
    if (!db._loadedShardKeys) db._loadedShardKeys = [];
    if (!db.tagColors) db.tagColors = {};

    loadStore().then(function () {
      console.log('[init] 本地数据加载完成，共 ' + db.items.length + ' 条素材');

      cleanTrash();
      refreshTypeSelect(db.settings.defaultType || db.cats[0] || '');
      setupDropZones();

      sourceEl.value = db.fixedSource || '';
      tagsEl.value = db.fixedTags.length ? db.fixedTags.join(', ') : '';

      render();
      updateSourcePickerUI();
      updateTagPickerUI();
      renderPendingImgs();
      fetchHitokoto();

      var cfg = loadGH();
      var isOwner = !!(cfg.token && cfg.owner && cfg.repo);

      if (isOwner) {
        document.body.classList.remove('guest-mode');
        handleOwnerSync(cfg);
        return;
      }

      initGuestMode();
    }).catch(function (err) {
      console.error('[init] 本地加载失败', err);
      try {
        render();
        updateSourcePickerUI();
        updateTagPickerUI();
        renderPendingImgs();
      } catch (e) {
        console.error('[init] 渲染失败', e);
      }
    });

  } catch (err) {
    console.error('[init] 初始化失败', err);
  }
})();

// 房主同步逻辑（核心：智能判断云端状态）
function handleOwnerSync(cfg) {
  if (!cfg.autoPull) {
    console.log('[init] 未开启自动拉取，跳过');
    return;
  }

  // 先检查云端是否有 index.json
  var rc = ghRepoConfig('data');
  var dataDir = cfg.dataDir || db.settings.dataDir || 'material-library';
  var indexPath = dataDir + '/index.json';

  ghGetRaw(rc, indexPath).then(function (f) {
    if (!f) {
      // 场景 1：云端没有分片结构
      if (db.items.length > 0) {
        // 1a. 本地有数据 → 推送上去（相当于首次迁移）
        console.log('[init] 云端未初始化分片，正在把本地 ' + db.items.length + ' 条素材推送上去...');
        toast('正在初始化云端分片...');
        ghPush(true).then(function (ok) {
          if (ok) {
            console.log('[init] ✅ 首次推送成功，分片结构已创建');
            toast('✅ 云端分片初始化完成');
          } else {
            console.warn('[init] ❌ 首次推送失败');
            toast('❌ 云端分片初始化失败，请检查网络或配置');
          }
        });
      } else {
        // 1b. 本地也空 → 什么都不做
        console.log('[init] 云端和本地都是空的');
      }
    } else {
      // 场景 2：云端有分片结构 → 判断是否拉取
      var shouldPull = cfg.autoSync || db.items.length === 0;
      if (shouldPull) {
        console.log('[init] 云端有分片，开始拉取...');
        ghPull(true).then(function (ok) {
          if (ok) {
            console.log('[init] ✅ 自动拉取成功，共 ' + db.items.length + ' 条素材');
          } else {
            console.warn('[init] ❌ 自动拉取失败');
          }
        });
      } else {
        console.log('[init] 云端有分片，本地有数据，未开启自动拉取，跳过');
      }
    }
  }).catch(function (e) {
    console.warn('[init] 检查云端状态失败:', e);
    // 兜底：如果检查失败，走原来的逻辑
    var shouldPull = cfg.autoSync || db.items.length === 0;
    if (shouldPull) {
      ghPull(true);
    }
  });
}

// 访客模式
function initGuestMode() {
  var style = document.createElement('style');
  style.innerHTML = ''
    + 'body.guest-mode .composer { display: none !important; }'
    + 'body.guest-mode .ops { display: none !important; }'
    + 'body.guest-mode .card-check { display: none !important; }'
    + 'body.guest-mode #selectBtn, '
    + 'body.guest-mode #sidebarImportBtn, '
    + 'body.guest-mode #manageCatBtn, '
    + 'body.guest-mode #manageTagBtn, '
    + 'body.guest-mode .menu button:not(#menuRandomBtn):not(#menuStatsBtn):not(#menuDupBtn) { display: none !important; }'
    + 'body.guest-mode .nav-del-btn { display: none !important; }'
    + 'body.guest-mode .layout-btn, '
    + 'body.guest-mode #themeToggleBtn { display: none !important; }'
    + 'body.guest-mode #reviewBtn, '
    + 'body.guest-mode #pipBtn, '
    + 'body.guest-mode #focusBtn { display: none !important; }'
    + 'body.guest-mode.focus-mode .composer { display: none !important; }'
    + '@keyframes spin { 100% { transform: rotate(360deg); } }'
    + '.owner-unlock-tip {'
    + '  background: var(--accent-soft);'
    + '  color: var(--accent);'
    + '  padding: 10px 16px;'
    + '  border-radius: 8px;'
    + '  font-size: 13px;'
    + '  margin-bottom: 20px;'
    + '  display: flex;'
    + '  justify-content: space-between;'
    + '  align-items: center;'
    + '  border: 1px dashed var(--accent);'
    + '}'
    + '.owner-unlock-btn {'
    + '  font-weight: bold;'
    + '  color: var(--accent);'
    + '  text-decoration: underline;'
    + '  cursor: pointer;'
    + '}'
    + '.owner-unlock-btn:hover { opacity: 0.8; }';
  document.head.appendChild(style);
  document.body.classList.add('guest-mode');

  var pageHead = document.querySelector('.page-head');
  if (pageHead) {
    var tip = document.createElement('div');
    tip.className = 'owner-unlock-tip';
    tip.innerHTML = '<span>👀 当前为访客只读模式</span><span class="owner-unlock-btn" id="ownerUnlockBtn">我是主人，去填入 Token 解锁</span>';
    pageHead.appendChild(tip);
    var unlockBtn = document.getElementById('ownerUnlockBtn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', function () {
        var gearBtns = document.querySelectorAll('.sidebar-footer .foot-btn');
        if (gearBtns.length > 0) {
          gearBtns[gearBtns.length - 1].click();
        } else {
          var settingMask = document.getElementById('settingMask');
          if (settingMask) settingMask.classList.add('show');
        }
      });
    }
  }

  if (PUBLIC_OWNER && PUBLIC_REPO) {
    if (db.items.length === 0) {
      listEl.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation: spin 2s linear infinite;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85 1 6.54 2.66L21 8"/><path d="M21 3v5h-5"/></svg><p>正在加载云端素材库...</p></div>';
    }

    var cfg = loadGH();
    if (!cfg.owner || !cfg.repo) {
      var guestCfg = {
        token: '', owner: PUBLIC_OWNER, repo: PUBLIC_REPO, branch: 'main',
        dataPath: PUBLIC_PATH, siteBase: '', autoSync: false, autoPull: true, autoPushDelay: 2,
        imgOwner: PUBLIC_OWNER, imgRepo: PUBLIC_IMG_REPO, imgBranch: 'main', imgPath: 'images', imgSite: '', imgToken: '',
        dataDir: 'material-library', shardSubdir: 'data', isPrivate: false
      };
      saveGH(guestCfg);
    }

    ghPull(true).then(function (ok) {
      if (!ok && db.items.length === 0) {
        listEl.innerHTML = '<div class="empty"><p>加载云端数据失败，请检查网络或配置</p></div>';
      }
    });
  }
}