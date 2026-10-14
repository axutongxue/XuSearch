import { state, escapeHtml } from "./state.js";
import { PROMPT_GROUPS_STORAGE_KEY } from "../shared/storage-keys.js";
import { getPromptGroupDisplayName } from "../shared/prompt-groups.js";
import { recordBuiltinPromptDeletion } from "../shared/builtin-prompt-tombstones.js";
import { closePromptPicker } from "./sections.js";

export function openPopupPromptEditModal(prompt, groupId) {
  closePromptPicker();
  const targetGroup =
    state.promptGroups.find((g) => g.id === groupId) || state.promptGroups[0];
  const targetPrompt = targetGroup?.prompts.find((p) => p.id === prompt.id);
  if (!targetPrompt) return;

  const overlay = document.createElement("div");
  overlay.className = "prompt-edit-modal-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.28);display:flex;align-items:flex-start;justify-content:center;padding:16px;z-index:10000;overflow-y:auto;";

  const modal = document.createElement("div");
  modal.style.cssText =
    "width:100%;margin:auto;background:#fff;border-radius:6px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.16);";
  
  
  
  if (!document.getElementById("pep-style")) {
    const s = document.createElement("style");
    s.id = "pep-style";
    s.textContent = `
      /* 几何统一 34px / 10px 圆角 / 14px / 500（内联是 32px/4px/13px，须 !important 压过） */
      .pep-cancel, .pep-save {
        height: 34px !important; border-radius: 10px !important;
        font-size: 14px !important; font-weight: 500 !important;
        padding: 0 20px !important; border: none !important;
        cursor: pointer; transition: background .15s ease, color .15s ease, transform .1s ease, filter .15s ease;
      }
      .pep-delete {
        height: 34px !important; border-radius: 10px !important;
        font-size: 14px !important; font-weight: 500 !important;
        padding: 0 20px !important; border: none !important;
        cursor: pointer; transition: background .15s ease, transform .1s ease;
      }
      /* 保存 = 主按钮蓝渐变 */
      .pep-save { background: linear-gradient(90deg, #0057ff, #87ceeb) !important; color: #fff !important; }
      .pep-save:hover { background: linear-gradient(90deg, #0043cc, #6bc0e8) !important; filter: saturate(1.12); }
      .pep-save:active { transform: scale(.98); background: linear-gradient(90deg, #0038ab, #57b3e0) !important; filter: saturate(1.18); }
      /* 取消 = 次级按钮方案 B（浅蓝底 + 蓝字） */
      .pep-cancel { background: #eaf1ff !important; color: #0057ff !important; }
      .pep-cancel:hover { background: #cfdfff !important; color: #0046d4 !important; }
      .pep-cancel:active { transform: scale(.98); background: #b9d0ff !important; }
      /* 删除 = 危险浅红底 + 红字 */
      .pep-delete { background: #fee2e2 !important; color: #dc2626 !important; }
      .pep-delete:hover { background: #fecaca !important; }
      .pep-delete:active { transform: scale(.98); background: #fca5a5 !important; }
      /* 弹窗内三键的本调 */
      .pep-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .pep-actions-main { display: flex; gap: 8px; }
    `;
    document.head.appendChild(s);
  }
  modal.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:2px;">编辑提示词</div>
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">名称</label>
      <input class="pep-title" type="text" value="${escapeHtml(targetPrompt.title || "")}" style="width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;" />
    </div>
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">分类</label>
      <div class="pep-cat-dd" style="position:relative;width:100%;">
        <button class="pep-cat-trigger" type="button" aria-expanded="false" aria-haspopup="listbox" style="width:100%;min-height:38px;padding:0 26px 0 11px;border:1px solid #dcdcdc;border-radius:9px;background:#fff;color:#000;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;cursor:pointer;position:relative;font:inherit;font-size:13px;">
          <span class="pep-cat-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(getPromptGroupDisplayName(targetGroup))}</span>
          <span class="pep-cat-arrow" aria-hidden="true" style="position:absolute;right:11px;top:50%;width:6px;height:6px;border-right:1.5px solid #666;border-bottom:1.5px solid #666;transform:translateY(-65%) rotate(45deg);"></span>
        </button>
        <div class="pep-cat-panel" role="listbox" hidden style="position:absolute;top:calc(100% + 8px);left:0;right:0;padding:8px;border:1px solid #e8e8e8;border-radius:18px;background:#fff;box-shadow:0 14px 30px rgba(31,24,16,.08);gap:4px;z-index:30;max-height:260px;overflow-y:auto;">
          ${state.promptGroups
            .map(
              (g) =>
                `<button class="pep-cat-option${g.id === groupId ? " is-active" : ""}" type="button" role="option" aria-selected="${g.id === groupId}" data-cat-id="${escapeHtml(g.id)}" style="width:100%;min-height:36px;padding:0 14px;border:none;border-radius:999px;background:${g.id === groupId ? "#f0f0f0" : "transparent"};color:#000;font:inherit;font-size:13px;font-weight:${g.id === groupId ? "600" : "400"};display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;">${escapeHtml(getPromptGroupDisplayName(g))}</button>`
            )
            .join("")}
          <button class="pep-cat-option pep-cat-option--new" type="button" data-cat-id="__new__" style="width:100%;min-height:36px;padding:0 14px;border:none;border-radius:999px;background:transparent;color:#6b7280;font:inherit;font-size:13px;display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;">＋ 新建分组…</button>
        </div>
      </div>
      <input class="pep-newgroup" type="text" placeholder="输入新分组名称" style="display:none;width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;margin-top:6px;" />
    </div>
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">提示词内容</label>
      <textarea class="pep-content" style="width:100%;min-height:120px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;resize:vertical;line-height:1.6;">${escapeHtml(targetPrompt.content || "")}</textarea>
    </div>
    <div class="pep-actions">
      <button class="pep-delete" type="button">删除</button>
      <div class="pep-actions-main">
        <button class="pep-cancel" type="button">取消</button>
        <button class="pep-save" type="button">保存</button>
      </div>
    </div>
  `;

  const titleInput = modal.querySelector(".pep-title");
  const catDd = modal.querySelector(".pep-cat-dd");
  const catTrigger = modal.querySelector(".pep-cat-trigger");
  const catLabel = modal.querySelector(".pep-cat-label");
  const catPanel = modal.querySelector(".pep-cat-panel");
  const catArrow = modal.querySelector(".pep-cat-arrow");
  const newGroupInput = modal.querySelector(".pep-newgroup");
  const contentInput = modal.querySelector(".pep-content");

  
  let selectedGroupId = groupId;

  const openCatPanel = () => {
    if (!catPanel) return;
    catPanel.hidden = false;
    catTrigger?.setAttribute("aria-expanded", "true");
    if (catArrow) catArrow.style.transform = "translateY(-35%) rotate(-135deg)";
  };
  const closeCatPanel = () => {
    if (!catPanel) return;
    catPanel.hidden = true;
    catTrigger?.setAttribute("aria-expanded", "false");
    if (catArrow) catArrow.style.transform = "translateY(-65%) rotate(45deg)";
  };
  const syncCatActive = (id) => {
    if (!catPanel) return;
    catPanel.querySelectorAll(".pep-cat-option").forEach((el) => {
      const on = el.dataset.catId === id;
      el.setAttribute("aria-selected", String(on));
      el.style.background = on ? "#f0f0f0" : "transparent";
      el.style.fontWeight = on ? "600" : "400";
    });
  };

  catTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (catPanel?.hidden === false) closeCatPanel();
    else openCatPanel();
  });

  if (catPanel) {
    catPanel.addEventListener("click", (e) => e.stopPropagation());
    catPanel.querySelectorAll(".pep-cat-option").forEach((opt) => {
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
    if (!overlay.isConnected) {
      document.removeEventListener("click", onDocPointerDown);
      return;
    }
    if (catDd && !catDd.contains(e.target)) closeCatPanel();
  };
  document.addEventListener("click", onDocPointerDown);

  const prevMinHeight = document.body.style.minHeight;
  const prevBodyBg = document.body.style.background;
  const popupShell = document.querySelector(".popup-shell");
  const prevShellBg = popupShell ? popupShell.style.background : "";

  function closeModal() {
    overlay.remove();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.minHeight = prevMinHeight;
    document.body.style.background = prevBodyBg;
    if (popupShell) popupShell.style.background = prevShellBg;
  }

  modal.querySelector(".pep-cancel").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  
  
  const buildNextGroups = () =>
    state.promptGroups.map((g) => ({
      ...g,
      prompts: (g.prompts || []).filter((p) => p.id !== targetPrompt.id),
    }));

  const saveBtn = modal.querySelector(".pep-save");
  const deleteBtn = modal.querySelector(".pep-delete");

  saveBtn.addEventListener("click", async () => {
    const newTitle =
      (titleInput instanceof HTMLInputElement ? titleInput.value : "").trim() ||
      "未命名提示词";
    const newContent = contentInput instanceof HTMLTextAreaElement ? contentInput.value : "";
    let newGroupId = selectedGroupId;

    const nextGroups = buildNextGroups();
    if (newGroupId === "__new__") {
      const newName =
        (newGroupInput instanceof HTMLInputElement ? newGroupInput.value : "").trim() ||
        "新建分组";
      const newGroup = { id: `prompt-group-${Date.now()}`, name: newName, prompts: [] };
      nextGroups.push(newGroup);
      newGroupId = newGroup.id;
    }
    const destGroup =
      nextGroups.find((g) => g.id === newGroupId) ||
      nextGroups.find((g) => g.id === targetGroup.id) ||
      nextGroups[0];
    destGroup.prompts.push({
      
      
      ...targetPrompt,
      id: targetPrompt.id,
      title: newTitle,
      content: newContent,
      
      updatedAt: Date.now()
    });

    saveBtn.disabled = true;
    try {
      await chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: nextGroups });
    } catch (_e) {
      saveBtn.disabled = false;
      window.alert("保存失败：写入存储时出错，修改未生效，请重试。");
      return;
    }
    state.promptGroups = nextGroups;
    closeModal();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm("确定要删除这条提示词吗？")) return;
    
    await recordBuiltinPromptDeletion(targetPrompt.id, groupId);
    const nextGroups = buildNextGroups();
    deleteBtn.disabled = true;
    try {
      await chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: nextGroups });
    } catch (_e) {
      deleteBtn.disabled = false;
      window.alert("删除失败：写入存储时出错，请重试。");
      return;
    }
    state.promptGroups = nextGroups;
    closeModal();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.documentElement.style.overflow = "visible";
  document.body.style.overflow = "visible";
  document.body.style.minHeight = "440px";
  document.body.style.background = "#ffffff";
  if (popupShell) popupShell.style.background = "#ffffff";
  if (titleInput instanceof HTMLInputElement) requestAnimationFrame(() => titleInput.focus());
}
