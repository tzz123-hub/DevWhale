import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
// import pkg from 'electron-updater'; // 暂未配置更新服务器
// const { autoUpdater } = pkg;
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;

const appIcon = path.join(__dirname, 'icon.ico');

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: appIcon,
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'devwhale',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

// File I/O
ipcMain.handle('fs:readFile', async (_e, fp: string) => {
  try {
    const stat = fs.statSync(fp);
    if (stat.size > MAX_FILE_BYTES) return { success: false, error: `文件过大 (${(stat.size/1024/1024).toFixed(1)}MB > 20MB)` };
    if (fp.toLowerCase().endsWith('.docx')) {
      const txt = extractDocxText(fp);
      if (txt) return { success: true, data: txt };
    }
    if (fp.toLowerCase().endsWith('.xlsx')) {
      const txt = extractXlsxText(fp);
      if (txt) return { success: true, data: txt };
    }
    return { success: true, data: fs.readFileSync(fp, 'utf-8') };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});
ipcMain.handle('fs:writeFile', async (_e, fp: string, content: string) => {
  try {
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, content, 'utf-8');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
});
ipcMain.handle('fs:exists', async (_e, fp: string) => fs.existsSync(fp));

// Shell exec
ipcMain.handle('shell:exec', async (_e, command: string, args: string[], options?: { cwd?: string }) => {
  return new Promise((resolve) => {
    try {
      const platform = os.platform();
      let finalCommand = command;
      let finalArgs = [...args];
      if (platform === 'win32' && command !== 'powershell') {
        // Windows: 非 PowerShell 命令用 cmd.exe + chcp 65001 解决 GBK 乱码
        finalArgs = ['/d', '/c', 'chcp', '65001', '>nul', '&&', command, ...args];
        finalCommand = 'cmd.exe';
      } else if (platform === 'win32' && command === 'powershell') {
        // PowerShell: 强制 UTF-8 输出
        finalArgs = ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + args.slice(2).join(' ')];
        finalCommand = 'powershell';
        args = []; // 避免重复使用
      } else if (command !== 'bash' && command !== 'sh') {
        finalArgs = ['-lc', [command, ...args].join(' ')];
        finalCommand = 'bash';
      }
      const useShell = finalCommand !== 'powershell'; // PowerShell 直接 spawn，不走 shell 避免编码被 cmd.exe 覆盖
      const child = spawn(finalCommand, finalArgs.length ? finalArgs : args, {
        cwd: options?.cwd || process.cwd(),
        shell: useShell,
        env: { ...process.env, LANG: 'en_US.UTF-8' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout!.on('data', (d: any) => { stdout += d.toString('utf8'); });
      child.stderr!.on('data', (d: any) => { stderr += d.toString('utf8'); });
      child.on('close', (code: number | null) => {
        if (code === 0) resolve({ success: true, data: stdout });
        else resolve({ success: false, error: stderr || 'exit ' + code, data: stdout });
      });
      child.on('error', (err: Error) => resolve({ success: false, error: err.message }));
    } catch (e: any) { resolve({ success: false, error: e.message }); }
  });
});

// Streaming shell
ipcMain.on('shell:execStreaming', (event, requestId: string, command: string, args: string[], options?: { cwd?: string }) => {
  try {
    const platform = os.platform();
    let finalCommand = command;
    let finalArgs = [...args];
    if (platform === 'win32' && command !== 'powershell') {
      // Windows: 非 PowerShell 命令用 cmd.exe + chcp 65001
      finalArgs = ['/d', '/c', 'chcp', '65001', '>nul', '&&', command, ...args];
      finalCommand = 'cmd.exe';
    } else if (platform === 'win32' && command === 'powershell') {
      // PowerShell: 强制 UTF-8 输出，直接 spawn 不经过 shell
      finalArgs = ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + args.slice(2).join(' ')];
      finalCommand = 'powershell';
      args = [];
    } else if (command !== 'bash' && command !== 'sh') {
      finalArgs = ['-lc', [command, ...args].join(' ')];
      finalCommand = 'bash';
    }
    const useShell = finalCommand !== 'powershell';
    const child = spawn(finalCommand, finalArgs.length ? finalArgs : args, {
      cwd: options?.cwd || process.cwd(),
      shell: useShell,
      env: { ...process.env, LANG: 'en_US.UTF-8' },
    });
    child.stdout.on('data', (d: any) => event.sender.send('shell:stream:' + requestId, { type: 'stdout', data: d.toString('utf8') }));
    child.stderr.on('data', (d: any) => event.sender.send('shell:stream:' + requestId, { type: 'stderr', data: d.toString('utf8') }));
    child.on('close', (code: number | null) => event.sender.send('shell:stream:' + requestId, { type: 'close', code }));
    child.on('error', (err: Error) => event.sender.send('shell:stream:' + requestId, { type: 'error', message: err.message }));
  } catch (e: any) { event.sender.send('shell:stream:' + requestId, { type: 'error', message: e.message }); }
});

// LSP management
interface LspSession {
  process: ReturnType<typeof spawn>;
  serverId: string;
  requestId: number;
  pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>;
  diagnostics: Map<string, Array<{ line: number; column: number; message: string; severity: string }>>;
}
const lspSessions = new Map<string, LspSession>();

ipcMain.handle('lsp:start', async (_e, language: string, command: string, args: string[], projectPath: string) => {
  try {
    // Resolve bundled LSP servers
    let finalCommand = command;
    let finalArgs = [...args];

    if (language === 'python') {
      // Use bundled pyright (no system Python required)
      try {
        const pyrightPath = require.resolve('pyright/dist/pyright-langserver');
        finalCommand = 'node';
        finalArgs = [pyrightPath, '--stdio'];
      } catch { /* fallback to system PATH */ }
    } else if (language === 'rust') {
      // Try rust-analyzer from PATH, fallback gracefully
      try {
        const { execSync } = await import('child_process');
        execSync('rust-analyzer --version', { stdio: 'ignore' });
      } catch {
        return { error: 'rust-analyzer 未安装。安装 Rust 工具链：https://rustup.rs' };
      }
    }

    const serverId = 'lsp-' + language + '-' + Date.now();
    const child = spawn(finalCommand, finalArgs, {
      cwd: projectPath || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    child.on('error', (err) => {
      console.error('LSP spawn error:', err.message);
      lspSessions.delete(serverId);
    });
    const session: LspSession = { process: child, serverId, requestId: 1, pending: new Map(), diagnostics: new Map() };
    let buffer = '';
    child.stdout!.on('data', (d: any) => {
      buffer += d.toString();
      while (true) {
        const hdrEnd = buffer.indexOf('\r\n\r\n');
        if (hdrEnd === -1) break;
        const hdr = buffer.slice(0, hdrEnd);
        const cl = hdr.match(/Content-Length: (\d+)/i);
        if (!cl) { buffer = ''; break; }
        const len = parseInt(cl[1]);
        if (isNaN(len) || len < 0) { buffer = ''; break; }
        const bodyStart = hdrEnd + 4;
        if (buffer.length < bodyStart + len) break;
        const body = buffer.slice(bodyStart, bodyStart + len);
        buffer = buffer.slice(bodyStart + len);
        try {
          const msg = JSON.parse(body);
          if (msg.id && session.pending.has(msg.id)) {
            const { resolve, reject } = session.pending.get(msg.id)!;
            session.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || 'LSP error'));
            else resolve(msg.result);
          } else if (msg.method === 'textDocument/publishDiagnostics') {
            const uri = msg.params?.uri || '';
            session.diagnostics.set(uri, (msg.params?.diagnostics || []).map((d: any) => ({
              line: (d.range?.start?.line || 0) + 1,
              column: (d.range?.start?.character || 0) + 1,
              message: d.message || '',
              severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info',
            })));
          }
        } catch {}
      }
    });
    child.on('close', () => lspSessions.delete(serverId));
    lspSessions.set(serverId, session);
    const initResult = await lspSend(session, 'initialize', {
      processId: process.pid,
      rootUri: 'file:///' + projectPath.replace(/\\/g, '/'),
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: true },
          synchronization: { didSave: true },
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
        },
      },
    });
    lspNotify(session, 'initialized', {});
    return { serverId, capabilities: initResult?.capabilities || {} };
  } catch (e: any) { return { error: e.message }; }
});
ipcMain.handle('lsp:request', async (_e, serverId: string, method: string, params: any) => {
  const s = lspSessions.get(serverId);
  if (!s) return { error: 'not found' };
  try { return { result: await lspSend(s, method, params) }; }
  catch (e: any) { return { error: e.message }; }
});
ipcMain.handle('lsp:diagnostics', async (_e, serverId: string, filePath: string) => {
  const s = lspSessions.get(serverId);
  if (!s) return [];
  return s.diagnostics.get('file:///' + filePath.replace(/\\/g, '/')) || [];
});
ipcMain.handle('lsp:stop', async (_e, serverId: string) => {
  const s = lspSessions.get(serverId);
  if (s) { lspNotify(s, 'shutdown', {}); s.process.kill(); lspSessions.delete(serverId); }
});

