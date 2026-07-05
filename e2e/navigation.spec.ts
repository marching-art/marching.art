import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Public Pages', () => {
    test('should render the public How to Play guide', async ({ page }) => {
      // /how-to-play is a public marketing/guide page (it used to redirect to
      // the dashboard; that behavior changed when the guide went public).
      await page.goto('/how-to-play');

      await expect(page).toHaveURL(/\/how-to-play/);
      await expect(page.getByRole('heading', { name: /how to play/i })).toBeVisible();
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

  test.describe('Protected Routes', () => {
    // Unauthenticated visitors must never see the real dashboard/profile.
    // The app either redirects to /login or serves the guest preview, which
    // always surfaces a sign-in path. The visible-filter + first matter:
    // several elements match /sign in|login/i and the first DOM match is a
    // hidden responsive nav link, while a bare isVisible() on multiple
    // matches throws a strict-mode error that the old .catch(() => false)
    // silently turned into a bogus failure.
    test('should gate dashboard behind sign-in when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(
        page.locator('text=/sign in|login/i').filter({ visible: true }).first()
      ).toBeVisible();
    });

    test('should gate profile behind sign-in when not authenticated', async ({ page }) => {
      await page.goto('/profile');

      await expect(
        page.locator('text=/sign in|login/i').filter({ visible: true }).first()
      ).toBeVisible();
    });
  });

  test.describe('404 Page', () => {
    test('should show 404 for unknown routes', async ({ page }) => {
      await page.goto('/this-page-does-not-exist-12345');

      // The 404 page renders "404" more than once (badge + heading), so match
      // the heading specifically — a bare text locator hits Playwright strict
      // mode on the duplicate matches.
      await expect(page.getByRole('heading', { name: /404|not found/i }).first()).toBeVisible();
    });
  });
});
