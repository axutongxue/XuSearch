

import { state, elements } from "./state.js";
import { diagnosticLog } from "../../shared/diagnostics.js";

const MAX_NAMED_SITES = 3;

const DEFAULT_UPLOAD_DONE_FALLBACK_MS = 20 * 1000;


const uploadStates = new Map();

let fileCount = 0;
let totalSites = 0;
let active = false;

let retryHappened = false;

function setPlaceholder(text, hasHint = true) {
  const ta = elements.queryInput;
  if (!ta) return;
  ta.placeholder = text;
  const bar = ta.closest(".bottom-composer-bar");
  if (bar) {
    bar.classList.toggle("answer-progressing", hasHint);
  }
}

function countByState(state) {
  let n = 0;
  for (const card of uploadStates.values()) {
    if (card.state === state) n += 1;
  }
  return n;
}

function listNames(states) {
  const stateSet = new Set(Array.isArray(states) ? states : [states]);
  const names = [];
  for (const card of uploadStates.values()) {
    if (stateSet.has(card.state)) names.push(card.name);
  }
  if (names.length <= MAX_NAMED_SITES) {
    return names.join("、");
  }
  return `${names.slice(0, MAX_NAMED_SITES).join("、")} 等`;
}


function listSlowUploadingNames() {
  const now = Date.now();
  const names = [];
  for (const card of uploadStates.values()) {
    if (card.state !== "uploading") continue;
    const fallbackMs = Number.isFinite(card.doneFallbackMs)
      ? card.doneFallbackMs
      : DEFAULT_UPLOAD_DONE_FALLBACK_MS;
    if (now - card.startTime <= fallbackMs) continue;
    names.push(card.name);
  }
  if (names.length === 0) return null;
  if (names.length <= MAX_NAMED_SITES) {
    return names.join("、");
  }
  return `${names.slice(0, MAX_NAMED_SITES).join("、")} 等`;
}

function isAllFinished() {
  for (const card of uploadStates.values()) {
    if (card.state === "uploading") return false;
  }
  return true;
}

function renderPlaceholder() {
  if (!active) return;
  const done = countByState("done");
  const errors = countByState("error");
  const uploading = totalSites - done - errors;

  if (uploading === 0) return; 

  const slow = listSlowUploadingNames();
  if (slow) {
    
    setPlaceholder(`上传中 ${done}/${totalSites} · ${slow} 长时间未上传完成，请打开卡片检查`);
  } else if (uploading <= MAX_NAMED_SITES) {
    setPlaceholder(`上传中 ${done}/${totalSites} · ${listNames("uploading")} 正在上传`);
  } else {
    setPlaceholder(`上传中 ${done}/${totalSites} · 请等待各站点上传附件完毕`);
  }
}


export function startUploadTracking(siteIds, files, options = {}) {
  const ids = Array.isArray(siteIds) ? siteIds : [];
  const isContinue = options?.continue === true && totalSites > 0;

  if (!isContinue) {
    uploadStates.clear();
    totalSites = ids.length;
    retryHappened = false;
  }
  fileCount = Number(files) || fileCount;
  active = totalSites > 0;

  ids.forEach((siteId) => {
    const ref = state.cardRefs.get(siteId);
    const prev = uploadStates.get(siteId);
    uploadStates.set(siteId, {
      state: "uploading",
      startTime: Date.now(),
      doneFallbackMs: Number.isFinite(ref?.site?.uploadDoneFallbackMs)
        ? ref.site.uploadDoneFallbackMs
        : DEFAULT_UPLOAD_DONE_FALLBACK_MS,
      name: ref?.site?.name || prev?.name || siteId,
      sawNetwork: false,
    });
  });

  diagnosticLog("compare.upload-progress", "start", {
    siteIds,
    fileCount,
    totalSites,
  });

  if (active) {
    setPlaceholder(`准备上传 ${fileCount} 个附件到 ${totalSites} 个站点...`);
  }
}


export function handleUploadState(siteId, uploadState) {
  if (!active) return;
  const card = uploadStates.get(siteId);
  if (!card) return;

  const state = uploadState?.state;
  if (state === "uploading") {
    card.sawNetwork = true; 
  } else if (state === "done") {
    card.state = "done";
  } else if (state === "error") {
    card.state = "error";
  } else {
    return;
  }

  diagnosticLog("compare.upload-progress", "state", {
    siteId,
    state: card.state,
    sawNetwork: card.sawNetwork,
  });

  renderPlaceholder();
}


export function handleUploadAck(siteId, payload) {
  if (!active) return;
  const card = uploadStates.get(siteId);
  if (!card) return;

  const ok = Boolean(payload?.ok);
  const isUploadError = Boolean(payload?.uploadError);
  if (!ok || isUploadError) {
    card.state = "error";
  } else if (!card.sawNetwork) {
    card.state = "done";
  } else if (card.state === "error") {
    
    
    
    card.state = "done";
  }
  

  diagnosticLog("compare.upload-progress", "ack", {
    siteId,
    ok,
    uploadError: isUploadError,
    state: card.state,
    sawNetwork: card.sawNetwork,
  });

  renderPlaceholder();
}


export function finishUploadTracking({ failures = 0, closed = 0 } = {}) {
  if (!active) return;
  active = false;

  const keptFailures = Math.max(0, Number(failures) || 0);
  const closedCount = Math.max(0, Number(closed) || 0);
  
  
  
  
  
  
  
  const effectiveTotal = Math.max(0, totalSites - closedCount);
  const done = Math.max(0, effectiveTotal - keptFailures);

  if (keptFailures > 0) {
    
    setPlaceholder(`${done}/${effectiveTotal} 上传完成 · ${keptFailures} 个站点上传失败`);
    return;
  }
  if (closedCount > 0) {
    
    setPlaceholder(`${effectiveTotal}/${effectiveTotal} 上传完成 · ${closedCount} 个上传失败的站点已关闭`);
    return;
  }

  setPlaceholder(`附件上传完成 ${effectiveTotal}/${effectiveTotal} · 输入问题后发送即可`);
}


export function cancelUploadProgress() {
  active = false;
}


export function untrackUploadSite(siteId) {
  
  
  
  const card = uploadStates.get(siteId);
  if (!card) return;

  uploadStates.delete(siteId);
  totalSites = Math.max(0, totalSites - 1);
  diagnosticLog("compare.upload-progress", "untrack", { siteId, totalSites, wasActive: active });

  
  const stillUploading = [...uploadStates.values()].some((c) => c.state === "uploading");
  if (stillUploading) {
    active = true; 
    renderPlaceholder();
    return;
  }
  
  const errorsLeft = countByState("error");
  const doneLeft = countByState("done");
  active = false;
  if (errorsLeft > 0) {
    setPlaceholder(`${doneLeft}/${totalSites} 上传完成 · ${errorsLeft} 个站点上传失败`);
  } else {
    setPlaceholder(`附件上传完成 ${totalSites}/${totalSites} · 输入问题后发送即可`);
  }
}


export function isUploadTrackingActive() {
  return active;
}
