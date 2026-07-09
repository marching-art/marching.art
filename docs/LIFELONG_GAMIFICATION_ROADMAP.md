# The Lifelong Game — A Unifying Gamification Roadmap

> Generated: July 2026
> Scope: a full audit of marching.art's gamification systems and a ten-step plan to connect them into one coherent, progressive, **lifelong** experience.
> Relationship to other docs: this is the **meta-layer** above the existing plans. `ENGAGEMENT_ECONOMY_REVIEW.md`, `LEAGUES_ENGAGEMENT_STRATEGY.md`, `GAMIFICATION_REDESIGN.md`, and `PRODUCT_ANALYSIS_UX.md` each fix one subsystem beautifully. None of them answers the question _"what is the single thing all of these are building toward, for the next ten years of a player's life?"_ This document does. It sequences and connects those plans rather than replacing them.

---

## Part 0 — The Art and the Science

Good gamification is not points, badges, and leaderboards (PBL). Those are the _visible exhaust_ of motivation systems, not the engine. The engine is a small set of well-studied principles, and marching.art can be measured against each:

| Lens (the "science") | What it says | marching.art today |
| --- | --- | --- |
| **Self-Determination Theory** (Deci & Ryan) — intrinsic motivation needs **competence, autonomy, relatedness** | People stay when they feel capable, in control, and connected | **Strong** competence (deep progression) and autonomy (lineup strategy). **Starved** relatedness (leagues are a dead zone). |
| **The compulsion loop / Hook model** (Eyal) — trigger → action → **variable** reward → investment | Habits form from cheap actions with variable payoff and accruing investment | The nightly 2:00 AM score drop is a _textbook_ variable-reward-on-a-fixed-schedule. Best asset in the game. |
| **Flow** (Csikszentmihalyi) — the skill/challenge channel must stay open | Boredom when too easy, anxiety when too hard, flow in between | Front-loaded: real challenge for ~19 weeks, then the channel **closes** — nothing new to master after World Class. |
| **Three horizons of engagement** — the moment, the session, the **lifetime** (micro / macro / meta) | A durable game rewards all three time scales | Strong **micro** (daily loops), decent **macro** (49-day season), **weak meta** (nothing meaningful accrues across years). |
| **Peak–End Rule** (Kahneman) | We remember an experience by its emotional peak and its ending | The season now _has_ an ending ceremony (recent work). The **career** has no peaks and no ending at all. |
| **Player-motivation diversity** (Bartle; Quantic Foundry) | Achievers, Socializers, Explorers, Collectors, Competitors want different things | Serves **Achievers/Competitors** well. **Socializers and Collectors** are barely served. |
| **The endowment effect & identity investment** | We over-value what we build and personalize | The uniform designer + AI corps avatars are a _fully built identity system_ — with no economy, legacy, or status attached to it. |
| **Games-as-a-Service** | A lifelong game is _operated_, not shipped | Rich systems, but no seasonal rotation, no live-ops cadence, no mint-vs-sink instrumentation. |

**The art** is deciding which of these to lean on, in what order, for _this_ game — a year-round, two-season fantasy simulation about an inherently legacy-obsessed culture (drum corps: the retirement of a jacket, the corps that folded in 1986, the championship dynasty). Drum corps is _already_ a game about legacy. The software should be too.

---

## Part 1 — The Diagnosis: a game of silos

The audit's headline finding matches your instinct exactly. **marching.art is not missing gamification — it is drowning in it.** There are roughly fifteen distinct, individually well-built reward systems:

- XP & leveling (flat 1,000/level, titles to Level 30 "Eternal")
- CorpsCoin (server-authoritative closed-loop currency + ledger)
- Login streaks (6 milestone tiers, purchasable freeze)
- Achievements (**three** separate implementations that disagree with each other)
- The First Season Journey (8-step onboarding quest)
- The Season Reward Ladder (12 tiers, the one truly repeating track)
- Daily Challenges (3 rotating micro-tasks)
- Daily Predictions (a predict-tonight / resolve-tomorrow loop)
- Class unlocks (obtainable **three** redundant ways: XP, waiting, or CorpsCoin)
- Leagues, weekly matchups, and auto-detected rivalries
- The all-time Records Book and dynasty trophy case
- Corps retirement / legacy gallery
- The cosmetic identity system (uniforms, AI avatars, titles, frames, card themes)
- The AI news engine
- A full re-engagement comms layer (email + push)

