/**
 * Published articles → #news, director press releases → #press-releases.
 *
 * Articles reach Firestore from several paths — the nightly generation run,
 * the season-summary job, the admin approve flow, and the trusted-author
 * auto-publisher — but they all land in one place:
 * `news_hub/{seasonId}/days/{dayId}/articles/{articleType}`. A create trigger
 * on that path is therefore the single hook that covers every publish route,
 * present and future, instead of five call sites that drift apart.
 *
 * One category routes elsewhere: a director-authored press release
 * (category "press") is an org's own voice, not the newsroom's, so it goes to
 * its own #press-releases channel rather than mixing into the #news feed. The
 * routing is a single lookup on the article's category, so a new dedicated
 * channel is one map entry away.
 *
 * Volume: the nightly run publishes up to ~5 articles, so #news sees a small
 * burst each evening. That is what a dedicated news channel is for; if it
 * ever reads as noise, the fix is to post one daily digest off the day-index
 * doc instead of one message per article.
 *
 * BACKFILL GUARD: a rebuild or migration that rewrites historical articles
 * must not replay years of headlines into the channel. Only articles created
 * within FRESH_WINDOW_MS of the trigger firing are announced.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const {
  discordNewsWebhookUrl,
  discordPressReleasesWebhookUrl,
  COLORS,
  SITE_URL,
  clampName,
  link,
  payloadOf,
  postToDiscordWebhook,
} = require("../helpers/discord");

// An article older than this when the trigger fires is a backfill, not news.
const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

const CATEGORY_LABELS = {
  dci: "DCI",
  fantasy: "Fantasy",
  editorial: "Editorial",
  community: "Community",
  press: "Press Release",
};

// Article categories that belong in a channel other than #news. A press
// release is an org's own announcement, so it posts to #press-releases.
const PRESS_RELEASE_CATEGORY = "press";

/** Timestamps arrive as Firestore Timestamps in prod, Dates in tests. */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return value instanceof Date ? value : new Date(value);
}

/**
 * The SPA's article URL. Article.jsx resolves a composite id back to the
 * document path (see src/api/articles.ts), so the id is assembled the same
 * way here: `{seasonId}_{dayId}_{articleType}`.
 */
function articleUrl({ seasonId, dayId, articleType }) {
  return link(`/article/${seasonId}_${dayId}_${articleType}`);
}

/**
 * Build the post for one published article.
 *
 * @param {Object} params
 * @param {Object} params.article - The article doc data.
 * @param {string} params.seasonId
 * @param {string} params.dayId - e.g. "day_12".
 * @param {string} params.articleType
 * @returns {Object|null} Webhook payload, or null with nothing to say.
 */
function buildArticlePayload({ article, seasonId, dayId, articleType }) {
  if (!article || !article.headline) return null;

  const category = CATEGORY_LABELS[article.category] || article.category || "News";
  const emoji = article.category === PRESS_RELEASE_CATEGORY ? "📣" : "📰";
  const embed = {
    title: `${emoji} ${clampName(article.headline, 200)}`,
    url: articleUrl({ seasonId, dayId, articleType }),
    description: article.summary ? clampName(article.summary, 400) : undefined,
    color: COLORS.news,
    footer: {
      text:
        `${category}` +
        (article.reportDay ? ` · Day ${article.reportDay}` : "") +
        ` · ${SITE_URL.replace("https://", "")}`,
    },
  };
  // Hero art when the generator produced some (DCI-sourced articles ship
  // imageUrl: null by design).
  if (article.imageUrl && /^https:\/\//.test(article.imageUrl)) {
    embed.image = { url: article.imageUrl };
  }
  return payloadOf(embed);
}

/**
 * Announce a freshly published article. Never throws — a Discord failure
 * must not fail (or retry) the trigger, and there is nothing to retry: the
 * article is already live in the app.
 *
 * @param {Object} params
 * @param {Object} params.article - The article doc data.
 * @param {string} params.seasonId
 * @param {string} params.dayId
 * @param {string} params.articleType
 * @param {string} params.webhookUrl
 * @param {Date} [params.now]
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{status: string, [k: string]: unknown}>}
 */
async function announceArticle({
  article,
  seasonId,
  dayId,
  articleType,
  webhookUrl,
  now = new Date(),
  fetchImpl,
}) {
  if (!webhookUrl) return { status: "disabled" };

  const createdAt = toDate(article && article.createdAt);
  if (createdAt && now.getTime() - createdAt.getTime() > FRESH_WINDOW_MS) {
    return { status: "stale", articleType };
  }

  const payload = buildArticlePayload({ article, seasonId, dayId, articleType });
  if (!payload) return { status: "not-announceable", articleType };

  try {
    await postToDiscordWebhook(webhookUrl, payload, fetchImpl);
    logger.info(`[news-discord] announced ${seasonId}/${dayId}/${articleType}.`);
    return { status: "posted", articleType };
  } catch (error) {
    logger.warn(`[news-discord] post failed for ${articleType}: ${error.message}`);
    return { status: "failed", error: error.message };
  }
}

exports.announceArticleToDiscord = onDocumentCreated(
  {
    document: "news_hub/{seasonId}/days/{dayId}/articles/{articleType}",
    secrets: [discordNewsWebhookUrl, discordPressReleasesWebhookUrl],
    // Pure fan-out; nothing here needs the scoring-sized budget. Retries are
    // off by default for Firestore triggers, which is what we want: the
    // article is already live, and a re-fired trigger would double-post.
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const article = snapshot.data();
    // A press release goes to its own channel; everything else is newsroom
    // copy. Each channel's webhook is independently unset-able to silence it.
    const webhookUrl =
      article && article.category === PRESS_RELEASE_CATEGORY
        ? discordPressReleasesWebhookUrl.value()
        : discordNewsWebhookUrl.value();
    await announceArticle({
      article,
      seasonId: event.params.seasonId,
      dayId: event.params.dayId,
      articleType: event.params.articleType,
      webhookUrl,
    });
  }
);

module.exports.FRESH_WINDOW_MS = FRESH_WINDOW_MS;
module.exports.PRESS_RELEASE_CATEGORY = PRESS_RELEASE_CATEGORY;
module.exports.articleUrl = articleUrl;
module.exports.buildArticlePayload = buildArticlePayload;
module.exports.announceArticle = announceArticle;
