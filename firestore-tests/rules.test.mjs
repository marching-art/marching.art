// Security-rules regression tests for the profile document, run against the
// Firestore emulator. These exist because rules are additive — any matching
// `allow` grants access — which is exactly how the user-subcollection
// catch-all silently bypassed every protected-field guard on profile/data
// (currency, XP, lineups, scores) until these tests caught it.
//
// Run from this directory:  npm install && npm test
// (needs Java for the emulator; the firestore JAR downloads on first run)
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

const APP = 'marching-art';
const ALICE = 'alice-uid';
const profilePath = `artifacts/${APP}/users/${ALICE}/profile/data`;

const seedProfile = {
  uid: ALICE,
  username: 'alice',
  bio: 'hello',
  corpsCoin: 100,
  xp: 50,
  lifetimeStats: { totalPoints: 10, totalSeasons: 1 },
  activeSeasonId: 'season-1',
  corps: {
    worldClass: {
      corpsName: 'Alice Corps',
      location: 'Anytown',
      showConcept: 'A Show',
      lineup: { GE1: 'Blue Devils', GE2: 'Bluecoats' },
      lineupKey: 'abc123',
      totalSeasonScore: 87.5,
      weeklyTrades: { seasonUid: 'season-1', week: 2, used: 1 },
      selectedShows: { week2: [{ eventName: 'DCI Anytown', day: 9 }] },
    },
    soundSport: {
      corpsName: 'Alice SS',
      lineup: { GE1: 'Genesis' },
      selectedShows: { week2: [{ eventName: 'SoundSport Anytown', day: 9 }] },
    },
  },
};

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-rules-test',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

async function freshSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), profilePath), seedProfile);
  });
}

const authed = () => testEnv.authenticatedContext(ALICE).firestore();
const mallory = () => testEnv.authenticatedContext('mallory-uid').firestore();

// --- cosmetic writes must still be allowed ---
await freshSeed();
await check(
  'owner updates bio',
  assertSucceeds(updateDoc(doc(authed(), profilePath), { bio: 'new bio' }))
);

await freshSeed();
await check(
  'owner edits corps cosmetic fields',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.location': 'Elsewhere',
      'corps.worldClass.showConcept': 'New Show',
    })
  )
);

// Corps identity is permanent: names are set at registration (registerCorps
// callable) and changed only by the admin duplicate-rename flow — retiring
// and restarting is the player path to a new name.
await freshSeed();
await check(
  'owner cannot rename a competitive-class corps',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.corpsName': 'Renamed Corps',
    })
  )
);

await freshSeed();
await check(
  'owner sets uniform design',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), { 'corps.worldClass.uniformDesign': { color: 'blue' } })
  )
);

await freshSeed();
await check(
  'owner deletes a corps class (null)',
  assertSucceeds(updateDoc(doc(authed(), profilePath), { 'corps.worldClass': null }))
);

// onboarding-style merge creating soundSport with a lineup
await freshSeed();
await check(
  'onboarding creates soundSport corps with lineup',
  assertSucceeds(
    setDoc(
      doc(authed(), profilePath),
      {
        location: '',
        corps: {
          soundSport: {
            corpsName: 'My SoundSport',
            lineup: { GE1: 'Genesis' },
          },
        },
      },
      { merge: true }
    )
  )
);

// --- protected top-level fields ---
await freshSeed();
await check(
  'owner cannot bump lifetimeStats',
  assertFails(updateDoc(doc(authed(), profilePath), { 'lifetimeStats.totalPoints': 999999999 }))
);

await freshSeed();
await check(
  'owner cannot replace lifetimeStats map',
  assertFails(updateDoc(doc(authed(), profilePath), { lifetimeStats: { totalPoints: 999999999 } }))
);

await freshSeed();
await check(
  'owner cannot change activeSeasonId',
  assertFails(updateDoc(doc(authed(), profilePath), { activeSeasonId: 'season-99' }))
);

