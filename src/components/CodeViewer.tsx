import { useState, useRef, useEffect, useMemo } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { getAICompletion } from '../lib/completion';
import { getLspDiagnostics } from '../lib/lsp';

/* ====== 类型 ====== */

export interface OpenFile {
  path: string;
  content: string;
  isDirty: boolean;
}

interface CodeViewerProps {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onSaveFile: (path: string, content: string) => void;
  inlineDiffs?: Record<string, { added: number[]; removed: number[] }>;
  lspServerId?: string | null; // LSP 诊断数据源
  breakpoints?: { file: string; line: number }[]; // 调试断点
  activeDebugLine?: number | null; // 当前暂停行
}

/* ====== 语言推断 ====== */

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx': return 'typescript';
    case 'ts': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'rs': return 'rust';
    case 'toml': return 'ini';
    case 'py': return 'python';
    case 'yml': case 'yaml': return 'yaml';
    default: return 'plaintext';
  }
}

/* ====== 演示文件 ====== */

export const DEMO_FILES: Record<string, string> = {
  'src/App.tsx': `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">DevWhale</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}

export default App;
`,
  'src/index.css': `@import "tailwindcss";

:root {
  --surface-0: #ffffff;
  --surface-50: #f8f9fa;
  --accent: #7c3aed;
}
`,
};

/* ====== 组件 ====== */

