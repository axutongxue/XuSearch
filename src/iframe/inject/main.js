import { EXTENSION_ORIGIN } from "./constants.js";
import { runSearchHandlerChain } from "./search-handler-run.js";
import { executeSiteHandler } from "./executor.js";
import { HANDLER_ERROR_CODE } from "../../shared/handler-fallback.js";
import { handleExtractRequest } from "./extractor.js";
import { hasSitePageTextConfig } from "./extractor-site-selectors.js";
import { deliverFilesToInput, extractInputSelectorsFromHandler } from "./file-paste.js";
import { diagnosticLog, traceLog } from "../../shared/diagnostics.js";
import { findBuiltinSiteForHost, loadEnabledSites } from "../../shared/site-registry.js";
import { initSelectionToolbar } from "./selection-toolbar.js";
import { initInputPromptLauncher } from "./input-prompt-launcher.js";
import { handleHistoryRestoreNavigate } from "./history-restore-navigate.js";
import { probeAnswerState } from "./answer-probe.js";
import { MSG } from "../../shared/compare-protocol.js";
import { isEmbeddedByExtensionPage, shouldCancelSiteFocus } from "./focus-policy.js";








const _siteTag = () => {
  const h = (window.location?.hostname || "").replace(/^www\./, "");
  const handler = window.__XUSEARCH_HANDLER__;
  return h ? `[XuSearch:${h}${handler ? "|" + handler : ""}]` : "[XuSearch]";
};
{
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  const _debug = console.debug ? console.debug.bind(console) : null;
  console.log = (...args) => _log(_siteTag(), ...args);
  console.warn = (...args) => _warn(_siteTag(), ...args);
  console.error = (...args) => _error(_siteTag(), ...args);
  if (_debug) console.debug = (...args) => _debug(_siteTag(), ...args);
}

const requestResults = new Map();
const requestsInProgress = new Set();
const REQUEST_RESULT_TTL_MS = 5 * 60 * 1000;
const REQUEST_RESULT_MAX = 80;
let lastReportedUrl = "";






const UPLOAD_MONITOR_EVENT = "__XUSEARCH_UPLOAD_MONITOR__";
const UPLOAD_MONITOR_WINDOW_MS = 90 * 1000;
let uploadMonitorActive = false;
let uploadMonitorSiteId = null;
let uploadMonitorTimer = null;


let uploadMonitorActivitySeen = false;

function activateUploadMonitor(siteId) {
  uploadMonitorActive = true;
  uploadMonitorSiteId = siteId || null;
  if (uploadMonitorTimer) {
    window.clearTimeout(uploadMonitorTimer);
  }
  uploadMonitorTimer = window.setTimeout(() => {
    uploadMonitorActive = false;
    uploadMonitorSiteId = null;
  }, UPLOAD_MONITOR_WINDOW_MS);
}


function waitForUploadMonitorActivity(waitMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (uploadMonitorActivitySeen) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startedAt >= waitMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 150);
  });
}

window.addEventListener("message", (event) => {
  if (!uploadMonitorActive) return;
  const payload = event.data;
  if (!payload || payload.type !== UPLOAD_MONITOR_EVENT) return;
  
  if (event.source !== window) return;
  const state = payload.state;
  if (state !== "uploading" && state !== "done" && state !== "error") return;
  uploadMonitorActivitySeen = true;
  notifyParentFrame({
    type: MSG.UPLOAD_STATE,
    siteId: uploadMonitorSiteId || "",
    uploadState: {
      state,
      percent: Number(payload.percent) || 0,
      kind: payload.kind || "unknown",
    },
  });
});












