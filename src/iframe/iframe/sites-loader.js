import { state } from "./state.js";
import { loadEnabledSites } from "../../shared/site-registry.js";



export async function loadSites(customSites) {
  const options = Array.isArray(customSites) ? { customSites } : {};
  const mergedSites = await loadEnabledSites(options);
  state.allSites = mergedSites;
  if (Array.isArray(state.requestedSiteIds) && state.requestedSiteIds.length > 0) {
    const siteById = new Map(mergedSites.map((site) => [site.id, site]));
    state.sites = state.requestedSiteIds
      .map((siteId) => siteById.get(siteId))
      .filter(Boolean);
  } else {
    state.sites = mergedSites;
  }
  state.hiddenSiteIds.clear();
}
