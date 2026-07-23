// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Structured data panels for the full-article view (standings, top performers,
// insights, trending corps). Fantasy buy/hold/sell picks are rendered separately
// by RecommendationCards in pages/Article.jsx. Extracted from pages/Article.jsx.

import { Trophy, Flame, BookOpen } from 'lucide-react';
import { TrendingBadge } from '../Landing/NewsFeedBadges';

const ArticleDataSections = ({ article }) => (
  <>
    {/* Standings Data */}
    {article.standings && article.standings.length > 0 && (
      <div className="mb-8">
        <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-interactive" />
          Standings
        </h3>
        <div className="bg-surface-sunken border border-line divide-y divide-line/50">
          {article.standings.slice(0, 10).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-none ${
                    item.rank <= 3 ? 'bg-interactive text-white' : 'bg-surface-raised text-muted'
                  }`}
                >
                  {item.rank}
                </span>
                <span className="text-sm text-white">{item.corps}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold font-data text-white tabular-nums">
                  {typeof item.total === 'number' ? item.total.toFixed(3) : item.total}
                </span>
                {item.change !== undefined && (
                  <span
                    className={`text-xs font-data ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {item.change >= 0 ? '+' : ''}
                    {typeof item.change === 'number' ? item.change.toFixed(3) : item.change}
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
            <div key={idx} className="bg-surface-sunken border border-line p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">{perf.corpsName || perf.corps}</span>
                <span className="text-sm font-data font-bold text-orange-400">
                  {typeof perf.score === 'number' ? perf.score.toFixed(3) : perf.score} pts
                </span>
              </div>
              {perf.director && (
                <span className="text-xs text-muted">Director: {perf.director}</span>
              )}
              {perf.highlight && <p className="text-xs text-muted mt-1">{perf.highlight}</p>}
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
              <div className="text-xs font-bold text-purple-400 uppercase mb-1">
                {insight.metric}
              </div>
              <p className="text-sm text-white mb-1">{insight.finding}</p>
              <p className="text-xs text-muted">{insight.implication}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Fantasy buy/hold/sell picks (object shape) are rendered by
        RecommendationCards in Article.jsx; no array-shaped recommendations
        panel here to avoid a dead double-render. */}

    {/* Trending Corps */}
    {article.trendingCorps?.length > 0 && (
      <div className="bg-surface-sunken border border-line p-5 mb-8">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
          Trending Corps
        </h3>
        <div className="space-y-4">
          {article.trendingCorps.map((corp, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <TrendingBadge direction={corp.direction} className="w-4 h-4" />
              <div>
                <span className="text-sm font-bold text-white">{corp.corps}</span>
                {corp.reason && <p className="text-xs text-muted mt-0.5">{corp.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
);

export default ArticleDataSections;
