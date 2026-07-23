// The three nightly DCI articles: scores analysis, corps feature, and the
// weekly caption recap. Extracted verbatim from newsGeneration.js.

const { Type } = require("./newsArticleShared");
const { logger } = require("firebase-functions/v2");
const {
  ARTICLE_TYPES,
  NEWS_INTEGRITY_RULES,
  formatNegativeSpace,
  createFallbackArticle,
} = require("./newsArticleShared");
const {
  generateWithFactCheckGuard,
} = require("./geminiService");
const {
  getShowTitleFromFirestore,
} = require("./newsUniforms");
// NOTE: The DCI articles (1–3) deliberately carry NO imagery at all (imageUrl:
// null — the feed/article pages render text-only). Fabricated AI depictions of
// real corps in invented uniforms are misleading. Only the fantasy-corps events
// article (Article 5) generates an AI image, of the user's own fantasy corps.
const { getTrendNarrative } = require("./newsNarratives");
const {
  getToneGuidance,
  getWritingVariety,
  formatBriefForArticle,
} = require("./newsEditorial");

/**
 * Article 1: DCI Scores Analysis
 * Daily competition results in DCI.org editorial style
 */
async function generateDciDailyArticle({ reportDay, dayScores, trendData, seasonContext, showContext, competitionContext, ledger, brief, isLiveSeason }) {
  const topCorps = dayScores[0];

  // Get dynamic tone guidance based on competition context
  const toneGuidance = getToneGuidance(competitionContext, "dci_scores");

  // Group today's corps by the show they actually competed at.
  // Some days have one show; others have multiple, and corps in different shows
  // did NOT compete head-to-head. The prompt must make that distinction clear.
  const scoresByShow = (() => {
    const groups = new Map();
    for (const s of dayScores) {
      const key = s.showName || showContext.showName || `Day ${reportDay} Competition`;
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: s.location || showContext.location || null,
          scores: [],
        });
      }
      groups.get(key).scores.push(s);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      scores: g.scores.sort((a, b) => b.total - a.total),
    }));
  })();

  const multiShow = scoresByShow.length > 1;

  const showBlocks = scoresByShow.map(group => {
    const header = `SHOW: ${group.name}${group.location ? ` — ${group.location}` : ''} (${group.scores.length} corps)`;
    const lines = group.scores.map((s, i) => {
      const trend = trendData[s.corps];
      const change = trend?.dayChange || 0;
      const marginToNext = i > 0 ? (group.scores[i - 1].total - s.total).toFixed(3) : "-";
      const changeStr = trend && Number.isFinite(change)
        ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday)`
        : '';
      // In a live season every corps performs current-year material, so the
      // source-year tag is meaningless noise — only annotate the year off-season.
      const yearTag = !isLiveSeason && s.sourceYear ? ` [${s.sourceYear}]` : '';
      return `${i + 1}. ${s.corps}${yearTag} - ${s.total.toFixed(3)}${changeStr}${i > 0 ? ` [${marginToNext} behind]` : ' [LEADER]'}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n');
    return `${header}\n${lines}`;
  }).join('\n\n');

  // Caption winners are computed per-show so we don't imply a head-to-head
  // caption race across corps that weren't on the same field.
  const captionWinnersByShow = scoresByShow.map(group => {
    const captions = ['ge', 'visual', 'music'];
    const winners = captions.map(cap => {
      const sorted = [...group.scores].sort((a, b) => (b.subtotals?.[cap] || 0) - (a.subtotals?.[cap] || 0));
      const top = sorted[0];
      if (!top) return null;
      const margin = sorted[1] ? (top.subtotals[cap] - sorted[1].subtotals[cap]).toFixed(2) : "N/A";
      return `• ${cap.toUpperCase()}: ${top.corps} (${top.subtotals[cap]?.toFixed(2)}) — ${margin} over ${sorted[1]?.corps || 'field'}`;
    }).filter(Boolean).join('\n');
    return `${group.name}:\n${winners}`;
  }).join('\n\n');

  // Day-over-day movers across the whole field (identity by corps name is fine;
  // a corps only competes at one show on a given day).
  const surgingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange > 0.3);
  const strugglingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange < -0.3);
  const moversBlock = [
    surgingLines.length > 0 ? `- Biggest gains: ${surgingLines.map(([c, t]) => `${c} (+${t.dayChange.toFixed(3)})`).join(', ')}` : null,
    strugglingLines.length > 0 ? `- Score drops: ${strugglingLines.map(([c, t]) => `${c} (${t.dayChange.toFixed(3)})`).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const corpsRoster = dayScores.map(s => s.corps).join(', ');

  // Actual position-battle matchups (not just a count) so the writer can name
  // the specific races that are within striking distance tonight.
  const positionBattlesBlock = (competitionContext.positionBattles || [])
    .map(b => `- ${b.corps1} vs ${b.corps2}: ${b.gap} apart (positions ${b.position}–${b.position + 1})`)
    .join('\n');

  // Field-shape metrics from the editorial brief: how the standings moved as a
  // whole tonight. Decimals live here inside the DATA block so the number-source
  // guard accepts them when the writer cites them. This is the DCI Daily's
  // signature analytical angle — the field, not just the winner.
  const f = brief?.field;
  const fieldShapeBlock = f ? [
    Number.isFinite(f.spread) ? `- Field spread (1st to last): ${f.spread.toFixed(3)}` : null,
    Number.isFinite(f.top3Spread) ? `- Top-3 spread: ${f.top3Spread.toFixed(3)}` : null,
    Number.isFinite(f.leadMargin) ? `- Lead margin (1st over 2nd): ${f.leadMargin.toFixed(3)}` : null,
    f.spreadTrend ? `- Standings are ${f.spreadTrend.direction}${Number.isFinite(f.spreadTrend.delta) && f.spreadTrend.delta > 0 ? ` (${f.spreadTrend.delta.toFixed(3)} vs yesterday)` : ''}` : null,
    Number.isInteger(f.rankChurn) ? `- Position changes since yesterday: ${f.rankChurn}` : null,
    f.biggestClimber ? `- Biggest riser by rank: ${f.biggestClimber.corps} (+${f.biggestClimber.spots} spot${f.biggestClimber.spots === 1 ? '' : 's'})` : null,
    f.biggestFaller ? `- Biggest slider by rank: ${f.biggestFaller.corps} (-${f.biggestFaller.spots} spot${f.biggestFaller.spots === 1 ? '' : 's'})` : null,
    f.gapCloser ? `- Biggest gap-closer: ${f.gapCloser.corps} shaved ${f.gapCloser.closed.toFixed(3)} off the margin to ${f.gapCloser.onCorps}` : null,
  ].filter(Boolean).join('\n') : '';

  // Season milestones: corps that hit a true season high or low tonight, plus
  // where tonight's overall leader ranks against the field this season. A light
  // touch — the Daily's spine is the field shape above, this is seasoning.
  const seasonHighsTonight = Object.entries(trendData).filter(([, t]) => t.atSeasonBest).map(([c]) => c);
  const seasonLowsTonight = Object.entries(trendData).filter(([, t]) => t.atSeasonWorst).map(([c]) => c);
  const leaderPct = seasonContext?.[dayScores[0]?.corps]?.percentileTotal;
  const milestonesBlock = [
    seasonHighsTonight.length ? `- Season high tonight: ${seasonHighsTonight.join(', ')}` : null,
    seasonLowsTonight.length ? `- Season low tonight: ${seasonLowsTonight.join(', ')}` : null,
    Number.isFinite(leaderPct) ? `- Tonight's top corps ${dayScores[0].corps} ranks ${leaderPct}th percentile in the field this season` : null,
  ].filter(Boolean).join('\n');

  // Get today's narrative variety to keep articles from feeling templated
  const variety = getWritingVariety(reportDay, "dci_daily");

  // In a live season every corps' sourceYear has been resolved to the current
  // competition year upstream, so it doubles as the season label for the prompt.
  const liveSeasonYear = isLiveSeason
    ? (dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear()))
    : null;

  const prompt = `You are a DCI.org staff writer covering tonight's competitions. Write a genuine article — not a template with blanks filled in. Every night's story is different because every night's scores tell a different story. Find that story.

ACCURACY RULES (read first — violations ruin the article)
- Every corps name, score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent corps, venues, cities, dates, or statistics.
- Only the corps listed in CORPS COMPETING TONIGHT exist in this article. Do not reference any corps not in that list.
- The field tonight has ${dayScores.length} corps — never state any other count, and never imply corps not listed were present.
${multiShow ? `- There are ${scoresByShow.length} separate competitions tonight at different venues. Corps at different shows did NOT compete against each other. Never imply a head-to-head result between corps that weren't at the same show. When you cite a score or placement, make the show clear from context.` : `- All corps tonight competed at a single show: ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` in ${scoresByShow[0].location}` : ''}.`}
${isLiveSeason
  ? `- This is the ${liveSeasonYear} live DCI season. Write about THIS season's competitions and scores as they happen now — do NOT reference a prior year's program material or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's program material the corps is performing. Every corps in the DATA block has a listed sourceYear; use it. After the first mention, the year can be omitted.`}
