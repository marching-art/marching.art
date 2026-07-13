// src/components/PWAInstallPrompt.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePWAInstall } from '../hooks/usePWAInstall';
import PWAInstallInstructions from './PWAInstallInstructions';
import { Heading } from './ui';

/**
 * PWA Install Prompt Component
 *
 * A transient, engagement-gated nudge to install the app. Install state is
 * sourced from the shared usePWAInstall hook so that dismissing this prompt does
 * NOT throw away the ability to install — the persistent "Install App" entry in
 * Settings continues to work for the rest of the session.
 */
const PWAInstallPrompt = () => {
  const { platform, isInstalled, canPromptInstall, needsManualInstall, promptInstall } =
    usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);

  // Decide whether to surface the transient nudge. Respects a 7-day dismissal
  // window and waits for engagement (a delay) before appearing.
  useEffect(() => {
    if (isInstalled) return;

    // Only nudge when there's actually something to offer: a native prompt, or
    // manual steps for a platform that supports installation.
    if (!canPromptInstall && !needsManualInstall) return;

    // Don't re-nudge if dismissed within the last 7 days.
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedDate = dismissed ? parseInt(dismissed, 10) : 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (dismissedDate > sevenDaysAgo) return;

    // iOS/manual platforms have no native prompt event to wait on — show after a
    // longer engagement delay. Native-prompt platforms appear a bit sooner.
    const delay = canPromptInstall ? 8000 : 20000;
    const timer = setTimeout(() => setShowPrompt(true), delay);
    return () => clearTimeout(timer);
  }, [isInstalled, canPromptInstall, needsManualInstall]);

  // Hide the nudge the moment the app becomes installed.
  useEffect(() => {
    if (isInstalled) setShowPrompt(false);
  }, [isInstalled]);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast.success('Installing marching.art...');
    }
    setShowPrompt(false);
  }, [promptInstall]);

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
        };
      case 'ipados':
        return {
          icon: Smartphone,
          title: 'Add to Home Screen',
          description: 'Get the full app experience on your iPad',
        };
      case 'android':
        return {
          icon: Smartphone,
          title: 'Install App',
          description: 'Add marching.art to your home screen for quick access and offline support',
        };
      case 'windows':
      case 'macos':
        return {
          icon: Monitor,
          title: 'Install Desktop App',
          description:
            'Install marching.art as a desktop app for faster access and better performance',
        };
      default:
        return {
          icon: Download,
          title: 'Install App',
          description: 'Install marching.art for offline access and better performance',
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
      <m.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-surface-card border border-line rounded-none p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-none hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-interactive rounded-none flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-charcoal-900" />
            </div>

            <div className="flex-1 min-w-0">
              <Heading level="title" as="h3" className="mb-1 pr-6">
                {content.title}
              </Heading>
              <p className="text-sm text-muted mb-4">{content.description}</p>

              {/* Native prompt available: one-tap install. Otherwise show the
                  manual, platform-specific steps. */}
              {canPromptInstall ? (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleInstall}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 text-muted hover:text-white hover:bg-white/5 rounded-none transition-colors"
                  >
                    Later
                  </button>
                </div>
              ) : (
                <>
                  <PWAInstallInstructions platform={platform} />
                  <button
                    onClick={handleDismiss}
                    className="mt-4 w-full px-4 py-2 text-sm text-muted hover:text-white hover:bg-white/5 rounded-none transition-colors"
                  >
                    Got it
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
