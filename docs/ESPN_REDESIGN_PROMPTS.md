# ESPN Fantasy Sports Redesign - Implementation Prompts

## Overview
This document contains a series of sequential prompts to transform marching.art from its current "Stadium HUD" glassmorphism design to an ESPN Fantasy Sports-inspired data-rich, professional sports presentation.

**Total Prompts: 15**
**Estimated Implementation: Execute in order**

---

## PHASE 1: DESIGN SYSTEM FOUNDATION

### Prompt 1: Update Tailwind Design Tokens

```
UPDATE THE TAILWIND DESIGN SYSTEM FOR ESPN FANTASY STYLE

Context: We're redesigning marching.art from a "Stadium HUD" glassmorphism style to an ESPN Fantasy Sports professional data presentation style.

File to modify: /home/user/marching.art/tailwind.config.cjs

Tasks:
1. Replace the color system with ESPN-inspired palette:
   - Remove gold glow colors as primary accent
   - Add DCI Blue (#0057B8) as brand color
   - Add ESPN-style semantic colors:
     - trend-up: #00c853 (green)
     - trend-down: #ff3d00 (red)
     - trend-neutral: #9e9e9e (gray)
     - live: #ff0000 (red pulse for live indicators)
   - Keep dark backgrounds but simplify:
     - background: #0a0a0a
     - surface: #1a1a1a
     - card: #2a2a2a
     - elevated: #333333

2. Replace box shadows - remove all glow effects:
   - 'sm': '0 1px 2px rgba(0,0,0,0.5)'
   - 'md': '0 2px 4px rgba(0,0,0,0.5)'
   - 'lg': '0 4px 8px rgba(0,0,0,0.5)'
   - 'card': '0 2px 8px rgba(0,0,0,0.4)'
   - Remove: gold-glow-*, glow-*, stadium-*, glass-*

3. Update border radius to be more subtle:
   - 'sm': '4px'
   - DEFAULT: '6px'
   - 'md': '8px'
   - 'lg': '12px'

4. Remove stadium-lights, stadium-glow background images

5. Keep useful animations but remove:
   - pulse-gold
   - glow
   - float
   - boot-grid

After changes, the design should feel: clean, professional, data-focused, like a sports broadcast.

Do NOT change: font families (keep Inter, Oswald, JetBrains Mono)
```

---

### Prompt 2: Update CSS Variables and Base Styles

```
UPDATE INDEX.CSS FOR ESPN FANTASY STYLE

Context: Following the Tailwind update, we need to update the CSS custom properties and remove glassmorphism styles.

File to modify: /home/user/marching.art/src/index.css

Tasks:
1. Update CSS custom properties (:root):
   --color-primary: #0057B8 (DCI Blue)
   --color-primary-hover: #004494
   --color-surface: #1a1a1a
   --color-surface-elevated: #2a2a2a
   --color-text-main: #ffffff
   --color-text-secondary: #9a9a9a
   --color-text-muted: #666666
   --color-border: rgba(255,255,255,0.1)
   --color-border-strong: rgba(255,255,255,0.2)
   --color-trend-up: #00c853
   --color-trend-down: #ff3d00
   --color-live: #ff0000

2. Remove these CSS classes entirely:
   - .glass-panel and all variants
   - .stadium-banner
   - .stadium-overlay
   - .score-bug (replace with simpler .stat-badge)
   - .icon-card (replace with .action-card)
   - .ticket-stub-* variants
   - .glow-border-pulse
   - .paper-card
   - .dark-toolbar

3. Add new ESPN-style utility classes:
   .data-table { border-collapse: collapse; width: 100%; }
   .data-table th { text-transform: uppercase; font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--color-border); }
   .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border); font-variant-numeric: tabular-nums; }
   .data-table tr:hover { background: rgba(255,255,255,0.03); }
   .data-table .highlight-row { background: rgba(0,87,184,0.15); }

   .trend-up { color: var(--color-trend-up); }
   .trend-down { color: var(--color-trend-down); }
   .trend-neutral { color: var(--color-text-muted); }

   .stat-card { background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: 6px; padding: 16px; }
   .stat-value { font-family: var(--font-data); font-size: 28px; font-weight: 700; }
   .stat-label { font-size: 11px; text-transform: uppercase; color: var(--color-text-muted); margin-top: 4px; }

   .live-indicator { display: inline-flex; align-items: center; gap: 6px; }
   .live-indicator::before { content: ''; width: 8px; height: 8px; background: var(--color-live); border-radius: 50%; animation: pulse 1.5s infinite; }

4. Keep: Mini stat bars, rarity borders (for achievements), tactical-row hover

The goal is a cleaner, flatter design with high contrast and clear data hierarchy.
```

