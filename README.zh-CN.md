<p align="center">
  <img src="imgs/logo.png" alt="DevWhale" width="108%" />
</p>

<h1 align="center">DevWhale</h1>
<p align="center"><strong>AI 驱动的桌面开发工作台</strong></p>
<p align="center"><em>Focus Deep. Build Efficiently. Code with DevWhale.</em></p>

<p align="center">
  <strong><a href="./README.md">English</a></strong>
  &nbsp;·&nbsp;
  <strong>简体中文</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform" /></a>
  <a href="#"><img src="https://img.shields.io/badge/electron-36-47848f?logo=electron" alt="Electron" /></a>
  <a href="#"><img src="https://img.shields.io/badge/react-19-61dafb?logo=react" alt="React" /></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-6-3178c6?logo=typescript" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tailwind-4-06b6d4?logo=tailwindcss" alt="Tailwind" /></a>
</p>

---

DevWhale 是一个轻量级 AI 编程助手桌面应用。三栏布局、流式对话、Monaco 代码编辑器（AI Ghost Text 补全 + LSP 诊断）、xterm.js 终端（内置 V8 调试器）、VSCode 风格文件树、检查点一键回滚、Skill 市场——全部本地运行。AI 引擎支持流式 Tool Calling，可读/写/编辑/Git 操作/Web 搜索/应用补丁/创建 Word 文档。三种执行模式：YOLO（全自动）、Ask（每步确认）、Plan（先计划后执行）。拖放支持 65+ 文件格式，DOCX/XLSX 自动解压提取文本，图片转 base64 多模态输入。

---

## 为什么选择 DevWhale

### 🧠 为 DeepSeek V4 Pro 而生

Codex 只接 OpenAI，Claude Code 只接 Anthropic。**它们对 DeepSeek 兼容性极差**——工具调用失败、上下文丢失、超过 128K 后严重退化。

DevWhale **从第一天起就为 DeepSeek V4 Pro 设计**——完整的 Tool Calling 循环、`task_complete` 终止协议、700K 字符上下文保护、DeepSeek / OpenAI / Anthropic 三模一键切换。

### 💰 前缀缓存优化，成本降 90%

DeepSeek V4 对 **128-token 粒度的 byte-stable 前缀** 提供约 90% 缓存折扣。DevWhale 的 Agent 引擎刻意保持 system prompt 前缀稳定——规则、记忆、技能、项目索引、MCP 工具列表全部前置且只追加不删改——确保每轮对话命中缓存。**同样的代码审查任务，单次 API 成本是 Cursor 的十分之一。**

Cursor 和 Claude Code 每次工具调用都重构提示词结构，缓存命中率几乎为零。Codex 绑死 OpenAI，无法受益于 DeepSeek 的缓存策略。

### 🖥️ 独立桌面应用，不是 IDE 插件

不像 Cursor（VSCode 魔改）或 Claude Code（终端 CLI），DevWhale 是 **Electron 原生桌面应用**——双击即用，自带 Monaco + xterm + 文件树，不依赖任何 IDE。适合不愿换编辑器的开发者，也适合非技术用户。

---

## 功能

### 核心
- 🧠 **AI 对话** — DeepSeek（V4 Pro / V4 Flash）、OpenAI（GPT-4o）、Anthropic（Claude）多模型，流式输出，支持图片输入
- 🔧 **Agent 工具调用** — 流式 Tool Calling：读/写/编辑文件、执行命令、Git 状态/差异/提交/分支、Web 搜索/抓取、创建 DOCX、应用 unified diff 补丁
- 💬 **会话管理** — 多会话、项目分组、搜索过滤、右键菜单（重命名/删除/移动分组/导出 Markdown）、消息持久化
- 📝 **代码编辑器** — Monaco Editor，TypeScript/JavaScript/Python/Rust/Go 语法高亮、智能补全、AI 内联补全（Ghost Text）、行内 Diff 标注、Ctrl+S 保存
- 🖥️ **终端** — xterm.js 终端模拟器，命令历史（↑↓）、Agent 命令日志折叠/展开、实时流式输出
- 📁 **文件树** — 项目文件浏览，递归扫描实际文件系统，按扩展名着色

