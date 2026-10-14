


import {
  SEARCH_GROUPS_STORAGE_KEY as GROUPS_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY as PROMPTS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CUSTOM_SITES_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
  BUNDLE_UPDATE_SUMMARY_KEY,
  MEMBER_FORBIDDEN_KEY,
} from "../../shared/storage-keys.js";
import {
  state,
  msg,
  applyDomI18n,
  SECTION_META,
  rebuildSiteCategories,
} from "./state.js";
import { loadBuiltinSites } from "./utils.js";
import {
  createNormalizedGroups,
  createNormalizedSelectionContextGroups,
  createNormalizedPromptGroups,
  createNormalizedUiPrefs,
  createNormalizedCustomSites,
  mergeSites,
  syncCustomCategoryIds,
} from "./store.js";
import { attachGroupDrag } from "./drag.js";
import { renderGroupsSection, closePicker } from "./sections/groups.js";
import { renderPromptsSection, resetPromptsActiveGroup } from "./sections/prompts.js";
import { createAiPageLauncherInlineSwitch } from "./sections/prompts-ai-launcher-setting.js";
import { renderCustomSection } from "./sections/custom.js";
import { renderOtherSection } from "./sections/other.js";
import { closeCtxPicker } from "./sections/selection-context-groups.js";
import { renderMiscSection } from "./sections/misc.js";
import { createAiSummaryProviderCard, createFreeApiEntryButton } from "./sections/misc-ai-summary.js";
import { applyDarkModeToDoc } from "../../shared/theme.js";
import { renderAboutSection } from "./sections/about.js";
import {
  createChangelogEntryButton,
  openChangelogModal,
  refreshChangelogEntryBadge,
} from "./sections/changelog.js";
import { openMembershipModal, renderMembershipEntry } from "./sections/membership.js";
import { invalidateBuiltinCache } from "../../shared/site-registry.js";

export function initSettingsPage() {
  document.addEventListener("DOMContentLoaded", start);
}

function cacheElements() {
  state.dom.groupsSection = document.getElementById("groupsSection");
  state.dom.promptsSection = document.getElementById("promptsSection");
  state.dom.customSection = document.getElementById("customSection");
  state.dom.otherSection = document.getElementById("otherSection");
  state.dom.miscSection = document.getElementById("miscSection");
  state.dom.aiSummarySection = document.getElementById("aiSummarySection");
  state.dom.aboutSection = document.getElementById("aboutSection");
  state.dom.groupsHeaderActions = document.getElementById("groupsHeaderActions");
  state.dom.aiSummaryHeaderActions = document.getElementById("aiSummaryHeaderActions");
  state.dom.sectionEyebrow = document.getElementById("sectionEyebrow");
  state.dom.sectionContentHeader = document.querySelector(".settings-content-header");
  state.dom.sectionTitleRow = document.getElementById("sectionTitleRow");
  state.dom.sectionTitle = document.getElementById("sectionTitle");
  state.dom.sectionSubtitle = document.getElementById("sectionSubtitle");
  state.dom.navItems = Array.from(document.querySelectorAll(".settings-nav-item"));

  
  
  const versionEl = document.getElementById("sidebarVersion");
  if (versionEl) {
    try {
      versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
    } catch (_err) {
      versionEl.textContent = "";
    }
  }
}

function registerRenderCallbacks() {
  state.renderCurrentSection = renderCurrentSection;
  state.renderGroupsSection = renderGroupsSection;
  state.renderPromptsSection = renderPromptsSection;
  state.renderCustomSection = renderCustomSection;
  state.renderOtherSection = renderOtherSection;
  state.renderMiscSection = renderMiscSection;
  state.renderAiSummarySection = renderAiSummarySection;
  state.renderAboutSection = renderAboutSection;
  
  state.reloadSettingsData = scheduleReloadSettingsData;
  
  
  
  
  
  
  state.syncRenderedGroupsSignature = () => {
    renderedGroupsSignature = groupsSignature(createNormalizedGroups(state.groups));
  };
}


function groupsSignature(list) {
  return JSON.stringify(
    (Array.isArray(list) ? list : []).map((g) => [
      g?.id,
      g?.name,
      g?.enabled !== false,
      g?.mode || "compare",
      (Array.isArray(g?.siteIds) ? g.siteIds : []).join(","),
    ]),
  );
}


let renderedGroupsSignature = "";


async function reloadSettingsData() {
  invalidateBuiltinCache();
  const builtinSites = await loadBuiltinSites();
  state.sites = mergeSites(builtinSites, state.customSites);

  
  
  const stored = await chrome.storage.local.get([GROUPS_STORAGE_KEY]);
  state.groups = createNormalizedGroups(stored[GROUPS_STORAGE_KEY]);
  await rebuildSiteCategories();
  syncCustomCategoryIds();

  renderedGroupsSignature = groupsSignature(state.groups);
  renderGroupsSection();
  return state.groups.length;
}


let reloadInFlight = null;

let reloadQueued = false;


