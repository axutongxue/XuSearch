import { state, msg, createBlankCustomFormState } from "../state.js";
import { escapeHtml } from "../utils.js";
import {
  persistAll,
  createCustomSiteId,
  deriveMatchPatterns,
  convertUrlToTemplate,
} from "../store.js";
import { decorateSiteAvatar } from "../site-icons.js";
import { createSiteIconFetchButton } from "../site-icon-button.js";





export function renderCustomSection() {
  const { customSection } = state.dom;
  customSection.innerHTML = "";
  customSection.appendChild(createAddSection());
  customSection.appendChild(createListSection());
}



function createAddSection() {
  const group = document.createElement("section");
  
  
  group.className = "misc-group custom-add-group";
  group.innerHTML = `
    <div class="misc-group-head">
      <h2>${msg("settings_custom_groupAdd", "添加站点")}</h2>
      <span class="misc-group-sub">${msg("settings_custom_groupAddSub", "手动填写或粘贴链接自动转换")}</span>
    </div>
  `;

  
  const converterRow = document.createElement("div");
  converterRow.className = "misc-line";
  converterRow.innerHTML = `
    <div class="misc-glyph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M11 3l4 4-4 4M20 17H9M13 13l-4 4 4 4"/></svg>
    </div>
    <div class="misc-info">
      <div class="misc-line-title">${msg("settings_custom_convertTitle", "URL 规则转换")}</div>
      <div class="misc-line-desc">${msg("settings_custom_convertDesc", "粘贴一条带搜索词的 URL，自动识别搜索参数并替换为 {query}")}</div>
    </div>
    <div class="custom-line-input">
      <input class="custom-converter-input" type="text" placeholder="https://www.example.com/search?wd=今天天气" />
    </div>
    <button class="btn custom-btn-ghost custom-convert-btn" type="button">${msg("settings_custom_convertBtn", "转换")}</button>
  `;
  group.appendChild(converterRow);

  const converterMsg = document.createElement("div");
  converterMsg.className = "custom-line-msg";
  if (state.customFormState.converterError) {
    converterMsg.textContent = state.customFormState.converterError;
    converterMsg.classList.add("is-error");
  }
  group.appendChild(converterMsg);

  
  const nameRow = document.createElement("div");
  nameRow.className = "misc-line";
  nameRow.innerHTML = `
    <div class="misc-glyph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/></svg>
    </div>
    <div class="misc-info">
      <div class="misc-line-title">${msg("settings_custom_fieldName", "名称")}</div>
      <div class="misc-line-desc">${msg("settings_custom_nameDesc", "显示在站点选择器与列表中的名称")}</div>
    </div>
    <div class="custom-line-input">
      <input class="custom-form-input" type="text" data-field="name" />
    </div>
  `;
  group.appendChild(nameRow);

  
  const urlRow = document.createElement("div");
  urlRow.className = "misc-line";
  urlRow.innerHTML = `
    <div class="misc-glyph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
    </div>
    <div class="misc-info">
      <div class="misc-line-title">${msg("settings_custom_fieldUrl", "URL 链接")}</div>
      <div class="misc-line-desc">${msg("settings_custom_addDesc", "填写站点名称与 URL，{query} 会在搜索时自动替换为你的关键词。")}</div>
    </div>
    <div class="custom-line-input">
      <input class="custom-form-input" type="text" data-field="url" />
    </div>
  `;
  group.appendChild(urlRow);

  const formMsg = document.createElement("div");
  formMsg.className = "custom-line-msg";
  if (state.customFormState.formError) {
    formMsg.textContent = state.customFormState.formError;
    formMsg.classList.add("is-error");
  }
  group.appendChild(formMsg);

  const actions = document.createElement("div");
  actions.className = "custom-form-actions";
  actions.innerHTML = `
    <button class="btn custom-btn-ghost custom-form-clear-btn" type="button">${msg("settings_custom_clear", "清空")}</button>
    <button class="btn custom-btn-primary custom-form-submit-btn" type="button">${msg("settings_custom_confirmAdd", "确定添加")}</button>
  `;
  group.appendChild(actions);

  
  const converterInput = converterRow.querySelector(".custom-converter-input");
  if (converterInput) {
    converterInput.value = state.customFormState.converterInput || "";
    converterInput.addEventListener("input", (e) => {
      state.customFormState.converterInput = e.target.value;
      state.customFormState.converterError = "";
      if (converterMsg) converterMsg.textContent = "";
    });
    converterInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleConvertClick(converterMsg); }
    });
  }
  const nameInput = nameRow.querySelector("[data-field='name']");
  if (nameInput) {
    nameInput.value = state.customFormState.name || "";
    nameInput.addEventListener("input", (e) => { state.customFormState.name = e.target.value; });
  }
  const urlInput = urlRow.querySelector("[data-field='url']");
  if (urlInput) {
    urlInput.value = state.customFormState.url || "";
    urlInput.addEventListener("input", (e) => { state.customFormState.url = e.target.value; });
  }

  converterRow.querySelector(".custom-convert-btn")?.addEventListener("click", () => handleConvertClick(converterMsg));
  actions.querySelector(".custom-form-clear-btn")?.addEventListener("click", () => {
    state.customFormState = createBlankCustomFormState();
    renderCustomSection();
  });
  actions.querySelector(".custom-form-submit-btn")?.addEventListener("click", handleAddSubmit);

  return group;
}

