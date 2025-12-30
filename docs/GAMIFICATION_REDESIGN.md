# Gamification System Redesign
## From Good to World-Class

---

## Current State Analysis

### Streak System
**Location:** `useEngagement.ts`, `dailyOps.js`

**Current Visibility:**
| Location | Display | Visibility |
|----------|---------|-----------|
| Morning Report | Small text under greeting | Low (modal, easy to dismiss) |
| Profile Page | Stat card in grid | Medium (requires navigation) |
| Dashboard | Not shown | None |
| Header/Nav | Not shown | None |

**Problem:** Users can play for weeks without noticing their streak. No urgency, no celebration, no risk awareness.

---

### Morning Report Evaluation

**Current Implementation:**
```
- Time-based greeting (Good Morning/Afternoon/Evening)
- User's first name
- Tiny streak display (if > 1)
- Corps card with season score
- "Let's Go!" button
```

**Verdict: REMOVE IT**

**Reasons:**
1. **No actionable information** - Just says "hello" and shows data available elsewhere
2. **Modal friction** - Blocks user from app until dismissed
3. **Competes with other modals** - Can stack with onboarding, achievements
4. **Streak display is buried** - Tiny text, easily missed
5. **No urgency or motivation** - Doesn't inspire action

**Recommendation:** Kill the Morning Report modal. Replace with a persistent streak/progress bar in the header that's always visible.

---

### XP vs CorpsCoin Analysis

#### XP Configuration
```javascript
XP_CONFIG = {
  xpPerLevel: 1000,
  classUnlocks: {
    aClass: 3,    // 3,000 XP (Level 3)
    open: 5,      // 5,000 XP (Level 5)
    world: 10     // 10,000 XP (Level 10)
  }
}

XP_SOURCES = {
  weeklyParticipation: 100,  // Per week
  leagueWin: 50,             // Per matchup win
  seasonCompletion: {
    top10: 500,
    top25: 400,
    top50: 300,
    completed: 200
  }
}
```

#### CorpsCoin Configuration
```javascript
CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000
}

EARNING = {
  showParticipation: 50-200 CC (by class)
  leagueWin: 100 CC
  seasonFinish: 250-1000 CC (by rank)
}
```

---

### Time-to-Unlock Calculations

#### Active Player Profile
- Plays every week
- Participates in 2 shows/week
- Wins 50% of league matchups
- Finishes top 25 in season

#### XP Route to World Class

| Timeframe | XP Earned | Calculation |
|-----------|-----------|-------------|
| Per Week | 125 XP | 100 (participation) + 25 (0.5 league wins × 50) |
| Per Season (10 weeks) | 1,650 XP | 1,250 (weekly) + 400 (top 25 bonus) |
| Per Year (2 seasons) | 3,300 XP | 1,650 × 2 |

**Time to Level 10 (10,000 XP): ~3 years** ❌ Too slow!

#### CorpsCoin Route to World Class

| Timeframe | CC Earned | Calculation |
|-----------|-----------|-------------|
| Per Week | 250 CC | 200 (2 shows × 100) + 50 (0.5 league wins × 100) |
| Per Season | 2,900 CC | 2,500 (weekly) + 400 (top 25 bonus) |

**Time to 5,000 CC (skip to World): ~20 weeks = 5 months** ✓
**Time to 8,500 CC (all classes): ~34 weeks = 8.5 months** ✓

---

### Key Finding: XP is Broken

The XP unlock path is **unreasonably slow** compared to CorpsCoin:
- **XP to World Class**: ~3 years
- **CC to World Class**: ~5 months

**The "Skip to World" strategy is already the optimal path** — users should save CC and skip A/Open classes entirely.

---

## Recommendations

### 1. Rebalance XP Earning (Must Fix)

**Current Problem:** 100 XP/week is too slow. Users need ~100 weeks to reach Level 10.

**Proposed Changes:**
```javascript
XP_SOURCES = {
  // Increase weekly participation
  weeklyParticipation: 200,  // Was 100

  // Add daily login bonus
  dailyLogin: 25,            // NEW: 175/week if consistent

  // Increase league rewards
  leagueWin: 100,            // Was 50

  // Add streak bonuses
  streakMilestone: {
    7: 100,     // Week streak
    14: 250,    // 2-week streak
    30: 500,    // Month streak
  },

  // Keep season rewards
  seasonCompletion: {
    top10: 500,
    top25: 400,
    top50: 300,
    completed: 200
  }
}
```

**New Active Player Earnings:**
| Timeframe | XP Earned | Calculation |
|-----------|-----------|-------------|
| Per Week | 475 XP | 200 + 175 (daily) + 100 (league) |
| Per Season | 5,450 XP | 4,750 (weekly) + 300 (7-day streak × 3) + 400 (season) |

**New Time to Level 10: ~18 weeks = 4.5 months** ✓ (now competitive with CC)

---

### 2. Make Both Currencies Feel Valuable

