# marching.art Game Setup & Play Guide

## Quick Start for Admin

### Step 1: Access Admin Panel
1. Sign in with admin account (UID: `o8vfRCOevjTKBY0k2dISlpiYiIH2`)
2. Navigate to **Admin Panel** in the sidebar (Shield icon)
3. You'll see the admin panel with season controls

### Step 2: Initialize a Season
You have two season types:

#### Option A: Start Off-Season
- Click **"Start Off-Season"** button
- This creates a new off-season (director simulation mode)
- Players can register corps and build lineups
- Runs for 7-week periods between live seasons

#### Option B: Start Live Season
- Click **"Start Live Season"** button
- This starts the live DCI season tracking
- Real scores from shows are processed
- Runs for 10 weeks during actual DCI season

**Choose based on the current time of year:**
- June-August: Live Season
- September-May: Off-Season

### Step 3: Players Can Now Play!

## How Players Play the Game

### For New Players

#### 1. Register a Corps
1. Go to **Dashboard**
2. Click **"Register Corps"** button
3. Fill in:
   - **Corps Name** (max 50 characters)
   - **Home Location** (e.g., "Boston, MA")
   - **Show Concept** (your creative vision, max 500 characters)
   - **Competition Class** (select based on your unlocked classes)
4. Click **"Register Corps"**

**Available Classes:**
- **SoundSport** - Unlocked by default, entry level (90 point cap)
- **A Class** - Requires Level 3 (60 point cap)
- **Open Class** - Requires Level 5 (120 point cap)
- **World Class** - Requires Level 10 (150 point cap)

#### 2. Build Your Caption Lineup
1. Click **"Edit Lineup"** or **"Select Captions"**
2. Choose 8 captions (one for each category):
   - **GE1** - General Effect 1
   - **GE2** - General Effect 2
   - **VP** - Visual Proficiency
   - **VA** - Visual Analysis
   - **CG** - Color Guard
   - **B** - Brass
   - **MA** - Music Analysis
   - **P** - Percussion

3. Each selection is formatted as: `"Corps Name Year | Points"`
4. Your total points must not exceed your class's point cap
5. Click **"Save Lineup"**

**Trade Limits:**
- **First week** of any season: Unlimited trades
- **Weeks 1-3** of live season: Unlimited trades
- **After that**: 3 trades per week

#### 3. Select Shows (Live Season Only)
- Each week, select up to 4 shows to attend
- Your corps earns points based on the captions you selected
- Shows run on actual DCI schedule

## Backend Functions Reference

### For Players

#### `registerCorps`
Registers a new corps in a specific class.

```javascript
// Called automatically when using the Register Corps form
registerCorps({
  corpsName: "Blue Knights",
  location: "Denver, CO",
  showConcept: "A journey through time...",
  class: "worldClass"
})
```

**Validations:**
- ✓ Name max 50 chars
- ✓ Location max 50 chars
- ✓ Show concept max 500 chars
- ✓ No profanity
- ✓ Must have unlocked the class
- ✓ Can't register multiple corps in same class

#### `saveLineup`
Saves your 8-caption lineup with point cap validation.

```javascript
// Called when saving caption lineup
saveLineup({
  lineup: {
    GE1: "Blue Devils 2014 | 19.85",
    GE2: "Carolina Crown 2013 | 19.75",
    // ... 6 more captions
  },
  corpsClass: "worldClass"
})
```

**Validations:**
- ✓ Exactly 8 captions required
- ✓ Points must not exceed class cap
- ✓ Lineup must be unique
- ✓ Trade limits enforced
- ✓ Must have registered corps first

#### `selectUserShows`
Choose shows to attend for the week (live season).

```javascript
selectUserShows({
  week: 1,
  corpsClass: "worldClass",
  shows: [
    { eventName: "DCI San Antonio", date: "2025-06-28" },
    // ... up to 3 more shows
  ]
})
```

### For Admins Only

#### `startNewOffSeason`
Initialize a new off-season period.

```javascript
startNewOffSeason()
```

**What it does:**
- Creates new season document in Firestore
- Sets up 7-week off-season schedule
- Initializes scoring framework
- Resets player progress for new season

#### `startNewLiveSeason`
Start the live DCI season tracking.

```javascript
startNewLiveSeason()
```

**What it does:**
- Transitions from off-season to live
- Sets up 10-week live schedule
- Enables real-time score processing
- Activates weekly matchups

