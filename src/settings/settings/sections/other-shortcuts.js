import { shortcutPartList, parseCommandShortcut } from "../../../shared/shortcut.js";
import { msg } from "../state.js";
import { escapeHtml } from "../utils.js";

const ICON_KEYBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M7 11h.01M11 11h.01M15 11h.01M7 15h6"/></svg>`;

const ICON_EXTERNAL = `<svg class="shortcut-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function renderShortcutKeysMarkup(shortcut) {
  const parts = shortcutPartList(shortcut);
  if (!parts.length) {
    return `<span class="shortcut-keys-empty">${escapeHtml(msg("common_notSet", "未设置"))}</span>`;
  }
  const sep = `<span class="kbd-sep" aria-hidden="true">+</span>`;
  return parts.map((part) => `<span class="kbd">${escapeHtml(part)}</span>`).join(sep);
}

function browserShortcutPageUrl() {
  return /Edg\//.test(navigator.userAgent) ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
}

export function createShortcutRow() {
  const row = document.createElement("article");
  row.className = "other-setting-row shortcut-row";
  row.innerHTML = `
    <div class="other-setting-glyph" aria-hidden="true">${ICON_KEYBOARD}</div>
    <div class="other-setting-row-stack">
      <div class="other-setting-row-main">
        <div class="other-setting-copy">
          <div class="other-setting-title">${msg("settings_other_customShortcutTitle", "自定义快捷键")}</div>
        </div>
        <span class="shortcut-readonly" data-field="overlay-shortcut" aria-live="polite"></span>
        <div class="shortcut-row-actions">
          <button type="button" class="shortcut-open-primary">${ICON_EXTERNAL}${msg("settings_other_browserShortcutOpen", "前往设置")}</button>
        </div>
      </div>
    </div>
  `;

  const display = row.querySelector('[data-field="overlay-shortcut"]');

  async function renderDisplay() {
    let raw = "";
    try {
      const all = await chrome.commands.getAll();
      raw = all.find((c) => c.name === "search-popup-hotkey")?.shortcut || "";
    } catch (_e) {
    }
    display.innerHTML = renderShortcutKeysMarkup(parseCommandShortcut(raw));
    display.dataset.raw = raw;
  }

  renderDisplay();

  row.querySelector(".shortcut-open-primary")?.addEventListener("click", () => {
    try {
      chrome.tabs.create({ url: browserShortcutPageUrl() }).catch(() => {});
    } catch (_e) {
    }
  });

  return row;
}
