// =============================================================================
// FOCUS TRAP HOOK
// =============================================================================
// Keyboard focus management for dialogs, extracted from Modal.tsx so every
// hand-rolled dialog (Portal + role="dialog" aria-modal) gets the same
// behavior (WCAG 2.4.3):
//   - initial focus moves into the dialog when it opens
//   - Tab / Shift+Tab cycle within the dialog instead of escaping to the
//     obscured page behind it
//   - focus is restored to the previously focused element on close
//
// Usage: put a ref on the dialog's container element and call
// `useFocusTrap(containerRef, isOpen)` (active defaults to true for dialogs
// that mount only while open).

import { useEffect, type RefObject } from 'react';

// Same focusable-element selector Modal.tsx has always used.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean = true
): void {
  useEffect(() => {
    if (!active) return;

    const previousActiveElement = document.activeElement;

    // Auto-focus the first focusable element in the container (deferred so
    // the dialog's subtree is fully mounted). Respect focus already placed
    // inside the dialog (e.g. an autoFocus input); fall back to the container
    // itself when it has no focusable children.
    const focusTimer = setTimeout(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? container;
      target.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusableElements =
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that was focused before the trap engaged.
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [containerRef, active]);
}

export default useFocusTrap;
