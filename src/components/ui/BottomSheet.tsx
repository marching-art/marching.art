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
  initialSnap: _initialSnap = 0,
  showHandle = true,
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const previousActiveElement = useRef<Element | null>(null);

  // Calculate heights — dvh tracks the visible viewport on iOS (the Safari
  // toolbar shrinks it below 100vh). Inline styles can't carry a fallback
  // declaration pair, so feature-detect and use vh where dvh is unsupported.
  const dvhSupported = typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh') === true;
  const maxHeight = `${snapPoints[snapPoints.length - 1]}${dvhSupported ? 'dvh' : 'vh'}`;
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
              rounded-none overflow-hidden
              focus:outline-none
              safe-area-bottom
              flex flex-col
              ${className}
            `}
            style={{ maxHeight }}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                onPointerDown={startDrag}
              >
                <div className="w-10 h-1 bg-gray-600 rounded-none" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
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
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BottomSheet;