function setupAutofocusGuard() {
  if (window.__XUSEARCH_AUTOFOCUS_GUARD__) return;
  window.__XUSEARCH_AUTOFOCUS_GUARD__ = true;
  
  
  const strict = isEmbeddedByExtensionPage(location.ancestorOrigins, EXTENSION_ORIGIN);
  let userTouched = false;
  if (strict) {
    
    
    const markTouched = (event) => {
      if (event.isTrusted) userTouched = true;
    };
    document.addEventListener("pointerdown", markTouched, true);
    document.addEventListener("mousedown", markTouched, true);
    document.addEventListener("keydown", markTouched, true);
    document.addEventListener("touchstart", markTouched, true);
  }
  document.addEventListener("focus", (event) => {
    
    
    const allowMarked = Boolean(
      window.__XUSEARCH_FOCUS_ALLOW__ ||
        (window.__XUSEARCH_FOCUS_ALLOW_TS__ && Date.now() - window.__XUSEARCH_FOCUS_ALLOW_TS__ <= 300),
    );
    const cancelled = shouldCancelSiteFocus({
      allowMarked,
      strict,
      userTouched,
      hasBeenActive: navigator.userActivation?.hasBeenActive === true,
    });
    if (cancelled) {
      event.preventDefault();
      diagnosticLog("inject.focus", "blocked-autofocus", {
        target: event.target?.tagName,
        class: String(event.target?.className || "").slice(0, 40),
      });
    }
  }, true);
}



function notifyFocusReturn(site) {
  if (window.parent === window) return;
  
  
  const targetOrigin = "*";
  try {
    diagnosticLog("inject.focus", "return-to-parent", { siteId: site?.id });
    window.parent.postMessage({ type: MSG.FOCUS_RETURN, siteId: site?.id }, targetOrigin);
  } catch (_error) {
    
  }
}









let _shellProxy = null;



let _claimedSiteId = null;
let _claimedSite = null;
const PROXY_DOWN_MSG = new Set([MSG.SEARCH, MSG.ANSWER_PROBE, MSG.EXTRACT, MSG.COMPOSER_WANTS]);


const seenPasteRequestIds = new Map();
const PASTE_DEDUPE_TTL_MS = 5 * 60 * 1000;
function isPasteRequestSeen(requestId) {
  if (!requestId) return false;
  const now = Date.now();
  for (const [id, ts] of seenPasteRequestIds) {
    if (now - ts > PASTE_DEDUPE_TTL_MS) seenPasteRequestIds.delete(id);
  }
  if (seenPasteRequestIds.has(requestId)) return true;
  seenPasteRequestIds.set(requestId, now);
  return false;
}
const PROXY_UP_MSG = new Set([
  MSG.RESULT,
  MSG.URL_UPDATE,
  MSG.FOCUS_RETURN,
  MSG.PASTE_RESULT,
  MSG.UPLOAD_HANDLER_RESULT,
  MSG.UPLOAD_STATE,
  MSG.NAVIGATE_RESULT,
  MSG.EXTRACT_RESULT,
  MSG.ANSWER_PROBE_RESULT,
]);

function isShellDocument() {
  
  if (!_shellProxy) return false;
  const host = window.location.hostname.replace(/^www\./, "").toLowerCase();
  const hosts = Array.isArray(_shellProxy.hosts) ? _shellProxy.hosts : [];
  return hosts.some((h) => String(h).replace(/^www\./, "").toLowerCase() === host)
    && !document.getElementById("input_ai_search");
}

function findNestedTargetFrame(keyword) {
  const targetKeyword = keyword || _shellProxy?.frameKeyword || "";
  if (!targetKeyword) return null;
  for (const frame of document.querySelectorAll("iframe")) {
    try {
      if ((frame.src || "").includes(targetKeyword)) return frame;
    } catch (_error) {
      
    }
  }
  return null;
}



function findExtractProxyFrame() {
  if (!Array.isArray(_extractProxySelectors) || _extractProxySelectors.length === 0) {
    return null;
  }
  for (const sel of _extractProxySelectors) {
    try {
      const frames = document.querySelectorAll(sel);
      for (const frame of frames) {
        if (frame?.contentWindow) return frame;
      }
    } catch (_error) {
      
    }
  }
  return null;
}

function hasExtractProxy() {
  return Array.isArray(_extractProxySelectors) && _extractProxySelectors.length > 0;
}

