# Technical Component Audit - marching.art UI Redesign

**Date:** 2025-11-29
**Purpose:** Map existing React components to new visual requirements for wholesale UI redesign

---

## 1. Global Navigation & Shell

### Current Components

| Component | File Path | Current Data Props | Visual States | Gap Analysis |
|-----------|-----------|-------------------|---------------|--------------|
| `Navigation.jsx` | `src/components/Navigation.jsx` | None (uses hooks: `useAuth()`, `useTheme()`, `useSeasonStore()`, `useLocation()`) | `open`, `collapsed`, `active` (per item) | **PARTIAL BADGE SUPPORT** - Has badge infrastructure but hardcoded. Needs dynamic badge counts from props/context |
| `MobileNav.jsx` | `src/components/MobileNav.jsx` | `isOpen: boolean`, `setIsOpen: (bool) => void` | `open`, `closed`, `active` (per item) | Has animated pulse badge on notification bell - needs to accept dynamic count |
| `BottomNav.jsx` | `src/components/BottomNav.jsx` | None (uses `useLocation()`) | `active` (per item) | **NO BADGE SUPPORT** - Needs prop interface for notification counts |

### Detailed Findings

**Navigation.jsx (Desktop Sidebar)**
- Has 4-5 sections: Main, Manage, Community, Account, Admin (conditional)
- Already supports:
  - Collapsible mode (icons only vs full labels)
  - Premium indicators (Sparkles icon for Battle Pass)
  - User profile card with XP progress bar and level badge
  - Season info display (name, current week)
  - Theme toggle
  - Active state highlighting (gold background)
- **GAP:** Badge infrastructure exists but is not dynamically fed. The nav items are hardcoded. Needs:
  - `badgeCounts` prop: `{ scores: number, schedule: number, leagues: number }`
  - Or a context/hook that provides notification counts

**Navigation Items Currently Supported:**
- Dashboard, Schedule, Scores & Rankings, Staff Market, Battle Pass, Leagues, Hall of Champions, Profile, Settings, How to Play, Admin Panel

### Recommended Changes for New Design

```jsx
// Current pattern - no badge prop
<NavItem icon={Trophy} label="Scores" to="/scores" />

// Needed pattern
<NavItem icon={Trophy} label="Scores" to="/scores" badge={notificationCounts.scores} />
```

**Priority Actions:**
1. Add `badge?: number` prop to nav item rendering
2. Create `useNotificationCounts()` hook or add to existing store
3. Style badge to match new design (red circle with white text)

---

## 2. Data Presentation Components (Cards & Lists)

### Corps & Score Display Components

| Component | File Path | Current Data Props | Visual States | Gap Analysis |
|-----------|-----------|-------------------|---------------|--------------|
| `ScoreRow.jsx` | `src/components/Scores/ScoreRow.jsx` | `score: object`, `rank: number` | `collapsed`, `expanded`, `hover` | **PARTIAL** - Has rank coloring (gold/silver/bronze) but NO trend indicator (scoreDelta +/-) |
| `ShowCard.jsx` | `src/components/Scores/ShowCard.jsx` | `show: object`, `onClick: fn` | `hover` (scale 1.005x) | Missing trend data, needs score change indicators |
| `DashboardCorpsPanel.jsx` | `src/components/Dashboard/DashboardCorpsPanel.jsx` | `activeCorps`, `activeCorpsClass`, `profile`, `currentWeek`, multiple handlers | `default`, `loading`, `tabbed` (Lineup/Schedule) | **GOOD** - Has class color-coding, Top 10 indicator, points usage. Needs `isLocked` state for caption conflicts |
| `LeagueCard.jsx` | `src/components/Leagues/LeagueCard.jsx` | `league`, `isMember`, `onJoin`, `onClick`, `userProfile` | `hover` (if member), `full` | Good base structure |

### Detailed Score Object Structure (ScoreRow.jsx)

```javascript
// Current props.score structure
{
  corps: string,           // "Aurora Vanguard"
  score: number,           // 81.25
  corpsClass: string,      // "world"
  captions: {              // Detailed breakdown
    GE1, GE2, VP, VA, CG, B, MA, P
  },
  geScore: number,         // Aggregated
  visualScore: number,
  musicScore: number
}
```

**MISSING for new design:**
- `rank: number` - Currently passed separately, should be in object
- `previousRank: number` - For calculating rank change
- `scoreDelta: number` - Score change from last show (+/- 0.25)
- `trend: 'up' | 'down' | 'stable'` - For trend line icon

