/**
 * skillsMarket.ts — Skill 市场数据层 v3
 *
 * 三源聚合：skillsmp.com (REST API) 为主力，
 * skillstore.io / skills.sh 为备用（无公开 API，暂用占位）
 * 榜单排序算法：多关键词搜索 → 去重 → 对数归一化 stars → 时间衰减 → 排序
 */

/* ====== 类型 ====== */

export interface MarketplaceSkill {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string;
  skillUrl: string;
  stars: number;
  updatedAt: number; // Unix 秒
  source: 'skillsmp' | 'skillstore' | 'skillssh';
}

export interface SearchResult {
  skills: MarketplaceSkill[];
  total: number;
}

/* ====== 常量 ====== */

const SKILLSMP_BASE = 'https://skillsmp.com';

/** 各榜单的搜索关键词 —— 覆盖多领域确保多样性 */
const LEADERBOARD_KEYWORDS: Record<'daily' | 'weekly' | 'monthly', string[]> = {
  daily: [
    'agent', 'claude', 'cursor', 'codex', 'automation',
    'mcp', 'tool', 'skill',
  ],
  weekly: [
    'development', 'testing', 'devops', 'security', 'frontend',
    'backend', 'data', 'ai', 'api', 'cli',
  ],
  monthly: [
    'framework', 'database', 'deployment', 'machine-learning',
    'ui', 'monitoring', 'python', 'typescript', 'rust',
    'docker', 'kubernetes', 'llm', 'rag', 'workflow',
  ],
};

/** 日/周/月的时间衰减参数 */
const TIME_DECAY: Record<string, { windowSec: number; power: number }> = {
  daily:   { windowSec: 86400,     power: 0.5 },  // 24h 半衰
  weekly:  { windowSec: 604800,    power: 0.5 },  // 7d 半衰
  monthly: { windowSec: 2592000,   power: 0.3 },  // 30d 慢衰减
};

/* ====== HTTP 工具 ====== */

async function httpGet(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'devwhale/0.3' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ====== skillsmp.com API ====== */

/** 搜索 skillsmp */
export async function searchSkillsMP(
  query: string,
  sortBy: 'stars' | 'recent' = 'stars',
  limit = 20,
): Promise<SearchResult> {
  const url =
    `${SKILLSMP_BASE}/api/v1/skills/search?` +
    `q=${encodeURIComponent(query)}&sortBy=${sortBy}&limit=${Math.min(limit, 50)}`;

  try {
    const raw = await httpGet(url);
    const data = JSON.parse(raw);
    if (!data.success || !data.data?.skills) return { skills: [], total: 0 };

    return {
      skills: data.data.skills.map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        author: s.author,
        description: s.description || '',
        githubUrl: s.githubUrl || '',
        skillUrl: s.skillUrl || '',
        stars: s.stars || 0,
        updatedAt: parseInt(s.updatedAt) || 0,
        source: 'skillsmp' as const,
      })),
      total: data.data.pagination?.total ?? 0,
    };
  } catch {
    return { skills: [], total: 0 };
  }
}

/* ====== skillstore.io 占位 ====== */

export async function searchSkillstore(
  _query: string,
  _limit = 20,
): Promise<SearchResult> {
  // skillstore.io 是 SvelteKit SPA，数据通过客户端 JS 加载，无公开 REST API。
  // 如果将来 skillstore 提供 API，在此接入。
  return { skills: [], total: 0 };
}

/* ====== skills.sh 占位 ====== */

export async function searchSkillssh(
  _query: string,
  _limit = 20,
): Promise<SearchResult> {
  // skills.sh 是 Next.js SPA on Vercel，数据通过 RSC 流内嵌，无公开 REST API。
  // 如果将来 skills.sh 提供 API，在此接入。
  return { skills: [], total: 0 };
}

/* ====== 综合排序算法 ====== */

/**
 * 对数归一化 stars：log10(stars + 1) / log10(maxStars + 1)
 * 避免头部百万级 star 项目主宰榜单
 */
function normalizeStars(stars: number, maxStars: number): number {
  if (maxStars <= 0) return 0;
  return Math.log10(stars + 1) / Math.log10(maxStars + 1);
}

/**
 * 时间衰减：越新的技能得分越高
 * score = 1 / (1 + elapsed / windowSec)^power
 */
