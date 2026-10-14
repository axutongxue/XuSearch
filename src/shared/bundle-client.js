
import { traceLog } from "./diagnostics.js";
import {
  parseSignedConfig,
  checkConfigVersion,
  getExtensionVersion,
  isConfigExpired,
} from "./signed-config.js";
import { BACKEND_BASE_URL, BACKEND_TIMEOUT_MS, IS_LOCAL_BACKEND } from "./backend-config.js";
import {
  SIGNED_CONFIGS_STORAGE_KEY,
  DEVICE_TOKEN_STORAGE_KEY,
  BUNDLE_LAST_CHECK_KEY,
  BUNDLE_LAST_SUCCESS_KEY,
  BUNDLE_COOLDOWN_KEY,
  CHANGELOG_CACHE_KEY,
} from "./storage-keys.js";
import { withStorageLock } from "./storage-lock.js";
import { mergeBundleGroups, sweepMemberGroups, BUNDLE_PRODUCT_ID } from "./config-merge.js";
import { invalidateBuiltinCache } from "./site-registry.js";
import { isMemberForbidden, markMemberForbidden, clearMemberForbidden, isMemberDead } from "./member-flag.js";


const CHECK_THROTTLE_MS = 6 * 3600 * 1000;

const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

const CHANGELOG_CACHE_MS = 6 * 3600 * 1000;


function sessionArea() {
  return chrome.storage.session || chrome.storage.local;
}

async function getLastCheck() {
  try {
    const store = await sessionArea().get([BUNDLE_LAST_CHECK_KEY]);
    return Number(store?.[BUNDLE_LAST_CHECK_KEY]) || 0;
  } catch (_err) {
    return 0;
  }
}

async function markChecked() {
  try {
    await sessionArea().set({ [BUNDLE_LAST_CHECK_KEY]: Date.now() });
  } catch (_err) {
    
  }
}

async function markSuccess() {
  try {
    await chrome.storage.local.set({ [BUNDLE_LAST_SUCCESS_KEY]: Date.now() });
  } catch (_err) {
    
  }
}


async function getCooldownUntil() {
  try {
    const store = await chrome.storage.local.get([BUNDLE_COOLDOWN_KEY]);
    return Number(store?.[BUNDLE_COOLDOWN_KEY]) || 0;
  } catch (_err) {
    return 0;
  }
}


