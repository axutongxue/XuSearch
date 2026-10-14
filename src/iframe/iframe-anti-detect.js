

(function () {
  if (window.parent === window) return;

  
  
  
  if (!/^chrome-extension:/i.test(document.referrer || "")) return;

  
  
  try {
    const realClear = console.clear;
    console.clear = function noopClear() {
      
    };
    if (console.clear !== realClear) {
      console.clear._xuSearchNoop = true;
    }
  } catch (_e) {}

  try {
    Object.defineProperty(window, "parent", {
      get: function () { return window; },
      configurable: true,
    });
  } catch (_e) {}

  try {
    Object.defineProperty(Window.prototype, "top", {
      get: function () { return this; },
      configurable: true,
    });
  } catch (_e) {}

  try {
    Object.defineProperty(document, "frameElement", {
      get: function () { return null; },
      configurable: true,
    });
  } catch (_e) {}

  const ROOT_SELECTORS = ["#app", ".app", "#root", "#__next", "#ice-container"];

  function forceReveal(el) {
    const cs = getComputedStyle(el);

    if (cs.display === "none") {
      el.style.setProperty("display", "block", "important");
      el.style.setProperty("visibility", "visible", "important");
    }

    if (parseFloat(cs.maxWidth) === 0 || parseFloat(cs.width) === 0) {
      el.style.setProperty("max-width", "100%", "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("flex-basis", "auto", "important");
      el.style.setProperty("overflow", "auto", "important");
    }
  }

  function attachWatch(el) {
    forceReveal(el);
    const obs = new MutationObserver(() => forceReveal(el));
    obs.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
  }

  const attached = new Set();

  function tryAttachAll() {
    for (const sel of ROOT_SELECTORS) {
      if (attached.has(sel)) continue;
      const el = document.querySelector(sel);
      if (el) {
        attached.add(sel);
        attachWatch(el);
      }
    }
  }

  function startWatching() {
    tryAttachAll();

    const bodyObs = new MutationObserver(() => {
      tryAttachAll();
      if (attached.size >= ROOT_SELECTORS.length) bodyObs.disconnect();
    });
    bodyObs.observe(document.documentElement, { childList: true, subtree: true });

    [300, 800, 1500, 3000].forEach((t) => setTimeout(tryAttachAll, t));
  }

  if (document.body) {
    startWatching();
  } else {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true });
  }

  
  if (/qianwen\.com/.test(location.hostname)) {
    function dismissQianwenEmbedBlockers() {
      var ice = document.getElementById("ice-container");
      var sk = document.getElementById("skeleton");
      if (sk && ice && ice.children.length > 0) {
        sk.remove();
      }
      document.querySelectorAll("[class*='ty-background']").forEach(function (el) {
        var cs = getComputedStyle(el);
        var filterText = (cs.filter || "") + (cs.backdropFilter || "") + (cs.webkitBackdropFilter || "");
        if (filterText.indexOf("blur") !== -1) {
          el.style.setProperty("display", "none", "important");
        }
      });
    }
    dismissQianwenEmbedBlockers();
    var qianwenObs = new MutationObserver(dismissQianwenEmbedBlockers);
    qianwenObs.observe(document.documentElement, { childList: true, subtree: true });
    [300, 800, 1500, 3000, 6000].forEach(function (t) {
      setTimeout(dismissQianwenEmbedBlockers, t);
    });
  }

  
  if (/qianwen\.com|qwen\.ai/i.test(location.hostname)) {
    try {
      var nativeOpen = window.open;
      window.open = function () {
        return null;
      };
      if (window.Window && Window.prototype.open) {
        Window.prototype.open = window.open;
      }
    } catch (_e) {}
  }
})();
