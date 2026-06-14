/**
 * Tool 执行函数 —— Agent 调用这些工具来操作文件系统
 * 策略：读优先用 Electron IPC 文件 API，写/列表用跨平台 shell
 */
import { writeTextFile, readTextFile, isTauri } from './tauriFs';
import { execCommand, listDirectory, readFileContent, writeFileContent } from './shell';
import { createCheckpoint, setCheckpointProjectRoot } from './checkpoint';
import { callMcpTool, getAllMcpTools } from './mcp';

/** 当前项目根路径（由 App.tsx 动态设置） */
let currentProjectPath = '';

/** 全局终端输出回调（由 App.tsx 在 Agent 运行前设置） */
let terminalOutputCallback: ((text: string) => void) | null = null;

export function setTerminalOutputCallback(cb: ((text: string) => void) | null) {
  terminalOutputCallback = cb;
}

export function setCurrentProjectPath(p: string) {
  currentProjectPath = p.replace(/\\/g, '/').replace(/\/$/, '');
  setCheckpointProjectRoot(currentProjectPath);
}
export function getCurrentProjectPath() { return currentProjectPath; }

function isAbsolutePath(p: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(p) || p.startsWith('/');
}

function resolvePath(p: string): string {
  if (isAbsolutePath(p)) return p.replace(/\\/g, '/');
  if (!currentProjectPath) return p.replace(/\\/g, '/');
  return `${currentProjectPath}/${p}`.replace(/\\/g, '/');
}

/* ====== 文件操作 ====== */

async function tauriRead(path: string): Promise<string> {
  const fullPath = resolvePath(path);

  // 优先用 Electron IPC 文件 API（快）
  if (isTauri()) {
    try { return await readTextFile(fullPath); } catch { /* fallback */ }
  }

  // 浏览器模式：演示文件
  try {
    const { DEMO_FILES } = await import('../components/CodeViewer');
    if (DEMO_FILES[path]) return DEMO_FILES[path];
  } catch { /* 演示模式：DEMO_FILES 不可用则跳过 */ }

  // 最后 fallback：跨平台 shell 读取
  try { return await readFileContent(fullPath); }
  catch (e: unknown) { return `【失败】${e instanceof Error ? e.message : String(e)}`; }
}

async function tauriWrite(path: string, content: string): Promise<string> {
  const fullPath = resolvePath(path);

  // 创建检查点（写前备份）
  createCheckpoint(fullPath, 'write_file', `写入 ${path}`).catch(() => {});

  if (isTauri()) {
    try { return await writeFileContent(fullPath, content); }
    catch (shellErr: unknown) {
      // shell 失败时尝试 fs 插件
      try { await writeTextFile(fullPath, content); return `文件写入成功（fs 插件）: ${fullPath}`; }
      catch { return `【失败】${shellErr.message || shellErr}`; }
    }
  }

  // 浏览器模式：更新演示缓存
  try {
    const { DEMO_FILES } = await import('../components/CodeViewer');
    DEMO_FILES[path] = content;
  } catch { /* 演示模式：DEMO_FILES 不可用则跳过 */ }
  return '文件写入成功（演示模式）';
}

