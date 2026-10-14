

import { EXTENSION_ORIGIN } from "./constants.js";
import { MSG } from "../../shared/compare-protocol.js";
import { extractReadablePageText } from "./extractor-site-selectors.js";
import { extractTurnsWithFallback } from "./extractor-conversation.js";
import { diagnosticLog } from "../../shared/diagnostics.js";




export async function handleExtractRequest(message) {
  const host = window.location.hostname.replace(/^www\./, "");
  diagnosticLog("inject.extract", "start", {
    host,
    siteId: message.site?.id,
    requestId: message.requestId,
  });
  
  
  const targetOrigin = "*";
  try {
    const [content, rawTurns] = await Promise.all([
      Promise.resolve(extractReadablePageText(message.site)),
      extractTurnsWithFallback(host, message.site),
    ]);

    diagnosticLog("inject.extract", "result", {
      host,
      siteId: message.site?.id,
      contentLen: String(content || "").length,
      contentHead: String(content || "").slice(0, 80),
      turns: Array.isArray(rawTurns) ? rawTurns.length : 0,
    });

    
    
    let turns = rawTurns;
    const query = String(message.query || "").trim();
    if (query && turns && turns.length > 0 && !turns.some((t) => t.role === "user")) {
      turns = [{ role: "user", text: query }, ...turns];
    }

    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        turns,
        url: window.location.href,
      },
      targetOrigin
    );
  } catch (_err) {
    
    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content: extractReadablePageText(message.site),
        turns: null,
        url: window.location.href,
      },
      targetOrigin
    );
  }
}
