import {
  getAllPromptGroupName,
  isAllPromptGroup,
} from "../../../shared/prompt-groups.js";
import { state, msg } from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll } from "../store.js";
import { recordBuiltinPromptDeletion } from "../../../shared/builtin-prompt-tombstones.js";




export function showPromptHoverCard(prompt, group, anchorBtn) {
  const existing = document.querySelector(".prompt-hover-card");
  if (existing) existing.remove();
  document.removeEventListener("keydown", state._hoverCardKeyHandler);

  const card = document.createElement("div");
  card.className = "prompt-hover-card";

  function closeCard() {
    card.remove();
    document.removeEventListener("keydown", state._hoverCardKeyHandler);
  }

  state._hoverCardKeyHandler = (ev) => {
    if (ev.key === "Escape") closeCard();
  };

  const header = document.createElement("div");
  header.className = "prompt-hover-card-header";

  const headerActions = document.createElement("div");
  headerActions.className = "prompt-hover-card-header-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "prompt-hover-card-copy-btn";
  copyBtn.textContent = msg("common_copy", "复制");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(prompt.content || "").then(() => {
      copyBtn.textContent = "✓ " + msg("common_copied", "已复制");
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.textContent = msg("common_copy", "复制");
        copyBtn.classList.remove("is-copied");
      }, 1800);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = prompt.content || "";
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      copyBtn.textContent = "✓ " + msg("common_copied", "已复制");
      setTimeout(() => { copyBtn.textContent = msg("common_copy", "复制"); }, 1800);
    });
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "prompt-hover-card-edit-btn";
  editBtn.textContent = msg("common_edit", "编辑");
  editBtn.addEventListener("click", () => {
    closeCard();
    state.promptEditorState = {
      mode: "edit",
      groupId: group.id,
      promptId: prompt.id,
      title: prompt.title || "",
      content: prompt.content || ""
    };
    state.renderPromptsSection();
  });

  headerActions.appendChild(copyBtn);
  headerActions.appendChild(editBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "prompt-hover-card-close-btn";
  closeBtn.setAttribute("aria-label", msg("common_close", "关闭"));
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener("click", closeCard);

  header.appendChild(headerActions);
  header.appendChild(closeBtn);

  
  const titleRow = document.createElement("div");
  titleRow.className = "prompt-hover-card-title";
  titleRow.textContent = prompt.title || "未命名提示词";

  
  const body = document.createElement("div");
  body.className = "prompt-hover-card-body";
  body.textContent = prompt.content || "（暂无内容）";

  card.appendChild(header);
  card.appendChild(titleRow);
  card.appendChild(body);

  document.body.appendChild(card);

  const cardRect = card.getBoundingClientRect();
  const row = anchorBtn.closest(".prompt-pcard");
  const titleEl = row ? row.querySelector(".prompt-pcard-title") : null;
  const iconsEl = row ? row.querySelector(".prompt-pcard-actions") : null;

  let left, top;
  if (titleEl && iconsEl) {
    const titleR = titleEl.getBoundingClientRect();
    const iconsR = iconsEl.getBoundingClientRect();
    const gapLeft = titleR.right;
    const gapRight = iconsR.left;
    const gapW = gapRight - gapLeft;

    if (cardRect.width <= gapW) {
      left = gapLeft + (gapW - cardRect.width) / 2;
    } else {
      left = gapRight - cardRect.width;
    }

    const rowR = row.getBoundingClientRect();
    top = rowR.top;
  } else {
    const rect = anchorBtn.getBoundingClientRect();
    left = rect.right + 10;
    top = rect.top - 10;
  }
  if (left + cardRect.width > window.innerWidth - 12) {
    left = window.innerWidth - cardRect.width - 12;
  }
  if (left < 12) left = 12;
  if (top + cardRect.height > window.innerHeight - 12) {
    top = window.innerHeight - cardRect.height - 12;
  }
  if (top < 12) top = 12;
  card.style.left = left + "px";
  card.style.top = top + "px";

  let leaveTimer = null;
  const startLeave = () => {
    leaveTimer = setTimeout(() => closeCard(), 300);
  };
  const cancelLeave = () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  };
  card.addEventListener("mouseenter", cancelLeave);
  card.addEventListener("mouseleave", startLeave);
  anchorBtn.addEventListener("mouseleave", startLeave);
  anchorBtn.addEventListener("mouseenter", cancelLeave);

  setTimeout(() => document.addEventListener("keydown", state._hoverCardKeyHandler), 0);
}

