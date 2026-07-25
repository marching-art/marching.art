// Parity guard: the server-rendered pages' palette must match the Tailwind
// config the rest of the site is built from. The results pages drifted two
// shades off (#141414 card, #9CA3AF muted text) precisely because nothing
// checked. If tailwind.config.cjs isn't reachable — the functions codebase is
// deployed on its own — the test skips rather than fails.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const { COLORS } = require("./designTokens");

const CONFIG_PATH = path.resolve(__dirname, "../../../tailwind.config.cjs");

describe("designTokens", () => {
  test("mirrors tailwind.config.cjs", (t) => {
    if (!fs.existsSync(CONFIG_PATH)) {
      t.skip("tailwind.config.cjs not present (functions deployed standalone)");
      return;
    }

    const colors = require(CONFIG_PATH).theme.extend.colors;

    assert.equal(COLORS.background, colors.background, "background");
    assert.equal(COLORS.surfaceCard, colors["surface-card"], "surface-card");
    assert.equal(COLORS.surfaceRaised, colors["surface-raised"], "surface-raised");
    assert.equal(COLORS.line, colors.line.DEFAULT, "line.DEFAULT");
    assert.equal(COLORS.lineSubtle, colors.line.subtle, "line.subtle");
    assert.equal(COLORS.textMain, colors.main, "main");
    assert.equal(COLORS.textSecondary, colors.secondary, "secondary");
    assert.equal(COLORS.textMuted, colors.muted, "muted");
    assert.equal(COLORS.brand, colors.brand.DEFAULT, "brand.DEFAULT");
    assert.equal(COLORS.interactive, colors.interactive.DEFAULT, "interactive.DEFAULT");
    assert.equal(COLORS.interactiveHover, colors.interactive.hover, "interactive.hover");
  });

  test("keeps gold out of the generic link role", () => {
    // docs/DESIGN_SYSTEM.md: brand gold is identity and reward only.
    assert.notEqual(COLORS.interactive, COLORS.brand);
  });
});
