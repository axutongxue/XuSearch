import { DEFAULT_PROMPT_GROUP_ID } from "./storage-keys.js";

function i18n(key) {
  try {
    return chrome?.i18n?.getMessage?.(key) || window.__XUSEARCH_I18N__?.t?.(key) || "";
  } catch (_e) {
    return "";
  }
}

export function getAllPromptGroupName() {
  return i18n("settings_prompts_allGroup") || "全部";
}

export function isAllPromptGroup(group) {
  return !!group && group.id === DEFAULT_PROMPT_GROUP_ID;
}

export function getPromptGroupDisplayName(group) {
  if (isAllPromptGroup(group)) return getAllPromptGroupName();
  return group?.name || i18n("common_unnamedPromptGroup") || "未命名分组";
}


export function getPromptGroupCount(group, allGroups) {
  if (!group) return 0;
  if (isAllPromptGroup(group)) {
    return (allGroups || []).reduce((sum, g) => sum + ((g.prompts || []).length), 0);
  }
  return (group.prompts || []).length;
}




export function getDisplayPromptEntries(group, allGroups) {
  if (!group) return [];
  if (isAllPromptGroup(group)) {
    const out = [];
    (allGroups || []).forEach((g) => {
      (g.prompts || []).forEach((prompt) => out.push({ prompt, sourceGroup: g }));
    });
    return out;
  }
  return (group.prompts || []).map((prompt) => ({ prompt, sourceGroup: group }));
}
