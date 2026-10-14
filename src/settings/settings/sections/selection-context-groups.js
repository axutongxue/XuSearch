import {
  state,
  msg,
  GROUP_MODE_OPTIONS,
  getGroupModeLabel,
  SITE_CATEGORIES,
  PICKER_CLOSE_DELAY_MS,
} from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll } from "../store.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";
import {
  createHoverPicker,
  attachModeDropdown,
  clearCtxPickerTimer,
  scheduleCtxPickerClose,
  closeCtxPicker,
  setBeforeModeDropdownOpenHook,
} from "./selection-context-picker.js";

export { clearCtxPickerTimer, scheduleCtxPickerClose, closeCtxPicker } from "./selection-context-picker.js";

let openCallTypeId = null;   
let openGroupSelectId = null; 
const MAX_CUSTOM_SITES = 5;















setBeforeModeDropdownOpenHook(() => closeCtxDropdowns(false));

const PROMPT_BASE_H = 70;
const PROMPT_STAGES = [PROMPT_BASE_H, Math.round(PROMPT_BASE_H * 1.5), Math.round(PROMPT_BASE_H * 2.25)];

function applyPromptStageHeight(el) {
  const saved = el.style.height;
  el.style.height = "auto";
  const contentH = el.scrollHeight;
  el.style.height = saved;
  let stageH = PROMPT_STAGES[PROMPT_STAGES.length - 1];
  for (const h of PROMPT_STAGES) {
    if (contentH <= h) { stageH = h; break; }
  }
  el.style.height = stageH + "px";
  el.style.overflowY = stageH === PROMPT_STAGES[PROMPT_STAGES.length - 1] ? "auto" : "hidden";
}


let ctxOutsideClickHandler = null;
let ctxEscapeHandler = null;

function removeCtxOutsideClickHandler() {
  if (ctxOutsideClickHandler) {
    document.removeEventListener("click", ctxOutsideClickHandler, true);
    ctxOutsideClickHandler = null;
  }
  if (ctxEscapeHandler) {
    document.removeEventListener("keydown", ctxEscapeHandler, true);
    ctxEscapeHandler = null;
  }
}


function hideCtxDropdownDom() {
  
  document.querySelectorAll(".selection-ctx-calltype-dd").forEach((dd) => {
    dd.classList.remove("is-open");
    dd.querySelector(".selection-ctx-calltype-trigger")?.setAttribute("aria-expanded", "false");
    const p = dd.querySelector(".selection-ctx-calltype-panel");
    if (p) p.hidden = true;
  });
  
  document.querySelectorAll(".selection-ctx-group-dd").forEach((dd) => {
    dd.classList.remove("is-open");
    dd.querySelector(".selection-ctx-group-trigger")?.setAttribute("aria-expanded", "false");
    const p = dd.querySelector(".selection-ctx-call-panel");
    if (p) p.hidden = true;
  });
}


export function closeCtxDropdowns(needRerender = true) {
  removeCtxOutsideClickHandler();
  const changed = openCallTypeId !== null || openGroupSelectId !== null;
  openCallTypeId = null;
  openGroupSelectId = null;
  if (!changed) return;
  if (needRerender) state.renderOtherSection();
  else hideCtxDropdownDom();
}



const CTX_DROPDOWN_SELECTOR =
  ".selection-ctx-calltype-dd, .selection-ctx-group-dd, .group-mode-dropdown";

function openDropdown(id, setter, closerSelector) {
  removeCtxOutsideClickHandler(); 
  setter(id);
  state.renderOtherSection();
  setTimeout(() => {
    
    if (!document.querySelector(`${closerSelector}.is-open`)) return;
    ctxOutsideClickHandler = (e) => {
      const t = e.target;
      
      if (t instanceof Element && t.closest(CTX_DROPDOWN_SELECTOR)) return;
      removeCtxOutsideClickHandler();
      
      closeCtxDropdowns(false);
    };
    document.addEventListener("click", ctxOutsideClickHandler, true);

    
    ctxEscapeHandler = (e) => {
      if (e.key === "Escape") {
        removeCtxOutsideClickHandler();
        closeCtxDropdowns(false);
      }
    };
    document.addEventListener("keydown", ctxEscapeHandler, true);
  }, 0);
}

function getCtxGroupById(id) {
  return state.selectionContextGroups.find((g) => g.id === id) || null;
}