---

## PHASE 2: CORE UI COMPONENTS

### Prompt 3: Update Button Component

```
UPDATE BUTTON COMPONENT FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/ui/Button.jsx (or create if needed)

Read the current button implementation first, then update:

Tasks:
1. Remove glow effects and gold gradients
2. Create these variants:
   - primary: Solid DCI Blue (#0057B8), white text, no glow
   - secondary: Transparent with white border, white text
   - danger: Solid red (#ff3d00)
   - ghost: No background, just text with hover underline
   - link: Looks like a link

3. Sizes: sm, md, lg with appropriate padding

4. States:
   - hover: Slightly lighter background (not glow)
   - active: Slightly darker
   - disabled: 50% opacity, cursor not-allowed
   - loading: Spinner icon, disabled state

5. Remove: 'glowing' prop, gold variants, brutalist variants

Example implementation pattern:
const variants = {
  primary: 'bg-[#0057B8] hover:bg-[#004494] text-white',
  secondary: 'bg-transparent border border-white/20 hover:border-white/40 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-white/5 text-white',
}

Ensure all existing button usages in the codebase will still work (check for variant prop compatibility).
```

---

### Prompt 4: Create Data Table Component

```
CREATE ESPN-STYLE DATA TABLE COMPONENT

Create new file: /home/user/marching.art/src/components/ui/DataTable.jsx

This is a core component for ESPN-style data presentation.

Requirements:
1. Props:
   - columns: Array of { key, label, align?, width?, render? }
   - data: Array of row objects
   - highlightRow: Function to determine if row should be highlighted (e.g., user's row)
   - onRowClick: Optional click handler
   - sortable: Boolean to enable column sorting
   - compact: Boolean for denser display

2. Features:
   - Sticky header on scroll
   - Highlighted row styling (for "your" entry in leaderboards)
   - Rank column with special styling (#1, #2, #3 get medal colors)
   - Trend indicators (▲ green, ▼ red, — gray)
   - Monospace numbers (tabular-nums)
   - Hover state on rows
   - Optional zebra striping

3. Responsive behavior:
   - Horizontal scroll on mobile with sticky first column
   - Minimum column widths
   - Touch-friendly row height on mobile

4. Example usage:
<DataTable
  columns={[
    { key: 'rank', label: 'RK', width: '50px', align: 'center' },
    { key: 'name', label: 'TEAM', width: '200px' },
    { key: 'score', label: 'PTS', align: 'right', render: (val) => val.toFixed(2) },
    { key: 'trend', label: '', width: '60px', render: (val) => <TrendIndicator value={val} /> },
  ]}
  data={leaderboardData}
  highlightRow={(row) => row.userId === currentUser.uid}
/>

Also create: /home/user/marching.art/src/components/ui/TrendIndicator.jsx
- Shows ▲ +0.5 (green) or ▼ -0.3 (red) or — 0.0 (gray)
- Props: value (number), showValue (boolean)
```

---

### Prompt 5: Update Card Component

```
UPDATE CARD COMPONENT FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/ui/Card.tsx (or .jsx)

Read current implementation, then update:

Tasks:
1. Remove glassmorphism:
   - No backdrop-blur
   - No gold border glows
   - No gradient backgrounds

2. New card styles:
   - Simple solid background (#2a2a2a)
   - 1px border (rgba(255,255,255,0.1))
   - Subtle shadow (0 2px 8px rgba(0,0,0,0.3))
   - Border-radius: 6px

3. Variants:
   - default: Standard card
   - elevated: Slightly lighter background, stronger shadow
   - outlined: Just border, no background fill
   - interactive: Hover effect (border brightens, slight lift)

4. Remove props:
   - accentGlow
   - glassmorphism
   - gradientBorder

5. Keep/Add props:
   - padding: 'none' | 'sm' | 'md' | 'lg'
   - className (for composition)

6. Create CardHeader, CardBody, CardFooter subcomponents for structured layouts:
<Card>
  <CardHeader>
    <h3>MY CORPS</h3>
    <Badge>World Class</Badge>
  </CardHeader>
  <CardBody>...</CardBody>
  <CardFooter>
    <Button>Manage Lineup</Button>
  </CardFooter>
</Card>

Test: Ensure all existing Card usages don't break (search codebase for Card imports)
```

