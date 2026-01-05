// src/components/charts/LazyCharts.jsx
// Lazy-loaded Chart.js components to reduce initial bundle size (~150KB savings)
// Chart.js is only loaded when a chart is actually rendered

import React, { lazy, Suspense } from 'react';

// Lazy load the chart implementations
const LazyLineChart = lazy(() => import('./LineChartImpl'));
const LazyBarChart = lazy(() => import('./BarChartImpl'));

// Chart loading skeleton
const ChartSkeleton = ({ height = '100%' }) => (
  <div
    className="animate-pulse bg-charcoal-800/50 rounded-sm flex items-center justify-center"
    style={{ height }}
  >
    <div className="text-cream-500/40 text-xs font-mono uppercase tracking-wide">
      Loading chart...
    </div>
  </div>
);

// Lazy Line chart wrapper
export const Line = ({ data, options, ...props }) => (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyLineChart data={data} options={options} {...props} />
  </Suspense>
);

// Lazy Bar chart wrapper
export const Bar = ({ data, options, ...props }) => (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyBarChart data={data} options={options} {...props} />
  </Suspense>
);
