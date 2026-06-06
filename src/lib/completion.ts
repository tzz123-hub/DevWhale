/**
 * AI 代码补全引擎 —— Monaco InlineCompletionProvider
 * 调用 DeepSeek API 实现 Ghost Text 补全
 */
import { loadProvider, getProviderConfig, loadSelectedModel } from './storage';

/** 补全缓存，避免同一位置重复请求 */
const completionCache = new Map<string, { text: string; time: number }>();
const CACHE_TTL = 30000; // 30 秒
let pendingRequest: Promise<string> | null = null;

/**
 * 请求 AI 补全
 * @param prefix 光标前的代码
 * @param suffix 光标后的代码（用于 FIM）
 * @param language 语言标识
 */
export async function getAICompletion(
  prefix: string,
  suffix: string,
  language: string
): Promise<string> {
  const providerId = loadProvider();
  const provider = getProviderConfig(providerId);
  const model = loadSelectedModel();
  const key = provider.apiKey;

  if (!key || !provider.baseUrl) return '';

  // 去重缓存
  const cacheKey = `${prefix.slice(-200)}|${suffix.slice(0, 50)}`;
  const cached = completionCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.text;

  // 如果已有进行中的请求，跳过（避免并发竞争）
  if (pendingRequest) return '';

  const prompt = `Complete the following ${language} code. Return ONLY the completion code, no explanation.

Code before cursor:
\`\`\`${language}
${prefix.slice(-2000)}
\`\`\`

Code after cursor:
\`\`\`${language}
${suffix.slice(0, 500)}
\`\`\`

Completion:`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 150,
        temperature: 0.1,
        stop: ['\n\n', '```'],
        messages: [
          {
            role: 'system',
            content:
              'You are a code completion engine. Complete the given code snippet. Return ONLY the completion, no explanation, no markdown. Do not repeat the prefix.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!resp.ok) return '';

    const data = await resp.json();
    const completion = data.choices?.[0]?.message?.content || '';

    // 清理：去除可能的 markdown 标记和重复前缀
    let cleaned = completion
      .replace(/^```[\s\S]*?\n/, '')
      .replace(/\n```$/, '')
      .trim();

    // 避免补全内容与已有代码重复
    if (cleaned && suffix && suffix.startsWith(cleaned.split('\n')[0])) {
      cleaned = '';
    }

    // 缓存
    if (cleaned) {
      completionCache.set(cacheKey, { text: cleaned, time: Date.now() });
      // 限制缓存大小
      if (completionCache.size > 50) {
        const oldest = completionCache.keys().next().value;
        if (oldest) completionCache.delete(oldest);
      }
    }

    return cleaned;
  } catch {
    return '';
  }
}

/** 清除补全缓存 */
export function clearCompletionCache() {
  completionCache.clear();
}
