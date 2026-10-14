
import { state, msg } from "../state.js";
import { escapeHtml } from "../utils.js";
import { formatRelativeTime } from "../../../shared/relative-time.js";



const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_MEMBER = `<svg class="membership-entry-icon" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M311.114667 371.242667L471.146667 169.098667a52.106667 52.106667 0 0 1 81.706666 0l160.032 202.144 153.152-65.632a52.106667 52.106667 0 0 1 71.541334 58.474666l-89.44 430.933334a112.416 112.416 0 0 1-110.08 89.568H285.941333a112.416 112.416 0 0 1-110.08-89.568l-89.429333-430.933334a52.106667 52.106667 0 0 1 71.541333-58.474666l153.152 65.632zM512 220.608L355.648 418.101333a52.106667 52.106667 0 0 1-61.376 15.552l-140.544-60.234666 84.8 408.586666a48.416 48.416 0 0 0 47.402667 38.581334h452.138666a48.416 48.416 0 0 0 47.402667-38.581334l84.8-408.586666-140.544 60.234666a52.106667 52.106667 0 0 1-61.376-15.552L512 220.608z" fill="currentColor"/></svg>`;
import {
  activate,
  fetchSubscriptionInfo,
  unbindDevice,
  unbindAllDevices,
  daysRemaining,
  remainingKind,
  getLocalLicense,
  maskCode,
  TOKEN_FAIL,
} from "../../../shared/membership-client.js";
import { getBundleStatus } from "../../../shared/bundle-client.js";
import { alignOverlayToContent } from "../overlay-align.js";


export const SUBSCRIBE_URL = "https://ifdian.net/a/axutongxue";


const AFDIAN_MESSAGE_URL = "https://ifdian.net/message";


const ICON_EXTERNAL = `<svg class="md-recover-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;


const FEEDBACK_FORM_URL = "https://my.feishu.cn/share/base/form/shrcnENi3DQf1pLXlSMTrPX6Cbg";



let entryRenderSeq = 0;

export async function renderMembershipEntry() {
  const wrap = state.dom.groupsHeaderActions;
  if (!wrap) return;
  const seq = ++entryRenderSeq;
  
  wrap.querySelectorAll(".membership-entry-btn, .membership-report-btn").forEach((el) => el.remove());

  const local = await getLocalLicense();
  const info = await fetchSubscriptionInfo();
  
  if (seq !== entryRenderSeq) return;
  const activated = info.ok;
  const sub = info.subscription || {};
  const permanent = !!sub.permanent || sub.subscriptionEnd == null;
  const days = daysRemaining(sub);
  const expired = activated && sub.active === false;

  const entry = document.createElement("button");
  entry.type = "button";
  entry.className = "membership-entry-btn";
  
  
  const kind = remainingKind(sub);
  let entryText;
  if (activated) {
    entryText = expired
      ? t("settings_membership_entryExpired", "会员 · 已到期")
      : permanent
        ? t("settings_membership_entryPermanent", "会员 · 永久")
        : kind?.unit === "ltHour"
          
          ? t("settings_membership_entryExpiringSoon", "会员 · 即将到期")
          : `${t("settings_membership_entryPrefix", "会员 · 还剩")} ${remainingPhrase(sub)}`;
    if (expired || (!permanent && days != null && days <= 7)) entry.classList.add("is-danger");
  } else if (local.tokenFailure?.reason === TOKEN_FAIL.REVOKED) {
    
    
    entryText = t("settings_membership_entryRevoked", "会员 · 本机已解绑");
    entry.classList.add("is-warn");
  } else if (info.error === "request_failed" || info.error === "storage_error") {
    
    
    entryText = t("settings_membership_entryUnreachable", "会员 · 服务端暂不可达");
    entry.title = t(
      "settings_membership_entryUnreachableTip",
      "服务端暂时连不上（本地后端可能没在运行），恢复后这里会自动恢复会员状态",
    );
    entry.classList.add("is-warn");
  } else {
    
    entryText = local.codeMask
      ? t("settings_membership_entryInvalid", "会员 · 状态异常")
      : t("settings_membership_entryFree", "开通会员");
  }
  
  entry.innerHTML = `${ICON_MEMBER}${escapeHtml(entryText)}`;
  entry.addEventListener("click", () => openMembershipModal());
  wrap.prepend(entry);

  
  if (activated) {
    const report = document.createElement("button");
    report.type = "button";
    report.className = "membership-report-btn";
    report.textContent = t("settings_membership_report", "失效反馈");
    report.addEventListener("click", reportBrokenSite);
    entry.after(report);
  }
}


function refreshEntry() {
  const wrap = document.getElementById("groupsHeaderActions");
  if (!wrap) return;
  
  
  
  renderMembershipEntry();
}


async function pullBundleAfterActivation() {
  let status = "skipped";
  let reconciled = 0;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "ENSURE_BUNDLE",
      force: true, 
      
      
      
      
      forceFullDownload: true,
      trigger: "activation",
    });
    status = result?.status || "unknown";
    
    reconciled = Number(result?.groupsReconciled) || 0;
  } catch (_err) {
    
    status = "sw_unavailable";
  }

  if (status === "updated" || reconciled > 0) {
    try {
      await state.reloadSettingsData?.();
    } catch (_err) {
      
    }
  }
  return { pulled: status === "updated" || reconciled > 0, status, reconciled };
}


function pullFailureSuffix(status) {
  if (status === "rate_limited") {
    return t(
      "settings_membership_updateRateLimited",
      "（规则库请求过于频繁，请 1 小时后再试；已装规则仍可正常使用）",
    );
  }
  if (status === "offline" || status === "http_error" || status === "sw_unavailable") {
    return t(
      "settings_membership_activatePullFailed",
      "（规则库暂时拉取失败，稍后打开设置页会自动重试）",
    );
  }
  if (status === "subscription_expired") {
    return t("settings_membership_updateExpired", "订阅已到期，请续费");
  }
  if (status === "unauthorized") {
    return t("settings_membership_updateUnauthorized", "授权已失效，请重新激活");
  }
  return "";
}


async function finishActivation(card, okText) {
  const { status } = await pullBundleAfterActivation();
  await renderMembershipInto(card);
  const suffix = pullFailureSuffix(status);
  showFeedback(
    card.querySelector('[data-role="feedback"]'),
    okText + suffix,
    suffix ? "warn" : "ok",
  );
}


async function reportBrokenSite() {
  try {
    const status = await getBundleStatus();
    const payload = t("settings_membership_reportMeta", "扩展 v{ext} · 规则库 v{ver} · {count} 站")
      .replace("{ext}", chrome.runtime.getManifest().version)
      .replace("{ver}", status.version ?? "未下发")
      .replace("{count}", String(status.siteCount ?? 0));
    await navigator.clipboard.writeText(payload);
  } catch (_err) {
    
  }

  try {
    chrome.tabs.create({ url: FEEDBACK_FORM_URL }).catch(() => {});
  } catch (_err) {
    
  }
}


export async function openMembershipModal() {
  const overlay = ensureMembershipModal();
  alignOverlayToContent(overlay);
  overlay.hidden = false;
  await renderMembershipInto(overlay.querySelector(".membership-modal-body"));
  return overlay;
}

function ensureMembershipModal() {
  let overlay = document.getElementById("membershipModalOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "membershipModalOverlay";
  overlay.className = "update-modal-overlay membership-modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="update-modal-card membership-modal-card" role="dialog" aria-modal="true" aria-label="${t("settings_membership_title", "会员")}">
      <button type="button" class="update-modal-close" aria-label="${t("settings_membership_close", "关闭")}">${ICON_CLOSE}</button>
      <div class="membership-modal-body"></div>
    </div>
  `;
  const close = () => {
    overlay.hidden = true;
  };
  overlay.querySelector(".update-modal-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
  document.body.appendChild(overlay);
  return overlay;
}

