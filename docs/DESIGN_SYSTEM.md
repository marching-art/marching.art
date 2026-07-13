# Design System

The visual language of marching.art: a token-driven **data-terminal** aesthetic —
charcoal surfaces, sharp corners, flat fills, one warm brand color and one cool
interactive color, monospace numerics, dense scannable tables. The identity is
unified and enforced by a CI census; this doc is the reference every new surface
is measured against.

Tokens live in `tailwind.config.cjs` + `src/index.css`; primitives in
`src/components/ui/`; the live reference is the `/styleguide` route.

> **Fixed anchor:** the logo (the 9-dot field grid + sweeping gold drill path) is
> permanent and anchors the identity. Everything else serves it.

---

## Color roles (the core decision)

Two brand colors, each with one job. A user should learn these four meanings in
the first minute and have them hold on every screen.

| Role                   | Color                                             | Used for                                                                                     | Never for                          |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Brand / reward**     | Gold `#EAB308`                                    | Logo, wordmark, #1 / podium & medal ranks, achievement unlocks, level-ups, currency, "you won"| General buttons, links, arbitrary icons |
| **Interactive / self** | Azure `#3B82F6`                                   | Links, primary buttons, active nav, focus rings, "your row," selected states                 | Decoration, celebration, status    |
| **Trend / status**     | Green `#00C853` / Red `#FF5252` / Amber `#FF9800` | Score deltas, win/loss, live, warnings                                                        | Branding or navigation             |
| **Neutral**            | One charcoal ramp + one border scale + one muted gray | All surfaces, structure, secondary text                                                   | —                                  |

Mental model: **gold = who we are and when you win; azure = what you can touch and
where you are; green/red = how the numbers moved; everything else is quiet
charcoal.**

Azure was chosen deliberately: it's the chromatic complement of the gold anchor
(cleanest possible warm-reward vs. cool-interactive separation on a leaderboard),
it preserves the "blue = clickable" convention, and it fixes an accessibility
defect — the retired `#0057B8` computed to only ~2.9:1 on `#0A0A0A`; `#3B82F6`
clears ~5.4:1.

### Token values (`tailwind.config.cjs`)

```javascript
brand:       { DEFAULT: '#EAB308', strong: '#CA8A04', subtle: '#A16207' } // gold
interactive: { DEFAULT: '#3B82F6', hover: '#2563EB', subtle: '#1D4ED8' }  // azure
background:  '#0A0A0A'
surface:     { sunken: '#111', card: '#1A1A1A', raised: '#222', elevated: '#2A2A2A' }
line:        { subtle: '#242424', muted, DEFAULT: '#333', strong: '#444' }
trend:       { up: '#00C853', down: '#FF5252', neutral: '#9E9E9E' }
success: '#00C853'  warning: '#FF9800'  error: '#FF5252'
// plus a fine-grained charcoal 50…950 neutral ramp
```

---

## Structural rules

- **Corners are square.** `rounded-none` on boxes; `rounded-full` only for
  circles/pills (avatars, dots). No `rounded-lg`/`-xl`/`-2xl` — a binary rule has
  no gray zone to drift into.
- **Elevation is flat.** Flat fills + 1px borders for structure; shadows reserved
  for genuinely floating layers (modals, menus) only. No gradients or blur outside
  the overlay/functional allowlist.
- **Typography is Inter.** The display face was dropped; there is a real
  weight/size scale via `<Heading level="display|title|section|eyebrow">` /
  `headingRecipes` (`src/components/ui/Heading.tsx`) and JetBrains Mono for
  numerics. Don't invent ad-hoc `text-2xl font-bold` headings.
- **Motion has a vocabulary.** `duration-150` for micro-interactions (hover,
  press, toggles), `duration-500` for reveals/transitions; Framer Motion for
  orchestrated sequences. All motion respects `prefers-reduced-motion`
  (`MotionConfig reducedMotion="user"`). No arbitrary `duration-[…ms]`.

### Emphasis per surface

Different surfaces have different jobs; unifying means using the _same vocabulary_
to express each:

- **Acquisition** (Landing, Hero, How-to-Play): gold-forward, largest type, most
  breathing room — the brand is allowed to be loud here.
- **Data core** (Dashboard, Scores, Leagues standings, Caption Selection):
  neutral chrome, azure for interaction/"you," green/red for trend, monospace
  numerics — calm so the data can shout.
- **Progression / reward** (Achievements, Podium, level-up, Season Recap): gold as
  the payoff color, used sparingly enough that it still reads as a reward.
- **Utility** (Settings, Admin, forms, modals): neutral, azure only on the
  actionable control.

