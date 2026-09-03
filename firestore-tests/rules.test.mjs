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
  deleteField,
  collection,
  collectionGroup,
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
const admin = () => testEnv.authenticatedContext('admin-uid', { admin: true }).firestore();

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

// =============================================================================
// FREE-TEXT SIZE/TYPE CAPS — profile/data is world-readable, so owner-writable
// free-text fields (bio, displayName, location, favoriteCorps, directorInfo)
// are coarsely bounded in rules: oversized or non-string junk written by an
// owner would otherwise be publicly served to every visitor. Caps are checked
// only for fields the write touches, so partial updates and deletions keep
// working.
// =============================================================================
await freshSeed();
await check(
  'owner cannot write an oversized bio (2KB cap)',
  assertFails(updateDoc(doc(authed(), profilePath), { bio: 'x'.repeat(5000) }))
);

await freshSeed();
await check(
  'owner cannot write a non-string bio',
  assertFails(updateDoc(doc(authed(), profilePath), { bio: 12345 }))
);

await freshSeed();
await check(
  'owner cannot write an oversized displayName (100 cap)',
  assertFails(updateDoc(doc(authed(), profilePath), { displayName: 'D'.repeat(150) }))
);

await freshSeed();
await check(
  'owner cannot write an oversized location (200 cap)',
  assertFails(updateDoc(doc(authed(), profilePath), { location: 'L'.repeat(500) }))
);

await freshSeed();
await check(
  'owner cannot write an oversized favoriteCorps (200 cap)',
  assertFails(updateDoc(doc(authed(), profilePath), { favoriteCorps: 'F'.repeat(500) }))
);

await freshSeed();
await check(
  'owner can delete a capped free-text field (FieldValue.delete still works)',
  assertSucceeds(updateDoc(doc(authed(), profilePath), { bio: deleteField() }))
);

// The exact onboarding merge shape (mergeProfile in src/pages/Onboarding.jsx)
await freshSeed();
await check(
  'onboarding merge with empty free-text fields still passes the caps',
  assertSucceeds(
    setDoc(
      doc(authed(), profilePath),
      { location: '', bio: '', favoriteCorps: '' },
      { merge: true }
    )
  )
);

// directorInfo is written wholesale by the profile edit modal; its free-text
// members and social links are capped, and unknown keys are rejected so a
// giant payload cannot hide under an unchecked key.
await freshSeed();
await check(
  'owner can save a full modal-shaped directorInfo with socials',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: {
        bio: 'Directing since 2020',
        yearsDirecting: 5,
        specialties: ['Brass', 'General Effect'],
        credentials: 'BA Music Ed',
        acceptingLeagueInvites: true,
        socialLinks: { website: 'https://example.com', twitter: '@alice' },
      },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write an oversized directorInfo.bio',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'x'.repeat(5000), specialties: [], socialLinks: {} },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write an oversized social link (300 cap)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: {
        bio: 'ok',
        specialties: [],
        socialLinks: { website: 'https://example.com/' + 'a'.repeat(500) },
      },
    })
  )
);

await freshSeed();
await check(
  'owner cannot smuggle text under an unknown socialLinks key',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: {
        bio: 'ok',
        specialties: [],
        socialLinks: { myspace: 'x'.repeat(100000) },
      },
    })
  )
);

await freshSeed();
await check(
  'owner cannot smuggle text under an unknown directorInfo key',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', wall_of_text: 'x'.repeat(100000) },
    })
  )
);

await freshSeed();
await check(
  'owner cannot replace directorInfo with a non-map',
  assertFails(updateDoc(doc(authed(), profilePath), { directorInfo: 'x'.repeat(100000) }))
);

// Writes that do not touch a capped field never pay for the caps: the seed
// bio stays in place while an unrelated cosmetic field changes.
await freshSeed();
await check(
  'update not touching capped fields is unaffected by the caps',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), { 'corps.worldClass.showConcept': 'Untouched' })
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

// customAvatarBanned gates the setCorpsAvatarFromUrl callable; a banned director
// must not be able to lift their own block by writing the field directly.
await freshSeed();
await check(
  'owner cannot lift their own custom-avatar ban',
  assertFails(updateDoc(doc(authed(), profilePath), { customAvatarBanned: false }))
);

