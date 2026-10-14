

export function findGroupByName(groups, word) {
  const w = String(word || "").trim().toLowerCase();
  if (!w || !Array.isArray(groups)) return null;
  for (const group of groups) {
    if (group && String(group.name || "").trim().toLowerCase() === w) return group;
  }
  return null;
}


export function getLastWordBeforeCaret(text) {
  if (!text) return null;
  const m = text.match(/[^\s]+$/);
  if (!m) return null;
  return { word: m[0], index: m.index };
}
