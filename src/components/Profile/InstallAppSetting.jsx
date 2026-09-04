// =============================================================================
// INSTALL APP SETTING — the persistent "Install App" entry in Settings
// =============================================================================
// Always reachable, so dismissing the transient install nudge never becomes a
// dead end. One-tap native install where the browser offers it; otherwise the
// exact steps for this device and browser (from utils/installGuide), with a
// link out to the full /install page for the troubleshooting and the
// "send this to your phone" flow.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallGuideBody } from '../InstallSteps';

/** @param {{ onNavigate?: () => void }} props */
const InstallAppSetting = ({ onNavigate }) => {
  const { isInstalled, canPromptInstall, promptInstall, guide } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const handleInstallApp = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success('Installing marching.art...');
      } else if (outcome === 'unavailable') {
        // The native prompt slipped away — fall back to manual steps.
        setShowInstallHelp(true);
      }
      return;
    }
    // No native prompt (iOS, or the browser hasn't offered one): reveal the
    // steps for this exact device and browser.
    setShowInstallHelp((prev) => !prev);
  };

  if (isInstalled) {
    return (
      <div className="w-full py-3 min-h-[44px] bg-surface-sunken border border-line text-muted text-sm font-bold rounded-none flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        App Installed
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleInstallApp}
        className="w-full py-3 min-h-[44px] bg-interactive/15 border border-interactive/40 text-interactive text-sm font-bold hover:bg-interactive/25 active:bg-interactive/35 transition-all press-feedback rounded-none flex items-center justify-center gap-2"
        aria-expanded={!canPromptInstall ? showInstallHelp : undefined}
      >
        <Download className="w-4 h-4" />
        {canPromptInstall ? 'Install App' : 'How to Install App'}
      </button>
      {!canPromptInstall && showInstallHelp && (
        <div className="bg-surface-sunken border border-line p-3 rounded-none space-y-3">
          <InstallGuideBody guide={guide} compact />
          <Link
            to="/install"
            onClick={onNavigate}
            className="block text-center text-xs font-bold text-interactive hover:underline min-h-[44px] leading-[44px]"
          >
            Open the full install guide →
          </Link>
        </div>
      )}
    </div>
  );
};

export default InstallAppSetting;
