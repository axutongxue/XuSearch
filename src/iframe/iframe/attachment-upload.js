

import { state, elements } from "./state.js";
import { setGlobalStatus, setSiteStatus } from "./status.js";
import { ackTimeoutForSite, dispatchFilesToCard } from "./file-upload.js";
import { createRequestId } from "./utils.js";
import { diagnosticLog, traceLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";
import { UI_PREFS_STORAGE_KEY } from "../../shared/storage-keys.js";
import { startUploadTracking, finishUploadTracking } from "./upload-progress.js";
import { loadFilesFromIDB } from "../../shared/upload-files-idb.js";
import { applySidebarPolicyForDoc } from "./sidebar-control.js";

let _uploadInited = false;
let _uiPrefsCache = null;


export function isUploadPage() {
  try {
    return new URL(window.location.href).searchParams.get("upload") === "1";
  } catch (_e) {
    return false;
  }
}


export async function fetchPendingUpload() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_PENDING_FILES" });
    if (!response?.ok || !response?.upload?.siteIds?.length) return null;
    traceLog("[XuSearch compare] fetchPendingUpload: siteIds =", response.upload.siteIds.length);
    return {
      siteIds: response.upload.siteIds,
      query: response.upload.query,
      sessionId: response.upload.sessionId,
    };
  } catch (error) {
    diagnosticLog("compare.upload", "fetch-pending-failed", { error: error.message });
    return null;
  }
}


export async function initAttachmentUpload(pendingUpload) {
  traceLog("[XuSearch upload] initAttachmentUpload called, _uploadInited =", _uploadInited, "siteIds =", pendingUpload?.siteIds?.length);
  if (_uploadInited || !pendingUpload || !Array.isArray(pendingUpload.siteIds) || pendingUpload.siteIds.length === 0) {
    traceLog("[XuSearch upload] initAttachmentUpload SKIPPED");
    return;
  }
  _uploadInited = true;

  const siteIds = new Set(pendingUpload.siteIds);
  traceLog("[XuSearch upload] looking for siteIds:", [...siteIds]);
  traceLog("[XuSearch upload] cardRefs keys:", [...state.cardRefs.keys()]);
  const refs = Array.from(state.cardRefs.values())
    .filter((ref) => siteIds.has(ref.site.id) && ref.site.supportIframe !== false);
  traceLog("[XuSearch upload] matched refs:", refs.map(r => ({ id: r.site.id, loaded: r.loaded, hasIframe: !!r.iframeEl, hasCW: !!r.iframeEl?.contentWindow })));

  if (refs.length === 0) {
    setGlobalStatus("没有可用的上传目标卡片。", true);
    traceLog("[XuSearch upload] NO matching refs, aborting");
    return;
  }

  setGlobalStatus(`已加载 ${refs.length} 个站点。`);

  
  _pendingRefs = refs;

  if (pendingUpload.query && elements.queryInput) {
    elements.queryInput.value = pendingUpload.query;
  }

  
  
  const files = pendingUpload.sessionId
    ? await loadFilesFromIDB(pendingUpload.sessionId).catch(() => null)
    : null;
  if (!files) {
    setGlobalStatus("未取到中转文件，请从弹窗重新上传附件。", true);
    traceLog("[XuSearch upload] no handoff files, aborting");
    return;
  }
  traceLog("[XuSearch upload] IDB handoff files:", files.length);
  await handleFilesSelected(files);
}

async function handleFilesSelected(files) {
  traceLog("[XuSearch upload] files selected:", files.length, files.map(f => ({ name: f.name, size: f.size })));

  const refs = _pendingRefs;
  if (!refs || refs.length === 0) {
    setGlobalStatus("没有可用的上传目标卡片。", true);
    return;
  }

  
  const unsupportedRefs = refs.filter((r) => r.site.uploadSupported !== true);
  const uploadableRefs = refs.filter((r) => r.site.uploadSupported === true);
  if (unsupportedRefs.length > 0) {
    const unsupportedFailures = unsupportedRefs.map((r) => ({
      siteId: r.site.id,
      siteName: r.site.name || r.site.id,
      error: "该站点在当前搜索组下不支持附件上传",
    }));
    await closeFailedSiteCards(unsupportedFailures);
    _pendingRefs = uploadableRefs;
  }

  if (uploadableRefs.length === 0) {
    setGlobalStatus("当前搜索组下没有支持附件上传的站点。", true);
    return;
  }

  await executeUploadToAllCards(uploadableRefs, files);
}


