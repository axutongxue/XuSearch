import { traceLog } from "../../shared/diagnostics.js";
import { safeFocus } from "./dom-utils.js";







export async function setContenteditableValue(element, query, append = false, strategy = "auto") {
  const text = String(query || "");
  safeFocus(element);

  if (strategy !== "execCommand") {
    
    
    
    
    if (isSlateEditor(element)) {
      updateSlateEditorContent(element, text, append);
      return true;
    }

    
    
    
    
    if (isDraftEditor(element)) {
      await updateDraftEditorContent(element, text, append);
      return true;
    }
  }

  
  
  
  
  
  
  
  if (strategy === "execCommand" && text.includes("\n")) {
    const written = await writeMultilineExecCommand(element, text, append);
    if (written) return true;
    
  }

  
  
  let selectionSet = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    if (append) range.collapse(false);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      selectionSet = true;
    }
  } catch (_error) {
    selectionSet = false;
  }

  
  
  
  
  let inserted = false;
  if (selectionSet || document.activeElement === element) {
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (_error) {
      inserted = false;
    }
  }

  if (inserted) {
    
    
    
    
    
    
    return true;
  }

  
  
  
  const isLexicalEditor =
    element.hasAttribute("data-lexical-editor") ||
    element.getAttribute("data-lexical-editor") === "true";

  if (isLexicalEditor) {
    updateLexicalEditorContent(element, text, append);
    return true;
  }

  updateGenericContenteditable(element, text, append);
  return true;
}


function setElementSelection(element, append) {
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    if (append) range.collapse(false);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch (_error) {
    
  }
}



const MULTILINE_PASTE_SETTLE_MS = 300;




async function writeMultilineExecCommand(element, text, append) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  
  
  try {
    setElementSelection(element, append);
    const baseline = readEditorText(element);
    const dt = new DataTransfer();
    dt.setData("text/plain", lines.join("\n"));
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      })
    );
    await new Promise((resolve) => setTimeout(resolve, MULTILINE_PASTE_SETTLE_MS));
    if (readEditorText(element) !== baseline) return true;
  } catch (_error) {
    
  }

  
  
  
  setElementSelection(element, append);
  let allOk = true;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] && !document.execCommand("insertText", false, lines[i])) {
      allOk = false;
      break;
    }
    if (i < lines.length - 1 && !document.execCommand("insertLineBreak")) {
      allOk = false;
      break;
    }
  }
  if (allOk) {
    const current = readEditorText(element);
    const landed = lines.every((line) => !line.trim() || current.includes(line.trim()));
    if (landed) return true;
  }
  return false;
}

function readEditorText(element) {
  try {
    return String(element.innerText ?? element.textContent ?? "");
  } catch (_error) {
    return String(element.textContent || "");
  }
}

export function isSlateEditor(element) {
  if (!element || typeof element.getAttribute !== "function") {
    return false;
  }
  return (
    element.getAttribute("data-slate-editor") === "true" ||
    element.hasAttribute("data-slate-node") ||
    element.hasAttribute("data-slate-string")
  );
}





export function isDraftEditor(element) {
  if (!element) return false;
  const cls = typeof element.className === "string" ? element.className : "";
  if (cls.includes("public-DraftEditor-content")) return true;
  if (typeof element.querySelector === "function") {
    return !!element.querySelector("[data-contents='true']");
  }
  return false;
}


