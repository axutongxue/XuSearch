


















import { diagnosticLog, traceLog } from "../../shared/diagnostics.js";
import { safeFocus } from "./dom-utils.js";
import { activateSubmitButton } from "./executor-dom.js";

const MIME_EXT_FALLBACK = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml"
};

function ensureFileName(name, type) {
  if (name) return name;
  const ext = MIME_EXT_FALLBACK[type] || "bin";
  return `clipboard-${Date.now()}.${ext}`;
}

async function blobToFile(entry) {
  
  
  
  
  
  let blob = null;
  let name = "";
  let type = "";
  let lastModified = Date.now();

  traceLog("[XuSearch paste] blobToFile: entry type =", typeof entry, "keys =", entry && typeof entry === "object" ? Object.keys(entry) : []);

  
  
  const rawFile = entry && typeof entry === "object" ? entry.file : null;
  if (rawFile && (rawFile instanceof File || Object.prototype.toString.call(rawFile) === "[object File]")) {
    traceLog("[XuSearch paste] blobToFile: direct File entry, size =", rawFile.size);
    return new File([rawFile], entry.name || rawFile.name || "", {
      type: entry.type || rawFile.type || "",
      lastModified: Number.isFinite(entry.lastModified) ? entry.lastModified : rawFile.lastModified,
    });
  }

  
  if (!blob && entry && typeof entry === "object" && entry.arrayBuffer) {
    try {
      let ab = null;
      if (entry.arrayBuffer instanceof ArrayBuffer) {
        ab = entry.arrayBuffer;
      } else if (typeof entry.arrayBuffer.byteLength === "number") {
        ab = entry.arrayBuffer.byteLength > 0
          ? new Uint8Array(entry.arrayBuffer).buffer
          : new ArrayBuffer(0);
      } else if (Array.isArray(entry.arrayBuffer) || (entry.arrayBuffer.length && typeof entry.arrayBuffer[0] === "number")) {
        ab = new Uint8Array(entry.arrayBuffer).buffer;
      }
      if (ab) {
        blob = new Blob([ab], { type: entry.type || "application/octet-stream" });
        name = entry.name || "";
        type = entry.type || blob.type || "";
        if (Number.isFinite(entry.lastModified)) {
          lastModified = entry.lastModified;
        }
        traceLog("[XuSearch paste] blobToFile: reconstructed from arrayBuffer, abSize =", ab.byteLength, "blob size =", blob.size);
      }
    } catch (err) {
      console.error("[XuSearch paste] blobToFile: arrayBuffer path failed:", err.message);
    }
  }

  
  if (!blob && entry && typeof entry === "object" && entry.blob instanceof Blob) {
    blob = entry.blob;
    name = entry.name || "";
    type = entry.type || blob.type || "";
    if (Number.isFinite(entry.lastModified)) {
      lastModified = entry.lastModified;
    }
  }

  
  if (!blob && entry && typeof entry === "object" && entry.blob && typeof entry.blob.size === "number" && (typeof entry.blob.arrayBuffer === "function" || typeof entry.blob.slice === "function")) {
    traceLog("[XuSearch paste] blobToFile: instanceof Blob failed, duck-typing entry.blob");
    try {
      const ab = typeof entry.blob.arrayBuffer === "function"
        ? await entry.blob.arrayBuffer()
        : await entry.blob.slice(0, entry.blob.size).arrayBuffer();
      blob = new Blob([ab], { type: entry.type || entry.blob.type || "application/octet-stream" });
      name = entry.name || "";
      type = entry.type || blob.type || "";
      if (Number.isFinite(entry.lastModified)) {
        lastModified = entry.lastModified;
      }
    } catch (err) {
      console.error("[XuSearch paste] blobToFile: duck-typing reconstruction failed:", err.message);
    }
  }

  
  if (!blob && entry instanceof Blob) {
    blob = entry;
    name = entry.name || "";
    type = entry.type || "";
    if (entry.lastModified) {
      lastModified = entry.lastModified;
    }
  }

  if (!blob || !(blob instanceof Blob)) {
    traceLog("[XuSearch paste] blobToFile: all paths failed, returning null");
    return null;
  }

  name = ensureFileName(name, type);
  type = type || "application/octet-stream";

  try {
    return new File([blob], name, { type, lastModified });
  } catch (_error) {
    const fallback = blob.slice(0, blob.size, type);
    try {
      Object.defineProperty(fallback, "name", { value: name, configurable: true });
      Object.defineProperty(fallback, "lastModified", { value: lastModified, configurable: true });
    } catch (_err) {
      
    }
    return fallback;
  }
}

