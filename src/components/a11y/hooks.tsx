// src/components/a11y/hooks.tsx
// Accessibility hooks. Kept out of SkipToContent.tsx so that file only exports
// components, which keeps Vite's fast refresh working
// (react-refresh/only-export-components).

import React from 'react';

/**
 * Focus trap hook - traps focus within a modal or dialog
 */
export const useFocusTrap = (
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean = true
) => {
  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element when trap is activated
    firstElement?.focus();

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
};

/**
 * Announce to screen readers
 */
export const useAnnounce = () => {
  const [announcement, setAnnouncement] = React.useState('');

  const announce = React.useCallback(
    (message: string, _priority: 'polite' | 'assertive' = 'polite') => {
      setAnnouncement(''); // Clear first to ensure re-announcement
      setTimeout(() => setAnnouncement(message), 100);
    },
    []
  );

  const Announcer = React.useCallback(
    () => (
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    ),
    [announcement]
  );

  return { announce, Announcer };
};