- If a data point you want to reference isn't in the DATA block, leave it out. Do not fill gaps with plausible-sounding invention.
- VENUE: a show's city or venue is available only when the DATA block prints one next to the show name. When a show has no location listed, refer to it by name alone ("at Drums Across the Smokies") — never write "an unknown location", "an undisclosed venue", "Competition Venue", "somewhere", or invent a city or state. A dateline (e.g., "INDIANAPOLIS —") is allowed only if that city is actually in the data. Simply omitting the venue reads as professional; naming a placeholder reads as broken.

${NEWS_INTEGRITY_RULES}

VOICE & STYLE
Study how DCI.org actually writes:
- "Boom." (punchy one-word opener)
- "INDIANAPOLIS — A mere 0.175-point gap separates first and second."
- "After trailing by 0.175 points Thursday, Bluecoats gained a lead of 0.188 points Friday."
- "Less than half a point separated The Cavaliers, Blue Stars, and Troopers — three corps who have been neck-and-neck throughout the season."

Lead with specific facts, stay concise, let the numbers carry the weight. No hype words. No exclamation points. The drama is in the data.

Write it like a reporter with a real story, not a results database narrating itself. The most common failure mode is recitation — marching corps-by-corps and reading out each one's total, then GE, then Visual, then Music, in the same flat cadence. Do NOT do that. Instead:
- Find tonight's through-line first (the tightest race, a lead that flipped, a caption that decided the night, a corps surging from nowhere) and build the piece around it.
- Cite the numbers that MEAN something — a decisive caption gap, a margin that shrank, a season high — and let the rest of the field be summarized rather than enumerated. A corps can be covered in a sharp clause; not every corps needs its full caption line.
- Vary sentence rhythm and connect results to each other ("what cost Carolina Crown the lead was Visual, not GE") rather than listing them side by side.
- Prefer the active, specific verb ("edged", "shaved the gap to", "held off") over flat linking verbs ("posted", "achieved", "resulted in a score of").

Score language should be precise: "edging past by 0.087" / "three-tenths back" / "a scant 0.2-point gap" / "swept every caption except Color Guard"
Caption terminology: GE (GE1 Music Effect + GE2 Visual Effect), Visual (VP, VA, CG), Music (B, MA, P)

BANNED PHRASES (AI tells): dominant, commanding, stellar, stunning, thrilling, incredible, captivating, testament, mettle, besting, heating up, setting the stage, all eyes on, force to be reckoned with, proves their mettle, tune in tomorrow, stay tuned, momentum is building, final showdown, critical juncture, dynasty in the making, echoes still resonate, poured their hearts into, leaving spectators on edge, within striking distance, absolutely crucial, emerging as a true contender

===== DATA =====
Day ${reportDay} — ${showContext.date}

CORPS COMPETING TONIGHT (${dayScores.length}): ${corpsRoster}

${multiShow ? `TONIGHT'S SHOWS (${scoresByShow.length}):` : `TONIGHT'S SHOW:`}
${scoresByShow.map(g => `- ${g.name}${g.location ? ` — ${g.location}` : ''} (${g.scores.length} corps)`).join('\n')}

