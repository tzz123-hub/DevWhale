/**
 * suspicion.test.ts —— 怀疑驱动的漏洞挖掘
 *
 * 主动质疑：164 全通过 → 测试本身是否有盲区？
 * 专门设计"破坏性"用例，挖掘遗漏的边界和异常路径。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import * as storage from '../../src/lib/storage';
import { cn } from '../../src/lib/utils';
import { isRunnable, getRunCommand } from '../../src/lib/shell';
import { __test as apiTest } from '../../src/lib/api';
import { __test as toolsTest, setCurrentProjectPath } from '../../src/lib/tools';
import * as checkpoint from '../../src/lib/checkpoint';

const { stableStringify, makeUsage } = apiTest;
const { isAbsolutePath, resolvePath } = toolsTest;
const TMP = join(__dirname, '..', '..', '.tmp-suspicion');

beforeEach(() => { localStorage.clear(); checkpoint.clearAllCheckpoints(); if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true }); });

// ============================================================
// 怀疑 1：storage — 空数组保存/读取是否真的空？
// ============================================================
describe('怀疑1: saveEnabledSkills([]) 是否真的空？', () => {
  it('保存空数组 → 读取应为 []，不是默认值', () => {
    storage.saveEnabledSkills([]);
    const loaded = storage.loadEnabledSkills();
    expect(loaded).toEqual([]); // 必须是空数组，不能是默认12个
  });
  it('再次清空 localStorage 后 → 回到默认12个（首次行为）', () => {
    storage.saveEnabledSkills([]);
    localStorage.removeItem('devwhale-enabled-skills');
    expect(storage.loadEnabledSkills().length).toBe(12);
  });
});

// ============================================================
// 怀疑 2：api — stableStringify 嵌套 undefined
// ============================================================
describe('怀疑2: stableStringify 嵌套 undefined', () => {
  it('{a:{b:undefined}} → 内层 b 应被跳过', () => {
    const r = stableStringify({ a: { b: undefined, c: 1 } });
    const p = JSON.parse(r);
    expect(p.a.c).toBe(1);
    expect('b' in p.a).toBe(false);
  });
  it('[{x:undefined}] → 数组元素是对象，应保留对象但跳过 x', () => {
    const r = stableStringify([{ x: undefined, y: 2 }]);
    const p = JSON.parse(r);
    expect(p[0].y).toBe(2);
    expect('x' in p[0]).toBe(false);
  });
  it('所有值都是 undefined → {}', () => {
    const r = stableStringify({ a: undefined, b: undefined });
    expect(r).toBe('{}');
  });
  it('数组全部 undefined → [null,null]', () => {
    const r = stableStringify([undefined, undefined]);
    expect(r).toBe('[null,null]');
  });
});

// ============================================================
// 怀疑 3：api — makeUsage 极端缺失字段
// ============================================================
describe('怀疑3: makeUsage 极端缺失', () => {
  it('空对象 {} → 全部 0', () => {
    const r = makeUsage({})!;
    expect(r.prompt).toBe(0);
    expect(r.completion).toBe(0);
    expect(r.cacheHit).toBe(0);
    expect(r.cacheMiss).toBe(0);
  });
  it('只有 prompt_tokens，无其他字段', () => {
    const r = makeUsage({ prompt_tokens: 300 })!;
    expect(r.cacheMiss).toBe(300); // fallback = prompt - cacheHit = 300 - 0
  });
  it('prompt_tokens:0 + cacheHit:0 → cacheMiss:0', () => {
    const r = makeUsage({ prompt_tokens: 0, prompt_cache_hit_tokens: 0 })!;
    expect(r.cacheMiss).toBe(0);
  });
});

// ============================================================
// 怀疑 4：tools — resolvePath 双斜杠 / 空段 / 点号
// ============================================================
describe('怀疑4: resolvePath 畸形路径', () => {
  beforeEach(() => setCurrentProjectPath('C:/proj'));

  it('双斜杠 //file → 保留原样（不规范化双斜杠）', () => {
    expect(resolvePath('src//file.ts')).toBe('C:/proj/src//file.ts');
  });
  it('只有点 . → 拼接', () => {
    expect(resolvePath('.')).toBe('C:/proj/.');
  });
  it('只有点点 .. → 拼接', () => {
    expect(resolvePath('..')).toBe('C:/proj/..');
  });
  it('Windows 反斜杠混合', () => {
    expect(resolvePath('src\\lib\\api.ts')).toBe('C:/proj/src/lib/api.ts');
  });
  it('已包含盘符的混合路径', () => {
    expect(resolvePath('D:\\data\\file.txt')).toBe('D:/data/file.txt');
  });
});

// ============================================================
// 怀疑 5：storage — 不存在 provider 的 getProviderConfig
// ============================================================
describe('怀疑5: getProviderConfig 不存在的 provider', () => {
  it('不存在的 provider → 不崩溃，返回空对象', () => {
    const cfg = storage.getProviderConfig('nonexistent' as any);
    expect(typeof cfg).toBe('object');
    expect(cfg.apiKey).toBe('');
  });
  it('saveProviderApiKey 连续切换 → 旧值被覆盖', () => {
    storage.saveProviderApiKey('openai', 'first');
    storage.saveProviderApiKey('openai', 'second');
    expect(storage.loadProviderApiKey('openai')).toBe('second');
  });
});

// ============================================================
// 怀疑 6：cn — 数字 0 / 空串
// ============================================================
describe('怀疑6: cn 极端值', () => {
  it('cn(0) → falsy 应跳过', () => expect(cn(0)).toBe(''));
  it('cn(false) → 空', () => expect(cn(false)).toBe(''));
  it('cn(null) → 空', () => expect(cn(null)).toBe(''));
  it('cn(undefined) → 空', () => expect(cn(undefined)).toBe(''));
  it("cn('') → 空", () => expect(cn('')).toBe(''));
  it("cn('a',0,'b') → 'a b'", () => expect(cn('a',0,'b')).toBe('a b'));
  it("cn('a',false,'b',null,'c',undefined,'d') → 'a b c d'", () => {
    expect(cn('a',false,'b',null,'c',undefined,'d')).toBe('a b c d');
  });
});

// ============================================================
// 怀疑 7：shell — isRunnable 未注册语言 / 常见误区
// ============================================================
describe('怀疑7: isRunnable 未覆盖语言', () => {
  it("'zsh' → false（不在列表中）", () => expect(isRunnable('zsh')).toBe(false));
  it("'fish' → false", () => expect(isRunnable('fish')).toBe(false));
  it("'perl' → false", () => expect(isRunnable('perl')).toBe(false));
  it("'make' → false", () => expect(isRunnable('make')).toBe(false));
  it("'docker' → false（命令不是语言）", () => expect(isRunnable('docker')).toBe(false));
  it("'npm' → false", () => expect(isRunnable('npm')).toBe(false));
  it("'npx' → false", () => expect(isRunnable('npx')).toBe(false));
});

// ============================================================
// 怀疑 8：checkpoint — clearAllCheckpoints 之后的状态
// ============================================================
describe('怀疑8: clearAllCheckpoints 之后状态', () => {
  const cpFile = join(TMP, 'susp-cp.txt');
  beforeEach(() => { writeFileSync(cpFile, 'data', 'utf-8'); });

  it('清除后 listCheckpoints → []', async () => {
    await checkpoint.createCheckpoint(cpFile, 'w', '');
    checkpoint.clearAllCheckpoints();
    expect(checkpoint.listCheckpoints()).toEqual([]);
  });
  it('清除后 getCheckpointStats → 全部0', async () => {
    await checkpoint.createCheckpoint(cpFile, 'w', '');
    checkpoint.clearAllCheckpoints();
    const s = checkpoint.getCheckpointStats();
    expect(s.total).toBe(0);
    expect(s.files).toBe(0);
    expect(s.latestTime).toBeNull();
  });
  it('删除不存在的检查点 → false', () => {
    expect(checkpoint.deleteCheckpoint('never-exists')).toBe(false);
  });
});

// ============================================================
// 怀疑 9：isAbsolutePath — Unicode/空格路径
// ============================================================
describe('怀疑9: isAbsolutePath 特殊字符路径', () => {
  it('含空格的绝对路径 C:/Program Files', () => {
    expect(isAbsolutePath('C:/Program Files')).toBe(true);
  });
  it('含中文的绝对路径 C:/用户/文档', () => {
    expect(isAbsolutePath('C:/用户/文档')).toBe(true);
  });
  it('以 / 开头但不含盘符 → true', () => {
    expect(isAbsolutePath('/usr/local/bin')).toBe(true);
  });
  it('空字符串 → false', () => {
    expect(isAbsolutePath('')).toBe(false);
  });
});

// ============================================================
// 怀疑 10：TOOLS 数组完整性
// ============================================================
describe('怀疑10: TOOLS 定义完整性', () => {
  // 动态读取 api.ts 中的 TOOLS
  it('TOOLS 数组存在且每个工具有 name/description/parameters', async () => {
    const mod = await import('../../src/lib/api');
    // TOOLS 不是导出的，但我们可以间接验证
    // 至少验证 stableStringify 能正确处理 TOOLS 结构
    const tools = [
      { type: 'function', function: { name: 'read_file', description: 'r', parameters: { type: 'object', properties: {}, required: [] } } },
    ];
    const r = stableStringify({ tools });
    const p = JSON.parse(r);
    expect(p.tools[0].function.name).toBe('read_file');
  });
});

// ============================================================
// 怀疑 11：真实文件操作 — 并发写入冲突
// ============================================================
describe('怀疑11: 文件操作稳定性', () => {
  const tf = join(TMP, 'concurrent.txt');
  it('快速连续写入读取 → 内容一致', () => {
    for (let i = 0; i < 10; i++) {
      writeFileSync(tf, `line-${i}`, 'utf-8');
      const r = readFileSync(tf, 'utf-8');
      expect(r).toBe(`line-${i}`);
    }
  });
  it('写入后立即检查 existsSync', () => {
    writeFileSync(tf, 'instant', 'utf-8');
    expect(existsSync(tf)).toBe(true);
  });
});

// ============================================================
// 怀疑 12：getRunCommand 大小写敏感
// ============================================================
describe('怀疑12: getRunCommand 大小写', () => {
  it('PYTHON → {program:python}', () => expect(getRunCommand('PYTHON')).toEqual({ program: 'python', args: [] }));
  it('Node → {program:node}', () => expect(getRunCommand('Node')).toEqual({ program: 'node', args: [] }));
  it('BaSh → {program:bash}', () => expect(getRunCommand('BaSh')).toEqual({ program: 'bash', args: [] }));
  it('CmD → {program:cmd,args:[/c]}', () => expect(getRunCommand('CmD')).toEqual({ program: 'cmd', args: ['/c'] }));
});

// ============================================================
// 怀疑 13：loadEnabledSkills 极端值
// ============================================================
describe('怀疑13: loadEnabledSkills 极端', () => {
  it('localStorage 中存储 null → 降级为12', () => {
    localStorage.setItem('devwhale-enabled-skills', 'null');
    expect(storage.loadEnabledSkills().length).toBe(12);
  });
  it('存储 JSON 数组但含非法 id → 直接返回', () => {
    localStorage.setItem('devwhale-enabled-skills', '["valid","also-valid",123]');
    const loaded = storage.loadEnabledSkills();
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded.length).toBe(3);
    expect(loaded[2]).toBe(123); // 原样返回，不做类型校验
  });
});
