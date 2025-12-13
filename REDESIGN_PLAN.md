# Marching.Art Fantasy Game Redesign Plan

## Design Philosophy

**Core Principle:** Strip away the management sim complexity and let the fantasy sports core shine. The game should feel like ESPN Fantasy Football meets DCI - simple to play, strategic to master, social to enjoy.

**Guiding Mantra:** "Draft smart, watch shows, talk trash, win leagues."

---

## Current State Analysis

### What's Working
- 8-caption drafting system (unique, strategic)
- Real DCI score integration (authentic connection to the activity)
- Season structure (live/off-season rhythm)
- League infrastructure (social competition)
- Visual design foundation (stadium HUD aesthetic)

### What's Hurting the Experience
- **Execution multiplier** obscures the draft → score connection
- **Daily grind** (rehearsals, wellness, equipment) creates burnout, not engagement
- **Too many systems** competing for attention (staff, equipment, difficulty, challenges)
- **Unclear scoring** - users don't know why they won or lost
- **Weak league focus** - leagues feel like an afterthought, not the main event

### Design Decisions for Redesign

| Element | Decision | Rationale |
|---------|----------|-----------|
| Execution System | **REMOVE** | Obscures fantasy core; daily grind ≠ fantasy sports |
| Staff System | **REMOVE** | Adds complexity without strategic depth |
| Equipment | **REMOVE** | Management sim baggage |
| Daily Operations | **REMOVE** | Replace with weekly rhythm |
| Show Difficulty | **REMOVE** | Unnecessary complication |
| CorpsCoin | **SIMPLIFY** | One currency, clear earning/spending |
| Battle Pass | **KEEP (Simplified)** | Seasonal progression without daily pressure |
| Leagues | **ELEVATE** | Make this the primary competitive experience |
| Caption Drafting | **KEEP** | Core fantasy mechanic, untouched |
| Season System | **KEEP** | Works well as-is |

---

## Simplified Game Loop

### Weekly Rhythm (Not Daily)
```
MONDAY: Set your lineup for the week (lock at first show)
WEEK: Watch DCI shows, scores post automatically
WEEKEND: See results, league standings update, trash talk
REPEAT: Make trades, adjust strategy for next week
```

### Scoring Transparency
```
Your Score = Sum of your 8 captions' actual DCI scores
That's it. No multipliers. No hidden factors.
If Blue Devils GE1 scores 19.2, you get 19.2.
```

### CorpsCoin Economy (Simplified)
```
EARN:
- Weekly show participation: 50-200 CC (by class)
- League wins: 100 CC
- Season milestones: 250-1000 CC
- Battle Pass rewards

SPEND:
- Unlock higher classes (one-time)
- Cosmetic customization
- League entry fees (optional)
```

### Battle Pass (Streamlined)
```
- 50 levels, entire season to complete
- XP from: Weekly participation, league wins, season milestones
- NO daily login requirements
- Rewards: CorpsCoin, cosmetics, profile badges
- Premium track: $4.99/season for bonus rewards
```

---

## 20-Step Redesign Plan

Each step is designed to be a complete, shippable increment. Steps can be executed sequentially, with each building on the previous.

---

## PHASE 1: STRIP DOWN (Steps 1-5)
*Remove complexity, expose the fantasy core*

### Step 1: Remove Execution System
**Goal:** Eliminate the execution multiplier and all related UI/backend

**Tasks:**
1. Remove ExecutionDashboard component and all TransparentGameplay/ subcomponents
2. Remove useExecution hook entirely
3. Remove execution-related cloud functions (dailyRehearsal, repairEquipment, upgradeEquipment, setShowDifficulty, boostMorale, getExecutionStatus)
4. Remove execution state from user profile schema
5. Update scoring calculation to use raw caption scores (no multiplier)
6. Remove all execution-related UI from Dashboard (readiness gauges, morale bars, equipment status)

**Files to modify:**
- `/src/components/Execution/` - DELETE entire directory
- `/src/hooks/useExecution.js` - DELETE
- `/functions/src/callable/execution.js` - DELETE or gut
- `/functions/src/helpers/executionMultiplier.js` - DELETE
- `/src/pages/Dashboard.jsx` - Remove execution sections
- `/src/components/Dashboard/CommandCenter.jsx` - Simplify to show scores only

