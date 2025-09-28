import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from 'firebaseConfig';

const LoginForm = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // The modal will be closed by the parent component upon successful login
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-text-primary-dark">Login</h2>
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
      <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors">
        Log In
      </button>
      <p className="text-center text-sm">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchMode} className="text-primary-dark hover:underline">
          Sign Up
        </button>
      </p>
    </form>
  );
};

export default LoginForm;