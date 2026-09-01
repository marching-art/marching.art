// Public director profile pages: the crawlable, server-rendered surface for
// /d/{username}. The SPA profile route (/profile/:userId) is auth-walled and
// robots-disallowed, so before these pages existed a director had no URL they
// could hand to a friend who doesn't play — the share button pointed at a
// login wall. /d/{username} is plain HTML with real content, a canonical URL,
// an OG card, and a sitemap entry.
//
// Privacy rules honored here:
//   - The page renders ONLY the fields the getPublicProfile callable's
//     allowlist returns (callable/profile.js). pickPublicProfile mirrors that
//     allowlist field for field; anything else on the profile doc (email
//     never lives there, but settings, corpsCoin, engagement, etc. do) is
//     dropped before any HTML is built.
//   - directorInfo.profileVisibility === 'members' (src/types/user.ts) means
//     the director opted out of the public page: render a minimal, noindexed
//     "keeps their profile private" stub instead.
//
// Pure builders, no Firestore: the HTTP layer (triggers/publicProfilePages.js)
// resolves username -> profile doc and passes plain data in, so the layout,
// allowlisting, and escaping pin down in unit tests.

const { CLASS_LABELS } = require("./scoreDrop");
const { SITE_URL, escapeHtml, clamp, CLASS_SLUGS, SLUG_BY_CLASS } = require("./shareCards");
const { buildPageShell } = require("./resultsPages");
const { colorwayStrip } = require("./uniformValidation");

// Ranked classes first, SoundSport last — the same display order the profile
// UI uses (PROFILE_CORPS_CLASS_ORDER in src/utils/corps).
const PROFILE_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport"];

// Username shape enforced by the updateUsername callable (callable/profile.js):
// 3-15 chars, letters/digits/underscore. Anything else 404s before Firestore.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,15}$/;

// The program-page URL slugs (CLASS_SLUGS / SLUG_BY_CLASS) are imported from
// shareCards.js above — one definition serves both the page router here and
// the OG-card parser there.

/**
 * Parse a /d request path.
 *
 * Two shapes: /d/{username} (director profile) and /d/{username}/{classSlug}
 * (that corps' program page). An unknown slug is a 404, not the director page
 * — one URL must never render two different documents.
 *
 * @param {string} path
 * @returns {{username: string, classKey?: string} | null}
 */
function parseDirectorPath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if ((parts.length !== 2 && parts.length !== 3) || parts[0] !== "d") return null;
  const username = parts[1];
  if (!USERNAME_PATTERN.test(username)) return null;
  if (parts.length === 2) return { username };
  const classKey = CLASS_SLUGS[parts[2]];
  if (!classKey) return null;
  return { username, classKey };
}

/**
 * Whether the director opted out of the public page. Only an explicit
 * 'members' setting hides the page — the field is optional and profiles
 * default to public, matching the world-readable profile/data doc and the
 * getPublicProfile callable (which has no visibility gate at all).
 *
 * @param {Object | null | undefined} profileData Raw profile doc data.
 * @returns {boolean}
 */
function isProfilePrivate(profileData) {
  return profileData?.directorInfo?.profileVisibility === "members";
}

/**
 * Reduce a raw profile doc to EXACTLY the fields the getPublicProfile
 * callable returns (same defaults, same shapes). This is the single privacy
 * boundary for the SSR page: nothing below this function ever sees the raw
 * doc, so a new profile field is private here by default exactly as it is in
 * the callable.
 *
 * @param {Object} profileData Raw profile doc data.
 * @returns {{
 *   displayName: string, location: string, bio: string, favoriteCorps: string,
 *   xp: number, xpLevel: number, achievements: Array<Object>,
 *   stats: {seasonsPlayed: number, championships: number, topTenFinishes: number, leagueWins: number},
 *   createdAt: *, corps: Object,
 * }}
 */
function pickPublicProfile(profileData) {
  const data = profileData || {};
  return {
    displayName: data.displayName || "Unknown Director",
    location: data.location || "",
    bio: data.bio || "",
    favoriteCorps: data.favoriteCorps || "",
    xp: data.xp || 0,
    xpLevel: data.xpLevel || 1,
    achievements: Array.isArray(data.achievements) ? data.achievements : [],
    stats: data.stats || {
      seasonsPlayed: 0,
      championships: 0,
      topTenFinishes: 0,
      leagueWins: 0,
    },
    createdAt: data.createdAt,
    corps: data.corps || {},
  };
}

