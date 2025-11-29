import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the landing page with logo and title', async ({ page }) => {
    await page.goto('/');

    // Check for the main heading
    await expect(page.locator('text=marching.art')).toBeVisible();

    // Check for main CTA buttons
    await expect(page.getByRole('link', { name: /get started|sign in|login/i })).toBeVisible();
  });

  test('should have proper meta tags and title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/marching\.art/i);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Click the sign in / login button
    const loginLink = page.getByRole('link', { name: /sign in|login/i }).first();
    await loginLink.click();

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
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
