/**
 * SSRF-safe fetch for director-supplied URLs.
 *
 * A server-side fetch of an arbitrary URL is a proxy into our own network: the
 * GCP metadata server (169.254.169.254 / metadata.google.internal hands out a
 * service-account token), loopback admin ports, RFC1918 peers in the VPC. A
 * scheme check alone doesn't stop that, and neither does validating the first
 * URL — a public host can 302 to an internal one, or a hostname can resolve
 * (or re-resolve, DNS rebinding) to a private address.
 *
 * So every hop is checked where it actually connects:
 *   - the URL itself: http(s) only, default ports only, no userinfo, no
 *     internal-only hostnames, IP literals checked against the blocklist;
 *   - DNS: the socket's `lookup` resolves the name and refuses the connection
 *     if ANY address is non-public, so the address we vet is the one we dial
 *     (no TOCTOU window between a pre-flight lookup and fetch's own);
 *   - redirects: followed manually (max MAX_REDIRECTS), each target re-vetted.
 *
 * Failures throw SafeFetchError with a machine `code`. Callers should collapse
 * everything but `too_large` into ONE user-facing message: distinct messages
 * for "blocked" vs "connection refused" vs "HTTP 404" are an oracle for
 * mapping what is reachable from inside.
 */

const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns");
const net = require("node:net");

const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".internal", ".local", ".home.arpa"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal"]);

class SafeFetchError extends Error {
  /**
   * @param {"invalid_url" | "blocked" | "network" | "http_status" | "not_image" | "too_large" | "empty" | "too_many_redirects"} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

/** IPv4 CIDRs that are not globally routable (RFC 6890 special-purpose + multicast/reserved). */
const BLOCKED_V4 = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata)
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
].map(([base, bits]) => ({ base: v4ToInt(/** @type {string} */ (base)), bits: /** @type {number} */ (bits) }));

/**
 * @param {string} ip dotted-quad IPv4
 * @returns {number} unsigned 32-bit value
 */
function v4ToInt(ip) {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

/** @param {string} ip */
function isBlockedV4(ip) {
  const n = v4ToInt(ip);
  return BLOCKED_V4.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((base & mask) >>> 0);
  });
}

/**
 * Expand an IPv6 address (any textual form, incl. a trailing dotted quad) into
 * eight 16-bit groups.
 *
 * @param {string} ip
 * @returns {number[] | null}
 */
