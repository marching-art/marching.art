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
const { COLORS, FONT_STACK } = require("./designTokens");
// Championship-week cuts, from the same function that decides who the scorer
// actually enrolls the next night — never a second implementation of "top 25".
const { cutForDrop } = require("./championshipCuts");

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
 *   byClass: Map<string, Array<{uid: string, corpsName: string, displayName: string,
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
        uid: result.uid,
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
        // Carried through so a championship-week cut can be matched back onto
        // the row it belongs to (the cut is decided per uid + class).
        uid: entry.uid,
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
// under the site's CSP (no external fetches at all) — but the values come from
// helpers/designTokens, which mirrors tailwind.config.cjs, so this surface can
// no longer drift away from the app the way it had.
//
// Note the link color: brand gold used to style every link and heading here,
// which is the one thing tailwind.config.cjs calls out by name as forbidden
// ("NEVER a generic UI accent — that job belongs to `interactive`"). Gold is
// now reserved for the wordmark and the winning total, as it is in the app.
const PAGE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body { background: ${COLORS.background}; color: ${COLORS.textMain}; font: 16px/1.5 ${FONT_STACK}; }
  a { color: ${COLORS.interactive}; text-decoration: none; }
  a:hover { color: ${COLORS.interactiveHover}; text-decoration: underline; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 0 16px 48px; }
  .site-header { border-bottom: 1px solid ${COLORS.line}; background: ${COLORS.surfaceCard}; margin: 0 -16px 24px; padding: 0 16px; height: 56px; display: flex; align-items: center; }
  .brand { display: flex; align-items: center; gap: 10px; color: ${COLORS.textMain}; font-weight: 700; font-size: 16px; letter-spacing: 1px; }
  .brand img { width: 32px; height: 32px; display: block; }
  .brand:hover { color: ${COLORS.textMain}; text-decoration: none; }
  .header-links { margin-left: auto; display: flex; gap: 16px; font-size: 13px; }
  .kicker { color: ${COLORS.textMuted}; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }
  h1 { font-size: 28px; margin: 8px 0 4px; }
  .sub { color: ${COLORS.textMuted}; margin-bottom: 24px; }
  h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin: 28px 0 8px; color: ${COLORS.textSecondary}; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: ${COLORS.surfaceCard}; border: 1px solid ${COLORS.line}; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid ${COLORS.line}; font-size: 14px; }
  th { color: ${COLORS.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: ${COLORS.surfaceRaised}; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.total { color: ${COLORS.brand}; font-weight: 700; }
  .dir { color: ${COLORS.textMuted}; font-size: 12px; }
  .cut { margin: 20px 0 0; padding: 10px 12px; background: ${COLORS.surfaceCard}; border-left: 3px solid ${COLORS.success}; font-size: 14px; }
  .adv-tag { color: ${COLORS.success}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .adv-count { color: ${COLORS.success}; font-size: 11px; letter-spacing: 1px; }
  tr.adv td { background: ${COLORS.surfaceRaised}; }
  .nav { display: flex; gap: 16px; flex-wrap: wrap; margin: 28px 0 0; }
  .cta { margin-top: 32px; padding: 16px; background: ${COLORS.surfaceCard}; border: 1px solid ${COLORS.line}; }
  .open-in-app { display: inline-block; margin-top: 16px; padding: 8px 14px; background: ${COLORS.interactive}; color: ${COLORS.textMain}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .open-in-app:hover { background: ${COLORS.interactiveHover}; color: ${COLORS.textMain}; text-decoration: none; }
  .days { display: flex; flex-wrap: wrap; gap: 8px; }
  .days a { border: 1px solid ${COLORS.line}; padding: 6px 10px; font-variant-numeric: tabular-nums; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid ${COLORS.line}; color: ${COLORS.textMuted}; font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px 20px; }
`;

// Mirrors src/components/Layout/SiteFooter.jsx. Both surfaces carry the same
// link set so a visitor crossing between them sees one site.
const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-to-play", label: "How to Play" },
  { href: "/podium-guide", label: "Podium Guide" },
  { href: "/hall-of-champions", label: "Hall of Champions" },
  { href: "/results", label: "Results" },
  { href: "mailto:support@marching.art", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const footerHtml = () =>
  `<footer>${FOOTER_LINKS.map(
    (link) =>
      `<a href="${link.href.startsWith("mailto:") ? link.href : `${SITE_URL}${link.href}`}">${escapeHtml(link.label)}</a>`
  ).join("\n")}</footer>`;

/**
 * Serialize structured data for embedding in a <script> block.
 *
 * escapeHtml is wrong here — the payload has to stay valid JSON, so entities
 * would corrupt it. Instead escape the three characters that can break out of
 * a script element as JSON string escapes, which parsers read back verbatim.
 * Corps names are user-authored, so without this a name of
 * `</script><script>…` executes.
 *
 * @param {Object} data
 * @returns {string}
 */
function serializeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// The site header, matching src/components/Layout/SiteHeader.jsx: the same
// logo mark and wordmark rather than the bare text link this used to carry.
const headerHtml = () =>
  `<header class="site-header">
<a class="brand" href="${SITE_URL}/"><img src="${SITE_URL}/logo192.svg" alt="" width="32" height="32">marching.art</a>
<nav class="header-links">
<a href="${SITE_URL}/how-to-play">How to Play</a>
<a href="${SITE_URL}/register">Sign Up Free</a>
</nav>
</header>`;

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.canonicalPath
 * @param {string} [params.ogImage]
 * @param {string} params.bodyHtml Pre-escaped body markup.
 * @param {boolean} [params.noindex] For the error pages, which must never rank.
 * @param {Object|null} [params.jsonLd] Structured data for the page.
 */
function buildPageShell({
  title,
  description,
  canonicalPath,
  ogImage,
  bodyHtml,
  noindex = false,
  jsonLd = null,
}) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${noindex ? `<meta name="robots" content="noindex, nofollow">\n` : ""}<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="icon" href="${SITE_URL}/favicon.svg" type="image/svg+xml">
<meta property="og:site_name" content="marching.art">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : `<meta name="twitter:card" content="summary">`}
<style>${PAGE_CSS}</style>
${jsonLd ? `<script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>` : ""}
</head>
<body>
<div class="wrap">
${headerHtml()}
${bodyHtml}
<div class="cta"><strong>Think your dream lineup scores higher?</strong><br>
marching.art is the free fantasy drum corps game — draft legendary DCI captions and compete on nightly leaderboards. <a href="${SITE_URL}/register">Create your corps free</a> or <a href="${SITE_URL}/preview">try the live demo</a>.</div>
${footerHtml()}
</div>
</body>
</html>
`;
}

/**
 * A styled page for the endpoint's error responses. These used to be bare
 * strings — Express serves them as text/html, so a crawler or a phone hitting a
 * dead day got an unstyled document with no charset, no viewport, and no way
 * back into the site.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.heading
 * @param {string} params.message
 * @param {string} [params.canonicalPath]
 */
function buildErrorPageHtml({ title, heading, message, canonicalPath = "/results" }) {
  return buildPageShell({
    title,
    description: message,
    canonicalPath,
    noindex: true,
    bodyHtml: `<div class="kicker">Fantasy Drum Corps</div>
<h1>${escapeHtml(heading)}</h1>
<p class="sub">${escapeHtml(message)}</p>
<div class="nav"><a href="${SITE_URL}/results">All results</a>
<a href="${SITE_URL}/hall-of-champions">Hall of Champions</a>
<a href="${SITE_URL}/">Home</a></div>`,
  });
}

/**
 * Door back into the app for a director who already has an account.
 *
 * Score share links land here (see triggers/shareCards.js), so the likeliest
 * visitor to a results page is a signed-in director's friend — and until now
 * the only calls to action were "create your corps" and "try the demo", both
 * useless to someone who already plays. /scores honors ?season and ?tab; there
 * is no per-day param, so this lands them on the right season's fantasy view.
 *
 * @param {string} seasonUid
 */
const openInAppHtml = (seasonUid) =>
  `<a class="open-in-app" href="${SITE_URL}/scores?season=${encodeURIComponent(seasonUid)}&amp;tab=fantasy">Open in marching.art</a>`;

/** @param {number|null} value */
const fmtScore = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "—";

/**
 * The cut banner over a championship-week night's tables: the rule, how many
 * survive it, and where the line fell.
 *
 * @param {?Object} cut From championshipCuts.cutForDrop.
 * @param {number} day The night being rendered.
 * @returns {string} Markup, or "" on a night that decides nothing.
 */
function cutBannerHtml(cut, day) {
  if (!cut) return "";
  const missed =
    cut.missed > 0 && typeof cut.cutLine === "number"
      ? ` ${cut.missed} ${cut.missed === 1 ? "corps misses" : "corps miss"} the cut, at ${cut.cutLine.toFixed(3)}.`
      : "";
  return `<p class="cut"><strong>${escapeHtml(cut.rule)}.</strong> ${cut.advancing.length} corps advance from Day ${day} to ${escapeHtml(clamp(cut.eventName, 90))} on Day ${cut.announcedDay}.${escapeHtml(missed)}</p>`;
}

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

  // On the three nights that end in a cut, the page says who marches tomorrow
  // — the single most interesting fact about a prelims or semifinals night, and
  // the reason anyone opens the page at all. Null on every other night.
  const cut = cutForDrop(recap, day);
  const advancing = new Set(
    (cut ? cut.advancing : []).map((row) => `${row.uid}_${row.corpsClass}`)
  );

  const sections = [];
  for (const classKey of RESULTS_CLASS_ORDER) {
    const entries = byClass.get(classKey);
    if (!entries) continue;
    const rows = entries
      .map((e) => {
        const advances = advancing.has(`${e.uid}_${classKey}`);
        return `<tr${advances ? ` class="adv"` : ""}>
<td class="num">${e.rank}</td>
<td>${escapeHtml(clamp(e.corpsName, 60))}${e.displayName ? ` <span class="dir">· ${escapeHtml(clamp(e.displayName, 40))}</span>` : ""}${advances ? ` <span class="adv-tag">Advances</span>` : ""}</td>
<td class="num">${fmtScore(e.ge)}</td>
<td class="num">${fmtScore(e.vis)}</td>
<td class="num">${fmtScore(e.mus)}</td>
<td class="num total">${fmtScore(e.total)}</td>
</tr>`;
      })
      .join("\n");
    const advancingInClass = cut
      ? entries.filter((e) => advancing.has(`${e.uid}_${classKey}`)).length
      : 0;
    sections.push(`<h2>${escapeHtml(CLASS_LABELS[classKey] || classKey)}${
      cut ? ` <span class="adv-count">${advancingInClass} advance</span>` : ""
    }</h2>
<div class="scroll"><table>
<thead><tr><th class="num">#</th><th>Corps</th><th class="num">GE</th><th class="num">VIS</th><th class="num">MUS</th><th class="num">Total</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`);
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
<div class="scroll"><table>
<thead><tr><th>Ensemble</th><th>Rating</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`);
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

  // Structured data for the top class's standings. This is the most structured
  // content on the site and it emitted none, while the SPA has supported JSON-LD
  // for articles all along.
  const jsonLd = leader
    ? {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Day ${day} ${CLASS_LABELS[topClass]} standings — ${displaySeason}`,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: byClass.get(topClass).length,
      itemListElement: byClass.get(topClass).map((entry) => ({
        "@type": "ListItem",
        position: entry.rank,
        name: clamp(entry.corpsName, 60),
      })),
    }
    : null;

  return buildPageShell({
    title: `Day ${day} Fantasy Scores — ${displaySeason} | marching.art`,
    description,
    canonicalPath: `${base}/${day}`,
    ogImage,
    jsonLd,
    bodyHtml: `<div class="kicker">Fantasy Drum Corps</div>
<h1>Day ${day} — ${escapeHtml(displaySeason)}</h1>
<p class="sub">${shows.length > 0 ? `${shows.length} ${showWord} scored${showList ? ` · ${escapeHtml(showList)}` : ""}` : "Nightly fantasy results"}</p>
${cutBannerHtml(cut, day)}
${sections.join("\n")}
<div class="nav">${nav}</div>
${openInAppHtml(seasonUid)}`,
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
<div class="scroll"><table>
<thead><tr><th>Class</th><th>Champion</th><th class="num">Final</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table></div>`);
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
    bodyHtml: `<div class="kicker">Fantasy Drum Corps</div>
<h1>${escapeHtml(displaySeason)}</h1>
<p class="sub">Fantasy drum corps results, night by night.</p>
${sections.join("\n")}
<div class="nav"><a href="${SITE_URL}/hall-of-champions">Hall of Champions</a></div>
${openInAppHtml(seasonUid)}`,
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
  buildErrorPageHtml,
  // Shared page chrome (header/footer/meta/CSS) — also the shell for the
  // public director pages (helpers/publicProfilePages.js), so both public
  // surfaces stay one site.
  buildPageShell,
  parseResultsPath,
};
