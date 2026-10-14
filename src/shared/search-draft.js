import { SEARCH_DRAFT_STORAGE_KEY } from "./storage-keys.js";



const SAVE_DEBOUNCE_MS = 300;
let pendingValue = null; 
let debounceTimer = null;

async function writeDraft(value) {
  try {
    if (value) {
      await chrome.storage.local.set({ [SEARCH_DRAFT_STORAGE_KEY]: value });
    } else {
      await chrome.storage.local.remove(SEARCH_DRAFT_STORAGE_KEY);
    }
  } catch (_e) {
    
  }
}

export function saveSearchDraft(text) {
  pendingValue = String(text ?? "").trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const value = pendingValue;
    pendingValue = null;
    writeDraft(value);
  }, SAVE_DEBOUNCE_MS);
}



export function flushSearchDraft() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pendingValue === null) return;
  const value = pendingValue;
  pendingValue = null;
  writeDraft(value);
}


if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSearchDraft);
}

export async function loadSearchDraft() {
  try {
    const data = await chrome.storage.local.get(SEARCH_DRAFT_STORAGE_KEY);
    return typeof data[SEARCH_DRAFT_STORAGE_KEY] === "string"
      ? data[SEARCH_DRAFT_STORAGE_KEY]
      : "";
  } catch (_e) {
    return "";
  }
}

export async function clearSearchDraft() {
  
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingValue = null;
  try {
    await chrome.storage.local.remove(SEARCH_DRAFT_STORAGE_KEY);
  } catch (_e) {
    
  }
}
