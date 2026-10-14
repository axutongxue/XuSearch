





(function installFramebustingGuard() {
  if (window.__XUSEARCH_FRAMEBUST_GUARD__) return;
  window.__XUSEARCH_FRAMEBUST_GUARD__ = true;
  if (window === window.top) return;

  
  
  
  
  
  const host = window.location.hostname.replace(/^www\./, "").toLowerCase();
  
  
  const framebustingHosts = new Set(__XUSEARCH_FRAMEBUST_HOSTS__);
  if (!framebustingHosts.has(host)) return;

  
  try {
    const noopLocation = new Proxy({}, {
      get(_target, prop) {
        if (prop === "replace" || prop === "assign" || prop === "reload") {
          return () => {};
        }
        return "";
      },
      set() { return true; },
    });
    Object.defineProperty(window, "top", { configurable: true, get: () => window.self });
    Object.defineProperty(window, "parent", { configurable: true, get: () => window.self });
    Object.defineProperty(document, "domain", { configurable: true, get: () => window.location.hostname });
    Object.defineProperty(window, "frameElement", { configurable: true, get: () => null });
    void noopLocation;
  } catch (_e) {
    
  }
})();
