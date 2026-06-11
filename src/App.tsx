import { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { RightPanel } from './components/RightPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Conversation, Message, Project, TodoItem, Mode } from './types/chat';
import { loadConversations, saveConversations, loadActiveConversationId, saveActiveConversationId, loadUsername, loadMode, saveMode, loadChatSettings, loadGeneralPreferences, loadProvider, migrateLegacyApiKey, getProviderConfig, loadProjects, saveProjects } from './lib/storage';
import { agentChat, ToolProgress } from './lib/api';
import { executeToolCall, setCurrentProjectPath, setTerminalOutputCallback } from './lib/tools';
import { CodeViewer, DEMO_FILES, type OpenFile } from './components/CodeViewer';
import { writeTextFile, isTauri } from './lib/tauriFs';
// import { startLspServer, stopLspServer, type LspLanguage } from './lib/lsp';

import { TerminalPanel } from './components/TerminalPanel';
import { SkillStore } from './components/SkillStore';
import { type FileNode } from './components/FileTree';
import { listFilesRecursive } from './lib/shell';

// 浏览器模式下的占位路径；Electron 模式下由 useEffect 动态获取
const DEFAULT_PROJECT_PATH = '';

/** 将文件路径列表转换为 FileNode 树 */
function buildFileTree(files: string[], rootPath: string): FileNode {
  const rootName = rootPath.replace(/\\/g, '/').split('/').pop() || '项目';
  const root: FileNode = { name: rootName, path: rootPath, type: 'directory', children: [] };
  const dirMap = new Map<string, FileNode>();
  dirMap.set('', root);

  // 按路径深度排序，确保父目录先创建
  const sorted = files.sort((a, b) => a.split('/').length - b.split('/').length);

  for (const fp of sorted) {
    const parts = fp.split('/');
    // 逐级创建目录节点
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(dirPath)) {
        const node: FileNode = { name: parts[i], path: rootPath + '/' + dirPath, type: 'directory', children: [] };
        dirMap.set(dirPath, node);
        const parentPath = parts.slice(0, i).join('/');
        const parent = dirMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    }
    // 添加文件节点
    const fileName = parts[parts.length - 1];
    const filePath = rootPath + '/' + fp;
    const parentPath = parts.slice(0, -1).join('/');
    const parent = dirMap.get(parentPath);
    if (parent && parent.children) {
      parent.children.push({ name: fileName, path: filePath, type: 'file' });
    }
  }

  return root;
}

