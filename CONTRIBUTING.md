# 贡献指南

感谢你对 devwhale 的关注！这份指南将帮助你参与项目开发。

## 行为准则

- 保持友善和尊重
- 建设性反馈优先于批评
- 帮助新人融入

## 如何贡献

### 报告 Bug

1. 搜索 [Issues](../../issues) 确认 Bug 未被报告
2. 使用 Bug Report 模板提交 Issue
3. 包含：环境信息（OS / Node 版本）、复现步骤、期望 vs 实际行为

### 提交功能请求

1. 搜索现有 Issues 和 Discussions
2. 描述功能的使用场景和预期效果
3. 如果能提供技术方案设计更好

### 提交代码

1. **Fork 并 Clone** 本仓库
2. **创建分支**：`feat/xxx`（新功能）或 `fix/xxx`（修复）
3. **开发**：
   ```bash
   npm install          # 安装依赖
   npm run build        # 构建
   npm run electron:start  # 启动桌面应用
   ```
4. **测试**：确保 `npm run build` 和 `npm run lint` 通过
5. **提交**：使用约定式提交格式
   ```
   feat: 添加 Git diff 工具
   fix: 修复跨平台路径分隔符问题
   docs: 更新 README 安装说明
   ```
6. **发起 Pull Request**：关联相关 Issue，描述改动

## 开发环境

| 需求 | 版本 |
|------|------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |

## 项目结构

```
electron/
  main.ts         # Electron 主进程（窗口、IPC、LSP、调试器）
  preload.ts      # contextBridge 安全 API

src/
├── components/   # React UI 组件
│   ├── Sidebar.tsx, ChatArea.tsx, MessageBubble.tsx
│   ├── RightPanel.tsx, SettingsPanel.tsx
│   ├── CodeViewer.tsx, DiffViewer.tsx, FileTree.tsx
│   ├── TerminalPanel.tsx, SkillStore.tsx
├── hooks/        # useTheme
├── lib/          # 核心逻辑
│   ├── api.ts    # Agent 引擎（流式 Tool Calling）
│   ├── tools.ts  # 工具执行调度器
│   ├── shell.ts  # 跨平台 Shell
│   ├── storage.ts, indexer.ts, completion.ts
│   ├── checkpoint.ts, lsp.ts, mcp.ts, debugger.ts
│   └── skillsMarket.ts, i18n.ts, tauriFs.ts
├── types/        # TypeScript 类型 + electron.d.ts
├── App.tsx       # 根组件
└── main.tsx      # React 入口
```

## 代码风格

- TypeScript 严格模式
- React 函数式组件 + Hooks
- Tailwind CSS 4 + CSS 变量主题
- `async/await` 优于 `.then()`

## Review 流程

维护者会在 3 个工作日内 review。

## License

MIT — 详见 [LICENSE](./LICENSE)
