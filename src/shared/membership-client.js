
import { BACKEND_BASE_URL, IS_LOCAL_BACKEND } from "./backend-config.js";
import { DEVICE_TOKEN_STORAGE_KEY, LICENSE_CODE_MASK_KEY, LICENSE_REVOKED_KEY } from "./storage-keys.js";
import { getOrCreateDeviceUuid, peekDeviceUuid } from "./device-identity.js";
import { getMachineAttrs } from "./machine-key.js";
import { withStorageLock } from "./storage-lock.js";
import { markMemberForbidden, clearMemberForbidden, markAuthoritativeEnd } from "./member-flag.js";
import { sweepMemberGroups } from "./config-merge.js";
import { invalidateBuiltinCache } from "./site-registry.js";


const REQUEST_TIMEOUT_MS = 20000;


export function maskCode(code) {
  const parts = String(code || "").trim().split("-").filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return `${parts[0].slice(0, 4)}-****-****`;
  return `${parts[0]}-${parts[1]}-****-****`;
}

async function request(path, { method = "GET", body, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    let data = null;
    try {
      data = await resp.json();
    } catch (_err) {
      data = null;
    }
    return { ok: resp.ok, status: resp.status, data: data || {} };
  } catch (err) {
    return { ok: false, status: 0, data: {}, error: err?.message || "network_error" };
  } finally {
    clearTimeout(timer);
  }
}


export const TOKEN_FAIL = {
  
  REVOKED: "device_revoked",
  
  STALE: "stale_token",
  
  INVALID: "invalid_token",
};


async function enforceLocalRevoked() {
  try {
    await markMemberForbidden();
    invalidateBuiltinCache();
    await sweepMemberGroups();
  } catch (_err) {
    
  }
}

async function clearLocalLicense() {
  try {
    await chrome.storage.local.remove([DEVICE_TOKEN_STORAGE_KEY]);
  } catch (_err) {
    
  }
}


async function markTokenFailure({ reason = TOKEN_FAIL.INVALID, at = null, by = null, byUa = null } = {}) {
  try {
    await chrome.storage.local.set({ [LICENSE_REVOKED_KEY]: { reason, at, by, byUa } });
  } catch (_err) {
    
  }
}

async function clearTokenFailure() {
  try {
    await chrome.storage.local.remove([LICENSE_REVOKED_KEY]);
  } catch (_err) {
    
  }
}


export async function getLocalLicense() {
  try {
    const store = await chrome.storage.local.get([
      DEVICE_TOKEN_STORAGE_KEY, LICENSE_CODE_MASK_KEY, LICENSE_REVOKED_KEY,
    ]);
    return {
      activated: !!store?.[DEVICE_TOKEN_STORAGE_KEY],
      codeMask: store?.[LICENSE_CODE_MASK_KEY] || "",
      tokenFailure: store?.[LICENSE_REVOKED_KEY] || null,
    };
  } catch (_err) {
    return { activated: false, codeMask: "", tokenFailure: null };
  }
}


const inFlightActivations = new Map();


