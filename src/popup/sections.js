import { state, normalizeSiteHomeUrl } from "./state.js";
import { LAST_USED_GROUP_ID_STORAGE_KEY } from "../shared/storage-keys.js";
import { isAllPromptGroup, getPromptGroupDisplayName, getPromptGroupCount, getDisplayPromptEntries } from "../shared/prompt-groups.js";
import { clusterGroupsByTag } from "../shared/group-tags.js";
import { clearSearchDraft } from "../shared/search-draft.js";
import { openPopupPromptEditModal } from "./prompt-edit-modal.js";

function msg(key, fallback = "") {
  return window.__XUSEARCH_I18N__?.t?.(key) || fallback;
}




const GROUP_DOT_COLORS = [
  "#2b5fd9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#14b8a6",
  "#ef4444",
];


function getGroupDotColor(group) {
  const key = String(group?.id || group?.name || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return GROUP_DOT_COLORS[hash % GROUP_DOT_COLORS.length];
}

export function renderGroups() {
  const { groupsContainer } = state.dom;
  if (!groupsContainer) return;
  groupsContainer.innerHTML = "";
  groupsContainer.hidden = state.groups.length === 0;

  const clusters = clusterGroupsByTag(state.groups);
  
  const showClusterTitles = clusters.length > 1;

  
  state.groupDisplayOrder = [];

  clusters.forEach((cluster) => {
    const clusterEl = document.createElement("div");
    clusterEl.className = "popup-group-cluster";

    if (showClusterTitles) {
      const title = document.createElement("div");
      title.className = "popup-group-cluster-title";
      title.textContent = cluster.tag;
      clusterEl.appendChild(title);
    }

    const pillRow = document.createElement("div");
    pillRow.className = "popup-group-pills";
    cluster.groups.forEach((group) => {
      state.groupDisplayOrder.push(group);
      pillRow.appendChild(createGroupPill(group));
    });

    clusterEl.appendChild(pillRow);
    groupsContainer.appendChild(clusterEl);
  });
}

function createGroupPill(group) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "popup-group-pill";
  
  if (getDefaultGroup() === group) button.classList.add("is-default");

  const dotColor = getGroupDotColor(group);

  const dot = document.createElement("span");
  dot.className = "popup-group-pill-dot";
  dot.style.background = dotColor;
  button.appendChild(dot);

  const name = document.createElement("span");
  name.className = "popup-group-pill-name";
  name.textContent = group.name || "";
  button.appendChild(name);

  const groupSites = getGroupSites(group);
  if (groupSites.length) {
    const count = document.createElement("span");
    count.className = "popup-group-pill-count";
    count.textContent = `${groupSites.length}${msg("popup_groupSiteUnit", "站")}`;
    
    count.style.color = dotColor;
    button.appendChild(count);
  }

  button.addEventListener("click", async () => {
    await runGroup(group);
  });

  return button;
}


function getDefaultGroup() {
  return state.groups.find((g) => g.id === state.lastUsedGroupId) || state.groups[0];
}

function getGroupSites(group) {
  return (group.siteIds || [])
    .map((id) => state.allSites.find((site) => site.id === id))
    .filter((site) => site && normalizeSiteHomeUrl(site.url))
    .map((site) => ({
      id: site.id,
      name: site.name || site.id,
      url: normalizeSiteHomeUrl(site.url),
    }));
}

export async function runDefaultSearch() {
  if (!state.groups.length) return;
  
  await runGroup(state.activeRunGroup || getDefaultGroup());
}

export async function runGroup(group) {
  const { queryInput } = state.dom;
  const query = queryInput ? queryInput.value.trim() : "";
  
  
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({ type: "RUN_SEARCH_GROUP", group, query });
  } catch (_err) {
    response = null;
  }
  if (!response || response.ok === false) {
    window.alert(`发送失败：${response?.error || "扩展后台无响应，请稍后重试"}`);
    return;
  }
  
  state.lastUsedGroupId = group.id;
  chrome.storage.local.set({ [LAST_USED_GROUP_ID_STORAGE_KEY]: group.id }).catch(() => {});
  clearSearchDraft();
  window.close();
}


export function closePromptPicker() {
  if (!state.isPromptPickerOpen) return;
  state.isPromptPickerOpen = false;
  if (state.popupPreviewMgr) state.popupPreviewMgr.hide();
  renderPromptPicker();
  state.updatePromptPickerLayoutState();
}

export function togglePromptPicker() {
  if (!state.isPromptPickerOpen) {
    
    state.pickerBaseTotalPx = document.body.scrollHeight;
  }
  state.isPromptPickerOpen = !state.isPromptPickerOpen;
  renderPromptPicker();
}

const PROMPT_PLUS_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;


function buildPromptGroupLabel(group, allGroups) {
  const name = document.createElement("span");
  name.className = "prompt-group-item-name";
  name.textContent = getPromptGroupDisplayName(group);

  const count = document.createElement("span");
  count.className = "prompt-group-item-count";
  count.textContent = String(getPromptGroupCount(group, allGroups));

  const frag = document.createDocumentFragment();
  frag.append(name, count);
  return frag;
}


