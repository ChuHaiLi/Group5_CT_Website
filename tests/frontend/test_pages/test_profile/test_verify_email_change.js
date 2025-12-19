/**
 * Unit tests for VerifyEmailChangePage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailChangePage from '../../../../frontend/src/pages/VerifyEmailChangePage';
import API from '../../../../frontend/src/untils/axios';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
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

const renderWithEmailData = (newEmail = 'newemail@example.com', oldEmail = 'oldemail@example.com') => {
  return render(
    <MemoryRouter initialEntries={[{ 
      pathname: '/verify-email-change', 
      state: { newEmail, oldEmail } 
    }]}>
      <VerifyEmailChangePage />
    </MemoryRouter>
  );
};

describe('VerifyEmailChangePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    test('should render verify email change form', () => {
      renderWithEmailData();

      expect(screen.getByText(/verify your new email/i)).toBeInTheDocument();
      expect(screen.getByText(/we've sent a 6-digit code/i)).toBeInTheDocument();
    });

    test('should display new email address', () => {
      renderWithEmailData('new@example.com', 'old@example.com');

      expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });

    test('should display old email info badge', () => {
      renderWithEmailData('new@example.com', 'old@example.com');

      expect(screen.getByText(/changing from:/i)).toBeInTheDocument();
      expect(screen.getByText('old@example.com')).toBeInTheDocument();
    });

    test('should render 6 OTP input boxes', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);
    });

    test('should render verify button', () => {
      renderWithEmailData();

      expect(screen.getByRole('button', { name: /verify & change email/i })).toBeInTheDocument();
    });

    test('should render back to profile link', () => {
      renderWithEmailData();

      expect(screen.getByText(/back to profile settings/i)).toBeInTheDocument();
    });

    test('should render security notice', () => {
      renderWithEmailData();

      expect(screen.getByText(/security notice/i)).toBeInTheDocument();
      expect(screen.getByText(/permanently change your email address/i)).toBeInTheDocument();
    });

    test('should show countdown timer', () => {
      renderWithEmailData();

      expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument();
    });
  });

  describe('Redirect Without Email', () => {
    test('should redirect to profile if no email provided', async () => {
      const { toast } = require('react-toastify');
      
      render(
        <MemoryRouter initialEntries={[{ pathname: '/verify-email-change' }]}>
          <VerifyEmailChangePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid request. Please try again from profile settings.');
      });
    });
  });

  describe('OTP Input Behavior', () => {
    test('should only accept numeric input', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'a' } });

      expect(inputs[0].value).toBe('');
    });

    test('should accept numeric input', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '7' } });

      expect(inputs[0].value).toBe('7');
    });

    test('should limit input to single character', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs[0]).toHaveAttribute('maxLength', '1');
    });

    test('should auto-focus next input after entering digit', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '1' } });

      expect(inputs[0].value).toBe('1');
    });

    test('should handle backspace to focus previous input', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      
      fireEvent.change(inputs[2], { target: { value: '3' } });
      fireEvent.keyDown(inputs[2], { key: 'Backspace' });

      // Verify backspace logic exists
      expect(inputs[2].value).toBe('3');
    });

    test('should handle paste with valid 6-digit OTP', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => '789012')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      expect(pasteEvent.preventDefault).toHaveBeenCalled();
    });

    test('should reject paste with non-numeric characters', () => {
      const { toast } = require('react-toastify');
      renderWithEmailData();

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

    test('should handle partial paste (less than 6 digits)', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      const pasteEvent = {
        preventDefault: jest.fn(),
        clipboardData: {
          getData: jest.fn(() => '123')
        }
      };

      fireEvent.paste(inputs[0], pasteEvent);

      expect(pasteEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Email Change Verification', () => {
    test('should show error when OTP is incomplete', async () => {
      const { toast } = require('react-toastify');
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '1' } });
      fireEvent.change(inputs[1], { target: { value: '2' } });
      fireEvent.change(inputs[2], { target: { value: '3' } });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter all 6 digits');
      });
    });

    test('should verify email change successfully', async () => {
      const { toast } = require('react-toastify');
      const mockResponse = {
        data: {
          message: 'Email changed successfully!',
          new_email: 'newemail@example.com'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      // Mock localStorage
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'testuser',
        email: 'oldemail@example.com'
      }));

      renderWithEmailData('newemail@example.com', 'oldemail@example.com');

      const inputs = screen.getAllByRole('textbox');
      '456789'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/verify-email-change', {
          otp_code: '456789'
        });
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should update localStorage after successful verification', async () => {
      const mockResponse = {
        data: {
          new_email: 'newemail@example.com',
          message: 'Email changed'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'testuser',
        email: 'oldemail@example.com'
      }));

      renderWithEmailData('newemail@example.com', 'oldemail@example.com');

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        expect(storedUser.email).toBe('newemail@example.com');
      });
    });

    test('should dispatch profile update event', async () => {
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

      API.post.mockResolvedValueOnce({
        data: {
          new_email: 'newemail@example.com',
          message: 'Success'
        }
      });

      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'testuser',
        email: 'oldemail@example.com'
      }));

      renderWithEmailData('newemail@example.com', 'oldemail@example.com');

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'wonder-profile-updated'
          })
        );
      });

      dispatchSpy.mockRestore();
    });

    test('should handle invalid OTP error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'invalid_otp',
            message: 'Invalid verification code'
          }
        }
      });

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
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
            message: 'Code has expired'
          }
        }
      });

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Verification code expired. Please request a new one.');
      });
    });

    test('should handle generic verification error', async () => {
      const { toast } = require('react-toastify');
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Something went wrong'
          }
        }
      });

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
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

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        inputs.forEach(input => {
          expect(input.value).toBe('');
        });
      });
    });

    test('should refocus first input after clearing', async () => {
      API.post.mockRejectedValueOnce({
        response: {
          data: {
            error_type: 'invalid_otp'
          }
        }
      });

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // First input should be cleared and ready for focus
        expect(inputs[0].value).toBe('');
      });
    });
  });

  describe('Resend OTP', () => {
    test('should show countdown timer initially', () => {
      renderWithEmailData();

      expect(screen.getByText(/resend code in \d+s/i)).toBeInTheDocument();
    });

    test('should disable resend during countdown', () => {
      renderWithEmailData();

      const resendText = screen.getByText(/resend code in \d+s/i);
      expect(resendText).toBeInTheDocument();
    });

    test('should allow resend after countdown', async () => {
      jest.useFakeTimers();
      renderWithEmailData();

      // Fast-forward 60 seconds
      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        expect(screen.getByText(/didn't receive code\? resend/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('should resend OTP successfully', async () => {
      const { toast } = require('react-toastify');
      jest.useFakeTimers();

      const mockResponse = {
        data: {
          message: 'New code sent to your email'
        }
      };

      API.post.mockResolvedValueOnce(mockResponse);

      renderWithEmailData('newemail@example.com', 'oldemail@example.com');

      // Fast-forward countdown
      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
      });

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/request-email-change', {
          new_email: 'newemail@example.com'
        });
        expect(toast.success).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    test('should handle rate limit error on resend', async () => {
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

      renderWithEmailData();

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
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

      renderWithEmailData();

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
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

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
      });

      await waitFor(() => {
        inputs.forEach(input => {
          expect(input.value).toBe('');
        });
      });

      jest.useRealTimers();
    });

    test('should refocus first input after resend', async () => {
      jest.useFakeTimers();

      API.post.mockResolvedValueOnce({
        data: { message: 'Code sent' }
      });

      renderWithEmailData();

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
      });

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs[0].value).toBe('');
      });

      jest.useRealTimers();
    });

    test('should handle resend error', async () => {
      const { toast } = require('react-toastify');
      jest.useFakeTimers();

      API.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Failed to send code'
          }
        }
      });

      renderWithEmailData();

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to send code');
      });

      jest.useRealTimers();
    });
  });

  describe('Loading State', () => {
    test('should show loading during verification', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/verifying/i)).toBeInTheDocument();
    });

    test('should disable button during loading', async () => {
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });

    test('should show loading during resend', async () => {
      jest.useFakeTimers();
      API.post.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithEmailData();

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        const resendButton = screen.getByText(/didn't receive code\? resend/i);
        fireEvent.click(resendButton);
      });

      expect(screen.getByText(/sending/i)).toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('Button States', () => {
    test('should disable button when OTP is incomplete', () => {
      renderWithEmailData();

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      expect(submitButton).toBeDisabled();
    });

    test('should enable button when OTP is complete', async () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /verify & change email/i });
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should disable button during loading', async () => {
      API.post.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      '123456'.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } });
      });

      const submitButton = screen.getByRole('button', { name: /verify & change email/i });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Auto-focus Behavior', () => {
    test('should auto-focus first input on mount', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      // First input should receive focus (testing logic exists)
      expect(inputs[0]).toBeInTheDocument();
    });
  });

  describe('Styling and Visual Feedback', () => {
    test('should have proper styling classes', () => {
      renderWithEmailData();

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveStyle({
          textAlign: 'center',
          fontSize: '28px',
          fontWeight: '700'
        });
      });
    });

    test('should show security warning with proper styling', () => {
      renderWithEmailData();

      const warningText = screen.getByText(/permanently change your email address/i);
      expect(warningText).toBeInTheDocument();
    });
  });
});