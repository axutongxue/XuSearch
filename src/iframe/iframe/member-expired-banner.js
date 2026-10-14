
import {
  DEVICE_TOKEN_STORAGE_KEY,
  MEMBER_AUTHORITATIVE_END_KEY,
  MEMBER_EXPIRED_BANNER_DISMISSED_KEY,
  MEMBER_FORBIDDEN_KEY,
  SIGNED_CONFIGS_STORAGE_KEY,
} from "../../shared/storage-keys.js";
import { isMemberDead } from "../../shared/member-flag.js";
import { syncMemberBadge } from "../../shared/member-gate-tip.js";

const BANNER_ID = "xusearch-member-expired-banner";

const UPLOAD_BUTTON_ID = "fileUploadBtn";


let syncChain = Promise.resolve();


async function resolveMemberDead() {
  return isMemberDead();
}

function buildBanner() {
  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.className = "free-tier-banner is-member-expired";
  banner.innerHTML = `
    <span class="free-tier-banner-text">会员已到期，会员站点已停用（重新激活后自动恢复）</span>
    <button type="button" class="free-tier-banner-cta">去续费</button>
    <button type="button" class="free-tier-banner-close" aria-label="关闭">×</button>
  `;
  banner.querySelector(".free-tier-banner-cta")?.addEventListener("click", () => {
    chrome.runtime
      .sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "groups", openMembership: true })
      .catch(() => {
        
      });
  });
  banner.querySelector(".free-tier-banner-close")?.addEventListener("click", async () => {
    await dismissExpiredBanner();
    banner.remove();
  });
  return banner;
}


function readExpiredBannerDismissal() {
  return chrome.storage.local
    .get([MEMBER_EXPIRED_BANNER_DISMISSED_KEY])
    .then((stored) => Number(stored[MEMBER_EXPIRED_BANNER_DISMISSED_KEY]) || 0)
    .catch(() => 0);
}

function dismissExpiredBanner() {
  return chrome.storage.local
    .set({ [MEMBER_EXPIRED_BANNER_DISMISSED_KEY]: Date.now() })
    .catch(() => {
      
    });
}

function clearExpiredBannerDismissal() {
  return chrome.storage.local.remove(MEMBER_EXPIRED_BANNER_DISMISSED_KEY).catch(() => {
    
  });
}

async function runSync() {
  let dead = false;
  try {
    dead = await resolveMemberDead();
  } catch (_err) {
    return; 
  }
  const existing = document.getElementById(BANNER_ID);
  const dismissedAt = await readExpiredBannerDismissal();
  
  if (dead && !dismissedAt && !existing) {
    const composer = document.querySelector(".bottom-composer");
    if (composer) composer.prepend(buildBanner());
  } else if ((!dead || dismissedAt) && existing) {
    existing.remove();
  }
  if (!dead && dismissedAt) await clearExpiredBannerDismissal();
}

function syncMemberExpiredBanner() {
  syncChain = syncChain.then(runSync, runSync);
  return syncChain;
}


export function maybeShowMemberExpiredBanner() {
  syncMemberExpiredBanner();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (
        changes[MEMBER_FORBIDDEN_KEY] ||
        changes[SIGNED_CONFIGS_STORAGE_KEY] ||
        changes[DEVICE_TOKEN_STORAGE_KEY] ||
        changes[MEMBER_AUTHORITATIVE_END_KEY] ||
        changes[MEMBER_EXPIRED_BANNER_DISMISSED_KEY]
      ) {
        syncMemberExpiredBanner();
        
        
        syncUploadMemberBadge();
      }
    });
  } catch (_err) {
    
  }
}


function syncUploadMemberBadge() {
  const btn = document.getElementById(UPLOAD_BUTTON_ID);
  if (!btn) return;
  syncMemberBadge(btn).catch(() => {
    
  });
}
