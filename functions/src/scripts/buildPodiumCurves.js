/**
 * Podium Phase 0.2 — Curve miner.
 *
 * Processes every completed year of historical_scores into the Podium
 * scoring engine's calibration data (docs/PODIUM_CLASS_DESIGN.md §4.1):
 *
 *   1. Day-indexed percentile bands per caption (p5/p25/p50/p75/p95/max)
 *      over offSeasonDay 1-49 — the realism envelope. Sparse days are
 *      filled by linear interpolation between observed days and the band
 *      is smoothed with a 3-day moving average so single thin days can't
 *      pinch the envelope.
 *   2. Day-over-day delta-rate distributions per caption per season phase
 *      (early weeks 1-2 / mid 3-5 / late 6-7) — how fast captions actually
 *      move, including the negative tail (real corps DO go down).
 *   3. Logistic growth fits per corps-season-caption
 *      (score(d) = L / (1 + e^(-k(d - d0)))), k-means clustered into
 *      archetypes per caption — the shapes Challenge Levels select between.
 *   4. Total-score bands (same treatment) for harness assertions.
 *
 * Only COMPLETED years are used (§14.2.7): a year is included when its max
 * offSeasonDay >= 45, so a partially-scraped live season can never shift
 * the envelope mid-season.
 *
 * Output: functions/src/helpers/podium/curveData.json (committed) — also
 * intended to be uploaded to Firestore `podium-config/curves` at deploy.
 *
 * Run:
 *   cd functions
 *   node src/scripts/buildPodiumCurves.js [--firestore]
 */

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join(__dirname, "../helpers/podium/curveData.json");
const LOCAL_DATA_DIR = path.join(__dirname, "../../pressboxImporter/output");

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const SEASON_DAYS = 49;
const PHASES = [
  { key: "early", fromDay: 1, toDay: 14 },
  { key: "mid", fromDay: 15, toDay: 35 },
  { key: "late", fromDay: 36, toDay: 49 },
];
const PERCENTILES = [5, 25, 50, 75, 95];
const ARCHETYPE_COUNT = 4;
const MIN_POINTS_FOR_FIT = 6;

/** Percentile of a sorted numeric array (linear interpolation). */
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Load event data grouped as corps-season caption series.
 * @param {boolean} useFirestore
 * @returns {Promise<{series: Map<string, Map<string, Array<[number, number]>>>, years: string[]}>}
 *   series: "corps|year" -> caption -> [[day, value], ...] (day-ascending, deduped by day: latest wins)
 */
async function loadSeries(useFirestore) {
  const yearDocs = [];
  if (useFirestore) {
    const { getDb } = require("../config");
    const snapshot = await getDb().collection("historical_scores").get();
    snapshot.forEach((doc) => yearDocs.push({ year: doc.id, data: doc.data().data || [] }));
  } else {
    const files = fs
      .readdirSync(LOCAL_DATA_DIR)
      .filter((f) => f.startsWith("historical_scores_") && f.endsWith(".json"));
    for (const file of files) {
      const year = (file.match(/(\d{4})/) || [])[1] || file;
      const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
      yearDocs.push({ year, data: parsed.data || [] });
    }
  }

  const series = new Map();
  const includedYears = [];
  for (const { year, data } of yearDocs) {
    const maxDay = Math.max(0, ...data.map((e) => e.offSeasonDay || 0));
    if (maxDay < 45) {
      console.warn(`Skipping year ${year}: max offSeasonDay ${maxDay} < 45 (incomplete season)`);
      continue;
    }
    includedYears.push(year);
    for (const event of data) {
      const day = event.offSeasonDay;
      if (!day || day < 1 || day > SEASON_DAYS) continue;
      for (const row of event.scores || []) {
        if (!row || !row.corps || !row.captions) continue;
        const key = `${row.corps}|${year}`;
        if (!series.has(key)) series.set(key, new Map());
        const byCaption = series.get(key);
        for (const caption of CAPTIONS) {
          const value = row.captions[caption];
          if (typeof value !== "number" || value <= 0 || value > 20) continue;
          if (!byCaption.has(caption)) byCaption.set(caption, new Map());
          byCaption.get(caption).set(day, value); // later events same day overwrite
        }
        // Total series under a pseudo-caption key.
        if (typeof row.score === "number" && row.score > 0 && row.score <= 100) {
          if (!byCaption.has("TOTAL")) byCaption.set("TOTAL", new Map());
          byCaption.get("TOTAL").set(day, row.score);
        }
      }
    }
  }

  // Convert day-maps to sorted arrays.
  for (const byCaption of series.values()) {
    for (const [caption, dayMap] of byCaption) {
      byCaption.set(caption, [...dayMap.entries()].sort((a, b) => a[0] - b[0]));
    }
  }
  return { series, years: includedYears.sort() };
}

/**
 * Build day-indexed percentile bands for one caption (or TOTAL) from all
 * corps-season observations, with interpolation over unobserved days and a
 * 3-day moving-average smooth.
 * @param {Array<Array<[number, number]>>} allSeries
 * @param {number} maxValue cap for the caption (20) or total (100)
 * @returns {Array<object>} index 0 = day 1; {p5,p25,p50,p75,p95,max}
 */