function handleConvertClick(converterMsg) {
  const result = convertUrlToTemplate(state.customFormState.converterInput);
  if (!result.ok) {
    state.customFormState.converterError = result.error;
    if (converterMsg) {
      converterMsg.textContent = result.error;
      converterMsg.classList.add("is-error");
    }
    return;
  }
  state.customFormState.url = result.url;
  if (!state.customFormState.name && result.name) state.customFormState.name = result.name;
  state.customFormState.formError = "";
  state.customFormState.converterError = "";
  renderCustomSection();
}

async function handleAddSubmit() {
  const name = String(state.customFormState.name || "").trim();
  const url = String(state.customFormState.url || "").trim();
  const error = validateSiteForm(name, url);
  if (error) {
    state.customFormState.formError = error;
    renderCustomSection();
    return;
  }

  state.customSites = [...state.customSites, {
    id: createCustomSiteId(),
    name, url,
    enabled: true,
    supportIframe: true,
    supportUrlQuery: true,
    matchPatterns: deriveMatchPatterns(url),
    isCustom: true,
    customType: "url"
  }];

  state.customFormState = createBlankCustomFormState();
  await persistAll();
  renderCustomSection();
}



function createListSection() {
  const urlSites = state.customSites.filter((s) => s.customType !== "ai");

  const group = document.createElement("section");
  group.className = "misc-group";

  const head = document.createElement("div");
  head.className = "misc-group-head custom-list-head";
  head.innerHTML = `
    <h2>${msg("settings_custom_listTitle", "已添加的自定义站点")}</h2>
    <span class="misc-group-sub">${msg("settings_custom_listCountPrefix", "当前共 ")}${urlSites.length}${msg("settings_custom_listCountSuffix", " 个自定义站点。")}</span>
  `;
  group.appendChild(head);

  if (urlSites.length) {
    
    
    head.appendChild(
      createSiteIconFetchButton({
        getTargetIds: () =>
          state.customSites.filter((s) => s.customType !== "ai").map((s) => s.id),
        keyPrefix: "custom",
        emptyTitle: msg("settings_custom_fetchIconsEmpty", "还没有自定义站点"),
        onFinished: () => {
          if (state.activeSection === "custom") renderCustomSection();
        },
      }),
    );
  }

  if (!urlSites.length) {
    const empty = document.createElement("div");
    empty.className = "custom-empty";
    empty.textContent = msg("settings_custom_listEmptyV2", "还没有自定义站点，在上方添加后会在这里显示。");
    group.appendChild(empty);
    return group;
  }

  urlSites.forEach((site) => group.appendChild(createSiteRow(site)));
  return group;
}

function createSiteRow(site) {
  const editingThis = state.customEditState?.id === site.id;
  const row = document.createElement("div");
  row.className = "misc-line custom-site-row" + (editingThis ? " is-editing" : "");

  if (editingThis) {
    row.appendChild(buildEditBlock(site));
    return row;
  }

  row.innerHTML = `
    <div class="custom-avatar" style="--custom-avatar-bg:${avatarGradient(site.name)};">${escapeHtml((site.name || "?").slice(0, 1).toUpperCase())}</div>
    <div class="misc-info">
      <div class="misc-line-title">${escapeHtml(site.name)}</div>
      <div class="custom-url-text">${highlightQuery(site.url)}</div>
    </div>
    <div class="custom-row-act">
      <button class="custom-icon-btn" type="button" title="${msg("common_edit", "编辑")}">✎</button>
      <button class="custom-icon-btn" type="button" title="${msg("common_delete", "删除")}">×</button>
    </div>
  `;

  
  decorateSiteAvatar(row.querySelector(".custom-avatar"), site);

  row.querySelector(".custom-icon-btn")?.addEventListener("click", () => startEdit(site));
  row.querySelectorAll(".custom-icon-btn")[1]?.addEventListener("click", () => handleDeleteSite(site));

  return row;
}


