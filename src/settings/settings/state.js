



import { SIGNED_CONFIGS_STORAGE_KEY } from "../../shared/storage-keys.js";
import { isConfigExpired } from "../../shared/signed-config.js";
import { buildDevMemberGroupDefs } from "./dev-site-categories.js";
import { buildSiteCatalog } from "./site-catalog.js";

const xuSearchI18n = (typeof window !== "undefined" && window.__XUSEARCH_I18N__) || {};
export const t = xuSearchI18n.t;
export const applyDomI18n = xuSearchI18n.applyDomI18n;

export const msg = (key, fallback) => (t ? (t(key) || fallback || "") : fallback || "");

export const PICKER_CLOSE_DELAY_MS = 320;

export const COMMON_SEARCH_PARAM_KEYS = [
  "q", "query", "wd", "word", "kw", "keyword", "s", "search", "key", "k", "text", "term", "w"
];

export const SITE_CATEGORIES = {
  custom: { labelKey: "settings_groups_categoryCustom", label: "自定义", siteIds: [] }
};

export function getSiteCategoryLabel(categoryKey) {
  const category = SITE_CATEGORIES[categoryKey];
  if (!category) return "";
  return category.labelKey ? msg(category.labelKey, category.label) : category.label;
}

let builtinGroupDefsCache = null;


async function loadBuiltinGroupDefs() {
  if (builtinGroupDefsCache) return builtinGroupDefsCache;
  try {
    const lang = String(
      chrome?.i18n?.getUILanguage?.() || navigator?.language || "zh"
    ).toLowerCase();
    const file = lang.startsWith("zh")
      ? "config/initialState.zh-CN.json"
      : "config/initialState.en.json";
    const resp = await fetch(chrome.runtime.getURL(file));
    const payload = resp.ok ? await resp.json() : null;
    builtinGroupDefsCache = Array.isArray(payload?.searchGroups) ? payload.searchGroups : [];
  } catch (_e) {
    builtinGroupDefsCache = [];
  }
  return builtinGroupDefsCache;
}


export async function rebuildSiteCategories() {
  
  for (const key of Object.keys(SITE_CATEGORIES)) {
    if (key.startsWith("group:") || key.startsWith("dev_")) {
      delete SITE_CATEGORIES[key];
    }
  }

  
  let signedConfigs = {};
  try {
    const stored = await chrome.storage.local.get([SIGNED_CONFIGS_STORAGE_KEY]);
    signedConfigs = stored[SIGNED_CONFIGS_STORAGE_KEY] || {};
  } catch (_e) {
    
  }

  
  const bundleGroups = [];
  for (const entry of Object.values(signedConfigs)) {
    if (entry?.config && (await isConfigExpired(entry.config))) continue;
    if (Array.isArray(entry?.config?.groups)) bundleGroups.push(...entry.config.groups);
  }

  const allSiteIds = (state.sites || []).map((s) => s?.id).filter(Boolean);
  const defs = buildSiteCatalog({
    builtinGroups: await loadBuiltinGroupDefs(),
    bundleGroups,
    
    
    devMemberGroups: await buildDevMemberGroupDefs(),
    validSiteIds: allSiteIds,
  });

  for (const def of defs) {
    SITE_CATEGORIES[def.key] = {
      label: def.label,
      siteIds: def.siteIds,
      isGroupTab: true,
    };
  }
}

