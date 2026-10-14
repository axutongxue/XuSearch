import { UI_PREFS_STORAGE_KEY } from "./storage-keys.js";

const DIAGNOSTIC_LOG_PREF_KEY = "diagnosticLogsEnabled";
const LOG_PREFIX = "[XuSearch diagnostics]";

let diagnosticLogsEnabled = false;
let hasLoadedPreference = false;

function getChromeStorage() {
  try {
    return chrome?.storage?.local || null;
  } catch (_error) {
    return null;
  }
}

export async function refreshDiagnosticLogPreference() {
  const storage = getChromeStorage();
  if (!storage) {
    diagnosticLogsEnabled = false;
    hasLoadedPreference = true;
    return diagnosticLogsEnabled;
  }

  try {
    const stored = await storage.get([UI_PREFS_STORAGE_KEY]);
    diagnosticLogsEnabled = stored[UI_PREFS_STORAGE_KEY]?.[DIAGNOSTIC_LOG_PREF_KEY] === true;
  } catch (_error) {
    diagnosticLogsEnabled = false;
  }
  hasLoadedPreference = true;
  return diagnosticLogsEnabled;
}

export function isDiagnosticLoggingEnabled() {
  if (!hasLoadedPreference) {
    refreshDiagnosticLogPreference();
  }
  return diagnosticLogsEnabled;
}

export function diagnosticLog(scope, eventName, details = undefined) {
  if (!isDiagnosticLoggingEnabled()) {
    return;
  }

  const label = `${LOG_PREFIX} ${scope}:${eventName}`;
  if (details === undefined) {
    console.log(label);
    return;
  }
  console.log(label, sanitizeDiagnosticDetails(details));
}


export function traceLog(...args) {
  if (!isDiagnosticLoggingEnabled()) {
    return;
  }
  console.log(...args);
}

function sanitizeDiagnosticDetails(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnosticDetails);
  }

  const output = {};
  Object.entries(value).forEach(([key, rawValue]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("query") || normalizedKey.includes("prompt") || normalizedKey.includes("content")) {
      output[key] = describeTextValue(rawValue);
      return;
    }
    if (normalizedKey.includes("url")) {
      output[key] = rawValue ? "[redacted-url]" : rawValue;
      return;
    }
    if (key === "site" && rawValue && typeof rawValue === "object") {
      output[key] = { id: rawValue.id, name: rawValue.name };
      return;
    }
    output[key] = sanitizeDiagnosticDetails(rawValue);
  });
  return output;
}

function describeTextValue(value) {
  if (typeof value !== "string") {
    return value == null ? value : "[redacted]";
  }
  return `[redacted length=${value.length}]`;
}

try {
  refreshDiagnosticLogPreference();
  chrome?.storage?.onChanged?.addListener?.((changes, areaName) => {
    if (areaName !== "local" || !changes[UI_PREFS_STORAGE_KEY]) {
      return;
    }
    const nextPrefs = changes[UI_PREFS_STORAGE_KEY].newValue;
    diagnosticLogsEnabled = nextPrefs?.[DIAGNOSTIC_LOG_PREF_KEY] === true;
    hasLoadedPreference = true;
  });
} catch (_error) {
  diagnosticLogsEnabled = false;
  hasLoadedPreference = true;
}
