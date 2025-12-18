// src/components/Scores/Leaderboard.jsx
// Simple, scannable leaderboard with rank, name, score, and trend indicators

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, Search, Users } from 'lucide-react';

// Simple trend indicator using arrows
const TrendArrow = ({ trend, change }) => {
  if (trend === 'up' || change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-400 text-sm font-medium">
        <TrendingUp className="w-3.5 h-3.5" />
        {change ? `${Math.abs(change)}` : ''}
      </span>
    );
  }
  if (trend === 'down' || change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-sm font-medium">
        <TrendingDown className="w-3.5 h-3.5" />
        {change ? `${Math.abs(change)}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-cream-500/40 text-sm">
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
};

// Rank badge with different styling for top 3
const RankBadge = ({ rank }) => {
  const getStyle = () => {
    if (rank === 1) return 'bg-gold-500 text-charcoal-900';
    if (rank === 2) return 'bg-gray-400 text-charcoal-900';
    if (rank === 3) return 'bg-amber-600 text-charcoal-900';
    return 'bg-charcoal-800 text-cream-400';
  };

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm ${getStyle()}`}>
      {rank}
    </div>
  );
};

// Filter dropdown component
const FilterDropdown = ({ label, value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-charcoal-800 border border-cream-500/10 rounded-lg text-sm text-cream-300 hover:bg-charcoal-700 transition-colors"
      >
        <span className="text-cream-500/60">{label}:</span>
        <span className="font-medium">{selectedOption?.label || value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 min-w-[150px] bg-[#1a1a1a] border border-[#333] rounded-sm z-20 overflow-hidden"
            >
              {options.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-charcoal-800 transition-colors ${
                    value === option.value ? 'text-gold-400 bg-charcoal-800' : 'text-cream-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Single leaderboard row
const LeaderboardRow = ({ entry, isCurrentUser, onClick }) => {
  const { rank, corps, corpsName, score, totalScore, trend, rankChange } = entry;
  const displayName = corps || corpsName || 'Unknown';
  const displayScore = score || totalScore || 0;

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onClick?.(entry)}
      className={`
        w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors text-left
        ${isCurrentUser
          ? 'bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/15'
          : 'hover:bg-charcoal-800/50'
        }
      `}
    >
      {/* Rank */}
      <RankBadge rank={rank} />

      {/* Corps name */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isCurrentUser ? 'text-gold-400' : 'text-cream-100'}`}>
          {isCurrentUser ? `You (${displayName})` : displayName}
        </p>
      </div>

      {/* Score */}
      <div className="text-right">
        <span className={`font-mono font-bold ${isCurrentUser ? 'text-gold-400' : 'text-cream-100'}`}>
          {displayScore.toFixed(1)}
        </span>
      </div>

      {/* Trend */}
      <div className="w-12 flex justify-end">
        <TrendArrow trend={trend?.trend} change={rankChange || trend?.direction} />
      </div>
    </motion.button>
  );
};

const Leaderboard = ({
  entries = [],
  currentUserCorps = null,
  onEntryClick,
  isLoading = false,
  totalEntries = 0
}) => {
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const classOptions = [
    { value: 'all', label: 'All Classes' },
    { value: 'world', label: 'World Class' },
    { value: 'open', label: 'Open Class' },
    { value: 'a', label: 'A Class' }
  ];

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Filter by class
    if (classFilter !== 'all') {
      const classMap = { world: 'worldClass', open: 'openClass', a: 'aClass' };
      result = result.filter(e => e.corpsClass === classMap[classFilter]);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => {
        const name = (e.corps || e.corpsName || '').toLowerCase();
        return name.includes(query);
      });
    }

    // Re-rank after filtering
    return result.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));
  }, [entries, classFilter, searchQuery]);

  // Find current user's position
  const currentUserEntry = useMemo(() => {
    if (!currentUserCorps) return null;
    return filteredEntries.find(e =>
      (e.corps || e.corpsName) === currentUserCorps
    );
  }, [filteredEntries, currentUserCorps]);

  // Get top entries and ensure user is visible
  const displayEntries = useMemo(() => {
    const topEntries = filteredEntries.slice(0, 50);

    // If user is in top 50, they're already visible
    if (currentUserEntry && currentUserEntry.rank <= 50) {
      return topEntries;
    }

    // If user is outside top 50, add them at the end
    if (currentUserEntry) {
      return [...topEntries, currentUserEntry];
    }

    return topEntries;
  }, [filteredEntries, currentUserEntry]);

  if (isLoading) {
    return (
      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-charcoal-800 rounded w-32"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-charcoal-800 rounded w-32"></div>
            <div className="h-10 bg-charcoal-800 rounded flex-1"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-charcoal-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cream-500/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
              Leaderboard
            </h2>
          </div>
          <span className="text-sm text-cream-500/60">
            {filteredEntries.length} corps
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <FilterDropdown
            label="Class"
            value={classFilter}
            options={classOptions}
            onChange={setClassFilter}
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search corps..."
              className="w-full pl-10 pr-4 py-2 bg-charcoal-800 border border-cream-500/10 rounded-lg text-sm text-cream-100 placeholder-cream-500/40 focus:outline-none focus:border-gold-500/50"
            />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="px-4 py-2 border-b border-cream-500/5 bg-charcoal-950/50">
        <div className="flex items-center gap-4 text-xs text-cream-500/40 uppercase tracking-wide">
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Corps</div>
          <div className="text-right">Score</div>
          <div className="w-12 text-right">Trend</div>
        </div>
      </div>

      {/* Entries */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Users className="w-12 h-12 text-cream-500/30 mb-3" />
            <p className="text-cream-500/60 text-sm text-center">
              {searchQuery ? 'No corps match your search' : 'No scores available'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displayEntries.map((entry, idx) => {
              const isCurrentUser = currentUserCorps &&
                (entry.corps || entry.corpsName) === currentUserCorps;

              // Add visual separator before user if they're far down
              const showSeparator = currentUserEntry &&
                idx > 0 &&
                displayEntries[idx - 1]?.rank < currentUserEntry.rank - 1 &&
                entry.rank === currentUserEntry.rank;

              return (
                <React.Fragment key={`${entry.corps || entry.corpsName}-${entry.rank}`}>
                  {showSeparator && (
                    <div className="flex items-center gap-2 py-2 px-4">
                      <div className="flex-1 border-t border-cream-500/10"></div>
                      <span className="text-xs text-cream-500/40">...</span>
                      <div className="flex-1 border-t border-cream-500/10"></div>
                    </div>
                  )}
                  <LeaderboardRow
                    entry={entry}
                    isCurrentUser={isCurrentUser}
                    onClick={onEntryClick}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