---

### Prompt 6: Create Stat Display Components

```
CREATE ESPN-STYLE STAT DISPLAY COMPONENTS

Create new file: /home/user/marching.art/src/components/ui/Stats.jsx

ESPN Fantasy shows stats prominently. Create these components:

1. StatCard - Single big stat
Props: label, value, trend?, subtitle?, icon?
<StatCard
  label="SEASON SCORE"
  value="847.20"
  trend={+2.5}
  subtitle="Rank #3 of 156"
/>
- Large value in monospace font
- Small uppercase label above
- Optional trend indicator
- Optional subtitle below

2. StatRow - Horizontal stat display
Props: stats (array of {label, value})
<StatRow stats={[
  { label: 'W-L', value: '6-1' },
  { label: 'PF', value: '847.2' },
  { label: 'PA', value: '802.1' },
  { label: 'STRK', value: 'W3' },
]} />
- Displays in a row with dividers
- All values in monospace
- Responsive: stacks on mobile

3. StatComparison - Side by side comparison
Props: left, right, labels
<StatComparison
  left={{ name: 'Blue Devils 2019', stats: { avg: 19.72, high: 19.95 } }}
  right={{ name: 'Crown 2022', stats: { avg: 19.45, high: 19.80 } }}
/>
- Used for caption comparisons
- Highlights which side is better per stat

4. MiniStat - Inline small stat
Props: label, value, inline?
<MiniStat label="AVG" value="19.72" />
- Very compact, for use in tables or tight spaces

5. RankBadge - Ranking display
Props: rank, total?, size?
<RankBadge rank={3} total={156} />
- Shows "#3" with gold/silver/bronze colors for top 3
- Optional "/156" suffix

Export all from Stats.jsx for easy importing.
```

---

### Prompt 7: Update Badge Component

```
UPDATE BADGE COMPONENT FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/ui/Badge.jsx (or .tsx)

ESPN uses simple, flat badges. Update:

1. Remove glow effects and gradients

2. Variants (solid background, no glow):
   - default: gray background, white text
   - primary: DCI Blue background
   - success: green background (#00c853)
   - danger: red background (#ff3d00)
   - warning: amber background (#f59e0b)
   - live: red with pulse animation
   - outline-*: Just border, no fill (for each color)

3. Sizes: xs, sm, md

4. Special badges:
   - ClassBadge: For corps class (SoundSport, A, Open, World)
     - Each class gets a specific color
     - World = gold outline
     - Open = blue
     - A = green
     - SoundSport = gray

   - RankBadge: "#1", "#2", "#3" with medal colors

   - LiveBadge: "LIVE" with red pulse dot

5. Props:
   - variant
   - size
   - children
   - icon (optional leading icon)
   - pulse (for live indicators)

Example:
<Badge variant="live" pulse>LIVE</Badge>
<Badge variant="outline-success">REGISTERED</Badge>
<ClassBadge class="world" />
```

---

## PHASE 3: LAYOUT & NAVIGATION

### Prompt 8: Update Navigation Components

```
UPDATE NAVIGATION FOR ESPN STYLE

Files to modify:
- /home/user/marching.art/src/components/CommandRail.jsx (desktop sidebar)
- /home/user/marching.art/src/components/BottomNav.tsx (mobile)
- /home/user/marching.art/src/components/Layout/GameShell.jsx

Tasks:

1. CommandRail.jsx (Desktop):
   - Remove gold accent colors
   - Use DCI Blue for active state
   - Simpler icons, no glow effects
   - Add notification badge support (red dot for alerts)
   - Navigation items: Dashboard, Scores, Schedule, Leagues, Profile
   - Footer: Settings gear, User avatar
   - Clean dark background (#1a1a1a), no gradients

2. BottomNav.tsx (Mobile):
   - Same items as desktop
   - Active state: DCI Blue icon + text
   - Inactive: gray icons
   - Notification dot on items with alerts
   - Safe area padding for iPhone notch

3. GameShell.jsx:
   - Remove atmospheric backgrounds (stadium lights)
   - Simple solid dark background
   - Remove vignette effects
   - Clean container with proper padding
   - Add global header bar with:
     - Season info: "2025 Season • Week 7 of 10"
     - Next show countdown (if applicable)
     - Notification bell icon
     - User dropdown

4. Create new component: /home/user/marching.art/src/components/Layout/TopBar.jsx
   - Horizontal bar above main content
   - Shows: Season context, alerts, user menu
   - ESPN-style: dark background, subtle bottom border

Ensure smooth transitions between pages (keep existing Framer Motion but simplify).
```

