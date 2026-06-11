# DevWhale 变更日志

## [2026-06-11] Bug 修复：Shell 编码 + 平台检测

### Shell 编码修复
- **PowerShell GBK 乱码**: `shell: false` 直连 + `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 强制 UTF-8 输出
- **cmd.exe 乱码**: `chcp 65001 >nul` 切换代码页
- **`listDirectory` 平台检测**: 改为 try PowerShell 优先，失败回退 bash（不再依赖 `detectPlatform()` 缓存）

### 消息气泡操作按钮
- 新增复制/重试/删除按钮（hover 显示）
- 删除：过滤消息；重试：删旧消息 + 重新发送原文

### 工具名修复
- 空闲终止消息工具名从 `(?, ?)` 修复为真实工具名

## [2026-06-11] MCP (Model Context Protocol) 功能实现

### 新增功能
- MCP 协议处理器：支持 stdio 类型 MCP 服务器的完整生命周期管理
  - `electron/main.ts`: `mcp:start` / `mcp:request` / `mcp:stop` IPC handler
  - `electron/preload.ts`: 暴露 `startMcp` / `mcpRequest` / `stopMcp` / `onMcpCrashed` API
  - `src/lib/mcp.ts`: 渲染进程 MCP 客户端、会话管理、工具调用入口
- MCP 设置面板 (`src/components/SettingsPanel.tsx`):
  - MCP 市场：6 个预设服务器一键安装（Filesystem / GitHub / PostgreSQL / Slack / Brave Search / Puppeteer）
  - 手动添加自定义 MCP 服务器
  - 启动/停止/启用/禁用/删除 UI
  - 启动中状态（"..." 按钮 + 蓝色"启动中..."）
  - 运行中工具计数 + 工具标签列表展示
  - 错误详情直接显示
  - 进程崩溃自动检测与 UI 更新
- Agent 集成 (`src/lib/api.ts`, `src/lib/tools.ts`):
  - `buildSystem()` 自动从已运行 MCP 会话注入工具列表到 system prompt
  - `executeToolCall()` MCP 工具路由（`mcp_<serverId>_<toolName>`）
  - 同名服务器去重，避免重复启动

### Bug 修复（11 项）
1. **预设服务器包名 scope 错误**: `@anthropic-ai/mcp-server-*` → `@modelcontextprotocol/server-*`
2. **NDJSON 协议适配**: 新版 MCP SDK 使用换行分隔 JSON (`{json}\n`)，替代 Content-Length 帧格式
3. **MCP 通信修复**: `cmd.exe` stdin 转发 + NDJSON 行解析器
4. **Agent 重复启动 MCP**: `buildSystem()` 改为 `getAllMcpTools()` 读取已运行会话
5. **工具名 ID 不匹配**: 统一使用主进程生成的 `serverId`
6. **3 秒超时太短**: 移除 `buildSystem` 中的 MCP 启动逻辑
7. **React.Fragment 未导入**: 改为 `<div>` 包裹
8. **useEffect 未导入**: `import { useState, useEffect }` 补全
9. **ES Module vs CommonJS 冲突**: `dist-electron/package.json` 声明 `{"type":"commonjs"}`
10. **stderr 就绪信号检测**: 监听 `"running on stdio"` 替代固定 2s 等待，总超时 30s
11. **进程崩溃通知**: `child.on('close')` → IPC `mcp:crashed` → 前端自动清除状态

### 技术文档
- 桌面 `MCP.md`：完整的技术文档，含架构图、数据流、类型定义、IPC 接口、验证方法

## [2026-06-10] 测试架构重构 + AI 驱动 E2E

### 目录整理
```
tests/
├── functional/          # 功能测试（10 个深度审计用例）
│   └── audit.test.tsx
└── e2e/                 # 端到端测试
    ├── ai-tester.ts     # 🤖 AI 驱动的自动化测试（用 DeepSeek API 测试 DevWhale）
    ├── user-sim.e2e.ts  # 🖥 Playwright Electron 真人模拟测试
    └── playwright.config.ts
src/
├── lib/__tests__/       # 单元测试（不变）
└── components/__tests__/ # 组件测试（不变）
```

### 两种"像真人一样测试"的方案

| 方案 | 文件 | 原理 | 运行 |
|------|------|------|------|
| **AI-as-Tester** | `tests/e2e/ai-tester.ts` | 另一个 DeepSeek V4 实例作为虚拟用户，发送 10 个精心设计的 prompt，自动验证回复质量和工具调用 | `npm run test:ai` |
| **Playwright Electron** | `tests/e2e/user-sim.e2e.ts` | 启动真实 Electron 窗口，模拟点击/输入/切换面板等真人操作 | `npm run test:e2e` |

### AI-as-Tester 工作流程
```
用户设置 DEEPSEEK_API_KEY
        ↓
tests/e2e/ai-tester.ts 启动
        ↓
逐用例: 构造 system prompt + user message → 调用 DeepSeek API
        ↓
断言引擎: 检查回复是否包含/不包含关键词、长度、工具调用
        ↓
生成 JSON 报告 → tests/e2e/ai-test-report.json
```

### npm scripts
```bash
npm test              # 全量单元 + 功能测试 (Vitest)
npm run test:ai       # AI 驱动的 E2E（需 DEEPSEEK_API_KEY）
npm run test:e2e      # Playwright Electron E2E（需桌面环境）
npm run test:watch    # 监听模式
```

### 此前修复汇总
- `api.ts` — `thinking` 参数仅 DeepSeek 发送
- `api.ts` — 工具重试检查返回值而非依赖异常
- `api.ts` — `makeUsage` `||` → `??` 修复 falsy 陷阱
- `api.ts` — `stableStringify` 跳过 undefined 键
- `App.tsx` — localStorage 500ms debounce
- `App.tsx` — 文件树不再排除隐藏文件
- `ChatArea.tsx` — 拖入文件按钮 disabled 修复
- `tools.ts` — `edit_file` 用 `replaceAll`
- `shell.ts` — `dist` 过滤正则精确化
- `electron/main.ts` — LSP NaN 保护 + PowerShell 路径转义
- `Sidebar.tsx` — 分组折叠持久化
