# DevWhale

> AI 驱动的桌面开发工作台 — Electron 36 + React 19 + TypeScript 6

DevWhale 是一个轻量级的 AI 编程助手桌面应用，对标 Cursor / Trae Solo。三栏布局、流式对话、Monaco 代码编辑器（支持 AI Ghost Text 补全和 LSP 诊断）、xterm.js 终端（含内置 V8 调试器）、文件树（VSCode 风格）、检查点回滚、Skill 市场，全部本地运行。AI 引擎支持流式 Tool Calling，可读/写/编辑/Git 操作/Web 搜索/应用补丁/创建 Word 文档，三种执行模式（YOLO 全自动 / Ask 每步确认 / Plan 先计划后执行）。拖放支持 65+ 文件格式，DOCX/XLSX 自动解压提取文本，图片转 base64 多模态输入。

![DevWhale](screenshot.png)

---

## 功能

### 核心能力
- 🧠 **真实 AI 对话** — 对接 DeepSeek（V4 Pro / V4 Flash）、OpenAI（GPT-4o）、Anthropic（Claude）多模型，流式输出，支持图片输入
- 🔧 **Agent 工具调用** — 流式 Tool Calling：读文件、写文件、编辑文件、执行命令、Git 状态/差异/提交/分支、Web 搜索/抓取、创建 Word 文档、应用 unified diff 补丁
- 💬 **会话管理** — 多会话、项目分组、搜索过滤、右键菜单（重命名/删除/移动分组/导出 Markdown）、消息持久化
- 📝 **代码编辑器** — 集成 Monaco Editor，支持 TypeScript/JavaScript/Python/Rust/Go 语法高亮、智能补全、AI 内联补全（Ghost Text）、行内 Diff 标注、Ctrl+S 保存到文件系统
- 🖥️ **终端面板** — 基于 xterm.js 的终端模拟器，支持命令历史（↑↓）、Agent 命令日志折叠/展开、实时流式输出
- 📁 **文件树** — 项目文件浏览，自动递归扫描实际文件系统，按扩展名着色

### 辅助系统
- 🌓 **日/夜主题** — 跟随系统自动切换，或手动切换亮色/暗色，使用 CSS 变量 + Tailwind token 体系
- 📋 **规则与记忆** — 设定 AI 行为准则（支持多条规则开关），跨会话记住事实。自动读取项目级规则文件（.bobdesk/rules.md、AGENTS.md、CLAUDE.md、.cursorrules）
- 🔙 **检查点回滚** — 文件写入/编辑前自动备份，右侧面板随时回滚到之前的版本，支持多文件追踪
- 🔍 **语义索引** — 自动分析项目 import/export 依赖图和关键符号表，注入 system prompt 帮助 AI 理解项目结构
- 🛠️ **技能系统** — 内置 12 个专家 Skill（代码审查/测试生成/文档编写/性能优化/安全审计等），支持从 SkillsMP 市场搜索安装社区 Skill
- 🐞 **调试器** — 集成 Node.js V8 Inspector 协议，支持断点设置、单步执行、变量查看
- 📡 **LSP 支持** — 内置 Pyright（Python），可选 Rust Analyzer / gopls，提供诊断和代码导航
- 🔌 **MCP 协议** — 支持 Model Context Protocol 服务器，可扩展外部工具链
- 🌐 **国际化** — 简体中文 / English 双语界面可切换
- ⚙️ **完整设置面板** — 11 个设置子面板：通用 / MCP / 模型 / 技能 / 对话流 / 外部应用授权 / 云端运行环境 / 工作树 / 命令 / 规则与记忆 / 关于

### 安全与体验
- 🔏 **隐私模式** — 开启后 AI 不会记录或推断个人信息
- ⏹ **流式中断** — 对话生成过程中可随时停止
- 🔄 **自动重试** — API 网络请求失败自动重试 3 次，429/500 自动退避
- 📊 **Token 用量** — 每条消息显示 prompt/completion/cache 命中率
- 📥 **文件拖放** — 支持拖放代码文件和图片到对话框，自动读取内容并编码

---

## 快速开始

### 1. 下载运行

从 [Releases](../../releases) 下载 `devwhale Setup.exe`，安装后双击运行。

或从源码启动：

```bash
cd bob前端
npm install
npx electron .          # 直接启动 Electron
# 或
npm run dev             # Vite 开发服务器 + Electron 窗口
```

### 2. 配置 API Key

首次使用需要配置 AI API Key：

1. 打开应用 → 左下角头像 → 设置（Settings）→ 模型（Models）
2. 选择提供商（DeepSeek / OpenAI / Anthropic）
3. 输入 API Key
   - DeepSeek: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com)
4. 选择模型后即可开始对话

### 3. 快速操作指南