// moderation.restricted gates the zero-sum callables (assertNotRestricted); a
// restricted alt must not be able to lift its own block by writing the field.
await freshSeed();
await check(
  'owner cannot clear their own account restriction',
  assertFails(updateDoc(doc(authed(), profilePath), { moderation: { restricted: false } }))
);

// Legacy Endowments: the recurring CorpsCoin sink. `legacy.total` renders on
// public profiles and grants milestone titles, so a client write would mint a
// free legacy and its honors without ever spending a coin.
await freshSeed();
await check(
  'owner cannot write legacy.total (free legacy)',
  assertFails(updateDoc(doc(authed(), profilePath), { 'legacy.total': 1000000 }))
);

await freshSeed();
await check(
  'owner cannot replace the legacy map',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      legacy: { total: 1000000, count: 99, entries: [{ tierId: 'facility' }] },
    })
  )
);

await freshSeed();
await check(
  'owner cannot forge a legacy entry',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'legacy.entries': [{ tierId: 'facility', amount: 100000 }],
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

// --- corps keys are a registry allowlist ---
await freshSeed();
await check(
  'owner cannot add an unknown corps class (with lineup + shows)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.fakeClass': {
        corpsName: 'Ghost Corps',
        lineup: { GE1: 'X' },
        selectedShows: { week3: [{ eventName: 'Every Show' }] },
      },
    })
  )
);

await freshSeed();
await check(
  'owner cannot add an unknown corps class via merge set',
  assertFails(
    setDoc(
      doc(authed(), profilePath),
      { corps: { soundsport: { corpsName: 'Wrong Case' } } },
      { merge: true }
    )
  )
);

// Positive path for the allowlist: soundSport is the one class a client
// creates (onboarding); the competitive classes are created server-side.
await freshSeed();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), profilePath), { 'corps.soundSport': deleteField() });
});
await check(
  'owner can add the soundSport class to a profile without one',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport': { corpsName: 'Fresh SS', lineup: { GE1: 'Genesis' } },
    })
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

// avatarUrl is written only by the avatar callables (AI generation and
// setCorpsAvatarFromUrl), which re-host the image to a CSP-allowlisted host and
// enforce size/crop + the custom-avatar ban. A direct client write would set an
// arbitrary URL and bypass all of that, so it must be rejected on every class.
await freshSeed();
await check(
  'owner cannot set a competitive-class avatarUrl directly (bypasses re-host/ban)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.avatarUrl': 'https://evil.example.com/anything.png',
    })
  )
);

await freshSeed();
await check(
  'owner cannot set a soundSport avatarUrl directly (bypasses re-host/ban)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport.avatarUrl': 'https://evil.example.com/anything.png',
    })
  )
);

// The equipped Uniform Studio snapshot (corps.{class}.uniform) is written only
// by the equipUniformDesign callable, which validates the design's shape and
// size server-side — a direct client write could plant an oversized or
// malformed payload on the world-readable profile doc.
await freshSeed();
await check(
  'owner cannot plant a corps uniform snapshot directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.uniform': { designId: 'forged', figure: { skin: '#c9a074' } },
    })
  )
);

await freshSeed();
await check(
  'owner cannot plant a soundSport uniform snapshot directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport.uniform': { designId: 'forged', figure: { skin: '#c9a074' } },
    })
  )
);

// The alternate look (corps.{class}.uniformAlt) gets the same callable-only
// treatment as the primary snapshot, on both guard paths.
await freshSeed();
await check(
  'owner cannot plant a corps alternate look directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.uniformAlt': { designId: 'forged', figure: { skin: '#c9a074' } },
    })
  )
);

await freshSeed();
await check(
  'owner cannot plant a soundSport alternate look directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport.uniformAlt': { designId: 'forged', figure: { skin: '#c9a074' } },
    })
  )
);

// The guard's show look (corps.{class}.uniformGuard) is the third
// callable-only snapshot slot, pinned on both guard paths like the others.
await freshSeed();
await check(
  'owner cannot plant a corps guard look directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.worldClass.uniformGuard': { designId: 'forged', figure: { skin: '#c9a074' } },
    })
  )
);

