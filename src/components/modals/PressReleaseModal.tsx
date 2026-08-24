// =============================================================================
// PRESS RELEASE MODAL — DATA-TERMINAL STYLE
// =============================================================================
// The composer for a director's own-organization press release. Unlike the news
// submission modal (admin-reviewed, shared-world coverage), this one is framed
// around INSTANT publishing: what the director writes here goes live under their
// corps' byline the moment they hit Publish. Validation logic lives in
// pressReleaseForm.ts so it stays unit-tested and in lockstep with the server.

import React, { useMemo, useRef, useState } from 'react';
import { X, Send, Megaphone, Image as ImageIcon, Zap } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { PressReleaseCorpsClass } from '../../api/pressReleases';
import {
  PRESS_RELEASE_LIMITS,
  PRESS_RELEASE_AUTO_APPROVE_THRESHOLD,
  pressReleaseAutoPublishes,
  emptyPressReleaseForm,
  validatePressReleaseForm,
  buildPressReleasePayload,
  type PressReleaseFormState,
  type PressReleaseFormErrors,
} from './pressReleaseForm';

/** One of the director's registered corps the release can be issued from. */
export interface OwnedCorpsOption {
  corpsClass: PressReleaseCorpsClass;
  corpsName: string;
}

export interface PressReleaseModalProps {
  /** The director's registered corps, highest class first. */
  ownedCorps: OwnedCorpsOption[];
  /**
   * The author's count of admin-approved PRESS RELEASES (its own trust track,
   * distinct from news articles). Below the threshold a release is submitted for
   * admin review; at or above it, releases publish instantly. Omit to assume the
   * instant path (the server re-checks regardless).
   */
  approvedPressReleaseCount?: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReturnType<typeof buildPressReleasePayload>) => void;
}

