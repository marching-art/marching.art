import React from 'react';
import { X, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import YouTubeIcon from '../YouTubeIcon';

const YouTubeModal = ({
  videoModal,
  onClose,
  onRetry
}) => {
  if (!videoModal.show) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
      />

      {/* Modal Content - 720p aspect ratio (1280x720) */}
      <div
        className="relative w-full max-w-4xl bg-[#0A0A0A] border border-[#333] rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <YouTubeIcon size={20} className="flex-shrink-0" />
            <h2 className="text-sm font-bold text-white truncate">
              {videoModal.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Container - 16:9 aspect ratio for 720p */}
        <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
          {videoModal.loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
              <p className="text-gray-400 text-sm">Searching YouTube...</p>
            </div>
          ) : videoModal.error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <YouTubeIcon size={64} className="mb-4 opacity-40" />
              <p className="text-gray-400 text-sm mb-4">{videoModal.error}</p>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
              >
                <YouTubeIcon size={16} />
                Search on YouTube
              </a>
            </div>
          ) : videoModal.videoId ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${videoModal.videoId}?autoplay=1&vq=hd720&rel=0`}
              title={videoModal.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : null}
        </div>

        {/* Footer with YouTube link */}
        <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex items-center justify-between">
          <p className="text-[10px] text-gray-500 truncate flex-1 mr-2">
            Search: "{videoModal.searchQuery}"
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onRetry}
              disabled={videoModal.loading}
              className="text-[10px] text-gray-400 hover:text-white font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
              title="Search again (skip cache)"
            >
              <RefreshCw className={`w-3 h-3 ${videoModal.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoModal.searchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              More Results
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubeModal;
