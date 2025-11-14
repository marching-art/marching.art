# Frontend-Backend Integration Guide

## Overview
This document explains how the marching.art frontend integrates with the Firebase backend functions and user accounts.

## Key Configuration

### Data Namespace
- **Frontend**: `dataNamespace = 'marching-art'` (src/firebase.js)
- **Backend**: Uses `DATA_NAMESPACE` parameter (functions/src/config.js)
- **Firestore Path**: `artifacts/marching-art/users/{userId}/profile/data`

### Admin User
- **Admin UID**: `o8vfRCOevjTKBY0k2dISlpiYiIH2`
- **Firestore Path**: `artifacts/marching-art/users/o8vfRCOevjTKBY0k2dISlpiYiIH2`
- **Configured in**:
  - Firestore rules (firestore.rules line 8)
  - Frontend admin helpers (src/firebase.js)

## User Account Structure

### User Profile Path
```
artifacts/marching-art/users/{userId}/profile/data
```

### Profile Schema
```javascript
{
  uid: string,
  email: string,
  username: string,
  displayName: string,
  createdAt: Timestamp,
  lastActive: Timestamp,
  bio: string,
  uniform: {...},  // Visual customization
  trophies: {...}, // Championships, regionals, medals
  seasons: [],     // Season participation history
  corps: {}        // User's corps by class (worldClass, open, etc.)
}
```

## Backend Callable Functions

### User Management Functions

#### 1. checkUsername
**Purpose**: Check if a username is available
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const checkUsername = httpsCallable(functions, 'checkUsername');
const result = await checkUsername({ username: 'myUsername' });
```

#### 2. createUserProfile
**Purpose**: Create initial user profile with username
```javascript
const createUserProfile = httpsCallable(functions, 'createUserProfile');
const result = await createUserProfile({ username: 'myUsername' });
```

#### 3. setUserRole (Admin Only)
**Purpose**: Grant or revoke admin privileges
```javascript
const setUserRole = httpsCallable(functions, 'setUserRole');
const result = await setUserRole({
  email: 'user@example.com',
  makeAdmin: true
});
```

#### 4. getUserRankings
**Purpose**: Get user's global rankings
```javascript
const getUserRankings = httpsCallable(functions, 'getUserRankings');
const result = await getUserRankings();
// Returns: { globalRank, totalPlayers, totalScore }
```

### Corps & Lineup Functions

#### 5. validateAndSaveLineup
**Purpose**: Save user's caption lineup
```javascript
const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
const result = await validateAndSaveLineup({
  lineup: {
    GE1: 'Blue Devils 2014',
    GE2: 'Carolina Crown 2013',
    // ... other captions
  }
});
```

#### 6. selectUserShows
**Purpose**: Select shows for a given week
```javascript
const selectUserShows = httpsCallable(functions, 'selectUserShows');
const result = await selectUserShows({
  week: 1,
  shows: [...]
});
```

### League Functions

#### 7. createLeague
**Purpose**: Create a new league
```javascript
const createLeague = httpsCallable(functions, 'createLeague');
const result = await createLeague({
  name: 'My League',
  description: 'League description',
  isPrivate: false
});
```

#### 8. joinLeague
**Purpose**: Join an existing league
```javascript
const joinLeague = httpsCallable(functions, 'joinLeague');
const result = await joinLeague({
  leagueId: 'league_id',
  inviteCode: 'optional_code'
});
```

#### 9. leaveLeague
**Purpose**: Leave a league
```javascript
const leaveLeague = httpsCallable(functions, 'leaveLeague');
const result = await leaveLeague({ leagueId: 'league_id' });
```

### Comment Functions

#### 10. sendCommentNotification
**Purpose**: Notify users of new comments
```javascript
const sendCommentNotification = httpsCallable(functions, 'sendCommentNotification');
const result = await sendCommentNotification({
  targetUserId: 'user_id',
  commentText: 'comment text'
});
```

#### 11. deleteComment
**Purpose**: Delete a comment (owner or admin only)
```javascript
const deleteComment = httpsCallable(functions, 'deleteComment');
const result = await deleteComment({ commentId: 'comment_id' });
```

#### 12. reportComment
**Purpose**: Report inappropriate comment
```javascript
const reportComment = httpsCallable(functions, 'reportComment');
const result = await reportComment({
  commentId: 'comment_id',
  reason: 'spam'
});
```

### Admin Functions

#### 13. startNewOffSeason (Admin Only)
**Purpose**: Initialize a new off-season
```javascript
const startNewOffSeason = httpsCallable(functions, 'startNewOffSeason');
const result = await startNewOffSeason({ year: 2025 });
```

#### 14. startNewLiveSeason (Admin Only)
**Purpose**: Initialize a new live season
```javascript
const startNewLiveSeason = httpsCallable(functions, 'startNewLiveSeason');
const result = await startNewLiveSeason({ year: 2025 });
```

#### 15. manualTrigger (Admin Only)
**Purpose**: Manually trigger backend processes
```javascript
const manualTrigger = httpsCallable(functions, 'manualTrigger');
const result = await manualTrigger({ action: 'processScores' });
```

## Frontend Helper Functions

### Admin Helpers (src/firebase.js)

```javascript
import { adminHelpers } from './firebase';

