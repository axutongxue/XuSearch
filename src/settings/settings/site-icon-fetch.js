

import { state } from "./state.js";
import { loadBuiltinSites } from "../../shared/site-registry.js";
import {
  pageUrlForSite,
  checkSiteIconAvailable,
  clearSiteIconCache,
  fetchIconBytes,
  isPlaceholderCalibrated,
  rememberPlaceholderIcon,
  bundledIconDataUrlForSite,
} from "./site-icons.js";


const CONCURRENCY = 5;


const PER_SITE_TIMEOUT_MS = 15000;


const POLL_INTERVAL_MS = 600;


const BUILT_IN_ICON_GRACE_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


async function buildSiteLookup() {
  const map = new Map();
  
  for (const site of state.customSites || []) {
    if (site?.id) map.set(site.id, site);
  }
  try {
    const builtin = await loadBuiltinSites({ fallbackEmpty: true });
    for (const site of builtin || []) {
      if (site?.id && !map.has(site.id)) map.set(site.id, site);
    }
  } catch {
    
  }
  return map;
}


const liveTabIds = new Set();

let pagehideBound = false;
function bindPagehideCleanup() {
  if (pagehideBound) return;
  pagehideBound = true;
  
  
  globalThis.addEventListener?.("pagehide", () => {
    for (const tabId of liveTabIds) {
      try {
        chrome.tabs.remove(tabId);
      } catch {
        
      }
    }
    liveTabIds.clear();
  });
}


async function fetchOneIcon(pageUrl) {
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url: pageUrl, active: false });
    tabId = tab?.id ?? null;
    if (tabId != null) liveTabIds.add(tabId);

    let sawPageFavicon = false;
    let pageSettled = false;
    let settledAt = 0;
    const deadline = Date.now() + PER_SITE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const live = tabId == null ? null : await chrome.tabs.get(tabId).catch(() => null);
      if (live?.favIconUrl) sawPageFavicon = true;
      if (live?.status === "complete" && !pageSettled) {
        pageSettled = true;
        settledAt = Date.now();
      }

      
      if (bundledIconDataUrlForSite(site)) continue;
      if (!(await checkSiteIconAvailable(pageUrl))) continue;
      if (sawPageFavicon) return { ok: true };
      
      
      if (pageSettled && Date.now() - settledAt > BUILT_IN_ICON_GRACE_MS) {
        await rememberPlaceholderIcon(await fetchIconBytes(pageUrl));
        return { ok: false };
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  } finally {
    
    
    if (tabId != null) {
      liveTabIds.delete(tabId);
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        
      }
    }
  }
}

let placeholderCalibrated = false;


async function calibratePlaceholderIcon() {
  if (placeholderCalibrated) return;
  placeholderCalibrated = true;
  if (await isPlaceholderCalibrated()) return;

  let tabId = null;
  try {
    const sentinelUrl = `https://example.com/xusearch-no-icon-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const tab = await chrome.tabs.create({ url: sentinelUrl, active: false });
    tabId = tab?.id ?? null;
    if (tabId != null) liveTabIds.add(tabId);

    const deadline = Date.now() + PER_SITE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const live = await chrome.tabs.get(tabId).catch(() => null);
      if (!live) return;
      
      if (live.favIconUrl) return;
      if (live.status !== "complete") continue;
      const bytes = await fetchIconBytes(sentinelUrl);
      await rememberPlaceholderIcon(bytes);
      return;
    }
  } catch {
    
  } finally {
    if (tabId != null) {
      liveTabIds.delete(tabId);
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        
      }
    }
  }
}


export async function fetchGroupSiteIcons(siteIds, onProgress) {
  bindPagehideCleanup();

  const siteById = await buildSiteLookup();

  
  const targets = [];
  const seen = new Set();
  let unresolved = 0;
  for (const siteId of siteIds || []) {
    const site = siteById.get(siteId);
    const pageUrl = site ? pageUrlForSite(site) : null;
    if (!pageUrl) {
      unresolved += 1;
      continue;
    }
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);
    targets.push(pageUrl);
  }

  
  
  await calibratePlaceholderIcon();

  
  const pending = [];
  for (const pageUrl of targets) {
    
    if (bundledIconDataUrlForSite(site)) continue;
    if (!(await checkSiteIconAvailable(pageUrl))) pending.push(pageUrl);
  }
  const skipped = targets.length - pending.length;
  const total = pending.length;

  onProgress?.(0, total);
  if (!total) return { total: 0, skipped, ok: 0, failed: 0, unresolved };

  let done = 0;
  let ok = 0;
  const queue = [...pending];

  
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const pageUrl = queue.shift();
        if ((await fetchOneIcon(pageUrl)).ok) ok += 1;
        done += 1;
        onProgress?.(done, total);
      }
    }),
  );

  
  clearSiteIconCache(targets);

  return { total, skipped, ok, failed: total - ok, unresolved };
}
