# Dashboard Unification — From Card Hunt to Director's Report

> Generated: July 2026
> Scope: reorganize the dashboard so a returning director isn't hunting across a dozen scattered cards to find what to do — and so the tasks they find are worth doing.
> Companion to: `LIFELONG_GAMIFICATION_ROADMAP.md` Step 3 ("Unify the daily loop into one Director's Report"). This is that step's detailed spec.

---

## Part 1 — What's on the dashboard today

`src/pages/Dashboard.jsx` renders a sticky HUD plus a 2/3 + 1/3 grid — **14 distinct surfaces**:

**HUD (sticky, full width) — `ControlBar`:** class tabs · next-deadline countdown · streak flame · level pill · CorpsCoin wallet · Buy/Unlock-class button.

**Right column, top — `SeasonScorecard`:** score · rank · rank-change · corps name · show-concept · design-uniform · move/retire.

**Main column (2/3, left):**
1. `ActiveLineupTable` — the 8 caption picks; click a slot → caption selection
2. `LineupSimulatorPanel` — per-caption weak-spot analyzer + swap CTAs
3. `RecentResultsFeed` — recent scores/placements
4. `PredictionGamePanel` — daily predictions

**Sidebar (1/3, right):**
5. `JourneyPanel` — first-season quest (self-retires)
6. `DailyChallenges` — 3 rotating micro-tasks
7. `SeasonLadderPanel` — seasonal reward track
8. `NextPerformancePanel` — real show timing + "your picks on tour tonight" spotlight
9. `RivalsPanel` — closest competitors
10. `QuickStats` — rotating fun facts
11. `AchievementTrackerPanel` — next unlockable achievements
12. `Submit Article` — community content

---

## Part 2 — Why it feels like a hunt (the diagnosis)

The cards are all individually good. The problem is purely **arrangement and connection**:

1. **No organizing principle.** Cards are placed by DOM convenience, not by what job they do for the player. A daily task (`DailyChallenges`) sits in the sidebar; another daily task (`PredictionGamePanel`) sits in the main column. Same job, opposite corners.
2. **The daily loop is fragmented across four locations.** The things a player must *do today* — login streak (HUD), daily challenges (sidebar #6), predictions (main #4), journey step (sidebar #5) — are in four different places with four different visual treatments. There is no single "here's today" surface, so the returning user has to *assemble* their to-do list by scanning the whole page.
3. **Mobile buries everything that matters.** The grid collapses to one column with the main column stacked first, so a phone user scrolls past the entire lineup + analyzer + results + predictions before reaching challenges, journey, or ladder — and the scorecard (the most-glanced datum in a fantasy game) is pushed down too (confirmed in `MOBILE_UX_AUDIT.md`).
4. **Prime real estate goes to the lowest-value card.** `QuickStats` (auto-rotating "fun facts") occupies a full sidebar slot; meanwhile the daily tasks it sits among are the actual reason to return.
5. **Four cards do the same conceptual thing, competing instead of cohering.** `JourneyPanel`, `DailyChallenges`, `SeasonLadderPanel`, and `AchievementTrackerPanel` are all "a progress bar + a claim/goal." Presented as four separate widgets, they read as clutter rather than one progression system.
6. **Some "tasks" are busywork.** Several daily challenges ("visit the leaderboard," "view your profile") auto-complete on navigation with no verification — they're not decisions, they're clicks. A task with no agency has no value.

The core insight: **the dashboard is laid out by _component_, but a player experiences it by _intention_** ("what happened / what do I do / how am I doing"). Re-lay it out by intention.

---

## Part 3 — The fix: four intention-zones, one of them the unified daily loop

Group every surface by the **job it does**, ordered by the natural return-visit flow. Four zones, consistent placement so spatial memory forms:

### Zone A — HEADLINE · "How did I do?"
The payoff of last night's 2 AM drop leads the page, on every device.
- **`SeasonScorecard`** (score, rank, rank-change, identity) — stays, leads.
- Fold the single best `QuickStats` fact inline here (e.g., "Best finish: 3rd at Mankato"); **retire the rotating `QuickStats` widget.**
- Keep the deadline countdown adjacent (HUD or scorecard).

### Zone B — TODAY · "What do I do right now?" — **the unification**
**One consolidated "Director's Report" card** replacing the scatter. A single checklist with a `Today · 3 of 5 done` header, each row showing its reward *and its connection to the spine*:
- Daily login / streak — surfaced and celebrated (today it's silent; see roadmap Step 2)
- Daily challenges (made real — see Part 4)
- Daily prediction(s)
- Journey next step (while the questline is active)
- Any pending claim (a Season Ladder tier ready, an achievement just earned)

This one card is the whole anti-hunting fix: the player opens the dashboard and *sees their entire to-do list in one place*, already assembled, each item one tap from done.

### Zone C — MY CORPS · "Manage my team"
The core strategic work, grouped:
- **`ActiveLineupTable`** + **`LineupSimulatorPanel`** (build/tune) + **`NextPerformancePanel`** ("your picks are on tour tonight" — the most personalized element, belongs next to the lineup it references).

### Zone D — THE SEASON · "How am I advancing, and who am I chasing?"
- **A unified Progression readout** — `SeasonLadderPanel` + `AchievementTrackerPanel` + an XP-to-next-level bar, presented as one surface (tabs or a compact stack), so the four-progress-bars clutter becomes one coherent "Season Progress" hub.
- **Competition context** — `RivalsPanel` + `RecentResultsFeed` (who's near me, what just happened).

### Demote / cut
- **`QuickStats`** rotating widget → best fact folded into Zone A, widget removed (also fixes its known destructuring bug).
- **`Submit Article`** → move to a page footer or secondary location; it's not a daily action.
- **Dead exported panels** (`LineupPanel`, `SchedulePanel`, `StandingsPanel`, `TeamSwitcher`, `LeagueStatus`) → delete.
- **`AchievementTrackerPanel`'s divergent client list** → reconcile to the server catalog (roadmap Step 1) before it becomes the Zone-D progress hub.

Result: ~14 scattered surfaces become **4 labeled zones** with a single daily-action card at the top of the actionable area. The player learns the map once.

---

## Part 4 — Making the tasks more valuable

Consolidation fixes *hunting*. Value is a separate problem — a task in a tidy list is still worthless if it's "+10 XP into an odometer that stopped mattering at Level 10." Five moves raise task value:

1. **Connect every task to the spine.** Show the *destination*, not just the reward: not "+10 XP" but **"+10 XP → Season Ladder Tier 7 (2 away)"** or "→ Brass Mastery II." A task that visibly advances something the player cares about is worth doing; a task that feeds a void is not. (Depends on the Career spine, roadmap Step 1, and the season ladder that already exists.)
2. **Replace busywork with decisions.** Retire the zero-agency "visit page X" challenges. A valuable daily task requires a *choice*: "swap a caption the analyzer flagged below value," "lock in a show that closes tonight," "make today's prediction," "answer your league's pool line." Agency is what separates a task from a chore. (`PredictionGamePanel` already models this well — extend the pattern.)
3. **Give the daily loop a weekly arc.** A meta-goal — "complete your daily set 5 days this week → bonus CC + a Ladder boost" — turns disconnected daily pings into a week-long pursuit (goal-gradient + loss aversion). The streak system is the scaffolding; this layers a *reward* on top of it.
4. **Add social stakes to at least one daily task.** Route a daily pick into the **league prediction pool** (`LEAGUES_ENGAGEMENT_STRATEGY.md`): a task with leaguemates watching and CorpsCoin on the line is worth far more than a solo one. This is also the recurring CC sink the economy needs.
5. **Celebrate completion.** Finishing the daily set should *feel* like something — fire the celebration juice that's currently dead code (roadmap Step 2). An uncelebrated completion trains nothing.

The through-line: **a task is valuable when it (a) advances something permanent, (b) requires a decision, and (c) is seen by someone or celebrated.** Today most daily tasks have none of the three.

---

## Part 5 — Mobile ordering

Reorder the DOM (or use `order-*` utilities) so the single-column stack follows the intention flow: **A Headline → B Today → C My Corps → D The Season.** Today a phone user must scroll past the entire main column to reach the daily tasks; after this, the score and the to-do list are the first two things they see. This is the highest-impact mobile fix and it's pure layout.

---

## Part 6 — Sequencing

1. **Reorder into the four zones + fix mobile stack** — pure layout, no new logic, immediately kills the hunt. *(days)*
2. **Build the unified "Today / Director's Report" card** — compose the existing daily components into one checklist surface with spine-connection labels. *(≈1 week)*
3. **Merge the progression cards** into one Zone-D hub; retire `QuickStats`; delete dead panels; reconcile the achievement list. *(days)*
4. **Raise task value** — swap busywork challenges for decisions, add the weekly meta-goal, wire one daily task into the league pool, turn on completion juice. *(with roadmap Steps 1–2, 6)*

Steps 1 and 3 are cheap layout/cleanup wins available immediately. Step 2 is the centerpiece — the one card that answers "what do I do right now?" in a single glance. Step 4 is where the tasks stop being chores.