RESULTS BY SHOW
${showBlocks}

CAPTION WINNERS (per show):
${captionWinnersByShow}

DAY-OVER-DAY MOVERS${moversBlock ? '' : ': none of note'}
${moversBlock}
${fieldShapeBlock ? `\nFIELD SHAPE (how the standings moved as a whole tonight):\n${fieldShapeBlock}\n` : ''}${milestonesBlock ? `\nSEASON MILESTONES:\n${milestonesBlock}\n` : ''}
POSITION BATTLES (${competitionContext.positionBattleCount} within 0.2 of the spot ahead)${positionBattlesBlock ? `:\n${positionBattlesBlock}` : ': none within 0.2 tonight.'}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_daily')}
TONIGHT'S NARRATIVE APPROACH
Opening: ${variety.opening}
Angle: ${variety.angle}
Structure: ${variety.structure}

HOW TO WRITE THIS ARTICLE
- Headline: Specific and factual. No exclamation points. Reference an actual margin, score, or storyline from the data.
- Summary: 2-3 factual sentences — key result, the margin, and one specific storyline${multiShow ? '. If the night had multiple shows, make that clear in the summary' : ''}.
- Narrative: 600-900 words. Every scoring corps should appear by name at least once, but let significance drive the emphasis — don't pad coverage to hit a checklist, and don't march through rank order unless that's genuinely the best frame.
${multiShow ? `- Cover all ${scoresByShow.length} shows by name. For each score or placement you cite, make the show clear (via dateline, a phrase like "at [Show]", or section framing). Readers should never be confused about which corps competed where.` : `- This is a single-show night — ground the article in ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` (${scoresByShow[0].location})` : ''} and treat the standings as one field.`}
- Weave day-over-day changes and caption details where they're relevant; don't break them out as obligatory sections.
- Use the FIELD SHAPE data — whether the field tightened or spread, how much position churn there was, the biggest gap-closer — as a structural through-line, not just a list of who placed where. This is what separates your piece from a bare results table: the story of how the whole standings moved tonight.
- Structure the piece with 3-4 short bolded lead-ins in Markdown (e.g., **The result.**, **The margins.**, **Movers.**, **What's next.**) at natural transitions. Keep each to 2-4 words — they render as section subheads and make the piece scannable. Don't over-segment.
- Close with a specific, grounded observation — a number, a trend, a question the next show will answer. No "tune in tomorrow" sign-offs.
- Also fill the structured fields: trendingCorps (only corps with a real up/down move from tonight's movers/momentum data, each with a short data-grounded reason — omit corps that didn't move) and insights (2-4 scannable takeaways, each tied to a specific number from the data).

Write like you've covered this beat for years. Let the scores drive the story.`;


  // Schema for structured output
  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Factual headline grounded in tonight's actual results. No exclamation points, no 'dominates' or 'stunning', no invented facts." },
      summary: { type: Type.STRING, description: "2-3 factual sentences. When multiple shows occurred, make that clear. Only use corps, scores, and venues from the DATA block." },
      narrative: { type: Type.STRING, description: "600-900 word article. Every scoring corps appears by name at least once; emphasis follows significance, not checklist. When there are multiple shows, make the venue split clear for every score cited. Never invent corps, venues, or statistics. Never use 'dominant', 'commanding', 'heating up', 'besting'." },
      standings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corps: { type: Type.STRING },
            year: { type: Type.INTEGER },
            total: { type: Type.NUMBER },
            change: { type: Type.NUMBER },
            momentum: { type: Type.STRING, enum: ["rising", "falling", "steady"] },
          },
          required: ["rank", "corps", "year", "total", "change", "momentum"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Caption score breakdown for top corps",
        properties: {
          geWinner: { type: Type.STRING, description: "Corps that won GE caption" },
          geScore: { type: Type.NUMBER, description: "Winning GE score" },
          visualWinner: { type: Type.STRING, description: "Corps that won Visual caption" },
          visualScore: { type: Type.NUMBER, description: "Winning Visual score" },
          musicWinner: { type: Type.STRING, description: "Corps that won Music caption" },
          musicScore: { type: Type.NUMBER, description: "Winning Music score" },
        },
        required: ["geWinner", "geScore", "visualWinner", "visualScore", "musicWinner", "musicScore"],
      },
      trendingCorps: {
        type: Type.ARRAY,
        description: "Up to 5 corps with a genuine day-over-day or momentum direction, drawn ONLY from the DAY-OVER-DAY MOVERS and MOMENTUM data. Omit corps with no meaningful movement — do not pad the list to fill it.",
        items: {
          type: Type.OBJECT,
          properties: {
            corps: { type: Type.STRING, description: "Corps name, exactly as in the data." },
            direction: { type: Type.STRING, enum: ["up", "down", "stable"], description: "Momentum direction from the data." },
            reason: { type: Type.STRING, description: "One concise, data-grounded reason (e.g., '+0.412 tonight, led by GE'). No invented numbers." },
          },
          required: ["corps", "direction", "reason"],
        },
      },
      insights: {
        type: Type.ARRAY,
        description: "2-4 scannable key takeaways from tonight for a reader skimming the article. Each must be grounded in the DATA block.",
        items: {
          type: Type.OBJECT,
          properties: {
            metric: { type: Type.STRING, description: "Short label, e.g., 'Tightest Race' or 'Biggest Mover'." },
            finding: { type: Type.STRING, description: "The specific data point, e.g., '0.087 separates the top two.'" },
            implication: { type: Type.STRING, description: "Why it matters for the standings. Descriptive, not a fantasy pick." },
          },
          required: ["metric", "finding", "implication"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "standings", "scoreBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_daily",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // No imagery for DCI articles — a fabricated depiction of the top corps
    // would be misleading, and the feed/article pages render fine without one.
    return {
      type: ARTICLE_TYPES.DCI_DAILY,
      ...content,
      featuredCorps: topCorps.corps, // Track which corps was featured for diversity
      imageUrl: null,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Scores article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_DAILY, reportDay);
  }
}

/**
 * Article 2: DCI Corps Feature
 * In-depth feature on a single corps and their progress across the season
 * Written in DCI.org editorial style
 */
async function generateDciFeatureArticle({ reportDay, dayScores, trendData, seasonContext, showContext, competitionContext, db, ledger, brief, isLiveSeason }) {
  // Derive the corps exclusion set from the coverage ledger so this article
  // doesn't repeat a spotlight subject from earlier in the batch.
  const excludeCorps = ledger?.dciCorps || new Set();
  const toneGuidance = getToneGuidance(competitionContext, "dci_corps_feature");

  // Corps selection priority:
  //   1. The editorial brief's trajectory pick (if it resolves to a corps in
  //      tonight's field and isn't already spotlit).
  //   2. Day-based rotation through the field (falls back if the brief either
  //      didn't produce a pick or picked a corps that's been excluded).
  let featureCorps = null;
  if (brief?.trajectory?.corps) {
    const briefPick = dayScores.find(s => s.corps === brief.trajectory.corps);
    if (briefPick && !excludeCorps.has(briefPick.corps)) {
      featureCorps = briefPick;
    }
  }
  if (!featureCorps) {
    let featureIndex = (reportDay - 1) % dayScores.length;
    featureCorps = dayScores[featureIndex];
    if (excludeCorps.has(featureCorps?.corps)) {
      for (let i = 1; i < dayScores.length; i++) {
        const nextIndex = (featureIndex + i) % dayScores.length;
        if (!excludeCorps.has(dayScores[nextIndex]?.corps)) {
          featureCorps = dayScores[nextIndex];
          break;
        }
      }
    }
  }

  const currentRank = dayScores.findIndex(s => s.corps === featureCorps.corps) + 1;
  const corpsTrend = trendData[featureCorps.corps] || { dayChange: 0, trendFromAvg: 0, avgTotal: featureCorps.total };

  // Get show title for this corps from Firestore (referenced in the prompt below).
  const showTitle = db ? await getShowTitleFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;

  // Calculate season progress data (true season-to-date now, not a 7-day window)
  const seasonHigh = corpsTrend.seasonHigh || featureCorps.total;
  const seasonLow = corpsTrend.seasonLow || featureCorps.total;
  const improvement = corpsTrend.totalImprovement || 0;
  const seasonAvg = corpsTrend.seasonAvg;
  const seasonShows = corpsTrend.seasonShows;
  const seasonImprovement = corpsTrend.seasonImprovement;

  // Field-relative season context for THIS corps: where their caption families
  // rank against the whole field this season. This is the signature "wow" data
  // for the feature — percentile strength no single-corps trend can show.
  const sc = seasonContext?.[featureCorps.corps] || null;
  const pctPhrase = (c) => c ? `${c.label} (${c.percentile}th percentile of the field)` : null;
  const seasonContextBlock = sc ? [
    `FIELD-RELATIVE SEASON CONTEXT (this corps vs the ${sc.fieldSize}-corps field, season to date):`,
    Number.isFinite(sc.seasonAvgTotal) ? `- Season average total: ${sc.seasonAvgTotal.toFixed(2)} — ${sc.percentileTotal}th percentile overall` : null,
    sc.captions?.ge ? `- General Effect: ${pctPhrase(sc.captions.ge)}` : null,
    sc.captions?.visual ? `- Visual: ${pctPhrase(sc.captions.visual)}` : null,
    sc.captions?.music ? `- Music: ${pctPhrase(sc.captions.music)}` : null,
    sc.strongest && sc.weakest ? `- Strongest area this season: ${sc.strongest.family.toUpperCase()}; softest: ${sc.weakest.family.toUpperCase()}` : null,
  ].filter(Boolean).join('\n') : '';

  // Build show-by-show history for the last 5 shows
  const recentShowHistory = corpsTrend.recentScores || [];
  const showHistoryText = recentShowHistory
    .filter(s => s.total >= 60) // Ignore scores under 60
    .slice(-5)
    .map((s, i, arr) => {
      const prevScore = i > 0 ? arr[i-1].total : null;
      const change = prevScore ? (s.total - prevScore) : 0;
      const changeStr = prevScore ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)})` : '';
      return `Day ${s.day}: ${s.total.toFixed(3)}${changeStr}${s.showName ? ` at ${s.showName}` : ''}${s.location ? `, ${s.location}` : ''}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n') || 'Limited show history available';

  // The per-day caption arc (GE/Visual/Music show by show) is already carried in
  // the SHOW-BY-SHOW block below, so the writer can narrate the caption
  // trajectory directly from that — no separate structure needed.

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_feature");

  // Pre-compute seeded narrative hints so the featured corps gets deterministic
  // per-(corps, day) phrasing for their momentum, streak, and caption story.
  // Seeded by corps+day+articleType so the same corps on the same day produces
  // one set of hints inside DCI Feature, but a different set if the same corps
  // shows up as a pick in the Fantasy Market Report later in the batch.
  const narrativeSeed = `${featureCorps.corps}:${reportDay}:dci_feature`;
  const narrative = getTrendNarrative(corpsTrend, narrativeSeed);
  const narrativeHintsBlock = narrative ? [
    narrative.momentum ? `- Momentum framing: "${narrative.momentum}"` : null,
    narrative.streak ? `- Streak framing: "${narrative.streak}"` : null,
    narrative.caption ? `- Caption framing: "${narrative.caption}"` : null,
    narrative.performance ? `- Season-context framing: "${narrative.performance}"` : null,
    narrative.stability ? `- Stability framing: "${narrative.stability}"` : null,
  ].filter(Boolean).join('\n') : '';

  const tonightShow = featureCorps.showName || showContext.showName;
  const tonightLocation = featureCorps.location || showContext.location;

  const prompt = `You are a DCI.org feature writer profiling ${featureCorps.corps}'s season. This is a numbers-driven piece — the kind of article a knowledgeable fan reads to understand what the scores actually say about this corps. Not a puff piece. Not a history lesson. A season audit.

ACCURACY RULES (read first)
- Every score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent venues, cities, dates, or scores.
${isLiveSeason
  ? `- This is the ${featureCorps.sourceYear} live DCI season. ${featureCorps.corps} is competing with their current ${featureCorps.sourceYear} program — write about this season's performances and scores, and do NOT reference or tag a prior year's program material.`
  : `- The featured corps is ${featureCorps.corps} competing with ${featureCorps.sourceYear} material. Do not reference seasons or material other than ${featureCorps.sourceYear} unless it appears in the data.
- Source-year disclosure: on the corps' FIRST mention in the narrative, render as "${featureCorps.corps} (${featureCorps.sourceYear})" so fantasy readers know which season's program they're reading about. After the first mention, omit the year unless you're explicitly contrasting seasons.`}
- If a fact isn't in the data, leave it out — do not fill gaps with plausible-sounding invention.

${NEWS_INTEGRITY_RULES}

VOICE: Sports analyst who respects the reader's intelligence. Specific scores, real comparisons, honest assessments. No filler about tradition or history — only this season's data matters.

BANNED PHRASES: dominant, commanding, stunning, thrilling, incredible, captivating, testament, mettle, identity forged in, legacy of excellence, storied history, tradition of, proving doubters wrong, making a statement, force to be reckoned with, passion and dedication, pushing the boundaries, compelling visual storytelling, emotionally resonant

DATA RULES: Ignore total scores under 60 (incomplete). Ignore caption scores of 0 (missing).

===== DATA =====
FEATURED CORPS: ${featureCorps.corps}
${isLiveSeason ? 'Live season' : 'Season material'}: ${featureCorps.sourceYear}${showTitle ? ` | Show title: "${showTitle}"` : ''}
Tonight's competition: ${tonightShow || 'N/A'}${tonightLocation ? ` — ${tonightLocation}` : ''}
Tonight's placement: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} of ${dayScores.length} at that show, ${featureCorps.total.toFixed(3)} (${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)} from yesterday)
Season (${seasonShows || 'few'} shows to date): High ${seasonHigh.toFixed(3)} | Low ${seasonLow >= 60 ? seasonLow.toFixed(3) : 'N/A'}${Number.isFinite(seasonAvg) ? ` | Avg ${seasonAvg.toFixed(3)}` : ''}${Number.isFinite(seasonImprovement) ? ` | Opener-to-now ${seasonImprovement >= 0 ? '+' : ''}${seasonImprovement.toFixed(3)}` : ''} | 7-day net ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)} | Momentum: ${corpsTrend.momentum || 'steady'}${corpsTrend.atSeasonBest ? ' | ★ AT SEASON HIGH TONIGHT' : ''}${corpsTrend.atSeasonWorst ? ' | ▼ SEASON LOW TONIGHT' : ''}
${seasonContextBlock ? `\n${seasonContextBlock}\n` : ''}
SHOW-BY-SHOW (last 5 valid — use these exact show names and locations):
${showHistoryText}

CAPTIONS TONIGHT:
GE: ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.ge?.trending === "up" ? "↑" : corpsTrend.captionTrends?.ge?.trending === "down" ? "↓" : "→"} (GE1: ${featureCorps.captions?.GE1?.toFixed(2) || 'N/A'}, GE2: ${featureCorps.captions?.GE2?.toFixed(2) || 'N/A'})
Visual: ${featureCorps.subtotals?.visual?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.visual?.trending === "up" ? "↑" : corpsTrend.captionTrends?.visual?.trending === "down" ? "↓" : "→"} (VP: ${featureCorps.captions?.VP?.toFixed(2) || 'N/A'}, VA: ${featureCorps.captions?.VA?.toFixed(2) || 'N/A'}, CG: ${featureCorps.captions?.CG?.toFixed(2) || 'N/A'})
Music: ${featureCorps.subtotals?.music?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.music?.trending === "up" ? "↑" : corpsTrend.captionTrends?.music?.trending === "down" ? "↓" : "→"} (B: ${featureCorps.captions?.B?.toFixed(2) || 'N/A'}, MA: ${featureCorps.captions?.MA?.toFixed(2) || 'N/A'}, P: ${featureCorps.captions?.P?.toFixed(2) || 'N/A'})

COMPETITIVE NEIGHBORHOOD (corps ranked within a few spots of the feature at today's show):
${dayScores.slice(Math.max(0, currentRank - 3), Math.min(dayScores.length, currentRank + 4)).map((s, i) => {
  const rank = Math.max(0, currentRank - 3) + i + 1;
  const gap = s.total - featureCorps.total;
  const venueTag = s.showName && s.showName !== tonightShow ? ` @ ${s.showName}` : '';
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${venueTag}${s.corps === featureCorps.corps ? ' ← FEATURED' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`}`;
}).join('\n')}
${narrativeHintsBlock ? `
NARRATIVE HINTS (you may use, paraphrase, or ignore these — do NOT use more than one verbatim in the same article, and do not daisy-chain them):
${narrativeHintsBlock}` : ''}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_feature')}
TODAY'S APPROACH
Lens: ${variety.lens}
Focus: ${variety.focus}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Include a real number (score, margin, trend). No exclamation points. No generic praise.
- Summary: 2-3 sentences — rank, score, and a specific caption insight. Reference the actual show name when natural.
- Narrative: 700-900 words. A season profile built on scores.
  Include: specific scores from their recent shows (use the exact show names from the data), analysis of at least 3 individual captions with numbers, a comparison to the corps around them tonight, and a reasoned outlook that follows the closing angle above.
  Sequence and emphasis are your call — if GE is the story, lead with GE; if trajectory is the story, lead with the arc. Don't walk through a checklist.
  If the FIELD-RELATIVE SEASON CONTEXT is present, use it — where this corps ranks against the whole field (percentile, "elite/strong/developing" in each caption family) is exactly the context that separates a real season audit from a recap of one night. Anchor at least one point in it.
  Structure the piece with 3-5 short bolded lead-ins in Markdown (e.g., **Where they stand.**, **The caption story.**, **Season arc.**, **The outlook.**) at natural transitions — 2-4 words each; they render as section subheads. Don't over-segment.
  Do NOT end with fantasy buy/hold/sell or lineup picks — that belongs to the Fantasy Market Report. Do NOT predict exact future scores — only analyze visible trends.
- Also fill the insights field: 2-3 scannable takeaways about this corps, each tied to a specific score, caption, or trend from the data.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Corps name with a real number/trend from tonight. No 'dominates', no exclamation points, no invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences: corps name, current score, rank, and one specific caption insight grounded in the data." },
      narrative: { type: Type.STRING, description: "700-900 word analytical profile. Uses the exact show names and scores from the data block — no invented venues, dates, or statistics. Covers current position, show-by-show journey with specific scores, caption strengths, caption weaknesses, and trajectory, ending per the closing angle above. No fantasy buy/hold/sell picks — that belongs to the Fantasy Market Report. Structure follows what the data emphasizes, not a fixed checklist. Never uses 'dominant', 'commanding', 'stunning'." },
      insights: {
        type: Type.ARRAY,
        description: "2-3 scannable key takeaways about this corps for a reader skimming the profile. Each must be grounded in the DATA block — a real score, caption, or trend. No invented history or biography.",
        items: {
          type: Type.OBJECT,
          properties: {
            metric: { type: Type.STRING, description: "Short label, e.g., 'Caption Strength' or 'Season Arc'." },
            finding: { type: Type.STRING, description: "The specific data point, e.g., 'GE up +0.45 over the last three shows.'" },
            implication: { type: Type.STRING, description: "What it says about this corps' season. Descriptive analysis, not a fantasy pick." },
          },
          required: ["metric", "finding", "implication"],
        },
      },
    },
    required: ["headline", "summary", "narrative"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_feature",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // No imagery for DCI articles (see note at top of file).
    return {
      type: ARTICLE_TYPES.DCI_FEATURE,
      ...content,
      featuredCorps: featureCorps.corps,
      featuredYear: featureCorps.sourceYear,
      showTitle,
      imageUrl: null,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Corps Feature article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_FEATURE, reportDay);
  }
}

/**
 * Article 3: DCI Weekly Recap
 * Deep dive on General Effect, Visual, and Music trends over the last week
 * Written in DCI.org recap analysis style
 */
async function generateDciRecapArticle({ reportDay, dayScores, trendData, seasonContext, showContext, competitionContext, ledger, brief, isLiveSeason }) {
  // Derive the corps exclusion set from the coverage ledger so the image subject
  // picker below doesn't land on a corps already spotlit in an earlier article.
  const excludeCorps = ledger?.dciCorps || new Set();
  const toneGuidance = getToneGuidance(competitionContext, "dci_weekly_recap");

  // Build comprehensive caption trend analysis
  const captionTrends = {
    ge: { leaders: [], trending: [], analysis: "" },
    visual: { leaders: [], trending: [], analysis: "" },
    music: { leaders: [], trending: [], analysis: "" },
  };

  // Analyze each corps' caption trends over the week
  dayScores.slice(0, 10).forEach(corps => {
    const trend = trendData[corps.corps];
    if (trend?.captionTrends) {
      if (trend.captionTrends.ge?.trending === "up") {
        captionTrends.ge.trending.push({ corps: corps.corps, change: trend.captionTrends.ge.weekChange || 0 });
      }
      if (trend.captionTrends.visual?.trending === "up") {
        captionTrends.visual.trending.push({ corps: corps.corps, change: trend.captionTrends.visual.weekChange || 0 });
      }
      if (trend.captionTrends.music?.trending === "up") {
        captionTrends.music.trending.push({ corps: corps.corps, change: trend.captionTrends.music.weekChange || 0 });
      }
    }
  });

  // Find caption leaders
  const geSorted = [...dayScores].sort((a, b) => (b.subtotals?.ge || 0) - (a.subtotals?.ge || 0));
  const visualSorted = [...dayScores].sort((a, b) => (b.subtotals?.visual || 0) - (a.subtotals?.visual || 0));
  const musicSorted = [...dayScores].sort((a, b) => (b.subtotals?.music || 0) - (a.subtotals?.music || 0));

  // Build comprehensive corps data for the entire field
  const _allCorpsTrends = dayScores.map(corps => {
    const trend = trendData[corps.corps] || {};
    return {
      corps: corps.corps,
      total: corps.total,
      ge: corps.subtotals?.ge,
      visual: corps.subtotals?.visual,
      music: corps.subtotals?.music,
      momentum: trend.momentum || 'steady',
      dayChange: trend.dayChange || 0,
      geTrend: trend.captionTrends?.ge?.trending || 'stable',
      visualTrend: trend.captionTrends?.visual?.trending || 'stable',
      musicTrend: trend.captionTrends?.music?.trending || 'stable',
    };
  });

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_recap");

  // Distinct shows represented in today's field (for venue-aware phrasing)
  const uniqueShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowToday = uniqueShows.length > 1;

  // Season-long, field-relative caption leaders. Connects tonight's snapshot to
  // the whole-season picture: who has actually owned each caption family this
  // year, and where tonight's leader sits in that season-long ranking. This is
  // the field-relative depth a bare one-night ranking can't show.
  const recapFieldNames = dayScores.map(s => s.corps);
  const seasonLeader = (fam) => {
    let best = null;
    for (const name of recapFieldNames) {
      const c = seasonContext?.[name]?.captions?.[fam];
      if (c && (!best || c.percentile > best.percentile)) best = { corps: name, ...c };
    }
    return best;
  };
  const seasonPctOf = (corps, fam) => seasonContext?.[corps]?.captions?.[fam]?.percentile;
  const seasonLeadersBlock = (() => {
    if (!seasonContext || Object.keys(seasonContext).length === 0) return '';
    const rows = [
      { fam: 'ge', label: 'GE', tonight: geSorted[0]?.corps },
      { fam: 'visual', label: 'Visual', tonight: visualSorted[0]?.corps },
      { fam: 'music', label: 'Music', tonight: musicSorted[0]?.corps },
    ].map(({ fam, label, tonight }) => {
      const lead = seasonLeader(fam);
      if (!lead) return null;
      const tonightPct = seasonPctOf(tonight, fam);
      const tonightNote = tonight && Number.isFinite(tonightPct)
        ? ` Tonight's ${label} leader ${tonight} sits at the ${tonightPct}th percentile season-long.`
        : '';
      return `- ${label}: ${lead.corps} has owned the field this season (${lead.label}, ${lead.percentile}th percentile).${tonightNote}`;
    }).filter(Boolean);
    return rows.length ? `SEASON-LONG FIELD LEADERS (whole season, field-relative — use to frame tonight against the year):\n${rows.join('\n')}` : '';
  })();

  const prompt = `You are a DCI score analyst writing tonight's caption deep-dive. This is the piece a serious drum corps fan bookmarks — the one that explains what the judges are actually rewarding and where the real races are hiding inside the overall standings. It is PURE caption analysis and description — it is not a fantasy column.

SCOPE (read carefully)
- This article DESCRIBES the caption landscape. It does NOT give fantasy buy/hold/sell picks, lineup advice, or "which caption to pick tomorrow" recommendations — a separate Fantasy Market Report article covers that.
- You may describe trajectory, momentum, and what a corps' caption profile suggests about their program identity and direction. You may NOT frame any observation as a pick, trade, buy, sell, hold, target, fade, or fantasy action.
- Readers who want actionable picks will read the Fantasy Market Report. Your job is to leave them understanding the night, not telling them what to do with their lineup.

ACCURACY RULES
- Every corps name, score, caption number, and trend direction you write MUST come from the DATA block below. Do not invent corps, scores, or statistics.
- The field being analyzed is ${dayScores.length} corps (listed below). Never state any other count, and never reference corps not in this list.
${multiShowToday ? `- Tonight's caption numbers come from ${uniqueShows.length} different shows: ${uniqueShows.join(', ')}. Corps at different shows did NOT judge against each other tonight, so the caption rankings below are a composite across venues — frame cross-venue comparisons as such, not as a head-to-head caption duel.` : `- Tonight's caption numbers come from a single show, so the caption rankings below are a true head-to-head.`}
${isLiveSeason
  ? `- This is the ${dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear())} live DCI season — the caption scores below are from this season's competitions. Do NOT reference a prior year's book or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's book is driving the caption scores. Every corps' year is listed in CORPS SOURCE YEARS below. After the first mention, the year can be omitted.`}
- If a fact isn't in the data, leave it out.

${NEWS_INTEGRITY_RULES}

VOICE & CRAFT: Write like a working journalist, not a stat sheet. The best drum corps writing finds the one tension that defines the night and pulls the reader through it — a race that has no business being this close, a caption a corps has quietly rebuilt over the week, a number that argues with the eye test. Open with a real lede that frames that tension; do not throat-clear with "here are tonight's caption rankings." Spend adjectives sparingly and let the numbers carry the drama — your job is to explain what they MEAN, not to re-list them. Prize the specific over the generic (name the sub-caption, the exact gap, the corps that moved), vary your sentence rhythm so short lines can land after longer ones, and keep one through-line running from the lede to the close. Authoritative but readable: a knowledgeable fan should finish both understanding the caption landscape better than before AND having enjoyed the read. Analyze; never merely recite.

BANNED PHRASES: dominant, commanding, stunning, thrilling, heating up, captivating, testament, battle for supremacy, stakes are high, every point matters, absolutely crucial, setting the stage, poised to, poised for success, will have a significant advantage, buy, sell, hold, trade, pick up, drop, fade, target, stash, fantasy directors should, for fantasy purposes, in your lineup

===== DATA =====
${dayScores.length} CORPS | Week: Days ${reportDay - 6} through ${reportDay} | Date: ${showContext.date}
CORPS IN TONIGHT'S FIELD: ${dayScores.map(s => s.corps).join(', ')}
${isLiveSeason ? '' : `CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}
`}
GENERAL EFFECT (40% of total) — arrow is the week trend, "wk" is the point swing over the window:
${geSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.ge;
  const margin = i > 0 ? (geSorted[i-1].subtotals?.ge - s.subtotals?.ge).toFixed(2) : '-';
  const arrow = trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→";
  const wk = trend && Number.isFinite(trend.weekChange) && Math.abs(trend.weekChange) >= 0.05 ? ` wk ${trend.weekChange >= 0 ? '+' : ''}${trend.weekChange.toFixed(2)}` : '';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.ge?.toFixed(2)} [GE1: ${s.captions?.GE1?.toFixed(2)}, GE2: ${s.captions?.GE2?.toFixed(2)}] ${arrow}${wk} (${margin} behind)`;
}).join('\n')}

