// src/components/Admin/CommentsModeration.jsx
// Admin interface for moderating article comments
// Follows Admin panel dark theme: bg-[#0a0a0a], bg-[#1a1a1a], bg-[#222]

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, RefreshCw, Check, X, Eye, Clock, User,
  AlertTriangle, Flag, EyeOff, CheckCircle, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  listCommentsForModeration,
  moderateComment,
  bulkModerateComments
} from '../../api/functions';

// Status badge colors
const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  hidden: 'bg-gray-500/20 text-gray-400',
};

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

const CommentsModeration = () => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedComments, setSelectedComments] = useState(new Set());
  const [previewComment, setPreviewComment] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, hidden: 0, total: 0 });

  useEffect(() => {
    loadComments();
  }, [statusFilter]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const result = await listCommentsForModeration({ status: statusFilter, limit: 50 });
      if (result.data.success) {
        setComments(result.data.comments);
        setCounts(result.data.counts);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
      setSelectedComments(new Set());
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadComments();
    setRefreshing(false);
    toast.success('Comments refreshed');
  };

  const handleModerate = async (commentId, action, reason = '') => {
    setProcessingId(commentId);
    try {
      const result = await moderateComment({ commentId, action, reason });
      if (result.data.success) {
        toast.success(`Comment ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'hidden'}`);
        // Remove from list if status doesn't match filter
        setComments(prev => prev.filter(c => c.id !== commentId));
        setPreviewComment(null);
        // Update counts
        setCounts(prev => ({
          ...prev,
          [statusFilter === 'all' ? result.data.comment.status : statusFilter]:
            statusFilter === 'all' ? prev[result.data.comment.status] : Math.max(0, prev[statusFilter] - 1),
        }));
      }
    } catch (error) {
      console.error('Error moderating comment:', error);
      toast.error(error.message || 'Failed to moderate comment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkModerate = async (action) => {
    if (selectedComments.size === 0) return;

    setBulkProcessing(true);
    try {
      const result = await bulkModerateComments({
        commentIds: Array.from(selectedComments),
        action
      });
      if (result.data.success) {
        toast.success(`${result.data.moderated} comment${result.data.moderated > 1 ? 's' : ''} ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'hidden'}`);
        // Remove moderated comments from list
        setComments(prev => prev.filter(c => !selectedComments.has(c.id)));
        setSelectedComments(new Set());
        // Refresh counts
        await loadComments();
      }
    } catch (error) {
      console.error('Error bulk moderating:', error);
      toast.error(error.message || 'Failed to bulk moderate');
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedComments.size === comments.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(comments.map(c => c.id)));
    }
  };

  const toggleSelectComment = (id) => {
    const newSelected = new Set(selectedComments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedComments(newSelected);
  };

  if (loading && comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with status tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'hidden', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === status
                  ? 'bg-[#0057B8] text-white'
                  : 'bg-[#222] text-gray-400 hover:text-white border border-[#333]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {counts[status] > 0 && status !== 'all' && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  status === 'pending' ? 'bg-yellow-500 text-black' : 'bg-[#333] text-gray-300'
                }`}>
                  {counts[status]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedComments.size > 0 && (
        <div className="bg-[#222] border border-[#333] rounded-sm p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selectedComments.size} comment{selectedComments.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkModerate('approve')}
              disabled={bulkProcessing}
              className="px-3 py-1.5 text-xs font-bold text-green-400 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 inline mr-1" />
              Approve All
            </button>
            <button
              onClick={() => handleBulkModerate('reject')}
              disabled={bulkProcessing}
              className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5 inline mr-1" />
              Reject All
            </button>
            <button
              onClick={() => handleBulkModerate('hide')}
              disabled={bulkProcessing}
              className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:bg-gray-500/20 rounded transition-colors disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5 inline mr-1" />
              Hide All
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-8 text-center">
          <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            No {statusFilter !== 'all' ? statusFilter : ''} comments to moderate
          </p>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="bg-[#222] border-b border-[#333] px-4 py-2 flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedComments.size === comments.length && comments.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 bg-[#333] border-[#444] rounded focus:ring-[#0057B8]"
            />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex-1">
              Comment
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">
              Status
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">
              Actions
            </span>
          </div>

          {/* Comments */}
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isSelected={selectedComments.has(comment.id)}
              onToggleSelect={() => toggleSelectComment(comment.id)}
              onPreview={() => setPreviewComment(comment)}
              onApprove={() => handleModerate(comment.id, 'approve')}
              onReject={() => handleModerate(comment.id, 'reject')}
              onHide={() => handleModerate(comment.id, 'hide')}
              isProcessing={processingId === comment.id}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewComment && (
        <CommentPreviewModal
          comment={previewComment}
          onClose={() => setPreviewComment(null)}
          onApprove={() => handleModerate(previewComment.id, 'approve')}
          onReject={(reason) => handleModerate(previewComment.id, 'reject', reason)}
          onHide={() => handleModerate(previewComment.id, 'hide')}
          isProcessing={processingId === previewComment.id}
        />
      )}
    </div>
  );
};

// Comment row component
const CommentRow = ({
  comment,
  isSelected,
  onToggleSelect,
  onPreview,
  onApprove,
  onReject,
  onHide,
  isProcessing
}) => {
  const hasReports = comment.reportCount > 0;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-[#222] last:border-b-0 ${
      hasReports ? 'bg-red-500/5' : 'hover:bg-[#1f1f1f]'
    } transition-colors`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 bg-[#333] border-[#444] rounded focus:ring-[#0057B8]"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">
            {comment.userName}
          </span>
          {comment.userTitle && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#0057B8]/20 text-[#0057B8] font-medium">
              {comment.userTitle}
            </span>
          )}
          <span className="text-[10px] text-gray-500">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {hasReports && (
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <Flag className="w-3 h-3" />
              {comment.reportCount} report{comment.reportCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 line-clamp-2">
          {comment.content}
        </p>
        {comment.articleHeadline && (
          <p className="text-[10px] text-gray-600 mt-1 truncate">
            On: {comment.articleHeadline}
          </p>
        )}
      </div>

      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded w-20 text-center ${STATUS_COLORS[comment.status]}`}>
        {comment.status}
      </span>

      <div className="flex items-center gap-1 w-32 justify-center">
        <button
          onClick={onPreview}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>

        {comment.status !== 'approved' && (
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
            title="Approve"
          >
            <Check className="w-4 h-4" />
          </button>
        )}

        {comment.status !== 'rejected' && (
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
            title="Reject"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {comment.status !== 'hidden' && (
          <button
            onClick={onHide}
            disabled={isProcessing}
            className="p-1.5 text-gray-400 hover:bg-gray-500/20 rounded transition-colors disabled:opacity-50"
            title="Hide"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Comment preview modal
const CommentPreviewModal = ({ comment, onClose, onApprove, onReject, onHide, isProcessing }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEscapeKey(onClose);

  const handleReject = () => {
    onReject(rejectReason);
    setShowRejectForm(false);
    setRejectReason('');
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0057B8]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Review Comment
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status and meta */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${STATUS_COLORS[comment.status]}`}>
                {comment.status}
              </span>
              <span className="text-xs text-gray-500">
                {formatRelativeTime(comment.createdAt)}
              </span>
              {comment.reportCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <Flag className="w-3 h-3" />
                  {comment.reportCount} report{comment.reportCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Author info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-sm font-bold text-gray-400">
                {comment.userName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{comment.userName}</p>
                {comment.userTitle && (
                  <p className="text-[10px] text-[#0057B8]">{comment.userTitle}</p>
                )}
              </div>
            </div>

            {/* Comment content */}
            <div className="bg-[#0a0a0a] border border-[#333] rounded p-3">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>

            {/* Article reference */}
            {comment.articleHeadline && (
              <div className="text-xs text-gray-500">
                <span className="text-gray-600">On article:</span>{' '}
                <span className="text-gray-400">{comment.articleHeadline}</span>
              </div>
            )}

            {/* Report reasons */}
            {comment.reportReasons && comment.reportReasons.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
                  Report Reasons
                </p>
                <ul className="space-y-1">
                  {comment.reportReasons.map((reason, idx) => (
                    <li key={idx} className="text-xs text-gray-300">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rejection form */}
            {showRejectForm && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
                  Rejection Reason (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            {/* Previous moderation */}
            {comment.moderatedAt && (
              <div className="text-[10px] text-gray-600">
                Last moderated {formatRelativeTime(comment.moderatedAt)}
                {comment.moderatedBy && ` by ${comment.moderatedBy}`}
                {comment.moderationReason && (
                  <span className="block text-gray-500 mt-1">
                    Reason: {comment.moderationReason}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#111]">
            {!showRejectForm ? (
              <div className="flex justify-end gap-2">
                {comment.status !== 'hidden' && (
                  <button
                    onClick={onHide}
                    disabled={isProcessing}
                    className="px-3 py-1.5 border border-[#333] text-gray-400 text-xs font-bold hover:text-white hover:border-[#444] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Hide
                  </button>
                )}
                {comment.status !== 'rejected' && (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 border border-red-500/50 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}
                {comment.status !== 'approved' && (
                  <button
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                )}
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectForm(false)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 border border-[#333] text-gray-400 text-xs font-bold hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Confirm Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default CommentsModeration;
