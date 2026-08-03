/**
 * Build the historical-shadow POOL (design §6 "historical shadows", decision
 * 29): real corps season arcs the Podium trajectory chart renders as ghost
 * lines behind the director's own score line.
 *
 * This used to emit ONE hand-picked cast of eight corps, so every director saw
 * the same eight ghosts every season forever. It now emits a banded POOL, and
 * the client (src/utils/historicalShadows.ts) draws eight arcs out of it keyed
 * by seasonUid — a fresh, still-balanced cast at every season reset.
 *
 * The pool is bucketed into eight finals bands spanning 70-98 (BANDS below),
 * eight arcs per band. Selection takes exactly one arc from each band, so the
 * rendered chart always spans the full competitive spectrum: there is a ghost
 * to chase whether you finish 71st percentile or are pushing for a medal.
 *
 * Eligibility is World Class only, resolved per year from the committed
 * final_rankings_YYYY.json ranked field (falling back to the union of every
 * ranked field for the years those files don't cover). That fence is what
 * keeps a Division II/III sheet season — where a small corps could post a 91 —
 * out of the same band as a World Class finalist.
 *
 * Reads the committed local corpus (pressboxImporter/output/
 * historical_scores_*.json, 2000-2025 — per-corps, per-day totals normalized
 * to competition days 1-49), linearly interpolates the gaps, and writes
 * src/data/historicalShadows.json. Pure local data; no Firestore.
 *
 * Run:  cd functions && node src/scripts/buildHistoricalShadows.js
 *       npx prettier --write src/data/historicalShadows.json   (from the repo root)
 */

const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(__dirname, "../../pressboxImporter/output");
const OUTPUT_PATH = path.join(__dirname, "../../../src/data/historicalShadows.json");

/**
 * Band edges for the finals distribution, low to high: eight buckets across
 * 70-98.5. The client picks one arc per band, which is what makes the chart's
 * spread a property of the DATA rather than of whoever curated the cast.
 * Anything finishing under 70 or over 98.5 is left out: below 70 the ghost is
 * no longer a target for a Podium corps, and the 99s are three or four dynasty
 * seasons that would crowd the top band with the same two corps.
 */
const BANDS = [70, 73.5, 77, 80.5, 84, 87.5, 91, 94.5, 98.5];
/** Arcs kept per band. Eight gives the seasonal rotation room without bloating
 *  the client bundle (the whole pool ships with the app). */
const PER_BAND = 8;
/** A season needs this many scored days before its shape is trustworthy. */
const MIN_SCORED_DAYS = 15;
/** Era split for the per-band mix, so the pool never drifts into all-2000s
 *  arcs just because early seasons had denser score reporting. */
const MODERN_FROM = 2013;

function loadCorpus() {
  const years = {};
  const rankedByYear = {};
  for (const file of fs.readdirSync(LOCAL_DATA_DIR)) {
    const scores = file.match(/^historical_scores_(\d{4})\.json$/);
    if (scores) {
      const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
      years[scores[1]] = parsed.data || [];
      continue;
    }
    const rankings = file.match(/^final_rankings_(\d{4})\.json$/);
    if (rankings) {
      const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
      rankedByYear[rankings[1]] = new Set((parsed.data || []).map((row) => row.corps));
    }
  }
  return { years, rankedByYear };
}

/** {day -> total} observed for a corps in one year's event list. */
function observedDays(events, corpsName) {
  const byDay = {};
  for (const event of events) {
    if (event.offSeasonDay == null || event.offSeasonDay < 1 || event.offSeasonDay > 49) continue;
    for (const row of event.scores || []) {
      if (row.corps === corpsName && typeof row.score === "number" && row.score > 0) {
        // Keep the highest score of multi-show days (a corps performs once).
        if (byDay[event.offSeasonDay] == null || row.score > byDay[event.offSeasonDay]) {
          byDay[event.offSeasonDay] = row.score;
        }
      }
    }
  }
  return byDay;
}

/** Linear interpolation across days 1-49 (flat extension at the edges). */
function interpolate(byDay) {
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  if (days.length === 0) return null;
  const out = [];
  for (let day = 1; day <= 49; day++) {
    if (byDay[day] != null) {
      out.push(Math.round(byDay[day] * 100) / 100);
      continue;
    }
    const prev = [...days].reverse().find((d) => d < day);
    const next = days.find((d) => d > day);
    if (prev == null) out.push(Math.round(byDay[days[0]] * 100) / 100);
    else if (next == null) out.push(Math.round(byDay[prev] * 100) / 100);
    else {
      const t = (day - prev) / (next - prev);
      out.push(Math.round((byDay[prev] + (byDay[next] - byDay[prev]) * t) * 100) / 100);
    }
  }
  return out;
}

