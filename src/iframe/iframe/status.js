import { state, elements } from "./state.js";
import { updateLatestHistoryUrl } from "./history.js";
import { handleHistoryRestoreUrlUpdate } from "./iframe-url-sync.js";
import { resolvePendingDispatch } from "./send.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";
import { handleUploadState, handleUploadAck } from "./upload-progress.js";

export function handleFrameMessage(event) {
  const payload = event.data;
  if (!payload || !payload.type) {
    return;
  }

  if (!payload.siteId) {
    return;
  }

  
  
  const ref = findCardRefByMessageSource(event.source);
  if (!ref || ref.site.id !== payload.siteId) {
    diagnosticLog("compare.message", "source-mismatch", {
      payloadType: payload.type,
      siteId: payload.siteId,
      matchedSiteId: ref?.site?.id,
    });
    return;
  }

  if (payload.type === MSG.FOCUS_RETURN) {
    
    
    
    
    
    
    
    
    
    const container = elements.iframesContainer;
    const active = document.activeElement;
    const focusInCard = Boolean(container && active && container.contains(active));
    diagnosticLog("compare.message", "focus-return", { siteId: payload.siteId, taken: focusInCard });
    if (!container || !focusInCard) return;
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    container.focus({ preventScroll: true });
    return;
  }

  if (payload.type === MSG.URL_UPDATE) {
    diagnosticLog("compare.message", "url-update", { siteId: payload.siteId, currentUrl: payload.currentUrl });
    ref.injectedPinged = true;
    if (payload.currentUrl) {
      if (handleHistoryRestoreUrlUpdate(ref, payload.currentUrl)) {
        updateLatestHistoryUrl(payload.siteId, ref.currentUrl);
        return;
      }
      ref.currentUrl = payload.currentUrl;
      ref._targetSrc = payload.currentUrl;
      updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
      
      
    }
    return;
  }

  if (payload.type === MSG.NAVIGATE_RESULT) {
    diagnosticLog("compare.message", "navigate-result", {
      siteId: payload.siteId,
      currentUrl: payload.currentUrl,
      ok: payload.ok,
    });
    if (payload.ok && payload.currentUrl && ref._historyRestoreNavigateTarget) {
      
      const renderWaitMs = ref.site?.restoreTimings?.renderWaitMs ?? 1800;
      window.setTimeout(() => {
        handleHistoryRestoreUrlUpdate(ref, payload.currentUrl);
      }, renderWaitMs);
    }
    return;
  }

  if (payload.type === MSG.PASTE_RESULT) {
    diagnosticLog("compare.message", "paste-result", {
      siteId: payload.siteId,
      requestId: payload.requestId,
      ok: payload.ok,
      error: payload.error,
    });
    resolvePendingFileDispatch(payload);
    
    handleUploadAck(payload.siteId, payload);
    return;
  }

  if (payload.type === MSG.UPLOAD_STATE) {
    diagnosticLog("compare.message", "upload-state", {
      siteId: payload.siteId,
      uploadState: payload.uploadState,
    });
    handleUploadState(payload.siteId, payload.uploadState);
    return;
  }

  if (payload.type !== MSG.RESULT) {
    diagnosticLog("compare.message", "unknown-type", { payloadType: payload.type, siteId: payload.siteId });
    return;
  }

  diagnosticLog("compare.message", "result", {
    siteId: payload.siteId,
    requestId: payload.requestId,
    ok: payload.ok,
    error: payload.error,
  });

  if (payload.currentUrl) {
    ref.currentUrl = payload.currentUrl;
    ref._targetSrc = payload.currentUrl;
    updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
    
    
  }

  if (payload.requestId) {
    resolvePendingDispatch(payload.requestId, payload);
  }

  if (payload.ok) {
    const successText = payload.handlerId && payload.handlerId !== "primary"
      ? payload.message || `已通过备选规则（${payload.handlerId}）发送。`
      : (payload.message || "iframe 页面已处理查询。");
    setSiteStatus(payload.siteId, successText, "success");
  } else {
    setSiteStatus(payload.siteId, payload.error || "iframe 页面处理失败。", "error");
  }
}