export function createPromptEditorModal() {
  if (!state.promptEditorState) {
    return document.createElement("div");
  }

  const editorState = state.promptEditorState;
  const editorGroup =
    state.promptGroups.find((group) => group.id === editorState.groupId && !isAllPromptGroup(group)) ||
    state.promptGroups.find((group) => !isAllPromptGroup(group)) ||
    state.promptGroups[0];
  
  const catOptions = state.promptGroups.filter((group) => !isAllPromptGroup(group));
  const overlay = document.createElement("div");
  overlay.className = "prompt-editor-overlay";

  const modal = document.createElement("div");
  modal.className = "prompt-editor-modal";
  modal.innerHTML = `
    <div class="prompt-editor-title">${editorState.mode === "edit" ? msg("settings_prompts_editPromptTitle", "编辑提示词") : msg("settings_prompts_addPromptTitle", "添加提示词")}</div>
    <div class="prompt-editor-field">
      <label class="field-label">${msg("settings_prompts_fieldName", "名称")}</label>
      <input class="prompt-editor-title-input" type="text" value="${escapeHtml(editorState.title || "")}" placeholder="${msg("settings_prompts_promptNamePlaceholder", "请输入提示词名称")}" />
    </div>
    <div class="prompt-editor-field">
      <label class="field-label">${msg("settings_prompts_fieldGroup", "分类")}</label>
      <div class="prompt-editor-cat-dd" data-field="cat-dd">
        <button class="prompt-editor-cat-trigger" type="button" data-field="cat-trigger" aria-expanded="false" aria-haspopup="listbox">
          <span class="prompt-editor-cat-label">${escapeHtml(editorGroup.name)}</span>
          <span class="prompt-editor-cat-arrow" aria-hidden="true"></span>
        </button>
        <div class="prompt-editor-cat-panel" data-field="cat-panel" role="listbox" hidden>
          ${catOptions.map((g) => `<button class="prompt-editor-cat-option${g.id === editorGroup.id ? " is-active" : ""}" type="button" role="option" aria-selected="${g.id === editorGroup.id}" data-cat-id="${escapeHtml(g.id)}">${escapeHtml(g.name)}</button>`).join("")}
          <button class="prompt-editor-cat-option prompt-editor-cat-option--new" type="button" data-cat-id="__new_group__">${msg("settings_prompts_newGroupOption", "＋ 新建分组…")}</button>
        </div>
      </div>
      <div class="prompt-new-group-row" hidden>
        <input class="prompt-new-group-input" type="text" placeholder="${msg("settings_prompts_newGroupPlaceholder", "输入新分组名称，按 Enter 确认")}" />
        <button class="prompt-new-group-confirm-btn" type="button">${msg("common_create", "创建")}</button>
      </div>
    </div>
    <div class="prompt-editor-field">
      <label class="field-label">${msg("settings_prompts_fieldContent", "提示词内容")}</label>
      <textarea class="prompt-editor-content-input">${escapeHtml(editorState.content || "")}</textarea>
    </div>
    <div class="prompt-editor-actions">
      ${editorState.mode === "edit" ? `<button class="prompt-editor-delete-btn" type="button">${msg("common_delete", "删除")}</button>` : "<span></span>"}
      <div class="prompt-editor-main-actions">
        <button class="prompt-editor-cancel-btn" type="button">${msg("common_cancel", "取消")}</button>
        <button class="prompt-editor-save-btn" type="button">${msg("common_save", "保存")}</button>
      </div>
    </div>
  `;

  const titleInput = modal.querySelector(".prompt-editor-title-input");
  const catDd = modal.querySelector("[data-field='cat-dd']");
  const catTrigger = modal.querySelector("[data-field='cat-trigger']");
  const catLabel = modal.querySelector(".prompt-editor-cat-label");
  const catPanel = modal.querySelector("[data-field='cat-panel']");
  const newGroupRow = modal.querySelector(".prompt-new-group-row");
  const newGroupInput = modal.querySelector(".prompt-new-group-input");
  const newGroupConfirmBtn = modal.querySelector(".prompt-new-group-confirm-btn");
  const contentInput = modal.querySelector(".prompt-editor-content-input");
  const cancelBtn = modal.querySelector(".prompt-editor-cancel-btn");
  const saveBtn = modal.querySelector(".prompt-editor-save-btn");

  
  const openCatPanel = () => {
    if (!catDd || !catPanel) return;
    
    catPanel.hidden = false;
    catDd.classList.add("is-open");
    catTrigger?.setAttribute("aria-expanded", "true");
  };
  const closeCatPanel = () => {
    if (!catDd || !catPanel) return;
    catPanel.hidden = true;
    catDd.classList.remove("is-open");
    catTrigger?.setAttribute("aria-expanded", "false");
  };
  const syncCatActive = (groupId) => {
    if (!catPanel) return;
    catPanel.querySelectorAll(".prompt-editor-cat-option").forEach((el) => {
      const on = el.dataset.catId === groupId;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
    });
  };

  if (catTrigger) {
    catTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (catDd?.classList.contains("is-open")) closeCatPanel();
      else openCatPanel();
    });
  }

  if (catPanel) {
    catPanel.addEventListener("click", (e) => e.stopPropagation());
    catPanel.querySelectorAll(".prompt-editor-cat-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const value = opt.dataset.catId;
        if (value === "__new_group__") {
          closeCatPanel();
          showNewGroupRow();
          return;
        }
        state.promptEditorState.groupId = value;
        if (catLabel) {
          const hit = catOptions.find((g) => g.id === value);
          if (hit) catLabel.textContent = hit.name;
        }
        syncCatActive(value);
        closeCatPanel();
        hideNewGroupRow();
      });
    });
  }

  
  
  
  const onDocPointerDown = (e) => {
    if (!modal.isConnected) {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      return;
    }
    if (catDd && !catDd.contains(e.target)) closeCatPanel();
  };
  document.addEventListener("pointerdown", onDocPointerDown, true);

  function showNewGroupRow() {
    if (newGroupRow) newGroupRow.hidden = false;
    if (newGroupInput) newGroupInput.focus();
  }

  function hideNewGroupRow() {
    if (newGroupRow) newGroupRow.hidden = true;
    if (newGroupInput) newGroupInput.value = "";
  }

  function confirmNewGroup() {
    const name = (newGroupInput ? newGroupInput.value : "").trim();
    if (!name) return;
    const newGroup = {
      id: `prompt-group-${Date.now()}`,
      name,
      prompts: []
    };
    state.promptGroups.push(newGroup);
    
    if (catPanel) {
      const newOpt = document.createElement("button");
      newOpt.type = "button";
      newOpt.className = "prompt-editor-cat-option";
      newOpt.setAttribute("role", "option");
      newOpt.setAttribute("aria-selected", "false");
      newOpt.dataset.catId = newGroup.id;
      newOpt.textContent = name;
      newOpt.addEventListener("click", () => {
        state.promptEditorState.groupId = newGroup.id;
        if (catLabel) catLabel.textContent = name;
        syncCatActive(newGroup.id);
        closeCatPanel();
        hideNewGroupRow();
      });
      const newGroupOpt = catPanel.querySelector(".prompt-editor-cat-option--new");
      catPanel.insertBefore(newOpt, newGroupOpt);
    }
    catOptions.push(newGroup);
    if (catLabel) catLabel.textContent = name;
    syncCatActive(newGroup.id);
    state.promptEditorState.groupId = newGroup.id;
    hideNewGroupRow();
  }

  if (titleInput) {
    titleInput.addEventListener("input", (event) => {
      const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
      state.promptEditorState.title = nextValue;
    });
  }
  if (newGroupConfirmBtn) {
    newGroupConfirmBtn.addEventListener("click", confirmNewGroup);
  }
  if (newGroupInput) {
    newGroupInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); confirmNewGroup(); }
      if (ev.key === "Escape") {
        hideNewGroupRow();
        syncCatActive(state.promptEditorState.groupId || editorGroup.id);
      }
    });
  }
  if (contentInput) {
    contentInput.addEventListener("input", (event) => {
      const nextValue = event.target instanceof HTMLTextAreaElement ? event.target.value : "";
      state.promptEditorState.content = nextValue;
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.promptEditorState = null;
      state.renderPromptsSection();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const targetGroup = state.promptGroups.find((group) => group.id === state.promptEditorState.groupId);
      if (!targetGroup) {
        return;
      }

      let originalGroup = null;
      let originalIndex = -1;
      let originalPrompt = null;
      if (state.promptEditorState.mode === "edit") {
        state.promptGroups.forEach((group) => {
          const promptIndex = group.prompts.findIndex((prompt) => prompt.id === state.promptEditorState.promptId);
          if (promptIndex >= 0) {
            originalGroup = group;
            originalIndex = promptIndex;
            originalPrompt = group.prompts[promptIndex];
          }
          group.prompts = group.prompts.filter((prompt) => prompt.id !== state.promptEditorState.promptId);
        });
      }

      const nextPrompt = {
        
        
        ...originalPrompt,
        id: state.promptEditorState.promptId || `prompt-${Date.now()}`,
        title: state.promptEditorState.title || msg("common_unnamedPrompt", "未命名提示词"),
        content: state.promptEditorState.content || "",
        
        updatedAt: Date.now()
      };
      if (state.promptEditorState.mode === "edit" && originalGroup === targetGroup && originalIndex >= 0) {
        targetGroup.prompts.splice(Math.min(originalIndex, targetGroup.prompts.length), 0, nextPrompt);
      } else {
        targetGroup.prompts.unshift(nextPrompt);
      }
      state.activePromptGroupId = targetGroup.id;
      state.promptEditorState = null;
      await persistAll();
      state.renderPromptsSection();
    });
  }

  const deleteBtn = modal.querySelector(".prompt-editor-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      showPromptDeleteConfirm(async () => {
        
        await recordBuiltinPromptDeletion(state.promptEditorState.promptId, state.promptEditorState.groupId);
        state.promptGroups.forEach((group) => {
          group.prompts = group.prompts.filter((prompt) => prompt.id !== state.promptEditorState.promptId);
        });
        state.promptEditorState = null;
        await persistAll();
        state.renderPromptsSection();
      });
    });
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      state.promptEditorState = null;
      state.renderPromptsSection();
    }
  });

  overlay.appendChild(modal);
  return overlay;
}