---

### Prompt 9: Create Score Ticker Component

```
CREATE ESPN-STYLE SCORE TICKER

Create new file: /home/user/marching.art/src/components/ScoreTicker.jsx

ESPN has a scrolling ticker showing live scores. Create one for marching.art:

Requirements:
1. Horizontal scrolling ticker at top of pages (below TopBar)
2. Shows:
   - During live shows: "LIVE: [Show Name] | [Corps] [Score] | [Corps] [Score] | ..."
   - Between shows: Latest results from most recent show
   - If user has corps: "YOUR SCORE: 94.12 (#3)"

3. Features:
   - Auto-scroll animation (CSS marquee-style, but smooth)
   - Pause on hover
   - Click item to go to full scores
   - "LIVE" indicator with pulse when scores are updating
   - Different background when live (subtle red tint)

4. Data source:
   - Connect to existing scores data from useScoresData hook
   - Or create new hook useTickerData that fetches latest show results

5. Props:
   - show: Show object with scores
   - isLive: Boolean
   - userScore: User's score if participating
   - onItemClick: Navigate to scores page

6. Responsive:
   - Full width ticker on desktop
   - Optional hide on mobile (configurable)
   - Touch scroll on mobile if shown

7. Styling:
   - Background: #1a1a1a
   - Border bottom: 1px solid rgba(255,255,255,0.1)
   - Text: Small, uppercase labels
   - Scores: Monospace, larger

Add to GameShell.jsx conditionally (only show when there's data).
```

---

## PHASE 4: PAGE REDESIGNS

### Prompt 10: Redesign Dashboard Page

```
REDESIGN DASHBOARD PAGE FOR ESPN STYLE

File to modify: /home/user/marching.art/src/pages/Dashboard.jsx

This is the most important page. Read the current implementation thoroughly first.

New layout structure:
┌─────────────────────────────────────────────────────────────────────┐
│ [TopBar: Season 2025 • Week 7 of 10 | Next: Atlanta Regional Sat]   │
├─────────────────────────────────────────────────────────────────────┤
│ [ScoreTicker: LIVE scores or recent results]                        │
├────────────────────────┬────────────────────────┬───────────────────┤
│ MY CORPS               │ STANDINGS              │ UPCOMING          │
│ [CorpsCard]            │ [DataTable]            │ [ShowList]        │
│ - Name, Class          │ - Top 10 + you         │ - Next 3 shows    │
│ - Season Score         │ - Your row highlighted │ - Register btn    │
│ - Rank & Trend         │ - Click for full       │                   │
│ - Quick Stats          │                        │                   │
│ - [Manage Lineup]      │                        │                   │
├────────────────────────┴────────────────────────┴───────────────────┤
│ YOUR LINEUP                                                          │
│ [LineupTable: 8 captions with scores, trends, edit capability]      │
│ TOTAL: 847.20 | BUDGET: 147/150 pts | [Edit Lineup]                 │
├─────────────────────────────────────────────────────────────────────┤
│ RECENT ACTIVITY (optional)                                          │
│ - Last show results                                                 │
│ - League matchup result                                             │
└─────────────────────────────────────────────────────────────────────┘

Components to create/use:
1. CorpsCard - Your corps summary (replace current hero section)
2. StandingsPreview - Compact leaderboard (use DataTable)
3. UpcomingShows - Next shows list
4. LineupTable - 8-row table with all caption data

Remove:
- Glassmorphism cards
- Gold glow effects
- Atmospheric backgrounds
- Execution metrics gauges (removed feature)
- Morning report modal
- Quick start guide

Keep:
- Core data hooks (useDashboardData)
- Navigation actions
- Modal triggers for editing

Data requirements (verify with hooks):
- User's corps data (name, class, score, rank)
- Current lineup with caption scores
- Leaderboard top 10 + user position
- Upcoming shows (next 3-5)
- Last show results

Make the page feel like ESPN's "My Team" page - all key info at a glance.
```

---

### Prompt 11: Redesign Scores Page

