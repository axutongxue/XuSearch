

import { SITE_ICON_PLACEHOLDER_KEYS_STORAGE_KEY } from "../../shared/storage-keys.js";

import { resolveSiteLogo } from "./site-logo.js";


import builtinSiteIcons from "../../config/builtinGroups.icons.js";


const FAVICON_SIZE = 32;


const KNOWN_PLACEHOLDER_KEYS = [`${601}:0x${(0x532434a2).toString(16)}`];


const iconCache = new Map();


function fnv1a(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}


function iconKey(bytes) {
  return `${bytes.byteLength}:0x${(fnv1a(bytes) >>> 0).toString(16)}`;
}


let placeholderKeys = new Set(KNOWN_PLACEHOLDER_KEYS);
let placeholderKeysLoading = null;


function loadPlaceholderKeys() {
  if (!placeholderKeysLoading) {
    placeholderKeysLoading = (async () => {
      try {
        const stored = await globalThis.chrome?.storage?.local?.get([
          SITE_ICON_PLACEHOLDER_KEYS_STORAGE_KEY,
        ]);
        const saved = stored?.[SITE_ICON_PLACEHOLDER_KEYS_STORAGE_KEY];
        if (Array.isArray(saved) && saved.length) {
          placeholderKeys = new Set([...KNOWN_PLACEHOLDER_KEYS, ...saved]);
        }
      } catch {
        
      }
      return placeholderKeys;
    })();
  }
  return placeholderKeysLoading;
}


export async function rememberPlaceholderIcon(bytes) {
  if (!bytes?.byteLength) return false;
  const keys = await loadPlaceholderKeys();
  const key = iconKey(bytes);
  if (keys.has(key)) return false;
  keys.add(key);
  try {
    await globalThis.chrome?.storage?.local?.set({
      [SITE_ICON_PLACEHOLDER_KEYS_STORAGE_KEY]: [...keys].filter((k) => !KNOWN_PLACEHOLDER_KEYS.includes(k)),
    });
  } catch {
    
  }
  return true;
}


async function isPlaceholderBytes(bytes) {
  const keys = await loadPlaceholderKeys();
  return keys.has(iconKey(bytes));
}


export async function isPlaceholderCalibrated() {
  return (await loadPlaceholderKeys()).size > KNOWN_PLACEHOLDER_KEYS.length;
}


function looksLikeImage(b) {
  return (
    (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || 
    (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) || 
    (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) || 
    (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) || 
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) 
  );
}


export function pageUrlForSite(site) {
  const raw = site?.url || (Array.isArray(site?.matchPatterns) ? site.matchPatterns[0] : "");
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
  } catch {
    return null;
  }
}


export function faviconUrlFor(pageUrl, size = FAVICON_SIZE) {
  const getURL = globalThis.chrome?.runtime?.getURL;
  if (typeof getURL !== "function" || !pageUrl) return null;
  try {
    const url = new URL(getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", String(size));
    return url.toString();
  } catch {
    return null;
  }
}


export async function fetchIconBytes(pageUrl) {
  const src = faviconUrlFor(pageUrl);
  if (!src) return null;
  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    
    return null;
  }
}


export async function isUsableIconBytes(bytes) {
  if (!bytes?.byteLength || !looksLikeImage(bytes)) return false;
  if (await isPlaceholderBytes(bytes)) return false;
  return true;
}


export function resolveSiteIcon(pageUrl) {
  if (!pageUrl) return Promise.resolve(null);
  const cached = iconCache.get(pageUrl);
  if (cached) return cached;

  const task = (async () => {
    const bytes = await fetchIconBytes(pageUrl);
    if (!(await isUsableIconBytes(bytes))) return null;
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  })();

  iconCache.set(pageUrl, task);
  return task;
}


export async function checkSiteIconAvailable(pageUrl) {
  return isUsableIconBytes(await fetchIconBytes(pageUrl));
}


export function clearSiteIconCache(pageUrls) {
  if (!pageUrls) {
    iconCache.clear();
    return;
  }
  for (const url of pageUrls) {
    iconCache.delete(url);
  }
}



export function bundledIconDataUrlForSite(site) {
  return builtinSiteIcons?.icons?.[site?.id] || null;
}


function applyDataUrlIcon(avatarEl, dataUrl) {
  const img = document.createElement("img");
  img.className = "site-avatar-img";
  img.alt = "";
  img.decoding = "async";
  img.addEventListener(
    "load",
    () => {
      if (!avatarEl.isConnected) return;
      avatarEl.textContent = "";
      avatarEl.classList.add("has-icon");
      avatarEl.appendChild(img);
    },
    { once: true },
  );
  img.src = dataUrl;
}

export function decorateSiteAvatar(avatarEl, site) {
  if (!avatarEl) return;

  
  
  
  
  if (site?.logoUrl) {
    resolveSiteLogo(site)
      .then((dataUrl) => {
        if (!dataUrl) return;
        applyDataUrlIcon(avatarEl, dataUrl);
      })
      .catch(() => {});
    return;
  }

  
  const bundled = bundledIconDataUrlForSite(site);
  if (bundled) {
    applyDataUrlIcon(avatarEl, bundled);
    return;
  }

  
  const pageUrl = pageUrlForSite(site);
  if (!pageUrl) return;

  resolveSiteIcon(pageUrl)
    .then((iconUrl) => {
      if (!iconUrl || !avatarEl.isConnected) return;
      const img = document.createElement("img");
      img.className = "site-avatar-img";
      img.alt = "";
      img.decoding = "async";
      
      img.addEventListener(
        "load",
        () => {
          if (!avatarEl.isConnected) return;
          avatarEl.textContent = "";
          avatarEl.classList.add("has-icon");
          avatarEl.appendChild(img);
        },
        { once: true },
      );
      img.src = iconUrl;
    })
    .catch(() => {});
}
