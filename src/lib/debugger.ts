/**
 * 调试器引擎 —— Node.js Inspector Protocol 客户端
 * 通过 Electron IPC 连接到 Node.js 的 V8 Inspector
 */

/* ====== 类型 ====== */

export interface DebugState {
  running: boolean;
  paused: boolean;
  breakpoints: { file: string; line: number }[];
  callStack: { name: string; file: string; line: number; column: number }[];
  variables: { name: string; value: string; type: string }[];
  currentFile: string;
  currentLine: number;
}

export interface DebugCallbacks {
  onStateChange: (state: DebugState) => void;
  onOutput: (text: string) => void;
}

/* ====== 调试器管理 ====== */

interface DebugSession {
  debugId: string;
  state: DebugState;
  callbacks: DebugCallbacks;
}

const sessions = new Map<string, DebugSession>();
let currentSessionId: string | null = null;

/**
 * 启动 Node.js 调试会话
 */
export async function startDebug(
  scriptPath: string,
  cwd: string,
  callbacks: DebugCallbacks
): Promise<string> {
  const api = (window as any).electronAPI;
  if (!api?.startDebug) throw new Error('调试器不可用');

  const debugId = `debug-${Date.now()}`;
  const state: DebugState = {
    running: true,
    paused: false,
    breakpoints: [],
    callStack: [],
    variables: [],
    currentFile: '',
    currentLine: 0,
  };

  sessions.set(debugId, { debugId, state, callbacks });
  currentSessionId = debugId;

  try {
    await api.startDebug(debugId, scriptPath, cwd);
    return debugId;
  } catch (e: any) {
    sessions.delete(debugId);
    currentSessionId = null;
    throw e;
  }
}

/**
 * 设置断点
 */
export async function setBreakpoint(file: string, line: number): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  // 避免重复
  if (session.state.breakpoints.some((bp) => bp.file === file && bp.line === line)) return;

  const api = (window as any).electronAPI;
  if (api?.debugSetBreakpoint) {
    await api.debugSetBreakpoint(session.debugId, file, line);
  }

  session.state.breakpoints.push({ file, line });
  session.callbacks.onStateChange({ ...session.state });
}

/**
 * 移除断点
 */
export async function removeBreakpoint(file: string, line: number): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.debugRemoveBreakpoint) {
    await api.debugRemoveBreakpoint(session.debugId, file, line);
  }

  session.state.breakpoints = session.state.breakpoints.filter(
    (bp) => !(bp.file === file && bp.line === line)
  );
  session.callbacks.onStateChange({ ...session.state });
}

/**
 * 继续执行
 */
export async function debugContinue(): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.debugContinue) {
    await api.debugContinue(session.debugId);
  }

  session.state.running = true;
  session.state.paused = false;
  session.callbacks.onStateChange({ ...session.state });
}

/**
 * 单步跳过
 */
export async function debugStepOver(): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.debugStepOver) {
    await api.debugStepOver(session.debugId);
  }
}

/**
 * 单步进入
 */
export async function debugStepInto(): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.debugStepInto) {
    await api.debugStepInto(session.debugId);
  }
}

/**
 * 单步跳出
 */
export async function debugStepOut(): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.debugStepOut) {
    await api.debugStepOut(session.debugId);
  }
}

/**
 * 停止调试
 */
export async function stopDebug(): Promise<void> {
  const session = getCurrentSession();
  if (!session) return;

  const api = (window as any).electronAPI;
  if (api?.stopDebug) {
    await api.stopDebug(session.debugId);
  }

  sessions.delete(session.debugId);
  currentSessionId = null;
}

/**
 * 监听调试器事件（由 Electron 主进程通过 IPC 推送）
 */
export function setupDebugListener(callbacks: DebugCallbacks): () => void {
  const api = (window as any).electronAPI;
  if (!api?.onDebugEvent) return () => {};

  const cleanup = api.onDebugEvent((event: any) => {
    const session = currentSessionId ? sessions.get(currentSessionId) : null;
    if (!session) return;

    switch (event.type) {
      case 'paused':
        session.state.paused = true;
        session.state.running = false;
        session.state.currentFile = event.file || '';
        session.state.currentLine = event.line || 0;
        session.state.callStack = event.callStack || [];
        session.callbacks.onStateChange({ ...session.state });
        break;

      case 'resumed':
        session.state.paused = false;
        session.state.running = true;
        session.callbacks.onStateChange({ ...session.state });
        break;

      case 'output':
        callbacks.onOutput(event.text || '');
        break;

      case 'variables':
        session.state.variables = event.variables || [];
        session.callbacks.onStateChange({ ...session.state });
        break;

      case 'end':
        sessions.delete(session.debugId);
        if (currentSessionId === session.debugId) currentSessionId = null;
        break;
    }
  });

  return cleanup;
}

function getCurrentSession(): DebugSession | null {
  return currentSessionId ? sessions.get(currentSessionId) || null : null;
}

export function getCurrentDebugState(): DebugState | null {
  const session = getCurrentSession();
  return session?.state || null;
}
