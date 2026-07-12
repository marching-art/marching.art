# Visual Identity Unification — Evaluation & 10-Step Plan

> **Status: in progress — foundation + sweep landed.** A diagnosis of the
> site's current visual identity and a dependency-ordered plan to make every
> surface read as one system designed at once, rather than a collection of
> modules assembled over ten months.
>
> **Fixed constraint:** the logo design (the 9-dot field grid + sweeping gold
> drill path) is permanent and is the anchor of the identity. Everything
> previously written as "law" is open to revision in service of that anchor.
>
> **Ratified decisions:** brand = gold `#EAB308` (identity/reward only);
> interactive = azure `#3B82F6` (replacing the WCAG-failing `#0057B8`); corners
> = `rounded-none`; one charcoal surface ramp + one hairline `line` scale.

## Progress log

| Step                   | State         | Evidence                                                                                          |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| 1 Ratify spec          | ✅ done       | this doc §3–4                                                                                     |
| 2 Logo → gold          | ✅ done       | `BrandLogo` defaults to `text-brand`; favicon/loader/theme already gold                           |
| 3 Token layer          | ✅ done       | `brand` / `interactive` / surface ramp / `line` scale in `tailwind.config.cjs` + `index.css`      |
| 4 Typography           | ◑ substantial | `Heading` scale (display/title/section/eyebrow) + Inter standardized; primitives adopt; page-by-page adoption ongoing |
| 5 Corners & elevation  | ✅ done       | `rounded` census = 0; shadows only on floating overlays                                           |
| 6 Harden primitives    | ✅ done       | Card/Button/PageHeader/DataTable/etc. consume tokens (no raw hex)                                 |
| 7 De-hex sweep         | ✅ done       | codemod (4,147 mech.) + fan-out; arbitrary-hex 3307→25, legacy-gray 1020→0                        |
| 8 Emphasis per surface | ◑ substantial | gold reassigned by role in the fan-out; deeper per-surface hierarchy work optional                |
| 9 Purge legacy styling | ◑ substantial | banned-effects 73→17 (remainder = overlay/functional/data); motion normalization TODO             |
| 10 Guardrails + docs   | ◑ substantial | census + ratchet + CI gate live; contributor guide + WCAG AA audit done (§7); interactive styleguide page remains |

**Census journey (TOTAL 5265 → 161).** Remaining counts are legitimate floors:
categorical tier/medal/prestige **data** (allowlisted), the Podium `GOLD`-const
system, confetti/chart palettes, functional image scrims, and overlay shadows.
The ratchet holds them frozen; they can only fall.

The tooling: `npm run census` (table), `npm run census:check` (CI ratchet),
`node scripts/designCensus.mjs --files <key>` (offenders), and
`scripts/tokenMap.json` + `scripts/applyTokenMap.mjs` (the deterministic codemod).

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
   can't learn what either color _means_.

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
`rounded-lg` / `rounded-xl` / `rounded-2xl` — **965 rounded-\* uses across 165
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
with size, some with all three. The result is uniform _loudness_ rather than a
consistent sense of where the eye should land.

---

## 3. The unifying model

One system, driven by tokens, with colors assigned to jobs. This is the spine
every step below serves.

### Color roles (the core decision)

| Role                   | Color                                             | Used for                                                                                                     | Never used for                                        |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Brand / reward**     | **Gold `#EAB308`**                                | Logo, wordmark, marquee brand moments, #1 / podium & medal ranks, achievement unlocks, level-up celebrations | General buttons, links, form accents, arbitrary icons |
| **Interactive / self** | **Azure `#3B82F6`**                               | Links, primary buttons, active nav, focus rings, "your row" highlight, selected states                       | Decoration, celebration, status                       |
| **Trend / status**     | Green `#00C853` / Red `#FF5252` / Amber `#FF9800` | Score deltas, win/loss, live, warnings only                                                                  | Branding or navigation                                |
| **Neutral**            | One charcoal ramp + one border + one muted gray   | All surfaces, structure, secondary text                                                                      | —                                                     |

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
flattening them — it means using the _same vocabulary_ to express each job.

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
  a bug. This is deliberately the _least_ driftable choice: radius is a
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

