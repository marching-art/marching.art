import React, { useState, useEffect } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import { useAuth } from '../../context/AuthContext';
import { X } from 'lucide-react';

const AuthModal = ({ isOpen, onClose, defaultMode = 'login' }) => {
  const [isLoginMode, setIsLoginMode] = useState(defaultMode === 'login');
  const { currentUser } = useAuth();

  // Reset to default mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoginMode(defaultMode === 'login');
    }
  }, [isOpen, defaultMode]);

  useEffect(() => {
    // If the user successfully logs in/signs up, close the modal.
    if (currentUser && isOpen) {
      onClose();
    }
  }, [currentUser, isOpen, onClose]);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitchMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-dark rounded-theme shadow-2xl w-full max-w-md relative animate-fadeIn border border-accent-dark">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-text-secondary-dark hover:text-white transition-colors z-10 p-1 hover:bg-background-dark rounded-full"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Tab Navigation */}
        <div className="flex border-b border-accent-dark">
          <button
            onClick={() => setIsLoginMode(true)}
            className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
              isLoginMode
                ? 'text-primary-dark border-b-2 border-primary-dark bg-background-dark bg-opacity-30'
                : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark hover:bg-opacity-20'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setIsLoginMode(false)}
            className={`flex-1 py-4 px-6 text-center font-semibold transition-all ${
              !isLoginMode
                ? 'text-primary-dark border-b-2 border-primary-dark bg-background-dark bg-opacity-30'
                : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark hover:bg-opacity-20'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {isLoginMode ? (
            <LoginForm onSwitchMode={handleSwitchMode} />
          ) : (
            <SignUpForm onSwitchMode={handleSwitchMode} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;