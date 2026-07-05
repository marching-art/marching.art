// =============================================================================
// ARTICLE PAGE - Full Article View with Site Layout
// =============================================================================
// Displays the full article content with reactions and comments
// Uses the same layout as Landing page for consistency
// Accessed via /article/:id route

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trophy,
  Flame,
  Share2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Lock,
  Mail,
  User,
  LogOut,
  Settings,
  Zap,
  LayoutDashboard,
  Award,
  Activity,
  MessageCircle,
  Coins,
} from 'lucide-react';
import ArticleReactions from '../components/Articles/ArticleReactions';
import ArticleComments from '../components/Articles/ArticleComments';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import ArticleNarrativeParser from '../components/Articles/ArticleNarrativeParser';
import CaptionInsightsCards from '../components/Articles/CaptionInsightsCards';
import CaptionBreakdownCards from '../components/Articles/CaptionBreakdownCards';
import RecommendationCards from '../components/Articles/RecommendationCards';
import {
  LiveScoresBox,
  FantasyTrendingBox,
  StandingsModal,
  YouTubeModal,
} from '../components/Sidebar';
import { getArticleEngagement } from '../api/functions';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import { useSeasonStore } from '../store/seasonStore';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { getCategoryConfig, formatArticleDate } from '../components/Landing/newsFeedUtils';
import ArticleDataSections from '../components/Articles/ArticleDataSections';
import { resolveArticleById } from '../api/articles';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';
import { useYoutubeSearch } from '../hooks/useYoutubeSearch';
import toast from 'react-hot-toast';

/**
 * Article Page - Full article view with site layout
 */