await freshSeed();
await check(
  'owner cannot plant a soundSport guard look directly (callable-only)',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      'corps.soundSport.uniformGuard': { designId: 'forged', figure: { skin: '#c9a074' } },
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

// --- creation is backend-only; the owner's write surface is exactly
// mark-read + delete (useLeagueNotifications.ts). The old blanket owner
// `write` let a user forge arbitrary "official" notifications to themselves
// with unbounded payloads.
await freshNotificationSeed();
await check(
  'owner can mark their notification read (the real client write)',
  assertSucceeds(updateDoc(doc(authed(), notificationPath), { read: true }))
);

await freshNotificationSeed();
await check(
  'owner can delete their own notification (clearOldNotifications)',
  assertSucceeds(deleteDoc(doc(authed(), notificationPath)))
);

await freshNotificationSeed();
await check(
  'owner cannot create a notification client-side (forgery, backend only)',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/notifications/forged-1`), {
      type: 'league_invite',
      title: 'OFFICIAL: You won',
      message: 'x'.repeat(100000),
      createdAt: new Date(),
    })
  )
);

await freshNotificationSeed();
await check(
  'owner cannot rewrite notification content via update (mark-read only)',
  assertFails(
    updateDoc(doc(authed(), notificationPath), {
      title: 'OFFICIAL: You actually won',
      message: 'forged',
    })
  )
);

await freshNotificationSeed();
await check(
  'owner cannot piggyback content changes onto a mark-read update',
  assertFails(updateDoc(doc(authed(), notificationPath), { read: true, message: 'forged' }))
);

await freshNotificationSeed();
await check(
  'notification read flag must be a boolean',
  assertFails(updateDoc(doc(authed(), notificationPath), { read: 'x'.repeat(100000) }))
);

await freshNotificationSeed();
await check(
  "another user cannot mark someone else's notification read",
  assertFails(updateDoc(doc(mallory(), notificationPath), { read: true }))
);

// =============================================================================
// USER-SUBCOLLECTION CATCH-ALL — inverted to default-private. Unlisted
// subcollections (email_log, corpsCoinHistory, future additions) are readable
// only by their owner and writable only by the backend; the old default-public
// denylist made every NEW subcollection world-readable-to-authenticated.
// =============================================================================
const emailLogPath = `artifacts/${APP}/users/${ALICE}/email_log/entry-1`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), profilePath), seedProfile);
  await setDoc(doc(ctx.firestore(), emailLogPath), { type: 'weekly_digest', sentAt: 1 });
});

await check(
  "another user cannot read someone else's email_log (default-private catch-all)",
  assertFails(getDoc(doc(mallory(), emailLogPath)))
);

await check(
  'owner can read their own unlisted subcollection docs',
  assertSucceeds(getDoc(doc(authed(), emailLogPath)))
);

await check(
  'owner cannot write an unlisted subcollection (backend only)',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/email_log/entry-2`), { forged: true })
  )
);

// Uniform Studio wardrobe (users/{uid}/wardrobe): exactly the catch-all
// contract, pinned here on purpose — owner-read, callable-only writes. If a
// future rules edit widens the catch-all or gives wardrobe its own block,
// these keep the write path server-mediated (the callables validate design
// shape/size and enforce the wardrobe cap).
const wardrobePath = `artifacts/${APP}/users/${ALICE}/wardrobe/design-1`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), profilePath), seedProfile);
  await setDoc(doc(ctx.firestore(), wardrobePath), { schema: 2, name: 'Saved Look' });
});

await check(
  'owner can read their own wardrobe designs',
  assertSucceeds(getDoc(doc(authed(), wardrobePath)))
);

await check(
  "another user cannot read someone else's wardrobe",
  assertFails(getDoc(doc(mallory(), wardrobePath)))
);

await check(
  'owner cannot write a wardrobe design directly (callable-only)',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/wardrobe/design-2`), {
      schema: 2,
      name: 'Forged',
    })
  )
);

await check(
  "signed-in user cannot write into another user's unlisted subcollection",
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/users/${ALICE}/mystery/doc-1`), { spam: true })
  )
);

