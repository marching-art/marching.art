import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the landing page with logo and title', async ({ page }) => {
    await page.goto('/');

    // Check for the main heading
    await expect(page.locator('text=marching.art')).toBeVisible();

    // Check for a sign-in affordance: the desktop landing embeds the sign-in
    // form (a "Sign In" button), while other layouts link to /login instead.
    // Filter to visible matches — a responsive nav link to /login exists in
    // the DOM but is hidden at some viewport widths.
    const signInAffordance = page
      .getByRole('button', { name: /sign in/i })
      .or(page.getByRole('link', { name: /get started|sign in|login/i }))
      .filter({ visible: true });
    await expect(signInAffordance.first()).toBeVisible();
  });

  test('should have proper meta tags and title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/marching\.art/i);
  });

  test('should offer a sign-in path', async ({ page }) => {
    await page.goto('/');

    // The desktop landing embeds the sign-in form directly (email/password
    // fields plus a "Sign In" button); some layouts link to /login instead.
    // Filter to visible matches (a hidden responsive /login nav link exists
    // in the DOM), wait for either affordance, then follow the link form.
    const loginLink = page.getByRole('link', { name: /sign in|login/i }).filter({ visible: true });
    const embeddedSignIn = page.getByRole('button', { name: /sign in/i }).filter({ visible: true });
    await expect(loginLink.or(embeddedSignIn).first()).toBeVisible();

    if (await loginLink.first().isVisible()) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      await expect(embeddedSignIn.first()).toBeVisible();
    }
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/');

    // Click the register / get started button
    const registerLink = page.getByRole('link', { name: /register|get started|sign up/i }).first();
    await registerLink.click();

    // Should be on register page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still render properly
    await expect(page.locator('text=marching.art')).toBeVisible();
  });
});
