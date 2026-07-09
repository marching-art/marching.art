# Engagement, Economy & Gamification Review

> Generated: July 2026 (revised same month)
> Scope: complete review of the user experience, gameplay process, and gamification elements, with a concrete plan for making CorpsCoin and XP valuable, giving new directors a guided path, and giving long-term directors goals worth chasing.
> Assumption: **no real-money monetization.** The game is donation-supported (Buy Me a Coffee). CorpsCoin is a fully closed-loop currency — earned only by playing, spent only in-game. `MONETIZATION_ROADMAP.md` is deprecated; only its competitive-integrity principle carries forward.

---

## 📌 Status annotation — July 2026 (added after owner review; read this first)

This review predates three newer companion docs — `LIFELONG_GAMIFICATION_ROADMAP.md`, `PROGRESSION_ECONOMY_REDESIGN.md`, and `DASHBOARD_UNIFICATION.md` — which **supersede this document wherever they overlap**. Much of Part 3 has since shipped. `📌 STATUS` blocks have been inserted below, recording per finding what is ✅ SHIPPED, ⚠️ PARTIAL, ⏳ OPEN, or ♻️ SUPERSEDED as of July 2026, verified against the code. Two corrections to this doc's analysis:

1. **The XP earn-rate estimates in Parts 1 and 5 are too high.** `awardXP` — carrying the two largest recurring XP sources, weekly participation (200 XP) and league win (100 XP) — is defined but never invoked, so the real active earn rate is ~385 XP/week, not 450–600. See `PROGRESSION_ECONOMY_REDESIGN.md` §1.2. The Part 5 verdict "XP pacing is already right" is **superseded**.
2. **League prediction pools** (deferred in B3 as optional side-wagers) are **promoted to flagship status** by `LIFELONG_GAMIFICATION_ROADMAP.md` Step 6, which is the plan of record.
3. **Class-unlock paths:** the owner approved replacing the calendar-week auto-unlock with *seasons-actively-completed* (see `PROGRESSION_ECONOMY_REDESIGN.md` Decision 1) — this doc's B5 aside about the "class-unlock triple-path" is resolved by that decision.

---

## Part 1 — State of the Game (what the code actually does)

### 1.1 The core loop is healthy — and richer than the UI lets on

A day in the life of an active director:

1. Open the app → `claimDailyLogin` fires (+25 XP, streak increments, milestone bonuses at 3/7/14/30/60/100 days).
2. Check last night's ~2:00 AM ET scores, rank change, and rivals.
3. Yesterday's predictions resolve (+15 XP / +10 CC per correct pick, +25 CC perfect day); make today's picks.
4. Complete up to 3 daily challenges (5–10 XP each).
5. If inside a change window, swap captions (3/week per class, days 15–42) using the Lineup Analyzer.
6. Confirm this week's show registrations (up to 4) before the nightly run.

That is genuinely a lot of loop for a "passive" game. The problem is that most of it is **invisible or unrewarded**: deadlines aren't surfaced, the streak-freeze sink has no UI, season-end payouts never fire, and nothing changes for a director after Level 10. The engagement gap is not a content gap — it's a **payoff and visibility gap**.

### 1.2 The economy: all faucet, no drain

**CorpsCoin faucets (live, verified in code):**

| Source                         | Amount                            | Where                                                     |
| ------------------------------ | --------------------------------- | --------------------------------------------------------- |
| New-account grant              | 1,000 CC                          | `functions/src/callable/users.js:108`                     |
| Show participation (nightly)   | 50/100/150/200 CC by class        | `economy.js:100-107`, paid via `scoringAwards.js:261-293` |
| Weekly league matchup win      | 100 CC                            | `scoringAwards.js:681-698`                                |
| Streak milestones (3→100 days) | 50–1,000 CC                       | `dailyOps.js:23-30`                                       |
| Prediction accuracy            | 10 CC/correct + 25 CC perfect day | `dailyPredictions.js:18-21`                               |
| League prize pool (champion)   | default 1,000 CC                  | `season.js:635-649`                                       |

