# Working in this repo

Guidance Claude Code loads automatically each session. Keep it short; link out
for detail.

## Formatting is automatic — don't fight it

Prettier runs on staged files via the `.githooks/pre-commit` hook (wired up by
the `prepare` script on `npm install`) and on each file after it's edited in a
web session (the PostToolUse hook in `.claude/settings.json`). You should never
need to run `npm run format` by hand, and the CI `format:check` gate should
never fail on a push. If it ever does, run `npm run format` and check that the
hook is active: `git config core.hooksPath` must print `.githooks`.

## Chip away at `@ts-nocheck` — one per task

**Every time you do substantive work in this repo (any issue, feature, or
fix), also remove at least one `// @ts-nocheck` header** and leave the file
passing `checkJs`. The count is ratcheted downward by CI
(`npm run ts-nocheck:check`, baseline in `scripts/ts-nocheck.baseline.json`);
this habit is how the ~155 grandfathered files get typed over time instead of
never. See [ARCHITECTURE.md](ARCHITECTURE.md#ci-gates) for the ratchet.

Low-friction loop:

```bash
npm run ts-nocheck:next        # ranks the cheapest headers to remove next;
                               # "FREE WINS" already pass checkJs — just delete
                               # the header. Others show their error count.
# 1. Pick a file, delete its `// @ts-nocheck ...` header line.
# 2. Fix the checkJs errors it surfaces (usually a few implicit `any`s —
#    add a JSDoc `@param {...}` / `@type {...}`, not a broad cast).
npm run typecheck              # app + functions must be clean (needs
                               # `cd functions && npm ci` for the functions pass)
npm test -- <the file>         # if it's covered by a test, run it
node scripts/tsNocheckCensus.mjs --update   # lock the new lower ceiling
```

Commit the header removal together with (or right after) your main change.
Never add a new `@ts-nocheck` header to compensate — the ratchet only falls.

> Note: this container may ship a newer TypeScript than the lockfile pins.
> If `npm run typecheck` reports `TS5101`/`TS6xxx` noise, align it first:
> `npm install --no-save typescript@$(node -p "require('./package-lock.json').packages['node_modules/typescript'].version")`

## Update the player-facing changelog when you ship something directors notice

There's no automation — write the entry by hand, in the same change. When a
change is something a **director** would notice (a new capability, an existing
thing improved, a bug fixed, or a balance tweak), prepend an entry to the top of
`src/data/changelogEntries.json` (newest first). Describe the **player-facing
effect**, never internal mechanics, thresholds, or algorithms. The entry shape,
the `category` values, and the id/date rules are documented at the top of
[`src/data/changelog.ts`](src/data/changelog.ts); the roadmap is hand-authored
in the same file. This is what keeps the `/updates` "What's New" page honest and
current — the visible cadence that answers "is this game still being worked on?"
(`docs/FMA_LESSONS.md`, lesson 2).
