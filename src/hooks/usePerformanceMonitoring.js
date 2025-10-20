import { useEffect, useRef, useCallback } from 'react';
import { trace, logEvent } from '../firebase';

/**
 * Hook for monitoring component performance
 * Tracks mount time, render time, and custom metrics
 */
export const usePerformanceMonitoring = (componentName, options = {}) => {
  const { enabled = process.env.NODE_ENV === 'production', trackRenders = false } = options;
  const mountTimeRef = useRef(null);
  const traceRef = useRef(null);
  const renderCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    // Start trace on mount
    mountTimeRef.current = performance.now();
    traceRef.current = trace(`component_${componentName}`);
    traceRef.current.start();

    // Track mount time
    const mountTime = performance.now() - mountTimeRef.current;
    traceRef.current.putMetric('mount_time', mountTime);

    // Stop trace on unmount
    return () => {
      if (traceRef.current) {
        traceRef.current.putMetric('total_renders', renderCountRef.current);
        traceRef.current.stop();
      }
    };
  }, [componentName, enabled]);

  useEffect(() => {
    if (!enabled || !trackRenders) return;
    renderCountRef.current += 1;
  });

  // Function to track custom events
  const trackEvent = useCallback((eventName, params = {}) => {
    if (!enabled) return;
    logEvent(`${componentName}_${eventName}`, params);
  }, [componentName, enabled]);

  // Function to track custom metrics
  const trackMetric = useCallback((metricName, value) => {
    if (!enabled || !traceRef.current) return;
    traceRef.current.putMetric(metricName, value);
  }, [enabled]);

  return { trackEvent, trackMetric };
};

/**
 * Hook for monitoring API call performance
 */
export const useAPIPerformance = (apiName) => {
  const startAPICall = useCallback(() => {
    const traceInstance = trace(`api_${apiName}`);
    traceInstance.start();
    const startTime = performance.now();

    return {
      stop: (success = true, statusCode = null) => {
        const duration = performance.now() - startTime;
        traceInstance.putMetric('duration', duration);
        traceInstance.putAttribute('success', success.toString());
        if (statusCode) {
          traceInstance.putAttribute('status_code', statusCode.toString());
        }
        traceInstance.stop();

        // Log slow API calls
        if (duration > 2000) {
          logEvent('slow_api_call', {
            api_name: apiName,
            duration: Math.round(duration),
            success
          });
        }
      },
      error: (errorMessage) => {
        const duration = performance.now() - startTime;
        traceInstance.putMetric('duration', duration);
        traceInstance.putAttribute('success', 'false');
        traceInstance.putAttribute('error', errorMessage);
        traceInstance.stop();

        logEvent('api_error', {
          api_name: apiName,
          error_message: errorMessage,
          duration: Math.round(duration)
        });
      }
    };
  }, [apiName]);

  return { startAPICall };
};

/**
 * Hook for monitoring page performance
 */
export const usePagePerformance = (pageName) => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const traceInstance = trace(`page_${pageName}`);
    traceInstance.start();

    // Track page load time
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          traceInstance.putMetric('dom_content_loaded', entry.domContentLoadedEventEnd);
          traceInstance.putMetric('load_complete', entry.loadEventEnd);
        }

        if (entry.entryType === 'paint') {
          if (entry.name === 'first-contentful-paint') {
            traceInstance.putMetric('fcp', entry.startTime);
          }
        }

        if (entry.entryType === 'largest-contentful-paint') {
          traceInstance.putMetric('lcp', entry.startTime);
        }
      }
    });

    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });

    // Track Core Web Vitals
    if ('web-vitals' in window) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS((metric) => traceInstance.putMetric('cls', metric.value));
        getFID((metric) => traceInstance.putMetric('fid', metric.value));
        getFCP((metric) => traceInstance.putMetric('fcp', metric.value));
        getLCP((metric) => traceInstance.putMetric('lcp', metric.value));
        getTTFB((metric) => traceInstance.putMetric('ttfb', metric.value));
      });
    }

    const timeout = setTimeout(() => {
      traceInstance.stop();
      observer.disconnect();
    }, 10000);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      traceInstance.stop();
    };
  }, [pageName]);
};

/**
 * Hook for tracking user interactions
 */
export const useInteractionTracking = (componentName) => {
  const trackClick = useCallback((elementName, metadata = {}) => {
    if (process.env.NODE_ENV !== 'production') return;
    
    logEvent('user_click', {
      component: componentName,
      element: elementName,
      ...metadata
    });
  }, [componentName]);

  const trackInput = useCallback((inputName, value) => {
    if (process.env.NODE_ENV !== 'production') return;
    
    logEvent('user_input', {
      component: componentName,
      input: inputName,
      has_value: !!value
    });
  }, [componentName]);

  const trackScroll = useCallback((scrollDepth) => {
    if (process.env.NODE_ENV !== 'production') return;
    
    logEvent('user_scroll', {
      component: componentName,
      depth: scrollDepth
    });
  }, [componentName]);

  return { trackClick, trackInput, trackScroll };
};

/**
 * Utility function to measure function execution time
 */
export const measurePerformance = async (fn, label) => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }
    
    if (process.env.NODE_ENV === 'production' && duration > 1000) {
      logEvent('slow_operation', {
        operation: label,
        duration: Math.round(duration)
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

export default {
  usePerformanceMonitoring,
  useAPIPerformance,
  usePagePerformance,
  useInteractionTracking,
  measurePerformance
};