await freshSeed();
await check(
  'owner cannot write corpsCoin',
  assertFails(updateDoc(doc(authed(), profilePath), { corpsCoin: 999999 }))
);
await freshSeed();
await check(
  'owner cannot change xp (regression)',
  assertFails(updateDoc(doc(authed(), profilePath), { xp: 9999 }))
);

await freshSeed();
await check(
  'owner cannot write challenges ledger (XP farming)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      challenges: { 'Wed Jan 14 2026': [{ id: 'visit-scores', completed: true }] },
    })
  )
);

// --- protected corps subfields ---
await freshSeed();
await check(
  'owner cannot write competitive lineup directly',
  assertFails(
    updateDoc(doc(authed(), profilePath), { 'corps.worldClass.lineup': { GE1: 'Illegal' } })
  )
);

await freshSeed();
await check(
  'owner cannot forge totalSeasonScore',
  assertFails(updateDoc(doc(authed(), profilePath), { 'corps.worldClass.totalSeasonScore': 99.99 }))
);

await freshSeed();
await check(
  'owner cannot reset weeklyTrades',
  assertFails(
    updateDoc(doc(authed(), profilePath), { 'corps.worldClass.weeklyTrades': { week: 2, used: 0 } })
  )
);

await freshSeed();
await check(
  'owner cannot clear mustRename',
  assertFails(updateDoc(doc(authed(), profilePath), { 'corps.worldClass.mustRename': false }))
);

await freshSeed();
await check(
  'owner cannot create competitive corps with lineup client-side',
  assertFails(
    setDoc(
      doc(authed(), profilePath),
      {
        corps: { openClass: { corpsName: 'Sneaky', lineup: { GE1: 'X' }, totalSeasonScore: 99 } },
      },
      { merge: true }
    )
  )
);

await freshSeed();
await check(
  'owner cannot forge soundSport score',
  assertFails(updateDoc(doc(authed(), profilePath), { 'corps.soundSport.totalSeasonScore': 99.9 }))
);

// selectedShows drives competitive score AND CorpsCoin payouts in the nightly
// scorer; the per-week/per-day caps live only in the selectUserShows callable,
// so a direct client write must be rejected — otherwise a director could
// "attend" every show every day, forging rank and farming coin.
await freshSeed();
await check(
  'owner cannot forge selectedShows on a competitive class (score/coin farming)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.selectedShows.week2': [
        { eventName: 'DCI Anytown', day: 9 },
        { eventName: 'DCI Elsewhere', day: 9 },
        { eventName: 'DCI Everywhere', day: 10 },
      ],
    })
  )
);

await freshSeed();
await check(
  'owner cannot add a new selectedShows week to a competitive class',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.selectedShows.week3': [{ eventName: 'Forged Show', day: 15 }],
    })
  )
);

// soundSport is scored from show attendance too (the scorer iterates every
// class), and only its score was previously guarded — selectedShows must be
// server-only here as well.
await freshSeed();
await check(
  'owner cannot forge selectedShows on soundSport',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport.selectedShows.week2': [
        { eventName: 'SoundSport Anytown', day: 9 },
        { eventName: 'SoundSport Elsewhere', day: 9 },
      ],
    })
  )
);

// seasonHistory feeds the public resume AND the lifetime Director Rating
// leaderboard (placements-only) — a client-forged placement would mint
// leaderboard rank. medals feed the trophy case. Both are archival-written.
await freshSeed();
await check(
  'owner cannot forge seasonHistory placements (Director Rating input)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.seasonHistory': [{ seasonId: 'forged', placement: 1 }],
    })
  )
);

await freshSeed();
await check(
  'owner cannot forge Podium medal counters',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.podiumClass.medals': { gold: 70, silver: 0, bronze: 0 },
    })
  )
);

// replacing the whole corps map with score-bearing changes must fail
await freshSeed();
await check(
  'owner cannot swap whole corps map to forge scores',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      corps: {
        worldClass: {
          corpsName: 'Alice Corps',
          lineup: { GE1: 'Illegal' },
          totalSeasonScore: 99.9,
        },
      },
    })
  )
);

