// Setup polyfills that run BEFORE jest-dom and modules are loaded
// This ensures compatibility with different versions of @testing-library

global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;

if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
}

if (typeof global.Blob === 'undefined') {
  global.Blob = function Blob() {};
}

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

// ===== CRITICAL: Setup DOM config FIRST =====
// This must happen BEFORE @testing-library/react imports fire-event
// which calls @testing-library/dom's getConfig
try {
  const domModule = require('@testing-library/dom');
  
  // Wrap the original getConfig to ensure it always returns a valid config
  const originalGetConfig = domModule.getConfig;
  domModule.getConfig = function() {
    try {
      if (typeof originalGetConfig === 'function') {
        const config = originalGetConfig();
        if (config && typeof config === 'object') {
          return config;
        }
      }
    } catch (e) {
      // If original fails, return default config
    }
    return {
      getElementError: (message, element) => new Error(message),
      asyncUtilTimeout: 1000,
      computedStyleSupportsPseudoElements: true,
    };
  };
  
  // Ensure configure function exists
  if (typeof domModule.configure !== 'function') {
    domModule.configure = function(config) {
      // no-op - just accept the call
    };
  }
} catch (e) {
  console.warn('Could not setup dom config:', e.message);
}

// ===== CRITICAL: Patch @testing-library/dom BEFORE @testing-library/react imports it =====
// This ensures fireEvent is available when react's fire-event.js tries to import it
try {
  const domModule = require('@testing-library/dom');
  // Import the actual fireEvent from dom's events module if it exists
  try {
    const eventsModule = require('@testing-library/dom/dist/events.js');
    if (eventsModule && eventsModule.fireEvent) {
      domModule.fireEvent = eventsModule.fireEvent;
    }
  } catch (e) {
    // If events module doesn't exist, create a minimal fireEvent
    if (!domModule.fireEvent) {
      domModule.fireEvent = {
        click: jest.fn(),
        change: jest.fn(),
        submit: jest.fn(),
        input: jest.fn(),
        focus: jest.fn(),
        blur: jest.fn(),
        keyDown: jest.fn(),
        keyUp: jest.fn(),
        keyPress: jest.fn(),
        mouseEnter: jest.fn(),
        mouseLeave: jest.fn(),
        mouseOver: jest.fn(),
        mouseOut: jest.fn(),
        mouseDown: jest.fn(),
        mouseUp: jest.fn(),
        touchStart: jest.fn(),
        touchEnd: jest.fn(),
        touchMove: jest.fn(),
        touchCancel: jest.fn(),
        doubleClick: jest.fn(),
        contextMenu: jest.fn(),
        wheel: jest.fn(),
        scroll: jest.fn(),
        copy: jest.fn(),
        paste: jest.fn(),
        cut: jest.fn(),
        drag: jest.fn(),
        dragStart: jest.fn(),
        dragEnd: jest.fn(),
        dragEnter: jest.fn(),
        dragLeave: jest.fn(),
        dragOver: jest.fn(),
        drop: jest.fn(),
      };
    }
  }
} catch (e) {
  console.warn('Could not patch @testing-library/dom, fireEvent may not be available');
}
