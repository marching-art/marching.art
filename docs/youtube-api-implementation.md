# YouTube API Implementation Design Document

## Application: marching.art

**Document Version:** 1.0
**Date:** January 2026
**API Client:** marching.art Web Application

---

## 1. Overview

marching.art is a web application serving the drum corps community. The application displays live competition scores and standings for Drum Corps International (DCI) events. Users can click on any corps name to watch their performance video embedded directly on the site.

### 1.1 Purpose of YouTube Integration

The YouTube integration allows users to:
- View official corps performance videos without leaving the site
- Quickly access performances while following live competition scores
- Watch historical performances from past seasons

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                           │
│  Landing.jsx / Article.jsx                                      │
│  - User clicks YouTube icon next to corps name                  │
│  - Calls Firebase callable function                             │
│  - Displays video in modal using YouTube iframe embed           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE CLOUD FUNCTION                       │
│  searchYoutubeVideo (callable)                                  │
│  - Checks Firestore cache first                                 │
│  - If cache miss: calls YouTube Data API                        │
│  - Filters results by title, year, duration                     │
│  - Caches result in Firestore                                   │
│  - Returns video ID to client                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│    FIRESTORE CACHE       │    │    YOUTUBE DATA API      │
│  Collection: youtubeCache│    │  - search.list           │
│  - Stores video results  │    │  - videos.list           │
│  - Permanent cache       │    │  (only on cache miss)    │
└──────────────────────────┘    └──────────────────────────┘
```

---

## 3. YouTube API Services Used

### 3.1 YouTube Data API v3

#### search.list Endpoint
- **Purpose:** Find corps performance videos
- **Quota Cost:** 100 units per request
- **Parameters Used:**
  - `part=snippet` - Get video metadata
  - `q={query}` - Search query (e.g., "2024 Blue Devils corps")
  - `type=video` - Only return videos
  - `maxResults=25` - Get enough results to filter
  - `videoEmbeddable=true` - Only embeddable videos

#### videos.list Endpoint
- **Purpose:** Get video duration for filtering
- **Quota Cost:** 1 unit per video
- **Parameters Used:**
  - `part=contentDetails` - Get duration metadata
  - `id={videoIds}` - Comma-separated video IDs

### 3.2 YouTube Embeds
- Videos displayed using official YouTube iframe embed
- Privacy-enhanced mode: `youtube-nocookie.com`
- Parameters: `autoplay=1&vq=hd720&rel=0`

---

## 4. Data Flow

### 4.1 User Search Flow

```
1. User views competition standings on marching.art
2. User clicks YouTube icon next to "Blue Devils" (2024 season)
3. Client calls: searchYoutubeVideo({ query: "2024 Blue Devils corps" })
4. Firebase function checks Firestore cache
   - Cache key: "2024_blue_devils_corps"
5. If CACHE HIT:
   - Return cached video ID immediately
   - No YouTube API calls made
6. If CACHE MISS:
   - Call YouTube search.list API (100 units)
   - Filter results by:
     a. Title must contain year (2024 or 24)
     b. Title must NOT contain blacklisted words
     c. Duration must be 8-15 minutes
   - Prioritize videos with "finals" in title
   - Call videos.list API for duration (1 unit per video)
   - Cache result in Firestore
   - Return video ID to client
