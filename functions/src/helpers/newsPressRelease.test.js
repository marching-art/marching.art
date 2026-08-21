// Unit tests for the pure press-release helpers: corps-byline resolution,
// input validation, and article-document shaping. These run with no Firestore
// (node --test) because the logic they guard — who a release is bylined to, and
// the exact document that gets published unreviewed — is the accountability the
// missing review step would otherwise provide.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveOwnedCorps,
  validatePressReleaseInput,
  buildPressReleaseArticle,
  rehostUserImageUrl,
  PRESS_RELEASE_LIMITS,
} = require("./newsSubmissionsShared");

// ---------------------------------------------------------------------------
// resolveOwnedCorps
// ---------------------------------------------------------------------------

test("resolveOwnedCorps honors a requested class the author owns", () => {
  const corps = {
    worldClass: { corpsName: "Aurora", location: "Denver, CO" },
    aClass: { corpsName: "Aurora Cadets", location: "Denver, CO" },
  };
  const byline = resolveOwnedCorps(corps, "aClass");
  assert.equal(byline.corpsClass, "aClass");
  assert.equal(byline.corpsName, "Aurora Cadets");
  assert.equal(byline.location, "Denver, CO");
});

test("resolveOwnedCorps falls back to the highest class when none requested", () => {
  const corps = {
    aClass: { corpsName: "Aurora Cadets" },
    worldClass: { corpsName: "Aurora" },
  };
  const byline = resolveOwnedCorps(corps, null);
  assert.equal(byline.corpsClass, "worldClass");
  assert.equal(byline.corpsName, "Aurora");
});

test("resolveOwnedCorps falls back when the requested class is not owned", () => {
  const corps = { openClass: { corpsName: "Aurora Open" } };
  const byline = resolveOwnedCorps(corps, "worldClass");
  assert.equal(byline.corpsClass, "openClass");
  assert.equal(byline.corpsName, "Aurora Open");
});

test("resolveOwnedCorps bylines a Podium-only director's corps", () => {
  // A Podium director keeps their competitive state server-side; the profile's
  // corps.podiumClass is a display copy carrying the corpsName the byline needs.
  const corps = { podiumClass: { corpsName: "Canton Regiment", location: "Canton, OH" } };
  const byline = resolveOwnedCorps(corps, null);
  assert.equal(byline.corpsClass, "podiumClass");
  assert.equal(byline.corpsName, "Canton Regiment");
  assert.equal(byline.location, "Canton, OH");
});

test("resolveOwnedCorps honors an explicitly requested Podium corps", () => {
  const corps = {
    worldClass: { corpsName: "Aurora" },
    podiumClass: { corpsName: "Aurora Podium" },
  };
  const byline = resolveOwnedCorps(corps, "podiumClass");
  assert.equal(byline.corpsClass, "podiumClass");
  assert.equal(byline.corpsName, "Aurora Podium");
});

test("resolveOwnedCorps defaults to a fantasy corps over Podium when none requested", () => {
  // Podium sits last in the preference order, so a director's competing fantasy
  // corps stays the default org voice unless Podium is explicitly chosen.
  const corps = {
    podiumClass: { corpsName: "Aurora Podium" },
    aClass: { corpsName: "Aurora Cadets" },
  };
  const byline = resolveOwnedCorps(corps, null);
  assert.equal(byline.corpsClass, "aClass");
  assert.equal(byline.corpsName, "Aurora Cadets");
});

test("resolveOwnedCorps returns null when the author owns no corps", () => {
  assert.equal(resolveOwnedCorps(null, "worldClass"), null);
  assert.equal(resolveOwnedCorps({}, null), null);
  assert.equal(resolveOwnedCorps({ worldClass: {} }, null), null);
});

test("resolveOwnedCorps normalizes a blank location to null", () => {
  const byline = resolveOwnedCorps({ worldClass: { corpsName: "Aurora", location: "   " } }, null);
  assert.equal(byline.location, null);
});

// ---------------------------------------------------------------------------
// validatePressReleaseInput
// ---------------------------------------------------------------------------

const validBody = "Aurora is proud to announce our 2026 production, a bold reimagining of the night sky.";

test("validatePressReleaseInput accepts a well-formed release", () => {
  const result = validatePressReleaseInput({
    headline: "Aurora Announces 2026 Program",
    summary: "Our new show goes public.",
    body: validBody,
  });
  assert.equal(result.valid, true);
  assert.equal(result.cleaned.headline, "Aurora Announces 2026 Program");
  assert.equal(result.cleaned.body, validBody);
  assert.equal(result.cleaned.imageUrl, null);
});

test("validatePressReleaseInput trims fields", () => {
  const result = validatePressReleaseInput({
    headline: "   Aurora Announces 2026   ",
    body: `   ${validBody}   `,
  });
  assert.equal(result.valid, true);
  assert.equal(result.cleaned.headline, "Aurora Announces 2026");
  assert.equal(result.cleaned.body, validBody);
});

test("validatePressReleaseInput derives a summary from the body when omitted", () => {
  const result = validatePressReleaseInput({ headline: "Aurora Announces 2026", body: validBody });
  assert.equal(result.valid, true);
  assert.ok(result.cleaned.summary.length > 0);
  assert.ok(validBody.startsWith(result.cleaned.summary.slice(0, 20)));
});

