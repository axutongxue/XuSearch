
import {
  SEARCH_GROUPS_STORAGE_KEY,
  REMOVED_GROUPS_STORAGE_KEY,
  BUNDLE_UPDATE_SUMMARY_KEY,
} from "./storage-keys.js";
import { withStorageLock } from "./storage-lock.js";


export const BUNDLE_PRODUCT_ID = "member";


export function threeWaySiteIds({ prevIds = [], nextIds = [], userIds = [] }) {
  const prevSet = new Set(prevIds);
  const nextSet = new Set(nextIds);

  const added = nextIds.filter((id) => !prevSet.has(id));
  const removed = prevIds.filter((id) => !nextSet.has(id));

  
  const removedSet = new Set(removed);
  const result = userIds.filter((id) => !removedSet.has(id));
  const resultSet = new Set(result);

  
  for (const id of added) {
    if (!resultSet.has(id)) {
      result.push(id);
      resultSet.add(id);
    }
  }

  return { siteIds: result, added, removed };
}


export function mergeGroups({ prevGroups = [], nextGroups = [], userGroups = [], userRemovedIds = [], now = Date.now(), skipMemberGroupCreates = false }) {
  const prevById = new Map(prevGroups.map((g) => [g?.id, g]));
  const removedByUser = new Set(
    (Array.isArray(userRemovedIds) ? userRemovedIds : []).map((id) => String(id || "")).filter(Boolean),
  );
  
  
  
  
  const result = userGroups.map((g) => ({ ...g }));
  const resultById = new Map(result.map((g) => [g?.id, g]));
  const changed = [];

  for (const next of nextGroups) {
    if (!next?.id) continue;
    const prev = prevById.get(next.id);
    const existing = resultById.get(next.id);
    const nextIds = Array.isArray(next.siteIds) ? next.siteIds : [];

    if (!existing) {
      
      if (skipMemberGroupCreates) continue;
      
      if (removedByUser.has(next.id)) continue;

      const group = {
        id: next.id,
        name: next.name || next.id,
        
        ...(next.groupTag ? { groupTag: String(next.groupTag) } : {}),
        mode: next.mode || "compare",
        enabled: next.enabled !== false,
        siteIds: [...nextIds],
        sourceProductId: BUNDLE_PRODUCT_ID,
        changedAt: now,
      };
      result.push(group);
      resultById.set(group.id, group);
      changed.push({ id: group.id, added: [...nextIds], removed: [] });
      continue;
    }

    
    const userIds = Array.isArray(existing.siteIds) ? existing.siteIds : [];
    const prevIds = Array.isArray(prev?.siteIds) ? prev.siteIds : [];
    const { siteIds: mergedIds, added, removed } = threeWaySiteIds({
      prevIds,
      nextIds,
      userIds,
    });

    if (added.length || removed.length) {
      existing.siteIds = mergedIds;
      existing.changedAt = now;
      if (!existing.sourceProductId) existing.sourceProductId = BUNDLE_PRODUCT_ID;
      changed.push({ id: next.id, added, removed });
    }

    
    
    
    
    const nextName = next.name ? String(next.name) : "";
    if (nextName && existing.name !== nextName) {
      const prevName = prev?.name ? String(prev.name) : "";
      if (!existing.name || existing.name === prevName) {
        existing.name = nextName;
        existing.changedAt = now;
        if (!existing.sourceProductId) existing.sourceProductId = BUNDLE_PRODUCT_ID;
        changed.push({ id: next.id, added: [], removed: [] });
      }
    }

    
    
    
    const nextTag = next.groupTag ? String(next.groupTag) : "";
    if (nextTag && existing.groupTag !== nextTag) {
      const prevTag = prev?.groupTag ? String(prev.groupTag) : "";
      if (!existing.groupTag || existing.groupTag === prevTag) {
        existing.groupTag = nextTag;
        existing.changedAt = now;
        if (!existing.sourceProductId) existing.sourceProductId = BUNDLE_PRODUCT_ID;
        changed.push({ id: next.id, added: [], removed: [] });
      }
    }
  }

  return { groups: result, changed };
}


export function collectRemovedSites(prevSites = [], nextSites = []) {
  const nextSet = new Set(nextSites.map((s) => s?.id));
  return prevSites.map((s) => s?.id).filter((id) => id && !nextSet.has(id));
}


