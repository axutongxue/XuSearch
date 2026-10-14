import { state, msg, applyDomI18n, SECTION_META } from "../state.js";
import { persistAll } from "../store.js";
import { applyDarkModeToDoc } from "../../../shared/theme.js";
import { createBackupPanel } from "./config-io.js";

export function applyDarkMode(mode) {
  applyDarkModeToDoc(mode);
}


export function renderMiscSection() {
  const { miscSection } = state.dom;
  miscSection.innerHTML = "";

  miscSection.appendChild(createAppearanceGroup());
  miscSection.appendChild(createSearchboxGroup());
  miscSection.appendChild(createBackupGroup());
}



function createAppearanceGroup() {
  const group = document.createElement("section");
  group.className = "misc-group";
  group.innerHTML = `
    <div class="misc-group-head">
      <h2>${msg("settings_misc_groupAppearance", "外观")}</h2>
      <span class="misc-group-sub">${msg("settings_misc_groupAppearanceSub", "主题与语言，全局生效")}</span>
    </div>
  `;
  const themeRow = createThemeRow();
  const localeRow = createLocaleRow();
  group.appendChild(themeRow);
  group.appendChild(localeRow);
  return group;
}

function createThemeRow() {
  const current = state.uiPrefs?.darkMode === "dark" || state.uiPrefs?.darkMode === "light"
    ? state.uiPrefs.darkMode
    : "auto";

  const options = [
    { value: "auto", label: msg("settings_misc_themeAuto", "跟随浏览器"), swatch: "auto" },
    { value: "dark", label: msg("settings_misc_themeDark", "深色"), swatch: "dark" },
    { value: "light", label: msg("settings_misc_themeLight", "浅色"), swatch: "light" },
  ];

  const row = document.createElement("div");
  row.className = "misc-line";
  row.innerHTML = `
    <div class="misc-glyph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </div>
    <div class="misc-info">
      <div class="misc-line-title">${msg("settings_misc_darkModeTitle", "主题颜色")}</div>
      <div class="misc-line-desc">${msg("settings_misc_themeDesc", "可跟随浏览器配色，或固定为深色 / 浅色界面。")}</div>
    </div>
    <div class="misc-seg" role="radiogroup" aria-label="${msg("settings_misc_darkModeTitle", "主题颜色")}"></div>
  `;

  const seg = row.querySelector(".misc-seg");
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "misc-seg-btn" + (opt.value === current ? " is-active" : "");
    btn.dataset.value = opt.value;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(opt.value === current));
    btn.innerHTML = `<span class="misc-seg-swatch misc-seg-swatch--${opt.swatch}"></span>${opt.label}`;
    seg.appendChild(btn);
  });

  seg.addEventListener("click", async (event) => {
    const btn = event.target.closest(".misc-seg-btn");
    if (!btn) return;
    const v = btn.dataset.value;
    if (v === current) return;
    const next = v === "dark" || v === "light" ? v : "auto";
    state.uiPrefs.darkMode = next;
    await persistAll();
    applyDarkMode(next);
    renderMiscSection();
  });

  return row;
}

