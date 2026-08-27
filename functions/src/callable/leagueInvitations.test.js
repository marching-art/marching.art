// Invitation guards + expiry.
//
// League invites are the other half of FMA's #1 bug cluster (docs/FMA_LESSONS.md
// §7): invites that don't work, stale offers that never clear, directors who
// can't join. These pin the send-time guards, the accept/decline guards, and
// the expiry rule that keeps an invitation list from filling with dead offers.
// All are pure, so they pin without a Firestore mock.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isInvitationExpired,
  validateInviteRequest,
  assertCanSendInvitation,
  assertCanRespondToInvitation,
  INVITATION_TTL_MS,
} = require("./leagueInvitations");

const NOW = 1_700_000_000_000;

const league = (over = {}) => ({
  name: "Test League",
  creatorId: "o",
  commissioners: ["c"],
  members: ["o", "c"],
  maxMembers: 20,
  ...over,
});

// A minimal invitee-profile shape, reduced to the two booleans the guard reads.
const sendArgs = (over = {}) => ({
  league: league(),
  inviterUid: "c",
  inviteeUid: "invitee",
  inviteeExists: true,
  inviteeAcceptingInvites: undefined,
  existingInvitation: null,
  now: NOW,
  ...over,
});

describe("isInvitationExpired", () => {
  test("a missing expiresAt (legacy invite) never expires", () => {
    assert.equal(isInvitationExpired({}, NOW), false);
    assert.equal(isInvitationExpired({ expiresAt: null }, NOW), false);
    assert.equal(isInvitationExpired(undefined, NOW), false);
  });

  test("compares against now for a millis expiresAt", () => {
    assert.equal(isInvitationExpired({ expiresAt: NOW - 1 }, NOW), true);
    assert.equal(isInvitationExpired({ expiresAt: NOW + 1 }, NOW), false);
    // Exactly-now is not yet expired (strict less-than).
    assert.equal(isInvitationExpired({ expiresAt: NOW }, NOW), false);
  });

  test("accepts a Firestore Timestamp (toMillis) as well as a raw number", () => {
    const ts = { toMillis: () => NOW - 1000 };
    assert.equal(isInvitationExpired({ expiresAt: ts }, NOW), true);
  });

  test("a fresh invite issued now is valid for the full TTL", () => {
    const expiresAt = NOW + INVITATION_TTL_MS;
    assert.equal(isInvitationExpired({ expiresAt }, NOW), false);
    assert.equal(isInvitationExpired({ expiresAt }, NOW + INVITATION_TTL_MS + 1), true);
  });
});

describe("validateInviteRequest", () => {
  test("requires both a league and an invitee", () => {
    assert.throws(
      () => validateInviteRequest({ leagueId: "", inviteeUid: "x", inviterUid: "c" }),
      /required/
    );
    assert.throws(
      () => validateInviteRequest({ leagueId: "L", inviteeUid: "", inviterUid: "c" }),
      /required/
    );
  });

  test("rejects inviting yourself", () => {
    assert.throws(
      () => validateInviteRequest({ leagueId: "L", inviteeUid: "c", inviterUid: "c" }),
      /cannot invite yourself/
    );
  });

  test("accepts a well-formed request", () => {
    assert.doesNotThrow(() =>
      validateInviteRequest({ leagueId: "L", inviteeUid: "x", inviterUid: "c" })
    );
  });
});

describe("assertCanSendInvitation", () => {
  test("only a commissioner may invite", () => {
    assert.throws(
      () => assertCanSendInvitation(sendArgs({ inviterUid: "m1" })),
      /Only a league commissioner/
    );
    assert.doesNotThrow(() => assertCanSendInvitation(sendArgs({ inviterUid: "o" })));
    assert.doesNotThrow(() => assertCanSendInvitation(sendArgs({ inviterUid: "c" })));
  });

  test("an existing member cannot be re-invited", () => {
    assert.throws(
      () => assertCanSendInvitation(sendArgs({ inviteeUid: "o" })),
      /already a member/
    );
  });

  test("a full league refuses new invites", () => {
    const full = league({ members: ["o", "c"], maxMembers: 2 });
    assert.throws(() => assertCanSendInvitation(sendArgs({ league: full })), /full/);
  });

  test("defaults the cap to 20 when maxMembers is unset", () => {
    const members = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const full = league({ members, maxMembers: undefined });
    assert.throws(() => assertCanSendInvitation(sendArgs({ league: full })), /full/);
  });

  test("the invitee must have a profile", () => {
    assert.throws(
      () => assertCanSendInvitation(sendArgs({ inviteeExists: false })),
      /profile not found/
    );
  });

  test("a director who opted out of invites cannot be invited", () => {
    assert.throws(
      () => assertCanSendInvitation(sendArgs({ inviteeAcceptingInvites: false })),
      /not accepting/
    );
    // undefined and true both mean "accepting".
    assert.doesNotThrow(() =>
      assertCanSendInvitation(sendArgs({ inviteeAcceptingInvites: true }))
    );
    assert.doesNotThrow(() =>
      assertCanSendInvitation(sendArgs({ inviteeAcceptingInvites: undefined }))
    );
  });

  test("a live pending invitation blocks a duplicate", () => {
    assert.throws(
      () =>
        assertCanSendInvitation(
          sendArgs({ existingInvitation: { status: "pending", expiresAt: NOW + 1000 } })
        ),
      /already a pending invitation/
    );
  });

  test("an expired or already-resolved prior invitation does NOT block a fresh one", () => {
    // The stale-invite escape hatch: an aged-out or declined offer must not
    // wedge the invitee out of ever being re-invited.
    assert.doesNotThrow(() =>
      assertCanSendInvitation(
        sendArgs({ existingInvitation: { status: "pending", expiresAt: NOW - 1000 } })
      )
    );
    assert.doesNotThrow(() =>
      assertCanSendInvitation(sendArgs({ existingInvitation: { status: "declined" } }))
    );
    assert.doesNotThrow(() =>
      assertCanSendInvitation(sendArgs({ existingInvitation: { status: "rescinded" } }))
    );
  });
});

describe("assertCanRespondToInvitation", () => {
  test("only the addressee may respond", () => {
    assert.throws(
      () =>
        assertCanRespondToInvitation({
          invitation: { inviteeUid: "invitee", status: "pending" },
          uid: "someone-else",
        }),
      /not for you/
    );
  });

  test("an already-answered invitation cannot be answered again", () => {
    for (const status of ["accepted", "declined", "rescinded", "expired"]) {
      assert.throws(
        () =>
          assertCanRespondToInvitation({
            invitation: { inviteeUid: "invitee", status },
            uid: "invitee",
          }),
        new RegExp(`already ${status}`)
      );
    }
  });

  test("a pending invitation addressed to the caller passes", () => {
    assert.doesNotThrow(() =>
      assertCanRespondToInvitation({
        invitation: { inviteeUid: "invitee", status: "pending" },
        uid: "invitee",
      })
    );
  });
});
