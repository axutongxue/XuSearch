import {
  SEARCH_GROUPS_STORAGE_KEY,
  SEARCH_HISTORY_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CUSTOM_SITES_STORAGE_KEY,
  LAST_USED_GROUP_ID_STORAGE_KEY,
  MEMBER_FORBIDDEN_KEY,
  MEMBER_AUTHORITATIVE_END_KEY,
} from "../shared/storage-keys.js";
import {
  readUpdateSummary,
  readUpdateSeenVersion,
  markUpdateSeen,
  hasUpdateSummaryContent,
} from "../shared/bundle-update-notice.js";
import {
  getMemberExpiryNotice,
  dismissMemberExpiryNotice,
} from "../shared/member-expiry-notice.js";
import { MEMBER_CROWN_SVG } from "../shared/member-gate-tip.js";
import { invalidateBuiltinCache } from "../shared/site-registry.js";
import { refreshSubscriptionThrottled } from "../shared/membership-client.js";
import {
  state,
  loadGroups,
  loadPromptGroups,
  loadUiPrefs,
  refreshAllSites,
} from "./state.js";
import {
  renderGroups,
  renderPromptPicker,
  closePromptPicker,
  togglePromptPicker,
  runDefaultSearch,
  runGroup,
} from "./sections.js";
import { findGroupByName, getLastWordBeforeCaret } from "../shared/group-name-trigger.js";
import { loadSearchDraft, saveSearchDraft } from "../shared/search-draft.js";
import {
  mountPopupAttachmentButton,
  isPopupUploadPickMode,
  clearPopupUploadMode,
  selectPopupUploadGroup,
  syncPopupAttachmentBadge,
} from "./attachments.js";

const { applyDomI18n } = window.__XUSEARCH_I18N__ || {};

const tx = (key, fallback) => window.__XUSEARCH_I18N__?.t?.(key) || fallback;


const UPDATE_NOTICE_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';


let manualMinHeight = null;

let isManualResizing = false;

const COMPACT_INPUT_LINES = 2.1;

let composerLayoutRafId = 0;
let composerLayoutTimerId = 0;
let pendingComposerLayoutOptions = null;

let lastObservedInputHeight = -1;


const POPUP_MAX_H = 582; 
const POPUP_WINDOW_CAP = 590; 


const PICKER_MIN_H = 180; 






function scheduleComposerLayout(options = {}) {
  pendingComposerLayoutOptions = { ...(pendingComposerLayoutOptions || {}), ...options };
  if (composerLayoutRafId) return;
  const run = () => {
    composerLayoutRafId = 0;
    if (composerLayoutTimerId) {
      clearTimeout(composerLayoutTimerId);
      composerLayoutTimerId = 0;
    }
    const opts = pendingComposerLayoutOptions || {};
    pendingComposerLayoutOptions = null;
    syncComposerLayout(opts);
  };
  composerLayoutRafId = requestAnimationFrame(run);
  composerLayoutTimerId = setTimeout(() => {
    if (!composerLayoutRafId) return;
    cancelAnimationFrame(composerLayoutRafId);
    composerLayoutTimerId = 0;
    run();
  }, 50);
}

document.addEventListener("DOMContentLoaded", start);
chrome.storage.onChanged.addListener(handleStorageChange);

import { applyDarkModeToDoc } from "../shared/theme.js";

