// Editorial tone system for news generation: competition-context analysis,
// tone guidance, writing-variety rotation, and the pre-computed editorial
// brief shared across the day's articles. Extracted verbatim from
// newsGeneration.js. Pure functions, no I/O.

// =============================================================================
// DYNAMIC TONE SYSTEM - Contextual writing style
// =============================================================================

/**
 * Analyze competition context to determine appropriate article tone
 * @param {Array} dayScores - Current day's scores
 * @param {Object} trendData - Trend data for all corps
 * @param {number} reportDay - Current season day
 * @returns {Object} Competition context analysis
 */
function analyzeCompetitionContext(dayScores, trendData, reportDay) {
  if (!dayScores || dayScores.length === 0) {
    return { scenario: "standard", intensity: "moderate" };
  }

  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const thirdCorps = dayScores[2];

  // Calculate key metrics
  const leadMargin = topCorps && secondCorps ? topCorps.total - secondCorps.total : 0;
  const top3Spread = topCorps && thirdCorps ? topCorps.total - thirdCorps.total : 0;

  // Find biggest daily movers
  const dailyChanges = Object.entries(trendData).map(([corps, data]) => ({
    corps,
    change: data.dayChange || 0,
    trend: data.trendFromAvg || 0,
  }));
  const biggestGainer = dailyChanges.sort((a, b) => b.change - a.change)[0];
  const biggestLoser = dailyChanges.sort((a, b) => a.change - b.change)[0];

  // Determine season phase
  let seasonPhase;
  if (reportDay <= 10) {
    seasonPhase = "early"; // Opening shows, everything is new
  } else if (reportDay <= 25) {
    seasonPhase = "mid"; // Regional competitions, patterns emerging
  } else if (reportDay <= 35) {
    seasonPhase = "late"; // Approaching finals, stakes are high
  } else {
    seasonPhase = "championship"; // Finals week
  }

  // Determine competitive scenario
  let scenario;
  let intensity;

  if (leadMargin < 0.3) {
    scenario = "tight_race"; // Less than 0.3 points - anyone's game
    intensity = "high";
  } else if (leadMargin < 0.8) {
    scenario = "competitive"; // Close but leader has edge
    intensity = "moderate-high";
  } else if (leadMargin > 2.0) {
    scenario = "dominant_leader"; // Clear frontrunner
    intensity = "moderate";
  } else {
    scenario = "standard"; // Normal competitive spread
    intensity = "moderate";
  }

  // Check for dramatic movements
  const hasBigMover = biggestGainer && biggestGainer.change > 0.5;
  const hasBigDrop = biggestLoser && biggestLoser.change < -0.5;
  const hasShakeup = hasBigMover || hasBigDrop;

  // Check for position battles (corps within 0.2 of each other)
  const positionBattles = [];
  for (let i = 0; i < dayScores.length - 1; i++) {
    const gap = dayScores[i].total - dayScores[i + 1].total;
    if (gap < 0.2) {
      positionBattles.push({
        position: i + 1,
        corps1: dayScores[i].corps,
        corps2: dayScores[i + 1].corps,
        gap: gap.toFixed(3),
      });
    }
  }

  return {
    scenario,
    intensity,
    seasonPhase,
    leadMargin: leadMargin.toFixed(3),
    top3Spread: top3Spread.toFixed(3),
    hasShakeup,
    biggestGainer: biggestGainer?.corps || null,
    biggestGainerChange: biggestGainer?.change?.toFixed(3) || "0.000",
    biggestLoser: biggestLoser?.corps || null,
    biggestLoserChange: biggestLoser?.change?.toFixed(3) || "0.000",
    positionBattles,
    positionBattleCount: positionBattles.length,
  };
}

/**
 * Generate dynamic tone guidance based on competition context
 * @param {Object} context - Competition context from analyzeCompetitionContext
 * @param {string} articleType - Type of article being generated
 * @returns {string} Tone guidance for the AI prompt
 */