### 辅助
- 🌓 **主题** — 跟随系统自动切换，或手动切换亮色/暗色，CSS 变量 + Tailwind token
- 📋 **规则与记忆** — 自定义 AI 行为规则（多条、可开关），跨会话记忆。自动读取项目规则文件（`.devwhale/rules.md`、`AGENTS.md`、`CLAUDE.md`、`.cursorrules`）
- 🔙 **检查点** — 文件写入/编辑前自动备份，右侧面板一键回滚，多文件追踪
- 🔍 **语义索引** — 自动分析项目 import/export 依赖图和符号表，注入 system prompt
- 🛠️ **Skill 系统** — 内置 12 个专家 Skill + SkillsMP 社区市场
- 🐞 **调试器** — 内置 Node.js V8 Inspector：断点、单步、变量查看
- 📡 **LSP** — Pyright 内置（Python），可选 Rust Analyzer / gopls
- 🔌 **MCP** — Model Context Protocol 服务器支持
- 🌐 **国际化** — 简体中文 / English 切换
- ⚙️ **设置面板** — 11 个子面板

### 安全与体验
- 🔏 **隐私模式**
- ⏹ **流式中断**
- 🔄 **自动重试**（3 次，429/500 退避）
- 📊 **Token 用量显示**
- 📥 **文件拖放**

---

## 快速开始

### 1. 下载

从 [Releases](../../releases) 下载 `devwhale Setup.exe`，安装运行。

或源码启动：

```bash
cd DevWhale
npm install
npx electron .
npm run dev
```

### 2. 配置 API Key

打开应用 → 左下角头像 → 设置 → 模型 → 选择提供商并输入 API Key。

### 3. 操作速查

| 操作 | 方式 |
|------|------|
| 新建会话 | 左侧栏 "+" |
| 重命名 | 双击标题 |
| 删除会话 | 右键 → 删除 |
| 切换模式 | 输入框下方 YOLO / Ask / Plan |
| 打开文件夹 | 左侧栏 "📂 打开文件夹" |
| Ctrl+S | 保存到磁盘 |
| 导出会话 | "📥 导出" → Markdown |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 36 |
| 构建 | Vite 8 |
| 前端 | React 19 + TypeScript 6 |
| 样式 | Tailwind CSS 4 |
| 编辑器 | Monaco Editor |
| 终端 | xterm.js 5 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI 接口 | OpenAI 兼容协议 |
| 持久化 | localStorage |
| 打包 | electron-builder |
| LSP | Pyright（内置） |
| 调试 | V8 Inspector |

---

## 项目结构

```
DevWhale/
├── electron/          # Electron 主进程
│   ├── main.ts        # 窗口、IPC（文件/Shell/LSP/调试）
│   └── preload.ts     # contextBridge API
├── src/
│   ├── components/    # React UI
│   ├── hooks/         # 自定义 hooks
│   ├── lib/           # 核心模块
│   │   ├── api.ts     # Agent 引擎
│   │   ├── tools.ts   # 工具调度器
│   │   ├── shell.ts   # 跨平台 Shell
│   │   └── ...        # 等 14 个模块
│   ├── types/         # TS 类型
│   ├── App.tsx        # 根组件
│   └── main.tsx       # 入口
├── package.json
├── vite.config.ts
└── index.html
```

---

## vs Codex / Cursor / Claude Code / Trae Solo

| 维度 | DevWhale | Codex (OpenAI) | Cursor | Claude Code | Trae Solo |
|------|----------|----------------|--------|-------------|-----------|
| **形态** | 独立桌面应用 | 终端 CLI | IDE | 终端 CLI | IDE |
| **GUI** | 三栏 + Monaco + xterm | 无 | 完整 IDE | 无 | 完整 IDE |
| **多模型** | ✅ DeepSeek / OpenAI / Anthropic | ❌ 仅 OpenAI | ⚠️ 部分 | ❌ 仅 Anthropic | ⚠️ 部分 |
| **DeepSeek V4** | ✅ 原生 Tool Calling | ❌ 不兼容 | ⚠️ 格式冲突 | ❌ 不兼容 | ⚠️ 需代理 |
| **前缀缓存** | ✅ byte-stable，成本降 90% | ❌ | ❌ | ❌ | ❌ |
| **文件格式** | 65+ 拖放 | 基础读写 | 项目内 | 基础读写 | 项目内 |
| **DOCX/XLSX** | 自动解压 | ❌ | ❌ | ❌ | ❌ |
| **检查点回滚** | ✓ 一键 | ❌ | ✓ (Git) | ❌ | ✓ (Git) |
| **执行模式** | YOLO / Ask / Plan | YOLO | Agent / Ask | YOLO | Agent / Ask |
| **Skill 市场** | 12 内置 + 社区 | ❌ | ❌ | ❌ | ❌ |
| **LSP** | Pyright 内置 | ❌ | VSCode 插件 | ❌ | VSCode 插件 |
| **调试器** | V8 + UI | ❌ | VSCode | ❌ | VSCode |
| **国际化** | 中/英 | 仅英文 | 仅英文 | 仅英文 | 中/英 |
| **价格** | 免费开源 | 免费 | 订阅制 | API 付费 | 免费 |

## License

MIT
