import { state, elements, STORAGE_KEYS } from "./state.js";
import { createRequestId, setQueryInputValue } from "./utils.js";
import { withStorageLock } from "../../shared/storage-lock.js";
import {
  attachHistoryFilterRefresh,
  bindHistoryFilterEvents,
  getFilteredHistory,
  getHistoryEmptyMessage,
  updateHistoryFilterUi,
} from "./history-filter.js";
import {
  normalizeHistorySiteUrl,
  shouldKeepStoredHistoryUrl,
} from "./history-url-normalize.js";

export { bindHistoryFilterEvents } from "./history-filter.js";

attachHistoryFilterRefresh(() => renderHistoryList());

export async function savePreferences() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.searchHistory]: state.searchHistory
  });
}

async function mutateStoredHistory(mutator) {
  return withStorageLock("history", async () => {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.searchHistory]);
    const latestHistory = Array.isArray(stored[STORAGE_KEYS.searchHistory])
      ? stored[STORAGE_KEYS.searchHistory]
      : [];
    const nextHistory = mutator(latestHistory);
    const resolvedHistory = Array.isArray(nextHistory) ? nextHistory.slice(0, 50) : latestHistory.slice(0, 50);
    const changed = nextHistory !== latestHistory;
    state.searchHistory = resolvedHistory;
    if (changed) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.searchHistory]: resolvedHistory
      });
    }
    return { changed, history: resolvedHistory };
  });
}

export async function saveSearchHistory(query, sites) {
  const entry = {
    id: createRequestId(),
    query,
    sites: sites.map((site) => {
      const ref = state.cardRefs.get(site.id);
      return {
        id: site.id,
        name: site.name,
        url: normalizeHistorySiteUrl(site.id, ref?.currentUrl || site.url) || site.url
      };
    }),
    createdAt: new Date().toISOString()
  };

  state.currentHistoryEntryId = entry.id;
  sites.forEach((site) => {
    if (site?.id) {
      state.historyEntryIdBySiteId.set(site.id, entry.id);
    }
  });

  await mutateStoredHistory((latestHistory) => {
    return [entry, ...latestHistory.filter((item) => item?.id !== entry.id)];
  });
  renderHistoryList();
  return entry.id;
}

export async function refreshHistoryEntryUrls(entryId, sites) {
  if (!entryId || !Array.isArray(sites) || sites.length === 0) {
    return;
  }

  const latestUrlsBySiteId = new Map();
  sites.forEach((site) => {
    if (!site?.id) {
      return;
    }
    const ref = state.cardRefs.get(site.id);
    latestUrlsBySiteId.set(
      site.id,
      normalizeHistorySiteUrl(site.id, String(ref?.currentUrl || site.url || ""))
    );
  });

  const { changed } = await mutateStoredHistory((latestHistory) => {
    let hasChanged = false;
    const nextHistory = latestHistory.map((entry) => {
      if (entry.id !== entryId || !Array.isArray(entry.sites)) {
        return entry;
      }

      const updatedSites = entry.sites.map((site) => {
        const nextUrl = latestUrlsBySiteId.get(site?.id);
        if (!nextUrl) {
          return site;
        }
        const homeUrl = state.allSites?.find((s) => s.id === site?.id)?.url || "";
        if (site.url === nextUrl || shouldKeepStoredHistoryUrl(site.url, nextUrl, homeUrl, site?.id)) {
          return site;
        }
        hasChanged = true;
        return {
          ...site,
          url: normalizeHistorySiteUrl(site?.id, nextUrl) || nextUrl
        };
      });

      return hasChanged ? { ...entry, sites: updatedSites } : entry;
    });
    return hasChanged ? nextHistory : latestHistory;
  });

  if (!changed) {
    return;
  }
  renderHistoryList();
}

export function scheduleHistoryUrlRefresh(entryId, sites) {
  if (!entryId || !Array.isArray(sites) || sites.length === 0) {
    return;
  }
  
  [3000, 8000, 15000, 30000, 45000, 60000].forEach((delayMs) => {
    window.setTimeout(() => {
      if (state.currentHistoryEntryId !== entryId) {
        return;
      }
      refreshHistoryEntryUrls(entryId, sites).catch(() => {});
    }, delayMs);
  });
}