await freshNotificationSeed();
await check(
  "another user cannot list someone else's notification feed (catch-all regression)",
  assertFails(getDocs(collection(mallory(), `artifacts/${APP}/users/${ALICE}/notifications`)))
);

// Uniform codes (artifacts/{app}/uniform_codes): world-readable snapshots of
// pure structured design data, minted only by the mintUniformCode callable.
const uniformCodePath = `artifacts/${APP}/uniform_codes/MA-TEST-AB`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), uniformCodePath), {
    design: { schema: 2, name: 'Shared Look' },
    creatorName: 'alice',
  });
});

// landing_scores/{seasonUid}: the nightly materialized Live Scores ranking the
// landing page reads signed out. Backend-only writes.
const landingScoresPath = 'landing_scores/off_2026';
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), landingScoresPath), { seasonUid: 'off_2026', corps: [] });
});
await check(
  'anyone (even signed out) can read the materialized landing scores',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), landingScoresPath)))
);
await check(
  'nobody (not even admin) can write landing scores from a client',
  assertFails(setDoc(doc(admin(), landingScoresPath), { seasonUid: 'x', corps: [] }))
);

await check(
  'anyone (even signed out) can read a uniform code',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), uniformCodePath)))
);

await check(
  'signed-in users cannot mint or overwrite a uniform code directly',
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/uniform_codes/MA-EVIL-XX`), {
      design: { schema: 2, name: 'Forged' },
    })
  )
);

// Design Exchange (artifacts/{app}/design_exchange): the public uniform
// gallery. Entries world-readable, all writes callable-only; a viewer reads
// only their OWN like/save marker; reports and the payout ledger are locked.
const exchangeEntryPath = `artifacts/${APP}/design_exchange/${ALICE}_d1`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), exchangeEntryPath), {
    design: { schema: 2, name: 'Gallery Look' },
    creatorUid: ALICE,
    likes: 0,
  });
  await setDoc(doc(ctx.firestore(), `${exchangeEntryPath}/likes/${ALICE}`), { likedAt: 'x' });
  await setDoc(doc(ctx.firestore(), `${exchangeEntryPath}/reports/${ALICE}`), { reason: 'r' });
});

await check(
  'anyone (even signed out) can browse Design Exchange entries',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), exchangeEntryPath)))
);

await check(
  'signed-in users cannot write a gallery entry directly (callable-only)',
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/design_exchange/mallory-uid_dX`), {
      design: { schema: 2, name: 'Forged' },
      creatorUid: 'mallory-uid',
    })
  )
);

await check(
  'a user reads their own like marker',
  assertSucceeds(getDoc(doc(authed(), `${exchangeEntryPath}/likes/${ALICE}`)))
);

await check(
  "a user cannot read someone else's like marker",
  assertFails(getDoc(doc(mallory(), `${exchangeEntryPath}/likes/${ALICE}`)))
);

await check(
  'like markers cannot be written directly (callable-only)',
  assertFails(setDoc(doc(authed(), `${exchangeEntryPath}/likes/${ALICE}`), { likedAt: 'y' }))
);

await check(
  'reports are unreadable even by their author',
  assertFails(getDoc(doc(authed(), `${exchangeEntryPath}/reports/${ALICE}`)))
);

await check(
  'the creator-payout ledger is locked (no rules match, default deny)',
  assertFails(getDoc(doc(authed(), `artifacts/${APP}/design_exchange_payouts/${ALICE}`)))
);

// Design Briefs (artifacts/{app}/design_briefs): the weekly styling-contest
// leaderboard — public bragging rights, callable-only writes.
const briefEntryPath = `artifacts/${APP}/design_briefs/2026-W35/entries/${ALICE}`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), briefEntryPath), {
    score: 85,
    username: 'alice',
    designName: 'Brief Entry',
  });
});

await check(
  'anyone (even signed out) can read the Design Brief leaderboard',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), briefEntryPath)))
);

await check(
  'brief entries cannot be written directly (callable-only)',
  assertFails(
    setDoc(doc(mallory(), `artifacts/${APP}/design_briefs/2026-W35/entries/mallory-uid`), {
      score: 100,
      username: 'mallory',
    })
  )
);

