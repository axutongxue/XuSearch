import { traceLog } from "../shared/diagnostics.js";
import {
  UI_PREFS_STORAGE_KEY,
  SEARCH_GROUPS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
  SIGNED_CONFIGS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { ensureInitialStateDefaults } from "./initial-state.js";
import { migrateBuiltinPrompts } from "../shared/builtin-prompt-migration.js";
import { openComparePage, runSearchGroup, runSelectionContextGroup, openSiteTabAndSend, buildComparePageUrl, openExternalSitesInTabs } from "./tabs.js";
import { loadEnabledSites } from "./sites.js";
import { rebuildContextMenus } from "./context-menu.js";
import { setupKeepaliveAlarm } from "./keepalive.js";
import { syncDynamicDnr } from "../shared/dynamic-dnr.js";
import { ensureBundle, isMemberActive } from "../shared/bundle-client.js";

import { clearStaleIDBFiles } from "../shared/upload-files-idb.js";


clearStaleIDBFiles();

const SETTINGS_PAGE_URL = chrome.runtime.getURL("settings/settings.html");
const POPUP_PAGE_URL = chrome.runtime.getURL("popup/popup.html");


let pendingBlankTabId = null;


let pendingUpload = null;


async function openExtensionComposerUi(windowId) {
  if (typeof chrome.action?.openPopup === "function") {
    try {
      const opts = typeof windowId === "number" ? { windowId } : undefined;
      await chrome.action.openPopup(opts);
      return;
    } catch (_e) {
      
    }
  }
  try {
    
    
    await chrome.windows.create({
      url: POPUP_PAGE_URL,
      type: "popup",
      width: 500,
      height: 680,
      focused: true,
    });
  } catch (_e) {
    try {
      await chrome.tabs.create({ url: POPUP_PAGE_URL, active: true });
    } catch (_e2) {
      
    }
  }
}

setupKeepaliveAlarm();



ensureBundle({ trigger: "sw_startup" }).catch(() => {
  
});





ensureInitialStateDefaults()
  .then(() => migrateBuiltinPrompts(chrome.runtime.getManifest().version))
  .catch(() => {
    
  });

chrome.runtime.onInstalled.addListener(async () => {
  traceLog("XuSearch - 虚空搜索 已安装");
  await ensureInitialStateDefaults();
  await migrateBuiltinPrompts(chrome.runtime.getManifest().version);
  await rebuildContextMenus();
  await syncDynamicDnr();
  
  await chrome.storage.local.remove("removedSiteNotices");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes[UI_PREFS_STORAGE_KEY]) {
    const newPrefs = changes[UI_PREFS_STORAGE_KEY].newValue;
    if (newPrefs) {
      rebuildContextMenus().catch(() => {});
    }
  }

  if (
    changes[SEARCH_GROUPS_STORAGE_KEY] ||
    changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]
  ) {
    rebuildContextMenus().catch(() => {});
  }

  
  if (changes[SIGNED_CONFIGS_STORAGE_KEY]) {
    syncDynamicDnr().catch(() => {});
  }
});



chrome.commands.onCommand.addListener(async (command) => {
  
  
  
  
  
  if (command !== "open-popup" && command !== "search-popup-hotkey") return;

  
  if (command === "search-popup-hotkey") {
    let prefs = {};
    try {
      prefs = (await chrome.storage.local.get(UI_PREFS_STORAGE_KEY))[UI_PREFS_STORAGE_KEY] || {};
    } catch (_e) {
      
    }
    if (prefs.searchPopupHotkeyEnabled === false) return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab) return;

  
  pendingBlankTabId = isBlankTabUrl(tab.url) ? tab.id : null;
  await openExtensionComposerUi(tab.windowId).catch(() => {});
});



function isBlankTabUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return true;
  if (
    /^(about:blank|chrome:\/\/newtab|edge:\/\/newtab|chrome-search:\/\/local-ntp|edge:\/\/local-ntp)/i.test(url)
  ) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return !parsed.hostname;
  } catch (_error) {
    return false;
  }
}


async function cleanupTriggerTab(sourceTabId, group, query) {
  const tabId = Number(sourceTabId) || null;
  pendingBlankTabId = null;
  if (!tabId || !group) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !isBlankTabUrl(tab.url)) return;
    if (group.mode === "compare") {
      await chrome.tabs.update(tabId, {
        url: buildComparePageUrl(query, Array.isArray(group.siteIds) ? group.siteIds : []),
        active: true,
      });
    } else {
      await chrome.tabs.remove(tabId);
    }
  } catch (_error) {
    
  }
}


