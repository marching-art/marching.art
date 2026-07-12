# Visual Identity Unification — Evaluation & 10-Step Plan

> **Status: proposal.** A diagnosis of the site's current visual identity and a
> dependency-ordered plan to make every surface read as one system designed at
> once, rather than a collection of modules assembled over ten months.
>
> **Fixed constraint:** the logo design (the 9-dot field grid + sweeping gold
> drill path) is permanent and is the anchor of the identity. Everything
> previously written as "law" is open to revision in service of that anchor.

---

## 1. Executive read

marching.art is caught between **two complete design systems**:

- **The "Stadium HUD" era** (pre-Oct 2025): rounded cards, gradients, gold
  glow, atmospheric backgrounds. Warm, marketing-flavored.
- **The "ESPN data terminal" era** (the redesign ~10 months ago, per
  `docs/ESPN_REDESIGN_PROMPTS.md`): sharp corners, flat fills, DCI blue,
  monospace stats, dense tables. Cool, broadcast-flavored.

The redesign was recorded as "✅ completed," but in practice it reached only
the **shared primitives** (`Card`, `Button`, `PageHeader`, `DataTable`) and a
few flagship pages. It never propagated to the long tail of feature modules,
and it never actually became the source of truth — because the app doesn't
render from tokens, it renders from **hardcoded hex values pasted into each
component**. So the two eras coexist, feature by feature, and a discerning eye
reads the seams instantly.

There are two root causes, and everything else is a symptom of them:

1. **No enforced source of truth.** The Tailwind token layer exists but is
   bypassed. `bg-[#1a1a1a]`, `border-[#333]`, `text-[#0057B8]`,
   `text-gray-400`, `yellow-500` appear as raw literals **1,977 times across
   179 files** — including inside the "canonical" primitives themselves
   (`Card.tsx` hardcodes `#333` instead of its own `border-default` token).
   Changing a token today changes almost nothing.

2. **No role assignment for the two brand colors.** Gold and blue both exist,
   both are used as general-purpose accents, and neither owns a job. Gold
   appears **658 times across 147 files**; blue is declared `primary` but is
   applied interchangeably with gold. Same visual weight, no rule → the eye
   can't learn what either color *means*.

The good news: the fix is not "rip out gold" (the redesign tried that and
abandoned it halfway). With the logo locked as gold, the fix is to **give gold
and blue defined, non-overlapping roles**, drive the whole app from tokens, and
resolve each era-contradiction to one deliberate answer.

---

## 2. The fault lines (what a discerning eye actually sees)

### A. Two brands, no roles
Gold (`#EAB308`) owns the logo, loader, favicon, and `theme-color`; blue
(`#0057B8`) is declared `primary`. But both are sprinkled as accents with no
logic. **Exhibit:** `HeroBanner.jsx` uses `yellow-500` (Zap), `orange-500`
(Trophy), and `#0057B8` (Users) as three unrelated accent colors in a single
component, and pairs a blue primary CTA with a gold-outlined secondary CTA — no
rule tells the user what any color signifies.

### B. The logo doesn't honor its own gold rule
`BrandLogo.jsx` defaults `color = 'text-[#0057B8]'` and paints the drill path
with `stroke-current` — so the in-app logo renders **blue** unless a caller
overrides it. The signature gold survives only in the hardcoded `index.html`
loader. The permanent rule is violated by the component that owns the logo.

### C. Corner-radius schism (the biggest "two eras" tell)
The ESPN primitives use `rounded-none` (sharp). The rest of the app uses
`rounded-lg` / `rounded-xl` / `rounded-2xl` — **965 rounded-* uses across 165
files.** Sharp-cornered flagship pages sit directly beside soft-cornered
feature modules. This single inconsistency does more to betray the "assembled
over time" feeling than any color issue.

### D. Tokens bypassed; duplicated neutrals
- **1,977 raw hex color classes** across 179 files — the token layer is
  decorative.
- **Two border systems:** opaque `#333` (in primitives) vs. the
  `border-default` token `rgba(255,255,255,0.1)`. They render as visibly
  different lines.
- **Two "muted" grays:** `text-gray-400` (Tailwind default) vs. `text-muted`
  (`#999999` token) — used for the same label role in adjacent components
  (`Card.Title` uses `gray-400`; `PageHeader` uses `muted`).

### E. Typography is declared but not delivered
`tailwind.config.cjs` defines a **display** family (Oswald / Barlow Condensed)
and `font-display` is used in **89 files** — but `index.html` only loads Inter
and JetBrains Mono. **Every `font-display` heading silently falls back to
system-ui**, so the intended condensed, impactful headline voice never renders,
and headings look different across browsers. There is also no shared type
scale: each module improvises heading sizes/weights/casing (`PageHeader` =
`text-sm`, `Card.Title` = `text-xs`, `HeroBanner` = `text-2xl/3xl`, noscript =
28px inline).

