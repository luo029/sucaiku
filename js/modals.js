/* js / modals.js · 所有的弹窗与隐藏元素，动态插入到页面底部 */
const modalsHtml = `
<div class="batch-bar" id="batchBar">
  <div class="batch-info">已选 <b id="batchNum">0</b> 条</div>
  <div class="batch-actions">
    <button class="btn" id="selectAllBtn">全选本页</button>
    <button class="btn" id="batchMoveBtn">移动分类</button>
    <button class="btn" id="batchTagBtn">加标签</button>
    <button class="btn" id="batchSourceBtn">设置来源</button>
    <button class="btn" id="batchExportBtn">导出</button>
    <button class="btn" id="batchExit">退出</button>
    <button class="btn danger-solid" id="batchDel">删除</button>
  </div>
</div>

<div class="modal-mask" id="modalMask">
  <div class="modal">
    <div class="modal-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></div>
    <h3 class="modal-title">删除素材</h3>
    <p class="modal-desc" id="modalDesc">确定要删除这条素材吗？删除后可在回收站恢复。</p>
    <label class="modal-check"><input type="checkbox" id="noRemind"><span>以后不再提醒</span></label>
    <div class="modal-actions"><button class="btn" id="modalCancel">取消</button><button class="btn danger-solid" id="modalConfirm">删除</button></div>
  </div>
</div>

<div class="modal-mask" id="exportMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
    <h3 class="modal-title">导出素材</h3>
    <p class="modal-desc">选择要导出的范围和格式。</p>
    <div class="export-field"><label class="export-label">导出范围</label><select id="exportScope"></select></div>
    <div class="export-field"><label class="export-label">导出格式</label>
      <div class="segmented" id="exportFormat">
        <button type="button" data-fmt="json" class="active">JSON 备份</button>
        <button type="button" data-fmt="txt">TXT</button>
        <button type="button" data-fmt="md">Markdown</button>
        <button type="button" data-fmt="csv">Excel (CSV)</button>
      </div>
    </div>
    <div class="modal-actions"><button class="btn" id="exportCancel">取消</button><button class="primary" id="exportConfirm">导出</button></div>
  </div>
</div>

<div class="modal-mask" id="randomMask">
  <div class="modal" style="max-width:480px; background:linear-gradient(180deg, var(--card) 0%, var(--bg) 100%); overflow:hidden;">
    <div class="modal-icon" style="background:var(--accent-soft);color:var(--accent);box-shadow:0 4px 12px var(--accent-soft);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; position:relative;">
      <h3 class="modal-title" style="margin:0;">盲盒灵感</h3>
      <button id="randomFilterBtn" class="btn" style="display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:13px; border-radius:8px; max-width:220px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span id="randomFilterText" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">全随机</span>
      </button>
      
      <div id="randomFilterPanel" class="source-panel" hidden style="position:absolute; top:calc(100% + 8px); right:0; width:260px; z-index:100;">
        <div class="sp-search-wrap"><input id="randomFilterSearch" placeholder="搜索分类、来源或标签…" autocomplete="off"></div>
        <div class="sp-list" id="randomFilterList" style="max-height:240px;"></div>
      </div>
    </div>

    <div id="randomContent" style="font-size:16px; line-height:1.8; height: 320px; overflow-y: auto; padding-right: 8px; position:relative;">
      <!-- 动态内容会插入到这里 -->
    </div>

    <!-- ★ 新增：自动翻动控制栏 -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
      <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-2);">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;">
          <input type="checkbox" id="randomAutoFlipCheck" style="accent-color:var(--accent); width:16px; height:16px; cursor:pointer;">
          自动翻动
        </label>
        <input type="number" id="randomAutoFlipTime" value="30" min="5" max="300" style="width:56px; padding:4px 6px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--text); text-align:center; outline:none;">
        <span>秒</span>
      </div>
      
      <div class="modal-actions" style="margin:0; width:auto;">
        <button class="btn" id="randomCloseBtn">关闭</button>
        <button class="primary" id="randomAgainBtn">再抽一次</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-mask" id="dupMask">
  <div class="modal" style="max-width:520px;">
    <div class="modal-icon" style="background:var(--accent-soft);color:var(--accent);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></div>
    <h3 class="modal-title">重复素材检测</h3>
    <p class="modal-desc">检测到相似度超过 50% 的素材，是否清理？</p>
    <div class="dup-list" id="dupList"></div>
    <div class="modal-actions" style="justify-content:flex-end;"><button class="btn" id="dupCloseBtn">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="settingMask">
  <div class="modal wide" style="max-width:600px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div class="modal-icon export-icon" style="margin-bottom:0;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </div>
      <div>
        <h3 class="modal-title" style="margin:0;">设置</h3>
        <p style="margin:2px 0 0;font-size:12.5px;color:var(--text-3);">所有配置仅保存在本机浏览器</p>
      </div>
    </div>
    <div class="st-scroll">
      <div id="settingTabs" style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--line); padding-bottom:12px; overflow-x:auto; scrollbar-width:none;">
        <button class="st-tab active" data-target="general" style="padding:6px 16px; border-radius:8px; font-weight:600; font-size:13.5px; color:var(--accent); background:var(--accent-soft); cursor:pointer; border:none; transition:all 0.15s; white-space:nowrap;">基础与编辑</button>
        <button class="st-tab" data-target="sync" style="padding:6px 16px; border-radius:8px; font-weight:500; font-size:13.5px; color:var(--text-2); background:transparent; cursor:pointer; border:none; transition:all 0.15s; white-space:nowrap;">云端同步</button>
        <button class="st-tab" data-target="images" style="padding:6px 16px; border-radius:8px; font-weight:500; font-size:13.5px; color:var(--text-2); background:transparent; cursor:pointer; border:none; transition:all 0.15s; white-space:nowrap;">图片处理</button>
      </div>
      
      <div class="st-card" data-group="general">
        <div class="st-card-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          <div><div class="st-card-title">数据概览</div><div class="st-card-desc">你当前素材库的实时数据</div></div>
        </div>
        <div class="st-card-body">
          <div id="settingsOverview" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
            <div class="ov-item">
              <div class="ov-num" style="color:var(--accent);" id="ovTotal">0</div>
              <div class="ov-label">总素材</div>
            </div>
            <div class="ov-item">
              <div class="ov-num" style="color:var(--text);" id="ovChars">0</div>
              <div class="ov-label">总字数</div>
            </div>
            <div class="ov-item">
              <div class="ov-num" style="color:var(--img-accent);" id="ovImgs">0</div>
              <div class="ov-label">图片数</div>
            </div>
            <div class="ov-item">
              <div class="ov-num" style="color:#059669;" id="ovTags">0</div>
              <div class="ov-label">标签数</div>
            </div>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <div><div class="st-card-title">编辑与列表</div><div class="st-card-desc">默认分类、长文折叠、分页与回收站</div></div>
        </div>
        <div class="st-card-body">
          <div class="st-field">
            <label>默认新建分类</label>
            <select id="defaultTypeSelect" style="width:100%; text-align:left; padding:10px 12px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--text); font-size:14px; outline:none;"></select>
            <div class="st-hint">新素材默认归入该分类</div>
          </div>
          <div class="st-grid-2" style="margin-top:16px;">
            <div class="st-field" style="margin-bottom:0;">
              <label>长文本折叠阈值</label>
              <div class="st-inline">
                <input type="number" class="setting-num" id="collapseLimitInput" min="50" max="9999" step="10" value="150" style="flex:1;">
                <span class="st-suffix">字</span>
              </div>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>默认每页显示条数</label>
              <select id="defaultPageSizeSelect" class="setting-num" style="width:100%; text-align:left; padding:9px 12px; flex:1;"><option value="12">12 条</option><option value="24">24 条</option><option value="48">48 条</option><option value="100">100 条</option></select>
            </div>
          </div>
          <!-- ★ 新增：回收站保留天数 -->
          <div class="st-field" style="margin-top:16px;">
            <label>回收站保留天数</label>
            <div class="st-inline">
              <input type="number" class="setting-num" id="trashTtlInput" min="1" max="365" step="1" value="30">
              <span class="st-suffix">天</span>
            </div>
            <div class="st-hint">删除的素材会保留指定天数，过期自动清理</div>
          </div>
          <!-- ★ 新增：复制时附带来源 -->
          <label class="st-toggle" style="margin-bottom:0;">
            <div><div class="st-toggle-title">复制时附带来源</div><div class="st-toggle-desc">复制素材内容时自动在末尾附上「—— 来源」</div></div>
            <input type="checkbox" id="copyWithSource">
          </label>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg><div><div class="st-card-title">外观与显示</div><div class="st-card-desc">主题、字号、时间显示格式</div></div></div>
        <div class="st-card-body">
          <label class="st-toggle" style="margin-bottom:12px;">
            <div><div class="st-toggle-title">夜间模式</div><div class="st-toggle-desc">切换深色/浅色主题</div></div>
            <input type="checkbox" id="themeDarkToggle">
          </label>
          <label class="st-toggle" style="margin-bottom:12px;">
            <div><div class="st-toggle-title">相对时间显示</div><div class="st-toggle-desc">如显示为“3 分钟前”、“昨天”</div></div>
            <input type="checkbox" id="useRelativeTimeToggle">
          </label>
          <label class="st-toggle" style="margin-bottom:12px;"><div><div class="st-toggle-title">显示一言（Hitokoto）</div><div class="st-toggle-desc">在页面顶部显示随机句子</div></div><input type="checkbox" id="showHitokoto"></label>
          <label class="st-toggle" style="margin-bottom:16px;"><div><div class="st-toggle-title">开启卡片动画</div><div class="st-toggle-desc">关闭可提升大量数据时的滚动性能</div></div><input type="checkbox" id="enableAnim"></label>
          
          <div class="st-field" style="margin-bottom:16px;">
            <label>保存快捷键</label>
            <div class="segmented" id="saveShortcut">
              <button type="button" data-shortcut="ctrl-enter">Ctrl + Enter 保存</button>
              <button type="button" data-shortcut="enter">Enter 保存</button>
            </div>
            <div class="st-hint">选择 Enter 保存时，需按 Shift+Enter 换行</div>
          </div>

          <div class="st-field" style="margin-bottom:16px;">
            <label>安心输入模式</label>
            <div style="display:flex; gap:10px;">
              <input type="text" id="focusModeCatInput" placeholder="收件箱" style="flex:1; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:14px; background:var(--bg); color:var(--text); outline:none;">
              <button class="btn primary" id="openFocusModeBtn" style="padding:0 20px; border-radius:8px;">进入模式</button>
            </div>
            <div class="st-hint">进入后隐藏所有列表，保存的素材默认归入上方填写的分类（如：收件箱、日志）。</div>
          </div>

          <div class="st-field" style="margin-bottom:16px;">
            <label>UI 风格</label>
            <div class="segmented" id="uiStyleMode">
              <!-- 这里的内容将由 JS 自动生成 -->
            </div>
            <div class="st-hint">切换界面的整体视觉风格</div>
          </div>

          <div class="st-field" style="margin-bottom:16px;">
            <label>全局字号缩放</label>
            <div class="segmented" id="fontSizeMode">
              <button type="button" data-size="normal">标准 A</button>
              <button type="button" data-size="large">大 A+</button>
              <button type="button" data-size="xlarge">特大 A++</button>
            </div>
          </div>

          <div class="st-field" style="margin-bottom:16px;">
            <label>极简模式字号</label>
            <div class="segmented" id="zenFontSize">
              <button type="button" data-zfs="normal">标准</button>
              <button type="button" data-zfs="large">大</button>
              <button type="button" data-zfs="xlarge">特大</button>
            </div>
            <div class="st-hint">极简模式下单独的字号调整，适合沉浸式阅读</div>
          </div>

          <div class="st-field">
            <label>卡片列表间距</label>
            <div class="segmented" id="cardSpacing">
              <button type="button" data-spacing="compact">紧凑</button>
              <button type="button" data-spacing="standard">标准</button>
              <button type="button" data-spacing="loose">宽松</button>
            </div>
            <div class="st-hint">调整卡片之间的留白</div>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><div><div class="st-card-title">侧栏设置</div><div class="st-card-desc">自定义侧栏显示内容与折叠数量</div></div></div>
        <div class="st-card-body">
          
          <label style="display:block; margin-bottom:10px; font-size:13px; font-weight:600; color:var(--text-2);">侧边栏内容显示</label>
          <div style="display:flex; gap:10px; margin-bottom:24px;">
            <label class="sidebar-toggle-item">
              <input type="checkbox" id="sidebarShowCat" checked style="display:none;">
              <span>分类</span>
            </label>
            <label class="sidebar-toggle-item">
              <input type="checkbox" id="sidebarShowSrc" checked style="display:none;">
              <span>来源</span>
            </label>
            <label class="sidebar-toggle-item">
              <input type="checkbox" id="sidebarShowTag" checked style="display:none;">
              <span>标签</span>
            </label>
          </div>

          <label style="display:block; margin-bottom:10px; font-size:13px; font-weight:600; color:var(--text-2);">折叠数量限制</label>
          <div style="display:flex; gap:10px;">
            <div style="flex:1; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:12px 8px; text-align:center;">
              <div style="font-size:12px; color:var(--text-3); margin-bottom:6px;">分类</div>
              <input type="number" id="catLimitInput" min="1" max="30" step="1" value="3" style="width:100%; text-align:center; padding:0; font-size:16px; font-weight:700; color:var(--accent); border:none; background:transparent; outline:none;">
            </div>
            <div style="flex:1; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:12px 8px; text-align:center;">
              <div style="font-size:12px; color:var(--text-3); margin-bottom:6px;">来源</div>
              <input type="number" id="srcLimitInput" min="1" max="30" step="1" value="3" style="width:100%; text-align:center; padding:0; font-size:16px; font-weight:700; color:var(--accent); border:none; background:transparent; outline:none;">
            </div>
            <div style="flex:1; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:12px 8px; text-align:center;">
              <div style="font-size:12px; color:var(--text-3); margin-bottom:6px;">标签</div>
              <input type="number" id="tagLimitInput" min="1" max="30" step="1" value="3" style="width:100%; text-align:center; padding:0; font-size:16px; font-weight:700; color:var(--accent); border:none; background:transparent; outline:none;">
            </div>
          </div>

        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><div><div class="st-card-title">统计</div><div class="st-card-desc">选择统计弹窗显示哪些分布图</div></div></div>
        <div class="st-card-body">
          <div class="st-chip-group"><label class="st-chip"><input type="checkbox" id="statDimCat" checked><span>按分类</span></label><label class="st-chip"><input type="checkbox" id="statDimSource" checked><span>按来源</span></label><label class="st-chip"><input type="checkbox" id="statDimTag" checked><span>按标签</span></label></div>
          <div class="st-field" style="margin-bottom:0;"><label>每组显示条数</label><div class="st-inline"><input type="number" class="setting-num" id="statLimitInput" min="3" max="30" step="1" value="8" style="flex:1;"><span class="st-suffix">条</span></div></div>
        </div>
      </div>

      <div class="st-card" data-group="sync" style="display:none;">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg><div><div class="st-card-title">主仓库 · 素材数据</div><div class="st-card-desc">存放素材 JSON 的 GitHub 仓库</div></div></div>
        <div class="st-card-body">
          <div class="st-field"><label>Fine-grained PAT</label><input type="password" id="ghToken" placeholder="github_pat_..." autocomplete="off"><div class="st-hint">需要 Contents: Read and write 权限</div></div>
          <div class="st-grid-2"><div class="st-field"><label>仓库所有者</label><input type="text" id="ghOwner" placeholder="your-username" autocomplete="off"></div><div class="st-field"><label>仓库名</label><input type="text" id="ghRepo" placeholder="material-library" autocomplete="off"></div></div>
          <div class="st-grid-2"><div class="st-field"><label>分支</label><input type="text" id="ghBranch" placeholder="main" autocomplete="off"></div><div class="st-field"><label>数据文件路径</label><input type="text" id="ghDataPath" placeholder="material-library.json" autocomplete="off"></div></div>
          <div class="st-field"><label>站点基础 URL（可选）</label><input type="text" id="ghSiteBase" placeholder="https://your-username.github.io/material-library" autocomplete="off"><div class="st-hint">仅用于显示；留空自动推断</div></div>
          <div class="st-toggle-row"><label class="st-toggle"><div><div class="st-toggle-title">保存后自动推送</div><div class="st-toggle-desc">任何增删改都会触发一次同步</div></div><input type="checkbox" id="ghAuto"></label></div>
          <div class="st-toggle-row"><label class="st-toggle"><div><div class="st-toggle-title">启动时自动拉取</div><div class="st-toggle-desc">刷新页面时，从云端获取最新数据</div></div><input type="checkbox" id="ghAutoPull" checked></label></div>
          
          <div class="st-grid-2" style="margin-top:16px;">
            <div class="st-field" style="margin-bottom:0;">
              <label>自动推送间隔</label>
              <div class="st-inline">
                <input type="number" class="setting-num" id="autoPushDelay" min="1" max="60" step="1" value="2">
                <span class="st-suffix">秒</span>
              </div>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>云端检查间隔</label>
              <div class="st-inline">
                <input type="number" class="setting-num" id="syncCheckIntervalInput" min="10" max="3600" step="10" value="60">
                <span class="st-suffix">秒</span>
              </div>
            </div>
          </div>
          <div class="st-hint" style="margin-bottom:12px;">停止操作指定时间后推送；闲置指定时间后检查云端更新（不低于10秒）</div>
          
          <div class="st-toggle-row">
            <label class="st-toggle">
              <div>
                <div class="st-toggle-title">开启云端更新巡检</div>
                <div class="st-toggle-desc">开启后，当其他设备更新时，会弹窗提醒你刷新</div>
              </div>
              <input type="checkbox" id="autoCheckUpdateToggle" checked>
            </label>
          </div>

          <div class="st-actions" style="display:flex; gap:8px; margin-top:16px;">
            <button class="btn" id="ghTestBtn">测试</button>
            <button class="btn" id="ghPullBtn">拉取</button>
            <button class="btn primary" id="ghPushBtn">推送</button>
          </div>
          <div class="st-actions" style="display:flex; gap:8px; margin-top:8px; margin-bottom:12px;">
            <button class="btn danger" id="ghForcePushBtn" style="flex:1; border-color:rgba(239,68,68,.3); background:var(--danger-soft); color:var(--danger); font-size:13px; padding:9px 10px;">强制覆盖云端</button>
          </div>
          <div class="st-status" id="ghStatus"></div>
        </div>
      </div>

      <div class="st-card" data-group="sync" style="display:none;">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div><div class="st-card-title">图片仓库（可选）</div><div class="st-card-desc">图片单独存一个仓库，避免主库膨胀</div></div></div>
        <div class="st-card-body">
          <div class="st-grid-2"><div class="st-field"><label>所有者</label><input type="text" id="ghImgOwner" placeholder="留空 = 主仓库" autocomplete="off"></div><div class="st-field"><label>仓库名</label><input type="text" id="ghImgRepo" placeholder="留空 = 主仓库" autocomplete="off"></div></div>
          <div class="st-grid-2"><div class="st-field"><label>分支</label><input type="text" id="ghImgBranch" placeholder="留空 = 主仓库分支" autocomplete="off"></div><div class="st-field"><label>图片目录</label><input type="text" id="ghImgPath" placeholder="images" autocomplete="off"></div></div>
          <div class="st-field"><label>图片访问 URL 前缀（可选）</label><input type="text" id="ghImgSite" placeholder="留空自动用 raw.githubusercontent.com" autocomplete="off"><div class="st-hint">公开仓库建议留空；私有仓库显示不出来时会自动用 API 兜底</div></div>
          <div class="st-field"><label>图片仓库 Token（可选）</label><input type="password" id="ghImgToken" placeholder="留空则使用主仓库 Token" autocomplete="off"><div class="st-hint">同一个 PAT 授权了多个仓库即可留空</div></div>
          <div class="st-status" id="ghImgStatus"></div>
        </div>
      </div>

      <div class="st-card" data-group="images" style="display:none;">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><div><div class="st-card-title">图片压缩</div><div class="st-card-desc">优先本地压缩（WebP）；TinyPNG 需代理</div></div></div>
        <div class="st-card-body">
          <div class="st-field"><label>压缩方式</label><div class="segmented" id="compressMode"><button type="button" data-mode="none">不压缩</button><button type="button" data-mode="local" class="active">本地压缩</button><button type="button" data-mode="tinypng">TinyPNG</button></div><div class="st-hint">本地压缩转 WebP 且限制尺寸；TinyPNG 需 API Key 和代理。</div></div>
          <div class="st-field" id="tinypngFields" style="display:none;"><label>TinyPNG API Key</label><input type="password" id="tinypngKey" placeholder="留空则使用本地压缩" autocomplete="off"><div class="st-hint">TinyPNG 会保持原格式并极高画质保留；浏览器直连会被 CORS 拦截，需填 Worker 代理。</div><label style="margin-top:10px;">TinyPNG 代理 URL</label><input type="text" id="tinypngProxy" placeholder="https://your-worker.workers.dev" autocomplete="off"></div>
          <div class="st-usage" id="tinyUsage">本月已用：0 次</div>
        </div>
      </div>

      <div class="st-card" data-group="images" style="display:none;">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><div><div class="st-card-title">图片分类</div><div class="st-card-desc">上传图片时可选的分类</div></div></div>
        <div class="st-card-body"><div class="st-field"><input type="text" id="imgCatsInput" placeholder="梗图, 情节, 插画, 其他" autocomplete="off"></div></div>
      </div>
    </div>

    <div class="modal-actions" style="margin-top:16px;"><button class="btn" id="settingCloseBtn">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="imgCatMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
    <h3 class="modal-title">选择图片分类</h3>
    <p class="modal-desc">共 <b id="imgCatCount">0</b> 张图片，选择分类后上传：</p>
    <div class="img-cat-list" id="imgCatList"></div>
    
    <div id="imgProgressWrap" style="display:none; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-3); margin-bottom:6px;">
        <span id="imgProgressText">准备中...</span>
        <span id="imgProgressPercent">0%</span>
      </div>
      <div style="height:6px; width:100%; background:var(--line); border-radius:3px; overflow:hidden;">
        <div id="imgProgressBar" style="height:100%; width:0%; background:var(--accent); transition:width 0.3s ease, background 0.3s;"></div>
      </div>
    </div>
    
    <div class="st-status" id="imgUploadStatus" style="margin-bottom:12px;"></div>
    <div class="modal-actions"><button class="btn" id="imgCatCancel">取消</button><button class="primary" id="imgCatConfirm">上传</button></div>
  </div>
</div>

<div class="img-view" id="imgView" hidden>
  <div class="img-view-head">
    <span class="ivh-title">图片浏览</span>
    <span class="ivh-count" id="imgViewCount">0</span>
    <div class="img-cat-tabs" id="imgCatTabs"></div>
    <span class="ivh-spacer"></span>
    <button class="btn" id="imgViewClose">关闭</button>
  </div>
  <div class="img-masonry-wrap"><div class="img-masonry" id="imgMasonry"></div></div>
</div>

<div class="img-view" id="imgManagerView" hidden>
  <div class="img-view-head" style="padding:16px 24px; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
    <div style="display:flex; align-items:center; gap:12px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--img-accent)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span class="ivh-title" style="font-size:18px;">图床仓库管理</span>
      <span class="ivh-count" id="imgMgrRepoName">-</span>
    </div>
    <span class="ivh-spacer"></span>
    <div style="display:flex; gap:8px;"><button class="btn" id="imgMgrRefreshBtn">刷新</button><button class="btn primary" id="imgMgrCloseBtn" style="padding:9px 20px;">返回素材库</button></div>
  </div>
  <div style="flex:1; overflow-y:auto; padding:24px; background:var(--bg);">
    <div id="imgMgrStatsPanel" style="display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap;"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
      <div class="segmented" id="imgMgrFilterTabs" style="width:auto; background:var(--card); border:1px solid var(--line);"><button class="active" data-filter="all">全部图片</button><button data-filter="unused">仅看未引用</button></div>
      <button class="btn danger" id="imgMgrCleanUnusedBtn" style="display:none;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-2px;"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>一键清理未引用图片</button>
    </div>
    <div id="imgMgrStatus" style="text-align:center; color:var(--text-3); font-size:13px; padding:40px;"></div>
    <div id="imgMgrGrid" class="img-mgr-grid"></div>
  </div>
</div>

<div class="modal-mask" id="tagManageMask">
  <div class="modal wide">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></div>
    <h3 class="modal-title">标签管理</h3>
    <p class="modal-desc">改名会自动合并到已有标签；回车或点击别处生效。</p>
    <div class="health-list" id="tagManageList"></div>
    <div class="modal-actions" style="justify-content:flex-end;"><button class="btn" id="tagManageCloseBtn">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="moveMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m9 13 3 3 3-3"/></svg></div>
    <h3 class="modal-title">移动到分类</h3>
    <p class="modal-desc">将选中的 <b id="moveCount">0</b> 条素材移动到：</p>
    <div class="export-field"><select id="moveCatSelect"></select></div>
    <div class="modal-actions"><button class="btn" id="moveCancel">取消</button><button class="primary" id="moveConfirm">移动</button></div>
  </div>
</div>

<div class="modal-mask" id="tagAddMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></div>
    <h3 class="modal-title">批量添加标签</h3>
    <p class="modal-desc">为选中的 <b id="tagAddCount">0</b> 条素材追加标签（逗号分隔）：</p>
    <div class="export-field"><input class="modal-input" id="tagAddInput" placeholder="如：金句, 爱情" autocomplete="off"></div>
    <div class="modal-actions"><button class="btn" id="tagAddCancel">取消</button><button class="primary" id="tagAddConfirm">添加</button></div>
  </div>
</div>

<div class="modal-mask" id="trashMask">
  <div class="modal wide">
    <div class="modal-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></div>
    <h3 class="modal-title">回收站</h3>
    <p class="modal-desc" id="trashDesc">删除的素材会保留 30 天，可随时恢复。</p>
    <div class="trash-list" id="trashList"></div>
    <div class="modal-actions"><button class="btn danger" id="trashClearBtn">清空回收站</button><button class="btn" id="trashCloseBtn">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="statsMask">
  <div class="modal wide">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
    <h3 class="modal-title">素材统计</h3>
    <div id="statsContent" style="max-height:60vh;overflow-y:auto;"></div>
    <div class="modal-actions" style="justify-content:flex-end;margin-top:16px;"><button class="btn" id="statsCloseBtn">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="healthMask">
  <div class="modal wide">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
    <h3 class="modal-title">数据健康检查</h3>
    <p class="modal-desc">点击条目可直接编辑。共 <b id="healthTotal">0</b> 条素材。</p>
    <div class="health-list" id="healthList"></div>
    <div class="modal-actions" style="justify-content:flex-end;"><button class="btn" id="healthCloseBtn">关闭</button></div>
  </div>
</div>

<input type="file" id="fileInput" accept=".json" hidden>
<div id="toast"></div>
`;

document.body.insertAdjacentHTML('beforeend', modalsHtml);