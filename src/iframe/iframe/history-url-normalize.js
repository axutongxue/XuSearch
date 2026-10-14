

import { state } from "./state.js";

export function normalizeHistorySiteUrl(siteId, rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    
    
    const aliasSite = state.sites.find((s) => s.id === siteId);
    const aliasTarget = aliasSite?.historyUrlAliases?.[parsed.hostname.toLowerCase()];
    if (aliasTarget) {
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, `https://${aliasTarget}/`).toString();
    }

    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

export function historyUrlsEquivalent(siteId, a, b) {
  const left = normalizeHistorySiteUrl(siteId, a);
  const right = normalizeHistorySiteUrl(siteId, b);
  return Boolean(left && right && left === right);
}

export function historyUrlsLooseMatch(siteId, a, b) {
  if (historyUrlsEquivalent(siteId, a, b)) {
    return true;
  }
  const left = normalizeHistorySiteUrl(siteId, a);
  const right = normalizeHistorySiteUrl(siteId, b);
  if (!left || !right) {
    return false;
  }
  try {
    const u1 = new URL(left);
    const u2 = new URL(right);
    if (u1.origin !== u2.origin) {
      return false;
    }
    const p1 = u1.pathname.replace(/\/+$/, "") || "/";
    const p2 = u2.pathname.replace(/\/+$/, "") || "/";
    return p1 === p2;
  } catch (_error) {
    return false;
  }
}


export function isSameOriginHomepage(candidateUrl, homeUrl) {
  if (!candidateUrl || !homeUrl) {
    return false;
  }
  try {
    const home = new URL(homeUrl);
    const candidate = new URL(candidateUrl);
    if (home.origin !== candidate.origin) {
      return false;
    }
    const normalizePath = (value) => value.pathname.replace(/\/+$/, "") || "/";
    const homePath = normalizePath(home);
    const candidatePath = normalizePath(candidate);
    const pathMatches = candidatePath === homePath || candidatePath === "/";
    if (!pathMatches) {
      return false;
    }
    return candidate.search === home.search && candidate.hash === home.hash;
  } catch (_error) {
    return false;
  }
}

export function shouldKeepStoredHistoryUrl(storedUrl, candidateUrl, homeUrl, siteId = "") {
  const stored = normalizeHistorySiteUrl(siteId, storedUrl);
  const candidate = normalizeHistorySiteUrl(siteId, candidateUrl);
  if (!stored || !candidate) {
    return false;
  }
  if (stored === candidate) {
    return true;
  }
  return isSameOriginHomepage(candidate, homeUrl)
    && !isSameOriginHomepage(stored, homeUrl);
}
