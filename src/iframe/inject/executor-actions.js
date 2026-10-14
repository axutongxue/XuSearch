

import { traceLog } from "../../shared/diagnostics.js";
import { delay } from "./constants.js";
import {
  safeFocus,
  isTextControl,
  setNativeValue,
  dispatchEventList,
  dispatchKeyboardEvent,
  detectInputType,
} from "./dom-utils.js";
import { setContenteditableValue } from "./editors.js";
import {
  findElement,
  getSelectors,
  readElementValue,
  activateSubmitButton,
  dispatchPointerLikeEvent,
  dispatchSubmitKeys,
  isSafeToSubmitForm,
  isUsableSubmitButton,
  findBestSubmitButton,
  isAnySelectorPresent,
} from "./executor-dom.js";



const STOP_SIGNAL_VERIFY_MS = 2000;
const VERIFY_POLL_INTERVAL_MS = 100;

export async function executeFocus(step) {
  const element = await findElement(step);
  
  safeFocus(element, { optional: true });
  if (!step.skipClick && typeof element.click === "function") {
    element.click();
  }
}

export async function executeSetValue(step, query) {
  const text = String(query || "");
  
  
  const fullText = step.prefix ? String(step.prefix) + text : text;
  const maxAttempts = step.maxAttempts || 12;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const element = await findElement(step);
    
    
    safeFocus(element, { optional: isTextControl(element) });

    let inputType = step.inputType === "auto"
      ? detectInputType(element)
      : (step.inputType || detectInputType(element));

    if (inputType === "text" && !isTextControl(element)) {
      inputType = "contenteditable";
      try {
        if (element.getAttribute("contenteditable") !== "true") {
          element.setAttribute("contenteditable", "true");
        }
      } catch (_error) {
        
      }
    }

    try {
      if (inputType === "execCommand") {
        
        
        
        const written = await setContenteditableValue(element, fullText, false, "execCommand");
        if (written && text) return;
      } else if (inputType === "contenteditable") {
        traceLog("[XuSearch setValue] contenteditable 分支, tagName=", element.tagName, "class=", (element.className || "").toString().slice(0, 80), "hasQuillTag=", !!element.querySelector(".quill-application-tag, [data-class-name*='application-blot']"));
        
        
        
        const written = await setContenteditableValue(element, fullText);
        if (written && text) return;
      } else if (isTextControl(element)) {
        setNativeValue(element, fullText);
        dispatchEventList(element, ["input", "change"]);
      } else {
        throw new Error("目标元素不是可写输入控件");
      }
    } catch (error) {
      lastError = error;
    }

    if (!text) return;

    await delay(60 + attempt * 40);

    const current = await readCurrentValue(step);
    if (current.includes(fullText) && await valueRemainsStable(step, fullText)) return;
  }

  if (lastError) throw lastError;
  throw new Error("写入输入框后内容未生效");
}

async function valueRemainsStable(step, text) {
  const stableWaitMs = Number.isFinite(step.stableWaitMs) ? step.stableWaitMs : 0;
  if (stableWaitMs <= 0) {
    return true;
  }

  const deadline = Date.now() + stableWaitMs;
  while (Date.now() < deadline) {
    await delay(Math.min(120, deadline - Date.now()));
    const current = await readCurrentValue(step);
    if (!current.includes(text)) {
      return false;
    }
  }

  return true;
}

export async function readCurrentValue(step) {
  try {
    const element = await findElement(step);
    if (!element) return "";
    if (isTextControl(element)) return String(element.value || "");
    return String(element.textContent || "");
  } catch (_error) {
    return "";
  }
}

export async function executeTriggerEvents(step) {
  const element = await findElement(step);
  const events = Array.isArray(step.events) ? step.events : [];
  const filtered = element && element.isContentEditable
    ? events.filter((name) => name !== "input" && name !== "beforeinput")
    : events;
  dispatchEventList(element, filtered);
}

