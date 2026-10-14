
import { msg } from "./state.js";
import { fetchGroupSiteIcons } from "./site-icon-fetch.js";

const FETCH_ICON_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const FETCH_DONE_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

export function createSiteIconFetchButton({
  getTargetIds,
  keyPrefix = "groups",
  emptyTitle = "还没有站点",
  onFinished,
} = {}) {
  const key = (name) => `settings_${keyPrefix}_fetchIcons${name}`;
  const idleTitle = msg(key("Title"), "获取站点图标");
  const initialIds = getTargetIds();

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "group-card-icon-btn";
  btn.dataset.field = "fetch-icons";
  btn.innerHTML = FETCH_ICON_SVG;
  btn.title = `${idleTitle}（${initialIds.length}）`;
  btn.setAttribute("aria-label", idleTitle);

  if (!initialIds.length) {
    btn.disabled = true;
    btn.title = emptyTitle;
    return btn;
  }

  btn.addEventListener("click", async () => {
    if (btn.classList.contains("is-progress")) return;
    
    const targetIds = getTargetIds();
    if (!targetIds.length) return;

    btn.classList.remove("is-done");
    btn.classList.add("is-progress");
    btn.disabled = true;
    btn.textContent = msg(key("Preparing"), "准备中…");
    btn.title = msg(key("Running"), "正在获取站点图标…");

    try {
      const result = await fetchGroupSiteIcons(targetIds, (done, total) => {
        
        if (total > 0) {
          btn.textContent = msg(key("Doing"), "正在获取") + " " + done + "/" + total + "…";
        }
      });

      btn.classList.remove("is-progress");
      const { total, ok, failed = 0, unresolved = 0 } = result;
      const allSet = !total && !unresolved;
      if (allSet || failed === 0) {
        btn.classList.add("is-done");
        btn.innerHTML = FETCH_DONE_SVG;
      } else {
        
        btn.innerHTML = FETCH_ICON_SVG;
      }
      if (allSet) {
        btn.title = msg(key("AllSet"), "所有站点图标都已就绪");
      } else {
        let label = msg(key("Done"), "已获取") + ` ${ok}/${total}`;
        if (failed) {
          label += msg(key("FailedPart"), `，${failed} 个未取得（该站没有 favicon 或页面打不开）`);
        }
        if (unresolved) {
          label += msg(key("UnresolvedPart"), `，${unresolved} 个站点在配置里查不到、无法获取`);
        }
        btn.title = label;
      }

      
      setTimeout(() => {
        onFinished?.();
      }, 2000);
    } catch (_error) {
      
      btn.classList.remove("is-progress");
      btn.disabled = false;
      btn.innerHTML = FETCH_ICON_SVG;
      btn.title = `${idleTitle}（${getTargetIds().length}）`;
    }
  });

  return btn;
}
