// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// Shared logic for user news submissions: author credit resolution, the
// fantasy-daily-style image generation, the publish routine, and the
// auto-publish scheduling math. Used by both the admin approval callables
// (triggers/newsSubmissions.js) and the daily 2 PM auto-publish scheduled
// job (scheduled/newsAutoPublish.js) so the two paths stay in lockstep.

const { logger } = require("firebase-functions/v2");
// User-submitted article text (headline, summary, body) is instruction-bearing
// if inlined raw into Gemini prompts — promptSafe/promptSafeBlock strip control
// chars, truncate, and wrap the text in unambiguous «...» / ««« »»» delimiters.
const {
  promptSafe,
  promptSafeBlock,
  UNTRUSTED_FIELD_RULE,
} = require("./promptSafety");

// A user graduates to auto-publish once an admin has approved this many of
// their articles. After that, their new submissions publish automatically at
// 2 PM Eastern rather than waiting in the admin queue.
const AUTO_PUBLISH_THRESHOLD = 3;

// The daily hour (Eastern) at which qualified auto-publish submissions go live.
const AUTO_PUBLISH_HOUR_ET = 14;

const DATA_NAMESPACE = () => process.env.DATA_NAMESPACE || "marching-art";

// =============================================================================
// EASTERN-TIME SCHEDULING MATH
// =============================================================================

/** Wall-clock Eastern parts (numbers) for a given instant. */
function easternParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    // Intl can emit "24" for midnight in hour12:false — normalize to 0.
    hour: +parts.hour === 24 ? 0 : +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
  };
}

/** Minutes the Eastern wall clock is ahead of UTC at the given instant (negative). */
function easternOffsetMinutes(date) {
  const p = easternParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - date.getTime()) / 60000;
}

/** The UTC instant corresponding to a given Eastern wall-clock date at HH:00. */
function easternWallTimeToInstant(year, month, day, hour) {
  const guessUTC = Date.UTC(year, month - 1, day, hour, 0, 0);
  const offset = easternOffsetMinutes(new Date(guessUTC));
  return new Date(guessUTC - offset * 60000);
}

/**
 * The next 2 PM Eastern strictly after `from`. If `from` is before 2 PM ET on
 * its own day the article publishes that same afternoon; otherwise it rolls to
 * the following day.
 *
 * @param {Date} from - Reference instant (defaults to now).
 * @returns {Date} The scheduled publish instant.
 */
function computeNextAutoPublishAt(from = new Date()) {
  const p = easternParts(from);
  let target = easternWallTimeToInstant(p.year, p.month, p.day, AUTO_PUBLISH_HOUR_ET);
  if (target.getTime() <= from.getTime()) {
    const tomorrow = easternParts(new Date(from.getTime() + 24 * 60 * 60 * 1000));
    target = easternWallTimeToInstant(tomorrow.year, tomorrow.month, tomorrow.day, AUTO_PUBLISH_HOUR_ET);
  }
  return target;
}

// =============================================================================
// AUTHOR CREDIT
// =============================================================================

/**
 * Resolve the display name, username, and location used to credit an author.
 * Falls back gracefully when the profile is missing fields.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<{authorName: string, authorUsername: string|null, authorLocation: string|null, corps: object|null}>}
 */
async function resolveAuthorCredit(db, uid) {
  let userData = {};
  try {
    const userDoc = await db
      .collection("artifacts")
      .doc(DATA_NAMESPACE())
      .collection("users")
      .doc(uid)
      .collection("profile")
      .doc("data")
      .get();
    userData = userDoc.exists ? userDoc.data() : {};
  } catch (err) {
    logger.warn("Could not resolve author credit profile:", err.message);
  }

  return {
    authorName: userData.displayName || userData.username || "Anonymous",
    authorUsername: userData.username || null,
    authorLocation: typeof userData.location === "string" && userData.location.trim()
      ? userData.location.trim()
      : null,
    corps: userData.corps || null,
    approvedCount: userData.articleStats?.approvedCount || 0,
  };
}

/** Pick the author's most relevant registered fantasy corps for image context. */
function pickAuthorCorps(corps) {
  if (!corps || typeof corps !== "object") return null;
  // Prefer a World Class corps, then any registered corps.
  const preferredOrder = ["worldClass", "openClass", "aClass", "soundSport"];
  for (const key of preferredOrder) {
    const c = corps[key];
    if (c && c.corpsName) return c;
  }
  for (const c of Object.values(corps)) {
    if (c && typeof c === "object" && c.corpsName) return c;
  }
  return null;
}

