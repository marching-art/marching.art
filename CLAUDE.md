# CLAUDE.md

Guidance for Claude (and any contributor) working in this repository.

## Player-facing changelog — update it when you ship something directors notice

marching.art's structural advantage over the game it descends from is a visible
cadence: a public, crawlable **What's New** page (`/updates`) that answers "is
this game still being worked on?" for returning and prospective directors. See
`docs/FMA_LESSONS.md`, lesson 2. That page is only as alive as the changelog
behind it, so keeping the changelog current is part of shipping — not an
afterthought and not something a bot does for us.

**When you make a change a director would notice, add a changelog entry in the
same change.** Write it by hand; there is no automation.

- **Where:** `src/data/changelogEntries.json`. Add the new entry as the **first
  element of the array** (the list is newest-first).
- **When to add one:** a new thing a player can do, an existing thing that got
  better, a bug players hit that's now fixed, or a scoring/economy/difficulty
  tuning change. When in doubt about whether a director would notice, lean
  toward adding it — but skip pure internals (refactors, tests, CI, deps, docs,
  tooling, typing) that change nothing a player sees.
- **How to write it:** describe the change the way it affects a **director**,
  not the commit. Warm and concrete, no dev jargon, no hype words
  ("game-changing", "revolutionary"). Keep the summary to a sentence or two and
  put specifics in `highlights`.

Entry shape (fields and the exact `category`/type contract are defined and
documented in `src/data/changelog.ts`):

```json
{
  "id": "2026-08-24-short-slug",
  "date": "2026-08-24",
  "title": "A short player-facing headline",
  "category": "feature | improvement | fix | balance",
  "summary": "One or two sentences on what changed and why it matters to a director.",
  "highlights": ["Optional bullet specifics", "Up to a few, each short"]
}
```

- `id` is stable and unique — it's also the watermark the unseen-updates badge
  compares against. Use `<date>-<slug>` and never reuse or renumber an id.
- `date` is the ISO day (yyyy-mm-dd) the change goes live, in the game's
  US/Eastern clock.
- `category`: `feature` (new capability), `improvement` (existing thing better),
  `fix` (a bug players hit is resolved), or `balance` (scoring/economy/difficulty
  tuning).

The **roadmap** ("On the horizon") is also hand-authored — in the `ROADMAP`
array in `src/data/changelog.ts`. Move items up as they ship.

## Conventions

- Prettier is the formatter (`npm run format`; `npm run format:check` in CI).
  Run it on files you touch.
- Longer-lived context and the "why" behind several systems lives in `docs/`,
  notably `docs/FMA_LESSONS.md`.
