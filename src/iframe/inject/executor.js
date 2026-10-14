

import { traceLog } from "../../shared/diagnostics.js";
import { SUBMIT_ACTIONS, delay } from "./constants.js";
import {
  executeFocus,
  executeSetValue,
  readCurrentValue,
  executeTriggerEvents,
  executeHover,
  executeClick,
  executeSendKeys,
  executeSmartSubmit,
  executeWaitForSelector,
  executeClickIfText,
} from "./executor-actions.js";
import { findElement, getSelectors, isAnySelectorPresent } from "./executor-dom.js";
import {
  safeFocus,
  isTextControl,
  dispatchEventList,
} from "./dom-utils.js";

const FILES_MIN_SUBMIT_WAIT_MS = 20000;
const FILES_MIN_FIND_TIMEOUT_MS = 25000;


const SUBMIT_VERIFY_WAIT_MS = 1000;



const SUBMIT_VERIFY_RETRY_COUNT = 8;

const RETRY_SUBMIT_WAIT_MS = 4500;

const RETRY_BETWEEN_WAIT_MS = 2000;

function applyFilesAwareTimeouts(step) {
  if (step.action !== "smartSubmit" && step.action !== "click") {
    return step;
  }
  const next = { ...step };
  if (next.action === "smartSubmit") {
    next.submitWaitMs = Math.max(
      Number.isFinite(next.submitWaitMs) ? next.submitWaitMs : 0,
      FILES_MIN_SUBMIT_WAIT_MS
    );
  } else if (next.action === "click") {
    next.timeout = Math.max(
      Number.isFinite(next.timeout) ? next.timeout : 0,
      FILES_MIN_FIND_TIMEOUT_MS
    );
  }
  return next;
}

export async function executeSiteHandler(query, handlerConfig, options = {}) {
  if (!handlerConfig || !Array.isArray(handlerConfig.steps) || handlerConfig.steps.length === 0) {
    throw new Error("无效的站点处理器配置");
  }

  const { hasFiles = false } = options;
  
  
  const isStale = typeof options.isStale === "function" ? options.isStale : null;
  const context = { submitted: false, isStale };

  for (const rawStep of handlerConfig.steps) {
    if (isStale && isStale()) {
      traceLog("[XuSearch executor] 检测到更新的侧栏指令, 本链中止");
      return { stopButtonSeen: false };
    }
    const step = hasFiles ? applyFilesAwareTimeouts(rawStep) : rawStep;

    if (context.submitted && SUBMIT_ACTIONS.has(step.action)) {
      continue;
    }

    try {
      await executeStep(step, query, context);
    } catch (error) {
      if (step.optional) continue;
      const label = step.description || step.action || "未知步骤";
      throw new Error(`${label}失败: ${error.message}`);
    }

    if (step.waitAfter) {
      await delay(step.waitAfter);
    }
  }

  await verifySubmittedOrRetry(query, handlerConfig, context, { hasFiles });

  
  
  return { stopButtonSeen: context.stopButtonSeen === true };
}

async function executeStep(step, query, context) {
  
  
  if (step.skipIfFlag && context[step.skipIfFlag]) {
    traceLog(`[XuSearch executor] 跳过步骤(${step.skipIfFlag}): ${step.description || step.action}`);
    return;
  }

  switch (step.action) {
    case "focus":
      await executeFocus(step);
      return;
    case "setValue":
      await executeSetValue(step, query);
      return;
    case "triggerEvents":
      await executeTriggerEvents(step);
      return;
    case "hover":
      await executeHover(step, context);
      return;
    case "waitForSelector":
      await executeWaitForSelector(step);
      return;
    case "clickIfText":
      await executeClickIfText(step, context);
      return;
    case "click":
      if (await executeClick(step)) context.submitted = true;
      return;
    case "wait": {
      
      
      const minMs = Number(step.durationMin);
      const maxMs = Number(step.durationMax);
      const useRange = Number.isFinite(minMs) && Number.isFinite(maxMs) && maxMs > minMs;
      const waitMs = useRange ? minMs + Math.floor(Math.random() * (maxMs - minMs + 1)) : (step.duration || 0);
      if (useRange) traceLog("[XuSearch executor] wait 随机区间:", waitMs, "ms");
      await delay(waitMs);
      return;
    }
    case "sendKeys":
      await executeSendKeys(step);
      context.submitted = true;
      return;
    case "smartSubmit":
      if (await executeSmartSubmit(step, query, context)) context.submitted = true;
      return;
    default:
      throw new Error(`不支持的 action: ${step.action}`);
  }
}