VISUAL (30% of total) — arrow is the week trend, "wk" is the point swing over the window:
${visualSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.visual;
  const margin = i > 0 ? (visualSorted[i-1].subtotals?.visual - s.subtotals?.visual).toFixed(2) : '-';
  const arrow = trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→";
  const wk = trend && Number.isFinite(trend.weekChange) && Math.abs(trend.weekChange) >= 0.05 ? ` wk ${trend.weekChange >= 0 ? '+' : ''}${trend.weekChange.toFixed(2)}` : '';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.visual?.toFixed(2)} [VP: ${s.captions?.VP?.toFixed(2)}, VA: ${s.captions?.VA?.toFixed(2)}, CG: ${s.captions?.CG?.toFixed(2)}] ${arrow}${wk} (${margin} behind)`;
}).join('\n')}

MUSIC (30% of total) — arrow is the week trend, "wk" is the point swing over the window:
${musicSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.music;
  const margin = i > 0 ? (musicSorted[i-1].subtotals?.music - s.subtotals?.music).toFixed(2) : '-';
  const arrow = trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→";
  const wk = trend && Number.isFinite(trend.weekChange) && Math.abs(trend.weekChange) >= 0.05 ? ` wk ${trend.weekChange >= 0 ? '+' : ''}${trend.weekChange.toFixed(2)}` : '';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.music?.toFixed(2)} [B: ${s.captions?.B?.toFixed(2)}, MA: ${s.captions?.MA?.toFixed(2)}, P: ${s.captions?.P?.toFixed(2)}] ${arrow}${wk} (${margin} behind)`;
}).join('\n')}