async function start() {
  
  chrome.runtime.sendMessage({ type: "ENSURE_BUNDLE", trigger: "popup" }).catch(() => {
    
  });

  
  
  
  
  refreshSubscriptionThrottled().catch(() => {
    
  });

  const dom = state.dom;
  dom.queryInput = document.getElementById("popupQueryInput");
  dom.composer = document.querySelector(".search-composer");
  dom.groupsContainer = document.getElementById("popupGroups");
  dom.openSettingsBtn = document.getElementById("openSettingsBtn");
  dom.promptEntryBtn = document.getElementById("promptEntryBtn");
  dom.composerActionsRow = document.querySelector(".composer-actions-row");
  dom.promptPicker = document.getElementById("promptPicker");
  dom.shell = document.querySelector(".popup-shell");
  dom.historyToggleBtn = document.getElementById("historyToggleBtn");
  dom.historyPanel = document.getElementById("historyPanel");
  dom.historyList = document.getElementById("historyList");
  dom.historyCollapseBtn = document.getElementById("historyCollapseBtn");
  mountPopupAttachmentButton(dom.composerActionsRow);

  
  
  
  state.syncComposerLayout = syncComposerLayout;
  state.updatePromptPickerLayoutState = updatePromptPickerLayoutState;

  await chrome.runtime.sendMessage({ type: "ENSURE_INITIAL_STATE_DEFAULTS" }).catch(() => null);
  await refreshUiPrefs();
  await refreshAllSites();
  
  await refreshLastUsedGroup();
  await Promise.all([
    refreshGroups(),
    refreshPromptGroups(),
  ]);
  await refreshHistory();
  renderHistoryPanel();
  updateHistoryEntryVisibility();

  
  await mountUpdateNotice();
  
  await mountMemberExpiryNotice();
  bindEvents();
  syncComposerLayout();
  const draft = await loadSearchDraft();
  
  if (draft && dom.queryInput && !dom.queryInput.value) dom.queryInput.value = draft;
  syncComposerLayout();
  dom.queryInput?.focus();
}

