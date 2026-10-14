














import previewData from "../../../config/memberGroups.preview.js";
import { getBundleStatus } from "../../../shared/bundle-client.js";
import { msg } from "../state.js";
import { escapeHtml } from "../utils.js";
import { SUBSCRIBE_URL } from "./membership.js";


let previewing = false;


function createPreviewSiteTile(site) {
  const tile = document.createElement("div");
  tile.className = "site-tile preview-site-tile";
  tile.title = msg("settings_groups_previewSiteTip", "会员站点 · 开通后可直接使用（当前为预览）");

  const label = site.name || "";
  const avatar = site.icon
    ? `<img class="site-tile-avatar has-icon" src="${site.icon}" alt="" aria-hidden="true">`
    : `<span class="site-tile-avatar" aria-hidden="true">${escapeHtml([...label][0] || "?")}</span>`;

  tile.innerHTML = `
    ${avatar}
    <span class="site-tile-text">
      <span class="site-chip-label">${escapeHtml(label)}</span>
      <span class="site-tile-domain">&nbsp;</span>
    </span>
  `;
  return tile;
}


function createPreviewGroupCard(group) {
  const card = document.createElement("section");
  card.className = "settings-group-card preview-locked-card";

  const head = document.createElement("div");
  head.className = "group-card-head";

  const identity = document.createElement("div");
  identity.className = "group-card-identity";
  const siteCount = (group.sites || []).length;
  identity.innerHTML = `
    <div class="group-card-titleline">
      <span class="preview-group-name">${escapeHtml(group.name || "")}</span>
      <span class="preview-member-badge">${msg("settings_groups_previewBadge", "会员")}</span>
    </div>
    <div class="group-card-sub">
      <span class="group-card-sub-text">${siteCount} ${escapeHtml(msg("settings_groups_siteUnit", "个站点"))}</span>
      <span class="group-card-dot" aria-hidden="true"></span>
      <span class="group-card-sub-text">${escapeHtml(msg("settings_groups_previewGroupSub", "会员专属搜索组（当前为预览）"))}</span>
    </div>
  `;
  head.appendChild(identity);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "group-card-body";
  const grid = document.createElement("div");
  grid.className = "site-tile-grid";
  for (const site of group.sites || []) grid.appendChild(createPreviewSiteTile(site));
  body.appendChild(grid);
  card.appendChild(body);
  return card;
}


export function mountMembershipPreview(groupsSection) {
  if (!groupsSection) return;
  
  getBundleStatus()
    .then((status) => {
      if (!status?.activated) renderPreviewUi(groupsSection);
    })
    .catch(() => {
      
    });
}

function renderPreviewUi(groupsSection) {
  const groups = Array.isArray(previewData?.groups) ? previewData.groups : [];
  if (!groups.length) return;

  
  const lockedWrap = document.createElement("div");
  lockedWrap.className = "preview-locked-wrap";
  for (const g of groups) lockedWrap.appendChild(createPreviewGroupCard(g));

  
  const bar = document.createElement("div");
  bar.className = "member-preview-bar";
  bar.innerHTML = `
    <span class="member-preview-bar-text">${msg(
      "settings_groups_previewBarText",
      "开通会员即可解锁 AI 联网推理 / 网盘资源搜索／免费在线影视／免费音乐资源／免费电脑软件 等会员组的持续规则更新 —— 先看看开通后的样子？",
    )}</span>
    <span class="member-preview-actions">
      <button class="member-preview-entry-btn" type="button">${msg("settings_groups_previewEntry", "👁 预览会员版")}</button>
      <button class="member-preview-exit-btn" type="button">${msg("settings_groups_previewExit", "退出预览")}</button>
      <a class="member-preview-buy-btn" href="${SUBSCRIBE_URL}" target="_blank" rel="noreferrer noopener">${msg(
        "settings_groups_previewBuy",
        "开通会员 ↗",
      )}</a>
    </span>
  `;

  
  const notice = document.createElement("div");
  notice.className = "member-preview-notice";
  notice.innerHTML = `
    <span class="member-preview-notice-tag">${msg("settings_groups_previewNoticeTag", "预览模式")}</span>
    <span class="member-preview-notice-text">${msg(
      "settings_groups_previewNoticeText",
      "这是开通会员后的样子 —— 会员组会与你的分组并列，组内站点可持续更新。",
    )}</span>
    <button class="member-preview-notice-exit" type="button">${msg("settings_groups_previewExit", "退出预览")}</button>
  `;

  const addCard = groupsSection.querySelector(".settings-add-card");
  if (addCard) {
    groupsSection.insertBefore(lockedWrap, addCard);
    groupsSection.insertBefore(bar, addCard);
  } else {
    groupsSection.appendChild(lockedWrap);
    groupsSection.appendChild(bar);
  }
  groupsSection.appendChild(notice);

  const paint = () => {
    lockedWrap.hidden = !previewing;
    notice.hidden = !previewing;
    bar.classList.toggle("is-previewing", previewing);
  };

  bar.querySelector(".member-preview-entry-btn").addEventListener("click", () => {
    previewing = true;
    paint();
    lockedWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  for (const btn of [bar.querySelector(".member-preview-exit-btn"), notice.querySelector(".member-preview-notice-exit")]) {
    btn.addEventListener("click", () => {
      previewing = false;
      paint();
    });
  }

  paint();
}
