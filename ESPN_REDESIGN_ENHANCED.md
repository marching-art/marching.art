# ESPN Fantasy Sports Redesign - Enhanced Implementation Plan

**Original Plan Enhanced With:** Code Audit Findings (December 14, 2025)
**Total Prompts:** 28 (was 17 + A-C)
**New Phases Added:** Phase 0 (Critical Fixes), Phase 0.5 (Code Cleanup)

---

## CRITICAL: Pre-Implementation Requirements

Before executing ANY redesign prompts, the following issues from the code audit MUST be addressed. Failure to do so will result in:
- Security vulnerabilities in the new code
- Performance issues being carried forward
- Duplicated work when fixing issues later
- Accessibility violations in new components

---

## PHASE 0: CRITICAL SECURITY & FOUNDATION FIXES

> **Execute these prompts BEFORE any redesign work**

### Prompt 0.1: Remove Hardcoded Credentials

```
CRITICAL SECURITY FIX: REMOVE HARDCODED CREDENTIALS

This is a BLOCKING task. Do not proceed with redesign until complete.

Files to modify:
1. /home/user/marching.art/src/config/index.ts

Tasks:

1. Remove hardcoded Firebase API key fallback (line 69):
   BEFORE:
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE',

   AFTER:
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

2. Remove hardcoded admin UID fallback (lines 54-56):
   BEFORE:
   adminUids: (import.meta.env.VITE_ADMIN_UIDS || 'o8vfRCOevjTKBY0k2dISlpiYiIH2')

   AFTER:
   adminUids: import.meta.env.VITE_ADMIN_UIDS?.split(',') || [],

3. Add runtime validation in src/config/index.ts:
   // Add at top of file after imports
   const requiredEnvVars = [
     'VITE_FIREBASE_API_KEY',
     'VITE_FIREBASE_AUTH_DOMAIN',
     'VITE_FIREBASE_PROJECT_ID',
   ];

   if (import.meta.env.MODE === 'production') {
     for (const envVar of requiredEnvVars) {
       if (!import.meta.env[envVar]) {
         throw new Error(`Missing required environment variable: ${envVar}`);
       }
     }
   }

4. Update /home/user/marching.art/firestore.rules (line 8):
   - Remove hardcoded admin UID
   - Use only custom claims for admin verification:

   function isAdmin() {
     return request.auth != null && request.auth.token.admin == true;
   }

5. Verify .env.local.example documents ALL required variables

6. Update /home/user/marching.art/.gitignore to ensure .env* files are ignored

VERIFICATION:
- grep -r "AIzaSy" src/ should return 0 results
- grep -r "o8vfRCOevjTKBY0k2dISlpiYiIH2" . should return 0 results
- Application should fail to start without env vars in production
```

---

### Prompt 0.2: Fix Authentication Token Handling

```
CRITICAL SECURITY FIX: REMOVE URL TOKEN AUTHENTICATION

File to modify: /home/user/marching.art/src/App.jsx

Current Issue (lines 85-92):
Auth token passed via URL parameter __initial_auth_token, exposing it in:
- Browser history
- Referrer headers
- Server logs
- Analytics

Tasks:

1. Remove URL token authentication entirely:
   DELETE these lines (85-92):
   const urlParams = new URLSearchParams(window.location.search);
   const authToken = urlParams.get('__initial_auth_token');
   if (authToken && !user && !loading) {
     authHelpers.signInWithToken(authToken)
       .then(() => {
         window.history.replaceState({}, document.title, window.location.pathname);
       })
   }

2. If URL token auth is REQUIRED for a specific use case (e.g., email links):
   - Document the use case in a comment
   - Implement secure alternative using Firebase Auth email link sign-in
   - Use sessionStorage instead of URL parameters
   - Add CSRF protection

3. Update any code that generates these URLs to use the new method

4. Search for other URL parameter auth patterns:
   grep -r "__initial_auth_token" src/
   grep -r "authToken.*URL" src/

   Fix any other occurrences found.

VERIFICATION:
- No auth tokens should appear in URLs
- Application authentication should still work normally
- Check browser Network tab for token leaks
```

---

### Prompt 0.3: Fix Error Message Information Disclosure

```
SECURITY FIX: SANITIZE ERROR MESSAGES IN CLOUD FUNCTIONS

Files to modify:
- /home/user/marching.art/functions/src/callable/admin.js
- /home/user/marching.art/functions/src/callable/profile.js
- /home/user/marching.art/functions/src/callable/economy.js
- /home/user/marching.art/functions/src/webhooks/stripe.js
- All other files in /home/user/marching.art/functions/src/callable/

Current Issue:
Error messages include internal details that leak implementation information.

Example (admin.js line 18):
throw new HttpsError("internal", `An error occurred while starting the season: ${error.message}`);

Tasks:

1. Create error handling utility:
   Create /home/user/marching.art/functions/src/utils/errorHandler.js:

   const { logger } = require("firebase-functions");
   const { HttpsError } = require("firebase-functions/v2/https");

   // Generic error messages for each error type
   const GENERIC_MESSAGES = {
     'unauthenticated': 'You must be logged in to perform this action.',
     'permission-denied': 'You do not have permission to perform this action.',
     'not-found': 'The requested resource was not found.',
     'already-exists': 'This resource already exists.',
     'invalid-argument': 'Invalid input provided. Please check your data.',
     'failed-precondition': 'Cannot perform this action at this time.',
     'internal': 'An unexpected error occurred. Please try again.',
   };

   function handleError(error, context = {}) {
     // Log full error details server-side
     logger.error('Function error:', {
       message: error.message,
       stack: error.stack,
       code: error.code,
       ...context
     });

     // If it's already an HttpsError with a safe message, rethrow
     if (error instanceof HttpsError) {
       // Check if message is safe (doesn't contain stack traces, paths, etc.)
       const unsafePatterns = [/at\s+\w+\s+\(/i, /\/home\//, /node_modules/, /Error:/i];
       const isSafe = !unsafePatterns.some(p => p.test(error.message));
       if (isSafe) throw error;
     }

     // Return generic error
     const code = error.code || 'internal';
     throw new HttpsError(code, GENERIC_MESSAGES[code] || GENERIC_MESSAGES.internal);
   }

   module.exports = { handleError, GENERIC_MESSAGES };

2. Update all callable functions to use the handler:

   const { handleError } = require('../utils/errorHandler');

   // In each function, wrap error handling:
   try {
     // ... function logic
   } catch (error) {
     handleError(error, { functionName: 'startSeason', userId: request.auth?.uid });
   }

3. Update Stripe webhook (stripe.js line 43):
   BEFORE:
   return res.status(400).send(`Webhook Error: ${err.message}`);

   AFTER:
   logger.error('Stripe webhook error:', err);
   return res.status(400).send('Webhook processing failed');

4. Create a map of all functions and their error handling status:
   | Function | File | Updated |
   | startSeason | admin.js | [ ] |
   | updateProfile | profile.js | [ ] |
   | ... | ... | [ ] |

VERIFICATION:
- Trigger errors intentionally and verify generic messages returned to client
- Check Cloud Functions logs contain full error details
- No stack traces or file paths in client-visible errors
```

---

## PHASE 0.5: CODE CLEANUP & CONSOLIDATION

> **Execute these prompts after Phase 0, before visual redesign**

### Prompt 0.4: Consolidate Duplicate Utility Functions

