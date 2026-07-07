# Leagues: The Clubhouse Strategy

> Generated: July 2026
> Scope: a plan to transform the `/leagues` zone from a dead side-piece into the game's daily social heartbeat — grounded in the systems that already exist in the code.
> Assumptions carried forward: **no real-money monetization**; **CorpsCoin never buys scores or competitive edges** (enforced in `scoring.js` — competitive score comes only from historical/scraped data). Everything here is zero-sum CorpsCoin among members, wagered on outcomes that are _already determined_ by the game's data.

---

## Part 1 — Why the leagues are dead (the diagnosis from the code)

The leagues aren't dead because they lack features. They're dead because of four structural gaps:

### 1.1 The game has a heartbeat; leagues don't

The core game pulses **every single night**: the scraper runs 01:30 ET (live season), scoring runs 02:00 ET, and every director wakes up to a new score, a new rank, and resolved predictions. That nightly drop is the whole reason the core game is "amazing."

Leagues have **no heartbeat of their own**. Everything that happens in a league happens _silently and automatically_:

- Matchups auto-generate Sunday 11:59 PM ET (`generateWeeklyMatchups`)
- Recaps auto-generate Sunday 10 PM ET (`generateWeeklyRecaps`)
- Rivalries recompute Monday 6 AM ET (`updateLeagueRivalries`)

A director has **no reason to open their league on a Tuesday**. The core game rewards daily return; the league rewards nothing between Sunday automations. This is the single biggest cause of the "dead zone" feeling.

### 1.2 The stakes are invisible

Your weekly head-to-head matchup _is_ happening — but you don't know who you're playing until you dig into a tab, there's no pre-game moment, no live tracking as tonight's scores drop, and the result appears with no ceremony. A matchup you never noticed can't create rivalry, tension, or a reason to talk trash.

### 1.3 Matchups only pit same-class against same-class

`smartPairMembers` pairs directors **within their corps class** (World vs World, SoundSport vs SoundSport). So a league of eight friends where three play World, three play Open, and two play SoundSport produces three separate little bubbles that never actually compete against each other. The "friends in a league together" fantasy quietly doesn't happen.

### 1.4 The social glue never sets, because chat is broken

This is a genuine structural bug, not a polish issue:

- `ChatTab.jsx` is **display-only** — it renders bubbles but has no input.
- The composer (`SmackTalkInput`) is pinned as a **fixed bottom bar across _every_ tab** (Standings, Matchups, Activity, Chat) in `LeagueDetailView.jsx:709-712`. A member reading Standings can type a message, hit send, get a "Sent!" toast — and never see it appear, because the messages live in a tab they aren't looking at.
- No optimistic append (messages only show after the Firestore round-trip), a success toast fires on _every_ message, it's capped at the newest 50 with no load-more, and the empty state ("No messages yet") greets every new league with a cold, silent room.

A clubhouse whose conversation is this hard to have will never become a clubhouse.

---

## Part 2 — The thesis: leagues are the clubhouse, and the clubhouse needs stakes

Reframing leagues as _"a clubhouse for drum corps fans who also love the fantasy system"_ is exactly right, and it implies a design mandate. A clubhouse is sticky when it has:

- **A reason to show up daily** — even when your own corps is passive.
- **Stakes shared with specific people** — something to win _from your friends_, and lose to them.
- **Rituals and events** — recurring moments the whole group experiences together.
- **Visible identity and legacy** — status your leaguemates can see and you can show off.

Three pillars follow. Every recommendation below maps to one of them:

| Pillar       | The gap it closes                                     | The daily hook it creates                 |
| ------------ | ----------------------------------------------------- | ----------------------------------------- |
| **STAKES**   | Nothing to win from each other between scoring nights | "The pool locks at 8 — get your picks in" |
| **EVENTS**   | Silent automation nobody notices                      | "You vs your rival, tonight, World Class" |
| **IDENTITY** | No visible status or legacy inside the league         | "You took the rivalry trophy back"        |

The unifying insight: **sync the league to the game's nightly heartbeat.** The game already resolves outcomes every night at 2 AM. If the league gives members something to _predict, wager, and settle_ on that same cadence, the league inherits the game's pulse instead of sitting silent beside it.

