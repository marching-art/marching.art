// Step 2: Parse the cached month recap documents into the exact
// historical_scores / final_rankings shapes the game already uses.
//
// The documents are Excel-exported HTML workbooks. Each event block looks like:
//
//   6/10/2000 Menasha, Wisconsin[--Optional Event Title]
//   <group row>    General Effect | Visual | Music            (colspans)
//   <caption row>  Visual, Music | Performance, Ensemble, Color Guard | ...
//   <judge row>    judge names, "Total", "Total /2", "Pen", "Score"
//   DCI Division I ... (class row, may carry the 20/40/30/100 maxima)
//   <corps score row> / <rank row that may carry the 2nd line of the name>
//
// Caption naming varies by era (Performance/Ensemble pre-2012 vs
// Proficiency/Analysis after; doubled GE panels at championships as
// "Visual #1"/"Visual #2"), all normalized here to the modern 8 keys:
// GE1 GE2 VP VA CG B MA P, each on the 0-20 scale the game stores.
// Multiple judges for one caption are averaged (same as the live scraper's
// processCaption). Captions a given show didn't field (reduced 2008/2013 tour
// panels) are stored as 0, which the scoring engine already treats as absent.
// DCA sections and sheets that don't map (e.g. 2000-2003 Division II/III
// Execution/Ensemble sheets) are skipped and counted in the report.
//
// Usage: node parse.js   (after node harvest.js)

const fs = require("fs");
const path = require("path");
const {
  CACHE_DIR, OUTPUT_DIR, MANIFEST_PATH, CAPTION_KEYS, YEARS, CORPS_NAME_MAP,
  mapCaption, calculateOffSeasonDay,
} = require("./config");

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b\s*(.*)$/;
const CLASS_RE = /^(DCI|DCA)\b/i;
const DECIMAL_RE = /^\d+\.\d+$/;
const NUMERIC_RE = /^\d+(\.\d+)?$/;

// --- Low-level HTML -> grid extraction ---

function extractRows(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const td of tr[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)) {
      let text = td[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;?/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#\d+;/g, " ")
        .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const cs = /colspan=["']?(\d+)/i.exec(td[1]);
      cells.push({ text, colspan: cs ? parseInt(cs[1], 10) : 1 });
    }
    rows.push(cells);
  }
  return rows;
}

// Header rows: repeat a merged cell's text across its span so any column can
// look up its group/caption. Data rows: keep the value in the first column of
// the span (numeric cells are never merged in these exports).
function expandRepeat(cells) {
  const out = [];
  for (const c of cells) for (let k = 0; k < c.colspan; k++) out.push(c.text);
  return out;
}

function expandFirst(cells) {
  const out = [];
  for (const c of cells) {
    out.push(c.text);
    for (let k = 1; k < c.colspan; k++) out.push("");
  }
  return out;
}

// --- Event block parsing ---

function buildColumnMap(groupRow, captionRow, judgeRow) {
  // Group headers ("General Effect" / "Visual" / "Music") span their section
  // as one cell followed by empty cells, so forward-fill them.
  const filled = [];
  let current = "";
  for (const cell of groupRow) {
    if (cell) current = cell;
    filled.push(current);
  }
  groupRow = filled;

  const width = Math.max(groupRow.length, captionRow.length, judgeRow.length);
  const columns = {}; // col index -> caption key
  let scoreCol = -1;
  let subCol = -1;

  for (let c = 0; c < width; c++) {
    const group = (groupRow[c] || "").toLowerCase();
    const caption = (captionRow[c] || "").toLowerCase();
    const judge = (judgeRow[c] || "").toLowerCase();

    if (/^score$/.test(judge)) scoreCol = c;
    if (/^sub/.test(caption)) subCol = c;
    if (/^(total|pen$|score$)/.test(judge)) continue;
    if (/^(sub|total|pen)/.test(caption)) continue;

    const key = mapCaption(group, caption);
    if (key) {
      if (!columns[key]) columns[key] = [];
      columns[key].push(c);
    }
  }
  return { columns, scoreCol, subCol };
}