export const SECTION_META = {
  groups: {
    eyebrowKey: "settings_groupsTitle",
    eyebrow: "搜索组设置",
    titleKey: "settings_sectionTitle_groups",
    title: "分组与调用内容",
    subtitleKey: "settings_sectionSubtitle_groups",
    subtitle: "管理搜索组名称、启用状态、打开方式，以及每个组内调用的网站或 AI 模型。"
  },
  prompts: {
    eyebrowKey: "settings_promptsTitle",
    eyebrow: "提示词设置",
    titleKey: "settings_meta_promptsTitle",
    title: "提示词管理",
    subtitleKey: "settings_meta_promptsSubtitle",
    subtitle: "自由添加和管理您的常用提示词，让每次输入更高效。"
  },
  custom: {
    eyebrowKey: "settings_customTitle",
    eyebrow: "自定义搜索",
    titleKey: "settings_meta_customTitle",
    title: "自定义搜索站点",
    subtitleKey: "settings_meta_customSubtitle",
    subtitle: "添加自己的搜索站点，保存后可在搜索组的“自定义”分类中直接勾选。"
  },
  other: {
    eyebrowKey: "settings_shortcutsTitle",
    eyebrow: "进阶搜索项",
    
    
    
    titleKey: "settings_otherPageTitle",
    title: "进阶搜索项",
    subtitleKey: "settings_otherPageSubtitle",
    subtitle: "全局快捷键、右键提示词、划词气泡与附件上传。所有设置仅保存在本地浏览器。"
  },
  misc: {
    eyebrow: "",
    titleKey: "settings_miscTitle",
    title: "显示与备份",
    subtitleKey: "settings_miscSubtitleV2",
    subtitle: "界面外观、搜索框展示内容与配置备份。所有数据仅保存在本地浏览器。"
  },
  aiSummary: {
    eyebrowKey: "settings_aiSummaryEyebrow",
    eyebrow: "AI 总结设置",
    titleKey: "settings_aiSummaryTitle",
    title: "AI 总结相关",
    subtitleKey: "settings_aiSummarySubtitle",
    subtitle: "添加一个或多个 OpenAI 兼容的自定义 API，用于总结搜索结果页所有 AI 卡片的回答。"
  },
  about: {
    eyebrow: "",
    title: "",
    subtitle: ""
  }
};

export const GROUP_MODE_OPTIONS = [
  { value: "compare", labelKey: "settings_groups_modeCompare", label: "卡片呈现" },
  { value: "tabs", labelKey: "settings_groups_modeTabs", label: "新开标签" }
];

export function getGroupModeLabel(option) {
  return msg(option.labelKey, option.label);
}


export const state = {
  groups: [],
  promptGroups: [],
  uiPrefs: null,
  sites: [],
  customSites: [],
  customFormState: createBlankCustomFormState(),
  
  customEditState: null,
  activeCustomTab: "search",
  activeMiscTab: "other",
  activeSection: "groups",
  selectionContextGroups: [],
  openCtxPickerGroupId: null,
  activeCtxPickerCategoryKey: null,
  ctxPickerCloseTimerId: null,
  openPickerGroupId: null,
  activePickerCategoryKey: null,
  pickerCloseTimerId: null,
  suppressPickerAnimation: false,
  activePromptGroupId: null,
  promptEditorState: null,
  pendingPromptGroupFocusId: null,
  renamingPromptGroupId: null,
  importModalState: null,
  _promptHoverTimer: null,
  _hoverCardKeyHandler: null,
  
  dom: {
    groupsSection: null,
    promptsSection: null,
    customSection: null,
    otherSection: null,
    miscSection: null,
    aiSummarySection: null,
    aboutSection: null,
    sectionEyebrow: null,
    sectionContentHeader: null,
    sectionTitleRow: null,
    sectionTitle: null,
    sectionSubtitle: null,
    navItems: [],
  },
  
  
  renderCurrentSection: () => {},
  renderGroupsSection: () => {},
  renderPromptsSection: () => {},
  renderCustomSection: () => {},
  renderOtherSection: () => {},
  renderMiscSection: () => {},
  renderAiSummarySection: () => {},
  renderAboutSection: () => {},
  
  reloadSettingsData: async () => 0,
};

export function createBlankCustomFormState() {
  return {
    name: "",
    url: "",
    converterInput: "",
    converterError: "",
    formError: ""
  };
}
