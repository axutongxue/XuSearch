import {
  state,
  msg,
  SITE_CATEGORIES,
  getSiteCategoryLabel,
  GROUP_MODE_OPTIONS,
  getGroupModeLabel,
  PICKER_CLOSE_DELAY_MS,
} from "../state.js";


import { escapeHtml, getGroupById, isSelfBuiltGroupId } from "../utils.js";
import { persistAll, getCategorySites } from "../store.js";
import { attachChipDrag } from "../drag.js";
import { bundleSourceButtonHtml, bindBundleSourceButton } from "../export-config.js";
import { decorateSiteAvatar } from "../site-icons.js";
import { createSiteIconFetchButton } from "../site-icon-button.js";
import { SIGNED_CONFIGS_STORAGE_KEY, REMOVED_GROUPS_STORAGE_KEY } from "../../../shared/storage-keys.js";
import { withStorageLock } from "../../../shared/storage-lock.js";
import { formatRelativeTime } from "../../../shared/relative-time.js";
import { BUNDLE_PRODUCT_ID } from "../../../shared/config-merge.js";
import { mountMembershipPreview } from "./member-preview.js";

export function renderGroupsSection() {
  const { groupsSection } = state.dom;
  groupsSection.innerHTML = "";

  if (!state.groups.length) {
    const emptyState = document.createElement("section");
    emptyState.className = "settings-empty-state";
    emptyState.innerHTML = `<strong>${msg("settings_groups_emptyTitle", "还没有搜索组")}</strong><p>${msg("settings_groups_emptyDesc", "先创建一个搜索组，再配置你要调用的网站或 AI 模型。")}</p>`;
    groupsSection.appendChild(emptyState);
  } else {
    state.groups.forEach((group, index) => groupsSection.appendChild(createGroupCard(group, index)));
  }

  const addCard = document.createElement("section");
  addCard.className = "settings-add-card";
  addCard.innerHTML = `
    <button class="add-section-btn" type="button">${msg("settings_groups_addGroup", "新增搜索组")}</button>
    ${bundleSourceButtonHtml()}
  `;

  addCard.querySelector(".add-section-btn").addEventListener("click", async () => {
    state.groups.push({
      id: `group_${Date.now()}`,
      name: msg("settings_groups_newGroupName", "新搜索组"),
      enabled: true,
      mode: "compare",
      siteIds: []
    });
    await persistAll();
    renderGroupsSection();
  });

  
  bindBundleSourceButton(addCard);

  groupsSection.appendChild(addCard);

  
  mountMembershipPreview(groupsSection);
}



