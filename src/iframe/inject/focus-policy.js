


export function extensionOriginOf(chromeRuntimeId) {
  return chromeRuntimeId ? `chrome-extension://${chromeRuntimeId}` : null;
}


export function isEmbeddedByExtensionPage(ancestorOrigins, extensionOrigin) {
  if (!extensionOrigin || !ancestorOrigins || typeof ancestorOrigins.length !== "number") {
    return false;
  }
  for (let i = 0; i < ancestorOrigins.length; i += 1) {
    if (ancestorOrigins[i] === extensionOrigin) return true;
  }
  return false;
}


export function shouldCancelSiteFocus(state) {
  
  if (state.allowMarked) return false;
  
  if (state.strict) return state.userTouched !== true;
  
  return state.hasBeenActive !== true;
}