/** Band index for a finals score, or -1 when it falls outside 70-98.5. */
function bandFor(finals) {
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (finals >= BANDS[i] && finals < BANDS[i + 1]) return i;
  }
  return -1;
}

/**
 * Every World Class season in the corpus dense enough to draw, banded.
 * A corps counts as World Class in a year when it appears in that year's
 * ranked field; for the years with no rankings file (2020-2021, 2023-2024) we
 * fall back to "has ever been ranked", which is the best the corpus supports.
 */
function buildCandidates({ years, rankedByYear }) {
  const everRanked = new Set();
  for (const set of Object.values(rankedByYear)) for (const corps of set) everRanked.add(corps);

  const candidates = [];
  for (const [year, events] of Object.entries(years)) {
    const eligible = rankedByYear[year] || everRanked;
    for (const corps of eligible) {
      const byDay = observedDays(events, corps);
      const scoredDays = Object.keys(byDay).length;
      if (scoredDays < MIN_SCORED_DAYS) continue;
      const totals = interpolate(byDay);
      const finals = totals[48];
      const band = bandFor(finals);
      if (band < 0) continue;
      candidates.push({ corps, year: Number(year), band, observedDays: scoredDays, finals, totals });
    }
  }
  return candidates;
}

/**
 * Reduce one band to PER_BAND arcs: distinct corps, distinct years, and an
 * even split between the modern and classic eras. Density (scored days) breaks
 * ties, since a denser season needs less interpolation to draw honestly.
 */
function pickBand(candidates) {
  const byDensity = [...candidates].sort(
    (a, b) => b.observedDays - a.observedDays || b.year - a.year
  );
  const modern = byDensity.filter((c) => c.year >= MODERN_FROM);
  const classic = byDensity.filter((c) => c.year < MODERN_FROM);
  const picked = [];
  const usedCorps = new Set();
  const usedYears = new Set();

  const take = (list) => {
    const next = list.find((c) => !usedCorps.has(c.corps) && !usedYears.has(c.year));
    if (!next) return false;
    picked.push(next);
    usedCorps.add(next.corps);
    usedYears.add(next.year);
    return true;
  };

  // Alternate eras first so neither can monopolize the band, then top up from
  // whatever still has distinct corps/years left.
  while (picked.length < PER_BAND) {
    const tookModern = take(modern);
    if (picked.length >= PER_BAND) break;
    const tookClassic = take(classic);
    if (!tookModern && !tookClassic) break;
  }
  while (picked.length < PER_BAND) {
    // Year uniqueness is a nice-to-have inside a band (the client dedupes
    // years across the eight it draws); corps uniqueness is not negotiable.
    const next = byDensity.find((c) => !usedCorps.has(c.corps) && !picked.includes(c));
    if (!next) break;
    picked.push(next);
    usedCorps.add(next.corps);
    usedYears.add(next.year);
  }
  return picked.sort((a, b) => b.finals - a.finals);
}

function main() {
  const corpus = loadCorpus();
  const candidates = buildCandidates(corpus);
  const pool = [];
  for (let band = 0; band < BANDS.length - 1; band++) {
    const inBand = pickBand(candidates.filter((c) => c.band === band));
    if (inBand.length < PER_BAND) {
      console.warn(
        `THIN BAND ${BANDS[band]}-${BANDS[band + 1]}: only ${inBand.length} arcs available`
      );
    }
    for (const arc of inBand) pool.push(arc);
    console.log(
      `band ${BANDS[band]}-${BANDS[band + 1]}: ` +
        inBand.map((a) => `${a.corps} '${String(a.year).slice(2)} ${a.finals.toFixed(1)}`).join(", ")
    );
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        meta: {
          note:
            "Historical shadow POOL (design decision 29) — real World Class season arcs " +
            "from the 2000-2025 local corpus, linearly interpolated to competition days " +
            "1-49 and bucketed into finals bands spanning 70-98. The Podium trajectory " +
            "chart draws one arc per band, chosen by seasonUid, so the cast rotates every " +
            "season reset. Regenerate with functions/src/scripts/buildHistoricalShadows.js.",
          generatedFrom: "pressboxImporter/output",
          bands: BANDS,
          perBand: PER_BAND,
        },
        pool,
      },
      null,
      2
    )
  );
  const years = new Set(pool.map((a) => a.year));
  const corps = new Set(pool.map((a) => a.corps));
  console.log(
    `\nWrote ${pool.length} pooled arcs (${corps.size} corps, ${years.size} years) to ${OUTPUT_PATH}`
  );
}

if (require.main === module) main();

module.exports = { observedDays, interpolate, bandFor, pickBand, BANDS, PER_BAND };