### Dashboard Header Component

| Component | File Path | Current Data Props | Visual States | Gap Analysis |
|-----------|-----------|-------------------|---------------|--------------|
| `DashboardHeader.jsx` | `src/components/Dashboard/DashboardHeader.jsx` | `profile`, `seasonData`, `formatSeasonName`, `weeksRemaining`, `currentWeek`, `engagementData`, `activeCorps`, `activeCorpsClass` | `default`, `loading` (implied) | **GOOD** - Has trend indicators (TrendingUp/Down icons), XP progress bar. Needs multi-corps overview support |

**Current Stats Grid:**
- Level/XP with progress bar
- CorpsCoin balance
- Login streak (flame icon)
- Week info

**NEW REQUIREMENT:** Multi-corps overview panel ("My Corps Overview" in mockup)
- Needs to show ALL user corps at once with status icons
- Checkmark for healthy, Warning for conflicts

### Profile Components

| Component | File Path | Current Data Props | Visual States | Gap Analysis |
|-----------|-----------|-------------------|---------------|--------------|
| `ProfileHeader.jsx` | `src/components/Profile/ProfileHeader.jsx` | `profile`, `isOwnProfile`, `onSave`, `saving`, `xpProgress`, `currentStreak` | `view`, `edit`, `saving` | Good base, already has XP progress and stats grid |

### Recommended New Component

**`<CorpsSummaryCard />` - Does NOT currently exist**

Will need to create for "My Corps Overview" panel:

```jsx
// Proposed interface
interface CorpsSummaryCardProps {
  name: string;              // "Aurora Vanguard"
  corpsClass: 'world' | 'open' | 'aClass' | 'soundSport';
  rank: number;              // #312
  lastScore: number;         // 81.25
  scoreDelta?: number;       // +0.25 or -0.50
  trend?: 'up' | 'down' | 'stable';
  status: 'healthy' | 'conflict' | 'warning';
  statusMessage?: string;    // "Caption conflict detected"
}
```

---

## 3. The Action Engine (Daily Briefing)

### Current Task/Quest System

| Component | File Path | Purpose | Current Capabilities | Gap Analysis |
|-----------|-----------|---------|---------------------|--------------|
| `DailyQuests.jsx` | `src/components/DailyQuests.jsx` | Daily challenge system | 3-4 daily quests, streak tracking, reward claiming | **NOT the Daily Briefing concept** - This is gamification quests, not dynamic game-state tasks |
| `DailyOperations.jsx` | `src/components/Dashboard/DailyOperations.jsx` | Execution activities | Staff check-in, equipment, sectionals, etc. | Execution metrics, not task generation |
| `MorningReport.jsx` | `src/components/Dashboard/MorningReport.jsx` | Daily summary | Daily updates, streak info | **CLOSEST TO BRIEFING** but minimal implementation |

### Critical Gap: TaskEngine

**Current State Awareness: PARTIAL**

The frontend has MULTIPLE state sources but NO unified "source of truth" that aggregates:

| Data Type | Current Source | Aggregated? |
|-----------|---------------|-------------|
| User corps | `useDashboardData()` → Firestore | Per-request |
| Caption conflicts | Firestore + game logic | **NO FRONTEND DETECTION** |
| New scores available | Firestore | No unified check |
| Staff market changes | Firestore | No notification system |
| Execution state | `useExecution()` hook | Isolated |

**DOES NOT EXIST: TaskEngine helper**

The new "Today's Briefing" checklist requires a new system:

```javascript
// PROPOSED: TaskEngine.js

interface BriefingTask {
  id: string;
  type: 'ACTION' | 'REVIEW' | 'STRATEGY';
  priority: 'urgent' | 'normal';
  title: string;
  description: string;
  corps?: string;          // Which corps this relates to
  action?: () => void;     // Navigation/action handler
  completed: boolean;
}

// Example output:
[
  {
    id: 'conflict-world-1',
    type: 'ACTION',
    priority: 'urgent',
    title: 'World Class Visual Conflict detected',
    description: 'Urgent for World Class Visual Conflict detected to the storm.',
    corps: 'Aurora Vanguard',
    completed: false
  },
  {
    id: 'scores-new',
    type: 'REVIEW',
    priority: 'normal',
    title: '3 new score recaps available',
    description: 'Check your 3 new score recaps to update to be ncors.',
    completed: false
  }
]
```

### Task Logic Requirements