let _pendingRefs = [];


async function executeUploadToAllCards(refs, files) {
  
  const entries = await filesToEntries(files);
  if (entries.length === 0) {
    setGlobalStatus("文件读取失败，请重试。", true);
    return;
  }

  const fileCount = entries.length;
  setGlobalStatus(`正在并行向 ${refs.length} 个站点上传 ${fileCount} 个文件...`);

  
  startUploadTracking(
    refs.map((ref) => ref.site.id),
    fileCount
  );

  const failures = [];   
  let successCount = 0;
  let queuedCount = 0;

  
  const results = await Promise.all(
    refs.map(async (ref) => {
      const outcome = await uploadFilesToCard(ref, entries);
      return { ref, outcome };
    })
  );

  for (const { ref, outcome } of results) {
    const siteName = ref.site.name || ref.site.id;
    if (outcome.accepted && !outcome.error) {
      successCount += 1;
    }
    if (outcome.queued) {
      queuedCount += 1;
    }
    if (outcome.error) {
      failures.push({ siteId: ref.site.id, siteName, error: outcome.error });
    }
  }

  _uploadInited = false;

  
  
  
  if (failures.length > 0) {
    await handleCloseFailedSites(failures, async function retryUpload() {
      const failedIds = new Set(failures.map((f) => f.siteId));
      const retryRefs = refs.filter((r) => failedIds.has(r.site.id) && state.cardRefs.has(r.site.id));
      if (retryRefs.length === 0) {
        setGlobalStatus("没有可重试的上传目标卡片。");
        return;
      }
      
      
      startUploadTracking(
        retryRefs.map((ref) => ref.site.id),
        entries.length,
        { continue: true }
      );
      const retryResults = await Promise.all(
        retryRefs.map(async (ref) => {
          const outcome = await uploadFilesToCard(ref, entries);
          return { ref, outcome };
        })
      );
      const stillFailed = [];
      let retryOk = 0;
      for (const { ref, outcome } of retryResults) {
        if (outcome.error) {
          stillFailed.push({ siteId: ref.site.id, siteName: ref.site.name || ref.site.id, error: outcome.error });
        } else if (outcome.accepted || outcome.queued) {
          retryOk += 1;
        }
      }
      if (stillFailed.length > 0) {
        
        await showUploadFailuresAndClose(stillFailed, retryUpload);
        
        const closedRetry = stillFailed.filter((f) => !state.cardRefs.has(f.siteId)).length;
        const keptRetry = stillFailed.length - closedRetry;
        finishUploadTracking({ failures: keptRetry, closed: closedRetry });
        setGlobalStatus(
          closedRetry > 0 && keptRetry === 0
            ? `重试后仍有 ${closedRetry} 个站点上传失败，卡片已关闭。`
            : `重试后仍有 ${keptRetry} 个站点上传失败（卡片已保留，可再次重试）。`,
          true
        );
      } else {
        finishUploadTracking({ failures: 0, closed: 0 });
        setGlobalStatus(`重试成功：${retryOk} 个站点已重新上传附件。`);
      }
    });
  }

  
  
  
  const closedCount = failures.filter((f) => !state.cardRefs.has(f.siteId)).length;
  const keptFailures = failures.length - closedCount;
  const remainingCount = refs.length - closedCount;

  
  finishUploadTracking({ failures: keptFailures, closed: closedCount });

  setGlobalStatus(
    `上传完成：${successCount} 个成功` +
      (queuedCount > 0 ? `，${queuedCount} 个排队中` : "") +
      (closedCount > 0 ? `，${closedCount} 个站点上传失败已关闭` : "") +
      (keptFailures > 0 ? `，${keptFailures} 个站点上传失败（卡片已保留，可重试）` : "") +
      `。请在剩余 ${remainingCount} 个卡片内确认附件后再输入问题发送。`,
    closedCount > 0 && remainingCount === 0
  );
}



