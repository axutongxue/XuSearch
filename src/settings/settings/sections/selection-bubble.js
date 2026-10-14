import { state, msg } from "../state.js";
import { persistAll } from "../store.js";
import { escapeHtml } from "../utils.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";


const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
const ICON_BUBBLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3l3 4 3-4h7a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/></svg>`;

function getBubblePref(key, defaultValue = true) {
  const prefs = state.uiPrefs || {};
  if (Object.prototype.hasOwnProperty.call(prefs, key)) {
    return prefs[key] !== false;
  }
  return defaultValue;
}


function createBubbleSourceToggle(key, title, defaultValue = true, icon = "") {
  const isOn = getBubblePref(key, defaultValue);
  const row = document.createElement("div");
  row.className = "other-setting-row";
  row.innerHTML = `
    ${icon ? `<div class="other-setting-glyph" aria-hidden="true">${icon}</div>` : ""}
    <div class="other-setting-row-stack">
      <div class="other-setting-row-main">
        <div class="other-setting-copy">
          <div class="other-setting-title">${escapeHtml(title)}</div>
        </div>
        ${renderStretchSwitchMarkup(isOn)}
      </div>
    </div>
  `;
  row.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs[key] = event.target.checked;
    await persistAll();
  });
  return row;
}

export function renderSelectionBubbleSection() {
  
  
  const isOn = state.uiPrefs?.selectionSearchEnabled === true;
  const sec = document.createElement("section");
  sec.className = "other-sec";
  if (!isOn) sec.classList.add("is-off");

  const head = document.createElement("div");
  head.className = "other-sec-head";
  head.innerHTML = `
    <h2>${escapeHtml(msg("settings_other_tabBubble", "划词气泡"))}</h2>
    <span class="other-sec-badge${isOn ? " is-on" : ""}" data-state-badge>${escapeHtml(
      isOn ? msg("settings_other_stateOn", "已开启") : msg("settings_other_stateOff", "已关闭")
    )}</span>
    <div class="other-sec-switch">
      ${renderStretchSwitchMarkup(isOn)}
    </div>
  `;
  sec.appendChild(head);

  const badge = head.querySelector(".other-sec-badge");
  head.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs.selectionSearchEnabled = event.target.checked;
    await persistAll();
    
    badge.textContent = event.target.checked
      ? msg("settings_other_stateOn", "已开启")
      : msg("settings_other_stateOff", "已关闭");
    badge.classList.toggle("is-on", event.target.checked);
    sec.classList.toggle("is-off", !event.target.checked);
  });

  const sub = document.createElement("p");
  sub.className = "other-sec-sub";
  sub.textContent = msg("settings_other_selectionSearchToggleDesc", "选中文字后自动弹出搜索快捷气泡。");
  sec.appendChild(sub);

  
  const block = document.createElement("div");
  block.className = "other-sub-block";

  const blockHead = document.createElement("h3");
  blockHead.className = "other-sub-head";
  blockHead.textContent = msg("settings_bubble_sourceTitle", "气泡显示内容");
  block.appendChild(blockHead);

  const blockSub = document.createElement("p");
  blockSub.className = "other-sec-sub";
  blockSub.textContent = msg("settings_bubble_sourceHint", "可同时开启多项，气泡依次展示各组条目，组间以分割线分隔。建议同时开启不超过两个，否则气泡会显得臃肿。每组最多显示 5 个条目。");
  block.appendChild(blockSub);

  const body = document.createElement("div");
  body.className = "other-sec-body";
  body.appendChild(
    createBubbleSourceToggle("bubbleShowGroups", msg("settings_bubble_sourceGroups", "搜索组"), true, ICON_GRID)
  );
  body.appendChild(
    createBubbleSourceToggle("bubbleShowCtx", msg("settings_bubble_sourceCtx", "右键提示词组"), false, ICON_BUBBLE)
  );
  block.appendChild(body);

  sec.appendChild(block);
  return sec;
}