**Must check these conditions to generate briefing:**

1. **Caption Conflicts** - Any corps with overlapping caption assignments
2. **New Scores** - Shows that have posted scores since last login
3. **Staff Market** - New staff available matching user's strategy
4. **Rehearsal Available** - Daily rehearsal not yet completed
5. **Week Transition** - New week started, lineup needs review
6. **Execution Warnings** - Low morale, equipment issues
7. **League Activity** - New standings, commissioner messages

**Recommendation:** Create `useTaskEngine()` hook that:
1. Subscribes to all relevant Firestore collections
2. Runs rule-based logic to generate task list
3. Returns `{ tasks: BriefingTask[], loading: boolean }`
4. Provides `markComplete(taskId)` action

---

## 4. Supporting Infrastructure

### State Management (Already Exists)

| Store/Context | File Path | Manages | Notes |
|--------------|-----------|---------|-------|
| `userStore.js` | `src/store/userStore.js` | Auth user, profile, daily challenges | Zustand store |
| `seasonStore.js` | `src/store/seasonStore.js` | Season data, current week, schedule | Zustand store |
| `AuthContext.jsx` | `src/context/AuthContext.jsx` | Auth state, profile completion | React Context |
| `ThemeContext.jsx` | `src/context/ThemeContext.jsx` | Light/dark theme | React Context |

### Key Data Hooks (Already Exists)

| Hook | File Path | Returns | Useful For |
|------|-----------|---------|------------|
| `useDashboardData.js` | `src/hooks/useDashboardData.js` | Profile, corps, activeCorps, seasonData, recentScores, engagementData, dailyChallenges | **PRIMARY HOOK** - already aggregates most dashboard data |
| `useLeaderboard.ts` | `src/hooks/useLeaderboard.ts` | Paginated leaderboard data | Competitive tier panel |
| `useLeagues.ts` | `src/hooks/useLeagues.ts` | League memberships, standings | League features |
| `useSeason.js` | `src/hooks/useSeason.js` | Season progress, weeks remaining | Countdown timer |

### UI Libraries in Use

- **Icons:** `lucide-react`
- **Animations:** `framer-motion`
- **Notifications:** `react-hot-toast`
- **Styling:** Tailwind CSS
- **Utility Classes:** `glass`, `card` for card styles

---

## 5. Summary: New Development Required

### Components to CREATE

| Component | Priority | Reason |
|-----------|----------|--------|
| `<CorpsSummaryCard />` | HIGH | Multi-corps overview panel needs compact corps cards |
| `<CompetitiveTierList />` | HIGH | "My Competitive Tier" rival tracking panel |
| `<DailyBriefing />` | HIGH | Replaces current scattered task systems |
| `<CaptionLockTimer />` | MEDIUM | Countdown to caption lock deadline |

### Components to MODIFY

| Component | Changes Needed | Priority |
|-----------|----------------|----------|
| `Navigation.jsx` | Add dynamic badge count props | HIGH |
| `BottomNav.jsx` | Add badge support | HIGH |
| `ScoreRow.jsx` | Add `scoreDelta`, `trend` props | MEDIUM |
| `DashboardHeader.jsx` | Support multi-corps overview mode | MEDIUM |

### New Hooks/Services to CREATE

| Name | Purpose | Priority |
|------|---------|----------|
| `useTaskEngine()` | Generate dynamic briefing tasks from game state | HIGH |
| `useNotificationCounts()` | Aggregate counts for nav badges | HIGH |
| `useRivalTracking()` | Track nearby competitors for tier panel | MEDIUM |

---

## 6. Quick Reference: Component → New UI Mapping

| New UI Element | Existing Component | Fit Level | Notes |
|----------------|-------------------|-----------|-------|
| Left Sidebar Nav | `Navigation.jsx` | 80% | Add badges, restructure sections |
| My Corps Overview | `DashboardCorpsPanel.jsx` | 40% | Currently single-corps focused |
| Competitive Tier | None | 0% | **NEW BUILD** |
| Daily Briefing | `DailyQuests.jsx` | 20% | Wrong paradigm, needs full rebuild |
| Corps Card (mini) | None | 0% | **NEW BUILD** (`<CorpsSummaryCard />`) |
| Score Row | `ScoreRow.jsx` | 70% | Add trend, rank change |
| Caption Lock Timer | None | 0% | **NEW BUILD** |

---

*This audit is based on codebase exploration as of 2025-11-29. CSS/styling details intentionally omitted per request.*
