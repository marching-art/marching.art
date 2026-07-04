// src/components/Layout/shellContext.js
// Shell context + hook live outside GameShell.jsx so that file only exports
// components, which keeps Vite's fast refresh working
// (react-refresh/only-export-components). The provider value is supplied by
// <GameShell /> in GameShell.jsx.

import { createContext, useContext } from 'react';

export const ShellContext = createContext(null);

export const useShell = () => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a GameShell');
  }
  return context;
};