function scheduleReloadSettingsData() {
  if (reloadInFlight) {
    reloadQueued = true;
    return reloadInFlight;
  }
  const task = reloadSettingsData().finally(() => {
    reloadInFlight = null;
    if (reloadQueued) {
      reloadQueued = false;
      scheduleReloadSettingsData();
    }
  });
  reloadInFlight = task;
  return task;
}


function watchExternalGroupChanges() {
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      
      
      if (changes[BUNDLE_UPDATE_SUMMARY_KEY]) {
        refreshChangelogEntryBadge().catch(() => {});
      }
      
      
      if (changes[MEMBER_FORBIDDEN_KEY]) {
        scheduleReloadSettingsData().catch(() => {
          
        });
      }
      if (!changes[GROUPS_STORAGE_KEY]) return;
      const next = createNormalizedGroups(changes[GROUPS_STORAGE_KEY].newValue);
      if (groupsSignature(next) === renderedGroupsSignature) return;
      scheduleReloadSettingsData().catch(() => {
        
      });
    });
  } catch (_err) {
    
  }
}

async function start() {
  
  chrome.runtime.sendMessage({ type: "ENSURE_BUNDLE", trigger: "settings" }).catch(() => {
    
  });

  cacheElements();
  registerRenderCallbacks();
  watchExternalGroupChanges();

  const [builtinSites, stored] = await Promise.all([
    loadBuiltinSites(),
    chrome.storage.local.get([
      GROUPS_STORAGE_KEY,
      PROMPTS_STORAGE_KEY,
      UI_PREFS_STORAGE_KEY,
      CUSTOM_SITES_STORAGE_KEY,
      SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
    ]),
  ]);
  state.customSites = createNormalizedCustomSites(stored[CUSTOM_SITES_STORAGE_KEY]);
  state.sites = mergeSites(builtinSites, state.customSites);
  
  state.groups = createNormalizedGroups(stored[GROUPS_STORAGE_KEY]);
  await rebuildSiteCategories();
  syncCustomCategoryIds();
  
  renderedGroupsSignature = groupsSignature(state.groups);
  state.selectionContextGroups = createNormalizedSelectionContextGroups(
    stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]
  );
  state.promptGroups = createNormalizedPromptGroups(stored[PROMPTS_STORAGE_KEY]);
  state.uiPrefs = createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
  applyDarkModeToDoc(state.uiPrefs.darkMode);
  window.__XUSEARCH_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
  applyDomI18n?.(document);
  state.activePromptGroupId = state.promptGroups[0]?.id || null;

  if (!Array.isArray(stored[GROUPS_STORAGE_KEY]) || stored[GROUPS_STORAGE_KEY].length === 0) {
    await chrome.storage.local.set({ [GROUPS_STORAGE_KEY]: state.groups });
  }
  if (!Array.isArray(stored[PROMPTS_STORAGE_KEY]) || stored[PROMPTS_STORAGE_KEY].length === 0) {
    await chrome.storage.local.set({ [PROMPTS_STORAGE_KEY]: state.promptGroups });
  }
  if (!stored[UI_PREFS_STORAGE_KEY] || typeof stored[UI_PREFS_STORAGE_KEY] !== "object") {
    await chrome.storage.local.set({ [UI_PREFS_STORAGE_KEY]: state.uiPrefs });
  }
  if (!Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY])) {
    await chrome.storage.local.set({ [CUSTOM_SITES_STORAGE_KEY]: state.customSites });
  }

  bindEvents();
  const urlParams = new URLSearchParams(location.search);
  const miscTab = urlParams.get("miscTab");
  let hashSection = urlParams.get("section") || location.hash.replace("#", "");
  
  if (hashSection === "misc" && miscTab === "ai") {
    hashSection = "aiSummary";
  }
  if (hashSection && SECTION_META[hashSection]) {
    setActiveSection(hashSection);
  } else {
    setActiveSection(state.activeSection);
  }
  
  if (urlParams.get("changelog") === "1") {
    openChangelogModal().catch(() => {
      
    });
  }

  
  if (urlParams.get("membership") === "1") {
    openMembershipModal().catch(() => {
      
    });
  }
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  attachGroupDrag(state.dom.groupsSection);

  state.dom.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActiveSection(item.dataset.section || "groups");
    });
  });
}

function handleDocumentClick(event) {
  if (state.openPickerGroupId && !event.target.closest(".inline-add-wrap")) {
    closePicker();
    renderGroupsSection();
    return;
  }
  if (state.openCtxPickerGroupId && !event.target.closest(".inline-add-wrap")) {
    closeCtxPicker();
    renderOtherSection();
    return;
  }

  if (!event.target.closest(".group-mode-dropdown")) {
    document.querySelectorAll(".group-mode-dropdown").forEach((dropdown) => {
      dropdown.classList.remove("is-open");
      const trigger = dropdown.querySelector("[data-field='mode-trigger']");
      const menu = dropdown.querySelector("[data-field='mode-menu']");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
      if (menu) {
        menu.hidden = true;
      }
    });
  }
}

