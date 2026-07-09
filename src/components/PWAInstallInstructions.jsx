// src/components/PWAInstallInstructions.jsx
// Platform-specific, manual "add to home screen / install" steps, shown when no
// native install prompt is available (iOS Safari, or a desktop/Android browser
// where `beforeinstallprompt` isn't currently offered). Shared by the transient
// PWA prompt and the persistent Install entry in Settings.
import React from 'react';
import { Share2, MoreVertical, Plus } from 'lucide-react';

const Step = ({ n, children }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-gray-500">{n}.</span>
    {children}
  </div>
);

const PWAInstallInstructions = ({ platform }) => {
  switch (platform) {
    case 'ios':
    case 'ipados':
      return (
        <div className="flex flex-col gap-2 text-sm text-gray-400">
          <Step n={1}>
            <span>Tap the</span>
            <Share2 className="w-4 h-4 text-yellow-400" />
            <span>Share button in Safari</span>
          </Step>
          <Step n={2}>
            <span>Scroll down and tap</span>
            <span className="text-yellow-400 font-medium">"Add to Home Screen"</span>
          </Step>
        </div>
      );
    case 'android':
      return (
        <div className="flex flex-col gap-2 text-sm text-gray-400">
          <Step n={1}>
            <span>Open the browser menu</span>
            <MoreVertical className="w-4 h-4 text-yellow-400" />
          </Step>
          <Step n={2}>
            <span>Tap</span>
            <span className="text-yellow-400 font-medium">"Install app"</span>
            <span>or</span>
            <span className="text-yellow-400 font-medium">"Add to Home screen"</span>
          </Step>
        </div>
      );
    default:
      // Desktop (Windows/macOS/other): Chrome/Edge show an install icon in the
      // address bar, or the option lives in the browser menu.
      return (
        <div className="flex flex-col gap-2 text-sm text-gray-400">
          <Step n={1}>
            <span>Click the install icon</span>
            <Plus className="w-4 h-4 text-yellow-400" />
            <span>in the address bar</span>
          </Step>
          <Step n={2}>
            <span>or open the browser menu and choose</span>
            <span className="text-yellow-400 font-medium">"Install marching.art"</span>
          </Step>
        </div>
      );
  }
};

export default PWAInstallInstructions;
