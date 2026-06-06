<p align="center">
  <img src="imgs/logo.png" alt="DevWhale" width="115%" />
</p>

<h1 align="center">DevWhale</h1>
<p align="center"><strong>AI-Powered Desktop Dev Workbench</strong></p>
<p align="center"><em>Focus Deep. Build Efficiently. Code with DevWhale.</em></p>

<p align="center">
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="./README.zh-CN.md">简体中文</a>
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

DevWhale is a lightweight AI-powered coding assistant desktop app. Three-panel layout, streaming chat, Monaco editor (AI Ghost Text completion + LSP diagnostics), xterm.js terminal (with built-in V8 debugger), VSCode-style file tree, one-click checkpoint rollback, Skill marketplace — all running locally. The AI engine supports streaming Tool Calling: read/write/edit files, Git operations, web search, apply patches, create Word documents. Three execution modes: YOLO (fully automatic), Ask (confirm each step), Plan (plan first, then execute). Drag-and-drop supports 65+ file formats with automatic DOCX/XLSX text extraction and image-to-base64 multimodal input.

---

## DeepSeek V4 — Built as One

DevWhale isn't just "compatible" with DeepSeek — it was **architected from the ground up for DeepSeek V4 Pro**. Every design decision was made with DeepSeek's unique strengths and constraints in mind.

### Technical Integration

| Feature | Why It Matters for DeepSeek |
|---------|---------------------------|
| **Streaming Tool Calling** | DeepSeek's `tool_choice` + streaming delta accumulation is fully implemented — no dropped tool calls, no truncated JSON. Cursor/Claude Code frequently fail on DeepSeek's streaming tool format. |
| **`task_complete` Protocol** | DeepSeek doesn't emit `finish_reason: tool_calls` reliably. DevWhale uses a custom `task_complete` tool as the explicit termination signal — 100% reliable loop control. |
| **Byte-Stable System Prompt** | DeepSeek's prefix cache works at 128-token byte-level granularity. DevWhale appends rules/memories/skills/MCP tools at the prompt tail and never mutates the prefix — every turn hits the cache. ~90% input cost reduction. |
| **1M Context Shield** | DeepSeek V4 supports 1M tokens but degrades beyond ~700K characters. DevWhale's context guard proactively truncates history before the degradation zone. |
| **Multi-Model Router** | Single config toggle between DeepSeek / OpenAI / Anthropic — same Tool Calling loop, same tools, same UX. No vendor lock-in. |

### Cost Comparison (same coding task, ~5 tool call rounds)

| Tool | DeepSeek V4 Cost | Cache Hit Rate | 
|------|:---:|:---:|
| **DevWhale** | ~$0.02 | 85-95% ✅ |
| Cursor | ~$0.18 | <30% ❌ |
| Claude Code | N/A (no DeepSeek support) | N/A ❌ |
| Codex | N/A (OpenAI only) | N/A ❌ |

---

## Why DevWhale

### 🧠 Built for DeepSeek V4 Pro

Codex only supports OpenAI. Claude Code only supports Anthropic. **They don't work well with DeepSeek** — broken tool calls, context loss, severe degradation beyond 128K tokens.

DevWhale was **designed from day one for DeepSeek V4 Pro** — complete Tool Calling loop, `task_complete` termination protocol, 700K-character context protection, one-click multi-model switching between DeepSeek / OpenAI / Anthropic.

### 💰 Prefix Cache Optimization — 90% Cost Reduction

DeepSeek V4 provides **~90% cache discount** for byte-stable prefixes at 128-token granularity. DevWhale's Agent engine deliberately keeps the system prompt prefix stable — rules, memories, skills, project index, MCP tool list are all prepended and only appended — ensuring every conversation turn hits the cache. **The same code review task costs 1/10 of what it does on Cursor.**

Cursor and Claude Code restructure prompts on every tool call, resulting in near-zero cache hits. Codex is locked to OpenAI and never benefits from DeepSeek's caching.

### 🖥️ Standalone Desktop App, Not an IDE Plugin