function bindEvents() {
  const { openSettingsBtn, promptEntryBtn, queryInput } = state.dom;

  openSettingsBtn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
    window.close();
  });

  promptEntryBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    
    if (isPopupUploadPickMode()) {
      clearPopupUploadMode();
      renderGroups();
    }
    togglePromptPicker();
  });

  
  
  const { historyToggleBtn, historyPanel, historyList, historyCollapseBtn } = state.dom;

  historyToggleBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHistoryPanel(!state.isHistoryOpen);
  });

  historyCollapseBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeHistoryPanel();
    queryInput?.focus();
  });

  historyList?.addEventListener("click", (event) => {
    const item = event.target instanceof Element ? event.target.closest(".composer-history-item") : null;
    if (!item) return;
    event.stopPropagation();
    const text = item.dataset.query || "";
    if (queryInput) {
      queryInput.value = text;
      saveSearchDraft(text);
      scheduleComposerLayout({ scrollToTop: true });
      queryInput.focus();
      queryInput.setSelectionRange(text.length, text.length);
    }
    closeHistoryPanel();
  });

  let popupSpaceCount = 0;
  let popupLastSpaceTime = 0;
  let popupPickMode = null; 

  function popupExitPickMode() {
    if (!popupPickMode) return;
    popupPickMode = null;
    popupSpaceCount = 0;
    popupLastSpaceTime = 0;
    const container = state.dom.groupsContainer;
    if (!container) return;
    container.style.paddingTop = "";
    renderGroups();
  }

  
  
  function ensureGroupChip() {
    if (state.dom.groupChip) return state.dom.groupChip;
    const composer = state.dom.composer;
    const queryInput = state.dom.queryInput;
    if (!composer || !queryInput) return null;
    const chip = document.createElement("div");
    chip.id = "popupGroupChip";
    chip.className = "popup-group-chip";
    chip.hidden = true;
    const label = document.createElement("span");
    label.className = "popup-group-chip-label";
    const xBtn = document.createElement("button");
    xBtn.type = "button";
    xBtn.className = "popup-group-chip-x";
    xBtn.setAttribute("aria-label", i18nMsg("popup_cancelGroupPick", "取消组选择"));
    xBtn.textContent = "✕";
    xBtn.addEventListener("click", () => setActiveRunGroup(null));
    chip.appendChild(label);
    chip.appendChild(xBtn);
    
    
    composer.insertBefore(chip, composer.firstChild);
    state.dom.groupChip = chip;
    state.dom.groupChipLabel = label;
    state.dom.groupChipX = xBtn;
    return chip;
  }

  function i18nMsg(key, fallback) {
    return window.__XUSEARCH_I18N__?.t?.(key) || fallback;
  }

  function setActiveRunGroup(group) {
    state.activeRunGroup = group || null;
    if (group) {
      const chip = ensureGroupChip();
      if (!chip) return;
      state.dom.groupChipLabel.textContent = group.name;
      chip.hidden = false;
    } else if (state.dom.groupChip) {
      state.dom.groupChip.hidden = true;
    }
    syncChipTextIndent();
    syncComposerLayout();
    if (queryInput) queryInput.focus();
  }

  
  
  
  
  function syncChipTextIndent() {
    if (!queryInput) return;
    const chip = state.dom.groupChip;
    if (chip && !chip.hidden) {
      const inputRect = queryInput.getBoundingClientRect();
      const xBtn = state.dom.groupChipX;
      const xRight = xBtn ? xBtn.getBoundingClientRect().right - inputRect.left : 0;
      queryInput.style.textIndent = `${Math.max(0, Math.round(xRight + 12))}px`;
    } else {
      queryInput.style.textIndent = "";
    }
  }

  
  state.syncChipIndent = syncChipTextIndent;
  
  state.exitPopupPickMode = popupExitPickMode;

  function popupEnterGroupPickMode() {
    popupPickMode = "group";
    const container = state.dom.groupsContainer;
    if (!container) return;
    container.style.paddingTop = "12px";
    const btns = container.querySelectorAll(".popup-group-pill");
    btns.forEach((btn, i) => {
      if (i < 9) {
        btn.setAttribute("data-pick-num", String(i + 1));
        btn.style.animationDelay = `${i * 0.06}s`;
      }
    });
  }

  queryInput?.addEventListener("keydown", async (event) => {
    
    if (
      event.key === "Backspace" &&
      state.activeRunGroup &&
      queryInput.selectionStart === 0 &&
      queryInput.selectionEnd === 0 &&
      queryInput.value === ""
    ) {
      event.preventDefault();
      setActiveRunGroup(null);
      return;
    }

    
    if (isPopupUploadPickMode()) {
      if (event.key >= "1" && event.key <= "9" && !event.isComposing) {
        event.preventDefault();
        const idx = parseInt(event.key, 10);
        if (selectPopupUploadGroup(idx - 1)) {
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearPopupUploadMode();
        popupPickMode = null;
        renderGroups();
        return;
      }
      if (event.key !== "Shift" && event.key !== "Control" && event.key !== "Alt" && event.key !== "Meta" && event.key !== " ") {
        clearPopupUploadMode();
        renderGroups();
      }
    }

    
    if (popupPickMode === "group") {
      if (event.key >= "1" && event.key <= "9" && !event.isComposing) {
        event.preventDefault();
        const group = state.groupDisplayOrder[parseInt(event.key, 10) - 1];
        popupExitPickMode();
        if (group) runGroup(group);
        return;
      }
      if (event.key === "Escape") { popupExitPickMode(); return; }
      if (event.key !== " ") { popupExitPickMode(); popupSpaceCount = 0; popupLastSpaceTime = 0; }
    }

    
    if (event.key === " " && !event.isComposing && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      
      if (!popupPickMode && state.groups.length) {
        const pos = queryInput.selectionStart ?? queryInput.value.length;
        const last = getLastWordBeforeCaret(queryInput.value.slice(0, pos));
        const group = last && findGroupByName(state.groups, last.word);
        if (group) {
          event.preventDefault();
          queryInput.value = queryInput.value.slice(0, last.index) + queryInput.value.slice(pos);
          queryInput.setSelectionRange(last.index, last.index);
          queryInput.dispatchEvent(new Event("input", { bubbles: true }));
          setActiveRunGroup(group);
          return;
        }
      }
      const now = Date.now();
      if (now - popupLastSpaceTime <= 400) {
        popupSpaceCount++;
      } else {
        popupSpaceCount = 1;
      }
      popupLastSpaceTime = now;

      if (popupSpaceCount === 2 && state.groups.length > 0) {
        event.preventDefault();
        
        if (state.isPromptPickerOpen) closePromptPicker();
        const ta = queryInput;
        const pos = ta.selectionStart ?? 0;
        if (pos > 0 && ta.value[pos - 1] === " ") {
          ta.value = ta.value.slice(0, pos - 1) + ta.value.slice(pos);
          ta.setSelectionRange(pos - 1, pos - 1);
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (popupPickMode !== "group") popupEnterGroupPickMode();
        return;
      }
    } else if (event.key !== "Shift" && event.key !== "Control" && event.key !== "Alt" && event.key !== "Meta") {
      popupSpaceCount = 0;
      popupLastSpaceTime = 0;
    }

    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    await runDefaultSearch();
  });

  
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (state.isPromptPickerOpen && !target.closest("#promptEntryBtn") && !target.closest("#promptPicker")) {
      closePromptPicker();
    }
    if (state.isHistoryOpen && !target.closest("#historyToggleBtn") && !target.closest("#historyPanel")) {
      closeHistoryPanel();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.isPromptPickerOpen) {
      closePromptPicker();
      queryInput?.focus();
      return;
    }
    if (state.isHistoryOpen) {
      closeHistoryPanel();
      queryInput?.focus();
    }
  });

  if (queryInput) {
    queryInput.addEventListener("input", () => scheduleComposerLayout());
    queryInput.addEventListener("input", () => saveSearchDraft(queryInput.value));
    queryInput.addEventListener("mouseup", () => scheduleComposerLayout());
    
    queryInput.addEventListener("scroll", () => {
      const chip = state.dom.groupChip;
      if (!chip) return;
      const hide = queryInput.scrollTop > 0;
      chip.style.opacity = hide ? "0" : "1";
      chip.style.pointerEvents = hide ? "none" : "";
    });
    if (typeof ResizeObserver !== "undefined") {
      state.composerResizeObserver = new ResizeObserver(() => {
        
        
        
        const h = queryInput.offsetHeight;
        if (h === lastObservedInputHeight) return;
        lastObservedInputHeight = h;
        scheduleComposerLayout();
      });
      state.composerResizeObserver.observe(queryInput);
    }
  }

  const resizeHandle = document.querySelector(".composer-resize-handle");
  if (resizeHandle) {
    let drag = null;
    const applyDragHeight = () => {
      if (!drag || !state.dom.queryInput) return;
      const height = Math.min(drag.maxH, Math.max(40, drag.startH + (drag.lastY - drag.startY)));
      manualMinHeight = height;
      const ta = state.dom.queryInput;
      ta.style.height = "auto";
      ta.style.minHeight = `${height}px`;
      ta.style.overflowY = height >= drag.maxH ? "auto" : "";
      state.dom.composer?.classList.add("is-manual-resized");
      
      
      applyPickerHeightBudget();
    };
    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const ta = state.dom.queryInput;
      if (!ta) return;
      
      
      const baseH = document.body ? document.body.scrollHeight : document.documentElement.scrollHeight;
      const otherH = Math.max(0, baseH - ta.offsetHeight - state.pickerReservePx);
      const maxH = Math.min(380, Math.max(60, 600 - otherH - 18));
      drag = { startY: event.clientY, lastY: event.clientY, startH: ta.offsetHeight || 40, maxH };
      isManualResizing = true;
      document.body.classList.add("is-dragging-composer");
      ta.style.height = "auto";
      resizeHandle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      isManualResizing = false;
      document.body.classList.remove("is-dragging-composer");
      syncComposerLayout();
    };
    
    window.addEventListener("pointermove", (event) => {
      if (!drag || !(event.buttons & 1)) return;
      drag.lastY = event.clientY;
      applyDragHeight();
    });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }
}

