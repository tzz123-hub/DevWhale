/**
 * TerminalPanel —— xterm.js 终端模拟器
 * 通过 Electron IPC 执行 shell 命令，输出显示在 xterm.js 终端中
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { execCommand } from '../lib/shell';
import { ToolProgress } from '../lib/api';
import { startDebug, stopDebug, debugContinue, debugStepOver, setupDebugListener, type DebugState } from '../lib/debugger';

import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  cwd?: string;
  toolLogs?: ToolProgress[];
  liveOutput?: string;
}

export function TerminalPanel({ cwd, toolLogs = [], liveOutput = '' }: TerminalPanelProps) {
  const _cwd = cwd; // kept for legacy
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState('');
  const [debugState, setDebugState] = useState<DebugState | null>(null);
  const [debugFile, setDebugFile] = useState('');
  const debugListenerRef = useRef<(() => void) | null>(null);

  // 初始化调试器事件监听
  useEffect(() => {
    debugListenerRef.current = setupDebugListener({
      onStateChange: (s) => setDebugState(s),
      onOutput: (text) => {
        const term = termRef.current;
        if (term) term.writeln(text);
      },
    });
    return () => { debugListenerRef.current?.(); };
  }, []);

  const handleDebugStart = async () => {
    if (!debugFile.trim()) return;
    try {
      await startDebug(debugFile.trim(), _cwd || '.', {
        onStateChange: (s) => setDebugState(s),
        onOutput: (text) => {
          const term = termRef.current;
          if (term) term.writeln(text);
        },
      });
    } catch (e: unknown) {
      const term = termRef.current;
      if (term) term.writeln(`\x1b[1;31m✗ Debug: ${e instanceof Error ? e.message : String(e)}\x1b[0m`);
    }
  };

  // 初始化 xterm
  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5d7',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // 欢迎信息
    term.writeln('\x1b[1;36mDevWhale 终端\x1b[0m');
    term.writeln('输入命令后按 Enter 执行。type \x1b[33mhelp\x1b[0m 查看可用命令');
    term.writeln('');

    const handleResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // 执行命令
  const executeCommand = useCallback(async (cmd: string) => {
    const term = termRef.current;
    if (!term || !cmd.trim()) return;

    setRunning(true);
    term.writeln(`\x1b[1;32m>\x1b[0m ${cmd}`);

    try {
      const result = await execCommand('powershell', ['-NoProfile', '-Command', cmd]);
      if (result) {
        for (const line of result.split('\n')) {
          term.writeln(line.replace(/\r/g, ''));
        }
      }
    } catch (e: unknown) {
      term.writeln(`\x1b[1;31m✗ ${e instanceof Error ? e.message : '执行失败'}\x1b[0m`);
    }

    term.writeln('');
    setRunning(false);
    try { term.scrollToBottom(); } catch {}

    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    historyIdx; // TS6133 suppress
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      executeCommand(input.trim());
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryIdx((prev) => {
        const next = prev < history.length - 1 ? prev + 1 : prev;
        const cmd = history[history.length - 1 - next];
        if (cmd) setInput(cmd);
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryIdx((prev) => {
        const next = prev > 0 ? prev - 1 : -1;
        setInput(next >= 0 ? history[history.length - 1 - next] : '');
        return next;
      });
    }
  };

  // 快捷命令
  const quickCommands = ['ls', 'npm run dev', 'git status', 'npx tsc --noEmit', 'python --version', 'clear'];

  const handleClear = () => {
    const term = termRef.current;
    if (term) term.clear();
  };

  // 过滤 Agent 的命令执行记录
  const agentCommands = toolLogs.filter((t) => t.toolName === 'exec_command');
  const [showAgentLog, setShowAgentLog] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* 快捷命令栏 + 调试器 */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] overflow-x-auto">
        {/* 调试文件输入 */}
        <input
          type="text"
          value={debugFile}
          onChange={(e) => setDebugFile(e.target.value)}
          placeholder="script.js (调试)"
          className="w-28 px-2 py-0.5 text-[11px] font-mono bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] placeholder-[#484f58] outline-none focus:border-[#58a6ff] shrink-0"
        />
        {!debugState?.running ? (
          <button onClick={handleDebugStart} disabled={!debugFile.trim()} className="shrink-0 px-2 py-0.5 text-[11px] font-medium text-[#3fb950] hover:bg-[#21262d] rounded disabled:opacity-40 transition-colors">
            ▶ 调试
          </button>
        ) : debugState.paused ? (
          <>
            <button onClick={() => debugContinue()} className="shrink-0 px-2 py-0.5 text-[11px] font-medium text-[#58a6ff] hover:bg-[#21262d] rounded transition-colors">▶ 继续</button>
            <button onClick={() => debugStepOver()} className="shrink-0 px-2 py-0.5 text-[11px] font-medium text-[#d29922] hover:bg-[#21262d] rounded transition-colors">⤵ 跳过</button>
            <button onClick={() => stopDebug()} className="shrink-0 px-2 py-0.5 text-[11px] font-medium text-[#ff7b72] hover:bg-[#21262d] rounded transition-colors">■ 停止</button>
          </>
        ) : (
          <button onClick={() => stopDebug()} className="shrink-0 px-2 py-0.5 text-[11px] font-medium text-[#ff7b72] hover:bg-[#21262d] rounded transition-colors">■ 停止</button>
        )}
        {debugState?.paused && debugState.currentFile && (
          <span className="text-[10px] text-[#d29922] font-mono truncate shrink-0 ml-1">
            ⏸ {debugState.currentFile.split('/').pop()}:{debugState.currentLine}
          </span>
        )}
        <span className="w-px h-4 bg-[#30363d] mx-1 shrink-0" />
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd === 'clear' ? 'clear' : cmd)}
            className="shrink-0 px-2 py-0.5 text-[11px] font-mono text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded transition-colors"
          >
            {cmd}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="shrink-0 ml-auto px-2 py-0.5 text-[11px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded transition-colors"
        >
          clear
        </button>
      </div>

      {/* 实时命令输出 */}
      {liveOutput && (
        <div className="border-b border-[#30363d] bg-[#0d1117]">
          <div className="px-3 py-1 text-[10px] text-[#58a6ff] font-medium border-b border-[#30363d] bg-[#161b22]">
            ● Agent 正在执行...
          </div>
          <pre className="px-3 py-2 text-[11px] font-mono text-[#c9d1d9] max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
            {liveOutput}
          </pre>
        </div>
      )}

      {/* Agent 命令历史（可折叠） */}
      {agentCommands.length > 0 && (
        <div className="border-b border-[#30363d] bg-[#0d1117]">
          <button
            onClick={() => setShowAgentLog(!showAgentLog)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22] transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showAgentLog ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Agent 命令 ({agentCommands.length})
            <span className="text-[10px] ml-auto">最近执行</span>
          </button>
          {showAgentLog && (
            <div className="max-h-24 overflow-y-auto px-3 pb-2 space-y-0.5">
              {agentCommands.slice(-5).reverse().map((cmd, i) => (
                <div key={i} className="text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className={cmd.status === 'ok' ? 'text-[#3fb950]' : cmd.status === 'fail' ? 'text-[#ff7b72]' : 'text-[#d29922]'}>
                      {cmd.status === 'ok' ? '✓' : cmd.status === 'fail' ? '✗' : '●'}
                    </span>
                    <span className="text-[#58a6ff]">{cmd.args?.command || '?'}</span>
                  </div>
                  {cmd.result && (
                    <div className="text-[10px] text-[#8b949e] ml-5 whitespace-pre-wrap break-all line-clamp-2">
                      {cmd.result.slice(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 调试器详情（暂停时展示） */}
      {debugState?.paused && (
        <div className="border-t border-[#30363d] bg-[#0d1117]">
          <div className="flex max-h-60">
            {/* 调用堆栈 */}
            <div className="flex-1 border-r border-[#30363d] p-2">
              <div className="text-[10px] font-semibold text-[#8b949e] uppercase mb-1">调用堆栈</div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {debugState.callStack.map((f, i) => (
                  <div key={i} className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${i === 0 ? 'text-[#58a6ff] bg-[#1f2937]' : 'text-[#8b949e]'}`}>
                    <span className="font-semibold">{f.name}</span>
                    <span className="ml-2 text-[10px] opacity-60">{f.file.split('/').pop()}:{f.line}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 变量 */}
            <div className="flex-1 p-2">
              <div className="text-[10px] font-semibold text-[#8b949e] uppercase mb-1">变量</div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {debugState.variables.length > 0 ? debugState.variables.map((v, i) => (
                  <div key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#1f2937] flex">
                    <span className="text-[#79c0ff]">{v.name}</span>
                    <span className="text-[#8b949e] mx-1.5">=</span>
                    <span className="text-[#56d364] font-mono truncate">{v.value}</span>
                    <span className="text-[10px] text-[#484f58] ml-auto shrink-0">{v.type}</span>
                  </div>
                )) : (
                  <div className="text-[10px] text-[#484f58]">等待断点触发...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* xterm 终端显示区 */}
      <div ref={containerRef} className="flex-1 overflow-hidden px-2 pt-1" />

      {/* 命令输入栏 */}
      <div className="flex items-center border-t border-[#30363d] bg-[#161b22] px-3 py-1.5">
        <span className="text-[#3fb950] font-mono text-xs mr-2 shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? '执行中...' : '输入命令，Enter 执行...'}
          className="flex-1 bg-transparent border-none outline-none text-[#c9d1d9] font-mono text-xs placeholder-[#484f58]"
          autoFocus
        />
        {running && (
          <span className="text-[#d29922] text-[10px] animate-pulse ml-2">●</span>
        )}
      </div>
    </div>
  );
}
