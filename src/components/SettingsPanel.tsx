import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { loadChatSettings, saveChatSettings, loadRulesMemory, saveRulesMemory, loadGeneralPreferences, saveGeneralPreferences, loadProvider, saveProvider, saveProviderApiKey, getProviderConfig, loadSelectedModel, saveSelectedModel, loadUsername, saveUsername, loadEnabledSkills, saveEnabledSkills, loadShowRecommendations, saveShowRecommendations, BUILTIN_SKILLS, getAllSkills, type ChatSettings, type ChatDensity, type CodeTheme, type RulesMemory, type RuleItem, type GeneralPreferences, type LinkOpenMode, type ProviderId } from '../lib/storage';
import { getCurrentProjectPath } from '../lib/tools';
import { startMcpServer, stopMcpServer } from '../lib/mcp';

/* ====== 导航项定义 ====== */
const NAV_ITEMS = [
  { key: 'general', label: '通用', icon: '⚙️' },
  { key: 'mcp', label: 'MCP', icon: '🔌' },
  { key: 'models', label: '模型', icon: '🧠' },
  { key: 'skills', label: '技能', icon: '🛠️' },
  { key: 'chat', label: '对话流', icon: '💬' },
  { key: 'external', label: '外部应用授权', icon: '🔗' },
  { key: 'cloud', label: '云端运行环境', icon: '☁️' },
  { key: 'worktree', label: '工作树', icon: '🌳' },
  { key: 'commands', label: '命令', icon: '⌨️' },
  { key: 'rules', label: '规则与记忆', icon: '📋' },
  { key: 'about', label: '关于 DevWhale', icon: 'ℹ️' },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'];

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [active, setActive] = useState<NavKey>('general');
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[680px] h-[480px] bg-surface-0 rounded-2xl shadow-2xl border border-surface-200 flex overflow-hidden animate-in fade-in zoom-in-95">
        {/* 左侧导航 */}
        <div className="w-44 shrink-0 bg-surface-50 border-r border-surface-200 flex flex-col">
          <div className="px-4 py-3 border-b border-surface-200">
            <h2 className="text-xs font-semibold text-surface-600 uppercase tracking-wider">设置</h2>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`
                  w-full text-left px-4 py-2 text-sm flex items-center gap-2.5 transition-colors
                  ${active === item.key
                    ? 'bg-accent-muted text-accent font-medium border-r-2 border-accent'
                    : 'text-surface-600 hover:bg-surface-100 border-r-2 border-transparent'
                  }
                `}
              >
                <span className="text-xs">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
            <h3 className="text-sm font-semibold text-surface-800">
              {NAV_ITEMS.find((i) => i.key === active)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {active === 'general' && (
              <GeneralSettings theme={theme} setTheme={setTheme} />
            )}
            {active === 'models' && <ModelsSettings />}
            {active === 'chat' && <ChatSettingsPanel />}
            {active === 'worktree' && <WorktreeSettings />}
            {active === 'commands' && <CommandsSettings />}
            {active === 'rules' && <RulesMemoryPanel />}
            {active === 'skills' && <SkillsPanel />}
            {active === 'about' && <AboutSettings />}
            {active === 'mcp' && <McpSettings />}
            {active === 'external' && <InfoPlaceholder title="外部应用授权" desc="管理第三方应用的 OAuth 授权。支持 GitHub、GitLab 等平台的令牌管理，让 AI 可以代表你操作代码仓库。" />}
            {active === 'cloud' && <InfoPlaceholder title="云端运行环境" desc="配置远程开发环境。支持 SSH 连接、容器化运行时，让 AI 在云端执行代码和命令。" />}
            {!['general', 'models', 'skills', 'chat', 'commands', 'worktree', 'rules', 'about', 'mcp', 'external', 'cloud'].includes(active) && (
              <PlaceholderSettings title={NAV_ITEMS.find((i) => i.key === active)?.label || ''} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== 通用设置 ====== */
function GeneralSettings({
  theme, setTheme,
}: {
  theme: string; setTheme: (t: 'light' | 'dark' | 'system') => void;
}) {
  const [prefs, setPrefs] = useState<GeneralPreferences>(loadGeneralPreferences);

  const updatePrefs = (patch: Partial<GeneralPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveGeneralPreferences(next);
    // 实时应用字号
    if (patch.fontSize !== undefined) {
      document.documentElement.style.fontSize = `${patch.fontSize}px`;
    }
  };
  return (
    <div className="space-y-5">
      {/* 主题 */}
      <Section title="主题">
        <div className="flex gap-2">
          {[
            { key: 'light' as const, label: '☀️ 日间', desc: '始终亮色' },
            { key: 'dark' as const, label: '🌙 夜间', desc: '始终暗色' },
            { key: 'system' as const, label: '💻 跟随系统', desc: '自动切换' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className={`
                flex-1 p-3 rounded-xl border text-center transition-all
                ${theme === opt.key
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
                }
              `}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* 语言 */}
      <Section title="界面语言">
        <select
          value={prefs.language}
          onChange={(e) => updatePrefs({ language: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent focus:ring-1 focus:ring-accent-muted"
        >
          <option value="zh">简体中文</option>
          <option value="en">English</option>
        </select>
      </Section>

      {/* 字体大小 */}
      <Section title={`字体大小 · ${prefs.fontSize}px`}>
        <input
          type="range"
          min={12}
          max={20}
          value={prefs.fontSize}
          onChange={(e) => updatePrefs({ fontSize: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-surface-400 mt-1">
          <span>A</span>
          <span className="text-sm">A</span>
        </div>
      </Section>

      {/* 偏好设置 */}
      <Section title="偏好设置">
        <p className="text-xs text-surface-400 mb-2">本地链接的默认打开方式</p>
        <div className="flex gap-2">
          {([
            { key: 'always-ask' as LinkOpenMode, label: '始终询问', desc: '每次点击链接时弹出确认' },
            { key: 'auto-browser' as LinkOpenMode, label: '自动打开', desc: '使用内置浏览器直接打开' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => updatePrefs({ linkOpenMode: opt.key })}
              className={`
                flex-1 p-3 rounded-xl border text-center transition-all
                ${prefs.linkOpenMode === opt.key
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* 隐私 */}
      <Section title="隐私与安全">
        <ToggleRow
          label="隐私模式"
          desc="开启后 AI 不会记录或推断你的个人信息。对标 Cursor 的零数据保留策略。"
          checked={prefs.privacyMode}
          onChange={(v) => updatePrefs({ privacyMode: v })}
        />
      </Section>

      {/* 账号 */}
      <Section title="账号管理">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-surface-400 mb-1">用户名</p>
            <input
              type="text"
              defaultValue={loadUsername()}
              onBlur={(e) => { const v = e.target.value.trim(); if (v) { saveUsername(v); } }}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent"
            />
          </div>
          <div>
            <p className="text-[10px] text-surface-400 mb-1">数据管理</p>
            <button
              onClick={() => {
                if (confirm('确定清除所有聊天记录？此操作不可撤销。')) {
                  localStorage.removeItem('devwhale-conversations');
                  localStorage.removeItem('devwhale-active-conversation');
                  window.location.reload();
                }
              }}
              className="px-4 py-2 rounded-lg bg-danger/10 text-danger text-sm font-medium border border-danger/20 hover:bg-danger/20 transition-colors"
            >
              清除所有聊天记录
            </button>
            <p className="text-[10px] text-surface-400 mt-1">清除后不可恢复。API Key 和设置保留。</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ====== 模型设置 ====== */
function ModelsSettings() {
  const [providerId, setProviderId] = useState<ProviderId>(loadProvider);
  const provider = getProviderConfig(providerId);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [saved, setSaved] = useState(false);
  const selected = loadSelectedModel();

  const providers: { id: ProviderId; name: string; desc: string }[] = [
    { id: 'deepseek', name: 'DeepSeek', desc: '性价比最高 · 1M 上下文' },
    { id: 'openai', name: 'OpenAI', desc: '多模态 · GPT-4o' },
    { id: 'anthropic', name: 'Anthropic', desc: '编码强 · Claude' },
  ];

  const handleSwitchProvider = (id: ProviderId) => {
    setProviderId(id);
    saveProvider(id);
    const cfg = getProviderConfig(id);
    setApiKey(cfg.apiKey);
    setSaved(false);
    // 切提供商时默认选第一个模型
    if (cfg.models.length > 0) {
      saveSelectedModel(cfg.models[0].id);
    }
  };

  const handleSaveKey = () => {
    saveProviderApiKey(providerId, apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* 提供商选择 */}
      <Section title="模型提供商">
        <p className="text-xs text-surface-400 mb-2">DevWhale 支持多模型切换。选择提供商后配置对应的 API Key。</p>
        <div className="flex gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSwitchProvider(p.id)}
              className={`
                flex-1 p-3 rounded-xl border text-center transition-all
                ${providerId === p.id
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}
            >
              <div className="text-xs font-medium">{p.name}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{p.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* API Key */}
      <Section title={`${provider.name} API Key`}>
        <p className="text-xs text-surface-400 mb-2">
          输入 {provider.name} 的 API Key。各提供商的 Key 独立保存，切换时自动切换。
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={providerId === 'deepseek' ? 'sk-...' : providerId === 'openai' ? 'sk-proj-...' : 'sk-ant-...'}
            className="flex-1 px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent"
          />
          <button
            onClick={handleSaveKey}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${saved ? 'bg-success text-white' : 'bg-accent text-white hover:bg-accent-hover'}`}
          >
            {saved ? '✓ 已保存' : '保存'}
          </button>
        </div>
      </Section>

      {/* 模型选择 */}
      <Section title="选择模型">
        <p className="text-xs text-surface-400 mb-2">当前提供商：{provider.name}</p>
        <div className="space-y-1.5">
          {provider.models.map((m) => (
            <button
              key={m.id}
              onClick={() => saveSelectedModel(m.id)}
              className={`
                w-full text-left p-3 rounded-xl border transition-all
                ${selected === m.id
                  ? 'border-accent bg-accent-muted'
                  : 'border-surface-200 hover:border-surface-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${selected === m.id ? 'text-accent' : 'text-surface-700'}`}>
                  {m.name}
                </span>
                {selected === m.id && (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="text-[11px] text-surface-400 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ====== 工作树 ====== */
function WorktreeSettings() {
  const defaultPath = getCurrentProjectPath() || '（未设置，请先打开文件夹）';
  const savedExcludes = (() => { try { return localStorage.getItem('devwhale-worktree-excludes') || 'node_modules, target, .git, dist'; } catch { return 'node_modules, target, .git, dist'; } })();
  const [excludes, setExcludes] = useState(savedExcludes);

  const saveExcludes = (v: string) => {
    setExcludes(v);
    try { localStorage.setItem('devwhale-worktree-excludes', v); } catch {}
  };

  return (
    <div className="space-y-5">
      <Section title="项目根目录">
        <p className="text-xs text-surface-400 mb-2">设置文件树的工作目录。文件面板将展示该目录下的所有文件。</p>
        <div className="flex gap-2">
          <input
            type="text"
            defaultValue={defaultPath}
            readOnly
            className="flex-1 px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 font-mono outline-none focus:border-accent"
          />
          <button
            onClick={async () => {
              const api = (window as any).electronAPI;
              if (api?.openFolderDialog) {
                const selected = await api.openFolderDialog();
                if (selected) window.location.reload(); // 重新加载以应用新路径
              }
            }}
            className="px-4 py-2 rounded-lg bg-surface-100 text-surface-600 text-sm font-medium hover:bg-surface-200 transition-colors"
          >
            浏览
          </button>
        </div>
      </Section>

      <Section title="排除规则">
        <p className="text-xs text-surface-400 mb-2">隐藏匹配以下模式的文件和文件夹（逗号分隔）。当前设置实时保存。</p>
        <input
          type="text"
          value={excludes}
          onChange={(e) => saveExcludes(e.target.value)}
          placeholder="node_modules, target, .git, dist"
          className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 font-mono outline-none focus:border-accent"
        />
      </Section>

      <Section title="文件图标">
        <p className="text-xs text-surface-400 mb-2">文件树中根据扩展名自动着色。</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { ext: 'tsx', color: 'bg-cyan-500' },
            { ext: 'ts', color: 'bg-blue-500' },
            { ext: 'css', color: 'bg-purple-500' },
            { ext: 'json', color: 'bg-amber-500' },
            { ext: 'rs', color: 'bg-orange-500' },
            { ext: 'md', color: 'bg-sky-500' },
          ].map((item) => (
            <span key={item.ext} className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-0 border border-surface-200 text-[11px] text-surface-600">
              <span className={`w-2 h-2 rounded-sm ${item.color}`} />
              .{item.ext}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ====== 关于 ====== */
function AboutSettings() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-xl border border-surface-200">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white text-lg font-bold">
          b
        </div>
        <div>
          <h4 className="text-sm font-semibold text-surface-800">DevWhale</h4>
          <p className="text-xs text-surface-400">v0.2.0</p>
        </div>
      </div>

      <Section title="技术栈">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <KV label="框架" value="Electron + React 19" />
          <KV label="样式" value="Tailwind CSS 4" />
          <KV label="语言" value="TypeScript" />
          <KV label="打包" value="electron-builder" />
          <KV label="编辑器" value="Monaco Editor" />
          <KV label="终端" value="xterm.js" />
        </div>
      </Section>

      <Section title="开发">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <KV label="构建日期" value="2026-06-03" />
          <KV label="平台" value="Windows x64" />
        </div>
      </Section>
    </div>
  );
}

/* ====== 对话流设置 ====== */
function ChatSettingsPanel() {
  const [settings, setSettings] = useState<ChatSettings>(loadChatSettings);

  const update = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveChatSettings(next);
  };

  return (
    <div className="space-y-5">
      <Section title="消息密度">
        <p className="text-xs text-surface-400 mb-2">控制对话列表中每条消息之间的间距。</p>
        <div className="flex gap-2">
          {([
            { key: 'comfortable' as ChatDensity, label: '舒适', desc: '较大间距' },
            { key: 'compact' as ChatDensity, label: '紧凑', desc: '较小间距' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ density: opt.key })}
              className={`
                flex-1 p-3 rounded-xl border text-center transition-all
                ${settings.density === opt.key
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="代码块主题">
        <p className="text-xs text-surface-400 mb-2">代码块使用亮色还是暗色背景。</p>
        <div className="flex gap-2">
          {([
            { key: 'dark' as CodeTheme, label: '🌙 暗色', desc: '深色背景' },
            { key: 'light' as CodeTheme, label: '☀️ 亮色', desc: '浅色背景' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => update({ codeTheme: opt.key })}
              className={`
                flex-1 p-3 rounded-xl border text-center transition-all
                ${settings.codeTheme === opt.key
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="打字速度">
        <p className="text-xs text-surface-400 mb-2">AI 回复时的逐字显示速度。数值越小越快。</p>
        <input
          type="range"
          min={5}
          max={60}
          value={settings.typingSpeed}
          onChange={(e) => update({ typingSpeed: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-surface-400 mt-1">
          <span>快</span>
          <span>{settings.typingSpeed}ms</span>
          <span>慢</span>
        </div>
      </Section>

      <Section title="显示选项">
        <div className="space-y-2">
          <ToggleRow
            label="显示时间戳"
            desc="每条消息下方显示发送时间"
            checked={settings.showTimestamps}
            onChange={(v) => update({ showTimestamps: v })}
          />
          <ToggleRow
            label="自动滚动"
            desc="新消息到达时自动滚动到底部"
            checked={settings.autoScroll}
            onChange={(v) => update({ autoScroll: v })}
          />
        </div>
      </Section>
    </div>
  );
}

/* ====== 技能面板 ====== */
function SkillsPanel() {
  const [enabled, setEnabled] = useState<string[]>(loadEnabledSkills);
  const [showRec, setShowRec] = useState(loadShowRecommendations);
  const allSkills = getAllSkills();

  const toggle = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id];
    setEnabled(next);
    saveEnabledSkills(next);
  };

  const toggleRec = () => {
    const next = !showRec;
    setShowRec(next);
    saveShowRecommendations(next);
  };

  // 推荐：用户未启用但在同类别中流行的
  const enabledCats = new Set(allSkills.filter((s) => enabled.includes(s.id)).map((s) => s.category));
  const recommended = showRec
    ? allSkills.filter((s) => !enabled.includes(s.id) && enabledCats.has(s.category)).slice(0, 3)
    : [];

  return (
    <div className="space-y-5">
      <Section title="已安装技能">
        <p className="text-xs text-surface-400 mb-2">启用技能后，AI 将在相关场景中自动运用该技能的专业知识。</p>
        <div className="grid grid-cols-1 gap-1.5">
          {allSkills.map((s) => {
            const isOn = enabled.includes(s.id);
            const isCustom = !BUILTIN_SKILLS.some(bs => bs.id === s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  isOn ? 'border-accent bg-accent-muted' : 'border-surface-200 hover:border-surface-300'
                }`}
              >
                <span className="text-lg shrink-0">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-medium ${isOn ? 'text-accent' : 'text-surface-700'}`}>
                    {s.name}
                    {isCustom && <span className="ml-1 text-[9px] text-amber-500 bg-amber-50 px-1 rounded">市场</span>}
                  </div>
                  <div className="text-[10px] text-surface-400 truncate">{s.desc}</div>
                </div>
                <div className={`w-8 h-5 rounded-full transition-colors shrink-0 ${isOn ? 'bg-accent' : 'bg-surface-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${isOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 推荐开关 */}
      <Section title="技能推荐">
        <ToggleRow
          label="显示推荐"
          desc="根据已启用的技能推荐相关技能。"
          checked={showRec}
          onChange={toggleRec}
        />
        {recommended.length > 0 && (
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {recommended.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-colors"
              >
                <span className="text-sm">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-amber-600">{s.name}</div>
                  <div className="text-[10px] text-surface-400 truncate">{s.desc}</div>
                </div>
                <span className="text-[10px] text-amber-500 font-medium">推荐</span>
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ====== 占位设置（说明性） ====== */
function InfoPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-surface-400 px-6">
      <div className="text-3xl mb-3 opacity-30">🔧</div>
      <p className="text-sm font-medium text-surface-500 mb-1">{title}</p>
      <p className="text-xs text-surface-400 text-center leading-relaxed max-w-sm">{desc}</p>
    </div>
  );
}

/* ====== 命令设置 ====== */
function CommandsSettings() {
  const [commands, setCommands] = useState<{ id: string; name: string; prompt: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('devwhale-commands') || '[]'); } catch { return []; }
  });
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const save = (list: typeof commands) => {
    setCommands(list);
    localStorage.setItem('devwhale-commands', JSON.stringify(list));
  };

  const add = () => {
    if (!name.trim() || !prompt.trim()) return;
    save([...commands, { id: Date.now().toString(), name: name.trim(), prompt: prompt.trim() }]);
    setName(''); setPrompt('');
  };

  const del = (id: string) => save(commands.filter((c) => c.id !== id));

  return (
    <div className="space-y-5">
      <Section title="自定义命令">
        <p className="text-xs text-surface-400 mb-2">创建快捷命令模板。在对话中输入 /命令名 即可快速发送预设的提示词。</p>
        <div className="flex gap-2 mb-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="命令名（如 /review）" className="flex-1 px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm outline-none focus:border-accent" />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="提示词" className="flex-[2] px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm outline-none focus:border-accent" />
          <button onClick={add} disabled={!name.trim()||!prompt.trim()} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-30">添加</button>
        </div>
        {commands.length === 0 ? (
          <p className="text-xs text-surface-400 py-2">暂无命令。添加后可在对话中使用。</p>
        ) : (
          <div className="space-y-1">
            {commands.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-0 border border-surface-200 group">
                <span className="text-xs font-mono font-medium text-accent shrink-0">/{c.name}</span>
                <span className="text-xs text-surface-600 truncate flex-1">{c.prompt}</span>
                <button onClick={() => del(c.id)} className="shrink-0 p-0.5 text-surface-400 hover:text-danger opacity-0 group-hover:opacity-100"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ====== 占位设置 ====== */
function PlaceholderSettings({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-surface-400">
      <div className="text-3xl mb-3 opacity-30">🚧</div>
      <p className="text-sm font-medium text-surface-500">{title}</p>
      <p className="text-xs mt-1">即将推出</p>
    </div>
  );
}

/* ====== 子组件 ====== */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2 rounded-lg bg-surface-50 border border-surface-200">
      <span className="text-surface-400">{label}</span>
      <span className="text-surface-600 font-medium">{value}</span>
    </div>
  );
}

/* ====== 规则与记忆面板 ====== */
function RulesMemoryPanel() {
  const [data, setData] = useState<RulesMemory>(loadRulesMemory);
  const [newRule, setNewRule] = useState('');
  const [newMemory, setNewMemory] = useState('');

  const save = (next: RulesMemory) => {
    setData(next);
    saveRulesMemory(next);
  };

  const addRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    save({
      ...data,
      rules: [...data.rules, { id: `rule-${Date.now()}`, content: trimmed, enabled: true, createdAt: Date.now() }],
    });
    setNewRule('');
  };

  const toggleRule = (id: string) => {
    save({
      ...data,
      rules: data.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    });
  };

  const deleteRule = (id: string) => {
    save({ ...data, rules: data.rules.filter((r) => r.id !== id) });
  };

  const addMemory = () => {
    const trimmed = newMemory.trim();
    if (!trimmed) return;
    save({
      ...data,
      memories: [...data.memories, { id: `mem-${Date.now()}`, content: trimmed, createdAt: Date.now() }],
    });
    setNewMemory('');
  };

  const deleteMemory = (id: string) => {
    save({ ...data, memories: data.memories.filter((m) => m.id !== id) });
  };

  return (
    <div className="space-y-5">
      {/* 规则 */}
      <Section title="规则">
        <p className="text-xs text-surface-400 mb-2">
          设定 AI 在所有对话中遵守的行为准则。例如：代码风格、语言偏好、回复格式。
        </p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="例如：始终使用 TypeScript，不用 any"
            className="flex-1 px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent"
          />
          <button
            onClick={addRule}
            disabled={!newRule.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-30 transition-colors"
          >
            添加
          </button>
        </div>
        {data.rules.length === 0 ? (
          <p className="text-xs text-surface-400 py-2">暂无规则</p>
        ) : (
          <div className="space-y-1">
            {data.rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onToggle={toggleRule} onDelete={deleteRule} />
            ))}
          </div>
        )}
      </Section>

      {/* 记忆 */}
      <Section title="记忆">
        <p className="text-xs text-surface-400 mb-2">
          AI 跨会话记住的事实。例如：用户姓名、项目背景、偏好。
        </p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newMemory}
            onChange={(e) => setNewMemory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMemory()}
            placeholder="例如：我的名字是 DevWhale，项目是前后端分离架构"
            className="flex-1 px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent"
          />
          <button
            onClick={addMemory}
            disabled={!newMemory.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-30 transition-colors"
          >
            添加
          </button>
        </div>
        {data.memories.length === 0 ? (
          <p className="text-xs text-surface-400 py-2">暂无记忆</p>
        ) : (
          <div className="space-y-1">
            {data.memories.map((mem) => (
              <div key={mem.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-0 border border-surface-200 group">
                <span className="text-xs text-surface-600 flex-1">{mem.content}</span>
                <button
                  onClick={() => deleteMemory(mem.id)}
                  className="shrink-0 p-0.5 rounded text-surface-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function RuleRow({ rule, onToggle, onDelete }: { rule: RuleItem; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-0 border border-surface-200 group">
      <button
        onClick={() => onToggle(rule.id)}
        className={`w-4 h-4 rounded border-2 shrink-0 transition-colors ${rule.enabled ? 'bg-accent border-accent' : 'border-surface-300'}`}
      >
        {rule.enabled && (
          <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.5 10.5l-2.5-2.5L5 7l1.5 1.5L10 5l1 1-4.5 4.5z" />
          </svg>
        )}
      </button>
      <span className={`text-xs flex-1 ${rule.enabled ? 'text-surface-700' : 'text-surface-400 line-through'}`}>
        {rule.content}
      </span>
      <button
        onClick={() => onDelete(rule.id)}
        className="shrink-0 p-0.5 rounded text-surface-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors cursor-pointer">
      <div>
        <div className="text-xs font-medium text-surface-700">{label}</div>
        <div className="text-[10px] text-surface-400 mt-0.5">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
          ${checked ? 'bg-accent' : 'bg-surface-300'}
        `}
      >
        <span className={`
          inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `} />
      </button>
    </label>
  );
}

/* ====== MCP 设置 ====== */

function McpSettings() {
  const [servers, setServers] = useState<Array<{ id: string; name: string; command: string; args: string[]; enabled: boolean }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('devwhale-mcp-servers') || '[]');
    } catch { return []; }
  });
  const [form, setForm] = useState({ name: '', command: '', args: '' });
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [mcpErrors, setMcpErrors] = useState<Record<string, string>>({});
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [toolInfos, setToolInfos] = useState<Record<string, Array<{ name: string; description: string }>>>({});

  // 监听主进程的 MCP 崩溃通知
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onMcpCrashed) return;
    const unsub = api.onMcpCrashed((serverId: string) => {
      setRunningIds((prev) => { const n = new Set(prev); n.delete(serverId); return n; });
      setToolInfos((prev) => { const n = { ...prev }; delete n[serverId]; return n; });
      setMcpErrors((prev) => ({ ...prev, [serverId]: '服务器进程意外退出' }));
    });
    return unsub;
  }, []);

  const save = (serversList: typeof servers) => {
    setServers(serversList);
    localStorage.setItem('devwhale-mcp-servers', JSON.stringify(serversList));
  };

  const handleAdd = () => {
    if (!form.name || !form.command) return;
    const newServer = {
      id: `mcp-${Date.now()}`,
      name: form.name,
      command: form.command,
      args: form.args.split(' ').filter(Boolean),
      enabled: true,
    };
    save([...servers, newServer]);
    setForm({ name: '', command: '', args: '' });
  };

  const handleDelete = (id: string) => {
    save(servers.filter((s) => s.id !== id));
  };

  const handleToggle = (id: string) => {
    save(servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  return (
    <div className="space-y-5">
      <Section title="MCP 服务器">
        <p className="text-xs text-surface-400 mb-3">
          Model Context Protocol — 连接外部工具和数据源。配置 stdio 类型的 MCP 服务器，AI 即可调用其提供的工具。
        </p>

        {/* 已有服务器列表 */}
        {servers.length > 0 && (
          <div className="space-y-2 mb-4">
            {servers.map((s) => (
              <div key={s.id}>
              <div
                className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 bg-surface-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-700 truncate">{s.name}</div>
                  <div className="text-[11px] text-surface-400 font-mono truncate mt-0.5">
                    {s.command} {s.args.join(' ')}
                  </div>
                </div>
                {/* 运行状态指示 */}
                {runningIds.has(s.id) ? (
                  <span className="text-[10px] text-success font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    运行中{toolInfos[s.id] ? ` · ${toolInfos[s.id].length}工具` : ''}
                  </span>
                ) : startingIds.has(s.id) ? (
                  <span className="text-[10px] text-accent font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    启动中...
                  </span>
                ) : mcpErrors[s.id] ? (
                  <span className="text-[10px] text-danger font-medium shrink-0 max-w-[160px] truncate">{mcpErrors[s.id]}</span>
                ) : null}
                {/* 启动/停止按钮 */}
                {runningIds.has(s.id) ? (
                  <button
                    onClick={() => {
                      stopMcpServer(s.id);
                      setRunningIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
                      setToolInfos((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                    }}
                    className="shrink-0 px-2 py-1 text-[10px] font-medium bg-amber-500/10 text-amber-600 rounded hover:bg-amber-500/20 transition-colors"
                  >停止</button>
                ) : (
                  <button
                    onClick={async () => {
                      setMcpErrors((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                      setStartingIds((prev) => new Set(prev).add(s.id));
                      try {
                        const { tools } = await startMcpServer(s);
                        setRunningIds((prev) => new Set(prev).add(s.id));
                        setToolInfos((prev) => ({ ...prev, [s.id]: tools.map(t => ({ name: t.name, description: t.description })) }));
                        if (tools.length === 0) setMcpErrors((prev) => ({ ...prev, [s.id]: '无可用工具' }));
                      } catch (e: any) {
                        setMcpErrors((prev) => ({ ...prev, [s.id]: e.message }));
                      } finally {
                        setStartingIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
                      }
                    }}
                    disabled={!s.enabled || startingIds.has(s.id)}
                    className="shrink-0 px-2 py-1 text-[10px] font-medium bg-accent/10 text-accent rounded hover:bg-accent/20 disabled:opacity-30 transition-colors"
                  >{startingIds.has(s.id) ? '...' : '启动'}</button>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => handleToggle(s.id)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-300 peer-checked:bg-accent rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                </label>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {/* 工具列表（运行时展开） */}
              {runningIds.has(s.id) && toolInfos[s.id] && toolInfos[s.id].length > 0 && (
                <div className="mt-2 pt-2 border-t border-surface-100">
                  <div className="flex flex-wrap gap-1">
                    {toolInfos[s.id].map((t) => (
                      <span
                        key={t.name}
                        title={t.description}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-100 text-[10px] text-surface-600 font-mono"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}

        {/* MCP 市场：预置服务器一键安装 */}
        <div className="mb-4">
          <div className="text-xs font-medium text-surface-600 mb-2">MCP 市场 · 一键安装</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { name: 'Filesystem', cmd: 'npx', args: '-y @modelcontextprotocol/server-filesystem .', desc: '读写本地文件' },
              { name: 'GitHub', cmd: 'npx', args: '-y @modelcontextprotocol/server-github', desc: '仓库/PR/Issue 操作', needToken: true },
              { name: 'PostgreSQL', cmd: 'npx', args: '-y @modelcontextprotocol/server-postgres', desc: '数据库查询', needConnStr: true },
              { name: 'Slack', cmd: 'npx', args: '-y @modelcontextprotocol/server-slack', desc: '消息/频道管理', needToken: true },
              { name: 'Brave Search', cmd: 'npx', args: '-y @modelcontextprotocol/server-brave-search', desc: '网页搜索', needToken: true },
              { name: 'Puppeteer', cmd: 'npx', args: '-y @modelcontextprotocol/server-puppeteer', desc: '浏览器自动化' },
            ].map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  if (servers.some((s) => s.name === preset.name)) return;
                  save([...servers, {
                    id: `mcp-${Date.now()}`,
                    name: preset.name,
                    command: preset.cmd,
                    args: preset.args.split(' '),
                    enabled: true,
                  }]);
                }}
                disabled={servers.some((s) => s.name === preset.name)}
                className={`text-left p-2 rounded-lg border text-[11px] transition-colors ${
                  servers.some((s) => s.name === preset.name)
                    ? 'border-success/30 bg-success/5 text-success cursor-default'
                    : 'border-surface-200 bg-surface-0 hover:border-accent hover:bg-accent-muted text-surface-600'
                }`}
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-[10px] text-surface-400 mt-0.5">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 添加新服务器 */}
        <div className="p-3 rounded-xl border border-dashed border-surface-300 bg-surface-50 space-y-2.5">
          <div className="text-xs font-medium text-surface-600">添加 MCP 服务器</div>
          <input
            type="text"
            placeholder="名称（如：Filesystem）"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="命令（如：npx 或 /usr/local/bin/mcp-server）"
            value={form.command}
            onChange={(e) => setForm({ ...form, command: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 font-mono outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="参数（空格分隔，如：-y @modelcontextprotocol/server-filesystem /tmp）"
            value={form.args}
            onChange={(e) => setForm({ ...form, args: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-0 text-sm text-surface-700 font-mono outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!form.name || !form.command}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:bg-surface-200 disabled:text-surface-400 transition-colors"
          >
            添加
          </button>
        </div>
      </Section>


    </div>
  );
}
