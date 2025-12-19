/**
 * Unit tests for GitHubLoginButton component
 * Tests rendering and GitHub OAuth login flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GitHubLoginButton from '../GitHubLoginButton';
import API from '../../untils/axios';
import { signInWithPopup } from 'firebase/auth';

// firebase/config is mocked via __mocks__/firebase/config.js
// firebase/auth is mocked globally in setupTests.js

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// react-toastify is mocked globally in setupTests.js
const { toast } = require('react-toastify');

// Mock config
jest.mock('../../config', () => ({
  isFirebaseConfigured: () => true,
}));

describe('GitHubLoginButton', () => {
  const mockSetIsAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    API.post.mockClear();
    signInWithPopup.mockClear();
  });

  test('renders GitHub login button', () => {
    render(
      <MemoryRouter>
        <GitHubLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    expect(screen.getByText(/continue with github/i)).toBeInTheDocument();
  });

  test('handles successful GitHub login', async () => {
    const mockFirebaseUser = {
      uid: 'github-user-id',
      email: 'user@github.com',
      displayName: 'GitHub User',
      photoURL: 'https://example.com/avatar.jpg',
      reloadUserInfo: {
        screenName: 'githubuser',
      },
    };

    signInWithPopup.mockResolvedValueOnce({
      user: mockFirebaseUser,
    });

    const mockResponse = {
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: 1,
          username: 'githubuser',
          email: 'user@github.com',
        },
        message: 'Welcome!',
      },
    };

    API.post.mockResolvedValueOnce(mockResponse);

    render(
      <MemoryRouter>
        <GitHubLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    const githubButton = screen.getByText(/continue with github/i);
    fireEvent.click(githubButton);

    await waitFor(() => {
      expect(signInWithPopup).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/github-login', expect.objectContaining({
        github_id: 'github-user-id',
        email: 'user@github.com',
      }));
    });

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'mock-access-token');
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('handles GitHub login error', async () => {
    const mockError = {
      code: 'auth/popup-closed-by-user',
    };

    signInWithPopup.mockRejectedValueOnce(mockError);

    render(
      <MemoryRouter>
        <GitHubLoginButton setIsAuthenticated={mockSetIsAuthenticated} />
      </MemoryRouter>
    );

    const githubButton = screen.getByText(/continue with github/i);
    fireEvent.click(githubButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Login popup was closed');
    });
  });
});
