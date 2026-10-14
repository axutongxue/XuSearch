import {
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CARD_SIZE_LEVEL_KEY,
  LAYOUT_ROWS_KEY,
  LAYOUT_MODE_KEY,
  REMOVED_GROUPS_STORAGE_KEY,
} from "../../../shared/storage-keys.js";
import { applyDarkModeToDoc } from "../../../shared/theme.js";
import {
  loadAiSummarySettings,
  saveAiSummarySettings,
} from "../../../shared/ai-summary-api.js";
import { state, msg } from "../state.js";
import {
  persistAll,
  createNormalizedGroups,
  createNormalizedCustomSites,
  createNormalizedSelectionContextGroups,
  createNormalizedPromptGroups,
  createNormalizedUiPrefs,
  mergeSites,
} from "../store.js";

const CONFIG_VERSION = 2;

const EXPORT_SECTION_DEFS = [
  {
    key: "searchGroups",
    label: msg("settings_configIo_sectionSearchGroups", "搜索组"),
    count: () => (state.groups?.length ? `${state.groups.length} ${msg("settings_misc_cntGroups", "组")}` : ""),
  },
  {
    key: "customSites",
    label: msg("settings_configIo_sectionCustomSites", "自定义搜索"),
    count: () => (state.customSites?.length ? `${state.customSites.length} ${msg("settings_misc_cntSites", "站")}` : ""),
  },
  {
    key: "selectionContextGroups",
    label: msg("settings_configIo_sectionCtxGroups", "右键提示词"),
    count: () => (state.selectionContextGroups?.length ? `${state.selectionContextGroups.length} ${msg("settings_misc_cntGroups", "组")}` : ""),
  },
  {
    key: "promptGroups",
    label: msg("settings_configIo_sectionPromptGroups", "提示词管理"),
    count: () => (state.promptGroups?.length ? `${state.promptGroups.length} ${msg("settings_misc_cntGroups", "组")}` : ""),
  },
  {
    key: "aiSummarySettings",
    label: msg("settings_configIo_sectionAiSummary", "AI 总结设置"),
    count: () => msg("settings_misc_hasKey", "含密钥"),
  },
  {
    key: "uiPrefs",
    label: msg("settings_configIo_sectionUiPrefs", "显示设置"),
    count: () => "",
  },
  {
    key: "layoutPrefs",
    label: msg("settings_configIo_sectionLayout", "对比页布局"),
    count: () => "",
  },
];

const SECTION_LABELS = Object.fromEntries(
  EXPORT_SECTION_DEFS.map((item) => [item.key, item.label])
);


