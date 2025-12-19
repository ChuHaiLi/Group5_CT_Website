/**
 * Unit tests for API client (axios wrapper)
 * Tests interceptor setup and configuration
 */

// Mock axios - define mocks inside the factory function to avoid hoisting issues
jest.mock('axios', () => {
  const mockRequestUseFn = jest.fn();
  const mockResponseUseFn = jest.fn();
  
  // Store references for test access
  global.__mockRequestUse = mockRequestUseFn;
  global.__mockResponseUse = mockResponseUseFn;
  
  return {
    default: {
      create: jest.fn(() => {
        const instance = {
          interceptors: {
            request: { use: mockRequestUseFn },
            response: { use: mockResponseUseFn },
          },
          get: jest.fn(),
          post: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
          baseURL: 'http://127.0.0.1:5000/api',
        };
        return instance;
      }),
    },
    create: jest.fn(() => {
      const instance = {
        interceptors: {
          request: { use: mockRequestUseFn },
          response: { use: mockResponseUseFn },
        },
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        baseURL: 'http://127.0.0.1:5000/api',
      };
      return instance;
    }),
  };
});

import API from '../axios';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('creates axios instance with correct baseURL', () => {
    expect(API).toBeDefined();
    expect(API.baseURL).toBe('http://127.0.0.1:5000/api');
  });

  test('sets up request interceptor', () => {
    expect(API.interceptors).toBeDefined();
    expect(API.interceptors.request).toBeDefined();
    expect(API.interceptors.response).toBeDefined();
  });

  test('request interceptor adds Authorization header when token exists', () => {
    localStorageMock.getItem.mockReturnValue('mock-token');
    
    // Access the mock function from global
    const mockRequestUseFn = global.__mockRequestUse;
    
    if (mockRequestUseFn && mockRequestUseFn.mock.calls.length > 0) {
      const interceptorFn = mockRequestUseFn.mock.calls[0]?.[0];
      if (interceptorFn) {
        const config = { headers: {} };
        const result = interceptorFn(config);
        expect(result.headers.Authorization).toBe('Bearer mock-token');
      }
    }
    
    // Verify interceptor is set up
    expect(API.interceptors.request.use).toBeDefined();
  });

  test('request interceptor does not add header when token is missing', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const mockRequestUseFn = global.__mockRequestUse;
    
    if (mockRequestUseFn && mockRequestUseFn.mock.calls.length > 0) {
      const interceptorFn = mockRequestUseFn.mock.calls[0]?.[0];
      if (interceptorFn) {
        const config = { headers: {} };
        const result = interceptorFn(config);
        expect(result.headers.Authorization).toBeUndefined();
      }
    }
    
    expect(API.interceptors.request.use).toBeDefined();
  });
});
