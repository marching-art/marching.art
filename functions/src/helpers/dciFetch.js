/**
 * DCI fetch layer — a single choke point for every HTTP request to dci.org.
 *
 * dci.org now fronts its entire zone with a Cloudflare "managed challenge": a
 * plain GET (any User-Agent) returns the "Just a moment..." interstitial with
 * HTTP 403 instead of the page/XML, which broke the nightly score scrape, the
 * sitemap-based deep scrapes, and the event-detail archive.
 *
 * To get past it we route requests through a rendering scraping API that solves
 * the challenge and returns the final page body (ScrapingBee / ZenRows /
 * ScraperAPI, or a custom endpoint). All existing cheerio/XML parsing is
 * unchanged — only the fetch is swapped.
 *
 * Configuration:
 *   - SCRAPER_API_KEY   (secret)  API key for the provider. Set with:
 *                                   firebase functions:secrets:set SCRAPER_API_KEY
 *                                 When UNSET, dciFetch falls back to a direct
 *                                 axios GET. That keeps local/dev and tests
 *                                 working and lets us drop the paid service
 *                                 instantly if dci.org later allowlists us.
 *   - SCRAPER_API_PROVIDER (str)  scrapingbee | zenrows | scraperapi | custom.
 *                                 Defaults to scrapingbee.
 *   - SCRAPER_API_ENDPOINT (str)  Only for provider=custom: a URL template with
 *                                 {key} and {url} placeholders, e.g.
 *                                   https://host/api?token={key}&url={url}&render=true
 *                                 {url} receives the URL-encoded target.
 *
 * Any deployed function that fetches dci.org MUST declare `secrets: [scraperApiKey]`
 * in its options, or the key won't be readable at runtime.
 */
const axios = require("axios");
const { logger } = require("firebase-functions/v2");
const { defineSecret, defineString } = require("firebase-functions/params");

const scraperApiKey = defineSecret("SCRAPER_API_KEY");
const scraperApiProvider = defineString("SCRAPER_API_PROVIDER", { default: "scrapingbee" });
const scraperApiEndpoint = defineString("SCRAPER_API_ENDPOINT", { default: "" });
// For provider=scrapingbee: use the "stealth proxy" — ScrapingBee's documented
// mode for Cloudflare-protected sites — instead of the plain premium proxy.
// dci.org's managed challenge intermittently beats premium_proxy (500s, or a
// challenge page returned as 200). Default "true"; set "false" only if your
// ScrapingBee plan lacks stealth_proxy.
const scraperApiStealth = defineString("SCRAPER_API_STEALTH", { default: "true" });

const DIRECT_USER_AGENT = "Mozilla/5.0 (compatible; MarchingArtBot/1.0)";

// JS-rendering proxies solve the challenge in-browser and can take tens of
// seconds; give them room. Direct (fallback) fetches stay snappy.
const PROXY_TIMEOUT_MS = 70000;
const DIRECT_TIMEOUT_MS = 30000;
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // recap/sitemap bodies can be large

/**
 * Build the provider request URL that wraps a target dci.org URL. Pure and
 * side-effect-free (no param reads) so it can be unit-tested directly.
 *
 * @param {string} rawUrl - The dci.org URL to fetch.
 * @param {object} cfg
 * @param {string} cfg.key - Provider API key.
 * @param {string} cfg.provider - scrapingbee | zenrows | scraperapi | custom.
 * @param {string} [cfg.endpoint] - Template for provider=custom.
 * @param {boolean} [cfg.stealth=true] - scrapingbee only: use stealth_proxy
 *   (Cloudflare mode) instead of premium_proxy.
 * @returns {string} The fully-formed provider request URL.
 */