## 4. How we guarantee completeness (Definition of Done)

The last redesign was labeled "✅ completed" and wasn't — because "done" was a
human assertion with no machine-checkable meaning. Diligence didn't fail; the
absence of a _definition of done_ did. This time, "unified" is an objective,
CI-enforced state, and "everything" is an enumerated set. The guarantee comes
from measurement and enforcement, not from trying harder.

**1. Census baseline, captured before any edit.** A script counts every
violation class across `src/`. These are the numbers we drive to their floor.
Indicative current baseline (the census script produces the authoritative
figures):

| Invariant              | Rule                                                                               | Baseline | Target                   |
| ---------------------- | ---------------------------------------------------------------------------------- | -------- | ------------------------ |
| Raw hex color literals | no `bg-[#…]` / `text-[#…]` / `border-[#…]` / bare `#hex` in className              | ~1,977   | **0**                    |
| Non-token neutrals     | no `gray-###` / `slate-###` / opaque `#333`                                        | (census) | **0**                    |
| Rounded corners        | no `rounded-*` except `rounded-none`                                               | ~965     | **0**                    |
| Off-role gold          | `gold` / `yellow` / `amber` only inside allowlisted brand & reward components      | ~658     | **enumerated allowlist** |
| Banned styling         | no `bg-gradient*` / `backdrop-blur*` / `shadow-*` outside the modal/menu allowlist | ~84      | **allowlist only**       |
| Orphaned display font  | no `font-display` unless the face is actually loaded                               | 89 files | **0 / resolved**         |

"Complete" = every counter at its floor. This converts "did we get
everything?" from a judgment call into arithmetic.

**2. The invariants _are_ the spec, executable.** Each row above becomes a lint
rule (ESLint `no-restricted-syntax` + a class-scanner, or stylelint). They
don't describe unification — they define it, and on failure they name the exact
file and line. There is no version of "looks done" that disagrees with them.

**3. A ratchet, introduced early — right after the token layer, not at the
end.** The rules land first in **warn + baseline** mode: the current count is
frozen as a ceiling and CI **fails any change that raises it**. Every batch can
only move the number down. When a counter reaches its floor, its rule flips to
**hard error**, permanently. This makes backsliding impossible and completion
monotonic: you cannot merge your way back into the old state, and you cannot
stall in a half-migrated limbo without it showing as a non-zero number.

**4. The whole surface is enumerated up front.** "Everything" is an explicit
list — every route and every component directory — not "the app." The
mechanical invariants are global by construction (they scan all files). The
_judgment_ work (per-surface emphasis, gold reassignment) can't be grepped, so
each enumerated surface gets a checklist row and an explicit sign-off against
the spec. A surface is done only when it passes the automated invariants **and**
its checklist row is signed.

**5. Propagation is structural, so completeness is held, not re-earned.** Once
components read from tokens, future unification is a token edit, not a 179-file
sweep. The de-hex is a one-time cost; afterward the token layer plus the
hard-error lint hold the line by construction. We pay for "everything" once.

**The one cultural rule:** no surface, PR, or session may be called "done"
while any invariant sits above its floor. The word "completed" is reserved for
green CI. That single rule is what the last effort lacked.

**Scope honesty.** The mechanical sweep touches ~179 files and will span
several PRs (batched by directory for reviewability) — possibly more than one
session. The ratchet is what makes that safe: at any moment there is an exact
remaining count, every merge only decreases it, and the system can never be
_falsely_ declared finished. Whether it takes one sitting or five, it
converges — and "piecemeal" becomes impossible, because partial state is always
visible and always shrinking.

---

## 5. Ten-step implementation plan

Ordered by dependency: ratify → anchor → tokenize → propagate → enforce. Each
step is shippable on its own and leaves the app in a better, coherent state.

### Step 1 — Ratify the identity spec

