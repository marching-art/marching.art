# 🎺 MARCHING.ART: EPIC DIRECTOR SIM REBUILD PLAN

## Core Philosophy: **Real DCI Scores × Strategic Gameplay**

```
Your Final Score = Historical DCI Caption Score × Execution Multiplier
                   \________________________/   \___________________/
                        Sacred Foundation           Your Skill
                        (From Database)            (0.70 - 1.10)
```

---

## 📊 What We Have (Database Analysis)

### Historical Scores Structure
```javascript
historical_scores/2024 = {
  data: [
    {
      eventName: "DCI World Championship Finals",
      date: "2024-08-10",
      location: "Indianapolis, IN",
      offSeasonDay: 49,  // Key for season progression!
      scores: [
        {
          corps: "Bluecoats",
          score: 98.75,
          captions: {
            GE1: 19.9,   // ← These are our base scores
            GE2: 19.75,
            VP: 19.8,
            VA: 20.0,
            CG: 19.5,
            B: 19.6,     // ← Real 2024 Bluecoats brass score
            MA: 19.85,
            P: 19.45
          }
        }
      ]
    }
  ]
}
```

### Current User Lineup
```javascript
corps: {
  worldClass: {
    corpsName: "Sacramento Corps",
    lineup: {
      B: "Bluecoats|25|2024",   // Selected 2024 Bluecoats brass
      GE1: "Carolina Crown|22|2019",
      // ... 8 captions total
    }
  }
}
```

### Current Scoring Logic (scoring.js:289)
```javascript
// CURRENT: Returns raw historical score
const captionScore = getRealisticCaptionScore(
  corpsName,      // "Bluecoats"
  sourceYear,     // "2024"
  caption,        // "B" (Brass)
  scoredDay,      // 28 (Regional Championship)
  historicalData  // { 2024: [...events] }
);
// Returns: 19.3 (actual Bluecoats brass score on day 28)
```

---

## 🎮 What We'll Add: The Execution Layer

### Phase 1: Core Execution System (Week 1-2)

#### 1.1 New Database Schema
```javascript
// Add to: artifacts/marching-art/users/{uid}/profile/data
{
  corps: {
    worldClass: {
      // ... existing fields (corpsName, lineup, etc.) ...

      // NEW: Execution State
      execution: {
        // Section readiness (0.0 - 1.0)
        readiness: {
          brass: 0.85,      // 85% prepared
          percussion: 0.92,
          guard: 0.78,
          ensemble: 0.88    // Overall cohesion
        },

        // Section morale (0.0 - 1.0)
        morale: {
          brass: 0.90,
          percussion: 0.75,
          guard: 0.88,
          overall: 0.84
        },

        // Equipment condition (0.0 - 1.0)
        equipment: {
          instruments: 0.88,
          uniforms: 0.95,
          props: 0.82,
          bus: 0.70,
          truck: 0.85
        },

        // Show design metadata
        showDesign: {
          difficulty: 8.5,              // 1-10 scale
          preparednessThreshold: 0.85,  // Required readiness
          ceilingBonus: 0.12,           // Max bonus if well-prepared
          riskPenalty: -0.15            // Penalty if under-prepared
        },

        // Last rehearsal tracking
        lastRehearsalDay: 27,
        rehearsalStreak: 5,

        // Performance history
        performanceHistory: [
          {
            day: 28,
            event: "Southwestern Championship",
            executionMultiplier: 0.94,
            breakdown: {
              readiness: 0.03,
              staff: 0.05,
              equipment: -0.02,
              morale: 0.02,
              showDifficulty: -0.08,
              randomVariance: -0.01
            }
          }
        ]
      }
    }
  }
}
```

