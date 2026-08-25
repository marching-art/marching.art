# The Uniform Studio — Corps Identity & Fashion System

**Proposal v1.0 · August 2026 · Status: PROPOSED (pre-build review)**

> The pitch in one sentence: promote uniform design from a buried AI-prompt form
> into marching.art's fashion game — a first-class profile studio where every
> director dresses a deterministic, instantly-rendered corps figure from a real
> drum-corps component vocabulary, saves a wardrobe of looks, shares them with a
> code, and competes in styling contests — the Fortnite-locker / Infinity-Nikki
> energy, but authentically drum corps.

This document is grounded in two research passes performed August 2026: (a) a
full audit of the existing uniform/avatar/profile/economy code, and (b) domain
research into DCI uniform history and anatomy, working uniform designers
(Cesario, Lagola, Chandler, Becker, Valentine), the manufacturers (FJM,
Stanbury, Fruhauf, DeMoulin, Band Shoppe, DPG, et al.), and the customization
systems of ~20 games (Infinity Nikki, Fortnite, Splatoon, Forza, GW2, Destiny,
Animal Crossing, WoW transmog, Dress to Impress…). Citations to code are
`file:line`; domain claims trace to the research digests in the PR/session that
produced this doc.

---

## 1. Diagnosis: what "Uniform Design" is today

Despite the name, today's feature is **an AI-prompt authoring form whose only
visible product is a 256 px profile avatar**:

- The design is 15 free-text inputs and dropdowns (`src/components/modals/UniformDesignModal.tsx`).
  Colors are prose ("crimson red") — nothing in the client can _draw_ a design
  (`src/types/corps.ts:21-53`). The only preview is the AI avatar that appears
  _after_ save.
- Avatar concerns live inside the design type (`avatarStyle`, `avatarSection`,
  `src/types/corps.ts:51-52`); saving a design force-fires avatar generation
  (`src/hooks/useDashboardModals.js:484`, `src/pages/Profile.jsx:230`) and, on
  the profile path, silently switches the profile picture
  (`src/pages/Profile.jsx:203-205`).
- One design per corps, forever — no wardrobe, no per-season history, no
  home/away looks (`functions/src/helpers/corpsHelpers.js:56-64`), even though
  the real-DCI reference system the news pipeline uses is _year-keyed_
  (`functions/src/helpers/dciUniforms.js`).
- Nobody else ever sees it. Scoreboards, rivals, leagues, Hall of Champions
  carry only `avatarUrl`; the design itself surfaces to other players only if
  you top the nightly leaderboard and the news generator renders you
  (`functions/src/helpers/newsFantasyArticles.js:386-419`).
- It isn't a destination: a modal with no URL, reachable by knowing an avatar
  tile is clickable (`src/hooks/useDashboardModals.js:37,107`).

The game's own docs already anticipate the fix — the gamification backlog lists
"expanded Shop tiers (**uniform palettes/emblems**)" (docs/GAMIFICATION.md:388-392),
and FMA's core lesson is that **identity and permanence** are what bring
players back for 15 years (docs/PODIUM.md §2.1.4).

## 2. Vision

**The Uniform Studio** is a routed, first-class page (entered from a new
**Corps Identity** section of the profile) where a director:

1. **Builds** a uniform on a live corps figure — a layered SVG "paper doll" that
   updates instantly with every slot and color choice. No AI round-trip, no
   cost, works for guests and demo corps.
2. **Chooses from real drum-corps vocabulary** — shako vs. aussie vs. pith
   helmet, French Upright vs. Fountain plume, cadet jacket vs. tunic vs.
   bodysuit, baldric vs. Sam Browne vs. drop sash, chevrons, gauntlets, spats,
   capes with contrast lining — the component catalog manufacturers actually
   sell and corps actually wear.
3. **Owns a wardrobe** — multiple saved designs per corps, an equipped "identity
   uniform," alternate looks (finals week, exhibition), and a per-season
   uniform history that archives at rollover, exactly like the real "pictorial
   history of the Cadets' uniforms."
4. **Shares identity in real time** — every design exports a share card (corps
   in formation, stadium backdrop, corps name) stamped with a **uniform code**
   anyone can enter to import the look; an opt-in **Design Exchange** gallery
   with likes/saves; seasonal **styling contests** with community voting.
