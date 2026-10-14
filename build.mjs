import esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { cp, rm, mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync as readFileSyncForDefines } from "node:fs";
import { DEFAULT_FEATURE_KEYS, FEATURE_DEFS } from "./src/config/features-source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const ARGV = process.argv.slice(2);
const WATCH = ARGV.includes("--watch");
const DEV = WATCH || process.env.NODE_ENV !== "production";


const DIST = resolveOutDir(ARGV);


function resolveOutDir(argv) {
  const arg = argv.find((item) => item.startsWith("--outdir="));
  if (!arg) return path.join(ROOT, "dist");
  const raw = arg.slice("--outdir=".length).trim();
  if (!raw) throw new Error("--outdir= 后面没给目录名");
  const resolved = path.resolve(ROOT, raw);
  const rel = path.relative(ROOT, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`--outdir 必须位于项目内：${raw}`);
  }
  if (rel.split(path.sep)[0] === "src") {
    throw new Error(`--outdir 不能指向 src/：${raw}`);
  }
  return resolved;
}



const STAGING = path.join(ROOT, "." + path.basename(DIST) + "-staging");
const FEATURE_FLAGS = parseFeatureFlags(ARGV, process.env);

const BASE_ENTRIES = [
  "background.js",
  "config/baseConfig.js",
  "iframe/inject.js",
  "iframe/framebust-guard.js",
  "iframe/iframe-anti-detect.js",
  "iframe/upload-monitor-main.js",
  "iframe/iframe.js",
  "popup/popup.js",
  "settings/settings.js",
  "shared/i18n.js",
  "shared/prompt-item.js",
];

const ENTRIES = collectEntries(FEATURE_FLAGS);

const SRC_ASSETS = [
  "manifest.json",
  "_locales",
  "icons",
  "config/initialState.json",
  "config/initialState.zh-CN.json",
  "config/initialState.en.json",
  "config/memberSite.json",
  "config/embed-hosts.json",
  "config/siteHandlers.json",
  "popup/popup.html",
  "popup/popup.css",
  "popup/styles",
  "popup/icon128.png",
  "popup/logo.png",
  "settings/settings.html",
  "settings/settings.css",
  "settings/styles",
  "settings/about-logo.png",
  "settings/assets",
  "iframe/iframe.html",
  "iframe/iframe.css",
  "iframe/styles",
];

const ROOT_ASSETS = ["LICENSE", "PRIVACY.md"];

function parseFeatureFlags(argv, env) {
  if (argv.includes("--list-features")) {
    console.log("[features] available:");
    for (const [key, def] of Object.entries(FEATURE_DEFS)) {
      console.log(`  - ${key}: ${def.label}`);
    }
    process.exit(0);
  }

  const enableArg = argv.find((arg) => arg.startsWith("--features="));
  const disableArg = argv.find((arg) => arg.startsWith("--disable-features="));
  const enableEnv = String(env.XUSEARCH_FEATURES || "").trim();
  const disableEnv = String(env.XUSEARCH_DISABLE_FEATURES || "").trim();
  const enableRaw = enableArg?.slice("--features=".length).trim() || enableEnv;
  const disableRaw = disableArg?.slice("--disable-features=".length).trim() || disableEnv;

  const flags = Object.fromEntries(DEFAULT_FEATURE_KEYS.map((key) => [key, true]));

  if (enableRaw) {
    for (const key of DEFAULT_FEATURE_KEYS) {
      flags[key] = false;
    }
    if (enableRaw === "release" || enableRaw === "store") {
      return flags;
    }
    for (const key of splitFeatureList(enableRaw)) {
      if (key in flags) {
        flags[key] = true;
      } else {
        console.warn(`[features] unknown feature in --features: ${key}`);
      }
    }
    return flags;
  }

  for (const key of splitFeatureList(disableRaw)) {
    if (key in flags) {
      flags[key] = false;
    } else {
      console.warn(`[features] unknown feature in --disable-features: ${key}`);
    }
  }

  return flags;
}

