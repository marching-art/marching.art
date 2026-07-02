// Structured data panels for the full-article view (standings, top performers,
// insights, recommendations, trending corps). Extracted from pages/Article.jsx.

import { Trophy, Flame, BookOpen, TrendingUp } from 'lucide-react';
import { TrendingBadge } from '../Landing/NewsFeedBadges';

const ArticleDataSections = ({ article }) => (
  <>
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
                <span
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-sm ${
                    item.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
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
              {perf.highlight && <p className="text-xs text-gray-400 mt-1">{perf.highlight}</p>}
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
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                    rec.action === 'buy'
                      ? 'bg-green-500/20 text-green-400'
                      : rec.action === 'sell'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
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
              <TrendingBadge direction={corp.direction} className="w-4 h-4" />
              <div>
                <span className="text-sm font-bold text-white">{corp.corps}</span>
                {corp.reason && <p className="text-xs text-gray-500 mt-0.5">{corp.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
);

export default ArticleDataSections;