function lspSend(session: LspSession, method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = session.requestId++;
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const header = 'Content-Length: ' + Buffer.byteLength(msg, 'utf-8') + '\r\n\r\n';
    session.pending.set(id, { resolve, reject });
    session.process.stdin!.write(header + msg);
    setTimeout(() => { if (session.pending.has(id)) { session.pending.delete(id); reject(new Error('timeout')); } }, 10000);
  });
}
function lspNotify(session: LspSession, method: string, params: any) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  session.process.stdin!.write('Content-Length: ' + Buffer.byteLength(msg, 'utf-8') + '\r\n\r\n' + msg);
}

// ── MCP (Model Context Protocol) ──────────────────────────────────

interface McpSession {
  process: ReturnType<typeof spawn>;
  serverId: string;
  requestId: number;
  pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>;
  tools: Array<{ name: string; description: string; inputSchema: Record<string, any> }>;
}
const mcpSessions = new Map<string, McpSession>();

ipcMain.handle('mcp:start', async (_e, command: string, args: string[], cwd?: string) => {
  const t0 = Date.now();
  const step = (msg: string) => `[+${Date.now() - t0}ms] ${msg}`;
  const steps: string[] = [step('mcp:start 开始')];
  let child: ReturnType<typeof spawn> | null = null;

  try {
    const serverId = 'mcp-' + t0;
    const isWin = os.platform() === 'win32';
    const finalCmd = isWin ? 'cmd.exe' : command;
    const finalArgs = isWin ? ['/d', '/c', command, ...args] : args;

    steps.push(step(`spawn: ${finalCmd} ${finalArgs.join(' ')}`));
    child = spawn(finalCmd, finalArgs, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      windowsHide: true,
    });

    if (!child || !child.pid) {
      return { error: steps.join('\n') + '\n[致命] spawn 返回空或 pid 不存在' };
    }
    steps.push(step(`spawn 成功, pid=${child.pid}`));

    // 检查进程是否立即退出，退出时通知渲染进程
    let exitedEarly = false;
    child.on('close', (code) => {
      if (!exitedEarly) steps.push(step(`进程退出, code=${code}`));
      mcpSessions.delete(serverId);
      // 通知渲染进程服务器已崩溃/退出
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mcp:crashed', serverId);
      }
    });
    child.on('error', (err) => {
      steps.push(step(`spawn error: ${err.message}`));
      mcpSessions.delete(serverId);
    });

    // 收集 stderr 和 stdout 原始数据
    let stderrLog = '';
    let stdoutRaw = '';
    let stdoutFrames = 0;
    child.stderr!.on('data', (d: any) => {
      const text = d.toString();
      stderrLog += text;
      if (stderrLog.length < 600) steps.push(step(`stderr(${d.length}B): ${text.trim().slice(0, 150)}`));
    });
    child.stdout!.on('data', (d: any) => {
      stdoutRaw += d.toString();
      if (stdoutRaw.length < 300) steps.push(step(`stdout raw(${d.length}B): ${d.toString().trim().slice(0, 120)}`));
    });

    // 等待 stderr 中的就绪信号或超时（替代固定 2s 等待）
    steps.push(step('等待 stderr 就绪信号...'));
    const serverReady = new Promise<void>((resolve) => {
      const check = () => {
        if (stderrLog.includes('running on stdio')) {
          resolve();
        }
      };
      // 每次收到 stderr 数据时检查
      child!.stderr!.on('data', check);
      // 也检查已收到的数据
      check();
      if (stderrLog.includes('running on stdio')) resolve();
    });
    const timeout30s = new Promise<void>((resolve) => setTimeout(() => resolve(), 30000));
    const procExit = new Promise<void>((resolve) => {
      child!.on('close', () => { exitedEarly = true; resolve(); });
    });

    await Promise.race([serverReady, timeout30s, procExit]);

    if (exitedEarly) {
      return { error: steps.join('\n') + '\n[stderr] ' + stderrLog.slice(-400) };
    }
    steps.push(step(`进程存活确认, stderr 已收 ${stderrLog.length}B, stdout ${stdoutRaw.length}B`));

    const session: McpSession = {
      process: child, serverId, requestId: 1, pending: new Map(), tools: [],
    };
    mcpSessions.set(serverId, session);

    // 设置 stdout NDJSON 行解析器
    let buffer = '';
    child.stdout!.on('data', (d: any) => {
      buffer += d.toString();
      while (true) {
        const nl = buffer.indexOf('\n');
        if (nl === -1) break;
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line) continue; // 跳过空行
        stdoutFrames++;
        try {
          const msg = JSON.parse(line);
          if (msg.id != null && session.pending.has(msg.id)) {
            const { resolve, reject } = session.pending.get(msg.id)!;
            session.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || 'MCP error'));
            else resolve(msg.result);
          }
        } catch {}
      }
    });

    // MCP 初始化握手
    steps.push(step('发送 initialize...'));
    try {
      const initResult = await mcpSend(session, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'devwhale', version: '0.2.0' },
      });
      steps.push(step(`initialize 成功, 收到 ${stdoutFrames} 帧`));
      mcpNotify(session, 'notifications/initialized', {});

      const toolsResult = await mcpSend(session, 'tools/list', {});
      session.tools = toolsResult?.tools || [];
      steps.push(step(`tools/list 成功, ${session.tools.length} 个工具`));

      return { serverId, tools: session.tools };
    } catch (innerErr: any) {
      steps.push(step(`握手失败: ${innerErr.message}`));
      try { child.kill(); } catch {}
      mcpSessions.delete(serverId);
      const diag = [
        ...steps,
        `[stdout 原始 ${stdoutRaw.length}B] ${stdoutRaw.slice(-200)}`,
        `[stderr ${stderrLog.length}B] ${stderrLog.slice(-400)}`,
      ].join('\n');
      return { error: diag };
    }
  } catch (e: any) {
    steps.push(step(`异常: ${e.message}`));
    if (child) { try { child.kill(); } catch {} }
    return { error: steps.join('\n') };
  }
});

