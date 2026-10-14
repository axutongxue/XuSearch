

















async function fetchConfigJson(file) {
  try {
    const resp = await fetch(chrome.runtime.getURL(file));
    if (!resp.ok) return null;
    return await resp.json();
  } catch (_error) {
    return null;
  }
}

let memberGroupsCache = null;


export async function loadMemberGroups() {
  if (memberGroupsCache) return memberGroupsCache;
  const payload = await fetchConfigJson("config/memberSite.json");
  memberGroupsCache = Array.isArray(payload?.groups) ? payload.groups : [];
  return memberGroupsCache;
}


export async function buildDevMemberGroupDefs() {
  const memberGroups = await loadMemberGroups();
  const byId = new Map(memberGroups.map((g) => [g.id, g]));
  const fromMemberGroups = (id) => {
    const g = byId.get(id);
    if (!g || !Array.isArray(g.siteIds) || !g.siteIds.length) return null;
    
    
    const defIds = Array.isArray(g.defaultSiteIds) && g.defaultSiteIds.length ? g.defaultSiteIds : g.siteIds;
    const out = { id, name: g.name || id, siteIds: [...defIds] };
    if (g.siteIds.length > defIds.length) out.rangeSiteIds = [...g.siteIds];
    return out;
  };

  
  return [
    fromMemberGroups("ai-online"),
    fromMemberGroups("ai-offline"),
    fromMemberGroups("ai-research"),
    fromMemberGroups("ai-domestic"),
    fromMemberGroups("ai-overseas"),
    fromMemberGroups("ai-movie-search"),
    fromMemberGroups("wangpan-quanliang"),
  ].filter(Boolean);
}
