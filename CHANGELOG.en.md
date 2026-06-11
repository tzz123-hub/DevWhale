# DevWhale Changelog

## [2026-06-11] MCP (Model Context Protocol) Implementation

### New Features
- MCP Protocol Handler: full lifecycle management for stdio-type MCP servers
  - `electron/main.ts`: `mcp:start` / `mcp:request` / `mcp:stop` IPC handlers
  - `electron/preload.ts`: exposes `startMcp` / `mcpRequest` / `stopMcp` / `onMcpCrashed` API
  - `src/lib/mcp.ts`: renderer-process MCP client, session management, tool invocation
- MCP Settings Panel (`src/components/SettingsPanel.tsx`):
  - MCP Marketplace: 6 preset servers with one-click install (Filesystem / GitHub / PostgreSQL / Slack / Brave Search / Puppeteer)
  - Manual custom MCP server configuration
  - Start / Stop / Enable / Disable / Delete UI
  - Loading state ("..." button + blue "Starting...")
  - Running tool count + tool tag list display
  - Inline error details
  - Process crash auto-detection with UI update
- Agent Integration (`src/lib/api.ts`, `src/lib/tools.ts`):
  - `buildSystem()` auto-injects tool list from running MCP sessions into system prompt
  - `executeToolCall()` MCP tool routing (`mcp_<serverId>_<toolName>`)
  - Same-name server deduplication to prevent duplicate startup

### Bug Fixes (11 items)
1. **Preset server package scope error**: `@anthropic-ai/mcp-server-*` → `@modelcontextprotocol/server-*`
2. **NDJSON protocol adaptation**: new MCP SDK uses newline-delimited JSON (`{json}\n`), replacing Content-Length frame format
3. **MCP communication fix**: `cmd.exe` stdin forwarding + NDJSON line parser
4. **Agent duplicate MCP startup**: `buildSystem()` now uses `getAllMcpTools()` to read running sessions
5. **Tool name ID mismatch**: unified use of main process-generated `serverId`
6. **3-second timeout too short**: removed MCP startup logic from `buildSystem`
7. **React.Fragment not imported**: replaced with `<div>` wrapper
8. **useEffect not imported**: added to import statement `import { useState, useEffect }`
9. **ES Module vs CommonJS conflict**: `dist-electron/package.json` declares `{"type":"commonjs"}`
10. **stderr ready signal detection**: listens for `"running on stdio"` instead of fixed 2s wait, 30s total timeout
11. **Process crash notification**: `child.on('close')` → IPC `mcp:crashed` → frontend auto-clears state

### Documentation
- Desktop `MCP.md`: comprehensive technical documentation including architecture diagram, data flow, type definitions, IPC interfaces, and verification methods

## [2026-06-10] Test Architecture Refactoring + AI-Driven E2E

### Directory Structure
```
tests/
├── functional/          # Functional tests (10 deep audit test cases)
│   └── audit.test.tsx
└── e2e/                 # End-to-end tests
    ├── ai-tester.ts     # 🤖 AI-driven automated testing (uses DeepSeek API to test DevWhale)
    ├── user-sim.e2e.ts  # 🖥 Playwright Electron human simulation tests
    └── playwright.config.ts
src/
├── lib/__tests__/       # Unit tests (unchanged)
└── components/__tests__/ # Component tests (unchanged)
```

### Two "Human-like Testing" Approaches

| Approach | File | Principle | Run |
|----------|------|-----------|-----|
| **AI-as-Tester** | `tests/e2e/ai-tester.ts` | Another DeepSeek V4 instance acts as virtual user, sends 10 carefully crafted prompts, auto-validates response quality and tool calls | `npm run test:ai` |
| **Playwright Electron** | `tests/e2e/user-sim.e2e.ts` | Launches real Electron window, simulates clicks/input/panel switching like a real user | `npm run test:e2e` |

### AI-as-Tester Workflow
```
User sets DEEPSEEK_API_KEY
        ↓
tests/e2e/ai-tester.ts starts
        ↓
Per test case: build system prompt + user message → call DeepSeek API
        ↓
Assertion engine: check if response contains/doesn't contain keywords, length, tool calls
        ↓
Generate JSON report → tests/e2e/ai-test-report.json
```

### npm scripts
```bash
npm test              # Full unit + functional tests (Vitest)
npm run test:ai       # AI-driven E2E (requires DEEPSEEK_API_KEY)
npm run test:e2e      # Playwright Electron E2E (requires desktop environment)
npm run test:watch    # Watch mode
```

### Previous Fixes
- `api.ts` — `thinking` parameter sent only for DeepSeek
- `api.ts` — tool retry checks return value instead of relying on exceptions
- `api.ts` — `makeUsage` `||` → `??` to fix falsy trap
- `api.ts` — `stableStringify` skips undefined keys
- `App.tsx` — localStorage 500ms debounce
- `App.tsx` — file tree no longer excludes hidden files
- `ChatArea.tsx` — drag-and-drop file button disabled fix
- `tools.ts` — `edit_file` uses `replaceAll`
- `shell.ts` — `dist` filter regex refined
- `electron/main.ts` — LSP NaN protection + PowerShell path escaping
- `Sidebar.tsx` — group collapse persistence
