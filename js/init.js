// js/init.js · 完整文件
// ★ Bug F 修复：checkOrphanImages 在云端分片未拉完时推迟执行（最多重试 20 次），
//   防止"本地 db.items 还没拉取完 → 云端实际被引用的图片被误判成孤儿"。

var PUBLIC_OWNER = 'luo029';
var PUBLIC_REPO = 'sucaiuk_data';
var PUBLIC_IMG_REPO = 'sucaiuk_pictures';
var PUBLIC_PATH = 'material-library.json';

var ORPHAN_KEY = 'material-library.orphan-imgs';
var ORPHAN_SNOOZE_KEY = 'material-library.orphan-snooze';
var ORPHAN_RETRY_KEY = 'material-library.orphan-retry-count';

function checkOrphanImages() {
  try {
    var retryCount = Number(sessionStorage.getItem(ORPHAN_RETRY_KEY) || 0);

    // ★ Bug F：云端分片还没拉完就先延后，避免误判
    var cloudPending = false;
    try {
      if (typeof db !== 'undefined' && db._allShardKeys && db._allShardKeys.length > 0
          && db._loadedShardKeys && db._loadedShardKeys.length < db._allShardKeys.length) {
        cloudPending = true;
      }
    } catch (e) {}

    if (cloudPending) {
      if (retryCount >= 20) {
        sessionStorage.removeItem(ORPHAN_RETRY_KEY);
        console.log('[init] 孤儿检查重试次数过多，放弃本次检查');
        return;
      }
      sessionStorage.setItem(ORPHAN_RETRY_KEY, String(retryCount + 1));
      console.log('[init] 云端分片未加载完，5 秒后重试孤儿检查 (' + (retryCount + 1) + '/20)');
      setTimeout(checkOrphanImages, 5000);
      return;
    }
    sessionStorage.removeItem(ORPHAN_RETRY_KEY);

    var snooze = Number(localStorage.getItem(ORPHAN_SNOOZE_KEY) || 0) || 0;
    if (Date.now() < snooze) return;

    var raw = JSON.parse(localStorage.getItem(ORPHAN_KEY) || '[]');
    if (!Array.isArray(raw) || !raw.length) return;

    var now = Date.now();
    var valid = raw.filter(function (x) { return x && x.path && (now - (x.time || 0)) < 7 * 86400000; });
    if (valid.length !== raw.length) {
      try { localStorage.setItem(ORPHAN_KEY, JSON.stringify(valid)); } catch (e) {}
    }
    if (!valid.length) return;

    var used = new Set();
    db.items.forEach(function (item) {
      (item.images || []).forEach(function (im) {
        if (im && im.path) used.add(String(im.path).trim());
      });
    });

    var orphans = valid.filter(function (x) { return !used.has(String(x.path).trim()); });
    if (!orphans.length) {
      try { localStorage.setItem(ORPHAN_KEY, '[]'); } catch (e) {}
      return;
    }

    var rc = ghRepoConfig('img');
    if (!rc || !rc.token || !rc.owner || !rc.repo) {
      console.warn('[init] 孤儿图片存在但未配置图床，跳过清理');
      return;
    }

    console.log('[init] 发现 ' + orphans.length + ' 张孤儿图片，等待用户确认清理');

    var cleaned = false;
    window.showCustomConfirm({
      title: '发现未保存的图片',
      desc: '有 ' + orphans.length + ' 张图片上传后未保存到素材库。\n\n是否从图床清理这些图片？（取消则在 24 小时后再提醒）',
      isDanger: false,
      onConfirm: function () {
        cleaned = true;
        cleanupOrphanImages(orphans);
      }
    });

    var checkTimer = setInterval(function () {
      var mask = document.getElementById('customConfirmMask');
      if (!mask || !mask.classList.contains('show')) {
        clearInterval(checkTimer);
        if (!cleaned) {
          try { localStorage.setItem(ORPHAN_SNOOZE_KEY, String(Date.now() + 86400000)); } catch (e) {}
        }
      }
    }, 500);
    setTimeout(function () { clearInterval(checkTimer); }, 5 * 60 * 1000);
  } catch (e) {
    console.warn('[init] 检查孤儿图片失败', e);
  }
}

function cleanupOrphanImages(orphans) {
  var rc = ghRepoConfig('img');
  if (!rc || !rc.token) { toast('未配置图床'); return; }
  var successPaths = new Set();
  var failPaths = new Set();
  toast('正在清理 ' + orphans.length + ' 张图片…');
  var chain = Promise.resolve();
  orphans.forEach(function (o) {
    chain = chain.then(function () {
      var fullPath = rc.path + '/' + o.path;
      return ghGetRaw(rc, fullPath).then(function (file) {
        if (!file) { successPaths.add(o.path); return; }
        return ghDeleteRaw(rc, fullPath, file.sha, 'cleanup orphan ' + o.path).then(function () {
          successPaths.add(o.path);
        });
      }).catch(function (e) {
        failPaths.add(o.path);
        console.warn('[init] 删除孤儿图片失败', o.path, e);
      }).then(function () {
        return new Promise(function (r) { setTimeout(r, 250); });
      });
    });
  });
  chain.then(function () {
    try {
      var list = JSON.parse(localStorage.getItem(ORPHAN_KEY) || '[]');
      list = list.filter(function (x) { return !successPaths.has(x.path); });
      localStorage.setItem(ORPHAN_KEY, JSON.stringify(list));
    } catch (e) {}
    if (successPaths.size > 0) toast('✅ 已清理 ' + successPaths.size + ' 张孤儿图片');
    if (failPaths.size > 0) toast('⚠️ 还有 ' + failPaths.size + ' 张清理失败，下次启动再试');
  });
}

