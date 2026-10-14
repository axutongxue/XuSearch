


function localized(key, n, zhTemplate) {
  const i18n = typeof window !== "undefined" ? window.__XUSEARCH_I18N__ : null;
  if (i18n && !i18n.isZhUi()) {
    const s = i18n.t(key);
    if (s) return s.replace("{n}", n);
  }
  return zhTemplate.replace("{n}", n);
}


export function formatRelativeTime(ts, now = Date.now()) {
  const value = Number(ts);
  if (!value) return "";
  const diff = now - value;
  if (diff < 60 * 1000) return localized("common_timeJustNow", 0, "刚刚");

  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return localized("common_timeMinutesAgo", minutes, "{n} 分钟前");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return localized("common_timeHoursAgo", hours, "{n} 小时前");

  const days = Math.floor(hours / 24);
  if (days < 30) return localized("common_timeDaysAgo", days, "{n} 天前");

  const months = Math.floor(days / 30);
  if (months < 12) return localized("common_timeMonthsAgo", months, "{n} 个月前");

  return localized("common_timeYearsAgo", Math.floor(months / 12), "{n} 年前");
}
