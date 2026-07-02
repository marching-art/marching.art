// Flat ESLint config (ESLint 9+).
//
// Scope: frontend (`src`, browser + React) and Cloud Functions
// (`functions`/`functions-scraper`, Node + CommonJS) are configured separately
// because they run in different environments with different module systems.
//
// Philosophy: this config is being introduced to an existing codebase, so
// rules that would flag large amounts of pre-existing (non-buggy) code are set
// to "warn" rather than "error". Rules that catch genuine bugs — most
// importantly the React Hooks rules — stay as errors. Tighten over time.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Vitest exposes these as globals (vite.config.js -> test.globals: true).
const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'build/**',
      'node_modules/**',
      '**/node_modules/**',
      'coverage/**',
      'storybook-static/**',
      'playwright-report/**',
      'playwright/.cache/**',
      'fantasymarchingarts/**', // legacy static HTML site (incl. minified vendor JS)
      'functions/eslint.config.js', // pre-existing ESM config; not a source file
      '**/*.d.ts',
    ],
  },

  // --- Frontend: browser + React ---
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Real-bug rules stay errors (react-hooks/* default to error).
      // Legacy-noise rules downgraded to warnings until the codebase is cleaned.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Guardrail: keep files from growing back into "god-files". A warning
      // (not an error) so it flags tech debt without blocking work. When a file
      // trips this, extract logic into hooks/utils or split sub-components.
      'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }],
    },
  },

  // --- Plain JS/JSX: catch undefined identifiers as errors ---
  // tseslint's recommended config turns no-undef off (the type-checker is
  // supposed to catch it), but .js/.jsx files are NOT type-checked (allowJs
  // without checkJs) and esbuild doesn't resolve free identifiers — so an
  // unimported identifier ships and throws ReferenceError at runtime (see:
  // the ADMIN_TABS incident). Re-enable no-undef for plain JS/JSX, plus
  // react/jsx-no-undef so undefined JSX component tags are errors too.
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
    },
  },

  // --- Test files: add Vitest globals; tests are allowed to be long ---
  {
    files: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'src/setupTests.jsx'],
    languageOptions: {
      globals: { ...globals.node, ...vitestGlobals },
    },
    rules: {
      'max-lines': 'off',
    },
  },

  // --- Cloud Functions: Node + CommonJS ---
  {
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }],
      // Intentional `do { ... } while (true)` batch loops (with internal breaks)
      // are idiomatic here; keep the rule for `if (true)`-style typos only.
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },

  // --- Scraper: Node + CommonJS, but also runs browser code via page.evaluate() ---
  {
    files: ['functions-scraper/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      // `document`, `window`, etc. are legitimately referenced inside
      // page.evaluate() callbacks, which execute in the browser context.
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Disable stylistic rules that conflict with Prettier. Must come last.
  prettier
);
