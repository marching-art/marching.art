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
const { SITE_URL, escapeHtml, clamp } = require("./shareCards");
const { buildPageShell } = require("./resultsPages");

// Ranked classes first, SoundSport last — the same display order the profile
// UI uses (PROFILE_CORPS_CLASS_ORDER in src/utils/corps).
const PROFILE_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport"];

// Username shape enforced by the updateUsername callable (callable/profile.js):
// 3-15 chars, letters/digits/underscore. Anything else 404s before Firestore.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,15}$/;

/**
 * Parse a /d request path.
 *
 * @param {string} path
 * @returns {{username: string} | null}
 */
function parseDirectorPath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "d") return null;
  const username = parts[1];
  if (!USERNAME_PATTERN.test(username)) return null;
  return { username };
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
 * The director's corps as [classKey, corpsName] pairs in display order.
 * Only the name and class are surfaced — lineups and scores stay off the
 * public page (same anti-lineup-harvesting posture as the results pages).
 *
 * @param {Object} corps Profile corps record (class key -> corps data).
 * @returns {Array<{classKey: string, classLabel: string, corpsName: string}>}
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
    const rows = corpsEntries
      .map(
        (entry) => `<tr>
<td>${escapeHtml(entry.classLabel)}</td>
<td>${escapeHtml(clamp(entry.corpsName, 60))}</td>
</tr>`
      )
      .join("\n");
    sections.push(`<h2>Corps</h2>
<div class="scroll"><table>
<thead><tr><th>Class</th><th>Corps</th></tr></thead>
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

module.exports = {
  PROFILE_CLASS_ORDER,
  USERNAME_PATTERN,
  parseDirectorPath,
  isProfilePrivate,
  pickPublicProfile,
  listPublicCorps,
  memberSinceYear,
  buildDirectorPageHtml,
  buildPrivateDirectorPageHtml,
};
