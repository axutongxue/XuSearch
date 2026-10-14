import { ICON_SIZE, PANEL_HEIGHT_PX } from "./input-prompt-launcher-constants.js";

export const LAUNCHER_SHELL_CSS = `
  :host { all: initial; }
  .root {
    position: fixed;
    z-index: 2147483646;
    font-family: "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
    pointer-events: none;
  }
  .root.hidden { display: none; }
  .fab {
    position: fixed;
    z-index: 2147483647;
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
    border-radius: 50%;
    border: 1px solid #e0e0e0;
    background: #fff;
    color: #111;
    box-shadow: 0 2px 10px rgba(0,0,0,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    padding: 0;
    transition: transform 0.12s, box-shadow 0.12s,
                background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }
  .fab:hover { transform: scale(1.06); box-shadow: 0 3px 14px rgba(0,0,0,0.18); }
  
  .fab:active { transform: scale(0.94); }
  
  .fab.open { animation: fab-pop 0.24s ease-out; }
  @keyframes fab-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(0.92); }
    75%  { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  .fab.dragging {
    cursor: grabbing;
    transition: none;
    transform: scale(1.08);
    box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  }
  .fab.spin-fire {
    border-color: #ff8c32;
    color: #fff;
    background: radial-gradient(circle at 35% 30%, #fff6a8, #ff6a00 58%, #c41e00);
  }
  
  .fab-ring {
    position: absolute;
    left: -5px;
    top: -5px;
    width: 40px;
    height: 40px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .fab-ring circle {
    fill: none;
    stroke: #2CBD61;
    stroke-width: 2;
    stroke-linecap: round;
    
    stroke-dasharray: 94.25;
    stroke-dashoffset: 94.25;
    transform: rotate(-90deg);   
    transform-origin: center;
    
    transition: stroke-dashoffset 160ms cubic-bezier(0.4, 0, 0.6, 1);
  }
  .fab.charging .fab-ring {
    opacity: 1;
  }
  .fab.charging .fab-ring circle {
    stroke-dashoffset: 0;
    
    transition: stroke-dashoffset var(--fab-ring-duration, 300ms) cubic-bezier(0.4, 0.2, 0.6, 0.8);
  }
  .launcher-spin-canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483646;
  }
  .launcher-picker-shell {
    position: fixed !important;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
    z-index: 2147483647 !important;
    display: none;
    pointer-events: none;
  }
  .launcher-picker-shell.open {
    display: block;
    pointer-events: auto;
  }
  .launcher-picker-shell[hidden] { display: none !important; }
  .launcher-picker {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    
    width: min(620px, calc(100vw - 24px));
    height: ${PANEL_HEIGHT_PX}px;
    min-height: ${PANEL_HEIGHT_PX}px;
    max-height: ${PANEL_HEIGHT_PX}px;
    grid-template-columns: 116px minmax(0, 1fr) !important;
    grid-template-rows: 1fr !important;
    display: none;
    pointer-events: auto !important;
    overflow: hidden;
  }
  .launcher-picker.open {
    display: grid !important;
    pointer-events: auto !important;
  }
  .launcher-picker .prompt-groups-col,
  .launcher-picker .prompt-list-col,
  .launcher-picker .prompt-item,
  .launcher-picker .prompt-group-item {
    pointer-events: auto;
  }
  .launcher-picker[hidden] { display: none !important; }
  .launcher-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    display: none;
    pointer-events: auto;
    background: transparent;
  }
  .launcher-backdrop.visible { display: block; }
  .launcher-picker .prompt-groups-col {
    padding: 8px;
    min-height: 0;
    max-height: none;
    overflow-y: auto;
    gap: 6px;
  }
  .launcher-picker .prompt-list-col {
    min-height: 0;
    max-height: none;
    overflow-y: auto;
    padding: 6px 0;
  }
  .launcher-picker .prompt-group-item {
    
    min-height: 37px;
    padding: 8px 8px 8px 10px;
    font-size: 14px;
  }
  .launcher-picker .prompt-group-item-count {
    font-size: 11px;
  }
  .launcher-picker .prompt-item {
    min-height: 41px;
    padding: 4px 14px;
    font-size: 14px;
  }
  .launcher-picker .prompt-item--rich {
    padding: 10px 14px;
  }
  .launcher-picker .prompt-item--rich .prompt-item-label {
    font-size: 14px;
  }
  .launcher-picker .prompt-item-tag {
    font-size: 11.5px;
  }
  .launcher-picker .prompt-item-count {
    font-size: 11px;
  }
  .launcher-picker .prompt-item-ex {
    font-size: 13px;
  }
  .launcher-picker .prompt-icon-btn {
    width: 25px;
    height: 25px;
  }
  .launcher-picker .prompt-empty {
    padding: 18px 14px;
    font-size: 14px;
  }
  .launcher-picker .prompt-empty-btn {
    height: 32px;
    font-size: 13px;
  }
  
  .fab.edge-left,
  .fab.edge-right {
    transition: transform 0.2s ease, box-shadow 0.12s;
  }
  .fab.edge-left:hover {
    transform: translateX(${Math.round(ICON_SIZE / 2)}px) scale(1.04);
    box-shadow: 0 3px 16px rgba(0,0,0,0.2);
  }
  .fab.edge-right:hover {
    transform: translateX(-${Math.round(ICON_SIZE / 2)}px) scale(1.04);
    box-shadow: 0 3px 16px rgba(0,0,0,0.2);
  }
  @media (prefers-color-scheme: dark) {
    .fab { background: #1e1e1e; border-color: #444; color: #fff; }
    
    .launcher-picker {
      border-color: #3f3f46;
      background: #27272a;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    }
    .launcher-picker .prompt-groups-col {
      background: #1e2a45;
      border-right-color: #3f3f46;
    }
    .launcher-picker .prompt-group-item {
      border-color: #3f3f46;
      background: #27272a;
      color: #f4f4f5;
    }
    .launcher-picker .prompt-group-item.is-active {
      
      border-color: #7d9cf5;
      box-shadow: none;
    }
    .launcher-picker .prompt-group-item:hover {
      border-color: #52525b;
      background: #2f2f33;
      box-shadow: none;
    }
    .launcher-picker .prompt-group-item-count { color: #71717a; }
    .launcher-picker .prompt-item {
      color: #f4f4f5;
      border-bottom-color: #2f2f33;
    }
    .launcher-picker .prompt-item:hover { background: #1e2a45; }
    .launcher-picker .prompt-item-tag {
      background: #2f2f33;
      color: #a1a1aa;
    }
    .launcher-picker .prompt-item-count { color: #71717a; }
    .launcher-picker .prompt-item-ex { color: #a1a1aa; }
    .launcher-picker .prompt-icon-btn { color: #71717a; }
    .launcher-picker .prompt-icon-btn:hover {
      background: #27272a;
      color: #66a4ff;
    }
    .launcher-picker .prompt-empty {
      color: #71717a;
      border-color: #3a3a40;
    }
    .launcher-picker .prompt-empty-btn {
      background: #f4f4f5;
      color: #18181b;
    }
  }
`;
