import { state, msg } from "../state.js";

const LOGO_URL = chrome.runtime.getURL("settings/about-logo.png");
const WECHAT_QR_URL = chrome.runtime.getURL("settings/assets/wechat-qrcode.webp");
const SITE_URL = "https://xusearch.com";
const GITHUB_URL = "http://github.com/axutongxue/XuSearch";

function ensureWechatModal() {
  let overlay = document.querySelector(".about-qr-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.className = "about-qr-overlay";
  overlay.innerHTML = `
    <div class="about-qr-modal" role="dialog" aria-modal="true" aria-label="${msg("settings_about_wechatAria", "公众号二维码")}">
      <button type="button" class="about-qr-close" aria-label="${msg("settings_about_close", "关闭")}">&times;</button>
      <img class="about-qr-img" src="${WECHAT_QR_URL}" alt="${msg("settings_about_wechatAlt", "阿虚同学公众号二维码")}" />
    </div>
  `;

  const close = () => overlay.classList.remove("open");
  overlay.querySelector(".about-qr-close").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("open")) close();
  });

  document.body.appendChild(overlay);
  return overlay;
}

export function renderAboutSection() {
  const { aboutSection } = state.dom;
  aboutSection.innerHTML = "";

  
  const inner = document.createElement("div");
  inner.className = "about-inner";
  inner.innerHTML = `
    <div class="about-brand">
      <img class="about-brand-logo" src="${LOGO_URL}" alt="${msg("settings_about_heroAlt", "Xusearch")}" />
      <div class="about-brand-names"><span>${msg("settings_about_heroCn", "虚空搜索")}</span></div>
      <span class="about-brand-ver">v${chrome.runtime.getManifest().version}</span>
    </div>

    <section class="about-shield-card" aria-label="${msg("settings_about_privacyTitle", "隐私与数据说明")}">
      <div class="about-shield-ring" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
      </div>
      <h2 class="about-shield-head">${msg("settings_about_shieldTitle", "你的数据只属于你")}</h2>
      <p class="about-shield-sub">${msg("settings_about_privacyTitle", "隐私与数据说明")}</p>
      <div class="about-checks">
        <div class="about-check">
          <span class="about-check-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
          <p><b>${msg("settings_about_openSourceLabel", "开源可审查：")}</b>${msg("settings_about_openSourceBody", "XuSearch 是一款开源的浏览器自动化扩展，通过「官方搜索串」或者「模拟人工键鼠操作」完成单一或者批量搜索与提问。")}</p>
        </div>
        <div class="about-check">
          <span class="about-check-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
          <p><b>${msg("settings_about_zeroDataLabel", "零数据收集：")}</b>${msg("settings_about_zeroDataBody", "XuSearch 不会将您的搜索关键词、浏览记录或页面内容上传到开发者服务器。用于功能的配置数据仅保存在本地。")}</p>
        </div>
        <div class="about-check">
          <span class="about-check-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
          <p><b>${msg("settings_about_transparencyLabel", "交互透明性：")}</b>${msg("settings_about_transparencyBody", "插件通过 iframe 或「新标签页模式」打开目标网站，您与网站的登录与交互均直接发生在浏览器与目标网站之间。")}</p>
        </div>
      </div>
    </section>

    <div class="about-links">
      <a class="about-link" href="${SITE_URL}" target="_blank" rel="noreferrer noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>${msg("settings_about_site", "插件官网")}
      </a>
      <a class="about-link" href="${GITHUB_URL}" target="_blank" rel="noreferrer noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>${msg("settings_about_source", "开源地址")}
      </a>
      <button type="button" class="about-link" id="about-wechat-btn" aria-label="${msg("settings_about_wechatAria", "公众号二维码")}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M18 18h3v3h-3z"/></svg>${msg("settings_about_wechat", "作者公众号")}
      </button>
    </div>

    <p class="about-foot">${msg("settings_about_footer", "XuSearch · 开源项目（GPL）· 配置数据仅保存在本地")}</p>
  `;
  aboutSection.appendChild(inner);

  const wechatBtn = inner.querySelector("#about-wechat-btn");
  if (wechatBtn) {
    wechatBtn.addEventListener("click", () => {
      ensureWechatModal().classList.toggle("open");
    });
  }
}