const HISTORY_EMPTY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

export function renderHistoryList() {
  if (!elements.historyList) {
    return;
  }

  updateHistoryFilterUi();
  elements.historyList.innerHTML = "";
  const filteredHistory = getFilteredHistory();
  if (filteredHistory.length === 0) {
    
    
    const empty = document.createElement("div");
    empty.className = "history-empty";
    const emptyIcon = document.createElement("div");
    emptyIcon.className = "history-empty-icon";
    emptyIcon.innerHTML = HISTORY_EMPTY_ICON;
    const emptyText = document.createElement("div");
    emptyText.className = "history-empty-text";
    emptyText.textContent = getHistoryEmptyMessage();
    empty.append(emptyIcon, emptyText);
    elements.historyList.appendChild(empty);
    return;
  }

  filteredHistory.forEach((entry) => {
    const normalizedSites = normalizeHistorySites(entry.sites);

    const item = document.createElement("div");
    item.className = "history-item";

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const meta = document.createElement("div");
    meta.className = "history-item-meta";
    meta.textContent = formatHistoryTime(entry.createdAt);
    actions.appendChild(meta);

    const actionButtons = document.createElement("div");
    actionButtons.className = "history-action-buttons";

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "history-restore-btn";
    restoreBtn.textContent = "复原";
    restoreBtn.setAttribute("aria-label", "新开页面复原这次搜索会话");
    restoreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openHistoryEntryRestorePage(entry.id);
    });
    actionButtons.appendChild(restoreBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-item-delete-btn";
    deleteBtn.textContent = "删除";
    deleteBtn.setAttribute("aria-label", "删除记录");
    deleteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      
      const raw = String(entry.query || "");
      const preview = raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
      if (!window.confirm(`确定要删除这条搜索记录吗？\n\n${preview}`)) return;
      await deleteHistoryEntry(entry.id);
    });
    actionButtons.appendChild(deleteBtn);
    actions.appendChild(actionButtons);

    const title = document.createElement("div");
    title.className = "history-item-title";
    title.textContent = entry.query;

    const links = document.createElement("div");
    links.className = "history-site-links";

    normalizedSites.forEach((site) => {
      const link = document.createElement(site.url ? "a" : "button");
      link.className = "history-site-link";
      link.textContent = site.name;

      if (site.url) {
        link.href = site.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.type = "button";
        link.disabled = true;
      }

      link.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      links.appendChild(link);
    });

    item.appendChild(actions);
    item.appendChild(title);
    item.appendChild(links);
    item.addEventListener("click", () => {
      setQueryInputValue(entry.query, { focus: true });
      closeHistoryPanel();
    });
    elements.historyList.appendChild(item);
  });
}

function openHistoryEntryRestorePage(entryId) {
  if (!entryId) {
    return;
  }

  const url = new URL(chrome.runtime.getURL("iframe/iframe.html"));
  url.searchParams.set("restoreHistoryId", entryId);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
  closeHistoryPanel();
}

export function applyHistoryRestoreFromUrl() {
  const entryId = state.restoreHistoryEntryId;
  if (!entryId) {
    return null;
  }

  const entry = state.searchHistory.find((item) => item?.id === entryId);
  if (!entry) {
    clearRestoreHistoryParamFromUrl();
    return null;
  }

  const normalizedSites = normalizeHistorySites(entry.sites);
  const siteById = new Map((state.allSites || []).map((site) => [site.id, site]));
  const restoredSites = normalizedSites
    .map((historySite) => buildRestoredSite(historySite, siteById))
    .filter(Boolean);

  if (restoredSites.length === 0) {
    setQueryInputValue("", { focus: false });
    clearRestoreHistoryParamFromUrl();
    return entry;
  }

  state.sites = restoredSites;
  state.hiddenSiteIds.clear();
  state.maximizedSiteId = null;
  state.activeSidebarSiteId = restoredSites[0]?.id || null;
  state.currentHistoryEntryId = entry.id || null;
  state.historyEntryIdBySiteId.clear();
  restoredSites.forEach((site) => {
    if (site?.id && entry?.id) {
      state.historyEntryIdBySiteId.set(site.id, entry.id);
    }
  });

  
  
  
  if (entry.query) {
    state.lastSearchQuery = entry.query;
    state.lastSearchTime = entry.createdAt
      ? new Date(entry.createdAt).toLocaleString()
      : new Date().toLocaleString();
  }

  setQueryInputValue("", { focus: false });
  clearRestoreHistoryParamFromUrl();
  return entry;
}