const t = (key, fallback) => msg(key, fallback);


function remainingPhrase(sub) {
  const k = remainingKind(sub);
  if (!k) return null;
  if (k.unit === "ltHour") return t("settings_membership_ltHour", "不到 1 小时");
  if (k.unit === "hour") return `${k.n} ${t("settings_membership_hours", "小时")}`;
  return `${k.n} ${t("settings_membership_days", "天")}`;
}


function subEndText(sub) {
  if (!sub || sub.permanent || sub.subscriptionEnd == null) return t("settings_membership_permanent", "永久有效");
  try {
    return new Date(sub.subscriptionEnd).toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_err) {
    return "—";
  }
}

function shortUa(ua) {
  const s = String(ua || "");
  const os = /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "macOS"
      : /Android/.test(s) ? "Android"
        : /iPhone|iPad/.test(s) ? "iOS"
          : /Linux/.test(s) ? "Linux" : "";
  const browser = /Edg\//.test(s) ? "Edge"
    : /Chrome\//.test(s) ? "Chrome"
      : /Firefox\//.test(s) ? "Firefox"
        : /Safari\//.test(s) ? "Safari" : "";
  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : (s.slice(0, 24) || t("settings_membership_unknownDevice", "未知设备"));
}

function showFeedback(el, text, level) {
  if (!el) return;
  el.hidden = false;
  el.className = `membership-feedback is-${level}`;
  el.textContent = text;
}


function mountEscapes(container, items) {
  const bar = document.createElement("div");
  bar.className = "md-escapes";
  const cap = document.createElement("span");
  cap.className = "md-escapes-cap";
  cap.textContent = t("settings_membership_escapes", "遇到情况：");
  bar.appendChild(cap);
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    
    btn.className = "md-escape" + (item.className ? ` ${item.className}` : "");
    btn.dataset.role = item.role;
    btn.textContent = item.label;
    btn.addEventListener("click", () => item.onClick?.(btn));
    bar.appendChild(btn);
  }
  container.appendChild(bar);
  return bar;
}


