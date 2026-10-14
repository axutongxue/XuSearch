import { escapeHtml, normalizeQueryForMatch } from "./utils.js";
import { state } from "./state.js";
import { flattenExportBodyMarkdown, renderSingleModelBlock } from "./export-format.js";

export function buildExportSectionsFromConversations(cardData) {
  const cardsWithTurns = cardData.filter((c) => Array.isArray(c.turns) && c.turns.length > 0);
  if (cardsWithTurns.length === 0) return null;

  const cardPairs = cardsWithTurns.map((card) => {
    const pairs = [];
    const turns = card.turns;
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role === "user") {
        let j = i + 1;
        while (j < turns.length && turns[j].role !== "assistant") j++;
        const answer = j < turns.length ? turns[j].text : "";
        if (answer) {
          pairs.push({ question: turns[i].text, answer });
        }
      }
    }
    return { siteName: card.siteName, url: card.url, pairs };
  });

  const seenQ = new Map();
  for (const card of cardPairs) {
    for (const pair of card.pairs) {
      const norm = normalizeQueryForMatch(pair.question);
      if (!seenQ.has(norm)) {
        seenQ.set(norm, pair.question);
      }
    }
  }

  if (seenQ.size === 0) return null;

  const sections = [];
  for (const [normQ, question] of seenQ.entries()) {
    const models = [];
    for (const card of cardPairs) {
      const pair = card.pairs.find((p) => normalizeQueryForMatch(p.question) === normQ);
      if (pair) {
        models.push({ siteName: card.siteName, url: card.url, content: pair.answer });
      }
    }
    if (models.length > 0) {
      sections.push({ query: question, models });
    }
  }

  return sections.length > 0 ? sections : null;
}

export function buildSiteNameFilter(selectedSiteIds) {
  if (!selectedSiteIds) {
    return null;
  }
  const names = new Set();
  for (const [id, ref] of state.cardRefs.entries()) {
    if (selectedSiteIds.has(id)) {
      names.add(ref.site.name);
    }
  }
  return names;
}


function parseConversationGroups(item, bigQuery) {
  const turns = Array.isArray(item.turns) ? item.turns : null;
  if (!turns || turns.length === 0) return null;

  let startIdx = 0;
  if (bigQuery) {
    const normBig = normalizeQueryForMatch(bigQuery);
    let matchIdx = -1;
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== "user") continue;
      const cleaned = String(turns[i].text || "")
        .replace(/^(你说|You\s+said)[：:：\s]*/i, "")
        .trim();
      const normTurn = normalizeQueryForMatch(cleaned);
      if (
        normTurn === normBig ||
        (normBig.length > 6 && normTurn.includes(normBig)) ||
        (normTurn.length > 6 && normBig.includes(normTurn))
      ) {
        matchIdx = i;
      }
    }
    if (matchIdx >= 0) startIdx = matchIdx;
  }

  const relevantTurns = turns.slice(startIdx);

  const groups = [];
  let currentGroup = null;
  let seenUserCount = 0;

  for (const turn of relevantTurns) {
    if (turn.role === "user") {
      seenUserCount++;
      const cleanText = String(turn.text || "")
        .replace(/^(你说|You\s+said)[：:：\s]*/i, "")
        .trim();
      if (seenUserCount === 1) {
        currentGroup = { question: null, answers: [] };
      } else {
        currentGroup = { question: cleanText, answers: [] };
      }
      groups.push(currentGroup);
    } else if (turn.role === "assistant") {
      if (!currentGroup) {
        currentGroup = { question: null, answers: [] };
        groups.push(currentGroup);
      }
      const text = flattenExportBodyMarkdown(String(turn.text || ""));
      const lastAnswer = currentGroup.answers[currentGroup.answers.length - 1];
      if (text && text !== lastAnswer) {
        currentGroup.answers.push(text);
      }
    }
  }

  return groups.length > 0 ? groups : null;
}