function parseFileEvents(html, stats) {
  const rows = extractRows(html);
  const blocks = [];

  let i = 0;
  while (i < rows.length) {
    const first = expandFirst(rows[i])[0] || "";
    const m = DATE_RE.exec(first.trim());
    if (!m) { i++; continue; }

    // Header trio follows the date row.
    if (i + 3 >= rows.length) break;
    const groupRow = expandRepeat(rows[i + 1]);
    const captionRow = expandRepeat(rows[i + 2]);
    const judgeRow = expandRepeat(rows[i + 3]);

    const [, mm, dd, yyyy, rest] = m;
    const [location, title] = rest.split(/--/).map((s) => s.trim());
    const date = new Date(Date.UTC(+yyyy, +mm - 1, +dd));

    const { columns, scoreCol, subCol } = buildColumnMap(groupRow, captionRow, judgeRow);
    const mappedKeys = Object.keys(columns).length;

    const block = {
      date, location: location || "Unknown Location", title: title || null,
      mappedKeys, corps: [],
    };

    let currentClass = null;
    let lastCorps = null;
    let j = i + 4;
    for (; j < rows.length; j++) {
      const grid = expandFirst(rows[j]);
      const cell0 = (grid[0] || "").trim();
      if (DATE_RE.test(cell0)) break;

      if (CLASS_RE.test(cell0)) {
        currentClass = cell0;
        lastCorps = null;
        continue;
      }

      const decimals = grid.filter((v) => DECIMAL_RE.test(v)).length;
      if (decimals >= 2) {
        const captions = {};
        for (const key of CAPTION_KEYS) {
          const vals = (columns[key] || [])
            .map((c) => grid[c])
            .filter((v) => NUMERIC_RE.test(v))
            .map(parseFloat);
          if (vals.length === 0) captions[key] = 0;
          else if (vals.length === 1) captions[key] = vals[0];
          else {
            captions[key] = parseFloat(
              (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
          }
        }

        let score = NaN;
        if (scoreCol >= 0 && NUMERIC_RE.test(grid[scoreCol] || "")) {
          score = parseFloat(grid[scoreCol]);
        } else {
          const nums = grid.filter((v) => DECIMAL_RE.test(v));
          if (nums.length > 0) score = parseFloat(nums[nums.length - 1]);
        }
        if (isNaN(score) || score <= 0 || !cell0) { lastCorps = null; continue; }

        // Cross-check the caption math against the sheet's own subtotal.
        if (subCol >= 0 && NUMERIC_RE.test(grid[subCol] || "") &&
            CAPTION_KEYS.every((k) => captions[k] > 0)) {
          const computed = captions.GE1 + captions.GE2 +
            (captions.VP + captions.VA + captions.CG) / 2 +
            (captions.B + captions.MA + captions.P) / 2;
          const sub = parseFloat(grid[subCol]);
          if (Math.abs(computed - sub) > 0.11) {
            stats.subtotalMismatches.push(
              `${yyyy}-${mm}-${dd} ${location} ${cell0}: computed ${computed.toFixed(2)} vs sheet ${sub}`);
          }
        }

        lastCorps = { name: cell0, class: currentClass, score, captions };
        block.corps.push(lastCorps);
        continue;
      }

      // A rank row can carry the wrapped second line of the corps name.
      if (lastCorps && cell0 && /^[A-Za-z][A-Za-z&.'()\- ]{0,24}$/.test(cell0) &&
          !/rained|recap|score/i.test(cell0)) {
        lastCorps.name += ` ${cell0}`;
      }
      lastCorps = null;
    }

    blocks.push(block);
    i = j;
  }
  return blocks;
}

// --- Assembly into historical_scores events ---

function assembleYear(year, blocks, stats) {
  const events = new Map();

  for (const block of blocks) {
    if (block.date.getUTCFullYear() !== +year) {
      stats.wrongYearBlocks++;
      continue;
    }

    const dciCorps = block.corps.filter((c) => {
      if (c.class === null) return block.mappedKeys >= 4;
      return /^DCI/i.test(c.class);
    });
    if (dciCorps.length === 0) {
      stats.skippedBlocks++;
      continue;
    }
    if (block.mappedKeys < 4) {
      stats.unmappableDciBlocks.push(
        `${block.date.toISOString().slice(0, 10)} ${block.location}` +
        (block.title ? ` (${block.title})` : "") + ` [${block.mappedKeys} captions]`);
      continue;
    }

    const key = `${block.date.toISOString()}|${block.location.toLowerCase()}|${(block.title || "").toLowerCase()}`;
    if (!events.has(key)) {
      // "Dum Corps Midwest" is a recurring typo in the source sheets.
      const title = block.title ?
        block.title.replace(/\bDum Corps\b/g, "Drum Corps") : null;
      events.set(key, {
        eventName: title || `DCI Competition - ${block.location}`,
        date: block.date.toISOString(),
        location: block.location,
        offSeasonDay: calculateOffSeasonDay(block.date, +year),
        headerMap: {},
        scores: [],
      });
    }
    const event = events.get(key);
    for (const corps of dciCorps) {
      let name = corps.name.replace(/\s+/g, " ").trim();
      name = CORPS_NAME_MAP[name] || name;
      if (event.scores.some((s) => s.corps === name)) continue;
      event.scores.push({
        corps: name,
        score: corps.score,
        captions: corps.captions,
        _class: corps.class, // stripped before writing historical_scores
      });
    }
  }

  return [...events.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// --- final_rankings generation (mirrors masterParser.js points scheme) ---

function generateFinalRankings(events) {
  const topClass = (e) =>
    /world championship finals/i.test(e.eventName) &&
    (/world class/i.test(e.eventName) || /division i\b(?!i|\/)/i.test(e.eventName));
  const topClassRound = (round) => (e) =>
    new RegExp(`world championship ${round}`, "i").test(e.eventName) &&
    (/world class/i.test(e.eventName) || /division i\b(?!i|\/)/i.test(e.eventName));

  const finalsEvent = events.find(topClass);
  if (!finalsEvent) return [];
  const semisEvent = events.find(topClassRound("semi"));
  const quartersEvent = events.find(topClassRound("quarter"));

  const rankings = [];
  const ranked = new Set();
  const take = (event, limit) => {
    if (!event) return;
    const sorted = [...event.scores].sort((a, b) => b.score - a.score);
    for (const corps of sorted) {
      if (rankings.length >= 25 || (limit && rankings.length >= limit)) break;
      if (ranked.has(corps.corps)) continue;
      rankings.push(corps);
      ranked.add(corps.corps);
    }
  };
  take(finalsEvent, 12);
  take(semisEvent);
  take(quartersEvent);

  return rankings
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map((corps, index) => ({
      rank: index + 1,
      corps: corps.corps,
      points: 25 - index,
      originalScore: corps.score,
    }));
}

// --- Main ---

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("manifest.json not found. Run: node harvest.js");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {};
  for (const year of YEARS) {
    const docs = manifest[year] || [];
    const stats = {
      skippedBlocks: 0, wrongYearBlocks: 0,
      unmappableDciBlocks: [], subtotalMismatches: [],
    };
    const blocks = [];
    for (const doc of docs) {
      const file = path.join(CACHE_DIR, doc.fileName.split("/").pop());
      if (!fs.existsSync(file)) {
        console.warn(`${year}: missing ${file}, run harvest.js`);
        continue;
      }
      // The exports are windows-1252; latin1 keeps every byte addressable.
      const html = fs.readFileSync(file, "latin1");
      blocks.push(...parseFileEvents(html, stats));
    }

    const events = assembleYear(year, blocks, stats);
    const rankings = generateFinalRankings(events);

    for (const event of events) {
      for (const s of event.scores) delete s._class;
    }

    if (events.length > 0) {
      const scoresPath = path.join(OUTPUT_DIR, `historical_scores_${year}.json`);
      fs.writeFileSync(scoresPath, JSON.stringify({ data: events }, null, 1));
      const corpsCount = events.reduce((n, e) => n + e.scores.length, 0);
      const size = fs.statSync(scoresPath).size;
      report[year] = {
        documents: docs.length,
        events: events.length,
        scoreEntries: corpsCount,
        rankings: rankings.length,
        fileBytes: size,
        skippedNonDciBlocks: stats.skippedBlocks,
        unmappableDciBlocks: stats.unmappableDciBlocks,
        subtotalMismatches: stats.subtotalMismatches.length,
      };
      console.log(`${year}: ${events.length} events, ${corpsCount} score entries, ` +
        `${rankings.length} ranked, ${(size / 1024).toFixed(0)}KB` +
        (size > 900000 ? "  *** NEAR 1MB FIRESTORE DOC LIMIT ***" : ""));
      if (rankings.length > 0) {
        fs.writeFileSync(
          path.join(OUTPUT_DIR, `final_rankings_${year}.json`),
          JSON.stringify({ data: rankings }, null, 1));
      } else {
        console.warn(`${year}: no Division I / World Class championship finals found - ` +
          "no final_rankings generated (corps from this year won't be draftable).");
      }
    } else {
      report[year] = { documents: docs.length, events: 0 };
      console.warn(`${year}: no events parsed.`);
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUTPUT_DIR}/report.json. Next: node import.js --dry-run`);
}

main();
