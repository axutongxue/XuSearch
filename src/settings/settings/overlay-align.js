
export function alignOverlayToContent(overlay) {
  if (!overlay) return;
  const content = document.querySelector(".settings-content");
  if (!content) return;

  const rect = content.getBoundingClientRect();
  overlay.style.paddingLeft = `${Math.max(0, Math.round(rect.left))}px`;
  overlay.style.paddingRight = `${Math.max(0, Math.round(window.innerWidth - rect.right))}px`;
  
  overlay.style.left = "";
  overlay.style.right = "";
}