// =============================================================================
// EXPRESSION-BUDGET REGRESSION — a profile with ALL FIVE corps classes present
// (worldClass, openClass, aClass, soundSport, podiumClass) must still accept
// owner writes. The pre-MapDiff guards compared 12 request-vs-resource get()
// pairs per class; with every class registered none of the per-class branches
// short-circuited and the total evaluation exceeded Firestore's per-request
// rules budget, which surfaces as a blanket PERMISSION_DENIED. In production
// that locked fully built-out directors out of EVERY profile edit ("Failed to
// update profile"), while profiles with fewer classes were fine — so the
// standard two-class seed above can never catch a regression here.
// =============================================================================
const guardedCorps = (name) => ({
  corpsName: name,
  lineup: { GE1: 'Blue Devils' },
  lineupKey: 'k',
  weeklyTrades: { used: 1 },
  totalSeasonScore: 10,
  seasonRank: 1,
  seasonRankOf: 2,
  seasonHistory: [{ seasonId: 's1', placement: 1 }],
  medals: { gold: 0, silver: 0, bronze: 0 },
  division: 'World',
  selectedShows: { week1: [{ eventName: 'Show', day: 1 }] },
});
const fullPortfolioProfile = {
  ...seedProfile,
  corps: {
    worldClass: guardedCorps('W Corps'),
    openClass: guardedCorps('O Corps'),
    aClass: guardedCorps('A Corps'),
    soundSport: guardedCorps('S Corps'),
    podiumClass: { ...guardedCorps('P Corps'), podium: { captions: { GE1: 1 } } },
  },
};
async function freshFullPortfolioSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), profilePath), fullPortfolioProfile);
  });
}

await freshFullPortfolioSeed();
await check(
  'owner with all five classes can still update display name (budget regression)',
  assertSucceeds(updateDoc(doc(authed(), profilePath), { displayName: 'New Name' }))
);

// The exact shape the profile edit modal saves: top-level identity fields plus
// per-class ensembleInfo via dotted paths.
await freshFullPortfolioSeed();
await check(
  'owner with all five classes can save the profile-edit-modal payload',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), {
      displayName: 'New Name',
      location: 'Elsewhere',
      directorInfo: { bio: 'hello', specialties: ['Brass'], socialLinks: {} },
      'corps.worldClass.ensembleInfo': { mission: 'm', notableShows: [] },
      'corps.openClass.ensembleInfo': { mission: 'm', notableShows: [] },
      'corps.aClass.ensembleInfo': { mission: 'm', notableShows: [] },
      'corps.soundSport.ensembleInfo': { mission: 'm', notableShows: [] },
      'corps.podiumClass.ensembleInfo': { mission: 'm', notableShows: [] },
    })
  )
);

// The guards must still bite on the same five-class doc — the budget fix must
// not have traded enforcement for cost.
await freshFullPortfolioSeed();
await check(
  'owner with all five classes still cannot forge a lineup',
  assertFails(
    updateDoc(doc(authed(), profilePath), { 'corps.worldClass.lineup': { GE1: 'Illegal' } })
  )
);

await freshFullPortfolioSeed();
await check(
  'owner with all five classes still cannot forge Podium state',
  assertFails(
    updateDoc(doc(authed(), profilePath), { 'corps.podiumClass.podium': { captions: { GE1: 99 } } })
  )
);

// --- other users still blocked entirely ---
await freshSeed();
await check(
  'non-owner cannot update profile at all',
  assertFails(updateDoc(doc(mallory(), profilePath), { bio: 'hax' }))
);

// role is trusted server-side: the admin email fan-out queries
// profile.role == 'admin', and the manual leaderboard/rivals refresh
// callables gate on it. A client-writable role was privilege escalation.
await freshSeed();
await check(
  'owner cannot grant themselves role admin (privilege escalation regression)',
  assertFails(updateDoc(doc(authed(), profilePath), { role: 'admin' }))
);

