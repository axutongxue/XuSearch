import { escapeHtml } from "./utils.js";


export function flattenExportBodyMarkdown(raw) {
  const text = String(raw || "").trim();
  if (!text || text === "暂未提取到内容") {
    return text || "暂未提取到内容";
  }

  const lines = text.split(/\r?\n/);
  const out = [];
  let inCodeFence = false;
  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    const trimmed = trimmedEnd.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      out.push(trimmedEnd);
      continue;
    }
    if (inCodeFence) {
      out.push(trimmedEnd);
      continue;
    }
    const headingMatch = trimmedEnd.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[2].trim();
      out.push(`**${title}**`);
      out.push("");
    } else {
      out.push(trimmedEnd);
    }
  }

  let result = out.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result || "暂未提取到内容";
}


function parseQAFromFlatContent(content) {
  if (!content || content === "暂未提取到内容") return null;

  
  const cleanUI = (text) =>
    text
      .replace(/(编辑|复制|分享|收藏|朗读|Edit|Copy|Share|点赞|踩|Thumbs up|Thumbs down)\s*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  
  if (content.includes("You said:")) {
    const pairs = [];
    const segs = content.split(/(?:^|\n)You said:\s*/m).filter(Boolean);
    for (const seg of segs) {
      const nl = seg.indexOf("\n");
      if (nl === -1) continue;
      const question = seg.slice(0, nl).trim();
      let answer = seg.slice(nl).trim();
      answer = answer
        .replace(/^[^\n]*Claude responded:[^\n]*\n/gm, "")
        .replace(/^\d{1,2}:\d{2}\s*\n/gm, "")
        .replace(/^Claude is AI[^\n]*\n/gm, "")
        .replace(/^Sonnet[^\n]*\n/gm, "")
        .replace(/^Adaptive\s*\n/gm, "")
        .replace(/^[^\n]*finished the response[^\n]*\n/gm, "")
        .trim();
      if (question && answer && answer.length > 20) {
        pairs.push({ question, answers: [flattenExportBodyMarkdown(answer)] });
      }
    }
    if (pairs.length > 0) return pairs;
  }

  
  const blocks = content
    .split(/\n{1,2}---\n{1,2}/)
    .map((b) => cleanUI(b))
    .filter((b) => b.length > 0);

  if (blocks.length < 2) return null;

  
  const isQuestion = (b) => {
    if (!b || b.length < 8 || b.length > 350) return false;
    if (/`/.test(b)) return false;
    if (/\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bclass\b|\breturn\b|=>|===/m.test(b)) return false;
    const mdCount = (b.match(/^#{1,6}\s|^\s*[-*+]\s|\*\*|```/gm) || []).length;
    if (mdCount > 0) return false;
    if (/^\d+[\.\)]\s/.test(b.trim())) return false;
    return true;
  };

  const pairs = [];
  let i = 0;
  while (i < blocks.length) {
    if (isQuestion(blocks[i])) {
      const q = blocks[i].replace(/\r?\n/g, " ").trim();
      const ansBlocks = [];
      let j = i + 1;
      while (j < blocks.length && !isQuestion(blocks[j])) {
        ansBlocks.push(blocks[j]);
        j++;
        if (ansBlocks.length >= 2) break;
      }
      if (ansBlocks.length > 0 && q.length >= 2) {
        pairs.push({
          question: q,
          answers: [flattenExportBodyMarkdown(ansBlocks.join("\n\n"))],
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  return pairs.length > 0 ? pairs : null;
}


function extractModelQAPairs(resp) {
  const turns = Array.isArray(resp.turns) ? resp.turns : null;
  if (turns && turns.length > 0) {
    const pairs = [];
    let cur = null;
    for (const turn of turns) {
      if (turn.role === "user") {
        const q = String(turn.text || "")
          .replace(/^(你说|You\s+said)[：:：\s]*/i, "")
          .trim();
        if (!q) continue;
        cur = { question: q, answers: [] };
        pairs.push(cur);
      } else if (turn.role === "assistant" && cur) {
        const text = flattenExportBodyMarkdown(String(turn.text || ""));
        const last = cur.answers[cur.answers.length - 1];
        if (text && text !== last) cur.answers.push(text);
      }
    }
    if (pairs.length > 0) return pairs;
  }

  const contentPairs = parseQAFromFlatContent(resp.content);
  if (contentPairs && contentPairs.length > 0) return contentPairs;

  return [];
}


export function renderSingleModelBlock(resp, format) {
  const name     = resp.siteName;
  const url      = resp.url;
  const pairs    = extractModelQAPairs(resp);

  const contentBlocks = (() => {
    const raw = resp.content || "";
    if (!raw || raw === "暂未提取到内容") return [];
    const bs = raw
      .split(/\n{1,2}---\n{1,2}/)
      .map((b) => flattenExportBodyMarkdown(b.trim()))
      .filter((b) => b && b !== "暂未提取到内容" && b.length > 10);
    return bs;
  })();

  const singleFallback = flattenExportBodyMarkdown(resp.content || "暂未提取到内容");

  if (format === "markdown") {
    const header = `# ${name}\n\n**URL：**${url}`;

    if (pairs.length > 0) {
      const body = pairs
        .map((p) => {
          const qLine = p.question.replace(/\r?\n/g, " ").trim();
          const ans   = p.answers.join("\n\n") || "暂未提取到内容";
          return [
            qLine ? `**User:** ${qLine}` : null,
            `**AI:** ${ans}`,
          ].filter(Boolean).join("\n\n");
        })
        .filter(Boolean)
        .join("\n\n---\n\n");
      return `${header}\n\n${body}`;
    }

    if (contentBlocks.length > 1) {
      const body = contentBlocks.map((b) => `**AI:** ${b}`).join("\n\n---\n\n");
      return `${header}\n\n${body}`;
    }
    return `${header}\n\n${singleFallback}`;
  }

  if (format === "html") {
    const headerHtml = `<h1>${escapeHtml(name)}</h1><p><strong>URL：</strong><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></p>`;

    if (pairs.length > 0) {
      const body = pairs
        .map((p) => {
          const qLine = p.question.replace(/\r?\n/g, " ").trim();
          const ans   = p.answers.join("\n\n") || "暂未提取到内容";
          return [
            qLine ? `<p class="user-turn"><strong>User:</strong> ${escapeHtml(qLine)}</p>` : null,
            `<div class="ai-turn"><strong>AI:</strong><pre>${escapeHtml(ans)}</pre></div>`,
          ].filter(Boolean).join("");
        })
        .filter(Boolean)
        .join("<hr class=\"turn-sep\">");
      return `<section class="model-section">${headerHtml}${body}</section>`;
    }

    if (contentBlocks.length > 1) {
      const body = contentBlocks
        .map((b) => `<div class="ai-turn"><strong>AI:</strong><pre>${escapeHtml(b)}</pre></div>`)
        .join("<hr class=\"turn-sep\">");
      return `<section class="model-section">${headerHtml}${body}</section>`;
    }
    return `<section class="model-section">${headerHtml}<pre>${escapeHtml(singleFallback)}</pre></section>`;
  }

  
  if (pairs.length > 0) {
    const body = pairs
      .map((p) => {
        const qLine = p.question.replace(/\r?\n/g, " ").trim();
        const ans   = p.answers.join("\n\n") || "暂未提取到内容";
        return [qLine ? `User: ${qLine}` : null, `AI: ${ans}`].filter(Boolean).join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n" + "-".repeat(40) + "\n\n");
    return `${name}\nURL: ${url}\n\n${body}`;
  }

  if (contentBlocks.length > 1) {
    const body = contentBlocks
      .map((b) => `AI: ${b}`)
      .join("\n\n" + "-".repeat(40) + "\n\n");
    return `${name}\nURL: ${url}\n\n${body}`;
  }
  return `${name}\nURL: ${url}\n\n${singleFallback}`;
}