// The Showcase (artifacts/{app}/showcases): finalized results are public;
// entries and ballots stay locked so pairwise voting is anonymous.
const showcaseResultsPath = `artifacts/${APP}/showcases/2026-08`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), showcaseResultsPath), {
    monthId: '2026-08',
    winners: [{ username: 'alice', designName: 'Winner Look' }],
  });
  await setDoc(doc(ctx.firestore(), `${showcaseResultsPath}/entries/${ALICE}`), {
    username: 'alice',
    wins: 3,
  });
  await setDoc(doc(ctx.firestore(), `${showcaseResultsPath}/votes/${ALICE}`), { count: 2 });
});

await check(
  'anyone (even signed out) can read finalized Showcase results',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), showcaseResultsPath)))
);

// historical_scores/{year}/events — the sharded per-event score archive. Public
// to read like the parent year doc; written only by the backend (Admin SDK).
const histEventPath = `historical_scores/2019/events/evt1`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `historical_scores/2019`), { sharded: true });
  await setDoc(doc(ctx.firestore(), histEventPath), { eventName: 'Finals', scores: [] });
});

await check(
  'anyone (even signed out) can read a sharded historical_scores event',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), histEventPath)))
);

await check(
  'sharded historical_scores events cannot be written directly (backend only)',
  assertFails(setDoc(doc(mallory(), histEventPath), { eventName: 'Forged' }))
);

await check(
  'Showcase results cannot be written directly (nightly stage only)',
  assertFails(setDoc(doc(mallory(), `artifacts/${APP}/showcases/2026-09`), { winners: [] }))
);

await check(
  'Showcase entries are unreadable even by their author (voting is anonymous)',
  assertFails(getDoc(doc(authed(), `${showcaseResultsPath}/entries/${ALICE}`)))
);

await check(
  'Showcase ballots are unreadable even by the voter',
  assertFails(getDoc(doc(authed(), `${showcaseResultsPath}/votes/${ALICE}`)))
);

await check(
  'Showcase entries cannot be planted directly',
  assertFails(setDoc(doc(mallory(), `${showcaseResultsPath}/entries/mallory-uid`), { wins: 999 }))
);

// =============================================================================
// CAPTION LEDGER — the private per-caption fantasy recap the nightly scorer
// writes for each director's own outings. The public fantasy recap keeps
// classes at GE/VIS/MUS so lineups can't be harvested; the analysis-grade
// per-caption detail lives here, owner-read and backend-write only.
// =============================================================================
const captionLedgerPath = `artifacts/${APP}/users/${ALICE}/captionLedger/season-1/days/12`;
async function freshCaptionLedgerSeed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), captionLedgerPath), {
      day: 12,
      outings: [{ corpsClass: 'worldClass', captions: { GE1: 18.5 }, totalScore: 90 }],
    });
  });
}

await freshCaptionLedgerSeed();
await check(
  'owner can read their own caption ledger',
  assertSucceeds(getDoc(doc(authed(), captionLedgerPath)))
);

await freshCaptionLedgerSeed();
await check(
  "another user cannot read someone else's caption ledger (per-caption is private)",
  assertFails(getDoc(doc(mallory(), captionLedgerPath)))
);

await freshCaptionLedgerSeed();
await check(
  'owner cannot forge caption-ledger entries client-side (backend only)',
  assertFails(
    setDoc(doc(authed(), `artifacts/${APP}/users/${ALICE}/captionLedger/season-1/days/13`), {
      day: 13,
      outings: [{ corpsClass: 'worldClass', captions: { GE1: 20 }, totalScore: 100 }],
    })
  )
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

// --- matchupHistory: where rollover MOVES a finished season's weeks, so the
// live collection only ever holds the current season. It is the same league
// data the live weeks were, and gets the same member-only read.
await freshLeagueSeed();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `${leaguesPath}/league-1/matchupHistory/old-season_week-1`), {
    seasonUid: 'old-season',
    worldClassMatchups: [],
  });
});
await check(
  'member can read archived league matchups',
  assertSucceeds(
    getDoc(
      doc(
        testEnv.authenticatedContext(BOB).firestore(),
        `${leaguesPath}/league-1/matchupHistory/old-season_week-1`
      )
    )
  )
);

