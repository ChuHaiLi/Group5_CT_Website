import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import GoogleLoginButton from '../../../../frontend/src/components/GoogleLoginButton';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import API from '../untils/axios';
import { toast } from 'react-toastify';
import * as config from '../../../../frontend/src/config/index';

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

jest.mock('../untils/axios');
jest.mock('react-toastify');

// Mock GOOGLE_CLIENT_ID
jest.mock('../config', () => ({
  GOOGLE_CLIENT_ID: 'mock-google-client-id'
}));

describe('GoogleLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    toast.success = jest.fn();
    toast.error = jest.fn();
    toast.info = jest.fn();
    
    // Reset GoogleLogin mock
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
    return render(
      <BrowserRouter>
        <GoogleLoginButton
          setIsAuthenticated={mockSetIsAuthenticated}
          {...props}
        />
      </BrowserRouter>
    );
  };

  test('should render Google login button', () => {
    renderComponent();
    
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  test('should display Google icon', () => {
    const { container } = renderComponent();
    
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  test('should show unavailable message when CLIENT_ID not configured', () => {
    // Override mock for this test
    jest.resetModules();
    jest.doMock('../config', () => ({
      GOOGLE_CLIENT_ID: null
    }));

    const GoogleLoginButtonNoConfig = require('../GoogleLoginButton').default;
    
    render(
      <BrowserRouter>
        <GoogleLoginButtonNoConfig setIsAuthenticated={mockSetIsAuthenticated} />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Google Login Unavailable')).toBeInTheDocument();
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
    const mockButton = screen.getByTestId('mock-google-button');
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
      email: 'noavatar@gmail.com',
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

    const mockButton = screen.getByTestId('mock-google-button');
    fireEvent.click(mockButton);

    await waitFor(() => {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect(storedUser.avatar).toBe('');
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

    const mockButton = screen.getByTestId('mock-google-button');
    fireEvent.click(mockButton);

    await waitFor(() => {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect(storedUser.avatar).toBe('https://google.com/pic.jpg');
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

    const mockButton = screen.getByTestId('mock-google-button');
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

    const mockButton = screen.getByTestId('mock-google-button');
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

    const errorButton = screen.getByTestId('mock-google-error');
    fireEvent.click(errorButton);

    expect(toast.error).toHaveBeenCalledWith('Google login failed. Please try again.');
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

    const mockButton = screen.getByTestId('mock-google-button');
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

    const mockButton = screen.getByTestId('mock-google-button');
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
    jest.resetModules();
    jest.doMock('../config', () => ({
      GOOGLE_CLIENT_ID: null
    }));

    GoogleLogin.mockClear();

    const GoogleLoginButtonNoConfig = require('../GoogleLoginButton').default;
    
    render(
      <BrowserRouter>
        <GoogleLoginButtonNoConfig setIsAuthenticated={mockSetIsAuthenticated} />
      </BrowserRouter>
    );
    
    // GoogleLogin should not be called when CLIENT_ID is null
    expect(screen.queryByTestId('google-login-component')).not.toBeInTheDocument();
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

    const mockButton = screen.getByTestId('mock-google-button');
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