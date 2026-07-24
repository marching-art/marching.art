// Share-card builders: the pure string/layout layer behind the /share and
// /api/og endpoints (triggers/shareCards.js). Everything here is
// deterministic and side-effect free so the card layouts, escaping, and
// route parsing pin down in unit tests without Firebase or sharp.
//
// Cards are composed as 1200x630 SVG (the standard OG raster size) in the
// site's data-terminal style and rasterized to PNG by the HTTP layer —
// social scrapers do not accept SVG og:images. Text uses the fonts present
// in the Cloud Functions runtime image (DejaVu/Liberation), so no font
// embedding is needed.

const { CLASS_LABELS, aggregateNightlyStandings } = require("./scoreDrop");

const SITE_URL = "https://marching.art";

// Palette mirrors the app's tokens (docs/DESIGN_SYSTEM.md): near-black
// background, card surface, hairline borders, yellow accent.
const COLORS = {
  background: "#0A0A0A",
  surface: "#141414",
  line: "#2A2A2A",
  accent: "#EAB308",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  gold: "#EAB308",
  silver: "#C0C4CC",
  bronze: "#CD7F32",
};

const FONT_STACK = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

/** @param {string | number | null | undefined} value */
const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Same escapes cover HTML text/attribute contexts. */
const escapeHtml = escapeXml;

