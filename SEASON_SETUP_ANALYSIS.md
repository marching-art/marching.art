# Marching.Art Season Management & Setup Flow - Detailed Analysis

## Overview
This document details the season management system, user setup flow, progression mechanics, and validation guards within the marching.art application.

---

## 1. SEASON MANAGEMENT & RESET FLOW

### Season Lifecycle
**Location:** `/home/user/marching.art/functions/src/helpers/season.js` (lines 14-217)
**Scheduler:** `/home/user/marching.art/functions/src/scheduled/seasonScheduler.js` (lines 6-66)

#### A. Season Creation Process
**Live Seasons:**
- Triggered daily at 03:00 AM EST via `seasonScheduler`
- Called when current date >= 69 days before second Saturday in August
- Creates new season with:
  - `name`: Format `live_YYYY-YY` (e.g., `live_2024-25`)
  - `status`: "live-season"
  - `seasonUid`: Document ID linking to DCI corps data
  - `currentPointCap`: 150 points per class
  - `schedule`: { startDate, endDate }
  - `events`: Array of scheduled shows

**Off-Seasons:**
- Created when not in live season window
- Uses thematic naming: "Finale", "Crescendo", "Scherzo", "Adagio", "Allegro", "Overture"
- Format: `{seasonType}_YYYY-YY` (e.g., `finale_2024-25`)
- 49-day seasons with dynamically scheduled shows from historical data

**Location in DB:** `game-settings/season` document

#### B. Season Reset Logic
**Key Function:** `startNewLiveSeason()` and `startNewOffSeason()` (lines 77-110, 184-216)

**What Gets Reset:**
```javascript
// User profile reset when season transitions
activeSeasonId: null        // Clears active season reference
corps: {}                   // Completely clears all corps data
```

**Process:**
1. Retrieves old season UID from `game-settings/season`
2. Queries all user profiles with `activeSeasonId == oldSeasonUid`
3. Batches updates (400 per batch) to reset profiles
4. Logs reset activity

**Critical Issue Identified:** 
- When a season ends and new season starts, ALL user corps data is wiped
- Users lose: lineup selections, show selections, corps info, scores
- No migration or archival of user data within profiles
- Only league winners are archived (via `archiveSeasonResultsLogic()`)

**Location:** `/home/user/marching.art/functions/src/helpers/season.js` lines 87-108

---

## 2. SEASON SETUP FLOW FOR USERS

### Step-by-Step User Onboarding

#### Phase 1: Authentication & Profile Creation (Onboarding.jsx)
**File:** `/home/user/marching.art/src/pages/Onboarding.jsx`

**What Happens:**
1. User creates basic profile with:
   - `displayName` (required)
   - `location` (optional)
   - `bio` (optional)
   - `favoriteCorps` (optional)

2. Profile initialized with:
   ```javascript
   {
     uid, email, displayName, location, bio, favoriteCorps,
     createdAt, xp: 0, xpLevel: 1, corpsCoin: 0,
     unlockedClasses: ['soundSport'],  // Only SoundSport unlocked initially
     staff: [],
     achievements: [],
     stats: { seasonsPlayed: 0, championships: 0, topTenFinishes: 0 },
     corps: {},                         // Empty - no corps created yet
     lastRehearsal: null
   }
   ```

**No activeSeasonId set at this stage!**

#### Phase 2: Corps Registration
**File:** `/home/user/marching.art/functions/src/callable/registerCorps.js` (lines 9-107)

**Validation Checks (Guards):**
1. ✅ User must be authenticated
2. ✅ All required fields present (corpsName, location, showConcept, class)
3. ✅ Character length limits enforced
4. ✅ Profanity filter applied
5. ✅ **Registration locks enforced based on weeks remaining:**
   ```javascript
   registrationLocks = {
     world: 6 weeks,      // Can't register after 6 weeks remain
     open: 5 weeks,
     aClass: 4 weeks,
     soundSport: 0        // No lock - can register anytime
   }
   ```
6. ✅ Corps class must be unlocked in `unlockedClasses`
7. ✅ User can't register same class twice