// =============================================================================
// DIRECTOR PRESS RELEASES
// =============================================================================
// A press release is instant, un-reviewed community content a director writes
// about THEIR OWN organization (season reveals, staff moves, results from their
// corps' POV, rivalry callouts). It is deliberately distinct from an admin-
// reviewed news submission, which covers the shared world. Because it publishes
// with no human in the loop, everything here is bounded, plain-text, and
// attributed to a specific corps the author actually owns — that ownership is
// the accountability the review step would otherwise provide.

// Length bounds. Kept tighter than news submissions: a press release is a short
// operational bulletin, not a feature article, and it publishes unreviewed.
const PRESS_RELEASE_LIMITS = {
  headlineMin: 6,
  headlineMax: 160,
  summaryMax: 300,
  bodyMin: 40,
  bodyMax: 8000,
};

// Preference order when a director owns corps across several classes and did
// not specify which one a release is from — highest class speaks for the org.
// Podium sits last: a director's competing fantasy corps is the default org
// voice, but a Podium director can byline their own corps (PODIUM.md §5.8) —
// explicitly here rather than only via the defensive fallback below — and a
// Podium-only director has nothing else to issue from.
const PRESS_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport", "podiumClass"];

/** Normalize one corps entry from the profile's corps map to a byline object. */
function corpsToByline(corpsClass, c) {
  if (!c || typeof c !== "object" || !c.corpsName) return null;
  return {
    corpsClass,
    corpsName: c.corpsName,
    location: typeof c.location === "string" && c.location.trim() ? c.location.trim() : null,
    uniformDesign: c.uniformDesign || null,
  };
}

/**
 * Resolve which of the author's registered corps a press release is bylined to.
 * Honors an explicitly requested class when the author owns a corps in it;
 * otherwise falls back to their highest-class corps. Returns null when the
 * author has no registered corps at all (they cannot issue a press release).
 *
 * @param {object|null} corps - The profile's `corps` map, keyed by class.
 * @param {string|null} [requestedClass] - Class the author chose in the composer.
 * @returns {{corpsClass: string, corpsName: string, location: string|null, uniformDesign: object|null}|null}
 */
function resolveOwnedCorps(corps, requestedClass) {
  if (!corps || typeof corps !== "object") return null;

  if (requestedClass && Object.prototype.hasOwnProperty.call(corps, requestedClass)) {
    const chosen = corpsToByline(requestedClass, corps[requestedClass]);
    if (chosen) return chosen;
  }

  for (const key of PRESS_CLASS_ORDER) {
    const byline = corpsToByline(key, corps[key]);
    if (byline) return byline;
  }
  // Any other registered corps (defensive: unknown/legacy class keys).
  for (const [key, c] of Object.entries(corps)) {
    const byline = corpsToByline(key, c);
    if (byline) return byline;
  }
  return null;
}

/**
 * Validate and normalize raw press-release input. Pure — no I/O — so the rules
 * are unit-testable and identical wherever they run. Returns the trimmed,
 * length-checked fields on success, or a human-readable error on failure.
 *
 * @param {object} input - { headline, summary, body, imageUrl }
 * @returns {{valid: true, cleaned: object} | {valid: false, error: string}}
 */
