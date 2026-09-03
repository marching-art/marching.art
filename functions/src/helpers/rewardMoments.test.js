// Reward-moment notifications: the inbox rows a daily-login claim leaves
// behind. Celebrations moved here from dashboard modals (site review U-H4),
// so the shape of each row is what the director actually sees.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildRewardMomentNotifications, classKeyFor } = require("./rewardMoments");

const ach = (id, title = id) => ({ id, title, description: "desc", rarity: "common", ccReward: 50 });

describe("buildRewardMomentNotifications", () => {
  test("nothing earned → no rows", () => {
    assert.deepEqual(buildRewardMomentNotifications("u1", {}), []);
    assert.deepEqual(buildRewardMomentNotifications("u1", { newAchievements: [] }), []);
  });

  test("one row per achievement, deduped per achievement", () => {
    const rows = buildRewardMomentNotifications("u1", { newAchievements: [ach("a"), ach("b")] });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, "achievement_unlocked");
    assert.equal(rows[0].link, "/achievements");
    assert.equal(rows[0].dedupeKey, "achievement_u1_a");
    assert.equal(rows[1].dedupeKey, "achievement_u1_b");
  });

  test("a backfill batch collapses to one summary row", () => {
    const rows = buildRewardMomentNotifications("u1", {
      newAchievements: [ach("a"), ach("b"), ach("c"), ach("d")],
    });
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /4 achievements/);
    assert.equal(rows[0].dedupeKey, "achievements_backfill_u1");
  });

  test("a level-up rides along, keyed by the level reached", () => {
    const rows = buildRewardMomentNotifications("u1", { levelsGained: 2, newLevel: 7 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "level_up");
    assert.equal(rows[0].dedupeKey, "level_up_u1_7");
  });

  test("an XP or seasons class unlock lands in the inbox with a registration deep link", () => {
    for (const unlockPath of ["xp", "seasons"]) {
      const rows = buildRewardMomentNotifications("u1", { classUnlocked: "Open Class", unlockPath });
      assert.equal(rows.length, 1, unlockPath);
      assert.equal(rows[0].type, "class_unlocked");
      assert.equal(rows[0].link, "/dashboard?panel=register");
      assert.equal(rows[0].metadata.corpsClass, "openClass");
      assert.equal(rows[0].dedupeKey, "class_unlocked_u1_openClass");
    }
  });

  test("the account-age backstop unlock stays silent", () => {
    const rows = buildRewardMomentNotifications("u1", { classUnlocked: "A Class", unlockPath: "backstop" });
    assert.deepEqual(rows, []);
  });

  test("classKeyFor accepts labels and canonical keys, rejects junk", () => {
    assert.equal(classKeyFor("World Class"), "worldClass");
    assert.equal(classKeyFor("aClass"), "aClass");
    assert.equal(classKeyFor("SoundSport"), null);
    assert.equal(classKeyFor(null), null);
  });
});
