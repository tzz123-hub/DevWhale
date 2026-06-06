import { useState } from 'react';
import { cn } from '../lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  root: FileNode;
  activeFilePath?: string | null;
  onSelectFile?: (path: string) => void;
}

/** 根据扩展名返回语言图标 emoji */
function fileEmoji(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx': case 'ts': return '🟦';
    case 'js': case 'jsx': return '🟨';
    case 'css': return '🎨';
    case 'html': return '🌐';
    case 'json': return '📋';
    case 'md': return '📝';
    case 'toml': case 'yml': case 'yaml': return '⚙️';
    case 'rs': return '🦀';
    case 'py': return '🐍';
    case 'svg': case 'png': case 'jpg': return '🖼️';
    default: return '📄';
  }
}

/* ====== 树节点 ====== */

function TreeNode({
  node,
  depth,
  isLastChild,
  activeFilePath,
  onSelectFile,
}: {
  node: FileNode;
  depth: number;
  isLastChild: boolean;
  activeFilePath?: string | null;
  onSelectFile?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth <= 1); // 前两层默认展开
  const isDir = node.type === 'directory';
  const isActive = activeFilePath === node.path;
  const childCount = node.children?.length ?? 0;

  return (
    <div>
      {/* 当前节点行 */}
      <button
        onClick={() => {
          if (isDir) {
            setExpanded((prev) => !prev);
          } else {
            onSelectFile?.(node.path);
          }
        }}
        className={cn(
          'w-full flex items-center gap-1 py-[3px] pr-2 rounded-sm text-left transition-colors group relative',
          isActive
            ? 'bg-accent-muted text-accent font-medium'
            : 'text-surface-600 hover:bg-surface-100',
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        title={isDir ? `${node.name}/ (${childCount} 项)` : node.path}
      >
        {/* 树状连接线 */}
        {depth > 0 && (
          <span className="absolute inset-y-0 left-0 flex items-stretch" style={{ width: `${depth * 14 + 6}px` }}>
            {/* 祖先的竖线 */}
            {Array.from({ length: depth - 1 }).map((_, i) => (
              <span
                key={i}
                className="block border-l border-surface-200"
                style={{ marginLeft: `${i * 14 + 13}px`, width: 1 }}
              />
            ))}
            {/* 当前层：L 形拐角或 T 形延续 */}
            <span
              className={cn(
                'absolute top-0 bottom-0 border-l border-surface-200',
                isLastChild ? 'h-[50%]' : 'h-full',
              )}
              style={{ left: `${(depth - 1) * 14 + 13}px` }}
            />
            <span
              className="absolute border-b border-surface-200"
              style={{
                left: `${(depth - 1) * 14 + 13}px`,
                top: '50%',
                width: '10px',
              }}
            />
          </span>
        )}

        {/* 文件夹/文件图标 */}
        {isDir ? (
          <span className="shrink-0 text-[10px] w-4 text-center">
            {expanded ? '📂' : '📁'}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] w-4 text-center leading-none">
            {fileEmoji(node.name)}
          </span>
        )}

        {/* 文件名 */}
        <span className={cn(
          'text-[12px] truncate leading-tight',
          isDir ? 'font-medium text-surface-500' : '',
          isActive && 'font-semibold',
        )}>
          {node.name}
        </span>

        {/* 子项计数（仅目录显示） */}
        {isDir && childCount > 0 && (
          <span className="ml-auto text-[10px] text-surface-400 tabular-nums shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {childCount}
          </span>
        )}

        {/* 展开/折叠指示器 */}
        {isDir && (
          <span className={cn(
            'shrink-0 text-[10px] text-surface-400 transition-transform duration-150 ml-auto',
            expanded && 'rotate-90',
          )}>
            ›
          </span>
        )}
      </button>

      {/* 子节点 */}
      {isDir && expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isLastChild={i === node.children!.length - 1}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ====== 文件树根组件 ====== */

export function FileTree({ root, activeFilePath, onSelectFile }: FileTreeProps) {
  const totalFiles = countFiles(root);
  const totalDirs = countDirs(root);

  return (
    <div className="py-1">
      {/* 根节点自身 */}
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1 mx-1 rounded-md bg-surface-100/80">
        <span className="text-sm">📁</span>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-surface-600 truncate">{root.name}</div>
          <div className="text-[10px] text-surface-400">{totalDirs} 个目录 · {totalFiles} 个文件</div>
        </div>
      </div>

      {/* 子节点 */}
      {root.children?.length ? (
        root.children.map((child, i) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={0}
            isLastChild={i === root.children!.length - 1}
            activeFilePath={activeFilePath}
            onSelectFile={onSelectFile}
          />
        ))
      ) : (
        <p className="px-3 py-4 text-[11px] text-surface-400 text-center">
          {root.children === undefined ? '加载中...' : '空目录'}
        </p>
      )}
    </div>
  );
}

/* ====== 辅助 ====== */

function countFiles(node: FileNode): number {
  if (node.type === 'file') return 1;
  return (node.children || []).reduce((sum, c) => sum + countFiles(c), 0);
}

function countDirs(node: FileNode): number {
  if (node.type === 'file') return 0;
  let count = 0;
  for (const c of node.children || []) {
    if (c.type === 'directory') count += 1 + countDirs(c);
  }
  return count;
}

/* ====== 演示用项目文件树 ====== */

export const DEMO_FILE_TREE: FileNode = {
  name: 'devwhale',
  path: 'devwhale',
  type: 'directory',
  children: [
    {
      name: 'electron',
      path: 'electron',
      type: 'directory',
      children: [
        { name: 'main.ts', path: 'electron/main.ts', type: 'file' },
        { name: 'preload.ts', path: 'electron/preload.ts', type: 'file' },
      ],
    },
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        {
          name: 'components',
          path: 'src/components',
          type: 'directory',
          children: [
            { name: 'Sidebar.tsx', path: 'src/components/Sidebar.tsx', type: 'file' },
            { name: 'ChatArea.tsx', path: 'src/components/ChatArea.tsx', type: 'file' },
            { name: 'MessageBubble.tsx', path: 'src/components/MessageBubble.tsx', type: 'file' },
            { name: 'RightPanel.tsx', path: 'src/components/RightPanel.tsx', type: 'file' },
            { name: 'SettingsPanel.tsx', path: 'src/components/SettingsPanel.tsx', type: 'file' },
            { name: 'CodeViewer.tsx', path: 'src/components/CodeViewer.tsx', type: 'file' },
            { name: 'DiffViewer.tsx', path: 'src/components/DiffViewer.tsx', type: 'file' },
            { name: 'FileTree.tsx', path: 'src/components/FileTree.tsx', type: 'file' },
            { name: 'TerminalPanel.tsx', path: 'src/components/TerminalPanel.tsx', type: 'file' },
            { name: 'SkillStore.tsx', path: 'src/components/SkillStore.tsx', type: 'file' },
          ],
        },
        {
          name: 'lib',
          path: 'src/lib',
          type: 'directory',
          children: [
            { name: 'api.ts', path: 'src/lib/api.ts', type: 'file' },
            { name: 'tools.ts', path: 'src/lib/tools.ts', type: 'file' },
            { name: 'shell.ts', path: 'src/lib/shell.ts', type: 'file' },
            { name: 'storage.ts', path: 'src/lib/storage.ts', type: 'file' },
            { name: 'indexer.ts', path: 'src/lib/indexer.ts', type: 'file' },
            { name: 'completion.ts', path: 'src/lib/completion.ts', type: 'file' },
            { name: 'checkpoint.ts', path: 'src/lib/checkpoint.ts', type: 'file' },
            { name: 'lsp.ts', path: 'src/lib/lsp.ts', type: 'file' },
            { name: 'mcp.ts', path: 'src/lib/mcp.ts', type: 'file' },
            { name: 'debugger.ts', path: 'src/lib/debugger.ts', type: 'file' },
            { name: 'skillsMarket.ts', path: 'src/lib/skillsMarket.ts', type: 'file' },
            { name: 'tauriFs.ts', path: 'src/lib/tauriFs.ts', type: 'file' },
            { name: 'i18n.ts', path: 'src/lib/i18n.ts', type: 'file' },
            { name: 'utils.ts', path: 'src/lib/utils.ts', type: 'file' },
          ],
        },
        {
          name: 'hooks',
          path: 'src/hooks',
          type: 'directory',
          children: [
            { name: 'useTheme.tsx', path: 'src/hooks/useTheme.tsx', type: 'file' },
          ],
        },
        {
          name: 'types',
          path: 'src/types',
          type: 'directory',
          children: [
            { name: 'chat.ts', path: 'src/types/chat.ts', type: 'file' },
          ],
        },
        { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
        { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
        { name: 'index.css', path: 'src/index.css', type: 'file' },
      ],
    },
    { name: 'package.json', path: 'package.json', type: 'file' },
    { name: 'vite.config.ts', path: 'vite.config.ts', type: 'file' },
    { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
    { name: 'index.html', path: 'index.html', type: 'file' },
    { name: 'README.md', path: 'README.md', type: 'file' },
  ],
};