function getToneGuidance(context, articleType) {
  const { scenario, seasonPhase, hasShakeup, positionBattleCount } = context;

  // Base context elements - factual, not dramatic
  const contextElements = [];

  // Season phase affects FACTUAL framing (not emotional)
  switch (seasonPhase) {
    case "early":
      contextElements.push("Early season: scores may change significantly in coming weeks");
      contextElements.push("Reference how many shows remain");
      break;
    case "mid":
      contextElements.push("Mid-season: patterns are emerging");
      contextElements.push("Compare current scores to early-season scores where relevant");
      break;
    case "late":
      contextElements.push("Late season: fewer shows remaining");
      contextElements.push("Reference specific point gaps needed to change positions");
      break;
    case "championship":
      contextElements.push("Championship week: final results pending");
      contextElements.push("Reference specific scores needed for placement changes");
      break;
  }

  // Competitive scenario - factual descriptions
  switch (scenario) {
    case "tight_race":
      contextElements.push(`Top 2 separated by less than 0.3 points`);
      contextElements.push("Note the specific margin when discussing leaders");
      break;
    case "competitive":
      contextElements.push("Multiple corps within striking distance");
      contextElements.push("Note specific point gaps between positions");
      break;
    case "dominant_leader":
      contextElements.push("Leader has significant margin");
      contextElements.push("Focus analysis on battles for other positions");
      break;
    default:
      contextElements.push("Standard competitive field");
  }

  // Shakeups - factual
  if (hasShakeup) {
    contextElements.push("Position change(s) occurred today - note who moved and by how much");
  }

  // Position battles - factual
  if (positionBattleCount > 3) {
    contextElements.push(`${positionBattleCount} corps within 0.2 of the position ahead`);
  } else if (positionBattleCount > 0) {
    contextElements.push(`${positionBattleCount} close position battle(s) in the standings`);
  }

  // Article-specific notes
  if (articleType === "underdog_story") {
    contextElements.push("Focus on score improvement and specific caption gains");
  } else if (articleType === "corps_spotlight") {
    contextElements.push("Analyze their specific caption scores and trends");
  } else if (articleType === "deep_analytics") {
    contextElements.push("Lead with data, explain what the numbers show");
  }

  // Build the guidance string - focused on FACTS not FEELINGS
  return `
CONTEXT FOR THIS ARTICLE:
• Season Phase: ${seasonPhase}
• Competition Status: ${scenario.replace(/_/g, " ")}
${hasShakeup ? "• Notable: Position changes today\n" : ""}
Key Points to Address:
${contextElements.map(t => `• ${t}`).join("\n")}

TONE REMINDER: Write like a knowledgeable sports reporter, not a hype announcer. State facts clearly. Let the numbers speak.`;
}

/**
 * Get a short tone descriptor for logging
 */
function getToneDescriptor(context) {
  const descriptors = [];
  if (context.scenario === "tight_race") descriptors.push("TENSE");
  if (context.hasShakeup) descriptors.push("BREAKING");
  if (context.seasonPhase === "championship") descriptors.push("FINALS");
  if (context.positionBattleCount > 3) descriptors.push("CHAOTIC");
  return descriptors.length > 0 ? descriptors.join("/") : "STANDARD";
}

// =============================================================================
// WRITING VARIETY SYSTEM
// Rotates narrative approaches so articles don't read like filled-in templates
// =============================================================================

/**
 * Returns a narrative approach for a given article type and day.
 * Rotates through different angles, opening styles, and structural emphases
 * so that consecutive days feel distinct even with the same underlying data shape.
 */
