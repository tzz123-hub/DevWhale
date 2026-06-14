/**
 * 全局 ElectronAPI 类型声明，替代各处 (window as any).electronAPI
 */

interface ElectronAPI {
  // 文件系统
  readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  fileExists: (path: string) => Promise<boolean>;
  readBinaryFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;

  // Shell
  execCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
  execStreaming: (requestId: string, command: string, args: string[], options?: { cwd?: string }) => void;
  onStreamData: (requestId: string, callback: (data: { type: string; data?: string; code?: number; message?: string }) => void) => () => void;

  // 对话框
  openFolderDialog: () => Promise<string | null>;
  openFileDialog: (filterType?: string) => Promise<string[] | null>;

  // 应用信息
  getDocumentDir: () => Promise<string>;
  getPlatform: () => Promise<string>;
  checkUpdate: () => Promise<{ updateAvailable: boolean }>;

  // LSP
  startLsp: (language: string, command: string, args: string[], projectPath: string) => Promise<{ serverId?: string; capabilities?: Record<string, unknown>; error?: string }>;
  lspRequest: (serverId: string, method: string, params: Record<string, unknown>) => Promise<unknown>;
  lspDiagnostics: (serverId: string, filePath: string) => Promise<Array<{ line: number; column: number; message: string; severity: string }>>;
  stopLsp: (serverId: string) => Promise<void>;

  // 调试器
  startDebug: (debugId: string, scriptPath: string, cwd: string) => Promise<{ success: boolean }>;
  debugSetBreakpoint: (debugId: string, file: string, line: number) => Promise<void>;
  debugRemoveBreakpoint: (debugId: string, file: string, line: number) => Promise<void>;
  debugContinue: (debugId: string) => Promise<void>;
  debugStepOver: (debugId: string) => Promise<void>;
  debugStepInto: (debugId: string) => Promise<void>;
  debugStepOut: (debugId: string) => Promise<void>;
  stopDebug: (debugId: string) => Promise<void>;
  onDebugEvent: (callback: (event: Record<string, unknown>) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
