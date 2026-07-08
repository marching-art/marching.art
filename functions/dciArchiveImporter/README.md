# DCI archive.org show-name enrichment (2000-2012)

The [From The Pressbox importer](../pressboxImporter/) backfilled 2000-2012
**scores**, but its recap workbooks carry no show titles, so most events land
with the placeholder name `DCI Competition - {City, State}` (e.g. 103 of 124
events in 2004). This importer recovers the **official show names** from the
Wayback Machine's snapshots of dci.org and overwrites those placeholders,
matched on date + city. Scores are never touched.

It also **completes abbreviated city names** in the pressbox `location` field
(`E Rutherford` -> `East Rutherford`, `Pt Huron` -> `Port Huron`) using the
archive spelling of the same event.

## The source

dci.org's ColdFusion scores page carried an "Other Scores" dropdown listing
every scored event of the season with its official name, division, date and
location:

```html
<select name="listboxmenu">
  <option value="/scores/?event_id={uuid}">
     7/28/04 - (DCI) SUMMER MUSIC GAMES in Cincinnati, Fairfield, OH</option>
```

The dropdown lists the season *to date*, so we harvest the **latest in-season
snapshot** of each year (late August through the fall) - after that the page
resets and only the corps-navigation dropdown remains.

The page and label formats changed over the years; this importer parses all
three eras:

| Years     | Source page                          | Event id / link           | Label format                              |
|-----------|--------------------------------------|---------------------------|-------------------------------------------|
| 2000-2003 | `showmonth.php` (monthly, see below) | `results.php?xId={n}`     | `(CLASS) Show Name, City, ST -- Month DD, YYYY` |
| 2004-2006 | `/scores/` dropdown                  | `?event_id={uuid}`        | `M/DD/YY - (CLASS) Show Name, City, ST`   |
| 2007-2010 | `/scores/` dropdown                  | `?event={uuid}`           | `City, ST (Show Name) - M/D/YY`           |
| 2011-2012 | `/scores/` dropdown                  | `index.cfm?event={uuid}`  | `City, ST (Show Name) - M/D/YY`           |

The 2000-2003 seasons predate the dropdown. Their scores live in monthly
`showmonth.php` pages listing `results.php?xId=` recap links. `harvest.js`
collects every archived month page for a season - both the parametrized
`showmonth.php?year=Y&month=M` captures and the bare `showmonth.php` captures
(which render the capture date's month) - and `parseShowmonth` dedups them by
the unique `xId`.

## Usage

```bash
cd functions/dciArchiveImporter

# Node's built-in fetch needs the proxy flag in the CC-on-web sandbox.
NODE_USE_ENV_PROXY=1 node harvest.js   # find + cache the best snapshot per year
node parse.js                          # cache/*.html -> output/names_{year}.json
node apply.js --dry-run                # preview the renames + city completions
node apply.js                          # patch ../pressboxImporter/output in place
```

`harvest.js` writes `snapshots.json` (the chosen Wayback capture per year) and
caches raw HTML in `cache/` (gitignored). `parse.js` writes committed
`output/names_{year}.json` + `output/report.json`, so `apply.js` can run
without re-harvesting. Flags: `--years 2004,2005`, and `harvest.js --force` to
re-download.

### Applying

`apply.js` is add-only and idempotent:

- **eventName** is overwritten *only* when the pressbox event still has a
  `DCI Competition - ...` placeholder. Already-titled events are left alone.
- **location** is rewritten *only* when the archive gives a more complete city
  spelling for the same matched event.

Two targets:

- **default** - patches `../pressboxImporter/output/historical_scores_{year}.json`
  in place, so the committed pressbox source becomes the merged truth. Push it
  with the pressbox importer: `cd ../pressboxImporter && node import.js --replace`
  (or the **Deploy Cloud Functions** workflow's `run_historical_import` checkbox).
- **`--firestore`** - re-plans against the live `historical_scores/{year}`
  documents and updates `eventName`/`location` directly (for data already
  imported). Uses `functions/serviceAccountKey.json` locally, or
  application-default credentials in CI, exactly like the pressbox `import.js`.

Because `apply.js` mutates the committed pressbox output, re-run it after any
future `pressboxImporter/parse.js` regeneration (which would restore the
placeholders).

## Matching

Every event is keyed on **`YYYY-MM-DD` + normalized city**. `normalizeCity`
lowercases, strips punctuation, drops doubleheader qualifiers (`Indianapolis II`
-> `indianapolis`) and expands abbreviations (`St.` -> `Saint`, `Pt` -> `Port`,
`E` -> `East`) so the two sources line up despite spelling differences.

- **Exact** date+city matches first.
- A conservative **±1-day** fallback then retries still-unmatched placeholders
  against the same city, accepting a match only when exactly one archive show
  falls within a day (source date-off-by-one is common).

City completion uses only **unambiguous** expansions (compass directions,
`Saint`/`Fort`/`Mount`); the ambiguous `Pt` (Port vs Point) is resolved solely
from the archive's already-spelled-out form, never guessed.

## Coverage

`output/report.json` records the per-year era, pages parsed, and event/titled
counts. As harvested (renames applied to the pressbox output):

| Year | Source        | Archive events | Placeholders renamed |
|------|---------------|----------------|----------------------|
| 2000 | -             | none archived  | 0                    |
| 2001 | showmonth     | 82             | 59                   |
| 2002 | showmonth     | 25 (Aug only)  | 13                   |
| 2003 | -             | none archived  | 0                    |
| 2004 | cfm           | 125            | 86                   |
| 2005 | cfm           | 139            | 94                   |
| 2006 | cfm           | 138            | 94                   |
| 2007 | cfm           | 132            | 86                   |
| 2008 | cfm           | 111            | 82                   |
| 2009 | -             | none archived  | 0                    |
| 2010 | cfm           | 112            | 70                   |
| 2011 | cfm           | 111            | 64                   |
| 2012 | cfm           | 106            | 66                   |

**714 placeholder eventNames** were replaced with official show names.

### Gaps

- **2000, 2003, 2009** have no usable Wayback capture: 2000/2003 predate a
  reliably-archived in-season `showmonth.php`, and dci.org's scores page simply
  wasn't captured during the 2009 season. To fill one later, drop a snapshot's
  HTML into `cache/` with the right name (`{year}.html` for the CFM dropdown,
  or `{year}-{month}.html` for showmonth) and re-run `parse.js` + `apply.js`.
- **2002** only has an August `showmonth.php` capture archived, so June/July
  events keep their placeholders.

### Other caveats

- **City names were already complete.** The pressbox `location` field uses full
  city + state spellings (`Port Huron, Michigan`), so the city-completion pass
  found nothing to fix - the abbreviations (`Pt Huron`, `E Rutherford`) live in
  the *archive* dropdown, the less-complete source. The pass stays as a safety
  net for any abbreviated city a future import introduces.
- **Championship week**: same-city/same-day multi-division nights collapse to
  one match key. Those events are almost always already titled in the pressbox
  data (Finals/Semifinals/Quarterfinals), so the placeholder-only rename rule
  leaves them untouched.
- **Div II/III & all-age** rows are excluded from matching; the game doesn't
  carry those corps.
- Events the archive never listed (or that only appear as a bare `City, ST`
  with no title) stay as pressbox placeholders and are counted as "unmatched"
  in the apply summary.
