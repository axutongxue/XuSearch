

import { state, elements } from "./state.js";
import { createRequestId } from "./utils.js";
import { MSG } from "../../shared/compare-protocol.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { cancelUploadProgress } from "./upload-progress.js";

const PROBE_INTERVAL_MS = 3000;
const PROBE_RESPONSE_TIMEOUT_MS = 2500;
const GENERATING_TIMEOUT_MS = 5 * 60 * 1000; 




const DEFAULT_SENT_DONE_FALLBACK_MS = 20 * 1000;
const MAX_NAMED_SITES = 3; 

const DEFAULT_PLACEHOLDER = "输入问题，或拖拽/粘贴文件以批量上传到所有站点";


const cardStates = new Map();
let probeTimer = null;


export function markGeneratingFromSend(siteId) {
  const card = cardStates.get(siteId);
  if (!card || card.phase !== "sent") return;
  card.phase = "generating";
  card.generatingSince = Date.now();
  diagnosticLog("compare.answer-progress", "generating-by-send-signal", { siteId });
  updatePlaceholder();
}


export function untrackSite(siteId) {
  if (!cardStates.delete(siteId)) return;
  diagnosticLog("compare.answer-progress", "untrack", { siteId });
  updatePlaceholder();
}


function resolveSite(siteId) {
  return (
    state.cardRefs.get(siteId)?.site ||
    (Array.isArray(state.sites) ? state.sites.find((s) => s?.id === siteId) : null) ||
    (Array.isArray(state.allSites) ? state.allSites.find((s) => s?.id === siteId) : null) ||
    null
  );
}


function shouldTrack(siteId) {
  const site = resolveSite(siteId);
  if (site?.supportAnswerProbe === false) return false;
  return state.cardRefs.has(siteId);
}


export function trackSite(siteId) {
  if (!shouldTrack(siteId)) return;
  const ref = state.cardRefs.get(siteId);
  const fallbackMs = Number.isFinite(ref?.site?.sentDoneFallbackMs)
    ? ref.site.sentDoneFallbackMs
    : DEFAULT_SENT_DONE_FALLBACK_MS;
  cardStates.set(siteId, {
    phase: "sent",
    startTime: Date.now(),
    generatingSince: 0,
    doneFallbackMs: fallbackMs,
    name: ref?.site?.name || siteId,
  });
  diagnosticLog("compare.answer-progress", "track-single", { siteId });
  updatePlaceholder();
  if (!probeTimer && hasActiveCards()) {
    void probeAll();
    scheduleProbe();
  }
}

export function startAnswerTracking(siteIds) {
  
  cancelUploadProgress();
  cardStates.clear();
  const now = Date.now();
  siteIds.forEach((id) => {
    
    
    
    
    
    if (!shouldTrack(id)) return;
    const ref = state.cardRefs.get(id);
    const fallbackMs = Number.isFinite(ref?.site?.sentDoneFallbackMs)
      ? ref.site.sentDoneFallbackMs
      : DEFAULT_SENT_DONE_FALLBACK_MS;
    cardStates.set(id, {
      phase: "sent",
      startTime: now,
      generatingSince: 0,
      doneFallbackMs: fallbackMs,
      name: ref?.site?.name || id,
    });
  });
  diagnosticLog("compare.answer-progress", "start", { siteIds });
  updatePlaceholder();
  
  
  void probeAll();
  scheduleProbe();
}


export async function forceProbeNow() {
  diagnosticLog("compare.answer-progress", "force-probe");
  await probeAll();
  updatePlaceholder();
}

function scheduleProbe() {
  if (probeTimer) {
    window.clearTimeout(probeTimer);
  }
  probeTimer = window.setTimeout(async () => {
    await probeAll();
    if (hasActiveCards()) {
      scheduleProbe();
    } else {
      probeTimer = null;
      updatePlaceholder();
    }
  }, PROBE_INTERVAL_MS);
}

function hasActiveCards() {
  for (const card of cardStates.values()) {
    if (card.phase === "sent" || card.phase === "generating") {
      return true;
    }
  }
  return false;
}

