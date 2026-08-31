# One-Night Slate — league format specification

**Status:** built. This document is the reference for _why_ it works the way it
does; the code is the reference for what it does. Where they disagree, the code
is right and this file is stale.

An alternate way for a league to decide its weekly matchups: instead of one
comparison of the week's **summed** score, a matchup is decided by each
director's **best single show** of the week. One great night beats a week of
grinding.

Everything else about the league is unchanged. This is a scoring format, not a
new game mode.

## The constraints (inherited from Caption Wars)

The design constraint set is [CAPTION_WARS_SPEC.md](CAPTION_WARS_SPEC.md) §1,
unchanged:

- **Nobody's lineup changes.** Directors play exactly the game they always
  played; only the reading of the week differs.
- **No new per-show data.** The weekly score index already walks every show
  result to build the sum; tracking the maximum (and the show that posted it)
  is one comparison over documents already in memory
  (`functions/src/helpers/leagueScoring.js buildWeeklyScoreIndex`). No scoring
  change, no recap-shape change, no backfill.
- **Resolution returns one winner uid (or `"tie"`).** Standings, the champion
  selection, the Finals bracket, the weekly-win payout and the rivalry
  detector never know the format exists.
- **Commissioner-purchased, season-pinned.** 1,500 CC from the commissioner's
  own balance (`ONE_NIGHT_SEASON_COST`, a notch below Caption Wars' 2,000 —
  the lighter read of the same numbers), for one season, cleared at rollover,
  preseason-only, prize pool untouched. Same callable, same guard
  (`activeScoringFormat` in `helpers/captionWars.js`).

## Why this format

The default total rewards **volume** — competing twice counts twice, which is
the right default (showing up is the game) but means a director who can attend
five shows a week out-grinds one who can attend two. One-Night Slate rewards
**peak**: the format for a league whose members cannot all give the game the
same number of nights.

## Resolution

In `leagueScoring.js decideHeadToHead` (the one shared decision rule, used by
the nightly resolution and the commissioner close alike):

```
if best(p1) > best(p2) → p1
if best(p2) > best(p1) → p2
equal bests            → the higher WEEKLY TOTAL (the fuller week takes it)
equal totals too       → "tie"
```

Edge cases:

| Situation                         | Result                                                                   |
| --------------------------------- | ------------------------------------------------------------------------ |
| One director sat the week out     | best 0, total 0 → the director who competed wins. Forfeit forfeits       |
| Neither competed                  | 0-0 on both rules → `"tie"`, same as every format                        |
| Cross-class matchup               | class percentile, like EVERY format — peaks don't compare across classes |
| Bye                               | untouched — no `best` block, folds as always                             |
| No recap days (`daysFound === 0`) | untouched — matchups stay unresolved                                     |
| Commissioner override             | sets `winner` directly, `best` block left in place                       |

## Storage & display

A resolved matchup on this format carries a `best` block —
`{ [uid]: { score, showName } }` — alongside the usual `scores` (which still
hold the weekly totals in every format, so points-for/against, percentiles and
the record book keep meaning the same thing across seasons). The matchup card
shows the best-show scores as the result with the weekly totals as detail;
notifications and pushes quote the best-show line, because the weekly totals
can contradict the verdict they announce. SoundSport stays ratings-only — its
best night renders as the earned tier, never a number.

Points-margin records (blowout / closest call) read weekly totals and treat a
one-night week like a caption-decided week: a winner whose total is lower has
a negative margin and sets no record.