```
REDESIGN SCORES PAGE FOR ESPN STYLE

File to modify: /home/user/marching.art/src/pages/Scores.jsx

The Scores page is critical for the "real deal" feeling.

New layout:
┌─────────────────────────────────────────────────────────────────────┐
│ SCORES                                                [Filter ▼]    │
├─────────────────────────────────────────────────────────────────────┤
│ [Tabs: Latest | Rankings | Season Stats | Your Scores]              │
├─────────────────────────────────────────────────────────────────────┤
│ LATEST TAB:                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [ShowCard] Atlanta Regional - July 15, 2025                     │ │
│ │ World Class Results                              [Live Badge]   │ │
│ │ ┌───────────────────────────────────────────────────────────┐   │ │
│ │ │ RK  DIRECTOR        CORPS           SCORE    +/-          │   │ │
│ │ │ 1   BlueDevil99     Crown Reign     98.50    ▲ +1.2       │   │ │
│ │ │ 2   DrumMajor       BD Legacy       97.80    ▼ -0.3       │   │ │
│ │ │►3   YOU             YOUR CORPS      97.25    ▲ +0.8       │   │ │
│ │ │ 4   BrassKing       Cavalier...     96.90    — 0.0        │   │ │
│ │ └───────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ RANKINGS TAB:                                                       │
│ - Full season standings DataTable                                   │
│ - Class filter (World/Open/A/SoundSport)                           │
│ - Sortable by: Total Score, Weekly Avg, Best Week                  │
│ - Your row always highlighted                                       │
│                                                                     │
│ SEASON STATS TAB:                                                   │
│ - Aggregate statistics                                              │
│ - Highest scores, most improved, etc.                              │
│                                                                     │
│ YOUR SCORES TAB:                                                    │
│ - Week-by-week breakdown of your scores                            │
│ - Caption-by-caption performance                                    │
│ - Trend chart (simple line graph)                                  │
└─────────────────────────────────────────────────────────────────────┘

Components to create/update:
1. ShowResultCard - Display results for one show
2. Full DataTable implementation for standings
3. ClassFilter - Dropdown to filter by class
4. UserScoreBreakdown - Detailed view of user's caption scores

Update existing tabs in /src/components/Scores/tabs/:
- LatestScoresTab.jsx
- RankingsTab.jsx
- StatsTab.jsx

Remove:
- Glassmorphism score cards
- Gold glow effects
- CorpsDossier modal (simplify to inline expansion)

The scores page should feel like ESPN's scoreboard - dense data, easy scanning.
```

---

### Prompt 12: Redesign Schedule Page

```
REDESIGN SCHEDULE PAGE FOR ESPN STYLE

File to modify: /home/user/marching.art/src/pages/Schedule.jsx

Layout:
┌─────────────────────────────────────────────────────────────────────┐
│ SCHEDULE                                          [Calendar View]   │
├─────────────────────────────────────────────────────────────────────┤
│ [WeekSelector: ← Week 7 of 10 →]                                    │
├─────────────────────────────────────────────────────────────────────┤
│ THIS WEEK'S SHOWS                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ SAT JUL 15  Atlanta Regional                                    │ │
│ │             Atlanta, GA • World/Open                            │ │
│ │             [REGISTERED ✓]                    [View Details]    │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ SUN JUL 16  Georgia Invitational                               │ │
│ │             Macon, GA • All Classes                             │ │
│ │             [Register]                        [View Details]    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ YOUR REGISTERED SHOWS                                               │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Week 7: Atlanta Regional (Sat)                                  │ │
│ │ Week 8: DCI Southwestern (Sat), Texas Regional (Sun)           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Components to update:
1. /src/components/Schedule/ShowCard.jsx
   - Clean, flat design
   - Date prominently displayed
   - Location, classes available
   - Registration status badge
   - Quick register button

2. /src/components/Schedule/WeekTabs.jsx
   - Simple week navigation
   - Highlight current week

3. /src/components/Schedule/ShowsGrid.jsx
   - List view by default (not grid)
   - Optional grid view toggle

4. ShowRegistrationModal - Simplify, remove fancy animations

Remove:
- Ticket stub styling
- Glassmorphism effects
- Complex ticket metaphors

Add:
- Calendar view option (month view)
- "Your upcoming shows" summary section
- Countdown to next show

Keep show registration flow functional, just update the visual presentation.
```

---

### Prompt 13: Redesign Leagues Page

