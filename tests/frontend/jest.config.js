module.exports = {
  // run tests from repo root so relative imports in tests resolve to the repo layout
  rootDir: '../../',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setupTests.js'],
  setupFiles: ['<rootDir>/tests/frontend/setup-jest-polyfills.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Map static assets to a mock file to avoid importing binary files during tests
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/tests/frontend/__mocks__/fileMock.js',
    '^axios$': '<rootDir>/tests/frontend/mocks/axios.js',
    // Mock fire-event to prevent import-time errors - must match the exact import path
    '^.*/dist/fire-event\\.js$': '<rootDir>/tests/frontend/mocks/fire-event.js',
    // (removed explicit mapping for @testing-library/dom to use actual package)
    // Direct path mappings for untils modules - must come BEFORE the @/ alias
    '^.*/untils/chatWidgetEvents(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/untils/chatWidgetEvents.js',
    '^.*/untils/axios(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/untils/axios.js',
    '^.*/untils/api(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/untils/api.js',
    '^.*/untils/imageResizer(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/untils/imageResizer.js',
    // Config and hooks - must come BEFORE the @/ alias
    '^.*/frontend/src/config(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/config',
    '^.*/hooks/useClickOutside(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/hooks/useClickOutside.js',
    '^.*/context/PageContext(?:\\.js)?$': '<rootDir>/tests/frontend/mocks/context/PageContext.js',
    // @ alias for other imports
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  // prefer repo node_modules and frontend/node_modules when resolving packages
  moduleDirectories: ['node_modules', '<rootDir>/frontend/node_modules'] ,
  testMatch: [
    '<rootDir>/tests/frontend/**/__tests__/**/*.test.js',
    '<rootDir>/tests/frontend/**/*.test.js',
    '<rootDir>/tests/frontend/**/test_*.js'
  ],
  collectCoverageFrom: [
    '<rootDir>/frontend/src/**/*.{js,jsx}',
    '!<rootDir>/frontend/src/index.js',
    '!<rootDir>/frontend/src/reportWebVitals.js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};