function getWritingVariety(reportDay, articleType) {
  // DCI Daily: rotate opening style and story angle
  const dailyApproaches = [
    {
      opening: "Lead with the tightest positional battle in the field, then zoom out to the full picture.",
      angle: "Frame the night around which corps moved — who gained ground, who lost it, and what the margins actually mean.",
      structure: "Start with the most dramatic position change, work outward to the rest of the field, then circle back to what it means for the standings.",
    },
    {
      opening: "Open with a single striking number — a margin, a score, a day-over-day change — and build the story from there.",
      angle: "Focus on caption splits. Which corps are winning on the sheets in GE but losing in Visual? Where are the hidden mismatches?",
      structure: "Organize by storyline rather than placement order. Group corps by the battles they're in, not their rank.",
    },
    {
      opening: "Dateline opener with the headline result, then immediately pivot to the story beneath the score.",
      angle: "Tonight through the lens of what changed since yesterday. Treat it like a market report — who's up, who's down, and why.",
      structure: "Lead with the top, cover the middle as a single competitive cluster, then highlight individual movers at the bottom.",
    },
    {
      opening: "Start with the corps that had the biggest single-day move, whether up or down. Make their story the hook.",
      angle: "Mid-pack storytelling. The top is well-covered — spend extra attention on the 5th-through-12th place battles where margins are thinnest.",
      structure: "Weave between the top and the middle of the field, showing how the whole standings are interconnected.",
    },
    {
      opening: "Open with a caption stat that reveals something the overall scores don't — a corps winning GE but falling in Visual, for example.",
      angle: "Write it like a scouting report. What should a knowledgeable fan take away from tonight's sheets?",
      structure: "Alternate between big-picture standings and microscopic caption details throughout the piece.",
    },
  ];

  // DCI Feature: rotate the profile lens
  const featureApproaches = [
    {
      lens: "The trajectory story. Where they started, how far they've come, and what the arc looks like on paper.",
      focus: "Emphasize the show-by-show score progression. Let the numbers tell the story — narrate the ups, the dips, the recovery.",
      closingAngle: "Project forward: based on the trendline, what's realistic for this corps in the next few shows?",
    },
    {
      lens: "The caption portrait. Pick apart which captions are carrying this corps and which are holding them back.",
      focus: "Compare their caption profile to the corps directly around them in the standings. Where do they win head-to-head? Where do they lose?",
      closingAngle: "Identify the one caption that could move the needle most and explain why.",
    },
    {
      lens: "The competitive context story. Define this corps by the battles they're in — the corps above them, the corps below, the margins between.",
      focus: "Use the standings as the narrative spine. How close are the races they're in, and what would it take to break through?",
      closingAngle: "Frame the fantasy outlook around their positional volatility — are they locked in or could they move several spots?",
    },
    {
      lens: "The momentum read. Is this corps accelerating, coasting, or fading? Use recent scores to make the case.",
      focus: "Look at their last 3 performances as a micro-trend. Are gains consistent across captions or concentrated in one area?",
      closingAngle: "Close with what the momentum suggests is next — the show on the schedule most likely to test or confirm the trend, and the specific caption to watch there. Describe the outlook; leave fantasy picks to the Fantasy Market Report.",
    },
  ];

  // DCI Recap: rotate analytical emphasis
  // This is a pure caption deep-dive. It does NOT give fantasy buy/hold/sell picks —
  // that's the Fantasy Market Report's job. Keep the lens on what the judges rewarded
  // and where the real races inside the overall standings are hiding.
  const recapApproaches = [
    {
      emphasis: "Lead with the caption where the race is tightest. Which scoring category has the smallest gap between 1st and 5th?",
      thread: "Build the analysis around competitive density — where are the closest races in each caption?",
      closingAngle: "Close with which caption race is most likely to shift next week, and which corps sit right on the edge of moving. Describe the dynamics — do not prescribe fantasy actions.",
    },
    {
      emphasis: "Lead with the biggest mover in any caption — the corps that gained or lost the most ground this week.",
      thread: "Frame the week as a story of change. What shifted, what held, and what's quietly building?",
      closingAngle: "Close by identifying what the movement says about each corps' program identity — is the rise in GE about new effect moments, or execution catching up to design?",
    },
    {
      emphasis: "Lead with the overall standings implications. How did this week's caption performances reshape the race?",
      thread: "Connect caption-level details back to total score impact. A 0.3 GE gain matters more than a 0.3 Percussion gain — explain the math.",
      closingAngle: "Close by mapping where each corps' caption profile leaves them positioned for the rest of the season — strengths, gaps, and the captions that still have headroom.",
    },
  ];

  // Fantasy Daily: rotate narrative voice. No quoteStyle — the fantasy daily
  // recap is a data-only piece that never fabricates director quotes (the
  // directors are real users), so personality lives in the voice and the way the
  // standings are read, not in invented interviews.
  const fantasyApproaches = [
    {
      voice: "Write like a local sports beat reporter covering a high school football rivalry — earnest, detailed, community-focused.",
      storyEngine: "Frame the night around a rivalry between two ensembles jockeying for the same position — grounded in the actual margin between them, not invented backstory.",
    },
    {
      voice: "Write like a fantasy sports podcast host — opinionated, direct, fun. Talk to the reader like they're in on the game.",
      storyEngine: "Frame the night around a surprise result — someone who jumped or fell unexpectedly in the standings.",
    },
    {
      voice: "Write like a longform sportswriter — find the human story in the numbers. Give the fantasy world some texture.",
      storyEngine: "Frame the night around the season narrative — who's peaking, who's building, who's fighting to stay relevant.",
    },
  ];

  // Fantasy Recap: rotate analytical framing
  // This is the FANTASY MARKET REPORT. It owns buy/hold/sell exclusively — the DCI
  // Recap is the pure caption deep-dive and will have already done the descriptive
  // analysis of what happened. Assume the reader has read it. Get to the picks fast
  // and lean into lineup mechanics, caption weighting, and scarcity.
  const fantasyRecapApproaches = [
    {
      framing: "Morning market report. Brisk, opinionated, actionable. Open with the single highest-conviction pick of the night and build out from there. Treat this as lineup advice, not caption analysis.",
      depthArea: "Go deepest on the GE captions since they drive ~40% of the score — those picks move lineups the most. Brief on the lower-weight captions.",
      pickStyle: "Confident and decisive. Strong opinions, loosely held. Name specific corps+caption combos; skip corps-only picks.",
    },
    {
      framing: "Research note with portfolio logic. Walk through the picks as a constructed lineup — how the GE, Visual, and Music holes fit together. Caption scarcity and substitution matter more than raw scores.",
      depthArea: "Balance the buys across caption families so a reader building a lineup from scratch has coverage across GE/Visual/Music. Explain the reasoning for each slot.",
      pickStyle: "Analytical and hedged. Explain the reasoning, acknowledge uncertainty, note which picks are robust vs. fragile.",
    },
    {
      framing: "Contrarian take. What is the consensus getting wrong? Which crowded picks are overvalued, and which overlooked captions offer the best value per point?",
      depthArea: "Focus on the captions where surface-level ranking and trend data disagree, and the corps whose recent momentum is under-priced by casual fantasy directors.",
      pickStyle: "Bold and counterintuitive. Challenge the obvious picks. Find the edges. Name specific corps+caption combos you'd fade.",
    },
  ];

  const pick = (arr) => arr[reportDay % arr.length];

  switch (articleType) {
    case "dci_daily": return pick(dailyApproaches);
    case "dci_feature": return pick(featureApproaches);
    case "dci_recap": return pick(recapApproaches);
    case "fantasy_daily": return pick(fantasyApproaches);
    case "fantasy_recap": return pick(fantasyRecapApproaches);
    default: return {};
  }
}

