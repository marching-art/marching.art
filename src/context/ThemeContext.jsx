// src/context/ThemeContext.jsx
// =============================================================================
// THEME CONTEXT - SINGLE DARK MODE
// =============================================================================
// The application uses a single "Night Mode Stadium HUD" aesthetic.
// No light mode toggle is provided - it's always night time at the stadium.

import React, { useEffect } from 'react';
import { ThemeContext } from './themeContextValue';

// OPTIMIZATION: Define static value outside component to prevent re-renders
// Since theme is always dark and never changes, this object is truly constant
const THEME_VALUE = Object.freeze({
  theme: 'dark',
  isDark: true,
  // These are provided for backwards compatibility but do nothing
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    // Always apply dark theme - this is the only mode
    document.documentElement.setAttribute('data-theme', 'dark');
    // Clear any old theme preference from localStorage
    localStorage.removeItem('marching-art-theme');
  }, []);

  return <ThemeContext.Provider value={THEME_VALUE}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
