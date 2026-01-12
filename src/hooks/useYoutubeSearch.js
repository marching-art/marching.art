import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Hardcoded video IDs to try before search (for videos that are hard to find)
const HARDCODED_VIDEOS = {
  '2018_santa clara vanguard': ['KfC6Xgy4ZL4', 'QWWP5jiGltA'],
  '2023_mandarins': ['JRkn1MC2FMs']
};

// Check if corps/year has hardcoded videos
const getHardcodedVideos = (year, corpsName) => {
  const lowerName = corpsName.toLowerCase();
  if (year === '2018' && lowerName.includes('santa clara')) {
    return HARDCODED_VIDEOS['2018_santa clara vanguard'];
  }
  if (year === '2023' && lowerName.includes('mandarins')) {
    return HARDCODED_VIDEOS['2023_mandarins'];
  }
  return null;
};

export const useYoutubeSearch = () => {
  const [videoModal, setVideoModal] = useState({
    show: false,
    loading: false,
    videoId: null,
    title: '',
    searchQuery: '',
    error: null
  });

  // Search YouTube and show video in modal
  const handleYoutubeSearch = async (year, corpsName, skipCache = false, fallbackIndex = 0) => {
    // Build search query with special cases
    let searchQuery = `${year} ${corpsName}`;

    // Add "corps" for generic names that need disambiguation
    if (['cavaliers', 'genesis'].includes(corpsName.toLowerCase())) {
      searchQuery += ' corps';
    }

    // Check for hardcoded videos first
    const hardcodedVideos = getHardcodedVideos(year, corpsName);

    // If we have hardcoded videos and haven't exhausted them, try them first
    if (hardcodedVideos && fallbackIndex < hardcodedVideos.length) {
      setVideoModal({
        show: true,
        loading: false,
        videoId: hardcodedVideos[fallbackIndex],
        title: `${year} ${corpsName}`,
        searchQuery,
        error: null,
        year,
        corpsName,
        fallbackIndex
      });
      return;
    }

    // Use abbreviated search for specific corps/year combinations
    if (year === '2018' && corpsName.toLowerCase().includes('santa clara')) {
      searchQuery = '2018 scv';
    }

    setVideoModal({
      show: true,
      loading: true,
      videoId: null,
      title: searchQuery,
      searchQuery,
      error: null,
      year,
      corpsName,
      fallbackIndex: hardcodedVideos ? hardcodedVideos.length : 0
    });

    try {
      // Call Firebase function to search YouTube
      const functions = getFunctions();
      const searchYoutube = httpsCallable(functions, 'searchYoutubeVideo');
      const result = await searchYoutube({ query: searchQuery, skipCache });

      if (result.data.success && result.data.found) {
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          videoId: result.data.videoId,
          title: result.data.title || searchQuery
        }));
      } else {
        setVideoModal(prev => ({
          ...prev,
          loading: false,
          error: result.data.message || 'No videos found'
        }));
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setVideoModal(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to search YouTube'
      }));
    }
  };

  // Retry with next fallback or search
  const handleRetrySearch = () => {
    if (videoModal.year && videoModal.corpsName) {
      const nextIndex = (videoModal.fallbackIndex ?? 0) + 1;
      handleYoutubeSearch(videoModal.year, videoModal.corpsName, true, nextIndex);
    }
  };

  const closeVideoModal = () => {
    setVideoModal({
      show: false,
      loading: false,
      videoId: null,
      title: '',
      searchQuery: '',
      error: null
    });
  };

  return {
    videoModal,
    handleYoutubeSearch,
    handleRetrySearch,
    closeVideoModal
  };
};