function showPromptDeleteConfirm(onConfirm) {
  document.querySelector(".prompt-delete-confirm-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "prompt-delete-confirm-overlay";
  overlay.innerHTML = `
    <div class="prompt-delete-confirm-dialog" role="dialog" aria-modal="true">
      <div class="prompt-delete-confirm-title">${msg("settings_prompts_deletePromptTitle", "删除提示词")}</div>
      <div class="prompt-delete-confirm-message">${msg("settings_prompts_deletePromptConfirm", "是否要删除该提示词？")}</div>
      <div class="prompt-delete-confirm-actions">
        <button class="prompt-delete-confirm-cancel" type="button">${msg("common_cancel", "取消")}</button>
        <button class="prompt-delete-confirm-submit" type="button">${msg("common_delete", "删除")}</button>
      </div>
    </div>
  `;

  const close = () => {
    document.removeEventListener("keydown", handleKeydown);
    overlay.remove();
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  overlay.querySelector(".prompt-delete-confirm-cancel")?.addEventListener("click", close);
  overlay.querySelector(".prompt-delete-confirm-submit")?.addEventListener("click", async () => {
    await onConfirm();
    close();
  });

  document.addEventListener("keydown", handleKeydown);
  document.body.appendChild(overlay);
  overlay.querySelector(".prompt-delete-confirm-submit")?.focus();
}
