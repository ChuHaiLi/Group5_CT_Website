// Mock @testing-library/dom - attempt to wrap the real module safely
let realDom;
try {
  // Prefer jest.requireActual which should bypass manual mocks
  realDom = jest.requireActual('@testing-library/dom');
} catch (e) {
  // Fallback: resolve the package from the frontend node_modules folder to avoid
  // hitting this mock file via moduleNameMapper recursion
  try {
    const path = require('path');
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const altPath = require.resolve('@testing-library/dom', { paths: [path.join(repoRoot, 'frontend', 'node_modules')] });
    realDom = require(altPath);
  } catch (err) {
    // As a last resort provide a minimal shim
    realDom = {
      configure: function() {},
      getConfig: function() {
        return {
          asyncUtilTimeout: 1000,
          getElementError: () => new Error('Test error'),
        };
      }
    };
  }
}

// Add configure noop if missing
if (typeof realDom.configure !== 'function') {
  realDom.configure = function configure() {};
}

// Ensure getConfig returns valid object
if (!realDom.getConfig || typeof realDom.getConfig !== 'function') {
  realDom.getConfig = function getConfig() {
    return {
      asyncUtilTimeout: 1000,
      getElementError: () => new Error('Test error'),
    };
  };
}

module.exports = realDom;




