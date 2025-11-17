// src/components/PWAInstallPrompt.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * PWA Install Prompt Component
 * Shows a native-like prompt to install the app on mobile/desktop
 * Follows modern UX best practices for PWA installation
 */
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedDate = dismissed ? parseInt(dismissed) : 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Don't show if dismissed within last 7 days
    if (dismissedDate > sevenDaysAgo) {
      return;
    }

    // For iOS, show after 30 seconds of use
    if (iOS) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
      return () => clearTimeout(timer);
    }

    // For other browsers, listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show prompt after 10 seconds
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success('Thanks for installing marching.art! 🎺');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="card-premium p-6 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-cream-500/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5 text-cream-400" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-7 h-7 text-charcoal-900" />
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-display font-bold text-cream-100 mb-1">
                Install marching.art
              </h3>
              <p className="text-sm text-cream-400 mb-4">
                {isIOS
                  ? 'Tap the share button and select "Add to Home Screen"'
                  : 'Install our app for a better experience, offline access, and faster loading!'
                }
              </p>

              {!isIOS && (
                <div className="flex gap-2">
                  <button
                    onClick={handleInstall}
                    className="btn-primary text-sm py-2 flex-1"
                  >
                    <Download className="w-4 h-4" />
                    Install Now
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="btn-ghost text-sm py-2"
                  >
                    Not Now
                  </button>
                </div>
              )}

              {isIOS && (
                <div className="flex items-center gap-2 text-xs text-cream-500/60 mt-2">
                  <span>Tap</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"/>
                  </svg>
                  <span>then "Add to Home Screen"</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