function revokedBlockHtml(revoked) {
  const rows = [];
  if (revoked.codeMask) {
    rows.push(`<div class="md-revoke-kv"><span>${escapeHtml(t("settings_membership_revokedCode", "这台曾用激活码"))}</span><b>${escapeHtml(revoked.codeMask)}</b></div>`);
  }
  if (revoked.at) {
    const when = new Date(revoked.at).toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const by = revoked.byUa ? ` · ${escapeHtml(t("settings_membership_revokedBy", "由"))} ${escapeHtml(shortUa(revoked.byUa))} ${escapeHtml(t("settings_membership_revokedBy2", "操作"))}` : "";
    rows.push(`<div class="md-revoke-kv"><span>${escapeHtml(t("settings_membership_revokedAt", "被解绑时间"))}</span><b>${escapeHtml(when)}${by}</b></div>`);
  }
  return `
    <div class="md-block is-revoke">
      <div class="md-kicker">${t("settings_membership_revokedKicker", "发生了什么")}</div>
      <div class="md-block-name">${t("settings_membership_revokedTitle", "这台设备被移出了原订阅")}</div>
      <p class="md-desc">${t("settings_membership_revokedDesc", "1 个激活码最多绑 2 台设备，任意一台已激活的设备都能解绑其他设备。这台被解绑后，本地的授权凭据已失效。")}</p>
      ${rows.join("")}
    </div>`;
}


function togglePanel(container, cls, buildHtml) {
  
  const selector = "." + cls.trim().split(/\s+/).join(".");
  const existed = container.querySelector(selector);
  if (existed) {
    existed.remove();
    return null;
  }
  const panel = document.createElement("div");
  panel.className = cls;
  panel.innerHTML = buildHtml();
  container.appendChild(panel);
  return panel;
}

function toggleRecoverPanel(container) {
  const panel = togglePanel(container, "md-recover", () => `
    <h4 class="md-recover-title">${t("settings_membership_recoverTitle", "激活码在爱发电的私信里，按下述操作一般可以找到：")}</h4>
    <ol>
      <li>${t("settings_membership_recoverStep1", "点击下方按钮，在「右上角登录」你的爱发电账号")}</li>
      <li>${t("settings_membership_recoverStep2", "然后在页面上找到「阿虚同学」给你发送的私信，那一长串字母数字就是激活码")}</li>
      <li>${t("settings_membership_recoverStep3", "复制后粘贴到上面的输入框。码 = 你的账号，请勿遗失或发给他人")}</li>
      <li>${t("settings_membership_recoverStep4", "如果私信中没有找到激活码，请将你的「订单号」通过爱发电私信给我，等待人工验证订单号后回复")}</li>
    </ol>
    <div class="md-recover-actions">
      <a class="membership-btn is-primary md-recover-open" href="${AFDIAN_MESSAGE_URL}" target="_blank" rel="noreferrer noopener">${ICON_EXTERNAL}${t("settings_membership_recoverOpen", "打开爱发电私信页面")}</a>
    </div>
  `);
  return panel;
}


function toggleSlotsPanel(container) {
  return togglePanel(container, "md-recover md-note", () => `
    <h4 class="md-recover-title">${t("settings_membership_slotsTitle", "名额已满怎么办")}</h4>
    <ol>
      <li>${t("settings_membership_slotsStep1", "一台订阅最多绑 2 台设备，同一台电脑上的多个浏览器只算 1 台。但是最多只可在 4 个浏览器上激活")}</li>
      <li>${t("settings_membership_slotsStep2", "如果你想在当前浏览器激活，最好的方式是去旧设备的浏览器打开扩展设置页 → 会员 → 设备列表，点某一台的「解绑」（需要粘贴完整激活码）")}</li>
      <li>${t("settings_membership_slotsStep3", "如果你旧设备都不在手里了，在新浏览器激活失败时，页面会提示「解绑全部旧设备并重新激活」，点它即可一次性解绑所有已激活的浏览器，然后重新激活")}</li>
    </ol>
  `);
}


export async function renderMembershipInto(container) {
  if (!container) return;
  container.innerHTML = "";
  refreshEntry();

  const card = document.createElement("section");
  card.className = "other-settings-card membership-card";
  container.appendChild(card);

  card.innerHTML = `<p class="membership-loading">${t("settings_membership_loading", "正在读取会员状态…")}</p>`;

  const info = await fetchSubscriptionInfo();
  if (info.ok) {
    await renderStatusCard(card, info);
    return;
  }

  
  
  const local = await getLocalLicense();
  const failure = tokenFailureOf(info, local);
  const revoked = failure?.reason === TOKEN_FAIL.REVOKED
    ? { codeMask: local.codeMask || "", at: failure.at, byUa: failure.byUa }
    : null;
  const notice = failure?.reason === TOKEN_FAIL.STALE
    ? t("settings_membership_staleToken", "这台设备的授权已换发（可能在别处重新激活过），请重新输入激活码。")
    : failure?.reason === TOKEN_FAIL.REVOKED
      
      ? ""
      : info.error === "not_activated"
        ? ""
        : t("settings_membership_offline", "暂时无法连接服务器，请稍后重试。");
  renderActivationForm(card, notice, revoked);
}


function tokenFailureOf(info, local) {
  if (info.error === TOKEN_FAIL.REVOKED || info.error === TOKEN_FAIL.STALE) {
    return { reason: info.error, at: info.revokedAt || null, byUa: info.revokedByUa || "" };
  }
  const mark = local.tokenFailure;
  if (info.error === "not_activated" && mark?.reason) {
    return { reason: mark.reason, at: mark.at || null, byUa: mark.byUa || "" };
  }
  return null;
}



