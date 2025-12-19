/**
 * Tests for API utilities (axios interceptors)
 * Note: These tests require mocking axios
 */
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('API utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should add token to headers when token exists', () => {
    localStorage.setItem('access_token', 'test-token');

    // Import after setting token to test interceptor
    const API = require('../../../frontend/src/untils/axios').default;

    // Mock request
    const config = { headers: {} };
    const interceptor = API.interceptors.request.handlers[0].fulfilled;

    const result = interceptor(config);

    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  test('should not add token when token does not exist', () => {
    localStorage.removeItem('access_token');

    const API = require('../../../frontend/src/untils/axios').default;
    const config = { headers: {} };
    const interceptor = API.interceptors.request.handlers[0].fulfilled;

    const result = interceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  // Note: Testing response interceptor (token refresh) requires more complex setup
  // with mocked axios responses and localStorage operations
});

