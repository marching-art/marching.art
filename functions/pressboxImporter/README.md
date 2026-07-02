# From The Pressbox historical recap importer (DCI 2000-2012)

Backfills `historical_scores/{year}` and `final_rankings/{year}` for
2000-2012 from the month-long recap workbooks published at
[fromthepressbox.com/dca-dcihistory](https://www.fromthepressbox.com/dca-dcihistory),
in exactly the shape the existing 2013+ data (scraped from dci.org) uses.

## Usage

```bash
cd functions/pressboxImporter
node harvest.js          # discover + download the .htm workbooks into cache/
node parse.js            # parse into output/*.json + output/report.json
node import.js --dry-run # preview Firestore writes
node import.js           # upload (needs functions/serviceAccountKey.json)
```

`import.js` is add-only by default: it never touches a year that already has a
`historical_scores` or `final_rankings` document. `--merge` appends missing
events (matched on eventName + date, same rule as `processDciScores`);
`--replace` overwrites; `--years 2000,2001` limits scope.

The parsed `output/*.json` files are committed, so you can review the data or
run `import.js` without re-harvesting.

### Running from GitHub Actions

The **Deploy Cloud Functions** workflow (`deploy-functions.yml`) has a
`run_historical_import` checkbox that runs `import.js` with the
`FIREBASE_SERVICE_ACCOUNT` secret — no local service-account key needed:

1. Actions -> Deploy Cloud Functions -> Run workflow.
2. To run the import *without* deploying, set "What to deploy" to `single`
   and leave the function names empty (the deploy jobs skip themselves).
3. Check `run_historical_import`. The args box defaults to `--dry-run`;
   inspect the job log, then re-run with the box empty for the real
   add-only import (or e.g. `--years 2000,2001`, `--merge`).

Because harvest/parse output is committed, CI only ever runs `import.js`;
re-run `harvest.js`/`parse.js` locally and commit the new output if the
source site ever fixes the 2008/2011 links.

## How the source maps to the game's schema

Each event block in the workbooks becomes one event object identical to what
`functions/src/triggers/scoreProcessing.js` writes:

```js
{
  eventName,          // title after "--" in the sheet's date row, e.g.
                      // "DCI Division I World Championship Finals";
                      // "DCI Competition - {location}" when untitled
  date,               // ISO string (UTC midnight)
  location,
  offSeasonDay,       // same calculateOffSeasonDay math as the live pipeline
  headerMap: {},
  scores: [{ corps, score, captions: { GE1, GE2, VP, VA, CG, B, MA, P } }],
}
```

### Caption mapping (old sheet names -> modern keys)

All captions were already judged on the 0-20 scale with the same
GE + Visual/2 + Music/2 = 100 build-up, so values transfer without rescaling —
only the names changed:

| Sheet group    | Sheet caption (2000-2011 / 2012)      | Key |
|----------------|----------------------------------------|-----|
| General Effect | Visual (also "Visual #1/#2")           | GE1 |
| General Effect | Music (also "Music #1/#2")             | GE2 |
| Visual         | Performance / Proficiency              | VP  |
| Visual         | Ensemble / Analysis                    | VA  |
| Visual         | Color Guard                            | CG  |
| Music          | Brass                                  | B   |
| Music          | Ensemble / Analysis                    | MA  |
| Music          | Percussion (also "Percussion #1/#2")   | P   |

Where a caption had multiple judges (doubled GE panels at championships,
dual percussion in 2007) the judge scores are averaged, matching
`processCaption` in `functions/src/helpers/scraping.js`. Older regular-season
shows had a single judge per caption, so the value passes through as-is.
Captions a show didn't field (reduced 2008/2013-style tour panels) are stored
as 0, which the scoring engine already treats as "no data".

Corps names are normalized to the identities the 2013+ data uses via
`CORPS_NAME_MAP` in `config.js` ("Cadets"/"Holy Name Cadets" -> "The Cadets",
"Vanguard" -> "Santa Clara Vanguard", "Spirit" -> "Spirit of Atlanta", ...).
Wrapped two-line names in the sheets ("Madison" / "Scouts") are rejoined.

`final_rankings/{year}` uses the same top-25 / 25-points-down scheme as
`masterParser.js`, seeded from the Division I / World Class World Championship
Finals -> Semifinals -> Quarterfinals events.

### What is skipped

- **DCA sections** (this is senior-corps data the game doesn't use) and the
  2000-2003 Division II/III "Execution/Ensemble" sheets, whose caption system
  has no modern equivalent. Counts appear in `output/report.json`.
- **2013**: already in Firestore from the dci.org scrape.

### Known source gaps

As of July 2026 the season pages link the wrong workbooks for some months, so
these are genuinely unavailable from this source:

- **2008**: only June exists (the "July" link points at the 2000 workbook), so
  2008 has 20 events and **no final_rankings** — 2008 corps won't be
  draftable until championship data is found elsewhere.
- **2011**: all three links point at the 2010 workbooks; nothing importable.

`harvest.js` detects and skips these mislinked files. If corrected documents
appear (or you obtain them another way), drop them into `cache/` with the
right `{year}{month}recaps.htm` name, add the entry to `manifest.json`, and
re-run `parse.js`.

Roughly 1-4% of score rows have arithmetic typos in the source sheets
themselves (a judge cell that disagrees with the sheet's own subtotal, e.g.
Spirit's GE at Albuquerque 8/2/2007). Caption cells are taken verbatim and the
sheet's official Sub/Score totals are kept in `score`; each case is listed in
`output/report.json` under `subtotalMismatches`.
