// Trend narrative phrase banks and selectors for news generation.
// Extracted verbatim from newsGeneration.js.

/**
 * Generate narrative phrases for trend descriptions
 * Provides variety in how trends are described across articles
 */
// Phrase banks used by getTrendNarrative() to pre-compute seeded narrative hints
// per corps. Each list is ~10 variants so a given (corps, day, article) seed has
// meaningful variety across consecutive uses. Any phrase that appears on the
// HARD_BANNED_PATTERNS list must not appear here.
const TREND_NARRATIVES = {
  surging: [
    "on an absolute tear",
    "riding a scorching hot streak",
    "catching fire at exactly the right moment",
    "in the best run of their season",
    "stringing together nightly gains",
    "accelerating faster than the field",
    "compiling a run that reshuffles the power rankings",
    "posting one of the biggest weekly improvements in the field",
    "ahead of their season's trendline by a wide margin",
    "moving up the sheet every time they perform",
  ],
  hot: [
    "building real momentum",
    "on the rise with no sign of slowing",
    "trending upward on the weekly sheets",
    "landing night after night",
    "improving every show they perform",
    "gaining ground on the corps above them",
    "sharper than they were a week ago",
    "hitting form at the right point in the season",
    "carving a clear upward line in recent scores",
    "showing meaningful week-over-week progress",
  ],
  rising: [
    "continuing to climb",
    "making steady gains",
    "showing modest but real improvement",
    "picking up ground show by show",
    "inching upward on the scoresheet",
    "walking their scores up week by week",
    "showing a slow but clear upward pattern",
    "improving at the pace they need to",
    "beginning to close the gap on the tier above",
    "on a gentle incline through the recent slate",
  ],
  sliding: [
    "struggling to find their footing",
    "in an extended rough patch",
    "dealing with a concerning decline",
    "trying to stop the bleeding",
    "losing ground night after night",
    "on the wrong side of the week-over-week picture",
    "falling behind the pace they set earlier in the season",
    "hunting for answers on the field",
    "giving back points they earned in earlier weeks",
    "unable to arrest a multi-day drop",
  ],
  cold: [
    "going through a cold spell",
    "searching for answers",
    "in a frustrating slump",
    "battling inconsistency",
    "off the pace they established earlier",
    "struggling to replicate earlier results",
    "shaking off a bad stretch",
    "down from their recent high-water mark",
    "working through a visibly rough week",
    "below the line they had been tracking toward",
  ],
  cooling: [
    "cooling off slightly",
    "seeing some regression",
    "coming back to earth",
    "experiencing a minor setback",
    "off their recent pace",
    "showing small signs of slowing",
    "taking a modest step back from last week's peak",
    "slightly below their ceiling",
    "losing a little edge night over night",
    "moving sideways after a stronger stretch",
  ],
  steady: [
    "maintaining their form",
    "holding the line",
    "staying the course",
    "delivering reliable performances",
    "turning in the kind of numbers the field expects",
    "landing squarely where the pattern predicts",
    "keeping within their established range",
    "producing performances in the same neighborhood as last week",
    "neither climbing nor slipping",
    "giving the standings no reason to move",
  ],
  consistent: [
    "rock solid show to show",
    "remarkably stable on the sheets",
    "the picture of dependability",
    "executing with precision night after night",
    "a model of reliability",
    "landing within a tight score range week over week",
    "unshakeable in their output",
    "the kind of corps you can almost set a watch by",
    "repeating their performance with near-identical numbers",
    "a flat, reliable signal in a noisy field",
  ],
};

const STREAK_NARRATIVES = {
  up: {
    3: [
      "three straight days of improvement",
      "a three-day winning streak",
      "improvement for the third consecutive day",
      "gains three nights running",
      "a three-show climb",
    ],
    4: [
      "four days of continuous gains",
      "an impressive four-day climb",
      "gains every day this week",
      "four consecutive nights in the green",
      "a four-show upward arc",
    ],
    5: [
      "five straight days trending upward",
      "a remarkable five-day surge",
      "an entire week of improvement",
      "five shows of uninterrupted gains",
      "a full week's climb on the sheets",
    ],
  },
  down: {
    3: [
      "three consecutive days of decline",
      "a three-day skid",
      "dropping for the third day running",
      "losses three nights in a row",
      "three shows of regression",
    ],
    4: [
      "four straight days of regression",
      "a concerning four-day slide",
      "losses every day this week",
      "four consecutive nights in the red",
      "a four-show descent",
    ],
    5: [
      "five days of continuous decline",
      "a five-day freefall",
      "struggling all week",
      "five shows of uninterrupted losses",
      "a full week's slide on the sheets",
    ],
  },
};

