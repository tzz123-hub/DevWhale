/**
 * LSP（Language Server Protocol）管理器
 */
import './tauriFs';

/* ====== 类型 ====== */

export type LspLanguage = 'python' | 'rust' | 'go' | 'typescript';

/* ====== 可用服务器检测 ====== */

const LSP_SERVERS: Record<LspLanguage, { command: string; args: string[]; npmPackage?: string }> = {
  python: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    npmPackage: 'pyright',
  },
  rust: {
    command: 'rust-analyzer',
    args: [],
  },
  go: {
    command: 'gopls',
    args: [],
  },
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
  },
};

/** 检测系统上可用的 LSP 服务器 */
export async function detectAvailableLsps(): Promise<LspLanguage[]> {
  const available: LspLanguage[] = [];
  const api = (window as any).electronAPI;

  // Python: bundled pyright, always available
  available.push('python');

  if (!api) return available;

  // Rust: check if rust-analyzer is in PATH
  try {
    const result = await api.execCommand('rust-analyzer', ['--version'], {});
    if (result.success) available.push('rust');
  } catch {}
  // Go
  try {
    const result = await api.execCommand('gopls', [], {});
    if (result.success) available.push('go');
  } catch {}

  return available;
}

/** 在 Electron 主进程中启动 LSP 服务器 */
export async function startLspServer(
  language: LspLanguage,
  projectPath: string
): Promise<string | null> {
  const api = (window as any).electronAPI;
  if (!api?.startLsp) return null;

  const server = LSP_SERVERS[language];
  if (!server) return null;

  try {
    const result = await api.startLsp(language, server.command, server.args, projectPath);
    return result.serverId || null;
  } catch {
    return null;
  }
}

/** 向 LSP 服务器发送请求 */
export async function sendLspRequest(
  serverId: string,
  method: string,
  params: any
): Promise<any> {
  const api = (window as any).electronAPI;
  if (!api?.lspRequest) return null;

  try {
    return await api.lspRequest(serverId, method, params);
  } catch {
    return null;
  }
}

/** 停止 LSP 服务器 */
export async function stopLspServer(serverId: string): Promise<void> {
  const api = (window as any).electronAPI;
  if (api?.stopLsp) {
    await api.stopLsp(serverId);
  }
}

/** 获取 LSP 诊断信息 */
export async function getLspDiagnostics(
  serverId: string,
  filePath: string
): Promise<Array<{
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}>> {
  const api = (window as any).electronAPI;
  if (!api?.lspDiagnostics) return [];

  try {
    return await api.lspDiagnostics(serverId, filePath);
  } catch {
    return [];
  }
}

/** 可用的 LSP 语言列表（用于 UI） */
export const AVAILABLE_LSPS: { lang: LspLanguage; name: string; icon: string }[] = [
  { lang: 'python', name: 'Python', icon: '🐍' },
  { lang: 'rust', name: 'Rust', icon: '🦀' },
  { lang: 'go', name: 'Go', icon: '🔵' },
];