// =============================================================================
// PROFILE COMMENTS — creation is backend-only. The old rule
// (`allow create: if isAuthenticated()`) let any signed-in user create a
// comment attributed to ANY authorUid: impersonation plus an unbounded
// arbitrary-document spam surface. These tests pin the lockdown.
// =============================================================================
const commentPath = `artifacts/${APP}/users/${ALICE}/comments/comment-1`;
const seedComment = { authorUid: 'mallory-uid', text: 'first!', createdAt: new Date() };

async function freshCommentSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), profilePath), seedProfile);
    await setDoc(doc(ctx.firestore(), commentPath), seedComment);
  });
}

await freshCommentSeed();
await check(
  'comments are publicly readable',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), commentPath)))
);

await freshCommentSeed();
await check(
  'signed-in user cannot create a comment client-side (backend only)',
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/users/${ALICE}/comments/comment-2`), {
      authorUid: 'mallory-uid',
      text: 'hello',
    })
  )
);

await freshCommentSeed();
await check(
  'user cannot create a comment forged as another authorUid (regression)',
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/users/${ALICE}/comments/comment-3`), {
      authorUid: ALICE, // impersonating Alice
      text: 'I said something terrible',
    })
  )
);

await freshCommentSeed();
await check(
  'comment author can edit their own comment',
  assertSucceeds(updateDoc(doc(mallory(), commentPath), { text: 'edited' }))
);

await freshCommentSeed();
await check(
  "non-author cannot edit someone else's comment",
  assertFails(
    updateDoc(doc(testEnv.authenticatedContext('eve-uid').firestore(), commentPath), {
      text: 'defaced',
    })
  )
);

await freshCommentSeed();
await check(
  'profile owner can delete a comment on their profile',
  assertSucceeds(deleteDoc(doc(authed(), commentPath)))
);

// The user-subcollection catch-all grants owners write access to
// unrecognized subcollections — before `comments` was excluded from it, the
// PROFILE OWNER could bypass `allow create: if false` and forge comments on
// their own profile attributed to any authorUid (fake praise from real
// users). Rules are additive, so the exclusion must live on the catch-all.
await freshCommentSeed();
await check(
  'profile owner cannot forge a comment on their own profile (catch-all regression)',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/comments/comment-4`), {
      authorUid: 'mallory-uid', // forged attribution
      text: 'alice is the greatest director ever',
    })
  )
);

// =============================================================================
// NOTIFICATIONS — private per-user league/trade/matchup messages with an
// owner-only rule. The user-subcollection catch-all read did not exclude
// `notifications`, and rules are additive, so any signed-in user could read
// any other user's entire notification feed until the exclusion landed.
// =============================================================================
const notificationPath = `artifacts/${APP}/users/${ALICE}/notifications/notif-1`;
async function freshNotificationSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), notificationPath), {
      type: 'matchup_result',
      title: 'You lost to Bob',
      message: 'Bob beat you 87.5 to 82.1',
      createdAt: new Date(),
    });
  });
}

await freshNotificationSeed();
await check(
  'owner can read their own notifications',
  assertSucceeds(getDoc(doc(authed(), notificationPath)))
);

await freshNotificationSeed();
await check(
  "another user cannot read someone else's notifications (catch-all regression)",
  assertFails(getDoc(doc(mallory(), notificationPath)))
);

await freshNotificationSeed();
await check(
  "another user cannot list someone else's notification feed (catch-all regression)",
  assertFails(getDocs(collection(mallory(), `artifacts/${APP}/users/${ALICE}/notifications`)))
);

// =============================================================================
// PRIVATE DOC — home of the FCM token (a stable device identifier that must
// never sit on the world-readable profile doc). Owner-only read/write.
// =============================================================================
const privatePath = `artifacts/${APP}/users/${ALICE}/private/data`;
async function freshPrivateSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), privatePath), { email: 'alice@example.com' });
  });
}

await freshPrivateSeed();
await check(
  'owner can save their FCM token to private/data',
  assertSucceeds(setDoc(doc(authed(), privatePath), { fcmToken: 'token-123' }, { merge: true }))
);

await freshPrivateSeed();
await check(
  "another user cannot read someone else's private doc (FCM token home)",
  assertFails(getDoc(doc(mallory(), privatePath)))
);

// =============================================================================
// CORPSCOIN HISTORY — the private economy audit trail. It is written only by
// Cloud Functions and read only through the getCorpsCoinHistory callable
// (Admin SDK). No client may read it directly: before this guard the
// subcollection catch-all made every user's full CorpsCoin ledger readable by
// any signed-in user.
// =============================================================================
const coinHistoryPath = `artifacts/${APP}/users/${ALICE}/corpsCoinHistory/txn-1`;
async function freshCoinHistorySeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), coinHistoryPath), {
      amount: 200,
      reason: 'show-participation',
      createdAt: new Date(),
    });
  });
}

await freshCoinHistorySeed();
await check(
  'another user cannot read a user corpsCoinHistory ledger (regression)',
  assertFails(getDoc(doc(mallory(), coinHistoryPath)))
);

await freshCoinHistorySeed();
await check(
  'even the owner cannot read corpsCoinHistory directly (callable-only)',
  assertFails(getDoc(doc(authed(), coinHistoryPath)))
);

await freshCoinHistorySeed();
await check(
  'a signed-in user cannot forge a corpsCoinHistory entry',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/corpsCoinHistory/txn-2`), {
      amount: 999999,
      reason: 'free money',
    })
  )
);