// =============================================================================
// EDITORIAL BRIEF
// -----------------------------------------------------------------------------
// Deterministic pre-pass: before any article is generated, compute per-article
// angle assignments so each of the five articles goes in knowing what story it
// owns. Complements the CoverageLedger — the brief proactively assigns hooks,
// the ledger reactively tracks what's been used. Together they force angle
// diversity without relying on Gemini to pick different stories on its own.
//
// Kept fully deterministic (no LLM call): the cost of another model round-trip
// doesn't beat the value of predictable, auditable assignments, and the pick
// logic is simple enough that a rule-based approach matches or beats an LLM's
// judgment at a fraction of the latency.
// =============================================================================

/**
 * Build the nightly editorial brief from today's data.
 *
 * Fields on the returned brief:
 *   lead         — DCI Daily's hook: biggest mover / tight race / field leader
 *   trajectory   — DCI Feature's subject: corps with clearest 7-day arc
 *                  (excluding the lead's subject, to diversify coverage)
 *   caption      — DCI Recap's angle: caption family with the tightest race
 *   market       — Fantasy Market Report's seed BUY: corps+caption with
 *                  highest upward-trending score
 *   fantasy      — Fantasy Daily's top ensemble and field context
 *
 * All assignments are optional — if the data doesn't support a clean pick,
 * that field is omitted and the generator falls back to its existing logic.
 */
