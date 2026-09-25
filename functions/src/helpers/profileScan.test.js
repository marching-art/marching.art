// The `profile` collection group holds the profile/public mirror beside every
// profile/data doc (plus other namespaces); every "each director once" scan
// must drop everything but this namespace's profile/data docs.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isProfileDataDoc, profileDataDocs, profileDocUid } = require("./profileScan");
const { paths } = require("./paths");

function snap(path) {
  const segments = path.split("/");
  const ownerId = segments[segments.length - 3];
  return { ref: { path, parent: { parent: { id: ownerId } } } };
}

const ns = paths.users().split("/")[1];

describe("isProfileDataDoc", () => {
  test("accepts this namespace's users/{uid}/profile/data", () => {
    assert.equal(isProfileDataDoc(snap(paths.userProfile("u1"))), true);
  });

  test("rejects the profile/public mirror sibling", () => {
    assert.equal(isProfileDataDoc(snap(paths.userProfilePublic("u1"))), false);
  });

  test("rejects profile/data from another data namespace", () => {
    assert.equal(isProfileDataDoc(snap(`artifacts/${ns}-old/users/u1/profile/data`)), false);
  });

  test("rejects a `data` doc that is not under users/", () => {
    assert.equal(isProfileDataDoc(snap(`artifacts/${ns}/leagues/l1/profile/data`)), false);
  });

  test("rejects a deeper `profile/data` doc under a user", () => {
    assert.equal(
      isProfileDataDoc(snap(`artifacts/${ns}/users/u1/seasonDetail/x/profile/data`)),
      false,
    );
  });

  test("tolerates malformed snapshots", () => {
    assert.equal(isProfileDataDoc(null), false);
    assert.equal(isProfileDataDoc({ id: "data" }), false);
    assert.equal(isProfileDataDoc({ ref: {} }), false);
  });
});

describe("profileDataDocs", () => {
  test("keeps one doc per director, in order, dropping mirrors and strays", () => {
    const docs = [
      snap(paths.userProfile("alice")),
      snap(paths.userProfilePublic("alice")),
      snap(paths.userProfile("bob")),
      snap(paths.userProfilePublic("bob")),
      snap(`artifacts/${ns}-old/users/carol/profile/data`),
    ];
    assert.deepEqual(
      profileDataDocs(docs).map((doc) => doc.ref.path),
      [paths.userProfile("alice"), paths.userProfile("bob")],
    );
  });

  test("handles an undefined input", () => {
    assert.deepEqual(profileDataDocs(undefined), []);
  });
});

describe("profileDocUid", () => {
  test("recovers the uid from the profile path", () => {
    assert.equal(profileDocUid(snap(paths.userProfile("u9"))), "u9");
    assert.equal(profileDocUid({ ref: { parent: { parent: null } } }), null);
  });
});
