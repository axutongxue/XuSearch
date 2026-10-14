


export function buildSiteCatalog({
  builtinGroups = [],
  bundleGroups = [],
  devMemberGroups = [],
  validSiteIds = null,
} = {}) {
  const valid = validSiteIds == null ? null : new Set(validSiteIds);
  const seen = new Set();
  const out = [];

  const push = (group, source) => {
    const id = group?.id;
    if (!id || seen.has(id)) return;
    
    
    
    
    
    const declared = Array.isArray(group.rangeSiteIds) && group.rangeSiteIds.length
      ? group.rangeSiteIds
      : (Array.isArray(group.siteIds) ? group.siteIds : []);
    
    const siteIds = [...new Set(declared)].filter((sid) => sid && (!valid || valid.has(sid)));
    
    if (!siteIds.length) return;
    seen.add(id);
    out.push({ key: `group:${id}`, label: group.name || id, siteIds, source });
  };

  for (const group of Array.isArray(builtinGroups) ? builtinGroups : []) push(group, "builtin");
  for (const group of Array.isArray(bundleGroups) ? bundleGroups : []) push(group, "bundle");
  for (const group of Array.isArray(devMemberGroups) ? devMemberGroups : []) push(group, "dev");

  return out;
}
