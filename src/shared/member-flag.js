
import {
  DEVICE_TOKEN_STORAGE_KEY,
  MEMBER_FORBIDDEN_KEY,
  MEMBER_AUTHORITATIVE_END_KEY,
  SIGNED_CONFIGS_STORAGE_KEY,
  MAX_SEEN_TIMESTAMP_KEY,
} from "./storage-keys.js";
import { isConfigExpired, EXPIRY_GRACE_MS } from "./signed-config.js";

export async function isMemberForbidden() {
  try {
    const stored = await chrome.storage.local.get([MEMBER_FORBIDDEN_KEY]);
    return Number(stored[MEMBER_FORBIDDEN_KEY]) > 0;
  } catch (_err) {
    return false;
  }
}

export async function markMemberForbidden() {
  try {
    await chrome.storage.local.set({ [MEMBER_FORBIDDEN_KEY]: Date.now() });
  } catch (_err) {
    
  }
}

export async function clearMemberForbidden() {
  try {
    await chrome.storage.local.remove(MEMBER_FORBIDDEN_KEY);
  } catch (_err) {
    
  }
}




const MEMBER_PRODUCT_ID = "member";


export async function isMemberDead() {
  try {
    const stored = await chrome.storage.local.get([
      DEVICE_TOKEN_STORAGE_KEY,
      MEMBER_FORBIDDEN_KEY,
      SIGNED_CONFIGS_STORAGE_KEY,
      MEMBER_AUTHORITATIVE_END_KEY,
    ]);
    if (!stored[DEVICE_TOKEN_STORAGE_KEY]) return false;
    if (Number(stored[MEMBER_FORBIDDEN_KEY]) > 0) return true;
    
    const auth = stored[MEMBER_AUTHORITATIVE_END_KEY];
    if (auth && typeof auth === "object") {
      if (auth.subscriptionEnd == null) return false; 
      return isTimestampExpired(Number(auth.subscriptionEnd));
    }
    const config = stored[SIGNED_CONFIGS_STORAGE_KEY]?.[MEMBER_PRODUCT_ID]?.config;
    return config ? await isConfigExpired(config) : false;
  } catch (_err) {
    return false;
  }
}


export async function markAuthoritativeEnd(subscriptionEnd) {
  try {
    await chrome.storage.local.set({
      [MEMBER_AUTHORITATIVE_END_KEY]: {
        subscriptionEnd: subscriptionEnd == null ? null : Number(subscriptionEnd),
        at: Date.now(),
      },
    });
  } catch (_err) {
    
  }
}


export async function clearAuthoritativeEnd() {
  try {
    await chrome.storage.local.remove(MEMBER_AUTHORITATIVE_END_KEY);
  } catch (_err) {
    
  }
}


async function isTimestampExpired(expiresAt) {
  if (!Number.isFinite(expiresAt)) return false; 
  try {
    const stored = await chrome.storage.local.get([MAX_SEEN_TIMESTAMP_KEY]);
    const prev = Number(stored[MAX_SEEN_TIMESTAMP_KEY]) || 0;
    const now = Math.max(Date.now(), prev);
    if (now !== prev) {
      await chrome.storage.local.set({ [MAX_SEEN_TIMESTAMP_KEY]: now });
    }
    return now > expiresAt + EXPIRY_GRACE_MS;
  } catch (_err) {
    return false;
  }
}