function v6Groups(ip) {
  let addr = ip.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone !== -1) addr = addr.slice(0, zone);
  // Trailing embedded IPv4 (::ffff:1.2.3.4) → two hex groups.
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (net.isIPv4(tail)) {
    const n = v4ToInt(tail);
    addr = `${addr.slice(0, lastColon + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest].map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

/**
 * @param {number[]} g eight IPv6 groups
 * @param {number} hi index of the group holding the high 16 bits of an embedded IPv4
 */
function embeddedV4(g, hi) {
  return `${g[hi] >> 8}.${g[hi] & 0xff}.${g[hi + 1] >> 8}.${g[hi + 1] & 0xff}`;
}

/** @param {string} ip */
function isBlockedV6(ip) {
  const g = v6Groups(ip);
  if (!g) return true; // unparseable → refuse
  const zeroPrefix = (n) => g.slice(0, n).every((x) => x === 0);
  if (zeroPrefix(8)) return true; // ::
  if (zeroPrefix(7) && g[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) — judge the v4.
  if (zeroPrefix(5) && g[5] === 0xffff) return isBlockedV4(embeddedV4(g, 6));
  if (zeroPrefix(6)) return isBlockedV4(embeddedV4(g, 6));
  // NAT64 well-known prefix 64:ff9b::/96 — judge the v4 it translates to.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedV4(embeddedV4(g, 6));
  }
  // 6to4 (2002::/16) embeds a v4 in groups 1–2.
  if (g[0] === 0x2002) return isBlockedV4(embeddedV4(g, 1));
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 discard
  return false;
}

/**
 * True when `ip` is not a globally routable unicast address — i.e. anything we
 * must never let a director-supplied URL reach. Non-IP input is treated as
 * blocked (fail closed).
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

// ---------------------------------------------------------------------------
// URL + DNS guards
// ---------------------------------------------------------------------------

/**
 * Parse and vet one hop's URL without touching the network.
 *
 * @param {string | URL} input
 * @param {(ip: string) => boolean} [isBlocked]
 * @param {Set<string>} [ports] allowed `URL.port` values ("" = scheme default)
 * @returns {URL}
 * @throws {SafeFetchError} invalid_url | blocked
 */
function assertPublicUrl(input, isBlocked = isPrivateAddress, ports = ALLOWED_PORTS) {
  let url;
  try {
    url = input instanceof URL ? input : new URL(String(input));
  } catch {
    throw new SafeFetchError("invalid_url", "Not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", "URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("blocked", "URL must not carry credentials.");
  }
  if (!ports.has(url.port)) {
    throw new SafeFetchError("blocked", "URL must use the default port.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host) throw new SafeFetchError("invalid_url", "URL has no host.");
  if (net.isIP(host)) {
    if (isBlocked(host)) throw new SafeFetchError("blocked", "URL points at a non-public address.");
  } else if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new SafeFetchError("blocked", "URL points at an internal host.");
  }
  return url;
}

/**
 * A `lookup` for http(s).request that resolves the name and fails the
 * connection if any resolved address is non-public. Handles both the
 * single-address and `all: true` (happy-eyeballs) calling conventions.
 *
 * @param {(ip: string) => boolean} [isBlocked]
 * @param {typeof dns.lookup} [resolve] injectable for tests
 * @returns {import("node:net").LookupFunction}
 */
function createGuardedLookup(isBlocked = isPrivateAddress, resolve = dns.lookup) {
  return /** @type {import("node:net").LookupFunction} */ (
    (hostname, options, callback) => {
      const opts = /** @type {import("node:dns").LookupOptions} */ (options || {});
      resolve(hostname, { family: opts.family ?? 0, hints: opts.hints, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 0);
        const list = /** @type {import("node:dns").LookupAddress[]} */ (/** @type {unknown} */ (addresses)) || [];
        if (list.length === 0 || list.some((a) => isBlocked(a.address))) {
          const blocked = new SafeFetchError("blocked", "Host resolves to a non-public address.");
          return callback(/** @type {NodeJS.ErrnoException} */ (/** @type {unknown} */ (blocked)), "", 0);
        }
        if (opts.all) {
          return /** @type {Function} */ (callback)(null, list);
        }
        return callback(null, list[0].address, list[0].family);
      });
    }
  );
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * One GET with the guarded lookup; resolves with the raw response stream.
 *
 * @param {URL} url
 * @param {{ lookup: import("node:net").LookupFunction, signal: AbortSignal, userAgent: string }} opts
 * @returns {Promise<import("node:http").IncomingMessage>}
 */
function requestOnce(url, { lookup, signal, userAgent }) {
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup,
        signal,
        agent: false,
        headers: {
          "User-Agent": userAgent,
          Accept: "image/*",
          "Accept-Encoding": "identity",
        },
      },
      resolve
    );
    req.on("error", (err) => {
      reject(err instanceof SafeFetchError ? err : new SafeFetchError("network", "Could not connect."));
    });
    req.end();
  });
}

/**
 * Fetch a director-supplied image URL with SSRF guards on every hop, a
 * streaming byte cap and a wall-clock timeout.
 *
 * @param {string} rawUrl
 * @param {{
 *   maxBytes: number,
 *   timeoutMs: number,
 *   userAgent?: string,
 *   _test?: {
 *     isBlocked?: (ip: string) => boolean,
 *     resolve?: typeof dns.lookup,
 *     ports?: Set<string>,
 *   },
 * }} opts `_test` overrides the guards so tests can reach a local server; never pass it in production.
 * @returns {Promise<{ buffer: Buffer, contentType: string, finalUrl: string }>}
 * @throws {SafeFetchError}
 */
async function safeFetchImage(rawUrl, { maxBytes, timeoutMs, userAgent = "marching.art-fetch/1.0", _test = {} }) {
  const { isBlocked = isPrivateAddress, resolve = dns.lookup, ports = ALLOWED_PORTS } = _test;
  const lookup = createGuardedLookup(isBlocked, resolve);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = controller.signal;

  try {
    let url = assertPublicUrl(rawUrl, isBlocked, ports);
    for (let hop = 0; ; hop++) {
      const res = await requestOnce(url, { lookup, signal, userAgent });
      const status = res.statusCode || 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (hop >= MAX_REDIRECTS) {
          throw new SafeFetchError("too_many_redirects", "Too many redirects.");
        }
        let next;
        try {
          next = new URL(res.headers.location, url);
        } catch {
          throw new SafeFetchError("invalid_url", "Redirect target is not a valid URL.");
        }
        url = assertPublicUrl(next, isBlocked, ports);
        continue;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        throw new SafeFetchError("http_status", `HTTP ${status}`);
      }

      const contentType = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) {
        res.resume();
        throw new SafeFetchError("not_image", "Response is not an image.");
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.destroy();
        throw new SafeFetchError("too_large", "Image is too large.");
      }

      // Stream with a running cap — a server can lie about or omit Content-Length.
      /** @type {Buffer[]} */
      const chunks = [];
      let received = 0;
      try {
        for await (const chunk of res) {
          received += chunk.length;
          if (received > maxBytes) {
            res.destroy();
            throw new SafeFetchError("too_large", "Image is too large.");
          }
          chunks.push(chunk);
        }
      } catch (err) {
        if (err instanceof SafeFetchError) throw err;
        throw new SafeFetchError("network", "Connection dropped.");
      }
      if (received === 0) throw new SafeFetchError("empty", "Response was empty.");

      return {
        buffer: Buffer.concat(chunks),
        contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
        finalUrl: url.toString(),
      };
    }
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    throw new SafeFetchError("network", "Could not fetch.");
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SafeFetchError,
  isPrivateAddress,
  assertPublicUrl,
  createGuardedLookup,
  safeFetchImage,
  MAX_REDIRECTS,
};
