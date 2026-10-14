import { state, elements, BASE_CONFIG } from "./state.js";
import { getSelectedSites, buildSiteUrl, escapeHtml, ensureCardsNotEmpty } from "./utils.js";
import { setSiteStatus, setGlobalStatus } from "./status.js";
import { diagnosticLog, traceLog } from "../../shared/diagnostics.js";
import {
  clearIframeTimers,
  removeFromLoadQueue,
  enqueueLoad,
  beginIframeLoad,
  releaseLoadSlot,
} from "./load-queue.js";
import {
  renderSiteNav,
  renderCardNavStrip,
  updateScrollEdgeBtns,
  activateSidebarSite,
  layoutGridPages,
} from "./layout.js";
import { abortPendingWorkForSite, flushPendingQueryAfterLoad, settlePendingQuery } from "./send.js";
import { isUploadPage } from "./attachment-upload.js";
import { untrackUploadSite } from "./upload-progress.js";
import { untrackSite as untrackAnswerSite } from "./answer-progress.js";
import { applySidebarPolicyForDoc } from "./sidebar-control.js";
import { dispatchPendingFilesForCard } from "./file-upload.js";
import { MSG } from "../../shared/compare-protocol.js";
import {
  applyHistoryRestoreNavigation,
  resolveHistoryRestoreLoadTarget,
  urlsNeedIframeReload,
} from "./iframe-url-sync.js";

function msg(key, fallback) {
  return window.__XUSEARCH_I18N__?.t?.(key) || fallback || "";
}

export function renderCards() {
  elements.iframesContainer.innerHTML = "";
  elements.iframesContainer.dataset.columns = "1";
  elements.iframesContainer.dataset.layoutRows = state.layoutMode === "sidebar" ? "sidebar" : String(state.layoutRows);
  state.cardRefs.clear();

  const selectedSites = getSelectedSites();
  
  
  const isUploading = isUploadPage();
  const cardSites = selectedSites.filter(
    (s) => s.supportIframe !== false && !(isUploading && s.uploadSupported !== true)
  );

  if (selectedSites.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "请先选择至少一个站点。";
    elements.iframesContainer.appendChild(emptyState);
    return;
  }

  if (cardSites.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "本组所有站点均为新标签页模式，发送后将在新标签页打开。";
    elements.iframesContainer.appendChild(emptyState);
  }

  
  
  
  cardSites.forEach((site) => {
    const card = createSiteCard(site);
    
    
    for (const layout of Array.isArray(site.cardLayout) ? site.cardLayout : []) {
      card.classList.add(`iframe-card-${layout}`);
    }
    elements.iframesContainer.appendChild(card);
  });

  if (state.layoutMode === "sidebar") {
    if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
      state.activeSidebarSiteId = cardSites[0]?.id || null;
    }
    
    
    if (state.activeSidebarSiteId) {
      activateSidebarSite(state.activeSidebarSiteId);
    }
    renderSiteNav();
  } else {
    
    state.activeGridPage = 0;
    layoutGridPages();
  }

  elements.iframesContainer.scrollLeft = 0;
  elements.iframesContainer.scrollTop = 0;
  renderCardNavStrip();
}

