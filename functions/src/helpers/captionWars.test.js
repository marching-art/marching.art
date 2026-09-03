// Caption Wars — best-of-three across GE, Visual and Music.
//
// The cases that matter are the ones where the format DISAGREES with the
// totals, because that divergence is the entire product, and the tie cases,
// because "a caption is never drawn" is a product decision that has exactly one
// pathological exception.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  SCORING_FORMATS,
  CAPTION_CATEGORIES,
  isCaptionWarsLeague,
  resolveCaptionWars,
  captionsWonBy,
} = require("./captionWars");

/** A week's work, in the shape getWeekScore returns. */
const week = (ge, visual, music, score = ge + visual + music) => ({
  score,
  shows: 1,
  ge,
  visual,
  music,
});

/** Nobody competed: the zero entry getWeekScore hands back for an absent corps. */
const absent = { score: 0, shows: 0, ge: 0, visual: 0, music: 0 };

describe("CAPTION_CATEGORIES", () => {
  test("is the three groups the scorer persists, at the DCI ratio", () => {
    assert.deepEqual(
      CAPTION_CATEGORIES.map((c) => c.key),
      ["ge", "visual", "music"]
    );
    // GE is worth more than either other group per show — the reason a
    // best-of-three can disagree with the total at all.
    assert.deepEqual(
      CAPTION_CATEGORIES.map((c) => c.max),
      [40, 30, 30]
    );
  });
});

describe("resolveCaptionWars", () => {
  test("a sweep gives every category to one director", () => {
    const { captions, winner } = resolveCaptionWars("alice", "bob", week(38, 28, 28), week(35, 26, 25));

    assert.equal(winner, "alice");
    assert.deepEqual(captions.tally, { alice: 3, bob: 0 });
    assert.equal(captions.ge.winner, "alice");
    assert.equal(captions.visual.winner, "alice");
    assert.equal(captions.music.winner, "alice");
    assert.deepEqual(captions.ge.scores, { alice: 38, bob: 35 });
  });

  test("two of three wins the week", () => {
    const { captions, winner } = resolveCaptionWars(
      "alice",
      "bob",
      week(30, 28, 28),
      week(40, 27, 27)
    );

    assert.equal(winner, "alice");
    assert.deepEqual(captions.tally, { alice: 2, bob: 1 });
    assert.equal(captions.ge.winner, "bob");
  });

  // THE case. Bob posts the higher week by four points and loses it, because
  // all four of them came from one caption. Under the default format this is a
  // comfortable Bob win.
  test("the higher total loses when it is banked in a single caption", () => {
    const alice = week(30, 28, 28); // 86
    const bob = week(40, 27, 27); // 94

    assert.ok(bob.score > alice.score);
    assert.equal(resolveCaptionWars("alice", "bob", alice, bob).winner, "alice");
  });

  test("whole weeks compare, not single shows", () => {
    // Two shows apiece, already folded by buildWeeklyScoreIndex.
    const alice = { score: 172, shows: 2, ge: 76, visual: 48, music: 48 };
    const bob = { score: 170, shows: 2, ge: 74, visual: 49, music: 47 };

    const { captions, winner } = resolveCaptionWars("alice", "bob", alice, bob);
    assert.equal(winner, "alice");
    assert.deepEqual(captions.tally, { alice: 2, bob: 1 });
    // The stored block carries the per-show figures, on the per-show scale.
    assert.deepEqual(captions.ge.scores, { alice: 38, bob: 37 });
  });

  test("each category compares per-show averages, so attendance takes nothing", () => {
    // busy attends three shows at 30/27/27 = 84; sharp attends one at 33/28/28 = 89.
    const busy = { score: 252, shows: 3, ge: 90, visual: 81, music: 81 };
    const sharp = { score: 89, shows: 1, ge: 33, visual: 28, music: 28 };

    const { captions, winner } = resolveCaptionWars("busy", "sharp", busy, sharp);
    // Summed, busy would sweep 90-33 / 81-28 / 81-28.
    assert.equal(winner, "sharp");
    assert.deepEqual(captions.tally, { busy: 0, sharp: 3 });
    assert.deepEqual(captions.visual.scores, { busy: 27, sharp: 28 });
  });

  test("reads the folded perShow figures when the entry carries them", () => {
    const a = { score: 180, shows: 2, ge: 70, visual: 55, music: 55, perShow: { ge: 35, visual: 27.5, music: 27.5 } };
    const b = { score: 89, shows: 1, ge: 34, visual: 28, music: 27, perShow: { ge: 34, visual: 28, music: 27 } };
    const { captions } = resolveCaptionWars("a", "b", a, b);
    assert.equal(captions.ge.winner, "a");
    assert.equal(captions.visual.winner, "b");
    assert.equal(captions.music.winner, "a");
  });
});