**What Gets Created:**
```javascript
{
  corpsName, location, showConcept,
  class: corpsClass,
  createdAt: timestamp,
  lineup: {},                     // Empty - captions not selected yet
  selectedShows: {},              // Empty - no shows selected
  totalSeasonScore: 0,
  biography: auto-generated
}
```

**Data Location:** `artifacts/marching-art/users/{uid}/profile/data.corps.{corpsClass}`

**ISSUE:** Still no `activeSeasonId` set! This is problematic for season tracking.

#### Phase 3: Caption (Lineup) Selection
**Files:** 
- Frontend: `/home/user/marching.art/src/components/CaptionSelection/CaptionSelectionModal.jsx`
- Backend: `/home/user/marching.art/functions/src/callable/lineups.js` (lines 9-144)

**8 Caption Types with Point Limits:**
- GE1, GE2 (General Effect)
- VP, VA, CG (Visual)
- B, MA, P (Music)

**Point Caps by Class:**
```javascript
soundSport: 90 points
aClass: 60 points
open: 120 points
world: 150 points
```

**Validations in `saveLineup()` (lines 16-44):**
1. ✅ All 8 captions must be selected
2. ✅ Total points <= class point cap
3. ✅ Corps must already exist
4. ✅ Active season must exist

**Critical Step - Sets activeSeasonId:**
```javascript
profileUpdateData.activeSeasonId = activeSeasonId;
profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;
```

**Location:** `/home/user/marching.art/functions/src/callable/lineups.js` line 133

**FINDING:** `activeSeasonId` is only set when first lineup is saved!

#### Phase 4: Show Selection
**Files:**
- Frontend: `/home/user/marching.art/src/components/ShowSelection/ShowSelectionModal.jsx`
- Backend: `/home/user/marching.art/functions/src/callable/lineups.js` (lines 150-178)

**Constraints:**
- Up to 4 shows per week
- Can only modify current week (past weeks locked)
- Week 7 (Championship) auto-enrolls all corps

**Validations:**
1. ✅ User authenticated
2. ✅ Week number valid
3. ✅ Array has max 4 shows
4. ✅ Corps class valid

**Storage Format:**
```javascript
corps.{corpsClass}.selectedShows.week{N}: [
  { eventName, date, location, day }
]
```

---

## 3. USER PROGRESSION METRICS & CLASS UNLOCKING

### XP System
**File:** `/home/user/marching.art/functions/src/callable/users.js` (lines 287-422)

**XP Gains:**
- Daily Rehearsal: +10 XP (once per 23 hours)
- Comments/actions: Via `awardXP()` function (variable amounts)

**Level Progression:**
- Level = `floor(totalXP / 1000) + 1`
- Starting level: 1 (0 XP)

**Class Unlocking via Level:**
```javascript
Level 3 → Unlock "aClass"
Level 5 → Unlock "open" (OpenClass)
Level 10 → Unlock "world" (WorldClass)
```

**Location:** Lines 327-341

**Automatic Unlock Process:**
- Checked every time XP is awarded
- Appended to `profile.unlockedClasses` array
- Toast notification sent: "🎉 Unlocked A Class!"

### Alternative Unlock
**Not yet implemented:** `unlockClassWithCorpsCoin()` function exists in exports but no backend implementation found

---

## 4. RELATIONSHIP BETWEEN CORPS, CAPTIONS, SCHEDULES

### Data Structure Hierarchy
```
User Profile
├── corps: {
│   ├── soundSport: {
│   │   ├── corpsName, location, showConcept
│   │   ├── createdAt
│   │   ├── lineup: {           ← 8 captions selected here
│   │   │   ├── GE1: "corps|year|points"
│   │   │   ├── GE2: "corps|year|points"
│   │   │   └── ... 6 more
│   │   ├── lineupKey          ← Unique hash of lineup
│   │   ├── weeklyTrades       ← Track trades per week
│   │   └── selectedShows: {   ← Shows per week
│   │       ├── week1: [{ show }]
│   │       ├── week2: [{ show }]
│   │       └── ... week7
│   │
│   ├── aClass: { ... same structure }
│   ├── open: { ... same structure }
│   └── world: { ... same structure }
│
├── activeSeasonId             ← References game-settings/season.seasonUid
├── unlockedClasses: ["soundSport", "aClass", "open", "world"]
└── ...
```