**Success criteria:** Dashboard loads without any execution-related UI. Scores display as raw DCI values.

---

### Step 2: Remove Staff System
**Goal:** Eliminate staff marketplace, assignments, and auctions

**Tasks:**
1. Remove Staff page entirely
2. Remove StaffMarketplace, StaffRoster, StaffAuctions components
3. Remove useStaffMarketplace hook
4. Remove staff-related cloud functions (purchaseStaff, assignStaff, listStaffForAuction, bidOnStaff, etc.)
5. Remove staff array from user profile schema
6. Remove DashboardStaffPanel from dashboard
7. Remove staff references from navigation

**Files to modify:**
- `/src/pages/Staff.jsx` - DELETE
- `/src/components/Staff/` - DELETE entire directory
- `/src/hooks/useStaffMarketplace.jsx` - DELETE
- `/functions/src/callable/economy.js` - Remove staff functions
- `/src/components/Dashboard/` - Remove staff panels

**Success criteria:** No staff-related UI anywhere in app. Navigation simplified.

---

### Step 3: Remove Daily Operations
**Goal:** Eliminate daily grind activities (except login tracking for streaks)

**Tasks:**
1. Remove DailyOperations component from Dashboard
2. Remove daily ops cloud functions (staffCheckin, memberWellnessCheck, equipmentInspection, sectionalRehearsal, showReview)
3. Keep claimDailyLogin but simplify to just streak tracking (no XP/coin pressure)
4. Remove dailyOps tracking from user profile (except login dates)
5. Remove MorningReport modal (or convert to simple "welcome back" with no tasks)
6. Remove challenge system entirely (useChallenges hook, challenge UI)
7. Remove QuickActionsRow or convert to simple navigation shortcuts

**Files to modify:**
- `/src/components/Dashboard/DailyOperations.jsx` - DELETE
- `/src/components/Dashboard/MorningReport.jsx` - DELETE or simplify drastically
- `/src/hooks/useChallenges.ts` - DELETE
- `/functions/src/callable/dailyOps.js` - Keep only login tracking

**Success criteria:** Dashboard has no "daily tasks" or "operations" section. No pressure to log in daily.

---

### Step 4: Simplify Dashboard to Fantasy Essentials
**Goal:** Rebuild Dashboard around the fantasy core: Your Corps, Your Scores, Your League

**Tasks:**
1. Design new simplified Dashboard layout:
   - **Hero Section:** Active corps card with current season score + rank
   - **Lineup Section:** Your 8 captions displayed clearly
   - **This Week Section:** Upcoming shows you're registered for
   - **League Widget:** Your league standing + next matchup
   - **Recent Scores:** Last 3 shows with caption breakdown
2. Remove CommandCenter complexity - replace with clean corps overview
3. Remove bento-grid HUD aesthetic for cleaner card-based layout
4. Keep corps switching if user has multiple corps
5. Simplify header to: Logo, Nav, Profile, CorpsCoin balance

**New Dashboard Structure:**
```
┌─────────────────────────────────────────────┐
│  [Logo]  Dashboard | Schedule | Leagues     │
│                              [Coin] [Avatar]│
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │  YOUR CORPS     │  │  THIS WEEK       │  │
│  │  Blue Thunder   │  │  2 shows         │  │
│  │  World Class    │  │  Next: Fri 7/12  │  │
│  │  Season: 847.3  │  │  [View Schedule] │  │
│  │  Rank: #12      │  │                  │  │
│  └─────────────────┘  └──────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  YOUR LINEUP                [Edit]   │   │
│  │  GE1: Blue Devils '19    GE2: BD '18 │   │
│  │  VP:  Crown '15          VA:  SCV'18 │   │
│  │  CG:  Cavaliers '21      B:   BD '14 │   │
│  │  MA:  Crown '17          P:   SCV'18 │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │  LEAGUE         │  │  RECENT SCORES   │  │
│  │  DCI Fanatics   │  │  Fri: 98.2 (+2)  │  │
│  │  You: 3rd/8     │  │  Sat: 96.8 (-1)  │  │
│  │  Next vs: @Mike │  │  [View All]      │  │
│  └─────────────────┘  └──────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/Dashboard.jsx` - Complete rewrite
- `/src/components/Dashboard/` - Keep minimal, rewrite others