// =============================================================================
// REPORTS & NEWS SUBMISSIONS — created exclusively by callables (Admin SDK).
// The old open create rules were a spam/storage-abuse vector.
// =============================================================================
await testEnv.clearFirestore();
await check(
  'signed-in user cannot create a report directly',
  assertFails(setDoc(doc(mallory(), 'reports/report-1'), { reason: 'spam', reportedUid: ALICE }))
);

await check(
  'signed-in user cannot create a news submission directly',
  assertFails(setDoc(doc(mallory(), 'news_submissions/sub-1'), { headline: 'BREAKING', body: 'x' }))
);

await check(
  'admin can read reports',
  assertSucceeds(
    getDoc(
      doc(testEnv.authenticatedContext('admin-uid', { admin: true }).firestore(), 'reports/nope')
    )
  )
);

await check('non-admin cannot read reports', assertFails(getDoc(doc(mallory(), 'reports/nope'))));

// =============================================================================
// LEAGUE INVITES / INVITATIONS / LEAGUES — enumeration lockdowns.
// /leagueInvites doc IDs ARE the secret join codes (docs carry the leagueId);
// the old `allow read: if isAuthenticated()` included list, so any signed-in
// user could dump every code and join any private league. leagueInvitations
// had careful per-doc invitee/inviter read checks that were nullified by an
// unconditional `allow list: if isAuthenticated()`. These tests pin both
// lockdowns, plus the DELIBERATELY-open leagues list (the community widgets
// run unconstrained queries over the leagues collection — see the tradeoff
// comment in firestore.rules).
// =============================================================================
const BOB = 'bob-uid'; // league member + invitation sender
const invitePath = 'leagueInvites/SECRET-CODE-1';
const invitationsPath = `artifacts/${APP}/leagueInvitations`;
const leaguesPath = `artifacts/${APP}/leagues`;

async function freshLeagueSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), invitePath), {
      leagueId: 'league-1',
      createdAt: new Date(),
    });
    await setDoc(doc(ctx.firestore(), `${invitationsPath}/inv-1`), {
      inviteeUid: ALICE,
      inviterUid: BOB,
      leagueId: 'league-1',
      status: 'pending',
      invitedAt: new Date(),
    });
    await setDoc(doc(ctx.firestore(), `${leaguesPath}/league-1`), {
      name: 'Private League',
      isPublic: false,
      members: [BOB],
      creatorId: BOB,
      createdAt: new Date(),
    });
    // Invite code home since it moved OFF the (listable) league doc:
    // member-only meta/private subcollection doc.
    await setDoc(doc(ctx.firestore(), `${leaguesPath}/league-1/meta/private`), {
      inviteCode: 'SECRET-CODE-1',
    });
  });
}