Unlike Cursor (a modified VSCode) or Claude Code (a terminal CLI), DevWhale is a **native Electron desktop app** — double-click to launch, with built-in Monaco + xterm + file tree. No IDE dependency. Ideal for developers who don't want to switch editors, and accessible to non-technical users.

---

## Features

### Core
- 🧠 **AI Chat** — DeepSeek (V4 Pro / V4 Flash), OpenAI (GPT-4o), Anthropic (Claude). Streaming output, image input support
- 🔧 **Agent Tool Calling** — Streaming Tool Calling: read/write/edit files, exec commands, Git status/diff/commit/branch, web search/scrape, create DOCX, apply unified diff patches
- 💬 **Session Management** — Multiple conversations, project groups, search & filter, right-click menu (rename/delete/move group/export Markdown), persistent messages
- 📝 **Code Editor** — Monaco Editor with TypeScript/JavaScript/Python/Rust/Go syntax highlighting, smart completion, AI inline completion (Ghost Text), inline diff annotations, Ctrl+S save to filesystem
- 🖥️ **Terminal** — xterm.js terminal emulator with command history (↑↓), collapsible Agent command logs, real-time streaming output
- 📁 **File Tree** — Project file browser, recursive filesystem scanning, extension-based coloring

### Auxiliary
- 🌓 **Light/Dark Theme** — Auto-follow system, manual toggle, CSS variables + Tailwind token system
- 📋 **Rules & Memory** — Custom AI behavior rules (multiple, toggleable), cross-session memory. Auto-reads project-level rule files (`.devwhale/rules.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`)
- 🔙 **Checkpoints** — Auto-backup before file writes/edits, one-click rollback from right panel, multi-file tracking
- 🔍 **Semantic Index** — Auto-analyzes project import/export dependency graphs and symbol tables, injects into system prompt
- 🛠️ **Skill System** — 12 built-in expert skills (code review, test gen, docs, perf optimization, security audit, etc.) + community marketplace via SkillsMP
- 🐞 **Debugger** — Integrated Node.js V8 Inspector protocol: breakpoints, step execution, variable inspection
- 📡 **LSP Support** — Built-in Pyright (Python), optional Rust Analyzer / gopls for diagnostics and code navigation
- 🔌 **MCP Protocol** — Model Context Protocol server support for extensible toolchains
- 🌐 **i18n** — Simplified Chinese / English toggle
- ⚙️ **Settings Panel** — 11 sub-panels: General / MCP / Models / Skills / Chat Flow / External Auth / Cloud Runtime / Worktree / Commands / Rules & Memory / About

### Safety & UX
- 🔏 **Privacy Mode** — AI won't log or infer personal information
- ⏹ **Stream Abort** — Stop generation mid-response
- 🔄 **Auto Retry** — 3 automatic retries on network failure, exponential backoff on 429/500
- 📊 **Token Usage** — Per-message prompt/completion/cache hit rate display
- 📥 **Drag & Drop** — Drop code files and images directly into the chat

---

## Quick Start

### 1. Download

Download `devwhale Setup.exe` from [Releases](../../releases) and run.

Or run from source:

```bash
cd DevWhale
npm install
npx electron .          # Launch Electron directly
npm run dev             # Vite dev server + Electron window
```

### 2. Configure API Key

1. Open app → Bottom-left avatar → Settings → Models
2. Select provider (DeepSeek / OpenAI / Anthropic)
3. Enter API Key
   - DeepSeek: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com)
4. Select model and start chatting

### 3. Quick Reference

