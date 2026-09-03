// New-supporter shout-outs to #announcements.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  tierRank,
  shouldAnnounceTierChange,
  buildSupporterPayload,
  announceSupporter,
} = require("./supporterDiscord");

describe("shouldAnnounceTierChange", () => {
  test("posts on a gain only: new, upgrade, or return after a lapse", () => {
    assert.equal(shouldAnnounceTierChange(null, "rookie"), true);
    assert.equal(shouldAnnounceTierChange(null, "friend"), true);
    assert.equal(shouldAnnounceTierChange("rookie", "staff"), true);
    assert.equal(shouldAnnounceTierChange("friend", "rookie"), true);
    assert.equal(shouldAnnounceTierChange(undefined, "corps_angel"), true);
  });

  test("stays silent on a renewal, downgrade, cancellation or unknown tier", () => {
    assert.equal(shouldAnnounceTierChange("rookie", "rookie"), false); // monthly renewal
    assert.equal(shouldAnnounceTierChange("staff", "rookie"), false);
    assert.equal(shouldAnnounceTierChange("rookie", null), false);
    assert.equal(shouldAnnounceTierChange(null, null), false);
    assert.equal(shouldAnnounceTierChange(null, "bogus"), false);
    assert.ok(tierRank("corps_angel") > tierRank("staff"));
    assert.ok(tierRank("rookie") > tierRank("friend"));
  });
});

describe("buildSupporterPayload", () => {
  test("names a linked supporter and links the wall", () => {
    const payload = buildSupporterPayload({ tier: "veteran", name: "cadets_fan" });
    const [embed] = payload.embeds;
    assert.match(embed.title, /^🎉 cadets_fan joined as a Veteran supporter$/);
    assert.match(embed.url, /^https:\/\/marching\.art\/supporters\?src=discord$/);
    assert.match(embed.description, /\*\*cadets_fan\*\*/);
    assert.equal(embed.fields[0].value, "Veteran");
  });

  test("an upgrade reads as a move up", () => {
    const [embed] = buildSupporterPayload({ tier: "staff", prevTier: "rookie", name: "x" }).embeds;
    assert.match(embed.title, /moved up to Staff supporter/);
  });

  test("an unlinked one-time coffee is anonymous", () => {
    const [embed] = buildSupporterPayload({ tier: "friend" }).embeds;
    assert.match(embed.title, /^☕ Someone just bought the game a coffee$/);
    assert.doesNotMatch(embed.description, /undefined|null/);
  });

  test("pings are disabled and user-authored names are clamped", () => {
    const payload = buildSupporterPayload({ tier: "rookie", name: "@everyone".padEnd(80, "x") });
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
    assert.ok(payload.embeds[0].title.length < 80);
  });
});

describe("announceSupporter", () => {
  test("is disabled without a webhook URL and never throws on failure", async () => {
    assert.deepEqual(await announceSupporter("", { tier: "rookie" }), { status: "disabled" });
    const failing = async () => ({ ok: false, status: 500, text: async () => "boom" });
    const result = await announceSupporter("https://discord/hook", { tier: "rookie" }, failing);
    assert.equal(result.status, "failed");
    assert.match(result.error, /500/);
  });

  test("posts the payload to the webhook", async () => {
    const sink = [];
    const ok = async (url, options) => {
      sink.push({ url, payload: JSON.parse(options.body) });
      return { ok: true, status: 204, text: async () => "" };
    };
    const result = await announceSupporter("https://discord/hook", { tier: "corps_angel", name: "a" }, ok);
    assert.equal(result.status, "posted");
    assert.equal(sink.length, 1);
    assert.match(sink[0].payload.embeds[0].title, /Corps Angel/);
  });
});
