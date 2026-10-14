import { state, elements } from "./state.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clearAutoSendFlagFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("autosend");
  history.replaceState({}, "", url.toString());
}

export function normalizeQueryForMatch(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
}

export function buildSiteUrl(site, query) {
  const url = site.url || "";
  if (!url.includes("{query}")) {
    return url;
  }
  if (query && site.supportUrlQuery) {
    return url.replace("{query}", encodeURIComponent(query));
  }
  
  let next = url.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
  next = next.replace(/[?&]$/, "");
  
  return next.replace(/\{query\}/g, "");
}

export function getSelectedSites() {
  return state.sites.filter((site) => !state.hiddenSiteIds.has(site.id));
}

export function getQuery() {
  return elements.queryInput.value.trim();
}

export function setQueryInputValue(value, options = {}) {
  if (!elements.queryInput) {
    return;
  }

  elements.queryInput.value = String(value || "");
  elements.queryInput.dispatchEvent(new Event("input", { bubbles: true }));

  if (options.focus) {
    elements.queryInput.focus();
  }
}

export function ensureCardsNotEmpty() {
  if (state.cardRefs.size > 0) {
    return;
  }

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.textContent = "请先选择至少一个站点。";
  elements.iframesContainer.innerHTML = "";
  elements.iframesContainer.appendChild(emptyState);
}

export function parseRequestedSiteIds(rawValue) {
  if (!rawValue) {
    return null;
  }

  const siteIds = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((id, index, list) => list.indexOf(id) === index);

  return siteIds.length > 0 ? siteIds : null;
}

export function normalizePromptGroups(source) {
  const list = Array.isArray(source) ? source : [];
  return list.map((group, groupIndex) => ({
    id: String(group.id || `prompt-group-${groupIndex}`),
    name: String(group.name || "未命名分组"),
    prompts: Array.isArray(group.prompts)
      ? group.prompts.map((prompt, promptIndex) => ({
          id: String(prompt.id || `prompt-${groupIndex}-${promptIndex}`),
          title: String(prompt.title || "未命名提示词"),
          content: String(prompt.content || "")
        }))
      : []
  }));
}
