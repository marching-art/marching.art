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
 *
 * Only GameShell pages carry the #main-content id, so on public pages
 * (landing, auth, articles) the click handler falls back to the page's
 * first <main> landmark — without it the link silently did nothing there.
 */
export const SkipToContent: React.FC<SkipToContentProps> = ({
  contentId = 'main-content',
  label = 'Skip to main content',
}) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target =
      document.getElementById(contentId) ?? document.querySelector<HTMLElement>('main');
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: false });
    target.scrollIntoView();
  };

  return (
    <a
      href={`#${contentId}`}
      onClick={handleClick}
      className="
        sr-only focus:not-sr-only
        fixed top-2 left-2 z-[200]
        px-4 py-2
        bg-interactive text-white
        font-bold text-sm
        rounded-none
        focus:outline-none focus:ring-2 focus:ring-interactive focus:ring-offset-2 focus:ring-offset-charcoal-950
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

export default SkipToContent;
