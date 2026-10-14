













import { state, elements } from "./state.js";
import { setGlobalStatus, setSiteStatus } from "./status.js";
import { createRequestId } from "./utils.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";
import { uploadFilesToCard, handleCloseFailedSites } from "./attachment-upload.js";
import {
  attachMemberBadge,
  ensureAttachmentAnchor,
  queryMemberActive,
  removeMemberBadge,
  showMemberGateTip,
  syncMemberBadge,
} from "../../shared/member-gate-tip.js";
import { startUploadTracking, finishUploadTracking } from "./upload-progress.js";





const MAX_FILE_SIZE = 1024 * 1024 * 1024; 
const MAX_FILES_PER_PICK = 50;            



const ACK_TIMEOUT_BASE_MS = 20000;
const ACK_TIMEOUT_PER_2MB_MS = 1000;
const ACK_TIMEOUT_MAX_MS = 10 * 60 * 1000;

function ackTimeoutForTotalSize(totalBytes) {
  const dynamic = ACK_TIMEOUT_BASE_MS + Math.floor((Number(totalBytes) || 0) / (2 * 1024 * 1024)) * ACK_TIMEOUT_PER_2MB_MS;
  return Math.min(dynamic, ACK_TIMEOUT_MAX_MS);
}







const FIND_INPUT_BUDGET_MS = 4000;
const DISPATCH_GAP_MS = 1000;
const ACK_PIPELINE_MARGIN_MS = 2000;
function detectionPipelineMs(site) {
  const windowMs = Number.isFinite(site?.uploadErrorWindowMs) && site.uploadErrorWindowMs > 0
    ? site.uploadErrorWindowMs
    : 3000;
  const successWaitMs = Array.isArray(site?.uploadSuccessSelectors) && site.uploadSuccessSelectors.length > 0
    ? windowMs
    : 0;
  
  
  
  const pasteRetries = site?.uploadVia !== "file" && Number.isFinite(site?.uploadRetryMax)
    ? Math.max(0, Math.min(3, Math.floor(site.uploadRetryMax)))
    : 0;
  return (FIND_INPUT_BUDGET_MS + DISPATCH_GAP_MS + windowMs + successWaitMs + ACK_PIPELINE_MARGIN_MS) * (pasteRetries + 1);
}


export function ackTimeoutForSite(site, totalBytes) {
  return Math.max(ackTimeoutForTotalSize(totalBytes), detectionPipelineMs(site));
}


let uploadAnchor = null;

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}







async function fileToEntry(file) {
  return {
    file,
    name: file.name || `file-${Date.now()}`,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified || Date.now()
  };
}



export { ackTimeoutForTotalSize };
export function dispatchFilesToCard(ref, entries, ackTimeoutMs = ACK_TIMEOUT_BASE_MS) {
  if (!ref || !ref.iframeEl) {
    return { accepted: false, queued: false, ackPromise: null };
  }
  if (entries.length === 0) {
    return { accepted: false, queued: false, ackPromise: null };
  }

  if (!ref.loaded || !ref.iframeEl.contentWindow) {
    if (!Array.isArray(ref.pendingFilesOnLoad)) {
      ref.pendingFilesOnLoad = [];
    }
    ref.pendingFilesOnLoad.push(...entries);
    diagnosticLog("compare.files", "queued-for-load", {
      site: ref.site,
      fileCount: entries.length,
    });
    setSiteStatus(ref.site.id, "卡片尚未加载完成，文件已排队，稍后自动发送...");
    return { accepted: true, queued: true, ackPromise: null };
  }

  const requestId = createRequestId();
  const ackPromise = new Promise((resolve) => {
    const timerId = window.setTimeout(() => {
      state.pendingFileDispatches.delete(requestId);
      setSiteStatus(ref.site.id, "文件发送超时，未收到卡片确认。", "error");
      resolve({
        ok: false,
        siteId: ref.site.id,
        requestId,
        error: "文件发送超时，未收到卡片确认。"
      });
    }, ackTimeoutMs);

    state.pendingFileDispatches.set(requestId, {
      siteId: ref.site.id,
      timerId,
      resolve
    });
  });

  try {
    ref.iframeEl.contentWindow.postMessage(
      {
        type: MSG.PASTE_FILES,
        files: entries,
        site: ref.site,
        requestId,
      },
      "*"
    );
    diagnosticLog("compare.files", "post-message", {
      site: ref.site,
      requestId,
      fileCount: entries.length,
    });
    setSiteStatus(ref.site.id, "文件已发送，等待站点确认接收...");
    return { accepted: true, queued: false, ackPromise };
  } catch (error) {
    const pending = state.pendingFileDispatches.get(requestId);
    if (pending?.timerId) {
      window.clearTimeout(pending.timerId);
    }
    state.pendingFileDispatches.delete(requestId);
    diagnosticLog("compare.files", "post-message-error", {
      site: ref.site,
      error: error.message,
    });
    setSiteStatus(ref.site.id, error.message || "文件发送失败。", "error");
    return {
      accepted: false,
      queued: false,
      ackPromise: Promise.resolve({
        ok: false,
        siteId: ref.site.id,
        requestId,
        error: error.message || "文件发送失败。"
      })
    };
  }
}


