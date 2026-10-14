

import { traceLog } from "./diagnostics.js";
import { SIGNED_CONFIGS_STORAGE_KEY } from "./storage-keys.js";
import { loadBuiltinSites } from "./site-registry.js";


const DYNAMIC_RULE_ID_BASE = 10000;


const COMMON_REQUEST_HEADERS = [
  { header: "Sec-Fetch-Dest", operation: "set", value: "document" },
  { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
  { header: "Sec-Fetch-Mode", operation: "set", value: "navigate" },
  { header: "Sec-Fetch-User", operation: "set", value: "?1" },
];


const COMMON_RESPONSE_HEADERS = [
  { header: "content-security-policy", operation: "remove" },
  { header: "content-security-policy-report-only", operation: "remove" },
  { header: "x-frame-options", operation: "remove" },
];


const SOCIAL_BATCH_DOMAINS = ["x.com", "twitter.com", "youtube.com", "reddit.com", "tiktok.com"];
const SOCIAL_BATCH_EXTRA_HEADERS = [
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "permissions-policy",
];


let LAST_SYNC = { hosts: 0, total: 0 };
export function getLastDnrSyncStats() {
  return { ...LAST_SYNC };
}


function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\*:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}


function buildSiteRules(site, baseId) {
  if (site.dnrEmbedHeaders !== true) return [];
  const patterns = Array.isArray(site.matchPatterns) ? site.matchPatterns : [];
  if (patterns.length === 0) return [];

  const responseHeaders = [...COMMON_RESPONSE_HEADERS];

  const rules = [];
  patterns.forEach((pattern, idx) => {
    const host = normalizeHost(pattern);
    if (!host) return;
    rules.push({
      id: baseId + idx,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: COMMON_REQUEST_HEADERS,
        responseHeaders,
      },
      condition: {
        urlFilter: `||${host}/`,
        resourceTypes: ["sub_frame"],
      },
    });
  });

  return rules;
}


function buildSocialBatchRule(id) {
  return {
    id,
    priority: 2,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        ...COMMON_RESPONSE_HEADERS,
        ...SOCIAL_BATCH_EXTRA_HEADERS.map((header) => ({ header, operation: "remove" })),
      ],
    },
    condition: {
      requestDomains: SOCIAL_BATCH_DOMAINS,
      resourceTypes: ["sub_frame"],
    },
  };
}


async function collectRuleSites(signedConfigs) {
  const builtinSites = (await loadBuiltinSites({ fallbackEmpty: true })) || [];
  const merged = new Map(builtinSites.map((s) => [s.id, s]));
  for (const entry of Object.values(signedConfigs || {})) {
    const configSites = entry?.config?.sites;
    if (!Array.isArray(configSites)) continue;
    for (const site of configSites) {
      if (!site?.id) continue;
      const builtin = merged.get(site.id);
      merged.set(site.id, builtin ? { ...builtin, ...site } : site);
    }
  }
  return [...merged.values()];
}


async function getExistingDynamicRuleIds() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return rules
      .filter((r) => r.id >= DYNAMIC_RULE_ID_BASE)
      .map((r) => r.id);
  } catch {
    return [];
  }
}


export async function syncDynamicDnr() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    console.warn("[dynamic-dnr] declarativeNetRequest API 不可用");
    return;
  }

  try {
    const stored = await chrome.storage.local.get([SIGNED_CONFIGS_STORAGE_KEY]);
    const signedConfigs = stored[SIGNED_CONFIGS_STORAGE_KEY] || {};
    const sites = await collectRuleSites(signedConfigs);
    const hostSites = sites.filter((s) => s.dnrEmbedHeaders === true);
    
    
    
    try {
      const resp = await fetch(chrome.runtime.getURL("config/embed-hosts.json"));
      if (resp.ok) {
        const orphans = (await resp.json())?.hosts;
        if (Array.isArray(orphans) && orphans.length) {
          hostSites.push({ id: "embed-hosts-social", enabled: true, dnrEmbedHeaders: true, matchPatterns: orphans });
        }
      }
    } catch (_err) {
      
    }

    
    const seenHosts = new Set();
    const newRules = [];
    let idCounter = DYNAMIC_RULE_ID_BASE;
    for (const site of hostSites) {
      const rules = buildSiteRules(site, idCounter).filter((rule) => {
        const host = rule.condition.urlFilter.replace(/^\|\|/, "").replace(/\/$/, "");
        if (seenHosts.has(host)) return false;
        seenHosts.add(host);
        return true;
      });
      newRules.push(...rules);
      idCounter += rules.length + 8; 
    }

    
    newRules.push(buildSocialBatchRule(idCounter));

    
    const oldIds = await getExistingDynamicRuleIds();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: newRules,
    });
    LAST_SYNC = { hosts: seenHosts.size, total: newRules.length };

    traceLog(
      `[dynamic-dnr] 已同步 ${newRules.length} 条动态规则（${seenHosts.size} 个 host 来自 ${hostSites.length} 个站点 + 1 条社媒批处理）`,
    );
  } catch (error) {
    console.error("[dynamic-dnr] 同步失败:", error);
  }
}