```
REDESIGN LEAGUES PAGE FOR ESPN STYLE

File to modify: /home/user/marching.art/src/pages/Leagues.jsx

ESPN's league pages show standings, matchups, and activity. Match that:

Layout when in a league:
┌─────────────────────────────────────────────────────────────────────┐
│ [League Name]                              [Leave] [Invite] [Chat]  │
│ Commissioner: @username • 8/12 members • Created Jun 2025          │
├─────────────────────────────────────────────────────────────────────┤
│ [Tabs: Standings | Matchups | History | Settings]                   │
├─────────────────────────────────────────────────────────────────────┤
│ STANDINGS TAB:                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ RK  TEAM              W-L    PF      PA     STRK   GB          │ │
│ │ 1   LeagueChamp      7-0   890.5   802.1   W7     —           │ │
│ │ 2   RunnerUp         6-1   875.2   810.5   W3     1.0         │ │
│ │►3   YOU              5-2   847.2   815.0   W2     2.0         │ │
│ │ ...                                                            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ MATCHUPS TAB:                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ WEEK 7 MATCHUPS                                                 │ │
│ │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │ │
│ │ │ YOU     94.5    │  │ Team A   92.1   │  │ Team C   89.0   │  │ │
│ │ │ vs              │  │ vs              │  │ vs              │  │ │
│ │ │ Rival   91.2    │  │ Team B   93.4   │  │ Team D   BYE    │  │ │
│ │ └─────────────────┘  └─────────────────┘  └─────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Layout when not in a league:
┌─────────────────────────────────────────────────────────────────────┐
│ LEAGUES                                                             │
├─────────────────────────────────────────────────────────────────────┤
│ [Create League] [Join with Code]                                    │
├─────────────────────────────────────────────────────────────────────┤
│ PUBLIC LEAGUES (Join Open)                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ League Name          Members    Created      [Join]             │ │
│ │ DCI Fanatics         18/20      Jun 2025    [Join]             │ │
│ │ World Class Only     12/16      Jun 2025    [Join]             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Components to update:
1. LeagueDetailView.jsx - Main league view
2. tabs/StandingsTab.jsx - Use DataTable
3. tabs/MatchupsTab.jsx - Matchup cards
4. tabs/ChatTab.jsx - Simple chat interface
5. CreateLeagueModal.jsx - Simplify form
6. LeagueCard.jsx - For league list

Remove:
- Complex glassmorphism cards
- TradesTab (already removed)
- Staff trading references

MatchupCard component:
- Shows two teams, their scores
- Winner highlighted
- "FINAL" or "IN PROGRESS" status
- Click to see detailed breakdown
```

---

### Prompt 14: Redesign Profile Page

```
REDESIGN PROFILE PAGE FOR ESPN STYLE

File to modify: /home/user/marching.art/src/pages/Profile.jsx

ESPN profiles show career stats and history:

Layout:
┌─────────────────────────────────────────────────────────────────────┐
│ PROFILE                                                             │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────┐  DirectorName                                         │
│ │  Avatar   │  Level 12 • Member since June 2024                    │
│ │           │  World Class Director                                 │
│ └───────────┘  847 CorpsCoin                                        │
├─────────────────────────────────────────────────────────────────────┤
│ [Tabs: Overview | Career Stats | History | Achievements]            │
├─────────────────────────────────────────────────────────────────────┤
│ OVERVIEW TAB:                                                       │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐        │
│ │ SEASONS         │ │ BEST FINISH     │ │ CAREER POINTS   │        │
│ │ 3               │ │ #2              │ │ 2,541.80        │        │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘        │
│                                                                     │
│ CURRENT SEASON                                                      │
│ Corps: Crown Reigners (World Class)                                │
│ Rank: #3 of 156 • Score: 847.20 • Weekly Avg: 94.13               │
│                                                                     │
│ CAREER STATS TAB:                                                   │
│ - Seasons played, total corps created                              │
│ - Average finish, best caption, etc.                               │
│                                                                     │
│ HISTORY TAB:                                                        │
│ - Season-by-season results table                                   │
│ - Past corps names and final placements                            │
│                                                                     │
│ ACHIEVEMENTS TAB:                                                   │
│ - Badge grid (keep current but remove glow effects)                │
│ - Progress on locked achievements                                   │
└─────────────────────────────────────────────────────────────────────┘

Components to update:
1. ProfileHeader.jsx - Clean stat display
2. tabs/OverviewTab.jsx - Key stats cards
3. tabs/StatsTab.jsx - Detailed career numbers
4. tabs/HistoryTab.jsx - Season history table
5. tabs/AchievementsTab.jsx - Badge grid (simplify styling)

Remove:
- Battle Pass integration (keep separate)
- Gold glow effects on achievements
- Complex animated stat displays

Settings section (integrated into Profile):
- Keep existing settings functionality
- Clean form styling
- Account management options
```

