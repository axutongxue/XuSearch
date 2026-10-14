


export function getGroupSiteObjects(group, allSites) {
  const ids = Array.isArray(group?.siteIds) ? group.siteIds : [];
  const index = new Map((allSites || []).map((s) => [s.id, s]));
  return ids
    .map((id) => index.get(id))
    .filter(
      (site) =>
        site &&
        site.enabled !== false &&
        site.supportIframe !== false &&
        
        
        site.uploadSupported === true
    );
}
