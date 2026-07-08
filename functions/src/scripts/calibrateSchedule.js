/**
 * DEV-ONLY calibration harness for the learned schedule model (Step 1).
 *
 * Samples real dci.org data across 2019-2026 and measures the two things the
 * learned-schedule generator needs to be trustworthy:
 *
 *   1. Order <-> score relationship: does a corps' performance order track the
 *      reverse of that night's score? (Spearman rank correlation per event.)
 *   2. Timing constants: show start (local), gates-open offset, scores-announced
 *      offset, inter-corps interval, and the intermission gap.
 *
 * For each sampled event we fetch the /events/ detail page (running order + times,
 * parsed by helpers/eventDetails) AND its matching /scores/recap/ page (per-corps
 * totals), then join by normalized corps name.
 *
 * Fetches via `curl` because this sandbox's proxy requires CONNECT tunneling and
 * the pinned axios here can't do it. The production scraper (real Functions
 * runtime, no such proxy) uses axios normally — this file is not shipped to prod.
 *
 * Run:  node src/scripts/calibrateSchedule.js [perYear]
 */

const { execFileSync } = require("node:child_process");
const {
  parseEventDetail,
  parseEventDate,
} = require("../helpers/eventDetails");

const UA = "Mozilla/5.0 (compatible; MarchingArtBot/1.0)";
const YEARS = [2019, 2021, 2022, 2023, 2024, 2025, 2026];
const PER_YEAR = parseInt(process.argv[2], 10) || 5;