const PressReleaseModal: React.FC<PressReleaseModalProps> = ({
  ownedCorps,
  approvedPressReleaseCount,
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<PressReleaseFormState>(() =>
    emptyPressReleaseForm(ownedCorps[0]?.corpsClass)
  );
  const [touched, setTouched] = useState(false);

  useEscapeKey(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const errors: PressReleaseFormErrors = useMemo(() => validatePressReleaseForm(form), [form]);
  const hasCorps = ownedCorps.length > 0;
  const selectedCorps = ownedCorps.find((c) => c.corpsClass === form.corpsClass) ?? ownedCorps[0];

  // Instant vs. review: at/above the threshold of approved press releases the
  // author has earned unreviewed publishing; below it, this release is submitted
  // for admin review. Undefined assumes the instant path (server re-checks).
  const publishesInstantly =
    approvedPressReleaseCount === undefined || pressReleaseAutoPublishes(approvedPressReleaseCount);
  const approvalsRemaining = Math.max(
    0,
    PRESS_RELEASE_AUTO_APPROVE_THRESHOLD - Math.max(0, Math.floor(approvedPressReleaseCount ?? 0))
  );
  // Anyone with a corps can compose — the only hard gate is owning one.
  const canPublish = hasCorps;

  const update = <K extends keyof PressReleaseFormState>(
    field: K,
    value: PressReleaseFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canPublish || Object.keys(errors).length > 0) return;
    onSubmit(buildPressReleasePayload(form));
  };

  // Only surface a field's error once the user has attempted to publish, so the
  // form doesn't scream red on an empty first render.
  const errorFor = (field: keyof PressReleaseFormErrors) => (touched ? errors[field] : undefined);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-press-release"
      >
        <div
          ref={dialogRef}
          className="w-full max-w-2xl bg-surface-card border border-line rounded-none max-h-[90dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-teal-400" />
              <h2
                id="modal-title-press-release"
                className="text-xs font-bold uppercase tracking-wider text-secondary"
              >
                Post a Press Release
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-white transition-colors"
              disabled={isSubmitting}
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* State banner — instant for trusted authors, review for the rest */}
              {publishesInstantly ? (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-none px-3 py-2 flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-secondary">
                    Press releases publish{' '}
                    <span className="text-teal-400 font-bold">instantly</span> under your
                    corps&apos; byline — no review. Share your organization&apos;s own news: season
                    reveals, staff moves, results, and rivalries from your corps&apos; point of
                    view. For circuit-wide coverage, use Submit News instead.
                  </p>
                </div>
              ) : (
                <div className="bg-interactive/10 border border-interactive/30 rounded-none px-3 py-2 flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-interactive mt-0.5 shrink-0" />
                  <p className="text-xs text-secondary">
                    Your first press releases are{' '}
                    <span className="text-interactive font-bold">reviewed by an admin</span> before
                    they publish. Once{' '}
                    <span className="text-interactive font-bold">
                      {PRESS_RELEASE_AUTO_APPROVE_THRESHOLD}
                    </span>{' '}
                    of your releases are approved
                    {approvalsRemaining > 0 &&
                      approvalsRemaining < PRESS_RELEASE_AUTO_APPROVE_THRESHOLD && (
                        <>
                          {' '}
                          (<span className="text-interactive font-bold">
                            {approvalsRemaining}
                          </span>{' '}
                          to go)
                        </>
                      )}
                    , your press releases publish instantly. Write it the way your organization
                    would — for circuit-wide coverage, use Submit News instead.
                  </p>
                </div>
              )}

              {!hasCorps ? (
                <div className="bg-background border border-line rounded-none px-3 py-6 text-center">
                  <p className="text-sm text-secondary">
                    Register a corps first — a press release is issued by your organization.
                  </p>
                </div>
              ) : (
                <>
                  {/* Issuing corps */}
                  <div>
                    <label
                      htmlFor="press-corps"
                      className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2"
                    >
                      Issued by
                    </label>
                    {ownedCorps.length === 1 ? (
                      <div className="h-10 px-3 flex items-center bg-background border border-line rounded-none text-sm text-white">
                        {selectedCorps?.corpsName}
                      </div>
                    ) : (
                      <select
                        id="press-corps"
                        value={form.corpsClass}
                        onChange={(e) =>
                          update('corpsClass', e.target.value as PressReleaseCorpsClass)
                        }
                        className="w-full h-10 px-3 bg-background border border-line rounded-none text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        {ownedCorps.map((c) => (
                          <option key={c.corpsClass} value={c.corpsClass}>
                            {c.corpsName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Headline */}
                  <div>
                    <label
                      htmlFor="press-headline"
                      className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1"
                    >
                      Headline *
                    </label>
                    <input
                      id="press-headline"
                      type="text"
                      placeholder="e.g. Aurora unveils its 2026 production"
                      value={form.headline}
                      onChange={(e) => update('headline', e.target.value)}
                      maxLength={PRESS_RELEASE_LIMITS.headlineMax}
                      className={`w-full h-10 px-3 bg-background border rounded-none text-sm text-white placeholder-muted focus:outline-none transition-colors ${
                        errorFor('headline')
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-line focus:border-teal-500'
                      }`}
                    />
                    <div className="flex justify-between mt-1">
                      {errorFor('headline') ? (
                        <p className="text-[10px] text-red-500">{errorFor('headline')}</p>
                      ) : (
                        <span />
                      )}
                      <p className="text-[10px] text-muted">
                        {form.headline.length}/{PRESS_RELEASE_LIMITS.headlineMax}
                      </p>
                    </div>
                  </div>

                  {/* Announcement body */}
                  <div>
                    <label
                      htmlFor="press-body"
                      className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1"
                    >
                      Announcement *
                    </label>
                    <textarea
                      id="press-body"
                      placeholder="Tell the community what's happening with your corps. Write it the way your organization would announce it."
                      value={form.body}
                      onChange={(e) => update('body', e.target.value)}
                      maxLength={PRESS_RELEASE_LIMITS.bodyMax}
                      rows={7}
                      className={`w-full px-3 py-2 bg-background border rounded-none text-sm text-white placeholder-muted focus:outline-none resize-none transition-colors ${
                        errorFor('body')
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-line focus:border-teal-500'
                      }`}
                    />
                    <div className="flex justify-between mt-1">
                      {errorFor('body') ? (
                        <p className="text-[10px] text-red-500">{errorFor('body')}</p>
                      ) : (
                        <span />
                      )}
                      <p className="text-[10px] text-muted">
                        {form.body.length}/{PRESS_RELEASE_LIMITS.bodyMax}
                      </p>
                    </div>
                  </div>

                  {/* Optional summary */}
                  <div>
                    <label
                      htmlFor="press-summary"
                      className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1"
                    >
                      Feed teaser <span className="text-muted/60">(optional)</span>
                    </label>
                    <input
                      id="press-summary"
                      type="text"
                      placeholder="One line for the news feed — defaults to the start of your announcement"
                      value={form.summary}
                      onChange={(e) => update('summary', e.target.value)}
                      maxLength={PRESS_RELEASE_LIMITS.summaryMax}
                      className={`w-full h-10 px-3 bg-background border rounded-none text-sm text-white placeholder-muted focus:outline-none transition-colors ${
                        errorFor('summary')
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-line focus:border-teal-500'
                      }`}
                    />
                    {errorFor('summary') && (
                      <p className="text-[10px] text-red-500 mt-1">{errorFor('summary')}</p>
                    )}
                  </div>

                  {/* Optional image URL */}
                  <div>
                    <label
                      htmlFor="press-image"
                      className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                        Header image URL <span className="text-muted/60">(optional)</span>
                      </span>
                    </label>
                    <input
                      id="press-image"
                      type="url"
                      placeholder="https://example.com/your-corps.jpg"
                      value={form.imageUrl}
                      onChange={(e) => update('imageUrl', e.target.value)}
                      className={`w-full h-10 px-3 bg-background border rounded-none text-sm text-white placeholder-muted focus:outline-none transition-colors ${
                        errorFor('imageUrl')
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-line focus:border-teal-500'
                      }`}
                    />
                    {errorFor('imageUrl') && (
                      <p className="text-[10px] text-red-500 mt-1">{errorFor('imageUrl')}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !canPublish}
                className="h-9 px-4 bg-teal-500 text-white text-sm font-bold uppercase tracking-wider hover:bg-teal-400 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  publishesInstantly ? (
                    'Publishing...'
                  ) : (
                    'Submitting...'
                  )
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {publishesInstantly ? 'Publish' : 'Submit for Review'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default PressReleaseModal;