7. Client displays video in modal using iframe embed
```

### 4.2 Cache Refresh Flow

```
1. User sees wrong/unavailable video in modal
2. User clicks "Refresh" button
3. Client calls: searchYoutubeVideo({ query: "...", skipCache: true })
4. Firebase function bypasses cache
5. Fresh YouTube API search performed
6. New result cached, replacing old entry
7. Updated video displayed to user
```

---

## 5. Video Filtering Logic

### 5.1 Title Blacklist
Videos with these words in the title are excluded:
- `lot` - Parking lot rehearsals
- `drumline`, `hornline`, `brass`, `battery`, `pit` - Section-only videos
- `guard` - Color guard only
- `snare`, `snareline` - Percussion section
- `camp` - Band camp footage
- `vlog` - Personal vlogs
- `percussion`, `warmup`, `warm up`, `warm-up` - Warmup footage
- `encore` - Encore performances (not full show)
- `headcam`, `cam` - POV/camera footage

### 5.2 Year Matching
- Query extracts year from search (e.g., "2024" from "2024 Blue Devils corps")
- Video title must contain full year (2024) OR short year (24)
- Examples that match: "Blue Devils 2024 Finals", "BD 8-10-24"

### 5.3 Duration Filtering
- Minimum: 8 minutes (full show minimum)
- Maximum: 15 minutes (full show maximum)
- Filters out clips, highlights, and multi-show compilations

### 5.4 Finals Prioritization
- After filtering, videos with "finals" in title are prioritized
- Finals performances are typically highest quality recordings

---

## 6. Caching Strategy

### 6.1 Cache Structure

**Collection:** `youtubeCache`

**Document ID:** Normalized query (e.g., `2024_blue_devils_corps`)

**Document Fields:**
```json
{
  "success": true,
  "found": true,
  "videoId": "KfC6Xgy4ZL4",
  "title": "Santa Clara Vanguard 2018 - Babylon",
  "thumbnail": "https://i.ytimg.com/vi/KfC6Xgy4ZL4/hqdefault.jpg",
  "channelTitle": "Drum Corps Archive",
  "cachedAt": "2026-01-08T01:30:00.000Z"
}
```

### 6.2 Cache Duration
- **Permanent:** Historical corps performances don't change
- **Manual Refresh:** Users can click "Refresh" to update stale entries
- **On Refresh:** Old cache entry is overwritten with new result

### 6.3 Cache Benefits
- Dramatically reduces API quota usage
- Faster response times for repeat searches
- 1000+ unique corps/year combinations can be cached
- After cache warmup, daily API usage approaches zero

---

## 7. Quota Usage Analysis

### 7.1 Per-Search Cost
| Operation | Units |
|-----------|-------|
| search.list | 100 |
| videos.list (25 videos) | 25 |
| **Total per cache miss** | **125** |

### 7.2 Daily Usage Scenarios

| Scenario | API Calls | Units |
|----------|-----------|-------|
| Cache fully warmed | 0 | 0 |
| New competition day (50 corps) | 50 | 6,250 |
| Typical day (10 cache misses) | 10 | 1,250 |
| DCI Finals (worst case) | 50 | 6,250 |

### 7.3 Requested Quota
- **Current:** 10,000 units/day
- **Requested:** 50,000 units/day
- **Justification:** 4-8x buffer for development, cache warming, and unexpected spikes

---

## 8. Compliance

### 8.1 YouTube Terms of Service
- Videos embedded using official YouTube iframe API
- No downloading or redistribution of content
- Proper attribution displayed (video title, channel name)
- Privacy-enhanced mode enabled (youtube-nocookie.com)

### 8.2 Data Storage
- Only metadata stored (video ID, title, thumbnail URL, channel)
- No video content downloaded or cached
- Users directed to YouTube for playback

### 8.3 User Experience
- Clear YouTube branding in modal
- "More Results" link to YouTube search
- "Refresh" option for stale results

---

## 9. Technical Implementation

### 9.1 Firebase Function Code Location
`/functions/src/callable/youtube.js`

### 9.2 Client Code Locations
- `/src/pages/Landing.jsx` - Main scores page
- `/src/pages/Article.jsx` - Article detail page

### 9.3 API Key Security
- Stored in Firebase Secrets (not in source code)
- Only accessible by Firebase Cloud Functions
- Never exposed to client-side code

---

## 10. Screenshots

### 10.1 Standings with YouTube Icons
Users see YouTube icon next to each corps name in the standings list.

### 10.2 Video Modal
When clicked, a modal overlay displays:
- Video player (720p, autoplay)
- Video title
- Search query used
- "Refresh" button (for cache refresh)
- "More Results" link to YouTube

### 10.3 Modal Footer
```
Search: "2024 Blue Devils corps"    [Refresh] [More Results →]
```

---

## 11. Contact

**Application:** marching.art
**Developer:** [Your Name]
**Email:** [Your Email]

---

*This document describes the implementation of YouTube API Services in the marching.art web application as of January 2026.*
