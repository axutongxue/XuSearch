

import { domToMarkdown } from "./extractor-dom-to-markdown.js";



async function fetchChatGPTConversation() {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  if (!match) return null;
  try {
    const res = await Promise.race([
      fetch(`/backend-api/conversation/${match[1]}`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.mapping) return null;

    const nodes = data.mapping;
    const orderedIds = [];
    let nodeId = data.current_node;
    while (nodeId && nodes[nodeId]) {
      orderedIds.unshift(nodeId);
      nodeId = nodes[nodeId]?.parent;
    }

    const turns = [];
    for (const id of orderedIds) {
      const msg = nodes[id]?.message;
      if (!msg) continue;
      const role = msg.author?.role;
      if (role !== "user" && role !== "assistant") continue;
      const parts = msg.content?.parts;
      if (!Array.isArray(parts)) continue;
      const text = parts.filter((p) => typeof p === "string").join("\n").trim();
      if (!text) continue;
      turns.push({ role: role === "user" ? "user" : "assistant", text });
    }
    return turns.length > 0 ? turns : null;
  } catch {
    return null;
  }
}



function extractFromWindowState() {
  try {
    const pageProps = window.__NEXT_DATA__?.props?.pageProps;
    if (pageProps) {
      const candidates = [
        pageProps?.conversation?.messages,
        pageProps?.chatConversation?.messages,
        pageProps?.messages,
      ];
      for (const msgs of candidates) {
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        const turns = msgs
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => {
            const text =
              typeof m.content === "string"
                ? m.content
                : Array.isArray(m.content)
                  ? m.content.filter((c) => typeof c === "string").join("\n")
                  : "";
            return { role: m.role, text: text.trim() };
          })
          .filter((m) => m.text);
        if (turns.length > 0) return turns;
      }
    }
  } catch {  }
  return null;
}




function sanitizeForMarkdown(el, excludeSelectors) {
  if (!Array.isArray(excludeSelectors) || excludeSelectors.length === 0) return el;
  const clone = el.cloneNode(true);
  for (const sel of excludeSelectors) {
    try {
      clone.querySelectorAll(sel).forEach((n) => n.remove());
    } catch (_e) {
      
    }
  }
  return clone;
}


function makeAiExtractor(selectors, excludeSelectors) {
  return (el) => {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found) return domToMarkdown(sanitizeForMarkdown(found, excludeSelectors));
    }
    return domToMarkdown(sanitizeForMarkdown(el, excludeSelectors));
  };
}


function normalizeExtractorConfig(raw) {
  if (!raw || typeof raw !== "object") return null;

  const config = {};

  
  const excludeSelectors = Array.isArray(raw.exclude)
    ? raw.exclude.filter((sel) => typeof sel === "string" && sel)
    : [];

  if (typeof raw.allMessages === "string" && raw.allMessages) {
    config.allMessages = raw.allMessages;
    if (typeof raw.roleAttribute === "string" && raw.roleAttribute) {
      config.getRole = (el) => el.getAttribute(raw.roleAttribute);
    } else {
      
      return null;
    }
    if (Array.isArray(raw.userTextSelectors) && raw.userTextSelectors.length > 0) {
      config.getUserText = (el) => {
        for (const sel of raw.userTextSelectors) {
          const inner = el.querySelector(sel);
          if (inner) return (inner.innerText || "").trim();
        }
        return (el.innerText || "").trim();
      };
    }
  }

  if (Array.isArray(raw.userSelector) && raw.userSelector.length > 0) {
    config.userSelector = raw.userSelector;
  }
  if (Array.isArray(raw.assistantSelector) && raw.assistantSelector.length > 0) {
    config.assistantSelector = raw.assistantSelector;
  }

  if (Array.isArray(raw.aiTextSelectors) && raw.aiTextSelectors.length > 0) {
    config.getAiText = makeAiExtractor(raw.aiTextSelectors, excludeSelectors);
  }

  
  if (!config.allMessages && !config.userSelector && !config.assistantSelector) {
    return null;
  }
  return config;
}





function filterDescendants(elements) {
  return elements.filter(
    (el) => !elements.some((other) => other !== el && other.contains(el))
  );
}

