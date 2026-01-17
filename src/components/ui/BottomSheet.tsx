// =============================================================================
// BOTTOM SHEET COMPONENT
// =============================================================================
// Mobile-native slide-up modal with drag-to-dismiss
// Uses Framer Motion for smooth animations and gestures

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

// =============================================================================
// TYPES
// =============================================================================

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[]; // Heights as percentages (e.g., [50, 90])
  initialSnap?: number;
  showHandle?: boolean;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

// =============================================================================
// BOTTOM SHEET COMPONENT
// =============================================================================

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [90],
  initialSnap = 0,
  showHandle = true,
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const previousActiveElement = useRef<Element | null>(null);

  // Calculate heights
  const maxHeight = `${snapPoints[snapPoints.length - 1]}vh`;
  const dismissThreshold = 150; // pixels to drag down before dismissing

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // Focus the sheet
      setTimeout(() => {
        sheetRef.current?.focus();
      }, 100);
    }

    return () => {
      document.body.style.overflow = '';
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Haptic feedback on open
  useEffect(() => {
    if (isOpen) {
      triggerHaptic('sheetOpen');
    }
  }, [isOpen]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const shouldDismiss = info.offset.y > dismissThreshold || info.velocity.y > 500;
      if (shouldDismiss) {
        triggerHaptic('sheetClose');
        onClose();
      }
    },
    [onClose]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && closeOnOverlayClick) {
        triggerHaptic('sheetClose');
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Start drag from handle
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      dragControls.start(e);
    },
    [dragControls]
  );

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <m.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'bottom-sheet-title' : undefined}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={`
              fixed bottom-0 left-0 right-0 z-[101]
              bg-[#1a1a1a] border-t border-[#333]
              rounded-t-sm overflow-hidden
              focus:outline-none
              safe-area-bottom
              ${className}
            `}
            style={{ maxHeight }}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={startDrag}
              >
                <div className="w-10 h-1 bg-gray-600 rounded-sm" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
                {title && (
                  <h2
                    id="bottom-sheet-title"
                    className="text-sm font-bold text-white uppercase tracking-wider"
                  >
                    {title}
                  </h2>
                )}
                {!title && <div />}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2.5 -mr-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div
              className="overflow-y-auto scroll-momentum"
              style={{ maxHeight: `calc(${maxHeight} - 120px)` }}
            >
              {children}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// =============================================================================
// ACTION SHEET COMPONENT
// =============================================================================
// Specialized bottom sheet for action menus

export interface ActionSheetAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
  showCancel?: boolean;
  cancelLabel?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  actions,
  showCancel = true,
  cancelLabel = 'Cancel',
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      showCloseButton={false}
      snapPoints={[50]}
    >
      <div className="px-4 pb-4">
        {/* Actions */}
        <div className="space-y-1">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                disabled={action.disabled}
                className={`
                  w-full flex items-center gap-3 px-4 py-4 min-h-[52px] rounded-sm
                  text-left text-base font-medium
                  transition-all press-feedback
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/20'
                    : 'text-white hover:bg-white/5 active:bg-white/10'
                  }
                `}
              >
                {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cancel Button */}
        {showCancel && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-4 min-h-[52px] bg-[#222] border border-[#333] rounded-sm text-base font-bold text-gray-400 hover:text-white active:bg-[#333] transition-all press-feedback"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </BottomSheet>
  );
};

// =============================================================================
// CONFIRMATION SHEET
// =============================================================================
// Bottom sheet for confirmations (mobile alternative to ConfirmModal)

export interface ConfirmationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
}

export const ConfirmationSheet: React.FC<ConfirmationSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      showHandle={true}
      showCloseButton={false}
      snapPoints={[40]}
    >
      <div className="px-4 pb-6 pt-2">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-base text-gray-400 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-4 min-h-[52px] bg-[#222] border border-[#333] rounded-sm text-base font-bold text-gray-400 hover:text-white active:bg-[#333] transition-all press-feedback disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-4 min-h-[52px] rounded-sm text-base font-bold transition-all press-feedback-strong disabled:opacity-50
              ${variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700'
                : 'bg-[#0057B8] text-white hover:bg-[#0066d6] active:bg-[#004a9e]'
              }
            `}
          >
            {isLoading ? 'Loading...' : confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default BottomSheet;
