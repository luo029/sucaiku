/* js / modals.js · 所有的弹窗与隐藏元素，动态插入到页面底部 */
const modalsHtml = `
<!-- 批量操作栏 -->
<div class="batch-bar" id="batchBar">
  <div class="batch-info">
    已选 <b id="batchNum">0</b> 条
  </div>
  <div class="batch-actions">
    <div class="batch-group">
      <button class="batch-btn" id="selectAllBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        全选本页
      </button>
    </div>

    <div class="batch-divider"></div>

    <div class="batch-group">
      <button class="batch-btn" id="batchMoveBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        移动分类
      </button>
      <button class="batch-btn" id="batchTagBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        加标签
      </button>
      <button class="batch-btn" id="batchSourceBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        设置来源
      </button>
      <button class="batch-btn" id="batchExportBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导出选中
      </button>
    </div>

    <div class="batch-divider"></div>

    <div class="batch-group">
      <button class="batch-btn danger" id="batchDel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        删除
      </button>
      <button class="batch-btn cancel" id="batchExit">退出</button>
    </div>
  </div>
</div>

<!-- 图床批量操作栏 -->
<div class="batch-bar" id="imgMgrBatchBar" style="top: 80px; bottom: auto; background: rgba(30, 58, 138, 0.9); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.15);">
  <div class="batch-info">图片已选 <b id="imgMgrBatchNum" style="color:#93c5fd;">0</b> 张</div>
  <div class="batch-actions">
    <div class="batch-group">
      <button class="batch-btn" id="imgMgrSelectAllBtn">全选本页</button>
      <button class="batch-btn" id="imgMgrBatchCatBtn">修改分类</button>
      <button class="batch-btn" id="imgMgrBatchTagBtn">修改标签</button>
    </div>
    <div class="batch-divider"></div>
    <div class="batch-group">
      <button class="batch-btn danger" id="imgMgrBatchDelBtn" style="background:#ef4444; color:#fff; border-color:#dc2626;">彻底删除</button>
      <button class="batch-btn cancel" id="imgMgrBatchExit">退出</button>
    </div>
  </div>
</div>

<!-- 图床批量修改弹窗 -->
<div class="modal-mask" id="imgMgrBatchEditMask" style="z-index: 210;">
  <div class="modal" style="max-width:420px; border-radius:16px; padding:24px;">
    <div class="modal-icon export-icon" style="width:44px;height:44px;margin-bottom:12px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></div>
    <h3 class="modal-title" id="imgMgrBatchEditTitle" style="font-size:18px;">批量修改</h3>
    <p class="modal-desc" style="margin-bottom:20px; font-size:13.5px;">正在为选中的 <b id="imgMgrBatchEditCount">0</b> 张图片修改：</p>
    
    <div id="imgMgrBatchCatWrap" class="export-field">
      <label class="export-label">目标分类</label>
      <div id="imgMgrBatchCatGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap:8px; margin-top:8px;"></div>
    </div>
    
    <div id="imgMgrBatchTagWrap" class="export-field" style="display:none;">
      <div style="margin-bottom:16px;">
        <label class="export-label" style="margin-bottom:6px;">当前标签（点击 × 移除）</label>
        <div id="imgMgrBatchSelectedTags" style="display:flex; flex-wrap:wrap; gap:6px; padding:10px; background:var(--bg); border-radius:10px; border:1px solid var(--line); min-height:42px; align-content:flex-start;"></div>
      </div>
      <div style="margin-bottom:12px;">
        <label class="export-label" style="margin-bottom:6px;">添加标签</label>
        <div style="display:flex; gap:8px;">
          <input class="modal-input" id="imgMgrBatchTagNewInput" placeholder="直接输入新标签（逗号分隔）" autocomplete="off" style="flex:1;">
          <button class="btn" id="imgMgrBatchTagAddBtn" style="padding:0 16px; border-radius:8px; white-space:nowrap; font-size:13px;">添加</button>
          <button class="btn" id="imgMgrBatchTagSearchBtn" style="padding:0 12px; border-radius:8px; white-space:nowrap; display:flex; align-items:center;" title="从已有标签中选择">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </button>
        </div>
      </div>
      <div id="imgMgrBatchTagPoolWrap" style="display:none; margin-top:10px;">
        <input class="modal-input" id="imgMgrBatchTagSearch" placeholder="搜索现有标签..." style="margin-bottom:10px; font-size:13px; padding:8px 12px;" autocomplete="off">
        <div id="imgMgrBatchTagPool" style="display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; padding:4px;"></div>
      </div>
    </div>

    <div class="modal-actions" style="margin-top:20px; gap:10px;">
      <button class="btn" id="imgMgrBatchEditCancel">取消</button>
      <button class="primary" id="imgMgrBatchEditConfirm" style="border-radius:8px;">确认修改</button>
    </div>
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
      <div style="display:flex; gap:8px; align-items:center;">
        <button id="randomFontSizeBtn" class="btn" style="display:flex; align-items:center; justify-content:center; padding:6px 10px; font-size:13px; font-weight:700; border-radius:8px; min-width:36px;" title="切换字号">Aa</button>
        <button id="randomAutoFlipToggleBtn" class="btn" style="display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:13px; border-radius:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85 1 6.54 2.66L21 8"/><path d="M21 3v5h-5"/></svg>
          <span>自动翻动</span>
        </button>
        <button id="randomFilterBtn" class="btn" style="display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:13px; border-radius:8px; max-width:150px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span id="randomFilterText" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">全随机</span>
        </button>
      </div>
      
      <div id="randomFilterPanel" class="source-panel" hidden style="position:absolute; top:calc(100% + 8px); right:0; width:260px; z-index:100;">
        <div class="sp-search-wrap"><input id="randomFilterSearch" placeholder="搜索分类、来源或标签…" autocomplete="off"></div>
        <div class="sp-list" id="randomFilterList" style="max-height:240px;"></div>
      </div>

      <div id="randomAutoFlipPanel" class="source-panel" hidden style="position:absolute; top:calc(100% + 8px); right:0; width:220px; z-index:100; padding:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <span style="font-size:14px; font-weight:600; color:var(--text);">开启自动翻动</span>
          <label class="st-toggle" style="margin:0; padding:0; border:none; background:transparent; width:auto;">
            <input type="checkbox" id="randomAutoFlipCheck" style="width:40px; height:22px; margin:0;">
          </label>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:13px; color:var(--text-3); white-space:nowrap;">间隔</span>
          <input type="number" id="randomAutoFlipTime" value="30" min="5" max="300" style="flex:1; border:1px solid var(--line); border-radius:6px; padding:6px; background:var(--bg); color:var(--text); text-align:center; outline:none; font-size:13px;">
          <span style="font-size:13px; color:var(--text-3);">秒</span>
        </div>
      </div>
    </div>
    <div id="randomContent" style="font-size:20px; line-height:1.8; height: 320px; overflow-y: auto; padding: 16px 8px; position:relative; display:flex; flex-direction:column; align-items:center; text-align:center;"></div>
    <div style="display:flex; justify-content:center; gap:12px; margin-top:16px;">
      <button class="btn" id="randomCloseBtn" style="min-width:100px;">关闭</button>
      <button class="primary" id="randomAgainBtn" style="min-width:100px;">再抽一次</button>
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
        <button class="st-tab active" data-target="general">基础与编辑</button>
        <button class="st-tab" data-target="sync">云端同步</button>
        <button class="st-tab" data-target="images">图片处理</button>
      </div>
      
      <div class="st-card" data-group="general">
        <div class="st-card-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          <div><div class="st-card-title">数据概览</div><div class="st-card-desc">你当前素材库的实时数据</div></div>
        </div>
        <div class="st-card-body">
          <div id="settingsOverview" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap:10px;">
            <div class="ov-item"><div class="ov-num" style="color:var(--accent);" id="ovTotal">0</div><div class="ov-label">总素材</div></div>
            <div class="ov-item"><div class="ov-num" style="color:var(--text);" id="ovChars">0</div><div class="ov-label">总字数</div></div>
            <div class="ov-item"><div class="ov-num" style="color:var(--img-accent);" id="ovImgs">0</div><div class="ov-label">图片数</div></div>
            <div class="ov-item"><div class="ov-num" style="color:#059669;" id="ovTags">0</div><div class="ov-label">标签数</div></div>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <div><div class="st-card-title">编辑与列表</div><div class="st-card-desc">默认分类、长文折叠、分页与复制格式</div></div>
        </div>
        <div class="st-card-body">
          <div class="st-grid-2">
            <div class="st-field" style="margin-bottom:0;">
              <label>默认新建分类</label>
              <select id="defaultTypeSelect" class="page-size" style="width:100%; text-align:left; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--text); font-size:13.5px; outline:none;"></select>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>默认每页显示条数</label>
              <select id="defaultPageSizeSelect" class="page-size" style="width:100%; text-align:left; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--text); font-size:13.5px; outline:none;">
                <option value="12">12 条</option><option value="24">24 条</option><option value="48">48 条</option><option value="100">100 条</option>
              </select>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>长文本折叠阈值</label>
              <div class="st-inline"><input type="number" class="setting-num" id="collapseLimitInput" min="50" max="9999" step="10" value="150" style="width:100%;"><span class="st-suffix">字</span></div>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>回收站保留天数</label>
              <div class="st-inline"><input type="number" class="setting-num" id="trashTtlInput" min="1" max="365" step="1" value="30" style="width:100%;"><span class="st-suffix">天</span></div>
            </div>
          </div>
          <div style="height: 1px; background: var(--line); margin: 16px 0;"></div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <label class="st-toggle">
              <div><div class="st-toggle-title">复制时自动去除标记符号</div><div class="st-toggle-desc">将【】 ** == 等符号去掉，只留纯文本</div></div>
              <input type="checkbox" id="copyWithoutMarks">
            </label>
            <label class="st-toggle">
              <div><div class="st-toggle-title">复制时保留空行（原汁原味）</div><div class="st-toggle-desc">如果关闭，则会压缩多余空行和首尾空行</div></div>
              <input type="checkbox" id="copyKeepBlankLines">
            </label>
            <label class="st-toggle">
              <div><div class="st-toggle-title">复制时附带自定义后缀</div><div class="st-toggle-desc">复制素材内容时自动在末尾追加文字</div></div>
              <input type="checkbox" id="copyWithSource">
            </label>
            <div id="copySourceFormatWrap" style="display: none; padding: 4px 0 0;">
              <label style="font-size: 12.5px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; display: block;">自定义后缀格式</label>
              <input type="text" id="copySourceFormat" placeholder="—— {source}" style="width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; color: var(--text); background: var(--bg); outline: none;">
              <div class="st-hint">可用 <code>{source}</code> 代表原来源。例如输入 <code>—— 摘抄</code>，或者 <code>（摘自：{source}）</code></div>
            </div>
            <div style="height: 1px; background: var(--line); margin: 6px 0;"></div>
            <label class="st-toggle">
              <div><div class="st-toggle-title">启用 Markdown 语法</div><div class="st-toggle-desc">输入 **文字** 显示为加粗，【文字】显示为高亮</div></div>
              <input type="checkbox" id="enableMarkdown">
            </label>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg><div><div class="st-card-title">外观与显示</div><div class="st-card-desc">主题、字号、时间显示格式</div></div></div>
        <div class="st-card-body">
          <div class="st-grid-2" style="margin-bottom:16px;">
            <label class="st-toggle" style="margin-bottom:0;"><div><div class="st-toggle-title">夜间模式</div></div><input type="checkbox" id="themeDarkToggle"></label>
            <label class="st-toggle" style="margin-bottom:0;"><div><div class="st-toggle-title">相对时间</div></div><input type="checkbox" id="useRelativeTimeToggle"></label>
            <label class="st-toggle" style="margin-bottom:0;"><div><div class="st-toggle-title">显示一言</div></div><input type="checkbox" id="showHitokoto"></label>
            <label class="st-toggle" style="margin-bottom:0;"><div><div class="st-toggle-title">卡片动画</div></div><input type="checkbox" id="enableAnim"></label>
          </div>
          <div class="st-field" style="margin-bottom:16px;">
            <label>保存快捷键</label>
            <div class="segmented" id="saveShortcut">
              <button type="button" data-shortcut="ctrl-enter">Ctrl + Enter 保存</button>
              <button type="button" data-shortcut="enter">Enter 保存</button>
            </div>
          </div>
          <div class="st-field" style="margin-bottom:16px;">
            <label>安心输入模式分类</label>
            <div style="display:flex; gap:10px;">
              <input type="text" id="focusModeCatInput" placeholder="收件箱" style="flex:1; border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-size:13.5px; background:var(--bg); color:var(--text); outline:none;">
              <button class="btn primary" id="openFocusModeBtn" style="padding:0 20px; border-radius:10px; white-space:nowrap; font-size:13px;">进入模式</button>
            </div>
            <div class="st-hint">此分类下的素材编辑保存后，会自动跳转处理下一条（无需进入模式也可生效）。</div>
          </div>
          <div class="st-field" style="margin-bottom:16px;">
            <label>UI 风格</label>
            <div class="segmented" id="uiStyleMode"></div>
          </div>
          <div class="st-grid-2" style="margin-bottom:16px;">
            <div class="st-field" style="margin-bottom:0;">
              <label>全局字号</label>
              <div class="segmented" id="fontSizeMode">
                <button type="button" data-size="normal">标准</button>
                <button type="button" data-size="large">大</button>
                <button type="button" data-size="xlarge">特大</button>
              </div>
            </div>
            <div class="st-field" style="margin-bottom:0;">
              <label>极简字号</label>
              <div class="segmented" id="zenFontSize">
                <button type="button" data-zfs="normal">标准</button>
                <button type="button" data-zfs="large">大</button>
                <button type="button" data-zfs="xlarge">特大</button>
              </div>
            </div>
          </div>
          <div class="st-field">
            <label>列表排版样式</label>
            <div class="segmented" id="listStyleMode">
              <button type="button" data-style="card">卡片视图</button>
              <button type="button" data-style="strip">紧凑列表</button>
            </div>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="general">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><div><div class="st-card-title">侧栏设置</div><div class="st-card-desc">自定义侧栏显示内容与折叠数量</div></div></div>
        <div class="st-card-body">
          <label style="display:block; margin-bottom:10px; font-size:13px; font-weight:600; color:var(--text-2);">侧边栏内容显示</label>
          <div style="display:flex; gap:10px; margin-bottom:20px;">
            <label class="sidebar-toggle-item"><input type="checkbox" id="sidebarShowCat" checked style="display:none;"><span>分类</span></label>
            <label class="sidebar-toggle-item"><input type="checkbox" id="sidebarShowSrc" checked style="display:none;"><span>来源</span></label>
            <label class="sidebar-toggle-item"><input type="checkbox" id="sidebarShowTag" checked style="display:none;"><span>标签</span></label>
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
          <div style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
            <label class="st-toggle"><div><div class="st-toggle-title">保存后自动推送</div><div class="st-toggle-desc">任何增删改都会触发一次同步</div></div><input type="checkbox" id="ghAuto"></label>
            <label class="st-toggle"><div><div class="st-toggle-title">启动时自动拉取</div><div class="st-toggle-desc">刷新页面时，从云端获取最新数据</div></div><input type="checkbox" id="ghAutoPull" checked></label>
          </div>
          <div class="st-grid-2" style="margin-top:16px;">
            <div class="st-field" style="margin-bottom:0;"><label>自动推送间隔</label><div class="st-inline"><input type="number" class="setting-num" id="autoPushDelay" min="1" max="60" step="1" value="2"><span class="st-suffix">秒</span></div></div>
            <div class="st-field" style="margin-bottom:0;"><label>云端检查间隔</label><div class="st-inline"><input type="number" class="setting-num" id="syncCheckIntervalInput" min="10" max="3600" step="10" value="60"><span class="st-suffix">秒</span></div></div>
          </div>
          <div class="st-hint" style="margin-bottom:12px;">停止操作指定时间后推送；闲置指定时间后检查云端更新（不低于10秒）</div>
          <label class="st-toggle"><div><div class="st-toggle-title">开启云端更新巡检</div><div class="st-toggle-desc">开启后，当其他设备更新时，会弹窗提醒你刷新</div></div><input type="checkbox" id="autoCheckUpdateToggle" checked></label>
          <div class="st-actions" style="display:flex; gap:8px; margin-top:16px;">
            <button class="btn" id="ghTestBtn">测试</button>
            <button class="btn" id="ghPullBtn">拉取</button>
            <button class="btn primary" id="ghPushBtn">推送</button>
          </div>
          <div class="st-actions" style="display:flex; gap:8px; margin-top:8px; margin-bottom:12px;">
            <button class="btn danger" id="ghForcePushBtn" style="flex:1; border-color:rgba(239,68,68,.3); background:var(--danger-soft); color:var(--danger); font-size:13px; padding:10px 12px;">强制覆盖云端</button>
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
        <div class="st-card-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>
          <div><div class="st-card-title">专注模式传图设置</div><div class="st-card-desc">在安心输入模式下，减少传图打断</div></div>
        </div>
        <div class="st-card-body">
          <div style="display:flex; flex-direction:column; gap:10px;">
            <label class="st-toggle">
              <div><div class="st-toggle-title">专注模式下传图跳过分类选择</div><div class="st-toggle-desc">开启后，在专注模式下传图将直接静默上传</div></div>
              <input type="checkbox" id="focusImgAutoUpload" checked>
            </label>
            <div id="focusImgCatWrap" class="st-field" style="margin-bottom:0; margin-top:8px;">
              <label>默认图片分类</label>
              <select id="focusImgDefaultCat" style="width:100%; text-align:left; padding:10px 36px 10px 12px; border-radius:10px; border:1px solid var(--line); background-color:var(--bg); background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%238c8f9e\\' stroke-width=\\'2.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'%3E%3Cpath d=\\'m6 9 6 6 6-6\\'/%3E%3C/svg%3E'); background-repeat:no-repeat; background-position:right 12px center; color:var(--text); font-size:13.5px; outline:none; appearance:none; -webkit-appearance:none; cursor:pointer; transition:all .15s;"></select>
              <div class="st-hint">静默上传时，图片将归入此分类。</div>
            </div>
          </div>
        </div>
      </div>

      <div class="st-card" data-group="images" style="display:none;">
        <div class="st-card-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><div><div class="st-card-title">图片分类</div><div class="st-card-desc">上传图片时可选的分类</div></div></div>
        <div class="st-card-body"><div class="st-field"><input type="text" id="imgCatsInput" placeholder="梗图, 情节, 插画, 其他" autocomplete="off"></div></div>
      </div>
    </div>
    <div class="modal-actions" style="margin-top:16px;"><button class="btn" id="settingCloseBtn" style="width:100%;">关闭</button></div>
  </div>
</div>

<div class="modal-mask" id="imgCatMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
    <h3 class="modal-title">选择图片分类</h3>
    <p class="modal-desc">共 <b id="imgCatCount">0</b> 张图片，选择分类后上传：</p>
    <div class="img-cat-list" id="imgCatList"></div>
    <div class="st-field" style="margin-bottom:16px;">
      <input class="modal-input" id="imgUploadTags" placeholder="添加标签（逗号分隔），与文字标签共用" autocomplete="off">
    </div>
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
    <div style="display:flex; gap:8px;">
      <button class="btn" id="imgMgrSelectBtn" style="transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        批量管理
      </button>
      <button class="btn" id="imgMgrRefreshBtn">刷新</button>
      <button class="btn primary" id="imgMgrCloseBtn" style="padding:9px 20px;">返回素材库</button>
    </div>
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

<div class="modal-mask" id="batchSourceMask">
  <div class="modal">
    <div class="modal-icon export-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
    <h3 class="modal-title">批量设置来源</h3>
    <p class="modal-desc">将选中的 <b id="batchSourceCount">0</b> 条素材来源修改为（留空则清空来源）：</p>
    <div class="export-field"><input class="modal-input" id="batchSourceInput" placeholder="输入来源名称，或留空清空" autocomplete="off"></div>
    <div class="modal-actions"><button class="btn" id="batchSourceCancel">取消</button><button class="primary" id="batchSourceConfirm">确定</button></div>
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