function curl(url) {
  try {
    return execFileSync(
      "curl",
      ["-sS", "-A", UA, "--max-time", "30", "-w", "\n%{http_code}", url],
      { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
    );
  } catch {
    return null;
  }
}

/** Fetch a URL, returning its body only on HTTP 200. */
function fetchOk(url) {
  const out = curl(url);
  if (!out) return null;
  const idx = out.lastIndexOf("\n");
  const body = out.slice(0, idx);
  const code = out.slice(idx + 1).trim();
  return code === "200" ? body : null;
}

function normalize(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Extract corps -> final total score from a /scores/recap/ page. */
function parseRecapTotals(html) {
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);
  const totals = new Map();
  $("table#effect-table-0 > tbody > tr").not(".table-top").each((_i, row) => {
    const corps = $(row).find("td.sticky-td").first().text().trim();
    if (!corps) return;
    const total = parseFloat(
      $(row).find("td.data-total").last().find("span").first().text().trim()
    );
    if (corps && !isNaN(total)) totals.set(normalize(corps), total);
  });
  return totals;
}

/** Spearman rank correlation between two equal-length numeric arrays. */
function spearman(xs, ys) {
  const rank = (arr) => {
    const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < sorted.length; i++) r[sorted[i][1]] = i + 1;
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function localHour(perfTimeStr) {
  const m = String(perfTimeStr).match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (/p/i.test(m[3]) && h !== 12) h += 12;
  if (/a/i.test(m[3]) && h === 12) h = 0;
  return h + parseInt(m[2], 10) / 60;
}

function discoverEventUrls() {
  const indexXml = fetchOk("https://www.dci.org/sitemap_index.xml") || "";
  const sitemaps = [...indexXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /(^|\/)event-sitemap\d*\.xml/.test(u));
  const byYear = new Map(YEARS.map((y) => [y, []]));
  for (const sm of sitemaps) {
    const xml = fetchOk(sm) || "";
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const url = m[1];
      const ym = url.match(/\/events\/(\d{4})-/);
      if (ym && byYear.has(+ym[1])) byYear.get(+ym[1]).push(url);
    }
  }
  return byYear;
}

/** Evenly spread `k` picks across a sorted list (deterministic, no RNG). */
function spread(list, k) {
  const sorted = [...list].sort();
  if (sorted.length <= k) return sorted;
  const step = sorted.length / k;
  return Array.from({ length: k }, (_, i) => sorted[Math.floor(i * step)]);
}

function main() {
  console.log(`Calibration sample: up to ${PER_YEAR} events/year across ${YEARS.join(", ")}\n`);
  const byYear = discoverEventUrls();

  const perEvent = [];
  const intervals = [];
  const startHours = [];
  const gatesOffsets = [];
  const scoresOffsets = [];
  const intermissionGaps = [];
  const intermissionPositions = [];
  let sampleShown = null;

  for (const year of YEARS) {
    const candidates = spread(byYear.get(year) || [], PER_YEAR * 2);
    let kept = 0;
    for (const eventUrl of candidates) {
      if (kept >= PER_YEAR) break;
      const slug = eventUrl.match(/\/events\/([^/]+)\/?$/)?.[1];
      if (!slug) continue;
      const eventHtml = fetchOk(eventUrl);
      if (!eventHtml) continue;
      const date = parseEventDate(eventHtml);
      const detail = parseEventDetail(eventHtml, { date });
      if (!detail.lineup || detail.lineup.length < 5) continue;

      const recapHtml = fetchOk(`https://www.dci.org/scores/recap/${slug}/`);
      if (!recapHtml) continue;
      const totals = parseRecapTotals(recapHtml);
      if (totals.size < 5) continue;

      // Join running order (performance sequence) to final totals.
      const order = [];
      const scores = [];
      let matched = 0;
      detail.lineup.forEach((entry) => {
        const t = totals.get(normalize(entry.corps));
        if (t !== undefined) {
          order.push(entry.order);
          scores.push(t);
          matched++;
        }
      });
      if (matched < 5) continue;

      const rho = spearman(order, scores);
      perEvent.push({ slug, n: matched, rho: +rho.toFixed(3) });
      kept++;

      // Timing: start hour = first performer local time.
      const firstPerf = detail.lineup[0];
      const sh = localHour(firstPerf.performanceTime);
      if (sh !== null) startHours.push(sh);

      // Gates / scores offsets (minutes).
      const times = detail.lineup.map((e) => e.performsAt).filter(Boolean).map((t) => new Date(t).getTime());
      if (detail.gatesAt && times.length) {
        gatesOffsets.push((times[0] - new Date(detail.gatesAt).getTime()) / 60000);
      }
      if (detail.scoresAt && times.length) {
        scoresOffsets.push((new Date(detail.scoresAt).getTime() - times[times.length - 1]) / 60000);
      }

      // Inter-corps intervals; largest gap = intermission.
      const gaps = [];
      for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 60000);
      if (gaps.length) {
        const maxGap = Math.max(...gaps);
        const maxIdx = gaps.indexOf(maxGap);
        gaps.forEach((g, i) => { if (i !== maxIdx) intervals.push(g); });
        intermissionGaps.push(maxGap);
        intermissionPositions.push((maxIdx + 1) / times.length);
      }

      if (!sampleShown && matched >= 8) {
        sampleShown = { slug, detail, totals };
      }
    }
    console.log(`  ${year}: kept ${kept} events`);
  }

  const rhos = perEvent.map((e) => e.rho);
  console.log(`\n=== ORDER <-> SCORE CORRELATION (${perEvent.length} events) ===`);
  console.log(`  Spearman rho  median=${median(rhos)?.toFixed(3)}  min=${Math.min(...rhos).toFixed(3)}  max=${Math.max(...rhos).toFixed(3)}`);
  console.log(`  events with rho >= 0.8: ${rhos.filter((r) => r >= 0.8).length}/${rhos.length}`);
  console.log(`  events with rho >= 0.6: ${rhos.filter((r) => r >= 0.6).length}/${rhos.length}`);
  console.log(`  (positive rho = later performers score higher = reverse-standings order holds)`);

  console.log(`\n=== TIMING CONSTANTS ===`);
  console.log(`  show start (local hr):   median=${median(startHours)?.toFixed(2)}  n=${startHours.length}`);
  console.log(`  gates-open offset (min): median=${median(gatesOffsets)?.toFixed(0)}  n=${gatesOffsets.length}`);
  console.log(`  scores offset (min):     median=${median(scoresOffsets)?.toFixed(0)}  n=${scoresOffsets.length}`);
  console.log(`  inter-corps interval:    median=${median(intervals)?.toFixed(1)}  n=${intervals.length}`);
  console.log(`  intermission gap (min):  median=${median(intermissionGaps)?.toFixed(0)}  n=${intermissionGaps.length}`);
  console.log(`  intermission position:   median=${median(intermissionPositions)?.toFixed(2)} (fraction through field)`);

  if (sampleShown) {
    console.log(`\n=== SAMPLE: ${sampleShown.slug} — real order vs. reverse-score order ===`);
    const rows = sampleShown.detail.lineup
      .map((e) => ({ corps: e.corps, time: e.performanceTime, score: sampleShown.totals.get(normalize(e.corps)) }))
      .filter((r) => r.score !== undefined);
    const byScore = [...rows].sort((a, b) => a.score - b.score);
    console.log("  real-order".padEnd(34) + "reverse-score-order");
    for (let i = 0; i < rows.length; i++) {
      const L = `${i + 1}. ${rows[i].corps} (${rows[i].score})`;
      const R = `${i + 1}. ${byScore[i].corps} (${byScore[i].score})`;
      console.log("  " + L.padEnd(32) + R);
    }
  }

  console.log(`\nPer-event rho: ${perEvent.map((e) => `${e.slug}=${e.rho}`).join(", ")}`);
}

main();
