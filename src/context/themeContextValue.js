// src/context/themeContextValue.js
// Theme context + hook live outside ThemeContext.jsx so that file only exports
// components, which keeps Vite's fast refresh working
// (react-refresh/only-export-components). The provider is <ThemeProvider /> in
// ThemeContext.jsx.

import { createContext, useContext } from 'react';

/**
 * @typedef {Object} ThemeContextValue
 * @property {'dark'} theme
 * @property {boolean} isDark
 * @property {() => void} setTheme - No-op; kept for backwards compatibility.
 * @property {() => void} toggleTheme - No-op; kept for backwards compatibility.
 */

export const ThemeContext = createContext(/** @type {ThemeContextValue | null} */ (null));

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
