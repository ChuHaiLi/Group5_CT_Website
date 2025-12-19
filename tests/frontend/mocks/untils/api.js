const mockFn = jest.fn(() => Promise.resolve({ data: {} }));

const API = {
  interceptors: {
    request: { use: jest.fn(() => {}) },
    response: { use: jest.fn(() => {}) },
  },
  get: mockFn,
  post: mockFn,
  put: mockFn,
  delete: mockFn,
  patch: mockFn,
  head: mockFn,
  options: mockFn,
};

module.exports = API;