**The Core Tension:**
- **XP** = Time investment (can't be spent, just accumulates)
- **CorpsCoin** = Spendable resource (creates decisions)

**Problem:** Neither feels valuable because they're invisible during gameplay.

**Solutions:**

#### A. Persistent Header Display
Add to the header/nav:
```
🔥 14 | ⭐ 2,450 XP (Lvl 3) | 💰 1,250 CC
```

#### B. Animate Currency Gains
When XP or CC is earned, show floating "+100 XP" animation that flies to header.

#### C. Show Progress Context
```
⭐ 2,450 / 3,000 XP → A Class
💰 1,250 CC (World Class: 5,000 CC)
```

---

### 3. Make Streak the Hero

**Current:** Tiny text in Morning Report
**Target:** Prominent, always-visible, anxiety-inducing

**Implementation:**

#### A. Streak Bar in Header
```
┌─────────────────────────────────────────┐
│ 🔥 14 DAY STREAK                        │
│ ████████████████████░░░░ 14/30 → Epic   │
└─────────────────────────────────────────┘
```

#### B. Streak States
| Days | Tier | Visual | Reward |
|------|------|--------|--------|
| 1-2 | Starting | Gray flame | — |
| 3-6 | Building | Orange flame | 50 CC at Day 3 |
| 7-13 | Hot | Orange + pulse | 100 CC + 100 XP at Day 7 |
| 14-29 | Fire | Red + glow | 200 CC + 250 XP at Day 14 |
| 30+ | Inferno | Gold + particles | 500 CC + 500 XP at Day 30 |

#### C. Streak Protection
**New Feature: Streak Freeze**
- Cost: 300 CC
- Effect: Protects streak for 24 hours of inactivity
- Limit: 1 freeze per 7 days
- Creates CC sink and decision tension

---

### 4. Create the "Save for World" Decision

**Current State:** Users can unlock classes with XP OR CC, but the tradeoff isn't clear.

**Make it Explicit:**

#### Unlock Modal Redesign
```
┌─────────────────────────────────────────┐
│           UNLOCK A CLASS                │
├─────────────────────────────────────────┤
│                                         │
│  Option 1: XP (FREE)                    │
│  ████████░░░░░░░░ 2,450 / 3,000 XP      │
│  ~2 weeks away                          │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Option 2: CorpsCoin (NOW)              │
│  💰 1,000 CC                            │
│  You have: 1,250 CC                     │
│  [Unlock Now]                           │
│                                         │
├─────────────────────────────────────────┤
│  💡 Pro Tip: Save your CC for World    │
│  Class (5,000 CC) and let XP handle    │
│  the earlier unlocks!                   │
└─────────────────────────────────────────┘
```

---

### 5. Daily Engagement Improvements

**Kill Morning Report. Add These Instead:**

#### A. Daily Login Bonus
- First login each day: +25 XP
- 7th consecutive day: +100 XP + 50 CC bonus
- Creates daily ritual without modal interruption

#### B. Streak Milestone Celebrations
- At 3/7/14/30 days: Achievement modal with reward
- At 30+: Show "🔥 INFERNO MODE" badge on profile

#### C. "At Risk" Warning
If user hasn't logged in and it's 6 PM local time:
```
⚠️ Your 14-day streak ends in 6 hours!
[Use Streak Freeze: 300 CC]
```
(Future: Push notification for this)

---

## Implementation Plan

### Phase 1: Streak Visibility (This PR)
1. ✅ Kill Morning Report modal
2. ✅ Add StreakBar component to header
3. ✅ Add streak milestones with rewards
4. ✅ Add Streak Freeze feature

### Phase 2: Currency Visibility (This PR)
1. ✅ Add XP/CC display to header
2. ✅ Add progress bar to next unlock
3. ✅ Add currency gain animations

### Phase 3: Rebalance (This PR)
1. ✅ Increase XP earning rates
2. ✅ Add daily login XP
3. ✅ Add streak milestone bonuses

### Phase 4: Decision Clarity (This PR)
1. ✅ Redesign class unlock modal
2. ✅ Show XP vs CC tradeoff clearly
3. ✅ Add "Save for World" tip

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Average streak length | ~3 days | ~10 days |
| 7-day retention | ~40% | ~60% |
| Daily active users | — | +30% |
| Time to World Class (XP) | ~3 years | ~4 months |
| Streak Freeze purchases | N/A | 5% of active users |

---

## Files to Modify

1. `src/components/Dashboard/MorningReport.jsx` → DELETE
2. `src/components/Layout/GameShell.jsx` → Add StreakBar
3. `src/components/StreakBar.tsx` → NEW
4. `src/components/CurrencyDisplay.tsx` → NEW
5. `src/hooks/useEngagement.ts` → Add milestone rewards
6. `functions/src/callable/dailyOps.js` → Add daily XP, streak freeze
7. `functions/src/callable/economy.js` → Add streak freeze purchase
8. `functions/src/helpers/xpCalculations.js` → Rebalance rates
9. `src/components/modals/ClassUnlockModal.jsx` → Redesign
