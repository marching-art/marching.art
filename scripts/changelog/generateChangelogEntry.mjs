// =============================================================================
// AUTOMATIC CHANGELOG ENTRY GENERATOR
// =============================================================================
// Runs from .github/workflows/changelog.yml on each merged PR. It decides
// whether the change is worth telling players about and, if so, writes a
// player-facing entry to src/data/changelogEntries.json (which the /updates
// page renders). Fully automatic — no human in the loop — so it is deliberately
// conservative: a noise pre-filter drops the obvious non-features before any
// model call, and the model is told it may (and often should) answer SKIP.
//
// Dependency-free (Node 22 global fetch) so the workflow needs no install step
// beyond the repo checkout. The pure helpers are exported and unit-tested in
// generateChangelogEntry.test.mjs; run `npm run changelog:selftest`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const VALID_CATEGORIES = ['feature', 'improvement', 'fix', 'balance'];

// Cap the log so the JSON (and the page) stay bounded; oldest entries fall off.
export const MAX_ENTRIES = 60;

const LIMITS = {
  title: 80,
  summary: 300,
  highlight: 160,
  highlights: 5,
};

// -----------------------------------------------------------------------------
// NOISE FILTER — drop changes players don't care about before any model call.
// -----------------------------------------------------------------------------

// PR titles that are, by convention, not player-facing.
const NOISE_TITLE_RE =
  /^(chore|ci|build|test|tests|docs?|style|refactor|lint|format|deps|dependabot|bump|revert|merge|wip)\b|\brelease lockfile\b|\blockfile\b|\btypecheck\b|\bprettier\b|\beslint\b/i;

// Bot authors whose PRs are never player-facing.
const BOT_AUTHOR_RE = /(\[bot\]$|^dependabot|^renovate|^github-actions)/i;

// A PR touching only these paths is infrastructure, not gameplay.
const NON_PRODUCT_PATH_RE =
  /^(\.github\/|docs\/|scripts\/|e2e\/|firestore-tests\/|.*\.test\.[jt]sx?$|.*\.md$|package(-lock)?\.json$|.*\.ya?ml$)/;

/** True when the PR is obviously not worth a player-facing changelog entry. */
export function isNoisePr({ title = '', authorLogin = '', labels = [], files = [] }) {
  if (BOT_AUTHOR_RE.test(authorLogin)) return true;

  const labelNames = labels.map((l) => (typeof l === 'string' ? l : l?.name || '').toLowerCase());
  if (
    labelNames.some((n) => n === 'dependencies' || n === 'no-changelog' || n === 'skip-changelog')
  ) {
    return true;
  }
  if (labelNames.includes('changelog') || labelNames.includes('player-facing')) {
    // Explicit opt-in overrides the title/paths heuristics below.
    return false;
  }

  if (NOISE_TITLE_RE.test(title.trim())) return true;

  // If we know the changed files and every one is non-product, it's noise.
  if (files.length > 0 && files.every((f) => NON_PRODUCT_PATH_RE.test(f))) return true;

  return false;
}

// -----------------------------------------------------------------------------
// ID + SANITIZATION
// -----------------------------------------------------------------------------

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/^-|-$/g, '');
}

/** Stable, unique id: `<date>-<slug>`, suffixed if it collides. */
export function makeEntryId(date, title, existingIds = []) {
  const base = `${date}-${slugify(title) || 'update'}`;
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function clampString(value, max) {
  const s = String(value ?? '').trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * Normalize a raw model/heuristic entry into a valid ChangelogEntry, or return
 * null when it can't be made valid (missing title/summary/category). Never
 * trusts lengths or category from the model — everything is bounded here.
 */
export function sanitizeEntry(raw, { date, existingIds = [] } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const category = VALID_CATEGORIES.includes(raw.category) ? raw.category : null;
  const title = clampString(raw.title, LIMITS.title);
  const summary = clampString(raw.summary, LIMITS.summary);
  if (!category || !title || summary.length < 8) return null;

  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights
        .map((h) => clampString(h, LIMITS.highlight))
        .filter(Boolean)
        .slice(0, LIMITS.highlights)
    : undefined;

  const entry = {
    id: makeEntryId(date, title, existingIds),
    date,
    title,
    category,
    summary,
  };
  if (highlights && highlights.length > 0) entry.highlights = highlights;
  return entry;
}

/** Prepend an entry (newest-first), dedupe by id, and cap the log length. */
export function prependEntry(entries, entry) {
  const withoutDup = entries.filter((e) => e.id !== entry.id);
  return [entry, ...withoutDup].slice(0, MAX_ENTRIES);
}

// -----------------------------------------------------------------------------
// MODEL DECISION PARSING
// -----------------------------------------------------------------------------

/** Extract the first JSON object from a model response (tolerates code fences). */
export function parseModelDecision(text) {
  if (!text || typeof text !== 'string') return { skip: true };
  const cleaned = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return { skip: true };
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (obj && obj.skip === true) return { skip: true };
    if (!obj || !obj.category || !obj.title || !obj.summary) return { skip: true };
    return obj;
  } catch {
    return { skip: true };
  }
}

/** The prompt that turns a merged PR into a player-facing entry (or a SKIP). */
export function buildPrompt({ title, body = '', files = [] }) {
  const fileList = files.slice(0, 40).join('\n');
  return `You write the player-facing changelog for marching.art, a year-round fantasy drum corps game. A pull request just merged. Decide whether it changes something a PLAYER (a "director") would notice or care about, and if so, describe it the way you'd tell a player — never in developer terms.

Answer with a single JSON object and nothing else.

If the change is internal (refactor, tests, CI, dependencies, docs, tooling, pure typing) or a player would not notice it, answer exactly:
{"skip": true}

Otherwise answer:
{
  "category": one of "feature" | "improvement" | "fix" | "balance",
  "title": a short player-facing headline (max 80 chars, no period, no "feat:"/"fix:" prefixes),
  "summary": 1-2 sentences on what changed and why it matters to a director (max 300 chars),
  "highlights": optional array of up to 4 short specifics (each under 160 chars)
}

Guidance:
- "feature" = something new players can do. "improvement" = an existing thing got better. "fix" = a bug players hit is resolved. "balance" = scoring/economy/difficulty tuning.
- Be concrete and warm, not marketing-flowery. No hype words ("game-changing", "revolutionary").
- When in doubt about player relevance, prefer {"skip": true}.

PR TITLE: ${title}

PR DESCRIPTION:
${(body || '').slice(0, 2000)}

CHANGED FILES:
${fileList}`;
}

// -----------------------------------------------------------------------------
// HEURISTIC FALLBACK — used when no model key is configured or the call fails.
// -----------------------------------------------------------------------------

const CONVENTIONAL_RE = /^(feat|fix|perf|balance)(\([^)]*\))?!?:\s*(.+)$/i;