function buyBlockHtml(isRevoked) {
  if (isRevoked) {
    return `
      <div class="md-block">
        <div class="md-kicker">${t("settings_membership_revokedBuyKicker", "不记得那张码了")}</div>
        <div class="md-block-name">${t("settings_membership_revokedBuyTitle", "找回激活码 / 开通新订阅")}</div>
        <div class="md-row">
          <button type="button" class="md-cta is-ghost" data-role="recover-entry-2">${t("settings_membership_recoverBtn", "找回激活码")}</button>
          <a class="md-cta is-ghost" href="${SUBSCRIBE_URL}" target="_blank" rel="noreferrer noopener">${t("settings_membership_buyCode", "购买激活码 ↗")}</a>
        </div>
        <p class="md-desc">${t("settings_membership_revokedBuyDesc", "激活码由爱发电私信自动发放，在「我的 - 订单」里可以找到。请先找回原码 —— 重新买一张等于多开一个订阅。")}</p>
      </div>`;
  }
  return `
    <div class="md-block is-buy">
      <div class="md-kicker">${t("settings_membership_buyKicker", "还没有码")}</div>
      <div class="md-block-name">${t("settings_membership_buyTitle", "开通会员")}</div>
      <ul class="md-list">
        <li>${t("settings_membership_perkSites", "全部下发站点解锁")}</li>
        <li>${t("settings_membership_perkUpdate", "站点失效持续更新规则")}</li>
        <li>${t("settings_membership_perkDevices", "1 个激活码可绑 2 台设备")}</li>
      </ul>
      <a class="md-cta" href="${SUBSCRIBE_URL}" target="_blank" rel="noreferrer noopener">${t("settings_membership_buyCode", "购买激活码 ↗")}</a>
      <p class="md-cta-note">${t("settings_membership_buyNote", "在爱发电下单，激活码由私信自动发放，约 1 分钟")}</p>
    </div>`;
}


function activateBlockHtml(isRevoked) {
  return `
    <div class="md-block${isRevoked ? " is-buy" : ""}" data-role="activate-block">
      <div class="md-kicker">${isRevoked
    ? t("settings_membership_revokedActKicker", "想继续用 · 首选这条")
    : t("settings_membership_actKicker", "已经有码")}</div>
      <div class="md-block-name">${isRevoked
    ? t("settings_membership_revokedActTitle", "用原激活码把这台挂回来")
    : t("settings_membership_actTitle", "输入激活码")}</div>
      <p class="md-desc" data-role="continue-hint" hidden>${t(
        "settings_membership_continueHintTop",
        "填你上次用过的旧激活码，把这台设备挂回原订阅（换电脑 / 重装 / 多加一台设备都走这里，旧码到期前可重复使用）",
      )}</p>
      <div class="membership-activate-row">
        <input type="text" class="membership-code-input" data-role="code-new" autocomplete="off" spellcheck="false"
          placeholder="${t(isRevoked ? "settings_membership_codePlaceholderOld" : "settings_membership_codePlaceholder",
      isRevoked ? "粘贴你原来的激活码" : "粘贴激活码")}" />
        <button type="button" class="membership-btn is-primary membership-activate-btn">${t("settings_membership_activate", "激活")}</button>
      </div>
      <p class="md-desc" data-role="continue-mid-hint" hidden>${t(
        "settings_membership_continueHintMid",
        "如果同时还买了新码，请将新码填在下方，这样才能在原订阅的基础上续期订阅时间！",
      )}</p>
      <div class="membership-activate-row" data-role="old-code-row" hidden>
        <input type="text" class="membership-code-input" data-role="code-old" autocomplete="off" spellcheck="false"
          placeholder="${t("settings_membership_oldCodePlaceholder", "粘贴你最新购买的激活码")}" />
      </div>
    </div>`;
}