#### 1.2 Modified Scoring Function
```javascript
// functions/src/helpers/scoring.js

// NEW FUNCTION: Calculate execution multiplier
async function calculateExecutionMultiplier(uid, corpsClass, caption, scoredDay, eventName) {
  const db = getDb();
  const userDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get();
  const execution = userDoc.data()?.corps?.[corpsClass]?.execution;

  if (!execution) {
    // No execution data = default to 0.90 (slight penalty for not engaging)
    return 0.90;
  }

  let multiplier = 1.00;  // Base: 100% of historical score
  const breakdown = {};

  // FACTOR 1: Section Readiness (±12%)
  const sectionMap = {
    B: 'brass', MA: 'brass',
    P: 'percussion',
    VP: 'guard', VA: 'guard', CG: 'guard',
    GE1: 'ensemble', GE2: 'ensemble'
  };
  const section = sectionMap[caption];
  const readiness = execution.readiness[section] || 0.80;
  const readinessBonus = (readiness - 0.80) * 0.60;  // Range: -0.12 to +0.12
  multiplier += readinessBonus;
  breakdown.readiness = readinessBonus;

  // FACTOR 2: Staff Effectiveness (±8%)
  const staffEffectiveness = await getStaffEffectiveness(uid, corpsClass, caption);
  const staffBonus = (staffEffectiveness - 0.80) * 0.40;  // Range: -0.08 to +0.08
  multiplier += staffBonus;
  breakdown.staff = staffBonus;

  // FACTOR 3: Equipment Condition (±5%)
  const equipmentMap = {
    B: 'instruments', MA: 'instruments',
    P: 'instruments',
    VP: 'uniforms', VA: 'uniforms', CG: 'uniforms'
  };
  const equipmentType = equipmentMap[caption] || 'instruments';
  const equipmentHealth = execution.equipment[equipmentType] || 0.90;
  const equipmentPenalty = (equipmentHealth - 1.00) * 0.50;  // Range: -0.05 to 0
  multiplier += equipmentPenalty;
  breakdown.equipment = equipmentPenalty;

  // Bus/Truck affects morale (indirect effect)
  const travelHealth = (execution.equipment.bus + execution.equipment.truck) / 2;
  if (travelHealth < 0.70) {
    breakdown.equipment -= 0.02;  // Extra penalty for poor travel conditions
    multiplier -= 0.02;
  }

  // FACTOR 4: Section Morale (±8%)
  const morale = execution.morale[section] || 0.75;
  const moraleBonus = (morale - 0.75) * 0.32;  // Range: -0.08 to +0.08
  multiplier += moraleBonus;
  breakdown.morale = moraleBonus;

  // FACTOR 5: Show Difficulty Risk/Reward (±15%)
  const avgReadiness = Object.values(execution.readiness).reduce((a,b) => a+b, 0) / 4;
  if (avgReadiness >= execution.showDesign.preparednessThreshold) {
    // Well-prepared: Get bonus!
    multiplier += execution.showDesign.ceilingBonus;
    breakdown.showDifficulty = execution.showDesign.ceilingBonus;
  } else {
    // Under-prepared: Take penalty
    multiplier += execution.showDesign.riskPenalty;
    breakdown.showDifficulty = execution.showDesign.riskPenalty;
  }

  // FACTOR 6: Random Variance (±2%)
  // Represents day-to-day unpredictability
  const variance = (Math.random() - 0.5) * 0.04;
  multiplier += variance;
  breakdown.randomVariance = variance;

  // FACTOR 7: Championship Pressure (Finals only)
  if (scoredDay >= 47 && scoredDay <= 49) {
    const pressureHandling = execution.morale.overall || 0.80;
    const pressureEffect = (pressureHandling - 0.80) * 0.10;  // ±2% in finals
    multiplier += pressureEffect;
    breakdown.championshipPressure = pressureEffect;
  }

  // Clamp to realistic bounds
  multiplier = Math.max(0.70, Math.min(1.10, multiplier));

  // Store breakdown in performance history
  await updatePerformanceHistory(uid, corpsClass, scoredDay, eventName, multiplier, breakdown);

  return multiplier;
}

// Helper: Get staff effectiveness for a caption
async function getStaffEffectiveness(uid, corpsClass, caption) {
  const db = getDb();
  const userDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get();
  const staff = userDoc.data()?.staff || [];

  // Find assigned staff for this caption
  const assignedStaff = staff.find(s =>
    s.assignedTo?.corpsClass === corpsClass &&
    s.assignedTo?.caption === caption
  );

  if (!assignedStaff) {
    return 0.75;  // No staff = below average
  }

  // Calculate effectiveness based on staff attributes
  const staffDoc = await db.doc(`staff_database/${assignedStaff.staffId}`).get();
  const staffData = staffDoc.data();

  let effectiveness = 0.80;  // Base

  // Caption match bonus
  if (staffData.caption === caption) {
    effectiveness += 0.15;  // Perfect match
  }

  // Experience bonus (from seasons completed)
  const experienceBonus = Math.min(assignedStaff.seasonsCompleted * 0.01, 0.10);
  effectiveness += experienceBonus;

  // Hall of Fame bonus (if baseValue is high)
  if (staffData.baseValue > 500) {
    effectiveness += 0.05;  // Elite staff
  }

  return Math.min(effectiveness, 1.00);
}

// UPDATE MAIN SCORING FUNCTION (Line 289)
async function processAndArchiveOffSeasonScoresLogic() {
  // ... existing code ...

  for (const caption in corps.lineup) {
    const [corpsName, , year] = corps.lineup[caption].split("|");

    // Get historical base score
    const historicalScore = getRealisticCaptionScore(
      corpsName, year, caption, scoredDay, historicalData
    );

    // NEW: Calculate execution multiplier
    const executionMultiplier = await calculateExecutionMultiplier(
      uid, corpsClass, caption, scoredDay, show.eventName
    );

    // Apply execution to historical score
    const captionScore = historicalScore * executionMultiplier;

    // Continue with existing scoring logic...
    if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
    // ... etc ...
  }

  // ... rest of existing code ...
}
```