async function handleStorageChange(changes, areaName) {
  if (areaName !== "local") return;
  if (changes[CUSTOM_SITES_STORAGE_KEY]) {
    await refreshAllSites();
    await refreshGroups();
  }
  if (changes[MEMBER_FORBIDDEN_KEY]) {
    
    invalidateBuiltinCache();
    await refreshAllSites();
    
    
    syncPopupAttachmentBadge();
  }
  
  
  if (changes[MEMBER_AUTHORITATIVE_END_KEY]) {
    syncPopupAttachmentBadge();
  }
  if (changes[SEARCH_GROUPS_STORAGE_KEY]) await refreshGroups();
  if (changes[PROMPT_GROUPS_STORAGE_KEY]) await refreshPromptGroups();
  if (changes[UI_PREFS_STORAGE_KEY]) await refreshUiPrefs();
  if (changes[LAST_USED_GROUP_ID_STORAGE_KEY]) {
    state.lastUsedGroupId = changes[LAST_USED_GROUP_ID_STORAGE_KEY].newValue || null;
    renderGroups();
  }
  if (changes[SEARCH_HISTORY_STORAGE_KEY]) {
    await refreshHistory();
    renderHistoryPanel();
    updateHistoryEntryVisibility();
  }
}

async function refreshGroups() {
  
  state.groups = (await loadGroups()).filter((g) => g.enabled !== false);
  renderGroups();
}


