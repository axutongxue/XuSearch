

import { state, elements, BASE_CONFIG } from "./state.js";

export function activateScrollGuard(left, top, durationMs) {
  
  
  
  return;
  
  const container = elements.iframesContainer;

  state.scrollGuardActive = true;
  state.scrollGuardLeft = left;
  state.scrollGuardTop = top;
  container?.classList.add("is-scroll-guarded");
  if (state.scrollGuardTimerId) {
    window.clearTimeout(state.scrollGuardTimerId);
  }

  startScrollGuardLoop();

  state.scrollGuardTimerId = window.setTimeout(() => {
    stopScrollGuard();
  }, Math.max(1000, durationMs | 0));
}

function startScrollGuardLoop() {
  if (state.scrollGuardRafId) {
    return;
  }

  const tick = () => {
    const container = elements.iframesContainer;
    if (!state.scrollGuardActive || !container) {
      state.scrollGuardRafId = null;
      return;
    }

    
    
    
    
    const follow = state.userIsScrolling ||
      (state.guardFollowUntil && Date.now() < state.guardFollowUntil);

    if (follow) {
      if (container.scrollLeft !== state.scrollGuardLeft) {
        state.scrollGuardLeft = container.scrollLeft;
      }
      if (container.scrollTop !== state.scrollGuardTop) {
        state.scrollGuardTop = container.scrollTop;
      }

      
      
      const moved = container.scrollTop !== state.lastTickScrollTop
        || container.scrollLeft !== state.lastTickScrollLeft;
      if (state.guardFollowUntil && Date.now() < state.guardFollowUntil && moved) {
        state.guardFollowUntil = Date.now() + 300;
      }
    } else {
      if (container.scrollLeft !== state.scrollGuardLeft) {
        container.scrollLeft = state.scrollGuardLeft;
      }
      if (container.scrollTop !== state.scrollGuardTop) {
        container.scrollTop = state.scrollGuardTop;
      }
    }

    state.lastTickScrollTop = container.scrollTop;
    state.lastTickScrollLeft = container.scrollLeft;
    state.scrollGuardRafId = window.requestAnimationFrame(tick);
  };

  state.scrollGuardRafId = window.requestAnimationFrame(tick);
}


export function notifyProgrammaticScroll(durationMs = 900) {
  if (!state.scrollGuardActive) return;
  state.guardFollowUntil = Date.now() + Math.max(200, durationMs | 0);
}

export function stopScrollGuard() {
  state.scrollGuardActive = false;
  state.guardFollowUntil = 0;
  if (state.scrollGuardTimerId) {
    window.clearTimeout(state.scrollGuardTimerId);
    state.scrollGuardTimerId = null;
  }
  if (state.scrollGuardRafId) {
    window.cancelAnimationFrame(state.scrollGuardRafId);
    state.scrollGuardRafId = null;
  }
  elements.iframesContainer?.classList.remove("is-scroll-guarded");
}

export function getScrollGuardDurationMs(cardCount) {
  const staggerMs = (BASE_CONFIG.iframeStaggerMs != null) ? BASE_CONFIG.iframeStaggerMs : 120;
  const base = 3000;
  const extra = Math.max(0, (cardCount | 0) - 1) * staggerMs;
  return Math.min(base + extra + 1500, 8000);
}

export function updateScrollEdgeBtns() {
  const c = elements.iframesContainer;
  
  
  
  void c;
  updateHScrollStrip();
}

export function updateHScrollStrip() {
  const strip = elements.hScrollStrip;
  const thumb = elements.hScrollThumb;
  if (!strip || !thumb) return;

  
  
  if (state.layoutMode === "sidebar") {
    const navStrip = elements.cardNavStrip;
    if (!navStrip) {
      strip.hidden = true;
      return;
    }
    const canScroll = navStrip.scrollWidth > navStrip.clientWidth + 2;
    strip.hidden = !canScroll;
    if (!strip.hidden) {
      const max = Math.max(1, navStrip.scrollWidth - navStrip.clientWidth);
      const ratio = Math.min(1, navStrip.scrollLeft / max);
      const thumbPct = Math.max(8, Math.min(100, (navStrip.clientWidth / navStrip.scrollWidth) * 100));
      thumb.style.width = thumbPct + "%";
      thumb.style.left = (ratio * (100 - thumbPct)) + "%";
    }
    return;
  }

  strip.hidden = true;
}

export function lockContainerScroll() {
  
  state.lockedScrollLeft = null;
  state.isScrollLocked = false;
  return;
}

export function restoreLockedScrollPosition() {
  if (state.lockedScrollLeft === null || !elements.iframesContainer) {
    return;
  }

  elements.iframesContainer.scrollLeft = state.lockedScrollLeft;
}

export function scheduleScrollUnlock() {
  if (state.scrollUnlockTimerId) {
    window.clearTimeout(state.scrollUnlockTimerId);
  }

  state.scrollUnlockTimerId = window.setTimeout(() => {
    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    state.scrollUnlockTimerId = null;
  }, 2200);
}