| 操作 | 方式 |
|------|------|
| 新建会话 | 左侧栏 "+" 按钮 |
| 重命名会话/分组 | 双击标题 |
| 删除会话 | 右键 → 删除，或悬停时点 × |
| 移动会话到分组 | 右键 → 选择目标分组 |
| 切换模式 | 输入框下方 YOLO / Ask / Plan |
| 打开文件夹 | 左侧栏 "📂 打开文件夹" |
| 打开文件 | 文件树点击，或对话中点击文件路径 |
| Ctrl+S | 保存当前编辑器文件到磁盘 |
| 停止生成 | 流式输出时下方 "停止生成" 按钮 |
| 导出会话 | 左侧顶部 "📥 导出" 按钮 → Markdown 文件 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 36 |
| 构建工具 | Vite 8 + vite-plugin-electron |
| 前端框架 | React 19 + TypeScript 6 |
| 样式 | Tailwind CSS 4 + CSS 变量主题 |
| 代码编辑器 | Monaco Editor (@monaco-editor/react) |
| 终端 | xterm.js 5 + addon-fit |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI 接口 | OpenAI 兼容协议（DeepSeek / OpenAI / Anthropic） |
| 数据持久化 | localStorage |
| 打包 | electron-builder (NSIS / DMG / AppImage) |
| LSP | Pyright (bundled) / rust-analyzer / gopls |
| 调试 | V8 Inspector Protocol |

---

## 项目结构

```
bob前端/
├── electron/               # Electron 主进程
│   ├── main.ts             # 窗口管理、IPC（文件/Shell/LSP/调试/更新）
│   └── preload.ts          # contextBridge 安全 API 暴露
├── src/
│   ├── components/         # React UI 组件
│   │   ├── Sidebar.tsx     # 左侧会话列表 + 项目分组
│   │   ├── ChatArea.tsx    # 中间对话区 + 输入框 + 模式切换
│   │   ├── MessageBubble.tsx # Markdown 消息渲染 + 代码运行/应用
│   │   ├── RightPanel.tsx  # 右侧 TODO/文件树/检查点/上下文面板
│   │   ├── SettingsPanel.tsx # 设置面板（11 个子面板）
│   │   ├── CodeViewer.tsx  # Monaco 编辑器 + AI 补全
│   │   ├── DiffViewer.tsx  # Unified Diff 解析 + 行内高亮
│   │   ├── FileTree.tsx    # 递归文件树组件
│   │   ├── TerminalPanel.tsx # xterm.js 终端
│   │   └── SkillStore.tsx  # Skill 专区（已安装/搜索/榜单）
│   ├── hooks/              # 自定义 hooks
│   │   └── useTheme.tsx    # 主题 Context（亮/暗/跟随系统）
│   ├── lib/                # 工具模块
│   │   ├── api.ts          # Agent 引擎 v3：system prompt 构建 + 流式 Tool Calling 循环
│   │   ├── tools.ts        # 工具执行调度器（读/写/编辑/Git/搜索/补丁/DOCX）
│   │   ├── shell.ts        # 跨平台 Shell 封装（PowerShell/Bash 自适应）
│   │   ├── tauriFs.ts      # Electron IPC 文件系统操作
│   │   ├── storage.ts      # localStorage 持久化（会话/设置/技能/提供商/规则记忆）
│   │   ├── indexer.ts      # 项目语义索引（符号 + 依赖图）
│   │   ├── completion.ts   # AI 代码补全引擎（FIM + Ghost Text）
│   │   ├── checkpoint.ts   # 文件操作前自动备份 + 回滚
│   │   ├── lsp.ts          # LSP 管理器（Python/TypeScript/Rust/Go）
│   │   ├── mcp.ts          # MCP 客户端（复用 LSP IPC 基础设施）
│   │   ├── debugger.ts     # Node.js V8 Inspector 调试器
│   │   ├── skillsMarket.ts # SkillsMP 市场 API + 双语搜索 + GitHub 下载
│   │   ├── i18n.ts         # 国际化（简体中文 / English）
│   │   └── utils.ts        # cn() / 时间格式化
│   ├── types/              # TypeScript 类型定义
│   │   └── chat.ts         # Message / Conversation / Project / TodoItem / Mode
│   ├── App.tsx             # 根组件：全局状态 + Agent 调度 + 持久化
│   └── main.tsx            # React 入口 + ThemeProvider 挂载
├── dist/                   # Vite 构建输出（前端）
├── dist-electron/          # Vite 构建输出（Electron 主进程）
├── release/                # electron-builder 打包输出
├── public/                 # 静态资源
├── package.json            # 依赖与 electron-builder 配置
├── vite.config.ts          # Vite + electron 插件配置
├── tsconfig.json           # TypeScript 配置
├── tsconfig.app.json       # 前端 TS 配置
├── tsconfig.node.json      # Electron 主进程 TS 配置
└── index.html              # 入口 HTML
```