export async function executeHover(step, context) {
  const element = await findElement(step);
  if (!element) throw new Error("未找到悬停目标");

  
  
  const skipIfTexts = Array.isArray(step.skipIfTexts)
    ? step.skipIfTexts.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (skipIfTexts.length > 0) {
    const label = (element.textContent || "").trim();
    if (skipIfTexts.includes(label)) {
      traceLog("[XuSearch hover] 目标已达成(文本匹配), 跳过悬停:", label);
      if (step.setFlag && context) context[step.setFlag] = true;
      return;
    }
  }

  try {
    
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const mouseInit = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    const pointerInit = { ...mouseInit, pointerId: 1, pointerType: "mouse", isPrimary: true, buttons: 1 };

    
    
    element.dispatchEvent(new PointerEvent("pointerenter", pointerInit));
    element.dispatchEvent(new PointerEvent("pointerover", pointerInit));
    element.dispatchEvent(new PointerEvent("pointermove", pointerInit));
    
    element.dispatchEvent(new MouseEvent("mouseenter", mouseInit));
    element.dispatchEvent(new MouseEvent("mouseover", mouseInit));
    element.dispatchEvent(new MouseEvent("mousemove", mouseInit));
  } catch (_error) {
    
  }
}

export async function executeClick(step) {
  const selectors = getSelectors(step);
  if (selectors.length === 0) throw new Error("缺少选择器");

  const timeoutMs = Number.isFinite(step.timeout) ? step.timeout : 1500;
  const deadline = Date.now() + timeoutMs;
  let lastSeen = null;

  while (Date.now() <= deadline) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      lastSeen = element;
      if (isUsableSubmitButton(element)) {
        activateSubmitButton(element);
        return true;
      }
    }
    await delay(25);
  }

  if (!lastSeen) throw new Error(`未找到元素: ${selectors.join(", ")}`);
  throw new Error("目标按钮处于禁用态");
}

export async function executeSendKeys(step) {
  const element = step.selector || step.selectors
    ? await findElement(step)
    : document.activeElement;
  if (!element) throw new Error("没有可发送按键的目标元素");

  const keys = Array.isArray(step.keys) ? step.keys : [];
  for (const key of keys) {
    dispatchKeyboardEvent(element, "keydown", key);
    dispatchKeyboardEvent(element, "keypress", key);
    dispatchKeyboardEvent(element, "keyup", key);
  }
}

export async function executeSmartSubmit(step, query, context = {}) {
  const anchor = step.selector || step.selectors
    ? await findElement(step)
    : document.activeElement;
  if (!anchor) throw new Error("没有可用于提交的输入元素");

  
  
  safeFocus(anchor, { optional: isTextControl(anchor) });

  
  
  if (step.forceRequestSubmit === true) {
    const form = typeof anchor.closest === "function" ? anchor.closest("form") : null;
    if (form && typeof form.requestSubmit === "function") {
      traceLog("[XuSearch smartSubmit] forceRequestSubmit 直接提交表单");
      form.requestSubmit();
      return true;
    }
  }

  const submitSelectors = Array.isArray(step.submitSelectors) && step.submitSelectors.length > 0
    ? step.submitSelectors
    : [
        "button[type='submit']",
        "button[aria-label*='发送']",
        "button[aria-label*='Send']",
        "button[title*='发送']",
        "button[title*='Send']",
        "[role='button'][aria-label*='发送']",
        "[role='button'][aria-label*='Send']",
      ];

  
  
  const stopSelectors = Array.isArray(context.stopButtonSelectors) && context.stopButtonSelectors.length > 0
    ? context.stopButtonSelectors
    : null;

  
  const waitMs = Number.isFinite(step.submitWaitMs) ? step.submitWaitMs : 3000;
  const deadline = Date.now() + waitMs;
  while (Date.now() <= deadline) {
    const candidate = findBestSubmitButton(anchor, submitSelectors);
    if (candidate) {
      const sig = getControlSignatureForLog(candidate);
      traceLog("[XuSearch smartSubmit] 找到发送按钮:", sig, "点击中...");
      
      
      
      if (stopSelectors) {
        const stopBaselineAbsent = !isAnySelectorPresent(stopSelectors);
        context.stopButtonBaselineAbsent = context.stopButtonBaselineAbsent === true || stopBaselineAbsent;
      }
      
      const clickTarget = activateSubmitButton(candidate);
      traceLog(
        "[XuSearch smartSubmit] 找到发送按钮:",
        sig,
        clickTarget && clickTarget !== candidate
          ? `(靶子=内层 ${clickTarget.tagName.toLowerCase()})`
          : "(靶子=按钮本身)",
        "点击中..."
      );
      if (step.enterFallbackAfterClick !== false && await shouldTryKeyboardFallbackAfterClick(step, query, anchor, stopSelectors, context.stopButtonBaselineAbsent)) {
        traceLog("[XuSearch smartSubmit] 点击后文本仍在输入框, 尝试回车兜底");
        const retryCandidate = findBestSubmitButton(anchor, submitSelectors);
        if (retryCandidate && retryCandidate !== candidate) {
          activateSubmitButton(retryCandidate);
          await delay(120);
        }
        dispatchSubmitKeys(anchor);
      }
      return true;
    }
    await delay(25);
  }

  traceLog("[XuSearch smartSubmit] 未找到发送按钮, selectors=", submitSelectors.join(", "), "尝试表单/回车兜底");

  const form = typeof anchor.closest === "function" ? anchor.closest("form") : null;
  
  
  
  if (form && (step.forceRequestSubmit === true || isSafeToSubmitForm(form))) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }
    if (typeof form.submit === "function") {
      form.submit();
      return true;
    }
  }

  dispatchSubmitKeys(anchor);
  return false;
}

