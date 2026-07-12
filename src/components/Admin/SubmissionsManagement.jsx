// src/components/Admin/SubmissionsManagement.jsx
// Admin interface for reviewing and managing user-submitted articles
// Follows Admin panel dark theme: bg-background, bg-surface-card, bg-surface-raised

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Check,
  X,
  Eye,
  Clock,
  User,
  Image,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { listPendingSubmissions, approveSubmission, rejectSubmission } from '../../api/functions';

// Status badge colors
const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  scheduled: 'bg-purple-500/20 text-purple-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

// Category badge colors
const CATEGORY_COLORS = {
  dci: 'bg-blue-500/20 text-blue-400',
  fantasy: 'bg-purple-500/20 text-purple-400',
  analysis: 'bg-cyan-500/20 text-cyan-400',
};

const CATEGORY_LABELS = {
  dci: 'DCI News',
  fantasy: 'Fantasy',
  analysis: 'Analysis',
};

const SubmissionsManagement = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [previewSubmission, setPreviewSubmission] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listPendingSubmissions({ status: statusFilter });
      if (result.data.success) {
        setSubmissions(result.data.submissions);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSubmissions();
    setRefreshing(false);
    toast.success('Submissions refreshed');
  };

  const handleApprove = async (submission, imageOption) => {
    setProcessingId(submission.id);
    try {
      // Fall back to the author's stored image preference so a quick approve
      // never overrides a "no image" or submitted-URL choice.
      const effectiveOption =
        imageOption || submission.imageOption || (submission.imageUrl ? 'submitted' : 'generate');
      const result = await approveSubmission({
        submissionId: submission.id,
        imageOption: effectiveOption,
      });
      if (result.data.success) {
        toast.success('Article approved and published!');
        // Remove from list or update status
        setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
        setPreviewSubmission(null);
      }
    } catch (error) {
      console.error('Error approving submission:', error);
      toast.error(error.message || 'Failed to approve submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (submission, reason = '') => {
    setProcessingId(submission.id);
    try {
      const result = await rejectSubmission({
        submissionId: submission.id,
        reason,
      });
      if (result.data.success) {
        toast.success('Submission rejected');
        setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
        setPreviewSubmission(null);
      }
    } catch (error) {
      console.error('Error rejecting submission:', error);
      toast.error(error.message || 'Failed to reject submission');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with status tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['pending', 'scheduled', 'approved', 'rejected', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-none transition-colors ${
                statusFilter === status
                  ? 'bg-interactive text-white'
                  : 'bg-surface-raised text-muted hover:text-white border border-line'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="bg-surface-card border border-line rounded-none p-8 text-center">
          <FileText className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-muted text-sm">
            No {statusFilter !== 'all' ? statusFilter : ''} submissions found
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <SubmissionRow
              key={submission.id}
              submission={submission}
              onPreview={() => setPreviewSubmission(submission)}
              onApprove={() => handleApprove(submission)}
              onReject={() => handleReject(submission)}
              formatDate={formatDate}
              isProcessing={processingId === submission.id}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewSubmission && (
        <PreviewModal
          submission={previewSubmission}
          onClose={() => setPreviewSubmission(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={processingId === previewSubmission.id}
          formatDate={formatDate}
        />
      )}
    </div>
  );
};

// Submission row component
const SubmissionRow = ({
  submission,
  onPreview,
  onApprove,
  onReject,
  formatDate,
  isProcessing,
}) => (
  <div className="bg-surface-card border border-line rounded-none overflow-hidden">
    <div className="flex items-center justify-between p-4">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none ${STATUS_COLORS[submission.status]}`}
          >
            {submission.status}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none ${CATEGORY_COLORS[submission.category]}`}
          >
            {CATEGORY_LABELS[submission.category]}
          </span>
        </div>
        <h3 className="text-sm font-bold text-white truncate mb-1">{submission.headline}</h3>
        <p className="text-xs text-muted truncate">{submission.summary}</p>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {submission.authorName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(submission.createdAt)}
          </span>
          {submission.imageUrl && (
            <span className="flex items-center gap-1 text-green-500">
              <Image className="w-3 h-3" />
              Has image
            </span>
          )}
          {submission.autoPublish && submission.scheduledPublishAt && (
            <span className="flex items-center gap-1 text-purple-400">
              <Sparkles className="w-3 h-3" />
              Auto-publishes {formatDate(submission.scheduledPublishAt)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPreview}
          className="p-2 text-muted hover:text-white hover:bg-line rounded-none transition-colors"
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>

        {(submission.status === 'pending' || submission.status === 'scheduled') && (
          <>
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-none transition-colors disabled:opacity-50"
              title="Approve"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-none transition-colors disabled:opacity-50"
              title="Reject"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

// Preview modal component
const PreviewModal = ({ submission, onClose, onApprove, onReject, isProcessing, formatDate }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  // Default to the author's stated image preference (respecting a "no image" or
  // submitted-URL choice); the admin can still override before publishing.
  const [imageOption, setImageOption] = useState(
    submission.imageOption || (submission.imageUrl ? 'submitted' : 'generate')
  );

  useEscapeKey(onClose);

  const handleApprove = () => {
    onApprove(submission, imageOption);
  };

  const handleReject = () => {
    onReject(submission, rejectReason);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl bg-surface-card border border-line rounded-none max-h-[90dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-interactive" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-secondary">
                Review Submission
              </h2>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs">
              <span
                className={`px-2 py-1 font-bold uppercase rounded-none ${STATUS_COLORS[submission.status]}`}
              >
                {submission.status}
              </span>
              <span
                className={`px-2 py-1 font-bold uppercase rounded-none ${CATEGORY_COLORS[submission.category]}`}
              >
                {CATEGORY_LABELS[submission.category]}
              </span>
              <span className="text-muted">by {submission.authorName}</span>
              <span className="text-muted">{formatDate(submission.createdAt)}</span>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                Headline
              </label>
              <p className="text-lg font-bold text-white">{submission.headline}</p>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                Summary
              </label>
              <p className="text-sm text-secondary">{submission.summary}</p>
            </div>

            {/* Full Story */}
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                Full Story
              </label>
              <div className="bg-background border border-line rounded-none p-3 max-h-48 overflow-y-auto">
                <p className="text-sm text-secondary whitespace-pre-wrap">{submission.fullStory}</p>
              </div>
            </div>

            {/* Image */}
            {submission.imageUrl && (
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Submitted Image
                </label>
                <img
                  src={submission.imageUrl}
                  alt="Article"
                  className="max-h-48 rounded-none border border-line"
                />
              </div>
            )}

            {/* Rejection form */}
            {showRejectForm && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-none p-3">
                <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
                  Rejection Reason (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this submission is being rejected..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-line rounded-none text-sm text-white placeholder-muted focus:outline-none focus:border-red-500"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          {(submission.status === 'pending' || submission.status === 'scheduled') && (
            <div className="px-4 py-3 border-t border-line bg-surface-sunken">
              {!showRejectForm ? (
                <div className="space-y-3">
                  {/* Image options */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider">
                      Article Image
                    </label>
                    <div className="space-y-2">
                      {/* Option: Use submitted image (only if available) */}
                      {submission.imageUrl && (
                        <label className="flex items-center gap-3 text-sm text-secondary cursor-pointer p-2 rounded-none hover:bg-surface-raised transition-colors">
                          <input
                            type="radio"
                            name="imageOption"
                            value="submitted"
                            checked={imageOption === 'submitted'}
                            onChange={(e) => setImageOption(e.target.value)}
                            className="text-interactive focus:ring-interactive bg-surface-raised border-line-strong"
                          />
                          <Image className="w-4 h-4 text-blue-400" />
                          <span>Use submitted image</span>
                        </label>
                      )}

                      {/* Option: Generate AI image */}
                      <label className="flex items-center gap-3 text-sm text-secondary cursor-pointer p-2 rounded-none hover:bg-surface-raised transition-colors">
                        <input
                          type="radio"
                          name="imageOption"
                          value="generate"
                          checked={imageOption === 'generate'}
                          onChange={(e) => setImageOption(e.target.value)}
                          className="text-interactive focus:ring-interactive bg-surface-raised border-line-strong"
                        />
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        <span>Generate AI image (Fantasy Daily style)</span>
                      </label>

                      {/* Option: No image */}
                      <label className="flex items-center gap-3 text-sm text-secondary cursor-pointer p-2 rounded-none hover:bg-surface-raised transition-colors">
                        <input
                          type="radio"
                          name="imageOption"
                          value="none"
                          checked={imageOption === 'none'}
                          onChange={(e) => setImageOption(e.target.value)}
                          className="text-interactive focus:ring-interactive bg-surface-raised border-line-strong"
                        />
                        <X className="w-4 h-4 text-muted" />
                        <span>No image</span>
                      </label>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-red-500/50 text-red-400 text-sm font-bold hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-bold hover:bg-green-500 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {isProcessing ? 'Publishing...' : 'Approve & Publish'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    disabled={isProcessing}
                    className="px-4 py-2 border border-line text-muted text-sm font-bold hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason display for rejected submissions */}
          {submission.status === 'rejected' && submission.rejectionReason && (
            <div className="px-4 py-3 border-t border-line bg-red-500/10">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-secondary">{submission.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default SubmissionsManagement;