function installNestedFrameProxy() {
  
  if (window.__xuSearchNestedProxyInstalled) return;
  
  
  if (!isShellDocument() && !hasExtractProxy()) return;
  window.__xuSearchNestedProxyInstalled = true;
  const isShell = isShellDocument();
  window.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || !payload.type) return;
    
    if (PROXY_UP_MSG.has(payload.type) && event.source && event.source !== window.parent) {
      window.parent.postMessage(payload, EXTENSION_ORIGIN || "*");
      return;
    }
    
    
    if (isShell && PROXY_DOWN_MSG.has(payload.type) && event.source === window.parent) {
      const target = findNestedTargetFrame();
      if (target?.contentWindow) {
        target.contentWindow.postMessage(payload, "*");
      }
    }
  });
}




let _shellOriginHosts = null;



let _extractProxySelectors = null;
resolveSite().then((site) => {
  if (site && Array.isArray(site.matchPatterns)) {
    _shellOriginHosts = new Set(site.matchPatterns.map((p) => String(p).replace(/^www\./, "")));
  }
  if (site && site.extractProxy && Array.isArray(site.extractProxy.frameSelectors)) {
    _extractProxySelectors = site.extractProxy.frameSelectors;
  }
  if (site && site.shellProxy && typeof site.shellProxy === "object") {
    _shellProxy = site.shellProxy;
  }
  
  
  installNestedFrameProxy();
}).catch(() => {});

async function handleSearchRequest(message) {
  const query = String(message.query || "").trim();
  traceLog("[XuSearch inject] handleSearchRequest 收到, query=", query, "site=", message.site?.id);
  if (!query) {
    diagnosticLog("inject.search", "empty-query", { site: message.site });
    return { ok: false, siteId: message.site?.id, error: "查询为空" };
  }

  const site = await resolveSite(message.site);
  traceLog("[XuSearch inject] resolveSite 结果, site=", site?.id, "有searchHandler=", !!site?.searchHandler);
  if (!site || !site.searchHandler) {
    diagnosticLog("inject.search", "site-unmatched", {
      site: message.site,
      hostname: window.location.hostname,
    });
    return {
      ok: false,
      siteId: message.site?.id,
      error: `当前页面未匹配到站点配置: ${window.location.hostname}`,
    };
  }

  diagnosticLog("inject.search", "handler-start", {
    site,
    hostname: window.location.hostname,
    query,
  });

  const result = await runSearchHandlerChain(query, site);
  if (result.ok) {
    scheduleUrlReports(site);
    diagnosticLog("inject.search", "handler-success", { site, handlerId: result.handlerId });
    
    notifyFocusReturn(site);
  } else {
    diagnosticLog("inject.search", "handler-error", {
      site,
      error: result.error,
      errorCode: result.errorCode,
      handlerAttempts: result.handlerAttempts,
    });
  }
  return result;
}


async function handleUploadHandlerRequest(message) {
  const steps = Array.isArray(message?.steps) ? message.steps : [];
  if (steps.length === 0) {
    return { ok: true, siteId: message?.site?.id, message: "无上传前置步骤" };
  }

  const site = await resolveSite(message.site);
  if (!site) {
    return {
      ok: false,
      siteId: message?.site?.id,
      error: `当前页面未匹配到站点配置: ${window.location.hostname}`,
    };
  }

  diagnosticLog("inject.upload", "handler-start", {
    site,
    hostname: window.location.hostname,
    stepCount: steps.length,
  });

  try {
    
    try {
      window.__XUSEARCH_HANDLER__ = "upload";
    } catch (_e) {
      
    }
    await executeSiteHandler("", { steps });
    diagnosticLog("inject.upload", "handler-success", { site });
    return { ok: true, siteId: site.id, message: "uploadHandler 执行完成" };
  } catch (error) {
    diagnosticLog("inject.upload", "handler-error", {
      site,
      error: error.message,
    });
    return {
      ok: false,
      siteId: site.id,
      error: `uploadHandler 失败: ${error.message}`,
    };
  }
}


let sidebarChainGen = 0;


