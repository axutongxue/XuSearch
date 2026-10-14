


const MEMBER_CROWN_PATH =
  "M495.274667 170.453333a21.333333 21.333333 0 0 1 33.450666 0L704.533333 392.533333a21.333333 21.333333 0 0 0 25.130667 6.368l171.392-73.450666a21.333333 21.333333 0 0 1 29.301333 23.946666l-94.912 457.28A85.333333 85.333333 0 0 1 751.893333 874.666667H272.106667a85.333333 85.333333 0 0 1-83.552-67.989334l-94.912-457.28a21.333333 21.333333 0 0 1 29.290666-23.946666l171.402667 73.450666a21.333333 21.333333 0 0 0 25.130667-6.368l175.808-222.08z";
export const MEMBER_CROWN_SVG = `<svg class="member-crown" viewBox="0 0 1024 1024" aria-hidden="true"><path d="${MEMBER_CROWN_PATH}" fill="currentColor"/></svg>`;


const TIP_HIDE_MS = 3000;

let tipEl = null;
let tipTimer = 0;

function t(key, fallback) {
  return window.__XUSEARCH_I18N__?.t?.(key) || fallback;
}


export async function queryMemberActive() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "CHECK_MEMBER_ACTIVE" });
    return resp?.active !== false;
  } catch (_err) {
    return true;
  }
}


export function removeMemberBadge(button) {
  button?.querySelectorAll(".upload-member-badge").forEach((el) => el.remove());
}


export async function syncMemberBadge(button) {
  if (!button) return false;
  const active = await queryMemberActive();
  if (active) removeMemberBadge(button);
  else attachMemberBadge(button);
  return active;
}


export function attachMemberBadge(button) {
  if (!button || button.querySelector(".upload-member-badge")) return null;
  const badge = document.createElement("span");
  badge.className = "upload-member-badge is-plain";
  badge.title = t("popup_uploadMemberBadge", "会员功能");
  badge.innerHTML = MEMBER_CROWN_SVG;
  button.appendChild(badge);
  return badge;
}


export function ensureAttachmentAnchor(button) {
  const parent = button?.parentElement;
  if (!parent) return null;
  if (parent.classList?.contains("att-anchor")) return parent;
  const anchor = document.createElement("span");
  anchor.className = "att-anchor";
  parent.insertBefore(anchor, button);
  anchor.appendChild(button);
  return anchor;
}


export function hideMemberGateTip() {
  if (tipTimer) {
    clearTimeout(tipTimer);
    tipTimer = 0;
  }
  if (tipEl && tipEl.isConnected) tipEl.remove();
  tipEl = null;
}


export function showMemberGateTip(anchor, options = {}) {
  if (!anchor) return null;
  
  if (tipEl && tipEl.isConnected && tipEl.parentElement === anchor) {
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(hideMemberGateTip, TIP_HIDE_MS);
    return tipEl;
  }
  hideMemberGateTip();

  const tip = document.createElement("span");
  tip.className = "member-tip";
  tip.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "member-tip-text";
  text.textContent = t("popup_uploadMemberTip", "批量上传附件是会员功能，激活之后即可使用");

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "member-tip-cta";
  cta.textContent = t("popup_uploadMemberCta", "去开通");
  cta.addEventListener("click", (event) => {
    event.stopPropagation();
    hideMemberGateTip();
    chrome.runtime
      .sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "groups", openMembership: true })
      .catch(() => {
        
      });
    options.afterOpen?.();
  });

  tip.appendChild(text);
  tip.appendChild(cta);
  anchor.appendChild(tip);
  tipEl = tip;
  tipTimer = setTimeout(hideMemberGateTip, TIP_HIDE_MS);
  return tip;
}