And critically — this reinforces the economy plan in `ENGAGEMENT_ECONOMY_REVIEW.md`. That review's central finding is that CorpsCoin is "all faucet, no drain": abundant income, almost nothing to spend it on, no _recurring_ sink. League wagering is precisely the recurring, zero-sum **CC circulation engine** the economy is missing — coins move between members every night without minting or inflation. Leagues become the place CorpsCoin finally _matters_.

---

## Part 3 — The flagship: League Prediction Pools ("The Book")

**This is the highest-leverage build in the entire plan, because it's ~90% already in the code.**

The solo prediction system already exists: `submitPrediction` / `resolvePredictions` in `dailyOps.js` let a director predict real outcomes and get resolved nightly against the same scraped/regressed scores the scoring engine computes, paying XP + CC. Today it's a lonely dashboard widget. Turn it into the league's beating heart.

### How it works

1. **Each competition night, every league gets a slate of "lines"** drawn from the actual upcoming shows on the schedule:
   - "Who posts the highest World Class score tonight?"
   - "Over/under 87.5 on tonight's top box?"
   - "Head-to-head: does **@leaguemateA**'s corps outscore **@leaguemateB**'s tonight?" (uses their real lineups)
   - "Which of tonight's shows produces the biggest upset?"
2. **Members stake CorpsCoin from their balance into a shared, escrowed pool** — reusing the exact escrow-and-payout pattern that league entry fees already use (`leagueEconomy.js` → `season.js` payout).
3. **Picks lock at 8 PM ET** — the same moment lineups lock — so the league's deadline rides the game's existing deadline.
4. **Resolution at 2 AM** against the scores the engine _already_ computes. Pari-mutuel payout: the pool is split among correct predictors in proportion to their stake. No house, no minting, purely zero-sum.
5. **Wake up to the settle.** The league feed shows who won the pool overnight — a reason to open the league every single morning, perfectly synced to the score drop everyone already checks.

### Why it's provably safe

- It **cannot touch anyone's score.** Members predict outcomes that are already determined by historical/scraped data. This is the same integrity firewall the code already enforces — prediction is downstream of scoring, never upstream.
- It **can't inflate the economy.** Every coin paid out was staked by a member; the pool is a closed zero-sum transfer, identical in principle to the entry-fee → prize-pool loop already shipping.
- The `ENGAGEMENT_ECONOMY_REVIEW.md` catalog already lists "friendly matchup side-wagers, escrowed and capped" as a sanctioned (if deferred) sink — this is that idea, made central.

### The second scoreboard

Track a season-long **"Sharpest Director"** standing per league — cumulative prediction accuracy, separate from the fantasy standing. This is subtle but important: it gives a _second way to win a league._ A director whose corps is stuck in 6th can still be the league's sharpest handicapper and have something to chase and brag about. More winners = more retention.

---

## Part 4 — Make head-to-head matchups matter (pillar: EVENTS)

The matchup engine is solid; it's just invisible. Turn each weekly matchup from a silent database write into a surfaced, three-act event.

### 4.1 The matchup as an event, not a record

- **Pre-game:** when matchups post, fire a notification + a league-feed card: "🔴 This week: **You** vs **@rival** — World Class." (The push/notification infra already exists — `pushNotifications`, `emailNotifications`.)
- **Live:** a "Tonight's Tracker" showing both directors' registered shows as they score in the nightly drop, so a matchup is something you _watch resolve_ over the week rather than discover after the fact.
- **Post-game:** an auto-generated recap card posted to the feed — final margin, the MVP caption that swung it, the closest section. The recap data already exists (`generateWeeklyRecaps` computes biggest upset / closest match / top scorer).

### 4.2 Cross-class matchups, so a mixed league actually competes

Add an optional league mode that matches directors **across classes on a normalized metric** — e.g. percentile-within-class, or score-as-a-fraction-of-class-cap — so a SoundSport player and a World player can have a head-to-head that's genuinely fair and meaningful. This directly fixes gap 1.3: it lets a league of friends in different classes actually play _against each other_, which is the whole reason they formed a league. Commissioner toggles it; `smartPairMembers` gains a "normalized" pairing strategy alongside the existing same-class one.

### 4.3 Rivalries with real stakes

Rivalries are already detected (`detectRivalries` → `meta/rivalries`) but they're passive labels. Make them combustible:

- A **rivalry trophy** that physically passes between two rivals each time one beats the other — visible on both profiles and in the league.
- A standing **rivalry side-bet**: two rivals escrow CC on their next head-to-head (opt-in, symmetric, capped — same escrow pattern).
- A **season-series card** (H2H record, biggest blowout, current holder) shown whenever they're matched.

