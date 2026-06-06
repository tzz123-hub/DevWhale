/**
 * api.ts — devwhale Agent 引擎 v3
 * 策略：流式 Tool Calling（stream: true + delta 累积） + 语义索引注入
 */
import {
  loadRulesMemory, loadSelectedModel, loadProvider, getProviderConfig,
  loadMode, loadGeneralPreferences, loadEnabledSkills, getEnabledSkillItems,
  loadMcpServers,
} from './storage';
import { buildProjectIndex } from './indexer';
import { readFileContent } from './shell';

/* ====== stableStringify ====== */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/* ====== 类型 ====== */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  images?: string[]; // base64 encoded images for vision models
}

export interface ToolProgress {
  toolName: string;
  args: any;
  status: 'running' | 'ok' | 'fail';
  result?: string;
}

export interface AgentCallbacks {
  onToken: (token: string) => void;
  onProgress: (progress: ToolProgress) => void;
  onToolCall: (name: string, args: any) => Promise<string>;
  onDone: (usage: { prompt: number; completion: number; cacheHit: number; cacheMiss: number } | null) => void;
  onError: (err: string) => void;
  onCancelled?: () => void;
  onTerminalOutput?: (text: string) => void;
}

/* ====== Tool 定义 ====== */
const TOOLS = [
  { type: 'function' as const, function: { name: 'read_file', description: '读取文件内容。先看项目结构确认路径存在。', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' } }, required: ['path'] } } },
  { type: 'function' as const, function: { name: 'write_file', description: '创建或覆盖写入文件。父目录不存在会自动创建。', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function' as const, function: { name: 'edit_file', description: '精确替换文件中某段文字。', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'search', 'replace'] } } },
  { type: 'function' as const, function: { name: 'exec_command', description: '执行 shell 命令并返回输出。', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } } },
  { type: 'function' as const, function: { name: 'list_dir', description: '列出目录中文件和子目录。', parameters: { type: 'object', properties: { path: { type: 'string', description: '目录路径，留空=项目根' } }, required: [] } } },
  { type: 'function' as const, function: { name: 'create_docx', description: '创建 Word 文档(.docx)。', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件完整路径' }, title: { type: 'string', description: '文档标题' }, content: { type: 'string', description: '正文内容' } }, required: ['path', 'title', 'content'] } } },
  { type: 'function' as const, function: { name: 'git_status', description: '查看 Git 工作区状态（已修改/已暂存/未跟踪文件）。', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function' as const, function: { name: 'git_diff', description: '查看未暂存的详细改动。参数 staged=true 查看已暂存改动。', parameters: { type: 'object', properties: { staged: { type: 'boolean', description: '是否查看已暂存（staged）的改动' } }, required: [] } } },
  { type: 'function' as const, function: { name: 'git_log', description: '查看最近 N 条提交记录（默认10条）。', parameters: { type: 'object', properties: { count: { type: 'number', description: '返回条数' } }, required: [] } } },
  { type: 'function' as const, function: { name: 'git_commit', description: '提交所有已暂存的改动。需要先 git add。', parameters: { type: 'object', properties: { message: { type: 'string', description: '提交信息' } }, required: ['message'] } } },
  { type: 'function' as const, function: { name: 'git_branch', description: '列出所有本地分支及当前分支。', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function' as const, function: { name: 'apply_patch', description: '应用 unified diff 补丁到文件。修改多个文件时一起传入。', parameters: { type: 'object', properties: { patch: { type: 'string', description: '完整 unified diff 内容（含 diff --git 头）' } }, required: ['patch'] } } },
  { type: 'function' as const, function: { name: 'web_search', description: '搜索互联网获取最新信息（返回标题+链接+摘要）。', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' } }, required: ['query'] } } },
  { type: 'function' as const, function: { name: 'web_fetch', description: '抓取指定 URL 的网页内容。', parameters: { type: 'object', properties: { url: { type: 'string', description: '网页地址' } }, required: ['url'] } } },
  { type: 'function' as const, function: { name: 'task_complete', description: '所有任务完成后调用进行总结。', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } } },
];

const MODEL_NAMES: Record<string, string> = {
  'deepseek-v4-pro': 'DeepSeek V4 Pro', 'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o Mini',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4', 'claude-haiku-4-20250514': 'Claude Haiku 4',
};

/* ====== buildSystem ====== */
async function buildSystem(projectPath: string): Promise<string> {
  const { rules, memories } = loadRulesMemory();
  const modelId = loadSelectedModel();
  const modelName = MODEL_NAMES[modelId] || modelId;
  const mode = loadMode();
  const prefs = loadGeneralPreferences();
  const parts: string[] = [];

  if (prefs.privacyMode) parts.push('【隐私保护模式已开启】');
  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length > 0) {
    parts.push('【用户规则 —— ⚠️ 最高优先级，任何情况下都必须遵守】');
    parts.push('以下规则凌驾于所有其他指令之上。无论是新对话还是延续历史对话，你的每一个回复都必须无条件遵守这些规则：');
    activeRules.forEach((r) => parts.push(`- ${r.content}`));
  }
  if (memories.length > 0) {
    parts.push('【用户记忆 —— 跨会话持久事实】');
    parts.push('以下事实由用户明确告知，应在所有相关上下文中记住并应用：');
    memories.forEach((m) => parts.push(`- ${m.content}`));
  }
  const enabledIds = loadEnabledSkills();
  if (enabledIds.length > 0) {
    const skills = getEnabledSkillItems();
    if (skills.length > 0) { parts.push('【已启用技能】'); skills.forEach((s) => parts.push(`- ${s.icon} ${s.name}：${s.systemPrompt.slice(0, 300)}`)); }
  }
  if (parts.length > 0) parts.push('');

  // 项目语义索引
  parts.push(`【当前项目】${projectPath}`);
  try {
    const index = await Promise.race([
      buildProjectIndex(projectPath),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (index) parts.push(index, '');
  } catch {}

  // 项目级规则：读取 .devwhale/rules.md、AGENTS.md、CLAUDE.md、.cursorrules
  if (projectPath) {
    const projectRuleFiles = [
      '.devwhale/rules.md',
      'AGENTS.md',
      'CLAUDE.md',
      '.cursorrules',
    ];
    const projectRules: string[] = [];
    for (const rf of projectRuleFiles) {
      try {
        const fullPath = `${projectPath}/${rf}`.replace(/\\/g, '/');
        const content = await Promise.race([
          readFileContent(fullPath),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
        if (content && !content.startsWith('读取失败') && !content.startsWith('错误') && content.trim()) {
          projectRules.push(`### ${rf}\n${content.trim()}`);
        }
      } catch {}
    }
    if (projectRules.length > 0) {
      parts.push('【项目规则（自动读取）】');
      parts.push(projectRules.join('\n\n'));
      parts.push('');
    }

    // 技术栈检测
    const techFiles: Record<string, string> = {
      'package.json': 'Node.js / npm 项目',
      'Cargo.toml': 'Rust 项目',
      'go.mod': 'Go 项目',
      'requirements.txt': 'Python 项目（pip）',
      'pyproject.toml': 'Python 项目',
      'CMakeLists.txt': 'C/C++ CMake 项目',
      'Makefile': 'Make 构建项目',
      'Dockerfile': 'Docker 容器化',
      'docker-compose.yml': 'Docker Compose',
      '.github/workflows': 'GitHub Actions CI/CD',
    };
    const detected: string[] = [];
    for (const [file, label] of Object.entries(techFiles)) {
      try {
        const fp = `${projectPath}/${file}`.replace(/\\/g, '/');
        const c = await Promise.race([
          readFileContent(fp),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
        ]);
        if (c && !c.startsWith('读取失败') && !c.startsWith('错误') && c.trim()) {
          detected.push(label);
        }
      } catch {}
    }
    if (detected.length > 0) {
      parts.push(`【技术栈】${detected.join('、')}`);
      parts.push('');
    }
  }

  // MCP 服务器工具
  const mcpServers = loadMcpServers().filter((s) => s.enabled);
  if (mcpServers.length > 0) {
    // 尝试启动 MCP 服务器并获取工具
    const mcpToolDescs: string[] = [];
    for (const server of mcpServers) {
      try {
        const { startMcpServer } = await import('./mcp');
        const tools = await Promise.race([
          startMcpServer(server),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]).catch(() => []);
        if (tools && tools.length > 0) {
          for (const tool of tools) {
            mcpToolDescs.push(`- mcp_${server.id}_${tool.name}: ${tool.description}`);
          }
        }
      } catch {}
    }
    if (mcpToolDescs.length > 0) {
      parts.push('【MCP 工具（来自已配置的服务器）】');
      parts.push(...mcpToolDescs);
      parts.push('');
    }
  }

  parts.push(`你是 ${modelName}，DevWhale 的 AI Agent。`);
  parts.push('');
  parts.push('【Agent 协议】');
  parts.push('1. 用工具直接操作文件。先解释思路，再调工具，看结果，继续或总结。');
  parts.push('2. Word 文档用 create_docx（不是 write_file）。');
  parts.push('3. 修改代码前先用 git_status 检查状态，完成后用 git_diff 展示改动。');
  parts.push('4. 全部完成后调 task_complete 总结。用中文回复。');
  parts.push('5. 需要最新信息或不确定的知识性问题，用 web_search 搜索后再回答。需要查阅网页内容时用 web_fetch。');
  parts.push('6. 【最高优先级】你的文字回复不是工具执行。只有函数调用（tool_calls）才是真实操作。禁止在文字中模拟工具调用过程，禁止描述"我创建了""我验证了"等未发生的操作。');
  parts.push('7. 工具返回"【失败】"或"错误"时，操作没有执行成功。必须如实告知用户，最多尝试1次替代方法。1次之后仍失败，立即调 task_complete 报告失败原因。');

  if (mode === 'yolo') {
    parts.push('【YOLO 模式——全自动执行】');
    parts.push('你是自主 Agent。用户需求直接执行，绝不反问。');
    parts.push('流程：理解需求 → 读必要文件 → 写/改代码 → 执行验证 → 总结。');
    parts.push('关键规则：遇到错误最多尝试1次替代方案。1次替代也失败时，必须如实告知用户失败原因，调 task_complete 结束。禁止无限重试，禁止伪造成功。');
    parts.push('如果读文件失败，换用 list_dir 确认路径，仍失败则报告。');
    parts.push('全部完成后调 task_complete。不要留下未完成的任务。');
    parts.push('如果连续3次工具失败或找不到解决方案，调 task_complete 解释原因并结束。');
  } else if (mode === 'ask') {
    parts.push('【Ask 确认模式——每步确认】');
    parts.push('当前为确认模式。你的第一轮回复中，绝对不要调用任何工具（包括 write_file、edit_file、exec_command）。');
    parts.push('你只能用文字说明你的计划，以"请确认是否继续"结尾。');
    parts.push('用户回复确认后，你才能在下一轮中调用工具执行。');
  } else if (mode === 'plan') {
    parts.push('【Plan 计划模式——先计划后执行】');
    parts.push('你处于只读分析模式。write_file、edit_file、exec_command 这三个工具对你已禁用，调用它们会导致系统错误。');
    parts.push('你能用的工具只有：read_file（读文件）、list_dir（列目录）、web_search（搜索互联网）、git_status / git_diff / git_log（查看 Git 状态）、task_complete（提交计划）。');
    parts.push('收到用户需求后：用 read_file/list_dir 了解现状 → 用文字列出详细计划 → 调用 task_complete 提交。');
  }
  return parts.join('\n');
}

function makeUsage(raw: any) {
  if (!raw) return null;
  return {
    prompt: raw.prompt_tokens || 0, completion: raw.completion_tokens || 0,
    cacheHit: raw.prompt_cache_hit_tokens || 0,
    cacheMiss: raw.prompt_cache_miss_tokens || (raw.prompt_tokens || 0) - (raw.prompt_cache_hit_tokens || 0),
  };
}

/* ====== agentChat：流式 Tool Calling ====== */
export async function agentChat(
  newUserMessage: string,
  history: ChatMessage[],
  projectPath: string,
  callbacks: AgentCallbacks,
  signal?: AbortSignal,
  images?: string[],
): Promise<void> {
  const providerId = loadProvider(), provider = getProviderConfig(providerId);
  const key = provider.apiKey, model = loadSelectedModel();
  if (!key) { callbacks.onToken('\n\n---\n❌ **缺少 API Key**\n原因：未配置 API Key\n建议：左下角头像 → 设置 → 模型 → 填入 DeepSeek API Key'); return; }
  if (!provider.baseUrl) { callbacks.onToken('\n\n---\n❌ **API 地址无效**\n原因：未配置 Base URL\n建议：设置 → 模型 → 检查 API 地址'); return; }
  if (signal?.aborted) { callbacks.onCancelled?.(); return; }

  callbacks.onToken('⏳ ');
  let system: string;
  try { system = await buildSystem(projectPath); }
  catch (e: any) { callbacks.onToken(`\n\n---\n❌ **System Prompt 构建失败**\n原因：${e.message}\n建议：检查项目路径是否有效`); return; }

  // 构建用户消息（支持图片）
  const userMsg: ChatMessage = { role: 'user', content: newUserMessage };
  if (images && images.length > 0) {
    userMsg.images = images;
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history,
    userMsg,
  ];
  callbacks.onToken('');

  type ToolDelta = { index: number; id?: string; type?: 'function'; function?: { name?: string; arguments?: string } };
  let lastUsage: any = null;
  let idleStreak = 0; // 连续无实质操作计数
  const PRODUCTIVE_TOOLS = new Set(['write_file', 'edit_file', 'exec_command']);
  const MAX_CONTEXT_CHARS = 700_000; // ~800K tokens 的安全边界

  for (let turn = 0; ; turn++) {
    if (signal?.aborted) { callbacks.onToken('\n\n⏹ 已停止'); callbacks.onCancelled?.(); return; }

    // 终止条件 1：上下文太长
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0) + (m.images?.join('').length || 0), 0);
    if (totalChars > MAX_CONTEXT_CHARS) {
      const msg = `\n\n---\n⚠️ **Agent 自动终止**\n原因：上下文窗口即将耗尽\n详情：当前 ${(totalChars / 1000).toFixed(0)}K 字符，超过 ${MAX_CONTEXT_CHARS / 1000}K 字符上限（模型窗口 ~1M tokens）\n建议：简化需求或开启新会话`;
      callbacks.onToken(msg);
      callbacks.onDone(makeUsage(lastUsage));
      return;
    }

    // 终止条件 2：连续空转
    if (idleStreak >= 5) {
      const lastTools = messages.slice(-3).filter(m => m.role === 'tool').map(m => (m as any).name || '?').join(', ');
      const msg = `\n\n---\n⚠️ **Agent 自动终止**\n原因：连续 ${idleStreak} 轮无实质操作\n详情：最近只调用了读取类工具（${lastTools || '无'}），没有写文件/编辑/执行命令\n建议：明确告诉 AI 要改哪个文件、做什么改动`;
      callbacks.onToken(msg);
      callbacks.onDone(makeUsage(lastUsage));
      return;
    }
    let res: Response = null as any;
    let fetchError = '';
    // Electron 的 fetch 偶发失败，重试 3 次
    for (let fetchRetry = 0; fetchRetry < 3; fetchRetry++) {
      try {
        res = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: stableStringify({
            max_tokens: 4096,
            messages: messages.map((m) => {
              if (m.images && m.images.length > 0 && m.role === 'user') {
                return {
                  role: 'user',
                  content: [
                    { type: 'text', text: m.content || '' },
                    ...m.images.map((img) => ({
                      type: 'image_url',
                      image_url: { url: img.startsWith('data:') ? img : `data:${img}` },
                    })),
                  ],
                };
              }
              return m;
            }),
            model,
            stream: true,
            ...(model.startsWith('deepseek') ? { thinking: { type: 'enabled' } } : { thinking: { type: 'disabled' } }),
            tools: TOOLS,
          }),
          signal,
        });
        fetchError = '';
        break;
      } catch (e: any) {
        fetchError = e.message;
        if (fetchRetry < 2) await new Promise(r => setTimeout(r, 1000 * (fetchRetry + 1)));
      }
    }
    if (fetchError) { callbacks.onToken(`\n\n---\n❌ **网络请求失败**\n原因：fetch 重试 3 次均失败\n详情：${fetchError}\n建议：检查网络连接或 API 地址`); return; }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 2000 * (turn + 1))); continue; }
      callbacks.onToken(`\n\n---\n❌ **API 请求被拒**\nHTTP 状态码：${res.status}\n详情：${errText.slice(0, 300)}\n建议：${res.status === 401 ? '检查 API Key 是否正确' : res.status === 402 ? '账户余额不足，请充值' : res.status === 429 ? '请求频率过高，已自动重试' : '检查 API 配置'}`); return;
    }

    const reader = res.body?.getReader();
    if (!reader) { callbacks.onToken('\n\n---\n❌ **响应流错误**\n原因：无法读取 API 返回的流式数据\n建议：重试或切换模型'); return; }
    const decoder = new TextDecoder();
    let buffer = '';
    const toolAcc = new Map<number, ToolDelta>();
    let finishReason: string | null = null;
    let usage: any = null;

    // 流式读取
    while (true) {
      if (signal?.aborted) { callbacks.onToken('\n\n⏹ 已停止'); callbacks.onCancelled?.(); return; }
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await reader.read(); } catch (e: any) { callbacks.onToken(`\n\n---\n❌ **流读取中断**\n原因：${e.message}\n建议：网络波动，重试`); return; }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6); if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          const delta = p.choices?.[0]?.delta;
          if (p.choices?.[0]?.finish_reason) finishReason = p.choices[0].finish_reason;
          if (p.usage) { usage = p.usage; lastUsage = p.usage; }
          if (delta?.content) callbacks.onToken(delta.content);
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const key = tc.index; if (!toolAcc.has(key)) toolAcc.set(key, { index: key });
              const cur = toolAcc.get(key)!;
              if (tc.id) cur.id = tc.id; if (tc.type) cur.type = tc.type;
              if (tc.function) { if (!cur.function) cur.function = {}; if (tc.function.name) cur.function.name = tc.function.name; if (tc.function.arguments) cur.function.arguments = (cur.function.arguments || '') + tc.function.arguments; }
            }
          }
        } catch {}
      }
    }

    // 检查 tool_calls
    if (finishReason === 'tool_calls' && toolAcc.size > 0) {
      const tcs = Array.from(toolAcc.values()).map(tc => ({ id: tc.id || '', type: 'function' as const, function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '{}' } }));
      messages.push({ role: 'assistant', content: null, tool_calls: tcs } as any);

      // task_complete 优先处理（单次循环）
      const completeTc = tcs.find((tc) => tc.function.name === 'task_complete');
      if (completeTc) {
        let args: any = {}; try { args = JSON.parse(completeTc.function.arguments); } catch {}
        callbacks.onToken('\n\n✅ ' + (args.summary || '任务完成'));
        callbacks.onDone(makeUsage(usage));
        return;
      }

      // 所有非 task_complete 工具并行执行
      const nonCompleteTcs = tcs.filter((tc) => tc.function.name !== 'task_complete');

      // idle 追踪：本轮有没有实质操作
      const hasProductive = nonCompleteTcs.some((tc) => PRODUCTIVE_TOOLS.has(tc.function.name));
      if (hasProductive) {
        idleStreak = 0;
      } else {
        idleStreak++;
      }

      for (const tc of nonCompleteTcs) {
        let args: any = {}; try { args = JSON.parse(tc.function.arguments); } catch {}
        callbacks.onProgress({ toolName: tc.function.name, args, status: 'running' });
      }

      // 并行执行所有工具
      const results = await Promise.all(nonCompleteTcs.map(async (tc) => {
        let args: any = {}; try { args = JSON.parse(tc.function.arguments); } catch {}
        let result = '';
        for (let retry = 0; retry < 3; retry++) {
          try {
            result = await callbacks.onToolCall(tc.function.name, args);
            callbacks.onProgress({ toolName: tc.function.name, args, status: 'ok', result: result.slice(0, 200) });
            return { id: tc.id, result };
          } catch (e: any) {
            if (retry < 2) { await new Promise(r => setTimeout(r, 1000 * (retry + 1))); continue; }
            result = `工具失败: ${e.message || e}`;
            callbacks.onProgress({ toolName: tc.function.name, args, status: 'fail', result });
            return { id: tc.id, result };
          }
        }
        return { id: tc.id, result };
      }));

      // 按原始顺序回填消息（保持一致性）
      for (const tc of tcs) {
        const r = results.find((r) => r.id === tc.id);
        if (r) {
          messages.push({ role: 'tool', content: r.result, tool_call_id: tc.id } as any);
        }
      }
      continue;
    }

    // 流式结束后有文字 → 已经输出过了，只需 done
    callbacks.onDone(makeUsage(usage));
    return;
  }
}
