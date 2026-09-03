# Branch rulesets

`main.json` is the repository ruleset for `main`, kept in the repo so it is
reviewed like code. GitHub does not read this directory — an owner imports it
once and re-imports after any edit:

**Settings → Rules → Rulesets → New ruleset ▾ → Import a ruleset → `main.json`.**

Or from a machine with an admin token:

```bash
gh api -X POST repos/marching-art/marching.art/rulesets --input .github/rulesets/main.json
# later edits: PUT repos/marching-art/marching.art/rulesets/<id>
```

## What it enforces

- The seven `CI` jobs (`.github/workflows/ci.yml`) must be green on the PR
  before it can merge, and the check must come from GitHub Actions
  (`integration_id` 15368), not from any app that happens to post a check
  with the same name. Job `name:` values are the check contexts — rename a
  job and the ruleset must change with it.
- `main` cannot be deleted or force-pushed.
- No bypass actors: a direct push to `main` is refused because its commit has
  no passing checks. Everything, including the automated gazetteer refresh,
  lands through a PR.

`strict_required_status_checks_policy` is deliberately `false` ("require
branches to be up to date" off). The `push` run of CI on `main` already tests
the true merge commit and gates both deploy workflows
(`.github/actions/wait-for-ci`), so requiring every open PR to rebase and
re-run after each merge would only add CI runs without adding safety.
