import { test, expect } from '@playwright/test';

/**
 * Core-loop e2e: the guest-preview draft — the product's designed
 * time-to-first-fun path. A visitor lands on the live demo dashboard, drafts
 * a full 8-caption lineup against the real budget rules, and hits the
 * save-your-progress registration gate.
 *
 * Data mode: the draft needs a season doc + corps-values pool, which the
 * fake-config smoke environment can't serve. The CI job runs this spec with
 * the Firestore emulator (VITE_USE_EMULATORS=true) seeded by
 * e2e/seedEmulator.mjs; without that data the preview renders its gated
 * "Edit Lineup" state and the spec skips rather than fails, so the plain
 * smoke run stays green.
 */

test.describe('Guest preview draft loop', () => {
  test('drafts a full lineup and reaches the save gate', async ({ page }) => {
    await page.goto('/preview');

    // Suppress the PWA install prompt — it overlays the lineup panel.
    await page.evaluate(() => localStorage.setItem('pwa-install-dismissed', String(Date.now())));

    // Wait for the lineup panel; which button shows tells us the data mode.
    const tryDrafting = page.getByRole('button', { name: /try drafting/i });
    const gatedEdit = page.getByRole('button', { name: /edit lineup/i });
    await expect(tryDrafting.or(gatedEdit).first()).toBeVisible({ timeout: 20000 });

    if (!(await tryDrafting.isVisible())) {
      test.skip(true, 'No seeded season/corps data (emulator not running) — draft is gated.');
    }

    await tryDrafting.click();

    // The picker auto-advances through all 8 captions; pick the first
    // enabled, not-yet-selected corps each time. Caption order starts at GE1.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/draft general effect 1/i)).toBeVisible();

    for (let pick = 0; pick < 8; pick++) {
      await expect(dialog).toBeVisible();
      // Corps rows are buttons showing "Cost N"; disabled ones are used or
      // over budget. The cheapest enabled row always fits the remaining
      // budget, so pick from the bottom of the (points-desc) list.
      const enabledCorps = dialog.locator('button:enabled', { hasText: /cost \d+/i });
      await expect(enabledCorps.last()).toBeVisible();
      await enabledCorps.last().click();
    }

    // Eighth pick closes the picker and opens the save-progress gate
    // (RegistrationGate type 'save') with its register CTA.
    await expect(page.getByText('Save Your Progress')).toBeVisible({ timeout: 10000 });
    // (.last() — the sidebar renders its own register CTA with the same label;
    // the gate's overlay is the later one in the DOM.)
    await expect(page.getByRole('link', { name: /create free account/i }).last()).toBeVisible();

    // The dashboard behind the gate now shows the guest's own draft panel.
    await expect(page.getByText(/your draft/i).first()).toBeVisible();
  });

  test('lineup taps are gated to registration without seeded data', async ({ page }) => {
    await page.goto('/preview');
    await page.evaluate(() => localStorage.setItem('pwa-install-dismissed', String(Date.now())));

    const tryDrafting = page.getByRole('button', { name: /try drafting/i });
    const gatedEdit = page.getByRole('button', { name: /edit lineup/i });
    await expect(tryDrafting.or(gatedEdit).first()).toBeVisible({ timeout: 20000 });

    if (await tryDrafting.isVisible()) {
      test.skip(true, 'Seeded data present — the gated path does not apply.');
    }

    // Without corps data the draft entry point funnels to the registration
    // gate instead of a broken picker.
    await gatedEdit.click();
    await expect(page.getByRole('link', { name: /sign up|create|register/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
