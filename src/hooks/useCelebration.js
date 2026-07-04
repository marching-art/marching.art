// src/hooks/useCelebration.js
// Hook to trigger celebrations programmatically. Lives outside
// Celebration.jsx so that file only exports components, keeping Vite's fast
// refresh working (react-refresh/only-export-components). The <Celebration>
// components listen for the 'celebration' event dispatched here.

/**
 * Hook to trigger celebrations programmatically
 */
export const useCelebration = () => {
  const celebrate = (message, type = 'default') => {
    const event = new CustomEvent('celebration', { detail: { message, type } });
    window.dispatchEvent(event);
  };

  return { celebrate };
};
