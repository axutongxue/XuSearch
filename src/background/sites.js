import { loadEnabledSites as loadSitesFromRegistry } from "../shared/site-registry.js";

export async function loadEnabledSites() {
  return loadSitesFromRegistry({ fallbackEmpty: false });
}

export function buildSiteUrl(site, query) {
  const url = String(site?.url || "");
  if (!url.includes("{query}")) {
    return url;
  }

  if (query && site?.supportUrlQuery) {
    return url.replace(/\{query\}/g, encodeURIComponent(query));
  }

  
  let next = url.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
  next = next.replace(/\?&/, "?");
  next = next.replace(/[?&]$/, "");
  
  return next.replace(/\{query\}/g, "");
}

export function canSearchByUrl(site) {
  return Boolean(site?.supportUrlQuery && String(site.url || "").includes("{query}"));
}

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