Every one of these works. The problem is that **they are parallel tracks that never touch.** Concretely, the audit found:

1. **No shared spine.** Achievements exist in three divergent forms (a server catalog of 33, a client tracker panel of ~17 that lists IDs the server never awards, and a trophy case built from a _different_ set of counters). A player's "record" has no single source of truth.
2. **Progression flattens hard.** Every content unlock is gone by Level 10 / week 19. Past that, XP is an odometer that unlocks nothing; there is not even an XP-to-next-level bar in the UI, and — critically — **the full-screen level-up celebration is dead code that never fires.** Leveling up, the most fundamental progression beat, is invisible.
3. **The biggest rewards are the least felt.** `claimDailyLogin` runs in the background and **the result is discarded** — daily XP, streak increments, and milestone bonuses happen with no toast, no animation, nothing. Achievements appear in a plain list with no "pop." The two richest celebration systems in the codebase are wired to nothing.
4. **The currency has nowhere to go.** ~50,000 CorpsCoin/year of income against a thin catalog of one-time cosmetics; the one gameplay sink (class unlocks) is undercut by the free waiting-path. For a veteran, CorpsCoin becomes "a score with no scoreboard."
5. **Relatedness is starved.** The game pulses nightly; leagues are silent between Sunday automations. Your weekly head-to-head happens in a database with no pre-game, no live tracking, no ceremony. The single strongest retention predictor in all of fantasy sports — being in an active social group — is the game's weakest zone.
6. **The player is never the protagonist.** The AI news engine is excellent and completely impersonal — global editorial identical for every user. In a game about _your_ corps, _your_ story is never told.
7. **Nothing accrues across the lifetime.** Records are recognition (a global scoreboard), not personal progression. Retirement is a static gallery. There is no growing, personal, decade-spanning artifact that says _"this is who I am as a director."_

That is the "unifying connection" you felt was missing. It is missing.

---

## Part 2 — The Unifying Spine: **The Director's Career**

One reframe connects all fifteen systems:

> **Stop treating marching.art as "a fantasy league you replay each season." Treat it as a decades-long career as a drum corps director, where each 49-day season is one chapter, and every system in the game writes into a single, permanent, ever-growing career.**

This is not new content. It is a _spine_ that the existing systems plug into. Everything the player does — every lineup, prediction, streak day, league win, trophy, retired corps — becomes a sentence in one long biography. The three engagement horizons become three concentric loops of that career, each mapped to the motivation it serves:

```
        ┌──────────────────────────────────────────────────────┐
        │  THE CAREER  (meta / lifetime)  — purpose & identity  │
        │   the permanent, ever-growing legacy. Never flattens. │
        │                                                       │
        │     ┌────────────────────────────────────────────┐   │
        │     │  THE SEASON  (macro / 49 days)             │   │
        │     │   autonomy · mastery · relatedness         │   │
        │     │   a chapter: goals → competition → ceremony│   │
        │     │                                            │   │
        │     │      ┌──────────────────────────────┐      │   │
        │     │      │  THE NIGHT  (micro / daily)  │      │   │
        │     │      │   competence · habit         │      │   │
        │     │      │   the 2 AM drop + daily loop │      │   │
        │     │      └──────────────────────────────┘      │   │
        │     └────────────────────────────────────────────┘   │
        └──────────────────────────────────────────────────────┘
```

The design test for every future feature becomes a single question: **"Does this feed the Career?"** A daily challenge that grants XP that vanishes into an odometer fails the test. A daily challenge that visibly advances your season ladder, which stamps a permanent line in your career biography at season's end, passes it. The ten steps below build this spine, foundation-first.

