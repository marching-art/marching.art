// SSRF guard for director-supplied URLs (custom corps avatars). These pin the
// address blocklist, the per-hop URL vetting, the connect-time DNS check, and
// that a public-looking first hop can't redirect its way inside.

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const {
  SafeFetchError,
  isPrivateAddress,
  assertPublicUrl,
  createGuardedLookup,
  safeFetchImage,
  MAX_REDIRECTS,
} = require("./safeFetch");

describe("isPrivateAddress", () => {
  const blocked = [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254", // GCP / AWS metadata
    "172.16.0.1",
    "172.31.255.255",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "::127.0.0.1",
    "64:ff9b::a9fe:a9fe", // NAT64 → 169.254.169.254
    "2002:c0a8:0101::1", // 6to4 → 192.168.1.1
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "2001:db8::1",
    "not-an-ip",
  ];
  const allowed = [
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "100.128.0.1",
    "151.101.1.140",
    "2607:f8b0:4004:800::200e",
    "2606:4700::6810:84e5",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
  ];
  for (const ip of blocked) test(`blocks ${ip}`, () => assert.equal(isPrivateAddress(ip), true));
  for (const ip of allowed) test(`allows ${ip}`, () => assert.equal(isPrivateAddress(ip), false));
});

describe("assertPublicUrl", () => {
  const rejects = (url, code) =>
    assert.throws(
      () => assertPublicUrl(url),
      (err) => err instanceof SafeFetchError && err.code === code
    );

  test("accepts a plain public https URL", () => {
    assert.equal(assertPublicUrl("https://example.com/a.png").hostname, "example.com");
  });
  test("rejects garbage and non-http schemes", () => {
    rejects("not a url", "invalid_url");
    rejects("file:///etc/passwd", "invalid_url");
    rejects("gopher://example.com/", "invalid_url");
    rejects("data:image/png;base64,AAAA", "invalid_url");
  });
  test("rejects private IP literals in every spelling", () => {
    rejects("http://169.254.169.254/computeMetadata/v1/", "blocked");
    rejects("http://127.0.0.1/", "blocked");
    rejects("http://2130706433/", "blocked"); // decimal 127.0.0.1 — WHATWG URL normalizes it
    rejects("http://0x7f.1/", "blocked");
    rejects("http://[::1]/", "blocked");
    rejects("http://[::ffff:169.254.169.254]/", "blocked");
  });
  test("rejects internal-only hostnames", () => {
    rejects("http://localhost/", "blocked");
    rejects("http://metadata.google.internal/", "blocked");
    rejects("http://metadata.google.internal./", "blocked");
    rejects("http://foo.localhost/", "blocked");
    rejects("http://printer.local/", "blocked");
  });
  test("rejects credentials and non-default ports", () => {
    rejects("https://user:pw@example.com/a.png", "blocked");
    rejects("https://example.com:8443/a.png", "blocked");
    rejects("http://example.com:22/", "blocked");
    assert.ok(assertPublicUrl("https://example.com:443/a.png"));
  });
});

describe("createGuardedLookup", () => {
  const fakeResolve = (addresses) => (_host, _opts, cb) => cb(null, addresses);

  test("refuses a name when any resolved address is private (rebinding-style mixed answer)", (t, done) => {
    const lookup = createGuardedLookup(
      isPrivateAddress,
      /** @type {any} */ (fakeResolve([
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ]))
    );
    lookup("evil.example", { all: true }, (err) => {
      assert.ok(err instanceof SafeFetchError);
      assert.equal(/** @type {any} */ (err).code, "blocked");
      done();
    });
  });

  test("passes public answers through in both calling conventions", (t, done) => {
    const answers = [
      { address: "8.8.8.8", family: 4 },
      { address: "2607:f8b0:4004:800::200e", family: 6 },
    ];
    const lookup = createGuardedLookup(isPrivateAddress, /** @type {any} */ (fakeResolve(answers)));
    lookup("ok.example", { all: true }, (err, list) => {
      assert.equal(err, null);
      assert.deepEqual(list, answers);
      lookup("ok.example", {}, (err2, address, family) => {
        assert.equal(err2, null);
        assert.equal(address, "8.8.8.8");
        assert.equal(family, 4);
        done();
      });
    });
  });

  test("propagates resolver errors", (t, done) => {
    const lookup = createGuardedLookup(isPrivateAddress, /** @type {any} */ ((_h, _o, cb) =>
      cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }))));
    lookup("nx.example", {}, (err) => {
      assert.equal(/** @type {any} */ (err).code, "ENOTFOUND");
      done();
    });
  });
});

