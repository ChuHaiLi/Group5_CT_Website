import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import GitHubLoginButton from '../../../../frontend/src/components/GitHubLoginButton';
import { signInWithPopup } from 'firebase/auth';
import API from '../../../../frontend/src/untils/axios';
import { toast } from 'react-toastify';
import * as config from '../../../../frontend/src/config/index';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn()
}));

jest.mock('../untils/axios');
jest.mock('react-toastify');
jest.mock('../config', () => ({
  isFirebaseConfigured: jest.fn(() => true)
}));

jest.mock('../firebase/config', () => ({
  auth: { currentUser: null },
  githubProvider: { providerId: 'github.com' }
}));

describe('GitHubLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    toast.success = jest.fn();
    toast.error = jest.fn();
    toast.info = jest.fn();
    config.isFirebaseConfigured.mockReturnValue(true);
  });

  const renderComponent = (props = {}) => {
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
    
    renderComponent();
    
    expect(screen.getByText('GitHub Login Unavailable')).toBeInTheDocument();
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
      expect(API.post).toHaveBeenCalledWith('/auth/github-login', {
        github_id: 'github123',
        email: 'test@github.com',
        name: 'Test User',
        username: 'testuser',
        picture: 'https://github.com/avatar.jpg'
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
      expect(API.post).toHaveBeenCalledWith('/auth/github-login', 
        expect.objectContaining({
          username: expect.stringMatching(/^github_/)
        })
      );
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
      expect(API.post).toHaveBeenCalledWith('/auth/github-login', 
        expect.objectContaining({
          username: 'test_user_name'
        })
      );
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