# Schedule System Documentation

## Overview

The game's schedule system creates realistic drum corps competition schedules based on historical DCI show data stored in Firestore.

## Data Flow

### 1. Historical Data Storage

**Collection:** `historical_scores`

Each document represents a year and contains:
```javascript
{
  data: [
    {
      eventName: "DCI World Championship Finals",
      date: "August 10, 2024",
      location: "Indianapolis, IN",
      offSeasonDay: 49, // Day of the 49-day off-season
      scores: { ... } // Historical scores for corps that competed
    },
    // ... more events
  ]
}
```

**Key Property:** `offSeasonDay` - Maps each historical event to a specific day in the 49-day off-season calendar.

### 2. Schedule Generation (Backend)

**Function:** `generateOffSeasonSchedule()` in `functions/src/helpers/season.js`

**Process:**
1. Fetches all documents from `historical_scores` collection
2. Groups shows by their `offSeasonDay` property
3. Creates a 49-day schedule array:
   ```javascript
   [
     { offSeasonDay: 1, shows: [show1, show2, show3] },
     { offSeasonDay: 2, shows: [show4, show5, show6] },
     // ... up to day 49
   ]
   ```
4. Places key championship shows on specific days:
   - Day 49: DCI World Championship Finals (mandatory)
   - Day 48: DCI World Championship Semifinals (mandatory)
   - Day 47: DCI World Championship Prelims (mandatory)
   - Day 28: DCI Southwestern Championship (mandatory)
   - Day 41-42: DCI Eastern Classic
5. Fills remaining days with 2-3 shows each
6. Avoids duplicate event names and locations

**Output Structure:**
```javascript
{
  offSeasonDay: 1-49,
  shows: [
    {
      eventName: "Show Name",
      date: "June 15, 2024",
      location: "City, State",
      scores: { ... },
      offSeasonDay: 1,
      mandatory: false // true for championship shows
    }
  ]
}
```

### 3. Season Document Storage

**Document:** `game-settings/season`

The generated schedule is saved as the `events` array:
```javascript
{
  name: "adagio_2025-26",
  status: "off-season",
  seasonUid: "adagio_2025-26",
  currentPointCap: 150,
  schedule: {
    startDate: Timestamp,
    endDate: Timestamp
  },
  events: [ /* 49-day schedule array */ ]
}
```

### 4. Frontend Show Selection

**Component:** `ShowSelectionModal.jsx`

**Process:**
1. Fetches season document from `game-settings/season`
2. Extracts the `events` array
3. Calculates current week:
   - Week 1 = Days 1-7
   - Week 2 = Days 8-14
   - etc.
4. Flattens the schedule structure:
   ```javascript
   // Backend structure
   { offSeasonDay: 15, shows: [show1, show2, show3] }

   // Flattened for frontend
   [
     { ...show1, day: 15, offSeasonDay: 15 },
     { ...show2, day: 15, offSeasonDay: 15 },
     { ...show3, day: 15, offSeasonDay: 15 }
   ]
   ```
5. Displays available shows for the current week
6. Allows user to select up to 4 shows

### 5. User Show Selection (Backend)

**Function:** `selectUserShows()` in `functions/src/callable/lineups.js`

**Saves to:** `artifacts/marching-art/users/{uid}/profile/data`

**Structure:**
```javascript
corps: {
  worldClass: {
    selectedShows: {
      week1: [
        {
          eventName: "Show Name",
          date: "June 15, 2024",
          location: "City, State",
          day: 2
        }
      ],
      week2: [ ... ],
      // ... up to week 7
    }
  }
}
```

## Key Design Decisions

### Why `offSeasonDay`?

The `offSeasonDay` property (1-49) maps historical show dates to the game's 49-day off-season calendar. This allows:
- Consistent schedule structure across different years
- Easy week calculation (week = ceil(day / 7))
- Preservation of realistic show timing and championship placement

### Schedule Structure

The backend uses a **nested structure** (days containing shows) rather than a flat array because:
1. Multiple shows can occur on the same day
2. Days can have 0 shows (rest days, especially days 45-46 before championships)
3. Easier to place mandatory championship shows
4. More efficient for the schedule generation algorithm

The frontend **flattens** this structure for easier rendering and selection.

### Week Calculation

```javascript
const weekStart = (currentWeek - 1) * 7 + 1;
const weekEnd = currentWeek * 7;

// Example: Week 2
// weekStart = (2 - 1) * 7 + 1 = 8
// weekEnd = 2 * 7 = 14
// So Week 2 = Days 8-14
```

## Important Notes

1. **Championship shows (Week 7)** are automatically included for all corps
2. **Days 45-46** are intentionally left empty (rest before championships)
3. **Mandatory shows** must be attended by all corps (Finals, Semifinals, Prelims)
4. **Show uniqueness** is enforced per season - no two corps can select the exact same show lineup

## Testing

To verify schedule generation is working:

1. **Check Firestore:**
   - `historical_scores` collection should have show data with `offSeasonDay` properties
   - `game-settings/season` should have populated `events` array

2. **Test Show Selection:**
   - Select shows for Week 1 (should show days 1-7 shows)
   - Verify shows from all days in that week appear
   - Confirm selection saves to user profile

3. **Verify Structure:**
   ```javascript
   // Backend: events array structure
   events[0] = {
     offSeasonDay: 1,
     shows: [...]
   }

   // Frontend: flattened shows
   availableShows[0] = {
     eventName: "...",
     day: 1,
     offSeasonDay: 1,
     ...
   }
   ```

## Common Issues

### Issue: "No shows available this week"

**Cause:** Missing or malformed `historical_scores` data

**Fix:** Ensure `historical_scores` collection has data with proper `offSeasonDay` values

### Issue: Shows not filtering by week

**Cause:** Mismatch between `day` and `offSeasonDay` property names

**Fix:** ShowSelectionModal now handles both property names and flattens the structure correctly

### Issue: Schedule generation fails

**Cause:** Missing championship shows in historical data

**Fix:** Ensure Finals (day 49), Semifinals (day 48), and Prelims (day 47) exist in historical_scores