function buildBands(allSeries, maxValue) {
  const byDay = Array.from({ length: SEASON_DAYS + 1 }, () => []);
  for (const points of allSeries) {
    for (const [day, value] of points) byDay[day].push(Math.min(value, maxValue));
  }
  const raw = [];
  for (let day = 1; day <= SEASON_DAYS; day++) {
    const sorted = byDay[day].sort((a, b) => a - b);
    if (sorted.length >= 3) {
      const entry = { n: sorted.length };
      for (const p of PERCENTILES) entry[`p${p}`] = Number(percentile(sorted, p).toFixed(3));
      entry.max = Number(sorted[sorted.length - 1].toFixed(3));
      raw.push(entry);
    } else {
      raw.push(null); // interpolate below
    }
  }
  // Linear interpolation for null days (and edge extension).
  const keys = [...PERCENTILES.map((p) => `p${p}`), "max"];
  for (const key of keys) {
    let prevIdx = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i][key] !== undefined) {
        if (prevIdx === -1) {
          for (let j = 0; j < i; j++) {
            if (!raw[j]) raw[j] = { n: 0 };
            raw[j][key] = raw[i][key];
          }
        } else if (prevIdx < i - 1) {
          const a = raw[prevIdx][key];
          const b = raw[i][key];
          for (let j = prevIdx + 1; j < i; j++) {
            if (!raw[j]) raw[j] = { n: 0 };
            raw[j][key] = Number((a + ((b - a) * (j - prevIdx)) / (i - prevIdx)).toFixed(3));
          }
        }
        prevIdx = i;
      }
    }
    if (prevIdx !== -1) {
      for (let j = prevIdx + 1; j < raw.length; j++) {
        if (!raw[j]) raw[j] = { n: 0 };
        raw[j][key] = raw[prevIdx][key];
      }
    }
  }
  // 3-day moving average smooth (monotone envelope is NOT forced — real
  // bands genuinely dip, e.g. post-regional-week field composition shifts).
  const smoothed = raw.map((entry, i) => {
    const out = { n: entry.n };
    for (const key of keys) {
      const window = [raw[Math.max(0, i - 1)][key], entry[key], raw[Math.min(raw.length - 1, i + 1)][key]];
      out[key] = Number((window.reduce((s, v) => s + v, 0) / window.length).toFixed(3));
    }
    return out;
  });
  return smoothed;
}

/**
 * Delta-rate samples (points per day) between consecutive observations,
 * bucketed by phase of the LATER observation. Gap-normalized; gaps > 7 days
 * are skipped (too lossy to attribute).
 */
function buildDeltas(allSeries) {
  const byPhase = Object.fromEntries(PHASES.map((p) => [p.key, []]));
  for (const points of allSeries) {
    for (let i = 1; i < points.length; i++) {
      const [d0, v0] = points[i - 1];
      const [d1, v1] = points[i];
      const gap = d1 - d0;
      if (gap < 1 || gap > 7) continue;
      const rate = (v1 - v0) / gap;
      const phase = PHASES.find((p) => d1 >= p.fromDay && d1 <= p.toDay);
      if (phase) byPhase[phase.key].push(rate);
    }
  }
  const out = {};
  for (const { key } of PHASES) {
    const sorted = byPhase[key].sort((a, b) => a - b);
    out[key] = {
      n: sorted.length,
      p5: Number((percentile(sorted, 5) ?? 0).toFixed(4)),
      p25: Number((percentile(sorted, 25) ?? 0).toFixed(4)),
      p50: Number((percentile(sorted, 50) ?? 0).toFixed(4)),
      p75: Number((percentile(sorted, 75) ?? 0).toFixed(4)),
      p95: Number((percentile(sorted, 95) ?? 0).toFixed(4)),
    };
  }
  return out;
}

/**
 * Least-squares logistic fit via coarse grid + one refinement pass.
 * score(d) = L / (1 + e^(-k(d - d0)))
 * @returns {{L: number, k: number, d0: number, rmse: number}|null}
 */
function fitLogistic(points, maxValue) {
  if (points.length < MIN_POINTS_FOR_FIT) return null;
  const maxObserved = Math.max(...points.map(([, v]) => v));
  const evaluate = (L, k, d0) => {
    let sse = 0;
    for (const [d, v] of points) {
      const pred = L / (1 + Math.exp(-k * (d - d0)));
      sse += (pred - v) * (pred - v);
    }
    return sse;
  };
  let best = null;
  const search = (Ls, ks, d0s) => {
    for (const L of Ls) {
      for (const k of ks) {
        for (const d0 of d0s) {
          const sse = evaluate(L, k, d0);
          if (!best || sse < best.sse) best = { L, k, d0, sse };
        }
      }
    }
  };
  const range = (from, to, step) => {
    const out = [];
    for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(4)));
    return out;
  };
  search(
    range(maxObserved, Math.min(maxValue * 1.05, maxObserved * 1.35), Math.max(0.1, maxObserved * 0.02)),
    range(0.02, 0.4, 0.02),
    range(-20, 40, 2)
  );
  // Refine around the coarse optimum.
  search(
    range(Math.max(maxObserved, best.L - 0.5), best.L + 0.5, 0.1),
    range(Math.max(0.005, best.k - 0.02), best.k + 0.02, 0.005),
    range(best.d0 - 2, best.d0 + 2, 0.5)
  );
  return {
    L: Number(best.L.toFixed(3)),
    k: Number(best.k.toFixed(4)),
    d0: Number(best.d0.toFixed(2)),
    rmse: Number(Math.sqrt(best.sse / points.length).toFixed(4)),
  };
}