```
CODE CLEANUP: CONSOLIDATE DUPLICATE UTILITIES

Issue: Multiple utility functions are duplicated 2-4 times across the codebase.

Duplicated functions:
1. getCorpsClassName - defined 3 times
2. formatSeasonName - defined 4 times
3. getCorpsClassColor - defined 2 times

Tasks:

1. Create centralized utilities file:
   /home/user/marching.art/src/utils/corps.ts

   import { CorpsClass } from '@/types';

   /**
    * Maps corps class enum to display name
    */
   export function getCorpsClassName(classType: CorpsClass): string {
     const classNames: Record<CorpsClass, string> = {
       soundSport: 'SoundSport',
       aClass: 'A Class',
       open: 'Open Class',
       world: 'World Class',
     };
     return classNames[classType] || 'Unknown';
   }

   /**
    * Maps corps class to theme color
    */
   export function getCorpsClassColor(classType: CorpsClass): string {
     const classColors: Record<CorpsClass, string> = {
       soundSport: '#9CA3AF', // gray-400
       aClass: '#22C55E',      // green-500
       open: '#3B82F6',        // blue-500
       world: '#F59E0B',       // amber-500
     };
     return classColors[classType] || '#9CA3AF';
   }

   /**
    * Maps corps class to Tailwind CSS classes
    */
   export function getCorpsClassStyles(classType: CorpsClass): string {
     const styles: Record<CorpsClass, string> = {
       soundSport: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
       aClass: 'bg-green-500/20 text-green-400 border-green-500/30',
       open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
       world: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
     };
     return styles[classType] || styles.soundSport;
   }

2. Create season utilities file:
   /home/user/marching.art/src/utils/season.ts

   /**
    * Formats season identifier to display name
    * @param seasonId - e.g., "2025-summer" or "2025"
    * @returns Display name e.g., "Summer 2025"
    */
   export function formatSeasonName(seasonId: string): string {
     if (!seasonId) return 'Unknown Season';

     // Handle "YYYY-season" format
     const match = seasonId.match(/^(\d{4})-?(\w+)?$/);
     if (match) {
       const [, year, season] = match;
       if (season) {
         const seasonName = season.charAt(0).toUpperCase() + season.slice(1);
         return `${seasonName} ${year}`;
       }
       return `Season ${year}`;
     }

     return seasonId;
   }

   /**
    * Gets the current week number in the season
    */
   export function getCurrentWeek(startDate: Date, endDate: Date): number {
     const now = new Date();
     const elapsed = now.getTime() - startDate.getTime();
     const weekMs = 7 * 24 * 60 * 60 * 1000;
     return Math.max(1, Math.ceil(elapsed / weekMs));
   }

   /**
    * Gets weeks remaining in season
    */
   export function getWeeksRemaining(endDate: Date): number {
     const now = new Date();
     const remaining = endDate.getTime() - now.getTime();
     const weekMs = 7 * 24 * 60 * 60 * 1000;
     return Math.max(0, Math.ceil(remaining / weekMs));
   }

3. Update all files that define these functions to import from utils:

   Files to update (remove local definitions, add imports):
   - /home/user/marching.art/src/components/SeasonSetupWizard/constants.js
     - Remove getCorpsClassName (line 46)
     - Remove formatSeasonName (lines 49-52)
     - Add: import { getCorpsClassName, formatSeasonName } from '@/utils/corps';

   - /home/user/marching.art/src/hooks/useDashboardData.js
     - Remove getCorpsClassName (lines 62-70)
     - Remove getCorpsClassColor (lines 72-80)
     - Remove formatSeasonName (lines 57-60)
     - Add: import { getCorpsClassName, getCorpsClassColor } from '@/utils/corps';
     - Add: import { formatSeasonName } from '@/utils/season';

   - /home/user/marching.art/src/hooks/useCorpsSelection.ts
     - Remove getCorpsClassName (lines 42-44)
     - Remove getCorpsClassColor (lines 46-48)
     - Add: import { getCorpsClassName, getCorpsClassColor } from '@/utils/corps';

   - /home/user/marching.art/src/api/season.ts
     - Remove formatSeasonName (lines 204-209)
     - Add: import { formatSeasonName } from '@/utils/season';

   - /home/user/marching.art/src/firebase.js
     - Remove formatSeasonName (lines 174-179)
     - Add: import { formatSeasonName } from '@/utils/season';

4. Update /home/user/marching.art/src/utils/index.ts to export all utilities:
   export * from './corps';
   export * from './season';
   export * from './errorMessages';

5. Standardize CorpsClass enum values in /home/user/marching.art/src/types/index.ts:
   export type CorpsClass = 'soundSport' | 'aClass' | 'open' | 'world';

   // Remove any variations like 'openClass' or 'worldClass'

VERIFICATION:
- grep -r "function getCorpsClassName" src/ should return only 1 result (in utils/corps.ts)
- grep -r "function formatSeasonName" src/ should return only 1 result (in utils/season.ts)
- All imports should resolve correctly
- Run: npm run build to verify no import errors
```

---

### Prompt 0.5: Remove Dead Code and Console Statements

```
CODE CLEANUP: REMOVE DEAD CODE AND DEBUG STATEMENTS

Tasks:

1. Remove all commented-out code (approximately 1238 lines identified):

   Use this command to find commented code blocks:
   grep -rn "^\s*//.*" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" |
   grep -v "TODO\|FIXME\|NOTE\|@" | head -100

   For each file with commented code:
   - If it's a single-line explanation comment, KEEP it
   - If it's commented-out code (old implementation), DELETE it
   - If unsure, check git history - if it's been commented for >30 days, DELETE it

2. Remove console.log statements from production code:

   Files with console.log to clean:
   - /home/user/marching.art/src/components/CaptionSelection/CaptionSelectionModal.jsx
   - /home/user/marching.art/src/utils/qaChecklist.ts (lines 282, 334)

   KEEP console.log ONLY if:
   - Inside if (import.meta.env.DEV) block
   - In service worker registration (with proper guards)

3. Replace console.error with proper error logging:

   Create /home/user/marching.art/src/utils/logger.ts:

   type LogLevel = 'debug' | 'info' | 'warn' | 'error';

   interface LogEntry {
     level: LogLevel;
     message: string;
     context?: Record<string, unknown>;
     timestamp: string;
   }

   class Logger {
     private isDev = import.meta.env.DEV;

     private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
       const entry: LogEntry = {
         level,
         message,
         context,
         timestamp: new Date().toISOString(),
       };

       if (this.isDev) {
         const consoleFn = console[level] || console.log;
         consoleFn(`[${level.toUpperCase()}]`, message, context || '');
       }

       // In production, send to error tracking service
       if (level === 'error' && !this.isDev) {
         // TODO: Integrate with Sentry, LogRocket, or similar
         // sendToErrorService(entry);
       }
     }

     debug(message: string, context?: Record<string, unknown>) {
       this.log('debug', message, context);
     }

     info(message: string, context?: Record<string, unknown>) {
       this.log('info', message, context);
     }

     warn(message: string, context?: Record<string, unknown>) {
       this.log('warn', message, context);
     }

     error(message: string, context?: Record<string, unknown>) {
       this.log('error', message, context);
     }
   }

   export const logger = new Logger();

4. Update files using console.error (18+ instances):

   Replace:
   console.error('Error message', error);

   With:
   import { logger } from '@/utils/logger';
   logger.error('Error message', { error: error.message, stack: error.stack });

   Files to update:
   - /home/user/marching.art/src/hooks/useLeagueNotifications.ts (6 instances)
   - /home/user/marching.art/src/api/leagues.ts (4 instances)
   - /home/user/marching.art/src/hooks/useEngagement.ts (1 instance)
   - /home/user/marching.art/src/components/Navigation.tsx (1 instance)
   - /home/user/marching.art/src/components/GamingHeader.tsx (1 instance)
   - /home/user/marching.art/src/App.jsx (1 instance at line 95)
   - /home/user/marching.art/src/store/userStore.js (1 instance at line 110)
   - /home/user/marching.art/src/context/AuthContext.jsx (1 instance at line 66)

5. Remove unused imports in all files:
   Run: npx eslint src/ --rule "no-unused-vars: error" --fix
   Or manually check each file

VERIFICATION:
- grep -r "console.log" src/ should return minimal results (only in dev guards)
- grep -r "console.error" src/ should return 0 results (replaced with logger)
- npm run build should complete without warnings about unused code
```