---

## Part 3 — The Ten-Step Plan

Each step names the **research principle** it serves, the **current state** from the audit, the **move**, and what it **connects**. They are ordered as a dependency-aware roadmap: integrity of the existing loop first, then depth, then breadth, then the lifetime layer, then live operation.

### Step 1 — Build the spine: one canonical Director Career record
**Principle:** coherent mental model; SDT _purpose_. A collection of systems becomes _a game_ when they share a source of truth.
**Current state:** three disagreeing achievement systems; a trophy case built from different counters than the scoring engine writes; XP, CC, streaks, and trophies stored and rendered as unrelated fields.
**The move:** define a single server-authoritative **Career** model on the profile that every system writes into and every surface reads from. Collapse the three achievement implementations into one catalog. Reconcile the stats-vs-trophies split. Give the profile page a true "Director Card" that renders _the one record_: level & title, career trophies, records held, mastery, retired corps, seasons played. This is plumbing, not new content — and it is the prerequisite for everything after it, because every later step needs one place to write to.
**Connects:** all of them. This is the literal connective tissue.

### Step 2 — Make every reward legible and _felt_
**Principle:** operant conditioning / "juice it or lose it." An unseen reward does not reinforce behavior; a felt one does.
**Current state:** `claimDailyLogin`'s result is discarded (silent daily login); `LevelUpCelebration` and the generic `Celebration` overlay are mounted but **never triggered**; achievements render as a plain list; the floating "+XP" feedback fires for only 2 of ~7 XP sources; there is no XP-to-next-level bar.
**The move:** wire the celebration code that already exists. Surface the daily-login payoff (streak flame animating up, "+25 XP", milestone bursts). Fire the full-screen level-up moment on actual level-ups. Give achievements a real "unlocked" pop. Add the missing XP-to-next-level progress bar. Route _all_ XP sources through the floating-feedback system. This is the highest leverage-to-effort ratio in the entire plan — the reward systems are built; they're just muted.
**Connects:** makes the daily loop (Night) and progression (Career) _visible_, which is the precondition for players valuing them.

### Step 3 — Unify the daily loop into one "Director's Report"
**Principle:** the Hook model + reduction of choice fatigue. A daily ritual beats a scavenger hunt across seven sidebar widgets.
**Current state:** login, streak, challenges, predictions, deadlines, and league events are excellent but scattered across the dashboard; the returning player has no single "here is today" surface.
**The move:** consolidate the daily beats into one coherent **Director's Report** — the first thing a returning director sees: last night's result and rank change, resolved predictions, today's challenges and picks, the next deadline countdown, and any league events, each explicitly showing how it advances the Season Ladder. One clear "what do I do next," every action visibly feeding the spine. (Retire the dismissible Morning Report modal per `GAMIFICATION_REDESIGN.md`; this replaces it with something that has a job.)
**Connects:** turns the Night loop into a single ritual that always points at the Season and Career.

### Step 4 — Give progression a spine that never flattens (the horizontal endgame)
**Principle:** the "elder game" / horizontal progression (WoW, Path of Exile, Destiny); keeping Flow's challenge channel open forever; serving Collectors and Explorers.
**Current state:** all vertical content is unlocked by Level 10 / week 19; nothing new to chase after. This is _the_ lifetime-play gap.
**The move:** add progression that grows sideways instead of just up:
- **Caption Mastery tracks** — cumulative lifetime performance per caption ("Brass Specialist III"), a strategic-identity track that rewards the game's actual skill (caption selection) and never caps. The data already lives in recaps.
- **A Collection / Codex** — every historical corps fielded, every caption mastered, every trophy type, every season theme. Collectors will chase 100% for years.
- **Prestige tiers** past the vertical ladder — the extended titles (Icon → Hall of Famer → Immortal → Eternal) already exist; give them a visible, celebrated, cosmetic-bearing prestige track.
**Connects:** this is the Career's engine — the reason a Level 30 director in year four still has something to build.