---

### Phase 2: Rehearsal System (Week 2-3)

#### 2.1 Daily Rehearsal Function
```javascript
// functions/src/callable/rehearsal.js

exports.dailyRehearsal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { corpsClass, focusCaption, intensity } = data;
  // focusCaption: 'brass' | 'percussion' | 'guard' | 'ensemble'
  // intensity: 'light' | 'moderate' | 'intense'

  const uid = context.auth.uid;
  const db = getDb();
  const userRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const execution = userDoc.data().corps[corpsClass].execution;

    // Calculate readiness improvement
    const intensityMultiplier = { light: 0.02, moderate: 0.04, intense: 0.06 };
    const improvement = intensityMultiplier[intensity];

    // Update readiness
    const newReadiness = Math.min(
      (execution.readiness[focusCaption] || 0.70) + improvement,
      1.00
    );

    // Calculate morale impact
    const moraleChange = {
      light: 0.01,      // Light rehearsal boosts morale
      moderate: 0.00,   // Moderate is neutral
      intense: -0.02    // Intense rehearsal tires them out
    };
    const newMorale = Math.max(
      (execution.morale[focusCaption] || 0.75) + moraleChange[intensity],
      0.50
    );

    // Degrade equipment slightly from use
    const equipmentWear = { light: 0.01, moderate: 0.02, intense: 0.03 };
    const newInstrumentHealth = Math.max(
      (execution.equipment.instruments || 0.90) - equipmentWear[intensity],
      0.50
    );

    // Update database
    transaction.update(userRef, {
      [`corps.${corpsClass}.execution.readiness.${focusCaption}`]: newReadiness,
      [`corps.${corpsClass}.execution.morale.${focusCaption}`]: newMorale,
      [`corps.${corpsClass}.execution.equipment.instruments`]: newInstrumentHealth,
      [`corps.${corpsClass}.execution.lastRehearsalDay`]: getCurrentSeasonDay(),
      [`corps.${corpsClass}.execution.rehearsalStreak`]: admin.firestore.FieldValue.increment(1)
    });

    // Award XP for rehearsal
    transaction.update(userRef, {
      xp: admin.firestore.FieldValue.increment(5)
    });

    return {
      success: true,
      readinessGain: improvement,
      newReadiness: newReadiness,
      moraleChange: moraleChange[intensity],
      message: `${focusCaption} rehearsal complete! Readiness: ${(newReadiness * 100).toFixed(0)}%`
    };
  });
});

// Helper: Get current season day
function getCurrentSeasonDay() {
  const db = getDb();
  const seasonDoc = await db.doc('game-settings/season').get();
  const startDate = seasonDoc.data().schedule.startDate.toDate();
  const now = new Date();
  const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(49, diffDays + 1));
}
```

