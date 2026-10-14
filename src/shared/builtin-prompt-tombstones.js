
import { DELETED_BUILTIN_PROMPTS_STORAGE_KEY } from "./storage-keys.js";


export async function recordBuiltinPromptDeletion(promptId, groupId) {
  if (!promptId) return;
  try {
    const stored = await chrome.storage.local.get(DELETED_BUILTIN_PROMPTS_STORAGE_KEY);
    const list = Array.isArray(stored[DELETED_BUILTIN_PROMPTS_STORAGE_KEY])
      ? stored[DELETED_BUILTIN_PROMPTS_STORAGE_KEY]
      : [];
    if (list.some((entry) => entry?.id === promptId)) return;
    list.push({ id: String(promptId), groupId: String(groupId || ""), deletedAt: Date.now() });
    await chrome.storage.local.set({ [DELETED_BUILTIN_PROMPTS_STORAGE_KEY]: list });
  } catch (_error) {
    
  }
}
