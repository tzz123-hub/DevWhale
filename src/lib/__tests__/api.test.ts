/**
 * api.test.ts — API 引擎核心函数测试
 */
import { describe, it, expect } from 'vitest';
import { __test } from '../api';

const { stableStringify, makeUsage } = __test;

describe('stableStringify', () => {
  it('基础类型', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(true)).toBe('true');
  });

  it('对象键按字母排序', () => {
    const obj = { b: 1, a: 2, c: 3 };
    expect(stableStringify(obj)).toBe('{"a":2,"b":1,"c":3}');
  });

  it('嵌套对象', () => {
    const obj = { outer: { b: 2, a: 1 } };
    expect(stableStringify(obj)).toBe('{"outer":{"a":1,"b":2}}');
  });

  it('数组', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('混合结构', () => {
    const obj = { tools: [{ name: 'z' }, { name: 'a' }] };
    expect(stableStringify(obj)).toBe('{"tools":[{"name":"z"},{"name":"a"}]}');
  });

  it('空对象和空数组', () => {
    expect(stableStringify({})).toBe('{}');
    expect(stableStringify([])).toBe('[]');
  });
});

describe('makeUsage', () => {
  it('null/undefined 输入', () => {
    expect(makeUsage(null)).toBeNull();
    expect(makeUsage(undefined)).toBeNull();
  });

  it('正常值', () => {
    const raw = {
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_cache_hit_tokens: 300,
      prompt_cache_miss_tokens: 700,
    };
    const result = makeUsage(raw);
    expect(result).toEqual({
      prompt: 1000,
      completion: 500,
      cacheHit: 300,
      cacheMiss: 700,
    });
  });

  it('值为 0 时不丢失（falsy 陷阱修复验证）', () => {
    const raw = {
      prompt_tokens: 1000,
      completion_tokens: 0,
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: 0,
    };
    const result = makeUsage(raw);
    expect(result!.prompt).toBe(1000);
    expect(result!.completion).toBe(0);   // 之前 || 会把 0 覆盖为 0（碰巧）
    expect(result!.cacheHit).toBe(0);      // 关键：之前 || 会把 0 覆盖为 1000
    expect(result!.cacheMiss).toBe(0);     // 关键：之前 || 会把 0 覆盖为 1000
  });

  it('全部命中缓存', () => {
    const raw = {
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_cache_hit_tokens: 1000,
      prompt_cache_miss_tokens: 0,
    };
    const result = makeUsage(raw);
    expect(result!.cacheHit).toBe(1000);
    expect(result!.cacheMiss).toBe(0);
  });

  it('缺失字段回退为 0', () => {
    const raw = { prompt_tokens: 500 };
    const result = makeUsage(raw);
    expect(result).toEqual({
      prompt: 500,
      completion: 0,
      cacheHit: 0,
      cacheMiss: 500, // fallback: prompt_tokens - cacheHit
    });
  });
});