#### 2.2 Equipment Management
```javascript
// functions/src/callable/equipment.js

exports.repairEquipment = functions.https.onCall(async (data, context) => {
  const { corpsClass, equipmentType } = data;
  // equipmentType: 'instruments' | 'uniforms' | 'props' | 'bus' | 'truck'

  const costs = {
    instruments: 200,
    uniforms: 300,
    props: 150,
    bus: 500,
    truck: 400
  };

  const cost = costs[equipmentType];
  const uid = context.auth.uid;
  const db = getDb();
  const userRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const corpsCoin = userDoc.data().corpsCoin || 0;

    if (corpsCoin < cost) {
      throw new functions.https.HttpsError('failed-precondition',
        `Not enough CorpsCoin. Need ${cost}, have ${corpsCoin}`);
    }

    // Deduct coins and repair equipment
    transaction.update(userRef, {
      corpsCoin: admin.firestore.FieldValue.increment(-cost),
      [`corps.${corpsClass}.execution.equipment.${equipmentType}`]: 1.00
    });

    // Morale boost from new equipment
    if (equipmentType === 'bus' || equipmentType === 'truck') {
      transaction.update(userRef, {
        [`corps.${corpsClass}.execution.morale.overall`]:
          admin.firestore.FieldValue.increment(0.05)
      });
    }

    return { success: true, newBalance: corpsCoin - cost };
  });
});

exports.upgradeEquipment = functions.https.onCall(async (data, context) => {
  const { corpsClass, upgradeType } = data;
  // upgradeType: 'new_uniforms' | 'elite_instruments' | 'luxury_bus'

  const upgrades = {
    new_uniforms: {
      cost: 1000,
      effect: { uniforms: 1.00, morale: { guard: 0.10, overall: 0.05 } }
    },
    elite_instruments: {
      cost: 1500,
      effect: { instruments: 1.00, readiness: { brass: 0.05, percussion: 0.05 } }
    },
    luxury_bus: {
      cost: 2000,
      effect: { bus: 1.00, morale: { overall: 0.15 } }
    }
  };

  // Implementation similar to repair...
});
```

---

### Phase 3: Frontend Dashboard (Week 3-4)

