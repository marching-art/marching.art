import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const SignUpForm = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
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
        setError('Password is too weak. Please use a stronger password.');
      } else if (err.message === 'Profile creation timeout') {
        setError('Account created but profile setup is taking longer than expected. Please refresh the page.');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-text-primary-dark">Sign Up</h2>
      
      {error && (
        <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 text-center p-3 rounded-theme">
          {error}
        </div>
      )}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        disabled={isCreatingAccount}
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      />
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 6 characters)"
        required
        disabled={isCreatingAccount}
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      />
      
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm Password"
        required
        disabled={isCreatingAccount}
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      />
      
      <button 
        type="submit" 
        disabled={isCreatingAccount}
        className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isCreatingAccount ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Your Account...
          </>
        ) : (
          'Sign Up'
        )}
      </button>
      
      {isCreatingAccount && (
        <p className="text-center text-sm text-text-secondary-dark">
          Setting up your profile... This may take a few seconds.
        </p>
      )}
      
      <p className="text-center text-sm">
        Already have an account?{' '}
        <button 
          type="button" 
          onClick={onSwitchMode} 
          disabled={isCreatingAccount}
          className="text-primary-dark hover:underline disabled:opacity-50"
        >
          Log In
        </button>
      </p>
    </form>
  );
};

export default SignUpForm;