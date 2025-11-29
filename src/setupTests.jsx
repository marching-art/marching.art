// Setup file for Vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      button: ({ children, ...props }) => {
        // eslint-disable-next-line no-unused-vars
        const { whileHover, whileTap, initial, animate, exit, variants, transition, ...htmlProps } = props;
        return <button {...htmlProps}>{children}</button>;
      },
      div: ({ children, ...props }) => {
        // eslint-disable-next-line no-unused-vars
        const { whileHover, whileTap, initial, animate, exit, variants, transition, layoutId, ...htmlProps } = props;
        return <div {...htmlProps}>{children}</div>;
      },
    },
    AnimatePresence: ({ children }) => children,
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock btoa for generateLineupHash tests
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str).toString('base64');
}
