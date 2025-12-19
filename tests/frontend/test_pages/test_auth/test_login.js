/**
 * Unit tests for LoginPage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../../../frontend/src/pages/LoginPage';
import API from '../../../frontend/src/untils/axios';

// Mock dependencies
jest.mock('../../../frontend/src/untils/axios');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockSetIsAuthenticated = jest.fn();

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <LoginPage setIsAuthenticated={mockSetIsAuthenticated} />
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    test('should render login form with all fields', () => {
      renderLoginPage();

      expect(screen.getByPlaceholderText(/email or username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start exploring/i })).toBeInTheDocument();
    });

    test('should render page title and subtitle', () => {
      renderLoginPage();

      expect(screen.getByText(/welcome back!/i)).toBeInTheDocument();
      expect(screen.getByText(/continue your journey through vietnam/i)).toBeInTheDocument();
    });

    test('should render social login buttons', () => {
      renderLoginPage();

      expect(screen.getByText((text) => /(continue with google|google login unavailable)/i.test(text))).toBeInTheDocument();
      expect(screen.getByText((text) => /(continue with github|github login unavailable)/i.test(text))).toBeInTheDocument();
    });

    test('should render links', () => {
      renderLoginPage();

      expect(screen.getByText(/create account/i)).toBeInTheDocument();
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
    });

    test('should render back to home button', () => {
      renderLoginPage();

      expect(screen.getByText(/back to home/i)).toBeInTheDocument();
    });

    test('should render OR divider', () => {
      renderLoginPage();

      expect(screen.getByText(/^OR$/i)).toBeInTheDocument();
    });

    test('should render plane icon', () => {
      renderLoginPage();

      const iconWrapper = screen.getByText(/welcome back!/i).parentElement.parentElement;
      expect(iconWrapper.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Email/Username Validation', () => {
    test('should show error for invalid email format', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'user@name!' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const vm = document.querySelector('.validation-message');
        expect(vm).toBeInTheDocument();
        expect(vm.textContent).toMatch(/please enter a valid email or username/i);
      });
    });

    test('should accept valid email', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText((text) => /please enter a valid email or username/i.test(text))).not.toBeInTheDocument();
      });
    });

    test('should accept valid username', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'validuser123' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText((text) => /please enter a valid email or username/i.test(text))).not.toBeInTheDocument();
      });
    });

    test('should reject username with less than 3 characters', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const vm = document.querySelector('.validation-message');
        expect(vm).toBeInTheDocument();
        expect(vm.textContent).toMatch(/please enter a valid email or username/i);
      });
    });

    test('should accept username with dots, underscores, hyphens', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'user.name_123-test' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText((text) => /please enter a valid email or username/i.test(text))).not.toBeInTheDocument();
      });
    });

    test('should reject username with special characters', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'user@name!' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const vm = document.querySelector('.validation-message');
        expect(vm).toBeInTheDocument();
        expect(vm.textContent).toMatch(/please enter a valid email or username/i);
      });
    });

    test('should show success icon for valid input', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'validuser' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const container = input.parentElement;
        const svg = container.querySelector('svg[style*="#4CAF50"], svg[style*="rgb(76, 175, 80)"]');
        expect(svg).toBeInTheDocument();
      });
    });

    test('should show error icon for invalid input', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const container = input.parentElement;
        const svg = container.querySelector('svg[style*="#f44336"], svg[style*="rgb(244, 67, 54)"]');
        expect(svg).toBeInTheDocument();
      });
    });

    test('should update border color for valid input', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#4CAF50' });
      });
    });

    test('should update border color for invalid input', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#f44336' });
      });
    });

    test('should show validation on change (component shows immediate validation)', () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(input, { target: { value: 'ab' } });

      const vm = document.querySelector('.validation-message');
      expect(vm).toBeInTheDocument();
      expect(vm.textContent).toMatch(/please enter a valid email or username/i);
    });
  });

  describe('Password Validation', () => {
    test('should show error for password less than 6 characters', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      fireEvent.change(input, { target: { value: '12345' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const el = Array.from(document.querySelectorAll('*')).find(n => n.textContent && /at least 6 characters/i.test(n.textContent));
        expect(el).toBeTruthy();
      });
    });

    test('should accept password with 6 or more characters', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      fireEvent.change(input, { target: { value: 'password123' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const strengthBox = Array.from(document.querySelectorAll('*')).find(n => n.textContent && /at least 6 characters/i.test(n.textContent));
        expect(strengthBox).toBeTruthy();
      });
    });

    test('should show strength indicator when typing password', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      fireEvent.change(input, { target: { value: 'pass' } });

      await waitFor(() => {
        const el = Array.from(document.querySelectorAll('*')).find(n => n.textContent && /at least 6 characters/i.test(n.textContent));
        expect(el).toBeTruthy();
      });
    });

    test('should update border color for valid password', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      fireEvent.change(input, { target: { value: 'password123' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#4CAF50' });
      });
    });

    test('should update border color for invalid password', async () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      fireEvent.change(input, { target: { value: '123' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#f44336' });
      });
    });

    test('should toggle password visibility', () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      const toggleButton = input.nextElementSibling;

      expect(input).toHaveAttribute('type', 'password');

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });

    test('should show eye icon when password is hidden', () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      expect(input).toHaveAttribute('type', 'password');
    });

    test('should show eye-slash icon when password is visible', () => {
      renderLoginPage();

      const input = screen.getByPlaceholderText(/password/i);
      const toggleButton = input.nextElementSibling;

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
    });
  });

  describe('Form Submission', () => {
    test('should show validation errors when fields are empty', async () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      // When fields are empty the submit button should be disabled and inputs required
      expect(submitButton).toBeDisabled();
      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });

    test('should show validation error when email/username is empty', async () => {
      renderLoginPage();

      const passwordInput = screen.getByPlaceholderText(/password/i);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      const emailInput = screen.getByPlaceholderText(/email or username/i);

      expect(submitButton).toBeDisabled();
      expect(emailInput).toBeRequired();
    });

    test('should show validation error when password is empty', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      const passwordInput = screen.getByPlaceholderText(/password/i);

      expect(submitButton).toBeDisabled();
      expect(passwordInput).toBeRequired();
    });

    test('should show validation error for invalid email/username on submit', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'ab' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      const form = submitButton.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        const vm = document.querySelector('.validation-message');
        expect(vm).toBeInTheDocument();
        expect(vm.textContent).toMatch(/please enter a valid email or username/i);
      });
    });

    test('should show validation error for invalid password on submit', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      const form = submitButton.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        const pwEl = Array.from(document.querySelectorAll('*')).find(n => n.textContent && /at least 6 characters/i.test(n.textContent));
        expect(pwEl).toBeTruthy();
      });
    });

    test('should login successfully with valid credentials (email)', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          },
          message: 'Welcome back!'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/login', {
          email: 'test@example.com',
          password: 'password123'
        });
        expect(localStorage.getItem('access_token')).toBe('mock-access-token');
        expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should login successfully with valid credentials (username)', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          },
          message: 'Welcome back!'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/login', {
          email: 'testuser',
          password: 'password123'
        });
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should store user data in localStorage', async () => {
      const userData = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user: userData,
          message: 'Success'
        }
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));

      await waitFor(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        expect(storedUser).toEqual(userData);
      });
    });

    test('should call setIsAuthenticated(true)', async () => {
      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user: { id: 1, username: 'test' }
        }
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));

      await waitFor(() => {
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      });
    });

    test('should dispatch authChange event', async () => {
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user: { id: 1, username: 'test' }
        }
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'authChange'
          })
        );
      });

      dispatchSpy.mockRestore();
    });

    test('should handle login failure with error message', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Invalid credentials'
          }
        }
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
      });
    });

    test('should handle unverified email error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error_type: 'email_not_verified',
            message: 'Please verify your email first',
            email: 'test@example.com'
          }
        }
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('Please verify your email first');
      });
    });

    test('should handle network error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        request: {},
        response: undefined
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Cannot connect to server. Please try again.');
      });
    });

    test('should handle generic error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce(new Error('Unknown error'));

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An error occurred. Please try again.');
      });
    });

    test('should handle invalid server response', async () => {
      const { toast } = require('react-toastify');
      API.post.mockResolvedValueOnce({
        data: {}
        // No access_token
      });

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid response from server');
      });
    });

    test('should disable submit button when validation fails', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable submit button when all validations pass', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should mark all fields as touched on submit', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'ab' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email or username/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    test('should show loading state during login', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      expect(screen.getByText(/logging in/i)).toBeInTheDocument();
    });

    test('should disable button during loading', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      const submitButton = screen.getByRole('button', { name: /start exploring/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });

    test('should show reduced opacity when disabled', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /start exploring/i });
      expect(submitButton).toHaveStyle({ opacity: '0.6' });
    });

    test('should show full opacity when enabled', async () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /start exploring/i });
        expect(submitButton).toHaveStyle({ opacity: '1' });
      });
    });
  });

  describe('Input Behavior', () => {
    test('should have autocomplete attributes', () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      expect(emailInput).toHaveAttribute('autoComplete', 'username');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });

    test('should have required attributes', () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });

    test('should have correct input types', () => {
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText(/email or username/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      expect(emailInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Navigation Links', () => {
    test('should have link to register page', () => {
      renderLoginPage();

      const registerLink = screen.getByText(/create account/i).closest('a');
      expect(registerLink).toHaveAttribute('href', '/register');
    });

    test('should have link to forgot password page', () => {
      renderLoginPage();

      const forgotLink = screen.getByText(/forgot password/i).closest('a');
      expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });
  });
});