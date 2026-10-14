
(() => {
  if (window.__XUSEARCH_UPLOAD_MONITOR_INSTALLED__) return;
  window.__XUSEARCH_UPLOAD_MONITOR_INSTALLED__ = true;

  const EVENT_TYPE = "__XUSEARCH_UPLOAD_MONITOR__";

  function emitUpload(state, percent, kind) {
    try {
      window.postMessage(
        { type: EVENT_TYPE, state, percent, kind },
        "*"
      );
    } catch (_error) {
      
    }
  }

  
  function detectUploadKind(body) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      for (const [, value] of body.entries()) {
        if (value instanceof File) return "formdata";
      }
      return null;
    }
    if (typeof body === "string" && body.length >= 65536) {
      return "base64";
    }
    return null;
  }

  
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    try {
      this.__xuSearchUploadMeta = { method: String(method || "").toUpperCase(), url: String(url || "") };
    } catch (_error) {
      
    }
    return origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const meta = this.__xuSearchUploadMeta;
    const kind = detectUploadKind(body);
    if (meta && kind) {
      let settled = false;

      const onProgress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        emitUpload("uploading", percent, kind);
      };
      const onDone = () => {
        if (settled) return;
        settled = true;
        let status = 0;
        try {
          status = this.status;
        } catch (_error) {
          
        }
        emitUpload(status >= 200 && status < 300 ? "done" : "error", 100, kind);
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        emitUpload("error", 100, kind);
      };

      try {
        this.upload.addEventListener("progress", onProgress);
        this.addEventListener("loadend", onDone);
        this.addEventListener("error", onError);
        this.addEventListener("abort", onError);
      } catch (_error) {
        
      }
      emitUpload("uploading", 0, kind);
    }
    return origXhrSend.call(this, body);
  };

  
  const origFetch = window.fetch;

  window.fetch = async function patchedFetch(input, init) {
    let url = "";
    try {
      url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input || ""));
    } catch (_error) {
      
    }
    const kind = detectUploadKind(init && init.body);
    if (kind) {
      emitUpload("uploading", 0, kind);
      try {
        const response = await origFetch.call(this, input, init);
        emitUpload(response.ok ? "done" : "error", 100, kind);
        return response;
      } catch (error) {
        emitUpload("error", 100, kind);
        throw error;
      }
    }
    return origFetch.call(this, input, init);
  };
})();
