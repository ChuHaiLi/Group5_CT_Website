/**
 * Manual mock for react-router-dom
 * This file is automatically used by Jest when react-router-dom is imported
 */
const React = require('react');

// Create mock functions that can be accessed by tests
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/', search: '', hash: '', state: null };
const mockParams = {};
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn();

module.exports = {
  // Hooks
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => mockParams,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  
  // Components
  BrowserRouter: ({ children }) => React.createElement('div', { 'data-testid': 'browser-router' }, children),
  MemoryRouter: ({ children, initialEntries }) => React.createElement('div', { 'data-testid': 'memory-router' }, children),
  Routes: ({ children }) => React.createElement('div', { 'data-testid': 'routes' }, children),
  Route: ({ element, path }) => React.createElement('div', { 'data-testid': `route-${path}` }, element),
  Navigate: ({ to, replace }) => React.createElement('div', { 'data-testid': 'navigate', 'data-to': to, 'data-replace': replace }),
  Link: ({ children, to, ...props }) => React.createElement('a', { href: to, ...props }, children),
  NavLink: ({ children, to, className, ...props }) => {
    const classNameValue = typeof className === 'function' ? className({ isActive: false }) : className;
    return React.createElement('a', { href: to, className: classNameValue, 'data-testid': `navlink-${to}`, ...props }, children);
  },
  
  // Export mocks for test access
  __mockNavigate: mockNavigate,
  __mockLocation: mockLocation,
  __mockParams: mockParams,
  __mockSetSearchParams: mockSetSearchParams,
};

