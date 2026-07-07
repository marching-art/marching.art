// Article 6: marching.art Season Summary.
//
// A RARE piece that publishes only on a competition day (15–49) that has NO
// events to score, when the normal 5-article batch cannot run because no scores
// were processed. It is a season-to-date state of the union built entirely from
// the fantasy_recaps already on record: overall placement and rivalries in each
// class, comparisons of combined GE / combined Visual / combined Music, show
// themes and design choices, the show-win (first-place) leaders in each class,
// and a deep dive into the SoundSport Best-in-Show awards to date.
//
// INTEGRITY: this article must NEVER discuss individual caption results
// (GE1/GE2/VP/VA/CG/B/MA/P) or reveal any director's specific lineup picks —
// that would let users reverse-engineer each other's selections. Only the
// COMBINED family scores (GE, Visual, Music) and totals — which the recap
// already stores as geScore/visualScore/musicScore/totalScore — are ever
// exposed here. The DATA block is built to contain nothing finer than that.

const { Type } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const {
  ARTICLE_TYPES,
  NEWS_INTEGRITY_RULES,
  processGeneratedImage,
} = require("./newsArticleShared");
const {
  generateWithFactCheckGuard,
  generateImageWithImagen,
  PAID_IMAGE_MODEL,
} = require("./geminiService");
const { buildFantasyPerformersImagePrompt } = require("./newsImagePrompts");
const { describeShowConcept } = require("./showConceptSynergy");

const CLASS_LABELS = {
  worldClass: "World Class",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
};
// Competitive classes carry numeric standings; SoundSport is deliberately
// non-competitive (ratings only, scores never revealed).
const COMPETITIVE_CLASSES = ["worldClass", "openClass", "aClass"];

/**
 * SoundSport rating from a raw score. Mirrors the thresholds used by the daily
 * fantasy article and the SoundSport tab. SoundSport scores themselves are
 * NEVER published — only the rating level derived from them.
 */
function getSoundSportRating(score) {
  if (!score || score <= 0) return null;
  if (score >= 85) return "Gold";
  if (score >= 75) return "Silver";
  if (score >= 65) return "Bronze";
  return "Participation";
}


/**
 * Collapse every recap day (offSeasonDay <= throughDay) into per-corps season
 * aggregates keyed by `${uid}_${corpsClass}`. Only combined family scores and
 * totals are aggregated — individual captions are never present in the recap
 * results, so they cannot leak.
 */
