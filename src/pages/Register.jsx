// src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music, Mail, Lock, User, Eye, EyeOff, ArrowLeft, 
  AlertCircle, Check, X, Info
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    acceptTerms: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Password strength checker
  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
    return strength;
  };

  const handlePasswordChange = (value) => {
    setFormData({ ...formData, password: value });
    checkPasswordStrength(value);
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.displayName) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!formData.acceptTerms) {
      setError('You must accept the terms and conditions');
      return false;
    }

    return true;
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
      toast.success('Account created successfully!');
      navigate('/dashboard');
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

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return 'bg-red-500';
      case 2:
        return 'bg-yellow-500';
      case 3:
        return 'bg-blue-500';
      case 4:
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-cream-500/10 rounded-full blur-3xl animate-float" 
             style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to Home */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-cream-300 hover:text-gold-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-dark rounded-2xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-gold rounded-2xl mb-4">
                <Music className="w-8 h-8 text-charcoal-900" />
              </div>
              <h1 className="text-3xl font-display font-bold text-gradient">
                Create Your Account
              </h1>
              <p className="text-cream-500/60 mt-2">
                Join the ultimate fantasy drum corps experience
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Display Name Field */}
              <div>
                <label className="label">Director Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="Your director name"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="director@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cream-500/40 hover:text-cream-300 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            level <= passwordStrength
                              ? getPasswordStrengthColor()
                              : 'bg-charcoal-800'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-cream-500/60">
                      Password Strength: <span className={`font-semibold ${
                        passwordStrength >= 3 ? 'text-green-400' : 'text-yellow-400'
                      }`}>{getPasswordStrengthText()}</span>
                    </p>
                  </div>
                )}

                {/* Password Requirements */}
                <div className="mt-2 p-2 bg-charcoal-900/50 rounded-lg">
                  <p className="text-xs text-cream-500/60 mb-1">Password must contain:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className={`flex items-center gap-1 ${
                      formData.password.length >= 8 ? 'text-green-400' : 'text-cream-500/40'
                    }`}>
                      {formData.password.length >= 8 ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${
                      formData.password.match(/[A-Z]/) ? 'text-green-400' : 'text-cream-500/40'
                    }`}>
                      {formData.password.match(/[A-Z]/) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      Uppercase
                    </div>
                    <div className={`flex items-center gap-1 ${
                      formData.password.match(/[a-z]/) ? 'text-green-400' : 'text-cream-500/40'
                    }`}>
                      {formData.password.match(/[a-z]/) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      Lowercase
                    </div>
                    <div className={`flex items-center gap-1 ${
                      formData.password.match(/[0-9]/) ? 'text-green-400' : 'text-cream-500/40'
                    }`}>
                      {formData.password.match(/[0-9]/) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      Number
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cream-500/40 hover:text-cream-300 transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  className="checkbox mt-1"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                />
                <label htmlFor="terms" className="text-sm text-cream-300 cursor-pointer">
                  I accept the{' '}
                  <Link to="/terms" className="text-gold-500 hover:text-gold-400 transition-colors">
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-gold-500 hover:text-gold-400 transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner mr-2" />
                    Creating Account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gold-300">
                  <p className="font-semibold mb-1">Free to Play!</p>
                  <p className="text-gold-300/80">
                    No credit card required. Start with SoundSport class and unlock more as you play.
                  </p>
                </div>
              </div>
            </div>

            {/* Sign In Link */}
            <p className="text-center mt-6 text-cream-500/60">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-gold-500 hover:text-gold-400 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
