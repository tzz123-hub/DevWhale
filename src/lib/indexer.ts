/**
 * 全局语义索引 —— 解析 import/export 依赖图 + 符号表
 * 输出结构化 Markdown 注入 system prompt
 * 跨平台：Windows (PowerShell) / macOS & Linux (bash + grep)
 */
import { execCommand, listFilesRecursive, getPlatform } from './shell';
import { isTauri } from './tauriFs';

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'const' | 'type' | 'export';
  file: string;
  line: number;
}

export interface DepEdge {
  from: string;
  to: string;
  names: string[];
}

export interface FileIndex {
  tree: string[];
  symbols: SymbolInfo[];
  deps: DepEdge[];
}

let cachedIndex: FileIndex | null = null;
let cacheTime = 0;
let cacheProjectPath = '';
const CACHE_TTL = 300_000;

export function setProjectPath(p: string) {
  if (cacheProjectPath !== p) {
    cachedIndex = null;
    cacheProjectPath = p;
  }
}

export async function buildProjectIndex(projectPath: string): Promise<string> {
  const now = Date.now();
  if (cachedIndex && cacheProjectPath === projectPath && now - cacheTime < CACHE_TTL) {
    return formatIndex(cachedIndex);
  }
  setProjectPath(projectPath);

  if (isTauri()) {
    try {
      cachedIndex = await buildTauriIndex(projectPath);
      cacheTime = now;
      return formatIndex(cachedIndex);
    } catch (e) { console.warn('索引生成失败:', e); }
  }
  cachedIndex = buildFallbackIndex();
  cacheTime = now;
  return formatIndex(cachedIndex);
}

