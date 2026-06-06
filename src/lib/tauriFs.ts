/**
 * Electron 文件系统操作封装
 * 通过 IPC 调用主进程的 Node.js fs API
 */

interface ElectronAPI {
  readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  fileExists: (path: string) => Promise<boolean>;
  execCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
  openFolderDialog: () => Promise<string | null>;
  getDocumentDir: () => Promise<string>;
  getPlatform: () => Promise<string>;
}

function getAPI(): ElectronAPI | null {
  return (window as any).electronAPI || null;
}

export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

/** 兼容旧代码的 isTauri 别名 */
export function isTauri(): boolean {
  return isElectron();
}

export async function readTextFile(path: string): Promise<string> {
  const api = getAPI();
  if (!api) throw new Error('Electron 不可用（浏览器模式）');
  const result = await api.readFile(path);
  if (!result.success) throw new Error(result.error || '读取失败');
  return result.data || '';
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  const api = getAPI();
  if (!api) throw new Error('Electron 不可用（浏览器模式）');
  const result = await api.writeFile(path, content);
  if (!result.success) throw new Error(result.error || '写入失败');
}

export async function fileExists(path: string): Promise<boolean> {
  const api = getAPI();
  if (!api) return false;
  return api.fileExists(path);
}
