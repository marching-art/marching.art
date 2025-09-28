import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from 'firebaseConfig';

const SignUpForm = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // The modal will be closed by the parent component upon successful signup
    } catch (err) {
      setError('Failed to create an account. The email may already be in use.');
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-text-primary-dark">Sign Up</h2>
      {error && <p className="bg-red-500 text-white text-center p-2 rounded-theme">{error}</p>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm Password"
        required
        className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
      />
      <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors">
        Sign Up
      </button>
      <p className="text-center text-sm">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchMode} className="text-primary-dark hover:underline">
          Log In
        </button>
      </p>
    </form>
  );
};

export default SignUpForm;