ipcMain.handle('mcp:request', async (_e, serverId: string, method: string, params: any) => {
  const s = mcpSessions.get(serverId);
  if (!s) return { error: 'MCP session not found' };
  try { return { result: await mcpSend(s, method, params) }; }
  catch (e: any) { return { error: e.message }; }
});

ipcMain.handle('mcp:stop', async (_e, serverId: string) => {
  const s = mcpSessions.get(serverId);
  if (s) { s.process.kill(); mcpSessions.delete(serverId); }
});

function mcpSend(session: McpSession, method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = session.requestId++;
    // MCP SDK (2025+) 使用 NDJSON（换行分隔 JSON），不再使用 Content-Length 头
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    session.pending.set(id, { resolve, reject });
    session.process.stdin!.write(msg);
    setTimeout(() => {
      if (session.pending.has(id)) { session.pending.delete(id); reject(new Error('MCP 超时（60s）')); }
    }, 60000);
  });
}

function mcpNotify(session: McpSession, method: string, params: any) {
  // 通知消息同样使用 NDJSON 格式（MCP 协议不要求通知有响应）
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  session.process.stdin!.write(msg);
}

// Debugger
interface DebugSession {
  process: ReturnType<typeof spawn>;
  debugId: string;
  ws: WebSocket | null;
}
const debugSessions = new Map<string, DebugSession>();

