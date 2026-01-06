// =============================================================================
// ARTICLE COMMENTS - Comment System with Moderation
// =============================================================================
// Allows signed-in users to comment on articles. Comments require moderation.

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Loader2, MoreVertical, Edit2, Trash2,
  Flag, Clock, CheckCircle, AlertTriangle, ChevronDown, X
} from 'lucide-react';
import { useAuth } from '../../App';
import {
  getArticleComments,
  addArticleComment,
  editArticleComment,
  deleteArticleComment,
  reportArticleComment
} from '../../api/functions';
import toast from 'react-hot-toast';

// Maximum comment length
const MAX_COMMENT_LENGTH = 1000;

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Single comment component
 */
function Comment({ comment, currentUserId, onEdit, onDelete, onReport }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const menuRef = useRef(null);

  const isOwner = currentUserId === comment.userId;
  const isPending = comment.status === 'pending';
  const isHidden = comment.status === 'hidden' || comment.status === 'rejected';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setReporting(true);
    try {
      await onReport(comment.id, reportReason);
      setShowReportModal(false);
      setReportReason('');
      toast.success('Comment reported');
    } catch (err) {
      toast.error('Failed to report comment');
    } finally {
      setReporting(false);
    }
  };

  if (isHidden && !isOwner) {
    return null;
  }

  return (
    <div className={`py-3 border-b border-[#222] last:border-b-0 ${isHidden ? 'opacity-50' : ''}`}>
      {/* Comment header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* User avatar placeholder */}
          <div className="w-7 h-7 bg-[#333] rounded-full flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
            {comment.userName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white truncate">
                {comment.userName}
              </span>
              {comment.userTitle && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#0057B8]/20 text-[#0057B8] font-medium">
                  {comment.userTitle}
                </span>
              )}
              {isOwner && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/20 text-gray-400 font-medium">
                  You
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span>{formatRelativeTime(comment.createdAt)}</span>
              {comment.isEdited && (
                <span className="text-gray-600">(edited)</span>
              )}
              {isPending && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Clock className="w-3 h-3" />
                  Pending review
                </span>
              )}
              {isHidden && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  {comment.status === 'rejected' ? 'Rejected' : 'Hidden'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu */}
        {currentUserId && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-500 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#222] border border-[#333] shadow-lg z-10">
                {isOwner && !isHidden && (
                  <>
                    <button
                      onClick={() => { onEdit(comment); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-[#333] transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => { onDelete(comment.id); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </>
                )}
                {!isOwner && (
                  <button
                    onClick={() => { setShowReportModal(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-yellow-500 hover:bg-[#333] transition-colors"
                  >
                    <Flag className="w-3 h-3" />
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comment content */}
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
        {comment.content}
      </p>

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-gray-400">Report Comment</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                placeholder="Why are you reporting this comment?"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReport}
                  disabled={reporting || !reportReason.trim()}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-bold hover:bg-yellow-700 disabled:opacity-50"
                >
                  {reporting ? 'Reporting...' : 'Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ArticleComments - Full comments section
 */
export default function ArticleComments({
  articleId,
  initialComments = null,
  initialCount = 0,
  onCommentCountChange,
  autoExpand = false,
}) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState(initialComments || []);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [loading, setLoading] = useState(!initialComments);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const textareaRef = useRef(null);

  // Auto-expand when prop changes
  useEffect(() => {
    if (autoExpand && !isExpanded) {
      setIsExpanded(true);
    }
  }, [autoExpand]);

  // Focus textarea when expanded via autoExpand
  useEffect(() => {
    if (isExpanded && autoExpand && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded, autoExpand]);

  // Fetch comments on mount
  useEffect(() => {
    if (!initialComments && articleId) {
      fetchComments();
    }
  }, [articleId]);

  const fetchComments = async () => {
    try {
      const result = await getArticleComments({ articleId, status: 'approved', limit: 10 });
      if (result.data?.success) {
        setComments(result.data.comments);
        setCommentCount(result.data.total);
        setHasMore(result.data.hasMore);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || comments.length === 0) return;

    setLoadingMore(true);
    try {
      const lastComment = comments[comments.length - 1];
      const result = await getArticleComments({
        articleId,
        status: 'approved',
        limit: 10,
        startAfter: lastComment.id,
      });

      if (result.data?.success) {
        setComments([...comments, ...result.data.comments]);
        setHasMore(result.data.hasMore);
      }
    } catch (err) {
      console.error('Error loading more comments:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Sign in to comment');
      return;
    }

    const content = newComment.trim();
    if (!content) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await addArticleComment({ articleId, content });
      if (result.data?.success) {
        // Add the new comment to the list (show even if pending)
        setComments([result.data.comment, ...comments]);
        setCommentCount(prev => prev + 1);
        setNewComment('');
        onCommentCountChange?.(commentCount + 1);

        if (result.data.comment.status === 'pending') {
          toast.success('Comment submitted for review');
        } else {
          toast.success('Comment posted');
        }
      }
    } catch (err) {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingComment) return;

    const content = editContent.trim();
    if (!content) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await editArticleComment({ commentId: editingComment.id, content });
      if (result.data?.success) {
        setComments(comments.map(c =>
          c.id === editingComment.id ? result.data.comment : c
        ));
        setEditingComment(null);
        setEditContent('');
        toast.success('Comment updated');
      }
    } catch (err) {
      toast.error('Failed to update comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      const result = await deleteArticleComment({ commentId });
      if (result.data?.success) {
        setComments(comments.filter(c => c.id !== commentId));
        setCommentCount(prev => Math.max(0, prev - 1));
        onCommentCountChange?.(Math.max(0, commentCount - 1));
        toast.success('Comment deleted');
      }
    } catch (err) {
      toast.error('Failed to delete comment');
    }
  };

  const handleReport = async (commentId, reason) => {
    const result = await reportArticleComment({ commentId, reason });
    if (!result.data?.success) {
      throw new Error('Failed to report');
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditContent('');
  };

  // Collapsed view - just show count
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="font-data tabular-nums">{commentCount}</span>
        <span>comments</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Comments
          </h3>
          <span className="text-xs text-gray-500 font-data tabular-nums">
            ({commentCount})
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Comment input */}
      <div className="p-4 border-b border-[#333]">
        {user ? (
          editingComment ? (
            // Edit mode
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={MAX_COMMENT_LENGTH}
                rows={3}
                placeholder="Edit your comment..."
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {editContent.length}/{MAX_COMMENT_LENGTH}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditing}
                    disabled={submitting}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={submitting || !editContent.trim()}
                    className="px-3 py-1.5 bg-[#0057B8] text-white text-xs font-bold hover:bg-[#0066d6] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // New comment mode
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-[#333] rounded-full flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                  {profile?.username?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                  rows={2}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#333] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
                />
              </div>
              <div className="flex items-center justify-between pl-10">
                <span className="text-[10px] text-gray-600">
                  {newComment.length}/{MAX_COMMENT_LENGTH}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !newComment.trim()}
                  className="px-3 py-1.5 bg-[#0057B8] text-white text-xs font-bold hover:bg-[#0066d6] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Post
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500">Sign in to join the discussion</p>
          </div>
        )}
      </div>

      {/* Comments list */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <p className="text-sm text-gray-500">No comments yet</p>
            <p className="text-xs text-gray-600 mt-1">Be the first to share your thoughts</p>
          </div>
        ) : (
          <div>
            {comments.map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                currentUserId={user?.uid}
                onEdit={startEditing}
                onDelete={handleDelete}
                onReport={handleReport}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs text-[#0057B8] hover:text-[#0066d6] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More Comments'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact comment count for article cards
 */
export function CommentCount({ count, onClick }) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span className="text-[11px] font-data tabular-nums">{count}</span>
    </button>
  );
}
