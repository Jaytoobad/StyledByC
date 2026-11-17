import { test, expect } from '@playwright/test';

test.describe('admin smoke', () => {
  test('admin route renders login or admin shell', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('body')).toContainText(/admin|sign in|login|email|password/i);
  });
});