Turn Section 3 into the single canonical reference and **replace the scattered
"laws"** (which are now explicitly open for revision) with one document: the
color-role table, the per-surface emphasis guide, and the ratified decisions on
corners, elevation, and typography. Nothing else proceeds until the four color
roles and the three structural decisions are locked. _Deliverable: an agreed
spec; the rest of the plan executes against it._

### Step 2 — Make the logo honor the permanent gold rule

Fix `BrandLogo.jsx` so the drill path defaults to **gold**, not blue
(`color` default → gold; the path is the brand mark). Align the favicon,
`theme-color`, PWA manifest, and the `index.html` loader to the same gold, and
pair the mark with a defined wordmark treatment (typeface, weight, spacing,
clear-space rule). _This anchors the entire identity to the one fixed point._

### Step 3 — Rebuild the token layer as the real source of truth

Rewrite the color tokens in `tailwind.config.cjs` and the `:root` variables in
`index.css` around **semantic, role-named tokens** (`brand`, `interactive`,
`surface-{base,card,elevated}`, `border`, `trend-{up,down}`, `text-{primary,
secondary,muted}`) — one value each, no synonyms. Collapse the duplicate border
(`#333` vs `border-default`) and duplicate gray (`gray-400` vs `muted`) into a
single token apiece. _After this, changing a token changes the app — which is
the precondition for everything after._

### Step 4 — Resolve typography

Execute the ratified type decision: if keeping the display face, **load it** in
`index.html` and apply it consistently to headings; if not, remove
`font-display` and standardize on Inter. Then define a **5-step type scale**
(display / h1 / h2 / body / caption) as reusable utilities or a `<Heading>`
component, and route every ad-hoc heading through it. _Kills the silent
system-ui fallback and the per-module heading improvisation._

### Step 5 — Settle corners & elevation

Encode the single ratified radius and the single elevation rule into the token
layer, and update the base primitives to use them. _One structural language,
enforced at the source._

### Step 6 — Harden the core primitives

Refactor `Card`, `Button`, `Badge`, `PageHeader`, `DataTable`, `StatCard`,
`Modal`, `Tabs`, and `Input` to consume **only tokens** — zero hardcoded hex,
correct color roles, ratified corners/type. These become the reference
implementation every feature is measured against. _A small, high-leverage set;
get these perfect first._

### Step 7 — De-hex the codebase (token migration)

