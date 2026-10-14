import { state, BASE_CONFIG } from "./state.js";
import { setSiteStatus } from "./status.js";
import { renderFallback, updateLoadingOverlay } from "./cards-render.js";




export function clearIframeTimers(ref) {
  if (!ref) return;
  if (ref.loadDelayTimerId) {
    window.clearTimeout(ref.loadDelayTimerId);
    ref.loadDelayTimerId = null;
  }
  if (ref.fallbackTimerId) {
    window.clearTimeout(ref.fallbackTimerId);
    ref.fallbackTimerId = null;
  }
}









export function enqueueLoad(ref) {
  if (!ref) return;
  if (state.loadingRefs.has(ref)) return;
  if (state.loadQueue.indexOf(ref) >= 0) return;
  state.loadQueue.push(ref);
  setSiteStatus(ref.site.id, "等待加载中…");
  updateLoadingOverlay(ref, "等待加载中…");
  pumpLoadQueue();
}

export function pumpLoadQueue() {
  const max = Math.max(1, BASE_CONFIG.iframeMaxConcurrent | 0 || 3);
  const staggerMs = (BASE_CONFIG.iframeStaggerMs != null) ? BASE_CONFIG.iframeStaggerMs : 120;
  
  let batchDelay = 0;
  while (state.loadingRefs.size < max && state.loadQueue.length > 0) {
    const next = state.loadQueue.shift();
    
    if (!next || !next.iframeEl || !state.cardRefs.has(next.site.id)) {
      continue;
    }
    state.loadingRefs.add(next);
    if (batchDelay === 0) {
      beginIframeLoad(next);
    } else {
      const target = next;
      window.setTimeout(() => {
        
        if (state.loadingRefs.has(target) && target.iframeEl) {
          beginIframeLoad(target);
        }
      }, batchDelay);
    }
    batchDelay += staggerMs;
  }
}

export function releaseLoadSlot(ref) {
  if (!ref) return;
  if (state.loadingRefs.has(ref)) {
    state.loadingRefs.delete(ref);
  }
  pumpLoadQueue();
}

export function removeFromLoadQueue(ref) {
  const idx = state.loadQueue.indexOf(ref);
  if (idx >= 0) {
    state.loadQueue.splice(idx, 1);
  }
}



export function beginIframeLoad(ref) {
  const iframe = ref?.iframeEl;
  const targetSrc = ref?._targetSrc;
  if (!iframe || !targetSrc) return;
  
  iframe.src = targetSrc;
  setSiteStatus(ref.site.id, "正在加载…");
  updateLoadingOverlay(ref, "正在加载…");

  armIframeFallbackTimer(ref, iframe);
}


export function armIframeFallbackTimer(ref, iframe) {
  if (!ref || !iframe) return;
  if (ref.fallbackTimerId) {
    window.clearTimeout(ref.fallbackTimerId);
    ref.fallbackTimerId = null;
  }
  const timeoutMs = ref._retryTimeoutMs || BASE_CONFIG.embedTimeoutMs || 25000;
  ref._retryTimeoutMs = 0;
  ref.fallbackTimerId = window.setTimeout(() => {
    ref.fallbackTimerId = null;
    if (!ref._loadState?.resolved && ref.iframeEl === iframe) {
      releaseLoadSlot(ref);
      renderFallback(ref, "站点未能在限定时间内完成 iframe 加载。可能仍被目标站点限制嵌入。", { fromTimeout: true });
    }
  }, timeoutMs);
}
