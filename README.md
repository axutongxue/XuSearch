<p align="center">
  <img src="src/icons/icon128.png" width="80" height="80" alt="XuSearch Logo">
</p>

<h1 align="center">XuSearch · 虚空搜索</h1>

<p align="center">
  <strong>Language / 语言</strong>：
  <a href="#readme-zh">简体中文</a> ·
  <a href="#readme-en">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License">
  <img src="https://img.shields.io/badge/Build-esbuild-orange" alt="Build Tool">
</p>

<p align="center">
  <a href="PRIVACY.md">隐私政策</a> ·
  <a href="LICENSE">开源协议</a>
</p>

---

## 前言说明

本项目是基于开源项目 **[Qshot](https://github.com/30bewater/Qshot)**（作者 [30bewater](https://github.com/30bewater)，[GPL-3.0](LICENSE)）的**改造衍生版**：在原项目基础上扩展了站点支持并重构了对比页体验，依据 GPL-3.0 继续以同一协议开源。感谢原作者及社区贡献者的开源工作！

此外，本项目也参考了开源项目 [AICompare](https://github.com/taoAIGC/AICompare) 的部分设计思路。

本项目主要借助 AI 编写。欢迎大家反馈问题、提出建议，也欢迎提交 Issue 或 Pull Request。

> **关于本仓库**：这里是**开源版**，只包含免费搜索组的站点规则，**不含**会员相关服务、会员站点规则与任何后端。
> 站点规则文件为 `src/config/siteHandlers.json`，想加站点直接改它即可。

---

<a id="readme-zh"></a>

## 简体中文

<p align="center">
  一次提问，并排打开多个 AI / 搜索站点，对比回答、导出整理。<br>
  支持 Ctrl+Q 全局浮层、分组管理、提示词库、自定义站点、AI 一键总结等。
</p>

### 项目定位

XuSearch 是一个 **Chrome / Edge Manifest V3** 扩展，面向「多 AI 对比搜索」场景：

- 省去在 ChatGPT、DeepSeek、Kimi、Gemini 等站点之间来回切换的麻烦
- 同一问题并排查看多个站点的回答，便于横向比较
- 分组、提示词、历史、布局均可配置，**数据全部保存在浏览器本地**
- 全部核心功能开箱即用：多站对比、分组管理、提示词库、自定义站点、AI 一键总结、网盘搜索组等

> 构建发布版：`npm run build:store`（产物在 `dist-store/`）。
> 本开源版**不含**后端服务与会员站点规则；站点规则随仓库更新。

### 核心功能

| 功能 | 说明 |
|------|------|
| 多站并行搜索 | 一次输入，同时向多个 AI / 搜索站点发送 |
| Compare 对比页 | 多栏 / 全局布局并排展示，支持卡片导航与布局持久化；单卡可跳过（不参与总结与追问）或单独重发 |
| 追问 | 第二轮提问优先在卡片内输入框打字发送，保留已有对话 |
| Ctrl+Q 悬浮层 | 任意网页快速唤起搜索、历史与提示词 |
| 组名+空格选组 | 输入搜索组名后按空格直接选中该组，继续输入即为问题 |
| 分组与站点 | 内置主流 AI 站 + 自定义 URL 模板，分组一键切换 |
| 提示词库 | 多组提示词，popup / 浮层 / 输入框旁的 Q 按钮均可调用 |
| 搜索历史 | 可选保存，便于复盘与再次打开 |
| 右键 / 划词 | 选中文本后右键菜单或气泡搜索（可配置） |
| AI 一键总结 | 对比页汇总多模型回答，需自备 API Key（可选） |
| 附件上传 | 支持附件上传的站点可批量投递文件 |
| 导出 | 将对比结果导出为 Markdown 等格式 |
| 配置导入导出 | 搜索组、自定义站、右键提示词、显示设置等可备份为 JSON |
| 暗色模式 | popup / 设置页 / 对比页统一支持 |

### 安装与使用

#### 从源码加载（开发者）

获取本仓库源码后，在根目录执行：

```bash
npm install
npm run build:store
```

在 `chrome://extensions/` 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 **`dist-store/`** 目录。

> 构建产物（`dist/`、`dist-store/`）不进版本库，改代码后需重新构建。
> 日常开发用 `npm run build`（产物在 `dist/`，后端指向本机 8790，仅自建后端时用）。

### 典型使用流程

1. 点击扩展图标或在网页按 **Ctrl+Q** 输入问题
2. 选择搜索组，进入 **Compare 对比页**
3. 各站点卡片加载完成后点击发送，查看并排结果
4. 可选：追问、导出、AI 总结、切换布局或追加站点

### 开发与调试

| 命令 | 说明 |
|------|------|
| `npm run build` | 开发构建 → `dist/` |
| `npm run build:store` | 发布构建 → `dist-store/` |
| `npm run test` | 单元测试（Node 直跑，不需要浏览器） |
| `npm run watch:store` | 监听 `src/` 变更并持续构建 |

**刷新注意**：改 background / popup / settings / 对比页 → 在 `chrome://extensions/` 刷新扩展；
改 **content script**（inject 等）→ 还需**关闭并重开**目标标签页。

### 仓库结构

```text
.
├── src/                 # 扩展源码（改这里）
│   ├── background/      # Service Worker
│   ├── iframe/          # 对比页 + inject（注入脚本）
│   ├── popup/           # 工具栏弹窗
│   ├── settings/        # 设置页
│   ├── config/          # 站点规则、初始预设、图标资产
│   ├── shared/          # i18n、协议常量、共用工具
│   └── build-stubs/     # 特性关闭时的构建占位
├── test/                # 单元测试
├── tools/               # 构建期辅助工具（图标抓取等）
├── build.mjs            # esbuild 打包
├── PRIVACY.md           # 隐私政策
├── LICENSE
└── README.md
```

### 权限与隐私

- 配置、提示词、历史等保存在 **`chrome.storage.local`**，不上传任何服务器
- 发送搜索或使用 AI 总结时，数据由浏览器**直连**你选择的第三方站点 / API
- **本版不连接任何后端**：不含账号与云端规则下发；如需自建后端，改
  `src/shared/backend-config.js` 里的地址即可
- 扩展不含任何遥测
- 详见 [`PRIVACY.md`](PRIVACY.md)

### 技术栈

- Manifest V3 · 原生 JavaScript（无框架）· esbuild
- Declarative Net Request（iframe 嵌入兼容）
- Shadow DOM（悬浮层样式隔离）

### 开源协议

本项目采用 [GPL-3.0](LICENSE)，基于开源项目 [Qshot](https://github.com/30bewater/Qshot) 改造而来，
并依据 GPL-3.0 继续以同一协议开源。

---

<a id="readme-en"></a>

## English

<p align="center">
  Ask once, open multiple AI / search sites side by side, compare and export.<br>
  Ctrl+Q overlay, groups, prompt library, custom sites, one-click AI summary, and more.
</p>

### Overview

XuSearch is a **Chrome / Edge Manifest V3** extension for multi-site AI comparison:

- No more tab-hopping between ChatGPT, DeepSeek, Kimi, Gemini and others
- See several answers to the same question side by side
- Groups, prompts, history and layout are configurable; **all data stays in your browser**
- Everything works out of the box: multi-site compare, groups, prompt library, custom sites,
  one-click AI summary, cloud-drive search group

> Build a release: `npm run build:store` (output in `dist-store/`).
> This open-source edition contains **no** backend service and no members-only site rules.

### Features

| Feature | Description |
|---|---|
| Parallel search | Send one question to multiple AI / search sites at once |
| Compare page | Grid / full-screen layouts, card navigation, persisted layout; skip or resend a single card |
| Follow-up | Subsequent questions are typed into each card's own input box, keeping the conversation |
| Ctrl+Q overlay | Quick search, history and prompts on any page |
| Group + space | Type a group name then space to pick it; keep typing to ask |
| Groups & sites | Built-in sites plus custom URL templates, switchable in one click |
| Prompt library | Multiple prompt groups, reachable from popup / overlay / an in-page Q button |
| Search history | Optional, for review and reopening |
| Right-click / selection | Search selected text via context menu or bubble (configurable) |
| AI summary | Aggregate answers from all cards with your own API key (optional) |
| Attachments | Batch upload files to sites that support them |
| Export | Export comparison results as Markdown and more |
| Config backup | Search groups, custom sites, right-click prompts, display settings as JSON |
| Dark mode | Across popup / settings / compare page |

### Install

```bash
npm install
npm run build:store
```

Then open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked** and select
the **`dist-store/`** directory.

> Build output is not committed; rebuild after editing `src/`.

### Typical flow

1. Click the extension icon, or press **Ctrl+Q** on any page, and type your question
2. Pick a search group to open the **Compare** page
3. Once cards finish loading, send and read the answers side by side
4. Optionally: follow up, export, run AI summary, change layout, or add sites

### Development

| Command | Description |
|---|---|
| `npm run build` | Dev build → `dist/` |
| `npm run build:store` | Release build → `dist-store/` |
| `npm run test` | Unit tests (plain Node, no browser needed) |
| `npm run watch:store` | Rebuild on change |

### Repository layout

```text
.
├── src/                 # Extension source (edit here)
│   ├── background/      # Service worker
│   ├── iframe/          # Compare page + injected scripts
│   ├── popup/           # Toolbar popup
│   ├── settings/        # Settings page
│   ├── config/          # Site rules, initial presets, icon assets
│   ├── shared/          # i18n, protocol constants, shared utils
│   └── build-stubs/     # Build-time placeholders
├── test/                # Unit tests
├── tools/               # Build-time helper scripts
├── build.mjs            # esbuild bundling
└── PRIVACY.md
```

### Privacy

- Settings, prompts and history live in **`chrome.storage.local`**; nothing is uploaded
- Search and AI summary connect **directly** from your browser to the sites / APIs you choose
- **No backend in this edition**; to use your own, edit `src/shared/backend-config.js`
- No telemetry
- See [`PRIVACY.md`](PRIVACY.md)

### Tech stack

- Manifest V3 · vanilla JavaScript · esbuild
- Declarative Net Request (iframe embedding compatibility)
- Shadow DOM (overlay style isolation)

### License

[GPL-3.0](LICENSE). This project is a modified derivative of
[Qshot](https://github.com/30bewater/Qshot) and remains licensed under GPL-3.0.
