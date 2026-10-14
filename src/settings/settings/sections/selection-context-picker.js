

import {
  state,
  msg,
  SITE_CATEGORIES,
  getSiteCategoryLabel,
  PICKER_CLOSE_DELAY_MS,
} from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll, getCategorySites } from "../store.js";
import { decorateSiteAvatar } from "../site-icons.js";
import { getSiteDomain, siteNameHue } from "./groups.js";

const MAX_CUSTOM_SITES = 5;

function getCtxGroupById(id) {
  return state.selectionContextGroups.find((g) => g.id === id);
}

export function createHoverPicker(group) {
  const panel = document.createElement("div");
  panel.className = "hover-picker-panel is-open";
  panel.addEventListener("click", (e) => e.stopPropagation());
  panel.addEventListener("mouseenter", clearCtxPickerTimer);
  panel.addEventListener("mouseleave", scheduleCtxPickerClose);

  const activeKey = state.activeCtxPickerCategoryKey || Object.keys(SITE_CATEGORIES)[0];

  
  const tabBar = document.createElement("div");
  tabBar.className = "hover-picker-tab-bar";
  Object.entries(SITE_CATEGORIES).forEach(([key]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hover-picker-tab" + (activeKey === key ? " is-active" : "");
    btn.innerHTML = `<span class="hover-picker-tab-label">${escapeHtml(getSiteCategoryLabel(key))}</span><span class="hover-picker-tab-count">${getCategorySites(key).length}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearCtxPickerTimer();
      if (state.activeCtxPickerCategoryKey !== key) {
        state.activeCtxPickerCategoryKey = key;
        state.renderOtherSection();
      }
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  const categorySites = getCategorySites(activeKey);
  const pickedInCategory = categorySites.filter((site) => (group.siteIds || []).includes(site.id)).length;

  
  const meta = document.createElement("div");
  meta.className = "hover-picker-meta";
  meta.innerHTML = `
    <span class="hover-picker-meta-text">${escapeHtml(getSiteCategoryLabel(activeKey))} · ${categorySites.length} ${escapeHtml(msg("settings_groups_siteUnit", "个站点"))} · ${escapeHtml(msg("settings_groups_pickedPrefix", "已选"))} ${pickedInCategory}</span>
    <span class="hover-picker-meta-hint">${escapeHtml(msg("settings_groups_pickerMaxHint", "每组最多 5 个站点"))}</span>
  `;
  panel.appendChild(meta);

  const content = document.createElement("div");
  content.className = "hover-picker-tab-content";

  if (!categorySites.length) {
    const empty = document.createElement("div");
    empty.className = "hover-picker-empty";
    empty.innerHTML =
      activeKey === "custom"
        ? msg("settings_groups_customEmpty", `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往「自定义搜索」添加</span>`)
        : escapeHtml(msg("settings_ctx_categoryEmpty", "该分类暂无可用站点"));
    content.appendChild(empty);
  } else {
    const tileGrid = document.createElement("div");
    tileGrid.className = "site-picker-grid";
    categorySites.forEach((site) => tileGrid.appendChild(createCtxPickerTile(group, site, activeKey)));
    content.appendChild(tileGrid);
  }
  panel.appendChild(content);
  return panel;
}


function createCtxPickerTile(group, site, categoryKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  const selected = (group.siteIds || []).includes(site.id);
  const atMax = !selected && (group.siteIds || []).length >= MAX_CUSTOM_SITES;
  const label = site.name || site.id;
  btn.className = `site-picker-tile${selected ? " is-selected" : ""}`;
  btn.setAttribute("aria-pressed", selected ? "true" : "false");
  if (atMax) btn.disabled = true;

  btn.innerHTML = `
    <span class="site-picker-avatar" style="--site-hue:${siteNameHue(label)}" aria-hidden="true">${escapeHtml([...label][0] || "?")}</span>
    <span class="site-picker-main">
      <span class="site-picker-name">${escapeHtml(label)}</span>
      <span class="site-picker-domain">${escapeHtml(getSiteDomain(site))}</span>
    </span>
    <span class="site-picker-check" aria-hidden="true"></span>
  `;

  
  decorateSiteAvatar(btn.querySelector(".site-picker-avatar"), site);

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const g = getCtxGroupById(group.id);
    if (!g) return;
    if (selected) {
      g.siteIds = (g.siteIds || []).filter((id) => id !== site.id);
    } else {
      if ((g.siteIds || []).length >= MAX_CUSTOM_SITES) return;
      g.siteIds = [...(g.siteIds || []), site.id];
    }
    await persistAll();
    state.openCtxPickerGroupId = g.id;
    state.activeCtxPickerCategoryKey = categoryKey;
    clearCtxPickerTimer();
    state.renderOtherSection();
  });
  return btn;
}


let onBeforeModeDropdownOpen = null;
export function setBeforeModeDropdownOpenHook(fn) {
  onBeforeModeDropdownOpen = typeof fn === "function" ? fn : null;
}

export function attachModeDropdown(container, group) {
  const modeDropdown = container.querySelector("[data-field='mode-dropdown']");
  const modeTrigger = container.querySelector("[data-field='mode-trigger']");
  const modeMenu = container.querySelector("[data-field='mode-menu']");
  if (!modeDropdown || !modeTrigger || !modeMenu) return;

  modeTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = modeDropdown.classList.contains("is-open");
    
    
    
    if (!isOpen) onBeforeModeDropdownOpen?.();
    document.querySelectorAll(".group-mode-dropdown").forEach((d) => {
      d.classList.remove("is-open");
      d.querySelector("[data-field='mode-trigger']")?.setAttribute("aria-expanded", "false");
      const m = d.querySelector("[data-field='mode-menu']");
      if (m) m.hidden = true;
    });
    if (!isOpen) {
      modeDropdown.classList.add("is-open");
      modeTrigger.setAttribute("aria-expanded", "true");
      modeMenu.hidden = false;
    }
  });

  modeMenu.querySelectorAll("[data-mode-value]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const g = getCtxGroupById(group.id);
      if (!g) return;
      g.mode = button.dataset.modeValue === "tabs" ? "tabs" : "compare";
      await persistAll();
      state.renderOtherSection();
    });
  });
}

export function clearCtxPickerTimer() {
  if (state.ctxPickerCloseTimerId) {
    clearTimeout(state.ctxPickerCloseTimerId);
    state.ctxPickerCloseTimerId = null;
  }
}

export function scheduleCtxPickerClose() {
  clearCtxPickerTimer();
  state.ctxPickerCloseTimerId = setTimeout(() => {
    closeCtxPicker();
    state.renderOtherSection();
  }, PICKER_CLOSE_DELAY_MS);
}

export function closeCtxPicker() {
  clearCtxPickerTimer();
  state.openCtxPickerGroupId = null;
  state.activeCtxPickerCategoryKey = null;
}
