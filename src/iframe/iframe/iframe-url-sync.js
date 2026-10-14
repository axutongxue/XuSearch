import { clearIframeTimers, armIframeFallbackTimer, releaseLoadSlot } from "./load-queue.js";
import { setSiteStatus } from "./status.js";
import { buildSiteUrl } from "./utils.js";
import { MSG } from "../../shared/compare-protocol.js";
import {
  historyUrlsLooseMatch,
  normalizeHistorySiteUrl,
} from "./history-url-normalize.js";

const RESTORE_NAVIGATE_TIMEOUT_MS = 22000;
const RESTORE_NAVIGATE_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 16000];

export function urlsNeedIframeReload(previousSrc, nextUrl) {
  const prev = String(previousSrc || "").trim();
  const next = String(nextUrl || "").trim();
  if (!next || !/^https?:/i.test(next)) {
    return false;
  }
  if (!prev || prev === "about:blank") {
    return true;
  }
  try {
    const a = new URL(prev);
    const b = new URL(next);
    if (a.origin !== b.origin) {
      return true;
    }
    return a.pathname !== b.pathname || a.search !== b.search || a.hash !== b.hash;
  } catch (_error) {
    return prev !== next;
  }
}


export function resolveHistoryRestoreLoadTarget(ref) {
  const homeUrl = buildSiteUrl(ref.site, "") || ref.site?.url || "";
  const restoreUrl = normalizeHistorySiteUrl(ref.site?.id, ref.restoreUrl);

  if (restoreUrl && restoreUrl !== ref.restoreUrl) {
    ref.restoreUrl = restoreUrl;
  }

  if (!restoreUrl || !urlsNeedIframeReload(homeUrl, restoreUrl)) {
    ref._targetSrc = restoreUrl || homeUrl;
    ref.restoreUrl = "";
    return ref._targetSrc;
  }

  ref._targetSrc = homeUrl;
  return homeUrl;
}

function hideLoadingOverlay(ref) {
  if (ref?.loadingEl) {
    ref.loadingEl.hidden = true;
  }
}

function showIframeLoading(ref, message) {
  if (!ref?.loadingEl) {
    return;
  }
  ref.loadingEl.hidden = false;
  const textEl = ref.loadingEl.querySelector(".iframe-loading-text");
  if (textEl) {
    textEl.textContent = message;
  }
}

function clearHistoryRestoreNavigateState(ref) {
  if (ref?._historyRestoreNavigateTimer) {
    window.clearTimeout(ref._historyRestoreNavigateTimer);
    ref._historyRestoreNavigateTimer = null;
  }
  ref._historyRestoreNavigateTarget = "";
  ref._historyRestoreNavigateRetryTimers?.forEach((timerId) => window.clearTimeout(timerId));
  ref._historyRestoreNavigateRetryTimers = [];
}

export function completeHistoryRestoreNavigation(ref) {
  if (!ref) {
    return;
  }
  clearHistoryRestoreNavigateState(ref);
  if (ref._loadState) {
    ref._loadState.resolved = true;
  }
  ref.loaded = true;
  clearIframeTimers(ref);
  releaseLoadSlot(ref);
  hideLoadingOverlay(ref);
  setSiteStatus(ref.site.id, "已恢复历史对话页。");
}

export function handleHistoryRestoreUrlUpdate(ref, currentUrl) {
  const target = ref?._historyRestoreNavigateTarget;
  if (!target || !currentUrl) {
    return false;
  }
  if (!historyUrlsLooseMatch(ref.site?.id, currentUrl, target)) {
    return false;
  }
  ref.currentUrl = normalizeHistorySiteUrl(ref.site?.id, currentUrl) || currentUrl;
  ref._targetSrc = ref.currentUrl;
  completeHistoryRestoreNavigation(ref);
  return true;
}

function shouldRestoreNavigateInFrame(homeUrl, restoreUrl) {
  try {
    return new URL(homeUrl).origin === new URL(restoreUrl).origin;
  } catch (_error) {
    return false;
  }
}