---

### Prompt 0.6: Split Oversized Components

```
CODE CLEANUP: SPLIT LARGE COMPONENTS BEFORE REDESIGN

Issue: Several components are too large (>500 lines), making redesign difficult.

Components to split:

1. /home/user/marching.art/src/pages/Profile.jsx (1264 lines)

   Split into:
   - /src/pages/Profile.jsx (main container, ~100 lines)
   - /src/components/Profile/ProfileHeader.jsx (~150 lines)
   - /src/components/Profile/ProfileStats.jsx (~100 lines)
   - /src/components/Profile/CorpsOverview.jsx (~150 lines)
   - /src/components/Profile/SeasonHistory.jsx (~200 lines)
   - /src/components/Profile/ProfileSettings.jsx (~300 lines)
   - /src/components/Profile/AchievementsGrid.jsx (~150 lines)
   - /src/components/Profile/ProfileTabs.jsx (~100 lines)

   Main Profile.jsx should:
   - Import all sub-components
   - Handle routing/tab state
   - Pass data down as props
   - Be under 150 lines

2. /home/user/marching.art/src/components/CaptionSelection/CaptionSelectionModal.jsx (1110 lines)

   Split into:
   - CaptionSelectionModal.jsx (container, ~150 lines)
   - CurrentLineupTable.jsx (~150 lines)
   - AvailableOptionsTable.jsx (~200 lines)
   - CaptionSearchFilter.jsx (~100 lines)
   - CaptionOptionCard.jsx (~100 lines)
   - BudgetIndicator.jsx (~50 lines)
   - hooks/useCaptionSelection.ts (~200 lines) - extract logic

3. /home/user/marching.art/src/pages/Dashboard.jsx (970 lines)

   Split into:
   - Dashboard.jsx (container, ~100 lines)
   - /src/components/Dashboard/CorpsCard.jsx (~150 lines)
   - /src/components/Dashboard/StandingsPreview.jsx (~100 lines)
   - /src/components/Dashboard/UpcomingShows.jsx (~100 lines)
   - /src/components/Dashboard/LineupOverview.jsx (~150 lines)
   - /src/components/Dashboard/RecentActivity.jsx (~100 lines)
   - /src/components/Dashboard/QuickActions.jsx (~100 lines)

4. /home/user/marching.art/src/pages/Leagues.jsx (920 lines)

   Split into:
   - Leagues.jsx (container, ~100 lines)
   - /src/components/Leagues/LeagueHeader.jsx (~100 lines)
   - /src/components/Leagues/StandingsTab.jsx (~150 lines)
   - /src/components/Leagues/MatchupsTab.jsx (~150 lines)
   - /src/components/Leagues/LeagueSettings.jsx (~150 lines)
   - /src/components/Leagues/JoinLeagueView.jsx (~150 lines)

5. /home/user/marching.art/src/hooks/useDashboardData.js (559 lines)

   Split into focused hooks:
   - hooks/useDashboardData.ts (orchestrator, ~100 lines)
   - hooks/useCorpsData.ts (~100 lines)
   - hooks/useSeasonProgress.ts (~80 lines)
   - hooks/useUpcomingShows.ts (~80 lines)
   - hooks/useUserStats.ts (~100 lines)

For each split:
1. Extract the component/hook to its own file
2. Define clear props interface (TypeScript)
3. Keep state management in parent when shared
4. Use composition over prop drilling
5. Maintain existing functionality exactly

DO NOT change any visual styling during this phase.
This is purely structural refactoring.

VERIFICATION:
- npm run build completes successfully
- All tests pass: npm run test
- Application functions identically to before
- No component file exceeds 300 lines
```

---

### Prompt 0.7: Fix Performance Foundation Issues

```
PERFORMANCE FIX: ADD MEMOIZATION PATTERNS BEFORE REDESIGN

Issue: Only 1 of 132 components uses React.memo(). This must be fixed before
redesign to prevent performance issues in new components.

Tasks:

1. Fix AuthContext value memoization:
   File: /home/user/marching.art/src/App.jsx (lines 109-117)

   BEFORE:
   <AuthContext.Provider value={{ user, loading, error, ...authHelpers }}>

   AFTER:
   // Add at component level:
   const authContextValue = useMemo(() => ({
     user,
     loading,
     error,
     ...authHelpers,
   }), [user, loading, error]);

   // Then use:
   <AuthContext.Provider value={authContextValue}>

2. Fix ThemeContext value memoization:
   File: /home/user/marching.art/src/context/ThemeContext.jsx (lines 29-35)

   const value = useMemo(() => ({
     theme: 'dark',
     isDark: true,
     setTheme: () => {},
     toggleTheme: () => {},
   }), []);

3. Create memoization utilities:
   File: /home/user/marching.art/src/utils/performance.ts

   import { useRef, useCallback, useMemo } from 'react';

   /**
    * Creates a stable callback that always calls the latest function
    * without changing identity (useful for event handlers in memoized components)
    */
   export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
     const callbackRef = useRef(callback);
     callbackRef.current = callback;

     return useCallback((...args: Parameters<T>) => {
       return callbackRef.current(...args);
     }, []) as T;
   }

   /**
    * Compares objects shallowly for memoization
    */
   export function shallowEqual(a: any, b: any): boolean {
     if (a === b) return true;
     if (!a || !b) return false;

     const keysA = Object.keys(a);
     const keysB = Object.keys(b);

     if (keysA.length !== keysB.length) return false;

     for (const key of keysA) {
       if (a[key] !== b[key]) return false;
     }

     return true;
   }

4. Add React.memo to high-impact list components:

   Priority components (render many items):

   a) /home/user/marching.art/src/components/Scores/Leaderboard.jsx
      - Wrap LeaderboardRow with React.memo
      - Add useCallback for onClick handlers

   b) /home/user/marching.art/src/components/Leagues/LeagueActivityFeed.jsx
      - Wrap ActivityItem with React.memo
      - Memoize onTap callback (line 60)

   c) All modal components in /src/components/modals/
      - Wrap modal content with React.memo
      - Memoize expensive renders inside modals

   Pattern to follow:

   // BEFORE
   function LeaderboardRow({ data, onClick }) {
     return <div onClick={onClick}>...</div>;
   }

   // AFTER
   const LeaderboardRow = memo(function LeaderboardRow({ data, onClick }) {
     return <div onClick={onClick}>...</div>;
   });

   // In parent:
   const handleRowClick = useCallback((id) => {
     navigate(`/profile/${id}`);
   }, [navigate]);

5. Fix useScoresData performance:
   File: /home/user/marching.art/src/hooks/useScoresData.js

   Issue: Multiple passes over data (lines 237-270)

   Refactor to single-pass algorithm:

   const processedData = useMemo(() => {
     if (!shows?.length) return { entries: [], stats: {}, uniqueDays: [] };

     const entries: ScoreEntry[] = [];
     const stats = { maxScore: 0, totalScores: 0 };
     const daysSet = new Set<string>();

     // Single pass over all data
     for (const show of shows) {
       for (const score of show.scores) {
         entries.push({
           ...score,
           showName: show.name,
           showDate: show.date,
         });

         stats.maxScore = Math.max(stats.maxScore, score.value);
         stats.totalScores++;
         daysSet.add(show.date);
       }
     }

     // Sort once at the end
     entries.sort((a, b) => b.value - a.value);

     return {
       entries,
       stats,
       uniqueDays: Array.from(daysSet).sort(),
     };
   }, [shows]);

6. Fix ScoresSpreadsheet N+1 pattern:
   File: /home/user/marching.art/src/components/Admin/ScoresSpreadsheet.jsx (lines 129-140)

   BEFORE: getScore() loops through yearData for each cell

   AFTER: Build lookup map once

   const scoreMap = useMemo(() => {
     const map = new Map<string, number>();
     for (const event of yearData) {
       for (const score of event.scores) {
         const key = `${score.corpsId}-${event.date}`;
         map.set(key, score.value);
       }
     }
     return map;
   }, [yearData]);

   // Then in render:
   const score = scoreMap.get(`${corps.id}-${day}`);

VERIFICATION:
- React DevTools Profiler shows reduced re-renders
- No new React warnings about missing keys or deps
- Application performance improved (measure with Lighthouse)
```

