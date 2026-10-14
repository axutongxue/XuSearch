export const AI_PROVIDER_KIND_OPENAI_COMPATIBLE = "openai-compatible";


export const AI_PROVIDERS = {
  agnes: {
    id: "agnes",
    label: "Agnes",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://apihub.agnes-ai.com/v1",
    apiKeyUrl: "",
    docsUrl: "",
    defaultModel: "agnes-2.5-flash",
    models: [{ value: "agnes-2.5-flash", label: "agnes-2.5-flash" }],
  },
  ollama: {
    id: "ollama",
    label: "Ollama",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://ollama.com/v1",
    apiKeyUrl: "https://ollama.com/settings/keys",
    docsUrl: "",
    defaultModel: "gpt-oss:120b-cloud",
    models: [{ value: "gpt-oss:120b-cloud", label: "gpt-oss:120b-cloud" }],
  },
  modelscope: {
    id: "modelscope",
    label: "魔搭社区 ModelScope",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api-inference.modelscope.cn/v1",
    apiKeyUrl: "https://modelscope.cn/my/myaccesstoken",
    docsUrl: "",
    defaultModel: "MiniMax/MiniMax-M1-80k",
    models: [{ value: "MiniMax/MiniMax-M1-80k", label: "MiniMax-M1-80k" }],
  },
  siliconflow: {
    id: "siliconflow",
    label: "硅基流动",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn/",
    defaultModel: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
    models: [{ value: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", label: "DeepSeek-R1-0528-Qwen3-8B" }],
  },
  zhipu: {
    id: "zhipu",
    label: "智谱 BigModel",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/models/text/glm-4.7",
    defaultModel: "GLM-4-Flash-250414",
    models: [{ value: "GLM-4-Flash-250414", label: "GLM-4-Flash-250414" }],
  },
  internai: {
    id: "internai",
    label: "书生",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://chat.intern-ai.org.cn/api/v1",
    apiKeyUrl: "",
    docsUrl: "",
    defaultModel: "intern-latest",
    models: [{ value: "intern-latest", label: "intern-latest" }],
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "",
    apiKeyUrl: "",
    docsUrl: "",
    defaultModel: "",
    models: [],
    allowCustomBaseUrl: true,
    allowCustomModel: true,
  },
};

export const DEFAULT_AI_PROVIDER_ID = "agnes";


export const LEGACY_PRESET_BASE_URLS = {
  deepseek: "https://api.deepseek.com",
  kimi: "https://api.moonshot.cn/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  minimax: "https://api.minimaxi.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

export function isKnownProviderId(providerId) {
  return Object.prototype.hasOwnProperty.call(AI_PROVIDERS, String(providerId || ""));
}

export function getAiProvider(providerId) {
  return AI_PROVIDERS[providerId] || AI_PROVIDERS[DEFAULT_AI_PROVIDER_ID];
}

export function getAiProviderList() {
  return Object.values(AI_PROVIDERS);
}

export function getDefaultModelForProvider(providerId) {
  const provider = getAiProvider(providerId);
  return provider.defaultModel || provider.models?.[0]?.value || "";
}

function isZhipuThinkingModel(modelId) {
  return /^glm-(4\.(5|6|7)|5)/.test(modelId);
}

function isMinimaxM2Model(modelId) {
  return /^minimax-m2/.test(modelId);
}


export function getAiSummaryRequestExtras(providerId, model) {
  const modelId = String(model || "").trim().toLowerCase();

  if (providerId === "kimi" && modelId.startsWith("kimi-k2")) {
    return { thinking: { type: "disabled" } };
  }

  if (providerId === "zhipu" && isZhipuThinkingModel(modelId)) {
    return { thinking: { type: "disabled" } };
  }

  if (providerId === "minimax" && isMinimaxM2Model(modelId)) {
    return { temperature: 1.0 };
  }

  return { temperature: 0.2 };
}
