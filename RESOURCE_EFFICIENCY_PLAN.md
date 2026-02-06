# 10-Point Resource Efficiency Plan

**Prepared for:** marching.art Fantasy Drum Corps Application
**Date:** 2026-02-06
**Scope:** Static analysis of all backend Cloud Functions, frontend React SPA, and Firestore data layer
**Goal:** Maximize Resource Efficiency (CPU, RAM, DB I/O, bandwidth) while maintaining Performance and Gameplay Integrity

---

## Priority 1 — Highest Impact / Lowest Effort

### 1. Eliminate Redundant Firestore Reads in League Join Flow

**Files:**
- `functions/src/callable/leagues.js` — Lines 202, 300

**Problem:**
After both `joinLeague` and `joinLeagueByCode` complete their transactions (which already write the updated `members` array to the league document), the code performs a *second* `leagueRef.get()` solely to read back `members.length` for an activity log metadata field:

```js
// Line 202 (joinLeague) and Line 300 (joinLeagueByCode)
metadata: { memberCount: (await leagueRef.get()).data().members?.length || 1 }
```

The transaction at lines 168-189 / 253-286 already has the league data in scope via `transaction.get(leagueRef)`. The member count after the join is simply `leagueData.members.length + 1`.

**Fix:** Replace the `.get()` call with the already-known value:
```js
metadata: { memberCount: leagueData.members.length + 1 }
```

**Expected Gain:**
- **2 Firestore reads eliminated per league join** (the most common social action in the app)
- ~50ms latency reduction per join operation (eliminates a round-trip)
- At scale (1,000 joins/week): **~2,000 reads/week saved**, plus reduced Cloud Function execution time

---

### 2. Parallelize Sequential Push Notification DB Reads

**File:**
- `functions/src/scheduled/pushNotifications.js` — Lines 60-80, 138-171

**Problem A — Show Reminders (Lines 60-80):**
For each show, the code sequentially `await`s the registrations subcollection, then sequentially `await`s `sendShowReminderPush` for each registration. This runs **every hour**.

```js
for (const showDoc of showsSnapshot.docs) {
  const registrationsSnapshot = await admin.firestore()    // Sequential read per show
    .collection(`seasons/${season.seasonUid}/shows/${showDoc.id}/registrations`)
    .get();
  for (const regDoc of registrationsSnapshot.docs) {
    const sent = await sendShowReminderPush(userId, ...);  // Sequential push per user
  }
}
```

With 10 shows and 100 registrations each, this is **1,010 sequential async operations** every hour.

**Problem B — Weekly Matchup Push (Lines 138-171):**
Each league's matchup document is fetched sequentially inside a loop rather than batch-fetched:

```js
for (const leagueDoc of leaguesSnapshot.docs) {
  const matchupDoc = await db                              // Sequential read per league
    .doc(`artifacts/${namespace}/leagues/${leagueDoc.id}/matchups/week-${currentWeek}`)
    .get();
}
```

With 500 leagues, this is **500 sequential Firestore reads**.

**Fix:**
- Use `Promise.all` / `Promise.allSettled` to parallelize registration fetches across shows
- Use `db.getAll(...refs)` to batch-fetch all matchup documents in a single call (identical to the pattern already used in `scoring.js:692-695`)
- Parallelize push notification sends with a concurrency limiter (e.g., chunks of 25)

**Expected Gain:**
- **Show reminders:** Reduce from O(shows * registrations) sequential calls to O(shows) parallel + O(registrations/25) chunked sends. **~90% wall-clock reduction** on the hourly job.
- **Weekly matchups:** Reduce from 500 sequential reads to 1 batch read. **~99% I/O reduction** for this path.
- Combined: **~12,000 fewer sequential DB operations/day** from the hourly show reminder alone.

---

### 3. Batch Zustand State Updates in Auth Listener

**File:**
- `src/store/userStore.js` — Lines 86-150

**Problem:**
Each `onAuthStateChanged` callback triggers **three separate `set()` calls**, each of which notifies all Zustand subscribers and causes a React re-render cascade:

```js
set({ isLoadingAuth: true });         // Render #1: show spinner
// ...fetch profile...
set({ loggedInProfile: profileData }); // Render #2: update profile
// (also set({ user }) on line 89)
set({ isLoadingAuth: false });         // Render #3: hide spinner
```

Every component subscribed to any of these fields re-renders 2-3 times on every auth state change (login, logout, token refresh).

**Fix:** Consolidate into a single atomic update:
```js
set({
  user,
  loggedInProfile: profileData,
  isLoadingAuth: false,
});
```