async function probeAll() {
  for (const [siteId, card] of cardStates) {
    if (card.phase === "done" || card.phase === "unknown" || card.phase === "timeout") {
      continue;
    }
    const ref = state.cardRefs.get(siteId);
    if (!ref?.iframeEl?.contentWindow) {
      continue;
    }
    const result = await requestProbe(ref);
    diagnosticLog("compare.answer-progress", "probe", {
      siteId,
      responded: !!result,
      detectable: result?.detectable,
      generating: result?.generating,
      done: result?.done,
    });
    if (!result) {
      continue; 
    }
    if (!result.detectable) {
      card.phase = "unknown";
      diagnosticLog("compare.answer-progress", "unknown", { siteId, reason: "no-stop-selectors" });
      continue;
    }
    if (result.done) {
      
      
      card.phase = "done";
      diagnosticLog("compare.answer-progress", "done-by-signal", { siteId });
      continue;
    }
    if (result.generating) {
      if (card.phase !== "generating") {
        card.phase = "generating";
        card.generatingSince = Date.now();
        diagnosticLog("compare.answer-progress", "generating", { siteId });
      }
      continue;
    }
    
    if (card.phase === "generating") {
      card.phase = "done";
      diagnosticLog("compare.answer-progress", "done", { siteId });
    } else if (card.phase === "sent" && Date.now() - card.startTime > card.doneFallbackMs) {
      
      card.phase = "done";
      diagnosticLog("compare.answer-progress", "sent-fallback-done", {
        siteId,
        elapsedMs: Date.now() - card.startTime,
      });
    }
  }

  
  const now = Date.now();
  for (const card of cardStates.values()) {
    if (card.phase === "generating" && now - card.generatingSince > GENERATING_TIMEOUT_MS) {
      card.phase = "timeout";
      diagnosticLog("compare.answer-progress", "timeout", { siteId: card.name });
    }
  }

  updatePlaceholder();
}

function requestProbe(ref) {
  return new Promise((resolve) => {
    const requestId = createRequestId();
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", handler);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const handler = (event) => {
      const data = event.data;
      if (!data || data.type !== MSG.ANSWER_PROBE_RESULT) return;
      if (data.requestId !== requestId) return;
      
      if (event.source !== ref.iframeEl.contentWindow) return;
      finish(data);
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, PROBE_RESPONSE_TIMEOUT_MS);

    window.addEventListener("message", handler);
    try {
      ref.iframeEl.contentWindow.postMessage(
        {
          type: MSG.ANSWER_PROBE,
          siteId: ref.site.id,
          site: ref.site,
          requestId,
        },
        "*"
      );
    } catch (_e) {
      finish(null);
    }
  });
}

function updatePlaceholder() {
  const ta = elements.queryInput;
  if (!ta) return;

  const bar = ta.closest(".bottom-composer-bar");
  let text = DEFAULT_PLACEHOLDER;
  let hasHint = false; 

  const total = cardStates.size;
  if (total > 0) {
    const done = countByPhase("done");
    const unknown = countByPhase("unknown");
    const timeout = countByPhase("timeout");
    const active = total - done - unknown - timeout;

    if (active === 0 && unknown === 0 && timeout === 0) {
      text = `全部回答完成 ${total}/${total} · 可以进行 AI 总结或者继续追问`;
      hasHint = true;
    } else if (active === 0 && unknown > 0) {
      text = `${done}/${total} 完成 · ${listNames("unknown")} 无法检测，请打开卡片确认`;
      hasHint = true;
    } else if (active === 0 && timeout > 0) {
      text = `${done}/${total} 完成 · ${listNames("timeout")} 超时未检测到回答，请检查卡片`;
      hasHint = true;
    } else {
      if (active <= MAX_NAMED_SITES) {
        
        const remaining = listNames(["sent", "generating"]);
        text = `回答中 ${done}/${total} · ${remaining} 尚未回答完成`;
      } else {
        const slow = listSlowActiveNames();
        if (slow) {
          
          text = `回答中 ${done}/${total} · ${slow} 等待时间过长，请打开卡片确认`;
        } else {
          text = `回答中 ${done}/${total} · 请等待全部站点回答完毕后再进行 AI 总结或者追问`;
        }
      }
      hasHint = true;
    }
  }

  ta.placeholder = text;
  if (bar) {
    
    
    bar.classList.toggle("answer-progressing", hasHint);
  }
}

function countByPhase(phase) {
  let n = 0;
  for (const card of cardStates.values()) {
    if (card.phase === phase) n += 1;
  }
  return n;
}

function listNames(phases) {
  const phaseSet = new Set(Array.isArray(phases) ? phases : [phases]);
  const names = [];
  for (const card of cardStates.values()) {
    if (phaseSet.has(card.phase)) names.push(card.name);
  }
  if (names.length <= MAX_NAMED_SITES) {
    return names.join("、");
  }
  return `${names.slice(0, MAX_NAMED_SITES).join("、")} 等`;
}



function listSlowActiveNames() {
  const now = Date.now();
  const names = [];
  for (const card of cardStates.values()) {
    if (card.phase !== "sent" && card.phase !== "generating") continue;
    if (now - card.startTime <= card.doneFallbackMs) continue;
    names.push(card.name);
  }
  if (names.length === 0) return null;
  if (names.length <= MAX_NAMED_SITES) {
    return names.join("、");
  }
  return `${names.slice(0, MAX_NAMED_SITES).join("、")} 等`;
}