function buildProxiedUrl(rawUrl, { key, provider, endpoint = "", stealth = true }) {
  const enc = encodeURIComponent(rawUrl);
  const k = encodeURIComponent(key);
  switch ((provider || "scrapingbee").toLowerCase()) {
  case "zenrows":
    return `https://api.zenrows.com/v1/?apikey=${k}&url=${enc}` +
      "&js_render=true&premium_proxy=true&proxy_country=us";
  case "scraperapi":
    return `https://api.scraperapi.com/?api_key=${k}&url=${enc}` +
      "&render=true&premium=true&country_code=us";
  case "custom": {
    const tmpl = (endpoint || "").trim();
    if (!tmpl) {
      throw new Error("SCRAPER_API_PROVIDER=custom requires SCRAPER_API_ENDPOINT to be set.");
    }
    return tmpl.replace(/\{key\}/g, k).replace(/\{url\}/g, enc);
  }
  case "scrapingbee":
  default:
    // stealth_proxy is ScrapingBee's Cloudflare-bypass mode; premium_proxy is the
    // cheaper fallback for plans without stealth. Both imply render_js.
    return `https://app.scrapingbee.com/api/v1/?api_key=${k}&url=${enc}&render_js=true&` +
      `${stealth ? "stealth_proxy=true" : "premium_proxy=true"}&country_code=us`;
  }
}

/**
 * True when a proxied response body is a Cloudflare challenge/interstitial rather
 * than the real page — i.e. the scraping API failed to solve the challenge and
 * handed back the "Just a moment..." page (often as HTTP 200). Treated as a
 * retryable failure so we don't silently parse a challenge page as "no results".
 * @param {*} body
 * @returns {boolean}
 */
function looksLikeChallenge(body) {
  if (typeof body !== "string") return false;
  const markers = /Just a moment\.\.\.|challenges\.cloudflare\.com|_cf_chl_opt|cf-chl-|Enable JavaScript and cookies/i;
  return markers.test(body);
}

/**
 * Read the scraping-API key without throwing if the secret isn't bound (e.g.
 * local dev, tests, or a function that forgot to declare it). Returns "" when
 * unavailable, which routes dciFetch to its direct-GET fallback.
 * @returns {string}
 */
function readApiKey() {
  try {
    return (scraperApiKey.value() || "").trim();
  } catch (_e) {
    return "";
  }
}

/**
 * GET a dci.org URL, transparently routing through the configured scraping API
 * when SCRAPER_API_KEY is set (to pass Cloudflare), or directly otherwise.
 * Retries transient failures with exponential backoff.
 *
 * @param {string} url - The dci.org URL to fetch.
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @returns {Promise<string>} The response body (HTML or XML).
 */
async function dciFetch(url, { maxRetries = 4 } = {}) {
  if (!url) throw new Error("dciFetch requires a URL.");

  const key = readApiKey();
  const useProxy = key.length > 0;
  const requestUrl = useProxy
    ? buildProxiedUrl(url, {
      key,
      provider: scraperApiProvider.value(),
      endpoint: scraperApiEndpoint.value(),
      stealth: (scraperApiStealth.value() || "true").toLowerCase() !== "false",
    })
    : url;

  const config = {
    timeout: useProxy ? PROXY_TIMEOUT_MS : DIRECT_TIMEOUT_MS,
    // The proxy returns the target body directly; a spoofed UA only matters on
    // the direct fallback path.
    headers: useProxy ? undefined : { "User-Agent": DIRECT_USER_AGENT },
    maxContentLength: MAX_PAYLOAD_BYTES,
    maxBodyLength: MAX_PAYLOAD_BYTES,
  };

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(requestUrl, config);
      // A challenge page returned as HTTP 200 would otherwise parse to "no
      // results". Treat it as a retryable failure so we retry (and ultimately
      // surface a clear error) instead of silently succeeding on junk.
      if (useProxy && looksLikeChallenge(response.data)) {
        const challengeError = new Error(
          "Scraping proxy returned a Cloudflare challenge page instead of the target content."
        );
        challengeError.isChallenge = true;
        throw challengeError;
      }
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const isRetryable =
        error.isChallenge === true ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.code === "ECONNABORTED" ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);

      if (!isRetryable || attempt === maxRetries) {
        logger.error(
          `[dciFetch] Failed for ${url} after ${attempt} attempt(s) ` +
          `(proxy=${useProxy}, status=${status ?? "n/a"}, code=${error.code ?? "n/a"}): ${error.message}`
        );
        throw error;
      }

      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn(
        `[dciFetch] Attempt ${attempt} for ${url} failed (${error.message}); retrying in ${backoffMs}ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

module.exports = {
  dciFetch,
  buildProxiedUrl,
  looksLikeChallenge,
  scraperApiKey,
};