### Season Data Structure
```
game-settings/season
├── name: "live_2024-25"
├── status: "live-season" or "off-season"
├── seasonUid: "live_2024-25"         ← Links to dci-data/{seasonUid}
├── currentPointCap: 150
├── schedule: {
│   ├── startDate: Timestamp
│   └── endDate: Timestamp
├── events: [
│   { 
│     offSeasonDay: 1,
│     shows: [
│       { eventName, date, location, scores }
│     ]
│   },
│   ... 49 days total
]
└── ...

dci-data/{seasonUid}
└── corpsValues: [
    { corpsName, sourceYear, points: 1-25 },
    ... 25 corps
]
```

### Relationship Flow
1. **Corps Registration** → User creates corps object under their class
2. **Caption Selection** → Selects 8 captions from available corps in `dci-data/{activeSeasonId}`
3. **Show Selection** → Selects shows from `game-settings/season.events` array
4. **Scoring** → Pulls user's lineup + selectedShows from profile, calculates scores

---

## 5. GUARDS & VALIDATION CHECKS FOR SCHEDULE CREATION

### Pre-Schedule Validation Chain

#### Guard 1: User Must Register Corps First
**Location:** `/home/user/marching.art/src/pages/Schedule.jsx` (lines 139-142)
```javascript
if (!activeCorpsClass) {
  toast.error('Please register a corps first');
  return;
}
```
**Consequence:** Toast error, no modal opens

#### Guard 2: User Can't Modify Past Weeks
**Location:** `/home/user/marching.art/src/pages/Schedule.jsx` (lines 131-137)
```javascript
const status = getWeekStatus(weekNumber);
if (status === 'past') {
  toast.error('Cannot modify shows for past weeks');
  return;
}
```
**Status Calculation:** 
- Compares week number to `currentWeek` (calculated from season start date)
- Past weeks are disabled, not clickable

#### Guard 3: Must Select At Least One Show
**Location:** `/home/user/marching.art/src/components/ShowSelection/ShowSelectionModal.jsx` (lines 104-108)
```javascript
if (selectedShows.length === 0) {
  toast.error('Please select at least one show');
  return;
}
```
**Save Button Disabled When:**
- No shows selected
- Still loading
- Still saving

#### Guard 4: Backend Validates Show Submission
**Location:** `/home/user/marching.art/functions/src/callable/lineups.js` (lines 150-178)
```javascript
if (!week || !shows || !Array.isArray(shows) || shows.length > 4) {
  throw new HttpsError("invalid-argument", 
    "Invalid data. A week number and a maximum of 4 shows are required.");
}
```

#### Guard 5: Active Season Must Exist
**Location:** `/home/user/marching.art/src/components/ShowSelection/ShowSelectionModal.jsx` (lines 32-74)
```javascript
const seasonRef = doc(db, 'game-settings/season');
const seasonSnap = await getDoc(seasonRef);
if (seasonSnap.exists()) {
  const seasonData = seasonSnap.data();
  const events = seasonData.events || [];
  // Filter for current week
}
```
**Consequence:** No shows available if season doesn't exist

### CRITICAL GAPS IDENTIFIED

#### Gap 1: activeSeasonId Not Set on First Login
**Problem:** 
- User registers corps → activeSeasonId still null
- Only set when first lineup is saved
- If user only registers corps and never touches captions, they have no activeSeasonId

**Impact:**
- Scoring system: Queries profiles by activeSeasonId
- Rankings: Only includes users with activeSeasonId
- User's corps scores might not be recorded

**Files Affected:**
- `/home/user/marching.art/functions/src/callable/registerCorps.js` - No activeSeasonId set
- `/home/user/marching.art/functions/src/callable/lineups.js` line 133 - First place activeSeasonId set

#### Gap 2: No Validation That Captions Are Selected Before Shows
**Problem:**
- ShowSelectionModal can be opened without any captions selected
- Shows can be saved without lineup

