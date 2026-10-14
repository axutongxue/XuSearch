import {
  DEFAULT_PROMPT_GROUP_ID,
  LEGACY_DEFAULT_GROUP_NAME,
  PROMPT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";
import {
  getPromptGroupDisplayName,
  getPromptGroupCount,
  getDisplayPromptEntries,
  getAllPromptGroupName,
  isAllPromptGroup,
} from "../../shared/prompt-groups.js";

const PLUS_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;


function buildGroupLabel(group, allGroups) {
  const name = document.createElement("span");
  name.className = "prompt-group-item-name";
  name.textContent = getPromptGroupDisplayName(group);

  const count = document.createElement("span");
  count.className = "prompt-group-item-count";
  count.textContent = String(getPromptGroupCount(group, allGroups));

  const frag = document.createDocumentFragment();
  frag.append(name, count);
  return frag;
}


function buildEmpty(text, onClosePanel) {
  const box = document.createElement("div");
  box.className = "prompt-empty";

  const label = document.createElement("span");
  label.textContent = text;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "prompt-empty-btn";
  btn.innerHTML = `${PLUS_SVG}去设置里新建`;
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" }).catch(() => {});
    onClosePanel();
  });

  box.append(label, btn);
  return box;
}


export function normalizePromptGroups(input) {
  if (!Array.isArray(input) || !input.length) return [];

  const source = input.filter(Boolean).map((group, gi) => ({
    id: String(group.id || `prompt-group-${gi}`),
    name: String(group.name || ""),
    prompts: Array.isArray(group.prompts)
      ? group.prompts.map((p, pi) => ({
          id: String(p.id || `prompt-${gi}-${pi}`),
          title: String(p.title || "\u672a\u547d\u540d\u63d0\u793a\u8bcd"),
          content: String(p.content || ""),
        }))
      : [],
  }));

  const defaultName = getAllPromptGroupName();
  let defaultIndex = source.findIndex((g) => g.id === DEFAULT_PROMPT_GROUP_ID);
  if (defaultIndex < 0) {
    defaultIndex = source.findIndex((g) => g.name === LEGACY_DEFAULT_GROUP_NAME);
    if (defaultIndex >= 0) {
      source[defaultIndex] = { ...source[defaultIndex], id: DEFAULT_PROMPT_GROUP_ID };
    }
  }
  if (defaultIndex < 0) {
    source.unshift({ id: DEFAULT_PROMPT_GROUP_ID, name: defaultName, prompts: [] });
  } else {
    const def = source.splice(defaultIndex, 1)[0];
    def.name = defaultName;
    source.unshift(def);
  }
  return source;
}

export function installPanelInteraction(panel, { isOpen, onApplyPrompt }) {
  if (!panel || panel.dataset.xuSearchBound) return;
  panel.dataset.xuSearchBound = "1";
  panel.addEventListener("pointerup", (e) => {
    if (!isOpen()) return;
    if (e.target.closest(".prompt-icon-btn")) return;
    if (!e.target.closest(".prompt-item-label")) return;
    const item = e.target.closest(".prompt-item");
    const prompt = item?._xuSearchPrompt;
    if (prompt) onApplyPrompt(prompt.content || "");
  });
}




export function renderLauncherPromptPanel({
  groupsCol,
  listCol,
  shadow,
  promptGroups,
  activeGroupId,
  setActiveGroupId,
  previewMgr,
  setPreviewMgr,
  onApplyPrompt,
  onClosePanel,
  onSaveEdit,
  rerender,
}) {
  if (!groupsCol || !listCol) return;

  groupsCol.innerHTML = "";
  listCol.innerHTML = "";

  if (!window.PromptItemUI) {
    const empty = document.createElement("section");
    empty.className = "prompt-empty";
    empty.textContent = "Prompt UI failed to load.";
    listCol.appendChild(empty);
    return;
  }

  if (!promptGroups.length) {
    listCol.appendChild(buildEmpty("还没有提示词分组，请先去设置里添加。", onClosePanel));
    return;
  }

  const activeGroup = promptGroups.find((g) => g.id === activeGroupId) || promptGroups[0];
  setActiveGroupId(activeGroup.id);

  promptGroups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    btn.append(buildGroupLabel(group, promptGroups));
    btn.addEventListener("mouseenter", () => {
      if (activeGroupId === group.id) return;
      setActiveGroupId(group.id);
      rerender();
    });
    btn.addEventListener("click", () => {
      setActiveGroupId(group.id);
      rerender();
    });
    groupsCol.appendChild(btn);
  });

  const entries = getDisplayPromptEntries(activeGroup, promptGroups);
  if (!entries.length) {
    listCol.appendChild(buildEmpty("这个分组里还没有提示词。", onClosePanel));
  } else {
    let mgr = previewMgr;
    if (!mgr) {
      mgr = window.PromptItemUI.createPreviewManager(shadow);
      setPreviewMgr(mgr);
    }
    entries.forEach(({ prompt, sourceGroup }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        itemClass: "prompt-item",
        labelClass: "prompt-item-label",
        iconsClass: "prompt-item-icons",
        iconBtnClass: "prompt-icon-btn",
        onFill: (p) => onApplyPrompt(p?.content || ""),
        onSaveEdit,
        previewManager: mgr,
        rich: true,
        groupLabel: isAllPromptGroup(activeGroup) ? getPromptGroupDisplayName(sourceGroup) : "",
      });
      item._xuSearchPrompt = prompt;
      listCol.appendChild(item);
    });
  }
}