MOMENTUM BY CORPS:
${Object.entries(trendData).map(([corps, trend]) => {
  return `${corps}: ${trend.momentum || 'steady'} | Day: ${trend.dayChange >= 0 ? '+' : ''}${trend.dayChange?.toFixed(3) || 'N/A'} | GE: ${trend.captionTrends?.ge?.trending || 'stable'} | Vis: ${trend.captionTrends?.visual?.trending || 'stable'} | Mus: ${trend.captionTrends?.music?.trending || 'stable'}`;
}).join('\n')}

SUBCAPTION LEADERS:
GE1: ${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.captions?.GE1?.toFixed(2)}) | GE2: ${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.captions?.GE2?.toFixed(2)})
VP: ${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.captions?.VP?.toFixed(2)}) | VA: ${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.captions?.VA?.toFixed(2)}) | CG: ${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.captions?.CG?.toFixed(2)})
B: ${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.captions?.B?.toFixed(2)}) | MA: ${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.captions?.MA?.toFixed(2)}) | P: ${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.captions?.P?.toFixed(2)})
${seasonLeadersBlock ? `\n${seasonLeadersBlock}\n` : ''}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_recap')}
TODAY'S ANALYTICAL APPROACH
Lead with: ${variety.emphasis}
Thread: ${variety.thread}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Technical, number-focused. Reference a specific caption gap or trend. No hype words, no "buy/sell" framing.
- Summary: 2-3 factual sentences with key caption insights from tonight's data.
- Narrative: 900-1200 words of caption analysis covering GE, Visual, and Music. Describe what the judges rewarded, where the races are tight, how the sub-caption picture differs from the composite picture, and how the week's trajectory reshapes each corps' caption profile. Close per the closing angle above.
  Reference a meaningful cross-section of the field in each caption family — aim for ${Math.min(5, dayScores.length)} or more corps per family, but never pad by inventing. Cite specific point gaps from the data.
  Weight the sections by where the real story is tonight. If the Visual race is tight and GE is decided, Visual gets more ink.
  Do NOT end with buy/hold/sell, fantasy picks, or "who to target" — the Fantasy Market Report handles that. Your ending belongs to the closing angle above.
