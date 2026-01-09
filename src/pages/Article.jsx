// =============================================================================
// ARTICLE PAGE - Full Article View with Site Layout
// =============================================================================
// Displays the full article content with reactions and comments
// Uses the same layout as Landing page for consistency
// Accessed via /article/:id route

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Trophy, Flame, BookOpen, Newspaper,
  TrendingUp, TrendingDown, Minus, Share2, Loader2,
  AlertCircle, ChevronRight, Lock, Mail, User, LogOut,
  Settings, Zap, Activity, LayoutDashboard, Award,
  UserPlus, MessageCircle, Coins, X, RefreshCw
} from 'lucide-react';
import YouTubeIcon from '../components/YouTubeIcon';
import ArticleReactions from '../components/Articles/ArticleReactions';
import ArticleComments from '../components/Articles/ArticleComments';
import { getArticleEngagement, getRecentNews } from '../api/functions';
import { db } from '../api/client';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../App';
import { useProfileStore } from '../store/profileStore';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

// Category configuration
function getCategoryConfig(category) {
  switch (category) {
    case 'dci':
      return {
        label: 'DCI RECAP',
        bgClass: 'bg-[#0057B8]',
        textClass: 'text-[#0057B8]',
        icon: Trophy,
      };
    case 'fantasy':
      return {
        label: 'FANTASY',
        bgClass: 'bg-orange-500',
        textClass: 'text-orange-400',
        icon: Flame,
      };
    case 'analysis':
      return {
        label: 'ANALYSIS',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        icon: BookOpen,
      };
    default:
      return {
        label: 'NEWS',
        bgClass: 'bg-gray-500',
        textClass: 'text-gray-400',
        icon: Newspaper,
      };
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Calculate reading time
function getReadingTime(story) {
  const text = `${story.headline} ${story.summary} ${story.fullStory || ''} ${story.narrative || ''} ${story.fantasyImpact || ''}`;
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

// Trending badge component
function TrendingBadge({ direction }) {
  if (direction === 'up') {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  }
  if (direction === 'down') {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-gray-500" />;
}

/**
 * Article Page - Full article view with site layout
 */
const Article = () => {
  useBodyScroll();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const { tickerData, loading: tickerLoading } = useTickerData();
  const { liveScores, displayDay, loading: scoresLoading, hasData: hasScoresData } = useLandingScores();

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

  // Standings and video modal state
  const [showStandingsModal, setShowStandingsModal] = useState(false);
  const [videoModal, setVideoModal] = useState({
    show: false,
    loading: false,
    videoId: null,
    title: '',
    searchQuery: '',
    error: null
  });

  // Search YouTube and show video in modal
  const handleYoutubeSearch = async (year, corpsName, skipCache = false) => {
    // Build search query with special cases
    let searchQuery = `${year} ${corpsName}`;

    // Add "corps" for generic names that need disambiguation
    if (['cavaliers', 'genesis'].includes(corpsName.toLowerCase())) {
      searchQuery += ' corps';
    }

    // Add show name for specific corps/year combinations
    if (year === '2018' && corpsName.toLowerCase().includes('santa clara')) {
      searchQuery += ' babylon';
    }

    setVideoModal({
      show: true,
      loading: true,
      videoId: null,
      title: searchQuery,
      searchQuery,
      error: null,
      year,
      corpsName
    });

    try {
      const functions = getFunctions();
      const searchYoutube = httpsCallable(functions, 'searchYoutubeVideo');
      const result = await searchYoutube({ query: searchQuery, skipCache });

      if (result.data.success && result.data.found) {
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          videoId: result.data.videoId,
          title: result.data.title || searchQuery
        }));
      } else {
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          error: result.data.message || 'No videos found'
        }));
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setVideoModal(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to search YouTube'
      }));
    }
  };

  const closeVideoModal = () => {
    setVideoModal({
      show: false,
      loading: false,
      videoId: null,
      title: '',
      searchQuery: '',
      error: null
    });
  };

  // Retry search with fresh results (skip cache)
  const handleRetrySearch = () => {
    if (videoModal.year && videoModal.corpsName) {
      handleYoutubeSearch(videoModal.year, videoModal.corpsName, true);
    }
  };

  // Fetch article if not in navigation state (direct link access)
  useEffect(() => {
    const fetchArticle = async () => {
      if (location.state?.article) {
        // Already have article from navigation
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let foundArticle = null;

        // Method 1: Parse composite article ID and fetch from correct path
        // ID format: {seasonId}_{dayId}_{articleType} e.g., "scherzo_2025-26_day_1_deep_analytics"
        // Path: news_hub/{seasonId}/days/{dayId}/articles/{articleType}
        const idMatch = id.match(/^(.+)_(day_\d+)_(.+)$/);
        if (idMatch) {
          const [, seasonId, dayId, articleType] = idMatch;
          const articlePath = `news_hub/${seasonId}/days/${dayId}/articles/${articleType}`;
          try {
            const docRef = doc(db, articlePath);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              // Determine category from article type
              const category =
                articleType.startsWith('dci_') ? 'dci' :
                articleType.startsWith('fantasy_') ? 'fantasy' :
                articleType === 'deep_analytics' ? 'analysis' : 'dci';
              foundArticle = {
                id,
                seasonId,
                reportDay: parseInt(dayId.replace('day_', ''), 10),
                articleType,
                category,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              };
            }
          } catch {
            // Path doesn't exist or no permission, try other methods
          }
        }

        // Method 2: Try community submissions path
        // Format: news_hub/{seasonId}/community/article_{submissionId}
        if (!foundArticle && id.startsWith('article_')) {
          // Try to find in community submissions - need to know seasonId
          // Fetch active season from game-settings
          try {
            const seasonSettingsRef = doc(db, 'game-settings', 'season');
            const seasonSettingsSnap = await getDoc(seasonSettingsRef);
            if (seasonSettingsSnap.exists()) {
              const seasonId = seasonSettingsSnap.data()?.seasonUid || 'current_season';
              const communityPath = `news_hub/${seasonId}/community/${id}`;
              const docRef = doc(db, communityPath);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                foundArticle = {
                  id,
                  ...data,
                  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                };
              }
            }
          } catch {
            // Community path doesn't exist
          }
        }

        // Method 3: Try legacy flat collection paths
        if (!foundArticle) {
          const legacyCollections = ['news_hub', 'news', 'articles'];
          for (const collectionPath of legacyCollections) {
            try {
              const docRef = doc(db, collectionPath, id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                foundArticle = {
                  id: docSnap.id,
                  ...data,
                  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                };
                break;
              }
            } catch {
              // Collection doesn't exist or no permission, try next
            }
          }
        }

        // Method 4: Fall back to searching through recent news API
        if (!foundArticle) {
          let startAfter = null;
          let attempts = 0;
          const maxAttempts = 5;

          while (!foundArticle && attempts < maxAttempts) {
            const result = await getRecentNews({ limit: 100, startAfter });

            if (!result.data?.success || !result.data.news?.length) {
              break;
            }

            foundArticle = result.data.news.find(a => a.id === id);

            if (!foundArticle && result.data.hasMore) {
              const lastArticle = result.data.news[result.data.news.length - 1];
              startAfter = lastArticle?.createdAt;
              attempts++;
            } else {
              break;
            }
          }
        }

        if (foundArticle) {
          setArticle(foundArticle);
          // Also fetch engagement
          const engagementResult = await getArticleEngagement({ articleIds: [id] });
          if (engagementResult.data?.success && engagementResult.data.engagement?.[id]) {
            setEngagement(engagementResult.data.engagement[id]);
          }
        } else {
          setError('Article not found');
        }
      } catch (err) {
        console.error('Error fetching article:', err);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, location.state?.article]);

  // Compute trending players from movers across all classes
  const trendingPlayers = useMemo(() => {
    if (!tickerData?.byClass) return [];

    const allMovers = [];
    for (const classKey of ['worldClass', 'openClass', 'aClass']) {
      const classData = tickerData.byClass[classKey];
      if (classData?.movers) {
        classData.movers.forEach(mover => {
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

    return allMovers
      .sort((a, b) => b.absChange - a.absChange)
      .slice(0, 4);
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
    } catch (err) {
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
      } catch (err) {
        toast.error('Failed to copy link');
      }
    };

    // Check if we're on a mobile device - Web Share API is only reliable on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
    setEngagement(prev => prev ? { ...prev, commentCount: newCount } : { commentCount: newCount });
  };

  const scrollToComments = () => {
    setExpandComments(true);
    commentsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0057B8] animate-spin" />
      </div>
    );
  }

  if (error || !article) {
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
  const Icon = config.icon;
  const readingTime = getReadingTime(article);
  const fullContent = article.fullStory || article.narrative || article.summary;

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
              <span className="text-base font-bold text-white tracking-wider">
                marching.art
              </span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile Auth Buttons */}
            {!user && (
              <div className="flex items-center gap-2 lg:hidden">
                <Link
                  to="/login"
                  className="h-9 px-4 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>
            )}
            {/* Authenticated user - Show dashboard link on mobile */}
            {user && (
              <Link
                to="/dashboard"
                className="h-9 px-4 bg-yellow-500 text-slate-900 font-display font-semibold text-sm uppercase tracking-wide flex items-center justify-center rounded-lg hover:bg-yellow-400 active:bg-yellow-600 transition-all duration-200 lg:hidden"
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
              <Link to="/privacy" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
                Privacy
              </Link>
              <Link to="/terms" className="px-3 py-2.5 min-h-touch text-sm text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center">
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
              {/* Hero Image */}
              {article.imageUrl && (
                <div className="w-full bg-[#111] mb-6 border border-[#333]">
                  <div className="aspect-[21/9] relative">
                    <img
                      src={article.imageUrl}
                      alt={article.headline}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                  </div>
                </div>
              )}

              {/* Article Card */}
              <article className="bg-[#1a1a1a] border border-[#333]">
                {/* Article Header */}
                <div className="p-5 lg:p-6 border-b border-[#333]">
                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 flex-wrap">
                    <span className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}>
                      {config.label}
                    </span>
                    <span>{formatDate(article.createdAt)}</span>
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
                  <p className="text-lg text-gray-400 leading-relaxed">
                    {article.summary}
                  </p>
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
                      <span className="text-sm font-medium">
                        {engagement?.commentCount || 0}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Full Story */}
                <div className="p-5 lg:p-6">
                  <div className="prose prose-invert prose-lg max-w-none mb-8">
                    {fullContent.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="text-base md:text-lg text-gray-300 leading-relaxed mb-6">
                        {paragraph}
                      </p>
                    ))}
                  </div>

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

                  {/* Standings Data */}
                  {article.standings && article.standings.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-[#0057B8]" />
                        Standings
                      </h3>
                      <div className="bg-[#111] border border-[#333] divide-y divide-[#333]/50">
                        {article.standings.slice(0, 10).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-sm ${
                                item.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
                              }`}>
                                {item.rank}
                              </span>
                              <span className="text-sm text-white">{item.corps}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold font-data text-white tabular-nums">
                                {typeof item.total === 'number' ? item.total.toFixed(3) : item.total}
                              </span>
                              {item.change !== undefined && (
                                <span className={`text-xs font-data ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {item.change >= 0 ? '+' : ''}{typeof item.change === 'number' ? item.change.toFixed(3) : item.change}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Performers */}
                  {article.topPerformers && article.topPerformers.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        Top Performers
                      </h3>
                      <div className="space-y-3">
                        {article.topPerformers.slice(0, 5).map((perf, idx) => (
                          <div key={idx} className="bg-[#111] border border-[#333] p-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-white">{perf.corpsName || perf.corps}</span>
                              <span className="text-sm font-data font-bold text-orange-400">
                                {typeof perf.score === 'number' ? perf.score.toFixed(3) : perf.score} pts
                              </span>
                            </div>
                            {perf.director && (
                              <span className="text-xs text-gray-500">Director: {perf.director}</span>
                            )}
                            {perf.highlight && (
                              <p className="text-xs text-gray-400 mt-1">{perf.highlight}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {article.insights && article.insights.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Key Insights
                      </h3>
                      <div className="space-y-3">
                        {article.insights.map((insight, idx) => (
                          <div key={idx} className="bg-purple-500/10 border border-purple-500/20 p-4">
                            <div className="text-xs font-bold text-purple-400 uppercase mb-1">{insight.metric}</div>
                            <p className="text-sm text-white mb-1">{insight.finding}</p>
                            <p className="text-xs text-gray-400">{insight.implication}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {article.recommendations && article.recommendations.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Fantasy Recommendations
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {article.recommendations.map((rec, idx) => (
                          <div key={idx} className="bg-[#111] border border-[#333] p-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-white">{rec.corps}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                                rec.action === 'buy' ? 'bg-green-500/20 text-green-400' :
                                rec.action === 'sell' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {rec.action}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">{rec.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Corps */}
                  {article.trendingCorps?.length > 0 && (
                    <div className="bg-[#111] border border-[#333] p-5 mb-8">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                        Trending Corps
                      </h3>
                      <div className="space-y-4">
                        {article.trendingCorps.map((corp, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <TrendingBadge direction={corp.direction} />
                            <div>
                              <span className="text-sm font-bold text-white">
                                {corp.corps}
                              </span>
                              {corp.reason && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {corp.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                          {profile?.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'D'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {profile?.displayName || 'Director'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      {profile && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[#333]/50">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs text-gray-400">Level</span>
                            <span className="text-sm font-bold text-white">{profile.xpLevel || 1}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-[#0057B8]" />
                            <span className="text-xs text-gray-400">XP</span>
                            <span className="text-sm font-bold text-white font-data tabular-nums">{profile.xp?.toLocaleString() || 0}</span>
                          </div>
                          {profile.engagement?.loginStreak > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs text-gray-400">Streak</span>
                              <span className="text-sm font-bold text-orange-500 font-data tabular-nums">{profile.engagement.loginStreak}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-xs text-gray-400">Coins</span>
                            <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">{(profile.corpsCoin || 0).toLocaleString()}</span>
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
                        <Link to="/forgot-password" className="hover:text-[#0057B8] transition-colors">
                          Forgot password?
                        </Link>
                        <span>Free to play</span>
                      </div>
                    </form>
                  </div>
                )}

                {/* ------------------------------------------------------- */}
                {/* FANTASY TRENDING MODULE */}
                {/* ------------------------------------------------------- */}
                <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                  {/* Header */}
                  <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5" />
                      Fantasy Trending
                    </h3>
                    <span className="text-[10px] font-data text-gray-500">{tickerData?.dayLabel || '24h'}</span>
                  </div>

                  {/* Trending List */}
                  <div className="divide-y divide-[#333]/50">
                    {tickerLoading ? (
                      <div className="px-3 py-6 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                      </div>
                    ) : trendingPlayers.length > 0 ? (
                      trendingPlayers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center text-xs font-bold font-data text-gray-500 tabular-nums">
                              {idx + 1}
                            </span>
                            <span className="text-sm text-white truncate max-w-[160px]">{player.name}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm font-bold font-data tabular-nums ${
                            player.direction === 'up' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {player.direction === 'up' ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            {player.change}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-gray-500">No trending data available</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                    <Link
                      to="/scores"
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                    >
                      View All Trends
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* ------------------------------------------------------- */}
                {/* LIVE SCORE TICKER */}
                {/* ------------------------------------------------------- */}
                <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
                  {/* Header */}
                  <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#0057B8]" />
                      Live Scores
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {hasScoresData && (
                        <>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-data text-gray-500">Day {displayDay}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score List */}
                  <div className="divide-y divide-[#333]/50">
                    {scoresLoading ? (
                      <div className="px-3 py-6 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-[#0057B8]/30 border-t-[#0057B8] rounded-full animate-spin" />
                      </div>
                    ) : hasScoresData ? (
                      liveScores.slice(0, 12).map((row) => {
                        const changeValue = row.change;
                        const hasChange = changeValue !== null;
                        const changeDisplay = hasChange
                          ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
                          : '—';

                        return (
                          <div
                            key={`${row.sourceYear}-${row.corpsName}`}
                            className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 flex items-center justify-center bg-[#222] text-xs font-bold font-data text-gray-500 tabular-nums rounded-sm">
                                {row.rank}
                              </span>
                              <span className="text-sm text-white truncate max-w-[140px]" title={`${row.sourceYear} ${row.corpsName}`}>
                                <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-data text-white tabular-nums">
                                {row.score.toFixed(3)}
                              </span>
                              <span className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                                row.direction === 'up' ? 'text-green-500' :
                                row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                              }`}>
                                {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                                {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                                {changeDisplay}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleYoutubeSearch(row.sourceYear, row.corpsName);
                                }}
                                className="p-1 hover:opacity-80 transition-opacity"
                                title={`Watch ${row.sourceYear} ${row.corpsName} on YouTube`}
                              >
                                <YouTubeIcon size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-gray-500">No scores available yet</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
                    <button
                      onClick={() => setShowStandingsModal(true)}
                      className="text-[10px] text-[#0057B8] hover:text-[#0066d6] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                    >
                      Full Standings
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* FULL STANDINGS MODAL */}
      {/* ============================================================= */}
      {showStandingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowStandingsModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0057B8]" />
                  Full Standings
                </h2>
                {displayDay && (
                  <p className="text-[10px] font-data text-gray-500 mt-0.5">Season Day {displayDay}</p>
                )}
              </div>
              <button
                onClick={() => setShowStandingsModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standings List */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-[#333]/50">
                {liveScores.map((row) => {
                  const changeValue = row.change;
                  const hasChange = changeValue !== null;
                  const changeDisplay = hasChange
                    ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}`
                    : '—';

                  return (
                    <div
                      key={`modal-${row.sourceYear}-${row.corpsName}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold font-data tabular-nums rounded-sm ${
                          row.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
                        }`}>
                          {row.rank}
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm text-white block truncate max-w-[180px]" title={`${row.sourceYear} ${row.corpsName}`}>
                            <span className="text-gray-400 font-data">{row.sourceYear}</span> {row.corpsName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-data text-white tabular-nums">
                          {row.score.toFixed(3)}
                        </span>
                        <span className={`flex items-center gap-0.5 text-xs font-bold font-data tabular-nums w-12 justify-end ${
                          row.direction === 'up' ? 'text-green-500' :
                          row.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                        }`}>
                          {row.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                          {row.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                          {changeDisplay}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleYoutubeSearch(row.sourceYear, row.corpsName);
                          }}
                          className="p-1 hover:opacity-80 transition-opacity"
                          title={`Watch ${row.sourceYear} ${row.corpsName} on YouTube`}
                        >
                          <YouTubeIcon size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex-shrink-0">
              <p className="text-[10px] font-data text-gray-500 text-center">
                {liveScores.length} of 25 corps with scores
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* YOUTUBE VIDEO MODAL */}
      {/* ============================================================= */}
      {videoModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90"
            onClick={closeVideoModal}
          />

          {/* Modal Content - 720p aspect ratio (1280x720) */}
          <div className="relative w-full max-w-4xl bg-[#0A0A0A] border border-[#333] rounded-sm">
            {/* Header */}
            <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <YouTubeIcon size={20} className="flex-shrink-0" />
                <h2 className="text-sm font-bold text-white truncate">
                  {videoModal.title}
                </h2>
              </div>
              <button
                onClick={closeVideoModal}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Container - 16:9 aspect ratio for 720p */}
            <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
              {videoModal.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Searching YouTube...</p>
                </div>
              ) : videoModal.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <YouTubeIcon size={64} className="mb-4 opacity-40" />
                  <p className="text-gray-400 text-sm mb-4">{videoModal.error}</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                  >
                    <YouTubeIcon size={16} />
                    Search on YouTube
                  </a>
                </div>
              ) : videoModal.videoId ? (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${videoModal.videoId}?autoplay=1&vq=hd720&rel=0`}
                  title={videoModal.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : null}
            </div>

            {/* Footer with YouTube link */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex items-center justify-between">
              <p className="text-[10px] text-gray-500 truncate flex-1 mr-2">
                Search: "{videoModal.searchQuery}"
              </p>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={handleRetrySearch}
                  disabled={videoModal.loading}
                  className="text-[10px] text-gray-400 hover:text-white font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Search again (skip cache)"
                >
                  <RefreshCw className={`w-3 h-3 ${videoModal.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                >
                  More Results
                  <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Article;