function setActiveSection(sectionKey) {
  if (!SECTION_META[sectionKey]) {
    return;
  }
  state.activeSection = sectionKey;
  state.dom.navItems.forEach((item) =>
    item.classList.toggle("is-active", item.dataset.section === sectionKey)
  );
  const meta = SECTION_META[sectionKey];
  const eyebrow = meta.eyebrowKey ? msg(meta.eyebrowKey, meta.eyebrow) : (meta.eyebrow || "");
  const title = meta.titleKey ? msg(meta.titleKey, meta.title) : (meta.title || "");
  const subtitle = meta.subtitleKey ? msg(meta.subtitleKey, meta.subtitle) : (meta.subtitle || "");
  state.dom.sectionEyebrow.textContent = eyebrow;
  state.dom.sectionEyebrow.hidden = true;
  state.dom.sectionTitle.textContent = title;
  state.dom.sectionTitle.hidden = !title;
  state.dom.sectionSubtitle.textContent = subtitle;
  state.dom.sectionSubtitle.hidden = !subtitle;
  state.dom.sectionTitleRow.hidden = !title && sectionKey !== "prompts";
  if (state.dom.sectionContentHeader) {
    state.dom.sectionContentHeader.hidden =
      !title && !subtitle && sectionKey !== "prompts";
  }
  
  
  if (sectionKey === "prompts") {
    resetPromptsActiveGroup();
  }
  updateSectionVisibility();
  renderCurrentSection();
}

function renderAiSummarySection() {
  const { aiSummarySection } = state.dom;
  if (!aiSummarySection) return;
  aiSummarySection.innerHTML = "";
  aiSummarySection.appendChild(createAiSummaryProviderCard());
}


function renderPromptsHeaderActions() {
  const host = document.getElementById("promptsHeaderActions");
  if (!host) return;
  const isPrompts = state.activeSection === "prompts";
  host.hidden = !isPrompts;
  if (!isPrompts) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML = "";
  host.appendChild(createAiPageLauncherInlineSwitch());
}

function renderCurrentSection() {
  updateSectionVisibility();
  renderPromptsHeaderActions();
  if (state.activeSection === "prompts") {
    renderPromptsSection();
    return;
  }
  if (state.activeSection === "custom") {
    renderCustomSection();
    return;
  }
  if (state.activeSection === "other") {
    renderOtherSection();
    return;
  }
  if (state.activeSection === "misc") {
    renderMiscSection();
    return;
  }
  if (state.activeSection === "aiSummary") {
    renderAiSummarySection();
    return;
  }
  if (state.activeSection === "about") {
    renderAboutSection();
    return;
  }
  renderGroupsSection();
}

function updateSectionVisibility() {
  const { dom } = state;
  const showGroups = state.activeSection === "groups";
  const showPrompts = state.activeSection === "prompts";
  const showCustom = state.activeSection === "custom";
  const showOther = state.activeSection === "other";
  const showMisc = state.activeSection === "misc";
  const showAiSummary = state.activeSection === "aiSummary";
  const showAbout = state.activeSection === "about";
  const showChangelog = state.activeSection === "changelog";
  const showMembership = state.activeSection === "membership";
  if (dom.groupsSection) {
    dom.groupsSection.hidden = !showGroups;
    dom.groupsSection.style.display = showGroups ? "" : "none";
  }
  if (dom.promptsSection) {
    dom.promptsSection.hidden = !showPrompts;
    dom.promptsSection.style.display = showPrompts ? "flex" : "none";
  }
  if (dom.customSection) {
    dom.customSection.hidden = !showCustom;
    dom.customSection.style.display = showCustom ? "flex" : "none";
  }
  if (dom.otherSection) {
    dom.otherSection.hidden = !showOther;
    dom.otherSection.style.display = showOther ? "flex" : "none";
  }
  if (dom.miscSection) {
    dom.miscSection.hidden = !showMisc;
    dom.miscSection.style.display = showMisc ? "flex" : "none";
  }
  if (dom.aiSummarySection) {
    dom.aiSummarySection.hidden = !showAiSummary;
    dom.aiSummarySection.style.display = showAiSummary ? "flex" : "none";
  }
  if (dom.aboutSection) {
    dom.aboutSection.hidden = !showAbout;
    dom.aboutSection.style.display = showAbout ? "flex" : "none";
  }
  if (dom.groupsHeaderActions) {
    dom.groupsHeaderActions.hidden = !showGroups;
    if (showGroups && dom.groupsHeaderActions.dataset.ready !== "1") {
      dom.groupsHeaderActions.dataset.ready = "1";
      
      renderMembershipEntry().then(() => {
        const changelogBtn = createChangelogEntryButton();
        if (changelogBtn) dom.groupsHeaderActions.appendChild(changelogBtn);
      });
    }
  }
  if (dom.aiSummaryHeaderActions) {
    dom.aiSummaryHeaderActions.hidden = !showAiSummary;
    if (showAiSummary && dom.aiSummaryHeaderActions.dataset.ready !== "1") {
      dom.aiSummaryHeaderActions.dataset.ready = "1";
      dom.aiSummaryHeaderActions.appendChild(createFreeApiEntryButton());
    }
  }
}