async function filesToEntries(files) {
  const entries = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    try {
      entries.push({
        file,
        name: file.name || `file-${Date.now()}`,
        type: file.type || "application/octet-stream",
        size: file.size,
        lastModified: file.lastModified || Date.now(),
      });
    } catch (error) {
      diagnosticLog("compare.upload", "file-read-failed", { name: file.name, error: error.message });
    }
  }
  return entries;
}


export async function uploadFilesToCard(ref, entries) {
  traceLog("[XuSearch upload] uploadFilesToCard start, site =", ref?.site?.id, "loaded =", ref?.loaded, "hasCW =", !!ref?.iframeEl?.contentWindow);
  if (!ref || !ref.iframeEl || !Array.isArray(entries) || entries.length === 0) {
    traceLog("[XuSearch upload] uploadFilesToCard early return: missing ref/iframe/entries");
    return { accepted: false, queued: false };
  }

  
  
  if (ref.site?.uploadSupported !== true) {
    traceLog("[XuSearch upload] site not upload-supported, skipping", ref.site.id);
    setSiteStatus(ref.site.id, "该站点不支持附件上传", "error");
    return { accepted: false, queued: false, error: "该站点不支持附件上传" };
  }

  
  if (!ref.loaded || !ref.iframeEl.contentWindow) {
    traceLog("[XuSearch upload] card not loaded, waiting...");
    setSiteStatus(ref.site.id, "等待卡片加载完成以执行上传...");
    const loadOk = await waitForCardLoad(ref, 30000);
    traceLog("[XuSearch upload] waitForCardLoad result =", loadOk, "site =", ref.site.id);
    if (!loadOk) {
      setSiteStatus(ref.site.id, "卡片加载超时，跳过上传。", "error");
      return { accepted: false, queued: false };
    }
  }

  
  
  
  
  try {
    await applySidebarPolicyForDoc(ref);
  } catch (error) {
    traceLog("[XuSearch sidebar] upload-policy ERROR:", error?.message);
  }

  
  let handlerOk = true;
  if (ref.site.uploadHandler && Array.isArray(ref.site.uploadHandler.steps) && ref.site.uploadHandler.steps.length > 0) {
    traceLog("[XuSearch upload] running uploadHandler for", ref.site.id);
    handlerOk = await runUploadHandler(ref, ref.site.uploadHandler.steps);
    traceLog("[XuSearch upload] uploadHandler result =", handlerOk, "site =", ref.site.id);
  } else {
    traceLog("[XuSearch upload] no uploadHandler steps for", ref.site.id);
  }

  
  if (!handlerOk) {
    setSiteStatus(ref.site.id, "上传前置步骤失败，跳过该站点。", "error");
    traceLog("[XuSearch upload] handlerOk=false, skipping", ref.site.id);
    return { accepted: false, queued: false, error: "上传前置步骤失败" };
  }
  if (!ref.iframeEl) {
    setSiteStatus(ref.site.id, "卡片 iframe 不可用，跳过上传。", "error");
    traceLog("[XuSearch upload] iframeEl gone, skipping", ref.site.id);
    return { accepted: false, queued: false };
  }
  traceLog("[XuSearch upload] dispatching files to", ref.site.id);
  traceLog("[XuSearch upload] entries prepared:", entries.length, "first entry keys =", entries[0] ? Object.keys(entries[0]) : []);
  
  
  
  const dispatchResult = dispatchFilesToCard(ref, entries, ackTimeoutForSite(ref.site, entries.reduce((s, e) => s + (e.size || 0), 0)));
  traceLog("[XuSearch upload] dispatchFilesToCard result =", dispatchResult, "site =", ref.site.id);

  
  if (dispatchResult.queued || !dispatchResult.ackPromise) {
    return {
      accepted: dispatchResult.accepted,
      queued: dispatchResult.queued,
      error: undefined,
    };
  }

  
  const ackResult = await dispatchResult.ackPromise;
  traceLog("[XuSearch upload] ackResult for", ref.site.id, "=", ackResult);

  return {
    accepted: dispatchResult.accepted,
    queued: false,
    error: ackResult?.error,
    uploadError: !!ackResult?.uploadError || (!ackResult?.ok && !!ackResult?.error),
  };
}