const CAPTION_TREND_NARRATIVES = {
  ge: {
    up: [
      "GE scores climbing",
      "connecting better with judges on effect",
      "drawing a stronger emotional response",
      "general effect moments landing harder",
      "effect captions trending the right way",
      "adjudicators rewarding the effect package",
    ],
    down: [
      "GE scores dipping",
      "struggling to land the effect",
      "effect captions not quite hitting",
      "losing points where the book demands them",
      "GE not returning what it used to",
      "effect moments not cashing in on the sheets",
    ],
    stable: [
      "effect scores holding steady",
      "consistent GE output",
      "reliable effect numbers",
      "GE sitting right where it has been",
    ],
  },
  visual: {
    up: [
      "visual program clicking into place",
      "drill execution sharpening",
      "guard and visual coming together",
      "visual caption gaining traction",
      "field product reading cleaner",
      "visual performance matching the design",
    ],
    down: [
      "visual clarity suffering",
      "execution issues on the field",
      "visual program not quite clean",
      "drill losing its edge",
      "guard and visual not in sync",
      "visual captions giving back points",
    ],
    stable: [
      "visual program consistent",
      "reliable execution on the field",
      "drill holding its level",
      "visual numbers steady",
    ],
  },
  music: {
    up: [
      "brass and percussion sharpening",
      "musical program elevating",
      "hornline finding their voice",
      "ensemble sound gaining definition",
      "music captions trending upward",
      "audio product catching up to the book",
    ],
    down: [
      "musical scores slipping",
      "brass not quite as sharp",
      "intonation and balance issues",
      "hornline losing some of its edge",
      "ensemble sound not as tight",
      "music captions giving up ground",
    ],
    stable: [
      "musical program solid",
      "consistent brass and percussion output",
      "hornline holding its level",
      "music numbers stable",
    ],
  },
};

/**
 * Get a narrative description for a corps' trend
 * @param {Object} trend - Trend data for a corps
 * @param {string} seed - Optional seed for consistent randomization
 * @returns {Object} Narrative components
 */
function getTrendNarrative(trend, seed = null) {
  if (!trend) return null;

  const selectPhrase = (arr) => {
    if (!arr || arr.length === 0) return "";
    if (seed) {
      const hash = seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      return arr[Math.abs(hash) % arr.length];
    }
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // Main momentum phrase
  const momentumPhrase = selectPhrase(TREND_NARRATIVES[trend.momentum] || TREND_NARRATIVES.steady);

  // Streak phrase (if applicable)
  let streakPhrase = null;
  if (trend.streak >= 3 && trend.streakDirection) {
    const streakLevel = Math.min(trend.streak, 5);
    const options = STREAK_NARRATIVES[trend.streakDirection]?.[streakLevel];
    if (options) streakPhrase = selectPhrase(options);
  }

  // Caption highlights (pick the most notable)
  let captionHighlight = null;
  if (trend.captionTrends) {
    const captionChanges = [
      { caption: "ge", ...trend.captionTrends.ge },
      { caption: "visual", ...trend.captionTrends.visual },
      { caption: "music", ...trend.captionTrends.music },
    ].filter(c => c.trending !== "stable")
     .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    if (captionChanges.length > 0) {
      const top = captionChanges[0];
      const phrases = CAPTION_TREND_NARRATIVES[top.caption]?.[top.trending];
      if (phrases) captionHighlight = selectPhrase(phrases);
    }
  }

  // Season best/worst note
  let performanceNote = null;
  if (trend.atSeasonBest) {
    performanceNote = selectPhrase([
      "hitting their season high",
      "at their best score of the year",
      "peaking at the right time",
    ]);
  } else if (trend.atSeasonWorst) {
    performanceNote = selectPhrase([
      "at their lowest point this season",
      "hitting a season-low score",
      "at rock bottom—nowhere to go but up",
    ]);
  }

  // Volatility note
  let stabilityNote = null;
  if (trend.volatility > 0.3) {
    stabilityNote = selectPhrase([
      "highly unpredictable night to night",
      "volatile performances making them hard to read",
      "inconsistent but capable of big nights",
    ]);
  } else if (trend.volatility < 0.1) {
    stabilityNote = selectPhrase([
      "remarkably consistent show to show",
      "predictable in the best way",
      "you know exactly what you're going to get",
    ]);
  }

  return {
    momentum: momentumPhrase,
    streak: streakPhrase,
    caption: captionHighlight,
    performance: performanceNote,
    stability: stabilityNote,
    // Full narrative combining key elements
    full: buildFullNarrative(momentumPhrase, streakPhrase, captionHighlight, performanceNote),
  };
}

/**
 * Build a complete narrative sentence from components
 */
function buildFullNarrative(momentum, streak, caption, performance) {
  const parts = [];

  if (streak) {
    parts.push(streak);
  }

  if (momentum) {
    if (parts.length > 0) {
      parts.push(`and ${momentum}`);
    } else {
      parts.push(momentum);
    }
  }

  if (caption && parts.length < 2) {
    if (parts.length > 0) {
      parts.push(`with ${caption}`);
    } else {
      parts.push(caption);
    }
  }

  if (performance && parts.length < 2) {
    parts.push(performance);
  }

  return parts.join(", ");
}

module.exports = {
  TREND_NARRATIVES,
  STREAK_NARRATIVES,
  CAPTION_TREND_NARRATIVES,
  getTrendNarrative,
  buildFullNarrative,
};
