import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Include .js files for JSX transformation (CRA compatibility)
      include: /\.(jsx?|tsx?)$/,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'build',
    // Source maps disabled in production - no error tracking service configured
    // Re-enable with 'hidden' if adding Sentry/Bugsnag (generates maps without linking)
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
            'firebase/storage',
            'firebase/analytics',
          ],
          // UI utilities - lightweight, loaded immediately
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          'vendor-query': ['@tanstack/react-query', 'zustand', 'date-fns'],
          // Framer Motion - now uses LazyMotion with async feature loading
          // Features are lazy-loaded after initial render via dynamic import
          // See src/components/MotionProvider.jsx for implementation
          'vendor-motion': ['framer-motion'],
          // Lazy-loaded chart library - only loaded when charts are rendered
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  // Enable JSX in .js files for dependency pre-bundling
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.jsx'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Measure the whole src tree, not just files touched by tests, so the
      // coverage report shows the real gap rather than a flattering subset.
      all: true,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'src/setupTests.jsx', 'src/types/**'],
      reporter: ['text-summary', 'lcov'],
      // Ratchet, not target: floors sit just below the current whole-tree
      // numbers (statements 8.87 / branches 7.93 / functions 6.18 / lines
      // 8.71 as of the hermetic hook tests) so coverage can only move up.
      // When a PR raises coverage meaningfully, raise the floors to just
      // below the new numbers.
      thresholds: {
        statements: 8.5,
        branches: 7.5,
        functions: 6,
        lines: 8.5,
      },
    },
  },
});