// "A caption is never drawn" — a tied category goes to whoever had the better
// week overall (the higher per-show average, then the fuller week). It is the
// one rule that keeps a best-of-three from producing 1-1-1 every time two
// evenly matched directors meet.
describe("tied categories", () => {
  test("a tied caption goes to the higher weekly average", () => {
    const alice = week(30, 28, 28, 90); // same GE, better week
    const bob = week(30, 29, 27, 88);

    const { captions } = resolveCaptionWars("alice", "bob", alice, bob);
    assert.equal(captions.ge.winner, "alice");
    // And the other two split on their own merits.
    assert.equal(captions.visual.winner, "bob");
    assert.equal(captions.music.winner, "alice");
    assert.deepEqual(captions.tally, { alice: 2, bob: 1 });
  });

  test("a tied caption with tied totals is left undecided, and the rest still decide the week", () => {
    // Identical totals, identical GE, and the other two split — so GE cannot be
    // awarded to anyone and the week comes down to 1-1.
    const alice = week(30, 29, 27, 86);
    const bob = week(30, 27, 29, 86);

    const { captions, winner } = resolveCaptionWars("alice", "bob", alice, bob);
    assert.equal(captions.ge.winner, "tie");
    assert.deepEqual(captions.tally, { alice: 1, bob: 1 });
    assert.equal(winner, "tie");
  });

  test("a tied caption with equal averages goes to the fuller week", () => {
    const two = { score: 180, shows: 2, ge: 60, visual: 60, music: 60 };
    const one = { score: 90, shows: 1, ge: 30, visual: 30, music: 30 };
    const { captions, winner } = resolveCaptionWars("two", "one", two, one);
    assert.equal(captions.ge.winner, "two");
    assert.equal(winner, "two");
  });

  test("an undecided caption does not rescue a director already beaten 2-0", () => {
    const alice = week(31, 29, 27, 87);
    const bob = week(30, 28, 29, 87);

    const { captions, winner } = resolveCaptionWars("alice", "bob", alice, bob);
    assert.equal(captions.music.winner, "bob");
    assert.deepEqual(captions.tally, { alice: 2, bob: 1 });
    assert.equal(winner, "alice");
  });
});

describe("weeks nobody contested", () => {
  test("neither director competed: every category undecided, the week is a tie", () => {
    const { captions, winner } = resolveCaptionWars("alice", "bob", absent, absent);

    assert.equal(winner, "tie");
    assert.deepEqual(captions.tally, { alice: 0, bob: 0 });
    for (const { key } of CAPTION_CATEGORIES) {
      assert.equal(captions[key].winner, "tie");
    }
  });

  // Under the default format sitting out is a quiet forfeit. Here it is a 3-0,
  // which is louder — and showing up should beat not showing up, loudly.
  test("competing against an absent director is a 3-0 sweep", () => {
    const { captions, winner } = resolveCaptionWars("alice", "bob", week(35, 26, 25), absent);

    assert.equal(winner, "alice");
    assert.deepEqual(captions.tally, { alice: 3, bob: 0 });
  });

  test("missing or malformed caption fields count as zero rather than throwing", () => {
    const { winner } = resolveCaptionWars("alice", "bob", { score: 90 }, { score: 80 });
    // Every category ties at zero and falls through to the totals.
    assert.equal(winner, "alice");
  });
});

describe("isCaptionWarsLeague", () => {
  const league = (settings) => ({ settings });

  test("requires the format AND the season it was bought for", () => {
    assert.equal(
      isCaptionWarsLeague(
        league({
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: "season-2",
        }),
        "season-2"
      ),
      true
    );
  });

  // `settings.scoringFormat` once existed as a value with no implementation and
  // was deleted as dead weight. A league document still carrying that stale
  // string must not be switched into a paid format nobody bought.
  test("a stale format with no season is ignored", () => {
    assert.equal(
      isCaptionWarsLeague(league({ scoringFormat: SCORING_FORMATS.CAPTION_WARS }), "season-2"),
      false
    );
  });

  test("last season's unlock does not carry into this one", () => {
    assert.equal(
      isCaptionWarsLeague(
        league({
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: "season-1",
        }),
        "season-2"
      ),
      false
    );
  });

  test("a league with no settings at all resolves on totals", () => {
    assert.equal(isCaptionWarsLeague({}, "season-2"), false);
    assert.equal(isCaptionWarsLeague(undefined, "season-2"), false);
    assert.equal(isCaptionWarsLeague(league({ scoringFormat: "total" }), "season-2"), false);
  });

  test("no live season means no format", () => {
    assert.equal(
      isCaptionWarsLeague(
        league({
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: undefined,
        }),
        undefined
      ),
      false
    );
  });
});

describe("captionsWonBy", () => {
  test("reads the stored block rather than recomputing it", () => {
    const { captions } = resolveCaptionWars("alice", "bob", week(38, 28, 28), week(35, 29, 25));
    assert.deepEqual(captionsWonBy(captions, "alice"), { won: 2, lost: 1 });
    assert.deepEqual(captionsWonBy(captions, "bob"), { won: 1, lost: 2 });
  });

  test("an undecided category counts for neither director", () => {
    const { captions } = resolveCaptionWars("alice", "bob", week(30, 29, 27, 86), week(30, 27, 29, 86));
    assert.deepEqual(captionsWonBy(captions, "alice"), { won: 1, lost: 1 });
  });

  test("a matchup with no block is all zeros", () => {
    assert.deepEqual(captionsWonBy(undefined, "alice"), { won: 0, lost: 0 });
    assert.deepEqual(captionsWonBy({}, "alice"), { won: 0, lost: 0 });
  });
});
