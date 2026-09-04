import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility scans (axe-core) over the public surfaces. The app
 * has strong a11y foundations (skip links, focus traps, live regions); this
 * locks them in by failing CI on any SERIOUS or CRITICAL WCAG 2.0/2.1 A/AA
 * violation on the pages every visitor can reach. Moderate/minor findings are
 * reported in the test output but don't fail — tighten over time.
 */

const PAGES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'landing' },
  { path: '/preview', name: 'guest preview' },
  { path: '/how-to-play', name: 'how to play' },
  { path: '/install', name: 'install guide' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
];

test.describe('Accessibility (axe)', () => {
  for (const { path, name } of PAGES) {
    test(`${name} has no serious/critical violations`, async ({ page }) => {
      await page.goto(path);
      // Suppress the PWA install prompt overlay; give lazy content a beat.
      await page.evaluate(() => localStorage.setItem('pwa-install-dismissed', String(Date.now())));
      await page.waitForLoadState('load');
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const gating = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      const advisory = results.violations.filter((v) => !gating.includes(v));

      if (advisory.length > 0) {
        console.log(
          `[a11y advisory] ${name}: ${advisory
            .map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node(s))`)
            .join(', ')}`
        );
      }

      expect(
        gating.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
        }))
      ).toEqual([]);
    });
  }
});