/**
 * The equipped Uniform Studio look, reduced to what the public page shows:
 * the look's name (bounded string) and a validated [primary, secondary,
 * accent] hex triple. Anything malformed drops the whole view — nothing
 * unvalidated from the snapshot reaches the SSR page.
 *
 * @param {Object|undefined} equipped corps.{class}.uniform snapshot.
 * @returns {{name: string, colors: string[]} | null}
 */
function pickPublicUniform(equipped) {
  if (!equipped || typeof equipped !== "object") return null;
  const colors = colorwayStrip(equipped.colorway);
  if (!colors) return null;
  const name = typeof equipped.name === "string" ? equipped.name.trim() : "";
  return { name: name || "Equipped uniform", colors };
}

/**
 * The director's corps as [classKey, corpsName] pairs in display order.
 * Only the name, class, and equipped-uniform view are surfaced — lineups and
 * scores stay off the public page (same anti-lineup-harvesting posture as the
 * results pages).
 *
 * @param {Object} corps Profile corps record (class key -> corps data).
 * @returns {Array<{classKey: string, classLabel: string, corpsName: string,
 *   uniform: {name: string, colors: string[]} | null}>}
 */
function listPublicCorps(corps) {
  const record = corps || {};
  const keys = [
    ...PROFILE_CLASS_ORDER.filter((key) => key in record),
    ...Object.keys(record).filter((key) => !PROFILE_CLASS_ORDER.includes(key)),
  ];
  const entries = [];
  for (const classKey of keys) {
    const corpsName =
      record[classKey] && typeof record[classKey].corpsName === "string"
        ? record[classKey].corpsName.trim()
        : "";
    if (!corpsName) continue;
    entries.push({
      classKey,
      classLabel: CLASS_LABELS[classKey] || classKey,
      corpsName,
      uniform: pickPublicUniform(record[classKey].uniform),
    });
  }
  return entries;
}