export async function updateDraftEditorContent(element, query, append = false) {
  safeFocus(element);

  const text = String(query || "");

  
  
  
  
  
  
  
  
  let modelWriteOk = false;
  if (text) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) {
        traceLog(`[XuSearch editors] Draft.js beforeinput 未生效, 重试写入 attempt=${attempt + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      
      try {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          const textNodes = collectDraftTextNodes(element);
          if (textNodes.length > 0) {
            if (append) {
              const lastNode = textNodes[textNodes.length - 1];
              range.setStart(lastNode.node, lastNode.offset);
              range.collapse(true);
            } else {
              const firstNode = textNodes[0];
              const lastNode = textNodes[textNodes.length - 1];
              range.setStart(firstNode.node, firstNode.offset);
              range.setEnd(lastNode.node, lastNode.offset);
            }
          } else {
            range.selectNodeContents(element);
            if (append) range.collapse(false);
          }
          selection.addRange(range);
        }
      } catch (_error) {
        
      }

      
      await new Promise((resolve) => setTimeout(resolve, 50));

      
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
        })
      );
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
        })
      );
      element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

      
      
      
      
      await new Promise((resolve) => setTimeout(resolve, 80));

      if (String(element.textContent || "").includes(text)) {
        modelWriteOk = true;
        break;
      }
    }
  }

  
  
  
  const currentText = String(element.textContent || "");
  if (text && !modelWriteOk && !currentText.includes(text)) {
    if (append) {
      const lastTextSpan = findDraftTextSpan(element, true);
      if (lastTextSpan) {
        lastTextSpan.textContent = (lastTextSpan.textContent || "") + text;
      } else {
        element.textContent = (element.textContent || "") + text;
      }
    } else {
      const firstTextSpan = findDraftTextSpan(element, false);
      if (firstTextSpan) {
        firstTextSpan.textContent = text;
      } else {
        element.textContent = text;
      }
    }
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text })
    );
  }
}


function collectDraftTextNodes(element) {
  const nodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (parent && parent.closest("[contenteditable='false']")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    }
  );
  let node;
  while ((node = walker.nextNode())) {
    nodes.push({ node, offset: node.nodeValue.length });
  }
  return nodes;
}


function findDraftTextSpan(element, last = false) {
  const spans = element.querySelectorAll("[data-text='true'], [data-offset-key] span");
  if (spans.length === 0) return null;
  return last ? spans[spans.length - 1] : spans[0];
}




export function updateSlateEditorContent(element, query, append = false) {
  safeFocus(element);

  
  
  const selection = window.getSelection();
  let selectionSet = false;
  try {
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(element);
      if (append) range.collapse(false);
      selection.addRange(range);
      selectionSet = true;
    }
  } catch (_error) {
    selectionSet = false;
  }

  
  
  if (!append) {
    const existingText = String(element.textContent || "");
    if (existingText.trim()) {
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward",
        })
      );
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward",
        })
      );
    }
  }

  if (!query) {
    return;
  }

  
  
  
  
  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );

  
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );

  
  
  
  
  const stillEmpty = !String(element.textContent || "").trim();
  if (!selectionSet && stillEmpty) {
    const paragraphs = element.querySelectorAll(
      "[data-slate-node='element'], p, div"
    );
    if (paragraphs.length > 0) {
      paragraphs[0].textContent = query;
    } else {
      element.textContent = query;
    }
  }
}

export function updateLexicalEditorContent(element, query, append = false) {
  safeFocus(element);

  
  
  let selectionSet = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    if (append) range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
      selectionSet = true;
    }
  } catch (_error) {
    selectionSet = false;
  }

  
  
  
  dispatchLexicalEvents(element, query);

  
  
  
  const currentText = String(element.textContent || "");
  if (!query || currentText.includes(query)) {
    return;
  }

  if (append) {
    
    const paragraphs = element.querySelectorAll("p");
    const target = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : null;
    const span = document.createElement("span");
    span.setAttribute("data-lexical-text", "true");
    span.textContent = query;
    if (target) {
      target.appendChild(span);
    } else {
      const p = document.createElement("p");
      p.appendChild(span);
      element.appendChild(p);
    }
    return;
  }

  const paragraphs = element.querySelectorAll("p");
  if (paragraphs.length > 0) {
    if (paragraphs.length > 1) {
      for (let i = 1; i < paragraphs.length; i += 1) {
        paragraphs[i].remove();
      }
    }
    const firstParagraph = paragraphs[0];
    firstParagraph.innerHTML = "";
    if (query.trim()) {
      const span = document.createElement("span");
      span.setAttribute("data-lexical-text", "true");
      span.textContent = query;
      firstParagraph.appendChild(span);
    }
  } else {
    element.innerHTML = "";
    const paragraph = document.createElement("p");
    if (query.trim()) {
      const span = document.createElement("span");
      span.setAttribute("data-lexical-text", "true");
      span.textContent = query;
      paragraph.appendChild(span);
    }
    element.appendChild(paragraph);
  }
}

export function updateGenericContenteditable(element, query, append = false) {
  safeFocus(element);

  if (append) {
    
    const paragraphs = element.querySelectorAll("p");
    if (paragraphs.length > 0) {
      const lastP = paragraphs[paragraphs.length - 1];
      lastP.textContent = (lastP.textContent || "") + query;
    } else {
      const p = document.createElement("p");
      p.textContent = query;
      element.appendChild(p);
    }
  } else {
    const paragraphs = element.querySelectorAll("p");
    if (paragraphs.length > 0) {
      if (paragraphs.length > 1) {
        for (let index = 1; index < paragraphs.length; index += 1) {
          paragraphs[index].remove();
        }
      }
      const firstParagraph = paragraphs[0];
      firstParagraph.classList.remove("is-empty", "is-editor-empty");
      firstParagraph.textContent = query;
    } else {
      element.innerHTML = "";
      const paragraph = document.createElement("p");
      paragraph.textContent = query;
      element.appendChild(paragraph);
    }
  }

  dispatchContenteditableEvents(element, query);
}


export function dispatchLexicalEvents(element, query) {
  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );
  element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}


export function dispatchContenteditableEvents(element, query) {
  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    })
  );

  element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  element.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: query }));
  element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: query }));
  element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}


export async function waitForSendButtonReady(element, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const selectors = [
    
    "#yuanbao-send-btn",
    "a[aria-label='发送']",
    "a[aria-label*='发送']",
    "[id*='send-btn']",
    "[class*='send-btn']",
    "span.icon-send",
    "button:has(svg.custom-icon-send-outline)",
    "button[aria-label*='发送']",
    "button[title*='发送']",
    "button[class*='send']",
    "button[aria-label*='send']",
    "button[title*='send']",
  ];
  let foundAny = false; 
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const btn = element.ownerDocument?.querySelector(selector);
        if (!btn) continue;
        foundAny = true;
        if (btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true") continue;
        const rect = btn.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const style = window.getComputedStyle(btn);
        if (style.display === "none" || style.visibility === "hidden") continue;
        return true;
      } catch (_e) {
        
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  
  return !foundAny;
}