**Location:** `/home/user/marching.art/src/pages/Dashboard.jsx` (lines 889-897)
```javascript
{showShowSelection && activeCorps && (
  <ShowSelectionModal
    onClose={() => setShowShowSelection(false)}
    // ⚠️ No check that lineup exists
    currentSelections={activeCorps.selectedShows?.[`week${season.week}`] || []}
  />
)}
```

#### Gap 3: Season Reset Completely Wipes User Corps Data
**Problem:**
- When season ends, `corps: {}` is set to empty object
- User loses all configuration, even in archive
- No gradual migration or backup

**Location:** `/home/user/marching.art/functions/src/helpers/season.js` lines 87-91, 194-198

#### Gap 4: No Check in Schedule Page That Season Exists
**Problem:**
- Schedule page loads even if no active season
- Shows could be undefined if `seasonData.events` doesn't exist

**Location:** `/home/user/marching.art/src/pages/Schedule.jsx` (lines 77-101)
```javascript
const getWeekData = (weekNumber) => {
  if (!seasonData?.events) return { shows: [], days: [] };
  // ⚠️ Silent failure - shows appear empty
}
```

#### Gap 5: Lineup Uniqueness Lock Uses `activeLineups` Collection
**Problem:**
- Lineups are locked in `activeLineups` collection
- But old lineup key is deleted when new lineup saved
- No check if a user has *any* lineup at all before allowing shows

**Location:** `/home/user/marching.art/functions/src/callable/lineups.js` lines 121-123

---

## EXECUTION STATE SYSTEM

### Execution Tracking
**File:** `/home/user/marching.art/src/hooks/useExecution.js`

**Tracks Per Corps:**
```javascript
{
  readiness: { brass, percussion, guard, ensemble },    // 0-1 scale
  equipment: { instruments, uniforms, props, bus, truck }, // 0-1.2 scale
  morale: 0-1,
  lastRehearsalDay: number,
  showDesign: { difficulty: 3-10 },
  staff: [],
}
```

**Initialized On First Rehearsal:**
- Location: `/home/user/marching.art/functions/src/callable/execution.js` lines 123-134
- Returns message: "Execution state initialized. Please rehearse again."

---

## SUMMARY OF CRITICAL FINDINGS

### ✅ Working Well
1. Season scheduler runs daily and creates/resets seasons correctly
2. Class unlocking works via XP progression
3. Show week validation prevents past-week modification
4. Point caps enforced for captions
5. Batch processing prevents Firestore limits

### ⚠️ Gaps & Issues
1. **activeSeasonId timing** - Set only after first lineup save, not after corps registration
2. **No lineup requirement** - Shows can be selected without captions
3. **No season existence check** - Schedule page loads without confirming season exists
4. **Data loss on reset** - Complete corps wipe on season transition
5. **No execution state initialization guard** - Execution system initializes on first use, not on corps creation
6. **Loose role-based access** - No verification user owns the corps they're modifying

### 🔧 Recommended Fixes
1. Set activeSeasonId immediately when corps is registered
2. Prevent show selection if lineup is empty (validate in SaveLineup)
3. Add season existence check before rendering Schedule
4. Archive instead of delete user corps data on season reset
5. Initialize execution state when corps created, not on first rehearsal

---

## FILE REFERENCE GUIDE

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| startNewLiveSeason | season.js | 14-110 | Create live season & reset profiles |
| startNewOffSeason | season.js | 112-217 | Create off-season & reset profiles |
| seasonScheduler | seasonScheduler.js | 6-66 | Daily cron to trigger season changes |
| registerCorps | registerCorps.js | 9-107 | Create user's corps |
| saveLineup | lineups.js | 9-144 | Save 8-caption lineup & set activeSeasonId |
| selectUserShows | lineups.js | 150-178 | Save weekly show selections |
| dailyRehearsal | users.js | 287-360 | Grant XP & check level-based unlocks |
| onSnapshot useSeason | useSeason.js | 10-57 | Real-time season data hook |
| Schedule Page | Schedule.jsx | 1-385 | Show selection UI |
| Dashboard | Dashboard.jsx | 30-902 | Main game hub, corps management |