export function createSiteCard(site) {
  const card = document.createElement("article");
  card.className = "iframe-card";
  card.dataset.siteId = site.id;
  card.tabIndex = 0;
  card.addEventListener("mouseenter", () => {
    card.classList.add("is-actions-visible");
  });
  card.addEventListener("mouseleave", () => {
    card.classList.remove("is-actions-visible");
  });
  card.addEventListener("focusin", () => {
    card.classList.add("is-actions-visible");
  });
  card.addEventListener("focusout", () => {
    card.classList.remove("is-actions-visible");
  });

  
  const header = document.createElement("div");
  header.className = "iframe-card-header";

  const title = document.createElement("span");
  title.className = "site-name";
  title.textContent = site.name;

  const status = document.createElement("span");
  status.className = "iframe-header-status is-hidden";
  status.setAttribute("aria-live", "polite");

  const controls = document.createElement("div");
  controls.className = "iframe-controls";

  const body = document.createElement("div");
  body.className = "iframe-card-body";

  const iconJump =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  const iconRefresh =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  const iconClose =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const jumpBtn = document.createElement("button");
  jumpBtn.type = "button";
  jumpBtn.className = "iframe-controls-btn";
  jumpBtn.innerHTML = iconJump;
  jumpBtn.setAttribute("data-tooltip", msg("iframe_cardJump", "跳往原网站"));
  jumpBtn.setAttribute("aria-label", msg("iframe_cardJump", "跳往原网站"));
  jumpBtn.addEventListener("click", () => {
    const ref = state.cardRefs.get(site.id);
    const targetUrl = ref?.currentUrl || site.url;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  });

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "iframe-controls-btn";
  refreshBtn.innerHTML = iconRefresh;
  refreshBtn.setAttribute("data-tooltip", msg("iframe_cardRefresh", "刷新当前卡片"));
  refreshBtn.setAttribute("aria-label", msg("iframe_cardRefresh", "刷新当前卡片"));
  refreshBtn.addEventListener("click", () => {
    const ref = state.cardRefs.get(site.id);
    if (ref) {
      refreshSiteCard(ref);
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "iframe-controls-btn";
  closeBtn.innerHTML = iconClose;
  closeBtn.setAttribute("data-tooltip", msg("iframe_cardClose", "关闭卡片"));
  closeBtn.setAttribute("aria-label", msg("iframe_cardClose", "关闭卡片"));
  closeBtn.addEventListener("click", () => {
    state.hiddenSiteIds.add(site.id);
    abortPendingWorkForSite(site.id);
    
    
    
    untrackUploadSite(site.id);
    untrackAnswerSite(site.id);
    const ref = state.cardRefs.get(site.id);
    if (ref?.cardEl) {
      ref.cardEl.remove();
    }
    state.cardRefs.delete(site.id);
    if (state.maximizedSiteId === site.id) {
      state.maximizedSiteId = null;
    }
    if (state.layoutMode === "sidebar" && state.activeSidebarSiteId === site.id) {
      const nextSite = getSelectedSites().find((s) => s.id !== site.id && state.cardRefs.has(s.id));
      state.activeSidebarSiteId = nextSite?.id || null;
      if (state.activeSidebarSiteId) {
        
        activateSidebarSite(state.activeSidebarSiteId);
      }
      renderSiteNav();
    } else if (state.layoutMode !== "sidebar") {
      
      layoutGridPages();
    }
    ensureCardsNotEmpty();
    renderCardNavStrip();
    setGlobalStatus(`已关闭 ${site.name} 卡片。`);
  });

  controls.appendChild(jumpBtn);
  controls.appendChild(refreshBtn);
  controls.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(status);
  header.appendChild(controls);

  const initialUrl = site.restoreUrl || site.url;
  const ref = {
    site,
    restoreUrl: site.restoreUrl || "",
    cardEl: card,
    statusEl: status,
    bodyEl: body,
    iframeEl: null,
    loadingEl: null,
    headerEl: header,
    controlsEl: controls,
    jumpBtnEl: jumpBtn,
    refreshBtnEl: refreshBtn,
    closeBtnEl: closeBtn,
    loaded: false,
    pendingQuery: "",
    pendingQueryDelayMs: 0,
    pendingQueryResolver: null,
    pendingFilesOnLoad: [],
    currentUrl: initialUrl,
    loadDelayTimerId: null,
    fallbackTimerId: null,
    _autoRetried: false,
    _retryTimeoutMs: 0
  };

  state.cardRefs.set(site.id, ref);
  createIframeBody(ref);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

export function refreshSiteCard(ref, options = {}) {
  
  
  const { immediate = true } = options;
  abortPendingWorkForSite(ref.site.id, { reason: "卡片已刷新，已取消上一条发送任务" });
  ref.loaded = false;
  ref.pendingFilesOnLoad = [];
  ref.iframeEl = null;
  ref._autoRetried = false;
  createIframeBody(ref, { immediate });
  setSiteStatus(ref.site.id, "正在重新加载…");
}

export function createIframeBody(ref, options = {}) {
  
  
  const { immediate = false } = options;

  
  
  
  clearIframeTimers(ref);
  removeFromLoadQueue(ref);
  if (state.loadingRefs.has(ref)) {
    state.loadingRefs.delete(ref);
    
    
  }

  if (ref.site.supportIframe === false) {
    renderExternalFallback(ref);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "ai-iframe";
  iframe.dataset.siteId = ref.site.id;
  iframe.loading = "eager";
  
  
  iframe.allow = "clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share";
  if (ref.site.iframeSandbox) {
    iframe.setAttribute("sandbox", ref.site.iframeSandbox);
  }

  const loadState = { resolved: false };
  ref._loadState = loadState;
  
  
  
  
  
  
  
  ref._targetSrc = ref.restoreUrl
    ? resolveHistoryRestoreLoadTarget(ref)
    : (ref.currentUrl || buildSiteUrl(ref.site, ""));
  
  
  diagnosticLog("compare.card", "rebuild-iframe", {
    site: ref.site.id,
    target: ref._targetSrc,
    hadCurrentUrl: Boolean(ref.currentUrl),
    restoreUrl: ref.restoreUrl || "",
  });

  const loading = createLoadingOverlay(ref.site.name, immediate ? "正在加载…" : "等待加载中…");

  iframe.addEventListener("load", () => {
    
    if (ref.iframeEl !== iframe) return;
    
    const currentSrc = iframe.src || "";
    if (!currentSrc || currentSrc === "about:blank") {
      return;
    }
    loadState.resolved = true;
    ref.loaded = true;
    
    
    
    
    try {
      iframe.contentWindow?.postMessage({ type: MSG.CLAIM_SITE_ID, siteId: ref.site.id }, "*");
    } catch (_error) {
      
    }
    const loadedUrl = currentSrc;
    const pendingRestoreUrl = ref.restoreUrl;
    ref.restoreUrl = "";
    if (pendingRestoreUrl && urlsNeedIframeReload(loadedUrl, pendingRestoreUrl)) {
      applyHistoryRestoreNavigation(ref, pendingRestoreUrl, loadedUrl);
      return;
    }
    ref.currentUrl = loadedUrl;
    clearIframeTimers(ref);
    releaseLoadSlot(ref);
    hideLoadingOverlay(ref);
    setSiteStatus(ref.site.id, "iframe 已加载，可直接在卡片内操作。");
    
    
    
    const postLoadDelay = BASE_CONFIG.postLoadSendDelayMs || 0;
    const flushAfterSidebarPolicy = () => {
      applySidebarPolicyForDoc(ref)
        .catch((error) => traceLog("[XuSearch sidebar] policy ERROR:", error?.message))
        .finally(() => flushPendingQueryAfterLoad(ref));
    };
    if (postLoadDelay > 0) {
      window.setTimeout(flushAfterSidebarPolicy, postLoadDelay);
    } else {
      flushAfterSidebarPolicy();
    }

    
    
    dispatchPendingFilesForCard(ref);
  });

  iframe.addEventListener("error", () => {
    if (ref.iframeEl !== iframe) return;
    if (!loadState.resolved) {
      loadState.resolved = true;
      clearIframeTimers(ref);
      releaseLoadSlot(ref);
      settlePendingQuery(ref, {
        ok: false,
        siteId: ref.site.id,
        error: "卡片加载失败，自动发送已取消"
      });
      renderFallback(ref, "加载失败，目标站点未响应或拒绝了连接。");
    }
  });

  
  ref.bodyEl.innerHTML = "";
  ref.bodyEl.appendChild(loading);
  ref.bodyEl.appendChild(iframe);
  ref.iframeEl = iframe;
  ref.loadingEl = loading;

  if (immediate) {
    
    state.loadingRefs.add(ref);
    beginIframeLoad(ref);
  } else {
    enqueueLoad(ref);
  }
}

export function renderFallback(ref, message, options = {}) {
  
  
  if (options.fromTimeout && !ref._autoRetried) {
    ref._autoRetried = true;
    ref.loaded = false;
    ref.iframeEl = null;
    
    
    ref._retryTimeoutMs = 8000;
    diagnosticLog("compare.card", "auto-retry-after-timeout", { site: ref.site.id });
    createIframeBody(ref, { immediate: true });
    setSiteStatus(ref.site.id, "加载超时，正在自动重试…");
    updateLoadingOverlay(ref, "加载超时，正在自动重试…");
    return;
  }

  
  clearIframeTimers(ref);
  settlePendingQuery(ref, {
    ok: false,
    siteId: ref.site.id,
    error: "卡片未完成加载，自动发送已取消"
  });
  ref.loadingEl = null;
  ref.bodyEl.innerHTML = `
    <div class="fallback-panel">
      <div class="warning-box">
        <strong>当前卡片未能完成嵌入</strong>
      </div>
      <p>${escapeHtml(message || ref.site.notes || "该站点可能限制 iframe 嵌入。")}</p>
      <div class="inline-action-row">
        <button class="site-action-btn" type="button" data-retry-load>重新加载</button>
        <button class="site-action-btn" type="button" data-open-site="${escapeHtml(ref.site.url)}">在新标签页打开</button>
      </div>
    </div>
  `;
  ref.iframeEl = null;
  ref.loaded = false;
  const retryButton = ref.bodyEl.querySelector("[data-retry-load]");
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      
      
      ref._autoRetried = false;
      createIframeBody(ref, { immediate: true });
      setSiteStatus(ref.site.id, "正在重新加载…");
    });
  }
  const openButton = ref.bodyEl.querySelector("[data-open-site]");
  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(ref.site.url, "_blank", "noopener,noreferrer");
    });
  }
  if (ref.controlsEl && !ref.cardEl.contains(ref.controlsEl)) {
    ref.headerEl.appendChild(ref.controlsEl);
  }
  setSiteStatus(ref.site.id, "该站点暂时无法在卡片内嵌入。");
}

