// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// CAPTION SELECTION MODAL - CONSOLIDATED CAPTION-FOCUSED DESIGN
// =============================================================================

import React from 'react';
import { Check, AlertCircle, Trophy, Save, Target, Award, X, ArrowLeft, Wand2 } from 'lucide-react';
import Portal from '../Portal';
import { formatCountdown } from '../../utils/seasonClock';
import { CORPS_CLASS_LABELS as CLASS_LABELS } from '../../utils/corps';
import {
  LineupCelebration,
  CorpsSelectionList,
  TemplateModal,
  DraftHelper,
  TradesRemainingIndicator,
  CaptionButton,
} from './CaptionSelectionParts';
import { Heading } from '../ui';
import { useCaptionSelectionModal } from './useCaptionSelectionModal';

const CaptionSelectionModal = ({
  onClose,
  onSubmit,
  corpsClass,
  currentLineup,
  seasonId,
  initialCaption,
}) => {
  const {
    dialogRef,
    captions,
    categoryColors,
    pointLimit,
    selections,
    totalPoints,
    remainingPoints,
    isOverLimit,
    isComplete,
    selectionCount,
    changedCaptions,
    changeCount,
    activeCaption,
    activeCaptionData,
    activeCaptionSelection,
    mobileView,
    filteredCorps,
    corpsSearch,
    setCorpsSearch,
    hotCorpsData,
    draftSuggestions,
    loading,
    saving,
    saveError,
    setSaveError,
    isInitialSetup,
    changeInfo,
    changesBlocked,
    tradesRemaining,
    confirmHint,
    scoresInMs,
    scoresPending,
    templates,
    showTemplateModal,
    setShowTemplateModal,
    showCelebration,
    getSelectedCorps,
    handleSelectionChange,
    handleCaptionClick,
    handleBackToLineup,
    handleCorpsSelect,
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplate,
    handleQuickFill,
    handleSubmit,
    handleCelebrationComplete,
  } = useCaptionSelectionModal({
    onClose,
    onSubmit,
    corpsClass,
    currentLineup,
    seasonId,
    initialCaption,
  });

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 md:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-caption-selection"
      >
        <div
          ref={dialogRef}
          className="w-full max-w-5xl max-h-[95dvh] bg-surface-card border border-line rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* Mobile back button when viewing selection */}
                {mobileView === 'selection' && (
                  <button
                    onClick={handleBackToLineup}
                    className="lg:hidden min-w-touch min-h-touch -ml-2 flex items-center justify-center text-muted hover:text-white active:text-white press-feedback"
                    aria-label="Back to lineup"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2
                    id="modal-title-caption-selection"
                    className="text-xs font-bold uppercase tracking-wider text-secondary"
                  >
                    {mobileView === 'selection' && activeCaptionData
                      ? `Select for ${activeCaptionData.name}`
                      : 'Draft Your Lineup'}
                  </h2>
                  <p className="text-sm text-muted">
                    {CLASS_LABELS[corpsClass]} • Draft budget: {pointLimit}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TradesRemainingIndicator
                  tradesRemaining={tradesRemaining}
                  isInitialSetup={isInitialSetup}
                  changeInfo={changeInfo}
                />
                {/* Icon-only on mobile so the header action row stays a single
                    line and doesn't push the lineup below the fold; labels
                    return at sm+. */}
                <button
                  onClick={handleQuickFill}
                  disabled={loading || selectionCount === 8}
                  className="min-h-touch min-w-touch px-3 justify-center bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase flex items-center gap-1 press-feedback"
                  title="Auto-fill empty positions with balanced picks"
                  aria-label="Quick fill empty positions"
                >
                  <Wand2 className="w-3 h-3" /> <span className="hidden sm:inline">Quick Fill</span>
                </button>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="min-h-touch min-w-touch px-3 justify-center border border-line text-muted text-xs font-bold uppercase hover:border-line-strong hover:text-white active:text-white flex items-center gap-1 press-feedback"
                  title="Lineup templates"
                  aria-label="Lineup templates"
                >
                  <Save className="w-3 h-3" /> <span className="hidden sm:inline">Templates</span>
                </button>
                <button
                  onClick={onClose}
                  className="min-w-touch min-h-touch -mr-2 flex items-center justify-center text-muted hover:text-white active:text-white press-feedback"
                  aria-label="Close lineup editor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="px-4 py-3 bg-background border-b border-line flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-interactive" />
                <span className="text-sm text-muted">Budget:</span>
                <span
                  className={`text-lg font-data font-bold ${isOverLimit ? 'text-red-500' : remainingPoints < 10 ? 'text-warning' : 'text-interactive'}`}
                >
                  {totalPoints} / {pointLimit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-muted'}`}
                >
                  {selectionCount}/8 selected
                </span>
                {isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-none">
                    <AlertCircle className="w-3 h-3" /> Over Budget
                  </span>
                )}
                {isComplete && !isOverLimit && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-none">
                    <Check className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-line overflow-hidden rounded-none">
              <div
                className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-interactive'}`}
                style={{ width: `${Math.min((totalPoints / pointLimit) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Prominent save-error banner — mirrors the lock/celebration
              messaging so change-limit and other save failures can't be lost
              behind the modal the way a bottom toast is. */}
          {saveError && (
            <div
              role="alert"
              aria-live="assertive"
              className="px-4 py-3 bg-red-500/15 border-b-2 border-red-500 flex items-start gap-3 flex-shrink-0 animate-slide-in-top"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm font-bold text-red-300 leading-snug">{saveError}</p>
              <button
                onClick={() => setSaveError(null)}
                className="min-w-touch min-h-touch -my-1 -mr-2 flex items-center justify-center text-red-400/70 hover:text-red-300 active:text-red-300 press-feedback"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-interactive border-t-transparent rounded-none animate-spin mx-auto mb-3" />
                <p className="text-xs text-muted uppercase tracking-wider">Loading corps...</p>
              </div>
            ) : (
              <div className="flex-1 flex min-h-0">
                {/* Left Panel - Your Lineup (hidden on mobile when viewing selection) */}
                <div
                  className={`w-full lg:w-80 flex-shrink-0 border-r border-line overflow-y-auto min-h-0 ${mobileView === 'selection' ? 'hidden lg:block' : ''}`}
                >
                  <div className="p-3">
                    {/* Your Lineup - Caption List, grouped by caption family so
                        all 8 slots read as three quick-to-scan sections and fit
                        one mobile screen without scrolling the modal. */}
                    <div className="bg-background border border-line">
                      <div className="p-3 border-b border-line flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                          <Award className="w-3 h-3" /> Your Lineup
                        </h3>
                        {selectionCount < 8 && (
                          <button
                            onClick={handleQuickFill}
                            disabled={loading}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-[10px] font-bold uppercase rounded-none disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" /> Quick Fill
                          </button>
                        )}
                      </div>
                      <div className="p-2 space-y-2">
                        {['General Effect', 'Visual', 'Music'].map((category) => (
                          <div key={category}>
                            <div className="flex items-center gap-1.5 px-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted/70">
                              <span
                                className={`w-1.5 h-1.5 rounded-none ${categoryColors[category]}`}
                              />
                              {category}
                            </div>
                            <div className="space-y-1">
                              {captions
                                .filter((c) => c.category === category)
                                .map((caption) => (
                                  <CaptionButton
                                    key={caption.id}
                                    caption={caption}
                                    selected={getSelectedCorps(caption.id)}
                                    isActive={activeCaption === caption.id}
                                    changed={changedCaptions.has(caption.id) && !isInitialSetup}
                                    onClick={() => handleCaptionClick(caption.id)}
                                    categoryColor={categoryColors[caption.category]}
                                  />
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel - Corps Selection (full screen on mobile when viewing selection) */}
                <div
                  className={`flex-1 flex flex-col overflow-hidden min-h-0 ${mobileView === 'lineup' ? 'hidden lg:flex' : ''}`}
                >
                  {activeCaption && activeCaptionData ? (
                    <>
                      {/* Caption Header */}
                      <div className="px-4 py-3 bg-surface-raised border-b border-line flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-1.5 h-6 rounded-none ${categoryColors[activeCaptionData.category]}`}
                            />
                            <div>
                              <h3 className="text-sm font-bold text-white">
                                {activeCaptionData.name}
                              </h3>
                              <p className="text-[10px] text-muted">{activeCaptionData.category}</p>
                            </div>
                          </div>
                          {activeCaptionSelection && (
                            <button
                              onClick={() => handleSelectionChange(activeCaption, null)}
                              className="flex items-center gap-2 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded-none text-xs"
                            >
                              <X className="w-3 h-3" /> Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Draft Helper — caption-specific suggestions live with
                          the picker (where they apply) rather than crowding the
                          lineup board. Collapsed by default. */}
                      <div className="px-3 pt-2 flex-shrink-0">
                        <DraftHelper
                          suggestions={draftSuggestions}
                          onSelectSuggestion={(corps, captionId) => {
                            if (captionId) handleSelectionChange(captionId, corps);
                          }}
                          selections={selections}
                          activeCaption={activeCaption}
                        />
                      </div>

                      {/* Corps Search + List */}
                      <CorpsSelectionList
                        corpsList={filteredCorps}
                        searchValue={corpsSearch}
                        onSearchChange={setCorpsSearch}
                        selections={selections}
                        activeCaption={activeCaption}
                        activeCaptionSelection={activeCaptionSelection}
                        totalPoints={totalPoints}
                        pointLimit={pointLimit}
                        hotCorpsData={hotCorpsData}
                        onSelect={(corps) => handleCorpsSelect(activeCaption, corps)}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                      <div>
                        <Award className="w-12 h-12 text-muted mx-auto mb-3" />
                        <Heading level="title" as="h3" className="text-muted mb-1">
                          Select a Caption
                        </Heading>
                        <p className="text-sm text-muted">
                          Click on a caption from Your Lineup to see available corps
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 flex-shrink-0 safe-area-bottom">
            <div className="min-w-0 w-full sm:flex-1">
              {/* When the confirm is unavailable, show why — inline and on every
                  screen size — instead of relying on a hover tooltip that never
                  fires on touch. Otherwise fall back to the scoring countdown. */}
              {confirmHint ? (
                <p className="text-[10px] font-bold text-warning leading-snug flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-px" /> {confirmHint}
                </p>
              ) : (
                <p className="text-[10px] text-muted leading-snug hidden sm:block">
                  {scoresPending ? (
                    <>
                      Locked lineups are scored once the night&apos;s DCI results post —{' '}
                      <span className="text-warning font-bold">scores are processing now</span>
                    </>
                  ) : (
                    <>
                      Locked lineups are scored after the night&apos;s last show — next run in{' '}
                      <span className="text-cyan-400 font-bold font-data tabular-nums">
                        {formatCountdown(scoresInMs)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 flex-shrink-0 w-full sm:w-auto sm:ml-auto">
              <button
                onClick={onClose}
                disabled={saving}
                className="min-h-touch px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50 press-feedback"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !isComplete ||
                  isOverLimit ||
                  saving ||
                  loading ||
                  changesBlocked ||
                  (!isInitialSetup && changeCount === 0)
                }
                title={
                  changesBlocked
                    ? 'Caption changes are currently closed — see the change-window indicator above'
                    : undefined
                }
                className="min-h-touch px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover active:bg-interactive-subtle disabled:opacity-50 flex-1 sm:flex-none flex items-center justify-center gap-2 press-feedback-strong"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-none animate-spin" />
                    Saving...
                  </>
                ) : changesBlocked ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    Changes {changeInfo?.status === 'locked' ? 'Locked' : 'Closed'}
                  </>
                ) : !isInitialSetup && changeCount > 0 ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    Confirm {changeCount} Change{changeCount === 1 ? '' : 's'}
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    Lock Lineup ({totalPoints}/{pointLimit})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTemplateModal && (
        <TemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          onSave={handleSaveTemplate}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          currentLineup={selections}
        />
      )}

      {showCelebration && <LineupCelebration onComplete={handleCelebrationComplete} />}
    </Portal>
  );
};

export default CaptionSelectionModal;
