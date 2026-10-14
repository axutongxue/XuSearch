import {
  SEARCH_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";


import { PROMPT_ICON_SVG } from "./input-prompt-launcher-constants.js";

let host = null;
let shadow = null;
let toolbar = null;
let isVisible = false;
let cachedUiPrefs = {};
let cachedGroups = [];
let cachedCtxGroups = [];
let cacheInitPromise = null;
let storageWatcherInstalled = false;


const CSS = `
  .toolbar {
    position: fixed;
    z-index: 2147483647;
    display: none;
    flex-direction: row;
    align-items: stretch;
    padding: 3px 4px;
    background: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.12);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 1;
    user-select: none;
    pointer-events: auto;
    max-width: 520px;
    color: #111;
  }
  .toolbar.visible { display: flex; }
  .q-col {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 2px 6px 2px 2px;
    color: #bbb;
  }
  .q-col svg { width: 14px; height: 14px; }
  .rows-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }
  .h-divider {
    height: 1px;
    background: #e2e2e2;
    margin: 1px 0;
  }
  .btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    color: #333;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
  }
  .btn:hover { background: #f0f0f0; color: #111; }
  @media (prefers-color-scheme: dark) {
    .toolbar {
      background: #1e1e1e;
      border-color: #3a3a3a;
      color: #eee;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    }
    .q-col { color: #555; }
    .h-divider { background: #3a3a3a; }
    .btn { color: #ccc; }
    .btn:hover { background: #2e2e2e; color: #fff; }
  }
`;

export function initSelectionToolbar() {
  
  if (location.protocol === "chrome-extension:") return;

  
  
  if (window !== window.top) {
    try {
      
      void window.top.location.href;
    } catch (_) {
      return;
    }
  }

  primeToolbarCache().catch(() => {});
  installStorageWatcher();

  
  
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("mousedown", onMouseDown);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("keydown", onKeyDown);

  
  
  document.addEventListener("selectionchange", onSelectionChange);
}

async function onMouseUp(e) {
  
  if (host && e.composedPath().includes(host)) return;

  
  await new Promise((r) => setTimeout(r, 20));

  const selection = window.getSelection();
  const text = (selection?.toString() || "").trim();
  if (!text || !selection.rangeCount) return;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  await primeToolbarCache();
  if (cachedUiPrefs.selectionSearchEnabled !== true) return;

  const showGroups = cachedUiPrefs.bubbleShowGroups !== false;
  const showCtx = cachedUiPrefs.bubbleShowCtx === true;

  const itemGroups = [];
  if (showGroups && cachedGroups.length) {
    itemGroups.push({ items: cachedGroups.slice(0, 5), type: "group" });
  }
  if (showCtx && cachedCtxGroups.length) {
    itemGroups.push({ items: cachedCtxGroups.slice(0, 5), type: "ctx" });
  }
  if (!itemGroups.length) return;

  renderToolbar(text, itemGroups, rect);
}

function onMouseDown(e) {
  if (!isVisible) return;
  if (host && e.composedPath().includes(host)) return;
  hideToolbar();
}

function onScroll() {
  if (isVisible) hideToolbar();
}

function onKeyDown(e) {
  if (isVisible && e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt") {
    hideToolbar();
  }
}

function onSelectionChange() {
  if (!isVisible) return;
  const sel = window.getSelection();
  if (!sel || !sel.toString().trim()) hideToolbar();
}

function ensureHost() {
  if (host) return;
  const body = document.body || document.documentElement;
  if (!body) return;
  host = document.createElement("div");
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);
  toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  shadow.appendChild(toolbar);
  body.appendChild(host);
}

function renderToolbar(query, itemGroups, selectionRect) {
  ensureHost();
  toolbar.innerHTML = "";

  
  const qCol = document.createElement("div");
  qCol.className = "q-col";
  qCol.innerHTML = PROMPT_ICON_SVG;
  toolbar.appendChild(qCol);

  
  const rowsCol = document.createElement("div");
  rowsCol.className = "rows-col";

  itemGroups.forEach((group, gIdx) => {
    if (gIdx > 0) {
      const hd = document.createElement("div");
      hd.className = "h-divider";
      rowsCol.appendChild(hd);
    }

    const row = document.createElement("div");
    row.className = "toolbar-row";

    group.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = item.name;
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("click", () => {
        hideToolbar();
        if (group.type === "ctx") {
          chrome.runtime.sendMessage({ type: "RUN_CTX_GROUP", ctxGroup: item, query }).catch(() => {});
        } else {
          chrome.runtime.sendMessage({ type: "RUN_SEARCH_GROUP", group: item, query }).catch(() => {});
        }
      });
      row.appendChild(btn);
    });

    rowsCol.appendChild(row);
  });

  toolbar.appendChild(rowsCol);

  toolbar.classList.add("visible");
  isVisible = true;

  
  requestAnimationFrame(() => {
    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    let left = selectionRect.left + selectionRect.width / 2 - tw / 2;
    let top = selectionRect.bottom + 8;

    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    if (top + th > window.innerHeight - 8) {
      top = selectionRect.top - th - 8;
    }

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  });
}

function hideToolbar() {
  if (!toolbar) return;
  toolbar.classList.remove("visible");
  isVisible = false;
}


function installStorageWatcher() {
  if (storageWatcherInstalled) {
    return;
  }
  storageWatcherInstalled = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[UI_PREFS_STORAGE_KEY]) {
      cachedUiPrefs = changes[UI_PREFS_STORAGE_KEY].newValue || {};
    }
    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      cachedGroups = normalizeGroups(changes[SEARCH_GROUPS_STORAGE_KEY].newValue);
    }
    if (changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]) {
      cachedCtxGroups = normalizeCtxGroups(changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY].newValue);
    }
  });
}

async function primeToolbarCache() {
  if (cacheInitPromise) {
    return cacheInitPromise;
  }

  cacheInitPromise = chrome.storage.local
    .get([UI_PREFS_STORAGE_KEY, SEARCH_GROUPS_STORAGE_KEY, SELECTION_CONTEXT_GROUPS_STORAGE_KEY])
    .then((stored) => {
      cachedUiPrefs = stored[UI_PREFS_STORAGE_KEY] || {};
      cachedGroups = normalizeGroups(stored[SEARCH_GROUPS_STORAGE_KEY]);
      cachedCtxGroups = normalizeCtxGroups(stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]);
    })
    .catch(() => {
      cachedUiPrefs = {};
      cachedGroups = [];
      cachedCtxGroups = [];
    });

  return cacheInitPromise;
}

function normalizeGroups(input) {
  return Array.isArray(input)
    ? input.filter((group) => group && group.enabled !== false)
    : [];
}

function normalizeCtxGroups(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((g) => {
    if (!g || g.enabled === false) return false;
    if (g.targetType === "group") return !!g.refGroupId;
    return Array.isArray(g.siteIds) && g.siteIds.length > 0;
  });
}
