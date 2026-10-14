

import { state, elements } from "./state.js";
import { updateScrollEdgeBtns } from "./layout-scroll.js";
import { getSelectedSites } from "./utils.js";
import { activateSidebarSite, layoutGridPages } from "./layout-card-nav.js";
import { broadcastSidebarPolicyOnLayoutChange } from "./sidebar-control.js";

export {
  activateScrollGuard,
  stopScrollGuard,
  updateScrollEdgeBtns,
  updateHScrollStrip,
  lockContainerScroll,
  restoreLockedScrollPosition,
  scheduleScrollUnlock,
} from "./layout-scroll.js";

export {
  onCardAdded,
  renderSiteNav,
  activateSidebarSite,
  renderCardNavStrip,
  scrollToCard,
  switchCardPage,
  layoutGridPages,
  scrollCardNavByChips,
  updateCardNavScrollBtns,
  toggleMaximize,
} from "./layout-card-nav.js";

export function updateLayoutUi() {
  const appShell = document.querySelector(".app-shell");

  if (state.layoutMode === "sidebar") {
    appShell?.classList.add("is-sidebar-mode");
    elements.iframesContainer.dataset.layoutRows = "sidebar";
    
    
    if (elements.siteNavPanel) elements.siteNavPanel.hidden = true;
    
    elements.layoutRowsButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.layoutRows === "1");
    });
    
    
    state.maximizedSiteId = null;
    state.cardRefs.forEach((ref) => {
      if (ref.cardEl) {
        ref.cardEl.hidden = false;
        ref.cardEl.style.flexBasis = "";
      }
    });
    
    
    
    if (elements.iframesContainer.querySelectorAll(".iframe-card").length > 0
        && !elements.iframesContainer.querySelector(".iframe-card.is-active-card")) {
      const activeId = state.activeSidebarSiteId && state.cardRefs.has(state.activeSidebarSiteId)
        ? state.activeSidebarSiteId
        : (getSelectedSites()[0]?.id || null);
      if (activeId) {
        activateSidebarSite(activeId);
      }
    }
    updateScrollEdgeBtns();
    
    broadcastSidebarPolicyOnLayoutChange();
    return;
  }

  appShell?.classList.remove("is-sidebar-mode");
  if (elements.siteNavPanel) elements.siteNavPanel.hidden = true;
  state.cardRefs.forEach((ref) => {
    if (ref.cardEl) ref.cardEl.hidden = false;
  });

  
  
  const rowHeight = "calc(100vh - 118px)";

  state.lockedScrollLeft = null;
  state.isScrollLocked = false;
  if (state.scrollUnlockTimerId) {
    window.clearTimeout(state.scrollUnlockTimerId);
    state.scrollUnlockTimerId = null;
  }

  elements.iframesContainer.style.setProperty("--row-height", rowHeight);
  elements.iframesContainer.dataset.layoutRows = String(state.layoutRows);

  elements.layoutRowsButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.layoutRows) === state.layoutRows);
  });

  layoutGridPages();
  updateScrollEdgeBtns();
  
  broadcastSidebarPolicyOnLayoutChange();
}
