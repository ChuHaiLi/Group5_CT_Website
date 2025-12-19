// Setup DOM module getConfig FIRST, before jest-dom is imported
// This ensures jest-dom and react have access to proper config
try {
  const domModule = require('@testing-library/dom');
  
  // Store original getConfig if it exists
  const originalGetConfig = domModule.getConfig;
  
  // Override getConfig to always return a valid config object
  domModule.getConfig = function() {
    if (typeof originalGetConfig === 'function') {
      const config = originalGetConfig();
      if (config && typeof config === 'object') {
        return config;
      }
    }
    // Return a default config object if original fails
    return {
      getElementError: (message, element) => new Error(message),
      asyncUtilTimeout: 1000,
    };
  };
  
  // Ensure configure exists
  if (typeof domModule.configure !== 'function') {
    domModule.configure = function(config) {
      // no-op
    };
  }
} catch (e) {
  console.warn('Could not patch dom module before jest-dom import');
}

// Import jest-dom matchers - this should be safe now that dom is patched
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Polyfills for Node test environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// Provide a simple fetch mock so libraries that check for fetch won't crash on import.
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
}

// Ensure Blob exists (some libs check for it)
if (typeof global.Blob === 'undefined') {
  global.Blob = function Blob(){ /* minimal stub */ };
}

// Polyfill Response for Firebase
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }
  };
}

