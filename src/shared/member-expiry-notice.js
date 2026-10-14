
import {
  SIGNED_CONFIGS_STORAGE_KEY,
  DEVICE_TOKEN_STORAGE_KEY,
  MEMBER_FORBIDDEN_KEY,
  MEMBER_EXPIRY_DISMISSED_KEY,
} from "./storage-keys.js";
import { BUNDLE_PRODUCT_ID } from "./config-merge.js";


const NOTICE_LEAD_DAYS = 7;

const DANGER_DAYS = 3;

const DISMISS_SILENCE_MS = 24 * 3600 * 1000;


export async function getMemberExpiryNotice() {
  try {
    const store = await chrome.storage.local.get([
      SIGNED_CONFIGS_STORAGE_KEY,
      DEVICE_TOKEN_STORAGE_KEY,
      MEMBER_FORBIDDEN_KEY,
      MEMBER_EXPIRY_DISMISSED_KEY,
    ]);
    if (!store?.[DEVICE_TOKEN_STORAGE_KEY]) return null;
    if (store?.[MEMBER_FORBIDDEN_KEY]) return null;
    
    const config = store?.[SIGNED_CONFIGS_STORAGE_KEY]?.[BUNDLE_PRODUCT_ID]?.config;
    const expiresAt = Number(config?.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const days = Math.ceil((expiresAt - Date.now()) / (24 * 3600 * 1000));
    if (days > NOTICE_LEAD_DAYS) return null;
    const dismissedAt = Number(store?.[MEMBER_EXPIRY_DISMISSED_KEY]) || 0;
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_SILENCE_MS) return null;
    return { days, danger: days <= DANGER_DAYS };
  } catch (_err) {
    return null;
  }
}


export async function dismissMemberExpiryNotice() {
  try {
    await chrome.storage.local.set({ [MEMBER_EXPIRY_DISMISSED_KEY]: Date.now() });
  } catch (_err) {
    
  }
}