await freshLeagueSeed();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `${leaguesPath}/league-1/matchupHistory/old-season_week-1`), {
    seasonUid: 'old-season',
    worldClassMatchups: [],
  });
});
await check(
  'non-member cannot read archived league matchups',
  assertFails(getDoc(doc(mallory(), `${leaguesPath}/league-1/matchupHistory/old-season_week-1`)))
);

await freshLeagueSeed();
await check(
  'no client may write archived league matchups (backend only)',
  assertFails(
    setDoc(
      doc(
        testEnv.authenticatedContext(BOB).firestore(),
        `${leaguesPath}/league-1/matchupHistory/forged_week-1`
      ),
      { worldClassMatchups: [] }
    )
  )
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

// --- PROFILE READ SURFACE + ENUMERATION (2026-09 audit) ---
// profile/data carries lineups, show picks, and prediction picks: readable by
// any signed-in director, never anonymously. The `profile` collection group
// and the `usernames` collection are the two bulk-enumeration paths.
await freshSeed();
await check(
  'unauthenticated visitor cannot read profile/data',
  assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), profilePath)))
);

await check(
  'signed-in third party can read another director profile/data',
  assertSucceeds(getDoc(doc(mallory(), profilePath)))
);

await check(
  'signed-in user cannot list the profile collection group (enumeration)',
  assertFails(getDocs(collectionGroup(mallory(), 'profile')))
);

await check(
  'admin can list the profile collection group',
  assertSucceeds(
    getDocs(
      collectionGroup(
        testEnv.authenticatedContext('admin-uid', { admin: true }).firestore(),
        'profile'
      )
    )
  )
);

const publicProfilePath = `artifacts/${APP}/users/${ALICE}/profile/public`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), publicProfilePath), { username: 'alice', xp: 50 });
});

await check(
  'signed-in third party can read another director profile/public (the mirror)',
  assertSucceeds(getDoc(doc(mallory(), publicProfilePath)))
);

await check(
  'unauthenticated visitor cannot read profile/public',
  assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), publicProfilePath)))
);

await check(
  'owner cannot write profile/public (server-mirrored only)',
  assertFails(updateDoc(doc(authed(), publicProfilePath), { xp: 999999 }))
);

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'usernames/alice'), { uid: ALICE });
  await setDoc(doc(ctx.firestore(), 'usernames/bob'), { uid: 'bob-uid' });
});

await check(
  'anyone can get a single usernames doc (username → uid resolve)',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'usernames/alice')))
);

await check(
  'signed-in user cannot list usernames (username → uid map enumeration)',
  assertFails(getDocs(collection(mallory(), 'usernames')))
);

await check(
  'signed-in user cannot list usernames via a filter either',
  assertFails(getDocs(query(collection(mallory(), 'usernames'), where('uid', '==', ALICE))))
);

// =============================================================================
// 2026-09-02 audit batch — diff guards and coverage for paths that had none.
// =============================================================================

// directorInfo.yearsDirecting / specialties — both land on a public doc; a
// non-numeric or absurd year and an unbounded specialties list are rejected.
await freshSeed();
await check(
  'owner can clear yearsDirecting (null) and save a normal specialties list',
  assertSucceeds(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', yearsDirecting: null, specialties: ['Brass', 'Visual'] },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write a string or absurd yearsDirecting',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', yearsDirecting: 'x'.repeat(50000), specialties: [] },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write yearsDirecting above a human lifetime',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', yearsDirecting: 5000, specialties: [] },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write an oversized specialties list',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', specialties: Array.from({ length: 200 }, (_, i) => `s${i}`) },
    })
  )
);

await freshSeed();
await check(
  'owner cannot smuggle a wall of text inside specialties',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', specialties: ['x'.repeat(20000)] },
    })
  )
);

await freshSeed();
await check(
  'owner cannot write non-string specialties',
  assertFails(
    updateDoc(doc(authed(), profilePath), {
      directorInfo: { bio: 'ok', specialties: [{ nested: 'map' }] },
    })
  )
);

