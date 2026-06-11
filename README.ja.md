<p align="center">
  <img src="imgs/logo.png" alt="DevWhale" width="115%" />
</p>

<h1 align="center">DevWhale</h1>
<p align="center"><strong>AI 搭載デスクトップ開発ワークベンチ</strong></p>
<p align="center"><em>集中し、効率的に構築し、DevWhale でコードを書こう。</em></p>

<p align="center">
  <a href="./README.md">English</a>
  &nbsp;·&nbsp;
  <a href="./README.zh-CN.md">简体中文</a>
  &nbsp;·&nbsp;
  <strong>日本語</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform" /></a>
  <a href="#"><img src="https://img.shields.io/badge/electron-36-47848f?logo=electron" alt="Electron" /></a>
  <a href="#"><img src="https://img.shields.io/badge/react-19-61dafb?logo=react" alt="React" /></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-6-3178c6?logo=typescript" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tailwind-4-06b6d4?logo=tailwindcss" alt="Tailwind" /></a>
</p>

---

DevWhale は軽量な AI 搭載コーディングアシスタントデスクトップアプリです。3 ペインレイアウト、ストリーミングチャット、Monaco エディタ（AI Ghost Text 補完 + LSP 診断）、xterm.js ターミナル（V8 デバッガ内蔵）、VSCode スタイルのファイルツリー、ワンクリックチェックポイントロールバック、Skill マーケットプレイス — すべてローカルで実行。AI エンジンはストリーミング Tool Calling をサポート：ファイルの読み取り/書き込み/編集、Git 操作、Web 検索、パッチ適用、Word 文書作成。3 つの実行モード：YOLO（全自動）、Ask（確認してから実行）、Plan（計画してから実行）。65 以上のファイル形式のドラッグ＆ドロップに対応し、DOCX/XLSX のテキスト自動抽出、画像の base64 マルチモーダル入力をサポートします。

---

## DeepSeek V4 — 統合設計

DevWhale は単に DeepSeek と「互換性がある」だけでなく、**DeepSeek V4 Pro のためにアーキテクチャレベルで設計**されています。すべての設計判断は DeepSeek の特性に基づいています。

### 技術統合

| 機能 | DeepSeek における重要性 |
|------|---------------------------|
| **ストリーミング Tool Calling** | DeepSeek の `tool_choice` + ストリーミングデルタ蓄積を完全実装。ツール呼び出しの欠落や JSON の切断なし。Cursor/Claude Code は DeepSeek のストリーミングツール形式で頻繁に失敗します。 |
| **`task_complete` プロトコル** | DeepSeek は `finish_reason: tool_calls` を確実に発行しません。DevWhale はカスタム `task_complete` ツールを明示的な終了シグナルとして使用 — 100% 信頼性のループ制御。 |
| **Byte-Stable システムプロンプト** | DeepSeek のプレフィックスキャッシュは 128 トークンのバイトレベル粒度で動作。DevWhale はルール/メモリ/スキル/MCP ツールをプロンプト末尾に追加し、プレフィックスを変更しません — 毎ターンキャッシュにヒット。約 90% の入力コスト削減。 |
| **1M コンテキストシールド** | DeepSeek V4 は 1M トークンをサポートしますが、約 700K 文字を超えると劣化。DevWhale のコンテキストガードは劣化領域に入る前に対話履歴を切り詰めます。 |
| **マルチモデルルーター** | DeepSeek / OpenAI / Anthropic を単一設定で切り替え — 同じ Tool Calling ループ、同じツール、同じ UX。ベンダーロックインなし。 |

### コスト比較（同じコーディングタスク、約 5 ラウンドのツール呼び出し）

| ツール | DeepSeek V4 コスト | キャッシュヒット率 | 
|------|:---:|:---:|
| **DevWhale** | ~$0.02 | 85-95% ✅ |
| Cursor | ~$0.18 | <30% ❌ |
| Claude Code | N/A (DeepSeek 未サポート) | N/A ❌ |
| Codex | N/A (OpenAI のみ) | N/A ❌ |

