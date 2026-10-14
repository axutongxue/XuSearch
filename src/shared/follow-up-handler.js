

import { UNIVERSAL_SUBMIT_SELECTORS } from "./handler-fallback.js";


const FOLLOW_UP_INPUT_SELECTORS = [
  "[role='textbox']",
  "div[contenteditable='true']",
  "textarea:not([disabled])",
];


export function supportsTypedFollowUp(site) {
  return site?.batchFollowUpSupported === true;
}


export function hasDomHandler(site) {
  const followUp = site?.followUpSearchHandler;
  if (Array.isArray(followUp?.steps) && followUp.steps.length > 0) return true;
  const primary = site?.searchHandler;
  return Array.isArray(primary?.steps) && primary.steps.length > 0;
}


function buildSynthesizedFollowUpHandler(site) {
  const precise = Array.isArray(site?.followUpInputSelectors)
    ? site.followUpInputSelectors.filter((sel) => typeof sel === "string" && sel)
    : [];
  const selectors = [...new Set([...precise, ...FOLLOW_UP_INPUT_SELECTORS])];
  return {
    submitVerifyWaitMs: 1200,
    submitVerifyRetries: 3,
    steps: [
      {
        action: "focus",
        selectors,
        timeout: 20000,
        description: "追问：聚焦卡片内输入框",
      },
      {
        action: "setValue",
        selectors,
        inputType: "auto",
        maxAttempts: 20,
        stableWaitMs: 600,
        
        
        
        
        waitAfter: 700,
        description: "追问：写入问题",
      },
      {
        action: "smartSubmit",
        selectors,
        submitSelectors: UNIVERSAL_SUBMIT_SELECTORS,
        submitWaitMs: 5000,
        
        
        
        postClickVerifyMs: 2500,
        optional: true,
        description: "追问：点击发送按钮",
      },
      {
        action: "sendKeys",
        selectors,
        keys: ["Enter"],
        optional: true,
        description: "追问：回车发送",
      },
    ],
  };
}


export function buildTypedFollowUpHandler(site) {
  const followUp = site?.followUpSearchHandler;
  if (Array.isArray(followUp?.steps) && followUp.steps.length > 0) return followUp;
  const primary = site?.searchHandler;
  if (Array.isArray(primary?.steps) && primary.steps.length > 0) return primary;
  return buildSynthesizedFollowUpHandler(site);
}


export function planSendStrategies({
  hasUrlTemplate,
  isFollowUp,
  typedFollowUpSupported,
  domHandlerAvailable,
}) {
  const canType = Boolean(domHandlerAvailable) || (Boolean(isFollowUp) && Boolean(typedFollowUpSupported));
  if (canType && isFollowUp) {
    return ["dom_automation"];
  }
  const plans = [];
  if (hasUrlTemplate) plans.push("url_template");
  if (canType) plans.push("dom_automation");
  if (plans.length === 0) plans.push("new_tab");
  return plans;
}