async function handleUploadFiles(message, sendResponse) {
  
  
  const { group, query, siteIds, sessionId } = message;
  traceLog("[XuSearch bg] UPLOAD_FILES received", {
    group: group ? { mode: group.mode, siteIds: group.siteIds } : null,
    query: query ? String(query).slice(0, 50) : null,
    siteIdsCount: Array.isArray(siteIds) ? siteIds.length : 0,
    hasSessionId: Boolean(sessionId),
  });
  pendingUpload = {
    group,
    query: String(query || ""),
    siteIds: Array.isArray(siteIds) ? siteIds : [],
    sessionId: sessionId || null,
    createdAt: Date.now(),
  };
  traceLog("[XuSearch bg] pendingUpload stored, siteIds:", pendingUpload.siteIds.length);
  const tab = await openComparePage(pendingUpload.query, pendingUpload.siteIds, { upload: true });
  traceLog("[XuSearch bg] openComparePage returned tab:", tab && tab.id);
  try {
    await chrome.tabs.update(tab.id, { active: true });
  } catch (_error) {
    
  }
  sendResponse({ ok: true, tabId: tab.id });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "ENSURE_INITIAL_STATE_DEFAULTS") {
    ensureInitialStateDefaults()
      .then(() => migrateBuiltinPrompts(chrome.runtime.getManifest().version))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ENSURE_BUNDLE") {
    
    ensureBundle({
      force: !!message.force,
      forceFullDownload: !!message.forceFullDownload,
      trigger: message.trigger || "message",
    })
      
      
      
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, status: "error", error: error.message }));
    return true;
  }

  if (message.type === "SETTINGS_SAVED") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "OPEN_COMPARE_PAGE") {
    openComparePage(message.query)
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CHECK_MEMBER_ACTIVE") {
    
    
    isMemberActive()
      .then((active) => sendResponse({ ok: true, active }))
      .catch(() => sendResponse({ ok: false, active: true })); 
    return true;
  }

  if (message.type === "UPLOAD_FILES") {
    
    
    isMemberActive()
      .then((active) => {
        if (!active) {
          sendResponse({ ok: false, error: "member_only" });
          return;
        }
        return handleUploadFiles(message, sendResponse);
      })
      .catch((error) => {
        console.error("[XuSearch bg] UPLOAD_FILES error:", error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "GET_PENDING_FILES") {
    traceLog("[XuSearch bg] GET_PENDING_FILES received, pendingUpload exists:", Boolean(pendingUpload));
    const upload = pendingUpload;
    
    const resp = { ok: Boolean(upload && upload.siteIds && upload.siteIds.length > 0), upload };
    traceLog("[XuSearch bg] GET_PENDING_FILES responding:", {
      ok: resp.ok,
      siteIds: resp.upload && resp.upload.siteIds ? resp.upload.siteIds.length : 0,
      query: resp.upload && resp.upload.query ? resp.upload.query.slice(0, 50) : null,
    });
    sendResponse(resp);
    return true;
  }

  if (message.type === "RUN_SEARCH_GROUP") {
    
    const sourceTabId = _sender && _sender.tab && _sender.tab.id
      ? _sender.tab.id
      : pendingBlankTabId;
    pendingBlankTabId = null;
    const group = message.group;
    const query = message.query;

    (async () => {
      
      
      if (group && group.mode === "compare" && sourceTabId) {
        try {
          const tab = await chrome.tabs.get(sourceTabId);
          if (tab && isBlankTabUrl(tab.url)) {
            await chrome.tabs.update(sourceTabId, {
              url: buildComparePageUrl(query, Array.isArray(group.siteIds) ? group.siteIds : []),
              active: true,
            });
            
            
            const externalTabIds = query
              ? []
              : await openExternalSitesInTabs(Array.isArray(group.siteIds) ? group.siteIds : []);
            sendResponse({ ok: true, tabId: sourceTabId, externalTabIds, message: "已复用空白标签打开对比页" });
            return;
          }
        } catch (_error) {
          
        }
      }

      const result = await runSearchGroup(group, query);
      
      await cleanupTriggerTab(sourceTabId, group, query);
      sendResponse({ ok: true, ...result });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_CTX_GROUP") {
    chrome.storage.local.get(SEARCH_GROUPS_STORAGE_KEY)
      .then((stored) => {
        const searchGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY])
          ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
        return runSelectionContextGroup(message.ctxGroup, message.query, searchGroups);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_SETTINGS_PAGE") {
    const params = new URLSearchParams();
    if (message.section) params.set("section", message.section);
    if (message.miscTab) params.set("miscTab", message.miscTab);
    
    if (message.openChangelog) params.set("changelog", "1");
    
    if (message.openMembership) params.set("membership", "1");
    const query = params.toString();
    const url = SETTINGS_PAGE_URL + (query ? `?${query}` : "");
    chrome.tabs.create({ url })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_EXTERNAL_URL") {
    chrome.tabs.create({ url: message.url, active: true })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_SITE_TAB_AND_SEND") {
    openSiteTabAndSend(message.site, message.query)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
