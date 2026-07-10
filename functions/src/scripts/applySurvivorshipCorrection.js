/**
 * Re-apply the championship-week survivorship correction to the COMMITTED
 * curveData.json in place (see correctSurvivorship in buildPodiumCurves.js).
 *
 * The full builder needs the historical_scores source (Firestore or the
 * pressboxImporter output); this runner exists so the correction can be
 * applied — and future band tweaks re-applied — to the committed artifact
 * without a source rebuild. Idempotent: min(observed, trend) twice is
 * min(observed, trend).
 *
 * Run:  cd functions && node src/scripts/applySurvivorshipCorrection.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { correctSurvivorship } = require("./buildPodiumCurves");

const CURVE_PATH = path.join(__dirname, "../helpers/podium/curveData.json");

const curves = JSON.parse(fs.readFileSync(CURVE_PATH, "utf8"));

const before = { ...curves.totalBands[48] };
correctSurvivorship(curves.totalBands);
for (const caption of Object.keys(curves.bands)) {
  correctSurvivorship(curves.bands[caption]);
}
curves.meta.survivorshipCorrected = new Date().toISOString().slice(0, 10);

fs.writeFileSync(CURVE_PATH, `${JSON.stringify(curves, null, 2)}\n`);

const after = curves.totalBands[48];
console.log("day-49 total band before:", JSON.stringify(before));
console.log("day-49 total band after: ", JSON.stringify(after));
console.log(`Wrote ${CURVE_PATH}`);
