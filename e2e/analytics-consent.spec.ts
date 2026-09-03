import { test, expect } from '@playwright/test';

// Google Analytics is consent-based (Privacy §7): the bar shows on a first
// visit, either answer hides it for good on this browser, and the answer is
// changeable later under Settings → Privacy (covered by the unit tests).

test.describe('Analytics consent bar', () => {
  test('shows once, hides on "No thanks", and stays hidden after reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('pwa-install-dismissed', String(Date.now())));

    const bar = page.getByTestId('analytics-consent');
    await expect(bar).toBeVisible({ timeout: 20000 });
    await expect(bar.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    );

    await bar.getByRole('button', { name: /no thanks/i }).click();
    await expect(bar).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('ma:analyticsConsent'))).toBe('denied');

    await page.reload();
    await page.waitForLoadState('load');
    await expect(page.getByTestId('analytics-consent')).toHaveCount(0);
  });

  test('"Allow" records consent', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByTestId('analytics-consent');
    await expect(bar).toBeVisible({ timeout: 20000 });
    await bar.getByRole('button', { name: /^allow$/i }).click();
    await expect(bar).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('ma:analyticsConsent'))).toBe('granted');
  });
});
