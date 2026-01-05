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
    sourcemap: true,
    rollupOptions: {
      // Exclude Storybook files from production build (saves ~750KB)
      external: (id) => id.includes('/stories/'),
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage', 'firebase/analytics'],
          // UI utilities - lightweight, loaded immediately
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          'vendor-query': ['@tanstack/react-query', 'zustand'],
          // Framer Motion in separate chunk - loaded via LazyMotion dynamic import
          // Uses domAnimation feature set (~60% smaller than full bundle)
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
  },
});
