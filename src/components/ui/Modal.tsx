// =============================================================================
// MODAL COMPONENT - ESPN DATA STYLE
// =============================================================================
// Rigid system modal. Dead-center. High contrast overlay. No glow.
// Laws: z-[100], bg-black/80 overlay, border-[#333], no backdrop-blur

import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// Size mapping
const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-4xl',
};

// =============================================================================
// MODAL COMPONENT
// =============================================================================

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const titleId = useId();

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
      // Focus trap - prevent tabbing outside modal
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [closeOnEscape, onClose]
  );

  // Lock body scroll and manage focus when open
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement;

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Auto-focus the first focusable element in the modal
      setTimeout(() => {
        const focusableElement = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusableElement?.focus();
      }, 0);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore focus to the previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`
          bg-[#1a1a1a] border border-[#333] rounded-sm w-full overflow-hidden
          transform transition-all duration-150
          ${sizeStyles[size]}
        `}
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'modalIn 150ms ease-out',
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
            {title && (
              <h2
                id={titleId}
                className="text-xs font-bold uppercase tracking-wider text-gray-300"
              >
                {title}
              </h2>
            )}
            {!title && <div />}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2.5 -mr-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body - Let children define padding */}
        <div className="max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>

      {/* Animation keyframes injected via style tag */}
      <style>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// =============================================================================
// MODAL HEADER COMPONENT (for custom headers)
// =============================================================================

export interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  onClose,
  showCloseButton = true,
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
    <div className="text-sm font-bold uppercase tracking-wider text-gray-300">
      {children}
    </div>
    {showCloseButton && onClose && (
      <button
        onClick={onClose}
        className="p-2.5 -mr-2 text-gray-500 hover:text-white active:text-white transition-colors press-feedback min-w-touch min-h-touch flex items-center justify-center"
        aria-label="Close modal"
      >
        <X className="w-5 h-5" />
      </button>
    )}
  </div>
);

// =============================================================================
// MODAL BODY COMPONENT
// =============================================================================

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  noPadding = false,
}) => (
  <div className={`${noPadding ? '' : 'p-4'} ${className}`}>
    {children}
  </div>
);

// =============================================================================
// MODAL FOOTER COMPONENT
// =============================================================================

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = '',
}) => (
  <div className={`px-4 py-3 border-t border-[#333] bg-[#111] flex justify-end gap-2 ${className}`}>
    {children}
  </div>
);

// =============================================================================
// CONFIRMATION MODAL
// =============================================================================

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white active:bg-white/5 transition-all press-feedback disabled:opacity-50 rounded-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              h-9 px-4 text-sm font-bold uppercase tracking-wider transition-all press-feedback-strong disabled:opacity-50 rounded-sm
              ${variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700'
                : 'bg-[#0057B8] text-white hover:bg-[#0066d6] active:bg-[#004a9e]'}
            `}
          >
            {isLoading ? 'Loading...' : confirmText}
          </button>
        </>
      }
    >
      <div className="p-4">
        <p className="text-sm text-gray-300">{message}</p>
      </div>
    </Modal>
  );
};

export default Modal;