function postRestoreNavigateMessage(ref, url) {
  const win = ref?.iframeEl?.contentWindow;
  if (!win) {
    return false;
  }
  try {
    win.postMessage({
      type: MSG.NAVIGATE,
      url,
      siteId: ref.site?.id,
      site: ref.site,
    }, "*");
    return true;
  } catch (_error) {
    return false;
  }
}

function failHistoryRestoreNavigation(ref) {
  clearHistoryRestoreNavigateState(ref);
  if (ref._loadState) {
    ref._loadState.resolved = true;
  }
  ref.loaded = true;
  clearIframeTimers(ref);
  releaseLoadSlot(ref);
  hideLoadingOverlay(ref);
  setSiteStatus(
    ref.site.id,
    "自动恢复对话页未完成，可点击卡片刷新或「跳往原网站」。",
    "error"
  );
}

function scheduleInFrameRestoreNavigation(ref, restoreUrl) {
  clearHistoryRestoreNavigateState(ref);
  ref._historyRestoreNavigateTarget = restoreUrl;
  ref._historyRestoreNavigateRetryTimers = [];
  showIframeLoading(ref, "正在恢复对话页…");
  setSiteStatus(ref.site.id, "正在恢复历史对话…");

  
  
  const siteDelays = ref.site?.restoreTimings?.retryDelaysMs;
  const retryDelays = Array.isArray(siteDelays) && siteDelays.length > 0 ? siteDelays : RESTORE_NAVIGATE_RETRY_DELAYS_MS;

  retryDelays.forEach((delayMs) => {
    const timerId = window.setTimeout(() => {
      if (!ref._historyRestoreNavigateTarget) {
        return;
      }
      postRestoreNavigateMessage(ref, restoreUrl);
    }, delayMs);
    ref._historyRestoreNavigateRetryTimers.push(timerId);
  });

  
  ref._historyRestoreNavigateTimer = window.setTimeout(() => {
    if (!ref._historyRestoreNavigateTarget) {
      return;
    }
    failHistoryRestoreNavigation(ref);
  }, RESTORE_NAVIGATE_TIMEOUT_MS);
}


export function applyHistoryRestoreNavigation(ref, restoreUrl, loadedUrl = "") {
  const siteId = ref?.site?.id || "";
  const normalized = normalizeHistorySiteUrl(siteId, restoreUrl);
  if (!normalized) {
    completeHistoryRestoreNavigation(ref);
    return false;
  }

  const homeUrl = buildSiteUrl(ref.site, "") || ref.site?.url || "";
  if (!urlsNeedIframeReload(loadedUrl || homeUrl, normalized)) {
    ref.currentUrl = normalized;
    ref._targetSrc = normalized;
    completeHistoryRestoreNavigation(ref);
    return false;
  }

  ref.currentUrl = normalized;

  if (shouldRestoreNavigateInFrame(homeUrl, normalized)) {
    scheduleInFrameRestoreNavigation(ref, normalized);
    return true;
  }

  syncIframeToReportedUrl(ref, normalized);
  return true;
}


export function syncIframeToReportedUrl(ref, nextUrl) {
  if (!ref?.iframeEl || !nextUrl) {
    return false;
  }

  const iframe = ref.iframeEl;
  const currentSrc = iframe.src || "";
  if (!urlsNeedIframeReload(currentSrc, nextUrl)) {
    ref.currentUrl = nextUrl;
    ref._targetSrc = nextUrl;
    return false;
  }

  ref._targetSrc = nextUrl;
  ref.currentUrl = nextUrl;
  if (ref._loadState) {
    ref._loadState.resolved = false;
  }
  ref.loaded = false;
  clearIframeTimers(ref);
  showIframeLoading(ref, "正在加载对话页…");
  iframe.src = nextUrl;
  armIframeFallbackTimer(ref, iframe);
  setSiteStatus(ref.site.id, "正在同步对话页…");
  return true;
}
