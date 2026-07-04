// src/context/themeContextValue.js
// Theme context + hook live outside ThemeContext.jsx so that file only exports
// components, which keeps Vite's fast refresh working
// (react-refresh/only-export-components). The provider is <ThemeProvider /> in
// ThemeContext.jsx.

import { createContext, useContext } from 'react';

export const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