function buildClipboardDataTransfer(files) {
  const dt = new DataTransfer();
  files.forEach((file) => {
    if (file) {
      try {
        dt.items.add(file);
      } catch (_error) {
        
      }
    }
  });
  return dt;
}

function buildPasteEvent(files) {
  const dt = buildClipboardDataTransfer(files);
  if (!dt || !dt.files || dt.files.length === 0) {
    return null;
  }

  const event = new ClipboardEvent("paste", {
    clipboardData: dt,
    bubbles: true,
    cancelable: true
  });

  
  try {
    if (event.clipboardData !== dt) {
      Object.defineProperty(event, "clipboardData", { value: dt, configurable: true });
    }
  } catch (_error) {
    
  }
  return { event, dt };
}









function dispatchPaste(target, files) {
  const built = buildPasteEvent(files);
  if (!built) {
    traceLog("[XuSearch paste] dispatchPaste: empty filelist after build, skipping");
    diagnosticLog("inject.paste", "dispatch-skip-empty-filelist", { expected: files.length });
    return { dispatched: false, handled: false };
  }

  traceLog("[XuSearch paste] dispatchPaste to target:", { tag: target?.tagName, id: target?.id, className: typeof target?.className === "string" ? target.className.slice(0, 80) : "" }, "files =", built.dt.files.length);
  const ok = target.dispatchEvent(built.event);
  const handled = built.event.defaultPrevented;
  traceLog("[XuSearch paste] dispatchPaste done, defaultPrevented =", handled, "returnedOk =", ok);
  diagnosticLog("inject.paste", "dispatched", {
    targetTag: target?.tagName,
    targetId: target?.id,
    targetClass: typeof target?.className === "string" ? target.className.slice(0, 80) : "",
    fileCount: built.dt.files.length,
    defaultPrevented: handled,
    returnedOk: ok
  });
  return { dispatched: true, handled };
}


function dispatchDrop(target, files, includeDragover = true, bubbles = true) {
  const dt = new DataTransfer();
  files.forEach((file) => {
    if (file) {
      try {
        dt.items.add(file);
      } catch (_e) {
        
      }
    }
  });
  if (dt.files.length === 0) {
    traceLog("[XuSearch paste] dispatchDrop: no files in DataTransfer");
    return { dispatched: false, handled: false };
  }

  try {
    
    
    
    
    
    
    
    if (includeDragover) {
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    }

    
    
    
    
    
    const dropEvent = new DragEvent("drop", { bubbles, cancelable: true, dataTransfer: dt });
    traceLog("[XuSearch paste] dispatchDrop to target:", { tag: target?.tagName, id: target?.id, className: typeof target?.className === "string" ? target.className.slice(0, 80) : "" }, "files =", dt.files.length, "includeDragover =", includeDragover, "bubbles =", bubbles);
    target.dispatchEvent(dropEvent);
    const handled = dropEvent.defaultPrevented;
    traceLog("[XuSearch paste] dispatchDrop done, defaultPrevented =", handled);

    
    try {
      document.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer: dt }));
      document.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
    } catch (_e) {  }

    
    dismissDragOverlays();

    diagnosticLog("inject.paste", "dispatched-drop", {
      targetTag: target?.tagName,
      targetId: target?.id,
      fileCount: dt.files.length,
      defaultPrevented: handled,
    });
    return { dispatched: true, handled };
  } catch (err) {
    console.error("[XuSearch paste] dispatchDrop error:", err.message);
    diagnosticLog("inject.paste", "dispatch-drop-error", { error: err.message });
    return { dispatched: false, handled: false };
  }
}