function renderActivationForm(card, notice = "", revoked = null) {
  const isRevoked = !!revoked;
  card.innerHTML = `
    <div class="md-head">
      <span class="md-title">${t("settings_membership_title", "会员")}</span>
      <span class="md-badge${isRevoked ? " is-warn" : ""}">${isRevoked
    ? t("settings_membership_badgeRevoked", "本机已解绑")
    : t("settings_membership_badgeFree", "免费版")}</span>
    </div>
    <p class="md-lead">${isRevoked
    ? t("settings_membership_revokedLead", "这台设备已被移出订阅，你的订阅本身没有失效：其他设备仍在使用，这台现在按免费版运行。")
    : t("settings_membership_intro", "免费版可用内置站点。开通后解锁全部下发站点与持续规则更新。")}</p>
    ${isRevoked ? revokedBlockHtml({ codeMask: revoked.codeMask, at: revoked.at, byUa: revoked.byUa }) : ""}
    ${notice ? `<div class="membership-feedback is-warn">${escapeHtml(notice)}</div>` : ""}
    ${isRevoked ? activateBlockHtml(true) + buyBlockHtml(true) : buyBlockHtml(false) + activateBlockHtml(false)}
    <div class="membership-feedback" data-role="feedback" hidden></div>
  `;

  
  
  
  
  const recoverHost = () => card;
  card.querySelectorAll('[data-role="recover-entry-2"]').forEach((btn) => {
    btn.addEventListener("click", () => toggleRecoverPanel(recoverHost()));
  });

  const newInput = card.querySelector('[data-role="code-new"]');
  
  
  const defaultNewPlaceholder = newInput?.placeholder || "";
  const oldInput = card.querySelector('[data-role="code-old"]');
  const oldRow = card.querySelector('[data-role="old-code-row"]');
  const continueHint = card.querySelector('[data-role="continue-hint"]');
  const continueMidHint = card.querySelector('[data-role="continue-mid-hint"]');
  const btn = card.querySelector(".membership-activate-btn");
  const feedback = card.querySelector('[data-role="feedback"]');

  
  let mode = "new";
  let escapesBar = null;

  
  const setMode = (next) => {
    mode = next;
    const cont = next === "continue";
    
    continueHint.hidden = !cont;
    continueMidHint.hidden = !cont;
    oldRow.hidden = !cont;
    
    
    
    if (escapesBar) {
      const chip = escapesBar.querySelector('[data-role="continue"]');
      if (chip) chip.classList.toggle("is-active", cont);
    }
    btn.textContent = cont
      ? t("settings_membership_continueSubmit", "接续原订阅")
      : t("settings_membership_activate", "激活");
    
    
    
    if (newInput) {
      newInput.placeholder = cont
        ? t("settings_membership_continueCodePlaceholder", "粘贴你上次用过，仍未过期的激活码")
        : defaultNewPlaceholder;
    }
    feedback.hidden = true;
    if (cont) oldInput?.focus();
  };

  
  
  const toggleContinue = () => {
    setMode(mode === "continue" ? "new" : "continue");
  };

  escapesBar = mountEscapes(card, [
    {
      role: "recover",
      label: t("settings_membership_recoverBtn", "找回激活码"),
      
      onClick: (btn) => { const p = toggleRecoverPanel(recoverHost()); btn.classList.toggle("is-active", !!p); },
    },
    {
      role: "continue",
      label: t("settings_membership_continueEntryShort", "换电脑 / 重装 / 加设备"),
      
      onClick: (btn) => toggleContinue(btn),
    },
    {
      role: "slots",
      label: t("settings_membership_slotsEntry", "设备名额已满"),
      onClick: (btn) => { const p = toggleSlotsPanel(card); btn.classList.toggle("is-active", !!p); },
    },
  ]);

  
  const mergeNewCode = async (code) => {
    const merge = await activate(code);
    if (!merge.ok) {
      showFeedback(
        feedback,
        `${merge.message || t("settings_membership_failed", "激活失败")} ${t(
          "settings_membership_mergeFailedHint",
          "本机已挂回原订阅，但这张新码还没有用上；重新输入新激活码即可完成续费。",
        )}`,
        "error",
      );
      return;
    }
    const phrase = remainingPhrase(merge.subscription);
    await finishActivation(
      card,
      t("settings_membership_renewOk", "续费成功，有效期已延长。") +
        (phrase == null
          ? ""
          : ` ${t("settings_membership_remaining", "当前剩余")} ${phrase}。`),
    );
  };

  
  const runContinue = async (code, oldCode) => {
    
    
    const join = await activate(oldCode, { preflight: true });
    if (join.intentRequired) {
      showFeedback(
        feedback,
        t(
          "settings_membership_oldCodeUnused",
          "这张码还没有被激活过，看起来不是你的旧激活码。请检查后重试。",
        ),
        "error",
      );
      return;
    }
    if (!join.ok) {
      if (join.canForceRelease) {
        
        renderForceRelease(card, feedback, oldCode, join.message, async () => {
          setMode("continue");
          await mergeNewCode(code);
        });
        return;
      }
      showFeedback(
        feedback,
        join.message || t("settings_membership_oldCodeFailed", "旧激活码无效，请检查后重试"),
        "error",
      );
      return;
    }
    
    
    if (!code) {
      await finishActivation(
        card,
        t("settings_membership_continueOnlyOldOk", "已用原激活码把这台设备挂回原订阅。"),
      );
      return;
    }
    await mergeNewCode(code);
  };

  
  const enterContinue = () => {
    setMode("continue");
  };

  
  const runNew = async (code) => {
    const result = await activate(code);
    if (result.ok) {
      await finishActivation(
        card,
        result.isRenewal
          ? t("settings_membership_renewOk", "续费成功，有效期已延长。")
          : t("settings_membership_activateOk", "激活成功，规则库正在更新。"),
      );
      return;
    }
    if (result.intentRequired) {
      
      renderIntentChoice(feedback, code, { onContinue: enterContinue, onNew: () => runNew(code) });
      return;
    }
    if (result.canForceRelease) {
      renderForceRelease(card, feedback, code, result.message);
      return;
    }
    showFeedback(feedback, result.message || t("settings_membership_failed", "激活失败"), "error");
  };

  const submit = async () => {
    const code = String(newInput?.value || "").trim();
    
    
    if (!code && mode !== "continue") {
      showFeedback(feedback, t("settings_membership_needCode", "请先输入激活码"), "warn");
      return;
    }

    if (mode === "continue") {
      const oldCode = String(oldInput?.value || "").trim();
      if (!oldCode) {
        showFeedback(feedback, t("settings_membership_needOldCode", "请输入你上次用过的激活码"), "warn");
        return;
      }
      if (oldCode === code) {
        showFeedback(
          feedback,
          t("settings_membership_oldCodeSame", "上下两栏填的是同一张码。只激活它的话，直接点「激活」即可。"),
          "warn",
        );
        return;
      }
      btn.disabled = true;
      btn.textContent = t("settings_membership_activating", "激活中…");
      try {
        await runContinue(code, oldCode);
      } finally {
        btn.disabled = false;
        if (mode === "continue") {
          btn.textContent = t("settings_membership_continueSubmit", "接续原订阅");
        }
      }
      return;
    }

    btn.disabled = true;
    btn.textContent = t("settings_membership_activating", "激活中…");
    try {
      
      
      
      
      
      
      const result = await activate(code);
      if (result.ok) {
        await finishActivation(
          card,
          result.isRenewal
            ? t("settings_membership_renewOk", "续费成功，有效期已延长。")
            : t("settings_membership_activateOk", "激活成功，规则库正在更新。"),
        );
        return;
      }
      if (result.intentRequired) {
        renderIntentChoice(feedback, code, { onContinue: enterContinue, onNew: () => runNew(code) });
        return;
      }
      if (result.canForceRelease) {
        renderForceRelease(card, feedback, code, result.message);
        return;
      }
      showFeedback(feedback, result.message || t("settings_membership_failed", "激活失败"), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = t("settings_membership_activate", "激活");
    }
  };

  btn?.addEventListener("click", submit);
  newInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  oldInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
}


function renderForceRelease(card, container, code, message, onDone) {
  if (!container) return;
  container.hidden = false;
  container.className = "membership-feedback is-warn";
  container.innerHTML = `
    <p>${escapeHtml(message || t("settings_membership_deviceFull", "该激活码已绑满 2 台设备。"))}</p>
    <button type="button" class="membership-btn membership-force-btn">${t(
      "settings_membership_forceRelease",
      "解绑全部旧设备并重新激活",
    )}</button>
  `;

  container.querySelector(".membership-force-btn")?.addEventListener("click", async () => {
    const confirmed = window.confirm(
      t(
        "settings_membership_forceConfirm",
        "将解绑该激活码下的全部设备（包含本机），随后需要重新激活。确定继续？",
      ),
    );
    if (!confirmed) return;

    const released = await unbindAllDevices(code);
    if (!released.ok) {
      showFeedback(container, released.message || t("settings_membership_unbindFailed", "解绑失败"), "error");
      return;
    }
    const again = await activate(code, { preflight: true });
    if (again.intentRequired) {
      
      
      
      showFeedback(
        container,
        t(
          "settings_membership_reactivateNeedIntent",
          "已解绑旧设备，但这张码仍未激活。请关闭本窗口后重新输入激活码。",
        ),
        "warn",
      );
      return;
    }
    if (again.ok) {
      if (onDone) {
        await onDone();
      } else {
        await finishActivation(card, t("settings_membership_reactivated", "已重新激活。"));
      }
    } else {
      showFeedback(container, again.message || t("settings_membership_failed", "激活失败"), "error");
    }
  });
}


function renderIntentChoice(container, code, { onNew, onContinue } = {}) {
  if (!container) return;
  container.hidden = false;
  container.className = "membership-feedback is-warn";
  container.innerHTML = `
    <p>${t("settings_membership_intentTitle", "这张激活码要怎么使用？")}
      <span class="membership-code-mask">${escapeHtml(maskCode(code))}</span></p>
    <div class="membership-intent-list">
      <label class="membership-intent-option">
        <input type="radio" name="membership-intent" value="new" checked />
        <span class="membership-intent-text">
          <strong>${t("settings_membership_intentNew", "开通新订阅")}</strong>
          <em>${t(
            "settings_membership_intentNewHint",
            "本机成为新订阅的第 1 台设备。需要更多设备同时使用时选这个。",
          )}</em>
        </span>
      </label>
      <label class="membership-intent-option">
        <input type="radio" name="membership-intent" value="continue" />
        <span class="membership-intent-text">
          <strong>${t("settings_membership_intentContinue", "接续我原来的订阅（换电脑 / 重装）")}</strong>
          <em>${t(
            "settings_membership_intentContinueHint",
            "把本机挂回原订阅，再用这张码延长有效期，原订阅剩余天数不丢失。需要你提供上次用过的激活码。",
          )}</em>
        </span>
      </label>
    </div>
    <button type="button" class="membership-btn is-primary membership-intent-next">${t(
      "settings_membership_intentNext",
      "下一步",
    )}</button>
  `;

  const next = container.querySelector(".membership-intent-next");
  next?.addEventListener("click", async () => {
    const choice = container.querySelector('input[name="membership-intent"]:checked')?.value || "new";
    if (choice === "continue") {
      
      
      onContinue?.();
      return;
    }

    next.disabled = true;
    next.textContent = t("settings_membership_activating", "激活中…");
    try {
      await onNew?.();
    } finally {
      next.disabled = false;
      next.textContent = t("settings_membership_intentNext", "下一步");
    }
  });
}




async function renderStatusCard(card, info) {
  const sub = info.subscription || {};
  const devices = Array.isArray(sub.devices) ? sub.devices : [];
  const permanent = !!sub.permanent || sub.subscriptionEnd == null;
  const days = daysRemaining(sub);
  const expired = sub.active === false;

  const endText = subEndText(sub);

  
  
  
  let banner = "";
  if (expired) {
    banner = `<div class="membership-banner is-danger">${t(
      "settings_membership_expiredBanner",
      "订阅已到期，规则库已停止更新。续费后立即恢复。",
    )}</div>`;
  } else if (!permanent && days != null && days <= 30) {
    const level = days <= 7 ? "is-danger" : days <= 14 ? "is-warn" : "is-info";
    banner = `<div class="membership-banner ${level}">${escapeHtml(
      t("settings_membership_renewBanner", `${remainingPhrase(sub)}后到期，建议提前续费，避免规则更新中断。`),
    )}</div>`;
  }

  
  
  
  const counting = Number.isFinite(Number(sub.deviceSlots))
    ? Number(sub.deviceSlots)
    : devices.filter((d) => d.counting !== false).length;
  const maxDevices = Number(sub.maxDevices) || 2;
  
  
  const groupCounts = new Map();
  for (const d of devices) {
    if (d.counting === false) continue;
    const g = Number(d.machineGroup);
    if (!(g >= 0)) continue;
    groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
  }

  card.classList.toggle("is-expired", expired);
  const badge = expired
    ? `<span class="md-badge is-off">${t("settings_membership_statusExpired", "已到期")}</span>`
    : `<span class="md-badge is-on">${permanent
      ? t("settings_membership_statusPermanent", "永久会员")
      : t("settings_membership_statusActive", "已激活")}</span>`;
  
  
  
  const lead = expired
    ? t("settings_membership_expiredLead", "订阅已到期，<b>规则库已停止更新</b>，会员站点已停用。到期后不再有「续费」这一说：买一张新码激活即可，有效期从激活当天重新计算，会员组与站点将在激活后按最新规则恢复。")
    : permanent
      ? t("settings_membership_permanentLead", "永久会员，规则库持续更新。")
      : t("settings_membership_activeLead", "规则库正常更新中。到期前 7 天这里会开始提醒。");

  
  const bundle = await getBundleStatus().catch(() => null);
  const bundleTs = Number(bundle?.releasedAt) || 0;
  const bundleDate = bundleTs
    ? new Date(bundleTs).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "";
  const bundleParts = bundle?.version ? [`v${bundle.version}`] : [];
  if (bundle?.siteCount) bundleParts.push(`${bundle.siteCount} ${t("settings_membership_bundleSites", "站")}`);
  if (bundleDate) bundleParts.push(bundleDate);
  const bundleText = bundleParts.length ? bundleParts.join(" · ") : "—";

  card.innerHTML = `
    <div class="md-head">
      <span class="md-title">${t("settings_membership_title", "会员")}</span>
      ${badge}
    </div>
    <p class="md-lead">${lead}</p>
    ${banner}

    <div class="md-block">
      <div class="md-kicker">${t("settings_membership_statusKicker", "当前状态")}</div>
      <div class="md-block-name">${t("settings_membership_statusName", "我的订阅")}</div>
      <div class="md-kv"><span>${t("settings_membership_endAt", "有效期至")}</span><b>${escapeHtml(endText)}</b></div>
      ${expired
    ? `<div class="md-kv is-danger"><span>${t("settings_membership_stateLine", "状态")}</span><b>${t("settings_membership_stateExpired", "已过期 · 不再续期")}</b></div>`
    : (!permanent && days != null
      ? `<div class="md-kv"><span>${t("settings_membership_daysLeft", "剩余")}</span><b>${escapeHtml(remainingPhrase(sub) || "—")}</b></div>`
      : "")}
      <div class="md-kv"><span>${t("settings_membership_code", "激活码")}</span><b>${escapeHtml(info.codeMask || "—")}</b></div>
      <div class="md-kv"><span>${t("settings_membership_bundleLine", "规则库")}</span><b>${escapeHtml(bundleText)}</b></div>

      <div class="membership-devices">
        <div class="membership-devices-head">
          <strong>${t("settings_membership_devices", "已激活设备")}</strong>
          <span class="membership-devices-count">${counting} / ${maxDevices}</span>
        </div>
        <ul class="membership-device-list">
          ${devices.length
    ? devices.map((d) => renderDeviceRow(d, info.deviceUuid, groupCounts)).join("")
    : `<li class="membership-device-empty">${t("settings_membership_noDevices", "暂无设备记录")}</li>`}
        </ul>
        ${devices.length >= 2
    ? `<p class="membership-hint">${t(
      "settings_membership_machineHint",
      "同一台电脑上的多个浏览器（如 Chrome / Edge）算作同一台设备，只占用 1 个名额。",
    )}</p>`
    : ""}
        <p class="membership-hint">${t(
    "settings_membership_unbindHint",
    "解绑需要完整激活码（存于爱发电私信）：点击设备后的「解绑」，粘贴激活码即可。长期未活跃的设备会自动释放名额。",
  )}</p>
      </div>
    </div>

    <div class="md-duo">
      <div class="md-block is-buy">
        <div class="md-kicker">${expired
    ? t("settings_membership_recoverBuyKicker", "恢复更新")
    : t("settings_membership_renewKicker", "不够用了")}</div>
        <div class="md-block-name">${expired
    ? t("settings_membership_buyTitle", "购买激活码")
    : t("settings_membership_renewTitle", "续费 / 加时长")}</div>
        <p class="md-desc">${expired
    ? t("settings_membership_expiredBuyDesc", "买一张新码，有效期从激活当天重新计算")
    : t("settings_membership_renewDesc", "新码自动并入当前订阅，剩余天数不丢")}</p>
        <a class="md-cta" href="${SUBSCRIBE_URL}" target="_blank" rel="noreferrer noopener">${t("settings_membership_buyCode", "购买激活码 ↗")}</a>
      </div>
      <div class="md-block">
        <div class="md-kicker">${t("settings_membership_haveNewCode", "已经买到新码")}</div>
        <div class="md-block-name">${expired
    ? t("settings_membership_actTitle", "输入激活码")
    : t("settings_membership_renewName", "粘贴新码续期")}</div>
        <input type="text" class="membership-code-input md-input" data-role="renew-code" autocomplete="off" spellcheck="false"
          placeholder="${t("settings_membership_codePlaceholder", "粘贴激活码")}" />
        <button type="button" class="md-cta membership-renew-btn">${expired
    ? t("settings_membership_activate", "激活")
    : t("settings_membership_renewSubmit", "续期")}</button>
      </div>
    </div>
    <div class="membership-feedback" data-role="feedback" hidden></div>
  `;

  const feedback = card.querySelector('[data-role="feedback"]');

  
  mountEscapes(card, [
    {
      role: "recover",
      label: t("settings_membership_recoverBtn", "找回激活码"),
      onClick: (btn) => { const p = toggleRecoverPanel(card); btn.classList.toggle("is-active", !!p); },
    },
  ]);

  
  
  
  const renewInput = card.querySelector('[data-role="renew-code"]');
  const renewBtn = card.querySelector(".membership-renew-btn");
  const submitRenew = async () => {
    const code = String(renewInput?.value || "").trim();
    if (!code) {
      showFeedback(feedback, t("settings_membership_needCode", "请先输入激活码"), "warn");
      return;
    }
    renewBtn.disabled = true;
    renewBtn.textContent = t("settings_membership_activating", "激活中…");
    try {
      const result = await activate(code);
      if (result.ok) {
        await finishActivation(
          card,
          result.isRenewal
            ? (expired
              ? t("settings_membership_renewOkExpired", "激活成功，会员已恢复，有效期已重新延长。")
              : t("settings_membership_renewOk", "续费成功，有效期已延长。"))
            : t("settings_membership_activateOk", "激活成功，规则库正在更新。"),
        );
        return;
      }
      if (result.canForceRelease) {
        
        showFeedback(
          feedback,
          `${result.message || t("settings_membership_deviceFull", "该激活码已绑满 2 台设备。")} ${t(
            "settings_membership_fullElsewhere",
            "这张码的名额已在别的机器上用掉。请在还留在手里的旧设备上解绑一台，或换一张没用过的码。",
          )}`,
          "error",
        );
        return;
      }
      showFeedback(feedback, result.message || t("settings_membership_failed", "激活失败"), "error");
    } finally {
      renewBtn.disabled = false;
      renewBtn.textContent = expired
        ? t("settings_membership_activate", "激活")
        : t("settings_membership_renewSubmit", "续期");
    }
  };
  renewBtn?.addEventListener("click", submitRenew);
  renewInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitRenew();
  });

  card.querySelectorAll("[data-unbind-uuid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uuid = btn.getAttribute("data-unbind-uuid");
      const code = window.prompt(
        t("settings_membership_promptCode", "请粘贴完整激活码以完成解绑（存于爱发电私信）："),
      );
      if (!code) return;
      const result = await unbindDevice(code, uuid);
      if (!result.ok) {
        showFeedback(feedback, result.message || t("settings_membership_unbindFailed", "解绑失败"), "error");
        return;
      }
      showFeedback(feedback, t("settings_membership_unbindOk", "已解绑该设备。"), "ok");
      await renderMembershipInto(card);
    });
  });
}


