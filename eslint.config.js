/**
 * ESLint 9 flat config.
 *
 * ESLint is a dev-only dependency — the app itself keeps zero runtime
 * dependencies. Globals are declared per area instead of pulling in the
 * `globals` package, keeping the dev toolchain to eslint + @eslint/js.
 */
import js from '@eslint/js';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  MutationObserver: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  matchMedia: 'readonly',
  crypto: 'readonly',
  getSelection: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  AbortSignal: 'readonly',
  indexedDB: 'readonly',
  IDBKeyRange: 'readonly',
  structuredClone: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  alert: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortSignal: 'readonly',
  queueMicrotask: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  Blob: 'readonly',
};

const extensionGlobals = {
  chrome: 'readonly',
  importScripts: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortSignal: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browserGlobals },
  },
  {
    files: ['server/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: nodeGlobals },
  },
  {
    files: ['extension/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: extensionGlobals },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
