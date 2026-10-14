

export const HANDLER_CHAIN_IDS = {
  PRIMARY: "primary",
  FALLBACK: "fallback",
  GENERIC: "generic",
};

export const HANDLER_ERROR_CODE = {
  HANDLERS_EXHAUSTED: "HANDLERS_EXHAUSTED",
  NOT_READY: "NOT_READY",
  FATAL: "FATAL",
};

const UNIVERSAL_INPUT_SELECTORS = [
  "[role='textbox']",
  "div[contenteditable='true']",
  "textarea:not([disabled])",
  "input[type='text']:not([disabled])",
];


export const UNIVERSAL_SUBMIT_SELECTORS = [
  "button[type='submit']",
  "button[aria-label*='Send']",
  "button[aria-label*='send']",
  "button[aria-label*='发送']",
  "button[title*='Send']",
  "button[title*='send']",
  "button[title*='发送']",
  "[role='button'][aria-label*='Send']",
  "[role='button'][aria-label*='send']",
  "[role='button'][aria-label*='发送']",
  "button[data-testid*='send']",
  "button[data-testid*='Send']",
];

const FATAL_ERROR_PATTERN = /查询为空|无效.*处理器|不支持的 action|未匹配到站点配置/i;


export function isFatalHandlerError(message) {
  return FATAL_ERROR_PATTERN.test(String(message || ""));
}


export function collectHandlerChain(site) {
  const chain = [];
  const primary = site?.searchHandler;
  if (primary && Array.isArray(primary.steps) && primary.steps.length > 0) {
    chain.push({ id: HANDLER_CHAIN_IDS.PRIMARY, config: primary });
  }
  const explicit = site?.searchHandlerFallback;
  if (explicit && Array.isArray(explicit.steps) && explicit.steps.length > 0) {
    chain.push({ id: HANDLER_CHAIN_IDS.FALLBACK, config: explicit });
  }
  if (site?.enableGenericFallback !== false) {
    const generic = buildGenericFallbackHandler(primary || explicit);
    if (generic) {
      chain.push({ id: HANDLER_CHAIN_IDS.GENERIC, config: generic });
    }
  }
  return chain;
}


export function buildGenericFallbackHandler(sourceHandler) {
  const inputSelectors = extractInputSelectors(sourceHandler);
  const selectors = dedupeSelectors([
    ...inputSelectors,
    ...UNIVERSAL_INPUT_SELECTORS,
  ]);
  if (selectors.length === 0) {
    return null;
  }

  
  
  
  const prefix = extractSetValuePrefix(sourceHandler);

  const setValueStep = {
    action: "setValue",
    selectors,
    inputType: "auto",
    maxAttempts: 16,
    stableWaitMs: 600,
    description: "通用兜底：写入查询",
  };
  if (prefix) {
    setValueStep.prefix = prefix;
  }

  return {
    submitVerifyWaitMs: 1200,
    submitVerifyRetries: 3,
    steps: [
      {
        action: "focus",
        selectors,
        timeout: 15000,
        description: "通用兜底：聚焦输入框",
      },
      setValueStep,
      {
        action: "smartSubmit",
        selectors,
        submitSelectors: UNIVERSAL_SUBMIT_SELECTORS,
        submitWaitMs: 5000,
        postClickVerifyMs: 1200,
        description: "通用兜底：点击发送按钮",
      },
      {
        action: "sendKeys",
        selectors,
        keys: ["Enter"],
        optional: true,
        description: "通用兜底：回车发送",
      },
    ],
  };
}


export function extractSetValuePrefix(handler) {
  const steps = Array.isArray(handler?.steps) ? handler.steps : [];
  for (const step of steps) {
    if (step?.action === "setValue" && step?.prefix) {
      return String(step.prefix);
    }
  }
  return "";
}


export function extractInputSelectors(handler) {
  const steps = Array.isArray(handler?.steps) ? handler.steps : [];
  const collected = [];
  for (const step of steps) {
    if (step?.action !== "focus" && step?.action !== "setValue" && step?.action !== "smartSubmit") {
      continue;
    }
    const list = Array.isArray(step.selectors) ? step.selectors : [];
    list.forEach((selector) => {
      if (selector) collected.push(String(selector));
    });
  }
  return dedupeSelectors(collected);
}


export function resolveHandlerErrorCode(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return HANDLER_ERROR_CODE.NOT_READY;
  }
  if (attempts.some((item) => isFatalHandlerError(item?.error))) {
    return HANDLER_ERROR_CODE.FATAL;
  }
  const reachedInteraction = attempts.some((item) => item.reachedSubmit);
  if (reachedInteraction) {
    return HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED;
  }
  return HANDLER_ERROR_CODE.NOT_READY;
}


export function errorIndicatesSubmitPhase(errorMessage) {
  const msg = String(errorMessage || "");
  return /发送|submit|smartSubmit|内容仍停留在输入框|按钮/i.test(msg);
}

function dedupeSelectors(selectors) {
  const seen = new Set();
  const result = [];
  for (const raw of selectors) {
    const value = String(raw || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
