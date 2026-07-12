// News feed inline badges (trend, fantasy value, urgency, ROI, share).
// Extracted from NewsFeed.jsx.

import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  DollarSign,
  Share2,
} from 'lucide-react';
import toast from 'react-hot-toast';

function TrendingBadge({ direction, className = 'w-3 h-3' }) {
  if (direction === 'up') {
    return <TrendingUp className={`${className} text-green-500`} />;
  }
  if (direction === 'down') {
    return <TrendingDown className={`${className} text-red-500`} />;
  }
  return <Minus className={`${className} text-muted`} />;
}

function FantasyValueBadge({ value }) {
  const config = {
    buy: {
      label: 'BUY',
      bgClass: 'bg-green-500/20',
      textClass: 'text-green-400',
      icon: ArrowUpRight,
    },
    sell: {
      label: 'SELL',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400',
      icon: ArrowDownRight,
    },
    hold: { label: 'HOLD', bgClass: 'bg-warning/20', textClass: 'text-warning', icon: Minus },
  };
  const { label, bgClass, textClass, icon: Icon } = config[value] || config.hold;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold ${bgClass} ${textClass}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function UrgencyBadge({ urgency }) {
  if (!urgency) return null;

  const isBreaking = urgency.type === 'breaking';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
        isBreaking
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-warning/20 text-warning border border-warning/30'
      }`}
    >
      {isBreaking && <Radio className="w-2.5 h-2.5" />}
      {urgency.label}
    </span>
  );
}

function FantasyROIBadge({ metrics }) {
  if (!metrics?.topROI) return null;

  const { corps, caption, pointsGained, roiPercent } = metrics.topROI;
  const isPositive = roiPercent >= 0;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20">
      <DollarSign className="w-4 h-4 text-green-400" />
      <div className="flex flex-col">
        <span className="text-[10px] text-green-400/80 uppercase tracking-wider font-medium">
          Top ROI
        </span>
        <span className="text-xs text-white font-bold">
          {corps} {caption}:{' '}
          <span
            className={`font-data tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}
          >
            {isPositive ? '+' : ''}
            {pointsGained.toFixed(1)} pts ({roiPercent.toFixed(1)}%)
          </span>
        </span>
      </div>
    </div>
  );
}

function ShareButton({ story, className = '' }) {
  const handleShare = async (e) => {
    e.stopPropagation(); // Prevent card click navigation

    const shareUrl = `${window.location.origin}/article/${story.id}`;

    // Helper function to copy to clipboard
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error('Failed to copy link');
      }
    };

    // Check if we're on a mobile device - Web Share API is only reliable on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (navigator.share && isMobile) {
      try {
        await navigator.share({
          title: story.headline,
          text: story.headline,
          url: shareUrl,
        });
      } catch (err) {
        // If user cancelled (AbortError), do nothing
        // For other errors (blocked by enterprise, etc.), fall back to clipboard
        if (err.name !== 'AbortError') {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`p-2 text-muted hover:text-white hover:bg-white/10 transition-colors rounded-none ${className}`}
      title="Share article"
      aria-label="Share article"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
}

export { TrendingBadge, FantasyValueBadge, UrgencyBadge, FantasyROIBadge, ShareButton };