function extractConversationTurnsGeneric() {
  const candidates = [
    ["[data-message-author-role='user']",    "[data-message-author-role='assistant']"],
    ["[data-author-type='1']",               "[data-author-type='2']"],
    ["[class*='human-turn']",                "[class*='assistant-turn']"],
    ["[class*='user-turn']",                 "[class*='assistant-turn']"],
    ["[class*='human-message']",             "[class*='assistant-message']"],
    ["[class*='user-message']",              "[class*='ai-message']"],
    ["[class*='human-bubble']",              "[class*='assistant-bubble']"],
    ["[class*='message--human']",            "[class*='message--bot']"],
    ["[class*='message--user']",             "[class*='message--bot']"],
    ["[class*='chat-message--human']",       "[class*='chat-message--bot']"],
    ["[class*='sender-content']",            "[class*='receiver-content']"],
    ["[class*='chat-msg--human']",           "[class*='chat-msg--ai']"],
    ["[class*='request-item']",              "[class*='response-item']"],
  ];

  for (const [userSel, aiSel] of candidates) {
    try {
      const userEls = Array.from(document.querySelectorAll(userSel));
      const aiEls   = Array.from(document.querySelectorAll(aiSel));
      if (userEls.length === 0 || aiEls.length === 0) continue;

      if (Math.abs(userEls.length - aiEls.length) > Math.max(userEls.length, aiEls.length)) continue;

      const combined = `${userSel}, ${aiSel}`;
      const allEls   = filterDescendants(Array.from(document.querySelectorAll(combined)));
      const userSet  = new Set(userEls);

      const turns = [];
      for (const el of allEls) {
        const isUser = userSet.has(el);
        const text   = isUser
          ? (el.innerText || el.textContent || "").trim()
          : domToMarkdown(el);
        if (text && text.length > 2) {
          turns.push({ role: isUser ? "user" : "assistant", text });
        }
      }

      const hasUser      = turns.some((t) => t.role === "user");
      const hasAssistant = turns.some((t) => t.role === "assistant");
      if (hasUser && hasAssistant) return turns;
    } catch (_) {  }
  }

  
  const exclusionAiSelectors = [
    "[data-author-type='2']",
    "[data-message-author-role='assistant']",
    "[class*='bot-message']",
    "[class*='assistant-message']",
  ];
  for (const aiSel of exclusionAiSelectors) {
    try {
      const aiEls = Array.from(document.querySelectorAll(aiSel));
      if (aiEls.length < 1) continue;

      const parent = aiEls[0].parentElement;
      if (!parent || !aiEls.every((el) => el.parentElement === parent)) continue;

      const aiSet = new Set(aiEls);
      const siblings = Array.from(parent.children);
      const turns = [];

      for (const sib of siblings) {
        if (aiSet.has(sib)) {
          const text = domToMarkdown(sib);
          if (text && text.length > 5) turns.push({ role: "assistant", text });
        } else {
          const text = (sib.innerText || sib.textContent || "").trim();
          if (text && text.length >= 2 && text.length <= 3000) {
            turns.push({ role: "user", text });
          }
        }
      }

      const hasUser = turns.some((t) => t.role === "user");
      const hasAI   = turns.some((t) => t.role === "assistant");
      if (hasUser && hasAI) return turns;
    } catch (_) {  }
  }

  return null;
}

function extractConversationTurns(site) {
  
  
  const config = normalizeExtractorConfig(site?.extractor);

  if (config) {
    const turns = [];
    try {
      if (config.allMessages) {
        const els = Array.from(document.querySelectorAll(config.allMessages));
        for (const el of els) {
          const role = config.getRole(el);
          if (role !== "user" && role !== "assistant") continue;
          const text = role === "user"
            ? (config.getUserText ? config.getUserText(el) : (el.innerText || "").trim())
            : (config.getAiText ? config.getAiText(el) : domToMarkdown(el));
          if (text && text !== "暂未提取到内容") turns.push({ role, text });
        }
        if (turns.length > 0 && !turns.some((t) => t.role === "user")) {
          return extractConversationTurnsGeneric();
        }
      } else {
        const userSelStr = (config.userSelector || []).join(", ");
        const aiSelStr   = (config.assistantSelector || []).join(", ");
        if (!userSelStr && !aiSelStr) return extractConversationTurnsGeneric();

        const combined = [userSelStr, aiSelStr].filter(Boolean).join(", ");
        const allEls   = filterDescendants(Array.from(document.querySelectorAll(combined)));
        const userEls  = new Set(userSelStr ? Array.from(document.querySelectorAll(userSelStr)) : []);

        for (const el of allEls) {
          const role = userEls.has(el) ? "user" : "assistant";
          const text = role === "user"
            ? (el.innerText || el.textContent || "").trim()
            : (config.getAiText ? config.getAiText(el) : domToMarkdown(el));
          if (text && text !== "暂未提取到内容") turns.push({ role, text });
        }
        if (turns.length > 0 && !turns.some((t) => t.role === "user")) {
          return extractConversationTurnsGeneric();
        }
      }
    } catch (_err) {
      return extractConversationTurnsGeneric();
    }

    if (turns.length > 0) return turns;
    return extractConversationTurnsGeneric();
  }

  return extractConversationTurnsGeneric();
}



export async function extractTurnsWithFallback(host, site) {
  if (host === "chatgpt.com" || host === "chat.openai.com") {
    const turns = await fetchChatGPTConversation();
    if (turns) return turns;
  }

  const stateTurns = extractFromWindowState();
  if (stateTurns) return stateTurns;

  return extractConversationTurns(site);
}
