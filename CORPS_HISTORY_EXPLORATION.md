# Marching.Art Fantasy Corps App - Comprehensive Exploration Summary

**Date:** November 17, 2025  
**Explored Breadth:** Very Thorough - All major data models, API routes, frontend pages, and system architecture  

---

## TABLE OF CONTENTS
1. [Project Structure Overview](#project-structure-overview)
2. [Data Models & Retirement System](#data-models--retirement-system)
3. [Season Archiving & History](#season-archiving--history)
4. [Lifetime Stats & Leaderboards](#lifetime-stats--leaderboards)
5. [Current UI Components & Pages](#current-ui-components--pages)
6. [API Routes & Backend Functions](#api-routes--backend-functions)
7. [Where to Build New Features](#where-to-build-new-features)

---

## PROJECT STRUCTURE OVERVIEW

### Tech Stack
- **Frontend:** React (Vite-based), React Router
- **Backend:** Firebase Cloud Functions (Node.js)
- **Database:** Firestore (NoSQL)
- **State Management:** React Context + Zustand (custom store)
- **UI Library:** Tailwind CSS + Framer Motion (animations)

### Directory Structure
```
/home/user/marching.art/
├── src/
│   ├── pages/               # All 19 main pages
│   ├── components/          # Reusable UI components
│   ├── firebase/            # Firebase configuration
│   ├── hooks/               # Custom React hooks
│   ├── store/               # State management
│   ├── utils/               # Helper functions
│   └── App.jsx              # Main routing (Routes defined here)
├── functions/
│   └── src/
│       ├── callable/        # HTTP callable Cloud Functions (12 files)
│       ├── scheduled/       # Scheduled jobs (cron tasks)
│       ├── helpers/         # Shared logic
│       ├── triggers/        # Firestore trigger functions
│       └── webhooks/        # External API webhooks
└── public/                  # Static assets
```

### Pages (19 total)
**Protected Routes (require login):**
- `/dashboard` - Main game hub, corps management
- `/schedule` - Show selection UI
- `/scores` - Performance tracking
- `/profile/:userId` - User profile (public or private)
- `/settings` - Account/notification settings
- `/leagues` - Fantasy league management
- `/battlepass` - Seasonal rewards
- `/staff` - Staff roster management
- `/admin` - Admin panel (role-based)

**Public Routes:**
- `/` - Landing page
- `/login` - Authentication
- `/register` - Sign up
- `/how-to-play` - Game rules/guide
- `/hall-of-champions` - Past champions (currently a stub/placeholder)

**Special Pages:**
- `/onboarding` - First-time setup
- `/leaderboard` - Rankings (season/lifetime)

---

## DATA MODELS & RETIREMENT SYSTEM

### Corps Data Structure
**Location:** `artifacts/marching-art/users/{uid}/profile/data.corps.{corpsClass}`

Each corps (per class) contains:
```javascript
{
  // Basic Info
  corpsName: string,
  location: string,
  showConcept: string,
  class: "soundSport" | "aClass" | "open" | "world",
  createdAt: timestamp,
  
  // Season-Specific (Reset each season)
  lineup: {
    GE1: "corpsName|year|points",
    GE2: "corpsName|year|points",
    VP: "...",
    VA: "...",
    CG: "...",
    B: "...",
    MA: "...",
    P: "..."
  },
  lineupKey: string,        // Unique hash to track duplicates
  selectedShows: {
    week1: [{eventName, date, location, day}],
    week2: [...],
    ... week7
  },
  weeklyScores: {
    week1: 42.5,
    week2: 38.2,
    ...
  },
  totalSeasonScore: number,
  
  // Historical Tracking
  seasonHistory: [         // Preserved between seasons
    {
      seasonId: string,
      seasonName: string,
      corpsClass: string,
      corpsName: string,
      location: string,
      lineup: {...},
      selectedShows: {...},
      weeklyScores: {...},
      totalSeasonScore: number,
      showsAttended: number,
      highestWeeklyScore: number,
      archivedAt: timestamp
    }
  ],
  
  weeklyTrades: {...}      // Staff trades tracking
}
```

### Retirement System (FULLY IMPLEMENTED)
**Location:** `artifacts/marching-art/users/{uid}/profile/data.retiredCorps`

**Backend Function:** `/home/user/marching.art/functions/src/callable/corps.js`
- `exports.retireCorps` - Move active corps to retired
- `exports.unretireCorps` - Restore retired corps to active

**Retired Corps Record Structure:**
```javascript
{
  corpsClass: "world" | "open" | "aClass" | "soundSport",
  corpsName: string,
  location: string,
  seasonHistory: [{...}],  // All past seasons archived
  weeklyTrades: {...},
  totalSeasons: number,
  bestSeasonScore: number,
  totalShows: number,
  retiredAt: timestamp
}
```

**Retirement Rules:**
- ✅ Can only retire when NOT in active season (no lineup active)
- ✅ Only one active corps per class
- ✅ Retired corps preserve all history (seasonHistory)
- ✅ Can be unretired to restore as active corps
- ✅ Unretiring clears season-specific data but preserves history

### Lifetime Stats
**Location:** `artifacts/marching-art/users/{uid}/profile/data.lifetimeStats`

```javascript
{
  totalSeasons: number,      // Count of seasons played
  totalShows: number,        // Cumulative shows attended
  totalPoints: number,       // All-time points across all corps
  bestSeasonScore: number,   // Highest season score ever
  bestWeeklyScore: number,   // Highest single week score
  leagueChampionships: number // League titles won
}
```

**Updated When:**
- Season ends (via `seasonScheduler` cron job)
- User wins league championship (via `archiveSeasonResultsLogic`)

---

## SEASON ARCHIVING & HISTORY

### Season Structure
**Location:** `game-settings/season` document

```javascript
{
  name: "live_2024-25" or "finale_2024-25",
  status: "live-season" | "off-season",
  seasonUid: string,              // References dci-data/{seasonUid}
  currentPointCap: 150,
  dataDocId: string,
  schedule: {
    startDate: Timestamp,
    endDate: Timestamp
  },
  events: [{
    offSeasonDay: number,
    shows: [{eventName, date, location, scores}]
  }]  // 49 events for live, 49 for off-season
}
```

### Corps Season Archive
**When does archiving happen?**
- Triggered by `seasonScheduler` cron job (daily at 3:00 AM EST)
- When `current date >= season.schedule.endDate`
- Creates new season (live or off-season based on calendar)

**What gets archived?**
Each corps' current season data is pushed to `corps.seasonHistory` array:
```javascript
{
  seasonId: oldSeasonUid,
  seasonName: oldSeasonUid,
  corpsClass: string,
  corpsName: string,
  location: string,
  lineup: {...},           // Snapshot of captions at season end
  selectedShows: {...},    // All shows attended
  weeklyScores: {...},     // All weekly scores
  totalSeasonScore: number,
  showsAttended: number,
  highestWeeklyScore: number,
  archivedAt: timestamp
}
```

**What gets reset?**
- Active corps lineup and selectedShows cleared
- weeklyScores reset to {}
- totalSeasonScore reset to 0
- **IMPORTANT:** seasonHistory array is PRESERVED
- activeSeasonId is set to null
- Lifetime stats are updated (totalSeasons incremented)

**Files:**
- `/home/user/marching.art/functions/src/helpers/season.js` - Archive logic (lines 14-430)
- `/home/user/marching.art/functions/src/scheduled/seasonScheduler.js` - Cron trigger

### League Championship Archiving
**Location:** `/home/user/marching.art/functions/src/helpers/season.js` (lines 626-731)

When season ends, `archiveSeasonResultsLogic()` runs:
- Finds highest-scoring user in each league
- Stores champion info in `leagues/{leagueId}.champions` array:
  ```javascript
  {
    seasonName: string,
    winnerId: uid,
    winnerUsername: string,
    winnerCorpsName: string,
    score: number,
    archivedAt: timestamp
  }
  ```
- Increments user's `lifetimeStats.leagueChampionships`
- Creates achievement record
- Notifies all league members

---

## LIFETIME STATS & LEADERBOARDS

### Lifetime Leaderboard System
**Location:** `/home/user/marching.art/functions/src/scheduled/lifetimeLeaderboard.js`

**Runs:** Daily at 3 AM UTC (scheduled)

**Metrics Tracked:**
1. `totalPoints` - Sum of all season scores
2. `totalSeasons` - Count of seasons played
3. `totalShows` - Count of shows attended
4. `bestSeasonScore` - Highest individual season score
5. `leagueChampionships` - League titles won

**Data Structure:**
```
artifacts/marching-art/leaderboard/lifetime_totalPoints/data
├── metric: "totalPoints"
├── entries: [
│   {
│     userId: string,
│     username: string,
│     userTitle: string,
│     lifetimeStats: {totalPoints, totalSeasons, ...},
│     updatedAt: timestamp
│   },
│   ... (up to 100 top entries)
]
└── updatedAt: timestamp
```

**All 5 metrics have similar structure** (lifetime_totalSeasons, lifetime_totalShows, etc.)

### Leaderboard UI
**Location:** `/home/user/marching.art/src/pages/Leaderboard.jsx`

**Features:**
- 4 tabs: Overall, Weekly, Monthly, Lifetime Stats
- Class filters: World, Open, A Class, SoundSport
- Lifetime view selector (5 metrics to choose from)
- Top 100 rankings per metric
- User's current rank displayed in card

---

## CURRENT UI COMPONENTS & PAGES

### 1. Dashboard (`/dashboard`)
**File:** `/home/user/marching.art/src/pages/Dashboard.jsx` (~2000 lines)

**Key Sections:**
- **Corps Selector** - Switch between multiple corps
- **Battle Pass Notification** - Shows unclaimed rewards
- **Engagement Widget** - Login streak, recent achievements
- **Daily Challenges** - 3 dynamic challenges
- **Weekly Progress** - Score improvement, rank change, equipment health
- **Quick Stats** - Rank, score, leagues, weeks remaining
- **Tab Navigation:**
  - `overview` - Corps info, lineup, show selection
  - `execution` - Rehearsals, equipment, show difficulty
  - `equipment` - Repair/upgrade system
  - `staff` - Staff roster management
  - `allcorps` - Comparison view of all corps

**Corps Management Menu** (Dropdown on overview tab)
- Edit Details
- Move to Another Class
- Delete Corps
- **MISSING:** Retire Corps button (ready to implement!)

### 2. Leaderboard (`/leaderboard`)
**File:** `/home/user/marching.art/src/pages/Leaderboard.jsx`

Shows:
- Overall season rankings
- Weekly rankings
- Monthly rankings
- Lifetime stats (5 different metrics)
- User's current rank card
- Class filters

### 3. Schedule (`/schedule`)
Show selection interface for weekly competition

### 4. Hall of Champions (`/hall-of-champions`)
**File:** `/home/user/marching.art/src/pages/HallOfChampions.jsx`

**Status:** Currently a STUB/PLACEHOLDER (lines 1-36)
- Shows static hardcoded years [2024, 2023, 2022]
- Shows static "Champion Corps" text
- NO real data loading
- **OPPORTUNITY:** This is where league champions should be displayed!

### 5. Profile (`/profile/:userId`)
**File:** `/home/user/marching.art/src/pages/ProfileNew.jsx`

Shows:
- Director name, location, bio, favorite corps
- Level, XP, CorpsCoin, Seasons Played
- Editable for own profile
- Read-only for other profiles

### 6. Settings (`/settings`)
**File:** `/home/user/marching.art/src/pages/Settings.jsx`

Tabs:
- Profile - Edit name, bio, location
- Notifications - Email, reminders, battle pass
- Privacy - Public profile, show location/stats
- Account - Sign out

---

## API ROUTES & BACKEND FUNCTIONS

### Corps Management Functions
**File:** `/home/user/marching.art/functions/src/callable/corps.js`

```
retireCorps(corpsClass: string) 
  → Validates user has active corps
  → Moves to retiredCorps array
  → Clears active corps from corps object
  → Returns: {success, message}

unretireCorps(corpsClass: string, retiredIndex: number)
  → Restores retired corps to active
  → Clears from retired list
  → Resets season-specific data
  → Returns: {success, message}
```

### Lifetime Leaderboard Function
**File:** `/home/user/marching.art/functions/src/scheduled/lifetimeLeaderboard.js`

```
updateLifetimeLeaderboard()
  → Admin-only callable
  → OR runs automatically daily at 3 AM UTC
  → Collects lifetimeStats from all users
  → Creates 5 pre-computed leaderboards
  → Stores top 100 per metric
```

### Season Management Functions
**File:** `/home/user/marching.art/functions/src/helpers/season.js`

```
startNewLiveSeason()
  → Triggered: When 69 days before DCI Finals
  → Archives all user corps season data
  → Updates lifetimeStats
  → Creates new "live_YYYY-YY" season
  → Resets all user activeLineups

startNewOffSeason()
  → Triggered: When not in live season window
  → Archives all user corps season data
  → Updates lifetimeStats
  → Creates thematic off-season (Finale, Crescendo, etc.)
  → Generates 49-day schedule with historical shows

archiveSeasonResultsLogic()
  → Finds league champions
  → Stores champion record in leagues collection
  → Creates achievement for winners
  → Notifies all league members
  → Increments leagueChampionships counter
```

### Other Callable Functions (Exported)
**File:** `/home/user/marching.art/src/firebase/functions.js`

**Corps & Lineup:**
- `registerCorps` - Create new corps
- `saveLineup` - Save caption selections
- `selectUserShows` - Save show selections
- `validateAndSaveLineup` - Combined validation

**Execution System:**
- `dailyRehearsal` - Grant XP, check unlocks
- `repairEquipment` - Restore equipment
- `upgradeEquipment` - Improve equipment
- `boostMorale` - Increase morale stat
- `setShowDifficulty` - Configure show difficulty

**Leaderboards:**
- `updateLifetimeLeaderboard` - Manual trigger for admin

---

## WHERE TO BUILD NEW FEATURES

### 1. CORPS HISTORY PAGE (Recommended Path)

**Path:** `/corps-history` or `/corps-legacy`

**Frontend Page:**
Create `/src/pages/CorpsHistory.jsx`

**What to display:**
- For the logged-in user's active corps
- All seasons in `corps.seasonHistory` array
- Each season card shows:
  - Season name (e.g., "live_2024-25")
  - Final rank
  - Final score
  - Shows attended (count)
  - Best weekly score
  - Archive date
- Click to view detailed season breakdown:
  - Weekly scores graph
  - Lineup used (captions)
  - All shows attended with scores
  - Execution stats (if tracked)

**Backend:** NO new functions needed!
- Data is already in `profile.corps.{class}.seasonHistory`
- Just read and display

**Integration Points:**
1. Add to Dashboard as a tab: "History" under active corps
2. Add route to App.jsx at `/corps-history`
3. Link from corps selector dropdown
4. Add navigation menu item

### 2. RETIRED CORPS GALLERY (Recommended Path)

**Path:** `/retired-corps` or `/corps-gallery`

**Frontend Page:**
Create `/src/pages/RetiredCorpsGallery.jsx`

**What to display:**
- Grid of retired corps for logged-in user
- Each card shows:
  - Corps name, class, location
  - Total seasons played (from seasonHistory length)
  - Best season score (from seasonHistory max)
  - Total shows attended (sum from seasonHistory)
  - Retirement date
  - Status badge: "Retired"
- Click to view full retired corps profile:
  - All season history (seasonal breakdown)
  - Career stats (lifetime performance in this corps)
  - Option to "Bring Out of Retirement" (calls unretireCorps)

**Backend:** NO new functions needed!
- Data is already in `profile.retiredCorps` array
- Just read and display
- Call existing `unretireCorps()` for restore action

**Integration Points:**
1. Add dropdown link in corps selector: "View Retired Corps"
2. Add route to App.jsx at `/retired-corps`
3. Add navigation menu item
4. Link from Dashboard corps management menu

### 3. ENHANCED HALL OF CHAMPIONS (Optional but Recommended)

**Path:** `/hall-of-champions` (replace current stub)

**Frontend Page:**
Enhance `/src/pages/HallOfChampions.jsx`

**What to display:**
- **Global League Champions** (all users)
  - Tab: "All-Time Champions"
    - Display from `leagues/{leagueId}.champions` array
    - Show top leagues with most championships
    - Filter by season or league
  
- **Personal Championships** (current user)
  - Tab: "My Championships"
    - Show user's league championship records
    - From `lifetimeStats.leagueChampionships` counter
    - From `achievements` array (champion achievements)
  
- **Historic Champions**
  - Tab: "Past Seasons"
    - Year/season selector (2024, 2023, 2022, etc.)
    - Show all league champions from that season

**Backend:** Needs One New Function
```javascript
// New callable function needed:
getLeagueChampions(seasonId?: string) 
  → If seasonId: return champions from that season only
  → Else: return all-time champions
  → Aggregate by league for rankings
```

**Location:** `/home/user/marching.art/functions/src/callable/leagues.js`

### 4. CORPS TIMELINE / CAREER ARC (Advanced)

**Path:** `/corps-timeline`

Shows chronological progression:
- Corps created → seasons played → championships → retired
- Timeline visualization with milestones
- Performance curve over time

**Backend:** Needs custom query
- But data structure supports it already via seasonHistory

---

## RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Basic Views (No Backend Changes)
1. **Retired Corps Gallery** - Show list of retired corps + stats
   - Time to build: 2-3 hours
   - Data already exists in `profile.retiredCorps`
   - Add unretire button (calls existing function)

2. **Corps History Tab** - Show season history for active corps
   - Time to build: 2-3 hours
   - Data already exists in `corps.seasonHistory`
   - Show season-by-season breakdown

### Phase 2: Enhanced Views (Some Backend)
3. **Hall of Champions** - Real league champion data
   - Time to build: 4-5 hours
   - Needs 1 new backend function to query league champions
   - Aggregate and display championship records

### Phase 3: Advanced Features (Future)
4. **Corps Timeline** - Career progression visualization
5. **Comparison Tool** - Compare two corps' performance
6. **Achievement Gallery** - Show all user achievements

---

## KEY FILES REFERENCE

### Data Models & Backend
| File | Lines | Purpose |
|------|-------|---------|
| `/functions/src/callable/corps.js` | 1-165 | Retirement system |
| `/functions/src/helpers/season.js` | 14-430 | Season archiving & reset |
| `/functions/src/scheduled/seasonScheduler.js` | 1-67 | Season cron trigger |
| `/functions/src/scheduled/lifetimeLeaderboard.js` | 1-141 | Lifetime stats leaderboard |
| `/src/firebase/functions.js` | 1-91 | Function exports |

### Frontend Pages
| File | Size | Status |
|------|------|--------|
| `/src/pages/Dashboard.jsx` | ~2000 lines | ✅ Well-built |
| `/src/pages/Leaderboard.jsx` | ~400 lines | ✅ Complete |
| `/src/pages/HallOfChampions.jsx` | 36 lines | ⚠️ Stub only |
| `/src/pages/ProfileNew.jsx` | ~300 lines | ✅ Complete |

### Routing
| File | Lines | Purpose |
|------|-------|---------|
| `/src/App.jsx` | 350 | All route definitions |

---

## CURRENT GAPS & OPPORTUNITIES

### ✅ What's Already Built
1. Retirement system (retireCorps/unretireCorps functions)
2. Season archiving to seasonHistory arrays
3. Lifetime stats tracking
4. Lifetime leaderboard generation
5. League champion archival
6. UI for managing corps (dashboard)

### ⚠️ What's Missing (Ready to Build)
1. **Corps History Page** - Show archived seasons for active corps
2. **Retired Corps Gallery** - Browse retired corps with stats
3. **Hall of Champions Real Data** - Currently stub, needs real league data
4. **Retirement UI** - No "Retire Corps" button in dashboard menu
5. **Career Stats View** - Detailed lifetime stats per corps
6. **History Graphs** - Visualize performance over seasons

### 🔄 Data Flow
```
Season Ends
  ↓
Season Scheduler Cron (3 AM EST daily)
  ↓
For Each User Profile:
  └─→ Archive corps data to seasonHistory
      └─→ Update lifetimeStats
          └─→ Reset activeLineup/selectedShows
  └─→ Create achievements (if league champion)
  └─→ Notify league members
  ↓
Lifetime Leaderboard Cron (3 AM UTC daily)
  ↓
Query all users, create 5 pre-computed leaderboards
  └─→ Store in leaderboard/lifetime_*/data docs
```

---

## SUMMARY

The marching.art app has a **solid foundation** for the Corps History and Retired Corps Gallery features:

- **Data models are ready**: `seasonHistory`, `retiredCorps`, `lifetimeStats` all exist
- **Backend functions are ready**: `retireCorps`, `unretireCorps`, season archiving
- **Lifetime leaderboards are ready**: Pre-computed daily with 5 metrics
- **Only missing**: Frontend pages to display this data

**Estimated effort to build:**
- Corps History page: 2-3 hours
- Retired Corps Gallery: 2-3 hours
- Hall of Champions (real data): 4-5 hours
- Total: 8-11 hours for all three features

**No breaking changes needed** - all data structures support the new features.

