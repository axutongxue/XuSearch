




import {
  SEARCH_HISTORY_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY,
  CARD_SIZE_LEVEL_KEY,
  LAYOUT_ROWS_KEY,
  LAYOUT_MODE_KEY,
} from "../../shared/storage-keys.js";

export const BASE_CONFIG = globalThis.XUSEARCH_BASE_CONFIG || {};




export const STORAGE_KEYS = {
  cardSizeLevel: CARD_SIZE_LEVEL_KEY,
  layoutRows: LAYOUT_ROWS_KEY,
  layoutMode: LAYOUT_MODE_KEY,
  searchHistory: SEARCH_HISTORY_STORAGE_KEY,
  promptGroups: PROMPT_GROUPS_STORAGE_KEY,
};

export const state = {
  sites: [],
  allSites: [],
  requestedSiteIds: null,
  hiddenSiteIds: new Set(),
  cardRefs: new Map(),
  columnCount: "1",
  maximizedSiteId: null,
  shouldAutoSend: false,
  restoreHistoryEntryId: null,
  pendingDispatches: new Map(),
  pendingFileDispatches: new Map(),
  cardSizeLevel: "3",
  
  
  
  
  layoutRows: 2,
  layoutMode: "sidebar",
  activeSidebarSiteId: null,
  
  activeGridPage: 0,
  searchHistory: [],
  historyDateFilter: "all",
  
  historySearchKeyword: "",
  currentHistoryEntryId: null,
  historyEntryIdBySiteId: new Map(),
  promptGroups: [],
  activePromptGroupId: null,
  isPromptPickerOpen: false,
  lockedScrollLeft: null,
  scrollUnlockTimerId: null,
  isScrollLocked: false,
  scrollGuardActive: false,
  scrollGuardLeft: 0,
  scrollGuardTop: 0,
  scrollGuardRafId: null,
  scrollGuardTimerId: null,
  userIsScrolling: false,
  userScrollTimer: null,
  isSending: false,
  isUploadMode: false,
  isFollowUp: false,
  lastSearchQuery: null,
  lastSearchTime: null,
  
  
  
  
  
  loadingRefs: new Set(),
  loadQueue: []
};

export const elements = {};


export const promptPreview = { mgr: null };
