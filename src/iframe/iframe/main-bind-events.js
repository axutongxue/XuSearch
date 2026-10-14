import { state, elements } from "./state.js";
import { getSelectedSites } from "./utils.js";
import {
  setGlobalStatus,
  updateSendBtnState,
} from "./status.js";
import {
  activateScrollGuard,
  updateScrollEdgeBtns,
  updateHScrollStrip,
  updateLayoutUi,
  renderSiteNav,
  activateSidebarSite,
  switchCardPage,
  scrollCardNavByChips,
  updateCardNavScrollBtns,
} from "./layout.js";
import { refreshSiteCard } from "./cards-render.js";
import { handleSendSelected } from "./send.js";
import {
  clearAllHistory,
  toggleHistoryPanel,
  closeHistoryPanel,
  bindHistoryFilterEvents,
} from "./history.js";
import {
  togglePromptPicker,
  closePromptPicker,
} from "./prompts.js";
import { showExportModal } from "./export.js";
import { showAiSummaryModal } from "./ai-summary.js";
import { savePreferences } from "./main-preferences.js";


function closeLayoutPopover() {
  elements.layoutPopover?.setAttribute("hidden", "");
}


function openSettingsPage() {
  try {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
  } catch (_error) {
    window.open(chrome.runtime.getURL("settings/settings.html"), "_blank", "noopener,noreferrer");
  }
}

