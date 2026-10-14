
import { msg } from "../state.js";
import { fetchChangelog } from "../../../shared/bundle-client.js";
import {
  readUpdateSummary,
  markUpdateSeen,
  isUpdateSummaryUnread,
  hasUpdateSummaryContent,
} from "../../../shared/bundle-update-notice.js";
import { alignOverlayToContent } from "../overlay-align.js";

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}


function richText(value) {
  return esc(value).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
}

function formatDate(iso) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}


function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (_err) {
    return String(url || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
  }
}


const SITE_PILL_KINDS = {
  removed: { cls: "off", prefix: "\u2212 ", tipKey: "settings_changelog_summaryOfflineTip", tip: "{domain} · 已下线" },
  added: { cls: "new", prefix: "+ ", tipKey: "settings_changelog_summaryAddedTip", tip: "{domain} · 新增站点" },
  updated: { cls: "upd", prefix: "\u21bb ", tipKey: "settings_changelog_summaryUpdatedTip", tip: "{domain} · 站点规则已更新" },
};

function createSummarySitePill(kind, site) {
  const spec = SITE_PILL_KINDS[kind] || SITE_PILL_KINDS.updated;
  const pill = document.createElement("span");
  pill.className = `cus-site is-${spec.cls}`;
  pill.textContent = spec.prefix + (site?.name || site?.id || "");
  const host = hostOf(site?.url);
  if (host) pill.title = msg(spec.tipKey, spec.tip).replace("{domain}", host);
  return pill;
}


const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 8 16 8"/></svg>`;


function createUpdateSummaryCard(summary, entries) {
  if (!hasUpdateSummaryContent(summary)) return null;

  const version = Number(summary.version) || 0;
  const matched = (Array.isArray(entries) ? entries : []).find((e) => Number(e?.version) === version) || null;
  const dateText = matched?.releasedAt
    ? formatDate(matched.releasedAt)
    : summary.at
      ? formatDate(new Date(Number(summary.at)).toISOString())
      : "";

  const card = document.createElement("div");
  card.className = "changelog-update-summary";
  card.innerHTML = `
    <div class="cus-cap">
      <span>${msg("settings_changelog_summaryTitle", "本次更新站点变化")}</span>
      ${version ? `<span class="cus-badge">${esc(`v${version}${dateText ? " · " + dateText : ""}`)}</span>` : ""}
    </div>
    <div class="cus-sites" data-role="sites"></div>
  `;

  const sitesEl = card.querySelector('[data-role="sites"]');
  for (const kind of ["removed", "added", "updated"]) {
    for (const site of Array.isArray(summary[kind]) ? summary[kind] : []) {
      sitesEl.appendChild(createSummarySitePill(kind, site));
    }
  }

  return card;
}


export function createChangelogEntryButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "changelog-entry-btn";
  btn.textContent = msg("settings_changelog_entry", "更新日志");

  const badge = document.createElement("span");
  badge.className = "dot-badge";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  btn.appendChild(badge);

  btn.addEventListener("click", () => {
    openChangelogModal();
  });
  
  refreshChangelogEntryBadge(btn).catch(() => {});
  return btn;
}


export async function refreshChangelogEntryBadge(btn = document.querySelector(".changelog-entry-btn")) {
  if (!btn) return false;
  const summary = await readUpdateSummary();
  const unread = await isUpdateSummaryUnread(summary);
  const count = unread
    ? ["removed", "added", "updated"].reduce(
        (n, key) => n + (Array.isArray(summary?.[key]) ? summary[key].length : 0),
        0,
      )
    : 0;

  const badge = btn.querySelector(".dot-badge");
  if (badge) {
    badge.textContent = unread ? String(count) : "";
    badge.hidden = !unread;
  }
  btn.classList.toggle("has-unread", unread);

  const entryText = msg("settings_changelog_entry", "更新日志");
  if (unread) {
    const tip = `${entryText} · ${msg("settings_changelog_entryUnread", "有未读更新")}`;
    btn.title = tip;
    btn.setAttribute("aria-label", tip);
  } else {
    btn.removeAttribute("title");
    btn.setAttribute("aria-label", entryText);
  }
  return unread;
}


export async function openChangelogModal() {
  const overlay = ensureChangelogModal();
  alignOverlayToContent(overlay);
  overlay.hidden = false;
  await renderChangelogInto(overlay.querySelector(".changelog-modal-body"));
  
  const summary = await readUpdateSummary();
  await markUpdateSeen(summary?.version);
  await refreshChangelogEntryBadge();
  return overlay;
}

