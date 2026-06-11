/**
 * tools.test.ts — 工具执行器核心函数测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __test, setCurrentProjectPath } from '../tools';

const { isAbsolutePath, resolvePath } = __test;

describe('isAbsolutePath', () => {
  it('Windows 绝对路径', () => {
    expect(isAbsolutePath('C:\\Users\\test\\file.ts')).toBe(true);
    expect(isAbsolutePath('D:/projects/app.tsx')).toBe(true);
    expect(isAbsolutePath('c:\\windows\\system32')).toBe(true);
  });

  it('Unix 绝对路径', () => {
    expect(isAbsolutePath('/home/user/file.ts')).toBe(true);
    expect(isAbsolutePath('/usr/local/bin')).toBe(true);
  });

  it('相对路径', () => {
    expect(isAbsolutePath('src/App.tsx')).toBe(false);
    expect(isAbsolutePath('./components/Sidebar.tsx')).toBe(false);
    expect(isAbsolutePath('../lib/api.ts')).toBe(false);
    expect(isAbsolutePath('file.txt')).toBe(false);
  });
});

describe('resolvePath', () => {
  beforeEach(() => {
    setCurrentProjectPath('C:/Users/test/project');
  });

  it('绝对路径原样返回（规范化斜杠）', () => {
    expect(resolvePath('C:\\Users\\other\\file.ts')).toBe('C:/Users/other/file.ts');
    expect(resolvePath('/home/user/file.ts')).toBe('/home/user/file.ts');
  });

  it('相对路径拼接项目根', () => {
    expect(resolvePath('src/App.tsx')).toBe('C:/Users/test/project/src/App.tsx');
    expect(resolvePath('./components/Sidebar.tsx')).toBe('C:/Users/test/project/./components/Sidebar.tsx');
  });

  it('空项目路径时返回原值', () => {
    setCurrentProjectPath('');
    expect(resolvePath('src/App.tsx')).toBe('src/App.tsx');
  });
});
