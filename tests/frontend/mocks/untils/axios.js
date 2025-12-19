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
  // create returns the same mock so calling code that uses axios.create still works
  create: jest.fn(function() { 
    return {
      interceptors: {
        request: { use: jest.fn(() => {}) },
        response: { use: jest.fn(() => {}) },
      },
      get: mockFn,
      post: mockFn,
      put: mockFn,
      delete: mockFn,
      patch: mockFn,
    };
  })
};

module.exports = API;
