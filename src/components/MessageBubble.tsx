import { useState, useCallback } from 'react';
import { Message } from '../types/chat';
import { formatTime } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { loadChatSettings } from '../lib/storage';
import { t } from '../lib/i18n';
import { execCommand, isRunnable, getRunCommand, writeFileContent } from '../lib/shell';
import { isTauri } from '../lib/tauriFs';
import { getCurrentProjectPath } from '../lib/tools';
import { createCheckpoint } from '../lib/checkpoint';
import { DiffViewer } from './DiffViewer';

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
}

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copiedMsg, setCopiedMsg] = useState(false);
  const settings = loadChatSettings();

  const copyMessage = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    });
  }, [message.content]);

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-[11px] text-surface-400 bg-surface-100/80 px-3 py-1 rounded-full font-medium backdrop-blur-sm">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${settings.density === 'compact' ? 'px-3 py-1' : 'px-5 py-2.5'} group/message ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`
          shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-1
          ${isUser
            ? 'bg-accent text-white'
            : 'bg-surface-100 text-accent ring-1 ring-surface-200/50'
          }
        `}
      >
        {isUser ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </div>

      {/* 消息体 */}
      <div className={`max-w-[78%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* 气泡 */}
        <div
          className={`
            relative rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'bg-accent text-white rounded-br-md shadow-[0_2px_12px_rgba(124,58,237,0.2)]'
              : 'bg-white text-surface-700 rounded-bl-md shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]'
            }
          `}
        >
          {/* 发送者 + 时间 */}
          <div className={`flex items-center gap-2 mb-1.5 ${isUser ? 'justify-end' : ''}`}>
            <span className={`text-[10px] font-semibold ${isUser ? 'text-white/70' : 'text-surface-500'}`}>
              {isUser ? t('user.you') : t('user.bob')}
            </span>
            {settings.showTimestamps && (
              <span className={`text-[10px] tabular-nums ${isUser ? 'text-white/50' : 'text-surface-400'}`}>
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>

          {/* 正文 */}
          <div className={`
            prose prose-sm max-w-none break-words
            prose-headings:text-inherit
            prose-p:my-1 prose-p:leading-relaxed
            prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-normal
            prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0
            prose-a:underline prose-a:underline-offset-2
            prose-strong:text-inherit
            prose-ul:my-1 prose-li:my-0.5
            prose-table:text-xs prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5
            [&_code]:before:hidden [&_code]:after:hidden
            ${isUser
              ? 'prose-code:bg-white/20 prose-code:text-white'
              : 'prose-code:bg-surface-100 prose-code:text-accent'
            }
          `}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre: ({ children }) => <>{children}</>,
                code: (props) => <CodeBlock {...props} codeTheme={settings.codeTheme} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* 文件引用 chip */}
          {message.files && message.files.length > 0 && (
            <div className={`mt-2.5 pt-2.5 border-t flex flex-wrap gap-1.5 ${isUser ? 'border-white/15' : 'border-surface-200'}`}>
              {message.files.map((file, i) => (
                <span
                  key={i}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                    ${isUser
                      ? 'bg-white/15 text-white/80'
                      : 'bg-surface-100 text-surface-600 ring-1 ring-surface-200/50'
                    }
                  `}
                >
                  <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  </svg>
                  <span className="truncate max-w-[140px]">{file.path}</span>
                </span>
              ))}
            </div>
          )}

          {/* Token 用量 */}
          {!isUser && message.usage && (
            <div className={`mt-2 pt-2 border-t flex items-center gap-3 text-[10px] ${isUser ? 'border-white/15 text-white/50' : 'border-surface-200 text-surface-400'}`}>
              <span>↑ {message.usage.prompt.toLocaleString()}</span>
              <span>↓ {message.usage.completion.toLocaleString()}</span>
              {message.usage.cacheHit > 0 && (
                <span className="text-green-500" title={`缓存命中 ${message.usage.cacheHit.toLocaleString()} tokens`}>
                  🚀 {Math.round((message.usage.cacheHit / message.usage.prompt) * 100)}%
                </span>
              )}
              <span className="ml-auto">{(message.usage.prompt + message.usage.completion).toLocaleString()} tokens</span>
            </div>
          )}
        </div>

        {/* 操作栏（hover 时显示） */}
        <div
          className={`
            flex items-center gap-1 mt-1 px-1 transition-opacity duration-150
            opacity-0 group-hover/message:opacity-100
            ${isUser ? 'flex-row-reverse self-start' : 'flex-row self-end'}
          `}
        >
          <button
            onClick={copyMessage}
            className="p-1 rounded-md text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            title="复制消息"
          >
            {copiedMsg ? (
              <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded-md text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              title="重新生成"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====== 代码块组件（语言标签 + 复制按钮） ====== */
function CodeBlock({ className, children, codeTheme, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [runError, setRunError] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  // 检测 ext:路径 格式（如 tsx:src/App.tsx）
  const fileMatch = language.match(/^(\w+):(.+)$/);
  const actualLang = fileMatch ? fileMatch[1] : language;
  const filePath = fileMatch ? fileMatch[2] : null;
  const isDark = codeTheme !== 'light';
  const canRun = isRunnable(actualLang);

  // 行内代码
  if (!language && !className?.includes('language-')) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const codeText = typeof children === 'string' ? children : '';

  // diff/patch 代码块用 DiffViewer 渲染
  if (language === 'diff' || language === 'patch' || codeText.startsWith('diff --git ')) {
    return <DiffViewer diffText={codeText} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRun = async () => {
    setRunning(true); setOutput(null); setRunError(false);
    try {
      const cmd = getRunCommand(actualLang);
      let execArgs: string[];
      if (actualLang === 'python') {
        execArgs = ['-c', codeText];
      } else if (actualLang === 'powershell') {
        execArgs = ['-NoProfile', '-Command', codeText];
      } else {
        execArgs = ['-c', codeText];
      }
      const result = await execCommand(cmd.program, execArgs);
      setOutput(result || '(命令执行成功，无输出)');
    } catch (e: any) {
      setOutput(e.message || '执行失败');
      setRunError(true);
    } finally {
      setRunning(false);
    }
  };

  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!filePath) return;
    setApplying(true);
    setApplyError(null);
    try {
      const projectRoot = getCurrentProjectPath();
      const fullPath = projectRoot
        ? `${projectRoot}/${filePath}`.replace(/\\/g, '/')
        : filePath;

      if (isTauri()) {
        // 写前备份
        await createCheckpoint(fullPath, 'apply', `从对话 Apply: ${filePath}`).catch(() => {});
        await writeFileContent(fullPath, codeText);
      }
      // 浏览器模式也更新 demo 缓存
      try {
        const { DEMO_FILES } = await import('./CodeViewer');
        DEMO_FILES[filePath] = codeText;
      } catch {}

      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } catch (e: any) {
      setApplyError(e.message || '写入失败');
      setTimeout(() => setApplyError(null), 4000);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`my-3 rounded-xl overflow-hidden border ${isDark ? 'border-surface-600/30 bg-surface-800' : 'border-surface-200 bg-surface-50'}`}>
      {/* 语言标签栏 */}
      <div className={`flex items-center justify-between px-4 py-1.5 border-b ${isDark ? 'bg-surface-700/50 border-surface-600/30' : 'bg-surface-200/50 border-surface-200'}`}>
        <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-surface-400' : 'text-surface-500'}`}>
          {filePath ? `${actualLang} → ${filePath}` : (actualLang || 'code')}
        </span>
        <div className="flex items-center gap-1">
          {filePath && (
            <button
              onClick={handleApply}
              disabled={applying}
              className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                applyError
                  ? 'bg-red-500/20 text-red-500'
                  : applied
                  ? 'bg-success/20 text-success'
                  : 'bg-accent/20 text-accent hover:bg-accent/30'
              }`}
              title={applyError || (applied ? '已写入' : filePath ? `写入 ${filePath}` : '')}
            >
              {applying ? '⏳ 写入中' : applyError ? '❌ 失败' : applied ? '✓ 已应用' : '📥 应用'}
            </button>
          )}
          {canRun && (
            <button
              onClick={handleRun}
              disabled={running}
              className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                running ? 'text-surface-400 cursor-wait' : 'bg-success/20 text-success hover:bg-success/30'
              }`}
            >
              {running ? '⏳' : '▶ 运行'}
            </button>
          )}
          <button onClick={handleCopy} className={`text-[10px] font-medium transition-colors ${copied ? 'text-success' : isDark ? 'text-surface-400 hover:text-surface-300' : 'text-surface-500 hover:text-surface-600'}`}>
            {copied ? t('chat.code.copied') : t('chat.code.copy')}
          </button>
        </div>
      </div>
      {/* 代码区 */}
      <pre className="!m-0 !rounded-none !bg-transparent !p-4 overflow-x-auto">
        <code className={`${className || ''} !bg-transparent !p-0 text-xs leading-relaxed ${isDark ? 'text-surface-100' : 'text-surface-700'}`} {...props}>
          {children}
        </code>
      </pre>
      {/* 运行结果 */}
      {output !== null && (
        <div className={`px-4 py-2 border-t text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto ${
          runError
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-green-500/10 text-green-400 border-green-500/20'
        }`}>
          {output}
        </div>
      )}
    </div>
  );
}
