

import { state } from "./state.js";
import { getGroupSiteObjects } from "../shared/attachment-utils.js";
import { saveFilesToIDB } from "../shared/upload-files-idb.js";
import { closePromptPicker, renderGroups } from "./sections.js";
import {
  attachMemberBadge,
  ensureAttachmentAnchor,
  queryMemberActive,
  removeMemberBadge,
  showMemberGateTip,
  syncMemberBadge,
} from "../shared/member-gate-tip.js";

let _groupOptions = [];
let _isPicking = false;

export function isPopupUploadPickMode() {
  return _isPicking && _groupOptions.length > 0;
}

export function clearPopupUploadMode() {
  _groupOptions = [];
  _isPicking = false;
}

export function selectPopupUploadGroup(index) {
  const option = _groupOptions[index];
  if (!option) return false;
  runUpload(option.group, option.siteIds);
  return true;
}


export function pickPopupAttachmentFiles() {
  enterAttachmentMode();
}

function enterAttachmentMode() {
  const usableGroups = findAllGroupsWithSites();
  if (usableGroups.length === 0) {
    window.alert("没有可用的搜索组。");
    return;
  }

  _isPicking = true;
  _groupOptions = usableGroups.map(({ group, siteIds }) => ({
    group,
    siteIds,
  }));

  renderGroupPicker(_groupOptions);
}


function findAllGroupsWithSites() {
  const results = [];
  for (const group of state.groups) {
    const groupSites = getGroupSiteObjects(group, state.allSites);
    if (groupSites.length === 0) continue;
    results.push({
      group,
      siteIds: groupSites.map((s) => s.id),
      siteCount: groupSites.length,
    });
  }
  return results;
}

function renderGroupPicker(groupOptions) {
  const { groupsContainer } = state.dom;
  if (!groupsContainer) return;

  groupsContainer.innerHTML = "";

  const title = document.createElement("div");
  title.className = "popup-upload-title";
  title.textContent = "选择搜索组上传附件";
  groupsContainer.appendChild(title);

  groupOptions.forEach(({ group, siteIds }, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "popup-group-btn popup-upload-group-btn";
    const siteNames = siteIds.map((id) => {
      const s = state.allSites.find((x) => x.id === id);
      return s?.name || id;
    }).join("、");
    btn.innerHTML =
      `<span class="popup-upload-group-name">${escapeHtml(group.name || "未命名搜索组")}</span>` +
      `<span class="popup-upload-group-meta">${siteIds.length} 个站点：${escapeHtml(siteNames)}</span>`;
    if (i < 9) {
      btn.setAttribute("data-pick-num", String(i + 1));
    }
    btn.addEventListener("click", () => {
      runUpload(group, siteIds);
    });
    groupsContainer.appendChild(btn);
  });
}

async function runUpload(group, siteIds) {
  const { queryInput } = state.dom;
  const query = queryInput instanceof HTMLTextAreaElement ? queryInput.value.trim() : "";

  
  
  
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async () => {
    try {
      const all = Array.from(input.files || []);
      if (all.length === 0) return;
      
      if (all.length > 50) {
        window.alert(`单次最多上传 50 个文件，已忽略后面的 ${all.length - 50} 个。`);
      }
      const sessionId = await saveFilesToIDB(all.slice(0, 50));
      clearPopupUploadMode();
      await chrome.runtime.sendMessage({
        type: "UPLOAD_FILES",
        group,
        query,
        siteIds,
        sessionId,
      });
    } catch (_err) {
      
    }
    window.close();
  };
  input.click();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


export function mountPopupAttachmentButton(actionsRow) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "popupAttachmentBtn";
  btn.className = "composer-icon-btn popup-attachment-btn";
  btn.setAttribute("aria-label", "上传附件");
  btn.title = "上传附件";
  btn.innerHTML = `<span class="attachment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>`;
  btn.addEventListener("click", async (event) => {
    event.stopPropagation();
    
    state.exitPopupPickMode?.();
    
    if (isPopupUploadPickMode()) {
      clearPopupUploadMode();
      renderGroups();
      return;
    }
    
    
    if (state.isPromptPickerOpen) closePromptPicker();
    
    
    if (!(await queryMemberActive())) {
      attachMemberBadge(btn);
      showMemberGateTip(anchor, { afterOpen: () => window.close() });
      return;
    }
    removeMemberBadge(btn);
    pickPopupAttachmentFiles();
  });
  actionsRow.appendChild(btn);
  
  syncMemberBadge(btn).catch(() => {});
  
  const anchor = ensureAttachmentAnchor(btn);
  return btn;
}


export function syncPopupAttachmentBadge() {
  const btn = document.getElementById("popupAttachmentBtn");
  if (!btn) return;
  syncMemberBadge(btn).catch(() => {
    
  });
}
