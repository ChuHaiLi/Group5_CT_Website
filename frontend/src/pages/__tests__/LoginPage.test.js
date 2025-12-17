/**
 * Unit tests for LoginPage component
 * Tests form rendering, validation, and API submission
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import API from '../../untils/axios';

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// react-toastify is mocked globally in setupTests.js
const { toast } = require('react-toastify');

// Mock OAuth components
jest.mock('../../components/GoogleLoginButton', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'google-login' });
});

jest.mock('../../components/GitHubLoginButton', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'github-login' });
});

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    API.post.mockClear();
  });

  test('renders login form with required fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('shows validation error when submitting empty form', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
    });
  });

  test('shows validation error for invalid email format', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email or username');
    });
  });

  test('shows validation error for short password', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Password must be at least 6 characters');
    });
  });

  test('calls API and navigates on successful login', async () => {
    const mockResponse = {
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: { id: 1, username: 'testuser', email: 'test@example.com' },
        message: 'Login successful',
      },
    };

    API.post.mockResolvedValueOnce(mockResponse);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'mock-access-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'mock-refresh-token');
      expect(toast.success).toHaveBeenCalledWith('Login successful');
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  test('handles login error with 403 email not verified', async () => {
    const mockError = {
      response: {
        status: 403,
        data: {
          error_type: 'email_not_verified',
          message: 'Please verify your email',
          email: 'test@example.com',
        },
      },
    };

    API.post.mockRejectedValueOnce(mockError);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith('Please verify your email');
      expect(mockNavigate).toHaveBeenCalledWith('/verify-email', {
        state: { email: 'test@example.com' },
      });
    });
  });

  test('handles login error with invalid credentials', async () => {
    const mockError = {
      response: {
        status: 401,
        data: {
          message: 'Invalid email or password',
        },
      },
    };

    API.post.mockRejectedValueOnce(mockError);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
    });
  });
});
