import { useMemo } from 'react';

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

interface DiffViewerProps {
  diffText: string;
  fileName?: string;
}

function parseUnifiedDiff(text: string): { fileName: string; hunks: DiffHunk[] } {
  const lines = text.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let fileName = '';
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // 文件头
    if (line.startsWith('diff --git ')) {
      const m = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (m) fileName = m[2];
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    if (line.startsWith('index ')) continue;

    // Hunk 头: @@ -old,count +new,count @@ context
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]);
      newLine = parseInt(hunkMatch[3]);
      currentHunk = { header: line, lines: [] };
      hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', oldLine: null, newLine: newLine++, content: line.slice(1) });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'remove', oldLine: oldLine++, newLine: null, content: line.slice(1) });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({ type: 'context', oldLine: oldLine++, newLine: newLine++, content: line.slice(1) || '' });
      }
      // 忽略 \ No newline 等标记
    }
  }

  return { fileName, hunks };
}

export function DiffViewer({ diffText, fileName: propFileName }: DiffViewerProps) {
  const parsed = useMemo(() => parseUnifiedDiff(diffText), [diffText]);
  const displayName = propFileName || parsed.fileName || '改动预览';

  if (!diffText.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        无改动（工作区干净）
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* 文件头 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-200 bg-surface-50">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
        <span className="text-xs font-mono text-surface-600 truncate">{displayName}</span>
        <span className="text-[10px] text-surface-400 ml-auto">
          {parsed.hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'add').length, 0)} 新增
          {' · '}
          {parsed.hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'remove').length, 0)} 删除
        </span>
      </div>

      {/* Diff 内容 */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        {parsed.hunks.length === 0 ? (
          <div className="p-4 text-surface-400">
            <pre className="whitespace-pre-wrap break-all text-[11px]">{diffText}</pre>
          </div>
        ) : (
          parsed.hunks.map((hunk, hi) => (
            <div key={hi}>
              {/* Hunk 头 */}
              <div className="px-4 py-0.5 bg-accent-muted/30 text-accent text-[10px] font-semibold sticky top-0 border-b border-accent-border/20">
                {hunk.header}
              </div>
              {/* Hunk 行 */}
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={`flex hover:brightness-95 ${
                    line.type === 'add'
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : line.type === 'remove'
                      ? 'bg-red-50 dark:bg-red-950/30'
                      : ''
                  }`}
                >
                  {/* 行号 */}
                  <span className="w-12 shrink-0 text-right pr-2 select-none text-surface-400 text-[10px] border-r border-surface-200 py-px">
                    {line.oldLine ?? ''}
                  </span>
                  <span className="w-12 shrink-0 text-right pr-2 select-none text-surface-400 text-[10px] border-r border-surface-200 py-px">
                    {line.newLine ?? ''}
                  </span>
                  {/* 操作标记 + 内容 */}
                  <span className="w-5 shrink-0 text-center select-none font-bold py-px">
                    {line.type === 'add' ? (
                      <span className="text-green-600">+</span>
                    ) : line.type === 'remove' ? (
                      <span className="text-red-600">-</span>
                    ) : (
                      <span className="text-surface-300"> </span>
                    )}
                  </span>
                  <span
                    className={`flex-1 px-1 py-px whitespace-pre-wrap break-all ${
                      line.type === 'add'
                        ? 'text-green-800 dark:text-green-200'
                        : line.type === 'remove'
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-surface-700'
                    }`}
                  >
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