function renderDeviceRow(device, localUuid, groupCounts) {
  const isLocal = !!localUuid && device.deviceUuid === localUuid;
  const released = device.counting === false;
  const grouped = !released && Number(device.machineGroup) >= 0
    && (groupCounts?.get(Number(device.machineGroup)) || 0) > 1;
  const lastActive = formatRelativeTime(Number(device.lastActive) || 0);

  return `
    <li class="membership-device${released ? " is-released" : ""}">
      <div class="membership-device-info">
        <span class="membership-device-name">
          ${escapeHtml(shortUa(device.ua))}
          ${isLocal ? `<span class="membership-device-tag is-local">${t("settings_membership_thisDevice", "本机")}</span>` : ""}
          ${grouped ? `<span class="membership-device-tag is-same-machine">${t("settings_membership_sameMachineTag", "同一台电脑")}</span>` : ""}
          ${released ? `<span class="membership-device-tag is-released">${t("settings_membership_releasedTag", "已释放名额")}</span>` : ""}
        </span>
        <span class="membership-device-meta">${lastActive ? `${t("settings_membership_activeAt", "活跃于")} ${escapeHtml(lastActive)}` : ""}</span>
      </div>
      <button type="button" class="membership-btn is-ghost" data-unbind-uuid="${escapeHtml(device.deviceUuid || "")}">${t(
    "settings_membership_unbind",
    "解绑",
  )}</button>
    </li>
  `;
}