async function handleSidebarHandlerRequest(message) {
  const steps = Array.isArray(message?.steps) ? message.steps : [];
  if (steps.length === 0) {
    return { ok: true, siteId: message?.site?.id, message: "无侧边栏步骤" };
  }
  const gen = ++sidebarChainGen;

  const site = await resolveSite(message.site);
  if (!site) {
    return {
      ok: false,
      siteId: message?.site?.id,
      error: `当前页面未匹配到站点配置: ${window.location.hostname}`,
    };
  }

  diagnosticLog("inject.sidebar", "handler-start", {
    site,
    hostname: window.location.hostname,
    stepCount: steps.length,
  });

  try {
    
    try {
      window.__XUSEARCH_HANDLER__ = "sidebar";
    } catch (_e) {
      
    }
    await executeSiteHandler("", { steps }, { isStale: () => gen !== sidebarChainGen });
    diagnosticLog("inject.sidebar", "handler-success", { site });
    return { ok: true, siteId: site.id, message: "sidebarHandler 执行完成" };
  } catch (error) {
    diagnosticLog("inject.sidebar", "handler-error", {
      site,
      error: error.message,
    });
    return {
      ok: false,
      siteId: site.id,
      error: `sidebarHandler 失败: ${error.message}`,
    };
  }
}





async function handleFilesPasteRequest(message) {
  const files = Array.isArray(message.files) ? message.files : [];
  if (files.length === 0) {
    return { ok: false, siteId: message.site?.id, error: "无文件可粘贴" };
  }

  const site = await resolveSite(message.site);
  if (!site) {
    return {
      ok: false,
      siteId: message.site?.id,
      error: `当前页面未匹配到站点配置: ${window.location.hostname}`,
    };
  }

  try {
    
    
    
    
    
    const siteAnchors = Array.isArray(site.uploadInputSelectors)
      ? site.uploadInputSelectors.filter(Boolean)
      : [];
    const inputSelectors = siteAnchors.length > 0
      ? siteAnchors
      : extractInputSelectorsFromHandler(site.searchHandler);
    const uploadVia = site.uploadVia || "auto";
    
    activateUploadMonitor(site.id);
    traceLog("[XuSearch inject] handleFilesPasteRequest start, site =", site.id, "fileCount =", files.length, "selectors =", inputSelectors, "uploadVia =", uploadVia);
    diagnosticLog("inject.paste-files", "start", {
      site,
      fileCount: files.length,
      usedSelectors: inputSelectors,
      uploadVia,
    });
    
    
    
    
    const maxPasteRetries = uploadVia !== "file" && Number.isFinite(site.uploadRetryMax)
      ? Math.max(0, Math.min(3, Math.floor(site.uploadRetryMax)))
      : 0;
    let result;
    let pasteAttempt = 0;
    while (true) {
      pasteAttempt += 1;
      uploadMonitorActivitySeen = false;
      result = await deliverFilesToInput(files, inputSelectors, uploadVia, {
        uploadErrorWindowMs: Number.isFinite(site.uploadErrorWindowMs) ? site.uploadErrorWindowMs : undefined,
        
        
        uploadTriggerSelectors: Array.isArray(site.uploadTriggerSelectors) ? site.uploadTriggerSelectors : undefined,
        
        
        uploadSuccessSelectors: Array.isArray(site.uploadSuccessSelectors) ? site.uploadSuccessSelectors : undefined,
        
        uploadErrorSelectors: Array.isArray(site.uploadErrorSelectors) ? site.uploadErrorSelectors : undefined,
        uploadErrorKeywords: Array.isArray(site.uploadErrorKeywords) ? site.uploadErrorKeywords : undefined,
      });
      
      
      
      
      
      
      
      
      const errorRetryable = result.unconfirmed
        || (Number.isFinite(site.uploadRetryMax) && site.uploadRetryMax > 0);
      if (!result.delivered || (result.error && !errorRetryable)) break;
      
      
      if (result.confirmed) break;
      if (pasteAttempt > maxPasteRetries) break;
      if (result.unconfirmed) {
        
        
        
        
        
        
        
        
        traceLog("[XuSearch inject] paste handled but marker absent, waiting 2s for UI settle, then retrying:", pasteAttempt, "/", maxPasteRetries, "site =", site.id);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        const sawUpload = await waitForUploadMonitorActivity(3000);
        if (sawUpload) break;
        traceLog("[XuSearch inject] paste handled but no upload activity seen, retrying:", pasteAttempt, "/", maxPasteRetries, "site =", site.id);
      }
      diagnosticLog("inject.paste-files", "retry-no-upload-activity", { site, attempt: pasteAttempt });
    }
    traceLog("[XuSearch inject] deliverFilesToInput returned:", result, "site =", site.id);
    diagnosticLog("inject.paste-files", "complete", { site, result });

    
    
    
    
    if (result.delivered && !result.error) {
      return {
        ok: true,
        siteId: site.id,
        message: `已粘贴 ${files.length} 个文件`,
      };
    }
    
    return {
      ok: false,
      siteId: site.id,
      error: result.error || "未能派发到输入框",
      
      uploadError: !!result.error,
    };
  } catch (error) {
    console.error("[XuSearch inject] handleFilesPasteRequest error:", error.message, "site =", site.id);
    diagnosticLog("inject.paste-files", "error", { site, error: error.message });
    return { ok: false, siteId: site.id, error: error.message };
  }
}