// --- leagueInvites: backend-only, even with a known code ---
await freshLeagueSeed();
await check(
  'signed-in user cannot get a leagueInvites doc even knowing the code (regression)',
  assertFails(getDoc(doc(mallory(), invitePath)))
);

await freshLeagueSeed();
await check(
  'signed-in user cannot list/enumerate leagueInvites codes (regression)',
  assertFails(getDocs(collection(mallory(), 'leagueInvites')))
);

// --- leagueInvitations: list only with an owning filter ---
await freshLeagueSeed();
await check(
  'signed-in user cannot list leagueInvitations without an owning filter (regression)',
  assertFails(getDocs(collection(mallory(), invitationsPath)))
);

await freshLeagueSeed();
await check(
  "user cannot list ANOTHER user's leagueInvitations even with their inviteeUid filter",
  assertFails(
    getDocs(query(collection(mallory(), invitationsPath), where('inviteeUid', '==', ALICE)))
  )
);

// The exact query the client runs (getPendingInvitations in src/api/leagues.ts)
await freshLeagueSeed();
await check(
  'invitee CAN list their own invitations with the inviteeUid+status filter',
  assertSucceeds(
    getDocs(
      query(
        collection(authed(), invitationsPath),
        where('inviteeUid', '==', ALICE),
        where('status', '==', 'pending')
      )
    )
  )
);

await freshLeagueSeed();
await check(
  'inviter CAN list invitations they sent with the inviterUid filter',
  assertSucceeds(
    getDocs(
      query(
        collection(testEnv.authenticatedContext(BOB).firestore(), invitationsPath),
        where('inviterUid', '==', BOB)
      )
    )
  )
);

await freshLeagueSeed();
await check(
  'invitee can get their own invitation doc',
  assertSucceeds(getDoc(doc(authed(), `${invitationsPath}/inv-1`)))
);

await freshLeagueSeed();
await check(
  "third party cannot get someone else's invitation doc",
  assertFails(getDoc(doc(mallory(), `${invitationsPath}/inv-1`)))
);

// --- leagues: get is member-only; list is deliberately open (see rules) ---
await freshLeagueSeed();
await check(
  'non-member cannot get a private league doc',
  assertFails(getDoc(doc(mallory(), `${leaguesPath}/league-1`)))
);

await freshLeagueSeed();
await check(
  'member can get their league doc',
  assertSucceeds(
    getDoc(doc(testEnv.authenticatedContext(BOB).firestore(), `${leaguesPath}/league-1`))
  )
);

// Pins the SCOPED list (was the "deliberately open" tradeoff): the live
// namespace requires an owning/public filter, so private leagues' member
// arrays and settings are no longer enumerable by any signed-in user. The
// frozen legacy namespace stays open for the community widgets
// (src/api/community.ts) — pinned separately below.
await freshLeagueSeed();
await check(
  'signed-in user can NO LONGER dump the leagues collection unfiltered (regression)',
  assertFails(getDocs(collection(mallory(), leaguesPath)))
);

await freshLeagueSeed();
await check(
  "third party cannot enumerate a private league via someone else's members filter",
  assertFails(
    getDocs(query(collection(mallory(), leaguesPath), where('members', 'array-contains', BOB)))
  )
);

await freshLeagueSeed();
await check(
  "third party cannot enumerate leagues via someone else's creatorId filter",
  assertFails(getDocs(query(collection(mallory(), leaguesPath), where('creatorId', '==', BOB))))
);

// The exact query shapes the client runs (src/api/leagues.ts).
await freshLeagueSeed();
await check(
  'public-league browse (isPublic == true) is allowed and excludes private leagues',
  assertSucceeds(getDocs(query(collection(mallory(), leaguesPath), where('isPublic', '==', true))))
);

