
import { DEVICE_UUID_STORAGE_KEY } from "./storage-keys.js";
import { withStorageLock } from "./storage-lock.js";

let cachedUuid = null;

function randomUuid() {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch (_err) {
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}


export async function getOrCreateDeviceUuid() {
  if (cachedUuid) return cachedUuid;
  return withStorageLock("deviceUuid", async () => {
    try {
      const stored = await chrome.storage.local.get([DEVICE_UUID_STORAGE_KEY]);
      let uuid = stored?.[DEVICE_UUID_STORAGE_KEY];
      if (!uuid) {
        uuid = randomUuid();
        await chrome.storage.local.set({ [DEVICE_UUID_STORAGE_KEY]: uuid });
      }
      cachedUuid = uuid;
      return uuid;
    } catch (_err) {
      
      cachedUuid = cachedUuid || randomUuid();
      return cachedUuid;
    }
  });
}


export async function peekDeviceUuid() {
  if (cachedUuid) return cachedUuid;
  try {
    const stored = await chrome.storage.local.get([DEVICE_UUID_STORAGE_KEY]);
    return stored?.[DEVICE_UUID_STORAGE_KEY] || null;
  } catch (_err) {
    return null;
  }
}