export function renderSelectionContextGroupsSection() {
  
  
  
  
  const sec = document.createElement("section");
  sec.className = "other-sec";

  const isCtxOn = state.uiPrefs?.contextMenuEnabled !== false;
  
  if (!isCtxOn) sec.classList.add("is-off");

  const head = document.createElement("div");
  head.className = "other-sec-head";
  head.innerHTML = `
    <h2>${escapeHtml(msg("settings_other_tabRightClick", "右键提示词"))}</h2>
    <span class="other-sec-badge is-count">${escapeHtml(
      msg("settings_other_groupCount", "{n} 组").replace("{n}", state.selectionContextGroups.length)
    )}</span>
    <div class="other-sec-switch">
      ${renderStretchSwitchMarkup(isCtxOn)}
    </div>
  `;
  head.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs.contextMenuEnabled = event.target.checked;
    await persistAll();
    sec.classList.toggle("is-off", !event.target.checked);
  });
  sec.appendChild(head);

  const sub = document.createElement("p");
  sub.className = "other-sec-sub";
  sub.textContent = msg("settings_ctx_sectionDesc", "仅在选择文字后通过右键菜单显示。发送格式为：提示词 + 选中内容。");
  sec.appendChild(sub);

  const body = document.createElement("div");
  body.className = "other-sec-body";

  const list = document.createElement("div");
  list.className = "selection-ctx-groups-list";
  if (!state.selectionContextGroups.length) {
    const empty = document.createElement("p");
    empty.className = "selection-ctx-empty-hint";
    empty.textContent = msg("settings_ctx_emptyHint", "点击下方按钮添加，例如「翻译」组。");
    list.appendChild(empty);
  } else {
    state.selectionContextGroups.forEach((g) => list.appendChild(createCtxGroupCard(g)));
  }
  body.appendChild(list);

  
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "selection-ctx-add-btn";
  addBtn.textContent = msg("settings_ctx_addGroup", "新增右键提示词组");
  addBtn.addEventListener("click", async () => {
    const first = state.groups[0] || null;
    state.selectionContextGroups.push({
      id: `ctx_${Date.now()}`,
      name: msg("settings_ctx_newGroupName", "翻译"),
      enabled: true,
      prompt: msg("settings_ctx_defaultPrompt", "请将以下内容翻译为中文："),
      targetType: first ? "group" : "sites",
      refGroupId: first?.id || null,
      mode: first?.mode || "tabs",
      siteIds: [],
    });
    await persistAll();
    state.renderOtherSection();
  });
  body.appendChild(addBtn);

  sec.appendChild(body);
  return sec;
}


function ctxBadgeText(name) {
  return (name || "").trim().slice(0, 1) || msg("settings_ctx_badgeFallback", "组");
}


function describeCtxTarget(group) {
  if (group.targetType === "group") {
    const ref = state.groups.find((g) => g.id === group.refGroupId);
    const name = ref ? ref.name : msg("settings_ctx_groupPlaceholder", "选择搜索组…");
    return `${msg("settings_ctx_callTypeGroupShort", "搜索组")} · ${name}`;
  }
  const count = (group.siteIds || []).length;
  return `${msg("settings_ctx_callTypeCustomShort", "自定义")} · ${msg("settings_ctx_siteCountUnit", "{n} 站点").replace("{n}", count)}`;
}

