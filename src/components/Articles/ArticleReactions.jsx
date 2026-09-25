// =============================================================================
// ARTICLE REACTIONS - Emoji Reaction System
// =============================================================================
// Allows signed-in users to react to articles with emojis

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MessageSquare, SmilePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toggleArticleReaction, getArticleReactions } from '../../api/functions';
import toast from 'react-hot-toast';

// Available emoji reactions
/** @typedef {import('../../types/news').ArticleReactionType} ReactionEmoji */

/** @type {readonly ReactionEmoji[]} */
const REACTIONS = ['👏', '🔥', '💯', '🎺', '🏳️', '🥁', '❤️', '🤔'];

// Reaction labels for accessibility and tooltips
/** @type {Record<string, string>} */
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
 * Reaction counts keyed by emoji, plus the running `total`.
 * @typedef {import('../../types/news').ArticleReactionCounts} ReactionCounts
 */
/**
 * The read-only shape the news feed passes the summaries: an article doc's
 * counts, which may be partial or missing on older articles.
 * @typedef {{ [reaction: string]: number | undefined, total?: number }} ReactionCountsLike
 */

/**
 * ArticleReactions - Interactive emoji reaction bar
 *
 * @param {{
 *   articleId: string,
 *   initialCounts?: ReactionCounts | null,
 *   initialUserReaction?: ReactionEmoji | null,
 *   compact?: boolean,
 *   onReactionChange?: (counts: ReactionCounts, emoji: ReactionEmoji | null) => void,
 * }} props - `initialCounts` / `initialUserReaction` are optional prefetch
 *   values; `compact` renders the card-sized bar.
 */