export function bindComparePageEvents() {
  elements.sendSelectedBtn.addEventListener("click", handleSendSelected);
  elements.promptAssistBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePromptPicker();
  });
  elements.queryInput.addEventListener("input", () => {
    closePromptPicker();
    updateSendBtnState();
  });
  elements.queryInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    event.preventDefault();
    await handleSendSelected();
  });
  
  
  elements.aiSummaryBtn?.addEventListener("click", () => {
    showAiSummaryModal();
  });

  
  [elements.aiSummaryBtn, elements.promptAssistBtn, elements.fileUploadBtn].forEach((btn) => {
    btn?.addEventListener("mousedown", (event) => event.preventDefault());
  });
  elements.exportBtn.addEventListener("click", () => {
    showExportModal();
  });
  elements.historyToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHistoryPanel();
  });
  elements.closeHistoryPanelBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeHistoryPanel();
  });
  
  
  
  elements.closeHistoryFooterBtn?.addEventListener("click", () => closeHistoryPanel());
  elements.historyPanel.addEventListener("click", (event) => {
    if (event.target === elements.historyPanel) closeHistoryPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.historyPanel.hasAttribute("hidden")) {
      closeHistoryPanel();
    }
  });
  elements.clearHistoryBtn?.addEventListener("click", async () => {
    if (state.searchHistory.length === 0) {
      return;
    }
    
    
    if (!window.confirm(`确定要清空全部 ${state.searchHistory.length} 条搜索记录吗？此操作不可恢复。`)) {
      return;
    }
    await clearAllHistory();
  });
  bindHistoryFilterEvents();
  
  
  
  elements.settingsBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSettingsPage();
  });

  elements.layoutToggleBtn.addEventListener("click", () => {
    const isHidden = elements.layoutPopover.hasAttribute("hidden");
    if (isHidden) {
      elements.layoutPopover.removeAttribute("hidden");
    } else {
      elements.layoutPopover.setAttribute("hidden", "");
    }
  });

  elements.layoutRowsButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const rows = Number(button.dataset.layoutRows);
      if (rows === 1) {
        
        state.layoutMode = "sidebar";
        const firstSite = getSelectedSites()[0];
        if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
          state.activeSidebarSiteId = firstSite?.id || null;
        }
        renderSiteNav();
        if (state.activeSidebarSiteId) {
          activateSidebarSite(state.activeSidebarSiteId);
        }
      } else {
        state.layoutRows = rows;
        state.layoutMode = "grid";
      }
      updateLayoutUi();
      await savePreferences();
    });
  });

  
  
  
  
  document.addEventListener("click", (event) => {
    if (!elements.layoutPopover || elements.layoutPopover.hasAttribute("hidden")) {
      return;
    }

    const insidePopover = elements.layoutPopover.contains(event.target);
    const insideToggle = elements.layoutToggleBtn.contains(event.target);
    if (!insidePopover && !insideToggle) {
      closeLayoutPopover();
    }
  });

  
  
  window.addEventListener("blur", () => {
    if (!elements.layoutPopover || elements.layoutPopover.hasAttribute("hidden")) return;
    closeLayoutPopover();
  });

  elements.iframesContainer.addEventListener("wheel", () => {
    state.userIsScrolling = true;
    clearTimeout(state.userScrollTimer);
    state.userScrollTimer = setTimeout(() => {
      state.userIsScrolling = false;
      state.userScrollTimer = null;
      if (state.scrollGuardActive) {
        state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
        state.scrollGuardTop = elements.iframesContainer.scrollTop;
      }
    }, 400);
  }, { passive: true });

  elements.iframesContainer.addEventListener("pointerdown", () => {
    state.userIsScrolling = true;
  }, { passive: true });

  window.addEventListener("pointerup", () => {
    if (state.userIsScrolling) {
      state.userIsScrolling = false;
      if (state.scrollGuardActive) {
        state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
        state.scrollGuardTop = elements.iframesContainer.scrollTop;
      }
    }
  }, { passive: true });

  elements.iframesContainer.addEventListener("scroll", () => {
    if (!state.scrollGuardActive || state.userIsScrolling) {
      return;
    }
    const container = elements.iframesContainer;
    if (container.scrollLeft !== state.scrollGuardLeft) {
      container.scrollLeft = state.scrollGuardLeft;
    }
    if (container.scrollTop !== state.scrollGuardTop) {
      container.scrollTop = state.scrollGuardTop;
    }
  }, { passive: true });

  
  
  
  
  
  
  
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const container = elements.iframesContainer;
    if (!container || state.scrollGuardActive) return;
    
    
    if (state.layoutMode === "sidebar") return;
    activateScrollGuard(container.scrollLeft, container.scrollTop, 800);
  });

  
  
  
  
  
  {
    let _wheelSwitchAccum = 0;
    let _wheelSwitchLockUntil = 0;
    const WHEEL_EXCLUDE_SELECTOR = [
      ".iframe-card",          
      "textarea, input",       
      ".card-nav-chip",        
      ".h-scroll-strip",       
      ".layout-popover, .history-modal, .site-nav-panel", 
      ".ai-summary-modal, .export-modal, .prompt-edit-modal, .prompt-edit-modal-overlay", 
      
      
      
      ".composer-prompt-picker",
    ].join(", ");
    window.addEventListener("wheel", (event) => {
      if (!event.deltaY) return;
      const target = event.target;
      if (target instanceof Element && target.closest(WHEEL_EXCLUDE_SELECTOR)) {
        return; 
      }
      event.preventDefault();
      const now = Date.now();
      if (now < _wheelSwitchLockUntil) return;
      _wheelSwitchAccum += event.deltaY;
      if (Math.abs(_wheelSwitchAccum) < 60) return;
      const direction = _wheelSwitchAccum > 0 ? 1 : -1;
      _wheelSwitchAccum = 0;
      _wheelSwitchLockUntil = now + 500;
      switchCardPage(direction);
    }, { passive: false });
  }

  elements.iframesContainer.addEventListener("scroll", updateScrollEdgeBtns, { passive: true });
  elements.cardNavStrip?.addEventListener("scroll", updateHScrollStrip, { passive: true });

  elements.hScrollStrip?.addEventListener("click", (e) => {
    if (e.target === elements.hScrollThumb) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (state.layoutMode === "sidebar") {
      const navStrip = elements.cardNavStrip;
      if (!navStrip) return;
      const max = navStrip.scrollWidth - navStrip.clientWidth;
      navStrip.scrollLeft = ratio * max;
      return;
    }

    const c = elements.iframesContainer;
    if (!c) return;
    c.scrollLeft = ratio * (c.scrollWidth - c.clientWidth);
  });

  let _thumbDragging = false;
  let _thumbDragStartX = 0;
  let _thumbDragStartScrollLeft = 0;

  elements.hScrollThumb?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    _thumbDragging = true;
    _thumbDragStartX = e.clientX;
    _thumbDragStartScrollLeft = state.layoutMode === "sidebar"
      ? (elements.cardNavStrip?.scrollLeft ?? 0)
      : (elements.iframesContainer?.scrollLeft ?? 0);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  });

  elements.hScrollThumb?.addEventListener("pointermove", (e) => {
    if (!_thumbDragging) return;
    const strip = elements.hScrollStrip;
    if (!strip) return;
    const dx = e.clientX - _thumbDragStartX;

    if (state.layoutMode === "sidebar") {
      const navStrip = elements.cardNavStrip;
      if (!navStrip) return;
      const max = navStrip.scrollWidth - navStrip.clientWidth;
      if (max <= 0) return;
      navStrip.scrollTo({
        left: Math.max(0, Math.min(max,
          _thumbDragStartScrollLeft + dx * navStrip.scrollWidth / strip.clientWidth
        )),
        behavior: "instant",
      });
      return;
    }

    const c = elements.iframesContainer;
    if (!c) return;
    const max = c.scrollWidth - c.clientWidth;
    if (max <= 0) return;
    c.scrollTo({
      left: Math.max(0, Math.min(max,
        _thumbDragStartScrollLeft + dx * c.scrollWidth / strip.clientWidth
      )),
      behavior: "instant",
    });
  });

  const _endThumbDrag = () => { _thumbDragging = false; };
  elements.hScrollThumb?.addEventListener("pointerup", _endThumbDrag);
  elements.hScrollThumb?.addEventListener("pointercancel", _endThumbDrag);

  window.addEventListener("resize", () => {
    updateLayoutUi();
  });

  
  
  
  elements.cardNavScrollLeftBtn?.addEventListener("mousedown", (event) => event.preventDefault());
  elements.cardNavScrollRightBtn?.addEventListener("mousedown", (event) => event.preventDefault());
  elements.cardNavScrollLeftBtn?.addEventListener("click", () => {
    scrollCardNavByChips(-1);
  });
  elements.cardNavScrollRightBtn?.addEventListener("click", () => {
    scrollCardNavByChips(1);
  });

  elements.cardNavStrip?.addEventListener("scroll", updateCardNavScrollBtns, { passive: true });
  updateCardNavScrollBtns();
}