describe("safeFetchImage (local server)", () => {
  // The server listens on every interface. The fetch reaches it as 127.0.0.2,
  // the ONE address the test blocklist exempts from the production one, so
  // redirect handling runs without leaving the box while 127.0.0.1, the
  // metadata server and every other private range stay blocked.
  /** @param {string} ip */
  const isBlocked = (ip) => ip !== "127.0.0.2" && isPrivateAddress(ip);
  const PNG = Buffer.from("89504e470d0a1a0a0000", "hex");
  /** @type {http.Server} */
  let server;
  let base = "";
  let port = 0;

  before(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://x");
      switch (url.pathname) {
        case "/ok.png":
          res.writeHead(200, { "Content-Type": "image/png; charset=binary" });
          return res.end(PNG);
        case "/jpg":
          res.writeHead(200, { "Content-Type": "image/jpg" });
          return res.end(PNG);
        case "/html":
          res.writeHead(200, { "Content-Type": "text/html" });
          return res.end("<html></html>");
        case "/404":
          res.writeHead(404, { "Content-Type": "image/png" });
          return res.end();
        case "/empty":
          res.writeHead(200, { "Content-Type": "image/png" });
          return res.end();
        case "/big-declared":
          res.writeHead(200, { "Content-Type": "image/png", "Content-Length": "999999" });
          return res.end(PNG);
        case "/big-streamed":
          res.writeHead(200, { "Content-Type": "image/png" });
          res.write(Buffer.alloc(64));
          return res.end(Buffer.alloc(64));
        case "/redirect-ok":
          res.writeHead(302, { Location: "/ok.png" });
          return res.end();
        case "/redirect-literal":
          res.writeHead(302, { Location: `http://127.0.0.1:${port}/ok.png` });
          return res.end();
        case "/redirect-dns":
          res.writeHead(301, { Location: `http://rebind.test:${port}/ok.png` });
          return res.end();
        case "/redirect-public-name":
          res.writeHead(303, { Location: `http://public.test:${port}/ok.png` });
          return res.end();
        case "/redirect-meta":
          res.writeHead(307, { Location: "http://169.254.169.254/computeMetadata/v1/" });
          return res.end();
        case "/loop":
          res.writeHead(302, { Location: "/loop" });
          return res.end();
        default:
          res.writeHead(500);
          return res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "0.0.0.0", () => resolve(undefined)));
    port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
    base = `http://127.0.0.2:${port}`;
  });
  after(() => new Promise((resolve) => server.close(() => resolve(undefined))));

  // The server sits on an ephemeral port, so the default-port rule (pinned in
  // assertPublicUrl above) is relaxed here; the fake resolver maps the
  // `*.test` names the redirects use.
  const hosts = { "public.test": "127.0.0.2", "rebind.test": "127.0.0.1" };
  const resolve = (host, _opts, cb) =>
    hosts[host]
      ? cb(null, [{ address: hosts[host], family: 4 }])
      : cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
  const _test = { isBlocked, resolve: /** @type {any} */ (resolve), ports: new Set(["", "80", "443"]) };
  const fetchLocal = (path) => {
    _test.ports.add(String(port));
    return safeFetchImage(`${base}${path}`, { maxBytes: 100, timeoutMs: 5000, _test });
  };

  const rejectsWith = async (path, code) => {
    await assert.rejects(fetchLocal(path), (err) => err instanceof SafeFetchError && err.code === code);
  };

  test("fetches an image and normalizes its content type", async () => {
    const res = await fetchLocal("/ok.png");
    assert.deepEqual(res.buffer, PNG);
    assert.equal(res.contentType, "image/png");
    assert.equal((await fetchLocal("/jpg")).contentType, "image/jpeg");
  });
  test("follows a same-host redirect", async () => {
    const res = await fetchLocal("/redirect-ok");
    assert.equal(res.finalUrl, `${base}/ok.png`);
  });
  test("refuses a redirect to a private IP literal", () => rejectsWith("/redirect-literal", "blocked"));
  test("refuses a redirect to the metadata server", () => rejectsWith("/redirect-meta", "blocked"));
  test("refuses a redirect whose name resolves privately at connect time", () =>
    rejectsWith("/redirect-dns", "blocked"));
  test("follows a redirect to a name that resolves publicly", async () => {
    const res = await fetchLocal("/redirect-public-name");
    assert.equal(res.finalUrl, `http://public.test:${port}/ok.png`);
    assert.deepEqual(res.buffer, PNG);
  });
  test("caps redirect chains", () => rejectsWith("/loop", "too_many_redirects"));
  test("rejects non-image responses", () => rejectsWith("/html", "not_image"));
  test("rejects non-2xx", () => rejectsWith("/404", "http_status"));
  test("rejects empty bodies", () => rejectsWith("/empty", "empty"));
  test("enforces the declared size cap", () => rejectsWith("/big-declared", "too_large"));
  test("enforces the streamed size cap", () => rejectsWith("/big-streamed", "too_large"));
  test("with production guards, the local server is unreachable", async () => {
    for (const url of [`http://127.0.0.1:${port}/ok.png`, `http://127.0.0.1/ok.png`, `http://localhost/ok.png`]) {
      await assert.rejects(
        safeFetchImage(url, { maxBytes: 100, timeoutMs: 5000 }),
        (err) => err instanceof SafeFetchError && err.code === "blocked"
      );
    }
  });
  test("exports the redirect ceiling it enforces", () => assert.equal(MAX_REDIRECTS, 3));
});