#### `manualTrigger`
Run backend maintenance jobs manually.

```javascript
// Calculate all corps statistics
manualTrigger({ jobName: 'calculateCorpsStatistics' })

// Archive current season
manualTrigger({ jobName: 'archiveSeasonResults' })

// Process off-season scores
manualTrigger({ jobName: 'processAndArchiveOffSeasonScores' })
```

## Automatic Backend Processing

These functions run automatically on schedule:

### Daily Jobs
- **`seasonScheduler`** - Advances season day, processes transitions
- **`dailyOffSeasonProcessor`** - Scores off-season shows
- **`processDailyLiveScores`** - Fetches and processes live DCI scores

### Weekly Jobs
- **`generateWeeklyMatchups`** - Creates league head-to-head matchups

### Triggered Jobs
- **`processDciScores`** - Triggered when new scores added to Firestore
- **`processLiveScoreRecap`** - Generates score recaps and updates rankings

## Game Flow

### Off-Season Flow
1. Admin starts off-season
2. Players register corps
3. Players build lineups
4. Weekly simulated shows run automatically
5. Scores calculated based on lineup selections
6. 7 weeks complete, prepare for live season

### Live Season Flow
1. Admin starts live season
2. Players finalize lineups (3 weeks unlimited trades)
3. Players select shows each week (up to 4)
4. Real DCI scores fetched daily
5. Player scores calculated from their caption selections
6. Weekly league matchups
7. Championships at season end

## Scoring System

### How Player Scores are Calculated

Your score for a show is the **sum of your 8 caption scores** based on the actual performances at that show.

**Example:**
- You selected: `"Blue Devils 2014 | 19.85"` for GE1
- At the show, Blue Devils scored 19.85 in GE1
- You earn 19.85 points for that caption

Your total show score = sum of all 8 caption scores

### Rankings
- Updated after each scored show
- Based on total season score
- Separate rankings per class
- League standings track head-to-head

## Point Caps by Class

| Class | Point Cap | Difficulty |
|-------|-----------|------------|
| SoundSport | 90 | Beginner |
| A Class | 60 | Intermediate |
| Open Class | 120 | Advanced |
| World Class | 150 | Elite |

Lower caps = harder strategy (must choose carefully)
Higher caps = more flexibility (can pick more top performers)

## Leveling Up

Players earn XP and unlock new classes:
- **Level 1**: SoundSport unlocked
- **Level 3**: A Class unlocked
- **Level 5**: Open Class unlocked
- **Level 10**: World Class unlocked

XP earned through:
- Completing seasons
- Achieving high rankings
- Winning championships
- League victories

## Troubleshooting

### "Invalid collection reference" error
- **Fix**: dataNamespace set to 'marching-art' in src/firebase.js ✓

### "Missing or insufficient permissions"
- **Fix**: Firestore rules updated for subcollections ✓

### "This lineup exceeds point limit"
- **Solution**: Remove some high-point captions, stay under your class cap

### "This exact lineup has already been claimed"
- **Solution**: Change at least one caption selection to make it unique

### "Exceeds trade limit"
- **Solution**: Wait until next week or live with current lineup

### "You have not unlocked this class"
- **Solution**: Play more, level up, unlock higher classes

## Admin Maintenance

### Weekly Tasks
- Monitor season progression
- Check for any stuck jobs
- Review player feedback
- Verify score processing

### Season Transitions
- Archive previous season before starting new
- Announce season changes to players
- Give players time to adjust lineups

### Data Management
- Use "Archive Season Results" before starting new season
- Use "Calculate Corps Statistics" if rankings seem off
- Use "Process Off-Season Scores" if scores didn't update

## API Endpoints for Reference

All callable functions require authentication:
- `functions.httpsCallable('registerCorps')`
- `functions.httpsCallable('saveLineup')`
- `functions.httpsCallable('selectUserShows')`
- `functions.httpsCallable('startNewOffSeason')` - Admin only
- `functions.httpsCallable('startNewLiveSeason')` - Admin only
- `functions.httpsCallable('manualTrigger')` - Admin only

## Support

For issues or questions:
1. Check INTEGRATION_GUIDE.md for technical details
2. Review Firestore console for data issues
3. Check Firebase Functions logs for errors
4. File issues at: https://github.com/marching-art/marching.art/issues

---

**Game is fully operational and ready to play!** 🎺🏆

Last Updated: 2025-11-14