---

### Prompt 15: Update Caption Selection Modal

```
UPDATE CAPTION SELECTION FOR ESPN STYLE

File to modify: /home/user/marching.art/src/components/CaptionSelection/CaptionSelectionModal.jsx

This is a critical user flow. Make it feel professional:

Layout:
┌─────────────────────────────────────────────────────────────────────┐
│ DRAFT LINEUP                                              [X Close] │
├─────────────────────────────────────────────────────────────────────┤
│ Budget: 147/150 pts                    Class: World Class           │
├─────────────────────────────────────────────────────────────────────┤
│ CURRENT LINEUP                                                      │
│ ┌────────┬─────────────────────┬──────┬───────┬────────┬─────────┐ │
│ │ CAPTION│ SELECTION           │ YEAR │ COST  │ AVG    │ ACTION  │ │
│ │ GE1    │ Blue Devils         │ 2019 │ 14    │ 19.72  │ [Swap]  │ │
│ │ GE2    │ Carolina Crown      │ 2022 │ 13    │ 19.45  │ [Swap]  │ │
│ │ VP     │ — Not Selected —    │ —    │ —     │ —      │ [Select]│ │
│ │ ...    │                     │      │       │        │         │ │
│ └────────┴─────────────────────┴──────┴───────┴────────┴─────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [Search corps/year...]                     [Filter ▼] [Sort: Avg ▼]│
├─────────────────────────────────────────────────────────────────────┤
│ AVAILABLE OPTIONS (for selected caption)                            │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ CORPS              YEAR   COST   AVG     HIGH    CONSISTENCY   │ │
│ │ Blue Devils        2019   14     19.72   19.95   A+            │ │
│ │ Carolina Crown     2022   13     19.45   19.80   A             │ │
│ │ Santa Clara Vang.  2021   12     19.30   19.60   A             │ │
│ │ Bluecoats          2023   12     19.25   19.55   A-            │ │
│ │ ...                                                            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [Cancel]                                              [Save Lineup] │
└─────────────────────────────────────────────────────────────────────┘

Features to implement:
1. Current lineup table (always visible at top)
2. Click caption row to select/change it
3. Available options table with sorting
4. Budget remaining display (warn if over)
5. Search by corps name or year
6. Filter by: cost range, corps, year range

Data display per option:
- Corps name + year
- Point cost
- Season average
- Season high
- Consistency grade (A+, A, B+, etc.)
- Trend vs last week (optional)

Interaction:
- Click option to select/swap
- Immediate feedback on budget impact
- "Save Lineup" validates and saves

Remove:
- Complex grid layout
- Glassmorphism option cards
- Animated selection effects

Make it efficient - users should be able to draft quickly.

Also update: ShowConceptSelector.jsx if it's still used
- Simplify to a clean form
- Remove decorative elements
```

---

## PHASE 5: MOBILE & TESTING

### Prompt 16: Mobile Optimization Pass

```
OPTIMIZE ALL PAGES FOR MOBILE ESPN EXPERIENCE

Review each page and component for mobile-first design:

Tasks:
1. Navigation:
   - BottomNav should be fixed, 56px height
   - Safe area insets for notched phones
   - 5 items max: Dashboard, Scores, Schedule, Leagues, Profile

2. DataTable mobile behavior:
   - Horizontal scroll with sticky first column
   - Touch-friendly row height (48px minimum)
   - Consider card view alternative for complex tables

3. Dashboard mobile:
   - Stack all panels vertically
   - CorpsCard at top
   - Lineup as collapsible section
   - Upcoming shows as horizontal scroll

4. Scores mobile:
   - Tabs as scrollable pills
   - Simplified data tables
   - Pull-to-refresh

5. Schedule mobile:
   - List view only (no grid)
   - Large touch targets for register buttons
   - Show cards full-width

6. Leagues mobile:
   - Tab bar scrollable
   - Matchup cards stack vertically
   - Chat with proper keyboard handling

7. Profile mobile:
   - Header with avatar/name
   - Stats in 2x2 grid
   - Tabs below

8. Modals on mobile:
   - Full-screen on mobile
   - Slide-up animation
   - Sticky header/footer

Test on:
- iPhone SE (small)
- iPhone 14 Pro (notch)
- Android (various)
- Tablet (iPad)

Check:
- No horizontal scroll on main content
- Touch targets >= 44px
- Text readable without zoom
- Forms usable with keyboard
```

