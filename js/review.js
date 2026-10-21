/* ================= ★ 手机端批阅界面适配 ================= */
@media (max-width: 680px) {
  .review-paper { flex-direction: column; }
  .review-main { flex: 1; min-height: 0; }
  .review-sidebar {
    width: 100%;
    flex-direction: row;
    border-left: none;
    border-top: 2px solid var(--rv-panel-border, #d4a59a);
    padding: 10px 6px;
    max-height: 150px;
    overflow-x: auto;
    overflow-y: hidden;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.03);
    flex: none;
    gap: 6px;
  }
  .review-sidebar.hidden { display: none; }
  .review-col {
    border-right: 1px dashed var(--rv-panel-border, #d4a59a);
    border-bottom: none;
    height: auto;
    flex-direction: row;
    gap: 8px;
    padding: 0 10px;
    align-items: flex-start;
    flex: none;
    min-width: 0;
  }
  .review-col:last-child { border-right: none; }
  .review-col-title {
    writing-mode: horizontal-tb;
    text-orientation: mixed;
    margin-bottom: 0;
    margin-right: 2px;
    font-size: 13px;
    letter-spacing: 2px;
    flex: none;
    white-space: nowrap;
    align-self: center;
  }
  .review-search-btn {
    writing-mode: horizontal-tb;
    width: auto;
    padding: 3px 8px;
    margin-bottom: 0;
    flex: none;
    align-self: center;
  }
  .review-opt-list {
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    max-height: none;
    padding-bottom: 0;
    align-items: center;
    gap: 6px;
    scrollbar-width: thin;
  }
  .review-pill {
    writing-mode: horizontal-tb;
    text-orientation: mixed;
    padding: 5px 12px;
    min-width: auto;
    min-height: auto;
    font-size: 13px;
    letter-spacing: 0;
    white-space: nowrap;
    flex: none;
    border-radius: 6px;
  }
  .review-pill-pin { top: -4px; right: -4px; font-size: 10px; }

  .review-header { padding: 10px 14px; }
  .review-title { font-size: 20px; letter-spacing: 4px; gap: 8px; }
  .review-stamp { font-size: 11px; padding: 1px 6px; letter-spacing: 1px; }
  .review-settings-btn { font-size: 11px; padding: 3px 6px; }
  .review-close-btn { font-size: 16px; padding: 2px 8px; }
  .review-progress { font-size: 13px; gap: 10px; }

  .review-body { padding: 16px; }
  .review-textarea { letter-spacing: 1px; }

  .review-footer { padding: 10px 12px calc(12px + env(safe-area-inset-bottom)); gap: 8px; flex-wrap: wrap; }
  .review-btn { padding: 6px 14px; font-size: 14px; letter-spacing: 0.5px; }
  .review-btn.approve { padding: 6px 20px; font-size: 15px; }
  .review-btn.undo-btn { font-size: 12px; padding: 5px 10px; }

  .rv-word-count { font-size: 11px; bottom: 6px; right: 10px; }
  .rv-shortcut-hint { display: none; }
  .rv-countdown { font-size: 60px !important; bottom: 40px; right: 20px; }
  .rv-corner-stamp { font-size: 24px; padding: 4px 12px; bottom: 20px; right: 20px; letter-spacing: 2px; border-width: 3px; }

  .review-completed { padding: 16px; }
  .review-completed .big-seal { font-size: 32px; padding: 6px 18px; letter-spacing: 4px; border-width: 4px; }
  .review-completed .comp-text { font-size: 15px; letter-spacing: 1px; }
  .rv-title-badge { font-size: 14px; padding: 3px 12px; }
  .battle-card { padding: 16px 20px; }
  .battle-main-stats { font-size: 14px; line-height: 1.9; }
  .battle-history-row { font-size: 13px; }
  .review-completed .btn-exit { padding: 8px 28px; font-size: 16px; letter-spacing: 1px; }

  .review-custom-panel { grid-template-columns: 1fr; padding: 16px; gap: 14px; }
  .rv-card { padding: 12px; }
  .rv-set-title { font-size: 13px; }
  .review-search-modal { width: 92vw; padding: 16px; }
}