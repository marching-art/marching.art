// Tests for the public director page layer: path parsing (the security
// boundary for an unauthenticated endpoint), the visibility gate, the
// field allowlist that IS the privacy boundary, and escaping of
// director-controlled text into HTML.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  parseDirectorPath,
  isProfilePrivate,
  pickPublicProfile,
  listPublicCorps,
  buildDirectorPageHtml,
  buildPrivateDirectorPageHtml,
} = require("./publicProfilePages");

describe("parseDirectorPath", () => {
  test("accepts a well-formed username path", () => {
    assert.deepEqual(parseDirectorPath("/d/Rohn_99"), { username: "Rohn_99" });
    assert.deepEqual(parseDirectorPath("d/abc"), { username: "abc" });
  });

  test("rejects paths outside /d/{username}", () => {
    for (const path of ["/", "/d", "/d/", "/x/name", "/d/name/extra", "", null, undefined]) {
      assert.equal(parseDirectorPath(path), null, `expected null for ${JSON.stringify(path)}`);
    }
  });

  test("rejects usernames the updateUsername callable could never mint", () => {
    // Length bounds, and anything that could walk the Firestore path or
    // smuggle markup: the parse is what stops it before a lookup happens.
    for (const bad of ["ab", "a".repeat(16), "has space", "dot.name", "sl/ash", "<script>", "e%20"]) {
      assert.equal(parseDirectorPath(`/d/${bad}`), null, `expected null for ${bad}`);
    }
  });
});

describe("isProfilePrivate", () => {
  test("only an explicit members-only setting hides the page", () => {
    assert.equal(isProfilePrivate({ directorInfo: { profileVisibility: "members" } }), true);
  });

  test("profiles default to public, matching the world-readable doc", () => {
    assert.equal(isProfilePrivate({}), false);
    assert.equal(isProfilePrivate({ directorInfo: {} }), false);
    assert.equal(isProfilePrivate({ directorInfo: { profileVisibility: "public" } }), false);
    assert.equal(isProfilePrivate(null), false);
    assert.equal(isProfilePrivate(undefined), false);
  });
});

describe("pickPublicProfile", () => {
  test("drops every field outside the getPublicProfile allowlist", () => {
    const picked = pickPublicProfile({
      displayName: "Chris",
      corpsCoin: 999999,
      email: "secret@example.com",
      fcmToken: "token",
      engagement: { lastLogin: "yesterday" },
      seasonHistory: [{ season: 1 }],
      directorInfo: { bio: "private-ish" },
    });

    for (const leaked of [
      "corpsCoin",
      "email",
      "fcmToken",
      "engagement",
      "seasonHistory",
      "directorInfo",
    ]) {
      assert.equal(leaked in picked, false, `${leaked} must not survive the allowlist`);
    }
    assert.equal(picked.displayName, "Chris");
  });

  test("fills the same defaults the callable returns", () => {
    const picked = pickPublicProfile({});
    assert.equal(picked.displayName, "Unknown Director");
    assert.equal(picked.xpLevel, 1);
    assert.equal(picked.xp, 0);
    assert.deepEqual(picked.achievements, []);
    assert.deepEqual(picked.corps, {});
    assert.equal(picked.stats.seasonsPlayed, 0);
  });

  test("coerces wrong-typed values instead of passing them through", () => {
    const picked = pickPublicProfile({ achievements: "not-an-array" });
    assert.deepEqual(picked.achievements, []);
  });
});

describe("listPublicCorps", () => {
  test("returns labelled entries and skips nameless corps", () => {
    const entries = listPublicCorps({
      worldClass: { corpsName: "Blue Devils" },
      aClass: {},
    });
    assert.deepEqual(entries, [
      { classKey: "worldClass", classLabel: "World Class", corpsName: "Blue Devils", uniform: null },
    ]);
  });

  test("surfaces only the validated equipped-uniform view", () => {
    const entries = listPublicCorps({
      worldClass: {
        corpsName: "Blue Devils",
        uniform: {
          name: "2026 Finals Look",
          colorway: { primary: "#101c33", secondary: "#d7dde2", accent: "#2f6fd0", metal: "silver" },
          figure: { skin: "#c9a074" }, // never surfaced
        },
      },
      openClass: {
        corpsName: "Open Star",
        // hostile / malformed colorway drops the whole uniform view
        uniform: { name: "x", colorway: { primary: "red;} body{", secondary: "#111111", accent: "#222222" } },
      },
    });
    assert.deepEqual(entries[0].uniform, {
      name: "2026 Finals Look",
      colors: ["#101c33", "#d7dde2", "#2f6fd0"],
    });
    assert.equal(entries[1].uniform, null);
  });

  test("tolerates a missing corps map", () => {
    assert.deepEqual(listPublicCorps(undefined), []);
    assert.deepEqual(listPublicCorps({}), []);
  });
});

