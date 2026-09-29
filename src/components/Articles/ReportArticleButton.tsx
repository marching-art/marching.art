// Report control for director-written articles (press releases and community
// articles). Trusted authors publish without review, so this is the after-the-
// fact moderation path: the report lands in Admin → Moderation → Player
// Reports, where an admin can take the article down in one step.

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../ui';
import { reportArticle, reportableArticleNoun } from '../../api/articleSocial';

const MIN_REASON = 5;
const MAX_REASON = 500;

interface ReportArticleButtonProps {
  articleId: string;
  headline?: string | null;
}

export default function ReportArticleButton({ articleId, headline }: ReportArticleButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);
  const noun = reportableArticleNoun(articleId);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setReason('');
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await reportArticle({ articleId, reason: reason.trim() });
      toast.success(data.message);
      setReported(true);
      setOpen(false);
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Couldn't report this ${noun}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={reported}
        className="p-2 text-muted hover:text-warning hover:bg-white/10 transition-colors rounded-none disabled:opacity-50 disabled:hover:text-muted disabled:hover:bg-transparent"
        title={reported ? 'Reported' : `Report ${noun}`}
        aria-label={reported ? `${noun} reported` : `Report ${noun}`}
      >
        <Flag className="w-4 h-4" aria-hidden />
      </button>

      <Modal
        isOpen={open}
        onClose={close}
        title={`Report ${noun}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="min-h-touch px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || reason.trim().length < MIN_REASON}
              className="min-h-touch px-4 bg-red-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-red-500 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
              Report
            </button>
          </>
        }
      >
        <div className="p-4 space-y-3">
          {headline && (
            <blockquote className="pl-3 border-l-2 border-line text-xs text-secondary line-clamp-3">
              {headline}
            </blockquote>
          )}
          <p className="text-xs text-muted">
            Site admins review every report and can take the {noun} down. The author isn&apos;t told
            who reported it.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, MAX_REASON))}
            rows={3}
            placeholder="What's wrong with it? (a few words is enough)"
            aria-label="Reason for report"
            className="w-full bg-surface-sunken border border-line px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-line-strong resize-none"
          />
        </div>
      </Modal>
    </>
  );
}