function createGroupCard(group, index) {
  const isLocked = false;
  const card = document.createElement("section");
  card.className = `settings-group-card${group.enabled ? "" : " is-disabled"}`;
  card.dataset.groupId = group.id;

  const selectedSites = group.siteIds
    .map((siteId) => state.sites.find((site) => site.id === siteId))
    .filter(Boolean);

  
  const head = document.createElement("div");
  head.className = "group-card-head";

  const identity = document.createElement("div");
  identity.className = "group-card-identity";
  head.appendChild(identity);

  const tools = document.createElement("div");
  tools.className = "group-card-tools";

  
  const modeSeg = document.createElement("div");
  modeSeg.className = "group-mode-seg";
  modeSeg.dataset.field = "mode-seg";
  modeSeg.setAttribute("role", "group");
  modeSeg.setAttribute("aria-label", msg("settings_groups_fieldMode", "呈现方式"));
  modeSeg.innerHTML = GROUP_MODE_OPTIONS.map((option) => {
    const value = option.value === "tabs" ? "tabs" : "compare";
    const active = value === (group.mode === "tabs" ? "tabs" : "compare");
    return `<button class="group-mode-seg-btn${active ? " is-active" : ""}" type="button" data-mode-value="${value}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(getGroupModeLabel(option))}</button>`;
  }).join("");
  
  
  
  
  
  
  
  if (isSelfBuiltGroupId(group.id)) {
    tools.appendChild(createFetchIconsButton(group));
  }
  tools.appendChild(modeSeg);

  head.appendChild(tools);
  card.appendChild(head);

  if (!isLocked) {
    
    const hideBtn = document.createElement("button");
    hideBtn.type = "button";
    hideBtn.className = "group-card-icon-btn";
    hideBtn.dataset.field = "visibility";
    hideBtn.title = group.enabled
      ? msg("settings_groups_hideGroupTitle", "在面板中隐藏该搜索组")
      : msg("settings_groups_showGroupTitle", "在面板中显示该搜索组");
    hideBtn.setAttribute(
      "aria-label",
      group.enabled
        ? msg("settings_groups_hideGroupAria", "隐藏搜索组")
        : msg("settings_groups_showGroupAria", "显示搜索组")
    );
    hideBtn.innerHTML = group.enabled
      ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    hideBtn.addEventListener("click", async () => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) return;
      currentGroup.enabled = currentGroup.enabled === false;
      await persistAll();
      renderGroupsSection();
    });
    tools.appendChild(hideBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "group-card-icon-btn is-danger";
    deleteBtn.dataset.field = "delete";
    deleteBtn.title = msg("settings_groups_deleteGroupAria", "删除搜索组");
    deleteBtn.setAttribute("aria-label", msg("settings_groups_deleteGroupAria", "删除搜索组"));
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`;
    deleteBtn.addEventListener("click", async () => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      
      const isBundleGroup = currentGroup.sourceProductId === BUNDLE_PRODUCT_ID;
      const confirmMsg = currentGroup.sourceProductId && !isBundleGroup
        ? "该搜索组关联密文数据，删除后需重新导入。是否继续？"
        : msg("settings_groups_deleteGroupConfirm", "是否要删除该搜索组？");
      const shouldDelete = window.confirm(confirmMsg);
      if (!shouldDelete) {
        return;
      }
      
      
      
      
      
      
      
      
      const productId = currentGroup.sourceProductId;
      if (productId && productId !== BUNDLE_PRODUCT_ID) {
        try {
          await withStorageLock("signedConfigs", async () => {
            const stored = await chrome.storage.local.get([SIGNED_CONFIGS_STORAGE_KEY]);
            const signedConfigs = stored[SIGNED_CONFIGS_STORAGE_KEY] || {};
            delete signedConfigs[productId];
            await chrome.storage.local.set({ [SIGNED_CONFIGS_STORAGE_KEY]: signedConfigs });
          });
        } catch (_e) {
          
        }
      }
      state.groups = state.groups.filter((item) => item.id !== currentGroup.id);
      
      
      
      if (currentGroup.sourceProductId === BUNDLE_PRODUCT_ID) {
        try {
          await withStorageLock("removedGroups", async () => {
            const stored = await chrome.storage.local.get([REMOVED_GROUPS_STORAGE_KEY]);
            const list = Array.isArray(stored[REMOVED_GROUPS_STORAGE_KEY])
              ? stored[REMOVED_GROUPS_STORAGE_KEY]
              : [];
            if (!list.includes(currentGroup.id)) {
              await chrome.storage.local.set({ [REMOVED_GROUPS_STORAGE_KEY]: [...list, currentGroup.id] });
            }
          });
        } catch (_e) {
          
        }
      }
      if (state.openPickerGroupId === currentGroup.id) {
        closePicker();
      }
      await persistAll();
      
      renderGroupsSection();
    });
    tools.appendChild(deleteBtn);
  }

  
  
  const changedHint =
    group.sourceProductId === BUNDLE_PRODUCT_ID && group.changedAt
      ? `<span class="group-card-dot" aria-hidden="true"></span><span class="group-card-sub-text">${escapeHtml(msg("settings_groups_changedHint", "规则库更新于"))} ${escapeHtml(formatRelativeTime(group.changedAt))}</span>`
      : "";
  const hiddenHint = group.enabled
    ? ""
    : `<span class="group-card-dot" aria-hidden="true"></span><span class="group-card-sub-text is-hidden">${escapeHtml(msg("settings_groups_hiddenHint", "已在面板中隐藏"))}</span>`;

  identity.innerHTML = `
    <div class="group-card-titleline">
      <input class="group-name-input" type="text" value="${escapeHtml(group.name)}" data-field="name" aria-label="${escapeHtml(msg("settings_groups_fieldName", "搜索组名称"))}" title="${escapeHtml(msg("settings_groups_nameSpaceTitle", "组名不能包含空格：空格是「输入组名+空格」快捷选组的专用键，输入时会自动去除"))}" />
      <span class="group-tag-wrap" data-field="group-tag-wrap">
        <button class="group-tag-btn" type="button" data-field="group-tag-btn" title="${escapeHtml(msg("settings_groups_tagEditHint", "点击修改分组标签"))}">
          <span class="group-tag-prefix">${escapeHtml(msg("settings_groups_tagShort", "分组"))}</span>
          <span class="group-tag-value" data-field="group-tag-value">${escapeHtml(group.groupTag || msg("settings_groups_tagFallback", "默认"))}</span>
          <span class="group-tag-edit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span>
        </button>
        <input class="group-tag-input" type="text" value="${escapeHtml(group.groupTag || "默认")}" data-field="group-tag" aria-label="${escapeHtml(msg("settings_groups_fieldTag", "分组标签"))}" />
      </span>
    </div>
    <span class="group-name-space-hint" data-field="name-space-hint" hidden>${escapeHtml(msg("settings_groups_nameSpaceHint", "组名不能包含空格：空格是「输入组名+空格」快捷选组的专用键，已自动去除"))}</span>
    <div class="group-card-sub">
      <span class="group-card-sub-text">${selectedSites.length} ${escapeHtml(msg("settings_groups_siteUnit", "个站点"))}</span>${changedHint}${hiddenHint}
    </div>
  `;

  
  const body = document.createElement("div");
  body.className = "group-card-body";

  const grid = document.createElement("div");
  grid.className = "site-tile-grid";

  selectedSites.forEach((site) => grid.appendChild(createSiteTile(group, site)));

  
  attachChipDrag(grid, group);
  grid.appendChild(createInlineAdd(group));
  body.appendChild(grid);
  card.appendChild(body);

  if (!isLocked) {
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "group-drag-handle";
    dragHandle.setAttribute("aria-label", msg("settings_groups_dragAria", "拖动调整搜索组顺序"));
    
    
    dragHandle.innerHTML = `<span class="group-drag-dots" aria-hidden="true">` + "<i></i>".repeat(6) + "</span>";
    card.appendChild(dragHandle);
  }

  const nameInput = card.querySelector("[data-field='name']");
  const groupTagInput = card.querySelector("[data-field='group-tag']");

  if (nameInput) {
    
    let spaceHintTimer = null;
    const flashSpaceHint = () => {
      const hint = card.querySelector("[data-field='name-space-hint']");
      if (!hint) return;
      hint.hidden = false;
      clearTimeout(spaceHintTimer);
      spaceHintTimer = setTimeout(() => { hint.hidden = true; }, 2600);
    };
    
    const stripWhitespace = () => {
      const raw = nameInput.value;
      const rawCaret = nameInput.selectionStart ?? raw.length;
      const before = raw.slice(0, rawCaret).replace(/\s+/g, "");
      const after = raw.slice(rawCaret).replace(/\s+/g, "");
      nameInput.value = before + after;
      nameInput.setSelectionRange(before.length, before.length);
      return before + after;
    };

    nameInput.addEventListener("input", async (event) => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      let nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
      
      
      
      
      if (!event.isComposing && /\s/.test(nextValue)) {
        nextValue = stripWhitespace();
        flashSpaceHint();
      }
      currentGroup.name = nextValue;
      
      
      state.syncRenderedGroupsSignature?.();
      await persistAll();
      
      
      
      
    });

    
    
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        nameInput.blur();
      }
    });

    
    
    nameInput.addEventListener("focus", () => {
      const end = nameInput.value.length;
      nameInput.setSelectionRange(end, end);
    });

    
    
    
    
    nameInput.addEventListener("blur", () => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) return;
      const cleaned = String(nameInput.value || "").replace(/\s+/g, "");
      if (cleaned !== nameInput.value) {
        nameInput.value = cleaned;
        currentGroup.name = cleaned;
        state.syncRenderedGroupsSignature?.();
        persistAll().catch(() => {});
      }
      if (!String(currentGroup.name || "").trim()) {
        nameInput.value = "未命名搜索组";
        currentGroup.name = "未命名搜索组";
        state.syncRenderedGroupsSignature?.();
        persistAll().catch(() => {});
      }
    });
  }

  if (groupTagInput) {
    const tagWrap = card.querySelector("[data-field='group-tag-wrap']");
    const tagBtn = card.querySelector("[data-field='group-tag-btn']");
    const tagValueEl = card.querySelector("[data-field='group-tag-value']");

    
    const syncTagLabel = () => {
      if (!tagValueEl) return;
      const currentGroup = getGroupById(group.id);
      const value = currentGroup ? String(currentGroup.groupTag || "").trim() : "";
      tagValueEl.textContent = value || msg("settings_groups_tagFallback", "默认");
    };

    groupTagInput.addEventListener("input", async (event) => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
      currentGroup.groupTag = nextValue.trim();
      syncTagLabel();
      await persistAll();
    });

    
    if (tagWrap && tagBtn) {
      tagBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        groupTagInput.dataset.prevValue = groupTagInput.value;
        tagWrap.classList.add("is-editing");
        
        requestAnimationFrame(() => {
          groupTagInput.focus();
          groupTagInput.select();
        });
      });

      const exitTagEdit = () => {
        tagWrap.classList.remove("is-editing");
        syncTagLabel();
      };

      groupTagInput.addEventListener("blur", exitTagEdit);

      groupTagInput.addEventListener("keydown", (event) => {
        
        
        if (event.isComposing) return;
        if (event.key === "Enter") {
          event.preventDefault();
          
          exitTagEdit();
          groupTagInput.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          
          groupTagInput.value = groupTagInput.dataset.prevValue || "";
          groupTagInput.dispatchEvent(new Event("input", { bubbles: true }));
          exitTagEdit();
          groupTagInput.blur();
        }
      });
    }
  }

  if (modeSeg) {
    modeSeg.querySelectorAll("[data-mode-value]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const currentGroup = getGroupById(group.id);
        if (!currentGroup) {
          return;
        }
        const nextMode = button.dataset.modeValue === "tabs" ? "tabs" : "compare";
        if (currentGroup.mode === nextMode) {
          return;
        }
        currentGroup.mode = nextMode;
        await persistAll();
        renderGroupsSection();
      });
    });
  }

  return card;
}


function createSiteTile(group, site) {
  const tile = document.createElement("div");
  tile.className = "selected-chip site-tile";
  tile.dataset.siteId = site.id;
  
  
  const noteText = String(site.notes || "").trim();
  tile.title = noteText || site.name;

  const label = site.name || site.id || "";
  const domain = getSiteDomain(site);
  
  const externalBadge =
    site.supportIframe === false
      ? `<span class="site-tile-external" title="${escapeHtml(msg("settings_groups_pickerExternalOnlyTip", "该模型不支持卡片形式呈现，仅支持新开标签打开。"))}">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
         </span>`
      : "";
  
  
  const blockedBadge =
    site.blocked === true
      ? `<span class="site-tile-blocked" title="${escapeHtml(msg("settings_groups_siteBlockedTip", "该站点当前可能无法直接访问"))}">${escapeHtml(msg("settings_groups_siteBlocked", "被墙"))}</span>`
      : "";
  
  
  const notedBadge =
    String(site.notes || "").trim()
      ? `<span class="site-tile-noted" title="${escapeHtml(String(site.notes).trim())}">${escapeHtml(msg("settings_groups_siteNoted", "有备注"))}</span>`
      : "";

  tile.innerHTML = `
    <span class="site-tile-avatar" style="--site-hue:${siteNameHue(label)}" aria-hidden="true">${escapeHtml([...label][0] || "?")}</span>
    <span class="site-tile-text">
      <span class="site-chip-label">${escapeHtml(label)}</span>
      <span class="site-tile-domain">${escapeHtml(domain)}</span>
    </span>
    ${externalBadge}
    <span class="site-flags">${notedBadge}${blockedBadge}</span>
    <button class="chip-remove-btn" type="button" aria-label="${escapeHtml(msg("settings_groups_removeSitePrefix", "删除 "))}${escapeHtml(label)}">×</button>
  `;

  
  
  decorateSiteAvatar(tile.querySelector(".site-tile-avatar"), site);

  tile.querySelector(".chip-remove-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    const currentGroup = getGroupById(group.id);
    if (!currentGroup) {
      return;
    }
    currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
    await persistAll();
    renderGroupsSection();
  });

  return tile;
}


export function siteNameHue(name) {
  let hash = 0;
  for (const char of String(name)) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash % 360;
}


export function getSiteDomain(site) {
  const raw = site.url || (Array.isArray(site.matchPatterns) ? site.matchPatterns[0] : "") || "";
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_error) {
    return String(raw).replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}


function resolveFetchTargetIds(group) {
  const groupIds = Array.isArray(group?.siteIds) ? group.siteIds : [];
  const name = String(group?.name || "").trim();
  let best = groupIds;

  for (const [key, category] of Object.entries(SITE_CATEGORIES)) {
    const ids = category?.siteIds;
    if (!Array.isArray(ids) || !ids.length) continue;
    const isOwnCategory = key === `group:${group?.id}`;
    const isSameName = !!name && String(category?.label || "").trim() === name;
    if (!isOwnCategory && !isSameName) continue;
    if (ids.length > best.length) best = ids;
  }

  return best;
}


function createFetchIconsButton(group) {
  return createSiteIconFetchButton({
    getTargetIds: () => resolveFetchTargetIds(getGroupById(group.id) || group),
    keyPrefix: "groups",
    emptyTitle: msg("settings_groups_fetchIconsEmpty", "该搜索组还没有站点"),
    onFinished: () => {
      if (state.activeSection === "groups") renderGroupsSection();
    },
  });
}

function createInlineAdd(group) {
  const wrap = document.createElement("div");
  wrap.className = "inline-add-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = `inline-add-btn${state.openPickerGroupId === group.id ? " is-active" : ""}`;
  button.textContent = msg("settings_groups_addSite", "添加站点");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    clearPickerCloseTimer();
    if (state.openPickerGroupId === group.id) {
      closePicker();
    } else {
      state.openPickerGroupId = group.id;
      if (!state.activePickerCategoryKey || !SITE_CATEGORIES[state.activePickerCategoryKey]) {
        state.activePickerCategoryKey = Object.keys(SITE_CATEGORIES)[0] || null;
      }
    }
    renderGroupsSection();
  });
  wrap.appendChild(button);

  if (state.openPickerGroupId === group.id) {
    wrap.appendChild(createHoverPicker(group));
  }

  return wrap;
}

function createHoverPicker(group) {
  const panel = document.createElement("div");
  panel.className = `hover-picker-panel is-open${state.suppressPickerAnimation ? " is-stable" : ""}`;
  state.suppressPickerAnimation = false;
  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.addEventListener("mouseenter", clearPickerCloseTimer);
  panel.addEventListener("mouseleave", schedulePickerClose);

  const activeKey = state.activePickerCategoryKey || Object.keys(SITE_CATEGORIES)[0];

  
  const tabBar = document.createElement("div");
  tabBar.className = "hover-picker-tab-bar";
  Object.entries(SITE_CATEGORIES).forEach(([key, category]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hover-picker-tab" + (activeKey === key ? " is-active" : "");
    
    btn.innerHTML = `<span class="hover-picker-tab-label">${escapeHtml(getSiteCategoryLabel(key))}</span><span class="hover-picker-tab-count">${getCategorySites(key).length}</span>`;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      clearPickerCloseTimer();
      setActivePickerCategory(key);
    });
    
    btn.addEventListener("dblclick", async (event) => {
      event.stopPropagation();
      clearPickerCloseTimer();
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) return;
      state.activePickerCategoryKey = key;
      const categorySites = getCategorySites(key);
      if (!categorySites.length) return;
      const categoryIds = new Set(categorySites.map((site) => site.id));
      const allSelected = categorySites.every((site) => currentGroup.siteIds.includes(site.id));
      if (allSelected) {
        currentGroup.siteIds = currentGroup.siteIds.filter((id) => !categoryIds.has(id));
      } else {
        const existing = new Set(currentGroup.siteIds);
        for (const site of categorySites) {
          if (!existing.has(site.id)) {
            currentGroup.siteIds.push(site.id);
          }
        }
      }
      await persistAll();
      state.openPickerGroupId = currentGroup.id;
      state.suppressPickerAnimation = true;
      renderGroupsSection();
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  const categorySites = getCategorySites(activeKey);

  
  const pickedInCategory = categorySites.filter((site) => group.siteIds.includes(site.id)).length;
  const meta = document.createElement("div");
  meta.className = "hover-picker-meta";
  meta.innerHTML = `
    <span class="hover-picker-meta-text">${escapeHtml(getSiteCategoryLabel(activeKey))} · ${categorySites.length} ${escapeHtml(msg("settings_groups_siteUnit", "个站点"))} · ${escapeHtml(msg("settings_groups_pickedPrefix", "已选"))} ${pickedInCategory}</span>
    <span class="hover-picker-meta-hint">${escapeHtml(msg("settings_groups_dblclickHint", "双击分类可全选本类"))}</span>
  `;
  panel.appendChild(meta);

  
  const content = document.createElement("div");
  content.className = "hover-picker-tab-content";

  if (activeKey === "custom") {
    if (!categorySites.length) {
      const empty = document.createElement("div");
      empty.className = "hover-picker-empty";
      empty.innerHTML = msg(
        "settings_groups_customEmpty",
        `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往左侧「自定义搜索」添加</span>`
      );
      content.appendChild(empty);
    } else {
      const tileGrid = document.createElement("div");
      tileGrid.className = "site-picker-grid";
      categorySites.forEach((site) => tileGrid.appendChild(createPickerSiteOption(group, site, activeKey)));
      content.appendChild(tileGrid);
    }
  } else {
    
    if (!categorySites.length) {
      const empty = document.createElement("div");
      empty.className = "hover-picker-empty";
      empty.innerHTML = `该搜索组暂无可用站点`;
      content.appendChild(empty);
    } else {
      const tileGrid = document.createElement("div");
      tileGrid.className = "site-picker-grid";
      categorySites.forEach((site) => tileGrid.appendChild(createPickerSiteOption(group, site, activeKey)));
      content.appendChild(tileGrid);
    }
  }

  panel.appendChild(content);
  return panel;
}

export function setActivePickerCategory(categoryKey) {
  if (state.activePickerCategoryKey === categoryKey) {
    return;
  }
  state.activePickerCategoryKey = categoryKey;
  renderGroupsSection();
}

export function clearPickerCloseTimer() {
  if (state.pickerCloseTimerId) {
    window.clearTimeout(state.pickerCloseTimerId);
    state.pickerCloseTimerId = null;
  }
}

export function schedulePickerClose() {
  clearPickerCloseTimer();
  state.pickerCloseTimerId = window.setTimeout(() => {
    closePicker();
    renderGroupsSection();
  }, PICKER_CLOSE_DELAY_MS);
}

export function closePicker() {
  clearPickerCloseTimer();
  state.openPickerGroupId = null;
  state.activePickerCategoryKey = null;
}

function createPickerSiteOption(group, site, categoryKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  const selected = group.siteIds.includes(site.id);
  const externalOnly = site.supportIframe === false;
  const label = site.name || site.id;
  
  
  btn.className = `site-picker-tile${selected ? " is-selected" : ""}`;
  btn.setAttribute("aria-pressed", selected ? "true" : "false");

  const noteText = String(site.notes || "").trim();
  if (noteText) {
    
    
    btn.title = noteText;
  } else if (externalOnly) {
    const tip = msg(
      "settings_groups_pickerExternalOnlyTip",
      "该模型不支持卡片形式呈现，仅支持新开标签打开。"
    );
    btn.setAttribute("aria-label", `${label}（${tip}）`);
    btn.title = tip;
  }

  
  
  const blockedBadge =
    site.blocked === true
      ? `<span class="site-tile-blocked" title="${escapeHtml(msg("settings_groups_siteBlockedTip", "该站点当前可能无法直接访问"))}">${escapeHtml(msg("settings_groups_siteBlocked", "被墙"))}</span>`
      : "";
  
  const notedBadge =
    String(site.notes || "").trim()
      ? `<span class="site-tile-noted" title="${escapeHtml(String(site.notes).trim())}">${escapeHtml(msg("settings_groups_siteNoted", "有备注"))}</span>`
      : "";

  btn.innerHTML = `
    <span class="site-picker-avatar" style="--site-hue:${siteNameHue(label)}" aria-hidden="true">${escapeHtml([...label][0] || "?")}</span>
    <span class="site-picker-main">
      <span class="site-picker-name">${escapeHtml(label)}</span>
      <span class="site-picker-domain">${escapeHtml(getSiteDomain(site))}</span>
    </span>
    ${externalOnly ? `<span class="site-picker-ext" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>` : ""}
    <span class="site-flags">${notedBadge}${blockedBadge}</span>
    <span class="site-picker-check" aria-hidden="true"></span>
  `;

  
  decorateSiteAvatar(btn.querySelector(".site-picker-avatar"), site);

  btn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const currentGroup = getGroupById(group.id);
    if (!currentGroup) return;
    if (selected) {
      currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
    } else {
      currentGroup.siteIds = [...currentGroup.siteIds, site.id];
    }
    await persistAll();
    state.openPickerGroupId = currentGroup.id;
    state.activePickerCategoryKey = categoryKey;
    state.suppressPickerAnimation = true;
    clearPickerCloseTimer();
    renderGroupsSection();
  });
  return btn;
}
