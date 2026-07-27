# Caption Wars — league format specification

**Status:** built, all four phases (§10). This document is now the reference for
_why_ it works the way it does; the code is the reference for what it does.
Where they disagree, the code is right and this file is stale.

Landed as: `48c2e80` (resolution), `609805a` (standings), `95e5073` (the
unlock), `f8b738b` (surfaces).

Two things ended up different from the design below, both noted in place:
§4.3's undecided-category rule needed one more row than first drafted, and §8's
Record Book work turned up a live bug in the existing blowout/closest-call
records — they named whoever scored more as the winner, which under this format
is not always who won.

An alternate way for a league to decide its weekly matchups. Instead of one
comparison of the week's total score, a matchup is decided as a **best-of-three
across the three caption groups the game already records** — General Effect,
Visual, Music. Win two of the three and you win the week, whatever the totals
say.

Everything else about the league is unchanged. This is a scoring format, not a
new game mode.

---

## 1. The constraints this design is built around

Four things were fixed before the design started. They are not open questions,
and every decision below is downstream of them.

**Nobody's lineup changes.** Directors pick the same eight captions in the same
game they always did. A league that turns Caption Wars on does not ask its
members to build a different corps, or to sacrifice a caption to a league
gimmick. _"Directors will avoid being in a league if that means they can't pick
their ideal lineup in the actual game. Leagues are just a side hustle."_ A format
that leaks into lineup construction is a worse format no matter how good it
reads on paper.

**No sub-caption scores, ever.** The eight individual captions (GE1, GE2, VP,
VA, CG, B, MA, P) are never persisted per-show and never exposed. Publishing
them would let an opponent read a director's lineup off the recap — _"like
playing poker with your cards face up on the table."_ This is a
competitive-secrecy invariant, not a storage-cost decision, and it is the reason
the format is three categories rather than eight. See §7.

**A caption is never drawn.** A tied category resolves to the higher weekly
total. Only the pathological case where the totals are tied too leaves a
category undecided (§4.3).

**Category record outranks the normalized score in standings** — the tiebreaker
order in §5.

---

## 2. Why three categories, and why this ships without touching scoring

`helpers/scoring.js scoreCorpsAtShow` already folds the eight captions into
exactly three groups and persists all three on every show result:

```js
if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
...
const visualScore = rawVisualScore / 2;
const musicScore = rawMusicScore / 2;
const totalShowScore = Math.min(100, geScore + visualScore + musicScore);
...
showResult.results.push({ uid, ..., totalScore: totalShowScore, geScore, visualScore, musicScore });
```

Ranges per show: GE 0–40, Visual 0–30, Music 0–30. These are the real DCI
caption groups, they are already in `fantasy_recaps/{seasonUid}/days/{d}`, and
they are already what `MatchupDetailView` renders in its breakdown.

So Caption Wars needs **no change to scoring, no change to the recap document
shape, and no backfill**. It is a different reading of numbers that have been
written since the game launched. Any format that needed new per-caption
persistence would collide head-on with the secrecy constraint; this one does
not touch it.

The three groups are also unequal in weight by design — GE is 40 points against
30 and 30 — which is exactly the DCI ratio and exactly why a best-of-three
produces upsets. A director who wins GE by twelve and loses Visual and Music by
a point each loses the week under Caption Wars and wins it comfortably under
totals. That divergence is the entire product.

---

## 3. Data model

### 3.1 The format flag

```
leagues/{leagueId}
  settings.scoringFormat: "total" | "captionWars"    // absent === "total"
  settings.scoringFormatSeasonUid: string | null     // the season it was paid for
```

**Migration note.** `settings.scoringFormat` was written by `createLeague` and
read by nothing; commit `5475b66` deleted it as dead weight. Re-adding a field
that was just removed needs to be deliberate, so: the old field was a value with
no implementation, this one is a value with an implementation and a paid unlock
behind it. Any league document still carrying a stale `scoringFormat` from
before `5475b66` must be treated as `"total"` unless
`scoringFormatSeasonUid === ` the live season — which no legacy document has.
That check is what makes the resurrection safe, and it is the reason the season
uid is stored alongside the format rather than the format standing alone.

### 3.2 The matchup document

`matchups/week-N` gains one block per matchup, beside the existing `scores`,
`shows`, and `normalized`:

```js
{
  pair: [uid1, uid2],
  scores:     { [uid1]: 178.2, [uid2]: 176.9 },   // unchanged — weekly totals
  shows:      { [uid1]: 2, [uid2]: 2 },           // unchanged
  normalized: { [uid1]: 88.0, [uid2]: 74.5 },     // unchanged
  captions: {                                      // NEW, only when the format is on
    ge:     { scores: { [uid1]: 76.1, [uid2]: 78.4 }, winner: uid2 },
    visual: { scores: { [uid1]: 51.4, [uid2]: 49.9 }, winner: uid1 },
    music:  { scores: { [uid1]: 50.7, [uid2]: 48.6 }, winner: uid1 },
    tally:  { [uid1]: 2, [uid2]: 1 },
  },
  winner: uid1,                                    // unchanged shape: uid | "tie"
  completed: true,
}
```

`winner` stays a single uid or the string `"tie"`. That one fact is what keeps
the blast radius at zero: `foldPairsIntoStandings`, `compareStandingRows`,
`rebuildStandingsFromMatchups`, `selectLeagueChampion`, the Finals bracket, the
Hall of Champions, the weekly-win CC payout, and `detectRivalries` all read
`winner` and `scores` and none of them need to know the format exists.

`scores` continues to hold the weekly **total**, not a caption sum, so
`pointsFor` / `pointsAgainst` / `normalized` / the Record Book's blowout and
closest-call lines all keep meaning the same thing across both formats. A league
that switches formats between seasons still has a coherent record book.

### 3.3 Standings

`EMPTY_RECORD` gains two counters:

```js
captionsWon: 0,     // total categories taken, across all completed matchups
captionsLost: 0,
```

Only written when the format is on; zero everywhere else, and zero sorts
harmlessly (§5).

---

## 4. The algorithm

### 4.1 Weekly caption index

`helpers/leagueScoring.js buildWeeklyScoreIndex` currently accumulates
`entry.score += result.totalScore`. It gains three parallel accumulators from
the same loop over the same documents — one extra pass over nothing, no extra
reads:

```js
entry.score += Number(result.totalScore) || 0;
entry.ge += Number(result.geScore) || 0;
entry.visual += Number(result.visualScore) || 0;
entry.music += Number(result.musicScore) || 0;
entry.shows += 1;
```

Summing across the week matches how `score` already works: two shows count
twice, in every category equally. A director who competed more has more of
everything, which is the same incentive the current format has and the same one
the game wants.

`getWeekScore`'s zero default gains `ge: 0, visual: 0, music: 0` — a director
who sat the week out forfeits every category, which is what forfeiting a week
should mean.

`applyClassPercentiles` is untouched. Percentiles remain a function of the
total, because their job is cross-class comparability in standings and that job
has not changed.

### 4.2 Resolving a matchup

In `processWeeklyMatchups`, when the league's format is Caption Wars:

```
for each of [ge, visual, music]:
    a = p1_week[cat], b = p2_week[cat]
    if a > b   → category to p1
    if b > a   → category to p2
    if a === b → category to whoever has the higher WEEKLY TOTAL
                 if the totals are equal too → category undecided ("tie")

tally = categories held
winner = the uid with the higher tally
         equal tallies → "tie"
```

Best-of-three, so the live outcomes are 3-0, 2-1, and — only through the
undecided path — 1-1-with-one-undecided or 0-0-0.

Everything downstream of `winner` is byte-identical to today: the record
increment, the award tokens, the 100 CC weekly-win bonus, the `leagueWins`
stat, the standings pair, the activity event.

### 4.3 Every edge case

| Situation                                            | Result                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Neither director competed                            | all three categories 0-0, totals 0-0, all three undecided, tally 0-0 → **`"tie"`** — same as today's 0-0 |
| One competed, one did not                            | competitor takes all three → **3-0**                                                                     |
| A category ties, totals differ                       | category to the higher total — **never a drawn category**                                                |
| A category ties, totals tie as well                  | that category is undecided; the other two still decide the week                                          |
| Bye (`isBye`)                                        | untouched — no `captions` block, folds into standings exactly as now                                     |
| No recap days exist for the week (`daysFound === 0`) | untouched — matchups stay unresolved rather than recording a week of ties, exactly as now                |
| Commissioner override (`overrideMatchupResult`)      | sets `winner` directly and leaves `captions` in place, flagged `overridden` as it is now                 |

