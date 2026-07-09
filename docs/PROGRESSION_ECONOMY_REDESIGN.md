# Progression Economy Redesign — Making the "Slow Way" Real

> Generated: July 2026
> Scope: a redesign of the XP / CorpsCoin earning economy and the class-unlock system, grounded in progression psychology, so that earning your way up feels *earned* and *good*.
> Companion to: `LIFELONG_GAMIFICATION_ROADMAP.md` (this is the detailed spec behind that roadmap's Steps 2, 4, 5, and 8) and `ENGAGEMENT_ECONOMY_REVIEW.md` (the CorpsCoin *sink* side; this doc is the *source* side).
> Prompted by: a real player request to "earn class unlocks the slow way" and the discovery that the slow way is both under-rewarded and partly broken.

> **✅ Both decisions were approved by the owner (July 2026).** The recommended answers below are the plan of record: Decision 1 (unlock trigger moves from calendar weeks to seasons actively completed) and Decision 2 (fix the dead-XP bugs first — Phase A — then the full rebalance — Phase B). The ⚑ DECISION flags are retained inline for context.

---

## Part 1 — The problem, precisely

### 1.1 The core contradiction

A class unlocks **three** independent ways today:

| Path | Trigger | Feel |
| --- | --- | --- |
| **XP level** | A = Lvl 3 (3,000 XP) · Open = Lvl 5 (5,000) · World = Lvl 10 (10,000) | earned (the "slow way") |
| **Calendar time** | A = 5 weeks · Open = 12 · World = 19 weeks **since registration** | unearned — the clock ticks whether you play or not |
| **CorpsCoin** | A = 1,000 · Open = 2,500 · World = 5,000 CC | purchased (skip) |

The three undercut each other, and the calendar path is the poison:

- An active SoundSport director earns **~385 XP/week** today → **~8 weeks** to earn A Class by playing.
- The calendar timer grants A Class at **5 weeks for doing nothing.**
- Therefore the "slow way" is not slow — it is **dominated.** The clock always laps effort. XP, as an unlock path, is decorative.

This is why the player's instinct ("does auto-unlock negate earning it the slow way?") is correct. **It does — as currently built.**

### 1.2 It's worse than the numbers suggest, because the earn side is partly dead

Tracing "what actually levels a director up" (see `LIFELONG_GAMIFICATION_ROADMAP.md` appendix) found:

- **`awardXP` is invoked nowhere.** The two largest *intended* recurring XP sources — **weekly participation (200 XP)** and **league win (100 XP)** — never fire. The callable is defined and exported, but no client or scoring path calls it.
- **Predictions (15 XP + 10 CC/correct) exclude SoundSport entirely** — so a SoundSport director (the largest new-player cohort) is down a whole daily earner.
- **Two redundant daily check-ins** exist: `claimDailyLogin` (25 XP, automatic) and `dailyXPCheckIn`/`dailyRehearsal` (10 XP). Two rewards for the same "I showed up."

So the real working XP for an active SoundSport rookie is roughly: daily login (175/wk) + challenges (~140/wk) + occasional streak milestones. The intended *primary* earner — "compete in the weekly shows" — pays **zero**. The slow way is under-rewarded *and* the reward it advertises is broken.

---

## Part 2 — The design principle: separate **access** from **achievement**

The mistake baked into the current system is that the **class unlock is being used as the progression reward.** It shouldn't be. Progression psychology draws a hard line:

- **Content access** (which class you may field) must never sit behind a punishing grind — that reads as "walled out," not "motivated." Access should be reachable by anyone who plays.
- **Achievement** (the feeling players chase for years) must never be auto-granted — that reads as "cheated." Achievement lives in *status, mastery, records, and legacy.*

The current design collapses both into one binary boolean, so it satisfies neither: grinders feel the timer cheapens their effort, and casual players feel the XP wall shuts them out. **Splitting the two is the entire overhaul.**

- **Access → earned by _playing_,** reachable by everyone, skippable with CorpsCoin.
- **Achievement → horizontal, permanent, never auto-granted** (caption mastery, prestige tiers, records, the Director's Career from the roadmap).

The class unlock becomes an **early, celebrated milestone** (a graduation), not the goal. The goal is who you become after it.

---

## Part 3 — The reframe that resolves the contradiction

> **⚑ DECISION 1 — Change the unlock trigger from _calendar weeks_ to _seasons actively completed_.**
> Recommended: **Yes.** (Alternatives considered in §7.) — **✅ APPROVED by owner, July 2026.**

The single highest-leverage change. Replace "weeks since registration" with "seasons the director actually participated in and completed." This aligns with the owner's own framing ("classes unlock after seasons are completed") and makes the contradiction vanish, because **playing becomes earning:**

| Class | Earned by _playing_ | Earned _early_ (grinder) | _Skip_ |
| --- | --- | --- | --- |
| **A Class** | Complete **1** season | Reach **Level 3** before it ends | 1,000 CC |
| **Open Class** | Complete **2** seasons | Reach **Level 5** | 2,500 CC |
| **World Class** | Complete **3** seasons | Reach **Level 10** | 5,000 CC |

- **Casual player** earns each tier by *finishing a season* — they played it, they earned it. No wall.
- **Active grinder** unlocks *early* through XP, before the season ends — visible recognition for extra effort (and gets the celebration + a "did it the hard way" cosmetic; the season-completion grant does not).
- **Register-and-vanish** completes zero seasons → unlocks nothing. Correct.
- **Impatient newcomer** spends the welcome grant to skip straight to A Class. Their choice.

"Completed a season" = participated meaningfully (registered for and competed in shows across a season that then archives). The hook already exists: season archival runs, awards completion XP, and increments `lifetimeStats.totalSeasons`. We gate the unlock on that same event.

**Remove the pure calendar-week auto-unlock.** Optionally retain a *very distant, silent* catch-up floor (e.g., World after ~1 year of account age) purely as an anti-frustration backstop for irregular players — set so far out that active play always beats it, and granted without the "earned" fanfare. Everything active players do now out-earns the clock.

---

## Part 4 — The rebalanced earning table (the "slow way," made real)

> **⚑ DECISION 2 — Overhaul scope.**
> Recommended: **Fix bugs first (Phase A), then full rebalance (Phase B).** Restores an honest slow way in days; the redesign follows. (Full table below is the Phase B target.) — **✅ APPROVED by owner, July 2026.**

Design intent: **competing out-earns logging in.** The core act (fielding a corps and competing in shows) should be the biggest recurring earner, not passive check-ins.

| Source | Today | Proposed | Change |
| --- | --- | --- | --- |
| Daily login | 25 (auto) **+ 10** (2nd check-in) | **25**, consolidated | Merge the two check-ins into one |
| Daily challenge ×3 | ~20–30 | keep (~30) | — |
| Daily prediction (per correct) | 15 XP / 10 CC — **SoundSport excluded** | 15 XP / 10 CC **+ a SoundSport variant** | SS predicts rating tier / medal outcome |
| Compete in a show | — | **+25 XP/show** (≤4/wk → ≤100) | **NEW** — rewards the core act, scales with engagement |
| Weekly participation | 200 XP — **DEAD** | **150 XP**, wired | **FIX `awardXP`**; submit lineup + compete ≥1 show |
| Win a league matchup | 100 XP — **DEAD** | **100 XP**, wired | **FIX `awardXP`** |
| Streak milestones | 50–1,000 (3→100 days) | keep | — |
| Season completion | 200–500 by rank | **flat 200 + 200–500 rank** | Add a guaranteed "you finished" grant |
| First Season Journey | 425 one-time | keep | — |

**Resulting pace (active SoundSport director, ~600–700 XP/wk):**

- **A Class:** 3,000 XP → **~4–5 weeks of active play** (mid-rookie-season, celebrated) — *or* at season-1 completion for casuals. Both earned; the grinder simply got there first.
- **World Class:** 10,000 XP → **~15 weeks** of hard play (~3.5 months) — *or* season-3 completion (~7–8 months) for a steady casual. Matches the "months, not years" target in `GAMIFICATION_REDESIGN.md`, with room to breathe for a lifelong game.

All numbers are tuning knobs, not commitments — the point is the *shape*: earning clearly beats the floor, and the floor still catches everyone who plays.

---

## Part 5 — CorpsCoin's role (and the constraint we keep)

- **Keep the 1,000 CC welcome grant, and keep A Class priced at 1,000 CC** — a deliberate one-time autonomy on-ramp. It is now clearly the *pay-to-skip-the-earn* lane, sitting beside earn (seasons/XP) as a genuine choice, not the default.
- CorpsCoin's *earning* side is largely fine; its problem is **sinks**, handled in `ENGAGEMENT_ECONOMY_REVIEW.md`. The only progression-relevant change here: class-unlock-by-CC is reframed from "a redundant third path" into "the explicit skip lane," which stops it from undercutting the earn path (because earning now has real, faster-than-floor value).
- **CorpsCoin never buys a competitive edge** — unchanged, non-negotiable. It buys skips, identity, and status only.

---

## Part 6 — Progression-psychology checklist (why this will *feel* good)

Each best practice, and how the redesign satisfies it:

- **Effort must beat time** (equity theory / fairness): active play now unlocks before the floor; the clock no longer laps effort.
- **Play = earning** (autonomy + competence, SDT): every unlock is earned by someone who played, no punishing wall and no unearned gift.
- **Recognition asymmetry** (achievement): unlocking early grants a permanent "earned the hard way" mark the floor-grant never gets — same access, different status.
- **Goal-gradient & near-miss**: an XP-to-next-level bar (currently missing) plus "1 season / 340 XP to A Class" teasers pull the player toward a *visible* finish line.
- **Peak–End** (Kahneman): each unlock is a celebrated graduation moment, not a silent boolean flip.
- **Reward the core act, not the chore**: competing out-earns logging in, so the game trains the behavior it actually wants.
- **Legibility** (the player's literal request): one authoritative, in-game "How Progression Works" explainer, generated from the real constants so it can never drift from the code.
- **No dead ends** (the roadmap's horizontal endgame): once class unlocks are done (early game), caption mastery, prestige, and records carry the *earning* feeling forward for years — so the "slow way" never runs out of road.

---

## Part 7 — Alternatives considered for Decision 1

| Option | What it is | Why not (as primary) |
| --- | --- | --- |
| **B. Keep calendar timer + earned badges** | Timer still grants access (pushed further out); early XP-unlockers get a prestige badge the timer-grant lacks | Least disruptive, but keeps *unearned* grants in the system — a lapsed non-player still gets classes for free. Recognition asymmetry is good and is **folded into the recommended option anyway.** |
| **C. Decouple entirely** | Class access made cheap/generous up front; *all* earning moves to horizontal mastery/prestige | Cleanest long-term and where the endgame is heading — but it **removes the class-unlock goal the player explicitly said they wanted.** Better reached gradually via the roadmap than by fiat now. |

The recommended option (seasons-played + XP early-unlock + CC skip) captures B's recognition asymmetry and points toward C's horizontal endgame, without discarding the goal players are actively asking to chase.

---

## Part 8 — Implementation sequence

**Phase A — Repair the honest slow way (days, do first):**
1. Wire `awardXP` into the weekly scoring rollover — pay **weekly participation (150)** and **league-win (100)** XP, idempotently, once per participating class per week (reuse the `scoringRunGuard` pattern).
2. Consolidate the two daily check-ins into one 25-XP `claimDailyLogin`; retire `dailyXPCheckIn`.
3. Ship the single **"How Progression Works"** explainer (sources, level→class, the three paths), generated from the real constants. Add the missing **XP-to-next-level bar**.

**Phase B — The rebalance (the redesign):**
4. Switch class-unlock trigger to **seasons-completed** (+ retain XP early-unlock, remove the calendar timer, add the distant silent backstop).
5. Add **per-show XP** and the **flat season-completion grant**; retune amounts to the §4 table.
6. Add the **SoundSport prediction variant** (rating tier / medal) for daily-earner parity.
7. Make each class unlock a **graduation ceremony** (modal + confetti + "earned early" cosmetic for the XP path) — reuses the existing (currently under-triggered) celebration components.

**Phase C — Carry the feeling forward (the roadmap):**
8. Horizontal endgame — caption mastery, prestige tiers, records — so earning never ends (roadmap Steps 4 & 9).

Phase A alone restores a slow way that works and is honest. Phases B–C make it *feel* the way the player is asking for.