function validatePressReleaseInput(input) {
  const { headline, summary, body, imageUrl } = input || {};
  const L = PRESS_RELEASE_LIMITS;

  const cleanHeadline = typeof headline === "string" ? headline.trim() : "";
  if (cleanHeadline.length < L.headlineMin) {
    return { valid: false, error: `Headline must be at least ${L.headlineMin} characters` };
  }
  if (cleanHeadline.length > L.headlineMax) {
    return { valid: false, error: `Headline cannot exceed ${L.headlineMax} characters` };
  }

  const cleanBody = typeof body === "string" ? body.trim() : "";
  if (cleanBody.length < L.bodyMin) {
    return { valid: false, error: `Your announcement must be at least ${L.bodyMin} characters` };
  }
  if (cleanBody.length > L.bodyMax) {
    return { valid: false, error: `Your announcement cannot exceed ${L.bodyMax} characters` };
  }

  const cleanSummary = typeof summary === "string" ? summary.trim() : "";
  if (cleanSummary.length > L.summaryMax) {
    return { valid: false, error: `Summary cannot exceed ${L.summaryMax} characters` };
  }

  // Optional author-supplied image. Stored and later rendered as an <img> src,
  // so the scheme is allowlisted exactly as the news-submission path does.
  let cleanImageUrl = null;
  if (imageUrl != null && String(imageUrl).trim()) {
    let parsed;
    try {
      parsed = new URL(String(imageUrl).trim());
    } catch {
      return { valid: false, error: "Image URL is not valid" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Image URL must use http or https" };
    }
    cleanImageUrl = String(imageUrl).trim();
  }

  return {
    valid: true,
    cleaned: {
      headline: cleanHeadline,
      // Fall back to a truncated body when the author writes no summary, so the
      // feed card always has a teaser line.
      summary: cleanSummary || cleanBody.slice(0, L.summaryMax),
      body: cleanBody,
      imageUrl: cleanImageUrl,
    },
  };
}

/**
 * Build the published-article document for a press release. Pure: given the
 * validated content, resolved corps byline, author credit, and season/day
 * context, it returns the exact Firestore document and its path. Shaped to
 * match generated/community articles so the entire existing read pipeline
 * (feed, article page, reactions, comments, OG cards, SEO) works unchanged.
 *
 * @returns {{article: object, articlePath: string, articleType: string}}
 */
function buildPressReleaseArticle({ id, cleaned, corps, author, seasonId, currentDay, now = new Date() }) {
  const articleType = `press_${id}`;
  const articlePath = `news_hub/${seasonId}/days/day_${currentDay}/articles/${articleType}`;

  const article = {
    type: articleType,
    pressReleaseId: id,
    reportDay: currentDay,
    createdAt: now,
    publishedAt: now,
    updatedAt: now,

    // Content
    headline: cleaned.headline,
    summary: cleaned.summary,
    narrative: cleaned.body,
    category: "press",

    // The corps this release speaks for — the heart of the "your own org" model.
    corpsName: corps.corpsName,
    corpsClass: corps.corpsClass,

    // Image (author-supplied only; press releases never block on AI generation).
    imageUrl: cleaned.imageUrl,
    imageIsPlaceholder: !cleaned.imageUrl,

    // Author credit — byline links back to the director's profile.
    authorUid: author.uid,
    authorName: author.authorName,
    authorUsername: author.authorUsername,
    authorLocation: corps.location || author.authorLocation || null,

    metadata: {
      source: "director_press_release",
      corpsName: corps.corpsName,
      corpsClass: corps.corpsClass,
      location: corps.location || null,
    },

    isPublished: true,
  };

  return { article, articlePath, articleType };
}

/**
 * Publish a press release: resolve the current season/day, build the article
 * document, and write it into the day's articles subcollection. The article is
 * live the instant this resolves — there is no review queue.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} params - { id, cleaned, corps, author }
 * @returns {Promise<{articleId: string, articlePath: string, seasonId: string, reportDay: number}>}
 */
async function publishPressReleaseArticle(db, { id, cleaned, corps, author }) {
  const seasonDoc = await db.doc("game-settings/season").get();
  const seasonData = seasonDoc.exists ? seasonDoc.data() : {};
  const seasonId = seasonData.seasonUid || "current_season";
  const currentDay = seasonData.currentDay || 1;

  const { article, articlePath, articleType } = buildPressReleaseArticle({
    id,
    cleaned,
    corps,
    author,
    seasonId,
    currentDay,
  });

  await db.doc(articlePath).set(article);

  logger.info("Press release published:", {
    pressReleaseId: id,
    articlePath,
    corpsName: corps.corpsName,
    authorUid: author.uid,
  });

  return {
    articleId: `${seasonId}_day_${currentDay}_${articleType}`,
    articlePath,
    seasonId,
    reportDay: currentDay,
  };
}

// =============================================================================
// IMAGE GENERATION — ARTICLE #5 (FANTASY DAILY) PROMPT
// =============================================================================

/**
 * Read the article and extract the concrete visual details it states or clearly
 * implies — the specific uniform colors, the moment to depict, the featured
 * section, and any props/staging mentioned. These drive the image so that, e.g.,
 * "stormed the field in their black uniforms with bronze trim" yields a black
 * uniform with bronze trim rather than a generic corps look.
 *
 * Returns null if extraction fails, so the caller can fall back to a
 * corps/headline-themed image.
 *
 * @param {object} submission - The submission document data.
 * @returns {Promise<object|null>}
 */
async function extractArticleVisualDetails(submission) {
  const { Type } = require("@google/genai");
  const { generateStructuredContent } = require("./geminiService");

  const schema = {
    type: Type.OBJECT,
    properties: {
      corpsName: { type: Type.STRING, description: "The specific corps/ensemble the image should feature, if the article names one. Blank otherwise." },
      primaryColor: { type: Type.STRING, description: "Primary uniform color explicitly mentioned (e.g., 'black'). Blank if none." },
      secondaryColor: { type: Type.STRING, description: "Secondary/trim uniform color explicitly mentioned (e.g., 'bronze'). Blank if none." },
      accentColor: { type: Type.STRING, description: "A third accent color if mentioned. Blank if none." },
      uniformDescription: { type: Type.STRING, description: "Short phrase describing the uniform exactly as the article frames it. Blank if none." },
      sceneDescription: { type: Type.STRING, description: "The single most vivid moment or action to depict, in one sentence." },
      section: { type: Type.STRING, description: "The featured section: one of 'brass', 'percussion', 'color guard', 'drum major', 'full ensemble'. Blank if unclear." },
      mood: { type: Type.STRING, description: "The emotional tone of the moment. Blank if unclear." },
      keyVisualDetails: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "2-6 concrete visual specifics the article states or implies: props, silks, weather, staging, instruments, expressions.",
      },
    },
    required: ["sceneDescription", "keyVisualDetails"],
  };

  const body = (submission.fullStory || "").substring(0, 1800);
  const prompt = `You are the art director for a marching arts (drum corps) publication, preparing a photorealistic image to illustrate a SPECIFIC article. Read the article and extract ONLY the concrete visual details it states or clearly implies. Do not invent specifics the article does not support — leave a field blank when the article gives no basis for it. Uniform colors, trim, and the described moment are the most important details to capture accurately.

${UNTRUSTED_FIELD_RULE}

ARTICLE HEADLINE: ${promptSafe(submission.headline, { maxLength: 200 })}
ARTICLE SUMMARY: ${promptSafe(submission.summary || "", { maxLength: 400 })}
ARTICLE BODY:
${promptSafeBlock(body, { maxLength: 1800 })}`;

  try {
    const result = await generateStructuredContent(prompt, schema);
    return result || null;
  } catch (err) {
    logger.warn("Article visual-detail extraction failed; using fallback image theme:", err.message);
    return null;
  }
}