**Success criteria:** Dashboard loads in <2 seconds, shows only fantasy-relevant info, no cognitive overload.

---

### Step 5: Simplify Navigation & Information Architecture
**Goal:** Reduce pages and create clear user flow

**Tasks:**
1. Consolidate navigation to 5 main items:
   - **Dashboard** (home)
   - **Schedule** (view/register for shows)
   - **Scores** (leaderboards)
   - **Leagues** (league management)
   - **Profile** (your stats, settings)
2. Remove from main nav: Staff, Battle Pass (move to profile), HUD Dashboard (remove entirely)
3. Simplify mobile navigation to bottom bar with these 5 items
4. Remove CommandRail complexity - use simple sidebar on desktop
5. Update GamingHeader to be cleaner, less cluttered
6. Remove HowToPlay page - integrate help into onboarding and tooltips

**New Navigation:**
```
Desktop: Simple left sidebar (icons + labels, no collapse)
Mobile: Bottom bar with 5 icons
```

**Files to modify:**
- `/src/App.jsx` - Update routes
- `/src/components/GamingHeader.tsx` - Simplify
- `/src/components/Navigation.tsx` - Simplify
- `/src/components/BottomNav.tsx` - 5 items only
- `/src/components/CommandRail.jsx` - Simplify or remove

**Success criteria:** User can access any feature in ≤2 taps. Navigation is obvious.

---

## PHASE 2: ELEVATE LEAGUES (Steps 6-10)
*Make leagues the primary competitive experience*

### Step 6: Redesign League Home Experience
**Goal:** Make leagues feel like the center of competition, not a side feature

**Tasks:**
1. Redesign Leagues page as a proper "League Hub":
   - **My Leagues** prominently displayed (not in a tab)
   - **League Cards** show: name, your rank, record, next matchup
   - **Quick Actions:** View standings, chat, matchups
2. Add "Featured Leagues" discovery section for public leagues
3. Improve league card design - make it scannable
4. Show head-to-head matchup preview on league card
5. Add league activity indicator (recent messages, trades)

**New League Hub Layout:**
```
┌─────────────────────────────────────────────┐
│  LEAGUES                    [Create League] │
├─────────────────────────────────────────────┤
│                                             │
│  MY LEAGUES                                 │
│  ┌──────────────────────────────────────┐   │
│  │ 🏆 DCI Fanatics          8 members   │   │
│  │    Your Record: 4-2 (3rd place)      │   │
│  │    This Week: vs @MikeDrums          │   │
│  │    [Standings] [Chat] [Matchups]     │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ 🥁 Percussion Heads      12 members  │   │
│  │    Your Record: 5-1 (1st place) 🔥   │   │
│  │    This Week: BYE                    │   │
│  │    [Standings] [Chat] [Matchups]     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  DISCOVER LEAGUES                           │
│  [Search...]                                │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │Public 1│ │Public 2│ │Public 3│          │
│  └────────┘ └────────┘ └────────┘          │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/Leagues.jsx` - Redesign
- `/src/components/Leagues/LeagueCard.jsx` - Enhanced design

**Success criteria:** Users immediately see their competitive standing. Leagues feel exciting.

---

### Step 7: Improve League Detail View
**Goal:** Make league detail page the social hub for competition

**Tasks:**
1. Redesign LeagueDetailView with better information hierarchy:
   - **Header:** League name, your rank badge, season record
   - **This Week's Matchups:** Prominent display of all H2H pairings
   - **Standings Table:** Clean, sortable, with win/loss streaks
   - **Activity Feed:** Recent scores, chat messages, trades
2. Make standings more visually interesting (podium for top 3, trend arrows)
3. Improve chat tab - make it feel alive (timestamps, reactions)
4. Add "Matchup Detail" view showing head-to-head score comparison
5. Remove trades/auctions for now (complexity reduction)

