/**
 * FileTree.test.tsx — 文件树组件测试
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree, type FileNode } from '../FileTree';

const mockTree: FileNode = {
  name: 'project',
  path: '/project',
  type: 'directory',
  children: [
    {
      name: 'src',
      path: '/project/src',
      type: 'directory',
      children: [
        { name: 'App.tsx', path: '/project/src/App.tsx', type: 'file' },
        { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
      ],
    },
    { name: 'package.json', path: '/project/package.json', type: 'file' },
    { name: 'README.md', path: '/project/README.md', type: 'file' },
  ],
};

describe('FileTree', () => {
  it('渲染根节点名称和统计', () => {
    render(<FileTree root={mockTree} />);
    expect(screen.getByText('project')).toBeInTheDocument();
    expect(screen.getByText(/4 个文件/)).toBeInTheDocument();
  });

  it('默认展开第一层目录', () => {
    render(<FileTree root={mockTree} />);
    // src 目录应该可见，因为 depth=0 => depth<=1
    expect(screen.getByText('src')).toBeInTheDocument();
    // App.tsx 在展开的 src 下可见
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });

  it('点击文件触发 onSelectFile', () => {
    const onSelect = vi.fn();
    render(<FileTree root={mockTree} onSelectFile={onSelect} />);
    fireEvent.click(screen.getByText('package.json'));
    expect(onSelect).toHaveBeenCalledWith('/project/package.json');
  });

  it('点击目录切换展开/折叠', () => {
    const onSelect = vi.fn();
    render(<FileTree root={mockTree} onSelectFile={onSelect} />);
    const srcBtn = screen.getByText('src');

    // 初始展开 → App.tsx 可见
    expect(screen.getByText('App.tsx')).toBeInTheDocument();

    // 点击折叠
    fireEvent.click(srcBtn);
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

    // 点击展开
    fireEvent.click(srcBtn);
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });

  it('空子节点显示提示', () => {
    const emptyTree: FileNode = {
      name: 'empty',
      path: '/empty',
      type: 'directory',
      children: [],
    };
    render(<FileTree root={emptyTree} />);
    expect(screen.getByText('空目录')).toBeInTheDocument();
  });

  it('无 children 显示加载中', () => {
    const loadingTree: FileNode = {
      name: 'loading',
      path: '/loading',
      type: 'directory',
    };
    render(<FileTree root={loadingTree} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});