async function refreshLastUsedGroup() {
  const obj = await chrome.storage.local.get(LAST_USED_GROUP_ID_STORAGE_KEY);
  state.lastUsedGroupId = obj[LAST_USED_GROUP_ID_STORAGE_KEY] || null;
}

async function refreshPromptGroups() {
  state.promptGroups = await loadPromptGroups();
  if (!state.promptGroups.some((g) => g.id === state.activePromptGroupId)) {
    state.activePromptGroupId = state.promptGroups[0]?.id || null;
  }
  renderPromptPicker();
}

async function refreshUiPrefs() {
  state.uiPrefs = await loadUiPrefs();
  applyUiPrefs();
}

function applyUiPrefs() {
  window.__XUSEARCH_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
  applyDomI18n?.(document);
  applyDarkModeToDoc(state.uiPrefs.darkMode);
  const { promptEntryBtn } = state.dom;

  
  if (promptEntryBtn) {
    promptEntryBtn.hidden = state.uiPrefs.showPromptButton === false;
    promptEntryBtn.style.display =
      state.uiPrefs.showPromptButton === false ? "none" : "inline-flex";
    if (state.uiPrefs.showPromptButton === false) closePromptPicker();
  }
  updateHistoryEntryVisibility();
  updatePromptPickerLayoutState();
}



