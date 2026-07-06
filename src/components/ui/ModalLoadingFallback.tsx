// =============================================================================
// MODAL LOADING FALLBACK
// =============================================================================
// Suspense fallback for lazy-loaded modals. While the modal's chunk downloads
// (noticeable on slow cellular), the tap that opened it gets immediate visual
// feedback — `fallback={null}` reads as an unresponsive button. Matches the
// modal overlay treatment (z-[100], bg-black/80) so the real modal replaces
// it seamlessly.

import React from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from './Spinner';

export const ModalLoadingFallback: React.FC = () => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <Spinner size="lg" />
    </div>,
    document.body
  );
};

export default ModalLoadingFallback;