export function renderSectionsToFormat(sections, format) {
  const valid = sections.filter((s) => (s.items || []).length > 0);
  if (valid.length === 0) return "";

  if (format === "markdown") {
    return valid
      .map((section) => {
        const queryLine = String(section.query || "").replace(/\r?\n/g, " ").trim();
        const timeLine = section.time ? `导出时间：${section.time}` : "";
        const modelBlocks = section.items
          .map((item) => {
            const groups = parseConversationGroups(item, section.query);
            let body;
            if (groups) {
              body = groups
                .map((g) => {
                  const answerText = g.answers.join("\n\n") || "暂未提取到内容";
                  if (g.question === null) {
                    return answerText;
                  }
                  const qLine = g.question.replace(/\r?\n/g, " ").trim();
                  return qLine ? `### ${qLine}\n\n${answerText}` : answerText;
                })
                .filter(Boolean)
                .join("\n\n");
            } else {
              body = flattenExportBodyMarkdown(item.content || "暂未提取到内容");
            }
            return `## ${item.siteName}\n\n**URL：**${item.url}\n\n${body}`;
          })
          .join("\n\n");
        return [`# ${queryLine}`, timeLine, modelBlocks].filter(Boolean).join("\n\n");
      })
      .join("\n\n---\n\n");
  }

  if (format === "html") {
    const querySections = valid
      .map((section) => {
        const modelBlocks = section.items
          .map((item) => {
            const groups = parseConversationGroups(item, section.query);
            let bodyHtml;
            if (groups) {
              bodyHtml = groups
                .map((g) => {
                  const answerHtml = `<pre>${escapeHtml(g.answers.join("\n\n") || "暂未提取到内容")}</pre>`;
                  if (g.question === null) return answerHtml;
                  const qLine = g.question.replace(/\r?\n/g, " ").trim();
                  return qLine ? `<h3>${escapeHtml(qLine)}</h3>${answerHtml}` : answerHtml;
                })
                .filter(Boolean)
                .join("");
            } else {
              bodyHtml = `<pre>${escapeHtml(flattenExportBodyMarkdown(item.content || "暂未提取到内容"))}</pre>`;
            }
            return `<section class="model-section"><h2>${escapeHtml(item.siteName)}</h2><p><strong>URL：</strong> <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p>${bodyHtml}</section>`;
          })
          .join("");
        const timeHtml = section.time ? `<p class="export-time">${escapeHtml(`导出时间：${section.time}`)}</p>` : "";
        return `<section class="query-section"><h1>${escapeHtml(section.query)}</h1>${timeHtml}${modelBlocks}</section>`;
      })
      .join("<hr>");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 对比结果</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.7}.query-section{margin-bottom:40px}.model-section{margin-bottom:28px}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:12px}h3{margin:20px 0 8px;font-size:1em;color:#1e40af}a{color:#2563eb}</style></head><body>${querySections}</body></html>`;
  }

  return valid
    .map((section) => {
      const timeStr = section.time ? `导出时间：${section.time}` : "";
      const modelBlocks = section.items
        .map((item) => {
          const groups = parseConversationGroups(item, section.query);
          let body;
          if (groups) {
            body = groups
              .map((g) => {
                const answerText = g.answers.join("\n\n") || "暂未提取到内容";
                if (g.question === null) return answerText;
                const qLine = g.question.replace(/\r?\n/g, " ").trim();
                return qLine ? `▶ 追问：${qLine}\n\n${answerText}` : answerText;
              })
              .filter(Boolean)
              .join("\n\n");
          } else {
            body = flattenExportBodyMarkdown(item.content || "暂未提取到内容");
          }
          return `${item.siteName}\nURL: ${item.url}\n\n${body}`;
        })
        .join("\n\n" + "-".repeat(32) + "\n\n");
      return [section.query, timeStr, modelBlocks].filter(Boolean).join("\n\n");
    })
    .join("\n\n" + "=".repeat(40) + "\n\n");
}


function buildSectionsFromFullConversation(responses) {
  const stripPrefix = (text) =>
    String(text || "").replace(/^(你说|You\s+said)[：:：\s]*/i, "").trim();

  const withTurns = responses.filter((r) => Array.isArray(r.turns) && r.turns.length > 0);
  if (withTurns.length === 0) return null;

  const modelData = withTurns.map((resp) => {
    const pairs = [];
    let cur = null;
    for (const turn of resp.turns) {
      if (turn.role === "user") {
        const q = stripPrefix(turn.text);
        if (!q) continue;
        cur = { question: q, normQ: normalizeQueryForMatch(q), answers: [] };
        pairs.push(cur);
      } else if (turn.role === "assistant" && cur) {
        const text = flattenExportBodyMarkdown(String(turn.text || ""));
        const last = cur.answers[cur.answers.length - 1];
        if (text && text !== last) cur.answers.push(text);
      }
    }
    return { siteName: resp.siteName, url: resp.url, pairs };
  });

  const qCount = new Map();
  const qText = new Map();
  for (const model of modelData) {
    const seen = new Set();
    for (const p of model.pairs) {
      if (seen.has(p.normQ)) continue;
      seen.add(p.normQ);
      qCount.set(p.normQ, (qCount.get(p.normQ) || 0) + 1);
      if (!qText.has(p.normQ)) qText.set(p.normQ, p.question);
    }
  }

  const total = modelData.length;
  const isCommon = (normQ) => total === 1 || (qCount.get(normQ) || 0) >= 2;

  const commonNormQs = [];
  const added = new Set();
  for (const model of modelData) {
    for (const p of model.pairs) {
      if (isCommon(p.normQ) && !added.has(p.normQ)) {
        added.add(p.normQ);
        commonNormQs.push(p.normQ);
      }
    }
  }
  if (commonNormQs.length === 0) return null;

  const sections = [];
  for (const normQ of commonNormQs) {
    const query = qText.get(normQ) || normQ;
    const items = [];

    for (const model of modelData) {
      const idx = model.pairs.findIndex((p) => p.normQ === normQ);
      if (idx === -1) continue;

      const main = model.pairs[idx];
      const followups = [];
      for (let i = idx + 1; i < model.pairs.length; i++) {
        if (isCommon(model.pairs[i].normQ)) break;
        followups.push(model.pairs[i]);
      }

      items.push({
        siteName: model.siteName,
        url: model.url,
        mainAnswer: main.answers.join("\n\n") || "暂未提取到内容",
        followups,
      });
    }

    for (const resp of responses) {
      if (items.some((it) => it.siteName === resp.siteName)) continue;
      items.push({
        siteName: resp.siteName,
        url: resp.url,
        mainAnswer: flattenExportBodyMarkdown(resp.content || "暂未提取到内容"),
        followups: [],
      });
    }

    if (items.length > 0) sections.push({ query, items });
  }

  return sections.length > 0 ? sections : null;
}