function buildEditBlock(site) {
  const edit = state.customEditState || { id: site.id, name: site.name, url: site.url, error: "" };

  const block = document.createElement("div");
  block.className = "custom-edit-block";

  const avatar = document.createElement("div");
  avatar.className = "custom-avatar";
  avatar.style.setProperty("--custom-avatar-bg", avatarGradient(edit.name || site.name));
  avatar.textContent = (edit.name || site.name || "?").slice(0, 1).toUpperCase();
  decorateSiteAvatar(avatar, site);
  block.appendChild(avatar);

  const body = document.createElement("div");
  body.className = "custom-edit-body";
  body.innerHTML = `
    <div class="custom-edit-title">
      <span class="custom-editing-badge">${msg("settings_custom_editingBadge", "编辑中")}</span>
      <span class="custom-edit-origin">${msg("settings_custom_editingOrigin", "修改会即时应用到所有引用该站点的搜索组")}</span>
    </div>
    <div class="custom-edit-fields">
      <div class="custom-edit-field">
        <label>${msg("settings_custom_fieldName", "名称")}</label>
        <input class="custom-edit-input" type="text" data-field="edit-name" />
      </div>
      <div class="custom-edit-field">
        <label>${msg("settings_custom_fieldUrl", "URL 链接")}</label>
        <input class="custom-edit-input" type="text" data-field="edit-url" />
      </div>
    </div>
    <div class="custom-edit-msg" data-field="edit-msg"></div>
    <div class="custom-edit-actions">
      <button class="btn custom-btn-ghost custom-edit-cancel-btn" type="button">${msg("common_cancel", "取消")}</button>
      <button class="btn custom-btn-primary custom-edit-save-btn" type="button">${msg("settings_custom_saveEdit", "保存修改")}</button>
    </div>
  `;
  block.appendChild(body);

  const nameInput = body.querySelector("[data-field='edit-name']");
  const urlInput = body.querySelector("[data-field='edit-url']");
  const msgEl = body.querySelector("[data-field='edit-msg']");
  if (nameInput) {
    nameInput.value = edit.name || "";
    nameInput.addEventListener("input", (e) => { state.customEditState.name = e.target.value; });
    
    requestAnimationFrame(() => nameInput.focus());
  }
  if (urlInput) {
    urlInput.value = edit.url || "";
    urlInput.addEventListener("input", (e) => { state.customEditState.url = e.target.value; });
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitEdit(msgEl); }
    });
  }
  if (edit.error && msgEl) {
    msgEl.textContent = edit.error;
    msgEl.classList.add("is-error");
  }

  body.querySelector(".custom-edit-cancel-btn")?.addEventListener("click", cancelEdit);
  body.querySelector(".custom-edit-save-btn")?.addEventListener("click", () => submitEdit(msgEl));

  return block;
}

function startEdit(site) {
  state.customEditState = { id: site.id, name: site.name, url: site.url, error: "" };
  renderCustomSection();
}

function cancelEdit() {
  state.customEditState = null;
  renderCustomSection();
}

async function submitEdit(msgEl) {
  const edit = state.customEditState;
  if (!edit) return;
  const name = String(edit.name || "").trim();
  const url = String(edit.url || "").trim();
  const error = validateSiteForm(name, url);
  if (error) {
    state.customEditState.error = error;
    if (msgEl) {
      msgEl.textContent = error;
      msgEl.classList.add("is-error");
    }
    return;
  }

  state.customSites = state.customSites.map((site) =>
    site.id === edit.id
      ? { ...site, name, url, supportUrlQuery: true, matchPatterns: deriveMatchPatterns(url) }
      : site
  );
  state.customEditState = null;
  await persistAll();
  renderCustomSection();
}

async function handleDeleteSite(site) {
  const confirmed = window.confirm(
    msg("settings_custom_deleteConfirmPrefix", "是否要删除自定义站点「") +
      site.name +
      msg("settings_custom_deleteConfirmMid", "」？\n") +
      msg("settings_custom_deleteConfirmBody", "删除后，所有搜索组中引用该站点的记录也会同步移除。")
  );
  if (!confirmed) return;
  state.customSites = state.customSites.filter((item) => item.id !== site.id);
  state.groups = state.groups.map((group) => ({
    ...group,
    siteIds: (group.siteIds || []).filter((id) => id !== site.id)
  }));
  if (state.customEditState?.id === site.id) {
    state.customEditState = null;
  }
  await persistAll();
  renderCustomSection();
}




function validateSiteForm(name, url) {
  if (!name) return msg("settings_custom_errorNameRequired", "请输入站点名称。");
  if (!url) return msg("settings_custom_errorUrlRequired", "请输入 URL 链接。");
  if (!/^https?:\/\//i.test(url)) return msg("settings_custom_errorUrlProtocol", "URL 必须以 http:// 或 https:// 开头。");
  if (!url.includes("{query}")) return msg("settings_custom_errorMissingQuery", "URL 中必须包含 {query} 作为搜索词占位符。");
  try { new URL(url.replace("{query}", "ai")); } catch (_) {
    return msg("settings_custom_errorUrlInvalid", "URL 格式不合法，请检查后重试。");
  }
  return null;
}


function highlightQuery(url) {
  const safe = escapeHtml(String(url || ""));
  return safe.replace(/\{query\}/g, '<span class="custom-q">{query}</span>');
}


function avatarGradient(name) {
  const gradients = [
    "linear-gradient(135deg,#2b5fd9,#7d9cf5)",
    "linear-gradient(135deg,#10b981,#34d399)",
    "linear-gradient(135deg,#8b5cf6,#a78bfa)",
    "linear-gradient(135deg,#f59e0b,#f97316)",
    "linear-gradient(135deg,#ec4899,#f472b6)",
    "linear-gradient(135deg,#14b8a6,#2dd4bf)",
  ];
  let hash = 0;
  for (const ch of String(name || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return gradients[hash % gradients.length];
}