### F. "Banned" styling persists
The redesign's "no glow / no gradient / no shadow" law is only half-enforced:
**84 gradient/blur/shadow uses across 38 files** remain (Landing, GameShell,
Podium, celebrations). `HeroBanner` opens with `bg-gradient-to-br` and a
gradient accent bar — directly against the stated law, right on the front door.

### G. Emphasis is improvised per module
Because there's no shared hierarchy system, "what's important here" is
re-decided in every feature. Some modules shout with gold, some with blue, some
with size, some with all three. The result is uniform *loudness* rather than a
consistent sense of where the eye should land.

---

## 3. The unifying model

One system, driven by tokens, with colors assigned to jobs. This is the spine
every step below serves.

### Color roles (the core decision)
| Role | Color | Used for | Never used for |
| --- | --- | --- | --- |
| **Brand / reward** | **Gold `#EAB308`** | Logo, wordmark, marquee brand moments, #1 / podium & medal ranks, achievement unlocks, level-up celebrations | General buttons, links, form accents, arbitrary icons |
| **Interactive / self** | **Azure `#3B82F6`** | Links, primary buttons, active nav, focus rings, "your row" highlight, selected states | Decoration, celebration, status |
| **Trend / status** | Green `#00C853` / Red `#FF5252` / Amber `#FF9800` | Score deltas, win/loss, live, warnings only | Branding or navigation |
| **Neutral** | One charcoal ramp + one border + one muted gray | All surfaces, structure, secondary text | — |

The mental model: **gold = who we are and when you win; azure = what you can
touch and where you are; green/red = how the numbers moved; everything else is
quiet charcoal.** A user should be able to learn those four meanings in the
first minute and have them hold on every screen.

**On the accent choice.** Azure is chosen deliberately, not inherited. It is
the chromatic complement of the amber-gold anchor (warm reward vs. cool
interactive — the cleanest possible separation on a leaderboard), it preserves
the learned "blue = clickable" web convention, and it **corrects an
accessibility defect**: the incumbent `#0057B8` computes to only ~2.9:1 on the
`#0A0A0A` background — below the WCAG floor for the links, focus rings, and
"your row" it was used for. `#3B82F6` clears ~5.4:1 (AA for text) with headroom.
Green and red are reserved for trend/status and must never be used for
interaction; gold is reserved for brand/reward and must never be a general UI
accent.

### Emphasis needs per surface (the "product" dimension)
Different surfaces have genuinely different jobs; unifying doesn't mean
flattening them — it means using the *same vocabulary* to express each job.

- **Acquisition** (Landing, Hero, How-to-Play, Preview): warmth and
  invitation. **Gold-forward, largest display type, most breathing room.** This
  is where the brand is allowed to be loud.
- **The data core** (Dashboard, Scores, Leagues standings, Caption Selection):
  density and scannability. **Neutral chrome, blue for interaction/"you,"
  green/red for trend, monospace numerics.** Calm so the data can shout.
- **Progression / reward** (Achievements, Podium, Level-up, Season Recap):
  celebration. **Gold as the payoff color, used sparingly enough that it still
  feels like a reward.**
- **Utility** (Settings, Admin, forms, modals): clarity, low emotion.
  **Neutral, blue only on the actionable control.**

### Structural decisions (resolving the era-contradictions)
- **Corners: `rounded-none`, ratified.** Every surface is sharp — 90° or it's
  a bug. This is deliberately the *least* driftable choice: radius is a
  spectrum, and spectrums are exactly how the app accumulated `rounded-lg`,
  `-xl`, and `-2xl` side by side. A binary rule has no gray zone to wander
  into. It is also the honest edge for the rest of the system — charcoal
  ground, flat fills, one confident accent, strict grid: the Swiss/Vignelli
  idiom, whose native corner is square. The 965 `rounded-*` uses collapse to
  one value.
- **Elevation:** one rule. Flat fills + 1px borders for structure; reserve any
  shadow for genuinely floating layers (modals, menus) only.
- **Type:** either **load the display face and use it deliberately** for
  headings, or **drop `font-display` and standardize on Inter** with a real
  weight/size scale. Pick one; eliminate the silent fallback.

---

## 4. Ten-step implementation plan

Ordered by dependency: ratify → anchor → tokenize → propagate → enforce. Each
step is shippable on its own and leaves the app in a better, coherent state.

### Step 1 — Ratify the identity spec
Turn Section 3 into the single canonical reference and **replace the scattered
"laws"** (which are now explicitly open for revision) with one document: the
color-role table, the per-surface emphasis guide, and the ratified decisions on
corners, elevation, and typography. Nothing else proceeds until the four color
roles and the three structural decisions are locked. *Deliverable: an agreed
spec; the rest of the plan executes against it.*