- Structure the piece with short bolded lead-ins in Markdown (e.g., **General Effect.**, **Visual.**, **Music.**, **The takeaway.**) so each caption family is a scannable section — 2-4 words each; they render as subheads.
- Fill the captionBreakdown field (geAnalysis / visualAnalysis / musicAnalysis — the "Caption Analysis Summary" cards). This is a SUMMARY, not a second copy of the narrative. For each family, distill the ONE thing a reader should walk away with — the defining number, the race that actually matters, or the shift worth watching next — in 1-2 tight sentences that lead with the verdict. Use different wording and a different angle than the narrative's corresponding section; never reuse its sentences or restate its full argument. If the narrative already made the obvious point at length, compress it to its essence or surface the sharper secondary insight the long form had no room to dwell on. Descriptive only — no picks.
- Also fill the insights field: 2-4 scannable caption takeaways, each tied to a specific gap, leader, or trend from the data. These are cross-cutting one-liners (a single stat or race per item) and should not duplicate the captionBreakdown summaries. Descriptive only — no picks.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Technical headline grounded in a real caption gap or trend from tonight. No 'heats up', 'battle intensifies', 'buy/sell' framing, or invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences with specific caption gaps and a key insight from the data. Descriptive, not prescriptive — no fantasy picks." },
      narrative: { type: Type.STRING, description: "900-1200 word caption analysis covering GE, Visual, and Music: what the judges rewarded, where the tightest races are, and how the week's trajectory reshapes each corps' caption profile. Every corps, score, and trend must come from the data block. No fantasy buy/hold/sell picks — that is the Fantasy Market Report's job. Never uses 'dominant', 'heating up', 'captivating'." },
      captionBreakdown: {
        type: Type.OBJECT,
        description: "The 'Caption Analysis Summary' cards — a distilled verdict per family, NOT a rehash of the narrative. Each field is 1-2 tight sentences leading with the single defining takeaway, in different words from the narrative.",
        properties: {
          geAnalysis: { type: Type.STRING, description: "1-2 sentence distilled verdict for General Effect: the single defining number or race, led with the bottom line. Different wording and angle from the narrative's GE section — a summary, never a repeat." },
          visualAnalysis: { type: Type.STRING, description: "1-2 sentence distilled verdict for Visual (VP/VA/CG): the one takeaway that matters most, led with the bottom line. Different wording and angle from the narrative's Visual section — a summary, never a repeat." },
          musicAnalysis: { type: Type.STRING, description: "1-2 sentence distilled verdict for Music (Brass/MA/Percussion): the one takeaway that matters most, led with the bottom line. Different wording and angle from the narrative's Music section — a summary, never a repeat." },
        },
        required: ["geAnalysis", "visualAnalysis", "musicAnalysis"],
      },
      insights: {
        type: Type.ARRAY,
        description: "2-4 scannable caption takeaways for a reader skimming the deep-dive. Each must be grounded in the DATA block — a specific caption gap, leader, or trend. Descriptive, never a fantasy pick.",
        items: {
          type: Type.OBJECT,
          properties: {
            metric: { type: Type.STRING, description: "Short label, e.g., 'GE Race' or 'Visual Swing'." },
            finding: { type: Type.STRING, description: "The specific caption data point, e.g., '0.15 separates the top three in Visual.'" },
            implication: { type: Type.STRING, description: "What it reveals about the caption landscape. Descriptive, not prescriptive — no buy/sell." },
          },
          required: ["metric", "finding", "implication"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "captionBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Feature the GE leader for coverage-ledger tracking (or next available if excluded).
    const featuredCorps = geSorted.find(s => !excludeCorps.has(s.corps)) || geSorted[0];

    // No imagery for DCI articles (see note at top of file).
    return {
      type: ARTICLE_TYPES.DCI_RECAP,
      ...content,
      featuredCorps: featuredCorps.corps,
      imageUrl: null,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Weekly Recap article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_RECAP, reportDay);
  }
}

module.exports = {
  generateDciDailyArticle,
  generateDciFeatureArticle,
  generateDciRecapArticle,
};
