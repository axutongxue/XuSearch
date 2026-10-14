

import { MAX_SEEN_TIMESTAMP_KEY } from "./storage-keys.js";



const PUBLIC_KEY_SPKI =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzp2Q6gkMwI8N5KbqFonw3HkuQUhf4lH2GY1PHpeNhn6pNHOfEafSA/86fFbb9TcFOYvbuetQoPhGmipegjAqjSv7sq3qy0UjeFamq0+ZibQIGNcCevo4iDL5xWckXt/EHlyRitPdcZ/43bmrrLU6OxCnYoMIIOZA3PQUWKFnQfgKF5YODxl9OZFohmnD9BgWsKB/vVW5JJkfKpYjmctkmVrdKSBEXkLZD1uQiTJnNVWwNf5mzoK20Q1Vlvh12rG6j6W78w3kvoJy0Wwd9VSPio6f2rmqwZa9V3zRvrh6BX2uh65n24Aj7NNDWhOX8MAwiIxXtbMVoPzgLa4AnpgIgwIDAQAB";


export const EXPIRY_GRACE_MS = 48 * 3600 * 1000;


export async function isConfigExpired(config) {
  if (!config || config.expiresAt == null) return false;
  try {
    const stored = await chrome.storage.local.get([MAX_SEEN_TIMESTAMP_KEY]);
    const prev = Number(stored[MAX_SEEN_TIMESTAMP_KEY]) || 0;
    const now = Math.max(Date.now(), prev, Number(config.issuedAt) || 0);
    if (now !== prev) {
      await chrome.storage.local.set({ [MAX_SEEN_TIMESTAMP_KEY]: now });
    }
    return now > Number(config.expiresAt) + EXPIRY_GRACE_MS;
  } catch (_err) {
    return false;
  }
}

const BEGIN_MARKER = "-----BEGIN XUSEARCH CONFIG-----";
const END_MARKER = "-----END XUSEARCH CONFIG-----";


let cachedKey = null;

async function getPublicKey() {
  if (cachedKey) return cachedKey;

  const spkiBytes = Uint8Array.from(atob(PUBLIC_KEY_SPKI), (c) => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey(
    "spki",
    spkiBytes,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return cachedKey;
}


function extractBase64(rawText) {
  const text = String(rawText || "").replace(/```[a-z]*/g, "").trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const beginIdx = lines.findIndex((l) => l.startsWith(BEGIN_MARKER));
  const endIdx = lines.findIndex((l) => l.startsWith(END_MARKER));

  if (beginIdx >= 0 && endIdx > beginIdx) {
    return lines.slice(beginIdx + 1, endIdx).join("");
  }

  
  return lines.join("");
}


function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}


async function gunzip(compressed) {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(compressed);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}


function unpack(packed) {
  const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  const sigLen = view.getUint32(0, false); 
  const signature = packed.slice(4, 4 + sigLen);
  const payload = packed.slice(4 + sigLen);
  return { signature, payload };
}


async function verifySignature(payload, signature) {
  const key = await getPublicKey();
  return crypto.subtle.verify(
    { name: "RSA-PSS", saltLength: 32 }, 
    key,
    signature,
    payload,
  );
}


function parseVersion(v) {
  return String(v || "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const diff = (va[i] || 0) - (vb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}


export async function parseSignedConfig(rawText) {
  try {
    
    const b64 = extractBase64(rawText);
    if (!b64) {
      return { ok: false, error: "未找到有效密文，请检查是否完整复制了 BEGIN/END 标记之间的内容。" };
    }

    
    const compressed = base64ToBytes(b64);

    
    const packed = await gunzip(compressed);

    
    const { signature, payload } = unpack(packed);

    
    const isValid = await verifySignature(payload, signature);
    if (!isValid) {
      return { ok: false, error: "验签失败：配置无效或已被篡改。" };
    }

    
    const jsonStr = new TextDecoder().decode(payload);
    const config = JSON.parse(jsonStr);

    
    const required = ["productId", "version", "sites"];
    for (const field of required) {
      if (!(field in config)) {
        return { ok: false, error: `配置缺少必需字段: ${field}` };
      }
    }
    if (!("searchGroup" in config) && !Array.isArray(config.groups)) {
      return { ok: false, error: "配置缺少必需字段: searchGroup 或 groups" };
    }

    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: `解析失败: ${err.message}` };
  }
}


export function checkConfigVersion(config, currentVersion, extVersion) {
  
  if (config.minExtVersion && compareVersions(config.minExtVersion, extVersion) > 0) {
    return {
      ok: false,
      reason: `此配置需要扩展 v${config.minExtVersion} 或更高版本（当前 v${extVersion}），请先更新扩展。`,
    };
  }

  
  if (currentVersion != null) {
    if (config.version === currentVersion) {
      return { ok: false, reason: `已是最新版本（v${config.version}）。` };
    }
    if (config.version < currentVersion) {
      return { ok: false, reason: `配置版本 v${config.version} 低于已装版本 v${currentVersion}，已拒绝回滚。` };
    }
  }

  return { ok: true };
}


export function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}