function createDemoConversations(): Conversation[] {
  return [
    {
      id: 'conv-1',
      title: '策略参数调整',
      project: 'proj-1',
      messages: [],
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: 'conv-2',
      title: '止损逻辑排查',
      project: 'proj-1',
      messages: [],
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 7200000,
    },
    {
      id: 'conv-3',
      title: '搭建前端框架',
      project: 'proj-2',
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: '做一个类似于 Trae Solo 的桌面应用',
          timestamp: Date.now() - 600000,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
}

const DEMO_TODOS: TodoItem[] = [
  { id: 'todo-1', content: '搭建 Electron + React 项目骨架', status: 'completed' },
  { id: 'todo-2', content: '三栏布局 + 主题切换', status: 'completed' },
  { id: 'todo-3', content: 'Agent 引擎: 流式 Tool Calling', status: 'completed' },
  { id: 'todo-4', content: 'Monaco 编辑器 + AI Ghost Text 补全', status: 'completed' },
  { id: 'todo-5', content: 'xterm.js 终端面板', status: 'completed' },
  { id: 'todo-6', content: '多模态输入: 图片 + 60+ 文件格式', status: 'completed' },
  { id: 'todo-7', content: 'LSP 诊断接入 Monaco (Pyright)', status: 'completed' },
  { id: 'todo-8', content: 'DiffViewer: diff 代码块自动渲染', status: 'completed' },
  { id: 'todo-9', content: 'MCP 服务器启动/停止管理', status: 'in_progress' },
  { id: 'todo-10', content: '外部应用 OAuth 授权', status: 'pending' },
];

function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConversations();
    return saved.length > 0 ? saved : createDemoConversations();
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    // 从同一个源（localStorage）推断，避免 cross-state 依赖
    const savedConvs = loadConversations();
    const convs = savedConvs.length > 0 ? savedConvs : createDemoConversations();
    const savedId = loadActiveConversationId();
    if (savedId && convs.some((c) => c.id === savedId)) return savedId;
    return convs[0]?.id ?? null;
  });
  const [mode, setMode] = useState<Mode>(loadMode);
  const [username] = useState(loadUsername);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [middleTab, setMiddleTab] = useState<'chat' | 'code' | 'terminal' | 'skills'>('chat');
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [toolLogs, setToolLogs] = useState<ToolProgress[]>([]);
  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH);
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = loadProjects();
    return saved.length > 0 ? saved : [{ id: 'proj-0', name: 'devwhale', path: DEFAULT_PROJECT_PATH }];
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const saved = loadProjects();
    return saved.length > 0 ? saved[0].id : 'proj-0';
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [fileTree, setFileTree] = useState<FileNode | undefined>(undefined);
  const [lspServerId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // LSP: 暂时关闭自动启动（需确认 pyright 在打包环境中正确解析后再开启）
  // useEffect(() => {
  //   ...见 git history
  // }, [projectPath]);

  // 副作用：只执行一次
  useEffect(() => { migrateLegacyApiKey(); }, []);

  // ====== 持久化：自动保存（500ms 防抖，避免流式输出时写入风暴） ======
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConversations(conversations);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [conversations]);

  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    saveMode(mode);
  }, [mode]);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  // ====== 应用全局设置 ======
  // 初始化时应用字号
  useEffect(() => {
    const prefs = loadGeneralPreferences();
    document.documentElement.style.fontSize = `${prefs.fontSize}px`;
  }, []);

  // 首次启动不再自动弹出 —— 用户在未配置 API Key 时发送消息会收到引导提示

  // 动态获取项目路径（Electron 模式下用 documentDir）
  useEffect(() => {
    if (!isTauri()) return;
    const api = (window as any).electronAPI;
    if (api?.getDocumentDir) {
      api.getDocumentDir().then((dir: string) => {
        const clean = dir.replace(/[/\\]$/, '');
        setCurrentProjectPath(clean);
        setProjectPath(clean);
        setProjects([{ id: 'proj-0', name: '默认项目', path: clean }]);
        setActiveProjectId('proj-0');
      }).catch(() => {});
    }
  }, []);

  // 项目文件树同步加载
  useEffect(() => {
    if (!projectPath || !isTauri()) {
      setFileTree(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await listFilesRecursive(projectPath);
        if (cancelled) return;
        const files = raw.split('\n').map(l => l.trim()).filter(l => l);
        setFileTree(buildFileTree(files, projectPath));
      } catch {
        if (!cancelled) setFileTree(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  // 设置面板关闭时重新应用所有设置
  useEffect(() => {
    if (settingsOpen) return; // 只在关闭时触发
    const prefs = loadGeneralPreferences();
    document.documentElement.style.fontSize = `${prefs.fontSize}px`;
    // 强制刷新版本号，让子组件感知设置变化
    setSettingsVersion((v) => v + 1);
  }, [settingsOpen]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const handleSend = useCallback(
    (content: string, images?: string[]) => {
      if (!activeConversationId) return;

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                messages: [...c.messages, newMessage],
                updatedAt: Date.now(),
              }
            : c
        )
      );

      // 用真实 API 或 fallback 提示
      const providerId = loadProvider();
      const provider = getProviderConfig(providerId);
      const apiKey = provider.apiKey;

      if (!apiKey) {
        // 无 API Key：模拟回复
        const fullContent =
          `⚠️ 未配置 API Key\n\n请点击左下角头像 → 设置 → 模型 → 输入 DeepSeek API Key。\n\n` +
          `获取地址：https://platform.deepseek.com/api_keys`;
        const aiId = `msg-${Date.now()}-ai`;
        const emptyMsg: Message = { id: aiId, role: 'assistant', content: '', timestamp: Date.now(), files: [] };
        setConversations((prev) =>
          prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...c.messages, emptyMsg], updatedAt: Date.now() } : c)
        );
        let i = 0;
        const chars = [...fullContent];
        const speed = loadChatSettings().typingSpeed;
        const interval = setInterval(() => {
          i += 2;
          if (i >= chars.length) {
            clearInterval(interval);
            setConversations((prev) =>
              prev.map((c) => c.id === activeConversationId ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, content: fullContent, updatedAt: Date.now() } : m), updatedAt: Date.now() } : c)
            );
            return;
          }
          setConversations((prev) =>
            prev.map((c) => c.id === activeConversationId ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, content: chars.slice(0, i).join(''), updatedAt: Date.now() } : m) } : c)
          );
        }, speed);
        return;
      }

      // 真实 API 调用
      const aiId = `msg-${Date.now()}-ai`;
      const emptyMsg: Message = { id: aiId, role: 'assistant', content: '', timestamp: Date.now(), files: [] };
      setConversations((prev) =>
        prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...c.messages, emptyMsg], updatedAt: Date.now() } : c)
      );

      const history = conversations
        .find((c) => c.id === activeConversationId)
        ?.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })) || [];

      // 如果打开了文件，附上文件上下文
      let contextContent = content;
      if (openFiles.length > 0) {
        const fileContexts = openFiles.map((f) => {
          const marker = f.path === activeFilePath ? '【当前活跃】' : '';
          return `### ${marker}${f.path}\n\`\`\`${f.path.split('.').pop() || ''}\n${f.content}\n\`\`\``;
        }).join('\n\n');
        contextContent = '【已打开的文件】\n' + fileContexts + '\n\n【用户需求】\n' + content + '\n\n（如果用户要求修改代码，请用 ext:相对路径 格式标注代码块语言以便自动应用文件。例如用 tsx:src/App.tsx 作为代码块语言标注）';
      }

      let fullContent = '';

      setToolLogs([]);
      setIsStreaming(true);
      setTerminalOutput('');
      // 设置终端流式回调
      setTerminalOutputCallback((text) => {
        setTerminalOutput((prev) => prev + text);
      });

      // 创建 AbortController 用于中断
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // agentChat 用 await + try-catch 防止异常静默吞掉
      (async () => {
        try {
          await agentChat(
            contextContent,
            history,
            projectPath,
            {
              onToken: (token) => {
                fullContent += token;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeConversationId
                      ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, content: fullContent, updatedAt: Date.now() } : m), updatedAt: Date.now() }
                      : c
                  )
                );
              },
              onProgress: (progress) => {
                setToolLogs((prev) => {
                  const idx = prev.findIndex((t) => t.toolName === progress.toolName && JSON.stringify(t.args) === JSON.stringify(progress.args));
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = progress;
                    return next;
                  }
                  return [...prev, progress];
                });
              },
              onToolCall: async (name, args) => {
                const result = await executeToolCall(name, args);
                return result;
              },
              onDone: (usage) => {
                setIsStreaming(false);
                setTerminalOutputCallback(null);
                abortControllerRef.current = null;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeConversationId
                      ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, usage: usage || undefined, updatedAt: Date.now() } : m) }
                      : c
                  )
                );
              },
              onError: (err) => {
                setIsStreaming(false);
                setTerminalOutputCallback(null);
                abortControllerRef.current = null;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeConversationId
                      ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, content: `❌ ${err}`, updatedAt: Date.now() } : m), updatedAt: Date.now() }
                      : c
                  )
                );
              },
              onCancelled: () => {
                setIsStreaming(false);
                setTerminalOutputCallback(null);
                abortControllerRef.current = null;
              },
            },
            controller.signal,
            images,
          );
        } catch (e: any) {
          console.error('agentChat 崩溃:', e);
          setIsStreaming(false);
          setTerminalOutputCallback(null);
          abortControllerRef.current = null;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, messages: c.messages.map((m) => m.id === aiId ? { ...m, content: `❌ 系统错误: ${e.message || '未知'}`, updatedAt: Date.now() } : m), updatedAt: Date.now() }
                : c
            )
          );
        }
      })();
    },
    [activeConversationId, projectPath, openFiles, activeFilePath, conversations]
  );

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleExportConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const md = [
      `# ${conv.title}`,
      `> 导出时间：${new Date().toLocaleString()}`,
      ``,
      ...conv.messages.map((m) => {
        const role = m.role === 'user' ? '**你**' : '**DevWhale**';
        return `${role}\n\n${m.content}\n`;
      }),
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [conversations]);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title, updatedAt: Date.now() } : c))
    );
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // 如果删除的是当前活跃会话，自动切换
      if (id === activeConversationId) {
        const newActive = next[0]?.id ?? null;
        setActiveConversationId(newActive);
      }
      return next;
    });
  }, [activeConversationId]);

  const handleMoveConversation = useCallback((id: string, projectId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, project: projectId, updatedAt: Date.now() } : c))
    );
  }, []);

  const handleNewConversation = () => {
    handleNewConversationInProject(activeProjectId);
  };

  const handleNewConversationInProject = (projectId: string) => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: '新会话',
      project: projectId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const handleRenameProject = useCallback((id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    );
  }, []);

  const handleCreateProject = (name: string) => {
    const id = `proj-${Date.now()}`;
    const newProj: Project = { id, name: name.trim() || '新项目', path: projectPath };
    setProjects((prev) => [...prev, newProj]);
    setActiveProjectId(id);
  };

  const handleOpenFolder = async () => {
    const api = (window as any).electronAPI;
    if (api?.openFolderDialog) {
      try {
        const selected = await api.openFolderDialog();
        if (selected) {
          setCurrentProjectPath(selected);
          setProjectPath(selected);
          const name = selected.split(/[/\\]/).pop() || selected;
          const projId = `proj-${Date.now()}`;
          const newProj: Project = { id: projId, name, path: selected };
          let finalId = projId;
          setProjects((prev) => {
            const existing = prev.find((p) => p.path === selected);
            if (existing) { finalId = existing.id; return prev; }
            return [...prev, newProj];
          });
          setActiveProjectId(finalId);
        }
      } catch (e: any) { console.error('打开文件夹失败:', e); }
    } else {
      // 浏览器模式：模拟
      const p = prompt('输入项目文件夹路径:') || '';
      setCurrentProjectPath(p);
      setProjectPath(p);
    }
  };

  const handleSelectProject = (proj: Project) => {
    setCurrentProjectPath(proj.path);
    setProjectPath(proj.path);
    setActiveProjectId(proj.id); // 设为当前活跃项目，后续新建会话归入此项目
  };

  const handleSelectFile = async (path: string) => {
    // 检查是否已打开
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      setMiddleTab('code');
      return;
    }
    // 新打开：优先从磁盘真实读取
    let content = '';
    const api = (window as any).electronAPI;
    if (api?.readFile && projectPath) {
      const fullPath = path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path)
        ? path
        : `${projectPath}/${path}`.replace(/\\/g, '/');
      try {
        const r = await api.readFile(fullPath);
        if (r.success) content = r.data || '';
      } catch {}
    }
    if (!content) {
      content = DEMO_FILES[path] || '// 文件内容未加载\n// 连接真实项目后可读取';
    }
    const newFile: OpenFile = { path, content, isDirty: false };
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFilePath(path);
    setMiddleTab('code');
  };

  const handleCloseFile = (path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      // 如果关闭的是当前活动文件，切换到最后一个
      if (path === activeFilePath && next.length > 0) {
        setActiveFilePath(next[next.length - 1].path);
      } else if (next.length === 0) {
        setActiveFilePath(null);
        setMiddleTab('chat');
      }
      return next;
    });
  };

  const handleSaveFile = async (path: string, content: string) => {
    if (isTauri()) {
      const fullPath = path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path)
        ? path
        : `${projectPath}/${path}`;
      await writeTextFile(fullPath, content);
    }
    // 更新 openFiles 和 demo 缓存
    setOpenFiles((prev) => prev.map((f) => f.path === path ? { ...f, content, isDirty: false } : f));
    DEMO_FILES[path] = content;
  };

  return (
    <div className="flex h-screen w-screen bg-surface-0">
      {/* 左侧栏：会话列表 */}
      <div className="w-64 shrink-0">
        <Sidebar
          key={settingsVersion}
          conversations={conversations}
          projects={projects}
          activeConversationId={activeConversationId}
          activeProjectId={activeProjectId}
          username={username}
          mode={mode}
          onSelectConversation={setActiveConversationId}
          onNewConversation={handleNewConversation}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenFolder={handleOpenFolder}
          onSelectProject={handleSelectProject}
          onExportConversation={handleExportConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onMoveConversation={handleMoveConversation}
          onNewConversationInProject={handleNewConversationInProject}
          onCreateProject={handleCreateProject}
          onRenameProject={handleRenameProject}
        />
      </div>

      {/* 分隔条 */}
      <div className="w-px bg-surface-200 shrink-0" />

      {/* 中间主区域 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Tab 栏 */}
        <div className="flex items-center border-b border-surface-200 bg-surface-50 px-2 gap-1">
          <button
            onClick={() => setMiddleTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
              middleTab === 'chat'
                ? 'text-accent border-accent bg-surface-0'
                : 'text-surface-400 border-transparent hover:text-surface-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            对话
          </button>
          <button
            onClick={() => setMiddleTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
              middleTab === 'terminal'
                ? 'text-accent border-accent bg-surface-0'
                : 'text-surface-400 border-transparent hover:text-surface-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            终端
          </button>
          <button
            onClick={() => setMiddleTab('skills')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
              middleTab === 'skills'
                ? 'text-accent border-accent bg-surface-0'
                : 'text-surface-400 border-transparent hover:text-surface-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Skill
          </button>
          {activeFilePath && (
            <button
              onClick={() => setMiddleTab('code')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
                middleTab === 'code'
                  ? 'text-accent border-accent bg-surface-0'
                  : 'text-surface-400 border-transparent hover:text-surface-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              </svg>
              {activeFilePath.split('/').pop()}
            </button>
          )}
          {/* 模式指示 + 提供商 */}
          <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${
            mode === 'yolo' ? 'bg-purple-500/10 text-purple-500' :
            mode === 'ask' ? 'bg-blue-500/10 text-blue-500' :
            'bg-amber-500/10 text-amber-500'
          }`}>
            {mode.toUpperCase()}
          </span>
          <span className="text-[10px] text-surface-400 font-medium">
            {getProviderConfig(loadProvider()).name}
          </span>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0">
          {middleTab === 'chat' ? (
            <ChatArea
              key={settingsVersion}
              messages={activeConversation?.messages || []}
              mode={mode}
              onModeChange={setMode}
              onSend={handleSend}
              isStreaming={isStreaming}
              onAbort={handleAbort}
              onDeleteMessage={(msgId) => {
                setConversations((prev) =>
                  prev.map((c) => c.id === activeConversationId
                    ? { ...c, messages: c.messages.filter((m) => m.id !== msgId), updatedAt: Date.now() }
                    : c)
                );
              }}
              onRetryMessage={(msgId) => {
                const conv = conversations.find((c) => c.id === activeConversationId);
                const msg = conv?.messages.find((m) => m.id === msgId);
                if (msg?.content) {
                  setConversations((prev) =>
                    prev.map((c) => c.id === activeConversationId
                      ? { ...c, messages: c.messages.filter((m) => m.id !== msgId), updatedAt: Date.now() }
                      : c)
                  );
                  handleSend(msg.content, msg.files?.map((f) => f.content).filter(Boolean) as string[] | undefined);
                }
              }}
            />
          ) : middleTab === 'terminal' ? (
            <TerminalPanel cwd={projectPath} toolLogs={toolLogs} liveOutput={terminalOutput} />
          ) : middleTab === 'skills' ? (
            <SkillStore />
          ) : (
            <CodeViewer
              openFiles={openFiles}
              activeFilePath={activeFilePath}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
              onSaveFile={handleSaveFile}
              lspServerId={lspServerId}
            />
          )}
        </div>
      </div>

      {/* 分隔条 */}
      {!rightPanelCollapsed && <div className="w-px bg-surface-200 shrink-0" />}

      {/* 右侧面板 */}
      <div className={`${rightPanelCollapsed ? 'w-0 overflow-hidden' : 'w-72'} shrink-0 transition-all duration-200`}>
        <RightPanel
          key={settingsVersion}
          todos={DEMO_TODOS}
          toolLogs={toolLogs}
          activeFilePath={activeFilePath}
          onSelectFile={handleSelectFile}
          fileTree={fileTree}
          projectName={projects.find(p => p.id === activeProjectId)?.name}
        />
      </div>

      {/* 折叠按钮 */}
      <button
        onClick={() => setRightPanelCollapsed((prev) => !prev)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-10 w-5 h-12
                   bg-surface-100 border border-surface-300 rounded-l-lg
                   flex items-center justify-center hover:bg-surface-200 transition-colors"
        title={rightPanelCollapsed ? '展开右侧面板' : '折叠右侧面板'}
      >
        <svg
          className={`w-3 h-3 text-surface-500 transition-transform ${rightPanelCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 设置面板 */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default App;