An active World Class director earns roughly **800–1,200 CC per week** (4 shows + league win + predictions + streak amortization). A SoundSport rookie earns roughly 300–500 CC/week.

**CorpsCoin sinks reachable in the UI:**

| Sink                         | Cost                     | Status                                                          |
| ---------------------------- | ------------------------ | --------------------------------------------------------------- |
| Class unlocks (A/Open/World) | 1,000 / 2,500 / 5,000 CC | ✅ Live (`ClassPurchaseModal.tsx` → `unlockClassWithCorpsCoin`) |

That's the entire list. **8,500 CC of one-time lifetime spending** against an income of ~50,000+ CC/year for an active player — and even that sink is undercut by the account-age auto-unlock (`CLASS_UNLOCK_WEEKS`: 5/12/19 weeks), which hands out the same classes for free just by waiting. After roughly week 19, CorpsCoin is a score with no scoreboard.

**Built but broken or unreachable (highest-leverage findings):**

| Item                                                                                      | Status                                                                                                                                                          | Evidence                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Streak freeze (300 CC)** — the one recurring sink                                       | Server-side complete (`purchaseStreakFreeze`, `getStreakStatus` in `dailyOps.js:308-475`, deployed in `index.js`), **zero frontend references** — unpurchasable | grep of `src/**` for `streakFreeze\|purchaseStreakFreeze\|getStreakStatus` = 0 hits |
| **Season finish bonuses** (Champion 1,000 / 2nd 750 / 3rd 500 / top10 350 / top25 250 CC) | `awardSeasonBonus` + `SEASON_FINISH_BONUSES` fully implemented, **never called** — the advertised season payday never happens                                   | `economy.js:117-123, 248`                                                           |
| **Season completion XP** (top10 500 / top25 400 / top50 300 / completed 200)              | `getSeasonCompletionXP` defined, **never invoked**                                                                                                              | `xpCalculations.js:195`                                                             |
| **CorpsCoin ledger + earning guide**                                                      | `getCorpsCoinHistory` and `getEarningOpportunities` implemented and deployed, **no frontend caller**                                                            | `economy.js:486, 525`; `index.js:240-241`                                           |
| League entry fees                                                                         | `payLeagueEntryFee` implemented, not deployed, no UI                                                                                                            | `economy.js:436`                                                                    |
| Stripe webhook                                                                            | Placeholder; logs analytics only, grants nothing                                                                                                                | `functions/src/webhooks/stripe.js`                                                  |
| Execution system (equipment/morale/readiness)                                             | Typed client stubs in `functions.ts:182-212` with **no backend** (intentionally cut per `PRIORITIES.md`)                                                        | dead client code                                                                    |
| XP display drift                                                                          | Frontend shows `weeklyParticipation: 100, leagueWin: 50` (`captionPricing.js:59-68`) — **half** the real backend values (200/100)                               | stale mirror                                                                        |

The practical consequence: **every season ends in silence.** No rank bonus, no completion XP, no ceremony — for a game whose entire dramatic arc builds toward Finals night, the anticlimax is the single biggest wasted engagement moment in the product.

> 📌 **STATUS (July 2026):** most rows of the table above have since been fixed —
>
> - **Streak freeze:** ✅ SHIPPED — purchasable via `src/pages/Shop.jsx` and `src/components/modals/StreakModal.jsx`.
> - **Season finish bonuses & completion XP:** ✅ SHIPPED — season archival (`functions/src/helpers/season.js`) now pays `SEASON_FINISH_BONUSES` and `getSeasonCompletionXP`, and a `SeasonRecapModal` exists. "Every season ends in silence" is no longer true.
> - **CorpsCoin ledger + earning guide:** ✅ SHIPPED — `CorpsCoinModal.jsx` calls `getCorpsCoinHistory` and `getEarningOpportunities`.
> - **XP display drift:** ✅ FIXED — `captionPricing.js` now mirrors the backend values (200/100). *However* those backend values still never pay out (`awardXP` uninvoked) — see `PROGRESSION_ECONOMY_REDESIGN.md` Phase A, the top open bug.
> - **League entry fees, Stripe webhook, execution-system stubs:** ⏳ status unchanged (entry fees folded into the roadmap's Step 6 league economy; Stripe stays a placeholder — no real-money path, per this doc's own assumption).