function createLocaleRow() {
  const current = state.uiPrefs?.localeMode === "zh" || state.uiPrefs?.localeMode === "en"
    ? state.uiPrefs.localeMode
    : "auto";

  const options = [
    { value: "auto", label: msg("settings_about_localeAuto", "跟随浏览器") },
    { value: "zh", label: "简体中文" },
    { value: "en", label: "English" },
  ];
  const currentLabel = options.find((o) => o.value === current)?.label ?? options[0].label;

  const row = document.createElement("div");
  row.className = "misc-line";
  row.innerHTML = `
    <div class="misc-glyph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>
    </div>
    <div class="misc-info">
      <div class="misc-line-title">${msg("settings_about_localeTitle", "界面语言")}</div>
      <div class="misc-line-desc">${msg("settings_about_localeDesc", "可跟随浏览器语言，或固定为中文 / 英文界面。")}</div>
    </div>
    <div class="misc-ctl">
      <div class="locale-dropdown" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <button type="button" class="locale-trigger">
          <span class="locale-trigger-label">${currentLabel}</span>
          <svg class="locale-trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="locale-menu" role="listbox"></div>
      </div>
    </div>
  `;

  const dropdown = row.querySelector(".locale-dropdown");
  const trigger = row.querySelector(".locale-trigger");
  const label = row.querySelector(".locale-trigger-label");
  const menu = row.querySelector(".locale-menu");

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "option";
    btn.className = "locale-option" + (opt.value === current ? " is-active" : "");
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    menu?.appendChild(btn);
  });

  function openMenu() {
    menu.classList.add("is-open");
    dropdown.setAttribute("aria-expanded", "true");
    trigger.classList.add("is-open");
  }
  function closeMenu() {
    menu.classList.remove("is-open");
    dropdown.setAttribute("aria-expanded", "false");
    trigger.classList.remove("is-open");
  }

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  });

  menu?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".locale-option");
    if (!btn) return;
    closeMenu();
    const v = btn.dataset.value;
    if (v === current) return;
    label.textContent = btn.textContent;
    state.uiPrefs.localeMode = v === "zh" || v === "en" ? v : "auto";
    await persistAll();
    window.__XUSEARCH_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
    applyDomI18n?.(document);
    const meta = SECTION_META[state.activeSection];
    if (meta) {
      const title = meta.titleKey ? msg(meta.titleKey, meta.title) : (meta.title || "");
      const subtitle = meta.subtitleKey ? msg(meta.subtitleKey, meta.subtitle) : (meta.subtitle || "");
      if (state.dom.sectionEyebrow) state.dom.sectionEyebrow.hidden = true;
      if (state.dom.sectionTitle) { state.dom.sectionTitle.textContent = title; state.dom.sectionTitle.hidden = !title; }
      if (state.dom.sectionSubtitle) { state.dom.sectionSubtitle.textContent = subtitle; state.dom.sectionSubtitle.hidden = !subtitle; }
      if (state.dom.sectionContentHeader) {
        state.dom.sectionContentHeader.hidden =
          !title && !subtitle && state.activeSection !== "about" && state.activeSection !== "prompts";
      }
    }
    state.renderCurrentSection();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeMenu();
  }, { capture: false });

  return row;
}



function createSearchboxGroup() {
  const group = document.createElement("section");
  group.className = "misc-group";
  group.innerHTML = `
    <div class="misc-group-head">
      <h2>${msg("settings_misc_groupSearchbox", "搜索框")}</h2>
      <span class="misc-group-sub">${msg("settings_other_homeDisplayDesc", "Ctrl+Q 快捷键与点击顶部插件图标均可触发的搜索框。")}</span>
    </div>
  `;

  const rows = [
    {
      key: "showHistory",
      title: msg("settings_other_showHistoryTitle", "显示搜索历史"),
      desc: msg("settings_misc_showHistoryDesc", "在搜索框下方展示最近 4 条搜索记录，点击可回填。"),
      glyph: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h13M12 5l7 7-7 7"/></svg>`,
      defaultValue: true,
    },
    {
      key: "showPromptButton",
      title: msg("settings_other_showPromptTitle", "显示提示词按钮"),
      desc: msg("settings_misc_showPromptDesc", "搜索框内展示提示词库入口，可快速插入提示词。"),
      glyph: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/></svg>`,
      defaultValue: true,
    },
  ];

  rows.forEach((item) => {
    const isOn = Object.prototype.hasOwnProperty.call(state.uiPrefs || {}, item.key)
      ? state.uiPrefs[item.key] !== false
      : item.defaultValue !== false;

    const row = document.createElement("div");
    row.className = "misc-line";
    row.innerHTML = `
      <div class="misc-glyph">${item.glyph}</div>
      <div class="misc-info">
        <div class="misc-line-title">${item.title}</div>
        <div class="misc-line-desc">${item.desc}</div>
      </div>
      <div class="misc-ctl">
        <label class="misc-switch"><input type="checkbox" ${isOn ? "checked" : ""}><span class="misc-switch-track"></span></label>
      </div>
    `;
    row.querySelector("input")?.addEventListener("change", async (event) => {
      state.uiPrefs[item.key] = event.target.checked;
      await persistAll();
    });
    group.appendChild(row);
  });

  return group;
}



function createBackupGroup() {
  const group = document.createElement("section");
  group.className = "misc-group";
  group.innerHTML = `
    <div class="misc-group-head">
      <h2>${msg("settings_misc_groupBackup", "配置备份")}</h2>
      <span class="misc-group-sub">${msg("settings_misc_groupBackupSub", "JSON 格式 · 覆盖式导入")}</span>
    </div>
  `;
  group.appendChild(createBackupPanel());
  return group;
}
