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

export const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

/**
 * The auth context, or null outside a provider.
 *
 * Null is a real, supported case, not a bug: the public pages (Hall of
 * Champions, articles, the guides) render outside AuthProvider and guard with
 * `useAuth()?.user`. The previous `@returns {AuthContextValue}` claimed a
 * guarantee the code does not make.
 *
 * @returns {AuthContextValue | null}
 */
export const useAuth = () => useContext(AuthContext);
