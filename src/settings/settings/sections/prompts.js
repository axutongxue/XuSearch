import {
  getAllPromptGroupName,
  isAllPromptGroup,
  getPromptGroupDisplayName,
} from "../../../shared/prompt-groups.js";
import { DEFAULT_PROMPT_GROUP_ID } from "../../../shared/storage-keys.js";
import { state, msg } from "../state.js";
import {
  persistAll,
  createNormalizedPromptGroups,
  getDisplayPromptEntries,
} from "../store.js";
import {
  attachPromptItemDrag,
  attachPromptItemDragAll,
  attachPromptTabDrag,
} from "../drag.js";
import {
  showPromptHoverCard,
  createPromptEditorModal,
} from "./prompts-editor.js";




export function resetPromptsActiveGroup() {
  state.activePromptGroupId = DEFAULT_PROMPT_GROUP_ID;
}

export function renderPromptsSection() {
  const { promptsSection } = state.dom;
  promptsSection.innerHTML = "";

  if (!state.promptGroups.length) {
    state.promptGroups = createNormalizedPromptGroups([]);
  }
  
  
  
  
  const allGroup = { id: DEFAULT_PROMPT_GROUP_ID, name: getAllPromptGroupName(), prompts: state.promptGroups.flatMap((g) => g.prompts || []) };
  const displayGroups = [allGroup, ...state.promptGroups];

  
  
  
  const activeGroup =
    displayGroups.find((group) => group.id === state.activePromptGroupId) ||
    displayGroups.find((group) => group.id === (state.promptGroups[0]?.id || null)) ||
    allGroup;
  if (!activeGroup) {
    return;
  }

  const shell = document.createElement("section");
  shell.className = "prompt-layout-c";
  
  
  
  
  shell.appendChild(createPromptTabs(displayGroups, activeGroup));
  shell.appendChild(createPromptToolbar(activeGroup));
  shell.appendChild(createPromptCardGrid(activeGroup));
  promptsSection.appendChild(shell);

  if (state.promptEditorState) {
    promptsSection.appendChild(createPromptEditorModal());
  }
}

function createPromptTabs(displayGroups, activeGroup) {
  const wrap = document.createElement("div");
  wrap.className = "prompt-tabs-wrap";

  const tabs = document.createElement("div");
  tabs.className = "prompt-tabs";
  displayGroups.forEach((group) => {
    tabs.appendChild(createPromptTab(group, activeGroup));
  });
  
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "prompt-tab-add";
  addBtn.title = msg("settings_prompts_addGroup", "添加分组");
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => {
    const newGroup = {
      id: `prompt-group-${Date.now()}`,
      name: "",
      prompts: []
    };
    state.promptGroups.push(newGroup);
    state.activePromptGroupId = newGroup.id;
    state.renamingPromptGroupId = newGroup.id;
    state.pendingPromptGroupFocusId = newGroup.id;
    state.promptSearchQuery = "";
    renderPromptsSection();
  });
  tabs.appendChild(addBtn);

  wrap.appendChild(tabs);

  attachPromptTabDrag(tabs);
  return wrap;
}

