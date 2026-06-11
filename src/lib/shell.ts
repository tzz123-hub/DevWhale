/**
 * 跨平台 Shell 执行封装（Electron 版本）
 */

/* ====== 平台检测 ====== */

type Platform = 'windows' | 'macos' | 'linux';

let cachedPlatform: Platform | null = null;

async function detectPlatform(): Promise<Platform> {
  if (cachedPlatform) return cachedPlatform;
  const api = (window as any).electronAPI;
  if (api?.getPlatform) {
    const p = await api.getPlatform();
    if (p === 'win32') cachedPlatform = 'windows';
    else if (p === 'darwin') cachedPlatform = 'macos';
    else cachedPlatform = 'linux';
    return cachedPlatform;
  }
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) cachedPlatform = 'windows';
  else if (/Mac/i.test(ua)) cachedPlatform = 'macos';
  else cachedPlatform = 'linux';
  return cachedPlatform;
}

export async function getPlatform(): Promise<Platform> { return detectPlatform(); }
export async function isWindows(): Promise<boolean> { return (await detectPlatform()) === 'windows'; }
export async function isMacOS(): Promise<boolean> { return (await detectPlatform()) === 'macos'; }
export async function isLinux(): Promise<boolean> { return (await detectPlatform()) === 'linux'; }

/* ====== 主执行接口 ====== */

/**
 * execCommand 是 shell 执行的核心入口。
 *
 * 平台自适应逻辑（见 electron/main.ts shell:exec handler）：
 * - Windows：非 powershell 命令自动包装为 `powershell -NoProfile -Command <cmd> <args...>`
 * - macOS/Linux：非 bash/sh 命令自动包装为 `bash -lc "<cmd> <args...>"`
 *
 * ⚠️ 调用约定：
 * - 如果高层函数已经指定 `command: 'powershell'` 或 `command: 'bash'`，
 *   则不会触发二次包装（安全）
 * - 如果直接传 `command: 'git'` / `command: 'python'` 等原生命令，
 *   主进程会自动包装为对应的 shell 执行
 * - 不要在 args 中包含 shell 特义字符（如管道 |、重定向 >），
 *   这些应由调用方自己通过完整 shell 命令字符串处理
 */

function getAPI() {
  return (window as any).electronAPI;
}

export async function execCommand(
  command: string,
  args: string[] = [],
  cwd?: string
): Promise<string> {
  const api = getAPI();
  if (!api) throw new Error('Electron 不可用（浏览器模式）');

  const result = await api.execCommand(command, args, cwd ? { cwd } : undefined);
  if (!result.success) throw new Error(result.error || '命令执行失败');
  return result.data || '';
}

/* ====== 高级操作 ====== */

export async function listDirectory(dirPath: string): Promise<string> {
  const platform = await detectPlatform();
  if (platform === 'windows') {
    return execCommand('powershell', [
      '-NoProfile', '-Command',
      `Get-ChildItem -Path '${dirPath.replace(/'/g, "''")}' -Name | Where-Object { $_ -notmatch 'node_modules|target|\\.git|dist' }`
    ]);
  }
  return execCommand('bash', ['-lc',
    `ls -1 '${dirPath.replace(/'/g, "'\\''")}' 2>/dev/null | grep -v -E 'node_modules|target|\\.git|dist' || echo "(空目录)"`
  ]);
}

export async function listFilesRecursive(dirPath: string): Promise<string> {
  const platform = await detectPlatform();
  if (platform === 'windows') {
    return execCommand('powershell', [
      '-NoProfile', '-Command',
      `Get-ChildItem -Path '${dirPath.replace(/'/g, "''")}' -Recurse -File -Name -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch 'node_modules|target|\\.git|(^|/)dist(/|$)' } | ForEach-Object { $_ -replace '\\\\', '/' }`
    ]);
  }
  return execCommand('bash', ['-lc',
    `find '${dirPath.replace(/'/g, "'\\''")}' -type f 2>/dev/null | grep -v -E 'node_modules|target|\\.git|(^|/)dist(/|$)' | sed 's|${dirPath.replace(/'/g, "'\\''")}/||' | sort`
  ]);
}

export async function readFileContent(filePath: string): Promise<string> {
  const platform = await detectPlatform();
  if (platform === 'windows') {
    return execCommand('powershell', [
      '-NoProfile', '-Command',
      `Get-Content -Path '${filePath.replace(/'/g, "''")}' -Raw -ErrorAction SilentlyContinue`
    ]);
  }
  return execCommand('bash', ['-lc', `cat '${filePath.replace(/'/g, "'\\''")}' 2>/dev/null`]);
}

export async function writeFileContent(filePath: string, content: string): Promise<string> {
  const api = getAPI();
  if (api) {
    // 直接走 Electron IPC（支持路径创建）
    const result = await api.writeFile(filePath, content);
    if (!result.success) throw new Error(result.error || '写入失败');
    return `文件写入成功: ${filePath}`;
  }

  // 浏览器模式 fallback
  const platform = await detectPlatform();
  const parent = filePath.replace(/[/\\][^/\\]+$/, '');
  if (platform === 'windows') {
    // 用 Base64 编码避免 PowerShell 变量展开问题
    const b64 = btoa(unescape(encodeURIComponent(content)));
    await execCommand('powershell', [
      '-NoProfile', '-Command',
      `New-Item -ItemType Directory -Force -Path '${parent.replace(/'/g, "''")}'`
    ]).catch(() => {});
    await execCommand('powershell', [
      '-NoProfile', '-Command',
      `[IO.File]::WriteAllText('${filePath.replace(/'/g, "''")}', [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))`
    ]);
  } else {
    const escaped = content.replace(/'/g, "'\\''");
    await execCommand('bash', ['-lc',
      `mkdir -p '${parent.replace(/'/g, "'\\''")}' && printf '%s' '${escaped}' > '${filePath.replace(/'/g, "'\\''")}'`
    ]);
  }
  return `文件写入成功: ${filePath}`;
}

/* ====== 代码执行 ====== */

export function isRunnable(lang: string): boolean {
  return ['python', 'py', 'bash', 'sh', 'powershell', 'pwsh', 'shell', 'cmd', 'bat', 'node', 'js', 'ruby', 'rb'].includes(lang.toLowerCase());
}

export function getRunCommand(lang: string): { program: string; args: string[] } {
  switch (lang.toLowerCase()) {
    case 'python': case 'py': return { program: 'python', args: [] };
    case 'bash': case 'sh': case 'shell': return { program: 'bash', args: [] };
    case 'powershell': case 'pwsh': return { program: 'powershell', args: [] };
    case 'cmd': case 'bat': return { program: 'cmd', args: ['/c'] };
    case 'node': case 'js': return { program: 'node', args: [] };
    case 'ruby': case 'rb': return { program: 'ruby', args: [] };
    default: return { program: '', args: [] };
  }
}