**Expected Gain:**
- **Eliminates 2 unnecessary full-tree re-renders** per auth event
- On login: reduces from ~3 render cycles to 1 across all mounted components
- Directly improves Time-to-Interactive by ~100-200ms on login
- Zero risk to gameplay integrity — purely an update batching change

---

## Priority 2 — High Impact / Moderate Effort

### 4. Deduplicate Off-Season and Live-Season Scoring Functions

**File:**
- `functions/src/helpers/scoring.js` — Lines 795-1095 (`processAndArchiveOffSeasonScoresLogic`) and Lines 1098-1375 (`processAndScoreLiveSeasonDayLogic`)

**Problem:**
These two functions share ~90% identical structure:
- Same 4-level nested loop: `shows → users → corpsClasses → captions`
- Same championship config building (lines 872-881 / 1144-1153)
- Same Day 41/42 regional split logic (lines 901-924 / 1171-1194)
- Same Set-based participant filtering (lines 930-936 / 1197-1202)
- Same coin award collection (lines 1016-1020 / ~1290)
- Same trophy awarding calls
- Same weekly matchup processing calls

The only meaningful difference is the score resolution strategy: off-season calls `getCachedRegressionScore` directly, while live-season first checks for actual scraped scores via `getScoreForDay`, then falls back to regression with a data-point threshold check.

This ~500 lines of duplication means:
- Every bug fix or optimization must be applied in two places
- Double the cognitive load for maintainers
- Double the cold-start code parsing cost

**Fix:** Extract a shared `scoreDayForAllUsers(profilesSnapshot, dayEventData, options)` function that accepts a `scoreResolver` callback:
```js
// Off-season passes:
scoreResolver: (corpsName, sourceYear, caption, day, historicalData) =>
  getCachedRegressionScore(corpsName, sourceYear, caption, day, historicalData)

// Live-season passes:
scoreResolver: (corpsName, sourceYear, caption, day, historicalData) =>
  getLiveOrRegressionScore(corpsName, sourceYear, caption, day, historicalData, currentYear)
```

**Expected Gain:**
- **~250 fewer lines of code** in the most critical backend module
- Reduced Cloud Function cold-start time (less code to parse)
- Single source of truth for the scoring loop — future optimizations apply once
- Easier to unit-test in isolation

---

### 5. Implement Cursor-Based Pagination for Profile and League Scoring Fetches

**File:**
- `functions/src/helpers/scoring.js` — Lines 848-857 (off-season), Lines 1108-1116 (live-season), Lines 682-686 (league matchups)

**Problem:**
Profile fetches are hard-capped at 5,000 documents with only a `logger.warn`:
```js
const PROFILE_FETCH_LIMIT = 5000;
const profilesQuery = db.collectionGroup("profile")
  .where("activeSeasonId", "==", seasonData.seasonUid)
  .select("corps", "username", "displayName")
  .limit(PROFILE_FETCH_LIMIT);
```

League fetches are hard-capped at 500. **Users/leagues beyond these limits are silently unscored.** This is a direct Gameplay Integrity risk — the 5,001st user simply doesn't get scored, with no user-visible error.

**Fix:** Implement cursor-based pagination that processes in batches:
```js
let lastDoc = null;
const BATCH_SIZE = 1000;
do {
  let query = db.collectionGroup("profile")
    .where("activeSeasonId", "==", seasonData.seasonUid)
    .select("corps", "username", "displayName")
    .limit(BATCH_SIZE);
  if (lastDoc) query = query.startAfter(lastDoc);

  const batch = await query.get();
  if (batch.empty) break;

  await processBatch(batch.docs, ...);
  lastDoc = batch.docs[batch.docs.length - 1];
} while (true);
```

**Expected Gain:**
- **Eliminates the silent data-loss ceiling** — all users scored regardless of count
- Reduces peak memory: processes 1,000 profiles at a time instead of loading 5,000 into memory
- More predictable Cloud Function execution time (avoids 9-minute timeout on large fetches)
- At 10,000+ users: difference between "app works" and "app silently breaks"

---

### 6. Hoist Day 41/42 Regional Split Computation Out of the Show Loop

**File:**
- `functions/src/helpers/scoring.js` — Lines 901-924 (off-season), Lines 1171-1194 (live-season)

**Problem:**
The regional split enrollee list is rebuilt by iterating over **all profiles** (up to 5,000) for **every show** in the day's event data:

```js
for (const show of dayEventData.shows) {                  // Outer: per-show
  if ([41, 42].includes(scoredDay) && show.eventName.includes("Eastern Classic")) {
    for (const userDoc of profilesSnapshot.docs) {        // Inner: ALL 5,000 users
      const userShows = userProfile.corps?.worldClass?.selectedShows?.[`week${week}`] || [];
      if (userShows.some(s => s.eventName === show.eventName)) {
        allEnrollees.push(userDoc.ref.parent.parent.id);
      }
    }
  }
}
```

