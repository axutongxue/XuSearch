

import { state } from "./state.js";
import { persistAll } from "./store.js";

function attachPromptGridDrag(listEl, commitOrder) {
  listEl.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(e) {
    const handle = e.target.closest(".prompt-pcard-drag-handle");
    if (!handle) return;
    const card = handle.closest(".prompt-pcard");
    if (!card) return;

    e.preventDefault();

    const rect = card.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const clone = card.cloneNode(true);
    clone.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 8px 28px rgba(0,0,0,0.13)",
      "opacity:0.95",
      "transition:none",
      "border-radius:12px",
      "background:#fff"
    ].join(";");
    document.body.appendChild(clone);

    card.style.opacity = "0";
    card.style.pointerEvents = "none";

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.left = `${ev.clientX - offsetX}px`;
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterX = ev.clientX - offsetX + rect.width / 2;
      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherCards = Array.from(listEl.querySelectorAll(".prompt-pcard")).filter((c) => c !== card);
      let newInsertBefore = null;

      for (const other of otherCards) {
        const r = other.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        if (cloneCenterY < midY - r.height * 0.25) {
          newInsertBefore = other;
          break;
        }
        if (cloneCenterY > midY + r.height * 0.25) {
          continue;
        }
        if (cloneCenterX < midX) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allCards = Array.from(listEl.querySelectorAll(".prompt-pcard"));
        const firstPositions = new Map();
        allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        listEl.insertBefore(card, newInsertBefore);
        lastInsertBefore = newInsertBefore;

        allCards
          .filter((el) => el !== card)
          .forEach((el) => {
            const first = firstPositions.get(el);
            if (!first) return;
            const last = el.getBoundingClientRect();
            const dx = first.left - last.left;
            const dy = first.top - last.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            el.style.transition = "none";
            el.style.transform = `translate(${dx}px,${dy}px)`;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.style.transition = "transform 200ms cubic-bezier(0.2,0,0,1)";
                el.style.transform = "";
              });
            });
          });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const finalRect = card.getBoundingClientRect();
      clone.style.transition = "left 160ms ease, top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
      clone.style.left = `${finalRect.left}px`;
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(() => {
        clone.remove();
        card.style.opacity = "";
        card.style.pointerEvents = "";

        Array.from(listEl.querySelectorAll(".prompt-pcard")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        commitOrder(listEl);
      }, 160);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}


export function attachPromptItemDrag(listEl, group) {
  attachPromptGridDrag(listEl, (gridEl) => {
    const newPromptIds = Array.from(gridEl.querySelectorAll(".prompt-pcard")).map((c) => c.dataset.promptId);
    const reordered = newPromptIds.map((id) => group.prompts.find((p) => p.id === id)).filter(Boolean);
    if (reordered.length === group.prompts.length) {
      group.prompts = reordered;
      persistAll();
    }
  });
}


export function attachPromptItemDragAll(listEl) {
  attachPromptGridDrag(listEl, (gridEl) => {
    const groupOrderMap = new Map();
    Array.from(gridEl.querySelectorAll(".prompt-pcard")).forEach((el) => {
      const gId = el.dataset.groupId;
      if (!groupOrderMap.has(gId)) groupOrderMap.set(gId, []);
      groupOrderMap.get(gId).push(el.dataset.promptId);
    });

    let changed = false;
    groupOrderMap.forEach((promptIds, gId) => {
      const group = state.promptGroups.find((g) => g.id === gId);
      if (!group) return;
      const reordered = promptIds.map((id) => group.prompts.find((p) => p.id === id)).filter(Boolean);
      if (reordered.length === group.prompts.length) {
        group.prompts = reordered;
        changed = true;
      }
    });

    if (changed) persistAll();
  });
}