function aggregateSeason(recaps) {
  const byCorps = new Map();
  // Win tallies, counted ONCE PER SHOW (event), not per day. A single day can
  // hold several shows (e.g. a regional weekend), so the unit is the individual
  // show — identified by (day, show index) so it is stable even when two shows on
  // a day share (or lack) an event name.
  //   - Competitive: a "show win" = first place WITHIN A CLASS at a show. Per
  //     class (not a single overall winner) so it is meaningful in every class;
  //     otherwise World Class would sweep every one. This is a placement, not the
  //     "Best in Show" award.
  //   - SoundSport: "Best in Show" is the genuine SoundSport award — the top
  //     SoundSport ensemble at a showcase (ratings format, scores never shown).
  const showWinners = new Map(); // corpsKey -> competitive first-place (show win) count
  const soundSportBestInShow = new Map(); // corpsKey -> SoundSport Best-in-Show count

  for (const recap of recaps) {
    const day = recap.offSeasonDay;

    (recap.shows || []).forEach((show, showIdx) => {
      // Stable per-event identity. Every result in this show shares it, so
      // best-in-show and head-to-head rivalry math all agree on what "a show" is.
      const showId = `${day}::${showIdx}`;
      const topByClass = new Map(); // corpsClass -> { key, total } — class winner at this show
      let topSoundSport = null; // { key, total }

      for (const r of show.results || []) {
        if (!r || !r.corpsClass || !r.corpsName) continue;
        const key = `${r.uid || r.corpsName}_${r.corpsClass}`;
        const total = Number.isFinite(r.totalScore) ? r.totalScore : 0;
        if (!byCorps.has(key)) {
          byCorps.set(key, {
            key,
            uid: r.uid || null,
            corpsClass: r.corpsClass,
            corpsName: r.corpsName,
            displayName: r.displayName || null,
            hometown: r.location || null,
            entries: [],
          });
        }
        const agg = byCorps.get(key);
        // Recaps are processed oldest-first and shows in array order, so the most
        // recently seen entry is always the latest — take its metadata (names /
        // hometowns can be edited mid-season).
        agg.corpsName = r.corpsName;
        agg.displayName = r.displayName || agg.displayName;
        agg.hometown = r.location || agg.hometown;
        agg.entries.push({
          day,
          showIdx,
          showId,
          eventName: show.eventName || null,
          total,
          ge: Number.isFinite(r.geScore) ? r.geScore : null,
          visual: Number.isFinite(r.visualScore) ? r.visualScore : null,
          music: Number.isFinite(r.musicScore) ? r.musicScore : null,
        });

        if (r.corpsClass === "soundSport") {
          if (!topSoundSport || total > topSoundSport.total) topSoundSport = { key, total };
        } else {
          const cur = topByClass.get(r.corpsClass);
          if (!cur || total > cur.total) topByClass.set(r.corpsClass, { key, total });
        }
      }

      // One show win per class (the top corps in each competitive class takes
      // first place at that show), plus the SoundSport Best in Show for the top
      // SoundSport ensemble (ratings-only, so it is a recognition not a score).
      for (const winner of topByClass.values()) {
        showWinners.set(winner.key, (showWinners.get(winner.key) || 0) + 1);
      }
      if (topSoundSport) {
        soundSportBestInShow.set(topSoundSport.key, (soundSportBestInShow.get(topSoundSport.key) || 0) + 1);
      }
    });
  }

  // Finalize per-corps derived stats.
  const corps = [];
  for (const agg of byCorps.values()) {
    // Order by day then within-day show index so "latest" is the true most-recent show.
    const sorted = [...agg.entries].sort((a, b) => (a.day - b.day) || (a.showIdx - b.showIdx));
    const totals = sorted.map(e => e.total);
    const geVals = sorted.map(e => e.ge).filter(v => Number.isFinite(v));
    const visVals = sorted.map(e => e.visual).filter(v => Number.isFinite(v));
    const musVals = sorted.map(e => e.music).filter(v => Number.isFinite(v));
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
    const latest = sorted[sorted.length - 1];
    corps.push({
      ...agg,
      entries: sorted,
      showsCount: sorted.length,
      latestDay: latest.day,
      latestTotal: latest.total,
      bestTotal: totals.length ? Math.max(...totals) : 0,
      avgTotal: avg(totals),
      avgGE: avg(geVals),
      avgVisual: avg(visVals),
      avgMusic: avg(musVals),
      showWins: showWinners.get(agg.key) || 0,
      soundSportBestInShow: soundSportBestInShow.get(agg.key) || 0,
      bestRating: agg.corpsClass === "soundSport" ? getSoundSportRating(totals.length ? Math.max(...totals) : 0) : null,
    });
  }
  return corps;
}

/**
 * Detect rivalries within a competitive class: pairs that have traded places
 * across shared SHOWS (not days — two corps can meet at several shows in one
 * day), or that sit within a tight season-average margin of each other.
 * Head-to-head is keyed on the same per-show identity as best-in-show, so the
 * two never disagree. Considers only the top of each class to stay cheap.
 */
function detectRivalries(classCorps) {
  const pool = [...classCorps]
    .sort((a, b) => b.latestTotal - a.latestTotal)
    .slice(0, 10);
  const rivalries = [];

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      // Head-to-head over the individual shows both competed at (by showId).
      const bByShow = new Map(b.entries.map(e => [e.showId, e.total]));
      let sharedShows = 0;
      let aWins = 0;
      let bWins = 0;
      let marginSum = 0;
      for (const e of a.entries) {
        if (!bByShow.has(e.showId)) continue;
        sharedShows++;
        const bt = bByShow.get(e.showId);
        marginSum += Math.abs(e.total - bt);
        if (e.total > bt) aWins++;
        else if (bt > e.total) bWins++;
      }
      if (sharedShows < 2) continue;
      const avgMargin = marginSum / sharedShows;
      const flipped = aWins > 0 && bWins > 0;
      if (!flipped && avgMargin > 1.0) continue;
      rivalries.push({
        corpsA: a.corpsName,
        corpsB: b.corpsName,
        sharedShows,
        aWins,
        bWins,
        avgMargin,
        flipped,
        // Ranking weight: flipped lead is the strongest rivalry signal, then a
        // tighter average margin, then a longer shared history.
        weight: (flipped ? 1000 : 0) + Math.max(0, 200 - avgMargin * 100) + sharedShows,
      });
    }
  }

  return rivalries.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