// Check if current user is admin
const isUserAdmin = await adminHelpers.isAdmin();

// Get user's token claims
const claims = await adminHelpers.getCurrentUserClaims();
console.log(claims.admin); // true/false
```

### Auth Helpers (src/firebase.js)

```javascript
import { authHelpers } from './firebase';

// Sign in
await authHelpers.signInWithEmail(email, password);

// Sign up
await authHelpers.signUpWithEmail(email, password);

// Sign in anonymously
await authHelpers.signInAnon();

// Sign out
await authHelpers.signOut();

// Get current user
const user = authHelpers.getCurrentUser();

// Subscribe to auth changes
const unsubscribe = authHelpers.onAuthStateChange((user) => {
  console.log('User:', user);
});
```

### Season Helpers (src/firebase.js)

```javascript
import { seasonHelpers } from './firebase';

// Get current season info
const season = seasonHelpers.getCurrentSeason();
// Returns: { type: 'live'|'off', year: 2025, week: 1, ... }

// Format season name
const displayName = seasonHelpers.formatSeasonName(season);
// Returns: "2025 Live Season - Week 1"
```

### Analytics Helpers (src/firebase.js)

```javascript
import { analyticsHelpers } from './firebase';

// Log page view
analyticsHelpers.logPageView('/dashboard');

// Log button click
analyticsHelpers.logButtonClick('create_corps');

// Log corps creation
analyticsHelpers.logCorpsCreated('worldClass');

// Log league joined
analyticsHelpers.logLeagueJoined('league_id');

// Log caption selection
analyticsHelpers.logCaptionSelected('GE1', 'Blue Devils 2014');
```

## User Store (Zustand)

The frontend uses Zustand for state management. Key functions:

```javascript
import { useUserStore } from './store/userStore';

function MyComponent() {
  const {
    user,              // Firebase auth user
    loggedInProfile,   // User profile from Firestore
    isLoadingAuth,     // Loading state
    signIn,            // Sign in function
    signUp,            // Sign up function
    signOutUser,       // Sign out function
    updateUserProfile  // Update profile function
  } = useUserStore();

  // Use these in your component
}
```

## Firestore Security Rules

The rules are configured to:
- Allow public read access to profiles (for leaderboards)
- Allow users to write their own data
- Grant admin full access (UID: o8vfRCOevjTKBY0k2dISlpiYiIH2)
- Protect private user data
- Allow public read for game data (dci-data, dci-stats, etc.)

## Important Notes

1. **Namespace Consistency**: Always use `dataNamespace = 'marching-art'` when accessing user data
2. **Admin Access**: Only the designated admin UID has full system access
3. **Custom Claims**: Admin privileges can also be granted via custom claims (requires re-login)
4. **Callable Functions**: All backend functions use Firebase Callable Functions for security
5. **Error Handling**: All functions throw HttpsError with descriptive messages

## Testing Admin Functions

To test admin functions locally:
1. Sign in as the admin user (UID: o8vfRCOevjTKBY0k2dISlpiYiIH2)
2. Use the admin helpers to verify admin status
3. Call admin-only functions (setUserRole, startNewSeason, etc.)

```javascript
// Example admin workflow
const isAdmin = await adminHelpers.isAdmin();
if (isAdmin) {
  const setUserRole = httpsCallable(functions, 'setUserRole');
  await setUserRole({
    email: 'newadmin@example.com',
    makeAdmin: true
  });
}
```

## Scheduled Functions (Backend Only)

These run automatically on schedule:
- `seasonScheduler`: Daily season management
- `dailyOffSeasonProcessor`: Process off-season activities
- `processDailyLiveScores`: Process live scores daily
- `generateWeeklyMatchups`: Generate league matchups

## Trigger Functions (Backend Only)

These respond to Firestore changes:
- `processDciScores`: Triggered on new DCI scores
- `processLiveScoreRecap`: Generate score recaps

---

Last Updated: 2025-11-14