function waitForCardLoad(ref, timeoutMs) {
  if (ref.iframeEl?.contentWindow && ref.loaded) return Promise.resolve(true);
  if (!ref.iframeEl) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      clearInterval(pollId);
      ref.iframeEl?.removeEventListener?.("load", onLoad);
      ref.iframeEl?.removeEventListener?.("error", onError);
      resolve(ok);
    };

    const timerId = window.setTimeout(() => finish(false), timeoutMs);

    const onLoad = () => {
      setTimeout(() => {
        if (ref.iframeEl?.contentWindow) finish(true);
      }, 100);
    };

    const onError = () => finish(false);

    const pollId = setInterval(() => {
      if (ref.loaded && ref.iframeEl?.contentWindow) finish(true);
    }, 500);

    ref.iframeEl.addEventListener("load", onLoad, { once: false });
    ref.iframeEl.addEventListener("error", onError, { once: true });
  });
}


async function runUploadHandler(ref, steps) {
  traceLog("[XuSearch upload] runUploadHandler start, site =", ref.site.id, "hasCW =", !!ref.iframeEl?.contentWindow);
  if (!ref.iframeEl?.contentWindow) {
    traceLog("[XuSearch upload] runUploadHandler: no contentWindow, returning false");
    return false;
  }

  const requestId = createRequestId();
  traceLog("[XuSearch upload] posting RUN_UPLOAD_HANDLER, requestId =", requestId, "stepsCount =", steps.length);
  const response = await new Promise((resolve) => {
    const timerId = window.setTimeout(() => {
      traceLog("[XuSearch upload] runUploadHandler TIMEOUT for", ref.site.id);
      resolve({ ok: false, error: "uploadHandler 执行超时" });
    }, 25000);

    const onMessage = (event) => {
      if (!event.data || event.data.type !== MSG.UPLOAD_HANDLER_RESULT || event.data.requestId !== requestId) {
        return;
      }
      traceLog("[XuSearch upload] received UPLOAD_HANDLER_RESULT for", ref.site.id, "ok =", event.data.ok);
      window.clearTimeout(timerId);
      window.removeEventListener("message", onMessage);
      resolve(event.data);
    };
    window.addEventListener("message", onMessage);

    try {
      ref.iframeEl.contentWindow.postMessage(
        {
          type: MSG.RUN_UPLOAD_HANDLER,
          requestId,
          steps,
          site: ref.site,
        },
        "*"
      );
      traceLog("[XuSearch upload] RUN_UPLOAD_HANDLER postMessage sent for", ref.site.id);
    } catch (error) {
      traceLog("[XuSearch upload] RUN_UPLOAD_HANDLER postMessage ERROR:", error.message);
      window.clearTimeout(timerId);
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: error.message });
    }
  });

  diagnosticLog("compare.upload", "handler-result", {
    site: ref.site.id,
    requestId,
    ok: response.ok,
    error: response.error,
  });

  return Boolean(response?.ok);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}




async function shouldAutoCloseFailedSites() {
  if (_uiPrefsCache) return _uiPrefsCache.uploadAutoCloseFailedSites === true;
  try {
    const result = await chrome.storage.local.get(UI_PREFS_STORAGE_KEY);
    _uiPrefsCache = result[UI_PREFS_STORAGE_KEY] || {};
    return _uiPrefsCache.uploadAutoCloseFailedSites === true;
  } catch (_e) {
    return false; 
  }
}