---

## DevWhale を選ぶ理由

### 🧠 DeepSeek V4 Pro のために設計

Codex は OpenAI のみ、Claude Code は Anthropic のみに対応。**これらは DeepSeek との互換性が非常に低く**、ツール呼び出しの失敗、コンテキストの喪失、128K を超えると深刻な劣化が発生します。

DevWhale は **初日から DeepSeek V4 Pro 向けに設計** — 完全な Tool Calling ループ、`task_complete` 終了プロトコル、700K 文字のコンテキスト保護、DeepSeek / OpenAI / Anthropic の 3 モード切り替え。

### 💰 プレフィックスキャッシュ最適化でコスト 90% 削減

DeepSeek V4 は **128 トークン粒度の byte-stable プレフィックス**に対して約 90% のキャッシュ割引を提供。DevWhale の Agent エンジンはシステムプロンプトのプレフィックスを意図的に安定させ、ルール、メモリ、スキル、プロジェクトインデックス、MCP ツールリストを先頭に配置し、追加のみで削除や変更を行いません。**同じコードレビュータスクで、API コストは Cursor の 10 分の 1。**

Cursor と Claude Code はツール呼び出しのたびにプロンプト構造を再構築し、キャッシュヒット率はほぼゼロ。Codex は OpenAI に固定されており、DeepSeek のキャッシュ戦略を活用できません。

### 🖥️ 独立したデスクトップアプリ、IDE プラグインではない

Cursor（VSCode フォーク）や Claude Code（ターミナル CLI）とは異なり、DevWhale は **Electron ベースのネイティブデスクトップアプリ** — ダブルクリックで起動、Monaco + xterm + ファイルツリーを内蔵し、IDE に依存しません。エディタを変えたくない開発者にも、非技術系ユーザーにも適しています。

---

## 機能

### コア機能
- 🧠 **AI チャット** — DeepSeek (V4 Pro / V4 Flash), OpenAI (GPT-4o), Anthropic (Claude) マルチモデル、ストリーミング出力、画像入力対応
- 🔧 **Agent ツール呼び出し** — ストリーミング Tool Calling：ファイル読み取り/書き込み/編集、コマンド実行、Git ステータス/差分/コミット/ブランチ、Web 検索/取得、DOCX 作成、unified diff パッチ適用
- 💬 **会話管理** — マルチセッション、プロジェクトグループ化、検索フィルタ、右クリックメニュー（名前変更/削除/グループ移動/エクスポート）、メッセージ永続化
- 📝 **コードエディタ** — Monaco Editor、TypeScript/JavaScript/Python/Rust/Go シンタックスハイライト、スマート補完、AI インライン補完（Ghost Text）、インライン Diff 注釈、Ctrl+S で保存
- 🖥️ **ターミナル** — xterm.js ターミナルエミュレータ、コマンド履歴（↑↓）、Agent コマンドログの折りたたみ/展開、リアルタイムストリーミング出力
- 📁 **ファイルツリー** — プロジェクトファイルブラウジング、実際のファイルシステムを再帰的にスキャン、拡張子で色分け

### 補助機能
- 🌓 **テーマ** — システム設定に自動追従、または手動でライト/ダーク切替、CSS 変数 + Tailwind トークン
- 📋 **ルールとメモリ** — カスタム AI 行動ルール（複数、切り替え可能）、クロスセッションメモリ。プロジェクトルールファイルの自動読み取り（`.devwhale/rules.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`）
- 🔙 **チェックポイント** — ファイル書き込み/編集前に自動バックアップ、右パネルからワンクリックでロールバック、複数ファイル追跡
- 🔍 **セマンティックインデックス** — プロジェクトの import/export 依存関係グラフとシンボルテーブルを自動分析し、システムプロンプトに注入
- 🛠️ **Skill システム** — 12 個の組み込みエキスパート Skill + SkillsMP コミュニティマーケットプレイス
- 🐞 **デバッガ** — Node.js V8 Inspector 内蔵：ブレークポイント、ステップ実行、変数表示
- 📡 **LSP** — Pyright 内蔵（Python）、Rust Analyzer / gopls オプション
- 🔌 **MCP** — Model Context Protocol サーバーサポート
- 🌐 **国際化** — 简体中文 / English / 日本語 切り替え
- ⚙️ **設定パネル** — 11 のサブパネル