export function createBackupPanel() {
  const panel = document.createElement("div");
  panel.className = "misc-backup-panel";
  
  panel.innerHTML = `
    <div class="misc-bp-steps">
      <div class="misc-bp-col">
        <h4><span class="misc-bp-step-tag">STEP 1</span>${msg("settings_misc_step1", "选择要备份的模块")}</h4>
        <div class="misc-bp-desc">${msg("settings_misc_step1Desc", "可全选，也可只备份部分模块")}</div>
        <div class="misc-bp-mods"></div>
      </div>
      <div class="misc-bp-arrow">➜</div>
      <div class="misc-bp-col">
        <h4><span class="misc-bp-step-tag">STEP 2</span>${msg("settings_misc_step2", "导出文件 / 导入恢复")}</h4>
        <div class="misc-bp-desc">${msg("settings_misc_step2Desc", "导出为 XuSearch配置-日期.json；导入时自动识别文件内包含的模块")}</div>
        <div class="misc-bp-actions">
          <button type="button" class="misc-bp-btn is-primary misc-bp-export-btn"></button>
          <button type="button" class="misc-bp-btn is-ghost misc-bp-import-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="17"/></svg>
            ${msg("settings_other_importConfig", "导入配置")}
          </button>
        </div>
        <div class="misc-bp-warning"><span class="misc-bp-warning-icon">⚠</span>${msg("settings_misc_ioWarning", "导入覆盖对应模块且不可撤销；AI 总结设置含 API Key，勿外传文件。")}</div>
      </div>
    </div>
  `;

  const modsWrap = panel.querySelector(".misc-bp-mods");
  const exportBtn = panel.querySelector(".misc-bp-export-btn");

  
  const checkboxes = new Map();
  EXPORT_SECTION_DEFS.forEach((item) => {
    const label = document.createElement("label");
    label.className = "misc-bp-mod";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.dataset.sectionKey = item.key;
    input.addEventListener("change", updateExportButton);
    const box = document.createElement("span");
    box.className = "misc-bp-mod-box";
    const text = document.createElement("span");
    text.textContent = item.label;
    const cnt = document.createElement("span");
    cnt.className = "misc-bp-mod-cnt";
    cnt.textContent = typeof item.count === "function" ? item.count() : "";
    label.appendChild(input);
    label.appendChild(box);
    label.appendChild(text);
    if (cnt.textContent) label.appendChild(cnt);
    modsWrap?.appendChild(label);
    checkboxes.set(item.key, input);
  });

  
  loadAiSummarySettings().then((settings) => {
    const hasKey = Array.isArray(settings?.providers) && settings.providers.some((p) => String(p?.apiKey || "").trim());
    const cnt = modsWrap?.querySelector(`input[data-section-key="aiSummarySettings"]`)?.closest(".misc-bp-mod")?.querySelector(".misc-bp-mod-cnt");
    if (cnt) cnt.textContent = hasKey ? cnt.textContent : "";
  }).catch(() => {});

  function selectedKeys() {
    return EXPORT_SECTION_DEFS.map((item) => item.key).filter((key) => checkboxes.get(key)?.checked);
  }

  function updateExportButton() {
    const count = selectedKeys().length;
    exportBtn.disabled = count === 0;
    exportBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      ${msg("settings_configIo_exportConfirm", "导出 JSON")}${count > 0 ? ` (${count})` : ""}
    `;
  }
  updateExportButton();

  exportBtn.addEventListener("click", async () => {
    const keys = selectedKeys();
    if (!keys.length) return;
    await doExport(keys);
  });

  panel.querySelector(".misc-bp-import-btn")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", handleConfigImportFile);
    input.click();
  });

  return panel;
}

async function collectSectionData(key) {
  if (key === "searchGroups") return state.groups;
  if (key === "customSites") return state.customSites;
  if (key === "selectionContextGroups") return state.selectionContextGroups;
  if (key === "promptGroups") return state.promptGroups;
  if (key === "uiPrefs") return state.uiPrefs;
  if (key === "layoutPrefs") return readLayoutPrefs();
  if (key === "aiSummarySettings") return loadAiSummarySettings();
  return null;
}


async function readLayoutPrefs() {
  const stored = await chrome.storage.local.get([
    CARD_SIZE_LEVEL_KEY,
    LAYOUT_ROWS_KEY,
    LAYOUT_MODE_KEY,
  ]);
  const out = {};
  if (stored[CARD_SIZE_LEVEL_KEY] !== undefined) out.cardSizeLevel = stored[CARD_SIZE_LEVEL_KEY];
  if (stored[LAYOUT_ROWS_KEY] !== undefined) out.layoutRows = stored[LAYOUT_ROWS_KEY];
  if (stored[LAYOUT_MODE_KEY] !== undefined) out.layoutMode = stored[LAYOUT_MODE_KEY];
  return out;
}

async function doExport(selectedKeys) {
  const payload = {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    exportSections: selectedKeys,
  };

  for (const key of selectedKeys) {
    payload[key] = await collectSectionData(key);
  }
  
  
  if (selectedKeys.includes("searchGroups")) {
    const stored = await chrome.storage.local.get([REMOVED_GROUPS_STORAGE_KEY]);
    payload.removedGroupIds = Array.isArray(stored[REMOVED_GROUPS_STORAGE_KEY])
      ? stored[REMOVED_GROUPS_STORAGE_KEY]
      : [];
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `XuSearch配置-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getImportableSections(payload) {
  if (!payload || typeof payload !== "object") return [];
  return EXPORT_SECTION_DEFS
    .map((item) => item.key)
    .filter((key) => {
      const value = payload[key];
      if (key === "aiSummarySettings") return value && typeof value === "object";
      if (key === "uiPrefs" || key === "layoutPrefs") {
        return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
      }
      return Array.isArray(value) && value.length > 0;
    });
}

function describeImportSections(sectionKeys) {
  return sectionKeys.map((key) => SECTION_LABELS[key] || key).join("、");
}

async function handleConfigImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    alert(msg("settings_other_importParseError", "无法解析文件，请确认是否为从本插件导出的 JSON 配置文件。"));
    return;
  }

  if (!payload || typeof payload !== "object") {
    alert(msg("settings_other_importInvalidFormat", "文件格式不正确，请使用本插件导出的配置文件。"));
    return;
  }

  const version = payload.version;
  if (version !== 1 && version !== CONFIG_VERSION) {
    alert(msg("settings_other_importInvalidFormat", "文件格式不正确，请使用本插件导出的配置文件。"));
    return;
  }

  const sectionKeys = getImportableSections(payload);
  if (!sectionKeys.length) {
    alert(msg("settings_configIo_importEmpty", "文件中没有可导入的配置内容。"));
    return;
  }

  const desc = describeImportSections(sectionKeys);
  const confirmed = confirm([
    msg("settings_other_importConfirmLine1Prefix", "即将导入 ") + desc + msg("settings_other_importConfirmLine1Suffix", "。"),
    "",
    msg("settings_configIo_importConfirmReplace", "导入后将覆盖对应模块的当前配置，此操作不可撤销。"),
    "",
    msg("settings_other_importConfirmLine3", "确认继续？"),
  ].join("\n"));
  if (!confirmed) return;

  
  
  const layoutSnapshot = sectionKeys.includes("layoutPrefs")
    ? await readLayoutPrefs()
    : null;
  const tombstoneSnapshot = sectionKeys.includes("searchGroups")
    ? await (async () => {
        const stored = await chrome.storage.local.get([REMOVED_GROUPS_STORAGE_KEY]);
        return Array.isArray(stored[REMOVED_GROUPS_STORAGE_KEY])
          ? stored[REMOVED_GROUPS_STORAGE_KEY]
          : [];
      })()
    : null;
  const snapshot = {
    customSites: state.customSites,
    sites: state.sites,
    groups: state.groups,
    selectionContextGroups: state.selectionContextGroups,
    promptGroups: state.promptGroups,
    uiPrefs: state.uiPrefs,
    layoutPrefs: layoutSnapshot,
    removedGroupIds: tombstoneSnapshot,
    aiSummarySettings: sectionKeys.includes("aiSummarySettings")
      ? await loadAiSummarySettings()
      : null,
  };

  try {
    if (sectionKeys.includes("customSites")) {
      state.customSites = createNormalizedCustomSites(payload.customSites);
      const builtinSites = state.sites.filter((site) => !site.isCustom);
      state.sites = mergeSites(builtinSites, state.customSites);
    }

    if (sectionKeys.includes("searchGroups")) {
      state.groups = createNormalizedGroups(payload.searchGroups);
      
      
      const importedRemoved = Array.isArray(payload.removedGroupIds)
        ? payload.removedGroupIds.filter((id) => typeof id === "string" && id)
        : [];
      if (importedRemoved.length) {
        const stored = await chrome.storage.local.get([REMOVED_GROUPS_STORAGE_KEY]);
        const current = Array.isArray(stored[REMOVED_GROUPS_STORAGE_KEY])
          ? stored[REMOVED_GROUPS_STORAGE_KEY]
          : [];
        await chrome.storage.local.set({
          [REMOVED_GROUPS_STORAGE_KEY]: [...new Set([...current, ...importedRemoved])],
        });
      }
    }

    if (sectionKeys.includes("selectionContextGroups")) {
      state.selectionContextGroups = createNormalizedSelectionContextGroups(payload.selectionContextGroups);
    }

    if (sectionKeys.includes("promptGroups")) {
      state.promptGroups = createNormalizedPromptGroups(payload.promptGroups);
    }

    if (sectionKeys.includes("uiPrefs")) {
      state.uiPrefs = createNormalizedUiPrefs(payload.uiPrefs);
      
      applyDarkModeToDoc(state.uiPrefs.darkMode);
      window.__XUSEARCH_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
    }

    if (sectionKeys.includes("layoutPrefs")) {
      const layout = payload.layoutPrefs || {};
      const patch = {};
      if (layout.cardSizeLevel !== undefined) patch[CARD_SIZE_LEVEL_KEY] = layout.cardSizeLevel;
      if (layout.layoutRows !== undefined) patch[LAYOUT_ROWS_KEY] = layout.layoutRows;
      if (layout.layoutMode !== undefined) patch[LAYOUT_MODE_KEY] = layout.layoutMode;
      if (Object.keys(patch).length) await chrome.storage.local.set(patch);
    }

    if (sectionKeys.includes("aiSummarySettings")) {
      await saveAiSummarySettings(payload.aiSummarySettings);
    }

    await persistAll();
  } catch (err) {
    state.customSites = snapshot.customSites;
    state.sites = snapshot.sites;
    state.groups = snapshot.groups;
    state.selectionContextGroups = snapshot.selectionContextGroups;
    state.promptGroups = snapshot.promptGroups;
    state.uiPrefs = snapshot.uiPrefs;
    if (snapshot.aiSummarySettings) {
      try {
        await saveAiSummarySettings(snapshot.aiSummarySettings);
      } catch (_e) {
        
      }
    }
    if (sectionKeys.includes("layoutPrefs") && snapshot.layoutPrefs) {
      await chrome.storage.local.set(snapshot.layoutPrefs);
    }
    if (sectionKeys.includes("searchGroups") && snapshot.removedGroupIds) {
      await chrome.storage.local.set({ [REMOVED_GROUPS_STORAGE_KEY]: snapshot.removedGroupIds });
    }
    alert(msg("settings_configIo_importFailed", "导入失败，配置未生效：") + (err?.message || err));
    refreshAfterConfigImport(sectionKeys);
    return;
  }
  refreshAfterConfigImport(sectionKeys);
}

function refreshAfterConfigImport(sectionKeys) {
  if (state.activeSection === "misc" || sectionKeys.includes("uiPrefs") || sectionKeys.includes("layoutPrefs")) {
    state.renderMiscSection?.();
  }
  if (state.activeSection === "groups" || sectionKeys.includes("searchGroups")) {
    state.renderGroupsSection?.();
  }
  if (state.activeSection === "custom" || sectionKeys.includes("customSites")) {
    state.renderCustomSection?.();
  }
  if (state.activeSection === "other" || sectionKeys.includes("selectionContextGroups")) {
    state.renderOtherSection?.();
  }
  if (state.activeSection === "prompts" || sectionKeys.includes("promptGroups")) {
    state.renderPromptsSection?.();
  }
  if (state.activeSection === "aiSummary" || sectionKeys.includes("aiSummarySettings")) {
    state.renderAiSummarySection?.();
  }
}
