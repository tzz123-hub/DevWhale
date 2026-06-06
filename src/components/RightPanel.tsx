import { useState, useEffect } from 'react';
import { TodoItem } from '../types/chat';
import { cn } from '../lib/utils';
import { FileTree, DEMO_FILE_TREE, type FileNode } from './FileTree';
import { t } from '../lib/i18n';

import { ToolProgress } from '../lib/api';
import { listCheckpoints, revertCheckpoint, getCheckpointStats, type Checkpoint } from '../lib/checkpoint';

interface RightPanelProps {
  todos: TodoItem[];
  toolLogs?: ToolProgress[];
  activeFilePath: string | null;
  onSelectFile?: (path: string) => void;
  fileTree?: FileNode;
  projectName?: string;
}

type Tab = 'plan' | 'files' | 'context' | 'checkpoints';

export function RightPanel({ todos, toolLogs, activeFilePath, onSelectFile, fileTree, projectName }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const doneCount = todos.filter((t) => t.status === 'completed').length;
  const progressPct = todos.length > 0 ? Math.round((doneCount / todos.length) * 100) : 0;
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [cpStats, setCpStats] = useState({ total: 0, files: 0, latestTime: null as number | null });

  useEffect(() => {
    const refresh = () => {
      setCheckpoints(listCheckpoints());
      setCpStats(getCheckpointStats());
    };
    refresh();
    const timer = setInterval(refresh, 5000); // 5s 降低轮询开销
    return () => clearInterval(timer);
  }, []);

  const handleRevert = async (id: string) => {
    await revertCheckpoint(id);
    setCheckpoints(listCheckpoints());
    setCpStats(getCheckpointStats());
  };

  return (
    <div className="flex flex-col h-full bg-surface-50 border-l border-surface-200">
      {/* Tab 切换 */}
      <div className="flex border-b border-surface-200">
          {([
            { key: 'plan' as Tab, label: t('rightPanel.plan') },
            { key: 'files' as Tab, label: t('rightPanel.files') },
            { key: 'checkpoints' as Tab, label: '回滚' },
            { key: 'context' as Tab, label: t('rightPanel.context') },
          ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 px-2 py-2.5 text-[11px] font-semibold border-b-2 transition-colors',
              activeTab === tab.key
                ? 'text-accent border-accent'
                : 'text-surface-400 border-transparent hover:text-surface-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'plan' && (
        <div className="flex flex-col flex-1 min-h-0">
          {todos.length > 0 && (
            <div className="px-3 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">{t('rightPanel.progress')}</span>
                <span className="text-[11px] text-surface-400 tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {todos.filter((t) => t.status === 'in_progress').length > 0 && (
              <TodoGroup title={t('rightPanel.inProgress')} color="text-amber-500" pulse>
                {todos.filter((t) => t.status === 'in_progress').map((t) => <TodoRow key={t.id} todo={t} />)}
              </TodoGroup>
            )}
            {todos.filter((t) => t.status === 'pending').length > 0 && (
              <TodoGroup title={t('rightPanel.pending')}>
                {todos.filter((t) => t.status === 'pending').map((t) => <TodoRow key={t.id} todo={t} />)}
              </TodoGroup>
            )}
            {todos.filter((t) => t.status === 'completed').length > 0 && (
              <TodoGroup title={t('rightPanel.completed')} color="text-success" check>
                {todos.filter((t) => t.status === 'completed').map((t) => <TodoRow key={t.id} todo={t} />)}
              </TodoGroup>
            )}
            {todos.length === 0 && !toolLogs?.length && <p className="text-xs text-surface-400 py-8 text-center">{t('rightPanel.noTasks')}</p>}

            {/* Agent 工具执行日志 */}
            {toolLogs && toolLogs.length > 0 && (
              <div className="mt-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-1">Agent 执行日志</h3>
                {toolLogs.map((log, i) => (
                  <div key={i} className={cn(
                    'px-2 py-1.5 rounded text-[11px] font-mono flex items-start gap-1.5',
                    log.status === 'running' ? 'bg-amber-500/5 text-amber-600' :
                    log.status === 'ok' ? 'bg-green-500/5 text-green-600' :
                    'bg-red-500/5 text-red-600'
                  )}>
                    <span className="shrink-0 mt-px">
                      {log.status === 'running' ? '⏳' : log.status === 'ok' ? '✅' : '❌'}
                    </span>
                    <span className="truncate">
                      <span className="font-semibold">{log.toolName}</span>
                      <span className="text-surface-400 text-[10px] ml-1">
                        {log.args?.path || log.args?.command || ''}
                      </span>
                      {log.result && log.status === 'fail' && (
                        <span className="block text-[10px] text-red-500 mt-0.5 truncate">{log.result.slice(0, 80)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-surface-200">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              <span className="text-[10px] text-surface-500">{t('rightPanel.ready')}</span>
              <span className="ml-auto text-[10px] text-surface-400 font-mono">{doneCount}/{todos.length} {t('rightPanel.items')}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">{t('rightPanel.projectFiles')}</span>
              <span className="text-[10px] text-surface-400">{projectName || t('fileTree.bobFrontend')}</span>
            </div>
            <FileTree root={fileTree || DEMO_FILE_TREE} activeFilePath={activeFilePath} onSelectFile={onSelectFile} />
          </div>
        </div>
      )}

      {activeTab === 'checkpoints' && (
        <div className="flex-1 overflow-y-auto p-3">
          {cpStats.total === 0 ? (
            <p className="text-xs text-surface-400 py-8 text-center">暂无检查点<br /><span className="text-[10px]">写入文件时自动创建备份</span></p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-surface-500 mb-1">
                <span>{cpStats.total} 个检查点 · {cpStats.files} 个文件</span>
              </div>
              {checkpoints.map((cp) => (
                <div key={cp.id} className="p-2 rounded-lg bg-surface-0 border border-surface-200 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-surface-600 truncate max-w-[120px]">{cp.filePath}</span>
                    <button
                      onClick={() => handleRevert(cp.id)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                    >
                      回滚
                    </button>
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    {cp.description}
                    <span className="mx-1">·</span>
                    {new Date(cp.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'context' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h3 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">{t('rightPanel.currentFile')}</h3>
            {activeFilePath ? (
              <div className="p-3 bg-surface-0 rounded-xl border border-surface-200 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  </svg>
                  <span className="text-xs text-surface-700 font-mono truncate">{activeFilePath}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-surface-400">
                  <span>TypeScript React</span><span className="w-1 h-1 rounded-full bg-surface-300" /><span>{t('rightPanel.saved')}</span>
                </div>
              </div>
            ) : (<p className="text-xs text-surface-400 py-2">{t('rightPanel.noOpenFile')}</p>)}
          </div>
          <div className="pt-3 border-t border-surface-200">
            <h3 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">{t('rightPanel.projectInfo')}</h3>
            <div className="p-3 bg-surface-0 rounded-xl border border-surface-200 space-y-2">
              <KV label="框架" value="Electron + React 19" />
              <KV label="样式" value="Tailwind CSS 4" />
              <KV label="语言" value="TypeScript" />
              <KV label="模式" value="YOLO" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodoGroup({ title, color, pulse, check, children }: {
  title: string; color?: string; pulse?: boolean; check?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={cn('text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5', color || 'text-surface-400')}>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
        {check && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TodoRow({ todo }: { todo: TodoItem }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors group">
      <div className={cn(
        'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-all duration-200',
        todo.status === 'completed' ? 'bg-success border-success'
          : todo.status === 'in_progress' ? 'border-accent bg-accent-muted'
          : 'border-surface-300 group-hover:border-surface-400'
      )}>
        {todo.status === 'completed' && (
          <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 10.5l-2.5-2.5L5 7l1.5 1.5L10 5l1 1-4.5 4.5z" /></svg>
        )}
      </div>
      <span className={cn('text-sm leading-snug', todo.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-600')}>
        {todo.content}
      </span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-surface-400">{label}</span>
      <span className="text-surface-600 font-medium">{value}</span>
    </div>
  );
}