describe("buildDirectorPageHtml", () => {
  const hostileName = '<script>alert("xss")</script>';

  test("escapes director-controlled text everywhere it lands", () => {
    const html = buildDirectorPageHtml({
      username: "Rohn",
      profile: {
        displayName: hostileName,
        bio: "bio & <b>bold</b>",
        location: '"quoted"',
        favoriteCorps: "Cavaliers & Co",
        corps: { worldClass: { corpsName: "<img onerror=1>" } },
      },
    });

    assert.equal(html.includes("<script>alert"), false, "raw script tag must never survive");
    assert.equal(html.includes("<img onerror"), false, "raw img tag must never survive");
    assert.ok(html.includes("&lt;script&gt;"), "hostile text should appear escaped");
    assert.ok(html.includes("bio &amp; &lt;b&gt;bold&lt;/b&gt;"));
  });

  test("renders equipped-uniform swatches from the validated triple only", () => {
    const html = buildDirectorPageHtml({
      username: "Rohn",
      profile: {
        displayName: "Chris",
        corps: {
          worldClass: {
            corpsName: "Blue Devils",
            uniform: {
              name: '<b>"Look"</b>',
              colorway: { primary: "#101C33", secondary: "#d7dde2", accent: "#2f6fd0" },
            },
          },
        },
      },
    });
    assert.ok(html.includes("background:#101c33"), "validated hex reaches the swatch style");
    assert.ok(html.includes("&lt;b&gt;&quot;Look&quot;&lt;/b&gt;"), "look name is escaped");
    assert.equal(html.includes('<b>"Look"</b>'), false);
  });

  test("carries the canonical URL and OG tags for the shared link", () => {
    const html = buildDirectorPageHtml({
      username: "Rohn",
      profile: pickPublicProfile({ displayName: "Chris" }),
    });

    assert.ok(html.includes('rel="canonical" href="https://marching.art/d/Rohn"'));
    assert.ok(html.includes('property="og:url" content="https://marching.art/d/Rohn"'));
    assert.ok(html.includes("/api/og/director/Rohn"), "OG image should point at the director card");
    assert.ok(html.includes('property="og:title"'));
  });

  test("emits ProfilePage JSON-LD without breaking out of the script element", () => {
    const html = buildDirectorPageHtml({
      username: "Rohn",
      profile: pickPublicProfile({ displayName: "</script><script>evil()" }),
    });

    assert.ok(html.includes("application/ld+json"));
    // The payload may appear as inert text, but a literal "</script>" inside
    // the block would end the element early and turn the rest into markup —
    // so "<" must be JSON-escaped (\u003c), not HTML-entity-escaped.
    const block = html.slice(html.indexOf("application/ld+json"));
    const body = block.slice(0, block.indexOf("</script>"));
    assert.equal(body.includes("</script"), false, "JSON-LD must not be terminable early");
    assert.ok(body.includes("\\u003c/script\\u003e"), "< should be escaped as \\u003c");
  });
});

describe("buildPrivateDirectorPageHtml", () => {
  test("renders a noindex stub that leaks no profile data", () => {
    const html = buildPrivateDirectorPageHtml({ username: "Rohn" });
    assert.ok(html.includes("noindex"), "private stubs must not be indexed");
    assert.ok(html.includes("Rohn"));
    assert.equal(html.includes("/api/og/director/"), false, "no OG card for a private profile");
  });

  test("escapes the username in the stub too", () => {
    const html = buildPrivateDirectorPageHtml({ username: '<b>x</b>' });
    assert.equal(html.includes("<b>x</b>"), false);
  });
});
