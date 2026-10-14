
import { SITE_LOGO_CACHE_STORAGE_KEY } from "../../shared/storage-keys.js";


const FETCH_TIMEOUT_MS = 12000;


const CONCURRENCY = 6;


const MAX_EDGE = 64;


const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;


const MAX_PASSTHROUGH_BYTES = 256 * 1024;


const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
]);


const memoryCache = new Map();


let tableLoaded = false;

let logoTable = {};


function hashKey(input) {
  const str = String(input || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${str.length}:0x${h.toString(16)}`;
}


let tablePromise = null;
function ensureTable() {
  if (tableLoaded) return tableLoaded;
  if (!tablePromise) {
    tablePromise = (async () => {
      try {
        const stored = await chrome.storage.local.get([SITE_LOGO_CACHE_STORAGE_KEY]);
        const table = stored?.[SITE_LOGO_CACHE_STORAGE_KEY];
        if (table && typeof table === "object") logoTable = { ...table };
      } catch (_err) {
        
      }
      tableLoaded = true;
      return true;
    })();
  }
  return tablePromise;
}


function toDataUrl(bytes, mime) {
  
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}


async function downscaleToTarget(bytes, mime) {
  if (mime.includes("svg")) return null; 
  if (typeof createImageBitmap !== "function") return null; 
  try {
    const blob = new Blob([bytes], { type: mime });
    const probe = await createImageBitmap(blob);
    const { width, height } = probe;
    const longest = Math.max(width, height);
    if (!longest) {
      probe.close?.();
      return null;
    }
    if (longest <= MAX_EDGE) {
      
      probe.close?.();
      return null;
    }
    const scale = MAX_EDGE / longest;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    probe.close?.();

    const bmp = await createImageBitmap(blob, {
      resizeWidth: w,
      resizeHeight: h,
      resizeQuality: "high",
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return canvas.toDataURL("image/png");
  } catch (_err) {
    return null; 
  }
}


async function fetchLogoAsDataUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!resp.ok) return null;
    const mime = String(resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(mime)) return null;
    const buf = await resp.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_DOWNLOAD_BYTES) return null;
    const bytes = new Uint8Array(buf);

    
    const downscaled = await downscaleToTarget(bytes, mime);
    if (downscaled) return downscaled;

    
    if (buf.byteLength > MAX_PASSTHROUGH_BYTES) {
      console.warn(
        `[site-logo] 图标未降采样且体积过大（${Math.round(buf.byteLength / 1024)}KB > ` +
          `${MAX_PASSTHROUGH_BYTES / 1024}KB），已放弃：${url}`,
      );
      return null;
    }
    return toDataUrl(bytes, mime);
  } catch (_err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


let writeChain = Promise.resolve();
function persistLogo(key, dataUrl) {
  writeChain = writeChain.then(async () => {
    try {
      const stored = await chrome.storage.local.get([SITE_LOGO_CACHE_STORAGE_KEY]);
      const onDisk = stored?.[SITE_LOGO_CACHE_STORAGE_KEY];
      const merged = onDisk && typeof onDisk === "object" ? { ...onDisk, [key]: dataUrl } : { [key]: dataUrl };
      await chrome.storage.local.set({ [SITE_LOGO_CACHE_STORAGE_KEY]: merged });
    } catch (_err) {
      
    }
  });
  return writeChain;
}


export function resolveSiteLogo(site) {
  const url = String(site?.logoUrl || "").trim();
  if (!url) return Promise.resolve(null);
  const key = hashKey(url);

  const cached = memoryCache.get(key);
  if (cached) return cached;

  const task = (async () => {
    await ensureTable();
    const hit = logoTable[key];
    if (hit) return hit;
    const dataUrl = await fetchLogoAsDataUrl(url);
    if (dataUrl) {
      logoTable[key] = dataUrl;
      persistLogo(key, dataUrl);
    }
    return dataUrl;
  })();

  memoryCache.set(key, task);
  return task;
}


export async function warmupSiteLogos(sites = []) {
  const targets = (Array.isArray(sites) ? sites : []).filter((s) => s?.logoUrl && !memoryCache.has(hashKey(s.logoUrl)));
  if (!targets.length) return { total: 0, ok: 0, failed: 0 };

  await ensureTable();
  
  const pending = [];
  for (const site of targets) {
    const key = hashKey(site.logoUrl);
    if (logoTable[key]) continue;
    pending.push(site);
  }
  if (!pending.length) return { total: targets.length, ok: targets.length, failed: 0, cached: true };

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((site) => resolveSiteLogo(site)));
    results.forEach((r) => (r ? (ok += 1) : (failed += 1)));
  }
  return { total: targets.length, ok, failed };
}


export function clearSiteLogoCache(sites) {
  if (!sites) {
    memoryCache.clear();
    logoTable = {};
    writeChain = writeChain.then(() =>
      chrome.storage.local.remove(SITE_LOGO_CACHE_STORAGE_KEY).catch(() => {}),
    );
    return;
  }
  const list = Array.isArray(sites) ? sites : [sites];
  for (const site of list) {
    const url = String(site?.logoUrl || "").trim();
    if (!url) continue;
    const key = hashKey(url);
    memoryCache.delete(key);
    delete logoTable[key];
  }
  writeChain = writeChain.then(async () => {
    try {
      const stored = await chrome.storage.local.get([SITE_LOGO_CACHE_STORAGE_KEY]);
      const onDisk = stored?.[SITE_LOGO_CACHE_STORAGE_KEY];
      if (!onDisk || typeof onDisk !== "object") return;
      for (const site of list) {
        const url = String(site?.logoUrl || "").trim();
        if (url) delete onDisk[hashKey(url)];
      }
      await chrome.storage.local.set({ [SITE_LOGO_CACHE_STORAGE_KEY]: onDisk });
    } catch (_err) {
      
    }
  });
}
