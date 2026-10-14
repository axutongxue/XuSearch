import { AI_SUMMARY_SETTINGS_STORAGE_KEY } from "./storage-keys.js";
import {
  DEFAULT_AI_PROVIDER_ID,
  LEGACY_PRESET_BASE_URLS,
  getAiProvider,
  getAiProviderList,
  getDefaultModelForProvider,
  getAiSummaryRequestExtras,
  isKnownProviderId,
} from "./ai-providers.js";

export const DEFAULT_SUMMARY_PROMPT =
  "你是一个专业的信息整理助手。请基于下面多个 AI 模型的回答，输出结构化总结：" +
  "1. 核心结论 2. 共同观点 3. 分歧与互补 4. 可执行建议 5. 值得继续追问的问题。";

export const DEFAULT_SUMMARY_SETTINGS = {
  
  
  
  providers: [],
  
  activeProviderIds: [],
  
  defaultProviderId: "",
  promptGroups: [],
  
  defaultPromptGroupId: "",
};

export function makePromptGroup(name = "默认总结", prompt = DEFAULT_SUMMARY_PROMPT) {
  return {
    id: `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    prompt,
  };
}

export function getPromptGroups(settings) {
  const groups = settings?.promptGroups;
  return Array.isArray(groups) && groups.length > 0 ? groups : [makePromptGroup()];
}

export function getPromptText(settings, groupId) {
  const groups = getPromptGroups(settings);
  const group = groupId ? groups.find((g) => g.id === groupId) : null;
  if (group) return group.prompt || DEFAULT_SUMMARY_PROMPT;
  
  const defaultId = String(settings?.defaultPromptGroupId || "");
  const defaultGroup = groups.find((g) => g.id === defaultId);
  return (defaultGroup || groups[0])?.prompt || DEFAULT_SUMMARY_PROMPT;
}

export function createCustomProviderEntry(label) {
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    kind: "custom",
    label: label || "Custom",
    baseUrl: "",
    apiKey: "",
    model: "",
  };
}


export function getProviderEntryView(entry) {
  if (!entry) return null;
  if (entry.kind === "preset") {
    const preset = getAiProvider(entry.id) || null;
    const defaultModel = preset?.defaultModel || preset?.models?.[0]?.value || "";
    return {
      id: entry.id,
      kind: "preset",
      label: entry.label || preset?.label || entry.id,
      baseUrl: String(entry.baseUrl || "").trim() || preset?.baseUrl || "",
      apiKey: String(entry.apiKey || "").trim(),
      model: String(entry.model || "").trim() || defaultModel,
      apiKeyUrl: preset?.apiKeyUrl || "",
      docsUrl: preset?.docsUrl || "",
      defaultModel,
      models: preset?.models || [],
      allowCustomBaseUrl: Boolean(preset?.allowCustomBaseUrl),
      allowBaseUrlOverride: Boolean(preset?.allowBaseUrlOverride),
    };
  }
  
  return {
    id: entry.id,
    kind: "custom",
    label: entry.label || "Custom",
    baseUrl: String(entry.baseUrl || "").trim(),
    apiKey: String(entry.apiKey || "").trim(),
    model: String(entry.model || "").trim(),
    apiKeyUrl: "",
    docsUrl: "",
    defaultModel: "",
    models: [],
    allowCustomBaseUrl: true,
  };
}

export function getProviderEntries(settings) {
  return Array.isArray(settings?.providers) ? settings.providers : [];
}


export function getActiveProviderIds(settings) {
  const ids = Array.isArray(settings?.activeProviderIds) ? settings.activeProviderIds : [];
  const valid = new Set(getProviderEntries(settings).map((e) => e.id));
  return ids.filter((id) => valid.has(id));
}

export function isProviderActive(settings, providerId) {
  return getActiveProviderIds(settings).includes(providerId);
}


export function getActiveProviderEntry(settings) {
  const entries = getProviderEntries(settings);
  if (entries.length === 0) return null;
  const activeIds = getActiveProviderIds(settings);
  const defaultId = String(settings?.defaultProviderId || "");
  if (defaultId && activeIds.includes(defaultId)) {
    const entry = entries.find((e) => e.id === defaultId);
    if (entry) return entry;
  }
  for (const id of activeIds) {
    const entry = entries.find((e) => e.id === id);
    if (entry) return entry;
  }
  return null;
}

export function getActiveProviderEntryView(settings) {
  return getProviderEntryView(getActiveProviderEntry(settings));
}

function normalizeAiSummarySettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const entries = normalizeProviderEntries(source);

  
  
  const rawActive = Array.isArray(source.activeProviderIds)
    ? source.activeProviderIds
    : (source.activeProviderId ? [source.activeProviderId] : (source.provider ? [source.provider] : []));
  const validIds = new Set(entries.map((e) => e.id));
  const activeProviderIds = [...new Set(rawActive.filter((id) => validIds.has(id)))];

  
  let promptGroups;
  if (Array.isArray(source.promptGroups) && source.promptGroups.length > 0) {
    promptGroups = source.promptGroups.map((g, i) => ({
      id: String(g.id || `pg_${i}`),
      name: String(g.name || "").trim() || "默认总结",
      prompt: String(g.prompt || "").trim() || DEFAULT_SUMMARY_PROMPT,
    }));
  } else {
    const legacyPrompt = typeof source.prompt === "string" && source.prompt.trim()
      ? source.prompt.trim()
      : DEFAULT_SUMMARY_PROMPT;
    promptGroups = [{ id: "pg_default", name: "默认总结", prompt: legacyPrompt }];
  }

  const activeView = getProviderEntryView(entries.find((e) => e.id === activeProviderIds[0]) || null);

  
  let defaultProviderId = String(source.defaultProviderId || "");
  if (!defaultProviderId || !activeProviderIds.includes(defaultProviderId)) {
    defaultProviderId = activeProviderIds[0] || "";
  }

  
  let defaultPromptGroupId = String(source.defaultPromptGroupId || "");
  if (!defaultPromptGroupId || !promptGroups.some((g) => g.id === defaultPromptGroupId)) {
    defaultPromptGroupId = promptGroups[0]?.id || "";
  }

  return {
    ...DEFAULT_SUMMARY_SETTINGS,
    providers: entries,
    activeProviderIds,
    defaultProviderId,
    promptGroups,
    defaultPromptGroupId,
    provider: activeView?.id || "", 
    prompt: promptGroups[0].prompt, 
  };
}


function normalizeProviderEntries(source) {
  if (Array.isArray(source.providers) && source.providers.length > 0) {
    return source.providers.map((p, i) => {
      const kind = p.kind === "custom" ? "custom" : "preset";
      
      
      const presetOk = kind === "preset" && isKnownProviderId(p.id);
      
      const temperature = Number(p.temperature);
      const maxTokens = Number(p.maxTokens);
      const advanced = {
        temperature: Number.isFinite(temperature) && temperature >= 0 && temperature <= 2 ? temperature : undefined,
        maxTokens: Number.isFinite(maxTokens) && maxTokens >= 1 ? maxTokens : undefined,
        thinking: typeof p.thinking === "boolean" ? p.thinking : undefined,
      };
      if (!presetOk && kind === "preset") {
        
        
        return {
          id: String(p.id || `cfg_${i}`),
          kind: "custom",
          label: String(p.label || "").trim() || String(p.id || "Custom"),
          baseUrl: String(p.baseUrl || "").trim() || LEGACY_PRESET_BASE_URLS[p.id] || "",
          apiKey: String(p.apiKey || "").trim(),
          model: String(p.model || "").trim(),
          ...advanced,
        };
      }
      return {
        id: String(p.id),
        kind,
        label: String(p.label || "").trim() || (kind === "preset" ? (getAiProvider(p.id).label || p.id) : "Custom"),
        baseUrl: String(p.baseUrl || "").trim(),
        apiKey: String(p.apiKey || "").trim(),
        model: String(p.model || "").trim(),
        ...advanced,
      };
    });
  }

  
  if (!source.apiKeys && !source.models && !source.customBaseUrls && !source.apiKey && !source.model && !source.baseUrl && !source.provider) {
    return [];
  }

  
  const apiKeys = { ...(source.apiKeys || {}) };
  const models = { ...(source.models || {}) };
  const customBaseUrls = { ...(source.customBaseUrls || {}) };

  
  if (typeof source.apiKey === "string" && source.apiKey.trim() && !apiKeys.deepseek) {
    apiKeys.deepseek = source.apiKey.trim();
  }
  if (typeof source.model === "string" && source.model.trim() && !models.deepseek) {
    models.deepseek = source.model.trim();
  }
  if (typeof source.baseUrl === "string" && source.baseUrl.trim() && !customBaseUrls.custom) {
    customBaseUrls.custom = source.baseUrl.trim();
  }

  const legacyProviderId = source.provider && isKnownProviderId(source.provider) ? source.provider : "";
  const providerIds = new Set([
    ...(legacyProviderId ? [legacyProviderId] : []),
    ...Object.keys(apiKeys),
    ...Object.keys(models),
    ...Object.keys(customBaseUrls),
  ]);

  const entries = [];
  for (const providerId of providerIds) {
    const known = isKnownProviderId(providerId) && providerId !== "custom";
    const hasData = String(apiKeys[providerId] || "").trim()
      || String(models[providerId] || "").trim()
      || (!known ? String(customBaseUrls[providerId] || "").trim() : "");
    if (!hasData) continue;
    entries.push({
      id: providerId,
      kind: known ? "preset" : "custom",
      label: known ? (getAiProvider(providerId).label || providerId) : providerId,
      
      baseUrl: String(customBaseUrls[providerId] || "").trim() || (known ? "" : LEGACY_PRESET_BASE_URLS[providerId] || ""),
      apiKey: String(apiKeys[providerId] || "").trim(),
      model: String(models[providerId] || (known ? getDefaultModelForProvider(providerId) : "") || "").trim(),
    });
  }
  return entries;
}

export async function loadAiSummarySettings() {
  const stored = await chrome.storage.local.get(AI_SUMMARY_SETTINGS_STORAGE_KEY);
  return normalizeAiSummarySettings(stored[AI_SUMMARY_SETTINGS_STORAGE_KEY]);
}

export async function saveAiSummarySettings(settings) {
  await chrome.storage.local.set({
    [AI_SUMMARY_SETTINGS_STORAGE_KEY]: normalizeAiSummarySettings(settings),
  });
}


export function getProvidersWithApiKeys(settings) {
  const activeIds = new Set(getActiveProviderIds(settings));
  return getProviderEntries(settings).filter(
    (e) => activeIds.has(e.id) && String(e.apiKey || "").trim().length > 0
  );
}


export function getActiveAiSummaryProvider(settings) {
  return getActiveProviderEntryView(settings);
}

export function getActiveAiSummaryApiKey(settings) {
  return getActiveProviderEntryView(settings)?.apiKey || "";
}

export function getActiveAiSummaryModel(settings) {
  const view = getActiveProviderEntryView(settings);
  return view?.model || view?.defaultModel || "";
}

export function getActiveAiSummaryBaseUrl(settings) {
  return getActiveProviderEntryView(settings)?.baseUrl || "";
}


export function buildSummaryInput(responses, query) {
  const valid = (responses || []).filter((r) => {
    const content = String(r?.content || "").trim();
    const contentOk = content && content !== "暂未提取到内容";
    
    
    const turnsOk = Array.isArray(r?.turns) && r.turns.length > 0;
    return contentOk || turnsOk;
  });
  if (valid.length === 0) return null;

  const parts = [];
  if (query) parts.push(`用户问题：${query}\n`);
  valid.forEach((r, i) => {
    const turns = Array.isArray(r.turns) && r.turns.length > 0
      ? r.turns.map((turn) => `${turn.role === "user" ? "User" : "AI"}: ${turn.text}`).join("\n\n")
      : r.content;
    parts.push(`=== 模型 ${i + 1}：${r.siteName} ===\nURL: ${r.url || ""}\n\n${turns}`);
  });
  return parts.join("\n\n");
}

export async function callAiSummary(settings, contentText) {
  const response = await _fetchOpenAICompatible(settings, contentText, false);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${(getActiveAiSummaryProvider(settings) || { label: "配置" }).label} 未返回有效内容。`);
  }
  return { content, truncated: data?.choices?.[0]?.finish_reason === "length" };
}

