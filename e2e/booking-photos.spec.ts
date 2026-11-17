import { test, expect } from '@playwright/test';

test.describe('booking flow smoke (mocked API)', () => {
  test('walks through questionnaire and photo step including "none apply"', async ({ page }) => {
    await page.route('**/api/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          services: [
            {
              id: 'brow-wax',
              name: 'Brow Wax',
              category: 'Brows',
              description: 'Test service',
              price: 100,
              duration: 20,
              image: '',
              gallery: [],
              active: true,
            },
          ],
        }),
      });
    });

    await page.route('**/api/availability?date=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, slots: [{ startTime: '13:30' }, { startTime: '15:30' }] }),
      });
    });

    await page.route('**/api/bookings', async (route) => {
      const body = route.request().postDataJSON() as any;
      expect(Array.isArray(body.photos)).toBeTruthy();
      expect(body.photos.length).toBe(2);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          booking: { ref: 'STC-TEST1234', status: 'pending_approval', service: 'Brow Wax', price: 100 },
        }),
      });
    });

    await page.goto('/book');
    await page.getByRole('button', { name: /Brow Wax/i }).click();

    // Step 2: date/time
    const dateButtons = page.locator('.time-chip');
    await expect(dateButtons.first()).toBeVisible();
    await dateButtons.first().click();
    await page.getByRole('button', { name: /1:30/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 3: details
    await page.getByLabel(/Full name/i).fill('Test Client');
    await page.getByLabel(/Email address/i).fill('test@example.com');
    await page.getByLabel(/Phone number/i).fill('+233200000000');
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 4: questionnaire - none apply
    await page.getByLabel(/None of these apply to me/i).check();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 5: photos (must appear even when none apply)
    await expect(page.getByRole('heading', { name: /Brow photos/i })).toBeVisible();
    await page.locator('input[type="file"]').nth(0).setInputFiles({
      name: 'photo1.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'photo2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await page.getByLabel(/I agree to share these photos for assessment/i).check();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Review & submit
    await expect(page.getByRole('heading', { name: /Review & send request/i })).toBeVisible();
    await page.getByLabel(/I have read and agree/i).check();
    await page.getByRole('button', { name: /Send request/i }).click();
    await expect(page.getByText(/Request sent/i)).toBeVisible();
  });
});