test("validatePressReleaseInput rejects a short headline", () => {
  const result = validatePressReleaseInput({ headline: "Hi", body: validBody });
  assert.equal(result.valid, false);
  assert.match(result.error, /Headline/);
});

test("validatePressReleaseInput rejects an over-long headline", () => {
  const result = validatePressReleaseInput({
    headline: "A".repeat(PRESS_RELEASE_LIMITS.headlineMax + 1),
    body: validBody,
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /Headline/);
});

test("validatePressReleaseInput rejects a short body", () => {
  const result = validatePressReleaseInput({ headline: "Aurora Announces", body: "too short" });
  assert.equal(result.valid, false);
  assert.match(result.error, /announcement/);
});

test("validatePressReleaseInput rejects an over-long body", () => {
  const result = validatePressReleaseInput({
    headline: "Aurora Announces 2026",
    body: "A".repeat(PRESS_RELEASE_LIMITS.bodyMax + 1),
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /announcement/);
});

test("validatePressReleaseInput accepts an http(s) image URL", () => {
  const result = validatePressReleaseInput({
    headline: "Aurora Announces 2026",
    body: validBody,
    imageUrl: "https://cdn.example.com/aurora.jpg",
  });
  assert.equal(result.valid, true);
  assert.equal(result.cleaned.imageUrl, "https://cdn.example.com/aurora.jpg");
});

test("validatePressReleaseInput rejects a non-http image scheme", () => {
  const result = validatePressReleaseInput({
    headline: "Aurora Announces 2026",
    body: validBody,
    imageUrl: "javascript:alert(1)",
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /http/);
});

test("validatePressReleaseInput rejects a malformed image URL", () => {
  const result = validatePressReleaseInput({
    headline: "Aurora Announces 2026",
    body: validBody,
    imageUrl: "not a url",
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /valid/);
});

// ---------------------------------------------------------------------------
// buildPressReleaseArticle
// ---------------------------------------------------------------------------

test("buildPressReleaseArticle shapes a published article document", () => {
  const now = new Date("2026-08-11T18:00:00Z");
  const { article, articlePath, articleType } = buildPressReleaseArticle({
    id: "abc123",
    cleaned: { headline: "Aurora Announces 2026", summary: "New show.", body: validBody, imageUrl: null },
    corps: { corpsClass: "worldClass", corpsName: "Aurora", location: "Denver, CO" },
    author: { uid: "user_1", authorName: "Chris", authorUsername: "chris", authorLocation: null },
    seasonId: "scherzo_2025-26",
    currentDay: 12,
    now,
  });

  assert.equal(articleType, "press_abc123");
  assert.equal(articlePath, "news_hub/scherzo_2025-26/days/day_12/articles/press_abc123");
  assert.equal(article.category, "press");
  assert.equal(article.isPublished, true);
  assert.equal(article.corpsName, "Aurora");
  assert.equal(article.corpsClass, "worldClass");
  assert.equal(article.narrative, validBody);
  assert.equal(article.authorUid, "user_1");
  // Corps location wins for the byline location.
  assert.equal(article.authorLocation, "Denver, CO");
  assert.equal(article.metadata.source, "director_press_release");
  assert.equal(article.imageIsPlaceholder, true);
  assert.equal(article.reportDay, 12);
});

test("buildPressReleaseArticle marks a supplied image as non-placeholder", () => {
  const { article } = buildPressReleaseArticle({
    id: "img1",
    cleaned: {
      headline: "Aurora Announces 2026",
      summary: "New show.",
      body: validBody,
      imageUrl: "https://cdn.example.com/a.jpg",
    },
    corps: { corpsClass: "worldClass", corpsName: "Aurora", location: null },
    author: { uid: "u", authorName: "Chris", authorUsername: "chris", authorLocation: "Ohio" },
    seasonId: "s",
    currentDay: 1,
  });
  assert.equal(article.imageUrl, "https://cdn.example.com/a.jpg");
  assert.equal(article.imageIsPlaceholder, false);
  // With no corps location, the author's own location fills the byline.
  assert.equal(article.authorLocation, "Ohio");
});

// ---------------------------------------------------------------------------
// rehostUserImageUrl — author-supplied image URLs must land on a CSP-allowed
// host, never be stored raw (a raw linked URL is blocked by img-src and the
// photo never displays). These cases are deterministic with no Cloudinary
// credentials configured, so they need no network.
// ---------------------------------------------------------------------------

test("rehostUserImageUrl returns null for empty/blank input", async () => {
  assert.equal(await rehostUserImageUrl(""), null);
  assert.equal(await rehostUserImageUrl("   "), null);
  assert.equal(await rehostUserImageUrl(null), null);
  assert.equal(await rehostUserImageUrl(undefined), null);
});

test("rehostUserImageUrl returns null (never the raw URL) when re-hosting cannot produce a CSP-safe URL", async () => {
  // With no Cloudinary creds, uploadFromUrl cannot re-host a remote URL and
  // yields a placeholder; rehostUserImageUrl reports that as null so the caller
  // publishes without an image rather than storing the CSP-blocked linked URL.
  const raw = "https://i.imgur.com/definitely-not-rehosted.jpg";
  const result = await rehostUserImageUrl(raw, { publicId: "press_test" });
  assert.notEqual(result, raw);
  assert.equal(result, null);
});