function ensureChangelogModal() {
  let overlay = document.getElementById("changelogModalOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "changelogModalOverlay";
  overlay.className = "update-modal-overlay changelog-modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="update-modal-card changelog-modal-card" role="dialog" aria-modal="true" aria-label="${msg("settings_changelogTitle", "规则库更新日志")}">
      <!-- 关闭按钮与会员弹窗同款（ICON_CLOSE 同源 SVG；样式见 16-membership.css 的
           .changelog-modal-card .update-modal-close 并列规则） -->
      <button type="button" class="update-modal-close" aria-label="${msg("settings_changelogClose", "关闭")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="changelog-modal-body"></div>
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


export async function renderChangelogInto(container) {
  if (!container) return;
  container.innerHTML = "";

  
  const [result, summary] = await Promise.all([fetchChangelog(), readUpdateSummary()]);
  const entries = result.ok && Array.isArray(result.changelog) ? result.changelog : [];

  const card = document.createElement("section");
  card.className = "other-settings-card changelog-card";
  card.innerHTML = `
    <div class="changelog-intro-row">
      <div class="other-settings-intro">
        <strong>${msg("settings_changelog_heading", "规则库更新日志")}</strong>
        <p class="changelog-intro">${msg(
          "settings_changelog_intro",
          "每次规则库发布都会记录在这里，免费用户同样可见——站点失效修复与新增都在持续进行。",
        )}</p>
      </div>
      <button type="button" class="cu-check-btn" data-role="check-update">${ICON_REFRESH}<span data-role="check-label">${msg("settings_changelog_checkUpdate", "检查规则更新")}</span></button>
    </div>
    <p class="cu-feedback" data-role="check-feedback" hidden></p>
    <div class="changelog-list" data-role="list">
      <p class="changelog-empty">${msg("settings_changelog_loading", "正在读取更新日志…")}</p>
    </div>
  `;

  const listEl = card.querySelector('[data-role="list"]');
  
  const summaryCard = createUpdateSummaryCard(summary, entries);
  if (summaryCard && listEl) card.insertBefore(summaryCard, listEl);

  container.appendChild(card);
  mountCheckUpdateButton(card, container);
  if (!listEl) return;

  if (!entries.length) {
    listEl.innerHTML = `<p class="changelog-empty">${msg(
      "settings_changelog_empty",
      "暂时没有可显示的更新日志（可能无法连接服务器，稍后再试）。",
    )}</p>`;
    return;
  }

  listEl.innerHTML = entries
    .map((entry, index) => {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      const version = entry?.version != null ? `v${entry.version}` : "";
      return `
        <article class="changelog-item${index === 0 ? " is-latest" : ""}">
          <div class="changelog-item-head">
            ${version ? `<span class="changelog-version">${esc(version)}</span>` : ""}
            <span class="changelog-date">${esc(formatDate(entry?.releasedAt))}</span>
            ${index === 0 ? `<span class="changelog-latest-tag">${msg("settings_changelog_latest", "最新")}</span>` : ""}
          </div>
          ${changes.length ? `<ul class="changelog-changes">${changes.map((c) => `<li>${richText(c)}</li>`).join("")}</ul>` : ""}
        </article>
      `;
    })
    .join("");
}


function mountCheckUpdateButton(card, container) {
  const btn = card.querySelector('[data-role="check-update"]');
  const feedback = card.querySelector('[data-role="check-feedback"]');
  if (!btn) return;
  const labelEl = btn.querySelector('[data-role="check-label"]');
  btn.addEventListener("click", async () => {
    if (btn.classList.contains("is-checking")) return;
    btn.classList.add("is-checking");
    btn.setAttribute("aria-disabled", "true");
    if (labelEl) labelEl.textContent = msg("settings_changelog_checking", "检查中…");
    try {
      const result = await chrome.runtime.sendMessage({
        type: "ENSURE_BUNDLE",
        force: true,
        trigger: "manual",
      });
      const status = result?.status;
      
      
      
      
      try {
        await fetchChangelog({ force: true });
      } catch (_err) {
        
      }
      await renderChangelogInto(container);
      const freshFeedback = container.querySelector("[data-role=check-feedback]");
      if (status === "updated") {
        
        if (freshFeedback) {
          freshFeedback.hidden = false;
          freshFeedback.textContent = msg("settings_changelog_checkUpdated", "已更新到 v{v}，以上内容已刷新。").replace(
            "{v}",
            String(result?.version ?? ""),
          );
        }
        return;
      }
      const messages = {
        unchanged: msg("settings_changelog_checkLatest", "已是最新版本"),
        not_activated: msg("settings_changelog_checkLatest", "已是最新版本"),
        unauthorized: msg("settings_membership_updateUnauthorized", "授权已失效，请重新激活"),
        subscription_expired: msg("settings_membership_updateExpired", "订阅已到期，请续费"),
        offline: msg("settings_membership_updateOffline", "无法连接服务器，请稍后重试"),
      };
      if (freshFeedback) {
        freshFeedback.hidden = false;
        freshFeedback.classList.add("is-warn");
        freshFeedback.textContent = messages[status] || msg("settings_changelog_checkDone", "检查完成");
      }
    } catch (_err) {
      if (feedback) {
        feedback.hidden = false;
        feedback.classList.add("is-warn");
        feedback.textContent = msg("settings_membership_updateFailed", "检查失败，请稍后重试");
      }
    } finally {
      btn.classList.remove("is-checking");
      btn.removeAttribute("aria-disabled");
      
      if (btn.isConnected && labelEl) labelEl.textContent = msg("settings_changelog_checkUpdate", "检查规则更新");
    }
  });
}
