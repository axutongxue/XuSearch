import { createShortcutRow } from "./other-shortcuts.js";
import {
  state,
  msg,
  PICKER_CLOSE_DELAY_MS
} from "../state.js";
import { escapeHtml } from "../utils.js";
import {
  persistAll,
} from "../store.js";
import { renderSelectionContextGroupsSection } from "./selection-context-groups.js";
import { renderSelectionBubbleSection } from "./selection-bubble.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";
import { externalLinkIcon } from "../external-link-icon.js";




const OTHER_SECTIONS = [
  { id: "global", i18nKey: "settings_other_tabGlobal", fallback: "浏览器全局搜索" },
  { id: "desktopglobal", i18nKey: "settings_other_tabDesktopGlobal", fallback: "电脑桌面级全局搜索" },
  { id: "rightclick", i18nKey: "settings_other_tabRightClick", fallback: "右键提示词" },
  { id: "bubble", i18nKey: "settings_other_tabBubble", fallback: "划词气泡" },
  { id: "upload", i18nKey: "settings_other_uploadTitle", fallback: "自动关闭附件上传失败卡片" },
];

export function renderOtherSection() {
  const { otherSection } = state.dom;
  if (!otherSection) return;
  otherSection.innerHTML = "";

  
  
  [
    createShortcutSection(),
    createDesktopGlobalSection(),
    renderSelectionContextGroupsSection(),
    renderSelectionBubbleSection(),
    createUploadSection(),
  ].forEach((el, i) => {
    el.id = `other-sec-${OTHER_SECTIONS[i].id}`;
    otherSection.appendChild(el);
  });
}


function createShortcutSection() {
  const sec = document.createElement("section");
  sec.className = "other-sec";

  const enabled = getOtherSettingValue("searchPopupHotkeyEnabled");
  if (!enabled) sec.classList.add("is-off");

  const head = document.createElement("div");
  head.className = "other-sec-head";
  head.innerHTML = `
    <h2>${escapeHtml(msg("settings_other_tabGlobal", "浏览器全局搜索"))}</h2>
    <span class="other-sec-badge${enabled ? " is-on" : ""}" data-state-badge>${escapeHtml(
      enabled ? msg("settings_other_stateOn", "已开启") : msg("settings_other_stateOff", "已关闭")
    )}</span>
    <div class="other-sec-switch">
      ${renderStretchSwitchMarkup(enabled)}
    </div>
  `;
  sec.appendChild(head);

  
  const badge = head.querySelector(".other-sec-badge");
  head.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs.searchPopupHotkeyEnabled = event.target.checked;
    await persistAll();
    applyBadgeState(badge, event.target.checked);
    sec.classList.toggle("is-off", !event.target.checked);
  });

  const sub = document.createElement("p");
  sub.className = "other-sec-sub";
  sub.textContent =
    msg("settings_other_globalShortcutDesc", "在任意网页上用快捷键快速打开搜索弹窗。") +
    msg("settings_other_enableGlobalShortcutDesc", "开启后，按下快捷键即可打开搜索弹窗；关闭后快捷键将失效。") +
    msg("settings_other_shortcutChangeInBrowser", "快捷键在浏览器自带的「扩展键盘快捷方式」页面里修改（扩展无法代改）。");
  sec.appendChild(sub);

  const body = document.createElement("div");
  body.className = "other-sec-body";

  body.appendChild(createShortcutRow());
  sec.appendChild(body);

  return sec;
}

function applyBadgeState(badge, isOn) {
  if (!badge) return;
  badge.textContent = isOn
    ? msg("settings_other_stateOn", "已开启")
    : msg("settings_other_stateOff", "已关闭");
  badge.classList.toggle("is-on", !!isOn);
}


const DESKTOP_GLOBAL_TUTORIAL_URL = "https://xusearch.com/docs/script-tutorial.html"; 
const DESKTOP_GLOBAL_DEMO_URL = chrome.runtime.getURL("settings/assets/desktop-global-demo.avif");

const TUTORIAL_ICON = externalLinkIcon("free-api-entry-icon");

function createDesktopGlobalSection() {
  const sec = document.createElement("section");
  sec.className = "other-sec desktop-global-sec";

  const head = document.createElement("div");
  head.className = "other-sec-head";
  head.innerHTML = `<h2>${escapeHtml(msg("settings_other_desktopGlobalTitle", "电脑桌面级全局搜索"))}</h2>`;
  sec.appendChild(head);

  const sub = document.createElement("p");
  sub.className = "other-sec-sub";
  sub.textContent = msg(
    "settings_other_desktopGlobalDesc",
    "搭配专属脚本小工具，可以实现在 Windows 或者 Mac 电脑的任意窗口快速发起提问或者搜索，具体请点击按钮查看配置教程"
  );
  sec.appendChild(sub);

  const body = document.createElement("div");
  body.className = "other-sec-body desktop-global-body";
  body.innerHTML = `
    <figure class="desktop-global-shot">
      <img src="${DESKTOP_GLOBAL_DEMO_URL}" alt="${escapeHtml(msg("settings_other_desktopGlobalDemoAlt", "电脑桌面级全局搜索演示"))}" />
    </figure>
    <div class="desktop-global-actions">
      <a class="btn custom-btn-primary desktop-global-cta free-api-entry-btn" href="${DESKTOP_GLOBAL_TUTORIAL_URL}" target="_blank" rel="noreferrer noopener">${TUTORIAL_ICON}${escapeHtml(
        msg("settings_other_desktopGlobalCta", "查看配置教程")
      )}</a>
    </div>
  `;
  sec.appendChild(body);

  return sec;
}

export { renderStretchSwitchMarkup } from "./stretch-switch.js";

function getOtherSettingValue(key, defaultValue = true) {
  if (Object.prototype.hasOwnProperty.call(state.uiPrefs || {}, key)) {
    return state.uiPrefs[key] !== false;
  }
  return defaultValue;
}


function createUploadSection() {
  const sec = document.createElement("section");
  sec.className = "other-sec";

  const enabled = getOtherSettingValue("uploadAutoCloseFailedSites");
  if (!enabled) sec.classList.add("is-off");

  const head = document.createElement("div");
  head.className = "other-sec-head";
  head.innerHTML = `
    <h2>${escapeHtml(msg("settings_other_uploadTitle", "自动关闭附件上传失败卡片"))}</h2>
    <span class="other-sec-badge${enabled ? " is-on" : ""}" data-state-badge>${escapeHtml(
      enabled ? msg("settings_other_stateOn", "已开启") : msg("settings_other_stateOff", "已关闭")
    )}</span>
    <div class="other-sec-switch">
      ${renderStretchSwitchMarkup(enabled)}
    </div>
  `;
  sec.appendChild(head);

  
  const badge = head.querySelector(".other-sec-badge");
  head.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs.uploadAutoCloseFailedSites = event.target.checked;
    await persistAll();
    applyBadgeState(badge, event.target.checked);
    sec.classList.toggle("is-off", !event.target.checked);
  });

  const sub = document.createElement("p");
  sub.className = "other-sec-sub";
  sub.textContent =
    msg("settings_other_uploadDesc", "控制批量上传附件时，检测到某站点上传失败后如何处理该卡片。") +
    msg("settings_other_uploadHint", "开启后，检测到站点返回错误（格式不支持、文件过大等）会直接关闭它的卡片；关闭（默认）则弹窗列出失败原因，由你决定重试或关闭。");
  sec.appendChild(sub);

  return sec;
}
