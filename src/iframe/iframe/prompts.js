import { DEFAULT_PROMPT_GROUP_ID } from "../../shared/storage-keys.js";
import { recordBuiltinPromptDeletion } from "../../shared/builtin-prompt-tombstones.js";
import {
  isAllPromptGroup,
  getPromptGroupDisplayName,
  getPromptGroupCount,
  getDisplayPromptEntries,
} from "../../shared/prompt-groups.js";
import { state, elements, STORAGE_KEYS, promptPreview } from "./state.js";
import { updateSendBtnState } from "./status.js";
import { escapeHtml } from "./utils.js";

const PLUS_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;


function buildGroupLabel(group, allGroups) {
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
  btn.innerHTML = `${PLUS_SVG}去设置里新建`;
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" }).catch(() => {});
  });

  box.append(label, btn);
  return box;
}


export function applyPromptFill(prompt) {
  const ta = elements.queryInput;
  if (!ta) return;

  const content = String(prompt?.content || "");
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  ta.value = before + content + after;
  const newCursor = before.length + content.length;

  closePromptPicker();
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  updateSendBtnState();

  requestAnimationFrame(() => {
    ta.focus();
    try {
      ta.setSelectionRange(newCursor, newCursor);
    } catch (_) {}
    updateSendBtnState();
  });
}

export function bindPromptPickerEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !state.isPromptPickerOpen) {
      return;
    }

    if (target.closest("#promptAssistBtn") || target.closest("#promptPicker")) {
      return;
    }

    closePromptPicker();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isPromptPickerOpen) {
      closePromptPicker();
      elements.queryInput?.focus();
    }
  });
}

export function togglePromptPicker() {
  state.isPromptPickerOpen = !state.isPromptPickerOpen;
  renderPromptPicker();
}

export function closePromptPicker() {
  if (!state.isPromptPickerOpen) {
    return;
  }
  state.isPromptPickerOpen = false;
  if (promptPreview.mgr) promptPreview.mgr.hide();
  renderPromptPicker();
}


