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
import { doc, updateDoc, setDoc } from 'firebase/firestore';

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
      'corps.worldClass.corpsName': 'Renamed Corps',
      'corps.worldClass.location': 'Elsewhere',
      'corps.worldClass.showConcept': 'New Show',
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

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
