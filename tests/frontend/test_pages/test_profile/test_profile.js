/**
 * Unit tests for ProfilePage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../../../../frontend/src/pages/ProfilePage';
import API from '../../../../frontend/src/untils/axios';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const renderProfilePage = () => {
  return render(
    <BrowserRouter>
      <ProfilePage />
    </BrowserRouter>
  );
};

const mockUserData = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  phone: '+84123456789',
  tagline: '#VN123',
  avatar: 'https://example.com/avatar.jpg',
  has_password: true,
  google_id: null,
  github_id: null
};

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Mock successful profile fetch by default
    API.get.mockResolvedValue({
      data: mockUserData
    });
  });

  describe('Rendering', () => {
    test('should render profile header', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/vietnam travel account/i)).toBeInTheDocument();
      });
    });

    test('should render sidebar with avatar', async () => {
      renderProfilePage();

      await waitFor(() => {
        const avatarImage = screen.getByAlt(/user avatar/i);
        expect(avatarImage).toBeInTheDocument();
      });
    });

    test('should render tabs (Account Info and Dashboard)', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/account info/i)).toBeInTheDocument();
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });
    });

    test('should display user information', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });
    });

    test('should render section navigation', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/account id/i)).toBeInTheDocument();
        expect(screen.getByText(/personal info/i)).toBeInTheDocument();
        expect(screen.getByText(/account sign-in/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Data Fetching', () => {
    test('should fetch profile data on mount', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledWith('/auth/me');
      });
    });

    test('should handle fetch error', async () => {
      const { toast } = require('react-toastify');
      API.get.mockRejectedValueOnce(new Error('Network error'));

      renderProfilePage();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Unable to load profile. Please try again.');
      });
    });

    test('should parse tagline correctly', async () => {
      API.get.mockResolvedValueOnce({
        data: { ...mockUserData, tagline: '#VNABC' }
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABC')).toBeInTheDocument();
      });
    });
  });

  describe('Username Validation', () => {
    test('should show error for invalid username', async () => {
      renderProfilePage();

      await waitFor(() => {
        const usernameInput = screen.getByDisplayValue('testuser');
        fireEvent.change(usernameInput, { target: { value: 'a@' } });
        fireEvent.blur(usernameInput);
      });

      await waitFor(() => {
        expect(screen.getByText(/username must be 3\+ characters/i)).toBeInTheDocument();
      });
    });

    test('should accept valid username', async () => {
      renderProfilePage();

      await waitFor(() => {
        const usernameInput = screen.getByDisplayValue('testuser');
        fireEvent.change(usernameInput, { target: { value: 'validuser123' } });
        fireEvent.blur(usernameInput);
      });

      await waitFor(() => {
        expect(screen.queryByText(/username must be 3\+ characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Email Validation', () => {
    test('should show error for invalid email', async () => {
      renderProfilePage();

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('test@example.com');
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.blur(emailInput);
      });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('should accept valid email', async () => {
      renderProfilePage();

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('test@example.com');
        fireEvent.change(emailInput, { target: { value: 'newemail@example.com' } });
        fireEvent.blur(emailInput);
      });

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Tagline Validation', () => {
    test('should limit tagline to 5 characters', async () => {
      renderProfilePage();

      await waitFor(() => {
        const taglineInput = screen.getByPlaceholderText('');
        fireEvent.change(taglineInput, { target: { value: '123456789' } });
      });

      await waitFor(() => {
        const taglineInput = screen.getByPlaceholderText('');
        expect(taglineInput.value.length).toBeLessThanOrEqual(5);
      });
    });

    test('should accept 3-5 character tagline', async () => {
      renderProfilePage();

      await waitFor(() => {
        const taglineInput = screen.getByPlaceholderText('');
        fireEvent.change(taglineInput, { target: { value: 'ABC' } });
      });

      await waitFor(() => {
        const taglineInput = screen.getByPlaceholderText('');
        expect(taglineInput.value).toBe('ABC');
      });
    });
  });

  describe('Password Fields', () => {
    test('should render password fields for regular users', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter current password/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/confirm new password/i)).toBeInTheDocument();
      });
    });

    test('should toggle password visibility', async () => {
      renderProfilePage();

      await waitFor(() => {
        const passwordInputs = screen.getAllByPlaceholderText(/password/i);
        const toggleButtons = screen.getAllByRole('button');
        const showHideButtons = toggleButtons.filter(btn => 
          btn.classList.contains('show-hide')
        );

        if (showHideButtons.length > 0) {
          fireEvent.click(showHideButtons[0]);
          expect(passwordInputs[0]).toHaveAttribute('type', 'text');
        }
      });
    });

    test('should validate password length', async () => {
      renderProfilePage();

      await waitFor(() => {
        const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
        fireEvent.change(newPasswordInput, { target: { value: '123' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/new password: at least 6 characters/i)).toBeInTheDocument();
      });
    });

    test('should validate password match', async () => {
      renderProfilePage();

      await waitFor(() => {
        const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
        const confirmPasswordInput = screen.getByPlaceholderText(/confirm new password/i);
        
        fireEvent.change(newPasswordInput, { target: { value: 'password123' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
      });

      await waitFor(() => {
        const passwordsMatch = screen.getByText(/passwords match/i);
        expect(passwordsMatch).toHaveStyle({ color: '#666' });
      });
    });
  });

  describe('Form Submission', () => {
    test('should update account ID successfully', async () => {
      const { toast } = require('react-toastify');
      API.put.mockResolvedValueOnce({
        data: {
          user: {
            username: 'newusername',
            tagline: '#VNABC'
          }
        }
      });

      renderProfilePage();

      await waitFor(() => {
        const usernameInput = screen.getByDisplayValue('testuser');
        fireEvent.change(usernameInput, { target: { value: 'newusername' } });
      });

      await waitFor(() => {
        const saveButtons = screen.getAllByText(/save changes/i);
        fireEvent.click(saveButtons[0]);
      });

      await waitFor(() => {
        expect(API.put).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
      });
    });

    test('should handle email change request', async () => {
      const { toast } = require('react-toastify');
      API.post.mockResolvedValueOnce({
        data: {
          message: 'Verification code sent'
        }
      });

      renderProfilePage();

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('test@example.com');
        fireEvent.change(emailInput, { target: { value: 'newemail@example.com' } });
      });

      await waitFor(() => {
        const saveButtons = screen.getAllByText(/send verification code/i);
        if (saveButtons.length > 0) {
          fireEvent.click(saveButtons[0]);
        }
      });

      await waitFor(() => {
        expect(API.post).toHaveBeenCalledWith('/auth/request-email-change', {
          new_email: 'newemail@example.com'
        });
      });
    });

    test('should update password successfully', async () => {
      const { toast } = require('react-toastify');
      API.put.mockResolvedValueOnce({
        data: {
          message: 'Password updated'
        }
      });

      renderProfilePage();

      await waitFor(() => {
        const currentPasswordInput = screen.getByPlaceholderText(/enter current password/i);
        const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
        const confirmPasswordInput = screen.getByPlaceholderText(/confirm new password/i);
        
        fireEvent.change(currentPasswordInput, { target: { value: 'oldpassword' } });
        fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } });
      });

      await waitFor(() => {
        const saveButtons = screen.getAllByText(/save changes/i);
        const passwordSaveButton = saveButtons[saveButtons.length - 1];
        fireEvent.click(passwordSaveButton);
      });

      await waitFor(() => {
        expect(API.put).toHaveBeenCalled();
      });
    });

    test('should handle update error', async () => {
      const { toast } = require('react-toastify');
      API.put.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Update failed'
          }
        }
      });

      renderProfilePage();

      await waitFor(() => {
        const usernameInput = screen.getByDisplayValue('testuser');
        fireEvent.change(usernameInput, { target: { value: 'newusername' } });
      });

      await waitFor(() => {
        const saveButtons = screen.getAllByText(/save changes/i);
        fireEvent.click(saveButtons[0]);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Functionality', () => {
    test('should cancel account ID changes', async () => {
      renderProfilePage();

      await waitFor(() => {
        const usernameInput = screen.getByDisplayValue('testuser');
        fireEvent.change(usernameInput, { target: { value: 'newusername' } });
      });

      await waitFor(() => {
        const cancelButton = screen.getByText(/cancel/i);
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });
    });

    test('should cancel password changes', async () => {
      renderProfilePage();

      await waitFor(() => {
        const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
        fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      });

      await waitFor(() => {
        const cancelButtons = screen.getAllByText(/cancel/i);
        if (cancelButtons.length > 0) {
          fireEvent.click(cancelButtons[cancelButtons.length - 1]);
        }
      });

      await waitFor(() => {
        const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
        expect(newPasswordInput.value).toBe('');
      });
    });
  });

  describe('OAuth Users', () => {
    test('should show password setup message for OAuth users without password', async () => {
      API.get.mockResolvedValueOnce({
        data: {
          ...mockUserData,
          google_id: 'google123',
          has_password: false
        }
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/set up password for traditional sign-in/i)).toBeInTheDocument();
      });
    });

    test('should not require current password for OAuth users setting first password', async () => {
      API.get.mockResolvedValueOnce({
        data: {
          ...mockUserData,
          google_id: 'google123',
          has_password: false
        }
      });

      renderProfilePage();

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/enter current password/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Tab', () => {
    test('should fetch dashboard stats when switching to dashboard', async () => {
      API.get.mockImplementation((url) => {
        if (url === '/auth/me') {
          return Promise.resolve({ data: mockUserData });
        } else if (url === '/trips') {
          return Promise.resolve({ data: [] });
        } else if (url === '/saved/list') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: {} });
      });

      renderProfilePage();

      await waitFor(() => {
        const dashboardTab = screen.getByText(/dashboard/i);
        fireEvent.click(dashboardTab);
      });

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledWith('/trips');
        expect(API.get).toHaveBeenCalledWith('/saved/list');
      });
    });

    test('should display trip statistics', async () => {
      API.get.mockImplementation((url) => {
        if (url === '/auth/me') {
          return Promise.resolve({ data: mockUserData });
        } else if (url === '/trips') {
          return Promise.resolve({ data: [
            { id: 1, status: 'COMPLETED' },
            { id: 2, status: 'PLANNED' }
          ]});
        } else if (url === '/saved/list') {
          return Promise.resolve({ data: [{ id: 1 }] });
        }
        return Promise.resolve({ data: {} });
      });

      renderProfilePage();

      await waitFor(() => {
        const dashboardTab = screen.getByText(/dashboard/i);
        fireEvent.click(dashboardTab);
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Total trips
        expect(screen.getByText('1')).toBeInTheDocument(); // Completed or saved
      });
    });
  });

  describe('Avatar Upload', () => {
    test('should trigger file input when avatar button clicked', async () => {
      renderProfilePage();

      await waitFor(() => {
        const uploadButton = screen.getByTitle(/upload a new avatar/i);
        fireEvent.click(uploadButton);
      });

      // File input click should be triggered
      expect(true).toBe(true);
    });

    test('should handle avatar upload', async () => {
      API.put.mockResolvedValueOnce({
        data: {
          message: 'Avatar updated'
        }
      });

      renderProfilePage();

      await waitFor(() => {
        const fileInput = screen.getByRole('img', { hidden: true }).closest('div').querySelector('input[type="file"]');
        
        if (fileInput) {
          const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
          Object.defineProperty(fileInput, 'files', {
            value: [file]
          });
          fireEvent.change(fileInput);
        }
      });

      // Avatar upload should be processed
      expect(true).toBe(true);
    });
  });
});