---

### Prompt 0.8: Fix Accessibility Foundation Issues

```
ACCESSIBILITY FIX: REPAIR BROKEN ARIA BEFORE REDESIGN

Critical issues that MUST be fixed before adding new components.

Tasks:

1. Fix Tabs component aria-labelledby reference:
   File: /home/user/marching.art/src/components/ui/Tabs.tsx

   Line 110 - TabTrigger is missing id attribute:

   BEFORE:
   <button
     role="tab"
     aria-selected={isActive}
     aria-controls={`tabpanel-${value}`}
   >

   AFTER:
   <button
     role="tab"
     id={`tab-${value}`}
     aria-selected={isActive}
     aria-controls={`tabpanel-${value}`}
   >

2. Fix Modal focus trapping:
   File: /home/user/marching.art/src/components/ui/Modal.tsx

   Import and use the existing useFocusTrap:

   import { useFocusTrap } from '@/components/a11y/SkipToContent';

   function Modal({ isOpen, onClose, children, ...props }) {
     const modalRef = useRef<HTMLDivElement>(null);

     useFocusTrap(modalRef, isOpen);

     // Also add Escape key handler
     useEffect(() => {
       const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape' && isOpen) {
           onClose();
         }
       };

       if (isOpen) {
         document.addEventListener('keydown', handleEscape);
         return () => document.removeEventListener('keydown', handleEscape);
       }
     }, [isOpen, onClose]);

     return (
       <div
         ref={modalRef}
         role="dialog"
         aria-modal="true"
         {...props}
       >
         {children}
       </div>
     );
   }

3. Fix ShowDetailModal accessibility:
   File: /home/user/marching.art/src/components/Scores/ShowDetailModal.jsx

   Add missing ARIA attributes:

   <motion.div
     role="dialog"
     aria-modal="true"
     aria-labelledby="show-detail-title"
   >
     <h2 id="show-detail-title">{show.name}</h2>
     ...
   </motion.div>

4. Fix ShowCard keyboard accessibility:
   File: /home/user/marching.art/src/components/Scores/ShowCard.jsx

   BEFORE (line 15-19):
   <motion.div onClick={onClick}>

   AFTER:
   <motion.div
     role="button"
     tabIndex={0}
     onClick={onClick}
     onKeyDown={(e) => {
       if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         onClick();
       }
     }}
     aria-label={`View details for ${showName}`}
   >

   OR better - change to button element:
   <motion.button
     onClick={onClick}
     className="w-full text-left" // preserve styling
   >

5. Add main landmark element:
   File: /home/user/marching.art/src/components/Layout/GameShell.jsx

   Wrap main content area in <main> element:

   <div className="app-layout">
     <Navigation />
     <main id="main-content" role="main">
       {children}
     </main>
     <BottomNav />
   </div>

6. Update SkipToContent to target new main element:
   File: /home/user/marching.art/src/components/a11y/SkipToContent.tsx

   Ensure href points to #main-content

7. Add prefers-reduced-motion to core animation components:

   Create /home/user/marching.art/src/utils/motion.ts:

   import { useReducedMotion } from '@/hooks/useReducedMotion';

   export function useAnimationConfig() {
     const shouldReduceMotion = useReducedMotion();

     return {
       // For Framer Motion
       transition: shouldReduceMotion
         ? { duration: 0 }
         : { duration: 0.2, ease: 'easeOut' },

       // Disable animations entirely
       animate: shouldReduceMotion ? false : true,

       // For hover/tap animations
       whileHover: shouldReduceMotion ? {} : { scale: 1.02 },
       whileTap: shouldReduceMotion ? {} : { scale: 0.98 },
     };
   }

   Update Spinner.tsx, Modal.tsx, and other animated components to use this.

VERIFICATION:
- Tab through entire application - all interactive elements reachable
- Test with screen reader (VoiceOver/NVDA)
- Test with prefers-reduced-motion enabled in OS settings
- No accessibility warnings in browser DevTools
```

---

## PHASE 1: DESIGN SYSTEM FOUNDATION

> Now proceed with the original prompts, enhanced with audit findings

### Prompt 1: Update Tailwind Design Tokens (ENHANCED)

