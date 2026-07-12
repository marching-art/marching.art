// =============================================================================
// NEWS SUBMISSION MODAL - ESPN DATA STYLE
// =============================================================================
// Allows directors to submit news articles for admin approval

import React, { useState } from 'react';
import { X, Send, FileText, Sparkles, Image as ImageIcon } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CATEGORIES = [
  { id: 'dci', name: 'DCI News', description: 'Corps announcements, show updates' },
  { id: 'analysis', name: 'Analysis', description: 'Strategy tips, roster advice' },
  { id: 'fantasy', name: 'Fantasy', description: 'Fantasy game updates, predictions' },
];

// Author's image preference, respected on publish (admin approval and
// auto-publish both honor this unless an admin explicitly overrides it).
const IMAGE_OPTIONS = [
  {
    id: 'generate',
    name: 'Generate an image for me',
    description: 'We create a Fantasy Daily-style image on approval',
  },
  { id: 'submitted', name: 'Use my own image', description: 'Provide an image URL' },
  { id: 'none', name: 'No image', description: 'Publish without a header image' },
];

const NewsSubmissionModal = ({ onClose, onSubmit, isSubmitting = false }) => {
  const [formData, setFormData] = useState({
    headline: '',
    summary: '',
    fullStory: '',
    category: 'dci',
    imageOption: 'generate',
    imageUrl: '',
  });
  const [errors, setErrors] = useState({});

  useEscapeKey(onClose);

  const validate = () => {
    const newErrors = {};
    if (!formData.headline.trim()) {
      newErrors.headline = 'Headline is required';
    } else if (formData.headline.length < 10) {
      newErrors.headline = 'Headline must be at least 10 characters';
    }
    if (!formData.summary.trim()) {
      newErrors.summary = 'Summary is required';
    } else if (formData.summary.length < 20) {
      newErrors.summary = 'Summary must be at least 20 characters';
    }
    if (!formData.fullStory.trim()) {
      newErrors.fullStory = 'Full story is required';
    } else if (formData.fullStory.length < 100) {
      newErrors.fullStory = 'Full story must be at least 100 characters';
    }
    if (formData.imageOption === 'submitted') {
      if (!formData.imageUrl.trim()) {
        newErrors.imageUrl = 'Enter an image URL, or choose another image option';
      } else if (!isValidUrl(formData.imageUrl)) {
        newErrors.imageUrl = 'Please enter a valid URL';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        headline: formData.headline.trim(),
        summary: formData.summary.trim(),
        fullStory: formData.fullStory.trim(),
        category: formData.category,
        imageOption: formData.imageOption,
        // Only send a URL when the author chose to supply their own image.
        imageUrl: formData.imageOption === 'submitted' ? formData.imageUrl.trim() || null : null,
      });
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-news-submission"
      >
        <div
          className="w-full max-w-2xl bg-surface-card border border-line rounded-none max-h-[90dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-interactive" />
              <h2
                id="modal-title-news-submission"
                className="text-xs font-bold uppercase tracking-wider text-secondary"
              >
                Submit News Article
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-white transition-colors"
              disabled={isSubmitting}
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Info Banner */}
              <div className="bg-interactive/10 border border-interactive/30 rounded-none px-3 py-2">
                <p className="text-xs text-secondary">
                  Your article will be reviewed by admins before publishing. Quality submissions
                  help our community!
                </p>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleChange('category', cat.id)}
                      className={`
                        px-3 py-2 text-left rounded-none border transition-all
                        ${
                          formData.category === cat.id
                            ? 'bg-interactive/20 border-interactive text-white'
                            : 'bg-background border-line text-muted hover:border-line-strong'
                        }
                      `}
                    >
                      <div className="text-xs font-bold">{cat.name}</div>
                      <div className="text-[10px] text-muted mt-0.5 hidden sm:block">
                        {cat.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Headline */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Headline *
                </label>
                <input
                  type="text"
                  placeholder="Write a compelling headline..."
                  value={formData.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  maxLength={120}
                  className={`
                    w-full h-10 px-3 bg-background border rounded-none text-sm text-white
                    placeholder-muted focus:outline-none transition-colors
                    ${errors.headline ? 'border-red-500 focus:border-red-500' : 'border-line focus:border-interactive'}
                  `}
                />
                <div className="flex justify-between mt-1">
                  {errors.headline ? (
                    <p className="text-[10px] text-red-500">{errors.headline}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[10px] text-muted">{formData.headline.length}/120</p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Summary *
                </label>
                <textarea
                  placeholder="Brief summary that appears in the news feed..."
                  value={formData.summary}
                  onChange={(e) => handleChange('summary', e.target.value)}
                  maxLength={300}
                  rows={2}
                  className={`
                    w-full px-3 py-2 bg-background border rounded-none text-sm text-white
                    placeholder-muted focus:outline-none resize-none transition-colors
                    ${errors.summary ? 'border-red-500 focus:border-red-500' : 'border-line focus:border-interactive'}
                  `}
                />
                <div className="flex justify-between mt-1">
                  {errors.summary ? (
                    <p className="text-[10px] text-red-500">{errors.summary}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[10px] text-muted">{formData.summary.length}/300</p>
                </div>
              </div>

              {/* Full Story */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Full Story *
                </label>
                <textarea
                  placeholder="Write your full article here. Include relevant details, quotes, and context..."
                  value={formData.fullStory}
                  onChange={(e) => handleChange('fullStory', e.target.value)}
                  maxLength={5000}
                  rows={6}
                  className={`
                    w-full px-3 py-2 bg-background border rounded-none text-sm text-white
                    placeholder-muted focus:outline-none resize-none transition-colors
                    ${errors.fullStory ? 'border-red-500 focus:border-red-500' : 'border-line focus:border-interactive'}
                  `}
                />
                <div className="flex justify-between mt-1">
                  {errors.fullStory ? (
                    <p className="text-[10px] text-red-500">{errors.fullStory}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[10px] text-muted">{formData.fullStory.length}/5000</p>
                </div>
              </div>

              {/* Article Image */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  Article Image
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChange('imageOption', opt.id)}
                      className={`
                        px-3 py-2 text-left rounded-none border transition-all
                        ${
                          formData.imageOption === opt.id
                            ? 'bg-interactive/20 border-interactive text-white'
                            : 'bg-background border-line text-muted hover:border-line-strong'
                        }
                      `}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {opt.id === 'generate' && (
                          <Sparkles className="w-3.5 h-3.5 text-secondary" />
                        )}
                        {opt.id === 'submitted' && (
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        {opt.id === 'none' && <X className="w-3.5 h-3.5 text-muted" />}
                        {opt.name}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5 hidden sm:block">
                        {opt.description}
                      </div>
                    </button>
                  ))}
                </div>

                {/* URL input — only when the author supplies their own image */}
                {formData.imageOption === 'submitted' && (
                  <div className="mt-2">
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => handleChange('imageUrl', e.target.value)}
                      className={`
                        w-full h-10 px-3 bg-background border rounded-none text-sm text-white
                        placeholder-muted focus:outline-none transition-colors
                        ${errors.imageUrl ? 'border-red-500 focus:border-red-500' : 'border-line focus:border-interactive'}
                      `}
                    />
                    {errors.imageUrl && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.imageUrl}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-line bg-surface-sunken flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit for Review
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default NewsSubmissionModal;
