// src/components/PWAInstallPrompt.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Monitor, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * PWA Install Prompt Component
 * Shows a platform-specific prompt to install the app on mobile/desktop
 * Supports iOS, Android, Windows, macOS, and other platforms
 */
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState('other');
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect platform
  useEffect(() => {
    const detectPlatform = () => {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isIPhone = /iPhone/.test(ua);
      const isAndroid = /android/i.test(ua);
      const isMac = /Macintosh|MacIntel/.test(ua) && !isIPad;
      const isWindows = /Win/.test(ua);

      if (isIPhone) return 'ios';
      if (isIPad) return 'ipados';
      if (isAndroid) return 'android';
      if (isMac) return 'macos';
      if (isWindows) return 'windows';
      return 'other';
    };

    setPlatform(detectPlatform());
  }, []);

  // Check if already installed
  useEffect(() => {
    // Check display-mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;

    // iOS-specific check
    const isIOSInstalled = window.navigator.standalone === true;

    if (isStandalone || isFullscreen || isMinimalUI || isIOSInstalled) {
      setIsInstalled(true);
      return;
    }

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Check dismissal and set up install prompt
  useEffect(() => {
    if (isInstalled) return;

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedDate = dismissed ? parseInt(dismissed) : 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Don't show if dismissed within last 7 days
    if (dismissedDate > sevenDaysAgo) return;

    // For iOS/iPadOS, show after delay
    if (platform === 'ios' || platform === 'ipados') {
      const timer = setTimeout(() => setShowPrompt(true), 20000);
      return () => clearTimeout(timer);
    }

    // For browsers that support beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 8000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platform, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('Installing marching.art...');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  // Get platform-specific content
  const getPlatformContent = () => {
    switch (platform) {
      case 'ios':
        return {
          icon: Smartphone,
          title: 'Add to Home Screen',
          description: 'Install marching.art for the best experience',
          instructions: (
            <div className="flex flex-col gap-2 text-sm text-cream-400">
              <div className="flex items-center gap-2">
                <span className="text-cream-500">1.</span>
                <span>Tap the</span>
                <Share2 className="w-4 h-4 text-yellow-400" />
                <span>Share button below</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cream-500">2.</span>
                <span>Scroll down and tap</span>
                <span className="text-yellow-400 font-medium">"Add to Home Screen"</span>
              </div>
            </div>
          ),
          showInstallButton: false
        };
      case 'ipados':
        return {
          icon: Smartphone,
          title: 'Add to Home Screen',
          description: 'Get the full app experience on your iPad',
          instructions: (
            <div className="flex flex-col gap-2 text-sm text-cream-400">
              <div className="flex items-center gap-2">
                <span className="text-cream-500">1.</span>
                <span>Tap the</span>
                <Share2 className="w-4 h-4 text-yellow-400" />
                <span>Share button in Safari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cream-500">2.</span>
                <span>Tap</span>
                <span className="text-yellow-400 font-medium">"Add to Home Screen"</span>
              </div>
            </div>
          ),
          showInstallButton: false
        };
      case 'android':
        return {
          icon: Smartphone,
          title: 'Install App',
          description: 'Add marching.art to your home screen for quick access and offline support',
          instructions: null,
          showInstallButton: true
        };
      case 'windows':
      case 'macos':
        return {
          icon: Monitor,
          title: 'Install Desktop App',
          description: 'Install marching.art as a desktop app for faster access and better performance',
          instructions: null,
          showInstallButton: true
        };
      default:
        return {
          icon: Download,
          title: 'Install App',
          description: 'Install marching.art for offline access and better performance',
          instructions: null,
          showInstallButton: !!deferredPrompt
        };
    }
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  const content = getPlatformContent();
  const Icon = content.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-cream-400" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[#0057B8] rounded-sm flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-slate-900" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-display font-bold text-cream-100 mb-1 pr-6">
                {content.title}
              </h3>
              <p className="text-sm text-cream-400 mb-4">
                {content.description}
              </p>

              {content.instructions}

              {content.showInstallButton && deferredPrompt && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleInstall}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0057B8] text-white font-bold text-sm rounded-sm hover:bg-[#0066d6] transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors"
                  >
                    Later
                  </button>
                </div>
              )}

              {!content.showInstallButton && (
                <button
                  onClick={handleDismiss}
                  className="mt-4 w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors"
                >
                  Got it
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
