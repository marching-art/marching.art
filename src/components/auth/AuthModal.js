import React, { useState, useEffect } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import { useAuth } from '../../context/AuthContext';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    // If the user successfully logs in/signs up, close the modal.
    if (currentUser && isOpen) {
      onClose();
    }
  }, [currentUser, isOpen, onClose]);


  if (!isOpen) return null;

  const handleSwitchMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-surface-dark p-8 rounded-theme shadow-theme-dark w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary-dark hover:text-white">
          &times;
        </button>
        {isLoginMode ? (
          <LoginForm onSwitchMode={handleSwitchMode} />
        ) : (
          <SignUpForm onSwitchMode={handleSwitchMode} />
        )}
      </div>
    </div>
  );
};

export default AuthModal;