Systematically replace the 1,977 raw hex/legacy classes with tokens across all
179 files: `#1a1a1a`→`surface-card`, `#333`→`border`, `#0057B8`→`interactive`,
`gray-400`→`text-muted`, and reassign every `gold/yellow/amber` use to _either_
`brand` (if it's genuinely brand/reward) _or_ a neutral/interactive/trend token
(if it was just decorative). Script the mechanical mappings; hand-review the
gold reassignments, since that's where the role model actually gets applied.
_This is the bulk of the visual unification — do it in reviewable batches by
directory (Leagues, Podium, Dashboard, Articles, Admin, …)._

### Step 8 — Retune emphasis per surface

With the vocabulary unified, apply the per-surface emphasis model from Section
3: make acquisition surfaces gold-forward, calm the data core to
neutral+blue+trend, tighten reward surfaces so gold reads as payoff, and
neutralize utility/forms. Fix the specimen offenders first — e.g. `HeroBanner`'s
three-accent hero → one brand accent + one interactive CTA. _This is where the
site stops being uniformly loud and starts having intentional hierarchy._

### Step 9 — Purge off-spec legacy styling & normalize motion

Remove the 84 leftover gradient/blur/shadow uses that don't fit the ratified
elevation rule, and unify the animation vocabulary (durations, easings,
reduced-motion behavior) so transitions feel like one hand made them. _Erases
the last obvious Stadium-HUD-era residue._

### Step 10 — Lock it in with guardrails

Flip every ratcheted invariant from warn to **hard error** now that the
counters are at their floors — the rules themselves were introduced back at
Step 3 and ran throughout the sweep (see §4). Publish the primitives and tokens
as a living reference (Storybook or a `/styleguide` page), and write the short
contributor guide ("use tokens; gold is brand-only; azure is interactive;
corners are square; here's the type scale"). Close with a verification pass:
WCAG AA contrast across tokens, and a visual sweep of the enumerated surfaces.
_Prevents the drift from re-accumulating — without this, the app is back here in
another ten months._

---

## 6. Sequencing & effort

- **Foundation (Steps 1–5):** the highest-leverage work; unblocks everything.
  Small, surgical edits to a handful of files.
- **Propagation (Steps 6–8):** the bulk of the hours, but mechanical and
  parallelizable by directory once the tokens exist.
- **Hardening (Steps 9–10):** the difference between "looks unified today" and
  "stays unified." Do not skip Step 10.

**The census + ratchet (see §4) is the spine that runs through all of it.** The
census is captured at Step 1 (baseline), the lint rules land at Step 3 in
warn/ratchet mode the moment tokens exist, they gate every Propagation PR so the
counters only fall, and they flip to hard error at Step 10. Enforcement is not
the last step — it is the rail the whole migration rides, which is precisely
what keeps this from becoming another piecemeal pass.

The first visible payoff lands early: Steps 2–3 alone make the logo correct and
give a single lever over the whole palette. Steps 6–8 are where a discerning eye
stops seeing seams.

---

## 7. Contributor guide (keep it unified)

Six rules. The census (`npm run census:check`) enforces the mechanical ones on
every PR; the rest are review conventions.

1. **Never hardcode a color.** No `bg-[#..]`, no `gray-###`/`slate-###`. Use a
   token: surfaces (`bg-background`, `bg-surface-sunken/card/raised/elevated`),
   borders (`border-line`, `-subtle`/`-muted`/`-strong`), text (`text-main`,
   `text-secondary`, `text-muted`).
2. **Gold is brand + reward only.** `brand` for the logo/wordmark, achievements,
   #1/podium/medals, level-ups, currency, "you won" moments — nothing else. If
   you reach for gold on a button, link, or generic icon, you want `interactive`
   or a neutral instead.
3. **Azure is interaction + self.** `interactive` for links, primary actions,
   active/selected states, focus, and "your row." (Use it for controls, icons,
   and large text; avoid azure _small body text_ on `surface-raised` — 4.3:1.)
4. **Green/red/amber are data only.** `success`/`error`/`warning`/`trend-*`
   never brand or navigate.
5. **Corners are square.** `rounded-none` on boxes; `rounded-full` only for
   circles/pills (avatars, dots). No `rounded-lg`/`-xl`/`-2xl`.
6. **Headings go through the scale.** Use `<Heading level="display|title|
section|eyebrow">` or `headingRecipes` (`src/components/ui/Heading.tsx`) —
   don't invent a new `text-2xl font-bold` combination.

### Accessibility (WCAG AA), audited

Every text token clears AA (≥ 4.5:1) on `background` and `surface-card`; azure
`interactive` corrects the retired `#0057B8` (which failed at **2.88:1**).

| token                     | on `#0a0a0a` | on `surface-card` | on `surface-raised` |
| ------------------------- | ------------ | ----------------- | ------------------- |
| text-main                 | 19.8         | 17.4              | 15.9                |
| text-secondary            | 9.4          | 8.3               | 7.6                 |
| text-muted                | 6.9          | 6.1               | 5.6                 |
| interactive (azure)       | 5.4          | 4.7               | 4.3 ⚠               |
| brand (gold)              | 10.3         | 9.1               | 8.3                 |
| warning / success / error | ≥ 6.2        | ≥ 5.5             | ≥ 5.0               |

Recompute anytime: the audit is a few lines of Node (relative-luminance ratio);
re-run it if a token value changes.

### On "hard error"

The ratchet is already a hard error _at each invariant's floor_: `legacy-gray`,
`rounded`, and `font-display` sit at 0, so `census:check` fails any PR that adds
even one. The nonzero floors (`hex-literal`, `banned-effects`, `off-role-gold`,
`arbitrary-hex`) are frozen ceilings holding legitimate data/overlay/functional
cases — they too can only fall. There is no separate "flip" needed; convergence
is the only permitted direction.