function splitFeatureList(raw) {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectEntries(flags) {
  const entries = [...BASE_ENTRIES];
  for (const [key, enabled] of Object.entries(flags)) {
    if (!enabled) continue;
    for (const rel of FEATURE_DEFS[key]?.entries || []) {
      if (!entries.includes(rel)) {
        entries.push(rel);
      }
    }
  }
  return entries;
}

function collectDisabledPermissions(flags) {
  const disabled = new Set();
  for (const [key, enabled] of Object.entries(flags)) {
    if (enabled) continue;
    for (const permission of FEATURE_DEFS[key]?.permissions || []) {
      disabled.add(permission);
    }
  }
  return disabled;
}

function collectEnabledPermissions(flags) {
  const enabled = new Set();
  for (const [key, isOn] of Object.entries(flags)) {
    if (!isOn) continue;
    for (const permission of FEATURE_DEFS[key]?.permissions || []) {
      enabled.add(permission);
    }
  }
  return enabled;
}

function makeFeatureDefines(flags) {
  return {
    __XUSEARCH_FEATURE_DESKTOP__: String(Boolean(flags.desktop)),
    __XUSEARCH_FEATURE_DEV_EXPORT__: String(Boolean(flags.devExport)),
  };
}

async function copyOne(from, to) {
  if (!existsSync(from)) {
    console.warn(`[assets] skip missing: ${path.relative(ROOT, from)}`);
    return;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

async function patchManifest(manifestPath) {
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const disabledPermissions = collectDisabledPermissions(FEATURE_FLAGS);
  const enabledPermissions = collectEnabledPermissions(FEATURE_FLAGS);

  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter((permission) => !disabledPermissions.has(permission));
    for (const permission of enabledPermissions) {
      if (!manifest.permissions.includes(permission)) {
        manifest.permissions.push(permission);
      }
    }
  }

  
  if (FEATURE_FLAGS.devExport && manifest.content_security_policy?.extension_pages) {
    const csp = manifest.content_security_policy.extension_pages;
    if (csp.includes("connect-src https:") && !csp.includes("127.0.0.1:8790")) {
      manifest.content_security_policy.extension_pages = csp.replace(
        "connect-src https:",
        "connect-src https: http://127.0.0.1:8790",
      );
    }
  }

  
  
  if (!FEATURE_FLAGS.devExport && Array.isArray(manifest.web_accessible_resources)) {
    for (const block of manifest.web_accessible_resources) {
      if (!Array.isArray(block.resources)) continue;
      block.resources = block.resources.filter((r) => r !== "config/memberSite.json");
    }
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function copyAssets(destRoot = DIST) {
  for (const rel of SRC_ASSETS) {
    const from = path.join(SRC, rel);
    const to = path.join(destRoot, rel);
    if (rel === "manifest.json") {
      await copyOne(from, to);
      await patchManifest(to);
      continue;
    }
    
    
    
    
    
    
    if (rel === "config/siteHandlers.json") {
      await copyOne(from, to);
      if (FEATURE_FLAGS.devExport) {
        const memberSites = existsSync(path.join(SRC, "config/memberSite.json"))
          ? (JSON.parse(readFileSyncForDefines(path.join(SRC, "config/memberSite.json"), "utf8")).sites || [])
          : [];
        const free = JSON.parse(readFileSyncForDefines(to, "utf8"));
        free.sites = [...(free.sites || []), ...memberSites];
        writeFileSync(to, JSON.stringify(free, null, 2) + "\n", "utf8");
        console.log(`[build] siteHandlers.json：dev 已并入 ${memberSites.length} 个会员站（内置表 ${free.sites.length} 站）`);
      } else {
        const n = (JSON.parse(readFileSyncForDefines(to, "utf8")).sites || []).length;
        console.log(`[build] siteHandlers.json：商店版内置表 = 免费站 ${n} 个（会员规则走签名包，不随包）`);
      }
      continue;
    }
    
    if (rel === "config/memberSite.json" && !FEATURE_FLAGS.devExport) continue;
    await copyOne(from, to);
  }
  for (const rel of ROOT_ASSETS) {
    await copyOne(path.join(ROOT, rel), path.join(destRoot, rel));
  }
}


function buildFramebustHosts() {
  const ORPHANS = ["twitter.com", "reddit.com", "tiktok.com"];
  const set = new Set(ORPHANS);
  try {
    const sites = JSON.parse(readFileSyncForDefines("./src/config/siteHandlers.json", "utf8")).sites || [];
    for (const site of sites) {
      if (site.framebustGuard !== true) continue;
      for (const pattern of site.matchPatterns || []) {
        const host = String(pattern).replace(/^www\./, "").toLowerCase();
        if (host) set.add(host);
      }
    }
  } catch (error) {
    console.error("[build] framebusting 名单派生失败，退回只保留默认三域名：", error.message);
  }
  return [...set];
}

function makeFeatureAliasPlugin(flags) {
  const desktopBackgroundStub = path.join(SRC, "build-stubs/desktop-background.js");
  const exportConfigStub = path.join(SRC, "build-stubs/export-config.js");
  const backendConfigStub = path.join(SRC, "build-stubs/backend-config.js");
  const devSiteCategoriesStub = path.join(SRC, "build-stubs/dev-site-categories.js");

  return {
    name: "xuSearch-feature-alias",
    setup(build) {
      if (!flags.desktop) {
        build.onResolve({ filter: /[/\\]desktop[/\\]background\.js$/ }, () => ({
          path: desktopBackgroundStub,
        }));
      }

      if (!flags.devExport) {
        build.onResolve({ filter: /export-config\.js$/ }, () => ({
          path: exportConfigStub,
        }));
        
        
        build.onResolve({ filter: /backend-config\.js$/ }, () => ({
          path: backendConfigStub,
        }));
        
        
        build.onResolve({ filter: /[/\\]dev-site-categories\.js$/ }, () => ({
          path: devSiteCategoriesStub,
        }));
      }
    },
  };
}

function makeBuildOptions(outdir = DIST) {
  return {
    entryPoints: ENTRIES.map((rel) => ({
      in: path.join(SRC, rel),
      out: rel.replace(/\.js$/, ""),
    })),
    outdir,
    bundle: true,
    format: "iife",
    target: "chrome111",
    sourcemap: DEV ? "inline" : false,
    minify: !DEV,
    logLevel: "info",
    legalComments: "none",
    charset: "utf8",
    define: {
      ...makeFeatureDefines(FEATURE_FLAGS),
      __XUSEARCH_FRAMEBUST_HOSTS__: JSON.stringify(buildFramebustHosts()),
    },
    plugins: [makeFeatureAliasPlugin(FEATURE_FLAGS)],
  };
}

function logFeatureSummary() {
  const enabled = DEFAULT_FEATURE_KEYS.filter((key) => FEATURE_FLAGS[key]);
  const disabled = DEFAULT_FEATURE_KEYS.filter((key) => !FEATURE_FLAGS[key]);
  console.log(`[features] enabled: ${enabled.join(", ") || "(none)"}`);
  if (disabled.length) {
    console.log(`[features] disabled: ${disabled.join(", ")}`);
  }
}


async function swapStagingIntoDist() {
  let cleaned = false;
  try {
    await rm(DIST, { recursive: true, force: true });
    cleaned = true;
  } catch (_error) {
    console.warn("[build] 清理旧 dist 失败（可能被沙箱拦截）");
  }

  if (cleaned) {
    try {
      await rename(STAGING, DIST);
      return;
    } catch (error) {
      console.warn(`[build] 暂存目录改名失败（${error?.code || error?.message}），回退为复制`);
    }
  }

  await mkdir(DIST, { recursive: true });
  await cp(STAGING, DIST, { recursive: true, force: true });
  console.warn("[build] ⚠️ 以复制方式替换 dist：可能有旧文件残留，建议手动删一次 dist/ 后重跑");
}


async function buildOnce() {
  await rm(STAGING, { recursive: true, force: true }).catch(() => {});
  await mkdir(STAGING, { recursive: true });

  console.log(`[build] 先编译到暂存目录 ${path.basename(STAGING)}/，全部成功后再整体替换 ${path.relative(ROOT, DIST)}/`);
  await esbuild.build(makeBuildOptions(STAGING));
  await copyAssets(STAGING);

  
  await swapStagingIntoDist();
  await rm(STAGING, { recursive: true, force: true }).catch(() => {});
  console.log(`[build] done → ${path.relative(ROOT, DIST)}/`);
}

async function run() {
  logFeatureSummary();

  if (WATCH) {
    
    
    
    await mkdir(DIST, { recursive: true });

    const baseOptions = makeBuildOptions();
    let announcedWatch = false;
    const ctx = await esbuild.context({
      ...baseOptions,
      
      
      
      
      plugins: [
        ...(baseOptions.plugins || []),
        {
          name: "copy-assets-on-rebuild",
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length === 0) {
                await copyAssets();
                console.log(`[build] ok (${new Date().toLocaleTimeString()})`);
              } else {
                console.warn("[build] 编译失败 → dist/ 保持上一次的成功产物");
              }
              if (!announcedWatch) {
                announcedWatch = true;
                console.log("[build] watching src/ ...");
              }
            });
          },
        },
      ],
    });
    await ctx.watch();
    
    
    
    
    
    
    
    return;
  }

  await buildOnce();
}

run().catch(async (err) => {
  console.error(err);
  console.error("[build] ❌ 构建失败 —— 输出目录未被改动，上一次的成功产物仍然可用。");
  await rm(STAGING, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
