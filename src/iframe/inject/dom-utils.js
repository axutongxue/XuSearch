







export function safeFocus(element, options = {}) {
  if (!element || typeof element.focus !== "function") {
    return;
  }
  if (options.optional && window.__XUSEARCH_COMPOSER_WANTS_FOCUS__) {
    return; 
  }
  const prevAllow = window.__XUSEARCH_FOCUS_ALLOW__;
  window.__XUSEARCH_FOCUS_ALLOW__ = true;
  window.__XUSEARCH_FOCUS_ALLOW_TS__ = Date.now();
  try {
    element.focus({ preventScroll: true });
  } catch (_error) {
    element.focus();
  } finally {
    window.__XUSEARCH_FOCUS_ALLOW__ = prevAllow;
  }
}

export function isTextControl(element) {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}

export function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor && typeof descriptor.set === "function") {
    descriptor.set.call(element, value);
    return;
  }
  element.value = value;
}

export function dispatchEventList(element, events) {
  events.forEach((eventName) => {
    let event;
    if (eventName === "input") {
      event = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: "",
        inputType: "insertText",
      });
    } else {
      event = new Event(eventName, { bubbles: true, cancelable: true });
    }
    element.dispatchEvent(event);
  });
}

export function dispatchKeyboardEvent(element, phase, key) {
  const event = new KeyboardEvent(phase, {
    key,
    code: key === "Enter" ? "Enter" : key,
    keyCode: key === "Enter" ? 13 : 0,
    which: key === "Enter" ? 13 : 0,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

export function detectInputType(element) {
  if (element.isContentEditable) {
    return "contenteditable";
  }
  return "text";
}