function createCtxGroupCard(group) {
  const card = document.createElement("section");
  card.className = `settings-group-card selection-ctx-card${group.enabled ? "" : " is-disabled"}`;

  
  
  
  const head = document.createElement("div");
  head.className = "selection-ctx-card-head";

  const cardBadge = document.createElement("span");
  cardBadge.className = "selection-ctx-card-badge";
  cardBadge.textContent = ctxBadgeText(group.name);
  head.appendChild(cardBadge);

  const cardName = document.createElement("span");
  cardName.className = "selection-ctx-card-name";
  cardName.textContent = group.name;
  head.appendChild(cardName);

  const modePill = document.createElement("span");
  modePill.className = "selection-ctx-card-pill";
  modePill.textContent = group.mode === "tabs"
    ? msg("settings_groups_modeTabs", "新开标签")
    : msg("settings_groups_modeCompare", "卡片呈现");
  head.appendChild(modePill);

  const targetPill = document.createElement("span");
  targetPill.className = "selection-ctx-card-pill";
  targetPill.textContent = describeCtxTarget(group);
  head.appendChild(targetPill);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "selection-ctx-card-delete";
  deleteBtn.setAttribute("aria-label", msg("settings_ctx_deleteAria", "删除"));
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(msg("settings_ctx_deleteConfirm", "删除该右键提示词组？"))) return;
    state.selectionContextGroups = state.selectionContextGroups.filter((g) => g.id !== group.id);
    if (state.openCtxPickerGroupId === group.id) closeCtxPicker();
    await persistAll();
    state.renderOtherSection();
  });
  head.appendChild(deleteBtn);
  card.appendChild(head);

  
  const row1 = document.createElement("div");
  row1.className = "selection-ctx-row1";

  
  const nameWrap = document.createElement("div");
  nameWrap.className = "selection-ctx-name-wrap";
  const nameLabel = document.createElement("span");
  nameLabel.className = "field-label inline-field-label";
  nameLabel.textContent = msg("settings_ctx_fieldNameMax", "组名（最多 6 字）");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "selection-ctx-name-input";
  nameInput.value = group.name;
  nameInput.maxLength = 6;
  nameInput.addEventListener("input", async (e) => {
    const g = getCtxGroupById(group.id);
    if (!g) return;
    g.name = e.target.value;
    cardBadge.textContent = ctxBadgeText(e.target.value);
    cardName.textContent = e.target.value;
    await persistAll();
  });
  nameWrap.append(nameLabel, nameInput);

  
  const modeWrap = document.createElement("label");
  modeWrap.className = "selection-ctx-mode-wrap";
  modeWrap.innerHTML = `
    <span class="field-label inline-field-label">${msg("settings_groups_fieldMode", "呈现方式")}</span>
    <div class="group-mode-dropdown" data-field="mode-dropdown">
      <button class="selection-ctx-mode-trigger" type="button" data-field="mode-trigger" aria-expanded="false">
        <span class="group-mode-trigger-label">${escapeHtml(group.mode === "tabs" ? msg("settings_groups_modeTabs", "新开标签") : msg("settings_groups_modeCompare", "卡片呈现"))}</span>
        <span class="group-mode-trigger-arrow" aria-hidden="true"></span>
      </button>
      <div class="group-mode-menu" data-field="mode-menu" hidden>
        ${GROUP_MODE_OPTIONS.map((o) => `<button class="group-mode-option${group.mode === o.value ? " is-active" : ""}" type="button" data-mode-value="${o.value}">${escapeHtml(getGroupModeLabel(o))}</button>`).join("")}
      </div>
    </div>
  `;
  attachModeDropdown(modeWrap, group);

  
  const callTypeWrap = createCallTypeDropdown(group);

  
  const ctxArea = createContextArea(group);

  row1.append(nameWrap, modeWrap, callTypeWrap, ctxArea);
  card.appendChild(row1);

  
  const promptRow = document.createElement("div");
  promptRow.className = "selection-ctx-prompt-row";
  promptRow.innerHTML = `
    <label class="selection-ctx-prompt-wrap">
      <span class="field-label inline-field-label">${msg("settings_ctx_fieldPrompt", "提示词（置于选中内容前）")}</span>
      <textarea class="selection-ctx-prompt-input" data-field="prompt">${escapeHtml(group.prompt)}</textarea>
    </label>
  `;
  card.appendChild(promptRow);

  const promptTextarea = promptRow.querySelector("[data-field='prompt']");
  promptTextarea?.addEventListener("input", async (e) => {
    const g = getCtxGroupById(group.id);
    if (!g) return;
    g.prompt = e.target.value;
    applyPromptStageHeight(e.target);
    await persistAll();
  });
  
  
  
  
  
  
  
  
  
  
  
  
  
  queueMicrotask(() => {
    if (promptTextarea?.isConnected) applyPromptStageHeight(promptTextarea);
  });

  return card;
}


function createCallTypeDropdown(group) {
  const wrap = document.createElement("div");
  wrap.className = "selection-ctx-calltype-wrap";

  const label = document.createElement("span");
  label.className = "field-label inline-field-label";
  label.textContent = msg("settings_ctx_fieldCallType", "调用方式");

  const dd = document.createElement("div");
  dd.className = "selection-ctx-calltype-dd";
  if (openCallTypeId === group.id) dd.classList.add("is-open");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "selection-ctx-calltype-trigger";
  const curLabel = group.targetType === "group"
    ? msg("settings_ctx_callTypeGroupShort", "搜索组")
    : msg("settings_ctx_callTypeCustomShort", "自定义");
  trigger.innerHTML = `<span>${escapeHtml(curLabel)}</span><span class="selection-ctx-call-arrow" aria-hidden="true"></span>`;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (openCallTypeId === group.id) {
      
      
      
      closeCtxDropdowns(false);
    } else {
      openGroupSelectId = null;
      openDropdown(group.id, (v) => { openCallTypeId = v; }, ".selection-ctx-calltype-dd");
    }
  });
  dd.appendChild(trigger);

  if (openCallTypeId === group.id) {
    const panel = document.createElement("div");
    panel.className = "selection-ctx-calltype-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());

    [
      { label: msg("settings_ctx_callOptionExistingGroup", "已有搜索组"), type: "group" },
      { label: msg("settings_ctx_callOptionCustomSites", "自定义站点"), type: "sites" },
    ].forEach(({ label: lbl, type }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `selection-ctx-call-option${group.targetType === type ? " is-active" : ""}`;
      btn.textContent = lbl;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const g = getCtxGroupById(group.id);
        if (!g) return;
        g.targetType = type;
        if (type === "group" && !g.refGroupId && state.groups.length) {
          g.refGroupId = state.groups[0].id;
        }
        if (type === "sites") { g.refGroupId = null; if (!g.siteIds) g.siteIds = []; }
        openCallTypeId = null;
        await persistAll();
        state.renderOtherSection();
      });
      panel.appendChild(btn);
    });
    dd.appendChild(panel);
  }

  wrap.append(label, dd);
  return wrap;
}