ipcMain.handle('debug:start', async (event, debugId: string, scriptPath: string, cwd: string) => {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--inspect-brk=0', scriptPath], {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let wsUrl = '';
    let started = false;
    let stderrBuf = '';
    child.stderr!.on('data', (d: any) => {
      const text = d.toString();
      stderrBuf += text;
      // 累积 stderr 防止 WebSocket URL 跨多次 data 事件
      const match = stderrBuf.match(/ws:\/\/[^\s]+/);
      if (match && !started) { wsUrl = match[0]; connect(); }
      event.sender.send('debug:event', { debugId, type: 'output', text });
    });
    child.stdout.on('data', (d: any) => event.sender.send('debug:event', { debugId, type: 'output', text: d.toString() }));
    child.on('close', () => { event.sender.send('debug:event', { debugId, type: 'end' }); debugSessions.delete(debugId); });
    async function connect() {
      started = true;
      try {
        const ws = new WebSocket(wsUrl);
        const session: DebugSession = { process: child, debugId, ws };
        debugSessions.set(debugId, session);
        ws.on('open', () => {
          debugCmd(session, 'Runtime.enable');
          debugCmd(session, 'Debugger.enable');
          resolve({ success: true });
        });
        ws.on('message', (raw: any) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.method === 'Debugger.paused') {
              const frames = msg.params?.callFrames || [];
              const top = frames[0];
              event.sender.send('debug:event', {
                debugId, type: 'paused',
                file: top?.url || '',
                line: (top?.location?.lineNumber || 0) + 1,
                callStack: frames.map((f: any) => ({
                  name: f.functionName || '(anonymous)',
                  file: f.url || '',
                  line: (f.location?.lineNumber || 0) + 1,
                  column: f.location?.columnNumber || 0,
                })),
              });
            } else if (msg.method === 'Debugger.resumed') {
              event.sender.send('debug:event', { debugId, type: 'resumed' });
            }
          } catch {}
        });
        ws.on('error', (err: Error) => reject(err));
      } catch (e: any) { reject(e); }
    }
    setTimeout(() => { if (!started) { reject(new Error('timeout')); child.kill(); } }, 5000);
  });
});
ipcMain.handle('debug:setBreakpoint', async (_e, debugId: string, file: string, line: number) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.setBreakpointByUrl', { lineNumber: line - 1, url: file });
});
ipcMain.handle('debug:removeBreakpoint', async (_e, debugId: string, file: string, line: number) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.removeBreakpoint', { lineNumber: line - 1, url: file });
});
ipcMain.handle('debug:continue', async (_e, debugId: string) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.resume');
});
ipcMain.handle('debug:stepOver', async (_e, debugId: string) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.stepOver');
});
ipcMain.handle('debug:stepInto', async (_e, debugId: string) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.stepInto');
});
ipcMain.handle('debug:stepOut', async (_e, debugId: string) => {
  const s = debugSessions.get(debugId);
  if (s?.ws) debugCmd(s, 'Debugger.stepOut');
});
ipcMain.handle('debug:stop', async (_e, debugId: string) => {
  const s = debugSessions.get(debugId);
  if (s) { s.ws?.close(); s.process.kill(); debugSessions.delete(debugId); }
});