const Article = () => {
  useBodyScroll();
  const { id } = useParams();
  const location = useLocation();
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const { tickerData, loading: tickerLoading } = useTickerData();
  const {
    liveScores,
    displayDay,
    loading: scoresLoading,
    hasData: hasScoresData,
  } = useLandingScores();

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Get article from navigation state or fetch it
  const [article, setArticle] = useState(location.state?.article || null);
  const [engagement, setEngagement] = useState(location.state?.engagement || null);
  const [loading, setLoading] = useState(!location.state?.article);
  const [error, setError] = useState(null);

  // Ref for scrolling to comments
  const commentsRef = useRef(null);
  const [expandComments, setExpandComments] = useState(false);

  // Standings modal state
  const [showStandingsModal, setShowStandingsModal] = useState(false);

  // YouTube search hook
  const { videoModal, handleYoutubeSearch, handleRetrySearch, closeVideoModal } =
    useYoutubeSearch();

  // Fetch article if not in navigation state (direct link access)
  // OR if article from navigation is missing full content (feedOnly mode)
  useEffect(() => {
    const fetchArticle = async () => {
      const navArticle = location.state?.article;

      // Check if we need to fetch full article data
      // Articles from feed (feedOnly mode) won't have narrative/fullStory
      const needsFullContent = navArticle && !navArticle.narrative && !navArticle.fullStory;

      if (navArticle && !needsFullContent) {
        // Already have complete article from navigation
        return;
      }

      // If we have partial article data, don't show loading spinner
      // but still fetch full content in background
      if (!needsFullContent) {
        setLoading(true);
      }
      setError(null);

      try {
        const foundArticle = await resolveArticleById(id);

        if (foundArticle) {
          setArticle(foundArticle);
          // Also fetch engagement if not already loaded
          if (!engagement) {
            const engagementResult = await getArticleEngagement({ articleIds: [id] });
            if (engagementResult.data?.success && engagementResult.data.engagement?.[id]) {
              setEngagement(engagementResult.data.engagement[id]);
            }
          }
        } else if (!needsFullContent) {
          // Only show error if we don't have any article data
          setError('Article not found');
        }
        // If needsFullContent but couldn't fetch, we still have partial data to show
      } catch (err) {
        console.error('Error fetching article:', err);
        // Only set error if we don't have any article data
        if (!needsFullContent) {
          setError('Failed to load article');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
    // `engagement` is read only as a guard to avoid a redundant engagement fetch;
    // including it would re-run the article fetch whenever engagement loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.state?.article]);

  // Compute trending players from movers across all classes
  const trendingPlayers = useMemo(() => {
    if (!tickerData?.byClass) return [];

    const allMovers = [];
    for (const classKey of ['worldClass', 'openClass', 'aClass']) {
      const classData = tickerData.byClass[classKey];
      if (classData?.movers) {
        classData.movers.forEach((mover) => {
          const prevScore = parseFloat(mover.previousScore);
          const changeValue = parseFloat(mover.change);
          const percentChange = prevScore > 0 ? (changeValue / prevScore) * 100 : 0;

          allMovers.push({
            name: mover.fullName,
            change: `${changeValue >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
            direction: mover.direction,
            absChange: Math.abs(percentChange),
          });
        });
      }
    }

    return allMovers.sort((a, b) => b.absChange - a.absChange).slice(0, 4);
  }, [tickerData]);

  // Fetch engagement data if not provided
  useEffect(() => {
    const fetchEngagement = async () => {
      if (article && !engagement) {
        try {
          const result = await getArticleEngagement({ articleIds: [article.id] });
          if (result.data?.success && result.data.engagement?.[article.id]) {
            setEngagement(result.data.engagement[article.id]);
          }
        } catch (err) {
          console.error('Error fetching engagement:', err);
        }
      }
    };
    fetchEngagement();
  }, [article, engagement]);

  // Scroll to top when article loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      console.error('Login error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setAuthError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setAuthError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setAuthError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setAuthError('Too many attempts. Try again later');
          break;
        default:
          setAuthError('Failed to sign in. Please try again');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    // Helper function to copy to clipboard
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error('Failed to copy link');
      }
    };

    // Check if we're on a mobile device - Web Share API is only reliable on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (navigator.share && isMobile) {
      try {
        await navigator.share({
          title: article?.headline,
          text: article?.headline,
          url: shareUrl,
        });
      } catch (err) {
        // If user cancelled (AbortError), do nothing
        // For other errors (blocked by enterprise, etc.), fall back to clipboard
        if (err.name !== 'AbortError') {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  const handleCommentCountChange = (newCount) => {
    setEngagement((prev) =>
      prev ? { ...prev, commentCount: newCount } : { commentCount: newCount }
    );
  };

  const scrollToComments = () => {
    setExpandComments(true);
    commentsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Day-gate: prevent viewing articles for days whose scores aren't visible yet.
  // When currentDay reaches the season maximum (49), the season is over or ending — lift the
  // gate after 2 AM so all season articles remain accessible during the off-season.
  const currentDay = useSeasonStore((state) => state.currentDay);
  // The active season's UID matches the `seasonId` on its articles. A prior
  // season's article carries a different seasonId and is never day-gated, so a
  // direct link to last season's finals recap stays readable after a reset.
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const effectiveDay = useMemo(() => {
    if (!currentDay) return null;
    const etHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hour12: false,
      }).format(new Date())
    );
    if (currentDay >= 49) {
      return etHour < 2 ? Math.max(currentDay - 2, 1) : null;
    }
    const day = etHour < 2 ? currentDay - 2 : currentDay - 1;
    return day >= 1 ? day : null;
  }, [currentDay]);
  const isPriorSeasonArticle = seasonUid && article?.seasonId && article.seasonId !== seasonUid;
  const isDayGated =
    article && effectiveDay && !isPriorSeasonArticle && article.reportDay > effectiveDay;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0057B8] animate-spin" />
      </div>
    );
  }

  if (isDayGated || error || !article) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Article Not Found</h1>
        <p className="text-gray-500 mb-6 text-center">
          This article may have been removed or the link is invalid.
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#0066d6] transition-colors"
        >
          Back to News
        </Link>
      </div>
    );
  }

  const config = getCategoryConfig(article.category);
  const fullContent =
    article.fullStory || (article.narrative && article.narrative.trim()) || article.summary;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
      {/* FIXED HEADER - Same as Landing */}
      <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333]">
        <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm overflow-hidden">
                <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
              </div>
              <span className="text-base font-bold text-white tracking-wider">marching.art</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile Auth Buttons */}
            {!user && (
              <div className="flex items-center gap-2 lg:hidden">
                <Link
                  to="/login"
                  className="h-9 px-4 bg-yellow-500 text-slate-900 font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>
            )}
            {/* Authenticated user - Show dashboard link on mobile */}
            {user && (
              <Link
                to="/dashboard"
                className="h-9 px-4 bg-yellow-500 text-slate-900 font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200 lg:hidden"
              >
                Dashboard
              </Link>
            )}
            {/* Desktop links */}
            <div className="hidden lg:flex items-center">
              <a
                href="https://discord.gg/YvFRJ97A5H"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-[#5865F2] active:text-white transition-colors press-feedback flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Discord
              </a>
              <Link
                to="/privacy"
                className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        <div className="max-w-[1920px] mx-auto p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ============================================================= */}
            {/* MAIN COLUMN - Article Content (8 cols) */}
            {/* ============================================================= */}
            <div className="lg:col-span-8">
              {/* Hero Image - OPTIMIZATION #7: Uses OptimizedImage for lazy loading with skeleton */}
              {article.imageUrl && (
                <div className="w-full mb-6 border border-[#333] relative">
                  <OptimizedImage
                    src={article.imageUrl}
                    alt={article.headline}
                    aspectRatio="21/9"
                    priority={true}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />
                </div>
              )}

              {/* Article Card */}
              <article className="bg-[#1a1a1a] border border-[#333]">
                {/* Article Header */}
                <div className="p-5 lg:p-6 border-b border-[#333]">
                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 flex-wrap">
                    <span
                      className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}
                    >
                      {config.label}
                    </span>
                    <span>{formatArticleDate(article.createdAt)}</span>
                    {article.metadata?.eventName && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>{article.metadata.eventName}</span>
                      </>
                    )}
                    {article.metadata?.location && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>{article.metadata.location}</span>
                      </>
                    )}
                  </div>

                  {/* Headline */}
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
                    {article.headline}
                  </h1>

                  {/* Summary */}
                  <p className="text-lg text-gray-400 leading-relaxed">{article.summary}</p>
                </div>

                {/* Reactions */}
                <div className="px-5 lg:px-6 py-4 border-b border-[#333] bg-[#111]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Share button */}
                      <button
                        onClick={handleShare}
                        className="p-2 text-gray-500 hover:text-white hover:bg-white/10 transition-colors rounded-sm"
                        title="Share article"
                        aria-label="Share article"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <ArticleReactions
                        articleId={article.id}
                        initialCounts={engagement?.reactionCounts}
                        initialUserReaction={engagement?.userReaction}
                      />
                    </div>
                    {/* Comment count - scrolls to comments */}
                    <button
                      onClick={scrollToComments}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors rounded-sm"
                      title="Jump to comments"
                      aria-label="Jump to comments"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{engagement?.commentCount || 0}</span>
                    </button>
                  </div>
                </div>

                {/* Full Story - only show if different from summary */}
                <div className="p-5 lg:p-6">
                  {/* Articles with structured sections get parsed layout */}
                  {[
                    'fantasy_recap',
                    'fantasy_daily',
                    'dci_recap',
                    'dci_daily',
                    'dci_feature',
                  ].includes(article.type) ||
                  [
                    'fantasy_recap',
                    'fantasy_daily',
                    'dci_recap',
                    'dci_daily',
                    'dci_feature',
                  ].includes(article.articleType) ? (
                    <div className="mb-8">
                      <ArticleNarrativeParser
                        narrative={article.narrative}
                        summary={article.summary}
                        articleType={article.type || article.articleType}
                      />
                    </div>
                  ) : fullContent && fullContent !== article.summary ? (
                    <div className="prose prose-invert prose-lg max-w-none mb-8">
                      {fullContent.split('\n\n').map((paragraph, idx) => (
                        <p
                          key={idx}
                          className="text-base md:text-lg text-gray-300 leading-relaxed mb-6"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {/* Caption Insights - for fantasy_recap articles */}
                  {(article.type === 'fantasy_recap' || article.articleType === 'fantasy_recap') &&
                    article.captionInsights && (
                      <CaptionInsightsCards captionInsights={article.captionInsights} />
                    )}

                  {/* Caption Breakdown - for dci_recap articles */}
                  {(article.type === 'dci_recap' || article.articleType === 'dci_recap') &&
                    article.captionBreakdown && (
                      <CaptionBreakdownCards captionBreakdown={article.captionBreakdown} />
                    )}

                  {/* Structured Recommendations - for fantasy_recap articles (object format) */}
                  {(article.type === 'fantasy_recap' || article.articleType === 'fantasy_recap') &&
                    article.recommendations &&
                    (article.recommendations.buy?.length > 0 ||
                      article.recommendations.hold?.length > 0 ||
                      article.recommendations.sell?.length > 0) && (
                      <RecommendationCards recommendations={article.recommendations} />
                    )}

                  {/* Fantasy Impact */}
                  {article.fantasyImpact && typeof article.fantasyImpact === 'string' && (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-5 mb-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-5 h-5 text-orange-400" />
                        <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
                          Fantasy Impact
                        </span>
                      </div>
                      <p className="text-base text-orange-100/80 leading-relaxed">
                        {article.fantasyImpact}
                      </p>
                    </div>
                  )}

                  <ArticleDataSections article={article} />
                </div>

                {/* Comments Section */}
                <div ref={commentsRef} className="p-5 lg:p-6 border-t border-[#333]">
                  <ArticleComments
                    articleId={article.id}
                    initialCount={engagement?.commentCount || 0}
                    onCommentCountChange={handleCommentCountChange}
                    autoExpand={expandComments}
                  />
                </div>
              </article>

              {/* Back to News Link */}
              <div className="mt-6 text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm text-[#0057B8] hover:text-[#0066d6] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to News Hub
                </Link>
              </div>
            </div>

            {/* ============================================================= */}
            {/* SIDEBAR - Right Column (4 cols, sticky) */}
            {/* ============================================================= */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-4 space-y-5">
                {/* ------------------------------------------------------- */}
                {/* AUTH WIDGET - Login or User Dashboard */}
                {/* ------------------------------------------------------- */}
                {user ? (
                  /* AUTHENTICATED USER WIDGET */
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                    {/* User Header */}
                    <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#0057B8]" />
                        My Fantasy
                      </h3>
                    </div>

                    {/* User Info */}
                    <div className="p-4 border-b border-[#333]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0057B8] flex items-center justify-center text-white font-bold text-sm">
                          {profile?.displayName?.[0]?.toUpperCase() ||
                            user.email?.[0]?.toUpperCase() ||
                            'D'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {profile?.displayName || 'Director'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      {profile && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[#333]/50">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs text-gray-400">Level</span>
                            <span className="text-sm font-bold text-white">
                              {profile.xpLevel || 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-[#0057B8]" />
                            <span className="text-xs text-gray-400">XP</span>
                            <span className="text-sm font-bold text-white font-data tabular-nums">
                              {profile.xp?.toLocaleString() || 0}
                            </span>
                          </div>
                          {profile.engagement?.loginStreak > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs text-gray-400">Streak</span>
                              <span className="text-sm font-bold text-orange-500 font-data tabular-nums">
                                {profile.engagement.loginStreak}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-xs text-gray-400">Coins</span>
                            <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                              {(profile.corpsCoin || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Links */}
                    <div className="p-2">
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#0057B8]" />
                        <span className="text-sm text-white font-medium">Dashboard</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                      </Link>
                      <Link
                        to="/leagues"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                      >
                        <Award className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-white font-medium">My Leagues</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                      </Link>
                      <Link
                        to="/scores"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                      >
                        <Activity className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-white font-medium">Live Scores</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                      </Link>
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.05] transition-colors group"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-white font-medium">Profile & Settings</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400" />
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  /* LOGIN/REGISTER WIDGET */
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                    {/* Card Header */}
                    <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        Director Login
                      </h3>
                    </div>

                    {/* Card Body - Compact Form */}
                    <form onSubmit={handleAuthSubmit} className="p-4 space-y-3">
                      {/* Error Message */}
                      {authError && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300">{authError}</p>
                        </div>
                      )}

                      {/* Email Input */}
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="email"
                          placeholder="Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={authLoading}
                          className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                        />
                      </div>

                      {/* Password Input */}
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={authLoading}
                          className="w-full h-9 pl-9 pr-3 bg-[#111] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                        />
                      </div>

                      {/* Actions Row */}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex-1 h-10 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] active:bg-[#004a9e] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                        >
                          {authLoading ? '...' : 'Sign In'}
                        </button>
                        <Link
                          to="/register"
                          className="flex-1 h-10 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-[#444] hover:text-white transition-all rounded-sm"
                        >
                          Register
                        </Link>
                      </div>

                      {/* Footer Links */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                        <Link
                          to="/forgot-password"
                          className="hover:text-[#0057B8] transition-colors"
                        >
                          Forgot password?
                        </Link>
                        <span>Free to play</span>
                      </div>
                    </form>
                  </div>
                )}

                {/* FANTASY TRENDING MODULE */}
                <FantasyTrendingBox
                  trendingPlayers={trendingPlayers}
                  loading={tickerLoading}
                  dayLabel={tickerData?.dayLabel}
                />

                {/* LIVE SCORE TICKER */}
                <LiveScoresBox
                  liveScores={liveScores}
                  displayDay={displayDay}
                  loading={scoresLoading}
                  hasData={hasScoresData}
                  onYoutubeClick={handleYoutubeSearch}
                  onShowStandings={() => setShowStandingsModal(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FULL STANDINGS MODAL */}
      <StandingsModal
        show={showStandingsModal}
        liveScores={liveScores}
        displayDay={displayDay}
        onClose={() => setShowStandingsModal(false)}
        onYoutubeClick={handleYoutubeSearch}
      />

      {/* YOUTUBE VIDEO MODAL */}
      <YouTubeModal videoModal={videoModal} onClose={closeVideoModal} onRetry={handleRetrySearch} />
    </div>
  );
};

export default Article;