function createContextArea(group) {
  const wrap = document.createElement("div");
  wrap.className = "selection-ctx-ctx-area";

  
  const label = document.createElement("span");
  label.className = "field-label inline-field-label";
  label.textContent = msg("settings_ctx_fieldContext", "上下文区域");
  wrap.appendChild(label);

  if (group.targetType === "group") {
    wrap.appendChild(createGroupDropdown(group));
  } else {
    wrap.appendChild(createSiteChipsInline(group));
  }
  return wrap;
}


function createGroupDropdown(group) {
  const dd = document.createElement("div");
  dd.className = "selection-ctx-group-dd";
  if (openGroupSelectId === group.id) dd.classList.add("is-open");

  const ref = state.groups.find((g) => g.id === group.refGroupId);
  const display = ref ? ref.name : msg("settings_ctx_groupPlaceholder", "选择搜索组…");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "selection-ctx-group-trigger";
  trigger.innerHTML = `<span class="selection-ctx-call-label">${escapeHtml(display)}</span><span class="selection-ctx-call-arrow" aria-hidden="true"></span>`;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (openGroupSelectId === group.id) {
      
      
      closeCtxDropdowns(false);
    } else {
      openCallTypeId = null;
      openDropdown(group.id, (v) => { openGroupSelectId = v; }, ".selection-ctx-group-dd");
    }
  });
  dd.appendChild(trigger);

  if (openGroupSelectId === group.id) {
    const panel = document.createElement("div");
    panel.className = "selection-ctx-call-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    if (!state.groups.length) {
      const hint = document.createElement("div");
      hint.className = "selection-ctx-call-option";
      hint.style.cssText = "color:#888;cursor:default";
      hint.textContent = msg("settings_ctx_noGroupsHint", "请先创建搜索组");
      panel.appendChild(hint);
    } else {
      state.groups.forEach((g) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `selection-ctx-call-option${group.refGroupId === g.id ? " is-active" : ""}`;
        btn.textContent = g.name;
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const ctxG = getCtxGroupById(group.id);
          if (!ctxG) return;
          ctxG.refGroupId = g.id;
          openGroupSelectId = null;
          await persistAll();
          state.renderOtherSection();
        });
        panel.appendChild(btn);
      });
    }
    dd.appendChild(panel);
  }

  return dd;
}


function createSiteChipsInline(group) {
  const wrap = document.createElement("div");
  wrap.className = "selection-ctx-sites-inline";

  const chipsArea = document.createElement("div");
  chipsArea.className = "selection-ctx-chips-area";

  const sites = (group.siteIds || []).map((id) => state.sites.find((s) => s.id === id)).filter(Boolean);
  sites.forEach((site) => {
    const chip = document.createElement("div");
    chip.className = "site-chip selected-chip selection-ctx-inline-chip";
    chip.innerHTML = `<span class="site-chip-label">${escapeHtml(site.name)}</span><button class="chip-remove-btn" type="button">×</button>`;
    chip.querySelector(".chip-remove-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      const g = getCtxGroupById(group.id);
      if (!g) return;
      g.siteIds = (g.siteIds || []).filter((id) => id !== site.id);
      await persistAll();
      state.renderOtherSection();
    });
    chipsArea.appendChild(chip);
  });
  wrap.appendChild(chipsArea);

  if (sites.length < MAX_CUSTOM_SITES) {
    const addWrap = document.createElement("div");
    addWrap.className = "inline-add-wrap selection-ctx-inline-add";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = `inline-add-btn${state.openCtxPickerGroupId === group.id ? " is-active" : ""}`;
    addBtn.textContent = msg("common_add", "新增");
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearCtxPickerTimer();
      if (state.openCtxPickerGroupId === group.id) {
        closeCtxPicker();
      } else {
        state.openCtxPickerGroupId = group.id;
        if (!SITE_CATEGORIES[state.activeCtxPickerCategoryKey]) {
          state.activeCtxPickerCategoryKey = Object.keys(SITE_CATEGORIES)[0] || null;
        }
      }
      state.renderOtherSection();
    });
    addWrap.appendChild(addBtn);
    if (state.openCtxPickerGroupId === group.id) addWrap.appendChild(createHoverPicker(group));
    wrap.appendChild(addWrap);
  } else {
    const note = document.createElement("span");
    note.className = "selection-ctx-max-note";
    note.textContent = msg("settings_ctx_maxSitesNote", `最多 ${MAX_CUSTOM_SITES} 个`);
    wrap.appendChild(note);
  }

  return wrap;
}