function activationKey(code) {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i += 1) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${code.length}`;
}

export function activate(code, { preflight = false } = {}) {
  const trimmed = String(code || "").trim();
  if (!trimmed) {
    return Promise.resolve({ ok: false, error: "empty_code", message: "请输入激活码" });
  }
  const key = activationKey(trimmed);
  const existing = inFlightActivations.get(key);
  if (existing) return existing;
  const run = runActivate(trimmed, { preflight }).finally(() => {
    inFlightActivations.delete(key);
  });
  inFlightActivations.set(key, run);
  return run;
}


async function runActivate(trimmed, { preflight = false } = {}) {
  const deviceUuid = await getOrCreateDeviceUuid();
  if (!deviceUuid) {
    return { ok: false, error: "no_device", message: "无法生成设备标识，请重试" };
  }

  
  
  
  const machine = await getMachineAttrs();

  const result = await request("/api/redeem", {
    method: "POST",
    body: {
      code: trimmed,
      deviceUuid,
      ua: String(navigator?.userAgent || ""),
      ...(machine ? { machine } : {}),
      ...(preflight ? { preflight: true } : {}),
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.data?.error || "request_failed",
      message: result.data?.message || "激活失败，请稍后再试",
      canForceRelease: !!result.data?.canForceRelease,
    };
  }

  
  
  
  
  
  if (result.data?.intentRequired) {
    return { ok: false, intentRequired: true };
  }

  const token = result.data?.deviceToken;
  if (!token) {
    return { ok: false, error: "bad_response", message: "服务器返回异常，请稍后再试" };
  }

  const codeMask = maskCode(trimmed);
  await withStorageLock("license", async () => {
    await chrome.storage.local.set({
      [DEVICE_TOKEN_STORAGE_KEY]: token,
      
      [LICENSE_CODE_MASK_KEY]: codeMask,
    });
  });
  
  await clearTokenFailure();
  
  
  await clearMemberForbidden();

  return {
    ok: true,
    isRenewal: !!result.data?.isRenewal,
    subscription: result.data?.subscription || null,
    codeMask,
  };
}


export async function fetchSubscriptionInfo() {
  let store = null;
  try {
    store = await chrome.storage.local.get([DEVICE_TOKEN_STORAGE_KEY, LICENSE_CODE_MASK_KEY]);
  } catch (_err) {
    return { ok: false, error: "storage_error" };
  }

  const token = store?.[DEVICE_TOKEN_STORAGE_KEY];
  if (!token) return { ok: false, error: "not_activated" };

  const result = await request("/api/subscription", { token });
  if (result.status === 401) {
    const error = result.data?.error === TOKEN_FAIL.REVOKED
      || result.data?.error === TOKEN_FAIL.STALE
      ? result.data.error
      : TOKEN_FAIL.INVALID;
    const revokedAt = Number.isFinite(Number(result.data?.revokedAt)) ? Number(result.data.revokedAt) : null;
    if (error === TOKEN_FAIL.REVOKED || error === TOKEN_FAIL.STALE) {
      
      await markTokenFailure({ reason: error, at: revokedAt, by: result.data?.revokedBy || null, byUa: result.data?.revokedByUa || null });
      await clearLocalLicense();
      await enforceLocalRevoked();
      return {
        ok: false,
        error,
        message: result.data?.message || "",
        revokedAt,
        revokedBy: result.data?.revokedBy || null,
        revokedByUa: result.data?.revokedByUa || null,
      };
    }
    if (IS_LOCAL_BACKEND) {
      
      
      
      await clearTokenFailure();
      return { ok: false, error, message: result.data?.message || "" };
    }
    
    await clearTokenFailure();
    await clearLocalLicense();
    return {
      ok: false,
      error,
      message: result.data?.message || "",
      revokedAt,
      revokedBy: result.data?.revokedBy || null,
      revokedByUa: result.data?.revokedByUa || null,
    };
  }
  if (!result.ok) {
    return { ok: false, error: result.data?.error || "request_failed" };
  }

  
  await clearTokenFailure();

  
  
  
  
  
  
  const subscription = result.data?.subscription || null;
  try {
    
    
    
    await markAuthoritativeEnd(subscription?.subscriptionEnd ?? null);
    if (subscription && subscription.active === false) {
      await markMemberForbidden();
      invalidateBuiltinCache();
      await sweepMemberGroups();
    } else if (subscription) {
      
      
      await clearMemberForbidden();
    }
  } catch (_e) {
    
  }

  return {
    ok: true,
    subscription,
    codeMask: store?.[LICENSE_CODE_MASK_KEY] || "",
    deviceUuid: await peekDeviceUuid(),
  };
}


const AUTH_REFRESH_THROTTLE_MS = 6 * 3600 * 1000;
const AUTH_REFRESH_KEY = "memberAuthRefreshedAt";


function throttleArea() {
  return chrome.storage.session || chrome.storage.local;
}


export async function refreshSubscriptionThrottled() {
  try {
    const store = await throttleArea().get([AUTH_REFRESH_KEY]);
    const last = Number(store?.[AUTH_REFRESH_KEY]) || 0;
    if (Date.now() - last < AUTH_REFRESH_THROTTLE_MS) {
      return { ok: true, skipped: true };
    }
  } catch (_err) {
    
  }
  const info = await fetchSubscriptionInfo();
  
  if (info.ok || info.error === "device_revoked" || info.error === "stale_token") {
    try {
      await throttleArea().set({ [AUTH_REFRESH_KEY]: Date.now() });
    } catch (_err) {
      
    }
  }
  return info;
}


export async function unbindDevice(code, deviceUuid) {
  const result = await request("/api/device/revoke", {
    method: "POST",
    body: { code: String(code || "").trim(), deviceUuid },
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.data?.error || "request_failed",
      message: result.data?.message || "解绑失败，请稍后再试",
    };
  }
  const local = await peekDeviceUuid();
  if (deviceUuid && local && deviceUuid === local) {
    
    
    await clearLocalLicense();
    await enforceLocalRevoked();
  }
  return { ok: true };
}


export async function unbindAllDevices(code) {
  const result = await request("/api/device/revoke-all", {
    method: "POST",
    body: { code: String(code || "").trim() },
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.data?.error || "request_failed",
      message: result.data?.message || "解绑失败，请稍后再试",
    };
  }
  await clearLocalLicense();
  
  await enforceLocalRevoked();
  return { ok: true, revokedCount: result.data?.revokedCount ?? 0 };
}


export function daysRemaining(subscription) {
  if (!subscription) return null;
  if (subscription.permanent || subscription.subscriptionEnd == null) return null;
  const diff = Number(subscription.subscriptionEnd) - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.ceil(diff / (24 * 3600 * 1000));
}


export function remainingKind(subscription, now = Date.now()) {
  if (!subscription) return null;
  if (subscription.permanent || subscription.subscriptionEnd == null) return null;
  const diff = Number(subscription.subscriptionEnd) - Number(now);
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const H = 3600 * 1000;
  if (diff < H) return { diff, unit: "ltHour", n: null };
  if (diff < 24 * H) return { diff, unit: "hour", n: Math.ceil(diff / H) };
  return { diff, unit: "day", n: Math.ceil(diff / (24 * H)) };
}
