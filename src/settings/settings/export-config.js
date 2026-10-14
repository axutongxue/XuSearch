
import { state } from "./state.js";



import { isSelfBuiltGroupId } from "./utils.js";


export function bundleSourceButtonHtml() {
  return `<button class="add-section-btn add-bundle-source-btn" type="button">导出规则源</button>`;
}



export function buildBundleSource(options = {}) {
  const { minExtVersion = chrome.runtime.getManifest().version, changelog = [] } = options;

  if (!state.groups?.length) {
    throw new Error("没有搜索组，无法导出规则源");
  }

  const siteMap = new Map((state.sites || []).map((site) => [site.id, site]));
  const collectedSiteIds = new Set();
  const groups = [];
  const skippedGroupIds = [];

  for (const group of state.groups) {
    
    
    
    
    if (isSelfBuiltGroupId(group.id)) {
      skippedGroupIds.push(String(group.id));
      continue;
    }

    
    const ids = (group.siteIds || group.sites || []).filter((id) => siteMap.has(id));
    
    
    const rangeIds = (Array.isArray(group.rangeSiteIds) ? group.rangeSiteIds : []).filter((id) => siteMap.has(id));
    const exported = {
      id: group.id,
      name: group.name || group.id,
      
      ...(group.groupTag ? { groupTag: String(group.groupTag) } : {}),
      mode: group.mode || "compare",
      enabled: group.enabled !== false,
      siteIds: ids,
    };
    if (rangeIds.length > ids.length) exported.rangeSiteIds = [...new Set(rangeIds)];
    groups.push(exported);
    ids.forEach((id) => collectedSiteIds.add(id));
    (exported.rangeSiteIds || []).forEach((id) => collectedSiteIds.add(id));
  }

  return {
    minExtVersion,
    groups,
    sites: [...collectedSiteIds].map((id) => serializeSite(siteMap.get(id))),
    changelog: Array.isArray(changelog) ? changelog : [],
    skippedGroupIds,
  };
}


const SITE_FIELD_EXCLUDE = new Set([]);

function serializeSite(site) {
  
  const exported = {
    id: site.id,
    name: site.name,
    url: site.url,
    enabled: site.enabled !== false,
    supportIframe: site.supportIframe !== false,
    matchPatterns: site.matchPatterns || [],
  };
  
  for (const [key, value] of Object.entries(site)) {
    if (Object.prototype.hasOwnProperty.call(exported, key)) continue;
    if (value === undefined) continue;
    if (key.startsWith("_") || SITE_FIELD_EXCLUDE.has(key)) continue;
    exported[key] = value;
  }
  return exported;
}


export async function exportBundleSource(options = {}) {
  try {
    const source = buildBundleSource(options);
    const blob = new Blob([`${JSON.stringify(source, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bundle-source.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, groupCount: source.groups.length, siteCount: source.sites.length, skippedGroupIds: source.skippedGroupIds || [] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}


export function bindBundleSourceButton(container) {
  container.querySelector(".add-bundle-source-btn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    try {
      const result = await exportBundleSource();
      if (!result.ok) {
        window.alert(`导出失败：${result.error}`);
        return;
      }
      window.alert(
        `规则源已导出\n\n组：${result.groupCount} 个\n站点：${result.siteCount} 个\n${
          result.skippedGroupIds?.length
            ? `已跳过自建组 ${result.skippedGroupIds.length} 个（自建组不进下发基线）\n`
            : ""
        }文件名：bundle-source.json\n\n下一步：放入 xusearch-backend/rules/ 后运行 publish-bundle.mjs 升版本。`,
      );
    } finally {
      btn.disabled = false;
    }
  });
}