```
UPDATE THE TAILWIND DESIGN SYSTEM FOR ESPN FANTASY STYLE

Context: We're redesigning marching.art from a "Stadium HUD" glassmorphism style
to an ESPN Fantasy Sports professional data presentation style.

File to modify: /home/user/marching.art/tailwind.config.cjs

PREREQUISITE CHECK:
- [ ] Prompts 0.1-0.8 completed
- [ ] No hardcoded credentials remain
- [ ] Duplicate utilities consolidated
- [ ] Dead code removed
- [ ] Large components split

Tasks:

1. Replace the color system with ESPN-inspired palette:

   colors: {
     // Brand colors
     'dci-blue': {
       DEFAULT: '#0057B8',
       light: '#3380CC',
       dark: '#004494',
     },

     // Semantic trend colors (WCAG AA compliant on dark backgrounds)
     'trend': {
       up: '#00C853',      // Green - meets 4.5:1 contrast
       down: '#FF5252',    // Red - meets 4.5:1 contrast
       neutral: '#9E9E9E', // Gray
     },

     // Live indicator
     'live': '#FF0000',

     // Surface colors (dark theme)
     'surface': {
       background: '#0A0A0A',
       DEFAULT: '#1A1A1A',
       elevated: '#2A2A2A',
       card: '#333333',
     },

     // Text colors (all meet WCAG AA on surface backgrounds)
     'text': {
       primary: '#FFFFFF',   // 21:1 contrast on #1A1A1A
       secondary: '#B3B3B3', // 7:1 contrast
       muted: '#808080',     // 4.6:1 contrast (AA minimum)
     },

     // Keep class colors for badges
     'class': {
       soundSport: '#9CA3AF',
       aClass: '#22C55E',
       open: '#3B82F6',
       world: '#F59E0B',
     },
   },

2. Replace box shadows - remove all glow effects:

   boxShadow: {
     'sm': '0 1px 2px rgba(0,0,0,0.5)',
     'md': '0 2px 4px rgba(0,0,0,0.5)',
     'lg': '0 4px 8px rgba(0,0,0,0.5)',
     'xl': '0 8px 16px rgba(0,0,0,0.5)',
     'card': '0 2px 8px rgba(0,0,0,0.4)',
     'none': 'none',
   },

   REMOVE all of these:
   - gold-glow-*
   - glow-*
   - stadium-*
   - glass-*

3. Update border radius to be more subtle:

   borderRadius: {
     'none': '0',
     'sm': '4px',
     DEFAULT: '6px',
     'md': '8px',
     'lg': '12px',
     'xl': '16px',
     'full': '9999px',
   },

4. Remove deprecated background images:

   In backgroundImage section, REMOVE:
   - stadium-lights
   - stadium-glow
   - Any radial-gradient patterns with gold

   KEEP:
   - Simple gradients for subtle effects

5. Update animations - remove decorative, keep functional:

   REMOVE:
   - pulse-gold
   - glow
   - float
   - boot-grid

   KEEP:
   - spin (for spinners)
   - pulse (for live indicators - update to use live color)
   - fadeIn (for modals)

   ADD:
   animation: {
     'pulse-live': 'pulse-live 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
   },
   keyframes: {
     'pulse-live': {
       '0%, 100%': { opacity: '1' },
       '50%': { opacity: '0.5' },
     },
   },

6. Font family - KEEP existing:

   fontFamily: {
     sans: ['Inter', 'system-ui', 'sans-serif'],
     display: ['Oswald', 'sans-serif'],
     mono: ['JetBrains Mono', 'monospace'],
   },

7. Add data-focused utilities:

   fontSize: {
     // Add tabular-nums variant sizes
     'stat-xs': ['0.75rem', { lineHeight: '1rem', fontVariantNumeric: 'tabular-nums' }],
     'stat-sm': ['0.875rem', { lineHeight: '1.25rem', fontVariantNumeric: 'tabular-nums' }],
     'stat-base': ['1rem', { lineHeight: '1.5rem', fontVariantNumeric: 'tabular-nums' }],
     'stat-lg': ['1.25rem', { lineHeight: '1.75rem', fontVariantNumeric: 'tabular-nums' }],
     'stat-xl': ['1.5rem', { lineHeight: '2rem', fontVariantNumeric: 'tabular-nums' }],
     'stat-2xl': ['2rem', { lineHeight: '2.5rem', fontVariantNumeric: 'tabular-nums' }],
   },

VERIFICATION:
- npm run build completes successfully
- No Tailwind warnings about missing classes
- Gold glow effects no longer appear in application
- Text remains readable (check contrast ratios)
```

---

### Prompt 2: Update CSS Variables and Base Styles (ENHANCED)

```
UPDATE INDEX.CSS FOR ESPN FANTASY STYLE

Context: Following the Tailwind update, update CSS custom properties and remove
glassmorphism styles.

File to modify: /home/user/marching.art/src/index.css

IMPORTANT: This file is large (101KB). Read it fully before making changes.
Maintain any accessibility-related styles.

Tasks:

1. Update CSS custom properties (:root):

   :root {
     /* Primary brand */
     --color-primary: #0057B8;
     --color-primary-hover: #004494;
     --color-primary-light: #3380CC;

     /* Surfaces */
     --color-background: #0A0A0A;
     --color-surface: #1A1A1A;
     --color-surface-elevated: #2A2A2A;
     --color-surface-card: #333333;

     /* Text - ALL must meet WCAG AA contrast */
     --color-text-primary: #FFFFFF;
     --color-text-secondary: #B3B3B3;
     --color-text-muted: #808080;

     /* Borders */
     --color-border: rgba(255, 255, 255, 0.1);
     --color-border-strong: rgba(255, 255, 255, 0.2);
     --color-border-focus: #0057B8;

     /* Semantic colors */
     --color-trend-up: #00C853;
     --color-trend-down: #FF5252;
     --color-trend-neutral: #9E9E9E;
     --color-live: #FF0000;

     /* Status colors */
     --color-success: #00C853;
     --color-warning: #F59E0B;
     --color-error: #FF5252;
     --color-info: #3B82F6;

     /* Corps class colors */
     --color-class-soundsport: #9CA3AF;
     --color-class-a: #22C55E;
     --color-class-open: #3B82F6;
     --color-class-world: #F59E0B;

     /* Typography */
     --font-sans: 'Inter', system-ui, sans-serif;
     --font-display: 'Oswald', sans-serif;
     --font-mono: 'JetBrains Mono', monospace;

     /* Spacing - keep consistent */
     --spacing-xs: 4px;
     --spacing-sm: 8px;
     --spacing-md: 16px;
     --spacing-lg: 24px;
     --spacing-xl: 32px;

     /* Focus ring for accessibility */
     --focus-ring: 0 0 0 2px var(--color-primary);
   }

2. REMOVE these CSS classes entirely (search and delete):

   - .glass-panel and all variants (.glass-panel-dark, .glass-panel-light, etc.)
   - .stadium-banner
   - .stadium-overlay
   - .stadium-lights (background effect)
   - .vignette
   - .score-bug (replace with .stat-badge below)
   - .icon-card (replace with .action-card below)
   - .ticket-stub-* variants
   - .glow-border-pulse
   - .glow-text
   - .paper-card
   - .dark-toolbar
   - Any class containing "gold-glow" or "amber-glow"

3. Add new ESPN-style utility classes:

   /* Data Table Styles */
   .data-table {
     border-collapse: collapse;
     width: 100%;
   }

   .data-table th {
     text-transform: uppercase;
     font-size: 11px;
     font-weight: 600;
     color: var(--color-text-muted);
     text-align: left;
     padding: 8px 12px;
     border-bottom: 1px solid var(--color-border);
     letter-spacing: 0.05em;
   }

   .data-table td {
     padding: 10px 12px;
     border-bottom: 1px solid var(--color-border);
     font-variant-numeric: tabular-nums;
   }

   .data-table tr:hover {
     background: rgba(255, 255, 255, 0.03);
   }

   .data-table .highlight-row {
     background: rgba(0, 87, 184, 0.15);
   }

   .data-table .highlight-row:hover {
     background: rgba(0, 87, 184, 0.2);
   }

   /* Trend Indicators */
   .trend-up {
     color: var(--color-trend-up);
   }

   .trend-down {
     color: var(--color-trend-down);
   }

   .trend-neutral {
     color: var(--color-text-muted);
   }

   /* Stat Display */
   .stat-card {
     background: var(--color-surface-elevated);
     border: 1px solid var(--color-border);
     border-radius: 6px;
     padding: 16px;
   }

   .stat-value {
     font-family: var(--font-mono);
     font-size: 28px;
     font-weight: 700;
     font-variant-numeric: tabular-nums;
   }

   .stat-label {
     font-size: 11px;
     text-transform: uppercase;
     color: var(--color-text-muted);
     margin-top: 4px;
     letter-spacing: 0.05em;
   }

   /* Live Indicator */
   .live-indicator {
     display: inline-flex;
     align-items: center;
     gap: 6px;
   }

   .live-indicator::before {
     content: '';
     width: 8px;
     height: 8px;
     background: var(--color-live);
     border-radius: 50%;
     animation: pulse-live 1.5s infinite;
   }

   @keyframes pulse-live {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.5; }
   }

   /* Rank Badges */
   .rank-badge {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     min-width: 32px;
     height: 24px;
     font-family: var(--font-mono);
     font-weight: 600;
     font-size: 12px;
   }

   .rank-badge.rank-1 {
     color: #FFD700;
   }

   .rank-badge.rank-2 {
     color: #C0C0C0;
   }

   .rank-badge.rank-3 {
     color: #CD7F32;
   }

4. Update focus styles for accessibility:

   /* Visible focus for keyboard navigation */
   *:focus-visible {
     outline: 2px solid var(--color-primary);
     outline-offset: 2px;
   }

   /* Remove default focus for mouse users */
   *:focus:not(:focus-visible) {
     outline: none;
   }

   /* Button focus states */
   button:focus-visible,
   [role="button"]:focus-visible {
     box-shadow: var(--focus-ring);
   }

5. Add reduced motion support:

   @media (prefers-reduced-motion: reduce) {
     *,
     *::before,
     *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }

6. KEEP these existing styles (verify they're present):

   - Mini stat bars (if used for data visualization)
   - Tactical-row hover effects (if simple)
   - Screen reader only class (.sr-only)
   - Skip to content styles

VERIFICATION:
- All glassmorphism effects removed
- Text contrast meets WCAG AA (use browser DevTools)
- Focus indicators visible on all interactive elements
- Reduced motion respected when OS setting enabled
- No broken layouts from removed classes
```

