import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Real Razorpay Test-Mode Connection (Task 1)', () => {

  test.beforeEach(async ({ page }) => {
    // Clear live webhook store before test
    await page.request.delete('/api/webhooks/razorpay');
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('switching to Connected Razorpay Test Mode shows honest waiting state when empty', async ({ page }) => {
    // Select Connected: Razorpay Test Mode in header dropdown
    const sourceSelect = page.locator('header select[title="Select Active Data Provenance"]');
    await sourceSelect.selectOption('razorpay_test_mode');

    // Confirm honest waiting empty state is visible
    const waitingState = page.locator('[data-testid="razorpay-waiting-state"]');
    await expect(waitingState).toBeVisible();
    await expect(waitingState).toContainText(/Connected — Waiting for (Test-Mode )?Payment Failures/i);
  });

  test('valid Razorpay payment.failed webhook event flows into the ranked queue and drill-down', async ({ page }) => {
    const testPaymentId = `pay_e2e_live_${Date.now()}`;
    const webhookPayload = {
      entity: 'event',
      account_id: 'acc_rzp_e2e_test',
      event: 'payment.failed',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            id: testPaymentId,
            amount: 349900, // ₹3,499.00
            currency: 'INR',
            status: 'failed',
            customer_id: 'cust_e2e_live_01',
            email: 'judge_evaluator@razorpay.example',
            contact: '+919876543210',
            error_code: 'GATEWAY_ERROR',
            error_description: 'Payment was declined due to bank server downtime.',
            error_source: 'issuing_bank',
            created_at: Math.floor(Date.now() / 1000),
            notes: {
              opt_out: 'false',
              on_time_rate: 0.88,
            },
          },
        },
      },
    };

    // 1. Post webhook to backend endpoint
    const postRes = await page.request.post('/api/webhooks/razorpay', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(webhookPayload),
    });
    if (!postRes.ok()) {
      const errText = await postRes.text();
      console.log('Webhook POST failed:', postRes.status(), errText);
    }
    expect(postRes.ok()).toBe(true);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.paymentId).toBe(testPaymentId);

    // 2. Select Connected: Razorpay Test Mode in header dropdown
    const sourceSelect = page.locator('header select[title="Select Active Data Provenance"]');
    await sourceSelect.selectOption('razorpay_test_mode');

    // 3. Confirm the live payment is rendered in the ranked queue (desktop table or mobile card)
    const paymentRow = page.locator('tbody').getByText(testPaymentId).first();
    await expect(paymentRow).toBeVisible();

    // 4. Click row to open explainability drilldown modal
    await paymentRow.click();

    const drilldownModal = page.locator('[data-testid="payment-drilldown-modal"]');
    await expect(drilldownModal).toBeVisible();
    await expect(drilldownModal).toContainText(/Deterministic Scoring Waterfall/i);
    await expect(drilldownModal).toContainText(/Bank Downtime/i);
  });
});