function buildEditorialBrief({ dayScores, trendData, fantasyData, reportDay }) {
  const brief = { reportDay };

  if (!dayScores || dayScores.length === 0) return brief;

  // --- Lead story: what's the biggest news tonight? --------------------------
  // Priority: (1) a day-over-day swing ≥ 0.3, (2) a tight top margin < 0.2,
  // (3) the field leader as default.
  const changeCandidates = Object.entries(trendData || {})
    .filter(([name]) => dayScores.some(s => s.corps === name))
    .map(([name, t]) => ({ corps: name, change: t?.dayChange ?? 0 }))
    .filter(x => Number.isFinite(x.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (changeCandidates[0] && Math.abs(changeCandidates[0].change) >= 0.3) {
    const top = changeCandidates[0];
    brief.lead = {
      angle: top.change >= 0 ? "biggest gain of the night" : "biggest score drop of the night",
      subject: top.corps,
      metric: `${top.change >= 0 ? "+" : ""}${top.change.toFixed(3)} from yesterday`,
    };
  } else if (dayScores[1] && (dayScores[0].total - dayScores[1].total) < 0.2) {
    brief.lead = {
      angle: "tight race at the top",
      subject: `${dayScores[0].corps} over ${dayScores[1].corps}`,
      metric: `${(dayScores[0].total - dayScores[1].total).toFixed(3)}-point margin`,
    };
  } else {
    brief.lead = {
      angle: "field leader on the night",
      subject: dayScores[0].corps,
      metric: `top score ${dayScores[0].total.toFixed(3)}`,
    };
  }

  // --- Trajectory story: best arc to profile --------------------------------
  // Corps with the largest net improvement over the recent window that is NOT
  // the lead story's subject (since DCI Daily will already own that corps).
  const leadCorpsNames = new Set(
    (brief.lead?.subject || "").split(/\s+over\s+|\s+vs\s+/).map(s => s.trim()).filter(Boolean)
  );
  const improvementCandidates = Object.entries(trendData || {})
    .filter(([name]) =>
      !leadCorpsNames.has(name) &&
      dayScores.some(s => s.corps === name) &&
      Number.isFinite(trendData[name]?.totalImprovement)
    )
    .map(([name, t]) => ({ corps: name, improvement: t.totalImprovement, momentum: t.momentum }))
    .sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement));

  if (improvementCandidates[0] && Math.abs(improvementCandidates[0].improvement) >= 0.5) {
    const top = improvementCandidates[0];
    brief.trajectory = {
      corps: top.corps,
      metric: `${top.improvement >= 0 ? "+" : ""}${top.improvement.toFixed(3)} net across the recent window`,
      momentum: top.momentum || "steady",
    };
  } else {
    // Fall back to the first corps not already claimed by the lead
    const fallback = dayScores.find(s => !leadCorpsNames.has(s.corps));
    if (fallback) {
      brief.trajectory = {
        corps: fallback.corps,
        metric: `field position ${dayScores.findIndex(s => s.corps === fallback.corps) + 1}, ${fallback.total.toFixed(3)} tonight`,
        momentum: trendData?.[fallback.corps]?.momentum || "steady",
      };
    }
  }

  // --- Caption story: tightest race or biggest mover in a caption family ----
  const captionFamilies = [
    { key: "ge", label: "General Effect" },
    { key: "visual", label: "Visual" },
    { key: "music", label: "Music" },
  ];
  const captionPicks = captionFamilies
    .map(({ key, label }) => {
      const sorted = [...dayScores]
        .filter(s => Number.isFinite(s.subtotals?.[key]))
        .sort((a, b) => (b.subtotals[key] || 0) - (a.subtotals[key] || 0));
      if (sorted.length < 2) return null;
      const n = Math.min(5, sorted.length);
      const gap = sorted[0].subtotals[key] - sorted[n - 1].subtotals[key];
      return { key, label, leader: sorted[0].corps, gap, depth: n };
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap);

  if (captionPicks[0]) {
    const tightest = captionPicks[0];
    brief.caption = {
      family: tightest.label,
      leader: tightest.leader,
      metric: `${tightest.gap.toFixed(2)}-point spread from 1st through ${tightest.depth === dayScores.length ? "last" : tightest.depth + "th"}`,
    };
  }

  // --- Market story: highest upward-trending caption to anchor the top BUY --
  const marketCandidates = [];
  for (const s of dayScores) {
    const trend = trendData?.[s.corps];
    if (!trend?.captionTrends) continue;
    const pairs = [
      ["ge", "GE"],
      ["visual", "Visual"],
      ["music", "Music"],
    ];
    for (const [k, label] of pairs) {
      if (trend.captionTrends[k]?.trending === "up") {
        marketCandidates.push({
          corps: s.corps,
          family: label,
          score: s.subtotals?.[k] ?? 0,
        });
      }
    }
  }
  marketCandidates.sort((a, b) => b.score - a.score);
  if (marketCandidates[0]) {
    brief.market = {
      topBuy: `${marketCandidates[0].corps}'s ${marketCandidates[0].family}`,
      metric: `${marketCandidates[0].score.toFixed(2)}, trending upward`,
    };
  }

  // --- Fantasy story: top competitive ensemble ------------------------------
  const shows = fantasyData?.current?.shows || [];
  const competitive = shows.flatMap(s => (s.results || []).filter(r => r.corpsClass !== "soundSport"));
  if (competitive.length > 0) {
    const top = competitive.sort((a, b) => b.totalScore - a.totalScore)[0];
    brief.fantasy = {
      ensemble: top.corpsName,
      director: top.displayName || "Unknown",
      score: Number.isFinite(top.totalScore) ? top.totalScore.toFixed(3) : null,
      fieldSize: competitive.length,
    };
  }

  // --- Field shape: spread, compression, and rank churn ----------------------
  // These are field-level facts (not per-corps) that give the DCI Daily its
  // signature analytical angle — how the standings moved as a whole tonight —
  // and are computed here so the piece can lead with structure, not just the
  // winner. All grounded in real totals + each corps' dayChange.
  if (dayScores.length >= 2) {
    const totals = dayScores.map(s => s.total);
    const spread = totals[0] - totals[totals.length - 1];
    const top3Spread = dayScores.length >= 3 ? totals[0] - totals[2] : null;

    // Reconstruct yesterday's standings from today's total minus dayChange, but
    // only for corps that actually competed yesterday (a real day-over-day
    // delta). Rank churn/spread-trend are computed over that comparable subset.
    const withYesterday = dayScores
      .map(s => {
        const t = trendData?.[s.corps];
        const hadYesterday = Array.isArray(t?.recentScores) && t.recentScores.some(r => r.day === reportDay - 1);
        return hadYesterday ? { corps: s.corps, today: s.total, yesterday: s.total - (t.dayChange || 0) } : null;
      })
      .filter(Boolean);

    let rankChurn = null, biggestClimber = null, biggestFaller = null, spreadTrend = null, gapCloser = null;
    if (withYesterday.length >= 2) {
      const todayOrder = [...withYesterday].sort((a, b) => b.today - a.today).map(x => x.corps);
      const yestOrder = [...withYesterday].sort((a, b) => b.yesterday - a.yesterday).map(x => x.corps);
      const todayRank = new Map(todayOrder.map((c, i) => [c, i]));
      const yestRank = new Map(yestOrder.map((c, i) => [c, i]));
      let churn = 0, bestClimb = 0, bestFall = 0;
      for (const c of todayOrder) {
        const delta = yestRank.get(c) - todayRank.get(c); // + = climbed
        if (delta !== 0) churn++;
        if (delta > bestClimb) { bestClimb = delta; biggestClimber = { corps: c, spots: delta }; }
        if (delta < bestFall) { bestFall = delta; biggestFaller = { corps: c, spots: -delta }; }
      }
      rankChurn = churn;

      const yTotals = withYesterday.map(x => x.yesterday).sort((a, b) => b - a);
      const ySpread = yTotals[0] - yTotals[yTotals.length - 1];
      const spreadDelta = spread - ySpread;
      spreadTrend = {
        direction: spreadDelta < -0.05 ? "tightening" : spreadDelta > 0.05 ? "loosening" : "holding",
        delta: Math.abs(spreadDelta),
      };

      // Biggest gap-closer: corps that shaved the most off the margin to the
      // corps directly above it in today's order (a compression sub-story).
      for (let i = 1; i < todayOrder.length; i++) {
        const cur = withYesterday.find(x => x.corps === todayOrder[i]);
        const above = withYesterday.find(x => x.corps === todayOrder[i - 1]);
        if (!cur || !above) continue;
        const closed = (above.yesterday - cur.yesterday) - (above.today - cur.today);
        if (closed > (gapCloser?.closed || 0.049)) {
          gapCloser = { corps: cur.corps, onCorps: above.corps, closed };
        }
      }
    }

    brief.field = {
      spread,
      top3Spread,
      leadMargin: dayScores.length >= 2 ? totals[0] - totals[1] : null,
      rankChurn,
      biggestClimber,
      biggestFaller,
      spreadTrend,
      gapCloser,
    };
  }

  // Subject map: which corps/ensemble each article is leading with tonight, so
  // every article's brief can be told what the OTHER four already own and pick
  // a different lead. This is the core anti-repetition guard.
  brief.subjects = {
    dci_daily: brief.lead?.subject || null,
    dci_feature: brief.trajectory?.corps || null,
    dci_recap: brief.caption ? `${brief.caption.family} race (led by ${brief.caption.leader})` : null,
    fantasy_recap: brief.market?.topBuy || null,
    fantasy_daily: brief.fantasy?.ensemble || null,
  };

  return brief;
}

// Human labels + one-line beat identity for each of the five nightly articles.
// The "beat" makes each piece's distinct job explicit in its own prompt; the
// labels drive the cross-article "off-limits" list that prevents five articles
// from all leading with the same corps or number.
const ARTICLE_BEATS = {
  dci_daily: {
    label: "DCI Daily",
    beat: "the result and the margins — who won each show tonight, the decisive gaps, and how the field as a whole tightened or spread. You own the standings and the shape of the night.",
  },
  dci_feature: {
    label: "DCI Feature",
    beat: "one corps, audited across the week — their show-by-show arc, caption profile, and what the trend says about where they're headed. You own depth on a single program.",
  },
  dci_recap: {
    label: "DCI Recap",
    beat: "the caption laboratory — where inside GE, Visual, and Music the judges are actually separating the field, and how the sub-caption picture differs from the totals. You own caption science.",
  },
  fantasy_recap: {
    label: "Fantasy Market Report",
    beat: "the only actionable column — buy/hold/sell on individual captions, weight and scarcity, and one sleeper. You own the picks.",
  },
  fantasy_daily: {
    label: "Fantasy Results",
    beat: "the users' league — the community's own fantasy ensembles, their races, and SoundSport. You own the human competition among directors.",
  },
};

/**
 * Build the "off-limits" block: the lead subjects the OTHER four articles are
 * covering tonight, so this article doesn't build its hook on a story already
 * owned elsewhere in the batch. Returns "" when nothing else is assigned.
 */
function formatOffLimits(brief, selfType) {
  const lines = Object.entries(brief.subjects || {})
    .filter(([type, subject]) => type !== selfType && subject)
    .map(([type, subject]) => `  • ${ARTICLE_BEATS[type]?.label || type} is leading with: ${subject}`);
  if (lines.length === 0) return "";
  return `\nOWNED BY OTHER ARTICLES TONIGHT (do NOT make any of these your lead or headline — find a different entry point):\n${lines.join("\n")}\n`;
}

/**
 * Render the brief into a prompt-ready beat + assigned-angle + off-limits block
 * for a given article type. Returns empty string when there's nothing to assign
 * so the prompt degrades cleanly instead of printing "undefined".
 */
function formatBriefForArticle(brief, articleType) {
  if (!brief) return "";

  const beat = ARTICLE_BEATS[articleType]?.beat;
  const beatLine = beat ? `YOUR BEAT: ${beat}\n` : "";
  const offLimits = formatOffLimits(brief, articleType);

  switch (articleType) {
    case "dci_daily": {
      const f = brief.field;
      // Qualitative direction only — the actual FIELD SHAPE decimals live in the
      // DATA block (so the number-source guard accepts them). Here we just point
      // the writer at tonight's most distinctive structural angle.
      const shapeAngle = f?.spreadTrend
        ? `The field is ${f.spreadTrend.direction} tonight${f.rankChurn ? ` with ${f.rankChurn} position change${f.rankChurn === 1 ? "" : "s"}` : ""} — lead with what that movement means, not just the winner. See FIELD SHAPE in the DATA block for the exact figures.`
        : brief.lead
          ? `Lead story: ${brief.lead.angle} (${brief.lead.subject}).`
          : "";
      if (!beatLine && !shapeAngle && !offLimits) return "";
      return `
${beatLine}YOUR ANGLE TONIGHT (editorial brief): ${shapeAngle}
${offLimits}`;
    }
    case "dci_feature": {
      if (!brief.trajectory && !beatLine) return "";
      const why = brief.trajectory
        ? `Featured corps: ${brief.trajectory.corps} — ${brief.trajectory.metric}; momentum: ${brief.trajectory.momentum}. Make the case for THIS corps' trajectory; do not fight for the lead headline.`
        : "";
      return `
${beatLine}YOUR ANGLE TONIGHT (editorial brief): ${why}
${offLimits}`;
    }
    case "dci_recap": {
      if (!brief.caption && !beatLine) return "";
      const why = brief.caption
        ? `Open on the ${brief.caption.family} race (${brief.caption.leader} leads, ${brief.caption.metric}). The other two families still get body coverage, but your first paragraphs belong to ${brief.caption.family}.`
        : "";
      return `
${beatLine}YOUR ANGLE TONIGHT (editorial brief): ${why}
${offLimits}`;
    }
    case "fantasy_recap": {
      if (!brief.market && !beatLine) return "";
      const why = brief.market
        ? `Seed BUY thesis: ${brief.market.topBuy} (${brief.market.metric}). Build around it unless the data clearly supports a stronger pick.`
        : "";
      return `
${beatLine}YOUR ANGLE TONIGHT (editorial brief): ${why}
${offLimits}`;
    }
    case "fantasy_daily": {
      if (!beatLine && !offLimits) return "";
      return `
${beatLine}${offLimits}`;
    }
    default:
      return "";
  }
}

module.exports = {
  analyzeCompetitionContext,
  getToneGuidance,
  getToneDescriptor,
  getWritingVariety,
  buildEditorialBrief,
  formatBriefForArticle,
};
