import { msg } from "../state.js";
import { externalLinkIcon } from "../external-link-icon.js";

const PROMPT_BASE_H = 96;
const PROMPT_STAGES = [PROMPT_BASE_H, Math.round(PROMPT_BASE_H * 1.75), Math.round(PROMPT_BASE_H * 3.5)];

function applyPromptStageHeight(el) {
  const savedH = el.style.height;
  el.style.height = "auto";
  const contentH = el.scrollHeight;
  el.style.height = savedH;
  let stageH = PROMPT_STAGES[PROMPT_STAGES.length - 1];
  for (const h of PROMPT_STAGES) {
    if (contentH <= h) { stageH = h; break; }
  }
  const atMax = stageH === PROMPT_STAGES[PROMPT_STAGES.length - 1];
  const prevH = parseInt(savedH) || 0;
  el.style.height = (atMax ? Math.max(stageH, prevH) : stageH) + "px";
  el.style.overflowY = atMax ? "auto" : "hidden";
  el.style.resize = atMax ? "vertical" : "none";
}

import {
  loadAiSummarySettings,
  saveAiSummarySettings,
  DEFAULT_SUMMARY_SETTINGS,
  DEFAULT_SUMMARY_PROMPT,
  callAiSummary,
  makePromptGroup,
  getPromptGroups,
  getProviderEntries,
  getProviderEntryView,
  getActiveProviderIds,
  createCustomProviderEntry,
} from "../../../shared/ai-summary-api.js";


const FREE_API_URL = "https://xusearch.com/docs/free-api.html";


const ICON_FREE_API = externalLinkIcon("free-api-entry-icon");


export function createFreeApiEntryButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "free-api-entry-btn";
  
  
  btn.innerHTML = ICON_FREE_API;
  btn.append(msg("settings_aiSummary_getFreeApi", "获取免费 API"));
  btn.addEventListener("click", () => {
    chrome.tabs.create({ url: FREE_API_URL }).catch(() => {});
  });
  return btn;
}

