import { msg, state } from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll } from "../store.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";

function isGlobalLauncherEnabled() {
  return state.uiPrefs?.showAiPagePromptLauncher !== false;
}


export function createAiPageLauncherInlineSwitch() {
  
  if (state.uiPrefs?.aiPagePromptLauncherSites && Object.keys(state.uiPrefs.aiPagePromptLauncherSites).length) {
    delete state.uiPrefs.aiPagePromptLauncherSites;
    void persistAll();
  }

  const wrap = document.createElement("div");
  wrap.className = "prompt-launcher-inline-switch";

  const globalOn = isGlobalLauncherEnabled();
  wrap.innerHTML = `
    <span class="prompt-launcher-inline-label">${escapeHtml(msg("settings_prompts_aiLauncherSwitchTitle", "输入框旁显示提示词按钮"))}</span>
    ${renderStretchSwitchMarkup(globalOn)}
  `;

  wrap.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs.showAiPagePromptLauncher = event.target.checked;
    await persistAll();
  });

  return wrap;
}