await freshLeagueSeed();
await check(
  'member can list their own leagues with the members filter',
  assertSucceeds(
    getDocs(
      query(
        collection(testEnv.authenticatedContext(BOB).firestore(), leaguesPath),
        where('members', 'array-contains', BOB)
      )
    )
  )
);

await freshLeagueSeed();
await check(
  'creator can list leagues they created with the creatorId filter',
  assertSucceeds(
    getDocs(
      query(
        collection(testEnv.authenticatedContext(BOB).firestore(), leaguesPath),
        where('creatorId', '==', BOB)
      )
    )
  )
);

// The frozen legacy namespace the landing widgets read stays fully listable
// (archived data, never written again — see the NOTE in src/api/community.ts).
await freshLeagueSeed();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'artifacts/fantasy_drum_corps_v1/leagues/legacy-1'), {
    name: 'Legacy League',
    createdAt: new Date(),
  });
});
await check(
  'legacy-namespace leagues stay listable unfiltered (community widgets)',
  assertSucceeds(getDocs(collection(mallory(), 'artifacts/fantasy_drum_corps_v1/leagues')))
);

await freshLeagueSeed();
await check(
  'unauthenticated visitor cannot list leagues',
  assertFails(getDocs(collection(testEnv.unauthenticatedContext().firestore(), leaguesPath)))
);

// --- meta/private: the invite code's new home. Because the leagues list is
// deliberately open, the code moved off the league doc into this member-only
// subcollection doc — a non-member must not be able to get OR list it, or the
// enumeration hole reopens one level down.
await freshLeagueSeed();
await check(
  'member can read the league invite code from meta/private',
  assertSucceeds(
    getDoc(
      doc(testEnv.authenticatedContext(BOB).firestore(), `${leaguesPath}/league-1/meta/private`)
    )
  )
);

await freshLeagueSeed();
await check(
  'non-member cannot read a private league invite code from meta/private',
  assertFails(getDoc(doc(mallory(), `${leaguesPath}/league-1/meta/private`)))
);

await freshLeagueSeed();
await check(
  'non-member cannot list the league meta subcollection (invite-code enumeration)',
  assertFails(getDocs(collection(mallory(), `${leaguesPath}/league-1/meta`)))
);

// =============================================================================
// drop_plans — nightly score-drop plans (public countdown data, backend-written
// by the drop dispatcher). Anyone may read; no client may ever write.
// =============================================================================
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'drop_plans/2026-07-15'), {
    showDateET: '2026-07-15',
    dropLabel: '2026-07-15 23:00 ET',
  });
});

await check(
  'drop_plans are publicly readable (client countdown)',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'drop_plans/2026-07-15')))
);

await check(
  'signed-in user cannot write a drop plan (backend only)',
  assertFails(setDoc(doc(mallory(), 'drop_plans/2026-07-15'), { dropLabel: 'hacked' }))
);

// =============================================================================
// fantasy_standings — nightly materialized season standings (public read like
// the recaps they summarize; written only by the scoring pipeline).
// =============================================================================
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'fantasy_standings/season-1'), {
    seasonUid: 'season-1',
    scoredDays: [1, 2],
  });
  await setDoc(doc(ctx.firestore(), 'fantasy_standings/season-1/classes/worldClass'), {
    classKey: 'worldClass',
    entries: [],
  });
});

await check(
  'standings summary is publicly readable',
  assertSucceeds(
    getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'fantasy_standings/season-1'))
  )
);

await check(
  'standings class doc is publicly readable',
  assertSucceeds(
    getDoc(
      doc(
        testEnv.unauthenticatedContext().firestore(),
        'fantasy_standings/season-1/classes/worldClass'
      )
    )
  )
);

await check(
  'signed-in user cannot write standings (backend only)',
  assertFails(setDoc(doc(mallory(), 'fantasy_standings/season-1'), { scoredDays: [1, 2, 3] }))
);

await check(
  'signed-in user cannot write a standings class doc (backend only)',
  assertFails(
    setDoc(doc(mallory(), 'fantasy_standings/season-1/classes/worldClass'), { entries: [] })
  )
);

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
