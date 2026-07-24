// Tests for the sitemap XML builder behind the /sitemap.xml rewrite. These
// pin the URL shapes crawlers consume: the static public-route set, the
// /article/:id composite ids, escaping, and the lastmod formatting.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildSitemapXml, articleEntryFromDoc, STATIC_ROUTES } = require("./sitemap");

describe("buildSitemapXml", () => {
  test("emits every static route with its changefreq and priority", () => {
    const xml = buildSitemapXml(STATIC_ROUTES, []);
    for (const route of STATIC_ROUTES) {
      assert.ok(
        xml.includes(`<loc>https://marching.art${route.path}</loc>`),
        `missing static route ${route.path}`
      );
    }
    assert.ok(xml.includes("<changefreq>daily</changefreq>"));
    assert.ok(xml.includes("<priority>1.0</priority>"));
  });

  test("static routes carry no fabricated lastmod", () => {
    const xml = buildSitemapXml(STATIC_ROUTES, []);
    assert.ok(!xml.includes("<lastmod>"));
  });

  test("well-formed envelope", () => {
    const xml = buildSitemapXml(STATIC_ROUTES, [{ id: "s1_day_1_dci_recap" }]);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset '));
    assert.ok(xml.trimEnd().endsWith("</urlset>"));
    // One <url> per entry, all closed.
    const opens = xml.match(/<url>/g)?.length ?? 0;
    const closes = xml.match(/<\/url>/g)?.length ?? 0;
    assert.equal(opens, STATIC_ROUTES.length + 1);
    assert.equal(opens, closes);
  });

  test("article entries use the /article/:id route with lastmod when known", () => {
    const xml = buildSitemapXml([], [
      { id: "season42_day_12_fantasy_recap", lastmod: "2026-07-20" },
      { id: "season42_day_13_dci_daily" },
    ]);
    assert.ok(
      xml.includes("<loc>https://marching.art/article/season42_day_12_fantasy_recap</loc>")
    );
    assert.ok(xml.includes("<lastmod>2026-07-20</lastmod>"));
    assert.ok(xml.includes("<loc>https://marching.art/article/season42_day_13_dci_daily</loc>"));
    // The lastmod-less entry must not inherit one.
    const entry = xml.split("<url>").find((u) => u.includes("day_13"));
    assert.ok(entry && !entry.includes("<lastmod>"));
  });

  test("escapes XML-significant characters in ids", () => {
    const xml = buildSitemapXml([], [{ id: "bad&<id>" }]);
    assert.ok(xml.includes("/article/bad&amp;&lt;id&gt;</loc>"));
    assert.ok(!xml.includes("bad&<id>"));
  });
});

describe("articleEntryFromDoc", () => {
  const makeDoc = (path, data) => ({
    id: path.split("/").at(-1),
    ref: { path },
    data: () => data,
  });

  test("builds the composite article id from the doc path", () => {
    const doc = makeDoc("news_hub/season42/days/day_7/articles/fantasy_recap", {});
    // @ts-ignore -- minimal stub of QueryDocumentSnapshot
    const entry = articleEntryFromDoc(doc);
    assert.equal(entry.id, "season42_day_7_fantasy_recap");
    assert.equal(entry.lastmod, undefined);
  });

  test("prefers updatedAt over createdAt for lastmod, formatted YYYY-MM-DD", () => {
    const ts = (iso) => ({ toDate: () => new Date(iso) });
    const doc = makeDoc("news_hub/s1/days/day_2/articles/dci_daily", {
      createdAt: ts("2026-07-01T05:00:00Z"),
      updatedAt: ts("2026-07-19T23:59:00Z"),
    });
    // @ts-ignore -- minimal stub of QueryDocumentSnapshot
    const entry = articleEntryFromDoc(doc);
    assert.equal(entry.lastmod, "2026-07-19");
  });

  test("tolerates non-Timestamp createdAt values", () => {
    const doc = makeDoc("news_hub/s1/days/day_3/articles/dci_feature", {
      createdAt: "2026-07-01T05:00:00Z",
    });
    // @ts-ignore -- minimal stub of QueryDocumentSnapshot
    const entry = articleEntryFromDoc(doc);
    assert.equal(entry.id, "s1_day_3_dci_feature");
    assert.equal(entry.lastmod, undefined);
  });
});