function dismissDragOverlays() {
  try {
    
    
    const candidates = document.querySelectorAll('[class*="z-9999"], [style*="z-index"][style*="9999"]');
    let dismissed = 0;
    candidates.forEach((el) => {
      const text = el.textContent || "";
      
      if (text.includes("拖放") || text.includes("拖拽")) {
        traceLog("[XuSearch paste] dismissDragOverlays: hiding drag overlay:", text.trim().slice(0, 60));
        el.style.setProperty("display", "none", "important");
        dismissed++;
      }
    });
    if (dismissed > 0) {
      traceLog("[XuSearch paste] dismissDragOverlays: dismissed", dismissed, "overlay(s)");
    }
    return dismissed;
  } catch (err) {
    traceLog("[XuSearch paste] dismissDragOverlays error:", err.message);
    return 0;
  }
}


async function tryFileInputFallback(files, options = {}) {
  
  const selectors = [
    '.js-input-file',
    'input[type="file"]',
    'input[accept]:not([type="text"])',
    '[class*="upload"] input[type="file"]',
  ];

  traceLog("[XuSearch paste] tryFileInputFallback start, files =", files.length);

  
  const found = tryAssignFileInputs(selectors, files);
  if (found) return true;

  
  
  
  const triggerSelectors = Array.isArray(options.uploadTriggerSelectors)
    ? options.uploadTriggerSelectors.filter(Boolean)
    : [];
  if (triggerSelectors.length > 0) {
    const triggerOk = await tryClickTriggerForFileInput(triggerSelectors, files);
    if (triggerOk) return true;
  }

  
  
  traceLog("[XuSearch paste] no direct file input found, trying hover-trigger...");
  const hoverOk = await tryHoverTriggerUpload(files);
  if (hoverOk) return true;

  traceLog("[XuSearch paste] tryFileInputFallback: no suitable file input found");
  diagnosticLog("inject.paste", "file-input-fallback-not-found", {});
  return false;
}


