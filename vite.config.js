import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync, writeFileSync } from 'node:fs';

// Stamp the service worker with a unique version on every production build.
// service-worker.js ships a literal '__BUILD_ID__'; the SW derives all of its
// cache names from APP_VERSION, so if that string never changes (it was
// hard-coded), the SW never invalidates its caches and returning PWA users keep
// getting served the previously cached app shell after a deploy. Rewriting the
// emitted file in closeBundle guarantees a fresh version per build/deploy.
function stampServiceWorker() {
  const buildId = `${new Date().toISOString().slice(0, 10)}.${Date.now()}`;
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'build/service-worker.js');
      try {
        const src = readFileSync(swPath, 'utf8');
        if (!src.includes('__BUILD_ID__')) return;
        writeFileSync(swPath, src.replace('__BUILD_ID__', buildId));
        console.log(`[stamp-service-worker] APP_VERSION = ${buildId}`);
      } catch (err) {
        console.warn('[stamp-service-worker] skipped:', err.message);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Include .js files for JSX transformation (CRA compatibility)
      include: /\.(jsx?|tsx?)$/,
    }),
    stampServiceWorker(),
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
        // Split vendor chunks for better caching. Vite 8 (Rolldown) only
        // accepts the function form of manualChunks — the object form throws
        // "manualChunks is not a function" at build time — so we match each
        // module's node_modules path to a vendor group by hand.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const inPackage = (name) => id.includes(`/node_modules/${name}/`);
          if (inPackage('react') || inPackage('react-dom') || inPackage('react-router-dom')) {
            return 'vendor-react';
          }
          if (inPackage('firebase') || id.includes('/node_modules/@firebase/')) {
            return 'vendor-firebase';
          }
          // UI utilities - lightweight, loaded immediately
          if (inPackage('lucide-react') || inPackage('react-hot-toast')) return 'vendor-ui';
          if (inPackage('@tanstack/react-query') || inPackage('zustand') || inPackage('date-fns')) {
            return 'vendor-query';
          }
          // Framer Motion - now uses LazyMotion with async feature loading
          // Features are lazy-loaded after initial render via dynamic import
          // See src/components/MotionProvider.jsx for implementation
          if (inPackage('framer-motion')) return 'vendor-motion';
          // Lazy-loaded chart library - only loaded when charts are rendered
          if (inPackage('chart.js') || inPackage('react-chartjs-2')) return 'vendor-charts';
          return undefined;
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
      // numbers (statements 11.75 / branches 9.32 / functions 9.61 / lines
      // 11.64 as of the season-clock, caption, and guard test additions) so
      // coverage can only move up. When a PR raises coverage meaningfully,
      // raise the floors to just below the new numbers.
      thresholds: {
        statements: 11.5,
        branches: 9,
        functions: 9,
        lines: 11.5,
      },
    },
  },
});