export function createAiSummaryProviderCard() {
  const card = document.createElement("section");
  
  card.className = "ai-summary-card ai-summary-card--flush";

  card.innerHTML = `
    <div class="ai-summary-two-col">
      <div class="ai-summary-left-col">
        <div class="ai-summary-list-header">
          <span class="ai-summary-list-title">${msg("settings_aiSummaryProvider", "自定义服务")}</span>
          <button type="button" class="ai-summary-add-custom-btn">+ ${msg("settings_aiSummaryAddCustom", "添加自定义服务")}</button>
        </div>
        <div class="ai-summary-config-list" role="list" aria-label="${msg("settings_aiSummaryProvider", "自定义服务列表")}"></div>
        <div class="ai-summary-list-empty">${msg("settings_aiSummaryNoConfig", "暂无自定义服务，点击右上角添加")}</div>
      </div>
      <div class="ai-summary-right-col">
        <div class="ai-summary-form-card">
          <div class="ai-summary-field ai-summary-label-field">
            <label class="ai-summary-label">${msg("settings_aiSummaryConfigLabel", "配置名称")}</label>
            <input type="text" class="ai-summary-input ai-summary-label-input" placeholder="${msg("settings_aiSummaryConfigLabelPlaceholder", "给这个配置起个名字...")}" spellcheck="false" />
          </div>
          <div class="ai-summary-field ai-summary-base-url-field">
            <label class="ai-summary-label">Base URL</label>
            <input type="text" class="ai-summary-input ai-summary-base-url-input" placeholder="https://your-api.example.com/v1" spellcheck="false" />
            <span class="ai-summary-hint ai-summary-base-url-hint">${msg("settings_aiSummaryBaseUrlHint", "OpenAI 兼容接口的 Base URL，通常以 /v1 结尾。")}</span>
          </div>
          <div class="ai-summary-field">
            <label class="ai-summary-label">${msg("settings_aiSummaryApiKey", "API Key")}</label>
            <input type="password" class="ai-summary-input ai-summary-key-input" placeholder="${msg("settings_aiSummaryApiKeyPlaceholder", "sk-...")}" autocomplete="off" spellcheck="false" />
            <label class="ai-summary-show-key-label">
              <input type="checkbox" class="ai-summary-show-key-checkbox" />
              <span>${msg("settings_aiSummaryShowKey", "显示 API Key")}</span>
            </label>
          </div>
          <div class="ai-summary-field">
            <label class="ai-summary-label">${msg("settings_aiSummaryModel", "模型")}</label>
            <input type="text" class="ai-summary-input ai-summary-model-input" placeholder="${msg("settings_aiSummaryCustomModelPlaceholder", "输入模型名")}" autocomplete="off" spellcheck="false" />
            <span class="ai-summary-hint">${msg("settings_aiSummaryModelHint", "填写该接口支持的模型名，例如 gpt-4o、deepseek-chat。")}</span>
          </div>
          <details class="ai-summary-advanced ai-summary-advanced-fields">
            <summary>
              <svg class="ai-summary-advanced-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              <span>${msg("settings_aiSummaryAdvanced", "高级设置")}</span>
              <small>${msg("settings_aiSummaryAdvancedHint", "留空则使用服务商默认值")}</small>
            </summary>
            <div class="ai-summary-advanced-body">
              <div class="ai-summary-field">
                <label class="ai-summary-label">${msg("settings_aiSummaryTemperature", "Temperature")}</label>
                <input type="number" class="ai-summary-input ai-summary-temperature-input" placeholder="0.2" min="0" max="2" step="0.1" autocomplete="off" spellcheck="false" />
                <span class="ai-summary-hint">${msg("settings_aiSummaryTemperatureHint", "采样随机性，0~2，默认 0.2。总结任务一般建议 0.2~0.3。")}</span>
              </div>
              <div class="ai-summary-field">
                <label class="ai-summary-label">${msg("settings_aiSummaryMaxTokens", "最大输出长度 (max_tokens)")}</label>
                <input type="number" class="ai-summary-input ai-summary-max-tokens-input" placeholder="4000" min="1" step="100" autocomplete="off" spellcheck="false" />
                <span class="ai-summary-hint">${msg("settings_aiSummaryMaxTokensHint", "单次回答的最大 token 数，默认 4000（1 个 token ≈ 1～2 个汉字）。")}</span>
              </div>
              <div class="ai-summary-field ai-summary-thinking-field">
                <label class="ai-summary-label">${msg("settings_aiSummaryThinking", "思考模式")}</label>
                <label class="ai-summary-show-key-label">
                  <input type="checkbox" class="ai-summary-thinking-checkbox" />
                  <span>${msg("settings_aiSummaryThinkingLabel", "启用思考模式（仅支持思考的模型生效）")}</span>
                </label>
              </div>
            </div>
          </details>
          <div class="ai-summary-actions-row">
            <button type="button" class="ai-summary-test-btn">${msg("settings_aiSummaryTestConn", "测试连接")}</button>
            <button type="button" class="ai-summary-save-btn">${msg("settings_aiSummarySave", "保存")}</button>
            <span class="ai-summary-feedback" hidden></span>
          </div>
        </div>
      </div>
    </div>
    <div class="ai-summary-prompt-row">
      <div class="ai-summary-left-col">
        <div class="ai-summary-list-header">
          <span class="ai-summary-list-title">${msg("settings_aiSummaryPrompt", "总结提示词")}</span>
          <button type="button" class="ai-summary-add-custom-btn ai-summary-pg-add-btn">+ ${msg("settings_aiSummaryAddGroup", "新建提示词")}</button>
        </div>
        <div class="ai-summary-config-list ai-summary-prompt-list" role="list" aria-label="${msg("settings_aiSummaryPrompt", "总结提示词列表")}"></div>
        <div class="ai-summary-list-empty ai-summary-prompt-empty">${msg("settings_aiSummaryNoGroup", "暂无提示词，点击右上角新建")}</div>
      </div>
      <div class="ai-summary-right-col">
        <div class="ai-summary-form-card ai-summary-prompt-editor">
          <div class="ai-summary-field">
            <label class="ai-summary-label">${msg("settings_aiSummaryGroupName", "提示词组名称")}</label>
            <input type="text" class="ai-summary-input ai-summary-group-name-input" placeholder="${msg("settings_aiSummaryGroupNamePlaceholder", "给这组提示词起个名字...")}" spellcheck="false" />
          </div>
          <div class="ai-summary-field">
            <label class="ai-summary-label">${msg("settings_aiSummaryPromptContent", "提示词内容")}</label>
            <textarea class="ai-summary-input ai-summary-prompt-textarea" rows="1" placeholder="${msg("settings_aiSummaryPromptPlaceholder", "输入自定义总结指令...")}"></textarea>
          </div>
          <div class="ai-summary-actions-row">
            <button type="button" class="ai-summary-save-btn ai-summary-pg-save-btn">${msg("settings_aiSummarySave", "保存")}</button>
            <span class="ai-summary-feedback ai-summary-pg-feedback" hidden></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const configList = card.querySelector(".ai-summary-two-col .ai-summary-config-list");
  const listEmpty = card.querySelector(".ai-summary-two-col .ai-summary-list-empty");
  const addCustomBtn = card.querySelector(".ai-summary-two-col .ai-summary-add-custom-btn");
  const labelInput = card.querySelector(".ai-summary-label-input");
  const keyInput = card.querySelector(".ai-summary-key-input");
  const showKeyCheckbox = card.querySelector(".ai-summary-show-key-checkbox");
  const modelInput = card.querySelector(".ai-summary-model-input");
  const temperatureInput = card.querySelector(".ai-summary-temperature-input");
  const maxTokensInput = card.querySelector(".ai-summary-max-tokens-input");
  const thinkingCheckbox = card.querySelector(".ai-summary-thinking-checkbox");
  const baseUrlInput = card.querySelector(".ai-summary-base-url-input");
  const promptTextarea = card.querySelector(".ai-summary-prompt-textarea");
  const promptList = card.querySelector(".ai-summary-prompt-list");
  const promptEmpty = card.querySelector(".ai-summary-prompt-empty");
  const addPgBtn = card.querySelector(".ai-summary-pg-add-btn");
  const groupNameInput = card.querySelector(".ai-summary-group-name-input");
  const testBtn = card.querySelector(".ai-summary-test-btn");
  const saveBtn = card.querySelector(".ai-summary-save-btn");
  const feedbackEl = card.querySelector(".ai-summary-feedback");
  
  const pgSaveBtn = card.querySelector(".ai-summary-pg-save-btn");
  const pgFeedbackEl = card.querySelector(".ai-summary-pg-feedback");

  let settings = { ...DEFAULT_SUMMARY_SETTINGS };
  let activeConfigId = null;
  let activeGroupIndex = 0;
  let saveTimer = null;
  let saveInFlight = null;

  function showFeedback(text, isError = false) {
    showFeedbackOn(feedbackEl, text, isError);
  }

  function showFeedbackOn(el, text, isError = false) {
    el.textContent = text;
    el.hidden = false;
    
    el.classList.remove("is-error", "is-ok");
    el.classList.add(isError ? "is-error" : "is-ok");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.hidden = true;
    }, 2000);
  }

  async function persistSettings() {
    captureCurrentConfigFields();
    try {
      if (saveInFlight) await saveInFlight;
      saveInFlight = saveAiSummarySettings(settings);
      await saveInFlight;
    } catch (err) {
      showFeedback(err.message || msg("settings_aiSummarySaveFail", "保存失败。"), true);
    } finally {
      saveInFlight = null;
    }
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persistSettings(); }, 400);
  }

  function getCurrentEntry() {
    return getProviderEntries(settings).find((e) => e.id === activeConfigId) || null;
  }

  function createToggleSwitch(isActive, onChange) {
    const label = document.createElement("label");
    label.className = "ai-summary-row-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "ai-summary-row-switch-input";
    input.checked = isActive;
    const slider = document.createElement("span");
    slider.className = "ai-summary-row-switch-slider";
    label.appendChild(input);
    label.appendChild(slider);
    label.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    input.addEventListener("change", async () => {
      await onChange(input.checked);
    });
    return label;
  }

  
  function reassignDefaultIfInvalid() {
    const activeIds = getActiveProviderIds(settings);
    const currentDefault = String(settings.defaultProviderId || "");
    if (currentDefault && activeIds.includes(currentDefault)) return;
    settings.defaultProviderId = activeIds[0] || "";
  }

  function renderConfigList() {
    configList.innerHTML = "";
    const entries = getProviderEntries(settings);
    const activeIds = new Set(getActiveProviderIds(settings));
    const defaultId = String(settings.defaultProviderId || "");

    listEmpty.hidden = entries.length > 0;

    entries.forEach((entry) => {
      const isEditing = entry.id === activeConfigId;
      const isActive = activeIds.has(entry.id);
      const isDefault = entry.id === defaultId && isActive;

      const row = document.createElement("div");
      row.className = "ai-summary-config-row"
        + (isEditing ? " is-editing" : "")
        + (isActive ? " is-active" : "")
        + (isDefault ? " is-default" : "");
      row.dataset.configId = entry.id;
      row.setAttribute("role", "listitem");
      row.title = entry.label || "Custom";

      const meta = document.createElement("div");
      meta.className = "ai-summary-config-row-meta";

      const name = document.createElement("span");
      name.className = "ai-summary-config-row-name";
      name.textContent = entry.label || "Custom";
      meta.appendChild(name);

      const actions = document.createElement("div");
      actions.className = "ai-summary-config-row-actions";

      
      if (!isDefault) {
        const setDefaultBtn = document.createElement("button");
        setDefaultBtn.type = "button";
        setDefaultBtn.className = "ai-summary-config-row-default-btn";
        setDefaultBtn.textContent = msg("settings_aiSummarySetDefault", "设为默认");
        setDefaultBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          captureCurrentConfigFields();
          settings.defaultProviderId = entry.id;
          renderConfigList();
          await persistSettings();
        });
        actions.appendChild(setDefaultBtn);
      } else {
        const badge = document.createElement("span");
        badge.className = "ai-summary-config-row-default-badge";
        badge.textContent = msg("settings_aiSummaryIsDefault", "当前默认");
        actions.appendChild(badge);
      }

      const toggle = createToggleSwitch(isActive, async (nextActive) => {
        captureCurrentConfigFields();
        const ids = getActiveProviderIds(settings);
        if (nextActive) {
          settings.activeProviderIds = [...ids, entry.id];
        } else {
          settings.activeProviderIds = ids.filter((id) => id !== entry.id);
          reassignDefaultIfInvalid();
        }
        renderConfigList();
        await persistSettings();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "ai-summary-config-row-delete";
      deleteBtn.title = msg("settings_aiSummaryDeleteConfig", "删除此配置");
      deleteBtn.setAttribute("aria-label", msg("settings_aiSummaryDeleteConfig", "删除此配置"));
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="13" height="13" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!window.confirm(msg("settings_aiSummaryConfirmDelete", `删除配置「${entry.label || "Custom"}」？`))) return;
        const entriesNow = getProviderEntries(settings);
        const idx = entriesNow.findIndex((e) => e.id === entry.id);
        entriesNow.splice(idx, 1);
        settings.providers = entriesNow;
        settings.activeProviderIds = (settings.activeProviderIds || []).filter((id) => id !== entry.id);
        reassignDefaultIfInvalid();
        if (activeConfigId === entry.id) {
          activeConfigId = entriesNow[Math.min(idx, entriesNow.length - 1)]?.id || entriesNow[0]?.id || null;
        }
        renderConfigList();
        renderConfigFields(activeConfigId);
        await persistSettings();
      });

      actions.appendChild(toggle);
      actions.appendChild(deleteBtn);

      row.appendChild(meta);
      row.appendChild(actions);

      row.addEventListener("click", () => {
        if (entry.id === activeConfigId) return;
        captureCurrentConfigFields();
        activeConfigId = entry.id;
        renderConfigList();
        renderConfigFields(entry.id);
      });

      configList.appendChild(row);
    });
  }

  function addCustomProvider() {
    captureCurrentConfigFields();
    const entry = createCustomProviderEntry(`${msg("settings_aiSummaryConfigDefaultName", "自定义服务")} ${getProviderEntries(settings).length + 1}`);
    settings.providers = [...getProviderEntries(settings), entry];
    settings.activeProviderIds = [...getActiveProviderIds(settings), entry.id];
    
    if (!String(settings.defaultProviderId || "")) {
      settings.defaultProviderId = entry.id;
    }
    activeConfigId = entry.id;
    renderConfigList();
    renderConfigFields(entry.id);
    labelInput.focus();
    labelInput.select();
    persistSettings();
  }

  function getSelectedModel() {
    return modelInput.value.trim();
  }

  function captureCurrentGroup() {
    const group = settings.promptGroups?.[activeGroupIndex];
    if (!group) return;
    group.name = groupNameInput.value.trim() || "默认总结";
    group.prompt = promptTextarea.value.trim() || DEFAULT_SUMMARY_PROMPT;
  }

  function loadGroupFields(index) {
    const group = settings.promptGroups?.[index];
    if (!group) return;
    groupNameInput.value = group.name || "";
    promptTextarea.value = group.prompt || "";
    applyPromptStageHeight(promptTextarea);
  }

  
  function reassignPromptDefaultIfInvalid() {
    const groups = settings.promptGroups || [];
    const currentDefault = String(settings.defaultPromptGroupId || "");
    if (currentDefault && groups.some((g) => g.id === currentDefault)) return;
    settings.defaultPromptGroupId = groups[0]?.id || "";
  }

  
  function renderPromptGroupList() {
    promptList.innerHTML = "";
    const groups = settings.promptGroups || [];
    const defaultId = String(settings.defaultPromptGroupId || "");

    promptEmpty.hidden = groups.length > 0;

    groups.forEach((group, index) => {
      const isEditing = index === activeGroupIndex;
      const isDefault = group.id === defaultId;

      const row = document.createElement("div");
      row.className = "ai-summary-config-row"
        + (isEditing ? " is-editing" : "")
        + (isDefault ? " is-default" : "");
      row.dataset.groupId = group.id;
      row.setAttribute("role", "listitem");
      row.title = group.name || "未命名";

      const meta = document.createElement("div");
      meta.className = "ai-summary-config-row-meta";

      const name = document.createElement("span");
      name.className = "ai-summary-config-row-name";
      name.textContent = group.name || "未命名";
      meta.appendChild(name);

      const actions = document.createElement("div");
      actions.className = "ai-summary-config-row-actions";

      if (!isDefault) {
        const setDefaultBtn = document.createElement("button");
        setDefaultBtn.type = "button";
        setDefaultBtn.className = "ai-summary-config-row-default-btn";
        setDefaultBtn.textContent = msg("settings_aiSummarySetDefault", "设为默认");
        setDefaultBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          captureCurrentGroup();
          settings.defaultPromptGroupId = group.id;
          renderPromptGroupList();
          await persistSettings();
        });
        actions.appendChild(setDefaultBtn);
      } else {
        const badge = document.createElement("span");
        badge.className = "ai-summary-config-row-default-badge";
        badge.textContent = msg("settings_aiSummaryIsDefault", "当前默认");
        actions.appendChild(badge);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "ai-summary-config-row-delete";
      deleteBtn.title = msg("settings_aiSummaryDeleteGroup", "删除此组");
      deleteBtn.setAttribute("aria-label", msg("settings_aiSummaryDeleteGroup", "删除此组"));
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="13" height="13" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (groups.length <= 1) return;
        captureCurrentGroup();
        settings.promptGroups.splice(index, 1);
        reassignPromptDefaultIfInvalid();
        if (activeGroupIndex >= settings.promptGroups.length) {
          activeGroupIndex = settings.promptGroups.length - 1;
        }
        renderPromptGroupList();
        loadGroupFields(activeGroupIndex);
        await persistSettings();
      });
      actions.appendChild(deleteBtn);

      row.appendChild(meta);
      row.appendChild(actions);

      row.addEventListener("click", () => {
        if (index === activeGroupIndex) return;
        captureCurrentGroup();
        activeGroupIndex = index;
        renderPromptGroupList();
        loadGroupFields(index);
      });

      promptList.appendChild(row);
    });
  }

  function addPromptGroup() {
    captureCurrentGroup();
    const newGroup = makePromptGroup(
      `${msg("settings_aiSummaryGroupDefaultName", "提示词")} ${(settings.promptGroups || []).length + 1}`,
      DEFAULT_SUMMARY_PROMPT
    );
    settings.promptGroups = [...(settings.promptGroups || []), newGroup];
    
    if (!String(settings.defaultPromptGroupId || "")) {
      settings.defaultPromptGroupId = newGroup.id;
    }
    activeGroupIndex = settings.promptGroups.length - 1;
    renderPromptGroupList();
    loadGroupFields(activeGroupIndex);
    groupNameInput.focus();
    groupNameInput.select();
    persistSettings();
  }

  function captureCurrentConfigFields() {
    const entry = getCurrentEntry();
    if (!entry) return;
    entry.label = labelInput.value.trim() || "Custom";
    entry.baseUrl = baseUrlInput.value.trim();
    entry.apiKey = keyInput.value.trim();
    entry.model = getSelectedModel();
    
    const temperature = temperatureInput.value.trim();
    entry.temperature = temperature === "" ? undefined : Number(temperature);
    const maxTokens = maxTokensInput.value.trim();
    entry.maxTokens = maxTokens === "" ? undefined : Number(maxTokens);
    entry.thinking = thinkingCheckbox.checked;
    captureCurrentGroup();
  }

  function renderConfigFields(configId) {
    const entry = getProviderEntries(settings).find((e) => e.id === configId) || null;
    activeConfigId = entry?.id || null;
    if (!entry) {
      labelInput.value = "";
      keyInput.value = "";
      modelInput.value = "";
      baseUrlInput.value = "";
      temperatureInput.value = "";
      maxTokensInput.value = "";
      thinkingCheckbox.checked = true; 
      showKeyCheckbox.checked = false;
      keyInput.type = "password";
      renderConfigList();
      return;
    }
    const view = getProviderEntryView(entry);
    renderConfigList();

    labelInput.value = entry.label || "";
    keyInput.value = entry.apiKey || "";
    modelInput.value = view.model || "";
    baseUrlInput.value = view.baseUrl || "";
    temperatureInput.value = entry.temperature == null ? "" : String(entry.temperature);
    maxTokensInput.value = entry.maxTokens == null ? "" : String(entry.maxTokens);
    thinkingCheckbox.checked = entry.thinking !== false; 
  }

  loadAiSummarySettings().then((loaded) => {
    settings = loaded;
    settings.promptGroups = getPromptGroups(settings);
    activeGroupIndex = Math.max(0, settings.promptGroups.findIndex((g) => g.id === settings.defaultPromptGroupId));
    activeConfigId = getProviderEntries(settings)[0]?.id || null;
    renderPromptGroupList();
    loadGroupFields(activeGroupIndex);   
    renderConfigFields(activeConfigId);
    
    
    
    
    applyPromptStageHeight(promptTextarea);
  });

  labelInput.addEventListener("input", () => {
    const entry = getCurrentEntry();
    if (entry) {
      entry.label = labelInput.value.trim() || "Custom";
      renderConfigList();
    }
    schedulePersist();
  });
  labelInput.addEventListener("blur", () => { persistSettings(); });

  keyInput.addEventListener("input", schedulePersist);
  keyInput.addEventListener("blur", () => { persistSettings(); });
  baseUrlInput.addEventListener("input", schedulePersist);
  baseUrlInput.addEventListener("blur", () => { persistSettings(); });
  modelInput.addEventListener("input", schedulePersist);
  modelInput.addEventListener("blur", () => { persistSettings(); });

  temperatureInput.addEventListener("input", schedulePersist);
  temperatureInput.addEventListener("blur", () => { persistSettings(); });
  maxTokensInput.addEventListener("input", schedulePersist);
  maxTokensInput.addEventListener("blur", () => { persistSettings(); });
  thinkingCheckbox.addEventListener("change", () => { persistSettings(); });

  showKeyCheckbox.addEventListener("change", () => {
    keyInput.type = showKeyCheckbox.checked ? "text" : "password";
  });

  addCustomBtn.addEventListener("click", addCustomProvider);

  promptTextarea.addEventListener("input", () => {
    applyPromptStageHeight(promptTextarea);
    schedulePersist();
  });
  promptTextarea.addEventListener("blur", () => { persistSettings(); });

  groupNameInput.addEventListener("input", () => {
    const name = groupNameInput.value.trim() || "未命名";
    const rows = promptList.querySelectorAll(".ai-summary-config-row");
    const row = rows[activeGroupIndex];
    if (row) {
      const nameEl = row.querySelector(".ai-summary-config-row-name");
      if (nameEl) { nameEl.textContent = name; nameEl.title = name; }
    }
    schedulePersist();
  });
  groupNameInput.addEventListener("blur", () => { persistSettings(); });

  addPgBtn.addEventListener("click", addPromptGroup);

  
  pgSaveBtn.addEventListener("click", async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      await persistSettings();
      showFeedbackOn(pgFeedbackEl, msg("settings_aiSummarySaved", "设置已保存。"));
    } catch (_error) {
      
    }
  });

  testBtn.addEventListener("click", async () => {
    captureCurrentConfigFields();
    const entry = getCurrentEntry();
    if (!entry) return;
    if (!entry.apiKey) {
      showFeedback(msg("settings_aiSummaryNeedApiKey", "请先填写 API Key。"), true);
      return;
    }
    if (!entry.model) {
      showFeedback(msg("settings_aiSummaryNeedModel", "请先选择或填写模型名。"), true);
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = msg("settings_aiSummaryTesting", "测试中...");
    try {
      const { content } = await callAiSummary(
        { ...settings, activeProviderIds: [entry.id], prompt: "请只回复 OK。" },
        "连接测试，请只回复 OK。"
      );
      showFeedback(`${msg("settings_aiSummaryTestOk", "连接成功")}：${content.slice(0, 40)}`);
    } catch (err) {
      showFeedback(`${msg("settings_aiSummaryTestFail", "测试失败：")}${err.message}`, true);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = msg("settings_aiSummaryTestConn", "测试连接");
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      try {
        await persistSettings();
        showFeedback(msg("settings_aiSummarySaved", "设置已保存。"));
      } catch (_error) {
        
      }
    });
  }

  return card;
}
