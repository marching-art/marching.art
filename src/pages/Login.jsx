// src/pages/Login.jsx
// =============================================================================
// LOGIN PAGE - MOBILE-FIRST DESIGN
// =============================================================================
// Touch-optimized form with proper input sizing and press feedback

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useSEO } from '../hooks/useSEO';

const Login = () => {
  useBodyScroll();
  useSEO({
    title: 'Sign In | marching.art — Fantasy Drum Corps',
    description:
      'Sign in to marching.art to manage your fantasy drum corps lineup, check scores, and climb the leaderboards.',
    path: '/login',
  });
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      console.error('Login error:', err);

      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later');
          break;
        default:
          setError('Failed to sign in. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-surface-card border-b border-line flex items-center px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted hover:text-white active:text-white transition-colors press-feedback min-h-touch px-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </Link>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto scroll-momentum">
        <div className="min-h-full flex flex-col justify-center px-4 py-8">
          <div className="w-full max-w-md mx-auto">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Logo & Title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-none overflow-hidden mb-4 bg-surface-card border border-line aspect-avatar">
                  <img
                    src="/logo192.svg"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
                <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
                <p className="text-base text-muted mt-2">Your corps is waiting.</p>
              </div>

              {/* Error Alert */}
              {error && (
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-none"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-base text-red-300">{error}</p>
                  </div>
                </m.div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      id="login-email"
                      type="email"
                      className="w-full h-12 pl-11 pr-4 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50"
                      placeholder="director@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="w-full h-12 pl-11 pr-12 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-muted hover:text-white active:text-white transition-colors min-w-touch min-h-touch flex items-center justify-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer min-h-touch">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-none border-line bg-background text-interactive focus:ring-interactive focus:ring-offset-0"
                    />
                    <span className="text-base text-muted">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-base text-interactive hover:text-interactive-hover active:text-interactive-subtle transition-colors min-h-touch flex items-center px-2 -mr-2"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full h-14 bg-interactive text-white font-bold text-base uppercase tracking-wider flex items-center justify-center hover:bg-interactive-hover active:bg-interactive-subtle transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Sign Up Link */}
              <p className="text-center mt-8 text-base text-muted">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-interactive hover:text-interactive-hover font-semibold transition-colors"
                >
                  Sign up free
                </Link>
              </p>
            </m.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