// Profile comments — an author may edit the body only: attribution and any
// other key are frozen, and the body stays bounded (comments are public).
await freshCommentSeed();
await check(
  'comment author cannot rewrite authorUid on their own comment',
  assertFails(updateDoc(doc(mallory(), commentPath), { authorUid: ALICE }))
);

await freshCommentSeed();
await check(
  'comment author cannot add an unlisted key to their comment',
  assertFails(updateDoc(doc(mallory(), commentPath), { text: 'ok', pinned: true }))
);

await freshCommentSeed();
await check(
  'comment author cannot grow the body without bound',
  assertFails(updateDoc(doc(mallory(), commentPath), { text: 'x'.repeat(5000) }))
);

await freshCommentSeed();
await check(
  'comment author cannot blank the body or make it a non-string',
  assertFails(updateDoc(doc(mallory(), commentPath), { text: 42 }))
);

// private/data — the owner may touch only the FCM token keys; the email and
// age-gate attestation are server-written, and the doc is never deletable
// by its owner.
await freshPrivateSeed();
await check(
  'owner can clear their FCM token (null + stamp)',
  assertSucceeds(
    setDoc(
      doc(authed(), privatePath),
      { fcmToken: null, fcmTokenUpdatedAt: new Date().toISOString() },
      { merge: true }
    )
  )
);

await freshPrivateSeed();
await check(
  'owner cannot rewrite their email on private/data',
  assertFails(updateDoc(doc(authed(), privatePath), { email: 'someone-else@example.com' }))
);

await freshPrivateSeed();
await check(
  'owner cannot forge an age-gate attestation on private/data',
  assertFails(
    updateDoc(doc(authed(), privatePath), { ageGate: { attestedAt: new Date().toISOString() } })
  )
);

await freshPrivateSeed();
await check(
  'owner cannot write an oversized FCM token',
  assertFails(setDoc(doc(authed(), privatePath), { fcmToken: 'x'.repeat(5000) }, { merge: true }))
);

await freshPrivateSeed();
await check('owner cannot delete private/data', assertFails(deleteDoc(doc(authed(), privatePath))));

await testEnv.clearFirestore();
await check(
  'owner can create private/data with just the FCM token',
  assertSucceeds(setDoc(doc(authed(), privatePath), { fcmToken: 'token-1' }))
);

await testEnv.clearFirestore();
await check(
  'owner cannot create private/data carrying an email',
  assertFails(setDoc(doc(authed(), privatePath), { fcmToken: 'token-1', email: 'x@example.com' }))
);

await freshPrivateSeed();
await check(
  'signed-in user cannot list the private collection group',
  assertFails(getDocs(collectionGroup(mallory(), 'private')))
);

await freshPrivateSeed();
await check(
  'admin can list the private collection group (admin panel email join)',
  assertSucceeds(getDocs(collectionGroup(admin(), 'private')))
);

// articles collection group — scoped to the news_hub tree. Any other
// subcollection that happens to be named `articles` is not world-readable.
const hubArticlePath = 'news_hub/season-1/days/day_3/articles/daily_recap';
const strayArticlePath = `artifacts/${APP}/users/${ALICE}/articles/draft-1`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), hubArticlePath), {
    isPublished: true,
    authorUid: ALICE,
    headline: 'Recap',
    createdAt: new Date(),
  });
  await setDoc(doc(ctx.firestore(), strayArticlePath), {
    isPublished: true,
    authorUid: ALICE,
    headline: 'Not news',
    createdAt: new Date(),
  });
});

await check(
  'anyone can query the articles group inside news_hub (director articles)',
  assertSucceeds(
    getDocs(
      query(
        collectionGroup(testEnv.unauthenticatedContext().firestore(), 'articles'),
        where('authorUid', '==', ALICE),
        where('isPublished', '==', true)
      )
    )
  )
);

await check(
  'a stray articles subcollection outside news_hub is not readable via the group rule',
  assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), strayArticlePath)))
);

await check(
  'the articles group cannot be listed without the isPublished filter (drafts stay hidden)',
  assertFails(
    getDocs(
      query(
        collectionGroup(testEnv.unauthenticatedContext().firestore(), 'articles'),
        where('authorUid', '==', ALICE)
      )
    )
  )
);

