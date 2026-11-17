import { test, expect } from '@playwright/test';

test.describe('pay page smoke', () => {
  test('shows invalid state without valid ref/token', async ({ page }) => {
    await page.goto('/pay/INVALID');
    await expect(page.locator('body')).toContainText(/invalid|expired|payment|link/i);
  });

  test('renders pay page data from mocked API', async ({ page }) => {
    await page.route('**/api/pay/STC-TEST1234**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          valid: true,
          booking: {
            ref: 'STC-TEST1234',
            status: 'approved_awaiting_payment',
            service: 'Brow Wax',
            approvedSlotDate: '2099-01-01',
            approvedSlotTime: '13:30',
            price: 100,
            fee: 100,
            amountPaid: 0,
            balanceDue: 0,
            paymentDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            paymentReference: 'pay_test_ref',
            paymentStatus: 'Unpaid',
            email: 'test@example.com',
            name: 'Test Client',
          },
        }),
      });
    });

    await page.goto('/pay/STC-TEST1234?t=test-token');
    await expect(page.locator('body')).toContainText(/STC-TEST1234|Brow Wax|reservation|pay/i);
  });
});
