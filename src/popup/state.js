import {
  SEARCH_GROUPS_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { loadEnabledSites } from "../shared/site-registry.js";



export const state = {
  groups: [],
  
  activeRunGroup: null,
  
  lastUsedGroupId: null,
  
  groupDisplayOrder: [],
  promptGroups: [],
  allSites: [],
  uiPrefs: createNormalizedUiPrefs(),
  activePromptGroupId: null,
  isPromptPickerOpen: false,
  
  isHistoryOpen: false,
  historyEntries: [],
  popupPreviewMgr: null,
  composerResizeObserver: null,
  
  
  pickerReservePx: 0,
  
  pickerBaseTotalPx: 0,
  
  dom: {
    queryInput: null,
    composer: null,
    groupsContainer: null,
    openSettingsBtn: null,
    promptEntryBtn: null,
    composerActionsRow: null,
    promptPicker: null,
    shell: null,
    historyToggleBtn: null,
    historyPanel: null,
    historyList: null,
    historyCollapseBtn: null,
  },
  
  
  syncComposerLayout: () => {},
  updatePromptPickerLayoutState: () => {},
  syncChipIndent: () => {},
};

export function createNormalizedUiPrefs(input) {
  const src = input && typeof input === "object" ? input : {};
  const rawLocale = src.localeMode;
  const localeMode = rawLocale === "zh" || rawLocale === "en" || rawLocale === "auto" ? rawLocale : "auto";
  return {
    
    
    showHistory: src.showHistory !== false,
    showPromptButton: src.showPromptButton !== false,
    darkMode: src.darkMode === "dark" || src.darkMode === "light" ? src.darkMode
             : src.darkMode === true ? "dark" : "auto",
    localeMode
  };
}

export function normalizeSiteHomeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let next = raw.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
  next = next.replace(/\?&/, "?");
  next = next.replace(/[?&]$/, "");
  next = next.replace(/\{query\}/g, "");
  if (!/^https?:\/\//i.test(next)) return "";
  return next;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function loadGroups() {
  const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
  return Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY])
    ? stored[SEARCH_GROUPS_STORAGE_KEY]
    : [];
}

export async function loadPromptGroups() {
  const stored = await chrome.storage.local.get([PROMPT_GROUPS_STORAGE_KEY]);
  const source = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY])
    ? stored[PROMPT_GROUPS_STORAGE_KEY]
    : [];
  return source.map((group, gi) => ({
    id: String(group.id || `prompt-group-${gi}`),
    name: String(group.name || "未命名分组"),
    prompts: Array.isArray(group.prompts)
      ? group.prompts.map((p, pi) => ({
          id: String(p.id || `prompt-${gi}-${pi}`),
          title: String(p.title || "未命名提示词"),
          content: String(p.content || ""),
        }))
      : [],
  }));
}

export async function loadUiPrefs() {
  const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
  return createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
}

export async function refreshAllSites() {
  try {
    state.allSites = await loadEnabledSites({ fallbackEmpty: true });
  } catch (_e) {
    state.allSites = [];
  }
}
