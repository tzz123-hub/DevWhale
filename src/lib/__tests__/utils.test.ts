/**
 * utils.test.ts — 工具函数测试
 */
import { describe, it, expect } from 'vitest';
import { cn, formatTime, formatDate } from '../utils';

describe('cn', () => {
  it('合并类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar')).toBe('foo');
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('条件类名', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });
});

describe('formatTime', () => {
  it('格式化时间戳', () => {
    // 使用固定时间戳 2026-06-10 14:30:00
    const ts = new Date('2026-06-10T14:30:00').getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatDate', () => {
  it('格式化日期', () => {
    const ts = new Date('2026-06-10').getTime();
    const result = formatDate(ts);
    expect(result).toMatch(/6月\d{1,2}日/);
  });
});
