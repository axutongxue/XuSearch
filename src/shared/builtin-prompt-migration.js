
import {
  DEFAULT_PROMPT_GROUP_ID,
  DELETED_BUILTIN_PROMPTS_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY,
} from "./storage-keys.js";


export const BUILTIN_PROMPTS_MIGRATED_KEY = "builtinPromptsMigratedVersion";


const MIGRATION_SCHEMA = 2;


function isBuiltinOrigin(prompt) {
  return prompt?.isBuiltin === true || Boolean(prompt?.builtInUpdatedAt);
}


function builtinFingerprint(builtinById) {
  const joined = [...builtinById.keys()]
    .sort()
    .map((id) => `${id}@${builtinById.get(id).builtInUpdatedAt || ""}`)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}


export async function migrateBuiltinPrompts(currentVersion) {
  if (!currentVersion) return;
  try {
    
    const resp = await fetch(chrome.runtime.getURL("config/initialState.json"));
    if (!resp.ok) return;
    const defaults = await resp.json();
    const builtinGroups = Array.isArray(defaults?.promptGroups) ? defaults.promptGroups : [];
    const builtinById = new Map();
    for (const g of builtinGroups) {
      for (const p of g.prompts || []) {
        if (p?.id) builtinById.set(p.id, { ...p, groupId: g.id });
      }
    }
    if (builtinById.size === 0) return;

    const migrationTag = `${currentVersion}#s${MIGRATION_SCHEMA}#${builtinFingerprint(builtinById)}`;
    const stored = await chrome.storage.local.get([
      BUILTIN_PROMPTS_MIGRATED_KEY,
      PROMPT_GROUPS_STORAGE_KEY,
      DELETED_BUILTIN_PROMPTS_STORAGE_KEY,
    ]);
    if (stored[BUILTIN_PROMPTS_MIGRATED_KEY] === migrationTag) return;

    const groups = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY])
      ? stored[PROMPT_GROUPS_STORAGE_KEY]
      : [];

    
    const tombstones = Array.isArray(stored[DELETED_BUILTIN_PROMPTS_STORAGE_KEY])
      ? stored[DELETED_BUILTIN_PROMPTS_STORAGE_KEY]
      : [];
    const deletedByUser = new Set(tombstones.map((t) => t?.id).filter(Boolean));

    const nextGroups = groups.map((g) => ({ ...g, prompts: [...(g.prompts || [])] }));
    const nextById = new Map();
    for (const g of nextGroups) {
      for (const p of g.prompts) nextById.set(p.id, { group: g, prompt: p });
    }

    let changed = false;

    
    for (const [id, entry] of nextById) {
      const def = builtinById.get(id);
      if (def) {
        
        if (!entry.prompt.isBuiltin) {
          entry.prompt.isBuiltin = true;
          changed = true;
        }
        if (entry.prompt.deprecatedFrom) {
          delete entry.prompt.deprecatedFrom;
          changed = true;
        }
      } else if (isBuiltinOrigin(entry.prompt)) {
        
        
        if (!entry.prompt.deprecatedFrom) {
          entry.prompt.deprecatedFrom = currentVersion;
          changed = true;
        }
      }
    }

    
    for (const [id, def] of builtinById) {
      if (nextById.has(id)) continue;
      if (deletedByUser.has(id)) continue; 
      const target = nextGroups.find((g) => g.id === def.groupId);
      if (!target) continue; 
      target.prompts.push({
        id: def.id,
        title: def.title,
        builtInUpdatedAt: def.builtInUpdatedAt || currentVersion,
        isBuiltin: true,
        content: def.content || "",
      });
      changed = true;
    }

    if (changed) {
      await chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: nextGroups });
    }
    await chrome.storage.local.set({ [BUILTIN_PROMPTS_MIGRATED_KEY]: migrationTag });
  } catch (_error) {
    
  }
}


export function isDeprecatedPrompt(prompt) {
  return Boolean(prompt?.deprecatedFrom);
}
