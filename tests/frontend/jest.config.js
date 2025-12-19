module.exports = {
  // run tests from repo root so relative imports in tests resolve to the repo layout
  rootDir: '../../',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setupTests.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
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