### 1.3 XP: a road that ends at Level 10

- Flat 1,000 XP/level; titles Rookie → Legend (Levels 1–10) in `xpCalculations.js:31-52`.
- The **only** thing XP unlocks is corps classes (Levels 3/5/10) — which are also obtainable by waiting (weeks) or paying (CC).
- Past 10,000 XP: nothing. No titles, no unlocks, no prestige, no seasonal reset. Long-term directors are stacking a number that stopped meaning anything months ago.

> 📌 **STATUS (July 2026):** ⚠️ PARTIAL — the title ladder now extends to Level 30 ("Legend" 10 → "Icon" 15 → "Hall of Famer" 20 → "Immortal" 25 → "Eternal" 30, `xpCalculations.js:44-48`), so C1 is largely shipped. Still open: no XP-to-next-level bar in the UI, no per-level CC stipend, no cosmetic unlocks per 5 levels, and the level-up celebration never fires (see `LIFELONG_GAMIFICATION_ROADMAP.md` Step 2).

### 1.4 Three achievement systems that don't talk to each other

1. **Persisted `profile.achievements[]`** — rarity-tiered, shown on profile; League Champion awarded server-side, but streak/top-10 achievements are written **from the browser** (`useDashboardData.js:258-287, 354-404`) — client-trusted writes in an otherwise server-authoritative game.
2. **`AchievementTrackerPanel`** — 17 achievements recomputed on every render, display-only, no persistence, no rewards; its "View all" link points to a `/profile?tab=achievements` tab that doesn't exist.
3. **Trophies** — server-authoritative and excellent (regionals, class finals, world championships, Hall of Champions archive via `scoringAwards.js`).

There is also a **legacy client-side streak writer** in `useDashboardData.js:206-312` that duplicates and can diverge from the server's `claimDailyLogin`.

> 📌 **STATUS (July 2026):** ⚠️ PARTIAL — a server-authoritative achievement catalog with CC rewards per rarity now exists (`functions/src/helpers/achievements.js`), and the legacy client streak writer is gone (`useDashboardData.js` now only mirrors server-owned streak data). Still open: `AchievementTrackerPanel`'s client-side list diverges from the server catalog and must be reconciled (see `DASHBOARD_UNIFICATION.md` Part 3 and `LIFELONG_GAMIFICATION_ROADMAP.md` Step 1).

### 1.5 What's genuinely strong (don't touch, build on)

- Server-authoritative daily systems: login/streaks, challenges, predictions — all idempotent, all real.
- The trophy/Hall of Champions pipeline and season archival (`seasonHistory`, retired corps gallery, lifetime leaderboard).
- Re-engagement comms: rival-diff weekly emails, win-back, streak-broken consolation, show-time push.
- The uniform designer + AI corps avatar generation — a **fully built cosmetic identity system** with no economy attached to it yet.
- Onboarding mechanics: 3-step wizard, guest-lineup import, auto show registration, dashboard tour, QuickStartGuide reading real constants.

---

## Part 2 — Design Principles for the Fix

1. **Sinks must recur.** One-time purchases (class unlocks) can't balance perpetual faucets. Every economy that works has consumables, seasonal catalogs, or prestige tiers.
2. **Prestige over power.** CorpsCoin must never buy scores, extra trades, or competitive edges. It buys **identity, ceremony, and status** — which is what drum corps culture actually runs on (uniforms, corps names, legacy, the retirement of a jacket).
3. **Price against weekly income.** Anchor: active player ≈ 800–1,200 CC/week. Consumables at ~25–40% of a week's income; cosmetics at 1–3 weeks; prestige items at 10–25 weeks (there to drain long-term hoards).
   _Because there is no real-money CC injection, the economy is fully closed-loop: every coin in circulation was earned by playing. That makes balance tractable — tune faucets and sink prices freely without worrying about purchased hoards, and "unfair advantage" is structurally impossible as long as sinks stay cosmetic._
