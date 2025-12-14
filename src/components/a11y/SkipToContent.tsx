// src/components/a11y/SkipToContent.tsx
// Accessibility skip link for keyboard navigation
import React from 'react';

interface SkipToContentProps {
  /** ID of the main content element to skip to */
  contentId?: string;
  /** Custom label for the skip link */
  label?: string;
}

/**
 * Skip to Content Link - Essential for keyboard navigation
 * This link is visually hidden until focused, allowing keyboard users
 * to bypass navigation and jump directly to main content.
 */
export const SkipToContent: React.FC<SkipToContentProps> = ({
  contentId = 'main-content',
  label = 'Skip to main content'
}) => {
  return (
    <a
      href={`#${contentId}`}
      className="
        sr-only focus:not-sr-only
        fixed top-2 left-2 z-[200]
        px-4 py-2
        bg-gold-500 text-charcoal-900
        font-display font-bold text-sm
        rounded-lg shadow-lg
        focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-charcoal-950
        transition-all
      "
    >
      {label}
    </a>
  );
};

/**
 * Visual hidden utility component - accessible but not visible
 */
export const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="sr-only">{children}</span>
);

/**
 * Focus trap hook - traps focus within a modal or dialog
 */
export const useFocusTrap = (containerRef: React.RefObject<HTMLElement>, isActive: boolean = true) => {
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

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(''); // Clear first to ensure re-announcement
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  const Announcer = React.useCallback(() => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  ), [announcement]);

  return { announce, Announcer };
};

export default SkipToContent;