function debugCmd(session: DebugSession, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!session.ws) { reject(new Error('Debugger WebSocket not connected')); return; }
    const id = Math.random().toString(36).slice(2);
    session.ws.send(JSON.stringify({ id, method, params }));
    const handler = (raw: any) => {
      try { const msg = JSON.parse(raw.toString()); if (msg.id === id) { session.ws?.removeListener('message', handler); resolve(msg.result); } } catch {}
    };
    session.ws.on('message', handler);
    setTimeout(() => { session.ws?.removeListener('message', handler); reject(new Error('timeout')); }, 5000);
  });
}

// Dialog
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'], title: 'Select Folder' });
  return r.canceled ? null : r.filePaths[0] || null;
});
ipcMain.handle('dialog:openFiles', async (_e, filterType?: 'image' | 'code' | 'all') => {
  const imageExts = ['png','jpg','jpeg','gif','webp','svg','bmp','ico','tiff','heic'];
  const codeExts = [
    // 开发
    'ts','tsx','js','jsx','css','scss','less','html','htm','json','jsonc','xml','sql',
    'rs','py','go','java','c','cpp','h','hpp','rb','php','swift','kt','cs','sh','bat','ps1',
    'toml','yml','yaml','ini','cfg','conf','env','gitignore','dockerfile','lock',
    // 文档
    'md','mdx','txt','log','csv','tsv','rtf',
    'pdf','docx','doc','xlsx','xls','pptx','ppt',
  ];
  let filters: Electron.FileFilter[];
  if (filterType === 'image') {
    filters = [{ name: '图片', extensions: imageExts }];
  } else if (filterType === 'code') {
    filters = [{ name: '代码 & 文档', extensions: codeExts }, { name: '所有文件', extensions: ['*'] }];
  } else {
    filters = [
      { name: '图片 & 代码', extensions: [...imageExts, ...codeExts] },
      { name: '所有文件', extensions: ['*'] },
    ];
  }
  const r = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    title: filterType === 'image' ? '选择图片' : filterType === 'code' ? '选择文件' : '选择文件',
    filters,
  });
  if (r.canceled || r.filePaths.length === 0) return null;
  return r.filePaths;
});
// Binary file read (for images)
ipcMain.handle('fs:readBinaryFile', async (_e, fp: string) => {
  try {
    const stat = fs.statSync(fp);
    if (stat.size > MAX_FILE_BYTES) return { success: false, error: `图片过大 (${(stat.size/1024/1024).toFixed(1)}MB > 20MB)` };
    return { success: true, data: fs.readFileSync(fp).toString('base64') };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});
// App info
ipcMain.handle('app:getDocumentDir', () => app.getPath('documents'));
ipcMain.handle('app:getPlatform', () => os.platform());
ipcMain.handle('app:checkUpdate', async () => {
  // autoUpdater 暂未配置
  return { updateAvailable: false };
});

/** 解压 .docx 并提取 word/document.xml 的纯文本 */
function extractDocxText(filePath: string): string | null {
  try {
    const { execSync } = require('child_process');
    const platform = os.platform();
    let xml = '';
    if (platform === 'win32') {
      const safePath = filePath.replace(/'/g, "''").replace(/[\x00-\x1f\x7f]/g, '');
      const psScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${safePath}'); $entry = $zip.GetEntry('word/document.xml'); if ($entry) { $stream = $entry.Open(); $reader = New-Object System.IO.StreamReader($stream); $reader.ReadToEnd(); $reader.Close() }; $zip.Dispose()`;
      xml = execSync(`powershell -NoProfile -Command "${psScript}"`, { encoding: 'utf-8', timeout: 10000 });
    } else {
      // macOS/Linux: Python zipfile（系统自带）
      const pyScript = `
import zipfile, sys
try:
    with zipfile.ZipFile('${filePath.replace(/'/g, "'\\''")}') as z:
        print(z.read('word/document.xml').decode('utf-8'))
except: pass
      `;
      xml = execSync(`python3 -c "${pyScript.replace(/"/g, '\\"')}"`, { encoding: 'utf-8', timeout: 10000 });
    }
    if (!xml) return null;
    // 去除 XML 标签，保留纯文本
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return null;
  }
}

/** 解压 .xlsx 并提取工作表纯文本 */
function extractXlsxText(filePath: string): string | null {
  try {
    const { execSync } = require('child_process');
    const platform = os.platform();
    let output = '';
    if (platform === 'win32') {
      const safePath = filePath.replace(/'/g, "''").replace(/[\x00-\x1f\x7f]/g, '');
      const psScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${safePath}'); function RE($n) { $e=$zip.GetEntry($n); if($e){$s=$e.Open();$r=New-Object System.IO.StreamReader($s);$t=$r.ReadToEnd();$r.Close();return $t} return '' }; $ss = RE('xl/sharedStrings.xml'); $sh = RE('xl/worksheets/sheet1.xml'); $zip.Dispose(); Write-Output \"STRINGS:$ss\"; Write-Output \"SHEET:$sh\"`;
      output = execSync(`powershell -NoProfile -Command "${psScript}"`, { encoding: 'utf-8', timeout: 10000 });
    } else {
      const pyScript = `
import zipfile, sys
try:
    with zipfile.ZipFile('${filePath.replace(/'/g, "'\\''")}') as z:
        ss = z.read('xl/sharedStrings.xml').decode('utf-8', errors='replace')
        sh = z.read('xl/worksheets/sheet1.xml').decode('utf-8', errors='replace')
        print('STRINGS:' + ss[:50000])
        print('SHEET:' + sh[:50000])
except: pass
      `;
      output = execSync(`python3 -c "${pyScript.replace(/"/g, '\\"')}"`, { encoding: 'utf-8', timeout: 10000 });
    }
    if (!output) return null;
    // 解析 shared strings
    const ssMatch = output.match(/STRINGS:([\s\S]*?)(?=\nSHEET:|$)/);
    const sheetMatch = output.match(/SHEET:([\s\S]*)/);
    const sharedStrings = ssMatch ? ssMatch[1] : '';
    const sheetXml = sheetMatch ? sheetMatch[1] : '';
    // 提取 shared string 列表
    const siList = [...sharedStrings.matchAll(/<si[^>]*>[\s\S]*?<\/si>/g)].map(m => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    // 替换 sheet 中的 shared string 引用
    let text = sheetXml;
    text = text.replace(/<c[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g, (_, idx) => {
      const i = parseInt(idx);
      return i < siList.length ? siList[i] : `[${idx}]`;
    });
    // 同时处理 inline strings
    text = text.replace(/<is>[\s\S]*?<\/is>/g, m => m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    // 去除所有 XML 标签
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text || null;
  } catch {
    return null;
  }
}

// Lifecycle
app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // 隐藏默认菜单栏
  createWindow();
  // autoUpdater 暂未配置更新服务器
  // autoUpdater.autoDownload = true;
  // autoUpdater.autoInstallOnAppQuit = true;
  // autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