async function markCooldown() {
  try {
    await chrome.storage.local.set({
      [BUNDLE_COOLDOWN_KEY]: Date.now() + RATE_LIMIT_COOLDOWN_MS,
    });
  } catch (_err) {
    
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = BACKEND_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}


async function loadLocalBundle() {
  try {
    const store = await chrome.storage.local.get([SIGNED_CONFIGS_STORAGE_KEY]);
    const entry = store?.[SIGNED_CONFIGS_STORAGE_KEY]?.[BUNDLE_PRODUCT_ID];
    return {
      config: entry?.config || null,
      version: Number(entry?.version) || 0,
    };
  } catch (_err) {
    return { config: null, version: 0 };
  }
}


function bundleContentSignature(config) {
  const sites = Array.isArray(config?.sites)
    ? config.sites.map((s) => s?.id).filter(Boolean).sort()
    : [];
  const groups = Array.isArray(config?.groups)
    ? config.groups.map((g) => `${g?.id}:${(Array.isArray(g?.siteIds) ? g.siteIds : []).join(",")}`).sort()
    : [];
  return JSON.stringify([sites, groups]);
}


async function persistBundle({ prevConfig, nextConfig }) {
  
  try {
    await mergeBundleGroups({ prevConfig, nextConfig });
  } catch (err) {
    console.warn("[bundle] 组合并失败（不阻塞包写入）", err);
  }

  await withStorageLock("signedConfigs", async () => {
    const store = await chrome.storage.local.get([SIGNED_CONFIGS_STORAGE_KEY]);
    const signedConfigs = store?.[SIGNED_CONFIGS_STORAGE_KEY] || {};
    signedConfigs[BUNDLE_PRODUCT_ID] = { version: nextConfig.version, config: nextConfig };
    await chrome.storage.local.set({ [SIGNED_CONFIGS_STORAGE_KEY]: signedConfigs });
  });

  try {
    invalidateBuiltinCache();
  } catch (_err) {
    
  }

  
  
  try {
    await chrome.storage.local.remove(CHANGELOG_CACHE_KEY);
  } catch (_err) {
    
  }
}


async function reconcileGroupsFromLocalBundle(config) {
  try {
    if (!config || !Array.isArray(config.groups) || !config.groups.length) return 0;
    const { changed } = await mergeBundleGroups({
      prevConfig: config,
      nextConfig: config,
      skipMemberGroupCreates: true,
    });
    const created = Array.isArray(changed) ? changed.length : 0;
    if (created) traceLog(`[bundle] 本地组对账：补齐 ${created} 个非会员组`);
    return created;
  } catch (err) {
    console.warn("[bundle] 本地组对账失败（不阻塞）", err);
    return 0;
  }
}


let inFlightEnsure = null;

export function ensureBundle(options = {}) {
  if (inFlightEnsure) {
    return options.force
      ? inFlightEnsure.then(() => runEnsureBundle(options))
      : inFlightEnsure;
  }
  inFlightEnsure = runEnsureBundle(options).finally(() => {
    inFlightEnsure = null;
  });
  return inFlightEnsure;
}



export function negotiateBundleVersion(local, expired) {
  if (expired) return 0;
  return Number(local?.version) || 0;
}

async function runEnsureBundle({ force = false, forceFullDownload = false, trigger = "entry" } = {}) {
  const out = { ok: false, status: "skipped", trigger };

  let token = null;
  let local = { config: null, version: 0 };
  try {
    const store = await chrome.storage.local.get([DEVICE_TOKEN_STORAGE_KEY]);
    token = store?.[DEVICE_TOKEN_STORAGE_KEY] || null;
    local = await loadLocalBundle();
  } catch (err) {
    out.status = "storage_error";
    out.error = err?.message;
    return out;
  }

  
  if (!token) {
    out.status = "not_activated";
    return out;
  }


  
  let expired = false;
  try {
    expired = await isConfigExpired(local.config);
  } catch (_err) {
    
  }

  
  
  
  
  if (local.config && !expired && !(await isMemberForbidden())) {
    out.groupsReconciled = await reconcileGroupsFromLocalBundle(local.config);
  }

  
  
  if (expired) {
    await sweepMemberGroups().catch(() => {});
  }

  if (!force && !expired && !IS_LOCAL_BACKEND) {
    
    
    
    
    
    
    const cooldownUntil = await getCooldownUntil();
    if (Date.now() < cooldownUntil) {
      out.status = "throttled";
      return out;
    }
    const last = await getLastCheck();
    if (Date.now() - last < CHECK_THROTTLE_MS) {
      out.status = "throttled";
      return out;
    }
  }

  let resp;
  try {
    
    
    
    const negotiateVersion = forceFullDownload ? 0 : negotiateBundleVersion(local, expired);
    resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/bundle?version=${encodeURIComponent(negotiateVersion)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    
    out.status = "offline";
    out.error = err?.message;
    return out;
  }

  if (resp.status === 304) {
    
    await clearMemberForbidden();
    await markChecked();
    out.status = "unchanged";
    return out;
  }
  if (resp.status === 401) {
    await markChecked();
    out.status = "unauthorized";
    return out;
  }
  if (resp.status === 403) {
    
    
    await markMemberForbidden();
    invalidateBuiltinCache();
    
    
    await sweepMemberGroups().catch(() => {});
    await markChecked();
    out.status = "subscription_expired";
    return out;
  }
  if (resp.status === 429) {
    
    
    
    if (!IS_LOCAL_BACKEND) {
      await markCooldown();
    }
    out.status = "rate_limited";
    return out;
  }
  if (!resp.ok) {
    out.status = "http_error";
    out.error = `HTTP ${resp.status}`;
    return out;
  }

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    out.status = "bad_response";
    out.error = err?.message;
    return out;
  }

  
  if (data?.unchanged) {
    
    await clearMemberForbidden();
    await markChecked();
    out.status = "unchanged";
    return out;
  }

  const parsed = await parseSignedConfig(data?.ciphertext || "");
  if (!parsed.ok) {
    out.status = "invalid_signature";
    out.error = parsed.error;
    return out;
  }

  const versionCheck = checkConfigVersion(parsed.config, local.version, getExtensionVersion());
  if (!versionCheck.ok) {
    
    if (String(versionCheck.reason || "").includes("已是最新版本")) {
      
      
      
      
      
      const prevSig = bundleContentSignature(local.config);
      const nextSig = bundleContentSignature(parsed.config);
      const hasContent = Array.isArray(parsed.config?.sites) && parsed.config.sites.length > 0;
      
      
      
      
      
      
      if (!forceFullDownload && (nextSig === prevSig || !hasContent)) {
        await markChecked();
        out.status = "unchanged";
        return out;
      }
      console.warn(
        `[bundle] 服务端内容已变化但版本号仍是 v${parsed.config.version}（未升版本）——按服务端内容覆盖。` +
          `发布新规则请务必运行 tools/publish-bundle.mjs。`,
      );
      out.content_changed_without_version_bump = true;
    } else {
      out.status = "rejected";
      out.error = versionCheck.reason;
      return out;
    }
  }

  await persistBundle({ prevConfig: local.config, nextConfig: parsed.config });
  await clearMemberForbidden();
  await markChecked();
  await markSuccess();

  out.ok = true;
  out.status = "updated";
  out.version = parsed.config.version;
  return out;
}


export async function fetchChangelog({ force = false } = {}) {
  try {
    if (!force) {
      const store = await chrome.storage.local.get([CHANGELOG_CACHE_KEY]);
      const cached = store?.[CHANGELOG_CACHE_KEY];
      if (cached?.fetchedAt && Date.now() - cached.fetchedAt < CHANGELOG_CACHE_MS) {
        return { ok: true, changelog: cached.changelog || [], cached: true };
      }
    }
    const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/changelog`);
    if (!resp.ok) return { ok: false, changelog: [] };
    const data = await resp.json();
    const changelog = Array.isArray(data?.changelog) ? data.changelog : [];
    await chrome.storage.local.set({
      [CHANGELOG_CACHE_KEY]: { fetchedAt: Date.now(), changelog },
    });
    return { ok: true, changelog };
  } catch (_err) {
    return { ok: false, changelog: [] };
  }
}


export async function isMemberActive() {
  try {
    const store = await chrome.storage.local.get([DEVICE_TOKEN_STORAGE_KEY]);
    if (!store?.[DEVICE_TOKEN_STORAGE_KEY]) return false;
    
    
    
    
    return !(await isMemberDead());
  } catch (_err) {
    return true;
  }
}


export async function getBundleStatus() {
  const store = await chrome.storage.local.get([
    SIGNED_CONFIGS_STORAGE_KEY,
    DEVICE_TOKEN_STORAGE_KEY,
  ]);
  const entry = store?.[SIGNED_CONFIGS_STORAGE_KEY]?.[BUNDLE_PRODUCT_ID];
  return {
    activated: !!store?.[DEVICE_TOKEN_STORAGE_KEY],
    version: entry?.version ?? null,
    siteCount: Array.isArray(entry?.config?.sites) ? entry.config.sites.length : 0,
    releasedAt: entry?.config?.issuedAt ?? null,
  };
}
