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
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

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

// --- other users still blocked entirely ---
await freshSeed();
await check(
  'non-owner cannot update profile at all',
  assertFails(updateDoc(doc(mallory(), profilePath), { bio: 'hax' }))
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

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
