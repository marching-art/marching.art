// =============================================================================
// NEWSROOM ACTIONS — compose your corps' news, from your profile
// =============================================================================
// The two authoring entry points — "Post a Press Release" (your organization's
// own news; reviewed at first, instant once you're a trusted press author) and
// "Submit an Article" (circuit coverage, always reviewed before publishing) —
// used to sit in a footer on the Dashboard, the
// daily-loop surface. Publishing news is not a daily action, and the Dashboard
// footer itself admitted as much. They moved here, to the director's profile,
// directly beneath the Newsroom that lists what they've already published — so
// the compose buttons and the resulting stories live in one place.
//
// Self-contained: it owns its own modal state and submit handlers (which used to
// live in hooks/useDashboardModals) so the Dashboard no longer carries them.
// Rendered only on a director's own profile.

import React, { useMemo, useState, Suspense } from 'react';
import toast from 'react-hot-toast';
import { FileText, Megaphone } from 'lucide-react';
import { ModalLoadingFallback } from '../ui';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { submitNewsForApproval, type SubmitNewsData } from '../../api/articleAdmin';
import { publishPressRelease, type PublishPressReleaseData } from '../../api/pressReleases';
import { PROFILE_CORPS_CLASS_ORDER, resolveCorpsForClass } from '../../utils/corps';
import type { OwnedCorpsOption } from '../modals/PressReleaseModal';
import {
  PRESS_RELEASE_AUTO_APPROVE_THRESHOLD,
  pressReleaseAutoPublishes,
} from '../modals/pressReleaseForm';

// lazyWithRetry (not raw React.lazy) so a stale hashed chunk after a deploy
// self-recovers with one reload instead of crashing the page error boundary —
// the same treatment these modals carried on the Dashboard.
const NewsSubmissionModal = lazyWithRetry(
  () => import('../modals/NewsSubmissionModal'),
  'NewsSubmissionModal'
);
const PressReleaseModal = lazyWithRetry(
  () => import('../modals/PressReleaseModal'),
  'PressReleaseModal'
);

interface NewsroomActionsProps {
  profile:
    | {
        corps?: Record<string, { corpsName?: string }> | null;
        articleStats?: { approvedCount?: number; approvedPressReleaseCount?: number } | null;
      }
    | null
    | undefined;
}

const NewsroomActions: React.FC<NewsroomActionsProps> = ({ profile }) => {
  const [showPressRelease, setShowPressRelease] = useState(false);
  const [submittingPressRelease, setSubmittingPressRelease] = useState(false);
  const [showNewsSubmission, setShowNewsSubmission] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);

  // The director's registered corps, highest class first — the roster a press
  // release can be issued from. Iterates PROFILE_CORPS_CLASS_ORDER so Podium is
  // included (it sits last): a Podium director speaks for their own corps too
  // (PODIUM.md §5.8), and a Podium-only director would otherwise have nothing to
  // issue a release from.
  const ownedCorps = useMemo<OwnedCorpsOption[]>(() => {
    const map = profile?.corps;
    if (!map) return [];
    return PROFILE_CORPS_CLASS_ORDER.flatMap((corpsClass) => {
      const corps = resolveCorpsForClass(map, corpsClass);
      return corps?.corpsName
        ? [{ corpsClass: corpsClass as OwnedCorpsOption['corpsClass'], corpsName: corps.corpsName }]
        : [];
    });
  }, [profile?.corps]);

  // Press releases run on their own trust track: a director's first releases are
  // reviewed, and after PRESS_RELEASE_AUTO_APPROVE_THRESHOLD are approved they
  // publish instantly. Surface which state the author is in before the composer
  // opens. Counts approved PRESS RELEASES only — never news articles.
  const approvedPressReleaseCount = profile?.articleStats?.approvedPressReleaseCount ?? 0;
  const pressReleasesInstant = pressReleaseAutoPublishes(approvedPressReleaseCount);

  const handlePressRelease = async (payload: PublishPressReleaseData) => {
    setSubmittingPressRelease(true);
    try {
      const result = await publishPressRelease(payload);
      if (result.data.success) {
        toast.success(result.data.message || 'Press release published!');
        setShowPressRelease(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish press release');
    } finally {
      setSubmittingPressRelease(false);
    }
  };

  const handleNewsSubmission = async (formData: SubmitNewsData) => {
    setSubmittingNews(true);
    try {
      const result = await submitNewsForApproval(formData);
      if (result.data.success) {
        toast.success('Article submitted for review!');
        setShowNewsSubmission(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit article');
    } finally {
      setSubmittingNews(false);
    }
  };

  return (
    <section className="px-4 pb-4">
      {/* Two distinct paths: a press release is YOUR organization's own news
          (instant), a submitted article covers the shared world (reviewed). */}
      <div className="bg-surface-card border border-line overflow-hidden">
        <div className="p-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setShowPressRelease(true)}
            className="group text-left p-3 bg-surface-raised hover:bg-line border border-line hover:border-teal-500/50 transition-colors flex items-start gap-3"
          >
            <Megaphone className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-white">Post a Press Release</span>
              <span className="block text-xs text-muted mt-0.5">
                {pressReleasesInstant
                  ? "Your corps' own news — reveals, staff, results. Publishes instantly."
                  : `Your corps' own news — reviewed until ${PRESS_RELEASE_AUTO_APPROVE_THRESHOLD} of your releases are approved, then instant.`}
              </span>
            </span>
          </button>
          <button
            onClick={() => setShowNewsSubmission(true)}
            className="group text-left p-3 bg-surface-raised hover:bg-line border border-line hover:border-line-strong transition-colors flex items-start gap-3"
          >
            <FileText className="w-4 h-4 text-interactive mt-0.5 shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-white">Submit an Article</span>
              <span className="block text-xs text-muted mt-0.5">
                Cover the circuit — competition, rivalries, analysis. Reviewed before publishing.
              </span>
            </span>
          </button>
        </div>
      </div>

      {showPressRelease && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <PressReleaseModal
            ownedCorps={ownedCorps}
            approvedPressReleaseCount={approvedPressReleaseCount}
            onClose={() => setShowPressRelease(false)}
            onSubmit={handlePressRelease}
            isSubmitting={submittingPressRelease}
          />
        </Suspense>
      )}

      {showNewsSubmission && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <NewsSubmissionModal
            onClose={() => setShowNewsSubmission(false)}
            onSubmit={handleNewsSubmission}
            isSubmitting={submittingNews}
          />
        </Suspense>
      )}
    </section>
  );
};

export default NewsroomActions;
