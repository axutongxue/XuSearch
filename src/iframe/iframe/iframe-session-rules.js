
export async function ensureIframeSessionRules() {
  try {
    const tab = await chrome.tabs.getCurrent();
    const currentTabId = tab?.id;
    if (!currentTabId) return;

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [9001, 9002],
      addRules: [
        {
          id: 9001,
          priority: 2,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Sec-Fetch-Dest", operation: "set", value: "document" },
              { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
              { header: "Sec-Fetch-Mode", operation: "set", value: "navigate" },
              { header: "Sec-Fetch-User", operation: "set", value: "?1" },
            ],
            responseHeaders: [
              { header: "content-security-policy", operation: "remove" },
              { header: "content-security-policy-report-only", operation: "remove" },
              { header: "x-frame-options", operation: "remove" },
            ],
          },
          condition: {
            tabIds: [currentTabId],
            resourceTypes: ["sub_frame"],
          },
        },
        {
          id: 9002,
          priority: 3,
          action: {
            type: "modifyHeaders",
            responseHeaders: [
              { header: "content-security-policy", operation: "remove" },
              { header: "content-security-policy-report-only", operation: "remove" },
              { header: "x-frame-options", operation: "remove" },
              { header: "cross-origin-opener-policy", operation: "remove" },
              { header: "cross-origin-resource-policy", operation: "remove" },
              { header: "cross-origin-embedder-policy", operation: "remove" },
              { header: "permissions-policy", operation: "remove" },
            ],
          },
          condition: {
            tabIds: [currentTabId],
            resourceTypes: ["sub_frame"],
          },
        },
      ],
    });
  } catch (_e) {
    
  }
}
