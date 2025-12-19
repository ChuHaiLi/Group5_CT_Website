// src/utils/__tests__/axios.test.js
import axios from 'axios';
import API from '@/untils/axios';

jest.mock('axios');

describe('API (Modern) - axios.js', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    mockAxiosInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    
    axios.create.mockReturnValue(mockAxiosInstance);
    
    // Reset window.location mock
    delete window.location;
    window.location = { href: '' };
  });

  describe('API Instance Configuration', () => {
    test('should create instance with localhost by default', () => {
      delete process.env.REACT_APP_BACKEND_URL;
      
      // Re-import to get fresh instance
      jest.resetModules();
      require('../axios');

      const createCall = axios.create.mock.calls[axios.create.mock.calls.length - 1][0];
      expect(createCall.baseURL).toBe('http://127.0.0.1:5000/api');
    });

    test('should use environment variable when provided', () => {
      process.env.REACT_APP_BACKEND_URL = 'https://api.production.com';
      
      jest.resetModules();
      require('../axios');

      const createCall = axios.create.mock.calls[axios.create.mock.calls.length - 1][0];
      expect(createCall.baseURL).toBe('https://api.production.com/api');
    });

    test('should set Content-Type header', () => {
      const createCall = axios.create.mock.calls[0][0];
      expect(createCall.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Request Interceptor', () => {
    test('should add Authorization header when token exists', () => {
      const token = 'test-jwt-token';
      localStorage.setItem('access_token', token);

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        url: '/users',
        headers: {}
      };

      const result = requestInterceptor(config);

      expect(result.headers['Authorization']).toBe(`Bearer ${token}`);
    });

    test('should not modify config when no token', () => {
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        url: '/public',
        headers: { 'X-Custom': 'header' }
      };

      const result = requestInterceptor(config);

      expect(result.headers['Authorization']).toBeUndefined();
      expect(result.headers['X-Custom']).toBe('header');
    });

    test('should handle request error', () => {
      const requestErrorHandler = mockAxiosInstance.interceptors.request.use.mock.calls[0][1];
      
      const error = new Error('Request setup failed');

      expect(() => requestErrorHandler(error)).rejects.toEqual(error);
    });

    test('should overwrite existing Authorization header', () => {
      localStorage.setItem('access_token', 'new-token');

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        url: '/test',
        headers: { 'Authorization': 'Bearer old-token' }
      };

      const result = requestInterceptor(config);

      expect(result.headers['Authorization']).toBe('Bearer new-token');
    });
  });

  describe('Response Interceptor - Success Path', () => {
    test('should return response unchanged on success', () => {
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      
      const response = {
        data: { users: [1, 2, 3] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };

      const result = successHandler(response);

      expect(result).toEqual(response);
    });

    test('should not modify response data structure', () => {
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      
      const complexResponse = {
        data: {
          nested: { deep: { value: 'test' } },
          array: [1, 2, { id: 3 }]
        },
        status: 201
      };

      const result = successHandler(complexResponse);

      expect(result.data).toEqual(complexResponse.data);
    });
  });

  describe('Response Interceptor - Auth URL Handling', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    });

    test('should not refresh token for /auth/login endpoint', async () => {
      const error = {
        response: { status: 401, data: { message: 'Invalid credentials' } },
        config: { url: '/auth/login', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should not refresh token for /auth/register endpoint', async () => {
      const error = {
        response: { status: 401 },
        config: { url: '/auth/register', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should not refresh token for /auth/forgot-password', async () => {
      const error = {
        response: { status: 401 },
        config: { url: '/auth/forgot-password', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should not refresh token for /auth/reset-password', async () => {
      const error = {
        response: { status: 401 },
        config: { url: '/auth/reset-password', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should refresh token for non-auth endpoints', async () => {
      localStorage.setItem('refresh_token', 'valid-refresh');

      const error = {
        response: { status: 401 },
        config: { url: '/api/profile', headers: {} }
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token' }
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'success' });

      await errorHandler(error);

      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('Response Interceptor - Token Refresh Flow', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      process.env.REACT_APP_BACKEND_URL = 'http://127.0.0.1:5000';
    });

    test('should call refresh endpoint with correct parameters', async () => {
      const refreshToken = 'valid-refresh-token';
      localStorage.setItem('refresh_token', refreshToken);

      const error = {
        response: { status: 401 },
        config: { url: '/protected', headers: {} }
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token' }
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'success' });

      await errorHandler(error);

      expect(axios.post).toHaveBeenCalledWith(
        'http://127.0.0.1:5000/api/auth/refresh',
        {},
        {
          headers: { Authorization: `Bearer ${refreshToken}` }
        }
      );
    });

    test('should save new access token to localStorage', async () => {
      const newToken = 'shiny-new-access-token';
      localStorage.setItem('refresh_token', 'refresh');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: newToken }
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'ok' });

      await errorHandler(error);

      expect(localStorage.getItem('access_token')).toBe(newToken);
    });

    test('should retry original request with new token', async () => {
      const newToken = 'new-access-token';
      localStorage.setItem('refresh_token', 'refresh');

      const originalConfig = {
        url: '/api/data',
        method: 'POST',
        data: { test: 'data' },
        headers: {}
      };

      const error = {
        response: { status: 401 },
        config: originalConfig
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: newToken }
      });

      const retryResponse = { data: { result: 'success' } };
      mockAxiosInstance.mockResolvedValueOnce(retryResponse);

      const result = await errorHandler(error);

      expect(originalConfig.headers['Authorization']).toBe(`Bearer ${newToken}`);
      expect(mockAxiosInstance).toHaveBeenCalledWith(originalConfig);
      expect(result).toEqual(retryResponse);
    });

    test('should set _retry flag to prevent loops', async () => {
      localStorage.setItem('refresh_token', 'refresh');

      const config = { url: '/test', headers: {} };
      const error = {
        response: { status: 401 },
        config
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token' }
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'ok' });

      await errorHandler(error);

      expect(config._retry).toBe(true);
    });

    test('should not retry if already retried', async () => {
      const error = {
        response: { status: 401 },
        config: {
          url: '/test',
          headers: {},
          _retry: true
        }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(axios.post).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });
  });

  describe('Response Interceptor - Refresh Failure Handling', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      console.error = jest.fn(); // Suppress console.error
    });

    test('should redirect to login when no refresh token', async () => {
      // No refresh token in localStorage
      const error = {
        response: { status: 401 },
        config: { url: '/protected', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(window.location.href).toBe('/login');
    });

    test('should clear all localStorage on refresh failure', async () => {
      localStorage.setItem('refresh_token', 'expired-token');
      localStorage.setItem('access_token', 'old-token');
      localStorage.setItem('user', JSON.stringify({ id: 1 }));
      localStorage.setItem('preferences', JSON.stringify({ theme: 'dark' }));

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      axios.post.mockRejectedValueOnce(new Error('Refresh token expired'));

      try {
        await errorHandler(error);
      } catch (err) {
        // Expected
      }

      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('preferences')).toBeNull();
    });

    test('should redirect to login on refresh failure', async () => {
      localStorage.setItem('refresh_token', 'bad-token');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      axios.post.mockRejectedValueOnce(new Error('Invalid refresh token'));

      try {
        await errorHandler(error);
      } catch (err) {
        // Expected
      }

      expect(window.location.href).toBe('/login');
    });

    test('should log refresh error to console', async () => {
      localStorage.setItem('refresh_token', 'token');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      const refreshError = new Error('Network error');
      axios.post.mockRejectedValueOnce(refreshError);

      try {
        await errorHandler(error);
      } catch (err) {
        // Expected
      }

      expect(console.error).toHaveBeenCalledWith(
        'Refresh token expired:',
        refreshError
      );
    });

    test('should reject with refresh error', async () => {
      localStorage.setItem('refresh_token', 'token');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      const refreshError = new Error('Refresh failed');
      axios.post.mockRejectedValueOnce(refreshError);

      await expect(errorHandler(error)).rejects.toEqual(refreshError);
    });
  });

  describe('Response Interceptor - Non-401 Error Handling', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    });

    test('should reject 400 Bad Request without refresh', async () => {
      const error = {
        response: { 
          status: 400, 
          data: { message: 'Validation error' }
        },
        config: { url: '/submit' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should reject 403 Forbidden without refresh', async () => {
      const error = {
        response: { status: 403 },
        config: { url: '/admin' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should reject 404 Not Found without refresh', async () => {
      const error = {
        response: { status: 404 },
        config: { url: '/missing' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should reject 500 Server Error without refresh', async () => {
      const error = {
        response: { status: 500 },
        config: { url: '/error' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should handle network errors', async () => {
      const error = {
        message: 'Network Error',
        code: 'ECONNABORTED',
        config: { url: '/test' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should handle timeout errors', async () => {
      const error = {
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED',
        config: { url: '/slow' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    });

    test('should handle error without response', async () => {
      const error = {
        message: 'Request failed',
        config: { url: '/test' }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should handle error without config', async () => {
      const error = {
        response: { status: 401 },
        message: 'Unauthorized'
      };

      await expect(errorHandler(error)).rejects.toBeDefined();
    });

    test('should handle malformed refresh response', async () => {
      localStorage.setItem('refresh_token', 'token');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      axios.post.mockResolvedValueOnce({
        data: { token: 'wrong-field' } // Missing access_token
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'ok' });

      await errorHandler(error);

      expect(localStorage.getItem('access_token')).toBe('undefined');
    });

    test('should handle concurrent 401 errors', async () => {
      localStorage.setItem('refresh_token', 'token');

      const error1 = {
        response: { status: 401 },
        config: { url: '/test1', headers: {} }
      };

      const error2 = {
        response: { status: 401 },
        config: { url: '/test2', headers: {} }
      };

      axios.post.mockResolvedValue({
        data: { access_token: 'new-token' }
      });

      mockAxiosInstance.mockResolvedValue({ data: 'ok' });

      await Promise.all([
        errorHandler(error1),
        errorHandler(error2)
      ]);

      // Should refresh token for both requests
      expect(error1.config._retry).toBe(true);
      expect(error2.config._retry).toBe(true);
    });

    test('should handle empty refresh token string', async () => {
      localStorage.setItem('refresh_token', '');

      const error = {
        response: { status: 401 },
        config: { url: '/test', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(window.location.href).toBe('/login');
    });

    test('should preserve original error data on rejection', async () => {
      const errorData = {
        message: 'Validation failed',
        errors: { email: 'Invalid email' }
      };

      const error = {
        response: { 
          status: 422,
          data: errorData
        },
        config: { url: '/validate' }
      };

      try {
        await errorHandler(error);
      } catch (err) {
        expect(err.response.data).toEqual(errorData);
      }
    });
  });

  describe('URL Pattern Matching', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    });

    test('should match auth URLs with query parameters', async () => {
      const error = {
        response: { status: 401 },
        config: { url: '/auth/login?redirect=/home', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should match auth URLs with full path', async () => {
      const error = {
        response: { status: 401 },
        config: { url: 'http://example.com/api/auth/register', headers: {} }
      };

      await expect(errorHandler(error)).rejects.toEqual(error);
    });

    test('should not match partial auth URL patterns', async () => {
      localStorage.setItem('refresh_token', 'token');

      const error = {
        response: { status: 401 },
        config: { url: '/auth/verify-email', headers: {} }
      };

      axios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token' }
      });

      mockAxiosInstance.mockResolvedValueOnce({ data: 'ok' });

      await errorHandler(error);

      expect(axios.post).toHaveBeenCalled();
    });
  });
});