function buildPromptEmpty(text) {
  const box = document.createElement("div");
  box.className = "popup-prompt-picker-empty";

  const label = document.createElement("span");
  label.textContent = text;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "prompt-empty-btn";
  btn.innerHTML = `${PROMPT_PLUS_SVG}${msg("popup_createPromptInSettings", "去设置里新建")}`;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" });
    window.close();
  });

  box.append(label, btn);
  return box;
}

export function renderPromptPicker() {
  state.updatePromptPickerLayoutState();
  const { promptPicker, promptEntryBtn, queryInput } = state.dom;

  if (!promptPicker || !promptEntryBtn || state.uiPrefs.showPromptButton === false) {
    if (promptPicker) promptPicker.hidden = true;
    state.updatePromptPickerLayoutState();
    return;
  }

  promptPicker.innerHTML = "";
  promptEntryBtn.setAttribute("aria-expanded", String(state.isPromptPickerOpen));

  if (!state.isPromptPickerOpen) {
    promptPicker.hidden = true;
    state.updatePromptPickerLayoutState();
    return;
  }

  promptPicker.hidden = false;

  if (!state.promptGroups.length) {
    promptPicker.appendChild(
      buildPromptEmpty(msg("popup_emptyPromptGroups", "还没有提示词分组，请先去设置里添加。")),
    );
    state.updatePromptPickerLayoutState();
    return;
  }

  const activeGroup =
    state.promptGroups.find((group) => group.id === state.activePromptGroupId) ||
    state.promptGroups[0];
  if (!activeGroup) {
    state.updatePromptPickerLayoutState();
    return;
  }

  const groupsColumn = document.createElement("div");
  groupsColumn.className = "popup-prompt-groups";

  state.promptGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.groupId = group.id;
    button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    button.append(buildPromptGroupLabel(group, state.promptGroups));
    button.addEventListener("mouseenter", () => {
      if (state.activePromptGroupId === group.id) return;
      state.activePromptGroupId = group.id;
      switchPopupPromptGroup(state, promptPicker, queryInput);
    });
    button.addEventListener("click", () => {
      if (state.activePromptGroupId === group.id) return;
      state.activePromptGroupId = group.id;
      switchPopupPromptGroup(state, promptPicker, queryInput);
    });
    groupsColumn.appendChild(button);
  });

  promptPicker.appendChild(groupsColumn);
  promptPicker.appendChild(buildPopupPromptsColumn(state, activeGroup, queryInput));

  const footer = document.createElement("div");
  footer.className = "popup-prompt-picker-footer";
  const settingsLink = document.createElement("button");
  settingsLink.type = "button";
  settingsLink.className = "popup-prompt-picker-settings-btn";
  settingsLink.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>${msg("popup_managePrompts", "管理提示词")}`;
  settingsLink.addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" });
    window.close();
  });
  footer.appendChild(settingsLink);
  promptPicker.appendChild(footer);

  state.updatePromptPickerLayoutState();
}

function buildPopupPromptsColumn(state, activeGroup, queryInput) {
  const promptsColumn = document.createElement("div");
  promptsColumn.className = "popup-prompt-list";

  const entries = getDisplayPromptEntries(activeGroup, state.promptGroups);
  if (!entries.length) {
    promptsColumn.appendChild(
      buildPromptEmpty(
        isAllPromptGroup(activeGroup)
          ? msg("popup_emptyPrompts", "还没有提示词，请先去设置里添加。")
          : msg("popup_emptyPromptsInGroup", "这个分组里还没有提示词。"),
      ),
    );
  } else {
    state.popupPreviewMgr =
      state.popupPreviewMgr ||
      window.PromptItemUI.createPreviewManager(null, {
        
        centerOn: () => document.querySelector(".popup-shell"),
      });
    entries.forEach(({ prompt, sourceGroup }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        onFill: (p) => {
          if (queryInput) {
            queryInput.value = p.content || "";
            closePromptPicker();
            state.syncComposerLayout({ scrollToTop: true });
            requestAnimationFrame(() => {
              queryInput.focus();
              queryInput.setSelectionRange(0, 0);
              queryInput.scrollTop = 0;
              state.syncComposerLayout({ scrollToTop: true });
            });
          }
        },
        onEdit: (p) => openPopupPromptEditModal(p, sourceGroup.id),
        previewManager: state.popupPreviewMgr,
        rich: true,
        
        groupLabel: isAllPromptGroup(activeGroup) ? getPromptGroupDisplayName(sourceGroup) : "",
      });
      promptsColumn.appendChild(item);
    });
  }
  return promptsColumn;
}

function switchPopupPromptGroup(state, promptPicker, queryInput) {
  if (!promptPicker || promptPicker.hidden) return;

  
  promptPicker.querySelectorAll(".popup-prompt-group-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.groupId === state.activePromptGroupId);
  });

  
  const activeGroup =
    state.promptGroups.find((g) => g.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) return;

  const oldList = promptPicker.querySelector(".popup-prompt-list");
  const newList = buildPopupPromptsColumn(state, activeGroup, queryInput);
  if (oldList) {
    oldList.replaceWith(newList);
  } else {
    const footer = promptPicker.querySelector(".popup-prompt-picker-footer");
    promptPicker.insertBefore(newList, footer || null);
  }
  
  state.updatePromptPickerLayoutState();
}
