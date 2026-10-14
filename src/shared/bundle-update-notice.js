
import { BUNDLE_UPDATE_SUMMARY_KEY, BUNDLE_UPDATE_SEEN_KEY } from "./storage-keys.js";


export async function readUpdateSummary() {
  try {
    const store = await chrome.storage.local.get([BUNDLE_UPDATE_SUMMARY_KEY]);
    const summary = store?.[BUNDLE_UPDATE_SUMMARY_KEY];
    return summary && typeof summary === "object" ? summary : null;
  } catch (_err) {
    return null;
  }
}


export async function readUpdateSeenVersion() {
  try {
    const store = await chrome.storage.local.get([BUNDLE_UPDATE_SEEN_KEY]);
    return Number(store?.[BUNDLE_UPDATE_SEEN_KEY]) || 0;
  } catch (_err) {
    return 0;
  }
}


export async function markUpdateSeen(version) {
  const next = Number(version) || 0;
  if (next <= 0) return;
  try {
    const seen = await readUpdateSeenVersion();
    if (next <= seen) return;
    await chrome.storage.local.set({ [BUNDLE_UPDATE_SEEN_KEY]: next });
  } catch (_err) {
    
  }
}


export function hasUpdateSummaryContent(summary) {
  if (!summary || typeof summary !== "object") return false;
  return ["removed", "added", "updated"].some(
    (key) => Array.isArray(summary[key]) && summary[key].length > 0,
  );
}


export async function isUpdateSummaryUnread(summary = null) {
  const data = summary || (await readUpdateSummary());
  if (!hasUpdateSummaryContent(data)) return false;
  const seen = await readUpdateSeenVersion();
  return Number(data.version) > seen;
}
