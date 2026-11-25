import { test, expect } from '@playwright/test';

test.describe('Booking flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/book');
  });

  test('submit a booking with photos', async ({ page }) => {
    // Select a service
    await page.click('button:has-text("Brow Wax")');

    // Fill contact details
    await page.fill('input[name="name"]', 'Test Customer');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '233200000000');

    // Accept policy
    await page.check('input[name="policyAccepted"]');

    // Submit booking
    await page.click('button:has-text("Submit Request")');

    // Should show success page
    await expect(page).toHaveURL(/\/book\/confirmation/);
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible();
  });

  test('requires contact details before submitting', async ({ page }) => {
    // Try to submit without filling contact info
    await page.click('button:has-text("Submit Request")');

    // Should show validation error
    await expect(page.locator('input[name="name"]:invalid')).toHaveCount(1);
  });
});