/** PowerShell 字符串转义 */
function esc(s: string): string {
  return s.replace(/'/g, "''");
}

async function buildTauriIndex(root: string): Promise<FileIndex> {
  const pRoot = root.replace(/\\/g, '/');
  const platform = await getPlatform();
  const srcDir = pRoot + '/src';

  // 1. 文件树
  let tree: string[] = [];
  try {
    const treeOut = await listFilesRecursive(srcDir);
    tree = treeOut.split('\n').map(l => l.trim()).filter(l => l).sort();
  } catch {}

  // 2. 符号提取
  let symbols: SymbolInfo[] = [];
  try {
    if (platform === 'windows') {
      // PowerShell: 列出 .ts/.tsx 文件，grep export/function/class/interface/type/const 声明
      const cmd =
        "Get-ChildItem -Path '" + esc(srcDir) + "' -Recurse -Include *.ts,*.tsx -File -ErrorAction SilentlyContinue |" +
        " Where-Object { " + '$_.FullName' + " -notmatch 'node_modules|target|\\.git|dist' } |" +
        " ForEach-Object { " +
          "$f=" + '$_.FullName' + ".Replace('" + esc(pRoot) + "/','').Replace('\\','/');" +
          " Select-String -Path " + '$_.FullName' + " -Pattern '^(export )?(async )?(function|class|interface|type|const) \\w+' |" +
          " ForEach-Object { " + '"$f' + "`t$(" + '$_.Line.Trim()' + ")`t$(" + '$_.LineNumber' + ')" }' +
        " }";
      const symOut = await execCommand('powershell', ['-NoProfile', '-Command', cmd]);
      for (const raw of symOut.split('\n')) {
        const parts = raw.trim().split('\t');
        if (parts.length < 3) continue;
        const [file, code, lineStr] = parts;
        const kind: SymbolInfo['kind'] =
          code.includes('function') ? 'function' : code.includes('class') ? 'class' :
          code.includes('interface') ? 'interface' : code.includes('type') ? 'type' :
          code.includes('const') ? 'const' : 'export';
        const nm = code.match(/(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const)\s+(\w+)/);
        if (nm) symbols.push({ name: nm[1], kind, file, line: parseInt(lineStr) || 0 });
      }
    } else {
      // macOS/Linux: grep
      const grepCmd =
        "cd '" + esc(srcDir).replace(/'/g, "'\\''") + "' &&" +
        " grep -rn '^\\(export \\)\\?\\(async \\)\\?\\(function\\|class\\|interface\\|type\\|const\\) [A-Z]'" +
        " --include='*.ts' --include='*.tsx' . 2>/dev/null | head -100";
      const grepOut = await execCommand('bash', ['-lc', grepCmd]);
      for (const line of grepOut.split('\n')) {
        const m = line.match(/^\.\/(.+):(\d+):(.+)$/);
        if (!m) continue;
        const [, file, lineStr, code] = m;
        const kind: SymbolInfo['kind'] =
          code.includes('function') ? 'function' : code.includes('class') ? 'class' :
          code.includes('interface') ? 'interface' : code.includes('type') ? 'type' :
          code.includes('const') ? 'const' : 'export';
        const nm = code.match(/(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const)\s+(\w+)/);
        if (nm) symbols.push({ name: nm[1], kind, file, line: parseInt(lineStr) || 0 });
      }
    }
  } catch {}

  // 3. 依赖提取
  let deps: DepEdge[] = [];
  try {
    if (platform === 'windows') {
      const cmd =
        "Get-ChildItem -Path '" + esc(srcDir) + "' -Recurse -Include *.ts,*.tsx -File -ErrorAction SilentlyContinue |" +
        " Where-Object { " + '$_.FullName' + " -notmatch 'node_modules|target|\\.git|dist' } |" +
        " ForEach-Object { " +
          "$f=" + '$_.FullName' + ".Replace('" + esc(pRoot) + "/','').Replace('\\','/');" +
          " Select-String -Path " + '$_.FullName' + " -Pattern \"from\\s+'([^']+)'\" -AllMatches |" +
          " ForEach-Object { foreach ($m in " + '$_.Matches' + ') { $dep=$m.Groups[1].Value; if ($dep -match ' + "'^\\\\.'" + ') { Write-Output "$f`t$dep" } } }' +
        " }";
      const depOut = await execCommand('powershell', ['-NoProfile', '-Command', cmd]);
      for (const raw of depOut.split('\n')) {
        const parts = raw.trim().split('\t');
        if (parts.length >= 2 && parts[1]?.startsWith('.')) {
          deps.push({ from: parts[0], to: parts[1], names: [] });
        }
      }
    } else {
      const grepCmd =
        "cd '" + esc(srcDir).replace(/'/g, "'\\''") + "' &&" +
        " grep -rn \"from '\\\\\\\\.\" --include='*.ts' --include='*.tsx' . 2>/dev/null | head -50";
      const depOut = await execCommand('bash', ['-lc', grepCmd]);
      for (const line of depOut.split('\n')) {
        const m = line.match(/^\.\/(.+):\d+:.*from\s+'([^']+)'/);
        if (m) deps.push({ from: m[1], to: m[2], names: [] });
      }
    }
  } catch {}

  return { tree, symbols, deps };
}

function buildFallbackIndex(): FileIndex {
  return {
    tree: ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/ChatArea.tsx', 'src/lib/api.ts', 'src/lib/tools.ts', 'src/lib/indexer.ts', 'src/types/chat.ts'],
    symbols: [
      { name: 'App', kind: 'function', file: 'src/App.tsx', line: 65 },
      { name: 'Sidebar', kind: 'function', file: 'src/components/Sidebar.tsx', line: 1 },
      { name: 'agentChat', kind: 'function', file: 'src/lib/api.ts', line: 248 },
      { name: 'executeToolCall', kind: 'function', file: 'src/lib/tools.ts', line: 149 },
    ],
    deps: [
      { from: 'src/App.tsx', to: './components/Sidebar', names: ['Sidebar'] },
      { from: 'src/App.tsx', to: './components/ChatArea', names: ['ChatArea'] },
      { from: 'src/App.tsx', to: './lib/api', names: ['agentChat'] },
      { from: 'src/App.tsx', to: './lib/tools', names: ['executeToolCall'] },
      { from: 'src/lib/api.ts', to: './storage', names: ['loadRulesMemory', 'loadProvider'] },
    ],
  };
}

function formatIndex(idx: FileIndex): string {
  const lines: string[] = [];
  lines.push('## 项目文件结构');
  lines.push('```');
  for (const f of idx.tree) lines.push('  📄 ' + f);
  lines.push('```');

  if (idx.symbols.length > 0) {
    lines.push('');
    lines.push('## 关键符号索引');
    lines.push('| 类型 | 名称 | 文件 |');
    lines.push('|------|------|------|');
    for (const s of idx.symbols.slice(0, 40)) {
      const e = ({ function: '🔧', class: '🏗️', interface: '📐', type: '🏷️', const: '📌', export: '📤' } as any)[s.kind] || '•';
      lines.push('| ' + e + ' ' + s.kind + ' | ' + s.name + ' | ' + s.file + ':' + s.line + ' |');
    }
  }

  if (idx.deps.length > 0) {
    lines.push('');
    lines.push('## 文件依赖关系');
    for (const d of idx.deps.slice(0, 20)) {
      lines.push('- `' + d.from + '` → `' + d.to + '`');
    }
  }

  return lines.join('\n');
}