(function initApp() {
  try {
    try {
      var savedLayout = localStorage.getItem(LAYOUT_KEY);
      if (savedLayout === 'sidebar' || savedLayout === 'compact') layoutMode = savedLayout;
      var savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') themeMode = savedTheme;
      else themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {}

    applyLayout();
    setTheme(themeMode, false);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem(THEME_KEY)) setTheme(e.matches ? 'dark' : 'light', false);
    });

    loadSettings();

    if (!db._shardSnapshots) db._shardSnapshots = {};
    if (!db._trashSnapshot) db._trashSnapshot = '';
    if (!db._metaSnapshot) db._metaSnapshot = '';
    if (!db._allShardKeys) db._allShardKeys = [];
    if (!db._loadedShardKeys) db._loadedShardKeys = [];
    if (!db.tagColors) db.tagColors = {};
    if (typeof db.catVersion !== 'number') db.catVersion = 0;

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

      setTimeout(function () { try { checkExportReminder(); } catch (e) {} }, 3000);

      // ★ Bug F 修复：孤儿检查会先判断云端是否加载完，未完成自动延迟
      setTimeout(function () { try { checkOrphanImages(); } catch (e) { console.warn(e); } }, 5000);

      setTimeout(function () {
        if (typeof maybeCreateSnapshot === 'function') {
          maybeCreateSnapshot().catch(function (e) { console.warn('启动快照失败', e); });
        }
      }, 8000);

      var cfg = loadGH();
      var isOwner = !!(cfg.token && cfg.owner && cfg.repo);

      if (isOwner) {
        document.body.classList.remove('guest-mode');
        handleOwnerSync(cfg);
      } else {
        initGuestMode();
      }
    }).catch(function (err) {
      console.error('[init] 本地加载失败', err);
      try {
        render(); updateSourcePickerUI(); updateTagPickerUI(); renderPendingImgs();
      } catch (e) { console.error('[init] 渲染失败', e); }
    });

    setInterval(function () {
      try { if (typeof cleanTrash === 'function') cleanTrash(); } catch (e) {}
    }, 3600000);
  } catch (err) {
    console.error('[init] 初始化失败', err);
  }
})();

function handleOwnerSync(cfg) {
  if (!cfg.autoPull) { console.log('[init] 未开启自动拉取，跳过'); return; }
  var rc = ghRepoConfig('data');
  var dataDir = cfg.dataDir || db.settings.dataDir || 'material-library';
  var indexPath = dataDir + '/index.json';

  ghGetRaw(rc, indexPath).then(function (f) {
    if (!f) {
      if (db.items.length > 0) {
        console.log('[init] 云端未初始化分片，正在把本地 ' + db.items.length + ' 条素材推送上去...');
        toast('正在初始化云端分片...');
        ghPush(true).then(function (ok) {
          if (ok) { console.log('[init] ✅ 首次推送成功'); toast('✅ 云端分片初始化完成'); }
          else { console.warn('[init] ❌ 首次推送失败'); toast('❌ 云端分片初始化失败，请检查网络或配置'); }
        });
      } else { console.log('[init] 云端和本地都是空的'); }
    } else {
      var shouldPull = cfg.autoSync || db.items.length === 0;
      if (shouldPull) {
        console.log('[init] 云端有分片，开始拉取...');
        ghPull(true).then(function (ok) {
          if (ok) {
            console.log('[init] ✅ 自动拉取成功，共 ' + db.items.length + ' 条素材');
            setTimeout(function () { try { checkOrphanImages(); } catch (e) {} }, 1000);
          } else { console.warn('[init] ❌ 自动拉取失败'); }
        });
      } else { console.log('[init] 云端有分片，本地有数据，未开启自动拉取，跳过'); }
    }
  }).catch(function (e) {
    console.warn('[init] 检查云端状态失败:', e);
    var shouldPull = cfg.autoSync || db.items.length === 0;
    if (shouldPull) ghPull(true);
  });
}

function initGuestMode() {
  var style = document.createElement('style');
  style.innerHTML = 'body.guest-mode .composer { display: none !important; }'
    + 'body.guest-mode .ops { display: none !important; }'
    + 'body.guest-mode .card-check { display: none !important; }'
    + 'body.guest-mode #selectBtn, body.guest-mode #sidebarImportBtn, body.guest-mode #manageCatBtn, body.guest-mode #manageTagBtn, body.guest-mode .menu button:not(#menuRandomBtn):not(#menuStatsBtn):not(#menuDupBtn) { display: none !important; }'
    + 'body.guest-mode .nav-del-btn { display: none !important; }'
    + 'body.guest-mode .layout-btn, body.guest-mode #themeToggleBtn { display: none !important; }'
    + 'body.guest-mode #reviewBtn, body.guest-mode #pipBtn, body.guest-mode #focusBtn { display: none !important; }'
    + 'body.guest-mode.focus-mode .composer { display: none !important; }'
    + '@keyframes spin { 100% { transform: rotate(360deg); } }'
    + '.owner-unlock-tip { background: var(--accent-soft); color: var(--accent); padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border: 1px dashed var(--accent); }'
    + '.owner-unlock-btn { font-weight: bold; color: var(--accent); text-decoration: underline; cursor: pointer; }'
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
        if (gearBtns.length > 0) gearBtns[gearBtns.length - 1].click();
        else { var sm = document.getElementById('settingMask'); if (sm) sm.classList.add('show'); }
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
      if (!ok && db.items.length === 0) listEl.innerHTML = '<div class="empty"><p>加载云端数据失败，请检查网络或配置</p></div>';
    });
  }
}