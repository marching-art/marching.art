# marching.art - Complete Gameplay Summary for UI/UX Design

## Executive Summary

**marching.art** is a fantasy drum corps management game inspired by DCI (Drum Corps International). It combines fantasy sports mechanics with simulation gameplay, allowing users to build virtual drum corps using real historical DCI performance data.

---

## Core Concept

### The Fantasy Sports Model
- Users create and manage virtual "fantasy" drum corps
- Corps are built by selecting **8 captions** (judging categories) from historical DCI performances
- Real DCI competition results during the summer season drive user scores
- Year-round engagement through a dual-season model

### Dual-Season Structure
| Season | Duration | Gameplay |
|--------|----------|----------|
| **Live Season** | 10 weeks (June-August) | Real DCI scores power fantasy competition |
| **Off-Season** | 42 weeks (Sept-May) | Director simulation: rehearsals, management |

---

## User Journey & Key Flows

### 1. Onboarding Flow
```
Sign Up → Create Username → Create Director Profile → Create First Corps (SoundSport) → Select Show Concept → Name Corps → Receive 100 CorpsCoin Starter Bonus
```

### 2. Daily Engagement Loop
```
Login → Claim Daily Bonus → Complete Daily Rehearsal → Check Daily Challenges → Review Scores/Leaderboards → (Optional) Show Selection
```

### 3. Weekly Engagement Loop
```
Select Shows to Enter → Manage Execution Metrics → Assign Staff → Repair Equipment → Track Battle Pass Progress
```

### 4. Seasonal Progression
```
Register Corps in Class → Select 8 Captions (within point budget) → Compete in Weekly Shows → Earn Points/Rank → Finals Competition → Championship Crowning
```

---

## The 8 Caption System

Users select one caption from each of these 8 judging categories:

| Caption | Full Name | Description |
|---------|-----------|-------------|
| **GE1** | General Effect 1 | Visual entertainment/design |
| **GE2** | General Effect 2 | Musical entertainment/design |
| **VP** | Visual Proficiency | Visual performance quality |
| **VA** | Visual Analysis | Visual design analysis |
| **CG** | Color Guard | Flag/equipment work |
| **B** | Brass | Brass section quality |
| **MA** | Music Analysis | Musical design analysis |
| **P** | Percussion | Drumline quality |

### Caption Selection Rules
- 25 historical corps to choose from per caption
- Each caption has a **point cost** (0-15 based on historical success)
- Point limits vary by competitive class
- Limited changes allowed as season progresses

---

## Competitive Classes (Progressive Unlocking)

| Class | Point Limit | Unlock Requirement |
|-------|-------------|-------------------|
| **SoundSport** | 90 points | Always available (starter) |
| **A Class** | 60 points | Level 3 OR 1,000 CorpsCoin |
| **Open Class** | 40 points | Level 5 OR 2,500 CorpsCoin |
| **World Class** | 40 points | Level 10 OR 5,000 CorpsCoin |

*Lower point limits = more strategic caption selection required*

---

## Scoring & Competition

### Live Season Scoring
- Real DCI show results update user fantasy scores
- User's corps score = Sum of their 8 captions' real scores
- Higher total = better placement
- Multiple shows per week

### League Scoring (NASCAR-Style Points)
| Placement | Points Earned |
|-----------|--------------|
| 1st | 15 |
| 2nd | 12 |
| 3rd | 10 |
| 4th-5th | 8, 6 |
| 6th-10th | 5, 4, 3, 2, 1 |

### Leaderboard Types
- **Overall** - Current season cumulative
- **Weekly** - Resets each week
- **Monthly** - Resets monthly
- **Lifetime** - All-time accumulated
- Separate leaderboards per class

---

## Execution System (Simulation Mechanics)

### Four Core Metrics (0-100%)

| Metric | Purpose | How It Changes |
|--------|---------|----------------|
| **Readiness** | Preparation level | +5% daily rehearsal, natural decay |
| **Morale** | Member satisfaction | Wellness checks, wins/losses |
| **Equipment** | Gear condition | Degrades with use, repair with coins |
| **Staff** | Assigned specialists | Purchase & assign for bonuses |

### Performance Multiplier Formula
```
Base = (Readiness × 0.4) + (Morale × 0.3) + (Equipment × 0.3)
Staff Bonus = min(staff_count × 1%, 5%)
Final Multiplier = 0.70 to 1.10 range
```
*Multiplier applies to all show scores*

### Daily Operations (Engagement Activities)
- Daily Rehearsal (+10 XP, main activity)
- Staff Check-in (morale boost)
- Wellness Check (morale maintenance)
- Equipment Inspection
- Sectional Rehearsal
- Show Review

---

## Economy System

### CorpsCoin - Primary Currency

**Earning Methods:**
| Action | Reward |
|--------|--------|
| Daily rehearsal | Bonus coins |
| Show performance (A Class) | 50 coins |
| Show performance (Open Class) | 100 coins |
| Show performance (World Class) | 200 coins |
| Login streak | Bonus coins |
| Challenge completion | Variable |