4. **Absorb existing hoards deliberately.** Veterans may hold 20,000–50,000+ CC. Launching the shop with only 500 CC items lets them buy everything on day one and feel done. The catalog needs a top shelf from day one.
5. **The season is the heartbeat.** Both season types run 49-day cycles year-round — every reward structure should reset, pay out, and re-hook at season boundaries, because the infrastructure for that (archival, champions, wizard re-entry) already exists.

---

## Part 3 — Recommendations

### A. Repair the economy you already built (days, not weeks — do first)

| #   | Fix                                                                                                                                                                                                                           | Effort | Why                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| A1  | **Wire the streak-freeze UI** — surface `getStreakStatus` + `purchaseStreakFreeze` in the streak display and in an "streak at risk" state                                                                                     | Small  | The only recurring CC sink in the game is fully built and unreachable                                    |
| A2  | **Call `awardSeasonBonus` and `getSeasonCompletionXP` during season archival** (`season.js` rollover) and announce them in a season-recap modal                                                                               | Small  | Turns Finals night into a payday; instantly gives rank a currency meaning                                |
| A3  | **Ship the CorpsCoin ledger + "How to earn" panel** using the already-deployed `getCorpsCoinHistory` / `getEarningOpportunities`                                                                                              | Small  | A currency without a visible ledger doesn't feel real; the earning guide doubles as new-player education |
| A4  | **Unify achievements server-side** — move streak/top-10 awards out of the browser, merge the 17 tracker achievements into the persisted system, award small CC per achievement, fix the dead `/profile?tab=achievements` link | Medium | Three inconsistent systems → one trustworthy one; removes client-trusted writes                          |
| A5  | Delete the legacy client streak writer (`useDashboardData.js:206-312`), fix the stale XP mirror in `captionPricing.js`                                                                                                        | Small  | Prevents divergent streaks and misleading numbers                                                        |

> 📌 **STATUS (July 2026):** A1 ✅ SHIPPED (Shop + StreakModal) · A2 ✅ SHIPPED (`season.js` archival + `SeasonRecapModal`) · A3 ✅ SHIPPED (`CorpsCoinModal`) · A4 ⚠️ PARTIAL (server catalog exists; tracker-panel reconciliation still open) · A5 ✅ SHIPPED.

### B. Give CorpsCoin a job (the sink catalog)

**B1. Corps Identity Shop — the flagship.** The uniform designer and AI avatar generator already exist; attach the economy to them:

- Premium uniform palettes and fabric/finish tiers: 500–2,500 CC
- Emblems, plumes, helmet styles, mascots: 750–3,000 CC
- Corps card themes and animated card effects (leaderboards/league standings show them to _others_ — status must be visible to be worth buying): 1,500–3,500 CC
- Avatar regeneration tokens beyond a free allowance: 250 CC
- Director titles/flair displayed under the username in leagues and scores: 1,000–10,000 CC
- Victory celebration effects (confetti variants — `canvas-confetti` is already a dependency): 1,500 CC

**B2. Consumables & conveniences (recurring, non-competitive):**

- Streak freeze, 300 CC (A1 — exists)
- Extra saved lineup template slots: 500 CC each
- Season Scrapbook / rich recap unlock at season end: 750 CC

**B3. League economy (backend half-exists):**

- Deploy `payLeagueEntryFee`; commissioner-set buy-ins (100–1,000 CC) fund real prize pools — leagues become CC circulation loops instead of pure faucets
- League cosmetics bought from the league treasury: custom league trophy styles, banner, chat badge (2,500–10,000 CC)
- _(Optional, later)_ Friendly matchup side-wagers, escrowed and capped (e.g., 100 CC) — opt-in, symmetric, zero scoring impact. Zero-sum transfers don't inflate the economy, but they add moderation edge cases; skip until leagues are humming.

