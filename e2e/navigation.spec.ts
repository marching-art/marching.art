import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Public Pages', () => {
    test('should navigate to How to Play page', async ({ page }) => {
      await page.goto('/how-to-play');

      // Should load the how to play content
      await expect(page).toHaveURL(/\/how-to-play/);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('should navigate to Terms page', async ({ page }) => {
      await page.goto('/terms');

      await expect(page).toHaveURL(/\/terms/);
    });

    test('should navigate to Privacy page', async ({ page }) => {
      await page.goto('/privacy');

      await expect(page).toHaveURL(/\/privacy/);
    });

    test('should navigate to Hall of Champions', async ({ page }) => {
      await page.goto('/hall-of-champions');

      await expect(page).toHaveURL(/\/hall-of-champions/);
    });
  });

  test.describe('Protected Routes Redirect', () => {
    test('should redirect dashboard to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to login or show login prompt
      // Wait for navigation to complete
      await page.waitForTimeout(1000);

      // Either redirected to login or on a page with login prompt
      const url = page.url();
      const hasLoginPrompt = await page.locator('text=/sign in|login/i').isVisible().catch(() => false);

      expect(url.includes('/login') || hasLoginPrompt).toBeTruthy();
    });

    test('should redirect profile to login when not authenticated', async ({ page }) => {
      await page.goto('/profile');

      await page.waitForTimeout(1000);

      const url = page.url();
      const hasLoginPrompt = await page.locator('text=/sign in|login/i').isVisible().catch(() => false);

      expect(url.includes('/login') || hasLoginPrompt).toBeTruthy();
    });
  });

  test.describe('404 Page', () => {
    test('should show 404 for unknown routes', async ({ page }) => {
      await page.goto('/this-page-does-not-exist-12345');

      // Should show some indication of 404 or redirect
      await page.waitForTimeout(500);

      // Either shows 404 content or redirects to home/login
      const is404 = await page.locator('text=/not found|404|page doesn\'t exist/i').isVisible().catch(() => false);
      const isRedirected = page.url().includes('/login') || page.url() === 'http://localhost:3000/';

      expect(is404 || isRedirected).toBeTruthy();
    });
  });
});