/** Year the profile was created, from a Firestore Timestamp/Date; null when unknown. */
function memberSinceYear(createdAt) {
  const date =
    createdAt && typeof createdAt.toDate === "function"
      ? createdAt.toDate()
      : createdAt instanceof Date
        ? createdAt
        : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

// Inline badge styling: the shared PAGE_CSS (resultsPages) has no badge
// class, and these two spots aren't worth growing the shared chrome for.
const BADGE_STYLE =
  "display:inline-block;border:1px solid #333333;background:#1A1A1A;" +
  "padding:4px 10px;margin:0 8px 8px 0;font-size:12px;letter-spacing:1px;" +
  "text-transform:uppercase;";

/**
 * Minimal stub for directors who set profileVisibility to 'members'.
 * Noindexed — an opt-out page must never rank for the director's name.
 *
 * @param {Object} params
 * @param {string} params.username
 * @returns {string}
 */
function buildPrivateDirectorPageHtml({ username }) {
  return buildPageShell({
    title: `@${username} | marching.art`,
    description: "This marching.art director keeps their profile private.",
    canonicalPath: `/d/${username}`,
    noindex: true,
    bodyHtml: `<div class="kicker">Fantasy Drum Corps · Director</div>
<h1>@${escapeHtml(username)}</h1>
<p class="sub">This director keeps their profile private.</p>
<div class="nav"><a href="${SITE_URL}/results">Latest results</a>
<a href="${SITE_URL}/hall-of-champions">Hall of Champions</a>
<a href="${SITE_URL}/">Home</a></div>`,
  });
}

/**
 * Full public director page.
 *
 * @param {Object} params
 * @param {string} params.username   Canonical username (as stored on the profile).
 * @param {Object} params.profile    RAW profile doc data — allowlisted in here.
 * @returns {string}
 */
function buildDirectorPageHtml({ username, profile }) {
  const view = pickPublicProfile(profile);
  const corpsEntries = listPublicCorps(view.corps);
  const sinceYear = memberSinceYear(view.createdAt);
  const stats = view.stats;

  const subParts = [
    `@${username}`,
    view.location ? clamp(view.location, 60) : "",
    sinceYear ? `Directing since ${sinceYear}` : "",
  ].filter(Boolean);

  const badges = [
    `Level ${Number(view.xpLevel) || 1}`,
    ...corpsEntries.map((entry) => entry.classLabel),
  ]
    .map((label) => `<span style="${BADGE_STYLE}">${escapeHtml(label)}</span>`)
    .join("\n");

  const sections = [];

  if (view.bio) {
    sections.push(`<h2>About</h2>
<p>${escapeHtml(clamp(view.bio, 500))}</p>`);
  }
  if (view.favoriteCorps) {
    sections.push(`<p class="sub">Favorite corps: ${escapeHtml(clamp(view.favoriteCorps, 100))}</p>`);
  }

  if (corpsEntries.length > 0) {
    // Equipped-uniform cell: the look's name beside its colorway as three
    // inline swatches. Colors come only from pickPublicUniform's validated
    // triple, so nothing unescaped reaches a style attribute.
    const uniformCell = (uniform) => {
      if (!uniform) return '<td class="sub">—</td>';
      const swatches = uniform.colors
        .map(
          (hex) =>
            `<span style="display:inline-block;width:12px;height:12px;border:1px solid #333333;background:${hex};margin-right:2px;"></span>`
        )
        .join("");
      return `<td>${swatches} ${escapeHtml(clamp(uniform.name, 40))}</td>`;
    };
    // Corps name links to its program page (/d/{username}/{slug}) — the
    // per-corps public surface with the show, the look, and season history.
    const corpsCell = (entry) => {
      const name = escapeHtml(clamp(entry.corpsName, 60));
      const slug = SLUG_BY_CLASS[entry.classKey];
      return slug
        ? `<a href="${SITE_URL}/d/${encodeURIComponent(username)}/${slug}">${name}</a>`
        : name;
    };
    const rows = corpsEntries
      .map(
        (entry) => `<tr>
<td>${escapeHtml(entry.classLabel)}</td>
<td>${corpsCell(entry)}</td>
${uniformCell(entry.uniform)}
</tr>`
      )
      .join("\n");
    sections.push(`<h2>Corps</h2>
<div class="scroll"><table>
<thead><tr><th>Class</th><th>Corps</th><th>Uniform</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`);
  }

  const statRows = [
    ["Seasons played", stats.seasonsPlayed],
    ["Championships", stats.championships],
    ["Top-10 finishes", stats.topTenFinishes],
    ["League wins", stats.leagueWins],
    ["Achievements", view.achievements.length],
    ["Experience", `Level ${Number(view.xpLevel) || 1}`],
  ]
    .map(
      ([label, value]) => `<tr>
<td>${escapeHtml(String(label))}</td>
<td class="num total">${escapeHtml(String(Number.isFinite(Number(value)) ? Number(value) : value || 0))}</td>
</tr>`
    )
    .join("\n");
  sections.push(`<h2>Career</h2>
<div class="scroll"><table>
<thead><tr><th>Stat</th><th class="num">Value</th></tr></thead>
<tbody>
${statRows}
</tbody>
</table></div>`);

  const canonicalPath = `/d/${username}`;
  const corpsSummary = corpsEntries.map((entry) => clamp(entry.corpsName, 40)).join(", ");
  const description = clamp(
    `${view.displayName} (@${username}) is a fantasy drum corps director on marching.art — ` +
      `level ${Number(view.xpLevel) || 1}, ${stats.seasonsPlayed || 0} season${
        (stats.seasonsPlayed || 0) === 1 ? "" : "s"
      } directed${
        (stats.championships || 0) > 0 ? `, ${stats.championships} championship${stats.championships === 1 ? "" : "s"}` : ""
      }${corpsSummary ? `. Corps: ${corpsSummary}` : ""}.`,
    250
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: clamp(view.displayName, 80),
      alternateName: username,
      ...(view.bio ? { description: clamp(view.bio, 200) } : {}),
      url: `${SITE_URL}${canonicalPath}`,
    },
  };

  return buildPageShell({
    title: `${clamp(view.displayName, 60)} (@${username}) — Fantasy Drum Corps Director | marching.art`,
    description,
    canonicalPath,
    ogImage: `${SITE_URL}/api/og/director/${encodeURIComponent(username)}.png`,
    jsonLd,
    bodyHtml: `<div class="kicker">Fantasy Drum Corps · Director</div>
<h1>${escapeHtml(clamp(view.displayName, 80))}</h1>
<p class="sub">${escapeHtml(subParts.join(" · "))}</p>
<div>${badges}</div>
${sections.join("\n")}
<div class="nav"><a href="${SITE_URL}/results">Latest results</a>
<a href="${SITE_URL}/hall-of-champions">Hall of Champions</a></div>
<a class="open-in-app" href="${SITE_URL}/profile/@${encodeURIComponent(username)}">Open in marching.art</a>`,
  });
}

// -----------------------------------------------------------------------------
// PROGRAM PAGES — /d/{username}/{classSlug}
// -----------------------------------------------------------------------------
// The per-corps page: the show, the look, and the record. Same privacy
// posture as the director page, plus one more rule inherited from the public
// results pages: SoundSport never exposes numeric scores, so a SoundSport
// program page lists seasons and shows attended with no numbers at all.

