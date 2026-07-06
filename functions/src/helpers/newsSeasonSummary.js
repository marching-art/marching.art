// Article 6: marching.art Season Summary.
//
// A RARE piece that publishes only on a competition day (15–49) that has NO
// events to score, when the normal 5-article batch cannot run because no scores
// were processed. It is a season-to-date state of the union built entirely from
// the fantasy_recaps already on record: overall placement and rivalries in each
// class, comparisons of combined GE / combined Visual / combined Music, show
// themes and design choices, and a deep dive into SoundSport and Best-in-Show
// awards to date.
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
  // Per (day, eventName) competitive winner tally = "Best in Show" for that show.
  const showWinners = new Map(); // corpsKey -> count
  // Per day SoundSport top scorer = SoundSport Best in Show for that showcase.
  const soundSportBestInShow = new Map(); // corpsKey -> count

  for (const recap of recaps) {
    const day = recap.offSeasonDay;
    const dayCompetitiveByShow = new Map(); // eventName -> best {key,total}
    let daySoundSportBest = null; // {key, total}

    for (const show of recap.shows || []) {
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
        // Latest-day metadata wins (names/hometowns can be edited mid-season).
        if (agg.entries.length === 0 || day >= agg.entries[agg.entries.length - 1].day) {
          agg.corpsName = r.corpsName;
          agg.displayName = r.displayName || agg.displayName;
          agg.hometown = r.location || agg.hometown;
        }
        agg.entries.push({
          day,
          eventName: show.eventName || null,
          total,
          ge: Number.isFinite(r.geScore) ? r.geScore : null,
          visual: Number.isFinite(r.visualScore) ? r.visualScore : null,
          music: Number.isFinite(r.musicScore) ? r.musicScore : null,
        });

        if (r.corpsClass === "soundSport") {
          if (!daySoundSportBest || total > daySoundSportBest.total) {
            daySoundSportBest = { key, total };
          }
        } else {
          const evt = show.eventName || "Unspecified";
          const cur = dayCompetitiveByShow.get(evt);
          if (!cur || total > cur.total) dayCompetitiveByShow.set(evt, { key, total });
        }
      }
    }

    for (const winner of dayCompetitiveByShow.values()) {
      showWinners.set(winner.key, (showWinners.get(winner.key) || 0) + 1);
    }
    if (daySoundSportBest) {
      soundSportBestInShow.set(
        daySoundSportBest.key,
        (soundSportBestInShow.get(daySoundSportBest.key) || 0) + 1
      );
    }
  }

  // Finalize per-corps derived stats.
  const corps = [];
  for (const agg of byCorps.values()) {
    const sorted = [...agg.entries].sort((a, b) => a.day - b.day);
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
 * across shared competition days, or that sit within a tight season-average
 * margin of each other. Considers only the top of each class to stay cheap.
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
      // Head-to-head over days both competed.
      const bByDay = new Map(b.entries.map(e => [e.day, e.total]));
      let sharedDays = 0;
      let aWins = 0;
      let bWins = 0;
      let marginSum = 0;
      for (const e of a.entries) {
        if (!bByDay.has(e.day)) continue;
        sharedDays++;
        const bt = bByDay.get(e.day);
        marginSum += Math.abs(e.total - bt);
        if (e.total > bt) aWins++;
        else if (bt > e.total) bWins++;
      }
      if (sharedDays < 2) continue;
      const avgMargin = marginSum / sharedDays;
      const flipped = aWins > 0 && bWins > 0;
      if (!flipped && avgMargin > 1.0) continue;
      rivalries.push({
        corpsA: a.corpsName,
        corpsB: b.corpsName,
        sharedDays,
        aWins,
        bWins,
        avgMargin,
        flipped,
        // Ranking weight: flipped lead is the strongest rivalry signal, then a
        // tighter average margin, then a longer shared history.
        weight: (flipped ? 1000 : 0) + Math.max(0, 200 - avgMargin * 100) + sharedDays,
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
  const competitive = corps.filter(c => COMPETITIVE_CLASSES.includes(c.corpsClass));
  const soundSport = corps.filter(c => c.corpsClass === "soundSport");

  // Need at least a small competitive field or a SoundSport field to say anything.
  if (competitive.length === 0 && soundSport.length === 0) {
    logger.info(`Season summary: no ensembles found through day ${throughDay}; skipping.`);
    return null;
  }

  const scoredDays = new Set(recaps.map(r => r.offSeasonDay));
  const daysScored = scoredDays.size;

  // Per-class standings (competitive), ranked by latest total (the same metric
  // the game itself uses for season standings).
  const classBlocks = [];
  for (const classKey of COMPETITIVE_CLASSES) {
    const inClass = competitive
      .filter(c => c.corpsClass === classKey)
      .sort((a, b) => b.latestTotal - a.latestTotal);
    if (inClass.length === 0) continue;
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
    }));
    const rivalries = detectRivalries(inClass).map(r => ({
      corpsA: r.corpsA,
      corpsB: r.corpsB,
      note: r.flipped
        ? `have traded the lead across ${r.sharedDays} shared shows (${r.aWins}-${r.bWins}), never separated by more than a hair`
        : `separated by an average of ${r.avgMargin.toFixed(2)} across ${r.sharedDays} shared shows`,
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

  // Competitive Best-in-Show (show-win) leaders across all competitive classes.
  const showWinLeaders = competitive
    .filter(c => c.showWins > 0)
    .sort((a, b) => b.showWins - a.showWins)
    .slice(0, 6)
    .map(c => ({ corpsName: c.corpsName, classLabel: CLASS_LABELS[c.corpsClass], showWins: c.showWins }));

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
  const standingsText = classBlocks.map(block => {
    const lines = block.standings.slice(0, 8).map(s =>
      `  ${s.rank}. "${s.corpsName}" (${s.director}) — latest total ${s.latestTotal.toFixed(3)} | season avg GE ${s.avgGE.toFixed(2)}, Visual ${s.avgVisual.toFixed(2)}, Music ${s.avgMusic.toFixed(2)} | ${s.showsCount} show${s.showsCount === 1 ? "" : "s"}${s.showWins > 0 ? `, ${s.showWins} best-in-show` : ""}`
    ).join("\n");
    const rivalryLines = block.rivalries.length
      ? "\n  RIVALRIES: " + block.rivalries.map(r => `"${r.corpsA}" vs "${r.corpsB}" (${r.note})`).join("; ")
      : "";
    return `${block.label} (${block.standings.length} ensembles):\n${lines}${rivalryLines}`;
  }).join("\n\n");

  const soundSportText = soundSport.length
    ? `SoundSport participants: ${soundSport.length}\n` +
      (soundSportLeaders.length ? `Best-in-Show tally (SoundSport, ratings-only — NEVER cite a SoundSport score): ${soundSportLeaders.map(l => `"${l.corpsName}" ×${l.bestInShow}`).join(", ")}\n` : "") +
      (ratingCounts.length ? `Current best ratings distribution: ${ratingCounts.map(r => `${r.rating}: ${r.count}`).join(", ")}` : "")
    : "No SoundSport participants this season.";

  const showWinsText = showWinLeaders.length
    ? showWinLeaders.map(l => `"${l.corpsName}" (${l.classLabel}): ${l.showWins} best-in-show`).join(", ")
    : "No competitive best-in-show titles recorded yet.";

  const conceptsText = programConcepts.length
    ? programConcepts.map(p => `- "${p.corpsName}": performing ${p.concept}`).join("\n")
    : "No director-designed show concepts on record for the featured ensembles.";

  const reportDay = throughDay;
  const prompt = `You are a marching.art fantasy sports journalist writing a special SEASON-TO-DATE SUMMARY. There are no competitions to score today, so instead of a nightly recap you are taking stock of the whole fantasy season so far — through Day ${throughDay}, across ${daysScored} scored days. These are FANTASY ensembles run by real users.

WHAT THIS ARTICLE IS
- A state-of-the-season overview: overall placement and the rivalries taking shape in each competitive class, how ensembles compare on their COMBINED General Effect, COMBINED Visual, and COMBINED Music scores, the show themes and design choices directors have committed to, and a look at the SoundSport and Best-in-Show story so far.
- A change of pace on a quiet day — reflective and big-picture, not a box score.

HARD PRIVACY RULE (never violate)
- You may ONLY discuss COMBINED scores: combined General Effect, combined Visual, combined Music, and total scores. You must NEVER mention, break down, or compare individual captions (GE1, GE2, Visual Proficiency, Visual Analysis, Color Guard, Brass, Music Analysis, Percussion) or any single-caption number. Revealing caption-level detail would let readers reverse-engineer another director's private lineup picks. If you are tempted to write about a specific caption, write about the combined family (GE / Visual / Music) instead.
- Never reveal or guess any director's specific roster/lineup selections. Discuss results and design, never picks.
- SoundSport is ratings-only: celebrate ratings and Best-in-Show recognition, but NEVER print a SoundSport score.

ACCURACY RULES
- Every ensemble name, director name, score, average, margin, count, class, rivalry, rating, and award below comes from the DATA block. Do not invent any of them. Quote numbers as written; do not recompute or re-round.
- Program/show themes may be referenced ONLY for ensembles in the SHOW CONCEPTS block, exactly as described there.
- Director names are user display names — some are real names, some are handles ("elithecreature", "mike_42"). For handle-style names, refer via the ensemble ("the director behind Stellar Vista") rather than as a bare first name.

${NEWS_INTEGRITY_RULES}

Through Day ${throughDay} | ${daysScored} scored days${isLiveSeason ? " | LIVE season" : ""}

===== DATA =====
CLASS STANDINGS & RIVALRIES (ranked by latest total score — combined families only):
${standingsText}

SOUNDSPORT & BEST-IN-SHOW TO DATE:
${soundSportText}

COMPETITIVE BEST-IN-SHOW (show wins across the season): ${showWinsText}

SHOW CONCEPTS (director-designed — the only theme information that exists):
${conceptsText}
===== END DATA =====

BANNED PHRASES: dominant, commanding, stunning, heating up, sent shockwaves, the drama is just beginning, tune in tomorrow, testament to

ARTICLE REQUIREMENTS
- Headline: Frame the state of the season — a class race, a rivalry, or the overall picture. Name a real ensemble. No hype words, no invented numbers.
- Summary: 2-3 sentences setting up the season-to-date picture and the single most compelling storyline.
- Narrative: 700-950 words. Structure it with 4-6 short bolded lead-ins in Markdown (e.g., **World Class at the top.**, **The rivalry to watch.**, **Design choices.**, **SoundSport spotlight.**) at natural transitions — 2-4 words each. Cover, in whatever order reads best:
  1. Overall placement in each competitive class, comparing ensembles on combined GE, combined Visual, and combined Music (never individual captions).
  2. The rivalries taking shape — who has traded places with whom, and how close it is.
  3. Show themes and design choices from the SHOW CONCEPTS block — what directors are going for artistically.
  4. A deep dive into SoundSport and Best-in-Show to date (ratings only for SoundSport).
  Carry personality through sharp reading of the combined numbers and the season arc. No fabricated quotes, reactions, or feelings.
- End with a specific, data-grounded observation about where the season stands — not a rhetorical question.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "State-of-the-season headline naming a real ensemble. No hype words, no invented numbers, no individual captions." },
      summary: { type: Type.STRING, description: "2-3 sentence setup of the season-to-date picture and the top storyline." },
      narrative: { type: Type.STRING, description: "700-950 word season summary. Discusses ONLY combined GE / combined Visual / combined Music and totals — never individual captions and never any director's lineup picks. Every name, score, average, margin, count, rating, and award comes from the DATA block. SoundSport is ratings-only. Uses 4-6 short bolded Markdown lead-ins." },
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
    bestInShow: showWinLeaders,
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