If Day 41 has 3 shows (2 Eastern Classic variants + 1 other), this iterates 5,000 users x 2 = **10,000 iterations** to build enrollee lists that could be computed once before the show loop.

**Fix:** Pre-compute a `Map<showEventName, Set<uid>>` of enrollees *before* the show loop:
```js
const enrolleesByShow = new Map();
if ([41, 42].includes(scoredDay)) {
  for (const userDoc of profilesSnapshot.docs) {
    const userShows = userProfile.corps?.worldClass?.selectedShows?.[`week${week}`] || [];
    for (const s of userShows) {
      if (!enrolleesByShow.has(s.eventName)) enrolleesByShow.set(s.eventName, []);
      enrolleesByShow.get(s.eventName).push(uid);
    }
  }
}
```

Then inside the show loop, simply look up `enrolleesByShow.get(show.eventName)`.

**Expected Gain:**
- Reduces from O(shows * users) to O(users) — a **2-3x reduction** on Days 41/42
- On Day 41 with 5,000 users and 3 shows: **~10,000 iterations eliminated**
- Simple refactor with zero impact on scoring correctness

---

## Priority 3 — Moderate Impact / Moderate Effort

### 7. Fix `useEngagement` Hook Dependency Array + Double Write

**File:**
- `src/hooks/useEngagement.ts` — Lines 78-184

**Problem A — Stale Closure:**
The effect depends on `[uid, profile?.uid]` (line 184) but reads deeply into `profile.engagement`, `profile.achievements`, `profile.engagement.loginStreak`, etc. (lines 81-166). Since `profile.uid` never changes within a session, the effect runs exactly once — but if the profile object is updated elsewhere (e.g., from a Firestore listener or another store action), this hook operates on **stale data**.

This creates a race condition: if a user earns a streak achievement, the hook writes `achievements: [...existingAchievements, achievement]` using the stale `existingAchievements` array, potentially **overwriting achievements earned by other concurrent processes** (like the backend scoring run).

**Problem B — Double Firestore Write:**
When a streak milestone is hit, the code makes two separate `updateDoc` calls:
```js
// Line 164: Write achievement
await updateDoc(profileRef, { achievements: [...existingAchievements, achievement] });

// Line 173: Write engagement (separate call)
await updateDoc(profileRef, { engagement: updatedEngagement });
```

This is 2 Firestore writes when 1 would suffice.

**Fix:**
1. Add `profile` (or a stable hash of engagement fields) to the dependency array
2. Merge the two writes into one:
```js
await updateDoc(profileRef, {
  achievements: [...existingAchievements, achievement],
  engagement: updatedEngagement,
});
```

**Expected Gain:**
- **Eliminates 1 Firestore write per login** for streak-milestone users
- Fixes a data-race bug that could silently overwrite achievements
- Prevents stale engagement data from being written back to Firestore

---

### 8. Batch Email Auth Lookups Instead of Per-User Fetches

**File:**
- `functions/src/scheduled/emailNotifications.js` — Lines 146-156

**Problem:**
The weekly digest processor calls `getUserEmail(uid)` individually for each user inside the processing loop:

```js
const processUser = async (doc) => {
  const email = await getUserEmail(uid);  // Firebase Auth lookup per user
};
```

This runs within a parallel batch of 25 (line 21: `PARALLEL_LIMIT = 25`), meaning up to 25 concurrent Firebase Auth calls per batch. For 5,000 users, that's **200 sequential batches of 25 Auth lookups** = 5,000 individual Auth API calls.

**Fix:** Use `admin.auth().getUsers()` to batch-fetch up to 100 users at once:
```js
const userRecords = await admin.auth().getUsers(
  uids.map(uid => ({ uid }))
);
const emailMap = new Map(
  userRecords.users.map(u => [u.uid, u.email])
);
```

Then look up `emailMap.get(uid)` in the processing loop.

**Expected Gain:**
- Reduces from **5,000 individual Auth calls to ~50 batch calls** (100 users per batch)
- ~98% reduction in Auth API round-trips
- Reduces Cloud Function execution time by several seconds per weekly digest run

---

### 9. Consolidate Trophy Awarding Into Single-Pass Per Show

**File:**
- `functions/src/helpers/scoring.js` — Lines 459-556 (`awardRegionalTrophies` + `awardClassChampionshipTrophies`)

**Problem:**
`awardClassChampionshipTrophies` (lines 495-556) makes multiple passes over the same `show.results` array:

```js
dailyRecap.shows.forEach(show => {
  const openClassResults = show.results.filter(r => r.corpsClass === "openClass");  // Pass 1
  const aClassResults = show.results.filter(r => r.corpsClass === "aClass");        // Pass 2

  openClassResults.sort(...);           // Sort 1
  aClassResults.sort(...);              // Sort 2

  openClassResults.slice(0,3).forEach(...)  // Iterate 1
  aClassResults.slice(0,3).forEach(...)     // Iterate 2
  show.results.forEach(...)                 // Pass 3: ALL results for finalist ribbons
});
```

That's **3 filter/iteration passes + 2 sorts** per show, and each creates new arrays.

**Fix:** Single pass to bucket results by class, then sort each bucket once:
```js
const byClass = {};
for (const r of show.results) {
  (byClass[r.corpsClass] ||= []).push(r);
}
for (const [cls, results] of Object.entries(byClass)) {
  results.sort((a, b) => b.totalScore - a.totalScore);
  // Award top-3 trophies + finalist ribbons in one loop
}
```

**Expected Gain:**
- Reduces from 5 array operations to 2 per show (1 bucket pass + 1 sort per class)
- Eliminates intermediate array allocations (`.filter()` creates new arrays)
- On championship day with 500+ results per show: measurable CPU reduction
- Removes the re-`.slice(0,3)` on line 554 (called again just for the log message)

---

## Priority 4 — Marginal Gains / Long-Term Hygiene

### 10. Add Visibility API Guard to Client-Side Polling Intervals

**Files:**
- `src/components/Layout/GameShell.jsx` — Lines 224-232 (ticker rotation every 8s)
- `src/hooks/useLandingScores.js` — Lines 90-103 (processing-time check every 60s)
- `src/components/Celebration.jsx` — Lines 76-128 (confetti interval every 500ms)

**Problem:**
All three polling intervals continue running when the browser tab is not visible:

```js
// GameShell.jsx:224 — Ticker rotates every 8 seconds, even in background tabs
const interval = setInterval(() => {
  setActiveSection(prev => (prev + 1) % tickerSections.length);
}, 8000);

// useLandingScores.js:90 — Checks 2 AM boundary every 60 seconds indefinitely
const interval = setInterval(checkProcessingTime, 60000);
```

If a user has 3 tabs open, that's 3 ticker intervals + 3 time-check intervals running perpetually, each triggering React state updates and re-renders in invisible tabs.

The `useLandingScores` time check is particularly wasteful: it runs **1,440 times per day** to detect a single 2 AM boundary crossing. A `setTimeout` calculated to fire at exactly 2 AM ET would replace all 1,440 checks with 1.

**Fix:**
```js
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      clearInterval(intervalRef.current);
    } else {
      intervalRef.current = setInterval(tick, 8000);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

For the 2 AM check, replace `setInterval(fn, 60000)` with:
```js
const msUntil2AM = calculateMsUntil2AMET();
const timeout = setTimeout(() => setIsPastProcessingTime(true), msUntil2AM);
```

**Expected Gain:**
- Eliminates all background-tab CPU usage from polling (saves battery on mobile PWA users)
- Reduces `useLandingScores` from 1,440 interval fires/day to 1 timeout
- Prevents unnecessary React re-renders in hidden tabs
- Improves PWA battery performance on mobile devices

---

## Summary Matrix

| # | Target | Effort | Impact | Saves |
|---|--------|--------|--------|-------|
| 1 | `leagues.js` redundant `.get()` | ~5 min | High | 2 reads/join, ~50ms latency |
| 2 | `pushNotifications.js` sequential reads | ~2 hr | Very High | ~12,000 sequential ops/day |
| 3 | `userStore.js` triple `set()` | ~15 min | High | 2 render cycles/auth event |
| 4 | `scoring.js` function duplication | ~4 hr | High | ~250 LOC, cold-start time |
| 5 | `scoring.js` hard fetch limits | ~3 hr | Critical | Fixes silent data loss >5K users |
| 6 | `scoring.js` regional split in loop | ~1 hr | Medium | ~10,000 iterations on Days 41/42 |
| 7 | `useEngagement.ts` deps + double write | ~1 hr | Medium | 1 write/login, fixes race condition |
| 8 | `emailNotifications.js` Auth lookups | ~2 hr | Medium | ~4,950 Auth API calls/week |
| 9 | `scoring.js` trophy multi-pass | ~2 hr | Low-Medium | 3 array passes/show on trophy days |
| 10 | `GameShell.jsx` + hooks polling | ~1 hr | Low | Background CPU, mobile battery |

**Total estimated effort:** ~16 hours of engineering time
**Total estimated savings:** Thousands of unnecessary DB reads/day, multiple render cycles per user session, elimination of a silent data-loss ceiling, and measurable Cloud Function execution time reductions.
