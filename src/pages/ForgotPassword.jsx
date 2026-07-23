// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/pages/ForgotPassword.jsx
// =============================================================================
// FORGOT PASSWORD PAGE - MOBILE-FIRST DESIGN
// =============================================================================
// Touch-optimized form for password reset requests

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi } from '../api/client';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { Heading } from '../components/ui';

const ForgotPassword = () => {
  useBodyScroll();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.sendPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);

      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many requests. Please try again later');
          break;
        default:
          setError('Failed to send reset email. Please try again');
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
          to="/login"
          className="flex items-center gap-2 text-muted hover:text-white active:text-white transition-colors press-feedback min-h-touch px-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Login</span>
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
                <Heading level="display">Reset Password</Heading>
                <p className="text-base text-muted mt-2">
                  Enter your email address and we'll send you a link to reset your password
                </p>
              </div>

              {/* Success Message */}
              {success ? (
                <m.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-none">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <p className="text-base text-green-300 font-medium">Check your email</p>
                        <p className="text-sm text-green-300/70 mt-1">
                          We've sent a password reset link to <strong>{email}</strong>. Click the
                          link in the email to reset your password.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted mb-6">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setSuccess(false);
                        setEmail('');
                      }}
                      className="w-full h-12 bg-surface-card text-white font-medium text-base border border-line flex items-center justify-center hover:bg-surface-raised active:bg-surface-raised transition-all duration-150 press-feedback rounded-none"
                    >
                      Try another email
                    </button>
                    <Link
                      to="/login"
                      className="w-full h-12 bg-interactive text-white font-bold text-base uppercase tracking-wider flex items-center justify-center hover:bg-interactive-hover active:bg-interactive-subtle transition-all duration-150 press-feedback-strong rounded-none"
                    >
                      Back to Login
                    </Link>
                  </div>
                </m.div>
              ) : (
                <>
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

                  {/* Reset Form */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Field */}
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                        <input
                          type="email"
                          className="w-full h-12 pl-11 pr-4 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50"
                          placeholder="director@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
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
                          Sending...
                        </span>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </form>

                  {/* Back to Login Link */}
                  <p className="text-center mt-8 text-base text-muted">
                    Remember your password?{' '}
                    <Link
                      to="/login"
                      className="text-interactive hover:text-interactive-hover font-semibold transition-colors"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </m.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