/** @param {string} name @param {number} max */
const clamp = (name, max) => {
  const text = String(name || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// -----------------------------------------------------------------------------
// SVG CARD
// -----------------------------------------------------------------------------

/**
 * Base 1200x630 card: brand header, title/subtitle, up to five ranked rows,
 * footer URL. All the specific card types (scores, champions) reduce to this.
 *
 * @param {Object} card
 * @param {string} card.kicker    Small uppercase line above the title.
 * @param {string} card.title     Main headline.
 * @param {string} [card.subtitle] Line under the title.
 * @param {Array<{rank: number, name: string, detail?: string, value?: string}>} card.rows
 * @param {string} [card.footer]  Bottom-left line (defaults to the site URL).
 * @returns {string} SVG document.
 */
function buildCardSvg({ kicker, title, subtitle, rows, footer }) {
  const rowLimit = 5;
  const shown = (rows || []).slice(0, rowLimit);

  // Geometry: rows start under the header block and the 5th row must clear
  // the footer baseline at y=608 (250 + 5*66 - 12 = 568).
  const rowHeight = 66;
  const rowsTop = subtitle ? 250 : 230;
  const rowBlocks = shown
    .map((row, index) => {
      const y = rowsTop + index * rowHeight;
      const rankColor =
        row.rank === 1
          ? COLORS.gold
          : row.rank === 2
            ? COLORS.silver
            : row.rank === 3
              ? COLORS.bronze
              : COLORS.muted;
      const detail = row.detail
        ? `<text x="180" y="${y + 46}" font-family="${FONT_STACK}" font-size="17" fill="${COLORS.muted}">${escapeXml(clamp(row.detail, 40))}</text>`
        : "";
      const value = row.value
        ? `<text x="1096" y="${y + 37}" text-anchor="end" font-family="${FONT_STACK}" font-size="30" font-weight="bold" fill="${COLORS.accent}">${escapeXml(row.value)}</text>`
        : "";
      return (
        `<g>` +
        `<rect x="80" y="${y}" width="1040" height="${rowHeight - 12}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="1"/>` +
        `<text x="112" y="${y + 37}" font-family="${FONT_STACK}" font-size="27" font-weight="bold" fill="${rankColor}">${row.rank}</text>` +
        `<text x="180" y="${y + (row.detail ? 27 : 36)}" font-family="${FONT_STACK}" font-size="${row.detail ? 23 : 27}" font-weight="bold" fill="${COLORS.text}">${escapeXml(clamp(row.name, 36))}</text>` +
        detail +
        value +
        `</g>`
      );
    })
    .join("\n    ");

  const subtitleBlock = subtitle
    ? `<text x="80" y="208" font-family="${FONT_STACK}" font-size="26" fill="${COLORS.muted}">${escapeXml(clamp(subtitle, 70))}</text>`
    : "";

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${COLORS.background}"/>
  <rect x="0" y="0" width="1200" height="6" fill="${COLORS.accent}"/>
  <text x="80" y="86" font-family="${FONT_STACK}" font-size="30" font-weight="bold" fill="${COLORS.accent}">marching.art</text>
  <text x="80" y="118" font-family="${FONT_STACK}" font-size="18" letter-spacing="3" fill="${COLORS.muted}">${escapeXml(kicker.toUpperCase())}</text>
  <text x="80" y="172" font-family="${FONT_STACK}" font-size="44" font-weight="bold" fill="${COLORS.text}">${escapeXml(clamp(title, 44))}</text>
  ${subtitleBlock}
    ${rowBlocks}
  <text x="80" y="608" font-family="${FONT_STACK}" font-size="20" fill="${COLORS.muted}">${escapeXml(footer || "marching.art — the fantasy drum corps game")}</text>
</svg>`;
}

/**
 * Nightly-results card for one class on one scored day.
 *
 * @param {Object} params
 * @param {Object} params.recap      fantasy_recaps day doc data.
 * @param {number} params.day        Scored day number.
 * @param {string} params.classKey   Registry class key (e.g. 'worldClass').
 * @param {string} [params.seasonName]
 * @returns {string | null} SVG, or null when the class has no results that day.
 */
function buildScoresCardSvg({ recap, day, classKey, seasonName }) {
  const { byClass, showCount } = aggregateNightlyStandings(recap);
  const entries = byClass.get(classKey);
  if (!entries || entries.length === 0) return null;

  const showWord = showCount === 1 ? "show" : "shows";
  const classLabel = CLASS_LABELS[classKey] || classKey;
  return buildCardSvg({
    kicker: "Fantasy Drum Corps · Nightly Scores",
    title: `Day ${day} — ${classLabel}`,
    subtitle: `${seasonName ? `${seasonName} · ` : ""}${showCount} ${showWord} scored · ${entries.length} corps`,
    rows: entries.slice(0, 5).map((entry) => ({
      rank: entry.rank,
      name: entry.corpsName || "Unknown Corps",
      detail: entry.displayName || undefined,
      value: entry.score.toFixed(3),
    })),
  });
}

/**
 * Season-champions card for one class of an archived season.
 *
 * @param {Object} params
 * @param {Object} params.champions  season_champions/{seasonId} doc data.
 * @param {string} params.classKey
 * @returns {string | null} SVG, or null when that class has no champions.
 */
function buildChampionCardSvg({ champions, classKey }) {
  const entries = (champions && champions.classes && champions.classes[classKey]) || [];
  if (entries.length === 0) return null;

  const classLabel = CLASS_LABELS[classKey] || classKey;
  const seasonName = champions.seasonName || "Season";
  // SoundSport is participation-focused: it recognizes "Best in Show" and its
  // ratings are never revealed as numeric scores anywhere in the product.
  const soundSport = classKey === "soundSport";
  return buildCardSvg({
    kicker: "Fantasy Drum Corps · Hall of Champions",
    title: soundSport ? `${seasonName} Best in Show` : `${seasonName} Champions`,
    subtitle: classLabel,
    rows: entries.slice(0, 5).map((entry, index) => ({
      rank: entry.rank || index + 1,
      name: entry.corpsName || "Unknown Corps",
      detail: entry.username || undefined,
      value: !soundSport && typeof entry.score === "number" ? entry.score.toFixed(3) : undefined,
    })),
  });
}

// -----------------------------------------------------------------------------
// SHARE PAGE HTML
// -----------------------------------------------------------------------------

/**
 * Minimal HTML served at /share/* URLs: social scrapers read the meta tags;
 * humans are bounced to the real app route via meta refresh + JS (scrapers
 * follow neither). The canonical points at the destination so crawlers
 * consolidate ranking signal there instead of on the share URL.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.imageUrl     Absolute URL of the og:image.
 * @param {string} params.redirectPath Site-relative destination for humans.
 * @param {string} [params.imageAlt]
 * @returns {string}
 */
function buildShareHtml({ title, description, imageUrl, redirectPath, imageAlt }) {
  const destination = `${SITE_URL}${redirectPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(destination)}">
<meta property="og:site_name" content="marching.art">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(destination)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(imageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}">
<script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(destination)}">${escapeHtml(destination)}</a>…</p>
</body>
</html>
`;
}

// -----------------------------------------------------------------------------
// ROUTE PARSING
// -----------------------------------------------------------------------------

// Conservative segment shapes: season/article ids are Firestore doc ids and
// composite article ids; class keys come from the registry via CLASS_LABELS.
const SEGMENT = /^[A-Za-z0-9_-]+$/;

/** @param {string} value */
const isValidClassKey = (value) => Object.prototype.hasOwnProperty.call(CLASS_LABELS, value);

/**
 * Parse an /api/og request path into a card descriptor.
 * Shapes: /api/og/scores/{seasonUid}/{day}/{classKey}.png
 *         /api/og/champion/{seasonId}/{classKey}.png
 *
 * @param {string} path
 * @returns {{type: 'scores', seasonUid: string, day: number, classKey: string}
 *   | {type: 'champion', seasonId: string, classKey: string}
 *   | null}
 */
function parseOgPath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  // parts: ['api', 'og', kind, ...rest]
  if (parts[0] !== "api" || parts[1] !== "og") return null;
  const kind = parts[2];

  if (kind === "scores" && parts.length === 6) {
    const [seasonUid, dayRaw, classFile] = parts.slice(3);
    const classKey = classFile.replace(/\.png$/, "");
    const day = Number(dayRaw);
    if (!SEGMENT.test(seasonUid) || !Number.isInteger(day) || day < 1 || day > 49) return null;
    if (!isValidClassKey(classKey)) return null;
    return { type: "scores", seasonUid, day, classKey };
  }

  if (kind === "champion" && parts.length === 5) {
    const [seasonId, classFile] = parts.slice(3);
    const classKey = classFile.replace(/\.png$/, "");
    if (!SEGMENT.test(seasonId) || !isValidClassKey(classKey)) return null;
    return { type: "champion", seasonId, classKey };
  }

  return null;
}

/**
 * Parse a /share request path.
 * Shapes: /share/article/{articleId}
 *         /share/scores/{seasonUid}/{day}/{classKey}
 *         /share/champion/{seasonId}/{classKey}
 *
 * @param {string} path
 * @returns {{type: 'article', articleId: string}
 *   | {type: 'scores', seasonUid: string, day: number, classKey: string}
 *   | {type: 'champion', seasonId: string, classKey: string}
 *   | null}
 */
function parseSharePath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if (parts[0] !== "share") return null;
  const kind = parts[1];

  if (kind === "article" && parts.length === 3 && SEGMENT.test(parts[2])) {
    return { type: "article", articleId: parts[2] };
  }

  if (kind === "scores" && parts.length === 5) {
    const [seasonUid, dayRaw, classKey] = parts.slice(2);
    const day = Number(dayRaw);
    if (!SEGMENT.test(seasonUid) || !Number.isInteger(day) || day < 1 || day > 49) return null;
    if (!isValidClassKey(classKey)) return null;
    return { type: "scores", seasonUid, day, classKey };
  }

  if (kind === "champion" && parts.length === 4) {
    const [seasonId, classKey] = parts.slice(2);
    if (!SEGMENT.test(seasonId) || !isValidClassKey(classKey)) return null;
    return { type: "champion", seasonId, classKey };
  }

  return null;
}

module.exports = {
  SITE_URL,
  buildCardSvg,
  buildScoresCardSvg,
  buildChampionCardSvg,
  buildShareHtml,
  parseOgPath,
  parseSharePath,
  escapeHtml,
  clamp,
};
