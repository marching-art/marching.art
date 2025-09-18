import React, { createContext, useContext, useEffect } from 'react';
import { useUserStore } from '../store/userStore';

const AuthContext = createContext();

// This custom hook will now get its data from the Zustand store.
// Components using useAuth() won't need to be changed.
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Select the state and the initializer action from the store
  const { user, loggedInProfile, isLoadingAuth, initAuthListener } = useUserStore();

  // On initial app load, run the authentication listener
  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  const value = {
    user,
    loggedInProfile,
    isLoadingAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};