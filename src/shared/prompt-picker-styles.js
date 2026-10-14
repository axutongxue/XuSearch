
export const PROMPT_PICKER_STYLES = `
  .prompt-picker {
    position: absolute;
    top: calc(100% + 8px);
    left: -1px;
    right: -1px;
    min-height: 228px;
    max-height: 320px;
    display: grid;
    grid-template-columns: 118px minmax(0, 1fr);
    grid-template-rows: 1fr auto;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, .06);
    overflow: hidden;
    z-index: 6;
  }
  .prompt-picker[hidden] { display: none; }

  /* ── 左：分组（外观 = 设置页站点块 .site-tile.selected-chip，见 14-groups-layout.css；
        唯一不照抄的是 cursor:grab —— 胶囊不可拖拽） ── */
  .prompt-groups-col {
    padding: 9px 8px;
    border-right: 1px solid #e5e7eb;
    background: #f0f5ff;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    /* 滚到边界后不把滚动链给外层（面板内防穿透；popup 无下层，行为不变） */
    overscroll-behavior: contain;
    min-height: 0;
  }
  .prompt-group-item {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    min-height: 37px;
    padding: 8px 8px 8px 10px;
    border: 1px solid rgba(0, 0, 0, .08);
    border-radius: 12px;
    background: #fff;
    color: #17181a;
    text-align: left;
    font-size: 14px;
    line-height: 1.4;
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
  }
  .prompt-group-item.is-active {
    /* 激活态 = popup 搜索组胶囊 .popup-group-pill.is-default：深蓝描边 + 蓝柔光，无底色无竖条 */
    border-color: #2b5fd9;
    box-shadow: 0 2px 6px rgba(43, 95, 217, .1);
  }
  .prompt-group-item:hover:not(:where(.is-active)) {
    /* 2026-09-24：只给「未选中」的分组胶囊挂 hover 特效；当前激活那颗保持深蓝描边（阿虚需求）。
       :where() 保证特异性不变，避免顶掉其它同特异性规则。
       ⚠️ 本样式串是 JS 模板字符串：注释里禁止出现反引号与美元花括号，否则字符串会被提前闭合。 */
    border-color: rgba(0, 87, 255, .32);
    background: #fbfcff;
    box-shadow: 0 2px 10px rgba(0, 87, 255, .07);
  }
  .prompt-group-item-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prompt-group-item-count {
    flex: none;
    font-size: 10px;
    color: #888;
    font-variant-numeric: tabular-nums;
  }

  /* ── 右：提示词行（虚线分隔，对齐设置页 .other-sec .other-setting-row） ── */
  .prompt-list-col {
    /* 顶部不留 padding：否则第一行的 hover 蓝底与输入区分隔线之间会有一条白缝 */
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .prompt-item {
    min-height: 36px;
    /* ⚠️ 禁止收缩：列表是 flex column + max-height，条目多时 flex 会把每行等比压扁 */
    flex-shrink: 0;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: #17181a;
    cursor: pointer;
    border-bottom: 1px dashed #e5e7eb;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 140ms ease;
  }
  .prompt-item:last-child { border-bottom: none; }
  .prompt-item:hover { background: #f0f5ff; }
  .prompt-item-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 4px 0;
  }

  /* rich 两行式（createItem 的 rich 分支） */
  .prompt-item--rich {
    align-items: flex-start;
    gap: 8px;
    padding: 9px 12px;
  }
  .prompt-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .prompt-item-top {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .prompt-item--rich .prompt-item-label {
    flex: none;
    min-width: 0;
    padding: 0;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.4;
  }
  .prompt-item-tag {
    flex: none;
    font-size: 10.5px;
    line-height: 1.5;
    color: #333;
    background: #f0f0ee;
    border-radius: 999px;
    padding: 1px 9px;
  }
  .prompt-item-count {
    flex: none;
    margin-left: auto;
    font-size: 10px;
    color: #888;
    font-variant-numeric: tabular-nums;
  }
  .prompt-item-ex {
    font-size: 12px;
    line-height: 1.55;
    color: #6b7280;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .prompt-item-icons {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .prompt-item:hover .prompt-item-icons { opacity: 1; }
  .prompt-icon-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: rgba(0, 0, 0, .42);
    border-radius: 5px;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: color 120ms ease, background 120ms ease, box-shadow 120ms ease;
  }
  .prompt-icon-btn:hover {
    background: #fff;
    color: #0057ff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .08);
  }

  /* ── 空态（对齐设置页 .prompt-grid-empty：虚线框 + 居中灰字） ── */
  .prompt-empty {
    grid-column: 1 / -1;
    flex-shrink: 0;
    margin: 10px;
    padding: 22px 14px;
    border: 1px dashed #e0e0e0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    line-height: 1.5;
    color: #888;
    text-align: center;
  }
  .prompt-empty-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 14px;
    border: none;
    border-radius: 10px;
    background: #0057ff;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 140ms ease;
  }
  .prompt-empty-btn:hover { background: #004ad9; }
  .prompt-empty-btn svg { width: 12px; height: 12px; }

  /* ── 底栏 ── */
  .prompt-picker-footer {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 5px 10px;
    border-top: 1px solid #e5e7eb;
    background: #f0f5ff;
  }
  .prompt-picker-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    font-size: 11px;
    color: #888;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 5px;
    transition: color 140ms ease, background 140ms ease;
  }
  .prompt-picker-footer-btn:hover { color: #0057ff; background: #fff; }
  ${window.PromptItemUI?.PREVIEW_CSS ?? ""}
`;