---

### Prompt 3: Update Button Component (ENHANCED)

```
UPDATE BUTTON COMPONENT FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/ui/Button.jsx (or .tsx)

Read the current implementation first. Note any existing props and ensure
backward compatibility.

REQUIREMENTS (from audit):
- Must include proper TypeScript types
- Must be memoized with React.memo
- Must have proper focus states for accessibility
- Must support loading state with accessible announcements

Tasks:

1. Convert to TypeScript if not already:
   Rename to Button.tsx

2. Define comprehensive types:

   type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
   type ButtonSize = 'sm' | 'md' | 'lg';

   interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: ButtonVariant;
     size?: ButtonSize;
     isLoading?: boolean;
     loadingText?: string;
     leftIcon?: React.ReactNode;
     rightIcon?: React.ReactNode;
     fullWidth?: boolean;
   }

3. Implement with memoization:

   const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
     function Button(
       {
         variant = 'primary',
         size = 'md',
         isLoading = false,
         loadingText,
         leftIcon,
         rightIcon,
         fullWidth = false,
         disabled,
         className,
         children,
         ...props
       },
       ref
     ) {
       const isDisabled = disabled || isLoading;

       return (
         <button
           ref={ref}
           disabled={isDisabled}
           aria-busy={isLoading}
           aria-disabled={isDisabled}
           className={clsx(
             // Base styles
             'inline-flex items-center justify-center font-medium transition-colors',
             'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
             'disabled:opacity-50 disabled:cursor-not-allowed',

             // Variant styles
             variants[variant],

             // Size styles
             sizes[size],

             // Full width
             fullWidth && 'w-full',

             className
           )}
           {...props}
         >
           {isLoading ? (
             <>
               <Spinner size="sm" className="mr-2" />
               <span>{loadingText || children}</span>
               <span className="sr-only">Loading</span>
             </>
           ) : (
             <>
               {leftIcon && <span className="mr-2">{leftIcon}</span>}
               {children}
               {rightIcon && <span className="ml-2">{rightIcon}</span>}
             </>
           )}
         </button>
       );
     }
   ));

4. Define variant styles (NO GLOW EFFECTS):

   const variants: Record<ButtonVariant, string> = {
     primary: clsx(
       'bg-[#0057B8] text-white',
       'hover:bg-[#004494]',
       'focus-visible:ring-[#0057B8]'
     ),
     secondary: clsx(
       'bg-transparent text-white',
       'border border-white/20',
       'hover:border-white/40 hover:bg-white/5'
     ),
     danger: clsx(
       'bg-red-600 text-white',
       'hover:bg-red-700',
       'focus-visible:ring-red-600'
     ),
     ghost: clsx(
       'bg-transparent text-white',
       'hover:bg-white/5'
     ),
     link: clsx(
       'bg-transparent text-[#0057B8]',
       'hover:underline',
       'p-0 h-auto'
     ),
   };

5. Define size styles:

   const sizes: Record<ButtonSize, string> = {
     sm: 'h-8 px-3 text-sm rounded',
     md: 'h-10 px-4 text-base rounded-md',
     lg: 'h-12 px-6 text-lg rounded-md',
   };

6. REMOVE these props (backward compatibility warning):

   If these props exist, log deprecation warning:
   - 'glowing' prop
   - 'gold' variant
   - 'brutalist' variant
   - 'glassmorphism' prop

   // Add deprecation warning
   if (process.env.NODE_ENV !== 'production') {
     if ('glowing' in props) {
       console.warn('Button: "glowing" prop is deprecated and will be ignored');
     }
   }

7. Export properly:

   export { Button };
   export type { ButtonProps, ButtonVariant, ButtonSize };

VERIFICATION:
- All existing button usages compile without error
- Search codebase for <Button and verify each works
- Test keyboard navigation (Tab, Enter, Space)
- Test screen reader announcements during loading
- Visual check: no gold/glow effects
```

---

### Prompt 4: Create Data Table Component (ENHANCED)

