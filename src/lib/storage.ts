import { Conversation, Mode, Project } from '../types/chat';

const KEYS = {
  conversations: 'devwhale-conversations',
  activeId: 'devwhale-active-conversation',
  username: 'devwhale-username',
  mode: 'devwhale-mode',
} as const;

/* ====== 会话持久化 ====== */

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEYS.conversations);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export function saveConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(KEYS.conversations, JSON.stringify(convs));
  } catch {
    // 存储满时静默失败
  }
}

/* ====== 活跃会话 ID ====== */

export function loadActiveConversationId(): string | null {
  return localStorage.getItem(KEYS.activeId);
}

export function saveActiveConversationId(id: string | null): void {
  if (id) {
    localStorage.setItem(KEYS.activeId, id);
  } else {
    localStorage.removeItem(KEYS.activeId);
  }
}

/* ====== 项目持久化 ====== */

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem('devwhale-projects');
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem('devwhale-projects', JSON.stringify(projects));
  } catch { /* localStorage 不可用时静默跳过 */ }
}

/* ====== 用户名 ====== */

export function loadUsername(): string {
  return localStorage.getItem(KEYS.username) || 'DevWhale';
}

export function saveUsername(name: string): void {
  localStorage.setItem(KEYS.username, name);
}

/* ====== 模式 ====== */

export function loadMode(): Mode {
  return (localStorage.getItem(KEYS.mode) as Mode) || 'yolo';
}

export function saveMode(mode: Mode): void {
  localStorage.setItem(KEYS.mode, mode);
}

/* ====== 对话流设置 ====== */

export type ChatDensity = 'compact' | 'comfortable';
export type CodeTheme = 'dark' | 'light';

export interface ChatSettings {
  density: ChatDensity;
  codeTheme: CodeTheme;
  showTimestamps: boolean;
  autoScroll: boolean;
  typingSpeed: number; // ms per tick, lower = faster
}

const DEFAULT_CHAT: ChatSettings = {
  density: 'comfortable',
  codeTheme: 'dark',
  showTimestamps: true,
  autoScroll: true,
  typingSpeed: 20,
};

export function loadChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem('devwhale-chat-settings');
    if (!raw) return { ...DEFAULT_CHAT };
    return { ...DEFAULT_CHAT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CHAT };
  }
}

export function saveChatSettings(s: ChatSettings): void {
  localStorage.setItem('devwhale-chat-settings', JSON.stringify(s));
}

/* ====== API 配置 ====== */

export function loadApiKey(): string {
  return localStorage.getItem('devwhale-api-key') || '';
}

export function saveApiKey(key: string): void {
  if (key) {
    localStorage.setItem('devwhale-api-key', key);
  } else {
    localStorage.removeItem('devwhale-api-key');
  }
}

export function loadSelectedModel(): string {
  return localStorage.getItem('devwhale-selected-model') || 'deepseek-v4-pro';
}

export function saveSelectedModel(model: string): void {
  localStorage.setItem('devwhale-selected-model', model);
}

/* ====== 模型提供商 ====== */

export type ProviderId = 'deepseek' | 'openai' | 'anthropic';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  models: { id: string; name: string; desc: string }[];
  apiKey: string;
}

const PROVIDERS: Record<ProviderId, Omit<ProviderConfig, 'apiKey'>> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-v4-pro', name: 'V4 Pro', desc: '最强推理 · 1M 上下文' },
      { id: 'deepseek-v4-flash', name: 'V4 Flash', desc: '快速响应 · 高性价比' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', desc: '多模态 · 快速' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '轻量 · 便宜' },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: '平衡 · 编码强' },
      { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', desc: '极速 · 轻量' },
    ],
  },
};

export function loadProvider(): ProviderId {
  return (localStorage.getItem('devwhale-provider') as ProviderId) || 'deepseek';
}

export function saveProvider(id: ProviderId): void {
  localStorage.setItem('devwhale-provider', id);
}

export function loadProviderApiKey(providerId: ProviderId): string {
  return localStorage.getItem(`devwhale-apikey-${providerId}`) || '';
}

export function saveProviderApiKey(providerId: ProviderId, key: string): void {
  if (key) {
    localStorage.setItem(`devwhale-apikey-${providerId}`, key);
  } else {
    localStorage.removeItem(`devwhale-apikey-${providerId}`);
  }
}