> 📌 **STATUS (July 2026):** ♻️ SUPERSEDED — `LIFELONG_GAMIFICATION_ROADMAP.md` Step 6 promotes league prediction pools from "optional, later" to the flagship social mechanic and the economy's recurring CC-circulation sink. The roadmap's position is the plan of record.

**B4. Prestige sinks — for the 40,000 CC veterans:**

- **Show sponsorship:** spend 10,000–25,000 CC to sponsor a show on next season's schedule — "TourStop Invitational, presented by The Ambassadors" visible to every director who registers or reads that recap. One sponsor per show, first-come or sealed-bid. Pure status, enormous drain, uses the existing schedule system.
- **Corps retirement ceremonies:** the Retired Corps gallery exists — sell commemorative tiers (bronze/silver/gold plaque, 2,500/7,500/15,000 CC) with a permanent styled page recording the corps' trophies and history.
- **Hall of Champions banner:** past champions can hang a customized banner (10,000 CC) on their Hall entry.

**B5. What CorpsCoin should never buy:** extra caption changes, show slots, score modifiers, or earlier deadlines. The moment currency touches competition, the classic-server trust that makes the game work is gone. (Recommend also revisiting the class-unlock triple-path: keep the age-based fallback for accessibility, but it's the reason classes can't be the load-bearing sink.)

### C. XP: progression that doesn't end

**C1. Extend the ladder past Level 10.** Keep 1,000 XP/level; add titles (Legend → 15 Icon → 20 Hall of Famer → 25 Immortal → 30+ numbered "Legend II"-style prestige), a small CC stipend per level-up (+100 CC), and a cosmetic unlock every 5 levels. Cheap to implement — it's a table in `xpCalculations.js` plus profile display.

