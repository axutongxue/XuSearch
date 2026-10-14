const DEFAULT_SHORTCUT = Object.freeze({
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  key: "Q",
});

export function normalizeKey(key) {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function normalizeShortcut(input) {
  if (!input || typeof input !== "object") return { ...DEFAULT_SHORTCUT };
  const key = typeof input.key === "string" && input.key.length > 0 ? input.key : DEFAULT_SHORTCUT.key;
  return {
    ctrlKey: !!input.ctrlKey,
    shiftKey: !!input.shiftKey,
    altKey: !!input.altKey,
    metaKey: !!input.metaKey,
    key: normalizeKey(key),
  };
}


export function shortcutPartList(sc) {
  if (!sc || !sc.key) return [];
  const parts = [];
  if (sc.ctrlKey) parts.push("Ctrl");
  if (sc.altKey) parts.push("Alt");
  if (sc.shiftKey) parts.push("Shift");
  if (sc.metaKey) parts.push(/Mac/i.test(navigator.platform) ? "Cmd" : "Win");
  parts.push(sc.key.length === 1 ? sc.key.toUpperCase() : sc.key);
  return parts;
}


export function parseCommandShortcut(raw) {
  const parts = String(raw || "").split("+").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return null;
  const key = parts.pop();
  if (!key) return null;
  return {
    ctrlKey: parts.includes("ctrl") || parts.includes("macctrl"),
    altKey: parts.includes("alt"),
    metaKey: parts.includes("meta") || parts.includes("command"),
    shiftKey: parts.includes("shift"),
    key: key.length === 1 ? key.toUpperCase() : key,
  };
}
