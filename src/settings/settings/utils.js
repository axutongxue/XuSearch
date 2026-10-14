import { state } from "./state.js";
import { loadBuiltinSites as loadBuiltinSitesFromRegistry } from "../../shared/site-registry.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}



export function markDirty() {}

export function getGroupById(groupId) {
  return state.groups.find((item) => item.id === groupId) || null;
}


const SELF_BUILT_GROUP_ID_RE = /^group_\d+$/;


export function isSelfBuiltGroupId(groupId) {
  return SELF_BUILT_GROUP_ID_RE.test(String(groupId || ""));
}

export async function loadBuiltinSites() {
  return loadBuiltinSitesFromRegistry({ fallbackEmpty: false }).then((sites) =>
    sites.filter((site) => site.enabled !== false)
  );
}
