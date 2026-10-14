
import { getBundleStatus } from "../../shared/bundle-client.js";
import { inDismissSilence } from "../../shared/dismiss-window.js";
import { FREE_BANNER_DISMISSED_KEY } from "../../shared/storage-keys.js";


const SUBSCRIBE_URL = "https://ifdian.net/a/axutongxue";

export async function maybeShowFreeTierBanner() {
  try {
    const stored = await chrome.storage.local.get([FREE_BANNER_DISMISSED_KEY]);
    if (inDismissSilence(stored[FREE_BANNER_DISMISSED_KEY])) return;

    const status = await getBundleStatus();
    if (status.activated) return;

    const composer = document.querySelector(".bottom-composer");
    if (!composer) return;

    const banner = document.createElement("div");
    banner.className = "free-tier-banner";
    banner.innerHTML = `
      <span class="free-tier-banner-text">免费版 · 订阅解锁 40+ AI 站点与持续规则更新</span>
      <a class="free-tier-banner-cta" href="${SUBSCRIBE_URL}" target="_blank" rel="noreferrer noopener">了解订阅</a>
      <button type="button" class="free-tier-banner-close" aria-label="关闭" title="关闭后 7 天内不再显示">&times;</button>
    `;

    banner.querySelector(".free-tier-banner-close")?.addEventListener("click", async () => {
      banner.remove();
      try {
        await chrome.storage.local.set({ [FREE_BANNER_DISMISSED_KEY]: Date.now() });
      } catch (_err) {
        
      }
    });

    composer.prepend(banner);
  } catch (_err) {
    
  }
}