export function openPromptEditModal(prompt, groupId) {
  closePromptPicker();

  
  let targetGroup = state.promptGroups.find((g) => g.id === groupId) || state.promptGroups[0];
  let targetPrompt = targetGroup?.prompts.find((p) => p.id === prompt.id);
  if (!targetPrompt) return;

  const overlay = document.createElement("div");
  overlay.className = "prompt-edit-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "prompt-edit-modal";
  modal.innerHTML = `
    <div class="prompt-edit-modal-title">编辑提示词</div>
    <div>
      <label class="prompt-edit-field-label">名称</label>
      <input class="prompt-edit-input" type="text" value="${escapeHtml(targetPrompt.title || "")}" />
    </div>
    <div>
      <label class="prompt-edit-field-label">分类</label>
      <div class="prompt-edit-cat-dd" data-field="cat-dd">
        <button class="prompt-edit-cat-trigger" type="button" data-field="cat-trigger" aria-expanded="false" aria-haspopup="listbox">
          <span class="prompt-edit-cat-label">${escapeHtml(getPromptGroupDisplayName(targetGroup))}</span>
          <span class="prompt-edit-cat-arrow" aria-hidden="true"></span>
        </button>
        <div class="prompt-edit-cat-panel" data-field="cat-panel" role="listbox" hidden>
          ${state.promptGroups.map((g) => `<button class="prompt-edit-cat-option${g.id === groupId ? " is-active" : ""}" type="button" role="option" aria-selected="${g.id === groupId}" data-cat-id="${escapeHtml(g.id)}">${escapeHtml(getPromptGroupDisplayName(g))}</button>`).join("")}
          <button class="prompt-edit-cat-option prompt-edit-cat-option--new" type="button" data-cat-id="__new__">＋ 新建分组…</button>
        </div>
      </div>
      <input class="prompt-edit-input prompt-edit-new-group-input" type="text" placeholder="输入新分组名称" style="display:none;margin-top:8px;" />
    </div>
    <div>
      <label class="prompt-edit-field-label">提示词内容</label>
      <textarea class="prompt-edit-textarea">${escapeHtml(targetPrompt.content || "")}</textarea>
    </div>
    <div class="prompt-edit-actions">
      <button class="prompt-edit-delete-btn" type="button">删除</button>
      <div class="prompt-edit-main-btns">
        <button class="prompt-edit-cancel-btn" type="button">取消</button>
        <button class="prompt-edit-save-btn" type="button">保存</button>
      </div>
    </div>
  `;

  const titleInput = modal.querySelector(".prompt-edit-input");
  const catDd = modal.querySelector("[data-field='cat-dd']");
  const catTrigger = modal.querySelector("[data-field='cat-trigger']");
  const catLabel = modal.querySelector(".prompt-edit-cat-label");
  const catPanel = modal.querySelector("[data-field='cat-panel']");
  const newGroupInput = modal.querySelector(".prompt-edit-new-group-input");
  const contentInput = modal.querySelector(".prompt-edit-textarea");
  const cancelBtn = modal.querySelector(".prompt-edit-cancel-btn");
  const saveBtn = modal.querySelector(".prompt-edit-save-btn");
  const deleteBtn = modal.querySelector(".prompt-edit-delete-btn");

  
  let selectedGroupId = groupId;

  const openCatPanel = () => {
    if (!catDd || !catPanel) return;
    catDd.classList.add("is-open");
    catPanel.hidden = false;
    catTrigger?.setAttribute("aria-expanded", "true");
  };
  const closeCatPanel = () => {
    if (!catDd || !catPanel) return;
    catDd.classList.remove("is-open");
    catPanel.hidden = true;
    catTrigger?.setAttribute("aria-expanded", "false");
  };
  const syncCatActive = (id) => {
    if (!catPanel) return;
    catPanel.querySelectorAll(".prompt-edit-cat-option").forEach((el) => {
      const on = el.dataset.catId === id;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
    });
  };

  catTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (catDd?.classList.contains("is-open")) closeCatPanel();
    else openCatPanel();
  });

  if (catPanel) {
    catPanel.addEventListener("click", (e) => e.stopPropagation());
    catPanel.querySelectorAll(".prompt-edit-cat-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const value = opt.dataset.catId;
        if (value === "__new__") {
          
          if (newGroupInput instanceof HTMLInputElement) {
            newGroupInput.style.display = "block";
            requestAnimationFrame(() => newGroupInput.focus());
          }
          closeCatPanel();
          return;
        }
        selectedGroupId = value;
        if (newGroupInput instanceof HTMLInputElement) newGroupInput.style.display = "none";
        if (catLabel) catLabel.textContent = opt.textContent.trim();
        syncCatActive(value);
        closeCatPanel();
      });
    });
  }

  
  const onDocPointerDown = (e) => {
    if (!modal.isConnected) {
      document.removeEventListener("click", onDocPointerDown);
      return;
    }
    if (catDd && !catDd.contains(e.target)) closeCatPanel();
  };
  document.addEventListener("click", onDocPointerDown);

  cancelBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  saveBtn.addEventListener("click", async () => {
    const newTitle = (titleInput instanceof HTMLInputElement ? titleInput.value : "").trim() || "未命名提示词";
    const newContent = contentInput instanceof HTMLTextAreaElement ? contentInput.value : "";
    let newGroupId = selectedGroupId;

    
    if (newGroupId === "__new__") {
      const newName = (newGroupInput instanceof HTMLInputElement ? newGroupInput.value : "").trim() || "新建分组";
      const newGroup = { id: `prompt-group-${Date.now()}`, name: newName, prompts: [] };
      state.promptGroups.push(newGroup);
      newGroupId = newGroup.id;
    }

    
    state.promptGroups.forEach((g) => {
      g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
    });
    
    const destGroup = state.promptGroups.find((g) => g.id === newGroupId) || targetGroup;
    
    
    destGroup.prompts.push({ ...targetPrompt, id: targetPrompt.id, title: newTitle, content: newContent });

    await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
    overlay.remove();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm("确定要删除这条提示词吗？")) return;
    
    await recordBuiltinPromptDeletion(targetPrompt.id, targetGroup?.id);
    state.promptGroups.forEach((g) => {
      g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
    });
    await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
    overlay.remove();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  if (titleInput instanceof HTMLInputElement) {
    requestAnimationFrame(() => titleInput.focus());
  }
}