async function tauriEdit(path: string, search: string, replace: string): Promise<string> {
  // 创建检查点（编辑前备份）
  createCheckpoint(resolvePath(path), 'edit_file', `编辑 ${path}`).catch(() => {});

  try {
    const original = await tauriRead(path);
    if (typeof original !== 'string' || original.startsWith('【失败】') || original.startsWith('读取失败') || original.startsWith('错误')) {
      return original;
    }
    if (!original.includes(search)) {
      return `未找到匹配文字 "${search.slice(0, 80)}..."`;
    }
    const modified = original.replaceAll(search, replace);
    return await tauriWrite(path, modified);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriExec(command: string, _cwd?: string): Promise<string> {
  const api = (window as any).electronAPI;
  // 流式模式：通过 IPC 实时推送输出
  if (api?.execStreaming && terminalOutputCallback) {
    const requestId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return new Promise((resolve) => {
      let output = '';
      const cleanup = api.onStreamData(requestId, (data: { type?: string; data?: string; code?: number; message?: string }) => {
        if (data.type === 'stdout') {
          output += data.data;
          terminalOutputCallback?.(data.data);
        } else if (data.type === 'stderr') {
          output += data.data;
          terminalOutputCallback?.(data.data);
        } else if (data.type === 'close') {
          cleanup();
          if (data.code === 0) resolve(output || '(命令执行成功，无输出)');
          else resolve(`【失败】命令退出码 ${data.code}${output ? '，输出: ' + output.slice(0, 500) : ''}`);
        } else if (data.type === 'error') {
          cleanup();
          resolve(`【失败】${data.message}`);
        }
      });
      api.execStreaming(requestId, command, [], _cwd ? { cwd: _cwd } : undefined);
    });
  }
  // 非流式模式：传统 execCommand
  try {
    return await execCommand(command);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriListDir(path: string): Promise<string> {
  const fullPath = resolvePath(path || '.');
  try {
    const result = await listDirectory(fullPath);
    return result || '(空目录)';
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriCreateDocx(p: string, title: string, content: string): Promise<string> {
  const fullPath = resolvePath(p);

  // 1) 尝试 Python + python-docx（最佳排版）
  try {
    const escPy = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const pythonScript = [
      `from docx import Document`,
      `from docx.shared import Pt`,
      `from docx.enum.text import WD_ALIGN_PARAGRAPH`,
      `doc = Document()`,
      `doc.styles['Normal'].font.size = Pt(12)`,
      `h = doc.add_heading('${escPy(title)}', 0)`,
      `h.alignment = WD_ALIGN_PARAGRAPH.CENTER`,
      `for line in '''${escPy(content)}'''.split('\\n'):`,
      `  doc.add_paragraph(line)`,
      `doc.save(r'${escPy(fullPath)}')`,
    ].join('\n');
    await execCommand('python', ['-c', pythonScript]);
    return `Word 文档创建成功: ${fullPath}`;
  } catch { /* fallback to JS */ }

  // 2) JS 回退：纯 ZIP 创建最小 .docx
  try {
    const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeContent = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const paragraphs = safeContent.split('\n').map((l) =>
      `<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${l}</w:t></w:r></w:p>`
    ).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${safeTitle}</w:t></w:r></w:p>
${paragraphs}
</w:body></w:document>`;

    const ctXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

    // 用 powershell .NET ZipFile 打包（Windows）/ node zlib（跨平台）
    const psZip = `
      $dir = '${fullPath.replace(/'/g, "''")}'
      if (Test-Path $dir) { Remove-Item $dir -Force }
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $z = [System.IO.Compression.ZipFile]::Open($dir, 'Create')
      function AE($n,$t) { $b=[Text.Encoding]::UTF8.GetBytes($t); $e=$z.CreateEntry($n); $s=$e.Open(); $s.Write($b,0,$b.Length); $s.Close() }
      AE '_rels/.rels' '${relsXml.replace(/'/g, "''")}'
      AE '[Content_Types].xml' '${ctXml.replace(/'/g, "''")}'
      AE 'word/document.xml' '${xml.replace(/'/g, "''").replace(/\n/g, ' ')}'
      $z.Dispose()
    `;
    await execCommand('powershell', ['-NoProfile', '-Command', psZip]);
    return `Word 文档创建成功 (JS回退): ${fullPath}`;
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

/* ====== Git 操作（新） ====== */

async function tauriGitStatus(_path?: string): Promise<string> {
  try {
    const cwd = currentProjectPath || undefined;
    return await execCommand('git', ['status', '--short'], cwd);
  } catch (e: unknown) {
    // 非 git 仓库或 git 不可用
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('退出码 128') || msg.includes('not a git repository')) {
      return '(当前目录不是 Git 仓库 — 运行 git init 初始化)';
    }
    return `【失败】${msg}`;
  }
}

async function tauriGitDiff(staged?: boolean): Promise<string> {
  try {
    const args = ['diff'];
    if (staged) args.push('--cached');
    const cwd = currentProjectPath || undefined;
    return await execCommand('git', args, cwd);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriGitLog(count: number = 10): Promise<string> {
  try {
    const cwd = currentProjectPath || undefined;
    return await execCommand('git', ['log', `-${count}`, '--oneline', '--decorate'], cwd);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriGitCommit(message: string): Promise<string> {
  try {
    const cwd = currentProjectPath || undefined;
    return await execCommand('git', ['commit', '-m', message], cwd);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tauriGitBranch(): Promise<string> {
  try {
    const cwd = currentProjectPath || undefined;
    return await execCommand('git', ['branch', '--list'], cwd);
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

/* ====== apply_patch ====== */

async function tauriApplyPatch(patch: string): Promise<string> {
  if (!patch.trim()) return '补丁为空';
  try {
    // 解析 unified diff：找到文件名，逐文件应用
    const filePattern = /^diff --git a\/(.+) b\/(.+)$/gm;
    const files: { oldPath: string; newPath: string }[] = [];
    let m;
    while ((m = filePattern.exec(patch)) !== null) {
      files.push({ oldPath: m[1], newPath: m[2] });
    }

    if (files.length === 0) return '无法解析补丁中的文件路径';

    const results: string[] = [];
    for (const { oldPath, newPath } of files) {
      const fullPath = resolvePath(newPath);

      // 读取原始文件
      let original = '';
      try {
        original = await tauriRead(newPath);
        if (original.startsWith('【失败】') || original.startsWith('读取失败') || original.startsWith('错误')) original = '';
      } catch { original = ''; }

      const originalLines = original.split('\n');

      // 提取该文件的 hunk
      const filePatchRegex = new RegExp(
        `diff --git a/${escapeRegExp(oldPath)} b/${escapeRegExp(newPath)}[\\s\\S]*?(?=diff --git|$)`,
        'g'
      );
      let filePatch = '';
      const fm = filePatchRegex.exec(patch);
      if (fm) filePatch = fm[0];

      const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm;
      let appliedLines = [...originalLines];
      let offset = 0;

      for (const hm of filePatch.matchAll(hunkRegex)) {
        const oldStart = parseInt(hm[1]) - 1; // 0-based
        const oldCount = hm[2] ? parseInt(hm[2]) : 1;

        // 找到 hunk 结束位置
        const hunkStart = hm.index!;
        const afterHunk = filePatch.slice(hunkStart);
        const hunkLines = afterHunk.split('\n').slice(1); // skip @@ line
        const hunkBody: string[] = [];
        for (const hl of hunkLines) {
          if (hl.startsWith('@@') || hl.startsWith('diff --git')) break;
          if (hl === '\\ No newline at end of file') continue;
          hunkBody.push(hl);
        }

        // 应用 hunk（offset 由 oldStart 和变形后的 newLines.length 计算）
        const newLines: string[] = [];

        for (const hl of hunkBody) {
          if (hl.startsWith(' ')) {
            newLines.push(hl.slice(1));
          } else if (hl.startsWith('-')) {
            // 删除行：不加入 newLines，offset 由 oldCount 计算
          } else if (hl.startsWith('+')) {
            newLines.push(hl.slice(1)); // 添加行
          }
        }

        // 替换
        appliedLines = [
          ...appliedLines.slice(0, oldStart + offset),
          ...newLines,
          ...appliedLines.slice(oldStart + offset + oldCount),
        ];
        offset += newLines.length - oldCount;
      }

      const result = appliedLines.join('\n');
      // 写前备份
      await createCheckpoint(fullPath, 'apply_patch', `应用补丁: ${newPath}`).catch(() => {});
      await tauriWrite(newPath, result);
      results.push(`✓ ${newPath} (${appliedLines.length} 行)`);
    }

    return `补丁已应用到 ${results.length} 个文件:\n${results.join('\n')}`;
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ====== Web 搜索 ====== */

async function tauriWebSearch(query: string): Promise<string> {
  // 多源搜索 fallback：先试 Bing，失败或结果为空时试 DuckDuckGo Lite（纯 HTML，反爬弱）
  const results: string[] = [];

  // === Bing ===
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000); // 8秒超时
    const resp = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const html = await resp.text();
      const algoRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
      let match;
      while ((match = algoRegex.exec(html)) !== null && results.length < 8) {
        const block = match[1];
        const linkMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (linkMatch) {
          const url = linkMatch[1];
          const title = linkMatch[2].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim() : '';
          if (url && title && !url.includes('go.microsoft.com')) {
            results.push(`**${title}**\n${snippet}\n🔗 ${url}`);
          }
        }
      }
    }
  } catch { /* Bing 失败，尝试下个源 */ }

  // === DuckDuckGo Lite（轻量 HTML，反爬较弱）===
  if (results.length === 0) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const html = await resp.text();
        // DuckDuckGo Lite 结果格式：<a rel="nofollow" href="URL" class="result-link">标题</a>
        // 后面跟 <span class="result-snippet">摘要</span>
        const linkRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = linkRegex.exec(html)) !== null && results.length < 8) {
          const url = m[1];
          const title = m[2].replace(/<[^>]*>/g, '').trim();
          // 尝试提取摘要：跟在此链接后的 result-snippet span
          const afterIdx = m.index + m[0].length;
          const after = html.slice(afterIdx, afterIdx + 800);
          const snippetMatch = after.match(/<span[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/span>/i);
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
          if (url && title) {
            results.push(`**${title}**\n${snippet}\n🔗 ${url}`);
          }
        }
      }
    } catch { /* DDG 也失败 */ }
  }

  if (results.length > 0) {
    return `搜索 "${query}" 的结果：\n\n${results.join('\n\n')}`;
  }
  return `搜索 "${query}" 未找到结果。\n\n可能原因：\n- 网络连接问题\n- 搜索引擎暂时不可用\n- 尝试更具体的关键词`;
}

async function tauriWebFetch(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'devwhale/0.3 (AI Agent)' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await resp.text();
      // 去除 HTML 标签，返回纯文本
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);
      return `网页内容 (${url}):\n\n${text}`;
    }
    const text = await resp.text();
    return `网页内容 (${url}):\n\n${text.slice(0, 8000)}`;
  } catch (e: unknown) {
    return `【失败】${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Agent 工具调度器 */
export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  // MCP 工具路由：mcp_<serverId>_<toolName>
  // 通过已注册会话精确匹配 serverId（支持 serverId 含下划线）
  if (name.startsWith('mcp_')) {
    const registered = getAllMcpTools();
    for (const { serverId, tools } of registered) {
      for (const tool of tools) {
        const fullName = `mcp_${serverId}_${tool.name}`;
        if (name === fullName) {
          try {
            return await callMcpTool(serverId, tool.name, args);
          } catch (e: unknown) {
            return `【失败】MCP：${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }
    // 未匹配到任何注册工具
    return `【失败】MCP 工具未注册: ${name}`;
  }

  switch (name) {
    case 'read_file': return tauriRead(args.path);
    case 'write_file': return tauriWrite(args.path, args.content);
    case 'edit_file': return tauriEdit(args.path, args.search, args.replace);
    case 'exec_command': return tauriExec(args.command, args.cwd);
    case 'list_dir': return tauriListDir(args.path || '.');
    case 'create_docx': return tauriCreateDocx(args.path, args.title, args.content);
    case 'git_status': return tauriGitStatus(args.path);
    case 'git_diff': return tauriGitDiff(args.staged);
    case 'git_log': return tauriGitLog(args.count || 10);
    case 'git_commit': return tauriGitCommit(args.message);
    case 'git_branch': return tauriGitBranch();
    case 'apply_patch': return tauriApplyPatch(args.patch);
    case 'web_search': return tauriWebSearch(args.query);
    case 'web_fetch': return tauriWebFetch(args.url);
    default: return `未知工具: ${name}`;
  }
}

// === 测试导出 ===
export const __test = { isAbsolutePath, resolvePath };
