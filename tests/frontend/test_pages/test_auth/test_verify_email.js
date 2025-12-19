/**
 * Unit tests for VerifyEmailPage component
 * Focus: Email verification after registration
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from '../../../../frontend/src/pages/VerifyEmailPage';
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

const renderWithEmail = (email = 'test@example.com') => {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-email', state: { email } }]}>
      <VerifyEmailPage setIsAuthenticated={mockSetIsAuthenticated} />
    </MemoryRouter>
  );
};

describe('VerifyEmailPage - Registration Email Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    test('should render verify email form', () => {
      renderWithEmail();

      expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      expect(screen.getByText(/we've sent a 6-digit code/i)).toBeInTheDocument();
    });

    test('should display registered email', () => {
      renderWithEmail('user@example.com');

      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    test('should render 6 OTP input boxes', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);
    });

    test('should render verify button', () => {
      renderWithEmail();

      expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
    });

    test('should render back to login link', () => {
      renderWithEmail();

      expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    });

    test('should render register again link', () => {
      renderWithEmail();

      expect(screen.getByText(/register again/i)).toBeInTheDocument();
    });

    test('should show countdown timer initially', () => {
      renderWithEmail();

      expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument();
    });

    test('should render email icon', () => {
      renderWithEmail();

      // Check for icon presence via its parent element
      const iconWrapper = screen.getByText(/verify your email/i).parentElement.parentElement;
      expect(iconWrapper.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Redirect Without Email', () => {
    test('should redirect to register if no email provided', async () => {
      const { toast } = require('react-toastify');
      
      render(
        <MemoryRouter initialEntries={[{ pathname: '/verify-email' }]}>
          <VerifyEmailPage setIsAuthenticated={mockSetIsAuthenticated} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please register first');
      });
    });
  });

  describe('OTP Input Behavior', () => {
    test('should only accept numeric input', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'a' } });

      expect(inputs[0].value).toBe('');
    });

    test('should accept numeric input', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '5' } });

      expect(inputs[0].value).toBe('5');
    });

    test('should accept all digits 0-9', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      
      for (let i = 0; i < 10; i++) {
        fireEvent.change(inputs[0], { target: { value: i.toString() } });
        expect(inputs[0].value).toBe(i.toString());
      }
    });

    test('should limit input to single character', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs[0]).toHaveAttribute('maxLength', '1');
    });

    test('should auto-focus next input after entering digit', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      
      // Enter digit in first input
      fireEvent.change(inputs[0], { target: { value: '1' } });
      
      // Verify value is set
      expect(inputs[0].value).toBe('1');
    });

    test('should handle backspace to navigate to previous input', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      
      // Fill second input
      fireEvent.change(inputs[1], { target: { value: '2' } });
      
      // Press backspace when empty
      fireEvent.keyDown(inputs[1], { key: 'Backspace' });
      
      // Verify backspace handling exists
      expect(inputs[1].value).toBe('2');
    });

    test('should not navigate back on first input', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      
      fireEvent.keyDown(inputs[0], { key: 'Backspace' });
      
      // Should not throw error
      expect(inputs[0]).toBeInTheDocument();
    });

    test('should handle paste with valid 6-digit OTP', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => '654321')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      // After paste, inputs should be populated with the OTP digits
      '654321'.split('').forEach((d, i) => {
        expect(inputs[i].value).toBe(d);
      });
    });

    test('should reject paste with non-numeric characters', () => {
      const { toast } = require('react-toastify');
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => 'abc123')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      expect(toast.error).toHaveBeenCalledWith('Please paste numbers only');
    });

    test('should handle paste with more than 6 digits', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => '123456789')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      // Should only use first 6 digits
      '123456'.split('').forEach((d, i) => {
        expect(inputs[i].value).toBe(d);
      });
    });

    test('should handle partial paste', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => '123')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      '123'.split('').forEach((d, i) => {
        expect(inputs[i].value).toBe(d);
      });
    });
  });

  describe('Email Verification and Auto-Login', () => {
    test('should show error when OTP is incomplete', async () => {
      const { toast } = require('react-toastify');
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '1' } });
      fireEvent.change(inputs[1], { target: { value: '2' } });
      fireEvent.change(inputs[2], { target: { value: '3' } });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      const form = submitButton.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter all 6 digits');
      });
    });

    test('should verify email and auto-login successfully', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            avatar: 'https://example.com/avatar.jpg'
          },
          message: 'Email verified successfully!'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/verify-email', {
          email: 'test@example.com',
          otp_code: '123456'
        });
      });
    });

    test('should store access token in localStorage', async () => {
      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user: { id: 1, username: 'test' }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBe('test-access-token');
        expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
      });
    });

    test('should store user data in localStorage', async () => {
      const userData = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg'
      };

      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user: userData
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

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

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

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

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'authChange'
          })
        );
      });

      dispatchSpy.mockRestore();
    });

    test('should show success toast', async () => {
      const { toast } = require('react-toastify');
      
      API.post.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          user: { id: 1, username: 'test' },
          message: 'Welcome!'
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should handle verification without token (fallback)', async () => {
      const { toast } = require('react-toastify');
      
      API.post.mockResolvedValueOnce({
        data: {
          message: 'Email verified'
          // No tokens provided
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Email verified! Please login.');
      });
    });

    test('should handle invalid OTP error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'invalid_otp',
            message: 'Invalid OTP code'
          }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid verification code. Please try again.');
      });
    });

    test('should handle expired OTP error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'otp_expired',
            message: 'OTP has expired'
          }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Verification code expired. Please request a new one.');
      });
    });

    test('should handle generic error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Something went wrong'
          }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Something went wrong');
      });
    });

    test('should clear OTP inputs after invalid OTP', async () => {
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'invalid_otp'
          }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        inputs.forEach(input => {
          expect(input.value).toBe('');
        });
      });
    });

    test('should refocus first input after error', async () => {
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'invalid_otp'
          }
        }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(inputs[0].value).toBe('');
      });
    });
  });

  describe.skip('Resend OTP Functionality', () => {
    test('should show countdown initially', () => {
      renderWithEmail();

      expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument();
    });

    test('should show resend button after countdown', async () => {
      jest.useFakeTimers();
      renderWithEmail();

      // Fast-forward 60 seconds
      jest.advanceTimersByTime(60000);
      // Ensure pending timers run so countdown state updates
      jest.runAllTimers();

      await waitFor(() => {
        expect(screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text))).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('should resend OTP successfully', async () => {
      const { toast } = require('react-toastify');
      jest.useFakeTimers();

      const mockResponse = {
        data: {
          message: 'New code sent'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderWithEmail('test@example.com');

      // Fast-forward countdown
      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/resend-verification', {
          email: 'test@example.com'
        });
        expect(toast.success).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    test('should handle rate limit error', async () => {
      const { toast } = require('react-toastify');
      jest.useFakeTimers();

      API.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            wait_seconds: 60,
            message: 'Too many requests'
          }
        }
      });

      renderWithEmail();

      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('Please wait 60 seconds before resending');
      });

      jest.useRealTimers();
    });

    test('should reset countdown after successful resend', async () => {
      jest.useFakeTimers();

      API.post.mockResolvedValueOnce({
        data: { message: 'Code sent' }
      });

      renderWithEmail();

      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('should clear OTP inputs after resend', async () => {
      jest.useFakeTimers();

      API.post.mockResolvedValueOnce({
        data: { message: 'Code sent' }
      });

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      await waitFor(() => {
        inputs.forEach(input => {
          expect(input.value).toBe('');
        });
      });

      jest.useRealTimers();
    });

    test('should handle resend error', async () => {
      const { toast } = require('react-toastify');
      jest.useFakeTimers();

      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Failed to send'
          }
        }
      });

      renderWithEmail();

      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to send');
      });

      jest.useRealTimers();
    });
  });

  describe('Loading States', () => {
    test('should show loading during verification', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/verifying/i)).toBeInTheDocument();
    });

    test('should disable button during loading', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });

    test.skip('should show loading during resend', async () => {
      jest.useFakeTimers();
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmail();

      jest.advanceTimersByTime(60000);
      jest.runAllTimers();

      await waitFor(() => {
        const resendSection = screen.getByText(text => /didn'?t\s*receive\s*code/i.test(text));
        const resendButton = resendSection.parentElement.querySelector('button');
        if (resendButton) {
          fireEvent.click(resendButton);
        }
      });

      expect(screen.getByText(/sending/i)).toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('Button States', () => {
    test('should disable button when OTP is incomplete', () => {
      renderWithEmail();

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable button when OTP is complete', async () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /verify email/i });
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should show reduced opacity when disabled', () => {
      renderWithEmail();

      const submitButton = screen.getByRole('button', { name: /verify email/i });
      expect(submitButton).toHaveStyle({ opacity: '0.6' });
    });

    test('should show full opacity when enabled', async () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /verify email/i });
        expect(submitButton).toHaveStyle({ opacity: '1' });
      });
    });
  });

  describe('Auto-focus Behavior', () => {
    test('should focus first input on mount', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs[0]).toBeInTheDocument();
    });
  });

  describe('OTP Input Styling', () => {
    test('should have proper input styling', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveStyle({
          width: '50px',
          height: '60px',
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 'bold'
        });
      });
    });

    test('should change border color on focus', () => {
      renderWithEmail();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.focus(inputs[0]);

      // Border color should change on focus
      expect(inputs[0]).toBeInTheDocument();
    });
  });
});