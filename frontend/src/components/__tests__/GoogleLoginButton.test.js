/**
 * Unit tests for GoogleLoginButton component
 * Tests rendering and OAuth login flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GoogleLoginButton from '../GoogleLoginButton';
import API from '../../untils/axios';

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// react-toastify is mocked globally in setupTests.js
const { toast } = require('react-toastify');

// Mock @react-oauth/google
jest.mock('@react-oauth/google', () => {
  const React = require('react');
  return {
    GoogleLogin: ({ onSuccess, onError }) => {
      // Simulate success for testing
      return React.createElement('div', {
        'data-testid': 'google-login-component',
        onClick: () => {
          if (onSuccess) {
            onSuccess({
              credential: 'mock-google-jwt-token',
            });
          }
        },
      }, 'Google Login');
    },
  };
});

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(() => ({
    sub: 'google-user-id',
    email: 'user@gmail.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  })),
}));

// Mock config
jest.mock('../../config', () => ({
  GOOGLE_CLIENT_ID: 'mock-google-client-id',
}));

describe('GoogleLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    API.post.mockClear();
  });

  test('renders Google login button', () => {
    render(
      <MemoryRouter>
        <GoogleLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
  });

  test('handles successful Google login', async () => {
    const mockResponse = {
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'user@gmail.com',
        },
        message: 'Welcome!',
      },
    };

    API.post.mockResolvedValueOnce(mockResponse);

    render(
      <MemoryRouter>
        <GoogleLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    const googleLogin = screen.getByTestId('google-login-component');
    fireEvent.click(googleLogin);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/google-login', {
        google_id: 'google-user-id',
        email: 'user@gmail.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      });
    });

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'mock-access-token');
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('handles Google login error', async () => {
    const mockError = {
      response: {
        data: {
          message: 'Google login failed',
        },
      },
    };

    API.post.mockRejectedValueOnce(mockError);

    render(
      <MemoryRouter>
        <GoogleLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    const googleLogin = screen.getByTestId('google-login-component');
    fireEvent.click(googleLogin);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Google login failed');
    });
  });
});
