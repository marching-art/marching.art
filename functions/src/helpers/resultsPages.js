// Public results pages: the crawlable, server-rendered read-only surface for
// fantasy scores. The Scores SPA route is auth-walled (and robots-disallowed),
// so before these pages existed the game's most interesting content — nightly
// results — had zero organic search presence. /results/{season} and
// /results/{season}/{day} are plain HTML with real content, canonical URLs,
// and OG cards, discoverable via the sitemap and cross-linked page to page.
//
// Product rules honored here:
//   - Fantasy sheets stay condensed to GE/VIS/MUS + Total (anti-lineup-
//     harvesting rule; full caption columns are Podium-only).
//   - SoundSport never exposes numeric scores — medal/participation only.
//
// Pure builders, no Firestore: the HTTP layer (triggers/resultsPages.js)
// fetches docs and passes plain data in, so layouts pin down in unit tests.

const { CLASS_LABELS } = require("./scoreDrop");
const { SITE_URL, escapeHtml, clamp } = require("./shareCards");

// Ranked-class display order for the public sheets (mirrors RECAP_CLASS_ORDER
// in src/pages/ScoresParts.jsx).
const RESULTS_CLASS_ORDER = ["worldClass", "openClass", "aClass"];

/**
 * Aggregate a day recap into per-class standings with caption totals.
 * Same accumulation shape as scoreDrop.aggregateNightlyStandings, plus
 * GE/VIS/MUS sums for the public box score. SoundSport is collected as a
 * scoreless medal list.
 *
 * @param {Object} recap fantasy_recaps day doc data ({shows: [...]}).
 * @returns {{
 *   byClass: Map<string, Array<{corpsName: string, displayName: string,
 *     total: number, ge: number|null, vis: number|null, mus: number|null, rank: number}>>,
 *   soundSport: Array<{corpsName: string, displayName: string, medal: string|null}>,
 *   shows: string[],
 * }}
 */
function aggregateDayResults(recap) {
  const shows = (recap && recap.shows) || [];
  const totals = new Map();
  const soundSportByUid = new Map();
  const showNames = [];

  for (const show of shows) {
    if (show.eventName || show.name) showNames.push(show.eventName || show.name);
    for (const result of show.results || []) {
      if (!result || !result.uid || !result.corpsClass) continue;
      if (result.corpsClass === "soundSport") {
        soundSportByUid.set(result.uid, {
          corpsName: result.corpsName || "",
          displayName: result.displayName || "",
          medal: result.medal || null,
        });
        continue;
      }
      if (!RESULTS_CLASS_ORDER.includes(result.corpsClass)) continue;
      const key = `${result.uid}_${result.corpsClass}`;
      const entry = totals.get(key) || {
        corpsClass: result.corpsClass,
        corpsName: result.corpsName || "",
        displayName: result.displayName || "",
        total: 0,
        ge: 0,
        vis: 0,
        mus: 0,
        hasCaptions: true,
      };
      entry.total += Number(result.totalScore ?? result.score) || 0;
      const ge = Number(result.geScore);
      const vis = Number(result.visualScore);
      const mus = Number(result.musicScore);
      // Legacy recap eras may lack caption fields; degrade the whole row to
      // total-only rather than showing partial sums as real numbers.
      if ([ge, vis, mus].some((v) => !Number.isFinite(v))) {
        entry.hasCaptions = false;
      } else {
        entry.ge += ge;
        entry.vis += vis;
        entry.mus += mus;
      }
      totals.set(key, entry);
    }
  }

  const byClass = new Map();
  for (const corpsClass of RESULTS_CLASS_ORDER) {
    const entries = [...totals.values()].filter((e) => e.corpsClass === corpsClass);
    if (entries.length === 0) continue;
    entries.sort((a, b) => b.total - a.total);
    byClass.set(
      corpsClass,
      entries.map((entry, index) => ({
        rank: index + 1,
        corpsName: entry.corpsName,
        displayName: entry.displayName,
        total: entry.total,
        ge: entry.hasCaptions ? entry.ge : null,
        vis: entry.hasCaptions ? entry.vis : null,
        mus: entry.hasCaptions ? entry.mus : null,
      }))
    );
  }

  return { byClass, soundSport: [...soundSportByUid.values()], shows: showNames };
}