---

## 核心架构说明

### Agent 引擎（api.ts）

```
用户输入 → buildSystem (规则/记忆/技能/项目索引/技术栈/MCP/Agent协议)
         → 构建 messages (system + history + user)
         → 流式 Tool Calling 循环:
            ├── fetch API (自动重试 3 次)
            ├── 累积 delta.content → onToken
            ├── 累积 delta.tool_calls → 完成时并行执行
            ├── 工具结果 → 回填 messages → 下一轮
            └── 终止条件: task_complete / 上下文超限(700K字符) / 连续空转(5轮)
```

### 工具执行层（tools.ts）

15 个内置工具 + MCP 动态工具路由：
`read_file | write_file | edit_file | exec_command | list_dir | create_docx | git_status | git_diff | git_log | git_commit | git_branch | apply_patch | web_search | web_fetch | task_complete`

### 数据流

```
API (DeepSeek/OpenAI/Anthropic)
  ↕ fetch (OpenAI 兼容 /chat/completions)
lib/api.ts (Agent 引擎 + 流式 Tool Calling)
  ↕ onToolCall / onToken / onProgress
App.tsx (全局状态管理 + useEffect 持久化)
  ↕ props
React Components (Sidebar / ChatArea / MessageBubble / RightPanel / CodeViewer / TerminalPanel)
  ↕ IPC (contextBridge)
electron/main.ts (文件I/O / Shell / LSP / 调试器 / 自动更新)
```

---

## 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows:** 无需额外依赖（Electron 自带 Chromium）
- **macOS:** 无需额外依赖
- **Linux:** 需要 `libgtk-3-0`、`libnotify4` 等（Electron 标准依赖）

### 快速开发

```bash
# 安装依赖
npm install

# 启动开发服务器（Vite + Electron 窗口）
npm run dev

# 仅编译检查
npx tsc --noEmit

# 生产构建
npm run build

# 打包为可分发安装包
npm run electron:build
```

---

---

## vs Codex / Cursor / Claude Code / Trae Solo

| 维度 | DevWhale | Codex (OpenAI) | Cursor | Claude Code | Trae Solo |
|------|----------|----------------|--------|-------------|-----------|
| **形态** | 独立桌面应用 | 终端 CLI | IDE（VSCode 魔改） | 终端 CLI | IDE |
| **启动** | 双击 .exe | `npx` 命令行 | 安装 IDE | `claude` 命令 | 安装 IDE |
| **GUI** | 三栏布局 + Monaco + xterm | 无（纯文本） | 完整 IDE | 无（纯文本） | 完整 IDE |
| **代码编辑器** | 内置 Monaco（AI Ghost Text） | 无 | VSCode 编辑器 | 无 | 内置编辑器 |
| **终端** | xterm.js 集成 + 调试器 | 依赖系统终端 | 集成终端 | 依赖系统终端 | 集成终端 |
| **多模型** | DeepSeek / OpenAI / Anthropic | 仅 OpenAI | 多家 API | 仅 Anthropic | 多家 API |
| **文件类型** | 65+ 格式拖放即读 | 基础文件读写 | 项目内文件 | 基础文件读写 | 项目内文件 |
| **DOCX/XLSX** | 自动解压提取文本 | ❌ | ❌ | ❌ | ❌ |
| **图片多模态** | 拖放/选择 → 自动 base64 | ❌ | ✓ | ✓ | ✓ |
| **检查点回滚** | ✓ 一键回滚 | ❌ | ✓ (Git) | ❌ | ✓ (Git) |
| **执行模式** | YOLO / Ask / Plan | YOLO only | Agent / Ask | YOLO only | Agent / Ask |
| **Skill 市场** | 内置 12 + 社区市场 | ❌ | ❌ | ❌ | ❌ |
| **LSP 诊断** | Pyright 内置 + Monaco | ❌ | VSCode 插件 | ❌ | VSCode 插件 |
| **调试器** | V8 Inspector + UI | ❌ | VSCode 调试器 | ❌ | VSCode 调试器 |
| **文件树** | VSCode 风格连接线 | ❌ | ✓ | ❌ | ✓ |
| **规则记忆** | 自定义规则 + 项目规则 | system prompt | .cursorrules | CLAUDE.md | 配置文件 |
| **多语言 UI** | 中/英 切换 | 仅英文 | 仅英文 | 仅英文 | 中/英 |
| **沙箱安全** | 本机直接执行 | 隔离沙箱 ✅ | 本机 | 本机 | 本机 |
| **成熟度** | 个人项目 | OpenAI 官方 | 商业产品 | Anthropic 官方 | 商业产品 |
| **价格** | 免费开源 | 免费 | 订阅制 | API 付费 | 免费 |

## License

MIT
