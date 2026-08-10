// The non-score Discord channels: ops alerts (#operations), director-hosted
// events (#events), season-clock announcements (#announcements), and published
// articles (#news). The Podium Report reaches #news as a published news
// article (see the "published articles" suite), not a standalone embed.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { joinLines, payloadOf } = require("./discord");
const { buildOpsAlertPayload, postOpsAlert } = require("./opsAlerts");
const { buildHostedEventPayload, announceHostedEvent } = require("./hostedEventDiscord");
const { buildSeasonStartPayload, buildLineupLockPayload } = require("./seasonAnnounce");
const { buildArticlePayload, announceArticle, FRESH_WINDOW_MS } = require("../triggers/newsDiscord");

const okFetch = (sink) => async (url, options) => {
  sink.push({ url, payload: JSON.parse(options.body) });
  return { ok: true, status: 204, text: async () => "" };
};

describe("shared payload safety", () => {
  test("every payload is posted with pings disabled", () => {
    // Corps, event and director names are user-authored and flow into this
    // copy — nobody gets to @everyone the server from inside the game.
    assert.deepEqual(payloadOf({ title: "x" }).allowed_mentions, { parse: [] });
    assert.deepEqual(buildOpsAlertPayload({ title: "t", source: "s" }).allowed_mentions, {
      parse: [],
    });
    assert.deepEqual(
      buildHostedEventPayload({ eventName: "@everyone Classic", hostName: "h", day: 4 })
        .allowed_mentions,
      { parse: [] }
    );
  });

  test("long lists are truncated inside Discord's field limit", () => {
    const value = joinLines(Array.from({ length: 300 }, (_, i) => `• Corps ${i}`));
    assert.ok(value.length <= 1024);
    assert.match(value, /…and \d+ more$/);
  });
});

describe("ops alerts (#operations)", () => {
  test("severity drives the marker, details become bullets", () => {
    const payload = buildOpsAlertPayload({
      title: "Nightly scoring pipeline: unhealthy run(s)",
      source: "scoring-watchdog",
      severity: "critical",
      summary: "Re-run from Admin.",
      details: ["s1_day12 (failed: boom)", "scrape_runs/2026-07-02 is missing"],
    });
    const embed = payload.embeds[0];
    assert.match(embed.title, /^🚨 Nightly scoring pipeline/);
    assert.match(embed.fields[0].value, /• s1_day12 \(failed: boom\)/);
    assert.match(embed.footer.text, /scoring-watchdog/);
    assert.ok(embed.timestamp);
  });

  test("an alert with no details carries no empty field", () => {
    const embed = buildOpsAlertPayload({ title: "t", source: "s" }).embeds[0];
    assert.deepEqual(embed.fields, []);
  });

  test("a Discord outage never throws — the incident is already logged", async () => {
    const failing = async () => ({ ok: false, status: 500, text: async () => "down" });
    assert.deepEqual(await postOpsAlert("", { title: "t", source: "s" }), { status: "disabled" });
    const result = await postOpsAlert("https://d.test/ops", { title: "t", source: "s" }, failing);
    assert.equal(result.status, "failed");
  });
});

describe("hosted events (#events)", () => {
  test("names the host, the day and the venue, and points at sign-ups", async () => {
    const posts = [];
    const result = await announceHostedEvent(
      "https://d.test/events",
      {
        eventName: "Rose City Invitational",
        hostName: "chris",
        location: "Portland, OR",
        venueLabel: "College Bowl",
        day: 18,
        capacity: 24,
        seasonName: "Season 12",
      },
      okFetch(posts)
    );
    assert.equal(result.status, "posted");
    const embed = posts[0].payload.embeds[0];
    assert.match(embed.title, /Rose City Invitational/);
    assert.match(embed.description, /\*\*chris\*\* is hosting a show on \*\*Day 18\*\*/);
    assert.match(embed.description, /Portland, OR/);
    assert.match(embed.url, /\/schedule\?src=discord/);
    assert.deepEqual(
      embed.fields.map((f) => f.name),
      ["Venue", "Day", "Capacity"]
    );
  });

  test("disabled without a webhook, and never throws on failure", async () => {
    assert.deepEqual(await announceHostedEvent("", { eventName: "x", day: 1 }), {
      status: "disabled",
    });
    const failing = async () => ({ ok: false, status: 404, text: async () => "gone" });
    const result = await announceHostedEvent(
      "https://d.test/events",
      { eventName: "x", day: 1 },
      failing
    );
    assert.equal(result.status, "failed");
  });
});

