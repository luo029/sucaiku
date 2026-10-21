// js/review.js · 完整文件
// ★ Bug D 修复：批阅"准奏"后 600ms 内撤销 → 之前的 setTimeout 会跳过刚恢复的当前条。
//   改用 pendingNextTimer 保存 setTimeout id，撤销时 clearTimeout。
// ★ Bug E 修复：撤销"准奏"时回退 battleStats.chars，防止重复累加。
// ★ Bug J 修复：批阅界面图片加 loading="lazy"。

(function() {
  var reviewHTML = ''
    + '<div class="review-mask" id="reviewMask"><div class="review-paper" id="reviewPaper">'
    + '<div class="review-custom-overlay" id="rvCustomOverlay"><div class="review-custom-panel" id="rvCustomPanel">'
    + '<div class="rv-card"><div class="rv-set-title">🖋 御笔字号</div><div class="rv-set-options" id="rvSetSize"><button class="rv-opt-btn" data-size="24px">小楷</button><button class="rv-opt-btn active" data-size="28px">中楷</button><button class="rv-opt-btn" data-size="34px">大楷</button><button class="rv-opt-btn" data-size="42px">行草</button></div><div class="rv-set-title">📏 行间宽窄</div><div class="rv-set-options" id="rvSetLine"><button class="rv-opt-btn" data-line="1.6">紧凑</button><button class="rv-opt-btn active" data-line="1.8">适中</button><button class="rv-opt-btn" data-line="2.2">疏朗</button></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">📜 墨迹字体</div><div class="rv-set-options" id="rvSetFont"><button class="rv-opt-btn active" data-font="\'KaiTi\', \'STKaiti\', serif">楷体</button><button class="rv-opt-btn" data-font="\'SimSun\', \'Songti SC\', serif">宋体</button><button class="rv-opt-btn" data-font="\'Microsoft YaHei\', sans-serif">黑体</button></div><div class="rv-set-title">🎨 宣纸底色</div><div class="rv-set-options" id="rvSetTheme"><button class="rv-opt-btn active" data-theme="default">原色</button><button class="rv-opt-btn" data-theme="aged">发黄</button><button class="rv-opt-btn" data-theme="dark">墨黑</button></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">📐 卷轴陈设</div><div class="rv-set-options" id="rvSetLines"><button class="rv-opt-btn active" data-lines="show">带辅助线</button><button class="rv-opt-btn" data-lines="hide">无辅助线</button></div><div class="rv-set-options" id="rvSetWidth"><button class="rv-opt-btn" data-width="800px">窄卷</button><button class="rv-opt-btn active" data-width="1100px">标准</button><button class="rv-opt-btn" data-width="1400px">宽幅</button></div><div class="rv-set-options" id="rvSetPadding"><button class="rv-opt-btn" data-padding="16px">紧凑</button><button class="rv-opt-btn active" data-padding="24px">标准</button><button class="rv-opt-btn" data-padding="40px">留白</button></div><div class="rv-set-options" id="rvSetSidebar"><button class="rv-opt-btn active" data-sidebar="show">显示竹简</button><button class="rv-opt-btn" data-sidebar="hide">隐藏竹简</button></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">🖨 御印与画卷</div><div class="rv-set-options" id="rvSetPulse"><button class="rv-opt-btn" data-pulse="on">印章呼吸</button><button class="rv-opt-btn active" data-pulse="off">印章常亮</button></div><div class="rv-set-options" id="rvSetImgs"><button class="rv-opt-btn active" data-imgs="show">展示画卷</button><button class="rv-opt-btn" data-imgs="hide">隐藏画卷</button></div><div class="rv-set-title" style="margin-top:10px;">🔖 准奏印章</div><div class="rv-set-options" id="rvSetBtnText"><button class="rv-opt-btn active" data-text="准奏">准奏</button><button class="rv-opt-btn" data-text="已阅">已阅</button><button class="rv-opt-btn" data-text="阅">阅</button></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">👑 批阅辅助</div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvShowWordCount" style="accent-color:#b92b27;" checked><span>显示实时字数统计</span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvPreventAccident" style="accent-color:#b92b27;" checked><span>防误触（清空内容不直接销毁）</span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableUndo" style="accent-color:#b92b27;" checked><span>启用操作撤销</span></label></div><div class="rv-form-row" style="margin-top: 4px; padding-left: 24px;"><span class="rv-form-label" style="font-size:12.5px; color:var(--rv-text-3, #888);">撤销条停留</span><div class="rv-form-inputs"><input type="number" class="rv-set-input" id="rvUndoTime" value="5" min="1" max="30" style="width:50px;"><span style="font-size:13px;">秒</span></div></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableSound" style="accent-color:#b92b27;" checked><span>启用环境音效（盖章/翻书）</span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableAnim" style="accent-color:#b92b27;" checked><span>卷轴翻页过渡动画</span></label></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">✨ 进阶玩法</div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableNumberKeys" style="accent-color:#b92b27;" checked><span>数字键快捷选择分类<br><small style="color:#888;font-weight:normal;">Alt+数字 选分类，Shift+Alt+数字 选标签</small></span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableTitle" style="accent-color:#b92b27;" checked><span>战报显示"御赐封号"</span></label></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">📊 战报与统计</div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvRecordHistory" style="accent-color:#b92b27;" checked><span>记录每日批阅历史</span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvShowBattleStats" style="accent-color:#b92b27;" checked><span>展示批阅战报统计</span></label></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvShowTime" style="accent-color:#b92b27;" checked><span>显示单次批阅耗时</span></label></div><div class="rv-form-row"><span class="rv-form-label">历史统计范围：</span><select class="rv-set-select" id="rvStatsRange"><option value="week">近七日</option><option value="month">近一月</option><option value="year">近一年</option><option value="none">不显示历史</option></select></div></div>'
    + '<div class="rv-card"><div class="rv-set-title">⌨ 快捷键设置</div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvEnableShortcuts" style="accent-color:#b92b27;" checked><span>启用快捷键</span></label><label class="rv-form-label" style="flex:0 0 auto;"><input type="checkbox" id="rvShowShortcutHint" style="accent-color:#b92b27;" checked><span>显示提示</span></label></div><div class="rv-form-row"><span class="rv-form-label">准奏：</span><select class="rv-set-select" id="rvShortcutApprove"><option value="">无 (不启用)</option><option value="ctrl-enter">Ctrl+Enter</option><option value="alt-enter">Alt+Enter</option><option value="enter">Enter</option></select></div><div class="rv-form-row"><span class="rv-form-label">留中：</span><select class="rv-set-select" id="rvShortcutSkip"><option value="">无 (不启用)</option><option value="alt-right">Alt+→</option><option value="ctrl-right">Ctrl+→</option><option value="right">→</option></select></div><div class="rv-form-row"><span class="rv-form-label">焚毁：</span><select class="rv-set-select" id="rvShortcutDel"><option value="">无 (不启用)</option><option value="alt-delete">Alt+Delete</option><option value="ctrl-delete">Ctrl+Delete</option><option value="delete">Delete</option></select></div></div>'
    + '<div class="rv-card" style="grid-column: 1 / -1;"><div class="rv-set-title">⏱ 代批（自动批阅）</div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvAutoApprove" style="accent-color:#b92b27;"><span>开启无操作代批</span></label><div class="rv-form-inputs"><span style="font-size:13px;">闲置</span><input type="number" class="rv-set-input" id="rvAutoTime" value="15" min="3" max="120"><span style="font-size:13px;">秒后准奏</span></div></div><div class="rv-form-row"><label class="rv-form-label"><input type="checkbox" id="rvShowCountdown" style="accent-color:#b92b27;" checked><span>右下角显示古风倒计时</span></label><div class="rv-form-inputs"><span style="font-size:13px;">提前</span><input type="number" class="rv-set-input" id="rvCdStartShow" value="5" min="1" max="120"><span style="font-size:13px;">秒才出现</span></div></div><div class="rv-form-row"><span class="rv-form-label" style="color:#8e7962;">倒计时视觉参数</span><div class="rv-form-inputs"><span style="font-size:13px;">字号</span><input type="number" class="rv-set-input" id="rvCdSize" value="80" min="40" max="150"><span style="font-size:13px;">像素 | 透明</span><input type="number" class="rv-set-input" id="rvCdOpacity" value="15" min="5" max="100"><span style="font-size:13px;">%</span></div></div><div class="rv-form-row" style="margin-top:10px; border-top:1px dashed #d4a59a; padding-top:14px;"><label class="rv-form-label"><input type="checkbox" id="rvAutoClose" style="accent-color:#b92b27;"><span>阅毕自动关闭</span></label><div class="rv-form-inputs"><span style="font-size:13px;">停留</span><input type="number" class="rv-set-input" id="rvAutoCloseTime" value="3" min="1" max="30"><span style="font-size:13px;">秒</span></div></div></div>'
    + '</div></div>'
    + '<div class="review-completed" id="rvCompleted" style="display:none;"><div class="big-seal">已批阅</div><div class="comp-text">启奏陛下，今日奏折已御批完毕。</div><div class="rv-title-badge" id="rvTitleBadge" style="display:none;"></div><div class="battle-card" id="rvBattleCard"><div class="battle-main-stats" id="rvBattleReport"></div><div class="battle-history-stats" id="rvHistoryStats"></div></div><button class="btn-exit" id="rvExitBtn">退 朝</button></div>'
    + '<div class="review-main">'
    + '<div class="review-header"><div class="review-title">今日奏折 <span class="review-stamp" id="rvStamp">御览</span><button class="review-settings-btn" id="rvSettingsBtn">⚙ 陈设</button></div><div class="review-progress"><span id="reviewProgress">剩 0 条</span><button class="review-close-btn" id="rvCloseBtn" title="退出批阅 (Esc)">✕</button></div></div>'
    + '<div class="review-body" id="rvBody"><textarea class="review-textarea" id="reviewText" placeholder="在此写下批注..."></textarea><div class="review-imgs" id="reviewImgs"></div><div class="rv-countdown" id="rvCountdown"></div><div class="rv-corner-stamp" id="rvCornerStamp">准奏</div><div class="rv-word-count" id="rvWordCount"></div><div class="rv-shortcut-hint" id="rvShortcutHint"></div></div>'
    + '<div class="review-footer"><button class="review-btn undo-btn" id="rvUndoBtn">撤销</button><button class="review-btn skip" id="rvSkipBtn">留中</button><button class="review-btn del" id="rvDelBtn">焚毁</button><button class="review-btn approve" id="rvApproveBtn">准奏</button></div>'
    + '</div>'
    + '<div class="review-sidebar" id="rvSidebar"><div class="review-col"><div class="review-col-title">落款</div><button class="review-search-btn" data-search="source" title="搜索或新建">🔍</button><div class="review-opt-list" id="listSource"></div></div><div class="review-col"><div class="review-col-title">朱批</div><button class="review-search-btn" data-search="tag" title="搜索或新建">🔍</button><div class="review-opt-list" id="listTag"></div></div><div class="review-col"><div class="review-col-title">分门</div><button class="review-search-btn" data-search="cat" title="搜索或新建">🔍</button><div class="review-opt-list" id="listCat"></div></div></div>'
    + '</div></div>';

  document.body.insertAdjacentHTML('beforeend', reviewHTML);

  var reviewQueue = [];
  var reviewCurrentId = null;
  var currentTags = new Set();
  var currentCat = '';
  var currentSource = '';
  var activeSearchType = null;
  var reviewStartTime = Date.now();
  var isStatsSaved = false;

  var rvStyle = db.settings.reviewStyle || {
    size: '28px', line: '1.8', theme: 'default', lines: 'show',
    font: "'KaiTi', 'STKaiti', serif", pulse: 'off', imgs: 'show',
    autoApprove: false, autoTime: 15, showCountdown: true,
    cdStartShow: 5, cdSize: 80, cdOpacity: 15,
    autoClose: false, autoCloseTime: 3,
    width: '1100px', padding: '24px', sidebar: 'show', btnText: '准奏',
    showWordCount: true, preventAccident: true, enableUndo: true, undoTime: 5,
    enableSound: true, enableAnim: true, showShortcutHint: true, enableShortcuts: true,
    shortcutApprove: 'ctrl-enter', shortcutSkip: 'alt-right', shortcutDel: 'alt-delete',
    recordHistory: true, showBattleStats: true, showTime: true, statsRange: 'week',
    enableNumberKeys: true, enableTitle: true
  };

  // ★ Bug D：保存 approve 后跳下一条的 setTimeout id，撤销时可以取消
  var pendingNextTimer = null;

  var autoApproveInterval = null, autoCloseTimer = null, undoTimer = null, undoCountdownInterval = null;
  var undoData = null;
  var battleStats = { approved: 0, skipped: 0, deleted: 0, chars: 0, tags: new Set() };
  var isProcessingAction = false;

  var cnNums = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','二十一','二十二','二十三','二十四','二十五','二十六','二十七','二十八','二十九','三十','三十一','三十二','三十三','三十四','三十五','三十六','三十七','三十八','三十九','四十','四十一','四十二','四十三','四十四','四十五','四十六','四十七','四十八','四十九','五十','五十一','五十二','五十三','五十四','五十五','五十六','五十七','五十八','五十九','六十','六十一','六十二','六十三','六十四','六十五','六十六','六十七','六十八','六十九','七十','七十一','七十二','七十三','七十四','七十五','七十六','七十七','七十八','七十九','八十','八十一','八十二','八十三','八十四','八十五','八十六','八十七','八十八','八十九','九十','九十一','九十二','九十三','九十四','九十五','九十六','九十七','九十八','九十九','一百'];

  var audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playSound(type) {
    if (!rvStyle.enableSound) return;
    try {
      initAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      var now = audioCtx.currentTime;
      if (type === 'stamp') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'page') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now); osc.stop(now + 0.08);
      } else if (type === 'tear') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      }
    } catch (e) { console.warn('Audio error', e); }
  }

  function updateWordCount() {
    var text = document.getElementById('reviewText').value || '';
    var count = text.replace(/\s/g, '').length;
    document.getElementById('rvWordCount').textContent = (rvStyle.showWordCount && count > 0) ? '计 ' + count + ' 字' : '';
  }
  function updateShortcutHint() {
    if (!rvStyle.enableShortcuts || !rvStyle.showShortcutHint) { document.getElementById('rvShortcutHint').textContent = ''; return; }
    var map = { 'ctrl-enter': 'Ctrl+Enter', 'alt-enter': 'Alt+Enter', 'enter': 'Enter' };
    var hint = map[rvStyle.shortcutApprove] || '';
    document.getElementById('rvShortcutHint').textContent = hint ? '快捷键：' + hint + ' 准奏' : '';
  }

  function resetAutoApproveTimer() {
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    var countdownEl = document.getElementById('rvCountdown');
    countdownEl.style.display = 'none';
    if (rvStyle.autoApprove && reviewCurrentId && !isProcessingAction) {
      var timeLeft = rvStyle.autoTime || 15;
      if (rvStyle.showCountdown && timeLeft <= rvStyle.cdStartShow) {
        countdownEl.style.display = 'block';
        countdownEl.textContent = cnNums[timeLeft] || timeLeft;
      }
      autoApproveInterval = setInterval(function () {
        timeLeft--;
        if (timeLeft > 0) {
          if (rvStyle.showCountdown && timeLeft <= rvStyle.cdStartShow) {
            countdownEl.style.display = 'block';
            countdownEl.textContent = cnNums[timeLeft] || timeLeft;
          }
        } else {
          clearInterval(autoApproveInterval);
          countdownEl.style.display = 'none';
          var approveBtn = document.getElementById('rvApproveBtn');
          if (approveBtn && document.getElementById('reviewMask').classList.contains('show')) approveBtn.click();
        }
      }, 1000);
    }
  }

  var _lastMouseReset = 0;
  document.getElementById('reviewMask').addEventListener('mousemove', function () {
    var now = Date.now();
    if (now - _lastMouseReset < 200) return;
    _lastMouseReset = now;
    resetAutoApproveTimer();
  });
  document.getElementById('reviewMask').addEventListener('keydown', resetAutoApproveTimer);
  document.getElementById('reviewText').addEventListener('input', function () { resetAutoApproveTimer(); updateWordCount(); });

  document.getElementById('reviewImgs').addEventListener('click', function (e) {
    var img = e.target.closest('img[data-review-img]');
    if (!img) return;
    var url = img.getAttribute('data-review-img') || '';
    if (/^(https?:|data:image\/|blob:)/i.test(url)) window.open(url, '_blank', 'noopener');
  });

  document.addEventListener('keydown', function (e) {
    if (!rvStyle.enableNumberKeys || !document.getElementById('reviewMask').classList.contains('show')) return;
    var num = parseInt(e.key, 10);
    if (isNaN(num) || num < 1 || num > 9) return;
    if (e.altKey && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); var ic = document.querySelectorAll('#listCat .review-pill'); if (ic[num - 1]) ic[num - 1].click(); }
    else if (e.shiftKey && e.altKey && !e.ctrlKey) { e.preventDefault(); var it = document.querySelectorAll('#listTag .review-pill'); if (it[num - 1]) it[num - 1].click(); }
  });

  document.getElementById('reviewText').addEventListener('keydown', function (e) {
    if (!rvStyle.enableShortcuts || isProcessingAction) return;
    var isApprove = rvStyle.shortcutApprove && (
      (rvStyle.shortcutApprove === 'ctrl-enter' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') ||
      (rvStyle.shortcutApprove === 'alt-enter' && e.altKey && e.key === 'Enter') ||
      (rvStyle.shortcutApprove === 'enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'Enter')
    );
    if (isApprove) { e.preventDefault(); document.getElementById('rvApproveBtn').click(); return; }
    var isSkip = rvStyle.shortcutSkip && (
      (rvStyle.shortcutSkip === 'ctrl-right' && (e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') ||
      (rvStyle.shortcutSkip === 'alt-right' && e.altKey && e.key === 'ArrowRight') ||
      (rvStyle.shortcutSkip === 'right' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowRight')
    );
    if (isSkip) { e.preventDefault(); document.getElementById('rvSkipBtn').click(); return; }
    var isDel = rvStyle.shortcutDel && (
      (rvStyle.shortcutDel === 'ctrl-delete' && (e.ctrlKey || e.metaKey) && e.key === 'Delete') ||
      (rvStyle.shortcutDel === 'alt-delete' && e.altKey && e.key === 'Delete') ||
      (rvStyle.shortcutDel === 'delete' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'Delete')
    );
    if (isDel) { e.preventDefault(); document.getElementById('rvDelBtn').click(); return; }
  });

  function applyReviewStyle() {
    var paper = document.getElementById('reviewPaper');
    var textarea = document.getElementById('reviewText');
    var imgWrap = document.getElementById('reviewImgs');
    var stamp = document.getElementById('rvStamp');
    var sidebar = document.getElementById('rvSidebar');
    var stampCorner = document.getElementById('rvCornerStamp');
    var clearActives = function (id) { document.querySelectorAll('#' + id + ' .rv-opt-btn').forEach(function (b) { b.classList.remove('active'); }); };
    ['rvSetSize','rvSetLine','rvSetFont','rvSetTheme','rvSetLines','rvSetWidth','rvSetPadding','rvSetSidebar','rvSetPulse','rvSetImgs','rvSetBtnText'].forEach(clearActives);
    var el;
    if ((el = document.querySelector('#rvSetSize [data-size="' + rvStyle.size + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetLine [data-line="' + rvStyle.line + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetFont [data-font="' + rvStyle.font + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetTheme [data-theme="' + rvStyle.theme + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetLines [data-lines="' + rvStyle.lines + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetWidth [data-width="' + rvStyle.width + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetPadding [data-padding="' + rvStyle.padding + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetSidebar [data-sidebar="' + rvStyle.sidebar + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetPulse [data-pulse="' + rvStyle.pulse + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetImgs [data-imgs="' + rvStyle.imgs + '"]'))) el.classList.add('active');
    if ((el = document.querySelector('#rvSetBtnText [data-text="' + rvStyle.btnText + '"]'))) el.classList.add('active');

    document.getElementById('rvAutoApprove').checked = !!rvStyle.autoApprove;
    document.getElementById('rvAutoTime').value = rvStyle.autoTime || 15;
    document.getElementById('rvShowCountdown').checked = rvStyle.showCountdown !== false;
    document.getElementById('rvCdStartShow').value = rvStyle.cdStartShow || 5;
    document.getElementById('rvCdSize').value = rvStyle.cdSize || 80;
    document.getElementById('rvCdOpacity').value = rvStyle.cdOpacity || 15;
    document.getElementById('rvAutoClose').checked = !!rvStyle.autoClose;
    document.getElementById('rvAutoCloseTime').value = rvStyle.autoCloseTime || 3;
    document.getElementById('rvShowWordCount').checked = rvStyle.showWordCount !== false;
    document.getElementById('rvPreventAccident').checked = rvStyle.preventAccident !== false;
    document.getElementById('rvEnableUndo').checked = rvStyle.enableUndo !== false;
    document.getElementById('rvUndoTime').value = rvStyle.undoTime || 5;
    document.getElementById('rvEnableSound').checked = rvStyle.enableSound !== false;
    document.getElementById('rvEnableAnim').checked = rvStyle.enableAnim !== false;
    document.getElementById('rvShowShortcutHint').checked = rvStyle.showShortcutHint !== false;
    document.getElementById('rvEnableShortcuts').checked = rvStyle.enableShortcuts !== false;
    document.getElementById('rvEnableNumberKeys').checked = rvStyle.enableNumberKeys !== false;
    document.getElementById('rvEnableTitle').checked = rvStyle.enableTitle !== false;
    document.getElementById('rvRecordHistory').checked = rvStyle.recordHistory !== false;
    document.getElementById('rvShowBattleStats').checked = rvStyle.showBattleStats !== false;
    document.getElementById('rvShowTime').checked = rvStyle.showTime !== false;
    document.getElementById('rvStatsRange').value = rvStyle.statsRange || 'week';
    document.getElementById('rvShortcutApprove').value = rvStyle.shortcutApprove !== undefined ? rvStyle.shortcutApprove : 'ctrl-enter';
    document.getElementById('rvShortcutSkip').value = rvStyle.shortcutSkip !== undefined ? rvStyle.shortcutSkip : 'alt-right';
    document.getElementById('rvShortcutDel').value = rvStyle.shortcutDel !== undefined ? rvStyle.shortcutDel : 'alt-delete';
    var isDisabled = !rvStyle.enableShortcuts;
    ['rvShortcutApprove', 'rvShortcutSkip', 'rvShortcutDel'].forEach(function (id) { document.getElementById(id).disabled = isDisabled; document.getElementById(id).style.opacity = isDisabled ? '0.5' : '1'; });

    paper.style.setProperty('--rv-max-width', rvStyle.width);
    paper.style.setProperty('--rv-padding', rvStyle.padding);
    paper.style.setProperty('--rv-font-size', rvStyle.size);
    paper.style.setProperty('--rv-font', rvStyle.font);
    paper.style.setProperty('--rv-cd-size', (rvStyle.cdSize || 80) + 'px');
    paper.style.setProperty('--rv-cd-opacity', (rvStyle.cdOpacity || 15) / 100);
    var sizePx = parseInt(rvStyle.size, 10);
    var lineMultiplier = parseFloat(rvStyle.line);
    paper.style.setProperty('--rv-line-height', Math.round(sizePx * lineMultiplier) + 'px');
    paper.classList.remove('theme-dark', 'theme-aged');
    if (rvStyle.theme === 'dark') paper.classList.add('theme-dark');
    if (rvStyle.theme === 'aged') paper.classList.add('theme-aged');
    textarea.classList.toggle('hide-lines', rvStyle.lines === 'hide');
    imgWrap.classList.toggle('hide-imgs', rvStyle.imgs === 'hide');
    stamp.classList.toggle('pulse', rvStyle.pulse === 'on');
    sidebar.classList.toggle('hidden', rvStyle.sidebar === 'hide');
    document.getElementById('rvApproveBtn').textContent = rvStyle.btnText;
    stampCorner.textContent = rvStyle.btnText;
    updateWordCount();
    updateShortcutHint();
    db.settings.reviewStyle = rvStyle;
    if (typeof save === 'function') save();
    resetAutoApproveTimer();
  }

  document.getElementById('rvSettingsBtn').addEventListener('click', function (e) { e.stopPropagation(); document.getElementById('rvCustomOverlay').classList.add('show'); });
  document.getElementById('rvCustomOverlay').addEventListener('click', function (e) { if (e.target === document.getElementById('rvCustomOverlay')) document.getElementById('rvCustomOverlay').classList.remove('show'); });

  document.getElementById('rvCustomPanel').addEventListener('click', function (e) {
    var btn = e.target.closest('.rv-opt-btn'); if (!btn) return;
    if (btn.dataset.size) rvStyle.size = btn.dataset.size;
    if (btn.dataset.line) rvStyle.line = btn.dataset.line;
    if (btn.dataset.font) rvStyle.font = btn.dataset.font;
    if (btn.dataset.theme) rvStyle.theme = btn.dataset.theme;
    if (btn.dataset.lines) rvStyle.lines = btn.dataset.lines;
    if (btn.dataset.width) rvStyle.width = btn.dataset.width;
    if (btn.dataset.padding) rvStyle.padding = btn.dataset.padding;
    if (btn.dataset.sidebar) rvStyle.sidebar = btn.dataset.sidebar;
    if (btn.dataset.pulse) rvStyle.pulse = btn.dataset.pulse;
    if (btn.dataset.imgs) rvStyle.imgs = btn.dataset.imgs;
    if (btn.dataset.text) rvStyle.btnText = btn.dataset.text;
    applyReviewStyle();
  });

  var bindCheckbox = function (id, prop) {
    document.getElementById(id).addEventListener('change', function (e) { rvStyle[prop] = e.target.checked; applyReviewStyle(); });
  };
  bindCheckbox('rvAutoApprove', 'autoApprove');
  bindCheckbox('rvShowCountdown', 'showCountdown');
  bindCheckbox('rvAutoClose', 'autoClose');
  bindCheckbox('rvShowWordCount', 'showWordCount');
  bindCheckbox('rvPreventAccident', 'preventAccident');
  bindCheckbox('rvEnableUndo', 'enableUndo');
  bindCheckbox('rvEnableSound', 'enableSound');
  bindCheckbox('rvEnableAnim', 'enableAnim');
  bindCheckbox('rvShowShortcutHint', 'showShortcutHint');
  bindCheckbox('rvEnableShortcuts', 'enableShortcuts');
  bindCheckbox('rvRecordHistory', 'recordHistory');
  bindCheckbox('rvShowBattleStats', 'showBattleStats');
  bindCheckbox('rvShowTime', 'showTime');
  bindCheckbox('rvEnableNumberKeys', 'enableNumberKeys');
  bindCheckbox('rvEnableTitle', 'enableTitle');

  var bindNumInput = function (id, prop, defVal) {
    document.getElementById(id).addEventListener('change', function (e) { var v = parseInt(e.target.value, 10) || defVal; e.target.value = v; rvStyle[prop] = v; applyReviewStyle(); });
  };
  bindNumInput('rvAutoTime', 'autoTime', 15);
  bindNumInput('rvCdStartShow', 'cdStartShow', 5);
  bindNumInput('rvCdSize', 'cdSize', 80);
  bindNumInput('rvCdOpacity', 'cdOpacity', 15);
  bindNumInput('rvAutoCloseTime', 'autoCloseTime', 3);
  bindNumInput('rvUndoTime', 'undoTime', 5);

  var bindSelect = function (id, prop) {
    document.getElementById(id).addEventListener('change', function (e) { rvStyle[prop] = e.target.value; applyReviewStyle(); });
  };
  bindSelect('rvShortcutApprove', 'shortcutApprove');
  bindSelect('rvShortcutSkip', 'shortcutSkip');
  bindSelect('rvShortcutDel', 'shortcutDel');
  bindSelect('rvStatsRange', 'statsRange');

  setTimeout(applyReviewStyle, 100);

  function getTodayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function getYesterdayStr() { var d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function finalizeBattle() {
    var durationSec = Math.round((Date.now() - reviewStartTime) / 1000);
    var todayCount = 0, yesterdayCount = 0, rangeCount = 0;
    if (rvStyle.recordHistory) {
      var todayStr = getTodayStr();
      var yesterdayStr = getYesterdayStr();
      var history = JSON.parse(localStorage.getItem('review-history') || '{}');
      if (!history[todayStr]) history[todayStr] = { count: 0, time: 0 };
      var totalProcessed = battleStats.approved + battleStats.skipped + battleStats.deleted;
      history[todayStr].count += totalProcessed;
      history[todayStr].time += durationSec;
      localStorage.setItem('review-history', JSON.stringify(history));
      todayCount = history[todayStr].count;
      yesterdayCount = history[yesterdayStr] ? history[yesterdayStr].count : 0;
      var now = new Date();
      var daysToCheck = rvStyle.statsRange === 'month' ? 30 : (rvStyle.statsRange === 'year' ? 365 : 7);
      if (rvStyle.statsRange !== 'none') {
        for (var i = 0; i < daysToCheck; i++) {
          var d = new Date(now);
          d.setDate(d.getDate() - i);
          var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          if (history[ds]) rangeCount += history[ds].count;
        }
      }
    }
    return { durationSec: durationSec, todayCount: todayCount, yesterdayCount: yesterdayCount, rangeCount: rangeCount };
  }

  function getImperialTitle() {
    var total = battleStats.approved + battleStats.skipped + battleStats.deleted;
    var approvedRate = total > 0 ? battleStats.approved / total : 0;
    var avgSec = total > 0 ? (Date.now() - reviewStartTime) / 1000 / total : 0;
    if (total >= 50) return '勤政明君';
    if (battleStats.deleted >= 10 && battleStats.deleted / total > 0.8) return '铁面无私';
    if (battleStats.chars >= 1000) return '才高八斗';
    if (avgSec < 3 && total > 5) return '一目十行';
    if (approvedRate === 1 && total > 5) return '从善如流';
    if (battleStats.tags.size >= 5) return '博学多闻';
    if (total > 0 && approvedRate === 0) return '从长计议';
    if (total > 0) return '今日事今日毕';
    return '天下太平';
  }

  function loadReviewItem(isUndo) {
    var completedScreen = document.getElementById('rvCompleted');
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    isProcessingAction = false;

    if (!reviewCurrentId) {
      completedScreen.style.display = 'flex';
      document.getElementById('reviewProgress').textContent = '剩 0 条';
      if (typeof updateReviewBtnState === 'function') updateReviewBtnState();
      if (typeof render === 'function') render();
      var stats = { durationSec: 0, todayCount: 0, yesterdayCount: 0, rangeCount: 0 };
      var history = JSON.parse(localStorage.getItem('review-history') || '{}');
      var todayStr = getTodayStr();
      if (!isStatsSaved && battleStats.approved + battleStats.skipped + battleStats.deleted > 0) { stats = finalizeBattle(); isStatsSaved = true; }
      else {
        stats.durationSec = Math.round((Date.now() - reviewStartTime) / 1000);
        stats.todayCount = history[todayStr] ? history[todayStr].count : 0;
        stats.yesterdayCount = history[getYesterdayStr()] ? history[getYesterdayStr()].count : 0;
        var nowD = new Date();
        var daysToCheck = rvStyle.statsRange === 'month' ? 30 : (rvStyle.statsRange === 'year' ? 365 : 7);
        if (rvStyle.statsRange !== 'none') {
          for (var i = 0; i < daysToCheck; i++) {
            var d = new Date(nowD);
            d.setDate(d.getDate() - i);
            var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (history[ds]) stats.rangeCount += history[ds].count;
          }
        }
      }
      var titleBadge = document.getElementById('rvTitleBadge');
      if (rvStyle.enableTitle) { titleBadge.style.display = 'inline-block'; titleBadge.textContent = getImperialTitle(); }
      else titleBadge.style.display = 'none';
      var tagStr = battleStats.tags.size > 0 ? Array.from(battleStats.tags).join('、') : '无';
      document.getElementById('rvBattleReport').innerHTML = '<div>御览奏折 <span class="hl-red">' + (battleStats.approved + battleStats.skipped + battleStats.deleted) + '</span> 件</div><div>准奏 <span class="hl-red">' + battleStats.approved + '</span> 件，留中 <span class="hl-red">' + battleStats.skipped + '</span> 件，焚毁 <span class="hl-red">' + battleStats.deleted + '</span> 件</div><div>御笔亲批 <span class="hl-red">' + battleStats.chars + '</span> 字</div><div>新添朱批：' + tagStr + '</div>';
      var historyEl = document.getElementById('rvHistoryStats');
      var battleCardEl = document.getElementById('rvBattleCard');
      var hasHistory = false;
      if (rvStyle.showBattleStats) {
        historyEl.style.display = 'flex';
        var diff = stats.todayCount - stats.yesterdayCount;
        var diffStr = '持平';
        if (diff > 0) diffStr = '多 <span class="hl-red">' + diff + '</span> 件';
        else if (diff < 0) diffStr = '少 <span class="hl-red">' + Math.abs(diff) + '</span> 件';
        var timeStr = stats.durationSec > 60 ? '<span class="hl-red">' + Math.floor(stats.durationSec / 60) + '</span>分<span class="hl-red">' + (stats.durationSec % 60) + '</span>秒' : '<span class="hl-red">' + stats.durationSec + '</span>秒';
        var rangeName = rvStyle.statsRange === 'month' ? '近一月' : (rvStyle.statsRange === 'year' ? '近一年' : '近七日');
        var html = '';
        if (rvStyle.showTime) html += '<div class="battle-history-row"><span>⏳ 耗费光阴</span> <span>' + timeStr + '</span></div>';
        html += '<div class="battle-history-row"><span>📜 今日总览</span> <span><span class="hl-red">' + stats.todayCount + '</span> 件 <span style="font-size:12px;font-weight:normal">（较昨日' + diffStr + '）</span></span></div>';
        if (rvStyle.statsRange !== 'none') html += '<div class="battle-history-row"><span>📅 ' + rangeName + '</span> <span>累计 <span class="hl-red">' + stats.rangeCount + '</span> 件</span></div>';
        historyEl.innerHTML = html;
        hasHistory = true;
      } else { historyEl.style.display = 'none'; historyEl.innerHTML = ''; }
      if (hasHistory) battleCardEl.classList.add('split-layout'); else battleCardEl.classList.remove('split-layout');
      if (rvStyle.autoClose) autoCloseTimer = setTimeout(function () { closeReview(); }, (rvStyle.autoCloseTime || 3) * 1000);
      return;
    } else completedScreen.style.display = 'none';

    var item = db.items.find(function (i) { return i.id === reviewCurrentId; });
    if (!item) { reviewNext(); return; }
    document.getElementById('reviewProgress').textContent = '剩 ' + reviewQueue.length + ' 条';
    document.getElementById('reviewText').value = item.text || '';
    updateWordCount();
    currentCat = db.settings.reviewFixedCat || item.type;
    var tagsSet = new Set(item.tags || []);
    if (db.settings.reviewFixedTags && db.settings.reviewFixedTags.length) db.settings.reviewFixedTags.forEach(function (t) { tagsSet.add(t); });
    currentTags = tagsSet;
    currentSource = db.settings.reviewFixedSource || item.source || (db.fixedSource || '');
    document.getElementById('rvCornerStamp').classList.remove('active');
    var rvBody = document.getElementById('rvBody'); if (rvBody) rvBody.scrollTop = 0;
    activeSearchType = null;
    var imgWrap = document.getElementById('reviewImgs');
    if (item.images && item.images.length) {
      // ★ Bug J 修复：图片加 loading="lazy"，避免一次加载大量图片卡顿
      imgWrap.innerHTML = item.images.map(function (im) { var src = typeof imageSrc === 'function' ? imageSrc(im) : im.url; return '<img src="' + esc(src) + '" loading="lazy" data-review-img="' + esc(src) + '" data-img-path="' + esc(im.path || '') + '" title="点击查看原图">'; }).join('');
    } else imgWrap.innerHTML = '';
    renderAllPanels();
    document.getElementById('reviewText').focus();
    resetAutoApproveTimer();
    if (rvStyle.enableAnim && !isUndo) { rvBody.classList.remove('rv-anim-in'); void rvBody.offsetWidth; rvBody.classList.add('rv-anim-in'); }
  }

  function triggerUndoToast(message, actionType) {
    var undoBtn = document.getElementById('rvUndoBtn');
    if (!rvStyle.enableUndo) { undoBtn.style.display = 'none'; return; }
    var item;
    if (actionType === 'delete') item = db.trash.find(function (i) { return i.id === reviewCurrentId; });
    else item = db.items.find(function (i) { return i.id === reviewCurrentId; });
    if (!item) return;
    undoData = { item: JSON.parse(JSON.stringify(item)), index: reviewQueue.indexOf(reviewCurrentId), action: actionType, message: message };

    // ★ Bug E 修复：如果是准奏操作，记录本次保存的字数，撤销时回退
    if (actionType === 'approve') {
      undoData.charsAdded = item.text ? item.text.replace(/\s/g, '').length : 0;
    }

    undoBtn.style.display = 'block';
    var timeLeft = rvStyle.undoTime || 5;
    undoBtn.textContent = message + ' · 撤销(' + timeLeft + 's)';
    if (undoTimer) clearTimeout(undoTimer);
    if (undoCountdownInterval) clearInterval(undoCountdownInterval);
    undoCountdownInterval = setInterval(function () {
      timeLeft--;
      if (timeLeft > 0) undoBtn.textContent = message + ' · 撤销(' + timeLeft + 's)';
      else clearInterval(undoCountdownInterval);
    }, 1000);
    undoTimer = setTimeout(function () { undoBtn.style.display = 'none'; undoData = null; clearInterval(undoCountdownInterval); }, timeLeft * 1000);
  }

  document.getElementById('rvUndoBtn').addEventListener('click', function () {
    if (!undoData) return;

    // ★ Bug D 修复：取消 pendingNextTimer，防止刚恢复的当前条被 setTimeout 跳走
    if (pendingNextTimer) { clearTimeout(pendingNextTimer); pendingNextTimer = null; }

    var item = undoData.item;
    var index = undoData.index;
    var action = undoData.action;
    if (action === 'delete') {
      var tIdx = db.trash.findIndex(function (i) { return i.id === item.id; });
      if (tIdx >= 0) db.trash.splice(tIdx, 1);
      db.items.push(item);
      markItemDirty(item); _indexAddItem(item);
    } else {
      var existIdx = db.items.findIndex(function (i) { return i.id === item.id; });
      if (existIdx >= 0) {
        var oldCopy = JSON.parse(JSON.stringify(db.items[existIdx]));
        db.items[existIdx] = item;
        markItemDirty(item); _indexUpdateItem(oldCopy, item);
      } else { db.items.push(item); markItemDirty(item); _indexAddItem(item); }
    }
    if (typeof save === 'function') save();
    reviewQueue.splice(index, 0, item.id);
    reviewCurrentId = item.id;
    document.getElementById('rvUndoBtn').style.display = 'none';

    // ★ Bug E 修复：撤销准奏时回退字数
    if (action === 'approve') {
      battleStats.approved--;
      if (undoData.charsAdded) battleStats.chars -= undoData.charsAdded;
    }
    if (action === 'skip') battleStats.skipped--;
    if (action === 'delete') battleStats.deleted--;

    undoData = null;
    if (undoTimer) clearTimeout(undoTimer);
    if (undoCountdownInterval) clearInterval(undoCountdownInterval);
    loadReviewItem(true);
  });

  function showCornerStamp() {
    var corner = document.getElementById('rvCornerStamp');
    corner.classList.remove('active');
    void corner.offsetWidth;
    corner.classList.add('active');
  }

  function reviewNext() {
    if (pendingNextTimer) { clearTimeout(pendingNextTimer); pendingNextTimer = null; }
    if (reviewQueue.length > 0) reviewQueue.shift();
    reviewCurrentId = reviewQueue.length > 0 ? reviewQueue[0] : null;
    loadReviewItem();
  }

  function saveCurrent() {
    if (!reviewCurrentId) return false;
    var item = db.items.find(function (i) { return i.id === reviewCurrentId; });
    if (!item) return false;
    var newText = document.getElementById('reviewText').value.trim();
    var hasText = newText.length > 0;
    var hasImgs = item.images && item.images.length > 0;
    
    if (!hasText && !hasImgs) {
      if (rvStyle.preventAccident) { if (window.toast) toast('内容已被清空，请点击【焚毁】来销毁，或按 Ctrl+Z 撤销'); return false; }
      else return true;
    }
    var oldCopy = JSON.parse(JSON.stringify(item));
    item.text = newText;
    item.type = currentCat || '未分类';
    item.tags = Array.from(currentTags);
    item.source = currentSource;
    if (currentSource && db.sources.indexOf(currentSource) < 0) db.sources.push(currentSource);
    item.updatedAt = Date.now();
    markItemDirty(item);
    _indexUpdateItem(oldCopy, item);
    battleStats.chars += newText.replace(/\s/g, '').length;
    item.tags.forEach(function (t) { battleStats.tags.add(t); });
    if (typeof save === 'function') save();
    return true;
  }

  document.getElementById('rvSkipBtn').addEventListener('click', function () {
    if (isProcessingAction) return;
    isProcessingAction = true;
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    playSound('page');
    battleStats.skipped++;
    triggerUndoToast('已留中', 'skip');
    reviewNext();
  });

  document.getElementById('rvDelBtn').addEventListener('click', function () {
    if (isProcessingAction) return;
    isProcessingAction = true;
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    playSound('tear');
    if (!reviewCurrentId) { isProcessingAction = false; return; }
    battleStats.deleted++;
    moveToTrash([reviewCurrentId]);
    if (typeof save === 'function') save();
    triggerUndoToast('已焚毁', 'delete');
    reviewNext();
  });

  document.getElementById('rvApproveBtn').addEventListener('click', function () {
    if (isProcessingAction) return;
    isProcessingAction = true;
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    if (!reviewCurrentId) { isProcessingAction = false; return; }
    var saved = saveCurrent();
    if (saved === false) { isProcessingAction = false; return; }
    playSound('stamp');
    showCornerStamp();
    battleStats.approved++;
    triggerUndoToast('已准奏', 'approve');
    // ★ Bug D 修复：保存 setTimeout id，撤销时可以取消
    pendingNextTimer = setTimeout(function () { pendingNextTimer = null; reviewNext(); }, 600);
  });

  function closeReview() {
    document.getElementById('reviewMask').classList.remove('show');
    reviewQueue = [];
    reviewCurrentId = null;
    isProcessingAction = false;
    if (pendingNextTimer) { clearTimeout(pendingNextTimer); pendingNextTimer = null; }
    if (autoApproveInterval) clearInterval(autoApproveInterval);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    if (undoTimer) clearTimeout(undoTimer);
    if (undoCountdownInterval) clearInterval(undoCountdownInterval);
    document.getElementById('rvUndoBtn').style.display = 'none';
    if (typeof updateReviewBtnState === 'function') updateReviewBtnState();
  }

  document.getElementById('rvExitBtn').addEventListener('click', closeReview);
  document.getElementById('rvCloseBtn').addEventListener('click', closeReview);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('reviewMask').classList.contains('show')) {
      if (document.querySelector('.review-search-overlay')) closeSearchPopup();
      else if (document.getElementById('rvCustomOverlay').classList.contains('show')) document.getElementById('rvCustomOverlay').classList.remove('show');
      else closeReview();
    }
  });

  function renderAllPanels() {
    renderColumn('listCat', getCatPool(), db.settings.reviewFixedCat, currentCat, 'cat');
    renderColumn('listTag', getTagPool(), db.settings.reviewFixedTags, Array.from(currentTags), 'tag');
    renderColumn('listSource', getSourcePool(), db.settings.reviewFixedSource, currentSource, 'source');
  }
  function getCatPool() { var cats = db.cats.slice(); if (cats.indexOf('收件箱') < 0) cats.push('收件箱'); return cats; }
  function getTagPool() { var counts = collectTags(); return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }); }
  function getSourcePool() { return db.sources.slice(); }

  function renderColumn(containerId, allItems, fixedItem, currentVal, type) {
    var wrap = document.getElementById(containerId);
    var display = [], base = [];
    if (type === 'tag') {
      if (fixedItem) base.push.apply(base, fixedItem);
      if (currentVal) base.push.apply(base, Array.isArray(currentVal) ? currentVal : [currentVal]);
    } else {
      if (fixedItem) base.push(fixedItem);
      if (currentVal) base.push(currentVal);
    }
    display = Array.from(new Set(base.filter(function (t) { return t && t.trim(); })));
    if (display.length < 5) {
      for (var i = 0; i < allItems.length; i++) {
        if (display.length >= 6) break;
        if (display.indexOf(allItems[i]) < 0) display.push(allItems[i]);
      }
    }
    wrap.innerHTML = display.map(function (t) {
      var isActive = Array.isArray(currentVal) ? currentVal.indexOf(t) >= 0 : t === currentVal;
      var isPinned = type === 'tag' ? (fixedItem || []).indexOf(t) >= 0 : fixedItem === t;
      return '<div class="review-pill ' + (isActive ? 'active' : '') + '" data-val="' + esc(t) + '" data-type="' + type + '"><span>' + esc(t) + '</span><span class="review-pill-pin ' + (isPinned ? 'pinned' : '') + '" data-pin="' + esc(t) + '" data-type="' + type + '">📌</span></div>';
    }).join('');
  }

  var currentSearchOverlay = null;
  function openSearch(type) {
    closeSearchPopup();
    activeSearchType = type;
    var overlay = document.createElement('div');
    overlay.className = 'review-search-overlay';
    overlay.innerHTML = '<div class="review-search-modal"><input type="text" id="rvSearchInput" placeholder="输入以搜索，回车新建..." autocomplete="off"><div class="rv-search-results" id="rvSearchResults"></div></div>';
    document.body.appendChild(overlay);
    currentSearchOverlay = overlay;
    var input = document.getElementById('rvSearchInput');
    var resultsWrap = document.getElementById('rvSearchResults');
    input.focus();
    function updateResults() {
      var q = input.value.trim();
      var pool = type === 'cat' ? getCatPool() : type === 'tag' ? getTagPool() : getSourcePool();
      if (q) pool = pool.filter(function (t) { return t.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
      var html = '';
      if (q && pool.indexOf(q) < 0) html += '<div class="rv-search-item new" data-val="' + esc(q) + '" data-new="1">新建：「' + esc(q) + '」</div>';
      html += pool.map(function (t) { return '<div class="rv-search-item" data-val="' + esc(t) + '">' + esc(t) + '</div>'; }).join('');
      if (!html) html = '<div style="color:#888; text-align:center; padding:10px;">无结果</div>';
      resultsWrap.innerHTML = html;
    }
    updateResults();
    input.addEventListener('input', updateResults);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearchPopup();
      if (e.key === 'Enter') { e.preventDefault(); var val = input.value.trim(); if (val) { applyValue(type, val, true); closeSearchPopup(); } }
    });
    resultsWrap.addEventListener('click', function (e) {
      var item = e.target.closest('.rv-search-item'); if (!item) return;
      applyValue(type, item.dataset.val, item.dataset.new === '1');
      closeSearchPopup();
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSearchPopup(); });
  }
  function closeSearchPopup() {
    activeSearchType = null;
    if (currentSearchOverlay) { currentSearchOverlay.remove(); currentSearchOverlay = null; }
    renderAllPanels();
  }

  document.querySelectorAll('.review-search-btn').forEach(function (btn) { btn.addEventListener('click', function () { openSearch(btn.dataset.search); }); });

  document.querySelector('.review-sidebar').addEventListener('click', function (e) {
    var pin = e.target.closest('.review-pill-pin');
    if (pin) {
      e.stopPropagation();
      var type = pin.dataset.type, val = pin.dataset.pin;
      if (type === 'cat') {
        db.settings.reviewFixedCat = (db.settings.reviewFixedCat === val) ? null : val;
        if (db.settings.reviewFixedCat) currentCat = val;
        else if (currentCat === val) currentCat = '';
      } else if (type === 'source') {
        db.settings.reviewFixedSource = (db.settings.reviewFixedSource === val) ? null : val;
        if (db.settings.reviewFixedSource) currentSource = val;
        else if (currentSource === val) currentSource = '';
      } else if (type === 'tag') {
        if (!db.settings.reviewFixedTags) db.settings.reviewFixedTags = [];
        var idx = db.settings.reviewFixedTags.indexOf(val);
        if (idx >= 0) { db.settings.reviewFixedTags.splice(idx, 1); currentTags.delete(val); }
        else { db.settings.reviewFixedTags.push(val); currentTags.add(val); }
      }
      if (typeof save === 'function') save();
      renderAllPanels();
      return;
    }
    var pill = e.target.closest('.review-pill');
    if (pill) {
      var ptype = pill.dataset.type, pval = pill.dataset.val;
      if (ptype === 'cat' && currentCat === pval) currentCat = '';
      else if (ptype === 'source' && currentSource === pval) currentSource = '';
      else applyValue(ptype, pval, false);
      renderAllPanels();
    }
  });

  function applyValue(type, val, shouldPin) {
    if (type === 'cat') {
      currentCat = val;
      if (db.cats.indexOf(val) < 0) db.cats.push(val);
      if (shouldPin) db.settings.reviewFixedCat = val;
    } else if (type === 'tag') {
      if (currentTags.has(val)) { if (!shouldPin) currentTags.delete(val); } else currentTags.add(val);
      if (shouldPin && db.settings.reviewFixedTags.indexOf(val) < 0) db.settings.reviewFixedTags.push(val);
    } else if (type === 'source') {
      currentSource = val;
      if (db.sources.indexOf(val) < 0) db.sources.push(val);
      if (shouldPin) db.settings.reviewFixedSource = val;
    }
    if (typeof save === 'function') save();
  }

  window.startReview = function () {
    var focusCat = (db.settings && db.settings.focusModeCat) || '收件箱';
    var items = db.items.filter(function (i) { return i.type === focusCat; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
    battleStats = { approved: 0, skipped: 0, deleted: 0, chars: 0, tags: new Set() };
    reviewStartTime = Date.now();
    isStatsSaved = false;
    isProcessingAction = false;
    if (pendingNextTimer) { clearTimeout(pendingNextTimer); pendingNextTimer = null; }
    document.getElementById('rvUndoBtn').style.display = 'none';
    if (!items.length) { reviewQueue = []; reviewCurrentId = null; document.getElementById('reviewMask').classList.add('show'); loadReviewItem(); return; }
    reviewQueue = items.map(function (i) { return i.id; });
    reviewCurrentId = reviewQueue[0];
    document.getElementById('reviewMask').classList.add('show');
    loadReviewItem();
  };

  window.updateReviewBtnState = function () {
    var focusCat = (db.settings && db.settings.focusModeCat) || '收件箱';
    var count = db.items.filter(function (i) { return i.type === focusCat; }).length;
    var btn = document.getElementById('reviewBtn');
    if (!btn) return;
    if (count > 0) { btn.classList.add('has-items'); btn.title = '待批奏折 (' + count + ' 条)'; }
    else { btn.classList.remove('has-items'); btn.title = '待批奏折 (空)'; }
  };

  var btn = document.getElementById('reviewBtn');
  if (btn) btn.addEventListener('click', window.startReview);

  if (typeof window.render === 'function' && !window._reviewRenderHooked) {
    var _oldRender = window.render;
    window.render = function () { _oldRender(); window.updateReviewBtnState(); };
    window._reviewRenderHooked = true;
  }
  setTimeout(window.updateReviewBtnState, 600);
})();