---

## Contributor rules

The census (`npm run census:check`) enforces the mechanical rules on every PR; the
rest are review conventions.

1. **Never hardcode a color.** No `bg-[#..]`, no `gray-###`/`slate-###`. Use a
   token: surfaces (`bg-background`, `bg-surface-{sunken,card,raised,elevated}`),
   borders (`border-line`, `-subtle`/`-muted`/`-strong`), text (`text-main`,
   `text-secondary`, `text-muted`).
2. **Gold is brand + reward only.**
3. **Azure is interaction + self.** (Avoid azure _small body text_ on
   `surface-raised` — 4.3:1.)
4. **Green/red/amber are data only** — never brand or navigate.
5. **Corners are square.**
6. **Headings go through the scale.**
7. **Motion uses the two-duration vocabulary** and respects reduced motion.

### Accessibility (WCAG AA), audited

Every text token clears AA (≥ 4.5:1) on `background` and `surface-card`:

| token               | on `#0a0a0a` | on `surface-card` | on `surface-raised` |
| ------------------- | ------------ | ----------------- | ------------------- |
| text-main           | 19.8         | 17.4              | 15.9                |
| text-secondary      | 9.4          | 8.3               | 7.6                 |
| text-muted          | 6.9          | 6.1               | 5.6                 |
| interactive (azure) | 5.4          | 4.7               | 4.3 ⚠ (avoid small body text) |
| brand (gold)        | 10.3         | 9.1               | 8.3                 |

Recompute with the relative-luminance ratio if a token value changes.

---

## Enforcement — the census & ratchet

The identity stays unified by measurement, not vigilance. `scripts/designCensus.mjs`
counts every violation class across `src/`; a ratchet freezes each count as a CI
ceiling so every PR can only move it down. When a counter hits its floor its rule
becomes a hard error.

```bash
npm run census                              # the census table
npm run census:check                        # CI ratchet (fails on regressions)
node scripts/designCensus.mjs --files <key> # list offenders for one invariant
# scripts/tokenMap.json + scripts/applyTokenMap.mjs — the deterministic codemod
```

Remaining nonzero floors are legitimate: categorical tier/medal/prestige **data**
(allowlisted), the Podium `GOLD`-const system, confetti/chart palettes, functional
image scrims, and overlay shadows. They're frozen and can only fall.

---

## Mobile UX

The mobile foundation is strong — a real bottom tab bar with haptics and
safe-area insets, a 44px touch-target token, card-ified score tables (no sideways
scrolling), skeleton-first loading, lazy-loaded routes/modals/charts, a complete
PWA manifest + service worker, Firestore offline persistence, and thorough
reduced-motion support. Keep to these standards:

- **44px minimum touch targets.** The system defines `--touch-target-min: 44px` /
  `min-h-touch`. Primary controls must honor it; where visual compactness matters,
  keep the visual size but extend the hit area.
- **Use `dvh`, not `vh`,** for full-height and modal caps — iOS Safari's dynamic
  toolbar makes `100vh` taller than the visible viewport and clips
  bottom-anchored actions.
- **Bottom sheets on mobile.** Modals anchor to the bottom under `sm` and center
  on `sm+`, with safe-area padding and keyboard avoidance (the shared `Modal`).
- **Thumb-zone ergonomics.** Primary actions (Lock Lineup, Join, Register) belong
  in the bottom third; destructive/rare actions up top.
- **16px minimum on inputs** to avoid iOS zoom-on-focus.
- **No hover-only controls** — every hover affordance needs a
  `focus-within`/`active`/tap equivalent.

### Known mobile gaps (candidates)

Tracked improvements not yet made (verify against current code before acting):

- **Navigation IA:** Leagues (a core social feature) and several routes have no
  bottom-nav entry — reachable only via in-page links; no "More" overflow sheet.
- **Sub-44px targets** still exist on some controls (class switcher, kebab menus,
  some Shop/Leagues buttons).
- **`screen` → `100dvh`** config mapping not yet applied globally.
- Route-change scroll/focus reset (`src/components/ui/PageTransition.tsx` is built
  but never mounted — verified dead as of this audit).

> Note: the mobile bottom-sheet, dead-search, toast-position, and avatar-overlay
> issues from earlier audits have since been fixed. The `SwipeableTabs` /
> `ActionSheet` / `ConfirmationSheet` "toolkit" referenced by older notes was
> aspirational — those components were never actually built.

For a best-in-class pass, also consider: prod sourcemaps + error tracking for
mobile-only crashes, real-device Web Vitals, and expanded mobile e2e (a Pixel 5
Playwright project exists).
