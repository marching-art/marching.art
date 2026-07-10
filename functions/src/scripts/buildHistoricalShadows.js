/**
 * Build the historical-shadow trajectories (design §6 "historical shadows",
 * decision 29): real corps season arcs the Podium trajectory chart renders
 * as ghost lines. Modeled on a CAST of corps, not just Crown — the famous
 * climbs (Crown, Bluecoats, Boston Crusaders), the mid-pack (Mandarins,
 * Seattle Cascades, Blue Stars) and the community-corps reality (Jersey
 * Surf, Pioneer).
 *
 * Reads the committed local corpus (pressboxImporter/output/
 * historical_scores_*.json — per-corps, per-day totals normalized to
 * competition days 1-49), picks each corps' DENSEST season, linearly
 * interpolates the gaps, and writes src/data/historicalShadows.json for the
 * client chart. Pure local data; no Firestore.
 *
 * Run:  cd functions && node src/scripts/buildHistoricalShadows.js
 */

const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(__dirname, "../../pressboxImporter/output");
const OUTPUT_PATH = path.join(__dirname, "../../../src/data/historicalShadows.json");

// The cast: 8 arcs across the competitive spectrum. `pick` chooses the
// corps' best season (elite icons) or its MEDIAN season (typical year) —
// median also filters out Division II/III sheet seasons, whose inflated
// scores would otherwise masquerade as a community corps hitting 95.
// `minYear` fences off years a corps spent on the Div II/III sheet.
const CAST = [
  { corps: "Carolina Crown", tierLabel: "Elite climb", pick: "max" },
  { corps: "Bluecoats", tierLabel: "Elite climb", pick: "max" },
  { corps: "Boston Crusaders", tierLabel: "Finalist", pick: "max" },
  { corps: "Blue Stars", tierLabel: "Finalist", pick: "max", minYear: 2008 },
  { corps: "Mandarins", tierLabel: "Mid-pack", pick: "median" },
  { corps: "Seattle Cascades", tierLabel: "Mid-pack", pick: "median" },
  { corps: "Jersey Surf", tierLabel: "Community", pick: "median", minYear: 2010 },
  { corps: "Pioneer", tierLabel: "Community", pick: "median" },
];

function loadYears() {
  const years = {};
  for (const file of fs.readdirSync(LOCAL_DATA_DIR)) {
    const match = file.match(/^historical_scores_(\d{4})\.json$/);
    if (!match) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
    years[match[1]] = parsed.data || [];
  }
  return years;
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

function main() {
  const years = loadYears();
  const shadows = [];
  for (const { corps, tierLabel, pick, minYear } of CAST) {
    // Among adequately dense seasons (>=15 scored days, falling back to >=8
    // when a corps never hits 15), take the corps' best or median season.
    let candidates = [];
    for (const minDays of [15, 8]) {
      for (const [year, events] of Object.entries(years)) {
        if (minYear && Number(year) < minYear) continue;
        const byDay = observedDays(events, corps);
        const count = Object.keys(byDay).length;
        if (count < minDays) continue;
        candidates.push({ year, byDay, count, finals: interpolate(byDay)[48] });
      }
      if (candidates.length > 0) break;
    }
    candidates.sort((a, b) => a.finals - b.finals);
    const best =
      candidates.length === 0
        ? null
        : pick === "median"
          ? candidates[Math.floor(candidates.length / 2)]
          : candidates[candidates.length - 1];
    if (!best) {
      console.warn(`SKIP ${corps}: no season with >=8 scored days in the local corpus`);
      continue;
    }
    const totals = interpolate(best.byDay);
    shadows.push({
      corps,
      year: Number(best.year),
      tierLabel,
      observedDays: best.count,
      finals: totals[48],
      totals,
    });
    console.log(
      `${corps} ${best.year}: ${best.count} scored days, ` +
        `opener ${totals[0]} -> finals ${totals[48]}`
    );
  }
  shadows.sort((a, b) => b.finals - a.finals);
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        meta: {
          note:
            "Historical shadow trajectories (design decision 29) — real corps season " +
            "arcs from the 2000-2012 local corpus, densest season per corps, linearly " +
            "interpolated to competition days 1-49. Regenerate with " +
            "functions/src/scripts/buildHistoricalShadows.js.",
          generatedFrom: "pressboxImporter/output",
        },
        shadows,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${shadows.length} shadows to ${OUTPUT_PATH}`);
}

if (require.main === module) main();

module.exports = { observedDays, interpolate, CAST };