function createPromptTab(group, activeGroup) {
  const isActive = group.id === activeGroup.id;
  const isAll = isAllPromptGroup(group);
  const isRenaming = !isAll && state.renamingPromptGroupId === group.id;
  const displayName = isAll ? getAllPromptGroupName() : group.name;
  
  const count = getDisplayPromptEntries(group).length;

  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = `prompt-tab${isActive ? " is-active" : ""}${isRenaming ? " is-renaming" : ""}${isAll ? " is-locked" : ""}`;
  tab.dataset.groupId = group.id;

  if (isRenaming) {
    const input = document.createElement("input");
    input.className = "prompt-tab-rename-input";
    input.type = "text";
    input.value = group.name;
    input.placeholder = msg("settings_prompts_groupPlaceholder", "请输入分组名称");

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const nextName = input.value.trim();
      group.name = nextName || msg("settings_prompts_newGroupName", "新建分组");
      if (state.renamingPromptGroupId === group.id) {
        state.renamingPromptGroupId = null;
      }
      await persistAll();
      renderPromptsSection();
    };

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        committed = true;
        if (state.renamingPromptGroupId === group.id) {
          state.renamingPromptGroupId = null;
        }
        renderPromptsSection();
      }
    });
    input.addEventListener("blur", commit);

    tab.appendChild(input);

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    if (state.pendingPromptGroupFocusId === group.id) {
      state.pendingPromptGroupFocusId = null;
    }
    return tab;
  }

  const nameEl = document.createElement("span");
  nameEl.className = "prompt-tab-name";
  nameEl.textContent = displayName || msg("common_unnamedPromptGroup", "未命名分组");
  tab.appendChild(nameEl);

  const cntEl = document.createElement("span");
  cntEl.className = "prompt-tab-cnt";
  cntEl.textContent = String(count);
  tab.appendChild(cntEl);

  if (!isAll) {
    const dragHandle = document.createElement("span");
    dragHandle.className = "prompt-tab-drag";
    dragHandle.title = msg("settings_prompts_dragGroupTitle", "拖动排序");
    dragHandle.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>`;
    tab.appendChild(dragHandle);
  }

  tab.addEventListener("click", (ev) => {
    if (ev.target.closest(".prompt-tab-drag")) return;
    if (state.activePromptGroupId === group.id) return;
    state.activePromptGroupId = group.id;
    state.promptSearchQuery = "";
    renderPromptsSection();
  });

  return tab;
}

function createPromptToolbar(activeGroup) {
  const isAll = isAllPromptGroup(activeGroup);
  const toolbar = document.createElement("div");
  toolbar.className = "prompt-toolbar";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "prompt-search-box";
  searchInput.placeholder = msg("settings_prompts_searchPlaceholder", "搜索提示词…");
  if (state.promptSearchQuery) {
    searchInput.value = state.promptSearchQuery;
  }

  const countEl = document.createElement("span");
  countEl.className = "prompt-toolbar-count";
  countEl.textContent = buildCountText(getFilteredEntries(activeGroup).length);

  toolbar.appendChild(searchInput);
  toolbar.appendChild(countEl);

  const spacer = document.createElement("div");
  spacer.className = "prompt-toolbar-spacer";
  toolbar.appendChild(spacer);

  if (!isAll) {
    toolbar.appendChild(createPromptGroupActions(activeGroup));
  }

  const addPromptBtn = document.createElement("button");
  addPromptBtn.type = "button";
  addPromptBtn.className = "prompt-add-prompt-btn";
  addPromptBtn.textContent = "+ " + msg("settings_prompts_addPromptCta", "添加提示词");
  addPromptBtn.addEventListener("click", () => {
    state.promptEditorState = {
      mode: "create",
      
      groupId: isAll
        ? (state.promptGroups.find((g) => !isAllPromptGroup(g))?.id || state.promptGroups[0]?.id)
        : activeGroup.id,
      promptId: null,
      title: "",
      content: ""
    };
    renderPromptsSection();
  });
  toolbar.appendChild(addPromptBtn);

  searchInput.addEventListener("input", () => {
    state.promptSearchQuery = searchInput.value.trim();
    const shell = toolbar.closest(".prompt-layout-c");
    const oldGrid = shell.querySelector(".prompt-card-grid");
    oldGrid.replaceWith(createPromptCardGrid(activeGroup));
    countEl.textContent = buildCountText(getFilteredEntries(activeGroup).length);
  });

  return toolbar;
}

function createPromptGroupActions(activeGroup) {
  const wrap = document.createElement("div");
  wrap.className = "prompt-toolbar-group-actions";

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "prompt-toolbar-btn prompt-toolbar-rename-btn";
  renameBtn.textContent = msg("settings_prompts_renameGroupTitle", "重命名");
  renameBtn.addEventListener("click", () => {
    state.renamingPromptGroupId = activeGroup.id;
    renderPromptsSection();
  });
  wrap.appendChild(renameBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "prompt-toolbar-btn prompt-toolbar-danger-btn";
  deleteBtn.textContent = msg("settings_prompts_deleteGroupTitle", "删除分组");
  deleteBtn.addEventListener("click", async () => {
    const shouldDelete = window.confirm(msg("settings_prompts_deleteGroupConfirm", "是否要删除该提示词分组？"));
    if (!shouldDelete) return;
    state.promptGroups = state.promptGroups.filter((g) => g.id !== activeGroup.id);
    if (!state.promptGroups.length) {
      state.promptGroups = createNormalizedPromptGroups([]);
    }
    state.activePromptGroupId = state.promptGroups[0]?.id || null;
    state.promptSearchQuery = "";
    await persistAll();
    renderPromptsSection();
  });
  wrap.appendChild(deleteBtn);

  return wrap;
}

function buildCountText(count) {
  return msg("settings_prompts_countPrefix", "共 ") + count + msg("settings_prompts_countSuffix", " 条提示词");
}

function getFilteredEntries(activeGroup) {
  const entries = getDisplayPromptEntries(activeGroup);
  const query = (state.promptSearchQuery || "").toLowerCase();
  if (!query) return entries;
  return entries.filter(({ prompt }) => {
    return (prompt.title || "").toLowerCase().includes(query)
      || (prompt.content || "").toLowerCase().includes(query);
  });
}

function createPromptCardGrid(activeGroup) {
  const isAll = isAllPromptGroup(activeGroup);
  const entries = getFilteredEntries(activeGroup);
  const grid = document.createElement("div");
  grid.className = "prompt-card-grid";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "prompt-grid-empty";
    empty.textContent = state.promptSearchQuery
      ? msg("settings_prompts_searchEmpty", "没有匹配的提示词。")
      : (isAll
        ? msg("settings_prompts_emptyAll", "还没有任何提示词，点击下方按钮添加。")
        : msg("settings_prompts_emptyGroup", "当前分组还没有提示词，点击下方按钮添加。"));
    grid.appendChild(empty);
    return grid;
  }

  entries.forEach(({ prompt, sourceGroup }) => {
    grid.appendChild(createPromptCard(sourceGroup, prompt, { showGroupTag: isAll }));
  });
  if (isAll) {
    attachPromptItemDragAll(grid);
  } else {
    attachPromptItemDrag(grid, activeGroup);
  }
  return grid;
}

function createPromptCard(group, prompt, options = {}) {
  const showGroupTag = !!options.showGroupTag;
  const card = document.createElement("article");
  card.className = "prompt-pcard";
  card.dataset.promptId = prompt.id;
  card.dataset.groupId = group.id;

  
  if (prompt.deprecatedFrom) {
    const notice = document.createElement("div");
    notice.className = "prompt-pcard-deprecated";
    const text = document.createElement("span");
    text.className = "prompt-pcard-deprecated-text";
    text.textContent = msg(
      "settings_prompts_deprecatedNotice",
      "此提示词已在新版扩展中被删除。你可以选择保留使用，也可以点击编辑手动删除或自行导出备份。"
    );
    const keepBtn = document.createElement("button");
    keepBtn.type = "button";
    keepBtn.className = "prompt-pcard-deprecated-keep";
    keepBtn.textContent = msg("settings_prompts_deprecatedKeep", "保留");
    
    keepBtn.addEventListener("click", async () => {
      delete prompt.deprecatedFrom;
      delete prompt.isBuiltin;
      delete prompt.builtInUpdatedAt;
      await persistAll();
      renderPromptsSection();
    });
    notice.append(text, keepBtn);
    card.appendChild(notice);
  }

  const row1 = document.createElement("div");
  row1.className = "prompt-pcard-row1";

  const titleEl = document.createElement("span");
  titleEl.className = "prompt-pcard-title";
  titleEl.textContent = prompt.title || msg("common_unnamedPrompt", "未命名提示词");

  const actions = document.createElement("div");
  actions.className = "prompt-pcard-actions";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "prompt-icon-btn prompt-pcard-preview-btn";
  previewBtn.setAttribute("aria-label", msg("settings_prompts_previewAria", "预览"));
  previewBtn.title = msg("settings_prompts_previewTitle", "预览内容");
  previewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  let hoverTimer = null;
  previewBtn.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => {
      showPromptHoverCard(prompt, group, previewBtn);
    }, 200);
  });
  previewBtn.addEventListener("mouseleave", () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  });
  actions.appendChild(previewBtn);

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "prompt-icon-btn prompt-pcard-edit-btn";
  editBtn.setAttribute("aria-label", msg("common_edit", "编辑"));
  editBtn.title = msg("common_edit", "编辑");
  editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener("click", () => {
    state.promptEditorState = {
      mode: "edit",
      groupId: group.id,
      promptId: prompt.id,
      title: prompt.title || "",
      content: prompt.content || ""
    };
    renderPromptsSection();
  });
  actions.appendChild(editBtn);

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "prompt-icon-btn prompt-pcard-drag-handle";
  dragHandle.setAttribute("aria-label", msg("settings_prompts_dragGroupAria", "拖动排序"));
  dragHandle.title = msg("settings_prompts_dragGroupTitle", "拖动排序");
  dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>`;
  actions.appendChild(dragHandle);

  row1.appendChild(titleEl);
  row1.appendChild(actions);

  const excerpt = document.createElement("div");
  excerpt.className = "prompt-pcard-excerpt";
  excerpt.textContent = prompt.content || msg("common_emptyPromptContent", "（暂无内容）");

  const foot = document.createElement("div");
  foot.className = "prompt-pcard-foot";
  if (showGroupTag) {
    const tag = document.createElement("span");
    tag.className = "prompt-pcard-tag";
    tag.textContent = getPromptGroupDisplayName(group);
    foot.appendChild(tag);
  }
  const expandHint = document.createElement("span");
  expandHint.className = "prompt-pcard-expand-hint";
  expandHint.textContent = msg("settings_prompts_expandHint", "▼ 点击展开");
  foot.appendChild(expandHint);

  const meta = document.createElement("span");
  meta.className = "prompt-pcard-meta";
  meta.textContent = msg("settings_prompts_charCount", "{n} 字").replace("{n}", prompt.content.length);
  foot.appendChild(meta);

  card.appendChild(row1);
  card.appendChild(excerpt);
  card.appendChild(foot);

  card.addEventListener("click", (ev) => {
    if (ev.target.closest("button")) return;
    card.classList.toggle("is-expanded");
    expandHint.textContent = card.classList.contains("is-expanded")
      ? msg("settings_prompts_collapseHint", "▲ 点击收起")
      : msg("settings_prompts_expandHint", "▼ 点击展开");
  });

  return card;
}
