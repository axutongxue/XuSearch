

import { domToMarkdown } from "./extractor-dom-to-markdown.js";

function getSiteContentConfig(site, host) {
  const table = site?.pageTextExtractor;
  if (!table || typeof table !== "object") return null;
  for (const [domain, config] of Object.entries(table)) {
    if (host === domain || host.endsWith("." + domain)) return config;
  }
  return null;
}


export function hasSitePageTextConfig(site, hostname) {
  const host = String(hostname || "").replace(/^www\./, "");
  return Boolean(host) && Boolean(getSiteContentConfig(site, host));
}


function sanitizeForMarkdown(el, config) {
  const excludes = Array.isArray(config.exclude) && config.exclude.length > 0
    ? config.exclude
    : null;
  if (!excludes) return el;
  const clone = el.cloneNode(true);
  for (const sel of excludes) {
    try {
      clone.querySelectorAll(sel).forEach((n) => n.remove());
    } catch (_e) {
      
    }
  }
  return clone;
}

function extractBySiteSelectors(site, host) {
  const config = getSiteContentConfig(site, host);
  if (!config) return "";

  const parts = [];

  for (const containerSel of (config.containers || [])) {
    const containers = Array.from(document.querySelectorAll(containerSel));
    if (containers.length === 0) continue;

    for (const container of containers) {
      let text = "";
      for (const contentSel of (config.content || [])) {
        const el = container.querySelector(contentSel);
        if (el) {
          text = domToMarkdown(sanitizeForMarkdown(el, config));
          break;
        }
      }
      if (!text) text = domToMarkdown(sanitizeForMarkdown(container, config));
      if (text) parts.push(text);
    }

    if (parts.length > 0) break;
  }

  if (parts.length > 0) return parts.join("\n\n---\n\n").slice(0, 10000);

  for (const contentSel of (config.content || [])) {
    const nodes = Array.from(document.querySelectorAll(contentSel));
    if (nodes.length > 0) {
      const texts = nodes
        .map((n) => domToMarkdown(sanitizeForMarkdown(n, config)))
        .filter(Boolean);
      if (texts.length > 0) return texts.join("\n\n---\n\n").slice(0, 10000);
    }
  }

  return "";
}

function extractWithGenericSelectors() {
  const selectors = [
    "[data-message-author-role='assistant']",
    ".markdown",
    ".prose",
    "[class*='assistant-message']",
    "[class*='ai-message']",
    "[class*='bot-message']",
    "[class*='response-content']",
    "main article",
    "main",
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector))
      .map((node) => domToMarkdown(node))
      .filter(Boolean);
    if (nodes.length > 0) return nodes.join("\n\n---\n\n").slice(0, 10000);
  }

  return (document.body?.innerText || "").trim().slice(0, 8000);
}

export function extractReadablePageText(site) {
  const host = window.location.hostname.replace(/^www\./, "");
  const siteText = extractBySiteSelectors(site, host);
  if (siteText && siteText.length > 40) {
    return siteText;
  }
  return extractWithGenericSelectors();
}
