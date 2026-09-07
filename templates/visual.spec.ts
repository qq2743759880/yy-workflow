// L0 像素 diff 全量回归示例（Playwright toHaveScreenshot，零 LLM token）。
// 复制到项目 test/ 并按需配置；L1 VLM 语义抽样见 frontend-visual-validation 分层策略。
import { test, expect } from '@playwright/test';

test('关键页像素回归（375/1280）', async ({ page }) => {
  for (const viewport of [375, 1280]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.goto('/');
    // 基线只在规格改变时更新（--update-snapshots），不能为通过盲目覆盖
    await expect(page).toHaveScreenshot(`home-${viewport}.png`, { maxDiffPixelRatio: 0.01 });
  }
});