/**
 * k-means over normalized (L, k, d0) fit parameters. Deterministic:
 * centroids seeded by sorting on L and taking evenly spaced members.
 */
function clusterArchetypes(fits, k) {
  if (fits.length < k * 2) return [];
  const dims = ["L", "k", "d0"];
  const mins = {};
  const spans = {};
  for (const dim of dims) {
    const values = fits.map((f) => f[dim]);
    mins[dim] = Math.min(...values);
    spans[dim] = Math.max(...values) - mins[dim] || 1;
  }
  const norm = (f) => dims.map((dim) => (f[dim] - mins[dim]) / spans[dim]);
  const points = fits.map(norm);
  const sortedByL = [...points].sort((a, b) => a[0] - b[0]);
  let centroids = Array.from({ length: k }, (_, i) => [
    ...sortedByL[Math.floor(((i + 0.5) * sortedByL.length) / k)],
  ]);
  let assignment = new Array(points.length).fill(0);
  for (let iter = 0; iter < 50; iter++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let bestC = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dist = points[i].reduce((s, v, d) => s + (v - centroids[c][d]) ** 2, 0);
        if (dist < bestDist) {
          bestDist = dist;
          bestC = c;
        }
      }
      if (assignment[i] !== bestC) {
        assignment[i] = bestC;
        moved = true;
      }
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const c = assignment[i];
      for (let d = 0; d < 3; d++) sums[c][d] += points[i][d];
      sums[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) centroids[c] = sums[c].slice(0, 3).map((s) => s / sums[c][3]);
    }
    if (!moved) break;
  }
  // Denormalize and describe each cluster.
  const clusters = Array.from({ length: k }, () => []);
  fits.forEach((f, i) => clusters[assignment[i]].push(f));
  return clusters
    .filter((members) => members.length > 0)
    .map((members) => {
      const mean = (dim) => members.reduce((s, f) => s + f[dim], 0) / members.length;
      return {
        L: Number(mean("L").toFixed(3)),
        k: Number(mean("k").toFixed(4)),
        d0: Number(mean("d0").toFixed(2)),
        share: Number((members.length / fits.length).toFixed(3)),
        n: members.length,
      };
    })
    .sort((a, b) => a.L - b.L);
}

async function main() {
  const useFirestore = process.argv.includes("--firestore");
  const { series, years } = await loadSeries(useFirestore);
  console.log(`Corps-seasons: ${series.size} across ${years.length} completed years`);

  const output = {
    meta: {
      generatedFrom: useFirestore ? "firestore:historical_scores" : "pressboxImporter/output",
      years,
      corpsSeasons: series.size,
      captions: CAPTIONS,
      seasonDays: SEASON_DAYS,
      phases: PHASES,
      model: "score(d) = L / (1 + exp(-k*(d - d0)))",
    },
    bands: {},
    deltas: {},
    archetypes: {},
    totalBands: null,
  };

  for (const caption of [...CAPTIONS, "TOTAL"]) {
    const allSeries = [];
    for (const byCaption of series.values()) {
      const points = byCaption.get(caption);
      if (points && points.length > 0) allSeries.push(points);
    }
    const maxValue = caption === "TOTAL" ? 100 : 20;
    const bands = buildBands(allSeries, maxValue);
    const deltas = buildDeltas(allSeries);
    if (caption === "TOTAL") {
      output.totalBands = bands;
      output.totalDeltas = deltas;
    } else {
      output.bands[caption] = bands;
      output.deltas[caption] = deltas;
    }

    if (caption !== "TOTAL") {
      const fits = [];
      for (const byCaption of series.values()) {
        const points = byCaption.get(caption);
        if (!points) continue;
        const fit = fitLogistic(points, maxValue);
        if (fit && fit.rmse < 1.5) fits.push(fit);
      }
      output.archetypes[caption] = clusterArchetypes(fits, ARCHETYPE_COUNT);
      console.log(
        `${caption}: ${allSeries.length} series, ${fits.length} logistic fits, ` +
          `${output.archetypes[caption].length} archetypes, ` +
          `day49 band p50/p95/max = ${bands[48].p50}/${bands[48].p95}/${bands[48].max}`
      );
    } else {
      console.log(`TOTAL: day49 band p50/p95/max = ${bands[48].p50}/${bands[48].p95}/${bands[48].max}`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
