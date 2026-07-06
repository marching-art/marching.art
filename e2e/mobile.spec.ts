import { test, expect } from '@playwright/test';

/**
 * Mobile experience smoke tests (unauthenticated).
 *
 * These guard the regressions phones actually hit: horizontal page overflow,
 * sub-16px inputs (iOS zooms the viewport on focus), sub-44px touch targets,
 * and the PWA/viewport meta that standalone installs depend on. They run in
 * both projects, but the assertions are calibrated for the Mobile Chrome
 * (Pixel 5) viewport.
 */

const PUBLIC_ROUTES = ['/', '/login', '/register', '/how-to-play', '/privacy'];

test.describe('Mobile Experience', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`no horizontal page overflow on ${route}`, async ({ page }) => {
      // Cold Vite dev-server loads fetch hundreds of ESM modules; give the
      // first navigation the same generosity as the suite's expect timeout.
      await page.goto(route, { timeout: 60000 });
      // Wait for real content so we measure the rendered page, not the loader
      await expect(page.locator('#root *').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test('login inputs use at least 16px font so iOS does not zoom on focus', async ({ page }) => {
    await page.goto('/login');
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible();
    for (const input of await page.locator('input:visible').all()) {
      const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test('primary sign-in action meets the 44px touch target minimum', async ({ page }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: /sign in/i }).first();
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('PWA and viewport meta are configured for standalone mobile use', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      /#[0-9a-fA-F]{6}/
    );
  });
});
