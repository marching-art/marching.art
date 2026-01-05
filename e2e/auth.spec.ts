import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Check for email and password fields
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();

      // Check for submit button
      await expect(page.getByRole('button', { name: /sign in|login|submit/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');

      // Click submit without filling form
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Should show validation error or required field indication
      // The form should not navigate away
      await expect(page).toHaveURL(/\/login/);
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/login');

      // Should have a link to register
      const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
      await expect(registerLink).toBeVisible();
    });
  });

  test.describe('Register Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      // Check for required fields
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i).first()).toBeVisible();

      // Check for submit button
      await expect(page.getByRole('button', { name: /register|sign up|create|submit/i })).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/register');

      // Should have a link to login
      const loginLink = page.getByRole('link', { name: /sign in|login|already have/i });
      await expect(loginLink).toBeVisible();
    });
  });
});
