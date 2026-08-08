// =============================================================================
// CUSTOM AVATAR MODAL
// =============================================================================
// Lets a director point their corps logo/uniform icon at an image URL instead
// of the AI-generated art. The URL is sent to the setCorpsAvatarFromUrl
// callable, which fetches, size-checks, crops to a square, and re-hosts it.
//
// NOTE: there is deliberately no in-app preview of the raw URL. The app CSP
// (img-src) only allows a few image hosts, so a <img src={arbitraryUrl}> would
// be blocked and always render broken — misleading. The re-hosted result shows
// on the profile immediately after a successful save.

import React, { useState } from 'react';
import { m } from 'framer-motion';
import { X, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import type { CorpsClass } from '../../types';
import { getClassDisplay } from './directorProfileHelpers';

export interface CustomAvatarCorpsOption {
  corpsClass: CorpsClass;
  corpsName: string;
}

interface CustomAvatarModalProps {
  corpsOptions: CustomAvatarCorpsOption[];
  initialCorpsClass?: CorpsClass | null;
  onClose: () => void;
  onSubmit: (corpsClass: CorpsClass, imageUrl: string) => Promise<void>;
}

const CustomAvatarModal: React.FC<CustomAvatarModalProps> = ({
  corpsOptions,
  initialCorpsClass,
  onClose,
  onSubmit,
}) => {
  const firstClass = corpsOptions[0]?.corpsClass;
  const [corpsClass, setCorpsClass] = useState<CorpsClass | undefined>(
    (initialCorpsClass && corpsOptions.some((c) => c.corpsClass === initialCorpsClass)
      ? initialCorpsClass
      : firstClass) || undefined
  );
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = url.trim();
  const looksValid = /^https?:\/\/\S+$/i.test(trimmed);

  const handleSave = async () => {
    if (!corpsClass) return;
    if (!looksValid) {
      setError('Enter a direct image link starting with http:// or https://');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(corpsClass, trimmed);
      onClose();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to set custom avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <m.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-surface-card border border-line w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <LinkIcon className="w-3.5 h-3.5" />
            Use an Image Link
          </span>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {corpsOptions.length > 1 && (
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
                Corps
              </label>
              <select
                value={corpsClass}
                onChange={(e) => setCorpsClass(e.target.value as CorpsClass)}
                className="w-full px-3 py-2 bg-surface-sunken border border-line text-sm text-white focus:outline-none focus:border-interactive"
              >
                {corpsOptions.map((c) => (
                  <option key={c.corpsClass} value={c.corpsClass}>
                    {c.corpsName} · {getClassDisplay(c.corpsClass).short}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">
              Image URL
            </label>
            <input
              type="url"
              inputMode="url"
              placeholder="https://example.com/logo.png"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3 py-2 bg-surface-sunken border border-line text-sm text-white focus:outline-none focus:border-interactive"
            />
          </div>

          <p className="text-[10px] text-muted leading-relaxed">
            Direct link to a PNG, JPG, WEBP, or GIF up to 5&nbsp;MB. The image is copied to our
            servers and cropped to a square — a square logo works best. This replaces the
            AI-generated art for the selected corps.
          </p>

          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 border border-line text-secondary text-xs font-bold uppercase tracking-wider hover:border-line-strong disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !corpsClass || !trimmed}
              className="flex-1 py-2 bg-interactive text-white text-xs font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
};

export default CustomAvatarModal;
