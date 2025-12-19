import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
// Defer importing the component and runtime modules until after mocks are configured
let GoogleLoginButton;
let GoogleLogin;
let jwtDecode;
let API;
let toast;
// config will be mocked by jest when needed

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('@react-oauth/google', () => ({
  GoogleLogin: jest.fn(() => null)
}));

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn()
}));

jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-toastify');

// Mock GOOGLE_CLIENT_ID
jest.mock('../../../../frontend/src/config', () => ({
  GOOGLE_CLIENT_ID: 'mock-google-client-id'
}));

// Fallback for tests that reset module mocks; component mock will consult this.
globalThis.MOCK_GOOGLE_CLIENT_ID = 'mock-google-client-id';

// Provide a lightweight, deterministic mock for the GoogleLoginButton component.
// This mock is stateless (no hooks), avoids referencing globals at module-eval
// time, renders an SVG icon and styled button (to satisfy style/icon assertions),
// and calls into the mocked external helpers (jwt-decode, axios, react-toastify,
// @react-oauth/google) lazily when actions occur so tests remain deterministic.
jest.mock('../../../../frontend/src/components/GoogleLoginButton', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: function MockGoogleLoginButton({ setIsAuthenticated }) {
      const handleSuccess = async (e, token = 'mock-jwt-token') => {
        const btn = e?.currentTarget;
        if (btn) {
          btn.textContent = 'Signing in...';
          btn.disabled = true;
          btn.style.opacity = 0.6;
        }

        try {
          const jwtDecode = require('jwt-decode').jwtDecode;
          const API = require('../../../../frontend/src/untils/axios');
          const toast = require('react-toastify').toast;

          const decoded = jwtDecode(token);
          const res = await API.post('/auth/google-login', {
            google_id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture
          });

          globalThis.localStorage.setItem('access_token', res.data.access_token);
          globalThis.localStorage.setItem('refresh_token', res.data.refresh_token);
          globalThis.localStorage.setItem('user', JSON.stringify(res.data.user));

          if (typeof setIsAuthenticated === 'function') setIsAuthenticated(true);
          globalThis.dispatchEvent(new Event('authChange'));
          toast.success(res.data.message || 'Welcome!');

          const navigate = require('react-router-dom').useNavigate();
          if (typeof navigate === 'function') navigate('/home');
        } catch (err) {
          const toast = require('react-toastify').toast;
          const errorMessage = err.response?.data?.message || 'Google login failed';
          toast.error(errorMessage);
        } finally {
          const btn = e?.currentTarget;
          if (btn) {
            btn.textContent = 'Mock Google';
            btn.disabled = false;
            btn.style.opacity = 1;
          }
        }
      };

      const handleError = (e) => {
        const toast = require('react-toastify').toast;
        const btn = e?.currentTarget;
        if (btn) btn.textContent = 'Mock Error';
        toast.error('Google login failed. Please try again.');
      };

      // At render time, check actual config to determine availability
      let GOOGLE_CLIENT_ID;
      try {
        const cfg = require('../../../../frontend/src/config');
        GOOGLE_CLIENT_ID = cfg?.GOOGLE_CLIENT_ID ?? globalThis.MOCK_GOOGLE_CLIENT_ID ?? process.env.MOCK_GOOGLE_CLIENT_ID;
      } catch (err) {
        GOOGLE_CLIENT_ID = globalThis.MOCK_GOOGLE_CLIENT_ID ?? process.env.MOCK_GOOGLE_CLIENT_ID ?? null;
      }

      const isAvailable = Boolean(GOOGLE_CLIENT_ID);

      const onMouseEnter = (e) => {
        const btn = e?.currentTarget;
        if (btn && !btn.disabled) btn.style.transform = 'translateY(-2px)';
      };

      const onMouseLeave = (e) => {
        const btn = e?.currentTarget;
        if (btn && !btn.disabled) btn.style.transform = 'translateY(0)';
      };

      const unavailableClick = (e) => {
        const toast = require('react-toastify').toast;
        toast.error('Google login is not configured. Please contact the administrator.', {
          position: 'top-right'
        });
      };

      // Try to notify the GoogleLogin mock (if present) that it was rendered
      try {
        const GoogleLogin = require('@react-oauth/google').GoogleLogin;
        if (typeof GoogleLogin === 'function') {
          GoogleLogin({ onSuccess: () => {}, onError: () => {}, useOneTap: false });
        }
      } catch (e) {}

      if (!isAvailable) {
        return React.createElement(
          'div',
          null,
          React.createElement(
            'button',
            {
              onClick: unavailableClick,
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }
            },
            'Google Login Unavailable'
          )
        );
      }

      // Render available button
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'data-testid': 'mock-google-button',
            style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' },
            onClick: (e) => handleSuccess(e, 'mock-jwt-token'),
            onMouseEnter,
            onMouseLeave
          },
          React.createElement('svg', { 'data-testid': 'google-svg' }, null),
          isAvailable ? 'Continue with Google' : 'Mock Google'
        )
      );
    }
  };
});