export async function* streamAiSummary(settings, contentText, signal) {
  const response = await _fetchOpenAICompatible(settings, contentText, true, signal);
  const reader = response.body?.getReader?.();
  if (!reader) {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    if (content) yield content;
    if (data?.choices?.[0]?.finish_reason === "length") yield { truncated: true };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let truncated = false;
  let doneByMarker = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") {
          doneByMarker = true;
          break;
        }
        try {
          const parsed = JSON.parse(raw);
          const thinkingChunk = parsed.choices?.[0]?.delta?.reasoning_content;
          if (thinkingChunk) yield { thinking: thinkingChunk };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) yield chunk;
          if (parsed.choices?.[0]?.finish_reason === "length") truncated = true;
        } catch (_) {
          
        }
      }
      if (doneByMarker) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (truncated) yield { truncated: true };
}


export const callDeepSeekSummary = callAiSummary;
export const streamDeepSeekSummary = streamAiSummary;

function joinChatCompletionsUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`;
}

async function _fetchOpenAICompatible(settings, contentText, stream, signal) {
  const provider = getActiveAiSummaryProvider(settings) || { id: "", label: "配置" };
  const apiKey = getActiveAiSummaryApiKey(settings);
  const model = getActiveAiSummaryModel(settings);
  const baseUrl = getActiveAiSummaryBaseUrl(settings);

  if (!provider.id) throw new Error("尚未启用任何服务商配置，请到设置「AI 总结」添加并启用。");
  if (!apiKey) throw new Error(`请先填写 ${provider.label} API Key。`);
  if (!model) throw new Error(`请先选择或填写 ${provider.label} 模型名。`);
  if (!baseUrl) throw new Error(`请先填写 ${provider.label} Base URL。`);

  let response;
  try {
    const activeEntry = getActiveProviderEntry(settings) || {};
    const requestBody = {
      model,
      stream,
      max_tokens: activeEntry.maxTokens || 4000,
      messages: [
        { role: "system", content: settings?.prompt || DEFAULT_SUMMARY_PROMPT },
        { role: "user", content: contentText },
      ],
      
      ...getAiSummaryRequestExtras(provider.id, model),
      ...(activeEntry.temperature == null ? {} : { temperature: activeEntry.temperature }),
      ...(activeEntry.thinking === true
        ? { thinking: { type: "enabled" } }
        : (activeEntry.thinking === false ? { thinking: { type: "disabled" } } : {})),
    };
    if (!Number.isFinite(requestBody.max_tokens) || requestBody.max_tokens < 1) {
      requestBody.max_tokens = 4000;
    }
    response = await fetch(joinChatCompletionsUrl(baseUrl), {
      method: "POST",
      signal: signal || null,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(`连接 ${provider.label} 失败：${err.message}`);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`${provider.label} API Key 无效或无权限（${status}），请检查 Key 是否正确。`);
    }
    if (status === 429) {
      throw new Error(`${provider.label} 请求过于频繁、余额不足或触发限流（429），请稍后重试。`);
    }
    let errMsg = `${provider.label} 返回错误 ${status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) errMsg += `：${errData.error.message}`;
      else if (errData?.message) errMsg += `：${errData.message}`;
    } catch (_) {
      
    }
    throw new Error(errMsg);
  }
  return response;
}
