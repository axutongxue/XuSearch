


function normalizePlatform(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("win")) return "windows";
  if (s.includes("mac") || s.includes("iphone") || s.includes("ipad")) return "mac";
  if (s.includes("cros") || s.includes("chrome os") || s.includes("crbook")) return "cros";
  if (s.includes("android")) return "android";
  if (s.includes("linux")) return "linux";
  return s.slice(0, 12); 
}


const CORES_CAP = 16;


export async function getMachineAttrs() {
  try {
    if (typeof screen === "undefined" || !screen) return null; 

    const os = normalizePlatform(navigator?.userAgentData?.platform || navigator?.platform);

    
    const rawCores = Number(navigator?.hardwareConcurrency) || 0;
    const cores = rawCores > 0 ? Math.min(rawCores, CORES_CAP) : null;

    
    const touch = Number.isFinite(Number(navigator?.maxTouchPoints)) ? Number(navigator.maxTouchPoints) : null;

    
    
    const dpr = Number(window?.devicePixelRatio) || 1;
    const w = Math.round((Number(screen.width) || 0) * dpr);
    const h = Math.round((Number(screen.height) || 0) * dpr);
    const res = w > 0 && h > 0 ? `${w}x${h}` : null;

    
    let arch = null;
    try {
      const hi = await navigator?.userAgentData?.getHighEntropyValues?.(["architecture", "bitness"]);
      if (hi?.architecture) {
        const joined = hi.bitness ? `${hi.architecture}${hi.bitness}` : String(hi.architecture);
        
        arch = joined === "x8664" ? "x64"
          : joined === "x8632" ? "x86"
            : joined === "arm64" ? "arm64"
              : joined === "arm32" ? "arm"
                : joined;
      }
    } catch (_err) {
      
    }

    const attrs = { os, arch, cores, res, touch };
    const available = Object.values(attrs).filter((v) => v !== null && v !== undefined).length;
    
    if (available < 2) return null;
    return attrs;
  } catch (_err) {
    return null; 
  }
}