export function dispatchPendingFilesForCard(ref) {
  if (!ref || !Array.isArray(ref.pendingFilesOnLoad) || ref.pendingFilesOnLoad.length === 0) {
    return;
  }
  const entries = ref.pendingFilesOnLoad;
  ref.pendingFilesOnLoad = [];
  dispatchFilesToCard(ref, entries, ackTimeoutForSite(ref.site, entries.reduce((s, e) => s + (e.size || 0), 0)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestFileList(fileList) {
  if (!fileList) return;

  
  
  
  if (!(await queryMemberActive())) {
    showMemberGateTip(uploadAnchor);
    return;
  }
  const allPicked = Array.from(fileList);
  
  
  const incoming = allPicked.slice(0, MAX_FILES_PER_PICK);
  if (allPicked.length > MAX_FILES_PER_PICK) {
    const dropped = allPicked.length - MAX_FILES_PER_PICK;
    window.alert(`单次最多处理 ${MAX_FILES_PER_PICK} 个文件，已忽略后面的 ${dropped} 个。`);
  }
  if (incoming.length === 0) return;

  const entries = [];
  const skippedOversize = [];
  for (const file of incoming) {
    if (!(file instanceof File)) continue;
    if (file.size > MAX_FILE_SIZE) {
      skippedOversize.push(file);
      continue;
    }
    try {
      entries.push(await fileToEntry(file));
    } catch (error) {
      diagnosticLog("compare.files", "read-failed", { name: file.name, error: error.message });
    }
  }
  
  if (skippedOversize.length > 0) {
    const list = skippedOversize.map((f) => `「${f.name}」${formatSize(f.size)}`).join("、");
    window.alert(`${skippedOversize.length} 个文件超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB 单文件上限，已跳过：\n${list}`);
  }

  if (entries.length === 0) return;

  
  
  
  
  
  
  const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);
  const targets = [];
  for (const ref of state.cardRefs.values()) {
    if (state.hiddenSiteIds.has(ref.site.id)) continue;
    targets.push(ref);
  }

  if (targets.length === 0) {
    setGlobalStatus("没有可发送文件的站点。", true);
    return;
  }

  setGlobalStatus(
    `准备把 ${entries.length} 个文件（${formatSize(totalSize)}）并行发送到 ${targets.length} 个 AI 卡片...`
  );

  
  startUploadTracking(
    targets.map((ref) => ref.site.id),
    entries.length
  );

  const failures = [];  
  let dispatchedCount = 0;
  let queuedCount = 0;

  
  const results = await Promise.all(
    targets.map(async (ref) => {
      const result = await uploadFilesToCard(ref, entries);
      return { ref, result };
    })
  );

  for (const { ref, result } of results) {
    if (result.accepted && !result.error) {
      dispatchedCount += 1;
    }
    if (result.queued) {
      queuedCount += 1;
    }
    if (result.error) {
      failures.push({
        siteId: ref.site.id,
        siteName: ref.site.name || ref.site.id,
        error: result.error,
      });
    }
  }

  
  if (failures.length > 0) {
    await handleCloseFailedSites(failures, async function retryUpload() {
      const failedIds = new Set(failures.map((f) => f.siteId));
      const retryTargets = targets.filter((ref) => failedIds.has(ref.site.id) && state.cardRefs.has(ref.site.id));
      if (retryTargets.length === 0) {
        setGlobalStatus("没有可重试的上传目标卡片。");
        return;
      }
      
      
      startUploadTracking(
        retryTargets.map((ref) => ref.site.id),
        entries.length,
        { continue: true }
      );
      const retryResults = await Promise.all(
        retryTargets.map(async (ref) => {
          const result = await uploadFilesToCard(ref, entries);
          return { ref, result };
        })
      );
      const stillFailed = [];
      let retryOk = 0;
      for (const { ref, result } of retryResults) {
        if (result.error) {
          stillFailed.push({ siteId: ref.site.id, siteName: ref.site.name || ref.site.id, error: result.error });
        } else if (result.accepted || result.queued) {
          retryOk += 1;
        }
      }
      if (stillFailed.length > 0) {
        const { showUploadFailuresAndClose } = await import("./attachment-upload.js");
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
  const remainingCount = targets.length - closedCount;

  
  finishUploadTracking({ failures: keptFailures, closed: closedCount });

  setGlobalStatus(
    `已开始向 ${dispatchedCount} 个 AI 卡片发送 ${entries.length} 个文件（${formatSize(totalSize)}），` +
      (queuedCount > 0
        ? `${queuedCount} 个卡片待加载后自动补发，请等待各卡片确认上传。`
        : "请等待各卡片确认上传后再提交问题。") +
      (closedCount > 0 ? ` ${closedCount} 个站点上传失败已关闭。` : "") +
      (keptFailures > 0 ? ` ${keptFailures} 个站点上传失败（卡片已保留，可重试）。` : ""),
    closedCount > 0 && remainingCount === 0
  );
}

export function bindFileUploadEvents() {
  const btn = elements.fileUploadBtn;
  const input = elements.fileUploadInput;
  const textarea = elements.queryInput;
  if (!btn || !input) return;

  
  
  
  syncMemberBadge(btn).catch(() => {});
  const anchor = ensureAttachmentAnchor(btn);
  uploadAnchor = anchor;
  btn.addEventListener("click", async () => {
    if (!(await queryMemberActive())) {
      attachMemberBadge(btn);
      showMemberGateTip(anchor);
      return;
    }
    removeMemberBadge(btn);
    input.click();
  });

  input.addEventListener("change", async () => {
    await ingestFileList(input.files);
    input.value = "";
  });

  
  if (textarea) {
    
    textarea.addEventListener("dragenter", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      event.preventDefault();
      textarea.classList.add("xuSearch-input-drag-over");
    });

    
    textarea.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    
    textarea.addEventListener("dragleave", (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
      textarea.classList.remove("xuSearch-input-drag-over");
    });

    
    
    textarea.addEventListener("drop", (event) => {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        textarea.classList.remove("xuSearch-input-drag-over");
        ingestFileList(files);
      }
    });

    
    textarea.addEventListener("paste", (event) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        ingestFileList(files);
      }
    });
  }
}



export function renderFilePreviewBar() {
  
}
