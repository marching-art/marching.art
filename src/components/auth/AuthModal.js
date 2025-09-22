// components/auth/AuthModal.js
// Authentication modal component for Enhanced Fantasy Drum Corps Game

import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose, initialView = 'login', onSuccess }) => {
  const { updateUserExperience } = useUserStore();
  const [view, setView] = useState(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: ''
  });

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (view === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        
        const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success('Account created successfully!');
        
        // Award signup experience
        setTimeout(() => {
          updateUserExperience(100, 'Account creation');
        }, 1000);
        
      } else {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success('Welcome back!');
      }

      onSuccess && onSuccess();
      onClose();
      
    } catch (error) {
      let errorMessage = 'An error occurred';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Email already in use';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-xl max-w-md w-full p-6 border border-accent dark:border-accent-dark">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {view === 'login' ? 'Welcome Back' : 'Join marching.art'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
          >
            <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {view === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-on-primary py-3 rounded-theme font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full"></div>
                {view === 'login' ? 'Signing In...' : 'Creating Account...'}
              </div>
            ) : (
              view === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Switch View */}
        <div className="mt-6 text-center border-t border-accent dark:border-accent-dark pt-4">
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {view === 'login' ? "Don't have an account?" : "Already have an account?"}
          </p>
          <button
            onClick={() => setView(view === 'login' ? 'signup' : 'login')}
            className="mt-2 text-primary dark:text-primary-dark hover:text-primary/80 font-semibold"
          >
            {view === 'login' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;