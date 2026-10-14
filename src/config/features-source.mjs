

export const FEATURE_DEFS = {
  desktop: {
    label: "Desktop companion bridge (Native Messaging)",
    entries: [],
    permissions: ["nativeMessaging"],
  },
  devExport: {
    label: "Development config export (private key embedded, dev-only)",
    entries: [],
    permissions: [],
  },
};

export const DEFAULT_FEATURE_KEYS = Object.keys(FEATURE_DEFS);
