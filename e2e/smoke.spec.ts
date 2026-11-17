import { test, expect } from '@playwright/test';

test.describe('public smoke', () => {
  test('home loads and primary navigation is usable', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Styled/i);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('link', { name: /services/i }).first()).toBeVisible();
  });

  test('services page loads', async ({ page }) => {
    await page.goto('/services');
    await expect(page).toHaveURL(/\/services/);
    await expect(page.locator('body')).toContainText(/service|book|brow/i);
  });

  test('guide page loads', async ({ page }) => {
    await page.goto('/guide');
    await expect(page).toHaveURL(/\/guide/);
    await expect(page.locator('body')).toContainText(/guide|policy|before|after|appointment/i);
  });
});
