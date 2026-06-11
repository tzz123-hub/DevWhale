/**
 * DiffViewer.test.tsx — Diff 解析器测试
 */
import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../DiffViewer';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';

describe('parseUnifiedDiff', () => {
  it('解析文件头', () => {
    const diff = `diff --git a/src/App.tsx b/src/App.tsx
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,3 +1,4 @@
 import React from 'react';
+import { useState } from 'react';
 
 function App() {`;
    const result = parseUnifiedDiff(diff);
    expect(result.fileName).toBe('src/App.tsx');
    expect(result.hunks.length).toBeGreaterThan(0);
  });

  it('解析新增行', () => {
    const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
 line1
+line2
 line3`;
    const result = parseUnifiedDiff(diff);
    const hunk = result.hunks[0];
    const added = hunk.lines.filter(l => l.type === 'add');
    expect(added.length).toBe(1);
    expect(added[0].content).toBe('line2');
  });

  it('解析删除行', () => {
    const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,2 @@
 line1
-line2
 line3`;
    const result = parseUnifiedDiff(diff);
    const removed = result.hunks[0].lines.filter(l => l.type === 'remove');
    expect(removed.length).toBe(1);
    expect(removed[0].content).toBe('line2');
  });

  it('空 diff', () => {
    const result = parseUnifiedDiff('');
    expect(result.fileName).toBe('');
    expect(result.hunks).toHaveLength(0);
  });

  it('多 hunk', () => {
    const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
 line1
+new1
 line2
@@ -10,2 +11,3 @@
 line10
+new2
 line11`;
    const result = parseUnifiedDiff(diff);
    expect(result.hunks).toHaveLength(2);
  });
});

describe('DiffViewer 组件', () => {
  it('渲染空状态', () => {
    render(<DiffViewer diffText="" />);
    expect(screen.getByText('无改动（工作区干净）')).toBeInTheDocument();
  });

  it('渲染 diff 内容', () => {
    const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
 line1
+added line
 line2`;
    render(<DiffViewer diffText={diff} />);
    expect(screen.getByText('test.ts')).toBeInTheDocument();
    expect(screen.getByText('added line')).toBeInTheDocument();
  });

  it('渲染统计信息', () => {
    const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
-line1
+new1
 line2`;
    render(<DiffViewer diffText={diff} />);
    // 1 added, 1 removed
    expect(screen.getByText(/新增/)).toBeInTheDocument();
    expect(screen.getByText(/删除/)).toBeInTheDocument();
  });
});