export default function ArticleReactions({
  articleId,
  initialCounts = null,
  initialUserReaction = null,
  compact = false,
  onReactionChange,
}) {
  const user = useAuth()?.user;
  const [counts, setCounts] = useState(
    /** @type {ReactionCounts} */ (initialCounts) || {
      '👏': 0,
      '🔥': 0,
      '💯': 0,
      '🎺': 0,
      '❤️': 0,
      '🤔': 0,
      '🏳️': 0,
      '🥁': 0,
      total: 0,
    }
  );
  const [userReaction, setUserReaction] = useState(
    /** @type {ReactionEmoji | null} */ (initialUserReaction)
  );
  const [loading, setLoading] = useState(!initialCounts);
  const [reacting, setReacting] = useState(/** @type {ReactionEmoji | null} */ (null));

  // Sync with parent's initialCounts when they become available
  useEffect(() => {
    if (initialCounts) {
      setCounts(initialCounts);
      setLoading(false);
    }
  }, [initialCounts]);

  // Sync with parent's initialUserReaction when it becomes available
  useEffect(() => {
    if (initialUserReaction !== undefined) {
      setUserReaction(initialUserReaction);
    }
  }, [initialUserReaction]);

  const fetchReactions = useCallback(async () => {
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
  }, [articleId]);

  // Fetch reactions on mount if not provided
  useEffect(() => {
    if (!initialCounts && articleId) {
      fetchReactions();
    }
  }, [articleId, initialCounts, fetchReactions]);

  /** @param {ReactionEmoji} emoji */
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
    } catch {
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
    const topReactions = REACTIONS.filter((emoji) => counts[emoji] > 0)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 3);

    if (counts.total === 0 && !loading) {
      return null;
    }

    return (
      <div className="flex items-center gap-1.5">
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted" />
        ) : (
          <>
            {topReactions.length > 0 && (
              <div className="flex -space-x-1">
                {topReactions.map((emoji) => (
                  <span
                    key={emoji}
                    className="text-xs bg-surface-raised border border-line rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[11px] text-muted font-data tabular-nums">{counts.total}</span>
          </>
        )}
      </div>
    );
  }

  // Full reaction bar with picker menu
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted" />
          <span className="text-xs text-muted">Loading reactions...</span>
        </div>
      ) : (
        <>
          {/* Emoji display and picker */}
          <ReactionPickerWithDisplay
            counts={counts}
            userReaction={userReaction}
            onReact={handleReaction}
            reacting={reacting}
            disabled={!user}
          />

          {/* Total count */}
          {counts.total > 0 && (
            <div className="text-xs text-muted">
              <span className="font-data tabular-nums">{counts.total}</span> reactions
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Reaction Picker with Facebook-style overlapping emoji display
 */
/**
 * @param {{
 *   counts: ReactionCounts,
 *   userReaction: ReactionEmoji | null,
 *   onReact: (emoji: ReactionEmoji) => void,
 *   reacting: ReactionEmoji | null,
 *   disabled: boolean,
 * }} props
 */
function ReactionPickerWithDisplay({ counts, userReaction, onReact, reacting, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // Get top emojis that have been used (sorted by count)
  const activeEmojis = REACTIONS.filter((emoji) => counts[emoji] > 0).sort(
    (a, b) => counts[b] - counts[a]
  );

  // Close picker when clicking outside
  useEffect(() => {
    /** @param {MouseEvent} e */
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(/** @type {Node} */ (e.target))) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** @param {ReactionEmoji} emoji */
  const handleReact = (emoji) => {
    onReact(emoji);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Clickable display area */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-none border transition-all ${
          userReaction
            ? 'bg-interactive/20 border-interactive'
            : 'bg-surface-card border-line hover:border-line-strong hover:bg-surface-raised'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {activeEmojis.length > 0 ? (
          <>
            {/* Overlapping emoji circles */}
            <div className="flex -space-x-1.5">
              {activeEmojis.slice(0, 3).map((emoji, idx) => (
                <span
                  key={emoji}
                  className={`w-6 h-6 flex items-center justify-center text-sm bg-surface-raised border-2 border-[#1a1a1a] rounded-full ${
                    userReaction === emoji ? 'ring-1 ring-interactive' : ''
                  }`}
                  style={{ zIndex: 3 - idx }}
                >
                  {emoji}
                </span>
              ))}
            </div>
            {/* Total count */}
            <span className="text-xs text-muted font-data tabular-nums">{counts.total}</span>
          </>
        ) : (
          <>
            <SmilePlus className="w-4 h-4 text-muted" />
            <span className="text-xs text-muted">React</span>
          </>
        )}
      </button>

      {/* Emoji picker popup */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 z-50">
          <div className="bg-surface-raised border border-line-strong rounded-none shadow-xl p-2 flex gap-1">
            {REACTIONS.map((emoji) => {
              const count = counts[emoji] || 0;
              const isSelected = userReaction === emoji;
              const isReacting = reacting === emoji;

              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  disabled={Boolean(reacting)}
                  title={`${REACTION_LABELS[emoji]}${count > 0 ? ` (${count})` : ''}`}
                  className={`
                    w-10 h-10 flex flex-col items-center justify-center rounded-none transition-all
                    ${isSelected ? 'bg-interactive/30 scale-110' : 'hover:bg-line hover:scale-110'}
                    ${isReacting ? 'opacity-50' : ''}
                  `}
                >
                  <span className={`text-xl ${isReacting ? 'animate-pulse' : ''}`}>{emoji}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] font-data tabular-nums ${isSelected ? 'text-interactive' : 'text-muted'}`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact reaction summary for article cards - Facebook style overlapping emojis
 */
/** @param {{ counts: ReactionCountsLike | null | undefined, userReaction?: string | null }} props */
export function ReactionSummary({ counts, userReaction }) {
  if (!counts || !counts.total) return null;

  /** @param {string} emoji */
  const countOf = (emoji) => counts[emoji] ?? 0;
  const topReactions = REACTIONS.filter((emoji) => countOf(emoji) > 0)
    .sort((a, b) => countOf(b) - countOf(a))
    .slice(0, 3);

  return (
    <div className="flex items-center gap-1.5">
      {topReactions.length > 0 && (
        <div className="flex -space-x-1">
          {topReactions.map((emoji, idx) => (
            <span
              key={emoji}
              className={`w-5 h-5 flex items-center justify-center text-xs bg-surface-raised border border-line rounded-full ${
                userReaction === emoji ? 'ring-1 ring-interactive' : ''
              }`}
              style={{ zIndex: 3 - idx }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
      <span className="text-[10px] text-muted font-data tabular-nums">{counts.total}</span>
    </div>
  );
}

/**
 * Combined engagement summary - Facebook style with overlapping reactions and comment count
 * Used on news cards to show both reactions and comments in one compact display
 */
/**
 * @param {{
 *   reactionCounts: ReactionCountsLike | null | undefined,
 *   userReaction?: string | null,
 *   commentCount?: number,
 * }} props
 */
export function EngagementSummary({ reactionCounts, userReaction, commentCount }) {
  const counts = reactionCounts || {};
  const total = counts.total ?? 0;
  const hasReactions = total > 0;
  const hasComments = (commentCount ?? 0) > 0;

  if (!hasReactions && !hasComments) return null;

  /** @param {string} emoji */
  const countOf = (emoji) => counts[emoji] ?? 0;
  const topReactions = hasReactions
    ? REACTIONS.filter((emoji) => countOf(emoji) > 0)
        .sort((a, b) => countOf(b) - countOf(a))
        .slice(0, 3)
    : [];

  return (
    <div className="flex items-center gap-3 text-muted">
      {/* Reactions - overlapping emojis + count */}
      {hasReactions && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {topReactions.map((emoji, idx) => (
              <span
                key={emoji}
                className={`w-5 h-5 flex items-center justify-center text-xs bg-surface-raised border border-line rounded-full ${
                  userReaction === emoji ? 'ring-1 ring-interactive' : ''
                }`}
                style={{ zIndex: 3 - idx }}
              >
                {emoji}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-data tabular-nums">{total}</span>
        </div>
      )}

      {/* Comments */}
      {hasComments && (
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[10px] font-data tabular-nums">{commentCount}</span>
        </div>
      )}
    </div>
  );
}
