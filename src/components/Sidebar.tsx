import { useState, useRef, useEffect } from 'react';
import { Conversation, Project, Mode } from '../types/chat';
import { cn, formatTime } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { t } from '../lib/i18n';

interface SidebarProps {
  conversations: Conversation[];
  projects: Project[];
  activeConversationId: string | null;
  activeProjectId?: string;
  username: string;
  mode: Mode;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onOpenSettings: () => void;
  onOpenFolder?: () => void;
  onSelectProject?: (proj: Project) => void;
  onExportConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversation?: (id: string) => void;
  onMoveConversation?: (id: string, projectId: string) => void;
  onNewConversationInProject?: (projectId: string) => void;
  onCreateProject?: (name: string) => void;
  onRenameProject?: (id: string, name: string) => void;
}

const PROJECT_ICONS: Record<string, string> = {
  'proj-1': '📈',
  'proj-2': '🖥️',
  'proj-0': '🖥️',
};

export function Sidebar({
  conversations,
  projects,
  activeConversationId,
  activeProjectId,
  username,
  mode,
  onSelectConversation,
  onNewConversation,
  onOpenSettings,
  onOpenFolder,
  onSelectProject,
  onExportConversation,
  onRenameConversation,
  onDeleteConversation,
  onMoveConversation,
  onNewConversationInProject,
  onCreateProject,
  onRenameProject,
}: SidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    try { const raw = localStorage.getItem('devwhale-collapsed-projects'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem('devwhale-collapsed-projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; convId: string; convTitle: string; convProject: string } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  // 项目重命名
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [editingProjName, setEditingProjName] = useState('');
  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<{ convId: string; convTitle: string } | null>(null);
  const { resolved, toggle } = useTheme();

  // 搜索过滤
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  const grouped = projects.map((proj) => ({
    ...proj,
    convs: filteredConversations.filter((c) => c.project === proj.id),
  }));

  const unassigned = filteredConversations.filter((c) => !c.project);

  // 模式显示
  const modeLabel = mode === 'yolo' ? 'YOLO' : mode === 'ask' ? 'Ask' : 'Plan';

  return (
    <div
      className="flex flex-col h-full bg-surface-50 border-r border-surface-200 select-none"
      data-tauri-drag-region
    >
      {/* 顶部品牌区 */}
      <div className="px-4 py-3 border-b border-surface-200" data-tauri-drag-region>
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-surface-800 tracking-tight">DevWhale</h1>
          <span className="text-[10px] text-surface-400 font-mono">v0.2</span>
        </div>
        {activeConversationId && onExportConversation && (
          <button
            onClick={() => onExportConversation(activeConversationId)}
            className="text-[10px] px-2 py-0.5 rounded bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700 transition-colors"
            title="导出为 Markdown"
          >
            📥 导出
          </button>
        )}
      </div>

      {/* 新建会话 */}
      <div className="p-3 border-b border-surface-200 space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                     bg-surface-0 border border-surface-300 hover:border-surface-400
                     hover:shadow-sm active:scale-[0.98]
                     text-surface-600 text-xs font-medium transition-all duration-150"
        >
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('sidebar.newChat')}
        </button>
        {/* 搜索框 */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话..."
            className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-surface-0 border border-surface-200 text-xs text-surface-700 placeholder-surface-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent-muted"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 新建分组 */}
        {showNewProject ? (
          <div className="flex gap-1 mt-1">
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newProjectName.trim()) {
                  onCreateProject?.(newProjectName.trim());
                  setNewProjectName('');
                  setShowNewProject(false);
                }
                if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); }
              }}
              onBlur={() => {
                // 延迟处理避免与按钮 click 事件竞态
                setTimeout(() => {
                  if (newProjectName.trim()) {
                    onCreateProject?.(newProjectName.trim());
                  }
                  setShowNewProject(false);
                  setNewProjectName('');
                }, 150);
              }}
              placeholder="分组名称..."
              className="flex-1 px-2 py-1 rounded-lg bg-surface-0 border border-accent-border text-xs text-surface-700 outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowNewProject(true)}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-surface-400 text-[11px] hover:bg-surface-100 hover:text-surface-600 transition-colors border border-dashed border-surface-300"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            📁 新建分组
          </button>
        )}
      </div>

      {/* 项目与会话树 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {onOpenFolder && (
          <button
            onClick={onOpenFolder}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-surface-400 text-[11px] hover:bg-surface-100 hover:text-surface-600 transition-colors mb-1 border border-dashed border-surface-300"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            📂 打开文件夹
          </button>
        )}
        {grouped.map((proj) => {
              const isProjEditing = editingProjId === proj.id;
              return (
          <div key={proj.id}>
            <div className="flex items-center gap-1 group/proj">
              {isProjEditing ? (
                <input
                  autoFocus
                  value={editingProjName}
                  onChange={(e) => setEditingProjName(e.target.value)}
                  onBlur={() => {
                    if (editingProjName.trim() && editingProjName.trim() !== proj.name) {
                      onRenameProject?.(proj.id, editingProjName.trim());
                    }
                    setEditingProjId(null);
                    setEditingProjName('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setEditingProjId(null); setEditingProjName(''); }
                  }}
                  className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                             bg-accent-muted text-accent outline-none
                             border border-accent-border min-w-0"
                />
              ) : (
                <button
                  onClick={() => {
                    if (onSelectProject) onSelectProject(proj);
                    setCollapsedProjects((prev) => ({ ...prev, [proj.id]: !prev[proj.id] }));
                  }}
                  onDoubleClick={(e) => { e.preventDefault(); setEditingProjId(proj.id); setEditingProjName(proj.name); }}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors min-w-0',
                    activeProjectId === proj.id
                      ? 'bg-accent-muted text-accent'
                      : 'text-surface-500 hover:bg-surface-100'
                  )}
                  title="双击重命名分组"
                >
                  <svg
                    className={cn(
                      'w-3 h-3 text-surface-400 transition-transform duration-200 shrink-0',
                      !collapsedProjects[proj.id] && 'rotate-90'
                    )}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs mr-1 shrink-0">{PROJECT_ICONS[proj.id] || '📁'}</span>
                  <span className="truncate">{proj.name}</span>
                  <span className="ml-auto text-[10px] text-surface-400 tabular-nums shrink-0">{proj.convs.length}</span>
                </button>
              )}
              {!isProjEditing && onNewConversationInProject && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNewConversationInProject(proj.id); }}
                  className="shrink-0 p-1 rounded-md text-surface-400 opacity-0 group-hover/proj:opacity-100 hover:text-accent hover:bg-accent-muted transition-all"
                  title="在此分组新建会话"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {!collapsedProjects[proj.id] && proj.convs.map((conv) => {
              const isEditing = editingId === conv.id;
              return (
              <div key={conv.id} className="relative group/item"
                   onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, convId: conv.id, convTitle: conv.title, convProject: conv.project }); }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => {
                      if (editingTitle.trim() && editingTitle.trim() !== conv.title) {
                        onRenameConversation?.(conv.id, editingTitle.trim());
                      }
                      setEditingId(null);
                      setEditingTitle('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setEditingId(null); setEditingTitle(''); }
                    }}
                    className="w-full text-left pl-8 pr-3 py-2 rounded-lg text-sm
                               bg-accent-muted text-accent font-medium outline-none
                               border border-accent-border shadow-sm ml-1"
                  />
                ) : (
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    onDoubleClick={() => { setEditingId(conv.id); setEditingTitle(conv.title); }}
                    className={cn(
                      'w-full text-left pl-8 pr-3 py-2 rounded-lg transition-all duration-150 ml-1 text-sm',
                      activeConversationId === conv.id
                        ? 'bg-accent-muted text-accent font-medium shadow-sm'
                        : 'text-surface-600 hover:bg-surface-100'
                    )}
                    title="双击重命名"
                  >
                    <div className="truncate">{conv.title}</div>
                    <div className={cn('text-[11px] mt-0.5 tabular-nums transition-colors', activeConversationId === conv.id ? 'text-accent/60' : 'text-surface-400')}>
                      {formatTime(conv.updatedAt)}
                      <span className="mx-1.5 opacity-30">·</span>
                      {conv.messages.length} {t('sidebar.msgCount')}
                    </div>
                  </button>
                )}
                {!isEditing && onDeleteConversation && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ convId: conv.id, convTitle: conv.title }); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-surface-400
                               opacity-0 group-hover/item:opacity-100 hover:text-red-500 hover:bg-red-50
                               transition-all duration-150"
                    title="删除会话"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )})}

            {proj.convs.length === 0 && !collapsedProjects[proj.id] && (
              <div className="pl-8 pr-3 py-2 text-[11px] text-surface-400 italic">{t('sidebar.noChats')}</div>
            )}
          </div>
        )})}

        {unassigned.length > 0 && (
          <div className="pt-2 mt-2 border-t border-surface-200">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
              {t('sidebar.uncategorized')}
            </div>
            {unassigned.map((conv) => {
              const isEditing = editingId === conv.id;
              return (
              <div key={conv.id} className="relative group/item"
                   onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, convId: conv.id, convTitle: conv.title, convProject: conv.project }); }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => {
                      if (editingTitle.trim() && editingTitle.trim() !== conv.title) {
                        onRenameConversation?.(conv.id, editingTitle.trim());
                      }
                      setEditingId(null);
                      setEditingTitle('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setEditingId(null); setEditingTitle(''); }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm
                               bg-accent-muted text-accent font-medium outline-none
                               border border-accent-border shadow-sm"
                  />
                ) : (
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    onDoubleClick={() => { setEditingId(conv.id); setEditingTitle(conv.title); }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      activeConversationId === conv.id
                        ? 'bg-accent-muted text-accent font-medium'
                        : 'text-surface-600 hover:bg-surface-100'
                    )}
                    title="双击重命名"
                  >
                    <div className="truncate">{conv.title}</div>
                    <div className="text-[11px] text-surface-400 mt-0.5 tabular-nums">{formatTime(conv.updatedAt)}</div>
                  </button>
                )}
                {!isEditing && onDeleteConversation && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ convId: conv.id, convTitle: conv.title }); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-surface-400
                               opacity-0 group-hover/item:opacity-100 hover:text-red-500 hover:bg-red-50
                               transition-all duration-150"
                    title="删除会话"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )})}
          </div>
        )}

        {grouped.length === 0 && unassigned.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs text-surface-400">{t('sidebar.noChats')}</p>
            <p className="text-[11px] text-surface-400/60 mt-1">{t('sidebar.noChatsHint')}</p>
          </div>
        )}
      </div>

      {/* 底部：用户区域 + 主题 */}
      <div className="p-3 border-t border-surface-200 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-100 transition-colors text-left"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white ring-2 ring-surface-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success ring-2 ring-surface-50" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-surface-700 truncate">{username}</div>
            <div className="text-[10px] text-surface-400">{modeLabel}</div>
          </div>
          <svg className="w-3.5 h-3.5 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors text-[11px] font-medium"
        >
          {resolved === 'dark' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          {resolved === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
        </button>
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            ref={ctxMenuRef}
            className="fixed z-50 bg-surface-0 border border-surface-200 rounded-xl shadow-xl py-1 min-w-[140px]"
            style={{ left: Math.max(4, Math.min(ctxMenu.x, window.innerWidth - 160)), top: Math.max(4, Math.min(ctxMenu.y, window.innerHeight - 220)) }}
          >
            <button
              className="w-full text-left px-3 py-2 text-xs text-surface-700 hover:bg-surface-100 flex items-center gap-2 transition-colors"
              onClick={() => { setEditingId(ctxMenu.convId); setEditingTitle(ctxMenu.convTitle); setCtxMenu(null); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              重命名
            </button>
            <button
              className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
              onClick={() => { setDeleteConfirm({ convId: ctxMenu.convId, convTitle: ctxMenu.convTitle }); setCtxMenu(null); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除
            </button>
            <div className="border-t border-surface-200 my-1" />
            <div className="px-3 py-1 text-[10px] text-surface-400 font-semibold uppercase tracking-wider">分组到</div>
            {projects.map((proj) => (
              <button
                key={proj.id}
                className={cn(
                  'w-full text-left px-4 py-1.5 text-xs transition-colors hover:bg-surface-100',
                  ctxMenu.convProject === proj.id ? 'text-accent font-medium' : 'text-surface-600'
                )}
                onClick={() => { onMoveConversation?.(ctxMenu.convId, proj.id); setCtxMenu(null); }}
              >
                <span className="mr-1.5">{PROJECT_ICONS[proj.id] || '📁'}</span>
                {proj.name}
                {ctxMenu.convProject === proj.id && <span className="ml-1 text-accent">✓</span>}
              </button>
            ))}
            {projects.length === 0 && (
              <div className="px-4 py-1.5 text-[10px] text-surface-400 italic">暂无项目</div>
            )}
          </div>
        </>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface-0 rounded-2xl shadow-2xl border border-surface-200 p-5 w-72 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-800">删除会话</p>
                <p className="text-xs text-surface-400 mt-0.5 truncate max-w-[180px]">"{deleteConfirm.convTitle}"</p>
              </div>
            </div>
            <p className="text-xs text-surface-500 mb-4">此操作不可撤销，会话中的消息将被永久删除。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 py-2 rounded-xl border border-surface-200 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { onDeleteConversation?.(deleteConfirm.convId); setDeleteConfirm(null); }}
                className="flex-1 px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