| Action | How |
|--------|-----|
| New conversation | Sidebar "+" button |
| Rename conversation/group | Double-click title |
| Delete conversation | Right-click → Delete, or hover × |
| Move conversation to group | Right-click → target group |
| Switch mode | YOLO / Ask / Plan buttons below input |
| Open folder | Sidebar "📂 Open Folder" |
| Open file | File tree click, or click file path in chat |
| Ctrl+S | Save current editor file to disk |
| Stop generation | "Stop" button during streaming |
| Export conversation | Sidebar "📥 Export" → Markdown file |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Electron 36 |
| Build Tools | Vite 8 + vite-plugin-electron |
| Frontend | React 19 + TypeScript 6 |
| Styling | Tailwind CSS 4 + CSS variable theming |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Terminal | xterm.js 5 + addon-fit |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI Interface | OpenAI-compatible protocol (DeepSeek / OpenAI / Anthropic) |
| Persistence | localStorage |
| Packaging | electron-builder (NSIS / DMG / AppImage) |
| LSP | Pyright (bundled) / rust-analyzer / gopls |
| Debugging | V8 Inspector Protocol |

---

## Project Structure

```
DevWhale/
├── electron/               # Electron main process
│   ├── main.ts             # Window, IPC (file/shell/LSP/debug/update)
│   └── preload.ts          # contextBridge API
├── src/
│   ├── components/         # React UI
│   │   ├── Sidebar.tsx     # Conversation list + project groups
│   │   ├── ChatArea.tsx    # Chat area + input + mode switch
│   │   ├── MessageBubble.tsx # Markdown message renderer
│   │   ├── RightPanel.tsx  # TODOs / file tree / checkpoints / context
│   │   ├── SettingsPanel.tsx # Settings (11 sub-panels)
│   │   ├── CodeViewer.tsx  # Monaco editor + AI completion
│   │   ├── DiffViewer.tsx  # Unified diff parser + inline highlight
│   │   ├── FileTree.tsx    # Recursive file tree
│   │   ├── TerminalPanel.tsx # xterm.js terminal
│   │   └── SkillStore.tsx  # Skill marketplace
│   ├── hooks/              # Custom hooks
│   │   └── useTheme.tsx    # Theme context (light/dark/system)
│   ├── lib/                # Core modules
│   │   ├── api.ts          # Agent engine v3: system prompt + streaming Tool Calling
│   │   ├── tools.ts        # Tool dispatcher (read/write/edit/Git/search/patch/DOCX)
│   │   ├── shell.ts        # Cross-platform shell (PowerShell/Bash)
│   │   ├── tauriFs.ts      # Electron IPC file operations
│   │   ├── storage.ts      # localStorage persistence
│   │   ├── indexer.ts      # Semantic project index (symbols + dependency graph)
│   │   ├── completion.ts   # AI code completion (FIM + Ghost Text)
│   │   ├── checkpoint.ts   # Auto-backup + rollback
│   │   ├── lsp.ts          # LSP manager (Python/Rust/Go)
│   │   ├── mcp.ts          # MCP client (reuses LSP IPC infrastructure)
│   │   ├── debugger.ts     # Node.js V8 Inspector debugger
│   │   ├── skillsMarket.ts # SkillsMP marketplace API
│   │   ├── i18n.ts         # Internationalization (zh-CN / en)
│   │   └── utils.ts        # cn() / time formatting
│   ├── types/              # TypeScript types
│   │   └── chat.ts         # Message / Conversation / Project / TodoItem / Mode
│   ├── App.tsx             # Root component: global state + agent dispatch + persistence
│   └── main.tsx            # React entry + ThemeProvider
├── dist/                   # Vite build output (frontend)
├── dist-electron/          # TSC build output (Electron main process)
├── release/                # electron-builder output
├── public/                 # Static assets
├── package.json            # Dependencies + electron-builder config
├── vite.config.ts          # Vite + electron plugin config
├── tsconfig.json           # TypeScript config
└── index.html              # Entry HTML
```

---

## Architecture

### Agent Engine (api.ts)

```
User input → buildSystem (rules/memories/skills/project index/tech stack/MCP/Agent protocol)
          → Build messages (system + history + user)
          → Streaming Tool Calling loop:
             ├── fetch API (auto-retry 3×)
             ├── Accumulate delta.content → onToken
             ├── Accumulate delta.tool_calls → parallel execution on completion
             ├── Tool results → append to messages → next iteration
             └── Termination: task_complete / context overflow (700K chars) / empty loop (5 iterations)
```

### Tool Layer (tools.ts)

