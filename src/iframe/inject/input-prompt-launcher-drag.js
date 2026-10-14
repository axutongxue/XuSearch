import { LAUNCHER_FAB_POSITIONS_STORAGE_KEY } from "../../shared/storage-keys.js";



export const LONG_PRESS_MS = 300;

export const RING_DELAY_MS = 100;
const MOVE_CANCEL_PX = 10;

const EDGE_SNAP_THRESHOLD = 80;

export function createLauncherFabDrag({
  fab,
  iconSize,
  getSiteId,
  onMove,
  onDragStart,
  spinFx,
}) {
  let pinned = null;
  let dragging = false;
  let pressTimer = null;
  let chargingTimer = null;
  let pressStart = null;
  let dragOffset = { x: 0, y: 0 };
  let suppressClick = false;
  let closePanelOnDrag = null;

  const size = iconSize || 24;
  const peek = Math.round(size / 2); 

  
  function clamp(left, top) {
    return {
      left: Math.max(8, Math.min(left, window.innerWidth - size - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - size - 8)),
    };
  }

  
  function snapToEdge(left, top) {
    const w = window.innerWidth;
    const clampedTop = Math.max(8, Math.min(top, window.innerHeight - size - 8));
    if (left <= EDGE_SNAP_THRESHOLD) {
      return { left: -(size - peek), top: clampedTop, edge: "left" };
    }
    if (left >= w - size - EDGE_SNAP_THRESHOLD) {
      return { left: w - peek, top: clampedTop, edge: "right" };
    }
    return { ...clamp(left, top), edge: null };
  }

  
  function resolveFromSaved(raw) {
    if (!raw || !Number.isFinite(raw.top)) return null;
    const clampedTop = Math.max(8, Math.min(raw.top, window.innerHeight - size - 8));
    if (raw.edge === "left") return { left: -(size - peek), top: clampedTop, edge: "left" };
    if (raw.edge === "right") return { left: window.innerWidth - peek, top: clampedTop, edge: "right" };
    if (!Number.isFinite(raw.left)) return null;
    return { ...clamp(raw.left, raw.top), edge: null };
  }

  async function load() {
    const siteId = getSiteId();
    const hostKey = location.hostname;
    try {
      const stored = await chrome.storage.local.get(LAUNCHER_FAB_POSITIONS_STORAGE_KEY);
      const map = stored[LAUNCHER_FAB_POSITIONS_STORAGE_KEY] || {};
      if (map[hostKey]) {
        pinned = resolveFromSaved(map[hostKey]);
      } else if (siteId && map[siteId]) {
        
        pinned = resolveFromSaved(map[siteId]);
        if (pinned) {
          const next = { ...map };
          next[hostKey] = next[siteId];
          delete next[siteId];
          await chrome.storage.local.set({ [LAUNCHER_FAB_POSITIONS_STORAGE_KEY]: next });
        }
      } else {
        pinned = null;
      }
    } catch (_e) {
      pinned = null;
    }
  }

  async function save(left, top, edge) {
    const hostKey = location.hostname;
    pinned = { left, top, edge: edge || null };
    try {
      const stored = await chrome.storage.local.get(LAUNCHER_FAB_POSITIONS_STORAGE_KEY);
      const map = { ...(stored[LAUNCHER_FAB_POSITIONS_STORAGE_KEY] || {}) };
      map[hostKey] = { left, top, edge: edge || null };
      await chrome.storage.local.set({ [LAUNCHER_FAB_POSITIONS_STORAGE_KEY]: map });
    } catch (_e) {
      
    }
  }

  function clearPressTimer() {
    if (!pressTimer) return;
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  
  function cancelCharging() {
    clearTimeout(chargingTimer);
    chargingTimer = null;
    fab.classList.remove("charging");
  }

  function endWindowListeners() {
    window.removeEventListener("pointermove", onWindowPointerMove, true);
    window.removeEventListener("pointerup", onWindowPointerUp, true);
    window.removeEventListener("pointercancel", onWindowPointerUp, true);
  }

  function onWindowPointerMove(e) {
    if (dragging) {
      const pos = clamp(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
      onMove(pos.left, pos.top, null);
      spinFx?.onDragMove?.(pos.left, pos.top);
      return;
    }
    if (!pressStart) return;
    const dx = e.clientX - pressStart.x;
    const dy = e.clientY - pressStart.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      clearPressTimer();
      cancelCharging();
    }
  }

  function onWindowPointerUp(e) {
    clearPressTimer();
    cancelCharging();   
    if (dragging) {
      dragging = false;
      fab.classList.remove("dragging");
      spinFx?.onDragEnd?.();
      suppressClick = true;
      const rawLeft = parseFloat(fab.style.left) || 0;
      const rawTop = parseFloat(fab.style.top) || 0;
      const snapped = snapToEdge(rawLeft, rawTop);
      save(snapped.left, snapped.top, snapped.edge);
      onMove(snapped.left, snapped.top, snapped.edge);
      try { fab.releasePointerCapture(e.pointerId); } catch (_e) {  }
    }
    pressStart = null;
    endWindowListeners();
  }

  function startDragging(e) {
    dragging = true;
    fab.classList.add("dragging");
    
    fab.classList.remove("edge-left", "edge-right");
    if (closePanelOnDrag) closePanelOnDrag();
    spinFx?.onDragStart?.();
    onDragStart?.();
    const rect = fab.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    try { fab.setPointerCapture(e.pointerId); } catch (_e) {  }
    window.addEventListener("pointermove", onWindowPointerMove, true);
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerUp, true);
  }

  function onFabPointerDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    pressStart = { x: e.clientX, y: e.clientY };
    clearPressTimer();
    cancelCharging();
    
    
    chargingTimer = setTimeout(() => {
      chargingTimer = null;
      fab.classList.add("charging");
    }, RING_DELAY_MS);
    pressTimer = setTimeout(() => {
      pressTimer = null;
      startDragging(e);
    }, LONG_PRESS_MS);
    window.addEventListener("pointermove", onWindowPointerMove, true);
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerUp, true);
  }

  function install({ onClosePanel } = {}) {
    closePanelOnDrag = onClosePanel || null;
    fab.addEventListener("pointerdown", onFabPointerDown);
  }

  function consumeSuppressClick() {
    if (!suppressClick) return false;
    suppressClick = false;
    return true;
  }

  return {
    install,
    load,
    isPinned: () => !!pinned,
    getPinned: () => pinned,
    isDragging: () => dragging,
    consumeSuppressClick,
  };
}