**League Detail Layout:**
```
┌─────────────────────────────────────────────┐
│  ← Back    DCI Fanatics    [Settings ⚙️]   │
├─────────────────────────────────────────────┤
│  YOUR STATUS                                │
│  ┌────────────────────────────────────────┐ │
│  │  🥉 3rd Place  |  4-2 Record  |  W2    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  THIS WEEK'S MATCHUPS (Week 5)              │
│  ┌──────────────────────────────────────┐   │
│  │ YOU (847.3)  vs  @MikeDrums (823.1)  │   │
│  │ [View Matchup Detail]                │   │
│  └──────────────────────────────────────┘   │
│  ┌───────────────┐ ┌───────────────┐        │
│  │@Sarah vs @Tom │ │@Alex vs @Kim  │        │
│  └───────────────┘ └───────────────┘        │
│                                             │
│  [Standings] [Chat] [History]               │
│  ┌──────────────────────────────────────┐   │
│  │ 1. 🥇 @Sarah      6-0   +127         │   │
│  │ 2. 🥈 @MikeDrums  5-1   +89          │   │
│  │ 3. 🥉 You         4-2   +45          │   │
│  │ 4.    @Tom        3-3   +12          │   │
│  │ ...                                  │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/components/Leagues/LeagueDetailView.jsx` - Redesign
- `/src/components/Leagues/tabs/` - Simplify tabs

**Success criteria:** League detail feels like a sports app league page. Social and competitive.

---

### Step 8: Add Head-to-Head Matchup Experience
**Goal:** Create exciting weekly matchup views that drive engagement