```
CREATE ESPN-STYLE DATA TABLE COMPONENT

Create new file: /home/user/marching.art/src/components/ui/DataTable.tsx

This is a core component for ESPN-style data presentation. Must be fully
accessible and performant.

REQUIREMENTS (from audit):
- Must use React.memo for row components
- Must have proper ARIA table semantics
- Must support keyboard navigation
- Must be mobile-responsive with horizontal scroll

Implementation:

1. Define types:

   interface Column<T> {
     key: keyof T | string;
     label: string;
     align?: 'left' | 'center' | 'right';
     width?: string;
     sticky?: boolean;
     render?: (value: any, row: T, index: number) => React.ReactNode;
     sortable?: boolean;
   }

   interface DataTableProps<T> {
     columns: Column<T>[];
     data: T[];
     keyField: keyof T;
     highlightRow?: (row: T) => boolean;
     onRowClick?: (row: T) => void;
     sortable?: boolean;
     compact?: boolean;
     stickyHeader?: boolean;
     emptyMessage?: string;
     className?: string;
     ariaLabel: string; // Required for accessibility
   }

2. Implement table with accessibility:

   function DataTableComponent<T extends Record<string, any>>({
     columns,
     data,
     keyField,
     highlightRow,
     onRowClick,
     sortable = false,
     compact = false,
     stickyHeader = true,
     emptyMessage = 'No data available',
     className,
     ariaLabel,
   }: DataTableProps<T>) {
     const [sortConfig, setSortConfig] = useState<{
       key: string;
       direction: 'asc' | 'desc';
     } | null>(null);

     const sortedData = useMemo(() => {
       if (!sortConfig) return data;

       return [...data].sort((a, b) => {
         const aVal = a[sortConfig.key];
         const bVal = b[sortConfig.key];

         if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
         if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
         return 0;
       });
     }, [data, sortConfig]);

     const handleSort = useCallback((key: string) => {
       setSortConfig(current => {
         if (current?.key !== key) return { key, direction: 'asc' };
         if (current.direction === 'asc') return { key, direction: 'desc' };
         return null;
       });
     }, []);

     return (
       <div className="overflow-x-auto" role="region" aria-label={ariaLabel}>
         <table
           className={clsx('data-table', compact && 'data-table-compact', className)}
           role="table"
         >
           <thead className={stickyHeader ? 'sticky top-0 bg-surface z-10' : ''}>
             <tr role="row">
               {columns.map((column) => (
                 <th
                   key={String(column.key)}
                   role="columnheader"
                   scope="col"
                   style={{
                     width: column.width,
                     textAlign: column.align || 'left',
                   }}
                   className={clsx(
                     column.sticky && 'sticky left-0 bg-surface',
                     column.sortable && sortable && 'cursor-pointer hover:text-white'
                   )}
                   onClick={() => column.sortable && sortable && handleSort(String(column.key))}
                   aria-sort={
                     sortConfig?.key === column.key
                       ? sortConfig.direction === 'asc'
                         ? 'ascending'
                         : 'descending'
                       : undefined
                   }
                 >
                   <div className="flex items-center gap-1">
                     {column.label}
                     {sortConfig?.key === column.key && (
                       <span aria-hidden="true">
                         {sortConfig.direction === 'asc' ? '▲' : '▼'}
                       </span>
                     )}
                   </div>
                 </th>
               ))}
             </tr>
           </thead>
           <tbody>
             {sortedData.length === 0 ? (
               <tr>
                 <td
                   colSpan={columns.length}
                   className="text-center py-8 text-text-muted"
                 >
                   {emptyMessage}
                 </td>
               </tr>
             ) : (
               sortedData.map((row, index) => (
                 <DataTableRow
                   key={String(row[keyField])}
                   row={row}
                   index={index}
                   columns={columns}
                   isHighlighted={highlightRow?.(row)}
                   onClick={onRowClick}
                 />
               ))
             )}
           </tbody>
         </table>
       </div>
     );
   }

3. Create memoized row component:

   interface DataTableRowProps<T> {
     row: T;
     index: number;
     columns: Column<T>[];
     isHighlighted?: boolean;
     onClick?: (row: T) => void;
   }

   const DataTableRow = memo(function DataTableRow<T extends Record<string, any>>({
     row,
     index,
     columns,
     isHighlighted,
     onClick,
   }: DataTableRowProps<T>) {
     const handleClick = useCallback(() => {
       onClick?.(row);
     }, [onClick, row]);

     const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
       if ((e.key === 'Enter' || e.key === ' ') && onClick) {
         e.preventDefault();
         onClick(row);
       }
     }, [onClick, row]);

     return (
       <tr
         role="row"
         className={clsx(
           isHighlighted && 'highlight-row',
           onClick && 'cursor-pointer'
         )}
         onClick={onClick ? handleClick : undefined}
         onKeyDown={onClick ? handleKeyDown : undefined}
         tabIndex={onClick ? 0 : undefined}
         aria-selected={isHighlighted}
       >
         {columns.map((column) => {
           const value = row[column.key as keyof T];
           const rendered = column.render
             ? column.render(value, row, index)
             : value;

           return (
             <td
               key={String(column.key)}
               role="cell"
               style={{ textAlign: column.align || 'left' }}
               className={column.sticky ? 'sticky left-0 bg-surface' : ''}
             >
               {rendered}
             </td>
           );
         })}
       </tr>
     );
   }) as <T>(props: DataTableRowProps<T>) => JSX.Element;

4. Create TrendIndicator component:

   Create /home/user/marching.art/src/components/ui/TrendIndicator.tsx:

   interface TrendIndicatorProps {
     value: number;
     showValue?: boolean;
     size?: 'sm' | 'md';
   }

   export const TrendIndicator = memo(function TrendIndicator({
     value,
     showValue = true,
     size = 'md',
   }: TrendIndicatorProps) {
     const isPositive = value > 0;
     const isNegative = value < 0;
     const isNeutral = value === 0;

     return (
       <span
         className={clsx(
           'inline-flex items-center gap-1 font-mono',
           size === 'sm' && 'text-xs',
           size === 'md' && 'text-sm',
           isPositive && 'trend-up',
           isNegative && 'trend-down',
           isNeutral && 'trend-neutral'
         )}
         aria-label={
           isPositive ? `Up ${value}` :
           isNegative ? `Down ${Math.abs(value)}` :
           'No change'
         }
       >
         <span aria-hidden="true">
           {isPositive ? '▲' : isNegative ? '▼' : '—'}
         </span>
         {showValue && (
           <span>
             {isPositive && '+'}
             {value.toFixed(1)}
           </span>
         )}
       </span>
     );
   });

5. Add compact variant styles to index.css:

   .data-table-compact th {
     padding: 6px 8px;
   }

   .data-table-compact td {
     padding: 6px 8px;
   }

VERIFICATION:
- Table is keyboard navigable (Tab through rows)
- Screen reader announces table structure correctly
- Horizontal scroll works on mobile with sticky first column
- Sorting works and is announced to screen readers
- Highlighted row is visually distinct and announced
- No performance issues with 100+ rows (check React DevTools)
```

---

[Continue with remaining prompts, each enhanced with similar detail...]

---

## Prompt 5: Update Card Component (ENHANCED)