/**
 * A conservative entry derived from the PR title alone, for when the model is
 * unavailable. Only fires on a conventional-commit-style title so we don't
 * fabricate copy from an ambiguous message; returns null otherwise.
 */
export function heuristicEntry({ title = '', date, existingIds = [] }) {
  const m = title.trim().match(CONVENTIONAL_RE);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const rest = m[3].trim();
  const category =
    type === 'feat'
      ? 'feature'
      : type === 'fix'
        ? 'fix'
        : type === 'perf'
          ? 'improvement'
          : 'balance';
  const headline = rest.charAt(0).toUpperCase() + rest.slice(1);
  return sanitizeEntry({ category, title: headline, summary: headline }, { date, existingIds });
}

// -----------------------------------------------------------------------------
// MODEL CALL (impure)
// -----------------------------------------------------------------------------

async function callGemini({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

function todayEastern() {
  // The changelog dates in America/New_York, matching the game's clock.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA yields yyyy-mm-dd
}

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    try {
      writeFileSync(out, `${name}=${value}\n`, { flag: 'a' });
    } catch {
      /* best effort */
    }
  }
  console.log(`${name}=${value}`);
}

async function main() {
  const dataPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'src',
    'data',
    'changelogEntries.json'
  );

  const title = process.env.PR_TITLE || '';
  const body = process.env.PR_BODY || '';
  const authorLogin = process.env.PR_AUTHOR || '';
  let labels = [];
  let files = [];
  try {
    labels = process.env.PR_LABELS ? JSON.parse(process.env.PR_LABELS) : [];
  } catch {
    labels = [];
  }
  try {
    files = process.env.PR_FILES ? JSON.parse(process.env.PR_FILES) : [];
  } catch {
    files = [];
  }

  if (!title) {
    setOutput('changelog_created', 'false');
    console.log('No PR title provided; nothing to do.');
    return;
  }

  if (isNoisePr({ title, authorLogin, labels, files })) {
    setOutput('changelog_created', 'false');
    console.log(`Skipped (noise filter): "${title}"`);
    return;
  }

  const entries = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const existingIds = entries.map((e) => e.id);
  const date = todayEastern();

  let entry = null;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const model = process.env.CHANGELOG_MODEL || 'gemini-2.0-flash';

  if (apiKey) {
    try {
      const text = await callGemini({ apiKey, model, prompt: buildPrompt({ title, body, files }) });
      const decision = parseModelDecision(text);
      if (decision.skip) {
        setOutput('changelog_created', 'false');
        console.log(`Model judged not player-facing: "${title}"`);
        return;
      }
      entry = sanitizeEntry(decision, { date, existingIds });
    } catch (err) {
      console.warn(`Model call failed (${err.message}); falling back to heuristic.`);
    }
  } else {
    console.log('No model key configured; using conservative heuristic.');
  }

  if (!entry) entry = heuristicEntry({ title, date, existingIds });

  if (!entry) {
    setOutput('changelog_created', 'false');
    console.log(`No entry produced for: "${title}"`);
    return;
  }

  const next = prependEntry(entries, entry);
  writeFileSync(dataPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  setOutput('changelog_created', 'true');
  setOutput('changelog_title', entry.title);
  console.log(`Added changelog entry: [${entry.category}] ${entry.title}`);
}

// Run only when invoked directly (not when imported by the test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error('generateChangelogEntry failed:', err);
    // Never fail the merge over a changelog entry.
    setOutput('changelog_created', 'false');
    process.exit(0);
  });
}
