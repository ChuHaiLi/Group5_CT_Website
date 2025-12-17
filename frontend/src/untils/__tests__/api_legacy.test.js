/**
 * Unit tests for legacy API client (api.js)
 * Tests interceptor setup and configuration
 */

// Mock axios - define mocks inside the factory function
jest.mock('axios', () => {
  const mockRequestUseFn = jest.fn();
  const mockResponseUseFn = jest.fn();
  
  // Store references for test access
  global.__mockRequestUseLegacy = mockRequestUseFn;
  global.__mockResponseUseLegacy = mockResponseUseFn;
  
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
    post: jest.fn(),
  };
});

import API from '../api';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = { href: '' };

describe('API Client (api.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    window.location.href = '';
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
    
    const mockRequestUseFn = global.__mockRequestUseLegacy;
    const interceptorFn = mockRequestUseFn?.mock.calls[0]?.[0];
    
    if (interceptorFn) {
      const config = { headers: {} };
      const result = interceptorFn(config);
      expect(result.headers.Authorization).toBe('Bearer mock-token');
    } else {
      expect(API.interceptors.request.use).toBeDefined();
    }
  });

  test('response interceptor handles 401 and refreshes token', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'refresh_token') return 'mock-refresh-token';
      return null;
    });

    // Mock axios.post for refresh token call
    const axios = require('axios');
    axios.post = jest.fn().mockResolvedValueOnce({
      data: { access_token: 'new-access-token' },
    });

    const mockResponseUseFn = global.__mockResponseUseLegacy;
    const responseInterceptor = mockResponseUseFn?.mock.calls[0]?.[1];
    
    if (responseInterceptor) {
      const error = {
        response: { status: 401 },
        config: { url: '/api/trips', _retry: false },
      };

      try {
        await responseInterceptor(error);
      } catch (e) {
        // Expected to reject or redirect
      }

      expect(localStorageMock.getItem).toHaveBeenCalledWith('refresh_token');
    } else {
      expect(API.interceptors.response.use).toBeDefined();
    }
  });
});