async function resolveSite(explicitSite) {
  if (explicitSite && explicitSite.searchHandler) {
    return explicitSite;
  }
  
  
  if (_claimedSiteId) {
    if (_claimedSite && _claimedSite.id === _claimedSiteId) {
      return _claimedSite;
    }
    try {
      
      
      const all = await loadEnabledSites({ fallbackEmpty: true });
      const claimed = all.find((s) => s.id === _claimedSiteId);
      if (claimed) {
        _claimedSite = claimed;
        return claimed;
      }
      traceLog("[XuSearch inject] 认领的站点 id 不在站点表内:", _claimedSiteId, "⇒ 回落 hostname 反查");
    } catch (_error) {
      
    }
  }
  try {
    return await findBuiltinSiteForHost(window.location.hostname, { fallbackEmpty: true });
  } catch (_error) {
    diagnosticLog("inject.registry", "load-failed", { error: _error.message });
    return null;
  }
}

function notifyParentFrame(result) {
  if (window.parent === window) return;
  
  
  
  
  const targetOrigin = "*";
  try {
    diagnosticLog("inject.message", "notify-parent", result);
      window.parent.postMessage(
      {
        type: result.type || MSG.RESULT,
        siteId: result.siteId,
        requestId: result.requestId,
        ok: result.ok,
        message: result.message,
        error: result.error,
        errorCode: result.errorCode,
        handlerId: result.handlerId,
        currentUrl: result.currentUrl,
        uploadError: result.uploadError,
        
        uploadState: result.uploadState,
        
        detectable: result.detectable,
        generating: result.generating,
        done: result.done,
        
        stopButtonSeen: result.stopButtonSeen,
      },
      targetOrigin
    );
  } catch (_error) {
    diagnosticLog("inject.message", "notify-parent-failed", { error: _error.message });
    
  }
}

async function setupUrlReporting() {
  let site;
  try {
    site = await resolveSite();
  } catch (_error) {
    return;
  }
  if (!site) return;

  scheduleUrlReports(site);

  const originalPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(...args) {
    const value = originalPushState(...args);
    scheduleUrlReports(site);
    return value;
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(...args) {
    const value = originalReplaceState(...args);
    scheduleUrlReports(site);
    return value;
  };

  window.addEventListener("popstate", () => scheduleUrlReports(site));
  window.addEventListener("hashchange", () => scheduleUrlReports(site));
}

function reportCurrentUrl(site) {
  const currentUrl = window.location.href;
  if (!site || !currentUrl || currentUrl === lastReportedUrl || window.parent === window) {
    return;
  }
  lastReportedUrl = currentUrl;
  
  
  
  const targetOrigin = "*";
  
  
  
  
  try {
    diagnosticLog("inject.url", "report", { site, currentUrl });
    window.parent.postMessage(
      { type: MSG.URL_UPDATE, siteId: site.id, currentUrl },
      targetOrigin
    );
  } catch (_error) {
    diagnosticLog("inject.url", "report-failed", { site, error: _error.message });
    
  }
}

function scheduleUrlReports(site) {
  reportCurrentUrl(site);
  [800, 2000, 5000, 10000, 20000, 30000].forEach((delayMs) => {
    window.setTimeout(() => reportCurrentUrl(site), delayMs);
  });
}

function installRuntimeMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "SEARCH_SITE_QUERY") return false;

    handleSearchRequest(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          siteId: message.site?.id,
          error: error.message,
        });
      });

    return true;
  });
}