/** How many archived seasons the program page lists, newest first. */
const PROGRAM_HISTORY_LIMIT = 10;

/**
 * Reduce one corps entry to EXACTLY what its public program page shows.
 * Returns null when the director fields no corps in this class — the caller
 * 404s. Lineups, show picks, and weekly scores never pass this boundary
 * (same anti-lineup-harvesting posture as everything public).
 *
 * @param {Object} profileData Raw profile doc data.
 * @param {string} classKey
 * @returns {{
 *   corpsName: string,
 *   showConcept: {showName: string, theme: string, musicSource: string, drillStyle: string} | null,
 *   uniform: {name: string, colors: string[]} | null,
 *   uniformGuard: {name: string, colors: string[]} | null,
 *   seasons: Array<{seasonName: string, corpsName: string, totalSeasonScore: number,
 *     placement: number|null, showsAttended: number}>,
 * } | null}
 */
function pickPublicProgram(profileData, classKey) {
  const corps = profileData?.corps?.[classKey];
  const corpsName = corps && typeof corps.corpsName === "string" ? corps.corpsName.trim() : "";
  if (!corpsName) return null;

  const concept = corps.showConcept;
  const conceptField = (value) => (typeof value === "string" ? clamp(value.trim(), 80) : "");
  const showConcept =
    concept && typeof concept === "object" && (conceptField(concept.showName) || conceptField(concept.theme))
      ? {
          showName: conceptField(concept.showName),
          theme: conceptField(concept.theme),
          musicSource: conceptField(concept.musicSource),
          drillStyle: conceptField(concept.drillStyle),
        }
      : null;

  const history = Array.isArray(corps.seasonHistory) ? corps.seasonHistory : [];
  const seasons = history
    .filter((row) => row && typeof row === "object")
    // Stored oldest-first (rollover pushes); shown newest-first.
    .slice(-PROGRAM_HISTORY_LIMIT)
    .reverse()
    .map((row) => ({
      seasonName: typeof row.seasonName === "string" ? clamp(row.seasonName, 60) : "",
      corpsName: typeof row.corpsName === "string" ? clamp(row.corpsName, 60) : "",
      totalSeasonScore: Number(row.totalSeasonScore) || 0,
      placement: Number.isFinite(Number(row.placement)) && row.placement ? Number(row.placement) : null,
      showsAttended: Number(row.showsAttended) || 0,
    }));

  return {
    corpsName: clamp(corpsName, 60),
    showConcept,
    uniform: pickPublicUniform(corps.uniform),
    uniformGuard: pickPublicUniform(corps.uniformGuard),
    seasons,
  };
}

/** Inline swatch strip for a validated color triple. */
function swatchStrip(colors) {
  return colors
    .map(
      (hex) =>
        `<span style="display:inline-block;width:14px;height:14px;border:1px solid #333333;background:${hex};margin-right:3px;vertical-align:middle;"></span>`
    )
    .join("");
}

/** "3rd" / "12th" — placement ordinal for the history table. */
function placementLabel(placement) {
  if (!placement) return "—";
  const rem100 = placement % 100;
  const suffix =
    rem100 >= 11 && rem100 <= 13 ? "th" : (["th", "st", "nd", "rd"][placement % 10] ?? "th");
  return `${placement}${suffix}`;
}

/**
 * Full public program page for one corps.
 *
 * @param {Object} params
 * @param {string} params.username  Canonical username (as stored on the profile).
 * @param {Object} params.profile   RAW profile doc data — allowlisted in here.
 * @param {string} params.classKey
 * @returns {string | null} null when the director fields no corps in this class.
 */