function renderExternalFallback(ref) {
  ref.loadingEl = null;
  ref.iframeEl = null;
  ref.loaded = false;
  ref.currentUrl = ref.restoreUrl || buildSiteUrl(ref.site, "");
  const siteName = escapeHtml(ref.site.name);
  const panelDesc = escapeHtml(
    ref.site.notes || `${ref.site.name} 不支持卡片嵌入。请先在新标签页登录，批量搜索时会自动在新标签向该站点发送问题。`
  );
  ref.bodyEl.innerHTML = `
    <div class="fallback-panel">
      <div class="warning-box">
        <strong>${siteName} — 新标签页模式</strong>
      </div>
      <p>${panelDesc}</p>
      <div class="inline-action-row">
        <button class="site-action-btn" type="button" data-open-site="${escapeHtml(ref.currentUrl)}">在新标签页打开并登录</button>
      </div>
    </div>
  `;

  const openButton = ref.bodyEl.querySelector("[data-open-site]");
  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(ref.currentUrl || ref.site.url, "_blank", "noopener,noreferrer");
    });
  }
  if (ref.controlsEl && !ref.cardEl.contains(ref.controlsEl)) {
    ref.headerEl.appendChild(ref.controlsEl);
  }
  setSiteStatus(ref.site.id, "该站点已改为新标签页模式。");
}

function createLoadingOverlay(siteName, message) {
  const loading = document.createElement("div");
  loading.className = "iframe-loading-panel";
  loading.setAttribute("aria-live", "polite");
  loading.innerHTML = `
    <div class="iframe-loading-spinner" aria-hidden="true"></div>
    <div class="iframe-loading-title">${escapeHtml(siteName)}</div>
    <div class="iframe-loading-text">${escapeHtml(message)}</div>
  `;
  return loading;
}

export function updateLoadingOverlay(ref, message) {
  const textEl = ref?.loadingEl?.querySelector(".iframe-loading-text");
  if (textEl) {
    textEl.textContent = message;
  }
}

function hideLoadingOverlay(ref) {
  if (!ref?.loadingEl) return;
  ref.loadingEl.hidden = true;
}