function buildRestoredSite(historySite, siteById) {
  const id = String(historySite?.id || "").trim();
  const name = String(historySite?.name || "").trim() || "未命名站点";
  const url = normalizeRestoredUrl(historySite?.url, id);
  const baseSite = siteById.get(id);

  if (baseSite) {
    return {
      ...baseSite,
      restoreUrl: url || baseSite.url
    };
  }

  if (!id || !url) {
    return null;
  }

  return {
    id,
    name,
    url,
    restoreUrl: url,
    enabled: true,
    supportIframe: true,
    supportUrlQuery: false,
    matchPatterns: [],
    isCustom: true
  };
}

function normalizeRestoredUrl(value, siteId = "") {
  return normalizeHistorySiteUrl(siteId, value);
}

function normalizeHistorySites(sites) {
  return Array.isArray(sites)
    ? sites.map((site, index) => {
        if (typeof site === "string") {
          return {
            id: `legacy-${index}`,
            name: site,
            url: ""
          };
        }

        return {
          id: String(site.id || `site-${index}`),
          name: String(site.name || "未命名站点"),
          url: String(site.url || "")
        };
      })
    : [];
}

function clearRestoreHistoryParamFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("restoreHistoryId")) {
      url.searchParams.delete("restoreHistoryId");
      history.replaceState({}, "", url.toString());
    }
  } catch (_error) {
    
  }
}

export async function deleteHistoryEntry(id) {
  const { changed } = await mutateStoredHistory((latestHistory) => {
    const nextHistory = latestHistory.filter((entry) => entry.id !== id);
    return nextHistory.length === latestHistory.length ? latestHistory : nextHistory;
  });
  if (!changed) {
    return;
  }
  for (const [siteId, entryId] of state.historyEntryIdBySiteId.entries()) {
    if (entryId === id) {
      state.historyEntryIdBySiteId.delete(siteId);
    }
  }
  if (state.currentHistoryEntryId === id) {
    state.currentHistoryEntryId = null;
  }
  renderHistoryList();
}

export async function clearAllHistory() {
  const { changed } = await mutateStoredHistory((latestHistory) => {
    return latestHistory.length > 0 ? [] : latestHistory;
  });
  if (!changed) {
    return;
  }
  state.currentHistoryEntryId = null;
  state.historyEntryIdBySiteId.clear();
  renderHistoryList();
}

export function formatHistoryTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

export async function updateLatestHistoryUrl(siteId, url) {
  const entryId = state.historyEntryIdBySiteId.get(siteId) || state.currentHistoryEntryId;
  if (!siteId || !url || !entryId) {
    return;
  }

  const { changed } = await mutateStoredHistory((latestHistory) => {
    let hasChanged = false;
    const nextHistory = latestHistory.map((entry) => {
      if (entry.id !== entryId || !Array.isArray(entry.sites)) {
        return entry;
      }

      const updatedSites = entry.sites.map((site) => {
        if (!site || site.id !== siteId || site.url === url) {
          return site;
        }

        const homeUrl = state.allSites?.find((s) => s.id === siteId)?.url || "";
        if (shouldKeepStoredHistoryUrl(site.url, url, homeUrl, siteId)) {
          return site;
        }

        hasChanged = true;
        return {
          ...site,
          url: normalizeHistorySiteUrl(siteId, url) || url
        };
      });

      return hasChanged ? { ...entry, sites: updatedSites } : entry;
    });
    return hasChanged ? nextHistory : latestHistory;
  });

  if (!changed) {
    return;
  }
  renderHistoryList();
}

export function openHistoryPanel() {
  
  
  elements.historyPanel.removeAttribute("hidden");
}

export function closeHistoryPanel() {
  elements.historyPanel.setAttribute("hidden", "");
}

export function toggleHistoryPanel() {
  if (elements.historyPanel.hasAttribute("hidden")) {
    openHistoryPanel();
  } else {
    closeHistoryPanel();
  }
}
