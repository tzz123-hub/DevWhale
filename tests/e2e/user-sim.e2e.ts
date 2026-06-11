/**
 * Electron E2E 测试 — 模拟真实用户操作
 *
 * 运行方式：
 *   1. npm run build        （先构建）
 *   2. npx electron tests/e2e/user-sim.e2e.ts
 *
 * 测试流程：
 *   打开应用 → 切换模式 → 输入消息 → 验证回复 → 切换面板 → 打开文件
 */
import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

test.describe('DevWhale E2E', () => {
  let electronApp: any;
  let window: any;

  test.beforeAll(async () => {
    // 启动 Electron 应用
    electronApp = await electron.launch({
      args: ['.'], // 当前工作目录即项目根
      executablePath: require('electron'),
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('TC-E2E-01: 应用启动正常', async () => {
    const title = await window.title();
    expect(title).toBe('devwhale');
  });

  test('TC-E2E-02: 侧栏可见', async () => {
    const sidebarText = await window.locator('h1').first().textContent();
    expect(sidebarText).toBe('DevWhale');
  });

  test('TC-E2E-03: 输入框可交互', async () => {
    const textarea = window.locator('textarea[placeholder*="输入"]');
    await textarea.fill('写一个 Hello World');
    const value = await textarea.inputValue();
    expect(value).toBe('写一个 Hello World');
    await textarea.fill('');
  });

  test('TC-E2E-04: 模式切换', async () => {
    // 点击 Plan 模式按钮
    const planBtn = window.locator('button:has-text("Plan")').first();
    await planBtn.click();
    // 验证模式标签
    const modeTag = window.locator('text=PLAN');
    await expect(modeTag).toBeVisible();
  });

  test('TC-E2E-05: 终端面板切换', async () => {
    const terminalBtn = window.locator('button:has-text("终端")');
    await terminalBtn.click();
    // xterm 容器应该可见
    const xtermContainer = window.locator('.xterm');
    await expect(xtermContainer).toBeVisible({ timeout: 5000 });
  });

  test('TC-E2E-06: 右侧面板折叠', async () => {
    // 折叠按钮在右侧
    const toggleBtn = window.locator('button[title*="折叠"]');
    await toggleBtn.click();
    // 验证面板隐藏
    const rightPanel = window.locator('.w-72'); // 右侧面板宽度
    await expect(rightPanel).not.toBeVisible({ timeout: 3000 });
  });
});