#### 3.1 Execution Dashboard Component
```jsx
// src/pages/Dashboard.jsx

import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { motion } from 'framer-motion';

function ExecutionDashboard({ corpsClass }) {
  const { userProfile } = useUserStore();
  const execution = userProfile?.corps?.[corpsClass]?.execution;

  if (!execution) return null;

  return (
    <div className="bg-charcoal-800 rounded-xl p-6 border border-gold-500/20">
      <h2 className="text-2xl font-bold text-cream mb-4">Corps Status</h2>

      {/* Section Readiness */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-cream mb-3">Section Readiness</h3>
        <div className="space-y-3">
          {Object.entries(execution.readiness).map(([section, value]) => (
            <div key={section}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-cream capitalize">{section}</span>
                <span className="text-gold-500">{(value * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-charcoal-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-500 to-gold-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${value * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Morale */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-cream mb-3">Section Morale</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(execution.morale).map(([section, value]) => (
            <div key={section} className="bg-charcoal-700 rounded-lg p-3">
              <div className="text-xs text-cream/60 capitalize">{section}</div>
              <div className={`text-xl font-bold ${getMoraleColor(value)}`}>
                {getMoraleLabel(value)}
              </div>
              <div className="text-sm text-cream/80">{(value * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment Health */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-cream mb-3">Equipment Status</h3>
        <div className="space-y-2">
          {Object.entries(execution.equipment).map(([item, health]) => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-cream capitalize">{item}</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getHealthColor(health)}`} />
                <span className="text-sm text-cream/80">{(health * 100).toFixed(0)}%</span>
                {health < 0.80 && (
                  <button
                    onClick={() => repairEquipment(item)}
                    className="text-xs px-2 py-1 bg-gold-500 text-charcoal rounded hover:bg-gold-400"
                  >
                    Repair
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rehearsal Actions */}
      <div>
        <h3 className="text-lg font-semibold text-cream mb-3">Daily Rehearsal</h3>
        <div className="grid grid-cols-2 gap-3">
          {['brass', 'percussion', 'guard', 'ensemble'].map(section => (
            <button
              key={section}
              onClick={() => rehearse(section)}
              className="bg-gold-500 hover:bg-gold-400 text-charcoal font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Rehearse {section}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getMoraleColor(value) {
  if (value >= 0.85) return 'text-green-400';
  if (value >= 0.70) return 'text-yellow-400';
  return 'text-red-400';
}

function getMoraleLabel(value) {
  if (value >= 0.90) return 'Excellent';
  if (value >= 0.80) return 'Good';
  if (value >= 0.70) return 'Fair';
  return 'Low';
}

function getHealthColor(value) {
  if (value >= 0.90) return 'bg-green-400';
  if (value >= 0.75) return 'bg-yellow-400';
  if (value >= 0.60) return 'bg-orange-400';
  return 'bg-red-400';
}
```

---

## 📅 Implementation Timeline

### Week 1: Core Execution System
- [ ] Add execution schema to user profiles
- [ ] Implement `calculateExecutionMultiplier()` function
- [ ] Integrate multiplier into scoring system
- [ ] Test with sample user data

### Week 2: Rehearsal & Preparation
- [ ] Create `dailyRehearsal` Cloud Function
- [ ] Create `repairEquipment` / `upgradeEquipment` functions
- [ ] Add rehearsal tracking to user profiles
- [ ] Implement equipment degradation system

### Week 3: Frontend Dashboard
- [ ] Build ExecutionDashboard component
- [ ] Add readiness/morale/equipment displays
- [ ] Create rehearsal action buttons
- [ ] Add equipment repair UI

### Week 4: Performance Day Experience
- [ ] Create performance recap with execution breakdown
- [ ] Add animated score reveal
- [ ] Show execution multiplier effects
- [ ] Display "what if" scenarios

### Week 5: Polish & Balance
- [ ] Tune execution multiplier ranges
- [ ] Balance rehearsal effectiveness
- [ ] Adjust CorpsCoin economy for equipment costs
- [ ] Add tutorial for new players

---

## 🎯 Success Metrics

**Engagement:**
- Daily active rehearsals: 60%+ of active users
- Equipment maintenance: 40%+ using repair system
- Execution variance: 0.85-1.05 average range

**Balance:**
- Top 10% players: 1.00-1.08 execution
- Average players: 0.90-0.98 execution
- Casual players: 0.85-0.95 execution

**Retention:**
- 7-day retention: 70%+ (from 50%)
- Season completion: 85%+ (from 60%)
- Repeat seasons: 90%+ (from 70%)

---

## 💡 Why This Works

1. **Preserves DCI Score Integrity**
   - Historical scores remain the foundation
   - Execution multiplier adds strategic layer
   - Real scores always visible in breakdown

2. **Creates Meaningful Decisions**
   - Rehearsal focus matters (can't max everything)
   - Equipment/budget tradeoffs
   - Risk/reward with show difficulty

3. **Adds Replayability**
   - Different staff combinations
   - Various rehearsal strategies
   - Show difficulty experimentation

4. **Maintains Competitive Fairness**
   - Everyone starts at 1.00 base
   - Skill creates advantage, not RNG
   - Leaderboards reward preparation

5. **Deepens Emotional Investment**
   - Your corps feels unique
   - Progress through season is visible
   - Victories feel earned

---

## 🚀 Ready to Build?

This plan maintains everything you've built while adding the epic simulation layer on top. Real DCI scores stay sacred, but player skill and strategic decisions create the variance that makes each season unique.

**Want me to start implementing Phase 1?**