const HISTORY_LIMIT = 4;
const HISTORY_ITEM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>`;


async function refreshHistory() {
  try {
    const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
    const list = stored[SEARCH_HISTORY_STORAGE_KEY];
    state.historyEntries = Array.isArray(list)
      ? list.filter((entry) => entry && String(entry.query || "").trim()).slice(0, HISTORY_LIMIT)
      : [];
  } catch (_err) {
    state.historyEntries = [];
  }
}

function renderHistoryPanel() {
  const { historyList } = state.dom;
  if (!historyList) return;
  historyList.replaceChildren();
  if (!state.historyEntries.length) {
    const empty = document.createElement("div");
    empty.className = "composer-history-empty";
    empty.textContent = window.__XUSEARCH_I18N__?.t?.("popup_historyEmpty") || "暂无搜索历史";
    historyList.appendChild(empty);
    return;
  }
  state.historyEntries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "composer-history-item";
    btn.dataset.query = entry.query;
    const icon = document.createElement("span");
    icon.className = "composer-history-icon";
    icon.innerHTML = HISTORY_ITEM_ICON;
    const text = document.createElement("span");
    text.className = "composer-history-text";
    text.textContent = entry.query;
    btn.appendChild(icon);
    btn.appendChild(text);
    historyList.appendChild(btn);
  });
}

function toggleHistoryPanel(open) {
  const { composer, historyToggleBtn, historyCollapseBtn } = state.dom;
  const next = Boolean(open);
  if (next && !state.historyEntries.length) return;
  state.isHistoryOpen = next;
  
  composer?.classList.toggle("is-history-open", next);
  
  historyToggleBtn?.setAttribute("aria-expanded", String(next));
  historyCollapseBtn?.setAttribute("aria-expanded", String(next));
  
  if (next && state.isPromptPickerOpen) closePromptPicker();
}

function closeHistoryPanel() {
  if (!state.isHistoryOpen) return;
  toggleHistoryPanel(false);
}


function updateHistoryEntryVisibility() {
  const { historyToggleBtn, composer } = state.dom;
  if (!historyToggleBtn) return;
  const visible = state.uiPrefs.showHistory !== false && state.historyEntries.length > 0;
  historyToggleBtn.hidden = !visible;
  composer?.classList.toggle("has-history-entry", visible);
  if (!visible) closeHistoryPanel();
  
  state.syncChipIndent?.();
}




async function mountUpdateNotice() {
  const panel = document.querySelector(".popup-panel");
  if (!panel || panel.querySelector(".popup-update-notice")) return null;

  let summary = null;
  try {
    summary = await readUpdateSummary();
  } catch (_err) {
    return null;
  }
  if (!hasUpdateSummaryContent(summary)) return null;
  if (Number(summary.version) <= (await readUpdateSeenVersion())) return null;

  const bar = document.createElement("div");
  bar.className = "popup-update-notice";
  bar.innerHTML = `
    <span class="nu-ico" aria-hidden="true">${UPDATE_NOTICE_ICON}</span>
    <span class="nu-txt"></span>
    <button type="button" class="nu-link"></button>
    <button type="button" class="nu-close"></button>
  `;
  bar.querySelector(".nu-txt").textContent = buildUpdateNoticeText(summary);

  const viewBtn = bar.querySelector(".nu-link");
  viewBtn.textContent = tx("popup_updateNoticeView", "查看");
  viewBtn.addEventListener("click", async () => {
    
    await markUpdateSeen(summary.version);
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "groups", openChangelog: true }).catch(() => {});
    window.close();
  });

  const closeBtn = bar.querySelector(".nu-close");
  closeBtn.textContent = "\u00d7";
  closeBtn.setAttribute("aria-label", tx("popup_updateNoticeClose", "关闭"));
  closeBtn.addEventListener("click", async () => {
    await markUpdateSeen(summary.version);
    
    
    
    const area = document.querySelector(".groups-area");
    if (area) {
      const reserved = area.getBoundingClientRect().height + bar.getBoundingClientRect().height;
      area.style.minHeight = `${Math.round(reserved)}px`;
    }
    bar.remove();
  });

  panel.insertBefore(bar, panel.firstChild);
  return bar;
}


async function mountMemberExpiryNotice() {
  const panel = document.querySelector(".popup-panel");
  if (!panel || panel.querySelector(".popup-member-expiry")) return;

  const notice = await getMemberExpiryNotice();
  if (!notice) return;

  const bar = document.createElement("div");
  bar.className = "popup-update-notice popup-member-expiry" + (notice.danger ? " is-danger" : "");
  bar.innerHTML = `
    <span class="nu-ico" aria-hidden="true">${MEMBER_CROWN_SVG}</span>
    <span class="nu-txt"></span>
    <button type="button" class="nu-link"></button>
    <button type="button" class="nu-close"></button>
  `;
  bar.querySelector(".nu-txt").textContent = tx("popup_memberExpiryTitle", "会员还剩 {n} 天到期").replace(
    "{n}",
    String(notice.days),
  );

  const renewBtn = bar.querySelector(".nu-link");
  renewBtn.textContent = tx("popup_memberExpiryCta", "去续费");
  renewBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", openMembership: true }).catch(() => {});
    window.close();
  });

  const closeBtn = bar.querySelector(".nu-close");
  closeBtn.textContent = "\u00d7";
  closeBtn.setAttribute("aria-label", tx("popup_memberExpiryClose", "关闭"));
  closeBtn.addEventListener("click", async () => {
    await dismissMemberExpiryNotice();
    
    const area = document.querySelector(".groups-area");
    if (area) {
      const reserved = area.getBoundingClientRect().height + bar.getBoundingClientRect().height;
      area.style.minHeight = `${Math.round(reserved)}px`;
    }
    bar.remove();
  });

  
  const anchor = panel.querySelector(".popup-update-notice:not(.popup-member-expiry)");
  panel.insertBefore(bar, anchor ?? panel.firstChild);
  return bar;
}


function buildUpdateNoticeText(summary) {
  const head = tx("popup_updateNoticeTitle", "规则库已更新");
  const countOf = (key) => (Array.isArray(summary?.[key]) ? summary[key].length : 0);
  const removed = countOf("removed");
  const added = countOf("added");
  const updated = countOf("updated");
  if (removed) return `${head} · ${tx("popup_updateNoticeRemoved", "{n} 个站点已下线").replace("{n}", String(removed))}`;
  if (added) return `${head} · ${tx("popup_updateNoticeAdded", "{n} 个站点已新增").replace("{n}", String(added))}`;
  if (updated) return `${head} · ${tx("popup_updateNoticeUpdated", "{n} 个站点规则已更新").replace("{n}", String(updated))}`;
  return head;
}

function syncComposerLayout(options = {}) {
  const { composer, queryInput } = state.dom;
  if (!composer || !queryInput) return;
  
  if (isManualResizing) return;

  const lineHeight = parseFloat(window.getComputedStyle(queryInput).lineHeight || "21.75");
  const floor = manualMinHeight || 0;

  
  
  
  const isSettledDefault =
    !floor &&
    !composer.classList.contains("is-expanded") &&
    !queryInput.style.minHeight &&
    !queryInput.style.height;
  if (isSettledDefault && queryInput.scrollHeight <= lineHeight * COMPACT_INPUT_LINES) {
    if (options.scrollToTop) {
      queryInput.scrollTop = 0;
    }
    return;
  }

  
  
  composer.classList.add("is-measuring");
  try {
    
    composer.classList.remove("is-expanded");
    queryInput.style.height = "auto";
    queryInput.style.minHeight = "0px";

    const scrollH = queryInput.scrollHeight;

    
    const shouldExpand = scrollH > lineHeight * 2.7 || floor > 0;

    
    
    
    composer.classList.toggle("is-expanded", shouldExpand);
    composer.classList.toggle("is-manual-resized", floor > 0);

    if (!shouldExpand) {
      
      
      queryInput.style.minHeight = "";
      queryInput.style.height = "";
      queryInput.style.overflowY = "";
      
      lastObservedInputHeight = queryInput.offsetHeight;
    } else {
      
      
      
      
      queryInput.style.overflowY = "hidden";
      const finalScrollH = queryInput.scrollHeight;
      queryInput.style.overflowY = "";

      
      
      
      const bodyH = document.body ? document.body.scrollHeight : document.documentElement.scrollHeight;
      const otherH = Math.max(0, bodyH - queryInput.offsetHeight - state.pickerReservePx);
      
      
      const budgetH = state.isPromptPickerOpen
        ? Math.max(60, Math.min(POPUP_WINDOW_CAP, state.pickerBaseTotalPx || POPUP_WINDOW_CAP))
        : 600 - 8;
      const availableMax = Math.min(380, Math.max(60, budgetH - otherH));

      
      
      const targetH = Math.min(Math.max(finalScrollH, floor), availableMax);
      queryInput.style.minHeight = `${targetH}px`;
      queryInput.style.height = "";
      queryInput.style.overflowY = finalScrollH > targetH ? "auto" : "";
      
      
      lastObservedInputHeight = queryInput.offsetHeight;
    }
  } finally {
    composer.classList.remove("is-measuring");
  }
  if (options.scrollToTop) {
    queryInput.scrollTop = 0;
  }
  
  applyPickerHeightBudget();
}


function applyPickerHeightBudget() {
  const { composer, promptPicker, shell } = state.dom;
  if (!composer || !promptPicker || !shell) return;

  if (!state.isPromptPickerOpen) {
    state.pickerReservePx = 0;
    state.pickerBaseTotalPx = 0;
    shell.style.height = "";
    return;
  }

  
  
  if (promptPicker.hidden) return;

  const composerH = composer.offsetHeight;
  
  
  
  
  const total = Math.min(POPUP_WINDOW_CAP, state.pickerBaseTotalPx || document.body.scrollHeight);
  shell.style.height = `${total}px`;
  
  state.pickerReservePx = Math.max(0, total - composerH - PICKER_MIN_H);
}

function updatePromptPickerLayoutState() {
  const { shell } = state.dom;
  if (!shell) return;
  
  shell.classList.toggle("is-prompt-picker-open", state.isPromptPickerOpen);
  applyPickerHeightBudget();
}
