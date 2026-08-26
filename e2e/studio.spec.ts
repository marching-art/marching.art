import { test, expect, type Page } from '@playwright/test';

/**
 * Uniform Studio routing contract. The Studio itself is auth-walled (like the
 * dashboard and profile), and the e2e suite runs unauthenticated — so what
 * this locks in is the wall: /studio must never render designer UI to a
 * signed-out visitor, and the redirect must land somewhere real. The Studio's
 * behavior for signed-in directors is covered by unit/mount tests
 * (src/pages/Studio.test.tsx) and the renderer suite
 * (src/components/uniform/UniformFigure.test.tsx).
 *
 * Skip-not-fail: without VITE_FIREBASE_* env (bare local runs), auth never
 * resolves and ProtectedRoute holds on the loading screen forever — that's a
 * missing-config condition, not a wall failure, so the spec self-skips
 * (same convention as guest-draft.spec.ts). CI provides the env.
 */

async function gotoStudioOrSkip(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('load');
  // Give ProtectedRoute a beat to resolve auth and issue its redirect.
  await page
    .waitForURL((url) => !url.pathname.startsWith('/studio'), { timeout: 8000 })
    .catch(() => {});
  if (page.url().includes('/studio')) {
    // Still parked on /studio: either the wall leaked (designer UI visible —
    // a real failure, fall through to the assertions) or auth never resolved
    // because Firebase env is missing (no designer UI either — skip).
    const designerVisible = (await page.getByText(/corps colorway/i).count()) > 0;
    test.skip(
      !designerVisible,
      'Firebase env not configured — auth never resolves, so the route holds pre-redirect.'
    );
  }
}

test.describe('Uniform Studio route', () => {
  test('unauthenticated /studio redirects off the studio', async ({ page }) => {
    await gotoStudioOrSkip(page, '/studio');

    // ProtectedRoute sends signed-out visitors to "/" (landing).
    await expect(page).not.toHaveURL(/\/studio/);
    // No designer UI leaks to signed-out visitors.
    await expect(page.getByText(/corps colorway/i)).toHaveCount(0);
  });

  test('deep link with a corps param is equally walled', async ({ page }) => {
    await gotoStudioOrSkip(page, '/studio?corps=worldClass');
    await expect(page).not.toHaveURL(/\/studio/);
  });

  test('the landing the redirect reaches renders (no error boundary)', async ({ page }) => {
    await gotoStudioOrSkip(page, '/studio');
    await page.waitForTimeout(1500);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