---

## Part 5 — Alternate games inside a league (pillars: STAKES + variety)

Commissioner-launchable side formats, each reusing the corps pool and the nightly scoring engine. These give a league _things to do together_ beyond the one auto-matchup — and they're the literal answer to "alternate fantasy corps games within each league."

| Format                               | How it works                                                                                                                                                                                   | Why it fits                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Survivor / Eliminator**            | Each week, pick one corps you think finishes top-3. Can't reuse a corps. Wrong pick = eliminated. Last director standing takes a CC pot.                                                       | Pure read of existing nightly scores; creates a weeks-long tension arc with escalating stakes.                                                                                      |
| **One-Night Slate ("Draft & Dash")** | A self-contained mini-contest on **historical** corps: everyone drafts a fresh 8-caption lineup under a special cap for a single historical show night, scored _instantly_ against known data. | The killer off-season format — resolves immediately (no waiting for a season), playable start-to-finish in one sitting inside the league. Reuses the entire lineup + scoring stack. |
| **Confidence Pick'em**               | Rank tonight's shows by predicted winner, confidence-weighted.                                                                                                                                 | The weekly-cadence cousin of the nightly prediction pool.                                                                                                                           |
| **Playoff Bracket**                  | End-of-season single-elimination H2H bracket, seeded by standings, each round a CC-stakes event.                                                                                               | Gives the season a climactic finish inside the league — mirrors the game's own Finals arc.                                                                                          |

Start with **One-Night Slate** and **Survivor**: the first is the strongest off-season engagement filler (instant resolution), the second is the strongest in-season narrative engine (elimination tension), and both are thin layers over systems that already exist.

---

## Part 6 — Fix the chat: merge it into a living "League Feed" (pillar: IDENTITY / social glue)

Don't just patch the composer bug — reconceive chat as the clubhouse's living room by **merging the Chat and Activity tabs into one interleaved feed** (the Slack/Discord model), then fixing the mechanics.

### 6.1 The structural fixes (the bug)

- Put the composer **inside** the feed (or only render the bottom bar when the feed is the active view). Input and conversation must be co-located.
- **Optimistic append** — show the member's message instantly; drop the per-message "Sent!" toast.
- **Pagination / load-more** beyond the newest 50.
- Typing indicator, `@mentions` of leaguemates, and message **reactions** (reactions are already stubbed in the roadmap — cheap to finish and huge for low-effort engagement).

### 6.2 The idea that kills the cold-start problem

**Pipe game events into the same feed as system messages**, interleaved with human chat:

- "⚔️ Matchups posted for Week 5 — you drew **@rival**"
- "💰 **@user** won last night's prediction pool (+340 CC)"
- "📈 Scores dropped — **@user** climbed to #1"
- "🏆 **@user** took the rivalry trophy back from **@rival**"

This is the payoff of Part 2's "sync to the heartbeat" thesis: because the game generates events every night, the feed is **never empty.** New leagues don't open to a dead "No messages yet" screen — they open to a live stream of what's happening, which is exactly what invites the first human reply. The system messages _are_ the trash-talk prompts.

---

## Part 7 — Get everyone into a league on day one

Social connection is the strongest retention predictor in fantasy sports, and today league discovery is entirely pull-based (a new director has to go find one). The `joinRookieLeague` auto-provisioning system already exists — extend it so **every new director lands in a populated league during onboarding**, and surface league state where they already look:

- Dashboard widgets: "Your matchup tonight," "Prediction pool locks in 3h," "You slipped to #2 in your league."
- A league line in the nightly re-engagement emails/pushes that already fire.

A director who is _in_ an active league on day two is a director who comes back on day three.

---

## Part 8 — Guardrails (state these explicitly and build to them)

1. **CorpsCoin never buys a competitive edge.** All wagering is on already-determined outcomes; all pools are zero-sum among members. This is the same firewall the scoring code already enforces and the same closed-loop the entry-fee system already runs — no new principle, just a wider application.
2. **No minting, always escrowed, always capped.** Reuse `leagueEconomy.js` escrow. Cap stakes (the entry-fee cap `MAX_LEAGUE_ENTRY_FEE = 5000` is a natural anchor) so no one can be pressured into a ruinous bet.
3. **Moderation is a real cost, not an afterthought.** Peer wagering + trash talk needs report, mute, and commissioner tools. Budget for it before launch, not after the first incident.
4. **Everything must work in the off-season.** The off-season also scores nightly (historical regression), so prediction pools, matchups, and One-Night Slates all function year-round — but test them against off-season data explicitly, since that's ~7 months of the calendar.
5. **Idempotent settlement.** Nightly pool resolution must use the same `scoringRunGuard` idempotency pattern the scoring engine already uses, so a retried cron can never double-pay a pool.