**C2. Seasonal reward ladder (free, one track, keep it simple).** A single free seasonal reward ladder — deliberately _not_ a battle pass: no premium track, no separate pass XP pool, no FOMO mechanics. ~15–20 tiers over the 49-day season, fed directly by the XP players already earn (login, challenges, predictions, participation), paying out CC, one seasonal cosmetic set, and a title at the cap. Implementation is one reward table + a claim function + a progress bar; season boundaries and XP events already exist. This converts XP from a lifetime odometer into a **seasonal ladder with a visible endpoint**, and the seasonal cosmetic set (themed to the off-season's name — the seasons are already thematically named) creates recurring demand in the shop without a new art pipeline. Miss a season? The set rotates into the regular catalog a year later at a higher price — gentle exclusivity, no punishment.

**C3. Caption mastery tracks.** Cumulative per-caption performance across seasons ("Brass: 2,400 lifetime points → Brass Specialist III") with titles/badges. Deepens the actual strategic identity of the game (caption picking) rather than bolting on generic quests. Data already exists in recaps/season history.

> 📌 **STATUS (July 2026):** C1 ⚠️ mostly SHIPPED (titles to Level 30; stipend/cosmetic-per-5-levels and the level-up celebration wiring still open) · C2 ✅ SHIPPED as the 12-tier `SeasonLadderPanel` · C3 ⏳ OPEN (roadmap Step 4).

### D. The new-director journey (first 49 days, not first 10 minutes)

Onboarding today is good at minute one and silent by day two. Bridge it:

**D1. "First Season Journey" questline.** Extend QuickStartGuide's 3-step checklist into a staged, server-validated quest line across the rookie season, each step paying CC/XP and teaching one mechanic at the moment it matters:

1. Field your full lineup (exists) → 2. Register for your first show → 3. Read your first recap → 4. Make your first prediction → 5. Make your first caption trade _in a change window_ (teaches the window system) → 6. Join a league → 7. Set a show concept (teaches synergy bonuses) → 8. Survive Championship Week → 9. Complete your first season → unlock "Sophomore Season" achievement + A Class spotlight.

This directly addresses "new directors learning the ropes": the trade windows, show registration cadence, and synergy system — the game's real depth — currently have to be discovered by accident.

**D2. Make time visible** (reaffirming `PRODUCT_ANALYSIS_UX.md` Rec 1): persistent countdowns for scores-drop, trade-window close, and week reset. For a rookie, invisible deadlines read as "nothing to do here"; visible ones read as "come back tonight."

**D3. Rookie leagues.** Auto-offer placement into a SoundSport rookie league at onboarding (social retention is the strongest predictor in fantasy sports, and today league discovery is entirely pull-based).

**D4. Class graduation ceremonies.** Unlocking A/Open/World is currently a silent boolean. Make each one a celebrated moment (modal + confetti + free class-themed cosmetic + achievement) — it's the new director's clearest "I'm getting somewhere" milestone chain.

> 📌 **STATUS (July 2026):** D1 ✅ SHIPPED (`JourneyPanel` + `functions/src/callable/journey.js`) · D2 ⚠️ PARTIAL (a next-deadline countdown lives in the dashboard `ControlBar`; full deadline visibility is `DASHBOARD_UNIFICATION.md`'s scope) · D3 ⏳ OPEN (roadmap Step 6) · D4 ⚠️ PARTIAL (a `ClassUnlockCongratsModal` exists; the full ceremony — including the "earned early" asymmetry — is `PROGRESSION_ECONOMY_REDESIGN.md` Phase B step 7).

### E. Long-term director goals (beyond stacking)

- **E1. Records Book:** a per-class and all-time records page (highest single-night score, best GE, biggest week-over-week climb, longest win streak, most Best-in-Show) with the record-holder's name. Recap data already contains all of it. Records are the classic-fantasy-server endgame: they give elite players a target that isn't just "win again."
- **E2. Dynasty/legacy meta-achievements:** back-to-back titles, medaling in all four classes, 10 career top-10s — feeding the unified achievement system (A4) and displayed in the Hall.
- **E3. Personal bests & season report cards:** at archival time, show each director their PBs and whether they beat last season — self-competition retains veterans who'll never be #1.
- **E4. Sponsorship & memorial sinks (B4)** are the hoard-drain and the status game for this cohort.

---

## Part 4 — Suggested Sequencing

Ordered for a donation-supported project where development time is the scarce resource. Each phase is independently shippable and valuable; stopping after any phase leaves the game better balanced than before.

| Phase | Work                                                                                                                                | Effort     | Payoff                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| 1     | A1–A3, A5 (wire streak freeze, season payouts, CC ledger, cleanup)                                                                  | ~1 week    | Economy stops being broken; Finals becomes a payday                                 |
| 2     | A4 unified achievements + D4 graduation ceremonies + C1 extended levels                                                             | ~1–2 weeks | Every existing milestone starts paying and celebrating                              |
| 3     | D1 First Season Journey questline + D2 deadline visibility + D3 rookie leagues                                                      | ~2 weeks   | New-director activation and week-2 retention                                        |
| 4     | B1 Corps Identity Shop **v1: three item types only** (director titles, uniform palettes, corps card themes) + streak freeze in-shop | ~1–2 weeks | The currency gets a job with minimal new surface area                               |
| 5     | E1 Records Book + B4 show sponsorship                                                                                               | ~1–2 weeks | Endgame targets + the big hoard drain, both mostly reads of existing data           |
| 6     | C2 seasonal reward ladder, then shop expansion (emblems, celebrations, league cosmetics, B3 entry fees), C3 mastery, E2–E3          | ongoing    | The seasonal cadence layer, once the fundamentals have a season of data behind them |

Explicitly dropped from the original plan: premium pass track, Stripe integration, CC bundles, and all real-money cosmetics — the project is donation-supported and the closed-loop economy is stronger for it. One optional nod to supporters: a manually granted, purely cosmetic **"Supporter" profile badge** for Buy-Me-a-Coffee donors. No gameplay effect, no store — just a visible thank-you.

> 📌 **STATUS (July 2026):** Phases 1–2 are ✅ essentially SHIPPED (streak freeze, season payouts, ledger, cleanup, extended levels; achievement unification remains ⚠️ partial). Phase 3's questline is ✅ shipped; deadline visibility and rookie leagues remain open. Phases 4–6 are ⏳ OPEN — but sequencing is now owned by `LIFELONG_GAMIFICATION_ROADMAP.md` Part 4, which supersedes this table. The Shop currently sells director titles + the streak freeze only; the rest of the B-catalog is unbuilt.

---

## Part 5 — Will it feel balanced? (the math)

Balance here has two axes. **Fairness** is solved by construction: nothing purchasable touches scoring, so no amount of CC — hoarded or fresh — changes competition. What remains is **pacing**: does earning feel meaningful and does spending feel affordable-but-not-trivial? Checked against the actual faucet rates:

- **The active-player weekly budget (~800–1,200 CC)** comfortably covers one consumable (streak freeze 300) plus one entry-tier cosmetic (~500) per week, or saves toward a 2,500 CC item in ~3 weeks. That is a healthy "always something in reach, always something to save for" cadence.
- **Class income asymmetry is real but acceptable.** World Class show payouts are 4× SoundSport's (200 vs 50 CC/show). Since sinks are cosmetic, this is progression flavor, not unfairness — but the shop needs a 250–500 CC entry tier so rookies can buy _something_ in their first two weeks. First purchase is the moment the currency becomes real.
- **Veteran hoards (est. 20,000–50,000 CC) are absorbed, not confiscated.** Prestige tier (10,000–25,000: sponsorships, plaques, banners) plus the full cosmetic catalog gives an opening-day catalog depth of roughly 40,000–60,000 CC for a completionist. Veterans get a shopping spree, not instant completion — and seasonal rotation (C2) keeps demand recurring afterward.
- **XP pacing is already right.** A daily-active player earns ~450–600 XP/week → a level every ~2 weeks → World Class via XP in ~4–5 months, matching the target in `docs/GAMIFICATION_REDESIGN.md`. Extended levels at the same rate mean a title bump roughly every 10 weeks — slow enough to mean something. *(📌 ♻️ SUPERSEDED — this estimate assumed `awardXP` fires; it doesn't. Real rate ≈ 385 XP/week. See `PROGRESSION_ECONOMY_REDESIGN.md` §1.2 and §4 for the corrected numbers and the rebalanced target.)*
- **Season payouts (Phase 1) won't inflate.** Even the champion's 1,000 CC + league pool is ~1 week of active income, arriving once per 49 days.
- **One caution: AI avatar regeneration costs real API money.** Pricing regen tokens in CC (250+) conveniently rate-limits actual infrastructure spend — keep that sink priced firmly and consider a hard daily cap.
- **Instrument it.** The `corpsCoinHistory` ledger already records every transaction with a type. A one-page admin stat — total CC minted vs. sunk per week — is the only dashboard needed to tune prices after launch. Expect to adjust cosmetic prices once, about one season in.

The honest overall verdict: the plan is a set of **small independent systems attached to one existing loop**, not one big interlocking machine. Phases 1–2 involve no new balance decisions at all (they activate rates already in the code). The first genuinely new balance surface is shop pricing in Phase 4, and a closed-loop cosmetic economy is forgiving — a mispriced palette is a shrug, not an exploit.

---

## Appendix — Pricing anchors

| Income profile                                                   | CC/week (approx.) |
| ---------------------------------------------------------------- | ----------------- |
| SoundSport rookie, moderately active                             | 300–500           |
| World Class, fully active (4 shows, league, predictions, streak) | 800–1,200         |

| Sink tier      | Price band    | Examples                                              |
| -------------- | ------------- | ----------------------------------------------------- |
| Consumable     | 250–750       | Streak freeze, avatar reroll, template slot           |
| Cosmetic       | 500–3,500     | Palettes, emblems, card themes, celebrations          |
| Identity/title | 1,000–10,000  | Director titles, league trophy styles                 |
| Prestige       | 10,000–25,000 | Show sponsorship, Hall banner, gold retirement plaque |