export async function handleCloseFailedSites(failures, onRetry) {
  const autoClose = await shouldAutoCloseFailedSites();
  if (autoClose) {
    await closeFailedSiteCards(failures);
  } else {
    await showUploadFailuresAndClose(failures, onRetry);
  }
}


async function closeFailedSiteCards(failures) {
  for (const f of failures) {
    const ref = state.cardRefs.get(f.siteId);
    if (!ref) continue;
    try {
      const { abortPendingWorkForSite } = await import("./send.js");
      abortPendingWorkForSite(f.siteId, { reason: "上传失败：站点不支持所选文件" });
    } catch (_error) {  }
    
    setSiteStatus(f.siteId, f.error || "上传失败", "error");
    ref.cardEl?.remove();
    state.cardRefs.delete(f.siteId);
    if (state.maximizedSiteId === f.siteId) {
      state.maximizedSiteId = null;
    }
  }
  
  try {
    const { renderCardNavStrip } = await import("./layout.js");
    const { ensureCardsNotEmpty } = await import("./utils.js");
    ensureCardsNotEmpty();
    renderCardNavStrip();
  } catch (_error) {  }
}


export async function showUploadFailuresAndClose(failures, onRetry) {
  const overlay = document.createElement("div");
  overlay.className = "xuSearch-upload-fail-overlay";
  overlay.innerHTML = `
    <div class="xuSearch-upload-fail-dialog">
      <button type="button" class="xuSearch-upload-fail-x" aria-label="关闭" title="关闭（不关闭站点）">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="xuSearch-upload-fail-title">部分站点上传失败</div>
      <div class="xuSearch-upload-fail-body">
        <p>以下 ${failures.length} 个站点无法接受您选的文件：</p>
        <ul class="xuSearch-upload-fail-list"></ul>
      </div>
      <div class="xuSearch-upload-fail-actions">
        <button type="button" class="xuSearch-upload-fail-cancel">取消</button>
        <button type="button" class="xuSearch-upload-fail-retry">重试</button>
        <button type="button" class="xuSearch-upload-fail-ok">关闭这些站点</button>
      </div>
    </div>
  `;

  const listEl = overlay.querySelector(".xuSearch-upload-fail-list");
  for (const f of failures) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="xuSearch-upload-fail-site"></span><span class="xuSearch-upload-fail-error"></span>`;
    li.querySelector(".xuSearch-upload-fail-site").textContent = f.siteName;
    li.querySelector(".xuSearch-upload-fail-error").textContent = f.error || "未知错误";
    listEl.appendChild(li);
  }

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .xuSearch-upload-fail-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .xuSearch-upload-fail-dialog {
      position: relative;
      background: #fff; border-radius: 12px; padding: 24px;
      max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    /* 🔵 2026-10-08 阿虚：右上角 ✕ 逐字对齐「搜索与提问记录」弹窗的 .export-close-btn
       （28px 灰圆底 + 15px 描边 X SVG + hover 浅红底红字），不再用文字 ✕ */
    .xuSearch-upload-fail-x {
      position: absolute; top: 14px; right: 14px;
      width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%;
      background: rgba(0,0,0,.06); color: #888;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; flex: none; line-height: 0;
    }
    .xuSearch-upload-fail-x svg { width: 15px; height: 15px; display: block; flex-shrink: 0; }
    .xuSearch-upload-fail-x:hover { background: rgba(239,68,68,.1); color: #ef4444; }
    .xuSearch-upload-fail-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a; }
    .xuSearch-upload-fail-body p { font-size: 14px; color: #555; margin: 0 0 12px; }
    .xuSearch-upload-fail-list { list-style: none; padding: 0; margin: 0 0 16px; max-height: 240px; overflow-y: auto; }
    .xuSearch-upload-fail-list li { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    .xuSearch-upload-fail-list li:last-child { border-bottom: none; }
    .xuSearch-upload-fail-site { font-weight: 600; color: #1a1a1a; margin-right: 8px; }
    .xuSearch-upload-fail-error { color: #e53e3e; }
    .xuSearch-upload-fail-actions { display: flex; justify-content: flex-end; gap: 10px; }
    /* 🔵 2026-10-08 阿虚：底部三键统一样式——「取消」「重试」= 次级蓝（.export-cancel-btn），
       「关闭这些站点」= 蓝色主按钮渐变（.export-confirm-btn）；值逐字抄自 01-overlays.css */
    .xuSearch-upload-fail-cancel,
    .xuSearch-upload-fail-retry {
      height: 34px; padding: 0 20px; border: none; border-radius: 10px;
      background: #eaf1ff; color: #0057ff;
      font-size: 14px; font-weight: 500; cursor: pointer;
      transition: background .15s ease, color .15s ease, transform .1s ease;
    }
    .xuSearch-upload-fail-cancel:hover,
    .xuSearch-upload-fail-retry:hover { background: #cfdfff; color: #0046d4; }
    .xuSearch-upload-fail-cancel:active,
    .xuSearch-upload-fail-retry:active { transform: scale(.98); background: #b9d0ff; }
    .xuSearch-upload-fail-ok {
      height: 34px; padding: 0 20px; border: none; border-radius: 10px;
      background: linear-gradient(90deg, #0057ff, #87ceeb);
      color: #fff; font-size: 14px; font-weight: 500; cursor: pointer;
      transition: background .15s ease, color .15s ease, transform .1s ease, filter .15s ease;
    }
    .xuSearch-upload-fail-ok:hover {
      background: linear-gradient(90deg, #0043cc, #6bc0e8); filter: saturate(1.12);
    }
    .xuSearch-upload-fail-ok:active {
      transform: scale(.98);
      background: linear-gradient(90deg, #0038ab, #57b3e0); filter: saturate(1.18);
    }
    /* 暗色（原实现无暗色支持，2026-10-08 一并补上；口径对齐 03-dark-panels.css 的 export 族） */
    html[data-theme="dark"] .xuSearch-upload-fail-dialog { background: #27272a; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
    html[data-theme="dark"] .xuSearch-upload-fail-x { background: rgba(255,255,255,.08); color: #71717a; }
    html[data-theme="dark"] .xuSearch-upload-fail-x:hover { background: rgba(239,68,68,.15); color: #ef4444; }
    html[data-theme="dark"] .xuSearch-upload-fail-title { color: #f4f4f5; }
    html[data-theme="dark"] .xuSearch-upload-fail-body p { color: #a1a1aa; }
    html[data-theme="dark"] .xuSearch-upload-fail-list li { border-bottom-color: rgba(255,255,255,.07); }
    html[data-theme="dark"] .xuSearch-upload-fail-site { color: #f4f4f5; }
    html[data-theme="dark"] .xuSearch-upload-fail-cancel,
    html[data-theme="dark"] .xuSearch-upload-fail-retry { background: #3f3f46; color: #e4e4e7; }
    html[data-theme="dark"] .xuSearch-upload-fail-cancel:hover,
    html[data-theme="dark"] .xuSearch-upload-fail-retry:hover { background: #52525b; color: #fff; }
  `;
  document.head.appendChild(styleEl);
  document.body.appendChild(overlay);

  const action = await new Promise((resolve) => {
    overlay.querySelector(".xuSearch-upload-fail-ok").addEventListener("click", () => resolve("close"));
    overlay.querySelector(".xuSearch-upload-fail-retry").addEventListener("click", () => resolve("retry"));
    
    overlay.querySelector(".xuSearch-upload-fail-cancel").addEventListener("click", () => resolve("dismiss"));
    overlay.querySelector(".xuSearch-upload-fail-x").addEventListener("click", () => resolve("dismiss"));
  });

  
  overlay.remove();
  styleEl.remove();

  if (action === "close") {
    await closeFailedSiteCards(failures);
  } else if (action === "retry" && typeof onRetry === "function") {
    setGlobalStatus("正在重试上传失败的文件...");
    await onRetry();
  }
  
}