describe("season clock (#announcements)", () => {
  test("season start distinguishes live from off-season and dates the end", () => {
    const live = buildSeasonStartPayload({
      seasonName: "Live Season 2026",
      seasonType: "live-season",
      endDate: new Date(Date.UTC(2026, 7, 8, 16, 0, 0)),
    }).embeds[0];
    assert.match(live.title, /Live Season 2026 starts now/);
    assert.match(live.description, /real DCI corps/);
    assert.equal(live.fields[0].value, "Live season");
    assert.match(live.fields[1].value, /August 8/);

    const off = buildSeasonStartPayload({
      seasonName: "Offseason IX",
      seasonType: "off-season",
    }).embeds[0];
    assert.match(off.description, /decades of DCI history/);
    assert.equal(off.fields.length, 1);
  });

  test("lineup lock copy matches the phase and always names the time", () => {
    const unlimited = buildLineupLockPayload({
      seasonName: "S",
      context: { phase: "unlimited", lockTimeLabel: "8:00 PM ET", periodKey: 14 },
    }).embeds[0];
    assert.match(unlimited.title, /Free caption changes end tonight/);

    const champ = buildLineupLockPayload({
      seasonName: "S",
      context: {
        phase: "championship",
        lockTimeLabel: "8:00 PM ET",
        periodKey: 46,
        competingClasses: ["openClass", "aClass"],
      },
    }).embeds[0];
    assert.match(champ.title, /Championship-week lineup lock/);
    assert.equal(champ.fields[0].value, "8:00 PM ET");
    assert.match(champ.fields[1].value, /openClass, aClass/);
  });
});

describe("published articles (#news)", () => {
  const article = {
    headline: "Blue Devils hold on in Toledo",
    summary: "A two-tenths night at the top.",
    category: "fantasy",
    reportDay: 12,
    imageUrl: "https://cdn.test/hero.jpg",
    createdAt: new Date(),
  };

  test("links back with the composite id the SPA resolves", () => {
    const embed = buildArticlePayload({
      article,
      seasonId: "season_2026",
      dayId: "day_12",
      articleType: "recap",
    }).embeds[0];
    assert.match(embed.title, /Blue Devils hold on in Toledo/);
    assert.equal(embed.url, "https://marching.art/article/season_2026_day_12_recap?src=discord");
    assert.equal(embed.image.url, "https://cdn.test/hero.jpg");
    assert.match(embed.footer.text, /Fantasy · Day 12/);
  });

  test("skips a non-https image and a headline-less doc", () => {
    const noImage = buildArticlePayload({
      article: { ...article, imageUrl: "javascript:alert(1)" },
      seasonId: "s",
      dayId: "day_1",
      articleType: "t",
    }).embeds[0];
    assert.equal(noImage.image, undefined);
    assert.equal(
      buildArticlePayload({ article: {}, seasonId: "s", dayId: "day_1", articleType: "t" }),
      null
    );
  });

  test("a backfill of old articles never replays into the channel", async () => {
    const posts = [];
    const stale = {
      ...article,
      createdAt: new Date(Date.now() - FRESH_WINDOW_MS - 1000),
    };
    const result = await announceArticle({
      article: stale,
      seasonId: "s",
      dayId: "day_1",
      articleType: "recap",
      webhookUrl: "https://d.test/news",
      fetchImpl: okFetch(posts),
    });
    assert.equal(result.status, "stale");
    assert.equal(posts.length, 0);
  });

  test("a fresh article posts; a webhook failure never throws", async () => {
    const posts = [];
    const base = {
      article,
      seasonId: "s",
      dayId: "day_12",
      articleType: "recap",
      webhookUrl: "https://d.test/news",
    };
    assert.equal((await announceArticle({ ...base, fetchImpl: okFetch(posts) })).status, "posted");
    const failing = async () => ({ ok: false, status: 500, text: async () => "x" });
    assert.equal((await announceArticle({ ...base, fetchImpl: failing })).status, "failed");
  });
});