export function stripRemovedSitesFromBundleGroups(groups = [], removedSiteIds = []) {
  if (!Array.isArray(groups) || !removedSiteIds.length) return groups;
  const removedSet = new Set(removedSiteIds);
  return groups.map((g) => {
    if (g?.sourceProductId !== BUNDLE_PRODUCT_ID) return g;
    const ids = Array.isArray(g.siteIds) ? g.siteIds : [];
    const filtered = ids.filter((id) => !removedSet.has(id));
    return filtered.length === ids.length ? g : { ...g, siteIds: filtered };
  });
}


function siteBrief(site) {
  return {
    id: String(site?.id || ""),
    name: String(site?.name || site?.id || ""),
    url: String(site?.url || ""),
  };
}


function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}


function siteSignature(site) {
  if (!site || typeof site !== "object") return "";
  return JSON.stringify(canonicalize(site));
}


export function diffBundleSites(prevSites = [], nextSites = []) {
  const prevById = new Map();
  for (const site of Array.isArray(prevSites) ? prevSites : []) {
    if (site?.id) prevById.set(site.id, site);
  }
  const nextById = new Map();
  for (const site of Array.isArray(nextSites) ? nextSites : []) {
    if (site?.id) nextById.set(site.id, site);
  }

  const removed = [];
  const added = [];
  const updated = [];
  for (const [id, site] of prevById) if (!nextById.has(id)) removed.push(siteBrief(site));
  for (const [id, site] of nextById) {
    if (!prevById.has(id)) added.push(siteBrief(site));
    else if (siteSignature(prevById.get(id)) !== siteSignature(site)) updated.push(siteBrief(site));
  }
  return { removed, added, updated };
}


export async function mergeBundleGroups({ prevConfig = null, nextConfig = {}, skipMemberGroupCreates = false }) {
  const prevGroups = Array.isArray(prevConfig?.groups) ? prevConfig.groups : [];
  const nextGroups = Array.isArray(nextConfig?.groups) ? nextConfig.groups : [];
  const removedSiteIds = collectRemovedSites(prevConfig?.sites || [], nextConfig?.sites || []);

  
  
  
  const prevSites = Array.isArray(prevConfig?.sites) ? prevConfig.sites : [];
  const diff = prevSites.length
    ? diffBundleSites(prevSites, Array.isArray(nextConfig?.sites) ? nextConfig.sites : [])
    : { removed: [], added: [], updated: [] };
  const hasDiff = diff.removed.length > 0 || diff.added.length > 0 || diff.updated.length > 0;

  if (!nextGroups.length && !removedSiteIds.length && !hasDiff) {
    return { changed: [], removedSiteIds: [] };
  }

  return withStorageLock("searchGroups", async () => {
    const stored = await chrome.storage.local.get([
      SEARCH_GROUPS_STORAGE_KEY,
      REMOVED_GROUPS_STORAGE_KEY,
    ]);
    const userGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY])
      ? stored[SEARCH_GROUPS_STORAGE_KEY]
      : [];
    const userRemovedIds = Array.isArray(stored[REMOVED_GROUPS_STORAGE_KEY])
      ? stored[REMOVED_GROUPS_STORAGE_KEY]
      : [];

    const { groups, changed } = mergeGroups({ prevGroups, nextGroups, userGroups, userRemovedIds, skipMemberGroupCreates });

    
    
    const finalGroups = stripRemovedSitesFromBundleGroups(groups, removedSiteIds);

    const patch = {};
    if (changed.length || removedSiteIds.length) {
      patch[SEARCH_GROUPS_STORAGE_KEY] = finalGroups;
    }
    
    
    if (hasDiff) {
      patch[BUNDLE_UPDATE_SUMMARY_KEY] = {
        version: Number(nextConfig?.version) || 0,
        at: Date.now(),
        removed: diff.removed,
        added: diff.added,
        updated: diff.updated,
      };
    }
    if (Object.keys(patch).length) {
      await chrome.storage.local.set(patch);
    }

    return { changed, removedSiteIds };
  });
}


export async function sweepMemberGroups() {
  return withStorageLock("searchGroups", async () => {
    const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
    const groups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
    const kept = groups.filter((g) => g?.sourceProductId !== BUNDLE_PRODUCT_ID);
    if (kept.length === groups.length) return [];
    await chrome.storage.local.set({ [SEARCH_GROUPS_STORAGE_KEY]: kept });
    return groups.filter((g) => g?.sourceProductId === BUNDLE_PRODUCT_ID).map((g) => g.id);
  });
}
