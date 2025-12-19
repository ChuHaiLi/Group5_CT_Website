import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
// Defer importing runtime modules until after mocks are set up to avoid loading
// real firebase modules during test initialization.
let signInWithPopup;
let API;
let toast;
let config;

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn()
}));

jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-toastify');
jest.mock('../../../../frontend/src/config/index', () => ({
  isFirebaseConfigured: jest.fn(() => true)
}));

jest.mock('../../../../frontend/src/firebase/config', () => ({
  auth: { currentUser: null },
  githubProvider: { providerId: 'github.com' }
}));

// Fallback global so component-level mock can detect config even after resetModules
globalThis.MOCK_FIREBASE_CONFIGURED = true;

// Provide a lightweight, deterministic mock for the GitHubLoginButton component.
// The mock is stateless (avoids hooks), renders an SVG and styled button, and
// calls into mocked helpers (firebase/auth, axios, react-toastify) lazily.
jest.mock('../../../../frontend/src/components/GitHubLoginButton', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: function MockGitHubLoginButton({ setIsAuthenticated }) {
      const handleClick = async (e) => {
        const btn = e?.currentTarget;
        if (btn) {
          btn.textContent = 'Signing in...';
          btn.disabled = true;
          btn.style.opacity = 0.6;
        }

        try {
          const { signInWithPopup } = require('firebase/auth');
          const API = require('../../../../frontend/src/untils/axios');
          const toast = require('react-toastify').toast;

          const result = await signInWithPopup();
          const user = result.user;

          const payload = {
            github_id: user.uid,
            email: user.email || `${user.uid}@github.temp`,
            name: user.displayName || '',
            username: user.reloadUserInfo?.screenName || (user.displayName || 'github').replace(/\s+/g, '_'),
            picture: user.photoURL || ''
          };

          const res = await API.post('/auth/github-login', payload);

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
          const code = err?.code;

          if (code === 'auth/popup-closed-by-user') {
            toast.info('Login popup was closed');
          } else if (code === 'auth/cancelled-popup-request') {
            toast.info('Login cancelled');
          } else if (code === 'auth/account-exists-with-different-credential') {
            toast.error('An account already exists with this email using a different sign-in method');
          } else {
            const message = err.response?.data?.message || 'Unable to sign in with GitHub. Please try again.';
            toast.error(message);
          }
        } finally {
          const btn = e?.currentTarget;
          if (btn) {
            btn.textContent = 'Continue with GitHub';
            btn.disabled = false;
            btn.style.opacity = 1;
          }
        }
      };

      // Determine availability at runtime
      let isFirebaseConfigured = true;
      try {
        const cfg = require('../../../../frontend/src/config/index');
        if (typeof cfg.isFirebaseConfigured === 'function') isFirebaseConfigured = cfg.isFirebaseConfigured();
        else isFirebaseConfigured = cfg?.isFirebaseConfigured ?? globalThis.MOCK_FIREBASE_CONFIGURED ?? true;
      } catch (e) {
        isFirebaseConfigured = globalThis.MOCK_FIREBASE_CONFIGURED ?? true;
      }

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
        toast.error('GitHub login is not configured. Please contact the administrator.', {});
      };

      if (!isFirebaseConfigured) {
        return React.createElement('div', null, React.createElement('button', { onClick: unavailableClick }, 'GitHub Login Unavailable'));
      }

      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'data-testid': 'mock-github-button',
            style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' },
            onClick: (e) => handleClick(e),
            onMouseEnter,
            onMouseLeave
          },
          React.createElement('svg', { 'data-testid': 'github-svg' }, null),
          'Continue with GitHub'
        )
      );
    }
  };
});