### Step 5 — Give CorpsCoin a lifelong job (the identity & prestige economy)
**Principle:** prestige-over-power; identity investment / the endowment effect. Drum-corps culture runs on uniforms, corps names, and legacy — not stat boosts.
**Current state:** faucet-heavy, thin sinks; the built uniform/avatar identity system has no economy attached; the class-unlock sink is redundant with the free waiting-path.
**The move:** execute `ENGAGEMENT_ECONOMY_REVIEW.md`'s catalog with the Career spine as the through-line — every purchase makes your legacy _visible to others_: the Corps Identity Shop (uniform tiers, emblems, card themes, celebration effects), recurring consumables, and — crucially for veterans — **prestige sinks** (show sponsorship, corps retirement ceremonies, Hall of Champions banners) priced to drain 20,000–50,000 CC hoards. Demote the class-unlock triple-path so it stops being the load-bearing sink. Keep the iron rule: **CorpsCoin never buys a competitive edge** — only identity, ceremony, and status.
**Connects:** the currency becomes the way you _author_ your visible Career.

### Step 6 — Turn leagues into the social heartbeat
**Principle:** SDT _relatedness_; social connection is the #1 retention predictor in fantasy sports.
**Current state:** the game pulses nightly; leagues are silent between Sunday automations; matchups are invisible; chat is structurally broken.
**The move:** the full `LEAGUES_ENGAGEMENT_STRATEGY.md` — a living League Feed that pipes game events in as system messages (never empty), the weekly matchup surfaced as a three-act **event**, and the flagship **League Prediction Pools** (escrowed, zero-sum CorpsCoin wagering on already-determined nightly outcomes) that give leagues their own nightly heartbeat _and_ become the recurring CC-circulation sink the economy needs. Cross-class normalized matchups so mixed friend-groups actually compete. Rivalry trophies that pass between rivals. And auto-place every new director into a populated rookie league on day one.
**Connects:** this is the single biggest retention lever, and it makes the Season a _shared_ chapter, not a solo grind.

### Step 7 — Make the director the protagonist
**Principle:** narrative transportation & identity; we invest in stories we are _in_.
**Current state:** the AI news engine is strong and entirely impersonal — the same global editorial for everyone; the user's own story is never told.
**The move:** point the existing narrative engine at the individual. Personalized season storylines ("Your corps has medaled three shows running"), rivalry narratives, a season-arc recap that casts _you_ as the subject, a career retrospective on retirement. The generation infrastructure exists; it just needs to be keyed to the player's own data.
**Connects:** narrative is the emotional glue of the Career — it turns a row of scores into _your biography_.

### Step 8 — Rebuild onboarding into a guided first _season_
**Principle:** scaffolded mastery / the Zone of Proximal Development; the "second-session problem"; graduated reveal of depth.
**Current state:** excellent at minute one, thin by day two; the First Season Journey helps but the game's real depth (trade windows, synergy, show registration cadence) is still discovered by accident; class unlocks are silent booleans; the "playable demo" is actually read-only; rules copy contradicts itself.
**The move:** extend the Journey into a staged, season-long questline that teaches one mechanic _at the moment it matters_; make each class unlock a **graduation ceremony** (the clearest "I'm getting somewhere" beat); make the demo genuinely playable and carry its lineup into signup; unify the rules vocabulary into one source (`PRODUCT_ANALYSIS_UX.md` Rec 3–4).
**Connects:** a new director's first chapter should _teach the Career_, not just the lineup builder.

### Step 9 — Build the legacy layer (the reason to play for a decade)
**Principle:** the finite-vs-infinite game / legacy; self-competition retains the 95% who will never be #1.
**Current state:** Records exist as a global scoreboard; the retirement gallery is static; there is no personal, growing, lifetime artifact.
**The move:** make legacy _personal and permanent_. Records with your name attached and a "you hold N records" line on your Director Card. **Dynasty meta-achievements** (back-to-back titles, a medal in all four classes, ten career top-10s). **Season report cards** at every archival ("you beat last season's best GE") — self-competition is what keeps veterans who've plateaued competitively. Living retirement _monuments_ (not a static list) that record each corps' full trophy history. The Hall of Champions as a shared, browsable history of the whole game.
**Connects:** this _is_ the Career made visible — the decade-spanning artifact that answers "who am I as a director."