5. **Progresses** — hues are always free, but _finishes_ (metallic, sequin,
   lamé, mylar plumes), premium silhouettes, emblem packs, and pattern packs
   are earned through play and CorpsCoin, following the existing cosmetics
   economy. Nothing expires; collections return; identity is never paywalled.

The AI image pipeline is retained but demoted to what it's good at: optional
glamour shots and news imagery, now fed _better_ prompts from structured data.

### Why this fits marching.art specifically

- **The daily-ritual game already exists; this is the between-scores game.**
  FMA proved the sim is the pretext and the social layer is the product
  (docs/PODIUM.md §2.1.7). A styling loop gives directors something expressive
  to do every day that isn't a lineup click.
- **Identity is the retention engine.** Players return after 80-season absences
  because "their corps is still there." A uniform you designed, iterated,
  archived by season, and are known by in the gallery is a much heavier anchor
  than a text blob.
- **It's cosmetic by construction** — zero competitive edge, which is exactly
  the CC economy's iron rule (docs/GAMIFICATION.md:121-129), and gives the
  economy the recurring identity sink it's designed around.

## 3. Research foundations (what the domain gives us for free)

### 3.1 The component vocabulary is deep, real, and gameable

Drum corps uniforms decompose into a natural slot system — the industry itself
sells them as components (McCormick's/Band Shoppe part catalogs; Ensemble
Innovations' literal mix-and-match menus):

- **Headwear** is the strongest identity slot: shako (straight/tapered crown,
  hat plate, chin chain vs. strap, recolorable wrap), aussie (SCV/Madison),
  pith helmet (Phantom), cavalry campaign hat (Troopers), busby, beret, hood,
  or bare-headed (legal since Bluecoats won in 2016 without headgear).
- **Plumes** have real named types — French Upright, Fountain, Carrousel,
  Stick-Up, Ostrich, Coque, Marabou, military hackle — in 6–16″ lengths with
  dye treatments (solid, tip-dyed, half-and-half, mylar flash). Vendors stock
  ~16 feather dye colors.
- **Torso** silhouettes: cadet jacket (short = taller silhouette, per Cesario
  and Fruhauf), tunic, knee-length Cossack/long coat (Bridgemen, Blue Devils),
  satin blouse (Cavaliers), vest, athletic top, full bodysuit (Blue Knights).
  Chest treatments: button grids, plastron color panels, asymmetric splits
  (Phantom 1970), diagonal sequin swash (Bluecoats 2016).
- **The "identity band"**: diagonal sash, baldric, cross strap(s), Sam Browne,
  cummerbund, tasseled drop sash (Cadets), waist belt with chrome buckle
  (Cavaliers).
- **Arms/hands**: epaulets, shoulder knots, citation cords, sleeve chevrons
  (Phantom's three black chevrons), service stripes, soutache rows, flared or
  percussion-cut gauntlets, gloves.
- **Lower/feet**: bibbers with leg stripes, leggings, spats, white bucks,
  black/white marching shoes, themed boots.
- **Back**: hip/shoulder/full capes with two-color reversible lining (Phantom's
  red-inside-black).
- **Emblems**: eagle shield (Cadets), fleur-de-lis (Madison), Maltese cross
  (Crossmen), crossed sabers (Troopers), dragon (Mandarins), dots-triangle
  (Blue Knights), sunburst, star, chevron, shield…

### 3.2 The designers give us honest design principles (and preset flavor)

Michael Cesario's canon — "**visibility, identity, practicality**"; design "in
multiples at a distance," not "a singular item you see in a mirror"; the
one-second identity test ("Of COURSE that's Phantom!"); short jackets elongate
the leg line; military ornament vanishes from the press box — plus Greg
Lagola's costume-first deconstruction (Bluecoats 2016), Scott Chandler's
quick-change dramaturgy (Blue Devils reveals), Brent Becker's heritage
sketching, and DeMoulin's texture-contrast/color-placement rules. These become:

- **In-studio guidance**: a tasteful "Design Notes" hint system quoting real
  principles (white draws the eye up; contrasting shoes expose technique).
- **A press-box preview toggle** — view your design at field distance (tiny,
  slightly desaturated, against turf). Authentic, delightful, and doubles as a
  legibility/accessibility check.
- **Fictional design-house flavor** for content packs (see §8.4): the
  century-old tailor house, the designer-label empire, the sublimation
  disruptor, the guard costumier, the catalog store with swatch rings, the
  accessories house whose shoe every finalist wears.

### 3.3 The manufacturers calibrate our numbers

Real swatch-library scale: ~110 silk colors (Band Shoppe's Poly China Silk
ring, incl. neons), ~22-color lamé families, 16 plume dyes, binary gold/silver
hardware — and the sublimation tier where color is unlimited. Real component
economics ($68 shako, $15–50 plume, $10–30 gauntlets, $200–800 uniforms) give
us believable relative CC pricing. The two real "tech trees" — tailored
construction (piecework, braid, buttons) vs. dye-sublimation (gradients,
prints, per-performer variation) — map directly onto a base catalog and an
advanced pattern tier.

### 3.4 The games tell us which mechanics actually work

- **Slots beat freeform** for casual creators (Love Nikki taxonomy), with
  bounded pattern depth inside one or two slots (Forza's lesson, contained).
- **Color: channels + collectible palettes, hue never gated.** Sims 4's
  swatch-only system bred a decade of resentment; GW2 dye channels and Destiny
  shader palettes are the loved middle ground. Our resolution: **full free hue
  picker on every channel; _finishes_ and _patterns_ are the collectible axis.**
- **Everything earnable, nothing expiring** (Helldivers/DRG/WoW-transmog
  goodwill vs. OW2/Love-Nikki resentment). Rotation without FOMO works
  (SplatNet).
- **Contests in two proven formats**: auto-scored themed briefs (Infinity
  Nikki style axes) and anonymous pairwise human voting with rewards _for
  voting_ (WoW Trial of Style + Nikki Starlight). Both map perfectly onto
  drum-corps show themes and the existing Fan Favorite voting plumbing
  (`functions/src/callable/podiumFan.js`).
- **Sharing via short codes** (Animal Crossing Design IDs, Forza 9-digit
  codes): pull-based, screenshot-able, near-zero moderation surface, and every
  share card is an advertisement carrying its own import mechanism.
- **Render identity everywhere it competes**: cosmetics matter because others
  see them — scoreboards, recaps, rivalries need at least a color-strip echo of
  the uniform.

## 4. The design space (and the combinatorics honestly counted)

### 4.1 Slot taxonomy (launch catalog)

| Slot               | Launch options (asset count)                                                                                | Color channels                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Headwear           | 8 styles: shako ×2 crowns, aussie, pith, campaign, busby, hood, none                                        | shell, band/wrap, hardware (gold/silver) |
| Hat plate / emblem | 12 emblems (curated library) + none                                                                         | metal (gold/silver)                      |
| Plume              | 6 types × 3 heights + none                                                                                  | feather, tip-dye, mylar toggle           |
| Jacket             | 7 silhouettes: cadet, tunic, long coat, satin blouse, vest, athletic top, bodysuit                          | base, panel, trim                        |
| Chest treatment    | 8: plain, single row, double-breasted, plastron, asymmetric split, diagonal panel, swash stripe, gradient\* | panel, buttons/detail                    |
| Chest hardware     | 8: none, sash, baldric, cross strap, double cross belts, Sam Browne, cummerbund, drop sash                  | strap, buckle/tassel                     |
| Shoulders          | 4: none, epaulets, fringed epaulets, shoulder knots + citation cord toggle                                  | cord/board                               |
| Sleeves            | 5: plain, chevrons (1–3), service stripes, soutache, contrast cuff                                          | stripe/trim                              |
| Hands              | gauntlets (none/flared/percussion) × gloves (none/white/black)                                              | gauntlet, glove                          |
| Legs               | bibbers stripe: none/thin/wide/double; leggings                                                             | base, stripe                             |
| Feet               | 3 shoes × spats toggle                                                                                      | shoe                                     |
| Back               | 5: none, hip cape, shoulder cape, full cape, side cape                                                      | outer, lining                            |

\* gradient/pattern treatments ship in the "sublimation tier" (§8.2).

**Asset budget:** every option is 1–4 SVG path groups keyed to one shared
figure geometry — roughly **250–350 hand-authored path groups at launch**.
That is the number that actually constrains scope (the critique's gap #3), and
it is achievable because the renderer is an **albedo + overlay** architecture:
garment parts carry only flat colorway-driven fills, while shading, highlights,
and fabric depth come from a shared set of colorway-independent overlay shapes
(black/white paths at low opacity), and finish effects (sequin fields, satin
sheen, metallic glints) are procedural. A working prototype of this exact
renderer — five fully-dressed colorways plus an annotated anatomy figure —
was built for the proposal's artifact page and validates the budget. Each
_new_ option after launch is a marginal 1–4 paths — content drops stay cheap
forever.

### 4.2 The honest math

Shape-only combinations (no color): 8 × 13 × 19 × 7 × 8 × 8 × (4×2) × 5 ×
(3×3) × (4+1) × (3×2) × 5 ≈ **3.3 billion silhouettes**. Even the most
conservative pruning (mutually exclusive combos, "none" collapse) leaves
**tens of millions of distinct silhouettes**.

Color multiplies that beyond meaning: ~30 channels across a full design, each
a free 24-bit hue with a curated ~110-name library on top. Two designs
being identical by accident is effectively impossible. **"Tens of thousands of
unique combinations" is exceeded by the jacket slot alone** — the real design
problem is curation (presets, palettes, guidance) so that the space feels
explorable instead of overwhelming, which is what §5's UX and §8's collections
are for.

### 4.3 Color system

- **Per-piece named channels** (3–5 each; ~"base / panel / trim / hardware /
  accent") — the GW2/Destiny model.
- **Corps colorway**: a saved 3–5 swatch palette (primary / secondary / accent /
  metal) that every piece defaults its channels to — set it once and the whole
  figure re-colors; override any channel locally. "Apply palette to all" is the
  Destiny whole-set button.
- **Hue is always free** (full picker + the ~110-name curated library with
  real silk-color names). **Finishes are collectible**: matte (free), satin,
  metallic, sequin, lamé, iridescent, mylar (plume). Finish ≠ hue, so identity
  is never paywalled but prestige still sparkles.
- Accessibility: every swatch shows its name; the press-box toggle doubles as
  a contrast/legibility check; color-picker is keyboard operable (the axe CI
  gate applies, `e2e/a11y.spec.ts`).

## 5. The Studio experience

### 5.1 Entry and navigation

- **New routed page** — `/studio` (with `?corps={class}&design={id}` deep
  links), lazy-loaded like every heavy feature (`lazyWithRetry`,
  `src/components/Dashboard/DashboardModalHost.jsx:42-63`). The current modal's
  no-URL, hidden-entry problem goes away.
- **Profile section "Corps Identity"** between Ensembles and the content grid
  (`src/components/Profile/DirectorProfile.tsx:611-616`), using the existing
  `Section` card grammar: per-corps uniform figure + colorway swatches + emblem
  - equipped-look name + "Open Studio" CTA. Public profiles render it
    read-only (the profile doc is already world-readable,
    `firestore.rules:249-255`); the `/d/{username}` SSR allowlist gets the
    equipped design added explicitly (`functions/src/helpers/publicProfilePages.js:78-97`).
- Dashboard's avatar tile keeps working but now routes to the Studio.

### 5.2 The editor

- **Canvas**: the live SVG figure, front-facing, full height; tap a region to
  jump to its slot. Desktop: canvas left, controls right. Mobile: canvas
  pinned top, controls in the existing `BottomSheet` with slot tabs; 44 px
  targets, no horizontal overflow (both are tested invariants).
- **Controls**: slot list → option grid (swatch-tile idiom from
  `AvatarSelectorModal.tsx:56-70`) → channel color rows. Colorway panel at
  top. A "Surprise me" randomizer seeded with palette-harmony rules (cheap,
  loved in every reference game).
- **Press-box toggle**: renders the figure at ~40 px against a field backdrop
  strip — "does it read from the stands?" (§3.2).
- **Presets**: 10–14 era/archetype starting points from the research (Classic
  Cadet maroon/gold, All-White Regiment, Green Satin, Cavalry, Scout, Police
  Blue, Costume-Revolution bodysuit, Sublimation Swash…) — _archetypes, not
  replicas of real corps_ (see §9.3).
- **Design Notes**: one-line rotating principles from real designers, shown
  contextually (pick a long coat → "short jackets read taller from the box —
  Cesario dresses the leg line").
- **Figure representation**: the figure is a _corps member_, not the director.
  Single-figure preview uses a neutral stylized tone by default with a
  selectable skin-tone set (6–8 tones); the formation share card renders a
  mixed-tone ensemble by default. This is the respectful reading of Cesario's
  "design for every body" and answers the critique's gap #8 without making the
  doll a self-portrait.

### 5.3 What save does (and doesn't do)

Save writes the design. **Nothing else.** No forced AI generation, no profile
picture switch. Equipping, avatar generation, and sharing are separate,
explicit actions with visible state — untangling the three behaviors the
current handlers fuse (§1).

## 6. Wardrobe, versioning, seasons

- **Wardrobe**: up to **24 saved designs per director** (across corps), each
  with a name ("2026 Finals Look"). Generous enough to never feel like a
  manufactured scarcity; bounded for storage sanity. Level milestones can raise
  it later if wanted — never sold.
- **Equipped identity uniform** per corps (what renders everywhere), plus an
  optional **alternate look** slot (finals week / exhibition — the home/away
  pattern from Rocket League, and real DCI practice: Cadets' 2015 mid-season
  change, finals-week additions).
- **Season archive**: rollover stamps the equipped design (id + snapshot) into
  that season's history (alongside `seasonHistory`,
  `functions/src/helpers/season.js:288-297`), building each corps a **Uniform
  History timeline** on the profile — the fantasy equivalent of the DCI
  pictorial-history features, and the fantasy twin of the year-keyed
  `dci-reference` system.
- **Guard / show look (phase 4+)**: a second figure silhouette attached to the
  per-season `showConcept` — hornline wears the identity, the guard wears the
  show, which is exactly the real activity's design contract.

## 7. Community: codes, cards, gallery, contests

### 7.1 Uniform codes (ship early — cheapest, safest sharing)

Every saved design can mint a short code (e.g. `MA-7K3F-Q2`). Entering a code
in the Studio imports that design as a new draft with attribution ("Design by
@username"). Pull-based (you only see what you ask for) — the Animal Crossing
model, with near-zero moderation surface because a design is **pure structured
data from a curated catalog**: no free text renders on anyone else's screen.

### 7.2 Share cards

A "field entrance" export: the corps in formation (mixed-tone ensemble) in the
designed uniform, stadium backdrop, corps name + class + colorway, uniform code
stamped in the corner. Client-side SVG→PNG via the existing poster pipeline
(`src/utils/posterExport.ts`), shared with `navigator.share` like tour posters;
the OG share-card system (`functions/src/helpers/shareCards.js`) later gets a
uniform variant so links unfurl with the look.

### 7.3 The Design Exchange (opt-in gallery)

Publish a design to a world-readable gallery collection (backend-written via
callable, the Fan Favorite shape — public results, callable writes,
`assertWriteBudget`). Browse by style tag/colorway; **like** and **save-a-copy**
with counters; creators earn a small capped CC payout per unique save (the
Forza download-credit loop, tuned tiny: it's a faucet, so it needs a daily cap
and an `economyStats` transaction type). Entries carry the creator's name and a
report button (§9).

### 7.4 Styling contests

- **The Design Brief** (auto-scored, weekly in off-season): a themed brief
  ("1920s revue," "thunderstorm," "toy soldiers") scores your submission from
  catalog metadata — every piece carries style tags (Traditional / Military /
  Theatrical / Modern / Avant-garde) and the brief wants a profile. Infinitely
  repeatable content generated from items that already exist (Infinity Nikki's
  trick), fully deterministic (FMA veterans' explicit warning: no subjective
  scoring in _competitive_ systems — which this respects by being a side game
  with cosmetic prizes only).
- **The Showcase** (community-voted, ~monthly): submit against a theme;
  anonymous **pairwise** voting (Trial of Style's format, which resists
  popularity meta better than star ratings); voting itself pays a token (the
  Nikki trick that keeps galleries judged); participation pays everyone;
  winners get a grant-only finish/plume/title (the `grantOnly` cosmetics
  pattern, `functions/src/helpers/shopCatalog.js:21-34`). The nightly news
  engine already knows how to write about corps — a Showcase-winner article
  with a generated glamour image is a natural, nearly-free crossover.

## 8. Economy & progression

### 8.1 The free floor (non-negotiable)

Every slot has free options; every hue is free; presets are free; SoundSport
players get the full editor. Identity is never paywalled — this is both the
ethics finding (§3.4) and the CC iron rule (docs/GAMIFICATION.md:121-129).

### 8.2 The collectible axes

| Axis                         | Examples                                                                                     | Acquisition                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Finishes                     | metallic, sequin, lamé, iridescent, mylar plume                                              | CC shop + achievements + ladder tiers                          |
| Premium silhouettes          | long coat, bodysuit, busby, cape variants                                                    | CC shop, level milestones                                      |
| Emblem packs                 | heraldic set, celestial set, creature set                                                    | CC shop, achievements                                          |
| Pattern tier ("sublimation") | gradients, geometric prints, asymmetric swash                                                | class-progression or CC unlock                                 |
| Grant-only prestige          | Championship White finish, medalist braid, contest-winner plumes, "class of 2026" collection | placements, contests, season participation — never purchasable |

All catalog/ownership follows the existing cosmetics machinery exactly:
server catalog + `purchaseShopItem`-style transactional callable + server-only
`cosmetics.owned`-style field + `corpsCoinHistory` entry with new
`TRANSACTION_TYPES` values (`functions/src/callable/shop.js`,
`functions/src/helpers/economy.js:124-131`), client display mirror with drift
test. Seasonal collections use the existing `seasonal` purchase-gate and
**return in later seasons** (Helldivers model): exclusivity means "I was
there," never "I paid before a timer."

### 8.3 Why the economy wants this

The non-Legacy catalog (~56k CC) exhausts in 11–16 months
(`functions/src/helpers/legacyCatalog.js:1-31`); the wardrobe adds the
recurring, self-renewing cosmetic sink the economy is explicitly designed to
need, at price points calibrated against existing items (frames 750–7,500 CC;
a finish pack ~1,000–2,500 CC; a silhouette ~1,500–5,000 CC).

### 8.4 Design houses (flavor layer, cheap content engine)

Fictional manufacturers modeled on the real industry sell the packs: the
century-old tailor house (traditional silhouettes), the designer-label empire
with a famous in-fiction designer (era presets + design notes), the
sublimation disruptor (pattern tier), the guard costumier (phase-4 guard
looks), the catalog store (swatch/palette packs), the accessories house
(plumes/shoes/gauntlets). Each pack drop is a changelog-worthy beat and a
Fantasy Daily story hook.

## 9. Moderation, IP, and safety

1. **Structured data only.** A shared design contains catalog ids and hex
   values — no free text ever renders on another player's screen. This deletes
   ~all of the moderation surface that plagues image/text UGC. (The current
   free-text prose fields survive only as private AI-prompt hints.)
2. **Emblems are curated**, not uploaded. No user-generated vector art in v1.
3. **Gallery hygiene**: report button on entries; admin unpublish + per-account
   `designShareBanned` flag following the `customAvatarBanned` pattern
   (`firestore.rules:59-63`, `functions/src/triggers/avatarGeneration.js:536-594`).
   Offensive _combinations_ (e.g. hate-symbol color arrangements) are rare but
   possible — report-driven takedown is the industry-standard answer.
4. **Real-corps IP**: presets are era archetypes ("Classic Cadet maroon/gold"),
   never named replicas; the emblem library contains no real corps marks (no
   DCI logos, no Blue Devils/Cavaliers copyrighted custom colors marketed as
   such). Players hand-building an homage with generic parts is the same
   protected play every dress-up game hosts. The news pipeline's real-DCI
   imagery is unaffected (separate system, `functions/src/helpers/dciUniforms.js`).

## 10. Technical architecture

### 10.1 Data model (v2, additive)

```ts
// src/types/uniform.ts
interface UniformDesignV2 {
  schema: 2;
  name: string;                    // "2026 Finals Look" (owner-visible label)
  colorway: { primary: Hex; secondary: Hex; accent: Hex; metal: 'gold'|'silver' };
  slots: {
    headwear: { style: SlotId; channels: Record<ChannelId, Hex>; finish?: FinishId };
    plume:    { type: SlotId; height: 1|2|3; treatment: TreatmentId; channels: {...} };
    jacket:   { silhouette: SlotId; chest: SlotId; channels: {...}; finish?: FinishId; pattern?: PatternRef };
    // … per §4.1
  };
  aiHints?: { mascotOrEmblem?: string; themeKeywords?: string[]; additionalNotes?: string }; // private, prompt-only
}
```

- **Wardrobe**: `artifacts/{ns}/users/{uid}/wardrobe/{designId}` — a new
  subcollection with its **own rules match block** (the default catch-all is
  admin-write-only, `firestore.rules:342-362`). Writes go through a
  `saveUniformDesign` callable (validation + entitlement checks + size caps +
  `assertWriteBudget`), because finishes/patterns are purchasable and the
  client must not self-attest ownership; reads are owner-only.
- **Equipped snapshot**: `corps.{class}.uniform` on the profile doc — a bounded
  (~2–4 KB) copy of the equipped design, written by an `equipUniformDesign`
  callable. World-readable like the rest of the profile, so any surface can
  render any corps deterministically. The hot-doc stays small (the
  `seasonDetail` lesson, `firestore.rules:257-266`); the wardrobe never
  accumulates on it.
- **Legacy**: `uniformDesign` (v1 prose) stays in place, read-only, as the AI
  fallback until migration completes; `avatarStyle`/`avatarSection` move to a
  small `avatarPrefs` field (they were never uniform data).
- **Rules**: new match blocks + mandatory cases in
  `firestore-tests/rules.test.mjs`; new callables registered with write
  budgets (CI census, ARCHITECTURE.md:167-183).

### 10.2 Migration (critique gap #1)

One-time, lazy, client-triggered: on first Studio open, v1 prose maps
best-effort to a v2 draft — the 20 color suggestions + CSS color names resolve
to hex (unknown strings → nearest preset palette), `style` enum → silhouette
preset, `helmetStyle` → headwear slot, prose section descriptions → `aiHints`.
Existing `avatarUrl`s are untouched; nothing regenerates. A "Your uniform,
rebuilt in the Studio — refine it" banner plus a changelog entry announce it.

### 10.3 Rendering

- **`UniformFigure.tsx`** — pure presentational `forwardRef<SVGSVGElement>`
  layered-`<g>` component following the TourPoster idiom exactly
  (`src/components/Schedule/TourPoster.tsx`): style-attribute-only (exportable),
  `role="img"` + descriptive `aria-label`, `viewBox` + `width:100%`, memoized.
  Zero new dependencies; the poster's SVG→PNG exporter is reused as-is.
- **Part data** in `src/data/uniformParts/` — path groups + channel metadata +
  catalog entries. `src/data/` is explicitly census-exempt for hex
  (`scripts/designCensus.mjs:46-56`), so the design-token ratchet never fires.
  Part data is imported only by the lazy Studio chunk (the `tourMap.ts`
  pattern) — the dashboard bundle doesn't grow.
- **At scale** (critique gap #5): full figures render on profile, Studio, and
  share surfaces only. Lists (Scores, rivals, leaderboards) get a **colorway
  strip** (3-swatch bar + metal dot next to `TeamAvatar`) — deterministic,
  ~zero cost, denormalized alongside `avatarUrl` in the nightly run — not
  hundreds of live dolls. Full-figure hover/preview can come later if wanted.

### 10.4 Art pipeline (critique gap #3)

One shared figure geometry (front-facing at-attention pose), rendered
illustration-grade rather than flat: layered albedo garment parts whose fills
come from colorway channels, a shared colorway-independent shading/highlight
overlay set (sculpted head, garment side-shade, inseam shadows, crease
highlights), and procedural finish effects (deterministic sequin fields, satin
sheen bands, metallic button/buckle glints). Symmetric limbs are authored once
and mirrored. Parts are authored as path data against the shared geometry —
in a vector tool or directly (TourPoster proves the codebase norm) — with a
Studio-internal dev harness page to preview all parts; the proposal artifact's
hero figures are a working prototype of this exact pipeline (source preserved
at [`docs/prototypes/uniform-figure.html`](prototypes/uniform-figure.html) —
open it in a browser to see the five colorways and the annotated anatomy
figure). Launch budget
~250–350 path groups (§4.1); every later drop is marginal. No new pose work
until the guard silhouette (phase 4).

### 10.5 AI imagery (critique gap #2)

- SVG preview: free, instant, unlimited — the designer loop never touches AI.
- `generateCorpsAvatar` stays: explicit action, free-tier model, existing
  5/hr/uid budget (`functions/src/triggers/avatarGeneration.js:337-340`)
  untouched. Prompts get _better_: structured slots + hex resolve to precise
  prose server-side (replacing the fragile `colors.split(" with ")` chain in
  `functions/src/helpers/newsImagePrompts.js:33-34`).
- **Design-hash cache**: skip regeneration when the design hash hasn't changed
  — spend goes down, not up.
- News pipeline reads v2-derived prose through the same
  `getFantasyUniformDetails` seam (`functions/src/helpers/newsUniforms.js:452-573`).

### 10.6 Testing & CI obligations

Vitest render tests (channels → fills; catalog/display-mirror drift like the
cosmetics test), rules tests for every new block, callable budget census,
Playwright spec (open Studio → pick options → save → equip; axe gate passes),
coverage floors respected, changelog entry on ship, and one `@ts-nocheck`
removal per landing PR per CLAUDE.md. All new UI is TypeScript.

## 11. Phased build plan

| Phase                        | Ships                                                                                                                                                                                                                  | Scope notes                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **1 — Figure & Studio core** | v2 schema + migration; `UniformFigure` + ~8 core slots with free catalog; `/studio` page (desktop + bottom-sheet mobile); colorway system; save/equip callables + rules; profile **Corps Identity** section; changelog | The moment the feature stops being a form. No economy, no sharing yet. |
| **2 — Depth & identity**     | Full slot catalog + finishes; emblem library; presets + Design Notes + press-box toggle; wardrobe UI (24 slots, alternate look); share card + uniform codes; colorway strip on Scores                                  | "Top-tier dress-up sim" bar is met here.                               |
| **3 — Community**            | Design Exchange gallery (publish/like/save-copy, creator payouts, report/admin tooling); OG unfurls; SSR profile section                                                                                               | Fan-Favorite-shaped backend.                                           |
| **4 — Live-ops & expansion** | Styling contests (Brief + Showcase); seasonal collections + design-house packs; uniform season-archive timeline; guard/show-look silhouette; drum-major prestige variant                                               | Recurring content cadence.                                             |

Each phase is independently shippable and player-visible; phase 1 alone
already replaces everything §1 criticizes.

## 12. Success metrics

- % of active directors with a v2 equipped design (target: >60% in two seasons)
- Designs saved per director; Studio return visits per week
- Codes redeemed / share cards exported (the viral loop)
- Gallery publishes, saves-with-attribution, contest entries + votes
- CC sunk into wardrobe catalog per week (`economyStats` new transaction types)
- AI generation spend per director (should _fall_ — cache + decoupled save)

## 13. Open questions for review

1. **Naming** — "Uniform Studio" (working title) vs. something more in-world
   ("The Design Suite," "Corps Couture," a fictional house name).
2. **Wardrobe cap** — 24 per director (proposed) vs. per-corps caps.
3. **Podium flavor** — should Podium corps get any Studio-adjacent hooks
   (e.g. a Corps-Budget-priced "uniform refresh" ceremony at registration), or
   stay identical to Fantasy? (Proposal: identical in v1; ceremony later.)
4. **Colorway strip on Scores in phase 2** — confirm appetite for touching the
   nightly denormalization pipeline that early, or defer to phase 3.
5. **Contest cadence** — off-season-only at first (proposed), or year-round?