function resolvePendingFileDispatch(payload) {
  const requestId = payload?.requestId;
  if (!requestId) {
    return;
  }

  const pending = state.pendingFileDispatches.get(requestId);
  if (!pending) {
    return;
  }

  state.pendingFileDispatches.delete(requestId);
  if (pending.timerId) {
    window.clearTimeout(pending.timerId);
  }

  if (payload.ok) {
    setSiteStatus(payload.siteId, payload.message || "文件已发送到卡片输入框。", "success");
  } else {
    setSiteStatus(payload.siteId, payload.error || "文件发送失败。", "error");
  }

  try {
    pending.resolve(payload);
  } catch (_error) {
    
  }
}




export function findCardRefByMessageSource(source) {
  if (!source) return null;
  for (const ref of state.cardRefs.values()) {
    const win = ref.iframeEl && ref.iframeEl.contentWindow;
    if (win && win === source) {
      return ref;
    }
  }
  return null;
}

export function setSiteStatus(siteId, message, kind = "info") {
  const ref = state.cardRefs.get(siteId);
  if (!ref) {
    return;
  }

  
  if (kind !== "error") {
    ref.statusEl.classList.add("is-hidden");
    return;
  }

  ref.statusEl.textContent = message;
  ref.statusEl.classList.remove("success-text");
  ref.statusEl.classList.remove("is-hidden");
}

export function setGlobalStatus(message, isError = false) {
  elements.globalStatus.textContent = message;
  elements.globalStatus.classList.toggle("success-text", !isError);
}

export function toggleGlobalButtons(isBusy) {
  elements.sendSelectedBtn.disabled = isBusy;
  if (elements.promptAssistBtn) {
    elements.promptAssistBtn.disabled = isBusy;
  }
}

export function updateSendBtnState() {
  const hasContent = elements.queryInput.value.trim().length > 0;
  elements.sendSelectedBtn.classList.toggle("is-empty", !hasContent);
  
  
  elements.queryInput.closest(".bottom-composer-bar")?.classList.toggle("is-filled", hasContent);
  _syncComposerSize();
}


function _isComposerExpanded() {
  const bar = elements.queryInput?.closest(".bottom-composer-bar");
  return Boolean(bar?.matches(":has(:focus-visible), .is-filled"));
}

function _resetComposerCollapsedStyles() {
  const ta = elements.queryInput;
  const bar = ta?.closest(".bottom-composer-bar");
  if (!ta || !bar) return;

  bar.style.transition = "none";
  bar.classList.remove("is-wide", "is-tall");
  ta.style.height = "";
  ta.style.maxHeight = "";
  ta.scrollTop = 0;
  requestAnimationFrame(() => {
    bar.style.transition = "";
  });
}


export function collapseComposerInput() {
  if (_isComposerExpanded()) return;
  _resetComposerCollapsedStyles();
}


const RESTORE_BUDGET_WINDOW_MS = 1500;
const RESTORE_MAX_PER_SITE = 5;
const RESTORE_MAX_GLOBAL = 20;
let _composerWantsFocus = false;

const _restoreStampsBySite = new Map();
let _restoreStampsAll = [];


function broadcastComposerWants(wants) {
  for (const ref of state.cardRefs.values()) {
    const frame = ref.iframeEl;
    if (!frame?.contentWindow) continue;
    try {
      frame.contentWindow.postMessage({ type: MSG.COMPOSER_WANTS, wants }, "*");
    } catch (_error) {
      
    }
  }
}


export function releaseComposerFocus() {
  if (!_composerWantsFocus) return;
  _composerWantsFocus = false;
  broadcastComposerWants(false);
}