### Step 10 — Operate it as a living service
**Principle:** Games-as-a-Service; data-driven balance. A lifelong game is never "done" — it is tended.
**Current state:** rich systems, no seasonal rotation, no live-ops rhythm, no mint-vs-sink instrumentation (though the `corpsCoinHistory` ledger already records every transaction with a type).
**The move:** run the 49-day season as the operating heartbeat. Rotate a seasonal cosmetic set and a **narrative theme tied to the tempo-named seasons** (adagio, allegro, andante…) so each chapter feels distinct. Recurring live events (historical One-Night Slates in the off-season). And a single admin dashboard reading the CC ledger — total minted vs. sunk per week — as the one instrument needed to keep the economy balanced for years. Expect to retune cosmetic prices about once per season; a closed-loop cosmetic economy is forgiving.
**Connects:** this keeps the Season fresh and the whole machine self-correcting across the lifetime — the difference between a game that ships and a game that lasts.

---

## Part 4 — Sequencing

The ten steps group into four phases. Each phase is independently shippable and leaves the game better than before.

| Phase | Steps | Theme | Why this order |
| --- | --- | --- | --- |
| **I — Integrity** | 1, 2, 3 | Make the existing loop coherent, honest, and felt | You cannot build a lifelong arc on systems that disagree with each other and rewards nobody sees. Cheapest work, highest trust return. Mostly wiring what already exists. |
| **II — Depth** | 4, 5 | Make progression and the economy last forever | Once the loop is legible, give it somewhere to _go_. Horizontal progression + a real economy are what convert "engaged for a season" into "engaged for years." |
| **III — Breadth** | 6, 7, 8 | Relatedness, story, and a guided on-ramp | With a durable core, widen it: the social heartbeat (biggest retention lever), personal narrative, and an onboarding that actually teaches the deep game. |
| **IV — The Lifetime** | 9, 10 | Legacy and live operation | The payoff layer — a growing personal legacy, run as a living seasonal service. This is the "lifetime of play" made real. |

A useful property: **Phase I is almost entirely activation of code that already exists** (dead celebration triggers, discarded login results, three-into-one achievement merge). It is the fastest way to make the game feel dramatically more cohesive, and it de-risks everything after it.

---

## Part 5 — What a ten-year player's arc looks like

The test of this plan is whether it describes a satisfying decade. It does:

- **Week 1 (The first Night):** guided into a rookie league and a caption-by-caption first lineup; wakes up to a felt score drop and a celebrated first XP.
- **Season 1 (The first Chapter):** the Journey teaches trade windows and synergy in-context; class graduations are celebrated; the season ends in a ceremony with a payout and a first line in the career biography.
- **Year 1 (finding an identity):** settles into a class, joins a real league with nightly prediction pools and a named rival, starts authoring a corps identity with earned CorpsCoin.
- **Years 2–4 (mastery & prestige):** vertical progression gives way to **horizontal** — caption mastery, the collection codex, prestige titles; the CorpsCoin hoard funds prestige status (a sponsored show, a retirement ceremony); competitive peak.
- **Years 5–10 (legacy):** may never be #1 again, and doesn't need to be — chasing personal records, dynasty achievements, beating last season's self, curating a Hall of Champions legacy and a gallery of retired corps. The Director Card is now a decade-deep biography. The seasonal live-ops rhythm keeps each new chapter feeling fresh.

At no point does the arc flatten into "the same season, again." Every year adds a permanent sentence to a story the player owns. **That is the lifelong experience — and it is built almost entirely from systems marching.art already has, given a spine to hang on.**