function getControlSignatureForLog(element) {
  if (!element) return "null";
  const parts = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-testid"),
    element.getAttribute("class"),
  ];
  const svgClass = element.querySelector ? Array.from(element.querySelectorAll("svg"))
    .map((s) => s.getAttribute("class")).filter(Boolean)[0] : "";
  const text = (element.textContent || "").trim().slice(0, 30);
  return [text, parts.filter(Boolean).join(" "), svgClass].filter(Boolean).join(" | ");
}







async function shouldTryKeyboardFallbackAfterClick(step, query, anchor, stopSelectors, context) {
  const text = String(query || "").trim();
  if (!text) return false;

  const useStopSignal = !!(stopSelectors && context.stopButtonBaselineAbsent);
  const waitMs = useStopSignal
    ? (Number.isFinite(step.submitSuccessWaitMs) ? step.submitSuccessWaitMs : STOP_SIGNAL_VERIFY_MS)
    : (Number.isFinite(step.postClickVerifyMs) ? step.postClickVerifyMs : 900);
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    if (useStopSignal && isAnySelectorPresent(stopSelectors)) {
      
      context.stopButtonSeen = true;
      traceLog("[XuSearch smartSubmit] 停止按钮已出现，判定提交成功");
      return false;
    }
    if (!readCurrentValueNow(step, anchor).includes(text)) {
      return false;
    }
    await delay(VERIFY_POLL_INTERVAL_MS);
  }
  return true;
}

function readCurrentValueNow(step, anchor) {
  const anchorText = readElementValue(anchor);
  if (anchorText) return anchorText;

  for (const selector of getSelectors(step)) {
    const element = document.querySelector(selector);
    const value = readElementValue(element);
    if (value) return value;
  }

  return "";
}


export async function executeWaitForSelector(step) {
  const selectors = getSelectors(step);
  if (selectors.length === 0) throw new Error("waitForSelector 缺少选择器");

  const timeoutMs = Number.isFinite(step.timeout) ? step.timeout : 15000;
  const intervalMs = Number.isFinite(step.interval) ? step.interval : 200;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    for (const selector of selectors) {
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length > 0) {
          const visible = Array.from(matches).some(
            (el) => el instanceof HTMLElement
              && el.getBoundingClientRect().width > 0
              && el.getBoundingClientRect().height > 0
          );
          if (visible) return;
        }
      } catch (_error) {
        
      }
    }
    await delay(intervalMs);
  }

  throw new Error(`waitForSelector 超时: ${selectors.join(", ")}`);
}









function looksExpanded(el) {
  if (!el) return false;
  if (typeof el.getAttribute === "function") {
    const expanded = el.getAttribute("aria-expanded");
    if (expanded === "true") return true;
    const pressed = el.getAttribute("aria-pressed");
    if (pressed === "true") return true;
    const state = el.getAttribute("data-state");
    if (state === "open") return true;
  }
  if (typeof el.classList === "object") {
    const cls = Array.from(el.classList);
    if (cls.some((c) => c.includes("expanded") || c.includes("is-open") || c.includes("active") || c.includes("selected"))) {
      return true;
    }
  }
  return false;
}

