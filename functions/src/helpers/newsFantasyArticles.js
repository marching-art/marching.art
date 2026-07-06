// The two nightly fantasy (marching.art) articles: daily results and the
// caption-analysis market report. Extracted verbatim from newsGeneration.js.

const { Type } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const {
  ARTICLE_TYPES,
  NEWS_INTEGRITY_RULES,
  formatFantasyEventName,
  formatNegativeSpace,
  processGeneratedImage,
  createFallbackArticle,
} = require("./newsArticleShared");
const {
  generateWithFactCheckGuard,
  generateImageWithImagen,
  PAID_IMAGE_MODEL,
} = require("./geminiService");
// Only the fantasy-corps events article (Article 5, generateFantasyDailyArticle)
// generates AI imagery — of the user's own fantasy corps, using the quality
// (paid) image model. The Fantasy Market Report (Article 4) analyzes real DCI
// corps, so it carries no imagery at all (imageUrl: null), same as the DCI
// articles — a fabricated depiction of a real corps would be misleading.
const {
  buildFantasyPerformersImagePrompt,
} = require("./newsImagePrompts");
const {
  getToneGuidance,
  getWritingVariety,
  formatBriefForArticle,
} = require("./newsEditorial");
const { describeShowConcept } = require("./showConceptSynergy");

/**
 * Article 4: marching.art Fantasy Results
 * Daily fantasy competition results
 */
