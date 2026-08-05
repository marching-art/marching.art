// Design tokens for server-rendered HTML.
//
// The public results pages (helpers/resultsPages.js) can't use Tailwind — they
// are plain HTML with inline CSS so they stay dependency-free and safe under
// the site's CSP. They previously hardcoded their own hex values, which drifted
// from the design system: #141414 for card surfaces (the real token is
// #1A1A1A) and #9CA3AF for muted text (Tailwind's stock gray-400, not a token
// at all). Links were brand gold, which docs/DESIGN_SYSTEM.md and the comment
// on `brand` in tailwind.config.cjs explicitly forbid — gold is identity and
// reward, never a generic UI accent; that job belongs to `interactive`.
//
// tailwind.config.cjs is the source of truth. These values mirror it, and
// designTokens.test.js fails if the two ever diverge again.

const COLORS = {
  // Surfaces (the neutral ramp)
  background: "#0A0A0A", // background
  surfaceCard: "#1A1A1A", // surface-card
  surfaceRaised: "#222222", // surface-raised

  // Hairlines
  line: "#333333", // line.DEFAULT
  lineSubtle: "#242424", // line.subtle

  // Text
  textMain: "#FFFFFF", // main
  textSecondary: "#B3B3B3", // secondary
  textMuted: "#999999", // muted

  // Accents
  brand: "#EAB308", // brand — identity and reward only
  interactive: "#60A5FA", // interactive — links and actions (foreground tone)
  interactiveHover: "#93C5FD", // interactive.hover
  success: "#00C853", // success — the championship-week advancement accent
};

// Matches the app's font-sans stack closely enough for a static page; the
// results pages have no webfont to load and shouldn't block on one.
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

module.exports = { COLORS, FONT_STACK };