**Spending Paths:**
- Class unlocking (1,000-5,000 coins)
- Staff purchases (100-5,000 coins)
- Equipment repairs/upgrades
- Cosmetic customization

---

## Gamification Elements

### XP & Level Progression
- **Level Formula**: `Level = floor(totalXP / 1000) + 1`
- Level milestones unlock classes, mentor status, cosmetics

| Action | XP Earned |
|--------|-----------|
| Daily Rehearsal | +10 XP |
| Show Victories | Variable |
| Challenges | +50-100 XP |

### Battle Pass System
- **50 levels** per season
- **Two tracks**: Free (50% rewards) + Premium ($4.99)
- Rewards: Coins, staff, cosmetics, XP boosts, titles

### Achievement System (Tiered Rarity)

| Tier | Points | Examples |
|------|--------|----------|
| **Common** | 10 | First Corps, Rehearsal Rookie |
| **Rare** | 100 | Execution Master, Giant Slayer |
| **Epic** | 500 | Perfect Season, Triple Crown |
| **Legendary** | 2,500 | The GOAT (5 championships) |
| **Secret** | ??? | Hidden achievements |

---

## Page Architecture

### Primary Navigation

| Page | Purpose | Key UI Elements |
|------|---------|-----------------|
| **Dashboard** | Main hub | Corps status, execution metrics, quick actions, daily ops |
| **Schedule** | Show selection | Weekly calendar, show cards, difficulty ratings |
| **Scores** | Results & rankings | Real-time scores, leaderboards, standings tabs |
| **Leagues** | Multiplayer | League list, standings, chat, member management |
| **Profile** | Player stats | XP progress, achievements, season history, activity |
| **Battle Pass** | Rewards track | Free/premium lanes, level progress, claim buttons |

### Secondary Pages

| Page | Purpose |
|------|---------|
| **How to Play** | Rules, scoring guide, tips |
| **Hall of Champions** | Past season winners, podium display |
| **Settings** | Preferences, notifications, theme |
| **Retired Corps Gallery** | Historical user corps |
| **Admin** | Staff/admin management panel |

---

## Social Features

- **Leagues** - Private/public competitive groups
- **League Chat** - Real-time messaging
- **Rivalries** - Head-to-head history tracking
- **Mentorship** - Level 20+ can mentor new players
- **Comments** - React to performances
- **Leaderboard Visibility** - Public rankings

---

## User Roles & States

| Role | Access Level |
|------|-------------|
| **New Player** | SoundSport only |
| **Regular Player** | Full gameplay access |
| **League Leader** | Create/manage leagues |
| **Premium User** | Battle Pass benefits |
| **Mentor** | Level 20+, can guide new players |
| **Staff** | Support team access |
| **Admin** | Full backend control |

---

## Key Design Considerations

### Visual Hierarchy Needs
1. **Execution metrics** should be glanceable (4 gauges/bars)
2. **Leaderboard rankings** need clear 1st/2nd/3rd visual distinction
3. **Class progression** should show locked vs. unlocked states
4. **Caption selection** requires browsing 25 options × 8 categories
5. **Battle Pass** needs clear free vs. premium track distinction

### Mobile-First Priorities
1. Daily rehearsal button (primary CTA)
2. Current standings/rank
3. Upcoming shows
4. Quick navigation between Dashboard/Scores/Leagues

### Engagement Touchpoints
- Daily login bonus notification
- Rehearsal cooldown timer (23hr)
- Live score updates during DCI season
- Weekly challenge progress
- Battle Pass level-up celebrations

### Data-Heavy Views
- **Scores page**: Multiple tabs, real-time updates, filtering
- **Caption selection**: 200 options total, comparison tools needed
- **Leaderboards**: Pagination, class filtering, time period tabs
- **Profile stats**: Historical data, charts, achievements grid

---

## Technical Notes for Design

- **Frontend**: React 18, React Router, Zustand state management
- **Animations**: Framer Motion
- **Real-time**: Firebase/Firestore listeners for live updates
- **Theme**: Brutalist design system with dark/light modes
- **Typography**: Monospace aesthetic (marching arts style)

---

## Summary of Core Game Loops

```
┌─────────────────────────────────────────────────────┐
│                    DAILY (10-15 min)                │
│  Login → Bonus → Rehearsal → Challenges → Standings │
└─────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│                   WEEKLY (30-45 min)                │
│  Select Shows → Manage Metrics → Staff → Equipment  │
└─────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│                  SEASONAL (50 weeks)                │
│  Register → Build Corps → Compete → Finals → Win    │
└─────────────────────────────────────────────────────┘
```

---

*This document provides a comprehensive overview for understanding the user experience and game mechanics of marching.art. For specific component details or additional context, please refer to the codebase or ask for targeted exploration.*
