import { useEffect } from 'react';

/**
 * Hook to handle Escape key press for closing modals/dialogs
 * Automatically cleans up event listener on unmount
 *
 * @param onEscape - Callback function to execute when Escape is pressed
 * @param isActive - Whether the hook should be active (default: true)
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true): void {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, isActive]);
}

export default useEscapeKey;