function buildProgramPageHtml({ username, profile, classKey }) {
  const program = pickPublicProgram(profile, classKey);
  if (!program) return null;
  const view = pickPublicProfile(profile);
  const classLabel = CLASS_LABELS[classKey] || classKey;
  const slug = SLUG_BY_CLASS[classKey];
  const canonicalPath = `/d/${username}/${slug}`;
  const isSoundSport = classKey === "soundSport";

  const sections = [];

  if (program.showConcept) {
    const c = program.showConcept;
    const detailRows = [
      ["Theme", c.theme],
      ["Music", c.musicSource],
      ["Drill", c.drillStyle],
    ]
      .filter(([, value]) => value)
      .map(
        ([label, value]) => `<tr>
<td>${escapeHtml(label)}</td>
<td>${escapeHtml(value)}</td>
</tr>`
      )
      .join("\n");
    sections.push(`<h2>This Season's Program</h2>
${c.showName ? `<p><strong>“${escapeHtml(c.showName)}”</strong></p>` : ""}
${detailRows ? `<div class="scroll"><table><tbody>\n${detailRows}\n</tbody></table></div>` : ""}`);
  }

  const lookRow = (label, look) =>
    look
      ? `<tr>
<td>${escapeHtml(label)}</td>
<td>${swatchStrip(look.colors)} ${escapeHtml(clamp(look.name, 40))}</td>
</tr>`
      : "";
  const lookRows = [lookRow("Corps", program.uniform), lookRow("Color guard", program.uniformGuard)]
    .filter(Boolean)
    .join("\n");
  if (lookRows) {
    sections.push(`<h2>The Look</h2>
<div class="scroll"><table>
<thead><tr><th>Uniform</th><th>Design</th></tr></thead>
<tbody>
${lookRows}
</tbody>
</table></div>`);
  }

  if (program.seasons.length > 0) {
    // SoundSport is participation-focused: seasons and shows, never numbers —
    // the same rule the public results pages follow.
    const rows = program.seasons
      .map(
        (row) => `<tr>
<td>${escapeHtml(row.seasonName || "—")}</td>
<td>${escapeHtml(row.corpsName || program.corpsName)}</td>
${
  isSoundSport
    ? `<td class="num">${escapeHtml(String(row.showsAttended))}</td>`
    : `<td class="num total">${row.totalSeasonScore.toFixed(3)}</td>
<td>${escapeHtml(placementLabel(row.placement))}</td>
<td class="num">${escapeHtml(String(row.showsAttended))}</td>`
}
</tr>`
      )
      .join("\n");
    sections.push(`<h2>Season History</h2>
<div class="scroll"><table>
<thead><tr><th>Season</th><th>Corps</th>${
      isSoundSport
        ? "<th class=\"num\">Shows</th>"
        : "<th class=\"num\">Score</th><th>Placement</th><th class=\"num\">Shows</th>"
    }</tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
${isSoundSport ? '<p class="sub">SoundSport is participation-focused — ensembles earn ratings, never numeric scores.</p>' : ""}`);
  }

  const descriptionParts = [
    `${program.corpsName} is a ${classLabel} fantasy drum corps on marching.art, directed by ${view.displayName} (@${username}).`,
  ];
  if (program.showConcept?.showName) {
    descriptionParts.push(`This season's program: “${program.showConcept.showName}”.`);
  }
  if (program.seasons.length > 0 && !isSoundSport) {
    const best = program.seasons.reduce((a, b) => (b.totalSeasonScore > a.totalSeasonScore ? b : a));
    if (best.totalSeasonScore > 0) {
      descriptionParts.push(`Best season: ${best.totalSeasonScore.toFixed(3)} (${best.seasonName}).`);
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PerformingGroup",
    name: program.corpsName,
    url: `${SITE_URL}${canonicalPath}`,
    member: {
      "@type": "Person",
      name: clamp(view.displayName, 80),
      alternateName: username,
      url: `${SITE_URL}/d/${username}`,
    },
  };

  return buildPageShell({
    title: `${program.corpsName} — ${classLabel} Fantasy Drum Corps | marching.art`,
    description: clamp(descriptionParts.join(" "), 250),
    canonicalPath,
    ogImage: `${SITE_URL}/api/og/corps/${encodeURIComponent(username)}/${slug}.png`,
    jsonLd,
    bodyHtml: `<div class="kicker">Fantasy Drum Corps · ${escapeHtml(classLabel)}</div>
<h1>${escapeHtml(program.corpsName)}</h1>
<p class="sub">Directed by <a href="${SITE_URL}/d/${encodeURIComponent(username)}">${escapeHtml(
      clamp(view.displayName, 80)
    )}</a> (@${escapeHtml(username)})</p>
${sections.join("\n")}
<div class="nav"><a href="${SITE_URL}/d/${encodeURIComponent(username)}">Director profile</a>
<a href="${SITE_URL}/results">Latest results</a></div>
<a class="open-in-app" href="${SITE_URL}/profile/@${encodeURIComponent(username)}">Open in marching.art</a>`,
  });
}

module.exports = {
  PROFILE_CLASS_ORDER,
  USERNAME_PATTERN,
  CLASS_SLUGS,
  SLUG_BY_CLASS,
  parseDirectorPath,
  isProfilePrivate,
  pickPublicProfile,
  pickPublicProgram,
  listPublicCorps,
  memberSinceYear,
  buildDirectorPageHtml,
  buildProgramPageHtml,
  buildPrivateDirectorPageHtml,
};