// Shared page chrome. Inline CSS keeps the pages dependency-free and safe
// under any CSP (no external fetches at all).
const PAGE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body { background: #0A0A0A; color: #fff; font: 16px/1.5 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  a { color: #EAB308; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px 48px; }
  .brand { display: inline-block; font-weight: 700; color: #EAB308; font-size: 20px; }
  .kicker { color: #9CA3AF; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  h1 { font-size: 28px; margin: 18px 0 4px; }
  .sub { color: #9CA3AF; margin-bottom: 24px; }
  h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin: 28px 0 8px; color: #EAB308; }
  table { width: 100%; border-collapse: collapse; background: #141414; border: 1px solid #2A2A2A; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #2A2A2A; font-size: 14px; }
  th { color: #9CA3AF; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.total { color: #EAB308; font-weight: 700; }
  .dir { color: #9CA3AF; font-size: 12px; }
  .nav { display: flex; gap: 16px; flex-wrap: wrap; margin: 28px 0 0; }
  .cta { margin-top: 32px; padding: 16px; background: #141414; border: 1px solid #2A2A2A; }
  .days { display: flex; flex-wrap: wrap; gap: 8px; }
  .days a { border: 1px solid #2A2A2A; padding: 6px 10px; font-variant-numeric: tabular-nums; }
  footer { margin-top: 40px; color: #9CA3AF; font-size: 13px; }
`;

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.canonicalPath
 * @param {string} [params.ogImage]
 * @param {string} params.bodyHtml Pre-escaped body markup.
 */
function buildPageShell({ title, description, canonicalPath, ogImage, bodyHtml }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:site_name" content="marching.art">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : `<meta name="twitter:card" content="summary">`}
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<a class="brand" href="${SITE_URL}/">marching.art</a>
<div class="kicker">Fantasy Drum Corps</div>
${bodyHtml}
<div class="cta"><strong>Think your dream lineup scores higher?</strong><br>
marching.art is the free fantasy drum corps game — draft legendary DCI captions and compete on nightly leaderboards. <a href="${SITE_URL}/register">Create your corps free</a> or <a href="${SITE_URL}/preview">try the live demo</a>.</div>
<footer>marching.art — where legends are made. · <a href="${SITE_URL}/hall-of-champions">Hall of Champions</a> · <a href="${SITE_URL}/how-to-play">How to play</a></footer>
</div>
</body>
</html>
`;
}

/** @param {number|null} value */
const fmtScore = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "—";

/**
 * Day results page: per-class standings tables + SoundSport medal list.
 *
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} [params.seasonName]
 * @param {number} params.day
 * @param {Object} params.recap        Day recap doc data.
 * @param {number[]} [params.days]     All scored days (for prev/next + strip).
 * @returns {string|null} HTML, or null when the recap has no results at all.
 */
function buildDayResultsHtml({ seasonUid, seasonName, day, recap, days = [] }) {
  const { byClass, soundSport, shows } = aggregateDayResults(recap);
  if (byClass.size === 0 && soundSport.length === 0) return null;

  const displaySeason = seasonName || seasonUid;
  const base = `/results/${seasonUid}`;

  const sections = [];
  for (const classKey of RESULTS_CLASS_ORDER) {
    const entries = byClass.get(classKey);
    if (!entries) continue;
    const rows = entries
      .map(
        (e) => `<tr>
<td class="num">${e.rank}</td>
<td>${escapeHtml(clamp(e.corpsName, 60))}${e.displayName ? ` <span class="dir">· ${escapeHtml(clamp(e.displayName, 40))}</span>` : ""}</td>
<td class="num">${fmtScore(e.ge)}</td>
<td class="num">${fmtScore(e.vis)}</td>
<td class="num">${fmtScore(e.mus)}</td>
<td class="num total">${fmtScore(e.total)}</td>
</tr>`
      )
      .join("\n");
    sections.push(`<h2>${escapeHtml(CLASS_LABELS[classKey] || classKey)}</h2>
<table>
<thead><tr><th class="num">#</th><th>Corps</th><th class="num">GE</th><th class="num">VIS</th><th class="num">MUS</th><th class="num">Total</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`);
  }

  if (soundSport.length > 0) {
    const rows = soundSport
      .map(
        (e) => `<tr>
<td>${escapeHtml(clamp(e.corpsName, 60))}${e.displayName ? ` <span class="dir">· ${escapeHtml(clamp(e.displayName, 40))}</span>` : ""}</td>
<td>${escapeHtml(e.medal || "Performed")}</td>
</tr>`
      )
      .join("\n");
    sections.push(`<h2>SoundSport</h2>
<p class="sub">SoundSport is participation-focused — ensembles earn medal ratings, never numeric scores.</p>
<table>
<thead><tr><th>Ensemble</th><th>Rating</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`);
  }

  const dayIndex = days.indexOf(day);
  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;
  const nav = [
    prevDay != null ? `<a href="${base}/${prevDay}">← Day ${prevDay}</a>` : "",
    `<a href="${base}">All ${escapeHtml(displaySeason)} results</a>`,
    nextDay != null ? `<a href="${base}/${nextDay}">Day ${nextDay} →</a>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const showWord = shows.length === 1 ? "show" : "shows";
  const showList = shows.length > 0 ? clamp(shows.join(" · "), 140) : "";

  // OG card: the top ranked class present that day.
  const topClass = RESULTS_CLASS_ORDER.find((cls) => byClass.has(cls));
  const ogImage = topClass ? `${SITE_URL}/api/og/scores/${seasonUid}/${day}/${topClass}.png` : null;

  const leader = topClass ? byClass.get(topClass)[0] : null;
  const description = leader
    ? `Day ${day} fantasy drum corps results for ${displaySeason}: ${clamp(leader.corpsName, 50)} leads ${CLASS_LABELS[topClass]} with ${leader.total.toFixed(3)}. Full GE/Visual/Music standings for every class.`
    : `Day ${day} fantasy drum corps results for ${displaySeason} on marching.art.`;

  return buildPageShell({
    title: `Day ${day} Fantasy Scores — ${displaySeason} | marching.art`,
    description,
    canonicalPath: `${base}/${day}`,
    ogImage,
    bodyHtml: `<h1>Day ${day} — ${escapeHtml(displaySeason)}</h1>
<p class="sub">${shows.length > 0 ? `${shows.length} ${showWord} scored${showList ? ` · ${escapeHtml(showList)}` : ""}` : "Nightly fantasy results"}</p>
${sections.join("\n")}
<div class="nav">${nav}</div>`,
  });
}

/**
 * Season index page: day links plus the archived champions when present.
 *
 * @param {Object} params
 * @param {string} params.seasonUid
 * @param {string} [params.seasonName]
 * @param {number[]} params.days      Scored days, ascending.
 * @param {Object|null} [params.champions] season_champions doc data, if archived.
 * @returns {string|null} HTML, or null when the season has nothing to show.
 */
function buildSeasonIndexHtml({ seasonUid, seasonName, days, champions = null }) {
  const hasChampions =
    champions && champions.classes && Object.values(champions.classes).some((c) => c && c.length);
  if ((!days || days.length === 0) && !hasChampions) return null;

  const displaySeason = seasonName || (champions && champions.seasonName) || seasonUid;
  const base = `/results/${seasonUid}`;

  const sections = [];

  if (hasChampions) {
    const rows = [];
    for (const classKey of [...RESULTS_CLASS_ORDER, "soundSport"]) {
      const entries = (champions.classes && champions.classes[classKey]) || [];
      if (entries.length === 0) continue;
      const champ = entries[0];
      const soundSport = classKey === "soundSport";
      rows.push(`<tr>
<td>${escapeHtml(CLASS_LABELS[classKey] || classKey)}</td>
<td>${escapeHtml(clamp(champ.corpsName || "", 60))}${champ.username ? ` <span class="dir">· ${escapeHtml(clamp(champ.username, 40))}</span>` : ""}</td>
<td class="num total">${soundSport ? "Best in Show" : fmtScore(typeof champ.score === "number" ? champ.score : null)}</td>
</tr>`);
    }
    sections.push(`<h2>Season Champions</h2>
<table>
<thead><tr><th>Class</th><th>Champion</th><th class="num">Final</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>`);
  }

  if (days && days.length > 0) {
    const links = days.map((d) => `<a href="${base}/${d}">Day ${d}</a>`).join("\n");
    sections.push(`<h2>Nightly Results</h2>
<div class="days">
${links}
</div>`);
  }

  return buildPageShell({
    title: `${displaySeason} Fantasy Scores & Results | marching.art`,
    description: `Every scored night of ${displaySeason} fantasy drum corps${hasChampions ? ", plus the season champions" : ""} — full class standings on marching.art.`,
    canonicalPath: base,
    bodyHtml: `<h1>${escapeHtml(displaySeason)}</h1>
<p class="sub">Fantasy drum corps results, night by night.</p>
${sections.join("\n")}
<div class="nav"><a href="${SITE_URL}/hall-of-champions">Hall of Champions</a></div>`,
  });
}

/**
 * Parse a /results request path. Bare /results parses with a null seasonUid —
 * the endpoint redirects it to the current season's index.
 *
 * @param {string} path
 * @returns {{seasonUid: string | null, day: number|null} | null}
 */
function parseResultsPath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if (parts[0] !== "results") return null;
  if (parts.length === 1) return { seasonUid: null, day: null };

  const seasonUid = parts[1];
  if (!seasonUid || !/^[A-Za-z0-9_-]+$/.test(seasonUid)) return null;

  if (parts.length === 2) return { seasonUid, day: null };
  if (parts.length === 3) {
    const day = Number(parts[2]);
    if (!Number.isInteger(day) || day < 1 || day > 49) return null;
    return { seasonUid, day };
  }
  return null;
}

module.exports = {
  RESULTS_CLASS_ORDER,
  aggregateDayResults,
  buildDayResultsHtml,
  buildSeasonIndexHtml,
  parseResultsPath,
};
