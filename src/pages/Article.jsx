// =============================================================================
// ARTICLE PAGE - Full Article View
// =============================================================================
// Displays the full article content with reactions and comments
// Accessed via /article/:id route

import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, Trophy, Flame, BookOpen, Newspaper,
  TrendingUp, TrendingDown, Minus, Share2, Loader2,
  AlertCircle, ChevronRight
} from 'lucide-react';
import ArticleReactions from '../components/Articles/ArticleReactions';
import ArticleComments from '../components/Articles/ArticleComments';
import { getArticleEngagement } from '../api/functions';

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
 * Article Page - Full article view
 */
const Article = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Get article from navigation state (passed from NewsFeed)
  const article = location.state?.article;
  const [engagement, setEngagement] = useState(location.state?.engagement || null);
  const [loading, setLoading] = useState(!article);
  const [error, setError] = useState(null);

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

  // If no article in state, show error
  useEffect(() => {
    if (!article) {
      setLoading(false);
      setError('Article not found');
    }
  }, [article]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.headline,
          text: article?.summary,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleCommentCountChange = (newCount) => {
    setEngagement(prev => prev ? { ...prev, commentCount: newCount } : { commentCount: newCount });
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
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#333]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-500 hover:text-white transition-colors"
                aria-label="Back to news"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm overflow-hidden">
                  <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-wider hidden sm:inline">
                  marching.art
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}>
                {config.label}
              </span>
              <span className="text-xs text-gray-500 hidden sm:flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {readingTime}
              </span>
              <button
                onClick={handleShare}
                className="p-2 text-gray-500 hover:text-white transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      {article.imageUrl && (
        <div className="w-full bg-[#111]">
          <div className="max-w-5xl mx-auto">
            <div className="aspect-[21/9] relative">
              <img
                src={article.imageUrl}
                alt={article.headline}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 flex-wrap">
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
          {article.metadata?.offSeasonDay && (
            <>
              <span className="text-gray-600">•</span>
              <span>Day {article.metadata.offSeasonDay}</span>
            </>
          )}
        </div>

        {/* Headline */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
          {article.headline}
        </h1>

        {/* Summary */}
        <p className="text-xl text-gray-400 leading-relaxed mb-8">
          {article.summary}
        </p>

        {/* Reactions */}
        <div className="mb-8 pb-8 border-b border-[#333]">
          <ArticleReactions
            articleId={article.id}
            initialCounts={engagement?.reactionCounts}
            initialUserReaction={engagement?.userReaction}
          />
        </div>

        {/* Full Story */}
        <article className="prose prose-invert prose-lg max-w-none mb-10">
          {fullContent.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-base md:text-lg text-gray-300 leading-relaxed mb-6">
              {paragraph}
            </p>
          ))}
        </article>

        {/* Fantasy Impact */}
        {article.fantasyImpact && typeof article.fantasyImpact === 'string' && (
          <div className="bg-orange-500/10 border border-orange-500/20 p-5 mb-10">
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
          <div className="mb-10">
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
          <div className="mb-10">
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
          <div className="mb-10">
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
          <div className="mb-10">
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
          <div className="bg-[#1a1a1a] border border-[#333] p-5 mb-10">
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

        {/* Comments Section */}
        <div className="mt-12 pt-8 border-t border-[#333]">
          <ArticleComments
            articleId={article.id}
            initialCount={engagement?.commentCount || 0}
            onCommentCountChange={handleCommentCountChange}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#333] bg-[#111]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              marching.art
            </span>
            <Link
              to="/"
              className="text-xs text-[#0057B8] hover:text-[#0066d6] transition-colors flex items-center gap-1"
            >
              More Stories
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Article;