/** Trim + normalize an extracted field to a non-empty string or null. */
function cleanField(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Generate a header image for an approved user submission using the same
 * builder that powers the nightly Fantasy Daily article (article #5): the
 * fantasy-performers prompt at article index 4, rendered on the paid image
 * model. The article is read first so the image reflects the specific uniform
 * colors and moment it describes; the author's own fantasy corps identity fills
 * in anything the article leaves unspecified.
 *
 * @param {object} submission - The submission document data.
 * @param {number} reportDay - The current season day (drives scene rotation).
 * @param {object|null} authorCorps - The author's fantasy corps (name/location/uniformDesign).
 * @returns {Promise<string|null>} Uploaded image URL, or null on failure.
 */
async function generateFantasyDailyImage(submission, reportDay, authorCorps) {
  const { buildFantasyPerformersImagePrompt } = require("./newsImagePrompts");
  const { generateImageWithImagen, PAID_IMAGE_MODEL } = require("./geminiService");
  const { uploadFromUrl } = require("./mediaService");

  // Read the article for concrete visual details before building the prompt.
  const visual = await extractArticleVisualDetails(submission);

  // Subject: a corps the article names > the author's own ensemble > neutral.
  const corpsName =
    cleanField(visual?.corpsName) || authorCorps?.corpsName || "Championship Corps";
  const corpsLocation = authorCorps?.location || submission.authorLocation || null;

  // Uniform: article-specified colors win. Start from the author's design (so
  // unspecified fields like style/helmet carry through) and override the colors
  // with what the article actually describes; getFantasyUniformDetails renders
  // these as the authoritative "director-specified" uniform.
  const articlePrimary = cleanField(visual?.primaryColor);
  let uniformDesign = authorCorps?.uniformDesign || null;
  if (articlePrimary) {
    uniformDesign = {
      ...(uniformDesign || {}),
      style: uniformDesign?.style || "contemporary",
      helmetStyle: uniformDesign?.helmetStyle || "modern",
      primaryColor: articlePrimary,
      secondaryColor: cleanField(visual?.secondaryColor) || uniformDesign?.secondaryColor || "silver",
      accentColor: cleanField(visual?.accentColor) || uniformDesign?.accentColor || null,
      additionalNotes: cleanField(visual?.uniformDescription) || uniformDesign?.additionalNotes || null,
    };
  }

  // Scene: the moment the article describes > headline/summary.
  const theme =
    cleanField(visual?.sceneDescription) ||
    `${submission.headline}. ${(submission.summary || "").substring(0, 180)}`.trim();

  // articleIndex 4 == the Fantasy Daily slot (article #5).
  let imagePrompt = buildFantasyPerformersImagePrompt(
    corpsName,
    theme,
    corpsLocation,
    uniformDesign,
    reportDay || 0,
    4
  );

  // Append an authoritative, article-derived block so the image model honors the
  // specifics even where they'd otherwise conflict with the generic scene.
  if (visual) {
    const details = Array.isArray(visual.keyVisualDetails)
      ? visual.keyVisualDetails.map(cleanField).filter(Boolean)
      : [];
    // Every value here was extracted from the user's article text, so it is
    // still user-influenced — delimit each one before it reaches the prompt.
    const lines = [
      articlePrimary
        ? `- Uniform: ${promptSafe([articlePrimary, cleanField(visual.secondaryColor), cleanField(visual.accentColor)].filter(Boolean).join(", "))}${cleanField(visual.uniformDescription) ? ` (${promptSafe(cleanField(visual.uniformDescription), { maxLength: 300 })})` : ""}`
        : null,
      `- Moment to depict: ${promptSafe(theme, { maxLength: 300 })}`,
      cleanField(visual.section) ? `- Featured section: ${promptSafe(cleanField(visual.section))}` : null,
      cleanField(visual.mood) ? `- Mood: ${promptSafe(cleanField(visual.mood))}` : null,
      details.length ? `- Must include: ${details.map(d => promptSafe(d, { maxLength: 300 })).join("; ")}` : null,
    ].filter(Boolean);

    if (lines.length) {
      imagePrompt += `

═══════════════════════════════════════════════════════════════
ARTICLE-ACCURATE DETAILS — THESE DEPICT THE SPECIFIC STORY AND TAKE PRECEDENCE
═══════════════════════════════════════════════════════════════
This image illustrates one specific article. Depict exactly what it describes.
Where these details conflict with any generic uniform or scene above, THESE WIN:
${lines.join("\n")}`;
    }
  }

  try {
    // Pin the quality (paid) image model, matching the nightly Fantasy Daily article.
    const imageData = await generateImageWithImagen(imagePrompt, { model: PAID_IMAGE_MODEL });
    if (!imageData) {
      logger.warn("Image model returned no image for user article:", {
        submissionId: submission._submissionId || null,
        model: PAID_IMAGE_MODEL,
      });
      return null;
    }

    const uploadResult = await uploadFromUrl(imageData, {
      folder: "marching-art/user-articles",
      publicId: `article_${submission._submissionId || "user"}`,
      category: submission.category,
      headline: submission.headline,
    });

    if (uploadResult.success) {
      logger.info("Fantasy Daily-style image generated for user article:", {
        url: uploadResult.url,
      });
      return uploadResult.url;
    }
    // uploadFromUrl swallows its own failures and hands back a placeholder, so
    // this branch is the only signal that an image was generated but never
    // stored — log loudly rather than publishing an imageless article quietly.
    logger.error("User-article image upload failed; publishing without an image:", {
      submissionId: submission._submissionId || null,
      error: uploadResult.error || "unknown upload error",
    });
    return null;
  } catch (err) {
    logger.error("Failed to generate Fantasy Daily-style image for user article:", err.message);
    return null;
  }
}

// =============================================================================
// PUBLISH ROUTINE
// =============================================================================

/**
 * Publish an approved/scheduled submission into the day's articles subcollection
 * and mark the submission approved. Generates a Fantasy Daily-style image
 * (unless the caller opts out) and stamps full author credit onto the article.
 *
 * Shared by the admin approve callable and the 2 PM auto-publish job.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} params
 * @param {FirebaseFirestore.DocumentReference} params.submissionRef
 * @param {object} params.submission - Submission document data.
 * @param {string} params.submissionId
 * @param {string} params.approvedBy - UID (or system marker) crediting the publish.
 * @param {"generate"|"submitted"|"none"} [params.imageOption]
 * @param {boolean} [params.autoPublished] - True when published by the scheduled job.
 * @returns {Promise<{articlePath: string, imageUrl: string|null}>}
 */
async function publishSubmission(db, {
  submissionRef,
  submission,
  submissionId,
  approvedBy,
  imageOption = "generate",
  autoPublished = false,
}) {
  // Current season / day context for the article path.
  const seasonDoc = await db.doc("game-settings/season").get();
  const seasonData = seasonDoc.exists ? seasonDoc.data() : {};
  const seasonId = seasonData.seasonUid || "current_season";
  const currentDay = seasonData.currentDay || 1;

  // Resolve (or refresh) author credit so the article always carries the
  // username/location even for older submissions created before we stored them.
  const credit = await resolveAuthorCredit(db, submission.authorUid);
  const authorName = submission.authorName || credit.authorName;
  const authorUsername = submission.authorUsername || credit.authorUsername;
  const authorLocation = submission.authorLocation || credit.authorLocation;
  const authorCorps = pickAuthorCorps(credit.corps);

  // Determine the header image.
  let finalImageUrl = null;
  if (imageOption === "submitted" && submission.imageUrl) {
    finalImageUrl = submission.imageUrl;
  } else if (imageOption === "generate") {
    finalImageUrl = await generateFantasyDailyImage(
      { ...submission, _submissionId: submissionId, authorLocation },
      currentDay,
      authorCorps
    );
  }

  const articleType = `community_${submissionId}`;
  const articlePath = `news_hub/${seasonId}/days/day_${currentDay}/articles/${articleType}`;
  const now = new Date();

  const publishedArticle = {
    type: articleType,
    submissionId,
    reportDay: currentDay,
    // Order by publish time so freshly approved articles land at the top.
    createdAt: now,
    submittedAt: submission.createdAt,
    publishedAt: now,
    updatedAt: now,

    // Article content
    headline: submission.headline,
    summary: submission.summary,
    narrative: submission.fullStory,
    category: submission.category,

    // Image
    imageUrl: finalImageUrl,
    imageIsPlaceholder: !finalImageUrl,

    // Author credit — username + location power the byline and profile link.
    authorUid: submission.authorUid,
    authorName,
    authorUsername,
    authorLocation,

    metadata: {
      source: autoPublished ? "community_auto_publish" : "community_submission",
      location: authorLocation,
      approvedBy,
      approvedAt: now,
      autoPublished,
    },

    isPublished: true,
  };

  await db.doc(articlePath).set(publishedArticle);

  await submissionRef.update({
    status: "approved",
    publishedAt: now,
    updatedAt: now,
    approvedBy,
    autoPublished,
    publishedImageUrl: finalImageUrl,
    publishedPath: articlePath,
  });

  logger.info("Submission published:", { submissionId, articlePath, autoPublished, hasImage: !!finalImageUrl });

  // True when an AI image was asked for but none made it onto the article, so
  // the caller can say so instead of reporting an unqualified success.
  const imageGenerationFailed = imageOption === "generate" && !finalImageUrl;
  if (imageGenerationFailed) {
    logger.warn("Submission published without its requested AI image:", { submissionId, articlePath });
  }

  return { articlePath, imageUrl: finalImageUrl, imageGenerationFailed };
}

module.exports = {
  AUTO_PUBLISH_THRESHOLD,
  AUTO_PUBLISH_HOUR_ET,
  computeNextAutoPublishAt,
  easternParts,
  resolveAuthorCredit,
  pickAuthorCorps,
  extractArticleVisualDetails,
  generateFantasyDailyImage,
  publishSubmission,
  // Press releases
  PRESS_RELEASE_LIMITS,
  resolveOwnedCorps,
  validatePressReleaseInput,
  buildPressReleaseArticle,
  publishPressReleaseArticle,
};