export function CodeViewer({
  openFiles,
  activeFilePath,
  onSelectFile,
  onCloseFile,
  onSaveFile,
  inlineDiffs,
  lspServerId,
  breakpoints = [],
  activeDebugLine,
}: CodeViewerProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const modelsRef = useRef<Map<string, editor.ITextModel>>(new Map());
  const decorationsRef = useRef<string[]>([]);
  const [localDirty, setLocalDirty] = useState<Record<string, boolean>>({});
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [editorSelection, setEditorSelection] = useState('');

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const language = activeFilePath ? langFromPath(activeFilePath) : 'plaintext';

  // LSP 诊断轮询（仅 Python 等有 LSP 的语言）
  useEffect(() => {
    if (!lspServerId || !activeFilePath || !monacoRef.current) return;
    let cancelled = false;
    const fetchDiag = async () => {
      const diags = await getLspDiagnostics(lspServerId, activeFilePath);
      if (cancelled || !monacoRef.current || !editorRef.current) return;
      const monaco = monacoRef.current;
      const model = editorRef.current.getModel();
      if (!model) return;
      const markers: editor.IMarkerData[] = diags.map((d) => ({
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.line,
        endColumn: 200,
      }));
      monaco.editor.setModelMarkers(model, 'lsp', markers);
    };
    fetchDiag();
    const interval = setInterval(fetchDiag, 3000); // 3 秒轮询
    return () => { cancelled = true; clearInterval(interval); };
  }, [lspServerId, activeFilePath]);

  /** Monaco 加载前配置 */
  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowNonTsExtensions: true, strict: true, noEmit: true,
      esModuleInterop: true, allowSyntheticDefaultImports: true,
      resolveJsonModule: true, isolatedModules: true, skipLibCheck: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false, noSyntaxValidation: false,
      noSuggestionDiagnostics: false, diagnosticCodesToIgnore: [6133, 6196, 2307],
    });
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'react' { export = React; export as namespace React; declare namespace React { function useState<T>(i: T): [T, (v: T|((p: T)=>T)) => void]; function useEffect(f: ()=>(void|(()=>void)), d?: any[]): void; function useCallback<T extends Function>(f: T, d: any[]): T; function useRef<T>(i?: T): { current: T|undefined }; type FC<P={}>= (p: P)=>any; type ReactNode=any; type CSSProperties=any; type ChangeEvent=any; type KeyboardEvent=any; type MouseEvent=any; } }`,
      'react.d.ts'
    );

    // 注册 AI 补全（Ghost Text）—— 对所有语言生效
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'rust', 'go',
      'css', 'html', 'json', 'markdown', 'yaml', 'plaintext',
    ];

    for (const lang of supportedLanguages) {
      monaco.languages.registerInlineCompletionsProvider(lang, {
        provideInlineCompletions: async (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
          // 只在输入暂停 300ms 后触发（由 Monaco 的 inlineCompletions debounce 控制）
          const prefix = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const suffix = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount()),
          });

          const completion = await getAICompletion(prefix, suffix, lang);

          if (!completion) return { items: [] };

          return {
            items: [
              {
                insertText: completion,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              },
            ],
          };
        },
        freeInlineCompletions: () => {},
      } as any);
    }
  };

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed;
    const monaco = monacoRef.current;

    // 跟踪光标和选区
    ed.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, column: e.position.column });
    });
    ed.onDidChangeCursorSelection((e) => {
      const sel = ed.getModel()?.getValueInRange(e.selection);
      setEditorSelection(sel || '');
    });

    ed.onDidChangeModelContent(() => {
      if (activeFilePath) {
        setLocalDirty((prev) => ({ ...prev, [activeFilePath]: true }));
      }
    });

    // 注册所有打开文件的 model
    if (monaco) {
      for (const file of openFiles) {
        if (!modelsRef.current.has(file.path)) {
          const uri = monaco.Uri.parse(`file:///${file.path}`);
          let model = monaco.editor.getModel(uri);
          if (!model) {
            model = monaco.editor.createModel(file.content, langFromPath(file.path), uri);
          }
          modelsRef.current.set(file.path, model);
        }
      }
      // 切换到当前活动 model
      const currentModel = modelsRef.current.get(activeFilePath || '');
      if (currentModel) {
        ed.setModel(currentModel);
      }
    }

    ed.layout();
    ed.focus();
  };

  /** 清理已关闭文件的 Monaco model，防止内存泄漏 */
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const openPaths = new Set(openFiles.map((f) => f.path));
    for (const [path] of modelsRef.current) {
      if (!openPaths.has(path)) {
        // 检查 Monaco 全局注册表中是否还有此 model，有则 dispose
        const uri = monaco.Uri.parse(`file:///${path}`);
        const existing = monaco.editor.getModel(uri);
        if (existing && !existing.isDisposed()) {
          existing.dispose();
        }
        modelsRef.current.delete(path);
      }
    }
  }, [openFiles]);

  /** Ctrl+S 保存 */
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const ed = editorRef.current;
        const path = activeFilePath;
        if (ed && path) {
          try {
            await onSaveFile(path, ed.getValue());
          } catch (e: any) {
            console.error('Save failed:', e);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFilePath, onSaveFile]);

  /** 行内 Diff */
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !activeFilePath || !inlineDiffs?.[activeFilePath]) {
      decorationsRef.current = ed?.deltaDecorations(decorationsRef.current, []) || [];
      return;
    }
    const diff = inlineDiffs[activeFilePath];
    const decorations: editor.IModelDeltaDecoration[] = [];
    for (const line of diff.added) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'inline-diff-added', glyphMarginClassName: 'inline-diff-added-glyph' },
      });
    }
    for (const line of diff.removed) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'inline-diff-removed', glyphMarginClassName: 'inline-diff-removed-glyph' },
      });
    }
    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, decorations);
  }, [activeFilePath, inlineDiffs]);

  /** 调试断点 + 当前行装饰器 */
  const bpDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !activeFilePath) return;
    const decorations: editor.IModelDeltaDecoration[] = [];
    // 断点标记（红点）
    console.log('bp check', activeFilePath, breakpoints);
    const fileBps = breakpoints.filter((bp) => bp.file === activeFilePath || activeFilePath.endsWith(bp.file));
    for (const bp of fileBps) {
      decorations.push({
        range: new monaco.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'bp-glyph',
          glyphMarginHoverMessage: { value: '断点' },
          className: 'bp-line',
        },
      });
    }
    // 当前调试行（黄色高亮）
    if (activeDebugLine && activeDebugLine > 0) {
      decorations.push({
        range: new monaco.Range(activeDebugLine, 1, activeDebugLine, 1),
        options: {
          isWholeLine: true,
          className: 'bp-active-line',
          glyphMarginClassName: 'bp-active-glyph',
        },
      });
    }
    bpDecorationsRef.current = ed.deltaDecorations(bpDecorationsRef.current, decorations);
  }, [activeFilePath, breakpoints, activeDebugLine]);

  /** 面包屑路径分段 */
  const breadcrumbs = useMemo(() => {
    if (!activeFilePath) return [];
    return activeFilePath.split('/');
  }, [activeFilePath]);

  // 空状态
  if (openFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-[#858585]">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
        </svg>
        <p className="text-sm">没有打开的文件</p>
        <p className="text-xs mt-1 opacity-50">Ctrl+P 搜索文件 · 从对话中点击文件路径打开</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* === Tab 栏 === */}
      <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto" style={{ height: 36 }}>
        {openFiles.map((file) => (
          <div
            key={file.path}
            onClick={() => onSelectFile(file.path)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onCloseFile(file.path); } }}
            className={`group flex items-center gap-1.5 px-3 h-full text-[13px] cursor-pointer border-r border-[#3c3c3c] transition-colors shrink-0 max-w-[180px] select-none ${
              file.path === activeFilePath
                ? 'bg-[#1e1e1e] text-[#cccccc] border-t-2 border-t-[#007acc]'
                : 'text-[#858585] hover:bg-[#2a2d2e]'
            }`}
          >
            <span className="truncate">{file.path.split('/').pop() || file.path}</span>
            {(localDirty[file.path] || file.isDirty) && (
              <span className="w-2 h-2 rounded-full bg-[#cccccc] shrink-0" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onCloseFile(file.path); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-[#3c3c3c] transition-all shrink-0"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* === 面包屑 === */}
      <div className="flex items-center h-[22px] bg-[#1e1e1e] border-b border-[#3c3c3c] px-2 text-[13px] select-none overflow-x-auto" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {breadcrumbs.map((seg, i) => (
          <span key={i} className="flex items-center shrink-0">
            {i > 0 && <span className="text-[#858585] mx-0.5">{'>'}</span>}
            <span className={`px-1 py-px rounded-sm cursor-pointer hover:bg-[#2a2d2e] ${
              i === breadcrumbs.length - 1 ? 'text-[#cccccc]' : 'text-[#858585]'
            }`}>
              {seg}
            </span>
          </span>
        ))}
      </div>

      {/* === Monaco === */}
      <div className="flex-1">
        <Editor
          key={activeFilePath}
          height="100%"
          language={language}
          value={activeFile?.content || ''}
          theme="vs-dark"
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            readOnly: false,
            minimap: { enabled: true, scale: 1, showSlider: 'mouseover' as const },
            fontSize: 13,
            fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            renderWhitespace: 'selection',
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            padding: { top: 4 },
            // 补全
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on' as const,
            tabCompletion: 'on' as const,
            wordBasedSuggestions: 'currentDocument' as const,
            snippetSuggestions: 'top' as const,
            // 提示和诊断
            hover: { enabled: true, delay: 300, sticky: true },
            inlayHints: { enabled: 'on' as const },
            // 导航
            gotoLocation: { multiple: 'gotoAndPeek' as const },
            definitionLinkOpensInPeek: true,
            parameterHints: { enabled: true, cycle: true },
            autoClosingBrackets: 'always' as const,
            autoClosingQuotes: 'always' as const,
            autoClosingOvertype: 'always' as const,
            autoIndent: 'full' as const,
            formatOnPaste: true,
            formatOnType: true,
            // 视觉
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
            renderLineHighlight: 'all' as const,
            cursorBlinking: 'smooth' as const,
            cursorSmoothCaretAnimation: 'on' as const,
            smoothScrolling: true,
            stickyScroll: { enabled: true },
            glyphMargin: true,
            folding: true,
            foldingHighlight: true,
            foldingStrategy: 'indentation' as const,
            showFoldingControls: 'always' as const,
            matchBrackets: 'always' as const,
            // 多光标
            multiCursorModifier: 'alt' as const,
            selectionHighlight: true,
            occurrencesHighlight: 'singleFile' as const,
            // 右键菜单 + 命令面板
            contextmenu: true,
          }}
        />
      </div>

      {/* === 状态栏 === */}
      <div
        className="flex items-center h-[22px] bg-[#007acc] text-white text-[12px] px-2 select-none"
        style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
      >
        {/* 左侧：Git 分支（装饰） */}
        <span className="mr-2 opacity-80">main</span>
        <svg className="w-3 h-3 mr-1 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>

        {/* 中间填充 */}
        <div className="flex-1" />

        {/* 右侧：光标位置 + 缩进 + 编码 + 语言 */}
        <span className="tabular-nums">行 {cursorPos.line}, 列 {cursorPos.column}</span>
        <span className="mx-2 opacity-40">|</span>
        <span>空格: 2</span>
        <span className="mx-2 opacity-40">|</span>
        <span>UTF-8</span>
        <span className="mx-2 opacity-40">|</span>
        <span>{language}</span>

        {/* 选区信息 */}
        {editorSelection && (
          <span className="ml-2 tabular-nums">
            ({editorSelection.length} 个字符选中)
          </span>
        )}
      </div>
    </div>
  );
}
