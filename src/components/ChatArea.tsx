import { useRef, useEffect, useState, useCallback } from 'react';
import { Message } from '../types/chat';
import { MessageBubble } from './MessageBubble';
import { Mode } from '../types/chat';
import { loadChatSettings } from '../lib/storage';
import { t } from '../lib/i18n';

interface ChatAreaProps {
  messages: Message[];
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSend: (content: string, images?: string[]) => void;
  isStreaming?: boolean;
  onAbort?: () => void;
  onDeleteMessage?: (msgId: string) => void;
  onRetryMessage?: (msgId: string) => void;
}

interface DroppedFile {
  name: string;
  path: string;
  content: string;
  isImage: boolean;
  imageBase64?: string;
  imageMime?: string;
}

export function ChatArea({ messages, mode, onModeChange, onSend, isStreaming, onAbort, onDeleteMessage, onRetryMessage }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const settings = loadChatSettings();

  const modes: { key: Mode; label: string; desc: string }[] = [
    { key: 'yolo', label: 'YOLO', desc: '全自动执行' },
    { key: 'ask', label: 'Ask', desc: '每步确认' },
    { key: 'plan', label: 'Plan', desc: '先计划后执行' },
  ];

  useEffect(() => {
    if (!settings.autoScroll) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, settings.autoScroll]);

  // 点击外部关闭文件菜单
  useEffect(() => {
    if (!showFileMenu) return;
    const handler = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFileMenu]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && droppedFiles.length === 0) return;
    
    // 如果有拖入文件，附带文件内容
    let finalContent = trimmed;
    const imageBases: string[] = [];
    if (droppedFiles.length > 0) {
      const fileContexts = droppedFiles.map((f) => {
        if (f.isImage) {
          if (f.imageBase64) {
            const mime = f.imageMime || 'image/png';
            imageBases.push(`data:${mime};base64,${f.imageBase64}`);
          }
          return `[图片: ${f.name}]`;
        }
        return `【文件: ${f.name}】\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``;
      }).join('\n\n');
      finalContent = fileContexts + (trimmed ? '\n\n【用户需求】\n' + trimmed : '');
      setDroppedFiles([]);
    }
    
    onSend(finalContent, imageBases.length > 0 ? imageBases : undefined);
    setInput('');
    inputRef.current?.focus();
  };

  /** 判断文件是否为图片（按扩展名） */
  const isImageExt = (name: string) => /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(name);
  /** 判断是否为 Office 格式（需要走 IPC 提取文本） */
  const isOffice = (name: string) => /\.(docx|xlsx|pptx|doc|xls|ppt)$/i.test(name);

  /** 公共：处理一批 File 对象，读取内容并添加到预览列表 */
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const newDropped: DroppedFile[] = [];
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    for (const file of files) {
      const isImg = file.type.startsWith('image/') || isImageExt(file.name);
      const fp = (file as { path?: string; name: string }).path || file.name;
      let content = '';
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      if (isImg) {
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = (reader.result as string);
            const m = result.match(/^data:([^;]+);base64,(.+)$/);
            if (m) { imageMime = m[1]; resolve(m[2]); }
            else resolve(result.split(',')[1] || '');
          };
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      } else if (isOffice(file.name) && api?.readFile && fp) {
        // Office 格式：走 IPC 触发主进程 docx/xlsx 解压提取
        try {
          const r = await api.readFile(fp);
          content = r.success ? (r.data || '') : '';
        } catch { content = ''; }
        if (!content) content = `[Office 文件: ${file.name} — 无法提取文本]`;
      } else {
        content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string || '');
          reader.onerror = () => resolve('');
          reader.readAsText(file);
        });
      }
      newDropped.push({
        name: file.name,
        path: fp,
        content,
        isImage: isImg,
        imageBase64,
        imageMime,
      });
    }
    setDroppedFiles((prev) => [...prev, ...newDropped]);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    await processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  /** 加号按钮 → 弹出菜单 → 选择图片/文件 → 原生对话框 */
  const handleAddFiles = useCallback(async (filterType: 'image' | 'code') => {
    setShowFileMenu(false);
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    if (api?.openFileDialog && api?.readBinaryFile) {
      // === Electron：原生文件对话框 ===
      const paths: string[] | null = await api.openFileDialog(filterType);
      if (!paths || paths.length === 0) return;
      const newDropped: DroppedFile[] = [];
      for (const fp of paths) {
        const name = fp.replace(/\\/g, '/').split('/').pop() || fp;
        const isImg = isImageExt(name);
        if (isImg) {
          const r = await api.readBinaryFile(fp);
          if (r.success) {
            const ext = name.split('.').pop()?.toLowerCase() || 'png';
            const mimeMap: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp', ico:'image/x-icon' };
            newDropped.push({
              name, path: fp, content: '', isImage: true,
              imageBase64: r.data,
              imageMime: mimeMap[ext] || 'image/png',
            });
          }
        } else {
          const r = await api.readFile(fp);
          const content = r.success ? (r.data || '') : '';
          newDropped.push({ name, path: fp, content, isImage: false });
        }
      }
      setDroppedFiles((prev) => [...prev, ...newDropped]);
    } else {
      // === 浏览器回退：input[type=file] ===
      fileInputRef.current?.click();
    }
  }, []);

  /** input[file] onChange（浏览器模式下由 handleAddFiles 间接触发） */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-surface-0"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      onDrop={handleDrop}
    >
      {/* 拖入提示蒙层 */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/10 backdrop-blur-sm pointer-events-none">
          <div className="px-6 py-4 rounded-2xl bg-white shadow-xl border-2 border-dashed border-accent text-accent font-medium text-sm">
            📎 释放文件以添加到对话
          </div>
        </div>
      )}

      {/* 拖入文件预览 */}
      {droppedFiles.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-muted border-b border-accent-border overflow-x-auto">
          <span className="text-[11px] font-medium text-accent shrink-0">已添加 {droppedFiles.length} 个文件：</span>
          {droppedFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-accent-border text-[11px] text-surface-600 shrink-0">
              {f.isImage ? '🖼️' : '📄'} {f.name}
              <button onClick={() => setDroppedFiles((prev) => prev.filter((_, j) => j !== i))} className="text-surface-400 hover:text-red-500 ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-surface-400 select-none">
              <div className="w-16 h-16 mb-5 rounded-2xl bg-surface-100 flex items-center justify-center">
                <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-surface-500">{t('chat.emptyTitle')}</p>
              <p className="text-sm mt-1.5 text-surface-400">{t('chat.emptyDesc')}</p>
              <div className="flex gap-2 mt-5">
                {[t('chat.hint1'), t('chat.hint2'), t('chat.hint3')].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => {
                      setInput(hint);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-surface-500
                               bg-surface-50 border border-surface-200 rounded-lg
                               hover:bg-surface-100 hover:border-surface-300
                               hover:text-surface-600 transition-all"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={settings.density === 'compact' ? 'py-0.5' : 'py-2'}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onDelete={onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
                  onRetry={msg.role === 'user' && onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-surface-200 bg-surface-0 px-4 pb-4 pt-3">
        <div className="max-w-3xl mx-auto">
          <div
            className={`
              flex items-end gap-2 p-1.5 rounded-2xl transition-all duration-200
              bg-surface-50 border
              ${isFocused
                ? 'border-accent-border ring-2 ring-accent-muted shadow-sm'
                : 'border-surface-300 hover:border-surface-400'
              }
            `}
          >
            {/* 多模态附件按钮 — 加号弹出 / 收起菜单 */}
            {!showFileMenu ? (
              <button
                onClick={() => setShowFileMenu(true)}
                className="shrink-0 p-2 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-200 transition-colors"
                title="添加图片或文件"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ) : (
              <div ref={fileMenuRef} className="shrink-0 flex flex-col gap-0.5 bg-surface-100 rounded-xl p-1">
                <button
                  onClick={() => handleAddFiles('image')}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-surface-600 hover:text-surface-700 hover:bg-surface-200 rounded-lg transition-colors"
                  title="上传图片 (PNG/JPG/GIF/WebP/SVG, ≤20MB)"
                >
                  <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>上传图片</span>
                </button>
                <button
                  onClick={() => handleAddFiles('code')}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-surface-600 hover:text-surface-700 hover:bg-surface-200 rounded-lg transition-colors"
                  title="上传文件 (代码/文档, ≤20MB)"
                >
                  <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
                  </svg>
                  <span>上传文件</span>
                </button>
                <button
                  onClick={() => setShowFileMenu(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-surface-400 hover:text-surface-600 hover:bg-surface-200 rounded-lg transition-colors"
                  title="取消"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>取消</span>
                </button>
              </div>
            )}
            {/* 浏览器模式回退：隐藏的 input[file] */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.ts,.tsx,.js,.jsx,.css,.html,.json,.md,.rs,.py,.toml,.yml,.yaml,.txt,.env,.gitignore,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.xml,.sql,.sh,.bat,.java,.go,.rb,.php,.c,.cpp,.h"
              onChange={handleFileSelect}
              className="sr-only"
            />

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-surface-700
                         placeholder-surface-400 outline-none min-h-[36px] max-h-[180px]"
            />

            <button
              onClick={handleSend}
              disabled={(!input.trim() && droppedFiles.length === 0) || isStreaming}
              className={`
                shrink-0 p-2 rounded-xl transition-all duration-200
                ${isStreaming
                  ? 'bg-surface-200 text-surface-400 cursor-not-allowed'
                  : input.trim()
                  ? 'bg-accent text-white hover:bg-accent-hover shadow-sm hover:shadow-md active:scale-95'
                  : 'bg-surface-200 text-surface-400 cursor-not-allowed'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 停止按钮（仅在流式输出时显示） */}
          {isStreaming && onAbort && (
            <div className="flex justify-center mt-2">
              <button
                onClick={onAbort}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                停止生成
              </button>
            </div>
          )}

          {/* 模式切换 + 提示 */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1">
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => onModeChange(m.key)}
                  title={m.desc}
                  className={`
                    px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150
                    ${mode === m.key
                      ? 'bg-accent-muted text-accent border border-accent-border'
                      : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100 border border-transparent'
                    }
                  `}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-surface-400 tabular-nums">
              {mode === 'yolo' ? 'YOLO · 全自动' : mode === 'ask' ? 'Ask · 每步确认' : 'Plan · 先计划'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