The "one director sat out" case deserves a note: under totals it is a forfeit,
and under Caption Wars it is a 3-0 sweep. The sweep is _more_ punishing in the
Record Book (§8) than the forfeit is today, which is the correct direction —
showing up should beat not showing up, loudly.

### 4.4 What happens mid-season if the format changes

It cannot. See §6.

---

## 5. Standings

The comparator gains one term, in the position the product decision put it:

```
win% → wins → CATEGORY RECORD → normalized → pointsFor → pointsAgainst → uid
```

Category record is `captionsWon - captionsLost`. Two directors at 4-2 are
separated first by how they got there: 12 categories to 6 is a more dominant
4-2 than 7 to 11, and a director who keeps losing 2-1 while winning 3-0 has been
better than their record. Placing it above `normalized` means a league running
Caption Wars is seeded for the Finals on the format it actually played, and only
falls back to the cross-class percentile when two directors' category records
are identical too.

In a `"total"` league both counters are 0 for everyone, the term is a constant,
and the comparator behaves exactly as it does today. The same comparator serves
both formats and there is no branch.

---

## 6. Unlocking the format — the CorpsCoin question

**Recommendation: yes to opt-in, yes to CorpsCoin, but as a per-season
league-level unlock the commissioner buys — never a per-member charge.**

The reasoning, since this is the part that can go wrong:

**Per-member pricing is out.** A format is a property of a matchup, so both
sides must be playing the same one; a member who declines to pay cannot be given
a different format, only excluded. That is pay-to-play in a competitive league,
and it is a genuinely bad look on a feature whose whole pitch is that leagues
are a friendly side hustle. It also collides with the entry-fee escrow: members
already paid a fee that was advertised when they joined, which is exactly why
`buildLeagueSettingsUpdate` refuses to let `entryFee` be edited at all. Adding a
second, later charge to be allowed to keep playing breaks the same promise from
a different direction.

**Commissioner-paid, from their own balance, is in.** It is symmetric — the
format changes how _everyone's_ matchup is scored, identically, so no CC buys
anybody an advantage. Commissioners are the most engaged accounts and carry the
biggest balances, which is precisely the pile you said needs a drain. And it
gives the commissioner role something to spend on, which it currently has
nothing of.

**Per season, not permanent.** This is the part that answers _"keep that
currency flowing."_ A one-time unlock drains a balance once and then the sink is
gone forever. A per-season unlock is a recurring sink that scales with how long
the league lasts — a five-season league pays five times. It also forces a small
annual decision that keeps the format from being something a league drifted into
in 2024 and forgot about.

**Price: 2,000 CC per season.** Grounded in the existing economy: show
participation pays 50–200 CC, a weekly league win pays 100, season finish
bonuses run 250–1,000, and the World Class unlock is 5,000. Two thousand is a
real commitment — roughly a season's participation earnings for a mid-tier
director — without approaching the biggest purchase in the game. It comes out of
the commissioner's balance and does **not** touch `prizePool`; the pool is
escrow for members' entry fees and must not be spendable by the commissioner for
any reason.

**Refunds: none, and say so in the dialog.** A refundable format toggle is an
invitation to churn the setting.

### 6.1 The lock

A new callable, `setLeagueScoringFormat({ leagueId, format })`:

1. Commissioner only (`isLeagueCommissioner`).
2. **Preseason only.** Rejected if any `matchups/week-N` document exists for the
   live `seasonUid`. Switching format mid-season would mix two formats inside
   one standings table and make `rebuildStandingsFromMatchups` produce a number
   that never existed. This is a hard `failed-precondition`, not a warning.
3. Charges 2,000 CC in the same transaction that writes the setting, with a
   `TRANSACTION_TYPES.LEAGUE_FORMAT` coin-history entry. Insufficient balance is
   a `failed-precondition` and nothing is written.
4. Writes `settings.scoringFormat` and `settings.scoringFormatSeasonUid` together.
5. Logs a `settings_changed` activity event, because members are entitled to know
   the rules of their league changed before the season starts.

Turning the format **off** is free and allowed in preseason. No refund.

### 6.2 Rollover