function installWindowMessageListener() {
  window.addEventListener("message", (event) => {
    
    
    
    
    
    
    
    if (EXTENSION_ORIGIN) {
      const isExtensionOrigin = event.origin === EXTENSION_ORIGIN;
      let isShellOrigin = false;
      if (!isExtensionOrigin && event.source === window.parent && _shellOriginHosts) {
        try {
          const host = new URL(event.origin).hostname.replace(/^www\./, "");
          
          
          isShellOrigin = _shellOriginHosts.has(host);
        } catch (_error) {
          
        }
      }
      if (!isExtensionOrigin && !isShellOrigin) return;
      if (event.source !== window.parent) return;
    }

    if (!event.data) return;

    
    
    
    if (event.data.type === MSG.COMPOSER_WANTS) {
      window.__XUSEARCH_COMPOSER_WANTS_FOCUS__ = event.data.wants === true;
      return;
    }

    
    
    
    
    if (event.data.type === MSG.CLAIM_SITE_ID) {
      const claimId = String(event.data.siteId || "").trim();
      if (claimId) {
        _claimedSiteId = claimId;
        _claimedSite = null; 
        traceLog("[XuSearch inject] 已认领站点身份:", claimId);
        diagnosticLog("inject.registry", "site-claimed", { siteId: claimId });
      }
      return;
    }

    if (event.data.type === MSG.EXTRACT) {
      
      
      
      if (isShellDocument()) {
        const target = findNestedTargetFrame();
        if (target?.contentWindow) {
          target.contentWindow.postMessage(event.data, "*");
          return;
        }
        
        
        
        
        
        
        if (hasSitePageTextConfig(event.data.site, window.location.hostname)) {
          traceLog("[XuSearch inject] EXTRACT: 未找到落地页 iframe，但本站为本域配了精确容器 ⇒ 就地提取");
          diagnosticLog("inject.extract", "shell-forward-fallback-local", { siteId: event.data.site?.id });
        } else {
          traceLog("[XuSearch inject] EXTRACT: 未找到落地页 iframe 且本站无本域容器 ⇒ 放弃（避免返回 UI 噪音）");
          diagnosticLog("inject.extract", "shell-forward-no-target", { siteId: event.data.site?.id });
          return;
        }
      }
      
      
      
      const extractProxyTarget = findExtractProxyFrame();
      if (extractProxyTarget?.contentWindow) {
        extractProxyTarget.contentWindow.postMessage(event.data, "*");
        return;
      }
      handleExtractRequest(event.data);
      return;
    }

    if (event.data.type === MSG.ANSWER_PROBE) {
      
      
      
      if (isShellDocument()) {
        const target = findNestedTargetFrame();
        if (target?.contentWindow) {
          target.contentWindow.postMessage(event.data, "*");
          return;
        }
        
        
        traceLog("[XuSearch inject] ANSWER_PROBE: 未找到落地页 iframe ⇒ 就地探测");
        diagnosticLog("inject.answer-probe", "shell-forward-fallback-local", { siteId: event.data.site?.id });
      }
      resolveSite(event.data.site)
        .then((site) => {
          const probe = probeAnswerState(site);
          notifyParentFrame({
            type: MSG.ANSWER_PROBE_RESULT,
            siteId: event.data.site?.id,
            requestId: event.data.requestId,
            detectable: probe.detectable,
            generating: probe.generating,
            done: probe.done,
          });
        })
        .catch(() => {
          notifyParentFrame({
            type: MSG.ANSWER_PROBE_RESULT,
            siteId: event.data.site?.id,
            requestId: event.data.requestId,
            detectable: false,
            generating: false,
            done: false,
          });
        });
      return;
    }

    if (event.data.type === MSG.NAVIGATE) {
      handleHistoryRestoreNavigate(event.data, () => {
        resolveSite()
          .then((site) => {
            if (site) {
              scheduleUrlReports(site);
            }
          })
          .catch(() => {});
      });
      return;
    }

    if (event.data.type === MSG.PASTE_FILES) {
      const requestId = event.data.requestId;
      traceLog("[XuSearch inject] PASTE_FILES received, requestId =", requestId, "fileCount =", Array.isArray(event.data.files) ? event.data.files.length : 0, "site =", event.data.site?.id);
      diagnosticLog("inject.message", "paste-files-received", {
        site: event.data.site,
        requestId,
        fileCount: Array.isArray(event.data.files) ? event.data.files.length : 0,
      });
      
      
      
      
      if (isShellDocument()) {
        
        
        
        
        
        
        void (async () => {
          const deadline = Date.now() + 15000;
          let forwardedOnce = false;
          const pasteResultArrived = () =>
            new Promise((resolve) => {
              const onResult = (evt) => {
                const d = evt.data;
                if (d && d.type === MSG.PASTE_RESULT && d.requestId === requestId) {
                  window.removeEventListener("message", onResult);
                  resolve(true);
                }
              };
              window.addEventListener("message", onResult);
              setTimeout(() => {
                window.removeEventListener("message", onResult);
                resolve(false);
              }, 800);
            });
          while (Date.now() < deadline) {
            const target = findNestedTargetFrame();
            if (target?.contentWindow) {
              if (!forwardedOnce) {
                forwardedOnce = true;
                diagnosticLog("inject.message", "shell-forward-paste-files", {
                  site: event.data.site,
                  requestId,
                });
              }
              target.contentWindow.postMessage(event.data, "*");
              
              const arrived = await pasteResultArrived();
              if (arrived) return;
            } else {
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
          }
          console.error("[XuSearch inject] 壳转发失败：落地页 15s 内未回执, site =", event.data.site?.id);
          diagnosticLog("inject.message", "shell-forward-no-ack", {
            site: event.data.site,
            requestId,
          });
          notifyParentFrame({
            ok: false,
            siteId: event.data.site?.id,
            requestId,
            type: MSG.PASTE_RESULT,
            error: "站点落地页尚未就绪，无法投递附件",
            uploadError: true,
          });
        })();
        return;
      }
      
      if (isPasteRequestSeen(requestId)) {
        traceLog("[XuSearch inject] PASTE_FILES duplicate ignored, requestId =", requestId);
        return;
      }
      handleFilesPasteRequest(event.data)
        .then((result) => {
          notifyParentFrame({ ...result, requestId, type: MSG.PASTE_RESULT });
        })
        .catch((error) => {
          notifyParentFrame({
            ok: false,
            siteId: event.data.site?.id,
            requestId,
            type: MSG.PASTE_RESULT,
            error: error.message,
          });
        });
      return;
    }

    if (event.data.type === MSG.RUN_UPLOAD_HANDLER) {
      
      const requestId = event.data.requestId;
      const steps = Array.isArray(event.data.steps) ? event.data.steps : [];
      traceLog("[XuSearch inject] RUN_UPLOAD_HANDLER received, requestId =", requestId, "stepsCount =", steps.length, "site =", event.data.site?.id);
      diagnosticLog("inject.message", "upload-handler-received", {
        site: event.data.site,
        requestId,
        stepCount: steps.length,
      });
      handleUploadHandlerRequest({ steps, site: event.data.site })
        .then((result) => {
          notifyParentFrame({ ...result, requestId, type: MSG.UPLOAD_HANDLER_RESULT });
        })
        .catch((error) => {
          notifyParentFrame({
            ok: false,
            siteId: event.data.site?.id,
            requestId,
            type: MSG.UPLOAD_HANDLER_RESULT,
            error: error.message,
          });
        });
      return;
    }

    if (event.data.type === MSG.SIDEBAR_HANDLER) {
      
      const requestId = event.data.requestId;
      const steps = Array.isArray(event.data.steps) ? event.data.steps : [];
      traceLog("[XuSearch inject] SIDEBAR_HANDLER received, requestId =", requestId, "stepsCount =", steps.length, "site =", event.data.site?.id);
      diagnosticLog("inject.message", "sidebar-handler-received", {
        site: event.data.site,
        requestId,
        stepCount: steps.length,
      });
      handleSidebarHandlerRequest({ steps, site: event.data.site })
        .then((result) => {
          notifyParentFrame({ ...result, requestId, type: MSG.SIDEBAR_HANDLER_RESULT });
        })
        .catch((error) => {
          notifyParentFrame({
            ok: false,
            siteId: event.data.site?.id,
            requestId,
            type: MSG.SIDEBAR_HANDLER_RESULT,
            error: error.message,
          });
        });
      return;
    }

    if (event.data.type !== MSG.SEARCH) return;

    
    
    
    if (isShellDocument()) {
      const target = findNestedTargetFrame();
      if (target?.contentWindow) {
        diagnosticLog("inject.message", "shell-forward-search", {
          site: event.data.site,
          requestId: event.data.requestId,
        });
        target.contentWindow.postMessage(event.data, "*");
      }
      return;
    }

    const requestId = event.data.requestId;
    diagnosticLog("inject.message", "search-received", {
      site: event.data.site,
      requestId,
      query: event.data.query,
    });
    const cachedResult = requestId ? getCachedRequestResult(requestId) : null;
    if (cachedResult) {
      diagnosticLog("inject.message", "return-cached-result", { requestId, site: event.data.site });
      notifyParentFrame(cachedResult);
      return;
    }
    if (requestId && requestsInProgress.has(requestId)) {
      diagnosticLog("inject.message", "duplicate-in-progress", { requestId, site: event.data.site });
      return;
    }
    if (requestId) requestsInProgress.add(requestId);

    handleSearchRequest(event.data)
      .then((result) => {
        if (requestId) {
          requestsInProgress.delete(requestId);
        }
        const finalResult = { ...result, requestId };
        if (result.ok) {
          if (requestId) storeRequestResult(requestId, finalResult);
          notifyParentFrame(finalResult);
          return;
        }
        
        if (
          result.errorCode === HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED
          || result.errorCode === HANDLER_ERROR_CODE.FATAL
        ) {
          notifyParentFrame(finalResult);
        }
        
      })
      .catch((_error) => {
        
        if (requestId) {
          requestsInProgress.delete(requestId);
        }
      });
  });
}

function getCachedRequestResult(requestId) {
  pruneRequestResults();
  return requestResults.get(requestId)?.result || null;
}

function storeRequestResult(requestId, result) {
  requestResults.set(requestId, {
    result,
    storedAt: Date.now()
  });
  pruneRequestResults();
}

function pruneRequestResults() {
  const now = Date.now();
  for (const [requestId, entry] of requestResults) {
    if (!entry || now - entry.storedAt > REQUEST_RESULT_TTL_MS) {
      requestResults.delete(requestId);
    }
  }

  while (requestResults.size > REQUEST_RESULT_MAX) {
    const oldestKey = requestResults.keys().next().value;
    if (!oldestKey) break;
    requestResults.delete(oldestKey);
  }
}

export function initInjectScript() {
  traceLog("[XuSearch inject] initInjectScript 已注入, hostname=", window.location.hostname, "parent同源=", window.parent !== window);
  const isGrokFrame = window.parent !== window && /(^|\.)grok\.com$/i.test(window.location.hostname);
  
  
  
  setupAutofocusGuard();
  
  installNestedFrameProxy();
  if (!isGrokFrame) {
    setupUrlReporting();
  }
  installRuntimeMessageListener();
  installWindowMessageListener();
  initSelectionToolbar();
  initInputPromptLauncher();
}
