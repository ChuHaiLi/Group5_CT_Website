/**
 * Unit tests for RegisterPage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegisterPage from '../../../frontend/src/pages/RegisterPage';
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
  },
}));

const mockSetIsAuthenticated = jest.fn();

const renderRegisterPage = () => {
  return render(
    <BrowserRouter>
      <RegisterPage setIsAuthenticated={mockSetIsAuthenticated} />
    </BrowserRouter>
  );
};

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    test('should render registration form with all fields', () => {
      renderRegisterPage();

      expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^email$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^password \(min 6 characters\)/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /begin adventure/i })).toBeInTheDocument();
    });

    test('should render social registration buttons', () => {
      renderRegisterPage();

      expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
      expect(screen.getByText(/continue with github/i)).toBeInTheDocument();
    });

    test('should render link to login', () => {
      renderRegisterPage();

      expect(screen.getByText(/login here/i)).toBeInTheDocument();
    });
  });

  describe('Username Validation', () => {
    test('should show error for username less than 3 characters', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/username/i);
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid username/i)).toBeInTheDocument();
      });
    });

    test('should show error for username with invalid characters', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/username/i);
      fireEvent.change(input, { target: { value: 'user@name!' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid username/i)).toBeInTheDocument();
      });
    });

    test('should accept valid username', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/username/i);
      fireEvent.change(input, { target: { value: 'validuser123' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid username/i)).not.toBeInTheDocument();
      });
    });

    test('should accept username with dots, underscores, hyphens', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/username/i);
      fireEvent.change(input, { target: { value: 'user.name_123-test' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid username/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Email Validation', () => {
    test('should show error for invalid email', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/^email$/i);
      fireEvent.change(input, { target: { value: 'invalid-email' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('should accept valid email', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/^email$/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Validation', () => {
    test('should show error for password less than 6 characters', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/^password \(min 6 characters\)/i);
      fireEvent.change(input, { target: { value: '12345' } });

      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
      });
    });

    test('should show success for password with 6+ characters', async () => {
      renderRegisterPage();

      const input = screen.getByPlaceholderText(/^password \(min 6 characters\)/i);
      fireEvent.change(input, { target: { value: 'password123' } });

      await waitFor(() => {
        const strengthBox = screen.getByText(/at least 6 characters/i);
        expect(strengthBox).toHaveStyle({ color: '#4CAF50' });
      });
    });

    test('should toggle password visibility', () => {
      renderRegisterPage();

      const passwordInput = screen.getByPlaceholderText(/^password \(min 6 characters\)/i);
      const toggleButtons = screen.getAllByRole('button');
      const passwordToggle = toggleButtons.find(btn => btn.classList.contains('show-hide'));

      expect(passwordInput).toHaveAttribute('type', 'password');

      if (passwordToggle) {
        fireEvent.click(passwordToggle);
        expect(passwordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  describe('Confirm Password Validation', () => {
    test('should show error when passwords do not match', async () => {
      renderRegisterPage();

      const passwordInput = screen.getByPlaceholderText(/^password \(min 6 characters\)/i);
      const confirmInput = screen.getByPlaceholderText(/confirm password/i);

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmInput, { target: { value: 'different123' } });

      await waitFor(() => {
        const matchText = screen.getByText(/passwords match/i);
        expect(matchText).toHaveStyle({ color: '#666' });
      });
    });

    test('should show success when passwords match', async () => {
      renderRegisterPage();

      const passwordInput = screen.getByPlaceholderText(/^password \(min 6 characters\)/i);
      const confirmInput = screen.getByPlaceholderText(/confirm password/i);

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmInput, { target: { value: 'password123' } });

      await waitFor(() => {
        const matchText = screen.getByText(/passwords match/i);
        expect(matchText).toHaveStyle({ color: '#4CAF50' });
      });
    });
  });

  describe('Form Submission', () => {
    test('should show error when fields are empty', async () => {
      const { toast } = require('react-toastify');
      renderRegisterPage();

      const submitButton = screen.getByRole('button', { name: /begin adventure/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
      });
    });

    test('should register successfully with valid data', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          message: 'Registration successful!',
          user: {
            id: 1,
            username: 'newuser',
            email: 'new@example.com'
          }
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderRegisterPage();

      fireEvent.change(screen.getByPlaceholderText(/username/i), {
        target: { value: 'newuser' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^email$/i), {
        target: { value: 'new@example.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^password \(min 6 characters\)/i), {
        target: { value: 'password123' }
      });
      fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
        target: { value: 'password123' }
      });

      const submitButton = screen.getByRole('button', { name: /begin adventure/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/register', {
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123'
        });
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should handle email already exists error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error_type: 'email_exists',
            message: 'Email already registered'
          }
        }
      });

      renderRegisterPage();

      fireEvent.change(screen.getByPlaceholderText(/username/i), {
        target: { value: 'testuser' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^email$/i), {
        target: { value: 'existing@example.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^password \(min 6 characters\)/i), {
        target: { value: 'password123' }
      });
      fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
        target: { value: 'password123' }
      });

      const submitButton = screen.getByRole('button', { name: /begin adventure/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'This email is already registered. Please login or use another email.'
        );
      });
    });

    test('should disable submit button when validation fails', () => {
      renderRegisterPage();

      const submitButton = screen.getByRole('button', { name: /begin adventure/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable submit button when all validations pass', async () => {
      renderRegisterPage();

      fireEvent.change(screen.getByPlaceholderText(/username/i), {
        target: { value: 'validuser' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^email$/i), {
        target: { value: 'valid@example.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^password \(min 6 characters\)/i), {
        target: { value: 'password123' }
      });
      fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
        target: { value: 'password123' }
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /begin adventure/i });
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading State', () => {
    test('should show loading state during registration', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderRegisterPage();

      fireEvent.change(screen.getByPlaceholderText(/username/i), {
        target: { value: 'testuser' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^email$/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/^password \(min 6 characters\)/i), {
        target: { value: 'password123' }
      });
      fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
        target: { value: 'password123' }
      });

      const submitButton = screen.getByRole('button', { name: /begin adventure/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    });
  });
});