// The article-admin callables take a client-supplied document path. This pins
// the guard that keeps that path inside news_hub/.../articles/* — without it
// an admin token could read, edit or delete any document in the database.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { assertArticlePath } = require("./newsAdmin");

describe("assertArticlePath", () => {
  test("accepts the composite article document path", () => {
    const path = "news_hub/overture_2026/days/day_12/articles/fantasy_recap";
    assert.equal(assertArticlePath(path), path);
    assert.equal(
      assertArticlePath("news_hub/s1/days/day_1/articles/user-submission-42"),
      "news_hub/s1/days/day_1/articles/user-submission-42"
    );
  });

  const rejects = (value) =>
    assert.throws(() => assertArticlePath(value), (error) => error.code === "invalid-argument");

  test("rejects missing or non-string paths", () => {
    rejects(undefined);
    rejects(null);
    rejects("");
    rejects(42);
    rejects({ path: "news_hub/s/days/d/articles/t" });
  });

  test("rejects any document outside an articles subcollection", () => {
    rejects("game-settings/season");
    rejects("artifacts/marching-art/users/uid/profile/data");
    rejects("artifacts/marching-art/users/uid/private/data");
    rejects("news_hub/s1");
    rejects("news_hub/s1/days/day_1");
    rejects("news_hub/s1/days/day_1/articles/t/comments/c1");
    rejects("/news_hub/s1/days/day_1/articles/t");
    rejects("news_hub/s1/days/day_1/articles/t/");
    rejects("news_hub/../days/day_1/articles/t");
    rejects("news_hub/s1/days/day_1/articles/has space");
  });
});
