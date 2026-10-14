
import {
  SEARCH_GROUPS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  AI_SUMMARY_SETTINGS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { saveAiSummarySettings } from "../shared/ai-summary-api.js";

export async function ensureInitialStateDefaults() {
  
  const stored = await chrome.storage.local.get([
    SEARCH_GROUPS_STORAGE_KEY,
    "promptGroups",
    SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
    "customSites",
    UI_PREFS_STORAGE_KEY,
    AI_SUMMARY_SETTINGS_STORAGE_KEY,
  ]);

  
  let defaultsPreview = null;
  try {
    defaultsPreview = await loadInitialStateFromConfig();
  } catch (_error) {
    defaultsPreview = null;
  }

  const hasGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) && stored[SEARCH_GROUPS_STORAGE_KEY].length > 0;
  
  
  
  
  let hasPromptGroups = Array.isArray(stored.promptGroups) && stored.promptGroups.length > 0;
  if (hasPromptGroups && Array.isArray(defaultsPreview?.promptGroups)) {
    const builtinGroupIds = new Set(defaultsPreview.promptGroups.map((g) => g?.id).filter(Boolean));
    hasPromptGroups = (stored.promptGroups || []).some((g) => g?.id && builtinGroupIds.has(g.id));
  }
  const hasSelectionContextGroups = Array.isArray(stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY])
    && stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY].length > 0;
  const hasCustomSites = Array.isArray(stored.customSites);
  const hasUiPrefs = stored[UI_PREFS_STORAGE_KEY] && typeof stored[UI_PREFS_STORAGE_KEY] === "object";
  const hasAiSummarySettings = stored[AI_SUMMARY_SETTINGS_STORAGE_KEY]
    && typeof stored[AI_SUMMARY_SETTINGS_STORAGE_KEY] === "object";

  
  if (
    hasGroups
    && hasPromptGroups
    && hasSelectionContextGroups
    && hasCustomSites
    && hasUiPrefs
    && hasAiSummarySettings
  ) {
    return;
  }

  
  const defaults = defaultsPreview;
  if (!defaults) return;

  const patch = {};
  if (!hasGroups && Array.isArray(defaults.searchGroups) && defaults.searchGroups.length > 0) {
    patch[SEARCH_GROUPS_STORAGE_KEY] = defaults.searchGroups;
  }
  
  
  
  if (!hasPromptGroups && Array.isArray(defaults.promptGroups) && defaults.promptGroups.length > 0) {
    patch.promptGroups = stampBuiltinPrompts(defaults.promptGroups);
  }
  if (
    !hasSelectionContextGroups
    && Array.isArray(defaults.selectionContextGroups)
    && defaults.selectionContextGroups.length > 0
  ) {
    patch[SELECTION_CONTEXT_GROUPS_STORAGE_KEY] = defaults.selectionContextGroups;
  }
  if (!hasCustomSites && Array.isArray(defaults.customSites)) {
    patch.customSites = defaults.customSites;
  }
  if (!hasUiPrefs && defaults.uiPrefs && typeof defaults.uiPrefs === "object") {
    patch[UI_PREFS_STORAGE_KEY] = defaults.uiPrefs;
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
  if (!hasAiSummarySettings && defaults.aiSummarySettings && typeof defaults.aiSummarySettings === "object") {
    await saveAiSummarySettings(defaults.aiSummarySettings);
  }
}


function stampBuiltinPrompts(groups) {
  return groups.map((group) => ({
    ...group,
    prompts: (group.prompts || []).map((prompt) => ({ ...prompt, isBuiltin: true })),
  }));
}

async function loadInitialStateFromConfig() {
  const configPath = getInitialStateConfigPath();
  let resp = await fetch(chrome.runtime.getURL(configPath));
  if (!resp.ok && configPath !== "config/initialState.json") {
    resp = await fetch(chrome.runtime.getURL("config/initialState.json"));
  }
  if (!resp.ok) {
    throw new Error("无法读取初始配置");
  }
  const payload = await resp.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("初始配置无效");
  }

  const {
    searchGroups,
    promptGroups,
    selectionContextGroups,
    customSites,
    aiSummarySettings,
    uiPrefs,
  } = payload;
  if (!Array.isArray(searchGroups)) return null;
  if (!Array.isArray(promptGroups) || promptGroups.length === 0) return null;
  if (!Array.isArray(customSites)) return null;
  if (!uiPrefs || typeof uiPrefs !== "object") return null;

  return {
    searchGroups,
    promptGroups,
    selectionContextGroups: Array.isArray(selectionContextGroups) ? selectionContextGroups : [],
    customSites,
    aiSummarySettings: aiSummarySettings && typeof aiSummarySettings === "object" ? aiSummarySettings : null,
    uiPrefs,
  };
}

function getInitialStateConfigPath() {
  const lang = getBrowserLanguage();
  if (lang.startsWith("zh")) {
    return "config/initialState.zh-CN.json";
  }
  return "config/initialState.en.json";
}

function getBrowserLanguage() {
  try {
    const chromeLang = chrome?.i18n?.getUILanguage?.();
    if (chromeLang) return String(chromeLang).toLowerCase();
  } catch (_e) {
    
  }
  try {
    return String(navigator?.language || "en").toLowerCase();
  } catch (_e) {
    return "en";
  }
}
