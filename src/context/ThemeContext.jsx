// src/context/ThemeContext.jsx
// =============================================================================
// THEME CONTEXT - SINGLE DARK MODE
// =============================================================================
// The application uses a single "Night Mode Stadium HUD" aesthetic.
// No light mode toggle is provided - it's always night time at the stadium.

import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    // Always apply dark theme - this is the only mode
    document.documentElement.setAttribute('data-theme', 'dark');
    // Clear any old theme preference from localStorage
    localStorage.removeItem('marching-art-theme');
  }, []);

  // Provide a stable context value - theme is always dark
  const value = {
    theme: 'dark',
    isDark: true,
    // These are provided for backwards compatibility but do nothing
    setTheme: () => {},
    toggleTheme: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