### セキュリティと体験
- 🔏 **プライバシーモード**
- ⏹ **ストリーミング中断**
- 🔄 **自動リトライ**（3 回、429/500 バックオフ）
- 📊 **トークン使用量表示**
- 📥 **ファイルドラッグ＆ドロップ**

---

## クイックスタート

### 1. ダウンロード

[Releases](../../releases) から `devwhale Setup.exe` をダウンロードしてインストール、実行。

またはソースから起動：

```bash
cd DevWhale
npm install
npx electron .
npm run dev
```

### 2. API キーの設定

アプリ起動 → 左下のアバター → 設定 → モデル → プロバイダーを選択し API キーを入力。

- DeepSeek: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Anthropic: [console.anthropic.com](https://console.anthropic.com)

### 3. クイックリファレンス

| 操作 | 方法 |
|------|------|
| 新規会話 | サイドバー「+」ボタン |
| 会話/グループ名変更 | タイトルをダブルクリック |
| 会話削除 | 右クリック → 削除、またはホバー × |
| 会話をグループに移動 | 右クリック → 対象グループ |
| モード切替 | 入力欄下の YOLO / Ask / Plan ボタン |
| フォルダを開く | サイドバー「📂 フォルダを開く」 |
| ファイルを開く | ファイルツリークリック、またはチャット内のファイルパスクリック |
| Ctrl+S | 現在のエディタファイルをディスクに保存 |
| 生成停止 | ストリーミング中の「停止」ボタン |
| 会話エクスポート | サイドバー「📥 エクスポート」→ Markdown ファイル |

---

## 技術スタック

| レイヤー | 技術 |
|-------|-----------|
| デスクトップフレームワーク | Electron 36 |
| ビルドツール | Vite 8 + vite-plugin-electron |
| フロントエンド | React 19 + TypeScript 6 |
| スタイリング | Tailwind CSS 4 + CSS 変数テーマ |
| コードエディタ | Monaco Editor (@monaco-editor/react) |
| ターミナル | xterm.js 5 + addon-fit |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI インターフェース | OpenAI 互換プロトコル (DeepSeek / OpenAI / Anthropic) |
| 永続化 | localStorage |
| パッケージング | electron-builder (NSIS / DMG / AppImage) |
| LSP | Pyright (内蔵) / rust-analyzer / gopls |
| デバッグ | V8 Inspector Protocol |

---

## プロジェクト構造

```
DevWhale/
├── electron/               # Electron メインプロセス
│   ├── main.ts             # ウィンドウ、IPC (ファイル/シェル/LSP/デバッグ/更新)
│   └── preload.ts          # contextBridge API
├── src/
│   ├── components/         # React UI
│   │   ├── Sidebar.tsx     # 会話リスト + プロジェクトグループ
│   │   ├── ChatArea.tsx    # チャットエリア + 入力 + モード切替
│   │   ├── MessageBubble.tsx # Markdown メッセージレンダラー
│   │   ├── RightPanel.tsx  # TODO / ファイルツリー / チェックポイント / コンテキスト
│   │   ├── SettingsPanel.tsx # 設定 (11 サブパネル)
│   │   ├── CodeViewer.tsx  # Monaco エディタ + AI 補完
│   │   ├── DiffViewer.tsx  # Unified diff パーサー + インラインハイライト
│   │   ├── FileTree.tsx    # 再帰的ファイルツリー
│   │   ├── TerminalPanel.tsx # xterm.js ターミナル
│   │   └── SkillStore.tsx  # Skill マーケットプレイス
│   ├── hooks/              # カスタムフック
│   │   └── useTheme.tsx    # テーマコンテキスト (ライト/ダーク/システム)
│   ├── lib/                # コアモジュール
│   │   ├── api.ts          # Agent エンジン v3: システムプロンプト + ストリーミング Tool Calling
│   │   ├── tools.ts        # ツールディスパッチャー (読み取り/書き込み/編集/Git/検索/パッチ/DOCX)
│   │   ├── shell.ts        # クロスプラットフォームシェル (PowerShell/Bash)
│   │   ├── tauriFs.ts      # Electron IPC ファイル操作
│   │   ├── storage.ts      # localStorage 永続化
│   │   ├── indexer.ts      # セマンティックプロジェクトインデックス (シンボル + 依存関係グラフ)
│   │   ├── completion.ts   # AI コード補完 (FIM + Ghost Text)
│   │   ├── checkpoint.ts   # 自動バックアップ + ロールバック
│   │   ├── lsp.ts          # LSP マネージャー (Python/Rust/Go)
│   │   ├── mcp.ts          # MCP クライアント
│   │   ├── debugger.ts     # Node.js V8 Inspector デバッガ
│   │   ├── skillsMarket.ts # SkillsMP マーケットプレイス API
│   │   ├── i18n.ts         # 国際化 (zh-CN / en / ja)
│   │   └── utils.ts        # cn() / 時間フォーマット
│   ├── types/              # TypeScript 型
│   │   └── chat.ts         # Message / Conversation / Project / TodoItem / Mode
│   ├── App.tsx             # ルートコンポーネント: グローバル状態 + Agent ディスパッチ + 永続化
│   └── main.tsx            # React エントリ + ThemeProvider
├── dist/                   # Vite ビルド出力 (フロントエンド)
├── dist-electron/          # TSC ビルド出力 (Electron メインプロセス)
├── release/                # electron-builder 出力
├── public/                 # 静的アセット
├── package.json            # 依存関係 + electron-builder 設定
├── vite.config.ts          # Vite + electron プラグイン設定
├── tsconfig.json           # TypeScript 設定
└── index.html              # エントリ HTML
```

---

## アーキテクチャ

### Agent エンジン (api.ts)

```
ユーザー入力 → buildSystem (ルール/メモリ/スキル/プロジェクトインデックス/技術スタック/MCP/Agent プロトコル)
           → メッセージ構築 (システム + 履歴 + ユーザー)
           → ストリーミング Tool Calling ループ:
              ├── fetch API (自動リトライ 3 回)
              ├── delta.content 蓄積 → onToken
              ├── delta.tool_calls 蓄積 → 完了時に並列実行
              ├── ツール結果 → メッセージに追加 → 次の反復
              └── 終了: task_complete / コンテキストオーバーフロー (700K 文字) / 空ループ (5 反復)
```

### ツールレイヤー (tools.ts)

15 の組み込みツール + MCP 動的ルーティング:
`read_file | write_file | edit_file | exec_command | list_dir | create_docx | git_status | git_diff | git_log | git_commit | git_branch | apply_patch | web_search | web_fetch | task_complete`

### データフロー

```
API (DeepSeek/OpenAI/Anthropic)
  ↕ fetch (OpenAI 互換 /chat/completions)
lib/api.ts (Agent エンジン + ストリーミング Tool Calling)
  ↕ onToolCall / onToken / onProgress
App.tsx (グローバル状態 + useEffect 永続化)
  ↕ props
React Components (Sidebar / ChatArea / MessageBubble / RightPanel / CodeViewer / TerminalPanel)
  ↕ IPC (contextBridge)
electron/main.ts (ファイル I/O / シェル / LSP / デバッガ)
```

---

## 必要環境

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows:** 追加の依存関係不要 (Electron が Chromium をバンドル)
- **macOS:** 追加の依存関係不要
- **Linux:** `libgtk-3-0`, `libnotify4` など (標準的な Electron 依存関係)

### 開発クイックスタート

```bash
npm install
npm run dev             # Vite 開発サーバー + Electron ウィンドウ
npx tsc --noEmit        # 型チェックのみ
npm run build           # プロダクションビルド
npm run electron:build  # 配布用インストーラーのパッケージ化
```

---

## vs Codex / Cursor / Claude Code / Trae Solo

| 項目 | DevWhale | Codex (OpenAI) | Cursor | Claude Code | Trae Solo |
|------|----------|----------------|--------|-------------|-----------|
| **形態** | 独立デスクトップアプリ | ターミナル CLI | IDE (VSCode フォーク) | ターミナル CLI | IDE |
| **起動** | .exe をダブルクリック | `npx` コマンド | IDE インストール | `claude` コマンド | IDE インストール |
| **GUI** | 3 ペイン + Monaco + xterm | なし (プレーンテキスト) | フル IDE | なし (プレーンテキスト) | フル IDE |
| **コードエディタ** | Monaco 内蔵 (AI Ghost Text) | なし | VSCode エディタ | なし | 内蔵エディタ |
| **ターミナル** | xterm.js + デバッガ | システムターミナル | 統合 | システムターミナル | 統合 |
| **マルチモデル** | ✅ DeepSeek / OpenAI / Anthropic | ❌ OpenAI のみ | ⚠️ 一部 | ❌ Anthropic のみ | ⚠️ 一部 |
| **DeepSeek V4** | ✅ ネイティブ Tool Calling + task_complete | ❌ 非互換 | ⚠️ 形式の問題 | ❌ 非互換 | ⚠️ プロキシ必須 |
| **プレフィックスキャッシュ** | ✅ byte-stable プレフィックス、約 90% コスト削減 | ❌ | ❌ | ❌ | ❌ |
| **ファイル形式** | 65+ ドラッグ＆ドロップ | 基本的な読み取り/書き込み | プロジェクトファイル | 基本的な読み取り/書き込み | プロジェクトファイル |
| **DOCX/XLSX** | テキスト自動抽出 | ❌ | ❌ | ❌ | ❌ |
| **画像マルチモーダル** | ドラッグ/選択 → 自動 base64 | ❌ | ✓ | ✓ | ✓ |
| **チェックポイント** | ✓ ワンクリックロールバック | ❌ | ✓ (Git) | ❌ | ✓ (Git) |
| **実行モード** | YOLO / Ask / Plan | YOLO のみ | Agent / Ask | YOLO のみ | Agent / Ask |
| **Skill マーケットプレイス** | 12 組み込み + コミュニティ | ❌ | ❌ | ❌ | ❌ |
| **LSP 診断** | Pyright 内蔵 + Monaco | ❌ | VSCode プラグイン | ❌ | VSCode プラグイン |
| **デバッガ** | V8 Inspector + UI | ❌ | VSCode デバッガ | ❌ | VSCode デバッガ |
| **ファイルツリー** | VSCode スタイルコネクタ | ❌ | ✓ | ❌ | ✓ |
| **ルールとメモリ** | カスタムルール + プロジェクトルール | システムプロンプト | .cursorrules | CLAUDE.md | 設定ファイル |
| **国際化** | zh-CN / en / ja | 英語のみ | 英語のみ | 英語のみ | zh-CN / en |
| **サンドボックス** | ネイティブ実行 | サンドボックス ✅ | ネイティブ | ネイティブ | ネイティブ |
| **成熟度** | 独立プロジェクト | OpenAI 公式 | 商用 | Anthropic 公式 | 商用 |
| **価格** | 無料 & オープンソース | 無料 | サブスクリプション | API 従量課金 | 無料 |

---

## ライセンス

MIT