function timeDecay(updatedAt: number, nowSec: number, windowSec: number, power: number): number {
  if (updatedAt <= 0) return 0.3; // 无时间数据给基线
  const elapsed = Math.max(0, nowSec - updatedAt);
  return Math.pow(1 / (1 + elapsed / windowSec), power);
}

/**
 * 计算综合得分
 */
function computeScore(
  skill: MarketplaceSkill,
  maxStars: number,
  nowSec: number,
  windowSec: number,
  power: number,
  sourceCount: number, // 该技能来自多少个不同的搜索词（1-多个关键词都搜到了它）
): number {
  const s = normalizeStars(skill.stars, maxStars);
  const t = timeDecay(skill.updatedAt, nowSec, windowSec, power);
  // 来源多样性加成：被多个关键词搜到说明覆盖度广
  const diversity = 1 + (sourceCount - 1) * 0.15;
  return s * t * diversity;
}

/* ====== 榜单（核心 API） ====== */

/**
 * 拉取榜单
 * @param period 'daily' | 'weekly' | 'monthly'
 * @param limit 返回条数
 */
export async function getLeaderboard(
  period: 'daily' | 'weekly' | 'monthly',
  limit = 20,
): Promise<MarketplaceSkill[]> {
  const keywords = LEADERBOARD_KEYWORDS[period] || LEADERBOARD_KEYWORDS.weekly;
  const decay = TIME_DECAY[period] || TIME_DECAY.weekly;
  const nowSec = Math.floor(Date.now() / 1000);

  // 第一阶段：多关键词并行搜索 skillsmp（其余源占位）
  const searchPromises = keywords.map((kw) =>
    searchSkillsMP(kw, 'stars', Math.ceil(limit / 2)),
  );
  // 预留：将来加入 skillstore / skillssh
  // searchPromises.push(...keywords.map(kw => searchSkillstore(kw, limit/3)));
  // searchPromises.push(...keywords.map(kw => searchSkillssh(kw, limit/3)));

  const allResults = await Promise.all(searchPromises);

  // 第二阶段：去重 + 计数来源多样性
  const skillMap = new Map<string, { skill: MarketplaceSkill; sourceCount: number }>();
  for (const result of allResults) {
    for (const skill of result.skills) {
      const existing = skillMap.get(skill.id);
      if (existing) {
        existing.sourceCount++;
        // 保留最新的 updatedAt
        if (skill.updatedAt > existing.skill.updatedAt) {
          existing.skill.updatedAt = skill.updatedAt;
        }
        // 保留最高的 stars
        if (skill.stars > existing.skill.stars) {
          existing.skill.stars = skill.stars;
        }
      } else {
        skillMap.set(skill.id, { skill, sourceCount: 1 });
      }
    }
  }

  const uniqueSkills = Array.from(skillMap.values());
  if (uniqueSkills.length === 0) return [];

  // 第三阶段：计算综合得分并排序
  const maxStars = Math.max(...uniqueSkills.map((s) => s.skill.stars), 1);

  const scored = uniqueSkills.map(({ skill, sourceCount }) => ({
    skill,
    score: computeScore(
      skill,
      maxStars,
      nowSec,
      decay.windowSec,
      decay.power,
      sourceCount,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.skill);
}

/* ====== 搜索（跨源聚合） ====== */

/**
 * 跨源搜索 + 双语翻译
 */
export async function searchAllSources(query: string): Promise<MarketplaceSkill[]> {
  // skillsmp 搜索 + 双语扩展
  const enKeywords = translateToEnglish(query);
  const allQueries = [query];
  if (enKeywords) allQueries.push(...enKeywords);

  const searchPromises = allQueries.map((kw) => searchSkillsMP(kw, 'stars', 20));
  // 预留：skillstore / skillssh
  const allResults = await Promise.all(searchPromises);

  const seen = new Set<string>();
  const merged: MarketplaceSkill[] = [];
  for (const result of allResults) {
    for (const skill of result.skills) {
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        merged.push(skill);
      }
    }
  }

  merged.sort((a, b) => b.stars - a.stars);
  return merged.slice(0, 30);
}

/* ====== GitHub 下载 SKILL.md ====== */

export async function fetchSkillFromGitHub(
  skill: MarketplaceSkill,
): Promise<{ name: string; desc: string; systemPrompt: string } | null> {
  const candidates = ['main/SKILL.md', 'master/SKILL.md', 'main/skill.md', 'master/skill.md'];
  let rawContent = '';

  for (const branchPath of candidates) {
    const baseUrl = skill.githubUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/');
    const url = `${baseUrl}/${branchPath}`;
    try {
      rawContent = await httpGet(url, 6000);
      break;
    } catch {
      continue;
    }
  }

  if (!rawContent) return null;

  let name = skill.name;
  const titleMatch = rawContent.match(/^#\s+(.+)$/m);
  if (titleMatch) name = titleMatch[1];

  return {
    name,
    desc: skill.description,
    systemPrompt: rawContent.slice(0, 2000),
  };
}

/* ====== 双语翻译 ====== */

export function translateToEnglish(zh: string): string[] | null {
  const lower = zh.toLowerCase().trim();
  const map: Record<string, string[]> = {
    'ppt': ['slides', 'presentation', 'pptx'],
    '幻灯片': ['slides', 'presentation'],
    '自动化': ['automation', 'ci', 'workflow', 'pipeline'],
    '测试': ['testing', 'test', 'unit-test'],
    '单元测试': ['unit-test', 'testing', 'jest', 'vitest'],
    '集成测试': ['integration-test', 'e2e'],
    '爬虫': ['scraping', 'crawler', 'spider', 'puppeteer', 'playwright'],
    '部署': ['deployment', 'devops', 'docker', 'kubernetes'],
    '翻译': ['translation', 'i18n', 'localization'],
    '文档': ['documentation', 'docs', 'readme', 'markdown'],
    '代码审查': ['code-review', 'review', 'linting', 'eslint'],
    '安全': ['security', 'audit', 'vulnerability'],
    '性能': ['performance', 'optimization', 'profiling', 'benchmark'],
    '日志': ['logging', 'monitoring', 'observability'],
    '监控': ['monitoring', 'alerting', 'dashboard', 'grafana'],
    '数据库': ['database', 'sql', 'postgresql', 'mysql', 'migration'],
    'api': ['api', 'rest', 'graphql', 'openapi', 'swagger'],
    '前端': ['frontend', 'react', 'vue', 'ui', 'component'],
    '后端': ['backend', 'server', 'express', 'fastapi'],
    '命令行': ['cli', 'terminal', 'command-line', 'bash'],
    '容器': ['docker', 'container', 'kubernetes'],
    '微服务': ['microservice', 'service', 'grpc', 'message-queue'],
    '数据分析': ['data-analysis', 'analytics', 'pandas'],
    '机器学习': ['machine-learning', 'ml', 'ai', 'llm', 'gpt'],
    '图像': ['image', 'screenshot', 'ocr'],
    '邮件': ['email', 'smtp', 'notification'],
    '通知': ['notification', 'webhook', 'alert'],
    '聊天': ['chat', 'message', 'slack', 'discord'],
    '支付': ['payment', 'stripe', 'checkout'],
    '认证': ['authentication', 'auth', 'oauth', 'jwt'],
    '缓存': ['cache', 'redis'],
    '搜索': ['search', 'elasticsearch', 'fulltext'],
    '报表': ['report', 'dashboard', 'chart'],
    '表格': ['spreadsheet', 'excel', 'csv'],
    '视频': ['video', 'ffmpeg', 'streaming'],
    '音频': ['audio', 'speech', 'transcription'],
    '备份': ['backup', 'restore', 'snapshot'],
    '迁移': ['migration', 'migrate'],
    '重构': ['refactor', 'refactoring'],
    '调试': ['debug', 'debugging', 'troubleshoot'],
    '格式化': ['formatter', 'prettier', 'linter'],
    '模板': ['template', 'scaffold', 'boilerplate', 'generator'],
    '工作流': ['workflow', 'pipeline', 'automation'],
    '区块链': ['blockchain', 'web3', 'solidity'],
    '游戏': ['game', 'gaming'],
    '物联网': ['iot', 'mqtt'],
    '简历': ['resume', 'cv'],
    '博客': ['blog', 'cms'],
  };

  if (map[lower]) return map[lower];

  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }

  if (/^[a-zA-Z0-9\s\-_]+$/.test(lower)) return null;
  return null;
}