/**
 * Fetch director-designed show concepts and uniform designs for the ensembles
 * that will anchor the article's theme/design discussion and its image.
 * Returns a map keyed by corpsKey.
 */
async function fetchDesignContext(db, dataDocId, targets) {
  const design = new Map();
  if (!db || !dataDocId) return design;
  for (const t of targets) {
    if (!t.uid || !t.corpsClass) continue;
    try {
      const profileDoc = await db.doc(`artifacts/${dataDocId}/users/${t.uid}/profile/data`).get();
      if (!profileDoc.exists) continue;
      const corpsData = profileDoc.data()?.corps?.[t.corpsClass];
      design.set(t.key, {
        concept: describeShowConcept(corpsData?.showConcept),
        uniformDesign: corpsData?.uniformDesign || null,
        location: corpsData?.location || t.hometown || null,
      });
    } catch (err) {
      logger.warn("Season summary: could not fetch design context:", err.message);
    }
  }
  return design;
}

/**
 * Generate the season-summary article (Article 6). Returns a full article
 * object (with an AI image, like the fantasy-results article) or null when
 * there is not yet enough of a season to summarize.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.Firestore} params.db
 * @param {string} params.seasonId
 * @param {string} params.dataDocId
 * @param {number} params.throughDay - The season day the summary runs through
 *   (the empty day). All aggregation uses recaps with offSeasonDay <= this.
 * @param {boolean} [params.isLiveSeason]
 */