`helpers/leagueSeasonReset.js` is the one place that decides what a league
carries between seasons. Caption Wars is explicitly **not carried**:
`scoringFormat` resets to `"total"` and `scoringFormatSeasonUid` clears. A
commissioner who wants it again buys it again — that is what makes it a
recurring sink rather than a one-time one, and it is the behavior that has to be
stated in the purchase dialog in plain words: _"For this season. It does not
renew."_

Resolution reads the format as `settings.scoringFormat === "captionWars" &&
settings.scoringFormatSeasonUid === seasonData.seasonUid`. Both conditions, every
time. A league whose season uid does not match is resolved on totals, which
means a rollover bug can only ever fail _back to the default format_ — never
into a paid one nobody bought.

---

## 7. The secrecy invariant

Three categories is the maximum resolution this format can have, permanently.

The eight sub-captions are not persisted per show and must not become
persisted per show for this feature or any feature downstream of it. GE1 alone,
published weekly, is a readable signal about which corps-year a director is
running in GE; all eight published together is the lineup. The three groups
aggregate 2, 3, and 3 captions respectively, which is enough blending that a
weekly group total does not identify a pick — and they are already public in
`MatchupDetailView`, so this format exposes nothing that is not already on the
screen.

Any future variant — "caption of the week," per-caption head-to-head, a caption
draft — has to clear this bar first, and most of them cannot.

---

## 8. Surfaces

**MatchupsTab / MatchupDetailView.** The card shows three rows instead of one
number, each with a check by the winner, and the tally as the headline
(`2–1`, `3–0`). `BattleBreakdown` already renders GE/Visual/Music, so it becomes
the primary view rather than a detail expander. The weekly totals stay visible
underneath — they are still what decides ties and still what feeds standings
points.

**StandingsTab.** One extra column, the category record (`14–7`), between the
W-L-T record and the normalized column, matching the comparator order.

**Record Book** (`utils/leagueRecords.ts`, derived — no new documents):

- _Most sweeps_ — 3-0 matchups, career.
- _Longest category streak_ — consecutive weeks holding a given category, which
  is the "nobody beats them in Music" narrative the format exists to create.
- _Best category record in a season._

All three read `matchup.captions` and skip matchups without it, so a league with
mixed-format history shows records from the seasons that had them and nothing
from the seasons that did not.

**Weekly recap.** `generateWeeklyRecap` gains a sweeps count and a "closest
week" that means 2-1 rather than a points margin. `detectRivalries` keeps its
existing `margin < 5` close-match test, since `scores` still holds totals.

**Discovery.** Leagues running Caption Wars carry a badge on the discovery card.
It is a reason to join a specific league, which is the point of having formats
at all.

---

## 9. Test plan

Backend, pure, no Firestore:

- Weekly caption index sums across multiple shows in a week.
- Every row of the §4.3 table.
- Category tie resolving to the higher total; category tie _and_ total tie
  leaving one undecided while the other two still decide the week.
- 2-1 where the loser has the higher weekly total — the upset case, which is the
  one that proves the format is doing something.
- A `"total"` league resolves identically before and after the change (a
  regression guard on the whole feature).
- Comparator: category record separating two identical W-L-T rows; both counters
  zero reproducing today's exact order.
- Rollover clears the format and its season uid.
- The callable: non-commissioner rejected, mid-season rejected, insufficient
  balance writes nothing, the charge and the setting land in one transaction,
  `prizePool` untouched.

Frontend:

- `computeLeagueRecords` over mixed-format history.
- Matchup card in both formats.

---

## 10. Phasing

1. **Caption index + resolution + the `captions` block.** Format flag read-only,
   defaulted off, set by hand in the console. Nothing user-visible.
2. **Standings comparator + the category-record column.**
3. **The callable, the CC charge, the preseason lock, the rollover reset.**
4. **Record Book, recap, discovery badge.**

Each phase is shippable and each one is safe with the format off everywhere,
which is what the whole `winner`-stays-a-uid design was for.

---

## 11. What this deliberately does not do

- **No consolation bracket.** Worth building, unrelated to this, tracked
  separately in the audit plan.
- **No per-caption lineup scarcity.** Lineup uniqueness is on the whole
  eight-caption combination (`activeLineups/{lineupKey}`), and per-caption
  scarcity would change lineup construction — the first constraint in §1.
- **No new caption groups.** Three, because that is what is stored, and §7 is
  why that will not change.
