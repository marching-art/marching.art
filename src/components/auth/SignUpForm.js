import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { Mail, Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const SignUpForm = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (password !== confirmPassword) {
      return setError('Passwords do not match. Please try again.');
    }
    
    if (password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    
    setError('');
    setIsCreatingAccount(true);
    
    try {
      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      // Wait for the backend to create the user profile (with timeout)
      await waitForProfileCreation(newUser.uid);
      
      // Profile is ready, modal will close automatically via AuthModal's useEffect
    } catch (err) {
      console.error('Signup error:', err);
      setIsCreatingAccount(false);
      
      // Handle specific Firebase auth errors
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password with letters and numbers.');
      } else if (err.message === 'Profile creation timeout') {
        setError('Account created but setup is taking longer than expected. Please refresh the page in a moment.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    }
  };

  // Helper function to wait for profile creation with timeout
  const waitForProfileCreation = (uid) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Profile creation timeout'));
      }, 10000); // 10 second timeout

      const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
      
      const unsubscribe = onSnapshot(
        profileRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve();
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          unsubscribe();
          reject(error);
        }
      );
    });
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: 'Too Short', color: 'bg-red-500', width: '33%' };
    if (password.length < 10) return { label: 'Fair', color: 'bg-yellow-500', width: '66%' };
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary-dark mb-2">Create Your Account</h2>
        <p className="text-text-secondary-dark text-sm">Start your drum corps journey today</p>
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 p-3 rounded-theme flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Email Input */}
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-text-primary-dark mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary-dark" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isCreatingAccount}
              className="w-full pl-11 pr-4 py-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-text-primary-dark placeholder-text-secondary-dark"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-text-primary-dark mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary-dark" />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              disabled={isCreatingAccount}
              className="w-full pl-11 pr-11 py-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-text-primary-dark placeholder-text-secondary-dark"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary-dark hover:text-text-primary-dark transition-colors"
              disabled={isCreatingAccount}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {passwordStrength && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-text-secondary-dark">Password Strength:</span>
                <span className={`text-xs font-semibold ${
                  passwordStrength.label === 'Too Short' ? 'text-red-400' :
                  passwordStrength.label === 'Fair' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="w-full bg-background-dark rounded-full h-2">
                <div 
                  className={`${passwordStrength.color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: passwordStrength.width }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-text-primary-dark mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary-dark" />
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={isCreatingAccount}
              className="w-full pl-11 pr-11 py-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-text-primary-dark placeholder-text-secondary-dark"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary-dark hover:text-text-primary-dark transition-colors"
              disabled={isCreatingAccount}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Passwords do not match
            </p>
          )}
          {confirmPassword && password === confirmPassword && password.length >= 6 && (
            <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Passwords match
            </p>
          )}
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isCreatingAccount || (password !== confirmPassword && confirmPassword !== '')}
        className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-theme hover:shadow-glow"
      >
        {isCreatingAccount ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Your Account...
          </>
        ) : (
          'Create Account'
        )}
      </button>

      {isCreatingAccount && (
        <div className="bg-primary bg-opacity-10 border border-primary-dark p-3 rounded-theme">
          <p className="text-center text-sm text-text-primary-dark flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up your profile... This may take a few seconds.
          </p>
        </div>
      )}

      <div className="text-center mt-6">
        <p className="text-text-secondary-dark text-sm">
          Already have an account?{' '}
          <button 
            type="button" 
            onClick={onSwitchMode} 
            disabled={isCreatingAccount}
            className="text-primary-dark hover:text-primary font-semibold hover:underline disabled:opacity-50 transition-colors"
          >
            Log In
          </button>
        </p>
      </div>
    </form>
  );
};

export default SignUpForm;