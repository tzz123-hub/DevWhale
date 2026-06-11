/**
 * shell.test.ts — Shell 工具函数测试
 */
import { describe, it, expect } from 'vitest';
import { isRunnable, getRunCommand } from '../shell';

describe('isRunnable', () => {
  it('可执行语言', () => {
    expect(isRunnable('python')).toBe(true);
    expect(isRunnable('py')).toBe(true);
    expect(isRunnable('bash')).toBe(true);
    expect(isRunnable('sh')).toBe(true);
    expect(isRunnable('powershell')).toBe(true);
    expect(isRunnable('pwsh')).toBe(true);
    expect(isRunnable('node')).toBe(true);
    expect(isRunnable('js')).toBe(true);
    expect(isRunnable('ruby')).toBe(true);
    expect(isRunnable('rb')).toBe(true);
  });

  it('不可执行语言', () => {
    expect(isRunnable('typescript')).toBe(false);
    expect(isRunnable('tsx')).toBe(false);
    expect(isRunnable('rust')).toBe(false);
    expect(isRunnable('go')).toBe(false);
    expect(isRunnable('')).toBe(false);
  });

  it('大小写不敏感', () => {
    expect(isRunnable('Python')).toBe(true);
    expect(isRunnable('BASH')).toBe(true);
  });
});

describe('getRunCommand', () => {
  it('Python', () => {
    expect(getRunCommand('python')).toEqual({ program: 'python', args: [] });
    expect(getRunCommand('py')).toEqual({ program: 'python', args: [] });
  });

  it('Shell', () => {
    expect(getRunCommand('bash')).toEqual({ program: 'bash', args: [] });
    expect(getRunCommand('shell')).toEqual({ program: 'bash', args: [] });
  });

  it('PowerShell', () => {
    expect(getRunCommand('powershell')).toEqual({ program: 'powershell', args: [] });
    expect(getRunCommand('pwsh')).toEqual({ program: 'powershell', args: [] });
  });

  it('CMD / Batch', () => {
    expect(getRunCommand('cmd')).toEqual({ program: 'cmd', args: ['/c'] });
    expect(getRunCommand('bat')).toEqual({ program: 'cmd', args: ['/c'] });
  });

  it('Node.js', () => {
    expect(getRunCommand('node')).toEqual({ program: 'node', args: [] });
    expect(getRunCommand('js')).toEqual({ program: 'node', args: [] });
  });

  it('未知语言', () => {
    expect(getRunCommand('unknown')).toEqual({ program: '', args: [] });
  });
});