export function getProviderConfig(providerId: ProviderId): ProviderConfig {
  const base = PROVIDERS[providerId];
  return { ...base, apiKey: loadProviderApiKey(providerId) };
}

/** 兼容旧版：迁移旧的 apiKey 到 deepseek 提供商 */
export function migrateLegacyApiKey(): void {
  const oldKey = localStorage.getItem('devwhale-api-key');
  if (oldKey) {
    if (!localStorage.getItem('devwhale-apikey-deepseek')) {
      localStorage.setItem('devwhale-apikey-deepseek', oldKey);
    }
    localStorage.removeItem('devwhale-api-key');
  }
}

/** 检测是否首次启动（从未配置过任何 API Key） */
export function isFirstLaunch(): boolean {
  const providers: ProviderId[] = ['deepseek', 'openai', 'anthropic'];
  return providers.every((p) => !localStorage.getItem(`devwhale-apikey-${p}`));
}

/* ====== 技能系统 ====== */

export interface SkillItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: string;
  systemPrompt: string;
}

/** 内置技能库 */
export const BUILTIN_SKILLS: SkillItem[] = [
  { id: 'code-review', name: '代码审查', desc: '审查代码质量、发现潜在 Bug', icon: '🔍', category: '开发', systemPrompt: '你是一个资深代码审查专家。对用户提供的代码进行严格审查：检查逻辑错误、安全漏洞、性能问题、代码风格。给出具体的改进建议和修改方案。' },
  { id: 'test-gen', name: '测试生成', desc: '自动生成单元测试和集成测试', icon: '🧪', category: '开发', systemPrompt: '你是一个测试工程师。为代码自动生成全面的测试用例，包括单元测试、集成测试、边界条件测试。使用 jest/vitest 等主流框架。' },
  { id: 'doc-writer', name: '文档编写', desc: '生成 API 文档、README、注释', icon: '📝', category: '开发', systemPrompt: '你是一个技术文档专家。为项目生成清晰、规范的文档：README、API 文档、架构说明。使用 Markdown 格式，结构清晰。' },
  { id: 'perf-optimize', name: '性能优化', desc: '分析和优化代码性能瓶颈', icon: '⚡', category: '开发', systemPrompt: '你是一个性能优化专家。分析代码的性能瓶颈，提出具体的优化方案：时间复杂度优化、内存优化、渲染优化、网络请求优化。' },
  { id: 'security-audit', name: '安全审计', desc: '检查安全漏洞和风险点', icon: '🛡️', category: '安全', systemPrompt: '你是一个安全审计专家。检查代码中的安全漏洞：注入攻击、XSS、CSRF、敏感信息泄露、不安全的依赖。给出修复方案。' },
  { id: 'sql-expert', name: 'SQL 专家', desc: '编写和优化 SQL 查询', icon: '🗄️', category: '数据', systemPrompt: '你是一个数据库专家。编写高效SQL查询，优化慢查询，设计表结构。精通 MySQL、PostgreSQL、SQLite。' },
  { id: 'git-assist', name: 'Git 助手', desc: 'Git 操作指导和冲突解决', icon: '🔀', category: '工具', systemPrompt: '你是一个 Git 专家。帮助用户解决 Git 问题：合并冲突、分支管理、rebase 操作、提交规范。给出具体的 Git 命令。' },
  { id: 'ui-ux', name: 'UI/UX 设计', desc: '界面设计和用户体验优化', icon: '🎨', category: '设计', systemPrompt: '你是一个 UI/UX 设计师。提供界面设计建议：布局优化、配色方案、交互改进、响应式设计。使用 Tailwind CSS 实现。' },
  { id: 'devops', name: 'DevOps 部署', desc: 'CI/CD 配置和部署方案', icon: '🚀', category: '运维', systemPrompt: '你是一个 DevOps 工程师。帮助配置 CI/CD 流水线、Docker 容器化、云服务部署。提供具体的配置文件和命令。' },
  { id: 'data-analysis', name: '数据分析', desc: '数据处理和可视化分析', icon: '📊', category: '数据', systemPrompt: '你是一个数据分析师。帮助处理和分析数据：Python/pandas 数据处理、图表生成、统计分析和洞察提取。' },
  { id: 'api-design', name: 'API 设计', desc: 'RESTful/GraphQL API 设计', icon: '🔌', category: '开发', systemPrompt: '你是一个 API 设计专家。设计规范的 RESTful 或 GraphQL API：路由设计、请求响应格式、错误处理、认证授权、版本管理。' },
  { id: 'refactor', name: '代码重构', desc: '重构遗留代码、改善架构', icon: '♻️', category: '开发', systemPrompt: '你是一个代码重构专家。分析遗留代码，提出重构方案：提取函数、消除重复、改善命名、引入设计模式。保证功能不变。' },
];

