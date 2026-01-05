// =============================================================================
// ARTICLE REACTIONS - Emoji Reaction System
// =============================================================================
// Allows signed-in users to react to articles with emojis

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../App';
import { toggleArticleReaction, getArticleReactions } from '../../api/functions';
import toast from 'react-hot-toast';

// Available emoji reactions
const REACTIONS = ['👏', '🔥', '💯', '🎺', '🏳️', '🥁', '❤️', '🤔'];

// Reaction labels for accessibility and tooltips
const REACTION_LABELS = {
  '👏': 'Applause',
  '🔥': 'Fire',
  '💯': 'Perfect',
  '🎺': 'Brass',
  '❤️': 'Love',
  '🤔': 'Thinking',
  '🏳️': 'White Flag',
  '🥁': 'Drum',
};

/**
 * ArticleReactions - Interactive emoji reaction bar
 *
 * @param {string} articleId - The article ID to track reactions for
 * @param {object} initialCounts - Initial reaction counts (optional, for SSR/prefetch)
 * @param {string} initialUserReaction - User's initial reaction (optional)
 * @param {boolean} compact - Show compact version (for cards)
 * @param {function} onReactionChange - Callback when reactions change
 */
export default function ArticleReactions({
  articleId,
  initialCounts = null,
  initialUserReaction = null,
  compact = false,
  onReactionChange,
}) {
  const { user } = useAuth();
  const [counts, setCounts] = useState(initialCounts || {
    '👏': 0, '🔥': 0, '💯': 0, '🎺': 0, '❤️': 0, '🤔': 0, '🏳️': 0, '🥁': 0, total: 0
  });
  const [userReaction, setUserReaction] = useState(initialUserReaction);
  const [loading, setLoading] = useState(!initialCounts);
  const [reacting, setReacting] = useState(null);

  // Fetch reactions on mount if not provided
  useEffect(() => {
    if (!initialCounts && articleId) {
      fetchReactions();
    }
  }, [articleId]);

  const fetchReactions = async () => {
    try {
      const result = await getArticleReactions({ articleId });
      if (result.data?.success) {
        setCounts(result.data.counts);
        setUserReaction(result.data.userReaction);
      }
    } catch (err) {
      console.error('Error fetching reactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (emoji) => {
    if (!user) {
      toast.error('Sign in to react to articles');
      return;
    }

    if (reacting) return;

    setReacting(emoji);

    // Optimistic update
    const prevCounts = { ...counts };
    const prevUserReaction = userReaction;

    // Calculate new counts
    const newCounts = { ...counts };
    if (userReaction === emoji) {
      // Removing reaction
      newCounts[emoji] = Math.max(0, newCounts[emoji] - 1);
      newCounts.total = Math.max(0, newCounts.total - 1);
      setUserReaction(null);
    } else {
      // Adding or changing reaction
      if (userReaction) {
        newCounts[userReaction] = Math.max(0, newCounts[userReaction] - 1);
      } else {
        newCounts.total += 1;
      }
      newCounts[emoji] += 1;
      setUserReaction(emoji);
    }
    setCounts(newCounts);

    try {
      const result = await toggleArticleReaction({ articleId, emoji });
      if (result.data?.success) {
        // Update with server response
        if (result.data.action === 'removed') {
          setUserReaction(null);
        } else {
          setUserReaction(result.data.emoji);
        }
        onReactionChange?.(newCounts, result.data.emoji);
      } else {
        // Rollback on failure
        setCounts(prevCounts);
        setUserReaction(prevUserReaction);
      }
    } catch (err) {
      // Rollback on error
      setCounts(prevCounts);
      setUserReaction(prevUserReaction);
      toast.error('Failed to save reaction');
    } finally {
      setReacting(null);
    }
  };

  // Compact view - just show total and top reactions
  if (compact) {
    const topReactions = REACTIONS
      .filter(emoji => counts[emoji] > 0)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 3);

    if (counts.total === 0 && !loading) {
      return null;
    }

    return (
      <div className="flex items-center gap-1.5">
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
        ) : (
          <>
            {topReactions.length > 0 && (
              <div className="flex -space-x-1">
                {topReactions.map((emoji) => (
                  <span
                    key={emoji}
                    className="text-xs bg-[#222] border border-[#333] rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[11px] text-gray-500 font-data tabular-nums">
              {counts.total}
            </span>
          </>
        )}
      </div>
    );
  }

  // Full reaction bar
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          <span className="text-xs text-gray-500">Loading reactions...</span>
        </div>
      ) : (
        <>
          {REACTIONS.map((emoji) => {
            const count = counts[emoji] || 0;
            const isSelected = userReaction === emoji;
            const isReacting = reacting === emoji;

            return (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                disabled={reacting}
                title={`${REACTION_LABELS[emoji]}${count > 0 ? ` (${count})` : ''}`}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-sm border transition-all
                  ${isSelected
                    ? 'bg-[#0057B8]/20 border-[#0057B8] text-white'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:border-[#444] hover:bg-[#222]'}
                  ${isReacting ? 'opacity-50' : ''}
                  ${!user ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                  disabled:opacity-50
                `}
              >
                <span className={`text-base ${isReacting ? 'animate-pulse' : ''}`}>
                  {emoji}
                </span>
                {count > 0 && (
                  <span className={`text-xs font-data tabular-nums ${isSelected ? 'text-[#0057B8]' : 'text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Total count */}
          {counts.total > 0 && (
            <div className="ml-2 text-xs text-gray-500">
              <span className="font-data tabular-nums">{counts.total}</span> reactions
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact reaction summary for article cards
 */
export function ReactionSummary({ counts, userReaction }) {
  if (!counts || counts.total === 0) return null;

  const topReactions = REACTIONS
    .filter(emoji => counts[emoji] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);

  return (
    <div className="flex items-center gap-1">
      {topReactions.length > 0 && (
        <div className="flex -space-x-0.5">
          {topReactions.map((emoji) => (
            <span
              key={emoji}
              className={`text-xs ${userReaction === emoji ? 'brightness-110' : 'opacity-80'}`}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
      <span className="text-[10px] text-gray-500 font-data tabular-nums">
        {counts.total}
      </span>
    </div>
  );
}
