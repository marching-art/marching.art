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
            // Messaging and Storage are only reached through dynamic imports
            // (App.jsx / SettingsModal lazy-load pushNotifications;
            // api/client.ts defers storage). Forcing them into the eager
            // vendor-firebase chunk silently undid those deferrals — leave
            // them out so Rolldown gives each its own lazy chunk.
            if (
              id.includes('/node_modules/@firebase/messaging') ||
              id.includes('/node_modules/firebase/messaging') ||
              id.includes('/node_modules/@firebase/storage') ||
              id.includes('/node_modules/firebase/storage')
            ) {
              return undefined;
            }
            return 'vendor-firebase';
          }
          // UI utilities - lightweight, loaded immediately
          if (inPackage('lucide-react') || inPackage('react-hot-toast')) return 'vendor-ui';
          if (inPackage('@tanstack/react-query') || inPackage('zustand') || inPackage('date-fns')) {
            return 'vendor-query';
          }
          // framer-motion intentionally gets NO manual group: the app uses
          // LazyMotion, whose domMax feature bundle is loaded behind a
          // dynamic import of src/lib/motionFeatures.js. A manual
          // 'vendor-motion' group forced the whole package — features
          // included — into an eagerly modulepreloaded chunk (~41.5 kB
          // gzip dead on first paint), defeating that split. With no group,
          // only the small LazyMotion/m/MotionConfig entry stays eager and
          // domMax lands in a lazy chunk (same reasoning as chart.js below).
          // chart.js / react-chartjs-2 intentionally get NO manual group:
          // they are only imported behind React.lazy (LazyCharts), and a
          // manual 'vendor-charts' group forced that whole library — plus a
          // duplicated React runtime Rolldown hoisted with it — into the
          // eager first-paint payload (~61 KB gzip). With no group, the
          // dynamic-import boundary splits them into a lazy chunk fetched
          // only when a chart actually renders.
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