### Step 2 — Make the logo honor the permanent gold rule
Fix `BrandLogo.jsx` so the drill path defaults to **gold**, not blue
(`color` default → gold; the path is the brand mark). Align the favicon,
`theme-color`, PWA manifest, and the `index.html` loader to the same gold, and
pair the mark with a defined wordmark treatment (typeface, weight, spacing,
clear-space rule). *This anchors the entire identity to the one fixed point.*

### Step 3 — Rebuild the token layer as the real source of truth
Rewrite the color tokens in `tailwind.config.cjs` and the `:root` variables in
`index.css` around **semantic, role-named tokens** (`brand`, `interactive`,
`surface-{base,card,elevated}`, `border`, `trend-{up,down}`, `text-{primary,
secondary,muted}`) — one value each, no synonyms. Collapse the duplicate border
(`#333` vs `border-default`) and duplicate gray (`gray-400` vs `muted`) into a
single token apiece. *After this, changing a token changes the app — which is
the precondition for everything after.*

### Step 4 — Resolve typography
Execute the ratified type decision: if keeping the display face, **load it** in
`index.html` and apply it consistently to headings; if not, remove
`font-display` and standardize on Inter. Then define a **5-step type scale**
(display / h1 / h2 / body / caption) as reusable utilities or a `<Heading>`
component, and route every ad-hoc heading through it. *Kills the silent
system-ui fallback and the per-module heading improvisation.*

### Step 5 — Settle corners & elevation
Encode the single ratified radius and the single elevation rule into the token
layer, and update the base primitives to use them. *One structural language,
enforced at the source.*

### Step 6 — Harden the core primitives
Refactor `Card`, `Button`, `Badge`, `PageHeader`, `DataTable`, `StatCard`,
`Modal`, `Tabs`, and `Input` to consume **only tokens** — zero hardcoded hex,
correct color roles, ratified corners/type. These become the reference
implementation every feature is measured against. *A small, high-leverage set;
get these perfect first.*

### Step 7 — De-hex the codebase (token migration)
Systematically replace the 1,977 raw hex/legacy classes with tokens across all
179 files: `#1a1a1a`→`surface-card`, `#333`→`border`, `#0057B8`→`interactive`,
`gray-400`→`text-muted`, and reassign every `gold/yellow/amber` use to *either*
`brand` (if it's genuinely brand/reward) *or* a neutral/interactive/trend token
(if it was just decorative). Script the mechanical mappings; hand-review the
gold reassignments, since that's where the role model actually gets applied.
*This is the bulk of the visual unification — do it in reviewable batches by
directory (Leagues, Podium, Dashboard, Articles, Admin, …).*

### Step 8 — Retune emphasis per surface
With the vocabulary unified, apply the per-surface emphasis model from Section
3: make acquisition surfaces gold-forward, calm the data core to
neutral+blue+trend, tighten reward surfaces so gold reads as payoff, and
neutralize utility/forms. Fix the specimen offenders first — e.g. `HeroBanner`'s
three-accent hero → one brand accent + one interactive CTA. *This is where the
site stops being uniformly loud and starts having intentional hierarchy.*

### Step 9 — Purge off-spec legacy styling & normalize motion
Remove the 84 leftover gradient/blur/shadow uses that don't fit the ratified
elevation rule, and unify the animation vocabulary (durations, easings,
reduced-motion behavior) so transitions feel like one hand made them. *Erases
the last obvious Stadium-HUD-era residue.*

### Step 10 — Lock it in with guardrails
Add an ESLint rule / CI check that **fails on raw hex color classes and on gold
used outside brand/reward contexts**, publish the primitives and tokens as a
living reference (Storybook or a `/styleguide` page), and write the short
contributor guide ("use tokens; gold is brand-only; here's the type scale").
Close with a verification pass: WCAG AA contrast across tokens, and a visual
sweep of the top surfaces in light and dark. *Prevents the drift from
re-accumulating — without this, the app is back here in another ten months.*

---

## 5. Sequencing & effort

- **Foundation (Steps 1–5):** the highest-leverage work; unblocks everything.
  Small, surgical edits to a handful of files.
- **Propagation (Steps 6–8):** the bulk of the hours, but mechanical and
  parallelizable by directory once the tokens exist.
- **Hardening (Steps 9–10):** the difference between "looks unified today" and
  "stays unified." Do not skip Step 10.

The first visible payoff lands early: Steps 2–3 alone make the logo correct and
give a single lever over the whole palette. Steps 6–8 are where a discerning eye
stops seeing seams.
