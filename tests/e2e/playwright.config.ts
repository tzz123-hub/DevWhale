/**
 * Playwright Electron E2E 配置
 *
 * 运行方式（需要本地桌面环境）：
 *   npx playwright test --config=tests/e2e/playwright.config.ts
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  use: {
    headless: false, // Electron 需要显示器，设为 true 需 xvfb
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    {
      name: 'electron',
      use: {
        // Playwright Electron 启动配置
        // 需要在全局安装 @playwright/test 并配置 electron 路径
      },
    },
  ],
});