export function loadEnabledSkills(): string[] {
  try {
    const raw = localStorage.getItem('devwhale-enabled-skills');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* localStorage 不可用则使用默认值 */ }
  // 首次使用：默认启用所有内置 skill
  const defaultIds = BUILTIN_SKILLS.map(s => s.id);
  saveEnabledSkills(defaultIds);
  return defaultIds;
}

export function saveEnabledSkills(ids: string[]): void {
  localStorage.setItem('devwhale-enabled-skills', JSON.stringify(ids));
}

export function loadShowRecommendations(): boolean {
  return localStorage.getItem('devwhale-show-recommendations') !== 'false';
}

export function saveShowRecommendations(show: boolean): void {
  localStorage.setItem('devwhale-show-recommendations', String(show));
}

/* ====== 自定义 Skill（从市场安装） ====== */

const CUSTOM_SKILLS_KEY = 'devwhale-custom-skills';

export function loadCustomSkills(): SkillItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomSkills(skills: SkillItem[]): void {
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
}

export function installCustomSkill(skill: SkillItem): void {
  const skills = loadCustomSkills();
  if (!skills.find(s => s.id === skill.id)) {
    skills.push(skill);
    saveCustomSkills(skills);
  }
}

export function uninstallCustomSkill(id: string): void {
  const skills = loadCustomSkills().filter(s => s.id !== id);
  saveCustomSkills(skills);
  // 同步从启用列表移除
  const enabled = loadEnabledSkills().filter(eid => eid !== id);
  saveEnabledSkills(enabled);
}

/** 获取所有可用的 Skill（内置 + 自定义） */
export function getAllSkills(): SkillItem[] {
  return [...BUILTIN_SKILLS, ...loadCustomSkills()];
}

/** 获取所有已启用的 Skill 完整对象 */
export function getEnabledSkillItems(): SkillItem[] {
  const enabledIds = loadEnabledSkills();
  const all = getAllSkills();
  return all.filter(s => enabledIds.includes(s.id));
}

/* ====== 通用偏好设置 ====== */

export type LinkOpenMode = 'always-ask' | 'auto-browser';

export interface GeneralPreferences {
  linkOpenMode: LinkOpenMode;
  fontSize: number;
  language: string;
  privacyMode: boolean;
}

const DEFAULT_PREFS: GeneralPreferences = {
  linkOpenMode: 'always-ask',
  fontSize: 14,
  language: 'zh',
  privacyMode: false,
};

export function loadGeneralPreferences(): GeneralPreferences {
  try {
    const raw = localStorage.getItem('devwhale-general-preferences');
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveGeneralPreferences(p: GeneralPreferences): void {
  localStorage.setItem('devwhale-general-preferences', JSON.stringify(p));
}

/* ====== 规则与记忆 ====== */

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
}

export interface RuleItem {
  id: string;
  content: string;
  enabled: boolean;
  createdAt: number;
}

export interface RulesMemory {
  rules: RuleItem[];
  memories: MemoryItem[];
}

const DEFAULT_RULES_MEMORY: RulesMemory = {
  rules: [],
  memories: [],
};

export function loadRulesMemory(): RulesMemory {
  try {
    const raw = localStorage.getItem('devwhale-rules-memory');
    if (!raw) return { ...DEFAULT_RULES_MEMORY, rules: [], memories: [] };
    return { ...DEFAULT_RULES_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { rules: [], memories: [] };
  }
}

export function saveRulesMemory(rm: RulesMemory): void {
  localStorage.setItem('devwhale-rules-memory', JSON.stringify(rm));
}

/* ====== MCP 服务器配置 ====== */

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export function loadMcpServers(): McpServerConfig[] {
  try {
    const raw = localStorage.getItem('devwhale-mcp-servers');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  localStorage.setItem('devwhale-mcp-servers', JSON.stringify(servers));
}