```
UPDATE CARD COMPONENT FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/ui/Card.tsx

REQUIREMENTS (from audit):
- Convert to TypeScript with proper types
- Add React.memo for CardHeader, CardBody, CardFooter
- Remove all glassmorphism effects
- Maintain accessibility

Tasks:

1. Define types:

   type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';
   type CardPadding = 'none' | 'sm' | 'md' | 'lg';

   interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
     variant?: CardVariant;
     padding?: CardPadding;
     as?: React.ElementType;
   }

   interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
     className?: string;
   }

2. Implement Card with compound components:

   const CardRoot = forwardRef<HTMLDivElement, CardProps>(
     function Card({ variant = 'default', padding = 'md', className, children, as: Component = 'div', ...props }, ref) {
       return (
         <Component
           ref={ref}
           className={clsx(
             'rounded-md',
             variants[variant],
             paddings[padding],
             className
           )}
           {...props}
         >
           {children}
         </Component>
       );
     }
   );

   const variants: Record<CardVariant, string> = {
     default: 'bg-surface-elevated border border-white/10 shadow-card',
     elevated: 'bg-surface-card border border-white/10 shadow-lg',
     outlined: 'bg-transparent border border-white/20',
     interactive: clsx(
       'bg-surface-elevated border border-white/10 shadow-card',
       'transition-all duration-200',
       'hover:border-white/30 hover:shadow-lg',
       'focus-within:ring-2 focus-within:ring-primary'
     ),
   };

   const paddings: Record<CardPadding, string> = {
     none: '',
     sm: 'p-3',
     md: 'p-4',
     lg: 'p-6',
   };

3. Create memoized sub-components:

   const CardHeader = memo(function CardHeader({ className, children, ...props }: CardSectionProps) {
     return (
       <div
         className={clsx('flex items-center justify-between mb-4', className)}
         {...props}
       >
         {children}
       </div>
     );
   });

   const CardTitle = memo(function CardTitle({ className, children, ...props }: CardSectionProps) {
     return (
       <h3
         className={clsx('text-lg font-semibold text-white', className)}
         {...props}
       >
         {children}
       </h3>
     );
   });

   const CardBody = memo(function CardBody({ className, children, ...props }: CardSectionProps) {
     return (
       <div className={clsx('', className)} {...props}>
         {children}
       </div>
     );
   });

   const CardFooter = memo(function CardFooter({ className, children, ...props }: CardSectionProps) {
     return (
       <div
         className={clsx('flex items-center justify-end gap-2 mt-4 pt-4 border-t border-white/10', className)}
         {...props}
       >
         {children}
       </div>
     );
   });

4. Export as compound component:

   export const Card = Object.assign(CardRoot, {
     Header: CardHeader,
     Title: CardTitle,
     Body: CardBody,
     Footer: CardFooter,
   });

   // Also export individually for flexibility
   export { CardHeader, CardTitle, CardBody, CardFooter };
   export type { CardProps, CardVariant, CardPadding };

5. DEPRECATION: Add warnings for removed props:

   const deprecatedProps = ['accentGlow', 'glassmorphism', 'gradientBorder'];

   if (process.env.NODE_ENV !== 'production') {
     for (const prop of deprecatedProps) {
       if (prop in props) {
         console.warn(`Card: "${prop}" prop is deprecated and will be ignored`);
       }
     }
   }

6. Update all existing Card usages in codebase:

   Search for:
   - <Card.*accentGlow - Remove prop
   - <Card.*glassmorphism - Remove prop
   - <Card.*gradientBorder - Remove prop

   These will need manual updates if they relied on these effects.

VERIFICATION:
- npm run build completes without errors
- All Card instances render correctly
- No glassmorphism effects visible
- Card.Header, Card.Body, Card.Footer work correctly
- Interactive cards have visible focus states
```

---

## ADDITIONAL ENHANCEMENT: Testing Checkpoint Prompts

Add these after each phase:

### Testing Checkpoint 1 (After Phase 1)

```
TESTING CHECKPOINT: VERIFY DESIGN SYSTEM CHANGES

After completing Prompts 1-2, verify:

1. Visual Checks:
   □ No gold glow effects visible anywhere
   □ No glassmorphism (frosted glass) effects
   □ DCI Blue (#0057B8) is primary color
   □ All text is readable (contrast check)
   □ Dark theme is consistent

2. Functional Checks:
   □ npm run build completes without errors
   □ npm run dev starts without errors
   □ All pages load without console errors
   □ No broken layouts

3. Accessibility Checks:
   □ Focus indicators visible (Tab through app)
   □ Reduced motion setting respected
   □ Text contrast meets WCAG AA

4. Regression Checks:
   □ Authentication still works
   □ Navigation works
   □ Data displays correctly
   □ Forms submit correctly

If ANY check fails, fix before proceeding to Phase 2.

Create commit: "Phase 1 complete: Design system updated to ESPN style"
```

### Testing Checkpoint 2 (After Phase 2)

```
TESTING CHECKPOINT: VERIFY CORE UI COMPONENTS

After completing Prompts 3-7, verify:

1. Button Component:
   □ All variants render correctly (primary, secondary, danger, ghost, link)
   □ All sizes work (sm, md, lg)
   □ Loading state shows spinner
   □ Disabled state is styled correctly
   □ Keyboard accessible (Tab, Enter, Space)

2. DataTable Component:
   □ Renders with sample data
   □ Sorting works (if enabled)
   □ Highlighted rows visible
   □ Keyboard navigable
   □ Screen reader announces correctly
   □ Mobile horizontal scroll works

3. Card Component:
   □ All variants render (default, elevated, outlined, interactive)
   □ Compound components work (Header, Body, Footer)
   □ No old glassmorphism effects

4. Stats Components:
   □ StatCard displays correctly
   □ StatRow is responsive
   □ TrendIndicator shows up/down/neutral
   □ RankBadge shows medal colors for top 3

5. Badge Component:
   □ All variants work
   □ LiveBadge pulses
   □ ClassBadge colors correct

Run: npm run test to verify unit tests pass.

Create commit: "Phase 2 complete: Core UI components updated"
```

---

## SUMMARY OF ENHANCEMENTS

### New Prompts Added (11 total):
- **0.1**: Remove hardcoded credentials (CRITICAL SECURITY)
- **0.2**: Fix URL token authentication (CRITICAL SECURITY)
- **0.3**: Sanitize error messages (SECURITY)
- **0.4**: Consolidate duplicate utilities (CODE QUALITY)
- **0.5**: Remove dead code and console statements (CODE QUALITY)
- **0.6**: Split oversized components (CODE QUALITY)
- **0.7**: Add memoization patterns (PERFORMANCE)
- **0.8**: Fix accessibility foundation (ACCESSIBILITY)
- **Testing Checkpoint 1**: After design system
- **Testing Checkpoint 2**: After components
- **Testing Checkpoint 3**: After pages (add similarly)

### Enhancements to Existing Prompts:
1. Added prerequisite checks to each prompt
2. Added TypeScript types requirements
3. Added React.memo requirements for components
4. Added accessibility requirements (ARIA, keyboard, focus)
5. Added verification steps to each prompt
6. Added backward compatibility requirements
7. Added memoization patterns for event handlers

### Execution Order Updated:

**Phase 0 (BLOCKING - Do First):**
- 0.1 → 0.2 → 0.3 (Security - sequential)

**Phase 0.5 (Before Redesign):**
- 0.4 → 0.5 (can parallelize)
- 0.6 → 0.7 → 0.8 (sequential)

**Phase 1-5:**
- Execute as original plan with enhanced prompts
- Run testing checkpoints after each phase

**Total Estimated Prompts:** 28-30

### Files That Will Be Modified:

**Security Fixes:**
- src/config/index.ts
- src/App.jsx
- firestore.rules
- functions/src/callable/*.js
- functions/src/webhooks/stripe.js

**Code Quality:**
- src/utils/corps.ts (new)
- src/utils/season.ts (new)
- src/utils/logger.ts (new)
- src/hooks/useDashboardData.js → split
- src/pages/Profile.jsx → split
- src/pages/Dashboard.jsx → split
- src/pages/Leagues.jsx → split

**Performance:**
- src/App.jsx (context memoization)
- src/context/ThemeContext.jsx
- src/hooks/useScoresData.js
- src/components/Admin/ScoresSpreadsheet.jsx

**Accessibility:**
- src/components/ui/Tabs.tsx
- src/components/ui/Modal.tsx
- src/components/Scores/ShowDetailModal.jsx
- src/components/Scores/ShowCard.jsx
- src/components/Layout/GameShell.jsx

**Design System:**
- tailwind.config.cjs
- src/index.css
- src/components/ui/*.tsx (all)
- src/pages/*.jsx (all)
