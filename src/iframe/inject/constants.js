




export const EXTENSION_ORIGIN =
  typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id
    ? `chrome-extension://${chrome.runtime.id}`
    : null;




export const SUBMIT_ACTIONS = new Set(["click", "sendKeys", "smartSubmit"]);

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