async function generateSeasonSummaryArticle({ db, seasonId, dataDocId, throughDay, isLiveSeason }) {
  const recapsSnapshot = await db.collection(`fantasy_recaps/${seasonId}/days`).get();
  const recaps = recapsSnapshot.docs
    .map(d => d.data())
    .filter(r => Number.isFinite(r.offSeasonDay) && r.offSeasonDay <= throughDay)
    .sort((a, b) => a.offSeasonDay - b.offSeasonDay);

  if (recaps.length === 0) {
    logger.info(`Season summary: no recaps on record through day ${throughDay}; skipping.`);
    return null;
  }

  const corps = aggregateSeason(recaps);
  // Feature every corps that has posted a real score. A corps sitting at 0.000
  // (e.g. an incomplete lineup) is a data anomaly, not a competitor — leave it
  // out rather than surfacing a dead 0.000 row.
  const competitive = corps.filter(c => COMPETITIVE_CLASSES.includes(c.corpsClass) && c.bestTotal > 0);
  const soundSport = corps.filter(c => c.corpsClass === "soundSport" && c.bestTotal > 0);

  // Need at least a small competitive field or a SoundSport field to say anything.
  if (competitive.length === 0 && soundSport.length === 0) {
    logger.info(`Season summary: no ensembles found through day ${throughDay}; skipping.`);
    return null;
  }

  const scoredDays = new Set(recaps.map(r => r.offSeasonDay));
  const daysScored = scoredDays.size;

  // Per-class standings (competitive), ranked by latest total (the same metric
  // the game itself uses for season standings). Each standing carries analysis
  // hooks — gap to the class leader, which caption family the ensemble ranks
  // best/worst on within its class, and its trajectory since its opener — so the
  // writer can interpret rather than recite the raw table.
  const rankByField = (list, field) => {
    const order = [...list].sort((a, b) => b[field] - a[field]);
    const rank = new Map();
    order.forEach((c, i) => rank.set(c.key, i + 1));
    return rank;
  };
  const classBlocks = [];
  for (const classKey of COMPETITIVE_CLASSES) {
    const inClass = competitive
      .filter(c => c.corpsClass === classKey)
      .sort((a, b) => b.latestTotal - a.latestTotal);
    if (inClass.length === 0) continue;
    const leaderTotal = inClass[0].latestTotal;
    const geRank = rankByField(inClass, "avgGE");
    const visRank = rankByField(inClass, "avgVisual");
    const musRank = rankByField(inClass, "avgMusic");
    const standings = inClass.map((c, i) => ({
      rank: i + 1,
      corpsName: c.corpsName,
      director: c.displayName || "Unknown",
      latestTotal: Number(c.latestTotal.toFixed(3)),
      avgGE: Number(c.avgGE.toFixed(2)),
      avgVisual: Number(c.avgVisual.toFixed(2)),
      avgMusic: Number(c.avgMusic.toFixed(2)),
      showsCount: c.showsCount,
      showWins: c.showWins,
      // Analysis hooks (all sourced, combined-family only):
      gapToLeader: i === 0 ? 0 : Number((leaderTotal - c.latestTotal).toFixed(3)),
      geRankInClass: geRank.get(c.key),
      visRankInClass: visRank.get(c.key),
      musRankInClass: musRank.get(c.key),
      // Trajectory: latest vs first scored show (only meaningful with 2+ shows).
      seasonDelta: c.showsCount >= 2 ? Number((c.latestTotal - c.entries[0].total).toFixed(3)) : null,
    }));
    const rivalries = detectRivalries(inClass).map(r => ({
      corpsA: r.corpsA,
      corpsB: r.corpsB,
      note: r.flipped
        ? `have split ${r.sharedShows} head-to-head meetings ${r.aWins}-${r.bWins}, an average of ${r.avgMargin.toFixed(2)} apart`
        : `separated by an average of ${r.avgMargin.toFixed(2)} over ${r.sharedShows} shared shows`,
    }));
    classBlocks.push({ classKey, label: CLASS_LABELS[classKey], standings, rivalries });
  }

  // SoundSport / Best-in-Show summary (ratings only — never scores).
  const soundSportLeaders = soundSport
    .filter(c => c.soundSportBestInShow > 0)
    .sort((a, b) => b.soundSportBestInShow - a.soundSportBestInShow)
    .slice(0, 5)
    .map(c => ({ corpsName: c.corpsName, director: c.displayName || "Unknown", bestInShow: c.soundSportBestInShow }));
  const ratingOrder = ["Gold", "Silver", "Bronze", "Participation"];
  const ratingCounts = ratingOrder
    .map(rating => ({ rating, count: soundSport.filter(c => c.bestRating === rating).length }))
    .filter(r => r.count > 0);

  // Competitive show-win (first-place) leaders, top few PER CLASS so each class
  // is represented rather than swept by the highest-scoring class.
  const showWinLeaders = [];
  for (const classKey of COMPETITIVE_CLASSES) {
    const leaders = competitive
      .filter(c => c.corpsClass === classKey && c.showWins > 0)
      .sort((a, b) => b.showWins - a.showWins)
      .slice(0, 3)
      .map(c => ({ corpsName: c.corpsName, classLabel: CLASS_LABELS[classKey], showWins: c.showWins }));
    showWinLeaders.push(...leaders);
  }

  // The single top overall competitive ensemble anchors the article image.
  const topOverall = [...competitive].sort((a, b) => b.latestTotal - a.latestTotal)[0] || null;

  // Design/theme context for the top two per competitive class + top SoundSport.
  const designTargets = [];
  for (const block of classBlocks) {
    const inClass = competitive.filter(c => c.corpsClass === block.classKey)
      .sort((a, b) => b.latestTotal - a.latestTotal);
    designTargets.push(...inClass.slice(0, 2));
  }
  const topSoundSport = [...soundSport].sort((a, b) => b.bestTotal - a.bestTotal)[0];
  if (topSoundSport) designTargets.push(topSoundSport);
  const designContext = await fetchDesignContext(db, dataDocId, designTargets);
  const programConcepts = [];
  for (const t of designTargets) {
    const d = designContext.get(t.key);
    if (d?.concept) programConcepts.push({ corpsName: t.corpsName, concept: d.concept });
  }

  // ---- Build the DATA block (nothing finer than combined families) ----
  // Each line carries the raw numbers (for grounding) plus interpretation hooks:
  // gap to the leader, a caption-family profile (which family the ensemble is
  // strongest/weakest on relative to its class), and its trajectory. The writer
  // is told to INTERPRET these, not restate them.
  const standingsText = classBlocks.map(block => {
    const n = block.standings.length;
    const lines = block.standings.slice(0, 8).map(s => {
      const nameLabel = `"${s.corpsName}" (${s.director})`;
      const place = s.rank === 1 ? "leads the class" : `${s.gapToLeader.toFixed(3)} behind the leader`;
      const fams = [["GE", s.geRankInClass], ["Visual", s.visRankInClass], ["Music", s.musRankInClass]];
      const strongest = fams.reduce((a, b) => (b[1] < a[1] ? b : a));
      const weakest = fams.reduce((a, b) => (b[1] > a[1] ? b : a));
      const profile = n >= 2 && strongest[0] !== weakest[0]
        ? `; profile: strongest on ${strongest[0]} (${strongest[1]} of ${n} in class), weakest on ${weakest[0]} (${weakest[1]} of ${n})`
        : "";
      const traj = s.seasonDelta !== null
        ? `; trajectory ${s.seasonDelta >= 0 ? "+" : ""}${s.seasonDelta.toFixed(3)} from opener to latest`
        : "";
      return `  ${s.rank}. ${nameLabel} — ${s.latestTotal.toFixed(3)}, ${place} | ${s.showsCount} show${s.showsCount === 1 ? "" : "s"}${s.showWins > 0 ? `, ${s.showWins} show win${s.showWins === 1 ? "" : "s"}` : ""} | avg GE ${s.avgGE.toFixed(2)} / Visual ${s.avgVisual.toFixed(2)} / Music ${s.avgMusic.toFixed(2)}${profile}${traj}`;
    }).join("\n");
    const rivalryLines = block.rivalries.length
      ? "\n  RIVALRIES: " + block.rivalries.map(r => `${r.corpsA} vs ${r.corpsB} — ${r.note}`).join("; ")
      : "";
    return `${block.label} (${block.standings.length} ensembles):\n${lines}${rivalryLines}`;
  }).join("\n\n");

  const soundSportText = soundSport.length
    ? `SoundSport participants: ${soundSport.length}\n` +
      (soundSportLeaders.length ? `Best-in-Show tally (SoundSport, ratings-only — NEVER cite a SoundSport score): ${soundSportLeaders.map(l => `"${l.corpsName}" ×${l.bestInShow}`).join(", ")}\n` : "") +
      (ratingCounts.length ? `Current best ratings distribution: ${ratingCounts.map(r => `${r.rating}: ${r.count}`).join(", ")}` : "")
    : "No SoundSport participants this season.";

  const showWinsText = showWinLeaders.length
    ? showWinLeaders.map(l => `"${l.corpsName}" (${l.classLabel}): ${l.showWins} show win${l.showWins === 1 ? "" : "s"}`).join(", ")
    : "No show wins recorded yet.";

  // Only surface a show-concepts section when concepts actually exist — an empty
  // section otherwise invites the writer to speculate about why directors haven't
  // logged one, which is padding.
  const hasConcepts = programConcepts.length > 0;
  const conceptsBlock = hasConcepts
    ? `\nSHOW CONCEPTS (director-designed themes — the only theme information that exists; reference ONLY these, exactly as written):\n${programConcepts.map(p => `- "${p.corpsName}": performing ${p.concept}`).join("\n")}\n`
    : "";

  const reportDay = throughDay;
  const prompt = `You are a marching.art fantasy sports journalist writing a special SEASON-TO-DATE SUMMARY. There are no competitions to score today, so instead of a nightly recap you are taking stock of the whole fantasy season so far — through Day ${throughDay}, across ${daysScored} scored days. These are FANTASY ensembles run by real users.

WHAT THIS ARTICLE IS
- A state-of-the-season overview: overall placement and the rivalries taking shape in each competitive class, how ensembles compare on their COMBINED General Effect, COMBINED Visual, and COMBINED Music scores, the show themes and design choices directors have committed to, which ensembles have piled up the most show wins (first-place finishes), and the SoundSport Best-in-Show story so far.
- TERMINOLOGY: In the competitive classes (World, Open, A), winning a show is a "show win" or "first place" — do NOT call it "Best in Show." "Best in Show" is a SoundSport-only award; use that phrase only for SoundSport.
- A change of pace on a quiet day — reflective and big-picture, not a box score.

HARD PRIVACY RULE (never violate)
- You may ONLY discuss COMBINED scores: combined General Effect, combined Visual, combined Music, and total scores. You must NEVER mention, break down, or compare individual captions (GE1, GE2, Visual Proficiency, Visual Analysis, Color Guard, Brass, Music Analysis, Percussion) or any single-caption number. Revealing caption-level detail would let readers reverse-engineer another director's private lineup picks. If you are tempted to write about a specific caption, write about the combined family (GE / Visual / Music) instead.
- Never reveal or guess any director's specific roster/lineup selections. Discuss results and design, never picks.
- SoundSport is ratings-only: celebrate ratings and Best-in-Show recognition, but NEVER print a SoundSport score.

ACCURACY RULES
- Every ensemble name, director name, score, average, margin, count, class, rivalry, rating, and award below comes from the DATA block. Do not invent any of them. Quote numbers as written; do not recompute or re-round.
- Program/show themes may be referenced ONLY for ensembles in a SHOW CONCEPTS block, exactly as described there. If there is no SHOW CONCEPTS block, do not discuss show design at all and do not speculate about why — simply omit the topic.
- Director names are user display names — some are real names, some are handles ("elithecreature", "mike_42"). For handle-style names, refer via the ensemble ("the director behind Stellar Vista") rather than as a bare first name.
- Every ensemble name in the DATA block is a real, deliberate proper noun and the corps' actual chosen name — even one that reads like a generic word (e.g., "Unspecified", "Unspecified Open"). Print it verbatim, capitalized as a name, and treat it exactly like any other corps. NEVER interpret such a name as missing data, and never rephrase it into a lowercase description ("an unspecified ensemble"). "Unspecified" is the corps; write "Unspecified leads Open Class," not "an unspecified ensemble leads."

${NEWS_INTEGRITY_RULES}

Through Day ${throughDay} | ${daysScored} scored days${isLiveSeason ? " | LIVE season" : ""}

===== DATA =====
CLASS STANDINGS & RIVALRIES (ranked by latest total score — combined families only):
${standingsText}

SOUNDSPORT BEST-IN-SHOW TO DATE (Best in Show is a SoundSport award):
${soundSportText}

COMPETITIVE SHOW WINS — first-place finishes per class, season totals (a count of wins to date, NOT a list of individual shows; do NOT call these "Best in Show"): ${showWinsText}
${conceptsBlock}===== END DATA =====

VOICE & CRAFT
- Write as a knowledgeable marching-arts columnist taking stock mid-season — think a smart DCI beat writer, not a stats printout. You know the activity: General Effect, Visual, and Music are the three scoring books; a season builds toward August finals; a "tight class" means the field is bunched. Use that texture, but stay accessible.
- INTERPRET, DON'T RECITE. The article is published alongside full standings tables that already list every ensemble's total, GE/Visual/Music averages, show count, and show wins. Your job is NOT to read those tables back. Do not walk down a class rank-by-rank reciting each ensemble's four numbers. Instead, tell the story the numbers reveal.
- Use the analysis hooks in the data — gap to the leader, each ensemble's caption-family PROFILE (which book carries them, which lags), and trajectory (rising or sliding since their opener). The best sentences compare and explain: "Altitude tops the class on Music but its GE trails the leaders — that's the ground it has to make up," or "the leader has done it in two shows; the corps chasing has proven it over five." Lead with the story, and cite only the two or three numbers that actually carry the point.
- Be selective. Feature the genuine storylines — the leader and the ensemble pressing it, the corps winning the most shows, a lopsided profile, a corps trending up. You do not have to mention every ensemble in prose; the tables cover the rest.
- Vary your sentences and your phrasing. Do not lean on a stock phrase (never repeat something like "never separated by more than a hair"). When a margin matters, use the actual figure or find a fresh way to say it.

BANNED PHRASES: dominant, commanding, stunning, heating up, sent shockwaves, the drama is just beginning, tune in tomorrow, testament to, incredibly close, proving to be, holding their cards close, let the numbers speak, never separated by more than a hair

ARTICLE REQUIREMENTS
- Headline: A specific storyline — the class race, a rivalry, or the corps quietly racking up wins. Name a real ensemble. No hype words, no invented numbers.
- Summary: 2-3 sentences that open on the single sharpest storyline of the season so far — a real lede, not a throat-clearing "through Day N, the landscape is taking shape."
- Narrative: 550-800 words (shorter and sharper beats longer and padded — do not pad to hit a count). Open with a true lede on the most newsworthy thread, then use 4-6 short bolded Markdown lead-ins (2-4 words each, e.g. **World Class.**, **The chase.**, **Rising fast.**, **SoundSport.**) at natural transitions. Cover, in whatever order reads best:
  1. The competitive-class picture — who leads, who is closing, and what the GE/Visual/Music PROFILES reveal about how each contender is built. Interpret; do not recite the table.
  2. The most compelling rivalries — who has traded places and how close it is (weave in a real margin figure, not a stock phrase).
  3. The show-win story: which corps have piled up the most first-place finishes in their class and what that says about their consistency (a season achievement count — never a show-by-show log; reserve "Best in Show" for SoundSport).
  4. The SoundSport picture — the Best-in-Show leaders and the ratings landscape (ratings only, never a SoundSport score).
  ${hasConcepts ? "5. What the ensembles with logged show concepts are going for artistically (only those in the SHOW CONCEPTS block)." : "There are no show concepts on record, so do NOT discuss show design or themes at all."}
  Carry personality through sharp reading of the combined numbers and the season arc. No fabricated quotes, reactions, or feelings.
- End on a forward-looking beat — what to watch as the field builds toward finals — grounded in a specific fact from the data, not a rhetorical question.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "State-of-the-season headline naming a real ensemble. No hype words, no invented numbers, no individual captions." },
      summary: { type: Type.STRING, description: "2-3 sentence setup of the season-to-date picture and the top storyline." },
      narrative: { type: Type.STRING, description: "550-800 word season summary that INTERPRETS the data rather than reciting the standings tables. Opens on a real lede, uses 4-6 short bolded Markdown lead-ins, and reads like a marching-arts columnist. Discusses ONLY combined GE / combined Visual / combined Music and totals — never individual captions and never any director's lineup picks. Every name, score, margin, count, rating, and award comes from the DATA block, with each corps name printed verbatim as a proper noun (including generic-looking names like 'Unspecified'). SoundSport is ratings-only. Reserves 'Best in Show' for SoundSport; competitive wins are 'show wins'." },
    },
    required: ["headline", "summary", "narrative"],
  };

  const fieldCorpsNames = corps.map(c => c.corpsName);
  const content = await generateWithFactCheckGuard(prompt, schema, {
    articleType: "season_summary",
    fieldCorpsNames,
  });

  // Deterministic structured payload for the UI — built from the aggregation,
  // not the model, so every rendered number is exact.
  const seasonSummary = {
    throughDay,
    daysScored,
    classes: classBlocks,
    soundSport: {
      participants: soundSport.length,
      bestInShowLeaders: soundSportLeaders,
      ratings: ratingCounts,
    },
    showWinLeaders,
  };

  // Image: the top overall competitive ensemble, like the fantasy-results
  // article. Falls back to the top SoundSport ensemble if there is no
  // competitive field at all.
  const imageCorps = topOverall || topSoundSport || null;
  const imageDesign = imageCorps ? designContext.get(imageCorps.key) : null;
  const topConcept = imageCorps ? programConcepts.find(p => p.corpsName === imageCorps.corpsName) : null;
  const imageContext = `Season-to-date showcase through Day ${throughDay}${topConcept ? ` — the ensemble is performing ${topConcept.concept}` : ""}`;

  let imageResult = { url: null, isPlaceholder: false };
  if (imageCorps) {
    try {
      const imagePrompt = buildFantasyPerformersImagePrompt(
        imageCorps.corpsName,
        imageContext,
        imageDesign?.location || imageCorps.hometown || null,
        imageDesign?.uniformDesign || null,
        reportDay,
        5 // articleIndex 5: Season Summary — distinct scene archetype from the daily five
      );
      const imageData = await generateImageWithImagen(imagePrompt, { model: PAID_IMAGE_MODEL });
      imageResult = await processGeneratedImage(imageData, "season_summary");
      return {
        type: ARTICLE_TYPES.SEASON_SUMMARY,
        ...content,
        seasonSummary,
        featuredPerformer: imageCorps.corpsName,
        imageUrl: imageResult.url,
        imagePrompt,
        reportDay,
      };
    } catch (error) {
      logger.error("Season summary image generation failed; shipping without image:", error);
    }
  }

  return {
    type: ARTICLE_TYPES.SEASON_SUMMARY,
    ...content,
    seasonSummary,
    featuredPerformer: imageCorps?.corpsName || null,
    imageUrl: imageResult.url,
    reportDay,
  };
}

module.exports = {
  generateSeasonSummaryArticle,
  // Exported for unit testing the pure aggregation/rivalry logic.
  aggregateSeason,
  detectRivalries,
  getSoundSportRating,
};
