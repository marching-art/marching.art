// src/pages/Register.jsx
// =============================================================================
// REGISTER PAGE - MOBILE-FIRST DESIGN
// =============================================================================
// Touch-optimized registration form with proper input sizing

import React, { useState, startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useFirstVisit } from '../hooks/useFirstVisit';

const Register = () => {
  useBodyScroll();
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useAuth();
  const { markAsReturning } = useFirstVisit();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    acceptTerms: false
  });
  const [googleLoading, setGoogleLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.displayName) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (!formData.acceptTerms) {
      setError('You must accept the terms and conditions');
      return false;
    }

    return true;
  };

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      markAsReturning();
      toast.success('Welcome to marching.art!');
      startTransition(() => {
        navigate('/onboarding');
      });
    } catch (err) {
      console.error('Google sign-in error:', err);

      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show error
        return;
      }

      switch (err.code) {
        case 'auth/account-exists-with-different-credential':
          setError('An account already exists with this email using a different sign-in method');
          break;
        case 'auth/popup-blocked':
          setError('Popup was blocked. Please allow popups for this site');
          break;
        default:
          setError('Failed to sign in with Google. Please try again');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await signUp(formData.email, formData.password);
      markAsReturning();
      toast.success('Account created successfully!');
      startTransition(() => {
        navigate('/onboarding');
      });
    } catch (err) {
      console.error('Registration error:', err);

      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('An account already exists with this email address');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Please use a stronger password');
          break;
        default:
          setError('Failed to create account. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const passwordStrength = formData.password.length >= 8 ? 'strong' : formData.password.length >= 4 ? 'medium' : 'weak';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white active:text-white transition-colors press-feedback min-h-touch px-2 -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </Link>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto scroll-momentum">
        <div className="min-h-full flex flex-col justify-center px-4 py-6">
          <div className="w-full max-w-md mx-auto">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Logo & Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl overflow-hidden mb-4 bg-[#1a1a1a] border border-[#333] aspect-avatar">
                  <img
                    src="/logo192.svg"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
                <h1 className="text-2xl font-bold text-white">Start Playing Free</h1>
                <p className="text-base text-gray-500 mt-2">
                  Build your dream corps in under 2 minutes
                </p>
              </div>

              {/* Google Sign-In - Fastest option first */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full h-14 bg-white text-gray-900 font-bold text-base flex items-center justify-center gap-3 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-sm mb-4"
              >
                {googleLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-[#333]" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#333]" />
              </div>

              {/* Error Alert */}
              {error && (
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-base text-red-300">{error}</p>
                  </div>
                </m.div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Display Name Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Director Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      className="w-full h-12 pl-11 pr-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                      placeholder="Your director name"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      required
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      className="w-full h-12 pl-11 pr-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                      placeholder="director@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full h-12 pl-11 pr-12 bg-[#0a0a0a] border border-[#333] rounded-sm text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-gray-500 hover:text-white active:text-white transition-colors min-w-touch min-h-touch flex items-center justify-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Password Strength */}
                  {formData.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#333] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength === 'strong' ? 'w-full bg-green-500' :
                            passwordStrength === 'medium' ? 'w-1/2 bg-yellow-500' : 'w-1/4 bg-red-500'
                          }`}
                        />
                      </div>
                      <span className={`text-xs ${
                        passwordStrength === 'strong' ? 'text-green-500' :
                        passwordStrength === 'medium' ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {passwordStrength === 'strong' ? 'Strong' :
                         passwordStrength === 'medium' ? 'Medium' : 'Weak'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Terms and Conditions */}
                <div className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    id="terms"
                    className="w-5 h-5 mt-0.5 rounded border-[#333] bg-[#0a0a0a] text-[#0057B8] focus:ring-[#0057B8] focus:ring-offset-0 flex-shrink-0"
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                  />
                  <label htmlFor="terms" className="text-base text-gray-400 cursor-pointer leading-relaxed">
                    I accept the{' '}
                    <Link to="/terms" className="text-[#0057B8] hover:underline">
                      Terms and Conditions
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-[#0057B8] hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full h-14 bg-[#0057B8] text-white font-bold text-base uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] active:bg-[#004a9e] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-sm mt-6"
                  disabled={loading || googleLoading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Account...
                    </span>
                  ) : (
                    'Start Playing — Free'
                  )}
                </button>
              </form>

              {/* Sign In Link */}
              <p className="text-center mt-6 text-base text-gray-500">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-[#0057B8] hover:text-[#0066d6] font-semibold transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </m.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