await check(
  'a news_hub article stays directly readable',
  assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), hubArticlePath)))
);

// --- Paths that previously had no regression test at all ---
const anon = () => testEnv.unauthenticatedContext().firestore();

// supporters — PII (payer email + name), fully locked.
const supporterPath = `artifacts/${APP}/supporters/hash-1`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), supporterPath), { email: 'fan@example.com', name: 'Fan' });
});
await check(
  'signed-in user cannot read a supporters doc (PII)',
  assertFails(getDoc(doc(mallory(), supporterPath)))
);
await check(
  'signed-in user cannot write a supporters doc',
  assertFails(setDoc(doc(mallory(), supporterPath), { email: 'x@example.com' }))
);

// seasonDetail — public history, server-written.
const seasonDetailPath = `artifacts/${APP}/users/${ALICE}/seasonDetail/season-1`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), seasonDetailPath), { lineup: { GE1: 'Blue Devils' } });
});
await check(
  'anyone can read an archived seasonDetail',
  assertSucceeds(getDoc(doc(anon(), seasonDetailPath)))
);
await check(
  'owner cannot rewrite their own seasonDetail',
  assertFails(updateDoc(doc(authed(), seasonDetailPath), { lineup: { GE1: 'Forged' } }))
);

// podium-fan — finalists/winner public; ballots private even to the voter.
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'podium-fan/season-1'), { finalists: [{ uid: ALICE }] });
  await setDoc(doc(ctx.firestore(), `podium-fan/season-1/ballots/${ALICE}`), { finals: 'bob-uid' });
});
await check(
  'anyone can read the Fan Favorite finalists',
  assertSucceeds(getDoc(doc(anon(), 'podium-fan/season-1')))
);
await check(
  'a voter cannot read their own Fan Favorite ballot (votes are private)',
  assertFails(getDoc(doc(authed(), `podium-fan/season-1/ballots/${ALICE}`)))
);
await check(
  'a voter cannot write a Fan Favorite ballot client-side',
  assertFails(setDoc(doc(authed(), `podium-fan/season-1/ballots/${ALICE}`), { finals: ALICE }))
);

// hosted-events — public pages; mutations are callable-only.
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'hosted-events/season-1/events/evt-1'), { hostUid: ALICE });
});
await check(
  'anyone can read a hosted event',
  assertSucceeds(getDoc(doc(anon(), 'hosted-events/season-1/events/evt-1')))
);
await check(
  'the host cannot edit their hosted event client-side',
  assertFails(updateDoc(doc(authed(), 'hosted-events/season-1/events/evt-1'), { purse: 999999 }))
);

// admin-stats — operational telemetry, admin read only.
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'admin-stats/economy'), { minted: 1, sunk: 1 });
});
await check(
  'admin can read admin-stats',
  assertSucceeds(getDoc(doc(admin(), 'admin-stats/economy')))
);
await check(
  'signed-in user cannot read admin-stats',
  assertFails(getDoc(doc(mallory(), 'admin-stats/economy')))
);

// game-settings — public read, admin write.
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'game-settings/season'), { seasonUid: 'season-1' });
});
await check(
  'anyone can read game-settings/season',
  assertSucceeds(getDoc(doc(anon(), 'game-settings/season')))
);
await check(
  'signed-in user cannot rewrite the season clock',
  assertFails(updateDoc(doc(mallory(), 'game-settings/season'), { seasonUid: 'forged' }))
);

// users/{uid}/podium/** — competitive intel, owner read / server write.
const podiumStatePath = `artifacts/${APP}/users/${ALICE}/podium/state`;
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), podiumStatePath), { reputation: 10 });
});
await check(
  'owner can read their own Podium state',
  assertSucceeds(getDoc(doc(authed(), podiumStatePath)))
);
await check(
  "another director cannot read someone else's Podium state",
  assertFails(getDoc(doc(mallory(), podiumStatePath)))
);
await check(
  'owner cannot write their own Podium state',
  assertFails(updateDoc(doc(authed(), podiumStatePath), { reputation: 999 }))
);

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