export function bindComposerFocusGuard(bar) {
  if (!bar) return;
  const claim = () => {
    if (_composerWantsFocus) return;
    _composerWantsFocus = true;
    broadcastComposerWants(true);
  };
  bar.addEventListener("pointerdown", claim, true);
  bar.addEventListener("focusin", () => {
    
    if (bar.matches(":focus-within")) claim();
  }, true);
  
  document.addEventListener("pointerdown", (event) => {
    if (bar.contains(event.target)) return;
    releaseComposerFocus();
  }, true);

  
  bar.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      const next = document.activeElement;
      const container = elements.iframesContainer;
      if (!container || !next || !container.contains(next) || !_composerWantsFocus) return;
      if (bar.matches(":focus-within")) return;
      const now = Date.now();
      const siteId = next.dataset?.siteId || "?";
      const siteStamps = (_restoreStampsBySite.get(siteId) || []).filter((t) => now - t < RESTORE_BUDGET_WINDOW_MS);
      _restoreStampsAll = _restoreStampsAll.filter((t) => now - t < RESTORE_BUDGET_WINDOW_MS);
      if (_restoreStampsAll.length >= RESTORE_MAX_GLOBAL) {
        
        releaseComposerFocus();
        return;
      }
      if (siteStamps.length >= RESTORE_MAX_PER_SITE) {
        
        _restoreStampsBySite.set(siteId, siteStamps);
        return;
      }
      siteStamps.push(now);
      _restoreStampsBySite.set(siteId, siteStamps);
      _restoreStampsAll.push(now);
      elements.queryInput?.focus({ preventScroll: true });
    });
  });
}


function rebroadcastWantsOnCardLoad() {
  const container = elements.iframesContainer;
  if (!container || container.__xsWantsRebind) return;
  container.__xsWantsRebind = true;
  
  container.addEventListener("load", (event) => {
    if (event.target?.tagName === "IFRAME") broadcastComposerWants(_composerWantsFocus);
  }, true);
}

export function bindComposerCollapseEvents() {
  const row = elements.queryInput?.closest(".bottom-composer-row");
  if (!row) return;

  row.addEventListener("focusin", () => {
    requestAnimationFrame(updateSendBtnState);
  });
  row.addEventListener("focusout", () => {
    requestAnimationFrame(collapseComposerInput);
  });
  const bar = elements.queryInput?.closest(".bottom-composer-bar");
  bindComposerFocusGuard(bar);
  rebroadcastWantsOnCardLoad();
}


const COMPOSER_TA_MIN_PX = 34;
const COMPOSER_TA_MAX_PX = 162;

const COMPOSER_WIDE_THRESHOLD_PX = 56;

function _syncComposerSize() {
  const ta = elements.queryInput;
  if (!ta) return;
  const bar = ta.closest(".bottom-composer-bar");
  if (!bar) return;

  if (!_isComposerExpanded()) {
    _resetComposerCollapsedStyles();
    return;
  }

  bar.style.transition = "none";
  bar.classList.remove("is-wide", "is-tall");
  ta.style.height = "0px";
  ta.style.maxHeight = "";
  ta.style.overflowY = "hidden";
  void ta.offsetWidth;

  const naturalH = ta.scrollHeight;

  if (naturalH <= COMPOSER_WIDE_THRESHOLD_PX) {
    
    const targetH = Math.max(COMPOSER_TA_MIN_PX, naturalH);
    ta.style.height = `${targetH}px`;
    requestAnimationFrame(() => { bar.style.transition = ""; });
    return;
  }

  
  bar.classList.add("is-wide");
  void ta.offsetWidth;

  
  ta.style.height = "0px";
  const expandedH = ta.scrollHeight;
  const clampedH = Math.min(expandedH, COMPOSER_TA_MAX_PX);
  ta.style.height = `${clampedH}px`;
  ta.style.maxHeight = `${COMPOSER_TA_MAX_PX}px`;
  ta.style.overflowY = expandedH > COMPOSER_TA_MAX_PX ? "auto" : "hidden";
  bar.classList.toggle("is-tall", expandedH > COMPOSER_TA_MAX_PX);

  requestAnimationFrame(() => { bar.style.transition = ""; });
}