**Tasks:**
1. Create new MatchupDetail component showing:
   - Both users' corps side-by-side
   - Caption-by-caption score comparison (who's winning each)
   - Running total with projection
   - Historical H2H record between these users
2. Add matchup notifications (when opponent's score updates)
3. Show "Live" indicator during shows
4. Add simple matchup sharing (screenshot-friendly design)
5. Display matchup result after week ends (winner celebration)

**Matchup Detail Layout:**
```
┌─────────────────────────────────────────────┐
│  WEEK 5 MATCHUP                             │
├─────────────────────────────────────────────┤
│                                             │
│    YOU              VS         @MikeDrums   │
│   847.3                          823.1      │
│   +24.2 ✓                                   │
│                                             │
│  Caption Breakdown:                         │
│  GE1:  19.2 ✓  vs  18.8                    │
│  GE2:  18.9     vs  19.1 ✓                  │
│  VP:   17.3 ✓  vs  16.9                    │
│  VA:   18.1 ✓  vs  17.5                    │
│  CG:   17.8     vs  18.2 ✓                  │
│  B:    19.4 ✓  vs  18.7                    │
│  MA:   18.3 ✓  vs  17.6                    │
│  P:    18.6     vs  18.9 ✓                  │
│                                             │
│  H2H History: You lead 3-1                  │
│                                             │
│  [Back to League]        [Share Matchup]    │
└─────────────────────────────────────────────┘
```

**Files to create:**
- `/src/components/Leagues/MatchupDetail.jsx` - NEW
- `/src/components/Leagues/MatchupCard.jsx` - NEW

**Success criteria:** Users check matchups multiple times per week. Creates natural engagement.

---

### Step 9: Improve League Creation & Discovery
**Goal:** Make it easy to create, find, and join leagues

**Tasks:**
1. Simplify CreateLeagueModal to essential fields:
   - League name
   - Public/Private toggle
   - Max members (4-20)
   - Invite code display after creation
2. Improve public league discovery:
   - Search by name
   - Filter by: member count, activity level
   - Show "Recommended" leagues based on corps class
3. Add "Quick Join" with invite code input
4. Improve league invitation flow (shareable link)
5. Add "Create League" CTA on dashboard if user has no leagues

**Files to modify:**
- `/src/components/Leagues/CreateLeagueModal.jsx` - Simplify
- `/src/pages/Leagues.jsx` - Better discovery UI

**Success criteria:** Creating/joining a league takes <30 seconds.

---

### Step 10: Add League Notifications & Activity
**Goal:** Keep users engaged with their leagues between sessions

**Tasks:**
1. Add notification system for league events:
   - Matchup results posted
   - Someone passed you in standings
   - New message in league chat
   - Trade proposal (if we keep trades later)
2. Create activity feed component showing recent league events
3. Add notification badge on Leagues nav item
4. Optional: Email digest for weekly league summary
5. Show "rivalry" indicators (repeated matchups with same opponent)

**Files to create:**
- `/src/components/Leagues/LeagueActivityFeed.jsx` - NEW
- `/src/hooks/useLeagueNotifications.ts` - NEW

**Success criteria:** Users have reasons to check the app beyond just score posting.

---

## PHASE 3: POLISH CORE EXPERIENCE (Steps 11-15)
*Make every interaction feel premium*

### Step 11: Redesign Score Display & Leaderboards
**Goal:** Make scores transparent, exciting, and easy to understand

**Tasks:**
1. Redesign Scores page with clearer hierarchy:
   - **Your Corps Status** at top (rank, score, trend)
   - **Recent Shows** with your results highlighted
   - **Leaderboard** below (filterable by class, time period)
2. Add "Score Breakdown" view for any score:
   - Show exactly which caption got what score
   - Compare to previous show
   - Show rank change
3. Remove complex analytics (heatmaps, sparklines) - clarity over density
4. Add simple trend indicators (↑↓→) instead of complex charts
5. Make leaderboard scannable (rank, name, score, trend)

**Scores Page Layout:**
```
┌─────────────────────────────────────────────┐
│  SCORES                                     │
├─────────────────────────────────────────────┤
│                                             │
│  YOUR SEASON                                │
│  ┌────────────────────────────────────────┐ │
│  │  #12 of 234  |  847.3 pts  |  ↑3 📈   │ │
│  │  World Class |  Blue Thunder           │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  LATEST SHOW: San Antonio (Sat 7/13)        │
│  ┌────────────────────────────────────────┐ │
│  │  Your Score: 98.2  |  Show Rank: #8    │ │
│  │  [View Breakdown]                      │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  LEADERBOARD         [World ▼] [Season ▼]  │
│  ┌──────────────────────────────────────┐   │
│  │  1. @DrumCorpsFan    892.4  ↑2        │   │
│  │  2. @BrassKing       887.1  →         │   │
│  │  3. @GuardQueen      879.6  ↑5        │   │
│  │  ...                                  │   │
│  │ 12. You (Blue Thunder) 847.3  ↑3      │   │
│  │  ...                                  │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/Scores.jsx` - Redesign
- `/src/components/Scores/` - Simplify components

**Success criteria:** Users understand their score in <5 seconds. No confusion.

---

### Step 12: Improve Caption Selection Experience
**Goal:** Make drafting your lineup feel strategic and fun

**Tasks:**
1. Redesign CaptionSelectionModal for clarity:
   - Show point budget prominently
   - Group captions by category (GE, Visual, Music)
   - Show historical performance for each option
   - Clear "selected" state for each slot
2. Add "Draft Helper" suggestions:
   - "Hot" corps (recent high scores)
   - "Value" picks (good performance relative to cost)
   - "Your History" (corps you've used before)
3. Make selection feel more like a draft:
   - Show remaining budget after each pick
   - Animate selection confirmation
   - Show "lineup complete" celebration
4. Add ability to save/load lineup templates
5. Improve mobile experience for caption selection

**Files to modify:**
- `/src/components/CaptionSelection/CaptionSelectionModal.jsx` - Redesign

**Success criteria:** Drafting a lineup is the most enjoyable part of setup.

---

### Step 13: Streamline Schedule & Show Registration
**Goal:** Make show selection simple and clear

**Tasks:**
1. Simplify Schedule page:
   - Week selector at top (horizontal scroll)
   - Show list for selected week (card-based)
   - Clear "Registered" indicators
   - "Register All" option for convenience
2. Remove show difficulty selection (eliminated with execution system)
3. Show which of your corps are registered for each show
4. Add "recommended shows" based on when real DCI shows happen
5. Simplify ShowRegistrationModal to checkbox selection
6. Add calendar view option (monthly overview)

**Schedule Page Layout:**
```
┌─────────────────────────────────────────────┐
│  SCHEDULE                   [Week 5 of 7]  │
├─────────────────────────────────────────────┤
│                                             │
│  [Wk1][Wk2][Wk3][Wk4][★Wk5][Wk6][Wk7]     │
│                                             │
│  WEEK 5 SHOWS (3 available)                 │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ 📍 San Antonio Regional                │ │
│  │    Saturday, July 13                   │ │
│  │    [✓ Registered - Blue Thunder]       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ 📍 DCI Southwestern                    │ │
│  │    Sunday, July 14                     │ │
│  │    [Register →]                        │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ 📍 Atlanta Showcase                    │ │
│  │    Sunday, July 14                     │ │
│  │    [Register →]                        │ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/Schedule.jsx` - Simplify
- `/src/components/Schedule/` - Simplify components

**Success criteria:** Registering for shows takes <10 seconds.

---

### Step 14: Redesign Profile & Settings
**Goal:** Clean profile that shows your fantasy career

**Tasks:**
1. Combine Profile and Settings into one cohesive page:
   - **Identity Section:** Avatar, name, location, favorite corps
   - **Stats Section:** Level, XP, seasons played, best finishes
   - **Corps Gallery:** All your corps across classes
   - **Achievements:** Milestone badges
   - **Settings:** Account, notifications, display preferences
2. Simplify achievement system to meaningful milestones:
   - First championship win
   - League winning streaks
   - Season participation milestones
   - Class unlocks
3. Add "Season History" view (archived seasons, final ranks)
4. Move Battle Pass access here (not main nav)
5. Add simple avatar customization

**Profile Page Layout:**
```
┌─────────────────────────────────────────────┐
│  PROFILE                        [Settings]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────┐  DrumCorpsFan                   │
│  │ Avatar │  Austin, TX                     │
│  │   LV12 │  Favorite: Blue Devils          │
│  └────────┘  Member since 2024              │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ 4,250 XP │ 3 Seasons │ 1 🏆 │ 2,340 CC│   │
│  └──────────────────────────────────────┘   │
│                                             │
│  MY CORPS                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │World   │ │Open    │ │A Class │          │
│  │Blue    │ │Thunder │ │Rising  │          │
│  │Thunder │ │Bolts   │ │Stars   │          │
│  │#12     │ │#5      │ │#23     │          │
│  └────────┘ └────────┘ └────────┘          │
│                                             │
│  ACHIEVEMENTS                               │
│  🏆 Season Champion (Open Class)            │
│  🔥 5-Win League Streak                     │
│  ⭐ 10 Seasons Completed                    │
│                                             │
│  [Battle Pass] [Season History]             │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/Profile.jsx` - Redesign
- `/src/pages/Settings.jsx` - Merge into Profile

**Success criteria:** Profile tells your fantasy story at a glance.

---

### Step 15: Improve Onboarding Flow
**Goal:** Get new users to their first "aha moment" in <3 minutes

**Tasks:**
1. Streamline onboarding to 3 steps:
   - **Step 1:** Welcome + pick a display name
   - **Step 2:** Create your first corps (name only, SoundSport)
   - **Step 3:** Draft your first lineup (guided caption selection)
2. Auto-register new users for current week's shows
3. Add contextual tooltips on first dashboard visit
4. Create "Quick Start Guide" accessible from dashboard
5. Remove location step (can add later in profile)
6. Show clear path to joining a league after setup

**Onboarding Flow:**
```
Step 1: "Welcome to marching.art!"
        → Enter display name
        → "You'll get 100 CorpsCoin to start"

Step 2: "Create your first corps"
        → Enter corps name
        → "Starting in SoundSport class"

Step 3: "Build your lineup" (interactive)
        → Guided caption selection
        → "You can change this anytime"

Done:   → Dashboard with "Join a league!" prompt
```

**Files to modify:**
- `/src/pages/Onboarding.jsx` - Simplify to 3 steps
- Create tooltip/tour system for first visit

**Success criteria:** New user has corps + lineup in <3 minutes.

---

## PHASE 4: ECONOMY & PROGRESSION (Steps 16-18)
*Meaningful rewards without daily grind*

### Step 16: Simplify CorpsCoin Economy
**Goal:** One currency with clear earning and spending

**Tasks:**
1. Define simplified earning sources:
   - Show participation: 50-200 CC per show (by class)
   - Weekly league win: 100 CC
   - Season finish bonus: 250-1000 CC (based on final rank)
   - Battle Pass rewards: Various amounts
2. Define simplified spending:
   - Class unlocks (one-time): A=1000, Open=2500, World=5000
   - Cosmetics (future): Avatars, badges, corps colors
   - League entry fees (optional, commissioner-set)
3. Remove all execution-related spending (repairs, upgrades, morale)
4. Update UI to show earning opportunities clearly
5. Add "CorpsCoin History" view in profile

**Files to modify:**
- `/functions/src/callable/economy.js` - Simplify
- Update profile UI to show CC balance and history

**Success criteria:** Users understand how to earn and spend CC without documentation.

---

### Step 17: Streamline Battle Pass
**Goal:** Seasonal progression without daily pressure

**Tasks:**
1. Redesign Battle Pass around weekly/seasonal milestones:
   - XP from: Weekly participation, league wins, season placement
   - NO daily login requirements
   - 50 levels, entire season to complete
2. Simplify reward structure:
   - Free track: CorpsCoin, basic badges
   - Premium track ($4.99): More CC, exclusive cosmetics
   - Milestone rewards at levels 10, 25, 50
3. Redesign BattlePass page to be cleaner:
   - Clear progress indicator
   - Upcoming rewards preview
   - Simple claim interface
4. Remove XP from daily activities (no grind)
5. Make premium upgrade optional and non-pressuring

**Battle Pass Page Layout:**
```
┌─────────────────────────────────────────────┐
│  BATTLE PASS - Season 2024-3               │
│  Level 23 / 50          47% complete        │
├─────────────────────────────────────────────┤
│                                             │
│  [====================                    ] │
│   Level 23              → Level 24 (180 XP)│
│                                             │
│  REWARDS                                    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 21 │ │ 22 │ │★23 │ │ 24 │ │ 25 │       │
│  │ ✓  │ │ ✓  │ │CURR│ │100CC││🎖️ │       │
│  └────┘ └────┘ └────┘ └────┘ └────┘       │
│                                             │
│  EARNING XP THIS SEASON:                    │
│  • Participate in weekly shows (+50 XP)    │
│  • Win league matchups (+100 XP)           │
│  • Season finish bonus (up to +500 XP)     │
│                                             │
│  [Upgrade to Premium - $4.99]              │
│                                             │
└─────────────────────────────────────────────┘
```

**Files to modify:**
- `/src/pages/BattlePass.jsx` - Redesign
- `/functions/src/callable/battlePass.js` - Simplify XP sources

**Success criteria:** Battle Pass feels rewarding, not like a chore.

---

### Step 18: Improve Progression & Class Unlocks
**Goal:** Clear path from SoundSport to World Class

**Tasks:**
1. Simplify XP earning:
   - Weekly participation: 100 XP
   - League wins: 50 XP
   - Season completion: 200-500 XP (based on rank)
2. Make class unlock requirements clear:
   - Level 3 (3000 XP) OR 1000 CC → A Class
   - Level 5 (5000 XP) OR 2500 CC → Open Class
   - Level 10 (10000 XP) OR 5000 CC → World Class
3. Add unlock celebration modal (kept from current)
4. Show progress toward next unlock on dashboard
5. Remove level display from main UI (focus on class, not arbitrary number)

**Files to modify:**
- `/src/utils/captionPricing.js` - Adjust if needed
- `/functions/src/helpers/xpCalculations.js` - Simplify sources

**Success criteria:** Users understand how to unlock next class. Feels achievable, not grindy.

---

## PHASE 5: VISUAL POLISH & FINAL TOUCHES (Steps 19-20)
*Make it beautiful and cohesive*

### Step 19: Visual Design Refinement
**Goal:** Cohesive, premium visual design throughout

**Tasks:**
1. Establish refined color palette:
   - Keep gold (#FACC15) as primary accent
   - Simplify glass effects (less blur, more clarity)
   - Consistent border treatments (1px subtle, not 2px brutal)
2. Typography cleanup:
   - Consistent heading hierarchy
   - Better readability (slightly larger body text)
   - Reduce uppercase usage (currently overused)
3. Component consistency:
   - Standardize button styles (primary, secondary, ghost)
   - Consistent card designs across all pages
   - Unified spacing system (8px base)
4. Animation polish:
   - Subtle page transitions
   - Micro-interactions on buttons/cards
   - Loading states that feel premium
5. Responsive refinement:
   - Ensure all pages work beautifully on mobile
   - Tablet layout optimization
   - Consistent touch targets (44px minimum)

**Design Principles:**
- **Clarity over density** - Less is more
- **Gold for action** - Gold color = interactive
- **Glass for containers** - Subtle glass, not overwhelming
- **Data is king** - Scores and ranks are always prominent

**Files to modify:**
- `/src/index.css` - Refine base styles
- `/tailwind.config.cjs` - Adjust theme if needed
- All components - Apply consistent styling

**Success criteria:** App feels like a finished product, not a prototype.

---

### Step 20: Final Polish & Launch Readiness
**Goal:** Ship-ready product with attention to detail

**Tasks:**
1. Empty states for all scenarios:
   - No leagues joined
   - No shows registered
   - No scores yet
   - New season starting
2. Error handling and messaging:
   - Clear error messages
   - Graceful offline handling
   - Loading states everywhere needed
3. Performance optimization:
   - Lazy load routes
   - Optimize images
   - Reduce bundle size
4. Accessibility review:
   - Keyboard navigation
   - Screen reader support
   - Color contrast verification
5. Final QA checklist:
   - All user flows tested
   - Mobile experience verified
   - Cross-browser testing
   - Analytics events added
6. Landing page update:
   - Reflect simplified game
   - Clear value proposition
   - Updated screenshots

**Pre-Launch Checklist:**
```
□ All pages load in <3 seconds
□ Core flow works on mobile
□ No console errors in production
□ All empty states designed
□ All error states handled
□ Analytics tracking working
□ SEO basics (meta tags, titles)
□ Social sharing cards work
□ PWA install prompt working
□ Terms/Privacy updated if needed
```

**Files to modify:**
- Various components for empty/error states
- `/src/pages/Landing.jsx` - Update messaging
- Performance and accessibility audit

**Success criteria:** Product feels complete, polished, and ready for users.

---

## Summary

### What Gets Removed
- ❌ Execution system (multipliers, readiness, morale)
- ❌ Staff system (marketplace, auctions, assignments)
- ❌ Daily operations (rehearsals, wellness, equipment)
- ❌ Equipment management
- ❌ Show difficulty selection
- ❌ Challenge system
- ❌ Complex HUD dashboard

### What Gets Simplified
- ✅ CorpsCoin → single purpose currency
- ✅ Battle Pass → weekly/seasonal milestones only
- ✅ Navigation → 5 main pages
- ✅ Scoring → raw DCI scores, no multipliers

### What Gets Elevated
- 🚀 Leagues → primary competitive mode
- 🚀 Head-to-head matchups → exciting weekly feature
- 🚀 Score transparency → clear cause and effect
- 🚀 Caption drafting → strategic and fun

### What Stays the Same
- 📌 8-caption drafting system
- 📌 Season structure (live/off-season)
- 📌 Class progression (SoundSport → World)
- 📌 Core visual aesthetic (dark theme, gold accents)

---

## Timeline Estimate

Each step is designed to be completable in 1-3 focused sessions. Total redesign: approximately 20 working sessions.

**Phase 1 (Steps 1-5):** Foundation - Remove complexity
**Phase 2 (Steps 6-10):** Leagues - Build social competition
**Phase 3 (Steps 11-15):** Core - Polish main experience
**Phase 4 (Steps 16-18):** Economy - Simplify progression
**Phase 5 (Steps 19-20):** Polish - Ship-ready quality

---

*This plan prioritizes the fantasy sports experience over management sim complexity. The goal is a game that's simple to play, strategic to master, and social to enjoy.*
