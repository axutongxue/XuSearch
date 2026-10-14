
const EXTERNAL_LINK_PATHS = [
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  '<polyline points="15 3 21 3 21 9"/>',
  '<line x1="10" y1="14" x2="21" y2="3"/>',
].join("");


export function externalLinkIcon(className = "external-link-icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTERNAL_LINK_PATHS}</svg>`;
}
