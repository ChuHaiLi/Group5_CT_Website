// Manual mock for axios package used in frontend tests
// Axios is both a callable function and an object with helpers; emulate that shape.
const axios = jest.fn(() => Promise.resolve({ data: {} }));

const defaultInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn()
};

// axios.create returns an instance
axios.create = jest.fn();
// convenience method bindings to the default instance
axios.get = defaultInstance.get;
axios.post = defaultInstance.post;
axios.put = defaultInstance.put;
axios.delete = defaultInstance.delete;
axios.patch = defaultInstance.patch;
axios.head = defaultInstance.head;
axios.options = defaultInstance.options;
// expose the default instance for tests
axios.__defaultInstance = defaultInstance;

module.exports = axios;