export async function executeClickIfText(step, context) {
  const selectors = getSelectors(step);
  const texts = Array.isArray(step.texts) && step.texts.length > 0
    ? step.texts.map((t) => String(t))
    : [];
  const rangeSelectors = selectors.length > 0 ? selectors : ["button"];
  const matchMode = step.matchMode === "exact" ? "exact" : "includes";
  const excludeSelected = step.excludeSelected !== false;
  const selectedClass = Array.isArray(step.selectedClass)
    ? step.selectedClass.filter(Boolean)
    : (step.selectedClass ? [String(step.selectedClass)] : []);
  const preHover = step.preHover === true;
  const usePointerEvents = step.usePointerEvents === true;
  const unselect = step.unselect === true;
  const timeoutMs = Number.isFinite(step.timeout) ? step.timeout : 20000;
  const intervalMs = Number.isFinite(step.interval) ? step.interval : 500;
  const clickAll = step.clickAll === true;
  const skipIfTexts = Array.isArray(step.skipIfTexts)
    ? step.skipIfTexts.map((t) => String(t).trim()).filter(Boolean)
    : [];
  
  
  
  const openTrigger = step.openTrigger
    ? {
        selectors: Array.isArray(step.openTrigger.selectors) ? step.openTrigger.selectors : [],
        usePointerEvents: step.openTrigger.usePointerEvents === true,
        interval: Number.isFinite(step.openTrigger.interval) ? step.openTrigger.interval : 1500,
      }
    : null;
  
  
  
  
  
  
  
  const verifySelectors = Array.isArray(step.verifySelectors)
    ? step.verifySelectors.filter(Boolean)
    : [];
  
  
  
  const skipIfSelectors = Array.isArray(step.skipIfSelectors)
    ? step.skipIfSelectors.filter(Boolean)
    : [];
  
  
  
  
  const verifyAbsentSelectors = Array.isArray(step.verifyAbsentSelectors)
    ? step.verifyAbsentSelectors.filter(Boolean)
    : [];
  
  
  
  
  
  
  
  
  
  
  
  const verifyBoxSelectors = Array.isArray(step.verifyBoxSelectors)
    ? step.verifyBoxSelectors.filter(Boolean)
    : [];
  const verifyAbsentBoxSelectors = Array.isArray(step.verifyAbsentBoxSelectors)
    ? step.verifyAbsentBoxSelectors.filter(Boolean)
    : [];
  const startedAt = Date.now();
  let lastOpenTriggerAt = 0;

  
  
  
  
  
  
  
  
  
  
  
  
  const isVisibleLoose = (el) =>
    el instanceof HTMLElement && typeof el.getClientRects === "function" && el.getClientRects().length > 0;
  const isVisibleHitTest = (el) => {
    if (!isVisibleLoose(el)) return false;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
    let hit = null;
    try {
      hit = document.elementFromPoint(x, y);
    } catch (_error) {
      return false;
    }
    return !!hit && (hit === el || el.contains(hit));
  };

  const isVerifyPresent = () => {
    for (const sel of verifySelectors) {
      try {
        const el = document.querySelector(sel);
        if (isVisibleLoose(el)) return true;
      } catch (_error) {
        
      }
    }
    return false;
  };

  const isSkipHit = () => {
    for (const sel of skipIfSelectors) {
      try {
        const el = document.querySelector(sel);
        if (isVisibleHitTest(el)) return sel;
      } catch (_error) {
        
      }
    }
    return null;
  };

  const isVerifyAbsentSatisfied = () => {
    if (verifyAbsentSelectors.length === 0) return false;
    for (const sel of verifyAbsentSelectors) {
      try {
        const el = document.querySelector(sel);
        if (isVisibleLoose(el)) return false; 
      } catch (_error) {
        
      }
    }
    return true;
  };

  
  
  
  
  
  const hasInstanceInViewport = (sel) => {
    let els = [];
    try {
      els = Array.from(document.querySelectorAll(sel));
    } catch (_error) {
      return false; 
    }
    for (const el of els) {
      if (!el.getBoundingClientRect) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right > 0 && r.left < window.innerWidth) return true;
    }
    return false;
  };
  const isVerifyBoxPresent = () => verifyBoxSelectors.some((sel) => hasInstanceInViewport(sel));
  const isVerifyAbsentBoxSatisfied = () =>
    verifyAbsentBoxSelectors.length > 0 &&
    verifyAbsentBoxSelectors.every((sel) => !hasInstanceInViewport(sel));

  
  
  if (skipIfTexts.length > 0) {
    for (const selector of rangeSelectors) {
      let els = [];
      try {
        els = Array.from(document.querySelectorAll(selector));
      } catch (_error) {
        continue;
      }
      for (const el of els) {
        if (!(el instanceof Element)) continue;
        const label = (el.textContent || "").trim();
        if (skipIfTexts.includes(label)) {
          traceLog("[XuSearch clickIfText] 目标已达成(文本匹配), 跳过点击:", label);
          
          if (step.setFlag && context) context[step.setFlag] = true;
          return;
        }
      }
    }
  }

  const matchesText = (label) => {
    if (texts.length === 0) return true;
    const trimmed = (label || "").trim();
    return texts.some((t) => {
      const key = (t || "").trim();
      if (!key) return false;
      return matchMode === "exact" ? trimmed === key : trimmed.includes(key);
    });
  };

  const isSelected = (el) => {
    if (!excludeSelected) return false;
    if (typeof el.classList === "object") {
      const classes = Array.from(el.classList);
      if (selectedClass.length > 0 && selectedClass.some((c) => classes.includes(c))) return true;
      if (classes.includes("selected")) return true;
      if (classes.some((c) => c.includes("selected"))) return true;
    }
    if (typeof el.getAttribute === "function") {
      const pressed = el.getAttribute("aria-pressed");
      const ariaSelected = el.getAttribute("aria-selected");
      const ariaChecked = el.getAttribute("aria-checked");
      if (pressed === "true" || ariaSelected === "true" || ariaChecked === "true") return true;
    }
    return false;
  };

  const dispatchHover = (el) => {
    try {
      const init = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mouseenter", init));
      el.dispatchEvent(new MouseEvent("mouseover", init));
    } catch (_error) {
      
    }
  };

  
  
  
  
  
  const verifySatisfied = () =>
    verifySelectors.length > 0 &&
    isVerifyPresent() &&
    (verifyAbsentSelectors.length === 0 || isVerifyAbsentSatisfied());
  
  
  
  const verifyBoxSatisfied = () =>
    isVerifyBoxPresent() || isVerifyAbsentBoxSatisfied();

  while (Date.now() - startedAt <= timeoutMs) {
    
    if (verifySatisfied()) {
      traceLog("[XuSearch clickIfText] 验证标记已出现, 状态达标无需点击");
      if (step.setFlag && context) context[step.setFlag] = true;
      return;
    }
    
    if (skipIfSelectors.length > 0) {
      const skipHit = isSkipHit();
      if (skipHit) {
        traceLog("[XuSearch clickIfText] 跳过条件命中(可见元素), 状态达标无需点击:", skipHit);
        if (step.setFlag && context) context[step.setFlag] = true;
        return;
      }
    }
    
    
    
    
    if (verifySelectors.length === 0 && isVerifyAbsentSatisfied()) {
      traceLog("[XuSearch clickIfText] 反向验证通过(目标已全部消失), 状态达标无需点击");
      if (step.setFlag && context) context[step.setFlag] = true;
      return;
    }
    
    
    
    if ((verifyBoxSelectors.length > 0 || verifyAbsentBoxSelectors.length > 0) && verifyBoxSatisfied()) {
      traceLog(
        "[XuSearch clickIfText] 几何验证通过, 状态达标无需点击:",
        verifyAbsentBoxSelectors.length > 0 ? `目标已移出视口(${verifyAbsentBoxSelectors.join(", ")})` : `目标已在视口内(${verifyBoxSelectors.join(", ")})`
      );
      if (step.setFlag && context) context[step.setFlag] = true;
      return;
    }
    
    
    if (context.isStale && context.isStale()) {
      traceLog("[XuSearch clickIfText] 检测到更新的侧栏指令, 本链中止");
      return;
    }
    let clickedAny = false;
    let skipped = 0;

    for (const selector of rangeSelectors) {
      let elements = [];
      try {
        elements = Array.from(document.querySelectorAll(selector));
      } catch (_error) {
        continue;
      }
      for (const el of elements) {
        
        
        
        
        if (!(el instanceof Element)) continue;
        const label = (el.textContent || "").trim();
        
        if (texts.length > 0 && !label) continue;
        if (!matchesText(label)) continue;
        const selected = isSelected(el);
        if (unselect) {
          
          if (!selected) {
            skipped += 1;
            continue;
          }
          traceLog("[XuSearch clickIfText] 取消选中:", label, "selector=", selector, "mode=", matchMode);
        } else {
          
          if (selected) {
            skipped += 1;
            continue;
          }
          traceLog("[XuSearch clickIfText] 点击:", label, "selector=", selector, "mode=", matchMode);
        }
        if (preHover) dispatchHover(el);
        if (usePointerEvents) {
          
          
          
          activateSubmitButton(el);
        } else if (typeof el.click === "function") {
          el.click();
        } else {
          
          
          
          try {
            dispatchPointerLikeEvent(el, "click");
          } catch (_error) {
            
          }
        }
        clickedAny = true;
        if (!clickAll) break;
      }
      if (clickedAny && !clickAll) break;
    }

    if (clickedAny) {
      
      
      
      const hasAnyVerify = verifySelectors.length > 0
        || verifyAbsentSelectors.length > 0
        || verifyBoxSelectors.length > 0
        || verifyAbsentBoxSelectors.length > 0;
      if (!hasAnyVerify) {
        if (step.setFlag && context) context[step.setFlag] = true;
        return;
      }
      traceLog("[XuSearch clickIfText] 已点击, 等待状态验证...");
    }

    
    
    
    
    
    
    if (openTrigger && openTrigger.selectors.length > 0 && Date.now() - lastOpenTriggerAt >= openTrigger.interval) {
      for (const sel of openTrigger.selectors) {
        let trigger = null;
        try {
          trigger = document.querySelector(sel);
        } catch (_error) {
          continue;
        }
        if (trigger instanceof Element) {
          if (looksExpanded(trigger)) {
            traceLog("[XuSearch clickIfText] 触发器已展开, 跳过重开（等待目标渲染）:", sel);
            lastOpenTriggerAt = Date.now();
            break;
          }
          traceLog("[XuSearch clickIfText] 未找到目标，重开弹窗:", sel);
          if (openTrigger.usePointerEvents) {
            activateSubmitButton(trigger);
          } else if (typeof trigger.click === "function") {
            trigger.click();
          }
          lastOpenTriggerAt = Date.now();
          break;
        }
      }
    }

    
    if (skipped > 0 && texts.length > 0) {
      const allMatched = await allMatchedState(rangeSelectors, texts, isSelected, matchesText, unselect);
      if (allMatched) {
        traceLog(unselect
          ? "[XuSearch clickIfText] 目标已全部处于未选中状态, 无需操作"
          : "[XuSearch clickIfText] 目标已全部处于选中状态, 无需点击");
        return;
      }
    }

    await delay(intervalMs);
  }

  const timeoutError = verifyAbsentSelectors.length > 0
    ? `clickIfText 超时: 已点击但目标未消失, verifyAbsentSelectors=${verifyAbsentSelectors.join(", ")}, selectors=${rangeSelectors.join(", ")}`
    : verifySelectors.length > 0
      ? `clickIfText 超时: 已点击但验证标记未出现, verifySelectors=${verifySelectors.join(", ")}, selectors=${rangeSelectors.join(", ")}`
      : `clickIfText 超时: 未找到可点击元素, selectors=${rangeSelectors.join(", ")}, texts=${texts.join(", ")}`;
  traceLog("[XuSearch clickIfText] 超时失败:", timeoutError, "检查元素是否存在或选择器是否过时");
  throw new Error(timeoutError);
}

async function allMatchedState(rangeSelectors, texts, isSelected, matchesText, unselect) {
  for (const selector of rangeSelectors) {
    let elements = [];
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (_error) {
      continue;
    }
    for (const el of elements) {
      if (!(el instanceof Element)) continue;
      const label = (el.textContent || "").trim();
      if (texts.length > 0 && !label) continue;
      if (!matchesText(label)) continue;
      const selected = isSelected(el);
      
      if (unselect ? selected : !selected) return false;
    }
  }
  return true;
}
