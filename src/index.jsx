// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initErrorReporting } from './lib/errorReporter';

// Capture uncaught errors and unhandled promise rejections in production.
initErrorReporting();

// Attach the Google Fonts stylesheet (preloaded in index.html, where the
// comment explains why it can't be a plain render-blocking <link>). Keep
// this URL in sync with the preload/noscript hrefs in index.html.
const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';
if (
  typeof document !== 'undefined' &&
  !document.querySelector(`link[rel="stylesheet"][href="${FONT_CSS_URL}"]`)
) {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = FONT_CSS_URL;
  document.head.appendChild(fontLink);
}

// Create root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA support (optional)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