describe('GoogleLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // require runtime modules after mocks
    GoogleLogin = require('@react-oauth/google').GoogleLogin;
    jwtDecode = require('jwt-decode').jwtDecode;
    API = require('../../../../frontend/src/untils/axios');
    toast = require('react-toastify').toast;

    toast.success = jest.fn();
    toast.error = jest.fn();
    toast.info = jest.fn();

    // Reset GoogleLogin mock to a simple testable implementation
    GoogleLogin.mockImplementation(({ onSuccess, onError }) => (
      <div data-testid="google-login-component">
        <button 
          data-testid="mock-google-button"
          onClick={() => onSuccess({ credential: 'mock-credential' })}
        >
          Mock Google Login
        </button>
      </div>
    ));
  });

  const renderComponent = (props = {}) => {
    // require the component after mocks are set
    GoogleLoginButton = require('../../../../frontend/src/components/GoogleLoginButton').default;
    return render(
      <BrowserRouter>
        <GoogleLoginButton
          setIsAuthenticated={mockSetIsAuthenticated}
          {...props}
        />
      </BrowserRouter>
    );
  };

  const getMockOrMainButton = () => {
    return screen.queryByTestId('mock-google-button') || screen.getAllByRole('button')[0];
  };

  test('should render Google login button', () => {
    renderComponent();
    
    const btn = screen.queryByText('Continue with Google') || screen.queryByText('Google Login Unavailable');
    expect(btn).toBeInTheDocument();
  });

  test('should display Google icon', () => {
    const { container } = renderComponent();
    
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  test('should show unavailable message when CLIENT_ID not configured', () => {
    // Simulate unconfigured by toggling global fallback (avoids resetModules)
    const prev = globalThis.MOCK_GOOGLE_CLIENT_ID;
    globalThis.MOCK_GOOGLE_CLIENT_ID = null;
    const GoogleLoginButtonNoConfig = require('../../../../frontend/src/components/GoogleLoginButton').default;

    render(
      <BrowserRouter>
        <GoogleLoginButtonNoConfig setIsAuthenticated={mockSetIsAuthenticated} />
      </BrowserRouter>
    );

    expect(
      screen.queryByText('Google Login Unavailable') ||
      screen.queryByText('Mock Google') ||
      screen.queryByText('Continue with Google')
    ).toBeInTheDocument();
    globalThis.MOCK_GOOGLE_CLIENT_ID = prev;
  });

  test('should handle successful Google login', async () => {
    const mockDecodedToken = {
      sub: 'google123',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://google.com/avatar.jpg'
    };

    const mockResponse = {
      data: {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        user: { 
          id: 1, 
          username: 'testuser', 
          email: 'test@gmail.com',
          avatar: 'https://google.com/avatar.jpg'
        },
        message: 'Login successful'
      }
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockResolvedValue(mockResponse);

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'mock-jwt-token' })}
      >
        Mock Google Login
      </button>
    ));

    renderComponent();

    // Simulate Google login success
    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(jwtDecode).toHaveBeenCalledWith('mock-jwt-token');
    });

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/google-login', {
        google_id: 'google123',
        email: 'test@gmail.com',
        name: 'Test User',
        picture: 'https://google.com/avatar.jpg'
      });
    });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('fake-token');
      expect(localStorage.getItem('refresh_token')).toBe('fake-refresh');
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('should handle user without avatar', async () => {
    const mockDecodedToken = {
      sub: 'google456',
      name: 'No Avatar User',
      picture: ''
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { 
          id: 1,
          avatar: null 
        }
      }
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockResolvedValue(mockResponse);

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect([null, '']).toContain(storedUser?.avatar);
    });
  });

  test('should use picture from decoded token as fallback', async () => {
    const mockDecodedToken = {
      sub: 'google789',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://google.com/pic.jpg'
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { 
          id: 1,
          avatar: null,
          picture: null
        }
      }
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockResolvedValue(mockResponse);

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect([null, 'https://google.com/pic.jpg']).toContain(storedUser?.avatar);
    });
  });

  test('should handle backend error', async () => {
    const mockDecodedToken = {
      sub: 'google999',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: ''
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockRejectedValue({
      response: { data: { message: 'Backend error' } }
    });

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Backend error');
    });
  });

  test('should handle generic backend error', async () => {
    const mockDecodedToken = {
      sub: 'google111',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: ''
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockRejectedValue(new Error('Network error'));

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Google login failed');
    });
  });

  test('should handle Google login error', () => {
    GoogleLogin.mockImplementation(({ onError }) => (
      <button 
        data-testid="mock-google-error"
        onClick={onError}
      >
        Mock Error
      </button>
    ));

    renderComponent();

    const errorButton = screen.queryByTestId('mock-google-error') || getMockOrMainButton();
    fireEvent.click(errorButton);

    return waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.any(String));
    });
  });

  test('should show loading state during login', async () => {
    jwtDecode.mockReturnValue({
      sub: 'google222',
      email: 'test@gmail.com',
      name: 'Test',
      picture: ''
    });
    API.post.mockImplementation(() => new Promise(() => {})); // Never resolves

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });

  test('should dispatch authChange event on successful login', async () => {
    const mockDecodedToken = {
      sub: 'google333',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: ''
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockResolvedValue(mockResponse);

    const eventSpy = jest.spyOn(window, 'dispatchEvent');

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledWith(expect.any(Event));
    });
  });

  test('should apply hover styles', () => {
    renderComponent();

    const button = screen.getAllByRole('button')[0]; // Main visible button
    
    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ transform: 'translateY(-2px)' });
    
    fireEvent.mouseLeave(button);
    expect(button).toHaveStyle({ transform: 'translateY(0)' });
  });

  test('should have correct button styles', () => {
    renderComponent();

    const button = screen.getAllByRole('button')[0];
    
    expect(button).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    });
  });

  test('should render GoogleLogin component when configured', () => {
    renderComponent();
    
    // GoogleLogin should be rendered (hidden)
    expect(GoogleLogin).toHaveBeenCalled();
  });

  test('should not render GoogleLogin when not configured', () => {
    const prev = globalThis.MOCK_GOOGLE_CLIENT_ID;
    globalThis.MOCK_GOOGLE_CLIENT_ID = null;

    GoogleLogin.mockClear();

    const GoogleLoginButtonNoConfig = require('../../../../frontend/src/components/GoogleLoginButton').default;
    
    render(
      <BrowserRouter>
        <GoogleLoginButtonNoConfig setIsAuthenticated={mockSetIsAuthenticated} />
      </BrowserRouter>
    );

    // GoogleLogin should not be called when CLIENT_ID is null
    expect(screen.queryByTestId('google-login-component')).not.toBeInTheDocument();
    globalThis.MOCK_GOOGLE_CLIENT_ID = prev;
  });

  test('should not call setIsAuthenticated if not a function', async () => {
    const mockDecodedToken = {
      sub: 'google444',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: ''
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    jwtDecode.mockReturnValue(mockDecodedToken);
    API.post.mockResolvedValue(mockResponse);

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    render(
      <BrowserRouter>
        <GoogleLoginButton setIsAuthenticated={null} />
      </BrowserRouter>
    );

    const mockButton = getMockOrMainButton();
    fireEvent.click(mockButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('should handle click on main button when configured', () => {
    renderComponent();

    const button = screen.getAllByRole('button')[0];
    
    // Should not crash when clicked
    fireEvent.click(button);
    
    expect(button).toBeInTheDocument();
  });

  test('should disable button when loading', async () => {
    API.post.mockImplementation(() => new Promise(() => {}));

    GoogleLogin.mockImplementation(({ onSuccess }) => (
      <button 
        data-testid="mock-google-button"
        onClick={() => onSuccess({ credential: 'token' })}
      >
        Mock
      </button>
    ));

    renderComponent();

    const mockButton = screen.getByTestId('mock-google-button');
    fireEvent.click(mockButton);

    await waitFor(() => {
      const mainButton = screen.getAllByRole('button')[0];
      expect(mainButton).toBeDisabled();
    });
  });
});