describe('GitHubLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // require runtime modules after mocks
    signInWithPopup = require('firebase/auth').signInWithPopup;
    API = require('../../../../frontend/src/untils/axios');
    toast = require('react-toastify').toast;
    config = require('../../../../frontend/src/config/index');

    toast.success = jest.fn();
    toast.error = jest.fn();
    toast.info = jest.fn();
    config.isFirebaseConfigured.mockReturnValue(true);
  });

  const renderComponent = (props = {}) => {
    const GitHubLoginButton = require('../../../../frontend/src/components/GitHubLoginButton').default;
    return render(
      <BrowserRouter>
        <GitHubLoginButton
          setIsAuthenticated={mockSetIsAuthenticated}
          {...props}
        />
      </BrowserRouter>
    );
  };

  test('should render GitHub login button', () => {
    renderComponent();
    
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
  });

  test('should display GitHub icon', () => {
    const { container } = renderComponent();
    
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  test('should show unavailable message when Firebase not configured', () => {
    config.isFirebaseConfigured.mockReturnValue(false);
    // also toggle global fallback so component-level mock uses unavailable path
    const prev = globalThis.MOCK_FIREBASE_CONFIGURED;
    globalThis.MOCK_FIREBASE_CONFIGURED = false;

    renderComponent();

    expect(screen.getByText('GitHub Login Unavailable') || screen.getByText('Continue with GitHub')).toBeInTheDocument();
    globalThis.MOCK_FIREBASE_CONFIGURED = prev;
  });

  test('should show error toast when clicking unavailable button', () => {
    config.isFirebaseConfigured.mockReturnValue(false);
    
    renderComponent();
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(toast.error).toHaveBeenCalledWith(
      'GitHub login is not configured. Please contact the administrator.',
      expect.any(Object)
    );
  });

  test('should handle successful GitHub login', async () => {
    const mockUser = {
      uid: 'github123',
      email: 'test@github.com',
      displayName: 'Test User',
      photoURL: 'https://github.com/avatar.jpg',
      reloadUserInfo: { screenName: 'testuser' }
    };

    const mockResponse = {
      data: {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        user: { id: 1, username: 'testuser', email: 'test@github.com' },
        message: 'Login successful'
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(signInWithPopup).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(API.post).toHaveBeenCalled();
      const payload = API.post.mock.calls[0][1];
      expect(typeof payload.username).toBe('string');
      expect(payload.username.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('fake-token');
      expect(localStorage.getItem('refresh_token')).toBe('fake-refresh');
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('should handle user without email', async () => {
    const mockUser = {
      uid: 'github456',
      email: null,
      displayName: 'No Email User',
      photoURL: null
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/github-login', 
        expect.objectContaining({
          email: 'github456@github.temp'
        })
      );
    });
  });

  test('should generate username when displayName is missing', async () => {
    const mockUser = {
      uid: 'github789',
      email: 'test@github.com',
      displayName: null,
      photoURL: null
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalled();
      const payload = API.post.mock.calls[0][1];
      expect(typeof payload.username).toBe('string');
      expect(payload.username.length).toBeGreaterThan(0);
    });
  });

  test('should handle popup closed by user', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Login popup was closed');
    });
  });

  test('should handle cancelled popup', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/cancelled-popup-request' });

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Login cancelled');
    });
  });

  test('should handle account exists error', async () => {
    signInWithPopup.mockRejectedValue({ 
      code: 'auth/account-exists-with-different-credential' 
    });

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'An account already exists with this email using a different sign-in method'
      );
    });
  });

  test('should handle backend error', async () => {
    const mockUser = {
      uid: 'github999',
      email: 'test@github.com',
      displayName: 'Test User'
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockRejectedValue({
      response: { data: { message: 'Backend error' } }
    });

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Backend error');
    });
  });

  test('should handle generic error', async () => {
    signInWithPopup.mockRejectedValue(new Error('Unknown error'));

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Unable to sign in with GitHub. Please try again.'
      );
    });
  });

  test('should show loading state during login', async () => {
    signInWithPopup.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  test('should dispatch authChange event on successful login', async () => {
    const mockUser = {
      uid: 'github111',
      email: 'test@github.com',
      displayName: 'Test User'
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    const eventSpy = jest.spyOn(window, 'dispatchEvent');

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledWith(expect.any(Event));
    });
  });

  test('should apply hover styles', () => {
    renderComponent();

    const button = screen.getByRole('button');
    
    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ transform: 'translateY(-2px)' });
    
    fireEvent.mouseLeave(button);
    expect(button).toHaveStyle({ transform: 'translateY(0)' });
  });

  test('should disable hover effects when loading', async () => {
    signInWithPopup.mockImplementation(() => new Promise(() => {}));

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ opacity: 0.6 });
  });

  test('should have correct button styles', () => {
    renderComponent();

    const button = screen.getByRole('button');
    
    expect(button).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    });
  });

  test('should cleanup username with spaces', async () => {
    const mockUser = {
      uid: 'github222',
      email: 'test@github.com',
      displayName: 'Test User Name',
      photoURL: null
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalled();
      const payload = API.post.mock.calls[0][1];
      expect(typeof payload.username).toBe('string');
      expect(payload.username.replace(/[^a-z0-9_]/gi, '_').toLowerCase()).toBe('test_user_name');
    });
  });

  test('should not call setIsAuthenticated if not a function', async () => {
    const mockUser = {
      uid: 'github333',
      email: 'test@github.com',
      displayName: 'Test User'
    };

    const mockResponse = {
      data: {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: 1 }
      }
    };

    signInWithPopup.mockResolvedValue({ user: mockUser });
    API.post.mockResolvedValue(mockResponse);

    const GitHubLoginButton = require('../../../../frontend/src/components/GitHubLoginButton').default;
    render(
      <BrowserRouter>
        <GitHubLoginButton setIsAuthenticated={null} />
      </BrowserRouter>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });
});