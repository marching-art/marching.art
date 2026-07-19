// Tests for the DCI scraping-API request builder. dci.org now sits behind a
// Cloudflare managed challenge, so dciFetch wraps the target URL in a rendering
// proxy request. buildProxiedUrl is the pure, side-effect-free core of that
// wrapping — these lock in each provider's format and the URL encoding.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildProxiedUrl, looksLikeChallenge } = require("./dciFetch");

const TARGET = "https://www.dci.org/scores/recap/2025-dci-world-championship-finals/";
const ENC = encodeURIComponent(TARGET);

describe("buildProxiedUrl", () => {
  test("scrapingbee: defaults to stealth_proxy (Cloudflare mode) with JS render", () => {
    const url = buildProxiedUrl(TARGET, { key: "abc123", provider: "scrapingbee" });
    assert.ok(url.startsWith("https://app.scrapingbee.com/api/v1/?api_key=abc123&url="));
    assert.ok(url.includes(`url=${ENC}`));
    assert.ok(url.includes("render_js=true"));
    assert.ok(url.includes("stealth_proxy=true"));
    assert.ok(!url.includes("premium_proxy=true"));
  });

  test("scrapingbee: stealth=false falls back to premium_proxy", () => {
    const url = buildProxiedUrl(TARGET, { key: "abc123", provider: "scrapingbee", stealth: false });
    assert.ok(url.includes("premium_proxy=true"));
    assert.ok(!url.includes("stealth_proxy=true"));
  });

  test("zenrows: js_render + premium proxy", () => {
    const url = buildProxiedUrl(TARGET, { key: "k", provider: "zenrows" });
    assert.ok(url.startsWith("https://api.zenrows.com/v1/?apikey=k&url="));
    assert.ok(url.includes("js_render=true"));
    assert.ok(url.includes("premium_proxy=true"));
  });

  test("scraperapi: render + premium", () => {
    const url = buildProxiedUrl(TARGET, { key: "k", provider: "scraperapi" });
    assert.ok(url.startsWith("https://api.scraperapi.com/?api_key=k&url="));
    assert.ok(url.includes("render=true"));
    assert.ok(url.includes("premium=true"));
  });

  test("defaults to scrapingbee for unknown/empty provider", () => {
    const fallback = buildProxiedUrl(TARGET, { key: "k", provider: "bogus" });
    const empty = buildProxiedUrl(TARGET, { key: "k", provider: "" });
    assert.ok(fallback.startsWith("https://app.scrapingbee.com/api/v1/"));
    assert.ok(empty.startsWith("https://app.scrapingbee.com/api/v1/"));
  });

  test("provider name is case-insensitive", () => {
    const url = buildProxiedUrl(TARGET, { key: "k", provider: "ZenRows" });
    assert.ok(url.startsWith("https://api.zenrows.com/v1/"));
  });

  test("custom: fills {key} and {url} placeholders", () => {
    const url = buildProxiedUrl(TARGET, {
      key: "s3cr3t",
      provider: "custom",
      endpoint: "https://proxy.example.com/get?token={key}&target={url}&render=true",
    });
    assert.equal(
      url,
      `https://proxy.example.com/get?token=s3cr3t&target=${ENC}&render=true`
    );
  });

  test("custom without an endpoint throws", () => {
    assert.throws(
      () => buildProxiedUrl(TARGET, { key: "k", provider: "custom", endpoint: "" }),
      /SCRAPER_API_ENDPOINT/
    );
  });

  test("the target URL is URL-encoded (query string not leaked into the proxy URL)", () => {
    const withQuery = "https://www.dci.org/scores/?page=2&sort=date";
    const url = buildProxiedUrl(withQuery, { key: "k", provider: "scrapingbee" });
    assert.ok(url.includes(`url=${encodeURIComponent(withQuery)}`));
    // The target's own "&page=2" must not appear as a top-level proxy param.
    assert.ok(!url.includes("&page=2"));
  });

  test("the API key is URL-encoded", () => {
    const url = buildProxiedUrl(TARGET, { key: "a b/c+d", provider: "scrapingbee" });
    assert.ok(url.includes(`api_key=${encodeURIComponent("a b/c+d")}`));
  });
});

describe("looksLikeChallenge", () => {
  test("detects the Cloudflare interstitial", () => {
    assert.equal(looksLikeChallenge("<html><head><title>Just a moment...</title>"), true);
    assert.equal(looksLikeChallenge("...window._cf_chl_opt={cRay:'abc'}..."), true);
    assert.equal(looksLikeChallenge("<script src='https://challenges.cloudflare.com/x'>"), true);
    assert.equal(looksLikeChallenge("<noscript>Enable JavaScript and cookies to continue</noscript>"), true);
  });

  test("passes real score/sitemap content through", () => {
    assert.equal(looksLikeChallenge("<table id='effect-table-0'><tr class='table-top'>"), false);
    assert.equal(looksLikeChallenge("<urlset><url><loc>https://www.dci.org/scores/final-scores/x</loc>"), false);
    assert.equal(looksLikeChallenge(""), false);
  });

  test("ignores non-string bodies (e.g. parsed JSON)", () => {
    assert.equal(looksLikeChallenge(null), false);
    assert.equal(looksLikeChallenge({ scores: [] }), false);
    assert.equal(looksLikeChallenge(undefined), false);
  });
});