async function generateFantasyDailyArticle({ reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger }) {
  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  const toneGuidance = getToneGuidance(competitionContext, "fantasy_results");

  const shows = fantasyData.current.shows || [];
  // Flatten while preserving which show each result came from — the article must
  // be able to attribute each ensemble to the correct competition.
  const allResults = shows.flatMap(s => (s.results || []).map(r => ({
    ...r,
    showEventName: r.showEventName || s.eventName || s.name || null,
    showLocation: r.showLocation || s.location || null,
  })));

  // Separate competitive and SoundSport results
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const soundSportResults = allResults
    .filter(r => r.corpsClass === 'soundSport')
    .sort((a, b) => b.totalScore - a.totalScore);

  // Rank everyone who competed — no arbitrary 25-cap, so the article reflects the real field.
  const topPerformers = [...competitiveResults].sort((a, b) => b.totalScore - a.totalScore);
  const totalCompetitors = topPerformers.length;

  // Caption dimension among the user ensembles: which fantasy corps won GE,
  // Visual, and Music tonight. Fantasy results carry geScore/visualScore/
  // musicScore, so the recap can tell a caption story (did the winner sweep, or
  // did someone else take a caption?) instead of only ranking totals.
  const captionLeaderOf = (key) => {
    const ranked = competitiveResults
      .filter(r => Number.isFinite(r[key]))
      .sort((a, b) => b[key] - a[key]);
    return ranked[0] || null;
  };
  const fantasyCaptionLeaders = {
    ge: captionLeaderOf('geScore'),
    visual: captionLeaderOf('visualScore'),
    music: captionLeaderOf('musicScore'),
  };
  const hasCaptionSplits = competitiveResults.some(r => Number.isFinite(r.geScore));
  const captionLeadersBlock = hasCaptionSplits ? [
    fantasyCaptionLeaders.ge ? `- General Effect: "${fantasyCaptionLeaders.ge.corpsName}" (${fantasyCaptionLeaders.ge.geScore.toFixed(2)})` : null,
    fantasyCaptionLeaders.visual ? `- Visual: "${fantasyCaptionLeaders.visual.corpsName}" (${fantasyCaptionLeaders.visual.visualScore.toFixed(2)})` : null,
    fantasyCaptionLeaders.music ? `- Music: "${fantasyCaptionLeaders.music.corpsName}" (${fantasyCaptionLeaders.music.musicScore.toFixed(2)})` : null,
  ].filter(Boolean).join('\n') : '';

  // Return a fallback if there is genuinely no content to write about tonight.
  // Only fire the fallback when BOTH the competitive field and the SoundSport
  // field are empty — a SoundSport-only evening still deserves its own piece.
  if (totalCompetitors === 0 && soundSportResults.length === 0) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  // Field-size mode drives voice, length, quote count, and framing so the
  // article matches the reality of tonight's field instead of padding a 1-
  // ensemble night into the same 5-paragraph shape as a 10-ensemble night.
  const fieldMode =
    totalCompetitors >= 6 ? 'full' :
    totalCompetitors >= 2 ? 'small' :
    totalCompetitors === 1 ? 'solo' :
    'soundsport';

  // Dynamic tiering so the prompt doesn't lie about how much of the field to cover.
  const detailCount = Math.min(5, totalCompetitors);
  const midTierEnd = Math.min(Math.max(detailCount + 5, Math.ceil(totalCompetitors / 2)), totalCompetitors);
  const tierDescription = totalCompetitors <= 5
    ? `all ${totalCompetitors} in detail`
    : totalCompetitors <= 10
      ? `top ${detailCount} in detail, the remaining ${totalCompetitors - detailCount} briefly`
      : `top ${detailCount} in detail, positions ${detailCount + 1}-${midTierEnd} as a group, and positions ${midTierEnd + 1}-${totalCompetitors} briefly`;

  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  // Group competitive results by fantasy show for venue-aware writing
  const competitiveByShow = (() => {
    const groups = new Map();
    for (const r of topPerformers) {
      const key = r.showEventName || 'Unspecified Competition';
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: r.showLocation || null,
          results: [],
        });
      }
      groups.get(key).results.push(r);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      results: g.results.sort((a, b) => b.totalScore - a.totalScore),
    }));
  })();
  const multiShow = competitiveByShow.length > 1;

  // SoundSport ratings based on scoring guidelines (NOT competitive scores)
  // SoundSport uses a rating system: Gold, Silver, Bronze, Participation
  // Scores are NEVER revealed - only the rating level
  // "Best in Show" is the highest scoring ensemble, NOT a rating level
  const getSoundSportRating = (score) => {
    if (!score || score <= 0) return null;
    // Thresholds based on SoundSport adjudication guidelines (from SoundSportTab.jsx)
    if (score >= 85) return "Gold";
    if (score >= 75) return "Silver";
    if (score >= 65) return "Bronze";
    return "Participation";
  };

  // Find "Best in Show" - the highest scoring SoundSport ensemble at this competition
  const soundSportBestInShow = soundSportResults.length > 0
    ? soundSportResults.reduce((best, current) =>
        (current.totalScore > (best?.totalScore || 0)) ? current : best, null)
    : null;

  // Categorize SoundSport results by rating (NO SCORES - only ratings)
  const soundSportByRating = {
    gold: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Gold"),
    silver: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Silver"),
    bronze: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Bronze"),
    participation: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Participation"),
  };

  const fantasyShowName = formatFantasyEventName(showContext.showName);

  // Get today's narrative variety. Full and small fields use the voice rotation;
  // solo and soundsport modes override it with mode-specific framing because the
  // rotation is built for competitive rivalries that don't exist in those modes.
  const variety = getWritingVariety(reportDay, "fantasy_daily");

  const modeConfig = {
    full: {
      words: '600-800',
      voice: variety.voice,
      storyEngine: variety.storyEngine,
      coverage: `Tiered coverage: ${tierDescription}.`,
      headlineGuidance: `Include the actual top ensemble's name and score. No exclamation points. No invented numbers.`,
      bodyNote: '',
    },
    small: {
      words: '450-600',
      voice: `Intimate small-field night — ${totalCompetitors} competitive ensembles. Every ensemble gets real air time; no filler, no pad-to-length paragraphs.`,
      storyEngine: `Frame the night as a head-to-head (or three-way) among the ${totalCompetitors} competitors. The margins between them ARE the story.`,
      coverage: `Cover all ${totalCompetitors} competitive ensembles in detail.`,
      headlineGuidance: `Include the top ensemble's name and score. A margin-forward headline (e.g., "X Edges Y by 0.156") is welcome when the gap is tight. No exclamation points.`,
      bodyNote: `- Do not pad. If a paragraph has no real material, cut it.`,
    },
    solo: {
      words: '300-400',
      voice: `Local beat reporter covering a quieter night. One ensemble in competition, performing solo. Honest, grounded, undramatic. Do NOT invent rivalries or opponents — there aren't any tonight.`,
      storyEngine: `Tonight is a solo showcase, not a competition. The story is this one ensemble's performance in context — their score and where it sits in the arc of the season. SoundSport participants (if present) are the evening's surrounding ecosystem, not opponents.`,
      coverage: `Cover the one competitive ensemble as the sole feature. Reference SoundSport participants only for evening texture — never imply they competed against the featured ensemble.`,
      headlineGuidance: `Name the ensemble and their score plainly. Do NOT invent competitive framing. Factual phrasing like "Mendota DBC Posts 68.198 in Solo Competition" is correct; "Dominates Field" or "Claims Victory" is not.`,
      bodyNote: `- This is a small night. Short and honest beats padded and dramatic. If the data does not support another paragraph, stop writing. 300-400 words is the target, not a floor.`,
    },
    soundsport: {
      words: '250-350',
      voice: `Feature writer covering a SoundSport-only showcase. Celebrate the participants and ratings; the focus is ensemble quality and growth, not standings.`,
      storyEngine: `SoundSport is the whole story tonight. Lead with the Best in Show ensemble (if any), then group the remaining participants by rating level. Do NOT reveal SoundSport scores — SoundSport is a ratings-only format.`,
      coverage: `Feature the SoundSport participants by rating. Make the ratings-only nature of SoundSport clear so readers understand scores are intentionally not published.`,
      headlineGuidance: `Lead with a SoundSport ensemble name and rating, or frame as a showcase evening. No invented scores. No exclamation points.`,
      bodyNote: `- No competitive scores are reported tonight — this is a SoundSport-only evening. Do not invent or imply a competitive outcome.`,
    },
  };
  const mode = modeConfig[fieldMode];

  // Classify each director's displayName as either a "real-looking name" or a
  // "username-style handle" so the writer knows which attribution pattern to
  // use. A displayName reads as a handle if it's lowercase with no internal
  // space, or contains digits/underscores/dots — typical of web signups like
  // "elithecreature" or "snare_guy_22". When that's the case, attributing via
  // the ensemble ("Mendota DBC's director said...") reads better than "said
  // elithecreature," which is what today's published articles actually do.
  const looksLikeHandle = (name) => {
    if (!name || typeof name !== "string") return true;
    const trimmed = name.trim();
    if (trimmed.length === 0) return true;
    if (/[0-9_.]/.test(trimmed)) return true;
    if (!trimmed.includes(" ") && trimmed === trimmed.toLowerCase()) return true;
    return false;
  };
  const directorClassBlock = competitiveResults.length > 0
    ? competitiveResults
        .map(r => `  • "${r.corpsName}" → director "${r.displayName || "Unknown"}" [${looksLikeHandle(r.displayName) ? "HANDLE — attribute via ensemble, not via name" : "NAME — direct attribution OK"}]`)
        .join("\n")
    : "";

  const resultsByShowBlock = competitiveByShow.map(group => {
    const header = `${group.name}${group.location ? ` — ${group.location}` : ''} (${group.results.length} ensemble${group.results.length === 1 ? '' : 's'})`;
    const lines = group.results.map((r, i) => {
      const margin = i > 0 ? (group.results[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
      const director = r.displayName || 'Unknown';
      // Home city = where the corps program is based. This is NOT the venue; the
      // venue is the SHOW header's location. Labeled explicitly so the writer
      // can't misread a home city as the place the ensemble performed.
      const hometown = r.location ? ` (based in ${r.location})` : '';
      const split = Number.isFinite(r.geScore)
        ? ` [GE ${r.geScore.toFixed(2)} | Vis ${r.visualScore.toFixed(2)} | Mus ${r.musicScore.toFixed(2)}]`
        : '';
      return `  ${i + 1}. "${r.corpsName}"${hometown} (Director: ${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind the ensemble above]` : ' [SHOW WINNER]'}${split}`;
    }).join('\n');
    return `SHOW: ${header}\n${lines}`;
  }).join('\n\n');

  const overallRankingBlock = topPerformers.map((r, i) => {
    const margin = i > 0 ? (topPerformers[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
    const director = r.displayName || 'Unknown';
    const showTag = r.showEventName ? ` @ ${r.showEventName}` : '';
    return `${i + 1}. "${r.corpsName}" (${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind the ensemble above]` : ' [OVERALL HIGH]'}${showTag}`;
  }).join('\n');

  // Director-designed show concepts for tonight's featured ensembles — the
  // one piece of program/theme information that actually exists, mirroring
  // how the top performer's uniform design feeds the article image. Fetched
  // for the top three competitive ensembles plus SoundSport Best in Show.
  const conceptTargets = [...topPerformers.slice(0, 3), soundSportBestInShow]
    .filter(Boolean)
    .filter(r => r.uid && r.corpsClass);
  const programConcepts = [];
  if (db && dataDocId && conceptTargets.length > 0) {
    for (const target of conceptTargets) {
      try {
        const profileDoc = await db.doc(`artifacts/${dataDocId}/users/${target.uid}/profile/data`).get();
        const concept = profileDoc.exists
          ? describeShowConcept(profileDoc.data()?.corps?.[target.corpsClass]?.showConcept)
          : null;
        if (concept) programConcepts.push({ corpsName: target.corpsName, concept });
      } catch (profileError) {
        logger.warn("Could not fetch show concept for article context:", profileError.message);
      }
    }
  }
  const programConceptsBlock = programConcepts.length > 0
    ? programConcepts.map(p => `- "${p.corpsName}": performing ${p.concept}`).join('\n')
    : '';

  const prompt = `You are a marching.art fantasy sports journalist writing a professional, data-grounded recap of tonight's results. These are FANTASY ensembles run by real users. You may write with an engaging sportswriter's voice and characterize the performances and the shape of the standings — but you have no interview access and no information beyond the scores and standings in the DATA block. Every factual detail — ensemble names, director names, scores, margins, competition names, locations, counts — must match the DATA block exactly. Do not state anything a reporter could not know from a scoresheet.

ACCURACY RULES (read first)
- The field is ${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'} tonight${soundSportResults.length > 0 ? ` plus ${soundSportResults.length} SoundSport participant${soundSportResults.length === 1 ? '' : 's'}` : ''}. Never claim any other count — do not say "25 corps" or any number other than ${totalCompetitors}.
- Only reference ensembles, directors, scores, and venues that appear in the DATA block. Do not invent ensembles, directors, venues, or scores.
${fieldMode === 'soundsport' ? `- No competitive ensembles tonight; SoundSport is non-competitive, so do NOT describe anyone as "winning" against anyone else. Performances are appraised by rating level, not rank.` : multiShow ? `- There are ${competitiveByShow.length} separate fantasy shows tonight at different venues. Ensembles at different shows did NOT compete head-to-head. When you cite a placement or margin, make the show clear.` : fieldMode === 'solo' ? `- Only one competitive ensemble performed tonight: "${topPerformers[0].corpsName}" at ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}. There are no opponents to frame against — do not invent rivals, runners-up, or head-to-head narratives.` : `- All ensembles tonight competed at the same fantasy show: ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}.`}
- The ranked lines give the exact gap to the ensemble directly above ("[0.041 behind the ensemble above]") — quote those verbatim and never re-derive them, and don't state a margin between two non-adjacent ensembles that the data doesn't provide.
- HOME CITY IS NOT THE VENUE. Each ranked line may list the corps' home city as "(based in X)" — that is where the program is based, NOT where it performed. The performance venue is the SHOW location in the section header. Never write that an ensemble performed, competed, or delivered its show "in" its home city unless that city is the show venue. Refer to a home city only as the corps' base (e.g., "the Denver-based ensemble"), never as the location of tonight's performance.
- Beyond your own analytical characterization of the results, invent nothing else: no rivalries, backstories, injuries, or biographical details. Do not reveal specific roster/lineup picks. Program/show themes may be referenced ONLY for ensembles listed in the PROGRAM CONCEPTS block, exactly as described there — never invent a theme for anyone else.
- Director names in the DATA block are whatever each user set as their displayName — some are real names ("Sarah Jones"), some are usernames ("elithecreature", "mike_42", "BluecoatsFan"). When you refer to a director, prefer an ensemble-based reference ("Mendota DBC's director", "the director behind Stellar Vista"). Use the bare displayName only when it reads like a real name (a capitalized word with a space). For handle-style names, wrap them in the role ("director elithecreature") so the reader sees a screen name rather than a first name — never use a handle as a bare first name.

${NEWS_INTEGRITY_RULES}

Date: ${showContext.date} | Day ${reportDay}
Field mode: ${fieldMode} (${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'}${soundSportResults.length > 0 ? `, ${soundSportResults.length} SoundSport` : ''})

Voice: ${mode.voice}
Story engine: ${mode.storyEngine}
Sourcing: Data-only recap — you have the scores and standings and nothing else. No quotes, no interviews, no reactions, no backstory. Personality comes from how you read the numbers, not from words you put in anyone's mouth.

===== DATA =====
TOTAL COMPETITIVE ENSEMBLES: ${totalCompetitors}
${directorClassBlock ? `\nDIRECTOR REFERENCE GUIDE (check this before naming any director — "HANDLE" names should NEVER be used as a bare first name; refer via the ensemble instead):\n${directorClassBlock}\n` : ''}${totalCompetitors === 0 ? 'No competitive ensembles tonight — this is a SoundSport-only evening.' : multiShow ? `\nRESULTS BY SHOW\n${resultsByShowBlock}\n\nOVERALL RANKING (across all shows tonight — reference carefully; these ensembles did NOT all face each other):\n${overallRankingBlock}` : `\nRESULTS\n${resultsByShowBlock}`}
${captionLeadersBlock ? `\nCAPTION LEADERS AMONG TONIGHT'S ENSEMBLES (who won each scoring caption — the winner didn't necessarily sweep):\n${captionLeadersBlock}\n` : ''}${programConceptsBlock ? `\nPROGRAM CONCEPTS (real, director-designed show concepts — the only theme information that exists; ensembles not listed have no known concept):\n${programConceptsBlock}\n` : ''}

${soundSportResults.length > 0 ? `SOUNDSPORT RATINGS (non-competitive, ratings-only showcase — NEVER reveal SoundSport scores, only rating levels):
${soundSportBestInShow ? `Best in Show: "${soundSportBestInShow.corpsName}" (${soundSportBestInShow.displayName || 'Unknown'})` : ''}
${soundSportByRating.gold.length > 0 ? `Gold (${soundSportByRating.gold.length}): ${soundSportByRating.gold.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.silver.length > 0 ? `Silver (${soundSportByRating.silver.length}): ${soundSportByRating.silver.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.bronze.length > 0 ? `Bronze (${soundSportByRating.bronze.length}): ${soundSportByRating.bronze.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.participation.length > 0 ? `Participation (${soundSportByRating.participation.length}): ${soundSportByRating.participation.map(r => `"${r.corpsName}"`).join(', ')}` : ''}` : ''}

STATS: ${totalCompetitors === 0
  ? `No competitive ensembles | SoundSport participants: ${soundSportResults.length}`
  : `Top ensemble: "${topPerformers[0].corpsName}" at ${topScore}${topPerformers[0].showEventName ? ` (${topPerformers[0].showEventName})` : ''} | ${totalCompetitors >= 2 ? `1st-to-2nd margin: ${(topPerformers[0].totalScore - topPerformers[1].totalScore).toFixed(3)}` : 'Solo competitor'} | Competitive ensembles: ${totalCompetitors} | Field avg: ${avgScore}${soundSportResults.length > 0 ? ` | SoundSport: ${soundSportResults.length}` : ''}`
}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
BANNED PHRASES: dominant, commanding, stunning, heating up, sent shockwaves, proves their mettle, showcased their prowess, the drama is just beginning, tune in tomorrow, Can [X] maintain their dominance?

ARTICLE REQUIREMENTS
- Headline: ${mode.headlineGuidance}
- Summary: 2-3 sentences — top result, score, and one storyline hook${multiShow ? '. Make the multi-show night clear' : ''}.
- Narrative: ${mode.words} words. ${mode.coverage} Carry personality through sharp, specific observation of the scores, the margins, and the competitive picture — the tight gaps, who closed on whom, where a score lands in the field. Do NOT manufacture quotes, reactions, or feelings to add color; characterize the ensembles and the night, never speak for a director.
${mode.bodyNote ? `${mode.bodyNote}\n` : ''}${captionLeadersBlock && fieldMode !== 'soundsport' ? `- Work in the caption story: the GE, Visual, and Music leaders are in the data. Note when the night's winner also swept the captions, or when a different ensemble took a caption — that's often the most interesting subplot.\n` : ''}${(fieldMode === 'full' || fieldMode === 'small') ? `- Structure the piece with 3-4 short bolded lead-ins in Markdown (e.g., **Top of the night.**, **The chase.**, **Caption watch.**) at natural transitions — 2-4 words each; they render as section subheads. Don't over-segment a short night.\n` : ''}${multiShow ? `- Cover all ${competitiveByShow.length} fantasy shows by name. When you cite a placement or score, make the show clear so readers know which ensembles actually faced each other.\n` : ''}${soundSportResults.length > 0 && fieldMode !== 'soundsport' ? `- Include a SoundSport highlight — celebrate the ratings without ever revealing SoundSport scores.\n` : ''}- End with a specific observation or stat from the data, not a rhetorical question or generic send-off.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Top ensemble name and score from the data. No exclamation points, no 'dominates', no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences grounded in tonight's real results: top ensemble, score, margin, one storyline hook. If multiple shows occurred, make that clear." },
      narrative: { type: Type.STRING, description: "600-800 word fantasy article. Uses the exact ensemble names, director names, scores, margins, and show/location values from the DATA block — no invented facts. Coverage depth matches the field size (detail for the top tier, grouped coverage for the rest). No fabricated quotes, interviews, reactions, rivalries, or backstory — personality comes from analysis of the real scores and standings. A corps' home city is where it is based, not where it performed. Margins are quoted verbatim from the data. Never uses 'dominant', 'commanding', 'stunning', 'heating up'." },
      topPerformers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corpsName: { type: Type.STRING },
            director: { type: Type.STRING },
            score: { type: Type.NUMBER },
          },
          required: ["rank", "corpsName", "director", "score"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Score breakdown and statistics for today's competition",
        properties: {
          winningScore: { type: Type.NUMBER, description: "Top score of the day" },
          averageScore: { type: Type.NUMBER, description: "Average score among top performers" },
          spreadTop10: { type: Type.NUMBER, description: "Point spread between 1st and 10th" },
          totalEnsembles: { type: Type.INTEGER, description: "Number of ensembles competing" },
        },
        required: ["winningScore", "averageScore", "totalEnsembles"],
      },
    },
    required: ["headline", "summary", "narrative", "topPerformers", "scoreBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, { articleType: "fantasy_daily" });

    // Image subject: the top competitive ensemble when there is one; otherwise
    // the SoundSport Best in Show for soundsport-only nights so the image still
    // reflects the actual subject of the article rather than a generic placeholder.
    const topCorps = topPerformers[0] || soundSportBestInShow || null;

    // Fetch uniform design if available
    let uniformDesign = null;
    let corpsLocation = null;
    if (topCorps?.uid && topCorps?.corpsClass && db && dataDocId) {
      try {
        const profileDoc = await db.doc(`artifacts/${dataDocId}/users/${topCorps.uid}/profile/data`).get();
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const corpsData = profileData?.corps?.[topCorps.corpsClass];
          uniformDesign = corpsData?.uniformDesign || null;
          corpsLocation = corpsData?.location || null;
        }
      } catch (profileError) {
        logger.warn("Could not fetch top performer's uniform design:", profileError.message);
      }
    }

    const topConcept = programConcepts.find(p => p.corpsName === topCorps?.corpsName);
    const imageContext = `${fieldMode === 'soundsport' ? `SoundSport showcase on Day ${reportDay}` : `Performance finale on Day ${reportDay}`}${topConcept ? ` — the ensemble is performing ${topConcept.concept}` : ''}`;
    const imagePrompt = buildFantasyPerformersImagePrompt(
      topCorps?.corpsName || "Champion Corps",
      imageContext,
      corpsLocation,
      uniformDesign,
      reportDay,
      4 // articleIndex 4: Fantasy Daily
    );

    // Explicitly pin the quality (paid) image model — this is the one nightly
    // article that ships an AI image, and it should not silently degrade if the
    // service-level default tier ever changes.
    const imageData = await generateImageWithImagen(imagePrompt, { model: PAID_IMAGE_MODEL });
    const imageResult = await processGeneratedImage(imageData, "fantasy_daily");

    return {
      type: ARTICLE_TYPES.FANTASY_DAILY,
      ...content,
      featuredPerformer: topCorps?.corpsName,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Results article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }
}