function renderFullConversationSections(sections, format) {
  if (!sections || sections.length === 0) return "";

  const fmtFollowup = (fu, sep) => {
    const qLine = String(fu.question || "").replace(/\r?\n/g, " ").trim();
    const ans = fu.answers.join("\n\n") || "暂未提取到内容";
    if (!qLine) return ans;
    return sep === "md"
      ? `### ${qLine}\n\n${ans}`
      : `▶ 追问：${qLine}\n\n${ans}`;
  };

  if (format === "markdown") {
    return sections
      .map((section) => {
        const queryLine = String(section.query || "").replace(/\r?\n/g, " ").trim();
        const modelBlocks = section.items
          .map((item) => {
            const parts = [item.mainAnswer];
            if (item.followups && item.followups.length > 0) {
              parts.push(...item.followups.map((fu) => fmtFollowup(fu, "md")));
            }
            return `## ${item.siteName}\n\n**URL：**${item.url}\n\n${parts.filter(Boolean).join("\n\n")}`;
          })
          .join("\n\n");
        return [`# ${queryLine}`, modelBlocks].filter(Boolean).join("\n\n");
      })
      .join("\n\n---\n\n");
  }

  if (format === "html") {
    const querySections = sections
      .map((section) => {
        const modelBlocks = section.items
          .map((item) => {
            let bodyHtml = `<pre>${escapeHtml(item.mainAnswer)}</pre>`;
            if (item.followups && item.followups.length > 0) {
              bodyHtml += item.followups
                .map((fu) => {
                  const qLine = String(fu.question || "").replace(/\r?\n/g, " ").trim();
                  const ans = fu.answers.join("\n\n") || "暂未提取到内容";
                  return qLine
                    ? `<h3>${escapeHtml(qLine)}</h3><pre>${escapeHtml(ans)}</pre>`
                    : `<pre>${escapeHtml(ans)}</pre>`;
                })
                .join("");
            }
            return `<section class="model-section"><h2>${escapeHtml(item.siteName)}</h2><p><strong>URL：</strong><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p>${bodyHtml}</section>`;
          })
          .join("");
        return `<section class="query-section"><h1>${escapeHtml(section.query)}</h1>${modelBlocks}</section>`;
      })
      .join("<hr>");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 对比结果</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.7}.query-section{margin-bottom:40px}.model-section{margin-bottom:28px}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:12px}h3{margin:20px 0 8px;font-size:1em;color:#1e40af}a{color:#2563eb}</style></head><body>${querySections}</body></html>`;
  }

  return sections
    .map((section) => {
      const modelBlocks = section.items
        .map((item) => {
          const parts = [item.mainAnswer];
          if (item.followups && item.followups.length > 0) {
            parts.push(...item.followups.map((fu) => fmtFollowup(fu, "txt")));
          }
          return `${item.siteName}\nURL: ${item.url}\n\n${parts.filter(Boolean).join("\n\n")}`;
        })
        .join("\n\n" + "-".repeat(32) + "\n\n");
      return [section.query, modelBlocks].filter(Boolean).join("\n\n");
    })
    .join("\n\n" + "=".repeat(40) + "\n\n");
}


export function generateExportContent(responses, format, selectedSiteIds = null) {
  const allowedNames = buildSiteNameFilter(selectedSiteIds);
  const filtered = allowedNames
    ? responses.filter((r) => allowedNames.has(r.siteName))
    : responses;

  if (filtered.length === 0) return "";

  if (format === "markdown") {
    return filtered
      .map((resp) => renderSingleModelBlock(resp, "markdown"))
      .join("\n\n---\n\n");
  }

  if (format === "html") {
    const blocks = filtered
      .map((resp) => renderSingleModelBlock(resp, "html"))
      .join("<hr>");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 对话导出</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.7}.model-section{margin-bottom:40px}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:12px}h2{color:#1e40af;margin:28px 0 8px}a{color:#2563eb}</style></head><body>${blocks}</body></html>`;
  }

  return filtered
    .map((resp) => renderSingleModelBlock(resp, "txt"))
    .join("\n\n" + "=".repeat(40) + "\n\n");
}

export function generateExportPreview(responses, format, selectedSiteIds = null) {
  const full = generateExportContent(responses, format, selectedSiteIds);
  return full.length > 1600 ? `${full.slice(0, 1600)}\n\n...` : full;
}