export function renderPromptPicker() {
  if (!elements.promptPicker || !elements.promptAssistBtn) {
    return;
  }

  elements.promptAssistBtn.style.display = state.promptGroups.length > 0 ? "inline-flex" : "none";

  elements.promptPicker.innerHTML = "";
  elements.promptAssistBtn.setAttribute("aria-expanded", String(state.isPromptPickerOpen));

  if (!state.isPromptPickerOpen) {
    elements.promptPicker.hidden = true;
    return;
  }

  elements.promptPicker.hidden = false;

  if (!state.promptGroups.length) {
    elements.promptPicker.appendChild(buildPromptEmpty("还没有提示词分组，请先去设置里添加。"));
    return;
  }

  const activeGroup = state.promptGroups.find((group) => group.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) {
    return;
  }

  const groupsColumn = document.createElement("div");
  groupsColumn.className = "popup-prompt-groups";

  state.promptGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.groupId = group.id;
    button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    button.append(buildGroupLabel(group, state.promptGroups));
    button.addEventListener("mouseenter", () => {
      if (state.activePromptGroupId === group.id) {
        return;
      }
      state.activePromptGroupId = group.id;
      switchPromptGroup();
    });
    button.addEventListener("click", () => {
      if (state.activePromptGroupId === group.id) {
        return;
      }
      state.activePromptGroupId = group.id;
      switchPromptGroup();
    });
    groupsColumn.appendChild(button);
  });

  elements.promptPicker.appendChild(groupsColumn);
  elements.promptPicker.appendChild(buildPromptsColumn(activeGroup));
}

function buildPromptsColumn(activeGroup) {
  const promptsColumn = document.createElement("div");
  promptsColumn.className = "popup-prompt-list";

  const entries = getDisplayPromptEntries(activeGroup, state.promptGroups);
  if (!entries.length) {
    promptsColumn.appendChild(
      buildPromptEmpty(
        isAllPromptGroup(activeGroup)
          ? "还没有提示词，请先去设置里添加。"
          : "这个分组里还没有提示词。",
      ),
    );
  } else {
    promptPreview.mgr = promptPreview.mgr || window.PromptItemUI.createPreviewManager(null);
    entries.forEach(({ prompt, sourceGroup }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        onFill: (p) => applyPromptFill(p),
        onEdit: (p) => openPromptEditModal(p, sourceGroup.id),
        previewManager: promptPreview.mgr,
        rich: true,
        groupLabel: isAllPromptGroup(activeGroup) ? getPromptGroupDisplayName(sourceGroup) : "",
      });
      promptsColumn.appendChild(item);
    });
  }
  return promptsColumn;
}

function switchPromptGroup() {
  if (!elements.promptPicker || elements.promptPicker.hidden) return;

  
  elements.promptPicker.querySelectorAll(".popup-prompt-group-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.groupId === state.activePromptGroupId);
  });

  
  const activeGroup =
    state.promptGroups.find((g) => g.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) return;

  const oldList = elements.promptPicker.querySelector(".popup-prompt-list");
  const newList = buildPromptsColumn(activeGroup);
  if (oldList) {
    oldList.replaceWith(newList);
  } else {
    elements.promptPicker.appendChild(newList);
  }
}



export { DEFAULT_PROMPT_GROUP_ID };