async function tryClickTriggerForFileInput(triggerSelectors, files) {
  let trigger = null;
  for (const sel of triggerSelectors) {
    try {
      trigger = document.querySelector(sel);
      if (trigger) break;
    } catch (_e) {  }
  }
  if (!trigger) {
    traceLog("[XuSearch paste] trigger-click: no trigger found, selectors =", triggerSelectors.join(", "));
    return false;
  }

  traceLog("[XuSearch paste] trigger-click: activating", trigger.tagName, "to reveal file input...");
  
  
  
  activateSubmitButton(trigger);

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const ok = tryAssignFileInputs(['input[type="file"]', '.js-input-file'], files);
    if (ok) {
      traceLog("[XuSearch paste] trigger-click: file input assigned");
      diagnosticLog("inject.paste", "trigger-click-file-input", {});
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  traceLog("[XuSearch paste] trigger-click: no input[type=file] appeared within 4s");
  diagnosticLog("inject.paste", "trigger-click-no-input", {});
  return false;
}


function tryAssignFileInputs(selectors, files) {
  for (const selector of selectors) {
    let inputs = [];
    try {
      inputs = Array.from(document.querySelectorAll(selector));
    } catch (_e) {
      continue;
    }
    traceLog("[XuSearch paste] tryAssignFileInputs selector =", selector, "found", inputs.length, "inputs");
    for (const input of inputs) {
      traceLog("[XuSearch paste] checking input:", { tag: input.tagName, type: input.type, accept: input.accept, id: input.id, className: typeof input.className === "string" ? input.className.slice(0, 80) : "" });
      if (input instanceof HTMLInputElement && input.type === "file") {
        try {
          const dt = new DataTransfer();
          files.forEach((f) => {
            if (f) {
              try { dt.items.add(f); } catch (_e) {  }
            }
          });
          const staged = dt.files.length;
          if (staged === 0) continue;

          
          
          let assigned = 0;
          try {
            input.files = dt.files;
            assigned = input.files.length;
          } catch (_e) {
            try {
              Object.defineProperty(input, "files", { value: dt.files, writable: false, configurable: true });
              assigned = input.files.length;
            } catch (_e2) {  }
          }
          
          
          
          
          if (assigned === 0) {
            traceLog("[XuSearch paste] fileInput assign failed (input.files empty after set), selector =", selector);
            continue;
          }

          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          
          traceLog("[XuSearch paste] fileInput fallback SUCCESS, selector =", selector,
            "staged =", staged, "assigned =", assigned, "afterDispatch =", input.files.length);
          diagnosticLog("inject.paste", "file-input-fallback", {
            selector,
            fileCount: assigned,
          });
          return true;
        } catch (error) {
          console.error("[XuSearch paste] fileInput fallback error for selector =", selector, ":", error.message);
          diagnosticLog("inject.paste", "file-input-fallback-error", { selector, error: error.message });
        }
      }
    }
  }
  return false;
}


async function tryHoverTriggerUpload(files) {
  const uploadBtnSelectors = [
    "#Tag_UploadButton",
    ".ant-dropdown-trigger[id*='Upload']",
    "button.ant-dropdown-trigger",
  ];

  let uploadBtn = null;
  for (const sel of uploadBtnSelectors) {
    try {
      uploadBtn = document.querySelector(sel);
      if (uploadBtn) {
        traceLog("[XuSearch paste] hover-trigger: found upload button via", sel);
        break;
      }
    } catch (_e) {  }
  }

  if (!uploadBtn) {
    traceLog("[XuSearch paste] hover-trigger: no upload button found");
    return false;
  }

  
  traceLog("[XuSearch paste] hover-trigger: dispatching mouseenter/mouseover to", uploadBtn.tagName, uploadBtn.id);
  try {
    uploadBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
    uploadBtn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
    uploadBtn.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
  } catch (err) {
    traceLog("[XuSearch paste] hover-trigger: mouse events failed:", err.message);
  }

  
  traceLog("[XuSearch paste] hover-trigger: waiting for .js-input-file to appear...");
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const inputs = document.querySelectorAll(".js-input-file");
    if (inputs.length > 0) {
      traceLog("[XuSearch paste] hover-trigger: found", inputs.length, ".js-input-file elements");
      const ok = tryAssignFileInputs([".js-input-file"], files);
      if (ok) return true;

      
      const dropdownInputs = document.querySelectorAll(".ant-dropdown input[type='file']");
      if (dropdownInputs.length > 0) {
        traceLog("[XuSearch paste] hover-trigger: trying ant-dropdown inputs:", dropdownInputs.length);
        const ok2 = tryAssignFileInputs([".ant-dropdown input[type='file']"], files);
        if (ok2) return true;
      }
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  
  traceLog("[XuSearch paste] hover-trigger: trying click on upload button");
  try {
    uploadBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    const ok = tryAssignFileInputs([".js-input-file", "input[type='file']"], files);
    if (ok) return true;
  } catch (_e) {  }

  traceLog("[XuSearch paste] hover-trigger: all attempts failed");
  return false;
}


async function findInputElement(selectors, timeoutMs = 4000) {
  const list = (Array.isArray(selectors) ? selectors : [selectors]).filter(Boolean);
  if (list.length === 0) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    for (const selector of list) {
      try {
        const el = document.querySelector(selector);
        if (el) return el;
      } catch (_error) {
        
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return null;
}


const DEFAULT_INPUT_SELECTORS = [
  '[contenteditable="true"]',
  "textarea",
  'input[type="text"]'
];


async function refindVisibleTarget(selectors, current, waitMs) {
  const list = (Array.isArray(selectors) ? selectors : [selectors]).filter(Boolean);
  const deadline = Date.now() + waitMs;
  const keep = (el, reason) => {
    traceLog("[XuSearch paste] refind:", reason, `采用=${elementBrief(el)}`);
    return el;
  };
  while (true) {
    const focused = focusedSelectorMatch(list);
    if (focused) {
      if (focused !== current) safeFocus(focused);
      return keep(focused, "采用站点焦点元素（真实粘贴落点）");
    }
    if (isUsableEditor(current)) return keep(current, "当前节点仍可用，保持不动");
    for (const selector of list) {
      let matches = [];
      try {
        matches = Array.from(document.querySelectorAll(selector)).filter(isUsableEditor);
      } catch (_error) {
        continue;
      }
      if (matches.length) {
        const fresh = matches[matches.length - 1];
        if (fresh !== current) safeFocus(fresh);
        return keep(fresh, `命中重找（选择器=${selector} 命中数=${matches.length}）`);
      }
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  traceLog("[XuSearch paste] refind: 无可用匹配，沿用当前节点（连接=" + Boolean(current?.isConnected) + "）");
  return current && current.isConnected ? current : null;
}


function elementBrief(el) {
  if (!el) return "null";
  try {
    const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
    const r = el.getBoundingClientRect();
    return `${el.tagName}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} ${Math.round(r.width)}x${Math.round(r.height)}`;
  } catch (_error) {
    return String(el.tagName || "?");
  }
}


function describeTargetCensus(target, selectors) {
  const list = (Array.isArray(selectors) ? selectors : []).map((sel) => {
    let all = [];
    try {
      all = Array.from(document.querySelectorAll(sel));
    } catch (_error) {
      return `${sel}: 非法选择器`;
    }
    return `${sel}: 命中${all.length}/可用${all.filter(isUsableEditor).length} 末个=${elementBrief(all[all.length - 1])}`;
  }).join(" ; ");
  return `hasFocus=${document.hasFocus()} active=${elementBrief(document.activeElement)} target=${elementBrief(target)} connected=${Boolean(target?.isConnected)} || ${list}`;
}


const MIN_EDITOR_HEIGHT = 20;
function isUsableEditor(el) {
  if (!el || !el.isConnected) return false;
  try {
    const r = el.getBoundingClientRect();
    if (r.height < MIN_EDITOR_HEIGHT || r.width <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  } catch (_error) {
    return false;
  }
}


function focusedSelectorMatch(selectors) {
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  const list = Array.isArray(selectors) ? selectors.filter(Boolean) : [];
  for (const sel of list) {
    try {
      if (active.matches && active.matches(sel)) return active;
    } catch (_error) {
      
    }
  }
  return null;
}




















const ERROR_SELECTORS = [
  '[class*="toast"][class*="error"]',
  '[class*="toast"][class*="warn"]',
  
  
  '[class*="reds-toast"]',
  '#sonner-toaster [data-type="error"]',
  '[data-sonner-toast][data-type="error"]',
  
  '[data-sonner-toaster] [data-type="error"]',
  '[role="alert"]',
  '[class*="notice"][class*="error"]',
  '[class*="message"][class*="error"]',
  '[class*="snackbar"][class*="error"]',
  
  
  '[class*="ant-message-notice-content"]',
  '[class*="ant-message-custom-content"]',
  
  '[data-sonner-toast] [data-title]',
];

const ERROR_KEYWORDS = [
  
  "不支持", "未支持", "格式错误", "过大", "超出", "最多",
  "无法上传", "上传失败", "无效", "限制", "超限", "超过",
  "仅支持", "文件类型",
  
  "unsupported", "invalid", "too large", "exceeds", "maximum",
  "failed", "not allowed", "limit", "file size", "not supported",
  "file type", "only support",
];

function matchesErrorSelector(el, extraSelectors = []) {
  if (!el || el.nodeType !== 1) return null;
  
  
  for (const sel of [...extraSelectors, ...ERROR_SELECTORS]) {
    try {
      if (el.matches?.(sel)) return el;
      const found = el.querySelector?.(sel);
      if (found) return found;
    } catch (_e) {
      
    }
  }
  return null;
}


function isExplicitErrorElement(el) {
  if (!el || el.nodeType !== 1) return false;
  
  if (el.getAttribute?.("data-type") === "error") return true;
  
  const child = el.querySelector?.('[data-type="error"]');
  if (child) return true;
  return false;
}

function textContainsErrorKeyword(text, extraKeywords = []) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return [...ERROR_KEYWORDS, ...extraKeywords].some((kw) =>
    kw.charCodeAt(0) < 128 ? lower.includes(kw.toLowerCase()) : text.includes(kw)
  );
}


function checkNodeForUploadError(node, siteErrorConfig = {}) {
  if (!node || node.nodeType !== 1) return null;
  const errorEl = matchesErrorSelector(node, siteErrorConfig.selectors);
  if (!errorEl) return null;
  let text = errorEl.textContent || "";
  
  
  
  if (!text.trim()) {
    let ancestor = errorEl.parentElement;
    for (let i = 0; i < 3 && ancestor && !text.trim(); i += 1) {
      text = ancestor.textContent || "";
      ancestor = ancestor.parentElement;
    }
  }
  
  
  
  if (text.length > 300) return null;
  
  if (textContainsErrorKeyword(text, siteErrorConfig.keywords) || isExplicitErrorElement(errorEl)) {
    return { errorEl, text };
  }
  return null;
}



export function countUploadSuccessMarkers(selectors) {
  const list = Array.isArray(selectors) ? selectors.filter(Boolean) : [];
  if (list.length === 0) return 0;
  return list.reduce((sum, sel) => {
    try { return sum + document.querySelectorAll(sel).length; } catch (_e) { return sum; }
  }, 0);
}


export function waitForUploadSuccessMarker(selectors, baseline = 0, timeoutMs = 3000) {
  const list = Array.isArray(selectors) ? selectors.filter(Boolean) : [];
  if (list.length === 0) return Promise.resolve(true); 
  const count = () => countUploadSuccessMarkers(list);
  if (count() > baseline) return Promise.resolve(true); 
  return new Promise((resolve) => {
    let settled = false;
    let timerId = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timerId) window.clearTimeout(timerId);
      resolve(ok);
    };
    const observer = new MutationObserver(() => { if (count() > baseline) finish(true); });
    observer.observe(document.body, { childList: true, subtree: true });
    timerId = setTimeout(() => finish(false), timeoutMs);
  });
}

export function watchForUploadError(timeoutMs = 3000, siteErrorConfig = {}) {
  return new Promise((resolve) => {
    let settled = false;
    
    
    
    let timerId = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timerId) window.clearTimeout(timerId);
      resolve(result);
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        
        for (const node of mutation.addedNodes) {
          const result = checkNodeForUploadError(node, siteErrorConfig);
          if (result) {
            traceLog("[XuSearch paste] watchForUploadError: detected error toast (addedNode):", result.text.trim().slice(0, 200));
            diagnosticLog("inject.paste", "upload-error-detected", {
              errorText: result.text.trim().slice(0, 300),
              source: "addedNode",
            });
            finish({ ok: false, error: result.text.trim().slice(0, 300) });
            return;
          }
        }
        
        if (mutation.type === "attributes" && mutation.target) {
          const result = checkNodeForUploadError(mutation.target, siteErrorConfig);
          if (result) {
            traceLog("[XuSearch paste] watchForUploadError: detected error toast (attributeChange):", result.text.trim().slice(0, 200));
            diagnosticLog("inject.paste", "upload-error-detected", {
              errorText: result.text.trim().slice(0, 300),
              source: "attributeChange",
            });
            finish({ ok: false, error: result.text.trim().slice(0, 300) });
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-visible", "data-type", "class", "style"],
    });

    
    
    
    timerId = setTimeout(() => {
      traceLog("[XuSearch paste] watchForUploadError: timeout, no error detected");
      finish({ ok: true });
    }, timeoutMs);

    
    const existing = checkNodeForUploadError(document.body, siteErrorConfig);
    if (existing) {
      traceLog("[XuSearch paste] watchForUploadError: detected pre-existing error toast:", existing.text.trim().slice(0, 200));
      finish({ ok: false, error: existing.text.trim().slice(0, 300) });
    }
  });
}

export async function deliverFilesToInput(fileEntries, explicitSelectors, uploadVia = "auto", options = {}) {
  
  const baselineSuccessCount = countUploadSuccessMarkers(options.uploadSuccessSelectors);
  traceLog("[XuSearch paste] deliverFilesToInput start, entries =", fileEntries?.length, "explicitSelectors =", explicitSelectors, "uploadVia =", uploadVia);
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) {
    traceLog("[XuSearch paste] deliverFilesToInput: no entries, returning false");
    return false;
  }

  const files = (await Promise.all(fileEntries.map(blobToFile)))
    .filter((f) => f instanceof Blob);
  if (files.length === 0) {
    traceLog("[XuSearch paste] deliverFilesToInput: reconstruct failed, no valid Blob");
    diagnosticLog("inject.paste", "reconstruct-failed", { expected: fileEntries.length });
    return false;
  }
  traceLog("[XuSearch paste] reconstructed", files.length, "File objects:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));

  const selectors = Array.isArray(explicitSelectors) && explicitSelectors.length > 0
    ? explicitSelectors
    : DEFAULT_INPUT_SELECTORS;

  let target = await findInputElement(selectors);
  traceLog("[XuSearch paste] findInputElement result:", target ? { tag: target.tagName, id: target.id, className: typeof target.className === "string" ? target.className.slice(0, 80) : "" } : "null", "selectors =", selectors);
  if (!target) {
    traceLog("[XuSearch paste] deliverFilesToInput: input element not found, returning false");
    diagnosticLog("inject.paste", "input-not-found", { selectors });
    return false;
  }

  
  safeFocus(target);
  await new Promise((resolve) => setTimeout(resolve, 300));

  
  
  
  
  
  target = await refindVisibleTarget(selectors, target, 2000);
  if (!target) {
    traceLog("[XuSearch paste] refind: 目标已脱离文档且无可见匹配, 放弃本次派发");
    return { delivered: false, error: undefined };
  }

  let dispatched = false;
  let handled = false;

  
  
  
  
  
  
  
  
  const focusOnTarget = () => {
    try {
      return document.hasFocus()
        && (document.activeElement === target
          || (typeof target.contains === "function" && target.contains(document.activeElement)));
    } catch (_error) {
      return false;
    }
  };
  
  
  
  
  
  
  const focusFrame = () => {
    try {
      window.__XUSEARCH_FOCUS_ALLOW__ = true;
      window.__XUSEARCH_FOCUS_ALLOW_TS__ = Date.now();
      window.focus();
    } catch (_error) {
      
    }
  };
  if (!focusOnTarget()) {
    traceLog("[XuSearch paste] 派发前焦点已丢，补聚焦（帧+元素）并等其就位…");
    diagnosticLog("inject.paste", "refocus-before-dispatch", {
      targetTag: target?.tagName,
      hasFocus: document.hasFocus(),
    });
    focusFrame();
    safeFocus(target);
    const focusDeadline = Date.now() + 300;
    while (!focusOnTarget() && Date.now() < focusDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    if (!focusOnTarget()) {
      const site = describeTargetCensus(target, selectors);
      traceLog("[XuSearch paste] 焦点 300ms 内未就位，再补一轮聚焦后照常派发；现场:", site);
      diagnosticLog("inject.paste", "focus-not-ready", { detail: site });
      focusFrame();
      safeFocus(target);
    }
  }

  
  
  
  
  
  if (uploadVia !== "drop" && uploadVia !== "file" && uploadVia !== "drop-auto") {
    try {
      const result = dispatchPaste(target, files);
      dispatched = result.dispatched;
      handled = result.handled;
      traceLog("[XuSearch paste] dispatchPaste result:", result);
    } catch (error) {
      console.error("[XuSearch paste] dispatchPaste error:", error.message);
      diagnosticLog("inject.paste", "dispatch-error", { error: error.message });
      dispatched = false;
    }
  }

  
  if (uploadVia === "file") {
    traceLog("[XuSearch paste] uploadVia=file, trying fileInput directly...");
    diagnosticLog("inject.paste", "trying-file-input-direct", {});
    const fallbackOk = await tryFileInputFallback(files, options);
    traceLog("[XuSearch paste] fileInput result:", fallbackOk);
    if (fallbackOk) {
      
      
      
      dispatched = true;
      handled = true;
    }
  } else if (uploadVia === "drop" || uploadVia === "drop-auto" || (dispatched && !handled)) {
    traceLog("[XuSearch paste] paste not handled, trying drop event...");
    diagnosticLog("inject.paste", "trying-drop", {});
    try {
      
      
      
      
      
      
      const generalStyle = uploadVia !== "drop";
      const dropResult = dispatchDrop(target, files, generalStyle, generalStyle);
      traceLog("[XuSearch paste] drop result:", dropResult);
      if (dropResult.dispatched) {
        dispatched = true;
      }
      if (dropResult.dispatched && dropResult.handled) {
        handled = true;
      }
    } catch (dropErr) {
      traceLog("[XuSearch paste] drop dispatch error:", dropErr.message);
    }

    
    if (!handled) {
      traceLog("[XuSearch paste] drop not handled, trying fileInput fallback...");
      diagnosticLog("inject.paste", "trying-file-input-fallback", {});
      const fallbackOk = await tryFileInputFallback(files, options);
      traceLog("[XuSearch paste] fileInput fallback result:", fallbackOk);
      if (fallbackOk) {
        handled = true;
      }
    }
  }

  
  
  
  await new Promise((resolve) => setTimeout(resolve, 400));

  traceLog("[XuSearch paste] deliverFilesToInput done, dispatched =", dispatched, "handled =", handled);
  const delivered = dispatched && handled;

  
  
  
  let errorResult = { ok: true };
  
  
  
  let confirmed = false;
  
  
  
  const watchMs = Number.isFinite(options.uploadErrorWindowMs) && options.uploadErrorWindowMs > 0
    ? options.uploadErrorWindowMs
    : 3000;
  if (delivered) {
    traceLog("[XuSearch paste] starting watchForUploadError...");
    
    
    const siteErrorConfig = {
      selectors: Array.isArray(options.uploadErrorSelectors) ? options.uploadErrorSelectors.filter(Boolean) : [],
      keywords: Array.isArray(options.uploadErrorKeywords) ? options.uploadErrorKeywords.filter(Boolean) : [],
    };
    const successSelectors = Array.isArray(options.uploadSuccessSelectors)
      ? options.uploadSuccessSelectors.filter(Boolean)
      : [];

    if (successSelectors.length === 0) {
      
      errorResult = await watchForUploadError(watchMs, siteErrorConfig);
      traceLog("[XuSearch paste] watchForUploadError result:", errorResult);
    } else {
      
      
      
      
      
      const errorP = watchForUploadError(watchMs, siteErrorConfig).then((r) => ({ kind: "error", r }));
      const markerP = waitForUploadSuccessMarker(successSelectors, baselineSuccessCount, watchMs).then((ok) => ({ kind: "marker", ok }));
      const first = await Promise.race([errorP, markerP]);
      if (first.kind === "error") {
        if (!first.r.ok) {
          errorResult = first.r;
          traceLog("[XuSearch paste] watchForUploadError result:", errorResult);
        } else {
          
          
          
          
          const m = await markerP;
          if (m.ok) {
            confirmed = true;
            traceLog("[XuSearch paste] 附件数:", baselineSuccessCount, "→", countUploadSuccessMarkers(successSelectors), "成功标记判定: 已新增 ✅");
          } else {
            errorResult = { ok: false, error: "未检测到上传结果（该站点可能不支持此文件格式）", unconfirmed: true };
            
            
            traceLog("[XuSearch paste] 附件数:", baselineSuccessCount, "→", countUploadSuccessMarkers(successSelectors), "成功标记判定: 未检测到新增 ❌");
          }
        }
      } else if (first.ok) {
        
        
        traceLog("[XuSearch paste] 附件数:", baselineSuccessCount, "→", countUploadSuccessMarkers(successSelectors), "（竞速抢先判定成功）");
        const grace = await Promise.race([
          errorP,
          new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (grace && grace.kind === "error" && !grace.r.ok) {
          errorResult = grace.r;
          traceLog("[XuSearch paste] 宽限期内捕获错误 toast:", errorResult.error);
        } else {
          confirmed = true;
          traceLog("[XuSearch paste] 成功标记判定: 已新增 ✅");
        }
      } else {
        
        
        const errRes = await errorP;
        errorResult = errRes.r.ok
          ? { ok: false, error: "未检测到上传结果（该站点可能不支持此文件格式）", unconfirmed: true }
          : errRes.r;
        traceLog("[XuSearch paste] 附件数:", baselineSuccessCount, "→", countUploadSuccessMarkers(successSelectors), "成功标记判定: 未检测到新增 ❌");
      }
    }
  }

  
  
  
  
  
  
  
  
  
  
  return {
    delivered,
    error: errorResult.ok ? undefined : errorResult.error,
    confirmed,
    unconfirmed: !errorResult.ok && !!errorResult.unconfirmed,
  };
}



export function extractInputSelectorsFromHandler(handlerConfig) {
  if (!handlerConfig || !Array.isArray(handlerConfig.steps)) return [];

  const collect = (step) => {
    if (!step) return [];
    if (Array.isArray(step.selectors)) return step.selectors.filter(Boolean);
    if (Array.isArray(step.selector)) return step.selector.filter(Boolean);
    if (typeof step.selector === "string") return [step.selector];
    return [];
  };

  const focusStep = handlerConfig.steps.find((s) => s?.action === "focus");
  const focusSelectors = collect(focusStep);
  if (focusSelectors.length > 0) return focusSelectors;

  for (const step of handlerConfig.steps) {
    const got = collect(step);
    if (got.length > 0) return got;
  }
  return [];
}
