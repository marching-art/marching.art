import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './Button';

// =============================================================================
// MODAL COMPONENT
// =============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', duration: 0.5, bounce: 0.3 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  footer,
}) => {
  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              bg-charcoal-900 border-2 border-gold-500/30 rounded w-full overflow-hidden
              shadow-[6px_6px_0px_0px_rgba(255,212,77,1)]
              ${sizeStyles[size]}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-6 border-b-2 border-gold-500/20">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="bg-gold-500 p-2.5 rounded border-2 border-gold-500">
                      {icon}
                    </div>
                  )}
                  {title && (
                    <div>
                      <h2 id="modal-title" className="text-xl font-display font-bold text-cream-100">
                        {title}
                      </h2>
                      {subtitle && (
                        <p className="text-sm text-cream-500/70">{subtitle}</p>
                      )}
                    </div>
                  )}
                </div>
                {showCloseButton && (
                  <IconButton
                    icon={X}
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    aria-label="Close modal"
                  />
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-6 border-t-2 border-gold-500/20 flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

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
  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

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
            className="px-4 py-2 rounded border-2 border-cream-800/30 text-cream-300 hover:bg-cream-900/20 transition-colors font-display font-semibold"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded font-display font-semibold transition-all border-2
              ${variant === 'danger'
                ? 'bg-red-600 text-white border-red-600 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] hover:shadow-[6px_6px_0px_0px_rgba(239,68,68,1)]'
                : 'bg-gold-500 text-charcoal-900 border-gold-500 shadow-[4px_4px_0px_0px_rgba(255,212,77,1)] hover:shadow-[6px_6px_0px_0px_rgba(255,212,77,1)]'}
              disabled:opacity-50 disabled:shadow-none
            `}
          >
            {isLoading ? 'Loading...' : confirmText}
          </button>
        </>
      }
    >
      <p className="text-cream-300">{message}</p>
    </Modal>
  );
};

export default Modal;