/**
 * Article 4: Fantasy Market Report
 * Owns buy/hold/sell picks exclusively for the day. The DCI Recap (Article 3)
 * describes the caption landscape; this article translates it into actionable
 * lineup moves on individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P).
 */
async function generateFantasyRecapArticle({ reportDay, dayScores, trendData, seasonContext, competitionContext, ledger, brief, isLiveSeason }) {
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_captions");

  // Build individual caption "stock" data for each corps
  const captionStocks = [];

  dayScores.forEach(score => {
    const trend = trendData[score.corps] || {};
    const captionTrends = trend.captionTrends || {};

    // Individual caption scores with trends
    const captions = [
      { name: 'GE1', fullName: 'GE1 (Music Effect)', score: score.captions?.GE1, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'GE2', fullName: 'GE2 (Visual Effect)', score: score.captions?.GE2, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'VP', fullName: 'Visual Proficiency', score: score.captions?.VP, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'VA', fullName: 'Visual Analysis', score: score.captions?.VA, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'CG', fullName: 'Color Guard', score: score.captions?.CG, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'B', fullName: 'Brass', score: score.captions?.B, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'MA', fullName: 'Music Analysis', score: score.captions?.MA, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'P', fullName: 'Percussion', score: score.captions?.P, trend: captionTrends.music?.trending, weight: '~10%' },
    ];

    captions.forEach(cap => {
      if (cap.score && cap.score > 0) {
        captionStocks.push({
          corps: score.corps,
          caption: cap.name,
          fullName: cap.fullName,
          score: cap.score,
          trend: cap.trend || 'steady',
          weight: cap.weight,
          dayChange: trend.dayChange || 0,
        });
      }
    });
  });

  // Sort by score within each caption type
  const captionTypes = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
  const stocksByCaption = {};
  captionTypes.forEach(cap => {
    stocksByCaption[cap] = captionStocks
      .filter(s => s.caption === cap)
      .sort((a, b) => b.score - a.score);
  });

  // Find trending stocks
  const trendingUp = captionStocks.filter(s => s.trend === 'up').sort((a, b) => b.score - a.score);
  const trendingDown = captionStocks.filter(s => s.trend === 'down').sort((a, b) => b.score - a.score);
  const steadyPerformers = captionStocks.filter(s => s.trend === 'steady').sort((a, b) => b.score - a.score);

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "fantasy_recap");

  const fieldCorpsList = dayScores.map(s => s.corps).join(', ');
  const uniqueCaptionShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowCaption = uniqueCaptionShows.length > 1;

  // Season-long "elite assets": corps whose strongest caption family sits in the
  // top of the field this season. Lets the picks weigh proven season-long value,
  // not just tonight's number. One compact line — deliberately not a full table.
  const eliteAssets = dayScores
    .map(s => {
      const st = seasonContext?.[s.corps]?.strongest;
      return st && st.percentile >= 85 ? `${s.corps} ${st.family.toUpperCase()} (${st.percentile}th pct)` : null;
    })
    .filter(Boolean);
  const eliteAssetsLine = eliteAssets.length
    ? `SEASON-LONG ELITE ASSETS (strongest family in the field ≥85th percentile this season — proven value beyond tonight): ${eliteAssets.join(', ')}`
    : '';

  const prompt = `You are the Fantasy Market Report analyst for marching.art. Fantasy directors pick individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P) for their lineups — you tell them what to do about it. This is THE picks column; it is the only article in tonight's five that gives buy/hold/sell recommendations. Earlier in the batch a separate DCI Recap already described tonight's caption landscape in depth. Assume the reader has read it. Your job is to translate that landscape into action, not to redo the description.

ACCURACY RULES (read first)
- Every corps name, caption score, and trend arrow you cite MUST come from the DATA block below. Do not invent corps, captions, scores, or trend directions.
- The field tonight has ${dayScores.length} corps (listed below). Do not reference any corps not in this list.
${multiShowCaption ? `- The caption numbers below come from ${uniqueCaptionShows.length} separate shows tonight: ${uniqueCaptionShows.join(', ')}. Corps at different shows did NOT caption-judge against each other — the rankings are a composite across venues. Frame cross-venue picks as such.` : `- All caption numbers tonight come from a single show, so the rankings are a true head-to-head.`}
${isLiveSeason
  ? `- This is the ${dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear())} live DCI season — the caption scores below come from this season's real competitions. Do NOT reference a prior year's book or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' first mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy directors know which season's book they're picking against. Every corps' year is listed in CORPS SOURCE YEARS below.`}
- If a caption shows "No data" in the DATA block, do not reference it. If a specific number isn't in the data, don't cite a number.

${NEWS_INTEGRITY_RULES}

${variety.framing}
Depth: ${variety.depthArea}
Pick style: ${variety.pickStyle}

===== DATA =====
DAY ${reportDay} | FIELD (${dayScores.length}): ${fieldCorpsList}
${isLiveSeason ? '' : `CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}
`}
CAPTION RANKINGS (top ${Math.min(5, dayScores.length)} per caption):
${captionTypes.map(cap => {
  const topN = stocksByCaption[cap]?.slice(0, 5) || [];
  const capInfo = topN.length > 0 ? topN.map((s, i) => `${i+1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`).join(' | ') : 'No data';
  return `${cap}: ${capInfo}`;
}).join('\n')}

TRENDING: ↑ ${trendingUp.length} rising${trendingUp.length > 0 ? ` (${trendingUp.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | ↓ ${trendingDown.length} falling${trendingDown.length > 0 ? ` (${trendingDown.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | → ${steadyPerformers.length} steady
${eliteAssetsLine ? `\n${eliteAssetsLine}\n` : ''}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'fantasy_recap')}
BANNED PHRASES: dominant, heating up, intensifies, key area of focus, captivating, absolutely crucial, mid-season phase, upward trend (as a standalone phrase), trajectory (cap at 1 use)

ARTICLE REQUIREMENTS
- Headline: A pick-oriented thesis. Name a specific corps+caption and what to DO with it (e.g., a buy, hold, sell, or fade framing). Use ↑↓→ if it fits. No hype words, no invented numbers.
- Summary: 2-3 sentences that lead with tonight's single highest-conviction pick and one line of reasoning. Every other piece in tonight's batch is descriptive — this one is directive.
- Narrative: 600-800 words, weighted heavily toward the picks. Structure:
  1. Lead with the top BUY (specific corps+caption, the thesis, the score/trend that supports it, who it displaces in a typical lineup).
  2. Cover the remaining BUYs, then HOLDs, then SELLs — each named at the corps+caption level with brief reasoning.
  3. Include one or two lines on caption WEIGHT or SCARCITY where it matters (e.g., a 0.30 swing in a ~20%-weight caption like GE1 is worth roughly 2x the same swing in a ~10% caption like Percussion).
  4. Close with a SLEEPER — one under-the-radar corps+caption most fantasy directors will miss, with the reason it's mispriced.
  Cite specific scores and margins drawn only from the data. Do NOT re-narrate what the DCI Recap already covered — no paragraph-length caption-by-caption play-by-play. Every paragraph should end with a picks-actionable takeaway or be cut.
  Pick style (confident / analytical / contrarian) follows the framing above.
- Also fill two structured fields: fantasyImpact (one or two sentences distilling tonight's single most actionable move — it appears on its own in the home-feed widget, so it must stand alone) and trendingCorps (up to 3 corps from the TRENDING data, each with a direction and a short data-grounded reason; omit any that aren't really moving).`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Caption-focused headline with a real corps, specific caption (GE1/B/CG etc), real score from the data, and ↑↓→ trend. No hype words, no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences highlighting tonight's actual caption movements and one clear recommendation drawn from the data." },
      narrative: { type: Type.STRING, description: "700-900 word caption-by-caption analysis. Every corps, caption score, and trend arrow must come from the data block. Section emphasis follows where the real story is. Fun but data-driven." },
      captionInsights: {
        type: Type.OBJECT,
        properties: {
          geInsight: { type: Type.STRING, description: "GE1 and GE2 analysis with specific scores" },
          visualInsight: { type: Type.STRING, description: "VP, VA, CG analysis with specific scores" },
          musicInsight: { type: Type.STRING, description: "B, MA, P analysis with specific scores" },
        },
        required: ["geInsight", "visualInsight", "musicInsight"],
      },
      recommendations: {
        type: Type.OBJECT,
        description: "Caption pick recommendations for fantasy directors",
        properties: {
          buy: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          hold: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          sell: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
        },
        required: ["buy", "hold", "sell"],
      },
      fantasyImpact: {
        type: Type.STRING,
        description: "One or two sentences: tonight's single most actionable lineup takeaway (the highest-conviction move and why), grounded in the data. This is the tip surfaced on the home feed's Fantasy Impact widget, so make it stand alone.",
      },
      trendingCorps: {
        type: Type.ARRAY,
        description: "Up to 3 corps whose captions are moving tonight, drawn ONLY from the TRENDING data in the DATA block. Omit if nothing is meaningfully trending — do not pad.",
        items: {
          type: Type.OBJECT,
          properties: {
            corps: { type: Type.STRING, description: "Corps name, exactly as in the data." },
            direction: { type: Type.STRING, enum: ["up", "down", "stable"], description: "Caption trend direction from the data." },
            reason: { type: Type.STRING, description: "One concise, data-grounded reason (e.g., 'GE1 up to 18.9'). No invented numbers." },
          },
          required: ["corps", "direction", "reason"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "captionInsights", "recommendations", "fantasyImpact"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "fantasy_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Headline subject for the coverage ledger. Prefer the corps named in the
    // top BUY recommendation since that's what the headline pitch is built on;
    // fall back to the top-scoring corps.
    const featuredCorps = content?.recommendations?.buy?.[0]?.corps || dayScores[0]?.corps || null;

    // The Fantasy Market Report analyzes real DCI corps, so it carries no
    // imagery — only the fantasy-corps events article generates an image.
    return {
      type: ARTICLE_TYPES.FANTASY_RECAP,
      ...content,
      featuredCorps,
      imageUrl: null,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Captions article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_RECAP, reportDay);
  }
}

module.exports = {
  generateFantasyDailyArticle,
  generateFantasyRecapArticle,
};
