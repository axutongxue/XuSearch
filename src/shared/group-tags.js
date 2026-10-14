

export const DEFAULT_GROUP_TAG = "默认";

export function getGroupTag(group) {
  const tag = String(group?.groupTag || "").trim();
  return tag || DEFAULT_GROUP_TAG;
}


export function clusterGroupsByTag(groups) {
  const order = [];
  const seen = new Set();
  for (const group of groups || []) {
    const tag = getGroupTag(group);
    if (!seen.has(tag)) {
      seen.add(tag);
      order.push(tag);
    }
  }
  return order.map((tag) => ({
    tag,
    groups: (groups || []).filter((group) => getGroupTag(group) === tag),
  }));
}
