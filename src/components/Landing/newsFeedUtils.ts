// =============================================================================
// NEWS FEED UTILITIES
// =============================================================================
// Pure helpers and category config extracted from NewsFeed.jsx so they can be
// unit-tested independently of the (large) presentational component.

import { Newspaper, Trophy, Flame, BookOpen, type LucideIcon } from 'lucide-react';

export interface NewsCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: NewsCategory[] = [
  { id: 'all', label: 'All Stories', icon: Newspaper },
  { id: 'dci', label: 'DCI Recaps', icon: Trophy },
  { id: 'fantasy', label: 'Fantasy', icon: Flame },
  { id: 'analysis', label: 'Analysis', icon: BookOpen },
];

export interface CategoryConfig {
  label: string;
  bgClass: string;
  textClass: string;
  bgLightClass: string;
  icon: LucideIcon;
}

export interface UrgencyBadge {
  label: string;
  type: 'breaking' | 'new';
}

export interface StoryLike {
  headline?: string;
  summary?: string;
  fullStory?: string;
  narrative?: string;
  fantasyImpact?: string;
  readingTime?: string;
}

/**
 * Safely converts a value to a string for rendering. Handles cases where the
 * AI backend might return an object instead of a string.
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.text) return String(obj.text);
    if (obj.content) return String(obj.content);
    if (obj.message) return String(obj.message);
    console.warn('NewsFeed: Unexpected object in text field:', value);
    return '';
  }
  return String(value);
}

/**
 * Formats a timestamp in a professional news style: relative for recent stories,
 * absolute for older ones. `now` is injectable for testing.
 */
export function formatTimestamp(dateString: string | number | Date, now: Date = new Date()): string {
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));

  if (diffInMins < 60) {
    return `${diffInMins}m ago`;
  }

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns reading time — the backend-provided value when present, otherwise a
 * ~200 wpm estimate from the story text.
 */
export function getReadingTime(story: StoryLike): string {
  if (story.readingTime) {
    return story.readingTime;
  }
  const wordsPerMinute = 200;
  const text = `${story.headline ?? ''} ${story.summary ?? ''} ${story.fullStory || ''} ${story.narrative || ''} ${story.fantasyImpact || ''}`;
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  return `${minutes} min read`;
}

/**
 * Whether a story should show a "Breaking" or "Just In" badge. `now` is
 * injectable for testing.
 */
export function getUrgencyBadge(
  dateString: string | number | Date,
  now: Date = new Date()
): UrgencyBadge | null {
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInMins < 60) {
    return { label: 'BREAKING', type: 'breaking' };
  }
  if (diffInHours < 6) {
    return { label: 'JUST IN', type: 'new' };
  }
  return null;
}

/** Visual configuration (label, colors, icon) for a story category. */
export function getCategoryConfig(category: string): CategoryConfig {
  switch (category) {
    case 'dci':
      return {
        label: 'DCI RECAP',
        bgClass: 'bg-[#0057B8]',
        textClass: 'text-[#0057B8]',
        bgLightClass: 'bg-[#0057B8]/20',
        icon: Trophy,
      };
    case 'fantasy':
      return {
        label: 'FANTASY',
        bgClass: 'bg-orange-500',
        textClass: 'text-orange-400',
        bgLightClass: 'bg-orange-500/20',
        icon: Flame,
      };
    case 'analysis':
      return {
        label: 'ANALYSIS',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        bgLightClass: 'bg-purple-500/20',
        icon: BookOpen,
      };
    default:
      return {
        label: 'NEWS',
        bgClass: 'bg-gray-500',
        textClass: 'text-gray-400',
        bgLightClass: 'bg-gray-500/20',
        icon: Newspaper,
      };
  }
}
