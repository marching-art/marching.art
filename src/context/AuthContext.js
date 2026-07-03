// src/context/AuthContext.js
// Auth context + hook live outside App.jsx so that file only exports
// components, which keeps Vite's fast refresh working for App.jsx
// (react-refresh/only-export-components). The provider value is built and
// supplied by <App /> in src/App.jsx.

import { createContext, useContext } from 'react';

/**
 * @typedef {Object} AuthContextValue
 * @property {import('firebase/auth').User | null | undefined} user
 * @property {boolean} loading
 * @property {Error | undefined} [error]
 * @property {(email: string, password: string) => Promise<unknown>} signIn
 * @property {(email: string, password: string, displayName?: string) => Promise<unknown>} signUp
 * @property {() => Promise<unknown>} signInAnonymously
 * @property {() => Promise<unknown>} signOut
 */

/** @type {import('react').Context<AuthContextValue | null>} */
export const AuthContext = createContext(null);

/** @returns {AuthContextValue} */
export const useAuth = () => useContext(AuthContext);