---

## Part 9 — Suggested sequencing

Ordered so each phase ships independently and the cheap, foundational wins come first. Effort estimates assume the existing infra noted in each row.

| Phase | Work                                                                                                                       | Reuses                                                                      | Effort  | Payoff                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| **1** | **Fix the chat → League Feed:** co-locate composer, optimistic send, load-more, and pipe game events in as system messages | `subscribeToChat`, `activity` subcollection, `createLeagueActivity`         | ~1 wk   | The zone stops feeling dead; the feed is never empty   |
| **2** | **Matchup as Event:** surfacing + notification, tonight's tracker, matchup-attached trash-talk thread, auto-recap card     | `generateWeeklyMatchups`, `generateWeeklyRecaps`, push infra                | ~2 wk   | Weekly matchups finally get noticed and talked about   |
| **3** | **League Prediction Pools (flagship):** nightly slate, escrowed CC, pari-mutuel settle, Sharpest-Director standing         | `submitPrediction`/`resolvePredictions`, scoring resolution, escrow pattern | ~2–3 wk | The daily heartbeat leagues have always lacked         |
| **4** | **Rivalry stakes** (trophy + side-bets) + **cross-class normalized matchup mode**                                          | `detectRivalries`, `smartPairMembers`                                       | ~2 wk   | Mixed-class leagues compete; rivalries get combustible |
| **5** | **Alternate formats:** One-Night Slate + Survivor, then Pick'em + Playoff Bracket                                          | lineup + scoring stack, corps pool                                          | ongoing | Reasons to gather beyond the auto-matchup, year-round  |

Stopping after any phase leaves the leagues meaningfully more alive than before. Phase 1 alone — the chat/feed fix — is the single highest ratio of impact to effort in the whole plan.

---

## Appendix — Key files by feature area

**Chat / Feed (Phase 1):** `src/components/Leagues/tabs/ChatTab.jsx` (display), `src/components/Leagues/LeagueDetailViewParts.jsx` (`SmackTalkInput`), `src/components/Leagues/LeagueDetailView.jsx:332-336, 687-712` (subscription + mounting), `src/components/Leagues/tabs/ActivityTab.jsx` (to merge), `src/api/leagues.ts:247-296`, `functions/src/callable/leagues.js:770-802` (`postLeagueMessage`), `functions/src/helpers/leagueHelpers.js` (`createLeagueActivity`).

**Matchups (Phase 2 & 4):** `functions/src/scheduled/leagueAutomation.js` (`generateWeeklyMatchups`, `generateWeeklyRecaps`, `updateLeagueRivalries`), `functions/src/callable/leagues.js` (`generateMatchups`, `updateMatchupResults`, `updateStandings`), `functions/src/helpers/leagueHelpers.js` (`smartPairMembers`), `src/components/Leagues/tabs/MatchupsTab.jsx`, `src/components/Leagues/MatchupDetailView.jsx`, `src/hooks/useLeagueNotifications.ts` (rivalries).

**Prediction Pools (Phase 3):** `functions/src/callable/dailyOps.js` (`submitPrediction`, `resolvePredictions`), `functions/src/helpers/scoring.js` + `scoringAwards.js` (nightly resolution), `functions/src/helpers/leagueEconomy.js` (escrow), `functions/src/callable/economy.js` (`corpsCoinHistory` ledger, `TRANSACTION_TYPES`), `scoringRunGuard` (idempotency).

**Economy context:** `docs/ENGAGEMENT_ECONOMY_REVIEW.md` (the CorpsCoin/XP plan this reinforces), `functions/src/callable/economy.js`, `functions/src/helpers/shopCatalog.js`.

**Onboarding leagues (Phase 7):** `functions/src/callable/rookieLeague.js` (`joinRookieLeague`), `functions/src/callable/journey.js`, `src/components/Dashboard/sections/LeagueStatus.jsx`.
</content>
</invoke>
