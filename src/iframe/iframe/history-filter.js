import { state, elements } from "./state.js";

function t(key, fallback) {
  return window.__XUSEARCH_I18N__?.t?.(key) || fallback || "";
}

function getLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
}


function getDayBeforeYesterdayDateKey() {
  const day = new Date();
  day.setDate(day.getDate() - 2);
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
}

function matchesHistoryDateFilter(entry, filter = state.historyDateFilter) {
  if (filter === "all") {
    return true;
  }

  const entryDateKey = getLocalDateKey(entry?.createdAt);
  if (!entryDateKey) {
    return false;
  }

  if (filter === "yesterday") {
    return entryDateKey === getYesterdayDateKey();
  }
  if (filter === "before-yesterday") {
    return entryDateKey === getDayBeforeYesterdayDateKey();
  }
  return true;
}

export function getFilteredHistory() {
  const keyword = String(state.historySearchKeyword || "").trim().toLowerCase();
  return state.searchHistory.filter((entry) => {
    if (!matchesHistoryDateFilter(entry)) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    
    if (String(entry.query || "").toLowerCase().includes(keyword)) {
      return true;
    }
    const sites = Array.isArray(entry.sites) ? entry.sites : [];
    return sites.some((site) => String(site?.name || "").toLowerCase().includes(keyword));
  });
}

export function getHistoryEmptyMessage() {
  if (state.searchHistory.length === 0) {
    return t("iframe_historyEmpty", "暂无搜索记录");
  }
  
  if (String(state.historySearchKeyword || "").trim()) {
    return t("iframe_historyEmptySearch", "没有匹配的记录");
  }
  if (state.historyDateFilter === "yesterday") {
    return t("iframe_historyEmptyYesterday", "昨天暂无搜索记录");
  }
  if (state.historyDateFilter === "before-yesterday") {
    return t("iframe_historyEmptyBeforeYesterday", "前天暂无搜索记录");
  }
  return t("iframe_historyEmpty", "暂无搜索记录");
}

let refreshHistoryList = null;

export function attachHistoryFilterRefresh(refresh) {
  refreshHistoryList = refresh;
}

export function setHistoryDateFilter(filter) {
  if (!["all", "yesterday", "before-yesterday"].includes(filter) || filter === state.historyDateFilter) {
    return;
  }
  state.historyDateFilter = filter;
  refreshHistoryList?.();
}


export function setHistorySearchKeyword(keyword) {
  const next = String(keyword ?? "");
  if (next === state.historySearchKeyword) {
    return;
  }
  state.historySearchKeyword = next;
  refreshHistoryList?.();
}

export function updateHistoryFilterUi() {
  elements.historyFilterBtns?.forEach((btn) => {
    const active = btn.dataset.historyFilter === state.historyDateFilter;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

export function bindHistoryFilterEvents() {
  elements.historyFilterBtns?.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      setHistoryDateFilter(btn.dataset.historyFilter || "all");
    });
  });
  
  elements.historySearchInput?.addEventListener("input", (event) => {
    event.stopPropagation();
    setHistorySearchKeyword(event.target.value);
  });
}
