import { state, elements, STORAGE_KEYS } from "./state.js";
import { parseRequestedSiteIds, normalizePromptGroups } from "./utils.js";
import { updateLayoutUi } from "./layout.js";
import { renderHistoryList } from "./history.js";
import { renderPromptPicker } from "./prompts.js";

export function cacheElements() {
  elements.queryInput = document.getElementById("queryInput");
  elements.sendSelectedBtn = document.getElementById("sendSelectedBtn");
  elements.promptAssistBtn = document.getElementById("promptAssistBtn");
  elements.promptPicker = document.getElementById("promptPicker");
  elements.globalStatus = document.getElementById("globalStatus");
  elements.iframesContainer = document.getElementById("iframes-container");
  elements.layoutToggleBtn = document.getElementById("layoutToggleBtn");
  elements.layoutPopover = document.getElementById("layoutPopover");
  
  
  elements.layoutRowsButtons = Array.from(document.querySelectorAll("[data-layout-rows]"));
  elements.aiSummaryBtn = document.getElementById("aiSummaryBtn");
  elements.exportBtn = document.getElementById("exportBtn");
  elements.historyToggleBtn = document.getElementById("historyToggleBtn");
  elements.historyPanel = document.getElementById("historyPanel");
  elements.historyList = document.getElementById("historyList");
  elements.historyFilterBar = document.getElementById("historyFilterBar");
  elements.historyFilterBtns = Array.from(document.querySelectorAll("[data-history-filter]"));
  elements.historySearchInput = document.getElementById("historySearchInput");
  elements.closeHistoryPanelBtn = document.getElementById("closeHistoryPanelBtn");
  elements.closeHistoryFooterBtn = document.getElementById("closeHistoryFooterBtn");
  elements.clearHistoryBtn = document.getElementById("clearHistoryBtn");
  elements.siteNavPanel = document.getElementById("siteNavPanel");
  elements.siteNavList = document.getElementById("siteNavList");
  elements.hScrollStrip = document.getElementById("hScrollStrip");
  elements.hScrollThumb = document.getElementById("hScrollThumb");
  elements.settingsBtn = document.getElementById("settingsBtn");
  elements.cardNavScrollLeftBtn = document.getElementById("cardNavScrollLeftBtn");
  elements.cardNavScrollRightBtn = document.getElementById("cardNavScrollRightBtn");
  elements.cardNavStrip = document.getElementById("cardNavStrip");
  elements.fileUploadBtn = document.getElementById("fileUploadBtn");
  elements.fileUploadInput = document.getElementById("fileUploadInput");
  
  
  
}

export function hydrateQueryFromUrl() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q");
  const sitesParam = url.searchParams.get("sites");
  state.restoreHistoryEntryId = url.searchParams.get("restoreHistoryId");
  state.shouldAutoSend = url.searchParams.get("autosend") === "1";
  state.requestedSiteIds = parseRequestedSiteIds(sitesParam);
  if (query) {
    elements.queryInput.value = query;
    url.searchParams.delete("q");
    history.replaceState({}, "", url.toString());
  }
}

export async function restorePreferences(preloaded) {
  const stored = preloaded || await chrome.storage.local.get([
    STORAGE_KEYS.cardSizeLevel,
    STORAGE_KEYS.layoutRows,
    STORAGE_KEYS.layoutMode,
    STORAGE_KEYS.searchHistory,
    STORAGE_KEYS.promptGroups,
  ]);

  if (typeof stored[STORAGE_KEYS.cardSizeLevel] === "string") {
    const legacy = { small: "2", medium: "3", large: "5" };
    const raw = stored[STORAGE_KEYS.cardSizeLevel];
    state.cardSizeLevel = legacy[raw] || raw;
  }
  
  
  
  if (typeof stored[STORAGE_KEYS.layoutRows] === "number") {
    const rows = stored[STORAGE_KEYS.layoutRows];
    if (rows === 1) {
      state.layoutRows = 2;
      state.layoutMode = "sidebar";
    } else if (rows === 2 || rows === 3) {
      state.layoutRows = rows;
    }
  }
  if (stored[STORAGE_KEYS.layoutMode] === "sidebar" || stored[STORAGE_KEYS.layoutMode] === "grid") {
    state.layoutMode = stored[STORAGE_KEYS.layoutMode];
  }
  if (Array.isArray(stored[STORAGE_KEYS.searchHistory])) {
    state.searchHistory = stored[STORAGE_KEYS.searchHistory];
  }
  state.promptGroups = normalizePromptGroups(stored[STORAGE_KEYS.promptGroups]);
  if (!state.promptGroups.some((group) => group.id === state.activePromptGroupId)) {
    state.activePromptGroupId = state.promptGroups[0]?.id || null;
  }
  elements.iframesContainer.dataset.columns = "1";
  updateLayoutUi();
  renderHistoryList();
  renderPromptPicker();
}

export async function savePreferences() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.cardSizeLevel]: state.cardSizeLevel,
    [STORAGE_KEYS.layoutRows]: state.layoutRows,
    [STORAGE_KEYS.layoutMode]: state.layoutMode,
    [STORAGE_KEYS.searchHistory]: state.searchHistory,
  });
}
