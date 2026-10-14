

import { state } from "./state.js";
import { createRequestId } from "./utils.js";
import { diagnosticLog, traceLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";



const SIDEBAR_CHAIN_TIMEOUT_MS = 8000;



const LAYOUT_SETTLE_MS = 400;



let lastBroadcastMode = null;


function runSidebarChain(ref, action) {
  const steps = ref.site?.sidebarHandler?.[action];
  if (!Array.isArray(steps) || steps.length === 0) {
    return Promise.resolve(false);
  }
  const contentWindow = ref.iframeEl?.contentWindow;
  if (!contentWindow) {
    return Promise.resolve(false);
  }

  const requestId = createRequestId();
  return new Promise((resolve) => {
    const timerId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      traceLog("[XuSearch sidebar] timeout, site =", ref.site.id, "action =", action);
      resolve(false);
    }, SIDEBAR_CHAIN_TIMEOUT_MS);

    const onMessage = (event) => {
      if (!event.data || event.data.type !== MSG.SIDEBAR_HANDLER_RESULT || event.data.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timerId);
      window.removeEventListener("message", onMessage);
      traceLog("[XuSearch sidebar] result, site =", ref.site.id, "action =", action, "ok =", event.data.ok, event.data.error || "");
      resolve(event.data.ok === true);
    };
    window.addEventListener("message", onMessage);

    try {
      contentWindow.postMessage({ type: MSG.SIDEBAR_HANDLER, requestId, steps, site: ref.site }, "*");
    } catch (error) {
      window.clearTimeout(timerId);
      window.removeEventListener("message", onMessage);
      traceLog("[XuSearch sidebar] postMessage ERROR:", error.message);
      resolve(false);
    }
  });
}


export async function applySidebarPolicyForDoc(ref) {
  if (!ref?.site || !state.cardRefs.has(ref.site.id)) return;
  await runSidebarChainOnce(ref, state.layoutMode === "grid" ? "close" : "open");
}


const inflightChains = new Map();
function runSidebarChainOnce(ref, action) {
  const key = `${ref?.site?.id || ""}|${action}`;
  const existing = inflightChains.get(key);
  if (existing) return existing;
  const promise = runSidebarChain(ref, action).finally(() => {
    if (inflightChains.get(key) === promise) inflightChains.delete(key);
  });
  inflightChains.set(key, promise);
  return promise;
}


export function waitForSidebarSettled(ref) {
  const siteId = ref?.site?.id;
  if (!siteId) return Promise.resolve();
  const pending = [];
  for (const [key, promise] of inflightChains) {
    if (key.startsWith(`${siteId}|`)) pending.push(promise);
  }
  return pending.length ? Promise.all(pending).then(() => undefined) : Promise.resolve();
}


export function broadcastSidebarPolicyOnLayoutChange() {
  const mode = state.layoutMode;
  if (lastBroadcastMode === mode) return;
  const prevMode = lastBroadcastMode;
  lastBroadcastMode = mode;
  
  if (!prevMode) return;

  diagnosticLog("compare.sidebar", "layout-broadcast", { mode });
  const send = () => state.cardRefs.forEach((ref) => {
    if (!ref.loaded) return;
    runSidebarChainOnce(ref, mode === "grid" ? "close" : "open");
  });
  
  
  
  
  
  if (mode === "grid") {
    send();
  } else {
    window.setTimeout(send, LAYOUT_SETTLE_MS);
  }
}