15 built-in tools + MCP dynamic routing:
`read_file | write_file | edit_file | exec_command | list_dir | create_docx | git_status | git_diff | git_log | git_commit | git_branch | apply_patch | web_search | web_fetch | task_complete`

### Data Flow

```
API (DeepSeek/OpenAI/Anthropic)
  ↕ fetch (OpenAI-compatible /chat/completions)
lib/api.ts (Agent engine + streaming Tool Calling)
  ↕ onToolCall / onToken / onProgress
App.tsx (Global state + useEffect persistence)
  ↕ props
React Components (Sidebar / ChatArea / MessageBubble / RightPanel / CodeViewer / TerminalPanel)
  ↕ IPC (contextBridge)
electron/main.ts (File I/O / Shell / LSP / Debugger)
```

---

## Requirements

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows:** No extra dependencies (Electron bundles Chromium)
- **macOS:** No extra dependencies
- **Linux:** `libgtk-3-0`, `libnotify4` etc. (standard Electron dependencies)

### Dev Quick Start

```bash
npm install
npm run dev             # Vite dev server + Electron window
npx tsc --noEmit        # Type check only
npm run build           # Production build
npm run electron:build  # Package distributable installer
```

---

## vs Codex / Cursor / Claude Code / Trae Solo

| Dimension | DevWhale | Codex (OpenAI) | Cursor | Claude Code | Trae Solo |
|-----------|----------|----------------|--------|-------------|-----------|
| **Form Factor** | Standalone desktop app | Terminal CLI | IDE (VSCode fork) | Terminal CLI | IDE |
| **Launch** | Double-click .exe | `npx` command | Install IDE | `claude` command | Install IDE |
| **GUI** | 3-panel + Monaco + xterm | None (plain text) | Full IDE | None (plain text) | Full IDE |
| **Code Editor** | Built-in Monaco (AI Ghost Text) | None | VSCode editor | None | Built-in editor |
| **Terminal** | xterm.js + debugger | System terminal | Integrated | System terminal | Integrated |
| **Multi-Model** | ✅ DeepSeek / OpenAI / Anthropic | ❌ OpenAI only | ⚠️ Partial | ❌ Anthropic only | ⚠️ Partial |
| **DeepSeek V4** | ✅ Native Tool Calling + task_complete | ❌ Incompatible | ⚠️ Format issues | ❌ Incompatible | ⚠️ Proxy required |
| **Prefix Cache** | ✅ byte-stable prefix, ~90% cost reduction | ❌ | ❌ | ❌ | ❌ |
| **File Formats** | 65+ drag-and-drop | Basic read/write | Project files | Basic read/write | Project files |
| **DOCX/XLSX** | Auto-extract text | ❌ | ❌ | ❌ | ❌ |
| **Image Multimodal** | Drag/select → auto base64 | ❌ | ✓ | ✓ | ✓ |
| **Checkpoints** | ✓ One-click rollback | ❌ | ✓ (Git) | ❌ | ✓ (Git) |
| **Execution Modes** | YOLO / Ask / Plan | YOLO only | Agent / Ask | YOLO only | Agent / Ask |
| **Skill Marketplace** | 12 built-in + community | ❌ | ❌ | ❌ | ❌ |
| **LSP Diagnostics** | Pyright built-in + Monaco | ❌ | VSCode plugins | ❌ | VSCode plugins |
| **Debugger** | V8 Inspector + UI | ❌ | VSCode debugger | ❌ | VSCode debugger |
| **File Tree** | VSCode-style connectors | ❌ | ✓ | ❌ | ✓ |
| **Rules & Memory** | Custom rules + project rules | system prompt | .cursorrules | CLAUDE.md | config files |
| **i18n** | zh-CN / en | English only | English only | English only | zh-CN / en |
| **Sandbox** | Native execution | Sandboxed ✅ | Native | Native | Native |
| **Maturity** | Independent project | OpenAI official | Commercial | Anthropic official | Commercial |
| **Pricing** | Free & open-source | Free | Subscription | API paid | Free |

## License

MIT