async function verifySubmittedOrRetry(query, handlerConfig, context, options = {}) {
  const text = String(query || "").trim();
  if (!text) {
    return;
  }

  
  
  
  if (handlerConfig.skipSubmitVerify) {
    return;
  }

  const steps = Array.isArray(handlerConfig.steps) ? handlerConfig.steps : [];
  const submitSteps = steps.filter((step) => SUBMIT_ACTIONS.has(step.action));
  const inputStep = findSubmitVerificationInputStep(steps);
  const rewriteStep = steps.find((step) => step.action === "setValue" && getSelectors(step).length > 0);
  if (submitSteps.length === 0 || !inputStep) {
    return;
  }

  const verifyWaitMs = Number.isFinite(handlerConfig.submitVerifyWaitMs)
    ? handlerConfig.submitVerifyWaitMs
    : SUBMIT_VERIFY_WAIT_MS;
  const maxRetries = Number.isFinite(handlerConfig.submitVerifyRetries)
    ? handlerConfig.submitVerifyRetries
    : SUBMIT_VERIFY_RETRY_COUNT;

  
  
  
  
  
  const stopSelectors = Array.isArray(context.stopButtonSelectors) && context.stopButtonSelectors.length > 0
    ? context.stopButtonSelectors
    : null;
  const canUseStopSignal = () => !!(stopSelectors && context.stopButtonBaselineAbsent) && isAnySelectorPresent(stopSelectors);

  await delay(verifyWaitMs);

  for (let retryIndex = 0; retryIndex <= maxRetries; retryIndex += 1) {
    if (canUseStopSignal()) {
      context.stopButtonSeen = true;
      traceLog("[XuSearch executor] 停止按钮已出现，提交验证通过");
      return;
    }
    const current = await readCurrentValue(inputStep);
    if (!current.includes(text)) {
      return;
    }

    if (retryIndex >= maxRetries) {
      throw new Error("内容仍停留在输入框，发送按钮可能未生效");
    }

    
    
    
    if (!rewriteStep) {
      await refireInputEvents(inputStep, text);
    }

    context.submitted = false;
    for (const rawStep of submitSteps) {
      
      let step = options.hasFiles ? applyFilesAwareTimeouts(rawStep) : rawStep;
      if (step.action === "smartSubmit") {
        step = {
          ...step,
          submitWaitMs: Math.max(
            Number.isFinite(step.submitWaitMs) ? step.submitWaitMs : 0,
            RETRY_SUBMIT_WAIT_MS
          ),
        };
      }
      try {
        await executeStep(step, query, context);
      } catch (error) {
        if (step.optional) continue;
        throw error;
      }

      if (step.waitAfter) await delay(step.waitAfter);
      await delay(Math.min(verifyWaitMs, 450));
      if (canUseStopSignal()) {
        context.stopButtonSeen = true;
        traceLog("[XuSearch executor] 停止按钮已出现，提交验证通过");
        return;
      }
      const afterSubmitValue = await readCurrentValue(inputStep);
      if (!afterSubmitValue.includes(text)) {
        return;
      }
    }

    await delay(RETRY_BETWEEN_WAIT_MS);
  }
}

async function refireInputEvents(step, text) {
  try {
    const element = await findElement(step);
    
    safeFocus(element, { optional: isTextControl(element) });
    if (isTextControl(element)) {
      dispatchEventList(element, ["input", "change"]);
      return;
    }
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      })
    );
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  } catch (_error) {
    
  }
}

function findSubmitVerificationInputStep(steps) {
  const inputActions = new Set(["setValue", "smartSubmit", "sendKeys", "focus"]);
  return steps.find((step) => step.action === "setValue" && getSelectors(step).length > 0)
    || steps.find((step) => inputActions.has(step.action) && getSelectors(step).length > 0)
    || null;
}