---

### Prompt 17: Final Testing & Cleanup

```
FINAL TESTING AND CLEANUP

After all components are updated:

1. Visual Regression Check:
   - Screenshot each page before/after
   - Ensure no broken layouts
   - Check dark mode consistency

2. Functional Testing:
   - User registration flow
   - Corps creation flow
   - Caption selection flow
   - Show registration
   - League creation/join
   - All modals open/close properly

3. Data Validation:
   - All existing data displays correctly
   - Scores calculate properly
   - Leaderboards sort correctly
   - User rankings accurate

4. Remove Dead Code:
   - Search for removed component imports
   - Remove unused CSS classes
   - Remove unused hooks/utilities
   - Clean up commented code

5. Performance Check:
   - Lighthouse audit
   - Check bundle size
   - Lazy loading working
   - No memory leaks

6. Accessibility:
   - Color contrast (WCAG AA)
   - Keyboard navigation
   - Screen reader labels
   - Focus indicators visible

7. Cross-Browser:
   - Chrome
   - Safari (iOS + Mac)
   - Firefox
   - Edge

8. Console Cleanup:
   - No errors in console
   - Remove debug logs
   - Handle all promise rejections

Create a test checklist document and verify each item.
```

---

## ADDITIONAL PROMPTS (As Needed)

### Prompt A: Update Loading States

```
UPDATE LOADING STATES FOR ESPN STYLE

Replace current loading spinners and skeletons:

1. Skeleton component (/src/components/Skeleton.tsx):
   - Simple gray pulsing bars
   - No shimmer animation (optional, subtle if kept)
   - Match exact layout of loaded content

2. Loading spinner:
   - Simple circular spinner in DCI Blue
   - No gold, no glow
   - Sizes: sm (16px), md (24px), lg (32px)

3. Page loading:
   - Skeleton layout matching page structure
   - Quick transition (no elaborate animations)

4. Button loading:
   - Spinner replaces text
   - Button stays same width
   - Disabled during loading
```

### Prompt B: Update Empty States

```
UPDATE EMPTY STATE COMPONENTS

File: /src/components/EmptyState.jsx and /src/components/EmptyStates.tsx

ESPN handles empty states cleanly:

1. Simple illustrations (or just icons)
2. Clear messaging
3. Action button when applicable

Updates:
- Remove decorative elements
- Use Lucide icons (gray, not gold)
- Centered layout
- Clear call-to-action button

Examples:
- No corps: "Create Your First Corps" + [Get Started]
- No league: "Join a League" + [Browse Leagues]
- No shows: "No Shows This Week"
- No scores: "Scores will appear after shows complete"
```

### Prompt C: Update Toast Notifications

```
UPDATE TOAST NOTIFICATIONS

File: Toaster config in /src/App.jsx

ESPN uses minimal, informative toasts:

1. Style updates:
   - Dark background (#2a2a2a)
   - White text
   - Simple border
   - No gold accents

2. Icons:
   - Success: Green checkmark
   - Error: Red X
   - Info: Blue info circle
   - Warning: Amber triangle

3. Duration:
   - Success: 3 seconds
   - Error: 5 seconds (longer to read)
   - Info: 4 seconds

4. Position: Top-right (desktop), Top-center (mobile)

5. Content:
   - Short, actionable messages
   - "Lineup saved" not "Your lineup has been saved successfully!"
```

---

## Execution Order

1. **Prompts 1-2**: Design system foundation (MUST DO FIRST)
2. **Prompts 3-7**: Core UI components
3. **Prompts 8-9**: Navigation and layout
4. **Prompts 10-15**: Page redesigns (can be parallelized)
5. **Prompt 16**: Mobile optimization
6. **Prompt 17**: Testing and cleanup
7. **Prompts A-C**: As needed for polish

---

## Notes for Implementer

- Always read existing code before modifying
- Maintain existing functionality - this is a visual update
- Test each change before moving to next prompt
- Commit after each major prompt completion
- Keep database queries/hooks unchanged unless necessary
- Preserve all Firebase integrations
- Maintain existing route structure
