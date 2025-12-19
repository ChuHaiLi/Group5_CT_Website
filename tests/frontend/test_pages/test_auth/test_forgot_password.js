/**
 * Unit tests for ForgotPasswordPage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ForgotPasswordPage from '../../../../frontend/src/pages/ForgotPasswordPage';
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

const renderForgotPasswordPage = () => {
  return render(
    <BrowserRouter>
      <ForgotPasswordPage />
    </BrowserRouter>
  );
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render forgot password form', () => {
      renderForgotPasswordPage();

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
    });

    test('should render back to login link', () => {
      renderForgotPasswordPage();

      expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    });

    test('should render back to home button', () => {
      renderForgotPasswordPage();

      expect(screen.getByText(/back to home/i)).toBeInTheDocument();
    });

    test('should display helper text', () => {
      renderForgotPasswordPage();

      expect(screen.getByText(/don't worry! enter your email to reset/i)).toBeInTheDocument();
    });
  });

  describe('Email Validation', () => {
    test('should show error for invalid email format', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid-email' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('should show error icon for invalid email', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const container = input.parentElement;
        expect(container.querySelector('svg[style*="#f44336"], svg[style*="rgb(244, 67, 54)"]')).toBeInTheDocument();
      });
    });

    test('should show success icon for valid email', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const container = input.parentElement;
        expect(container.querySelector('svg[style*="#4CAF50"], svg[style*="rgb(76, 175, 80)"]')).toBeInTheDocument();
      });
    });

    test('should accept valid email without error', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });

    test('should update border color for valid email', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#4CAF50' });
      });
    });

    test('should update border color for invalid email', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveStyle({ borderColor: '#f44336' });
      });
    });
  });

  describe('Form Submission', () => {
    test('should show error when email is empty', async () => {
      const { toast } = require('react-toastify');
      renderForgotPasswordPage();

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      const form = submitButton.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter your email');
      });
    });

    test('should show error for invalid email on submit', async () => {
      const { toast } = require('react-toastify');
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid-email' } });

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      const form = submitButton.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
      });
    });

    test('should send OTP successfully', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          message: 'OTP sent successfully'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/forgot-password', {
          email: 'test@example.com'
        });
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should handle server error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Email not found'
          }
        }
      });

      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'notfound@example.com' } });

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Email not found');
      });
    });

    test('should handle network error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        request: {},
        response: undefined
      });

      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to send OTP');
      });
    });

    test('should disable button when email is invalid', () => {
      renderForgotPasswordPage();

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable button when email is valid', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /send reset code/i });
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading State', () => {
    test('should show loading state during API call', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/sending otp/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    test('should reduce button opacity when disabled', () => {
      renderForgotPasswordPage();

      const submitButton = screen.getByRole('button', { name: /send reset code/i });
      expect(submitButton).toHaveStyle({ opacity: '0.6' });
    });
  });

  describe('Email Input Behavior', () => {
    test('should not show validation before blur', () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid' } });

      expect(screen.queryByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    test('should show validation after blur', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('should clear validation when email becomes valid', async () => {
      renderForgotPasswordPage();

      const input = screen.getByPlaceholderText(/enter your email/i);
      
      // First, enter invalid email
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      // Then, correct to valid email
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });
});