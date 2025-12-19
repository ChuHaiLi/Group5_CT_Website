import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserSettingsPage } from '../UserSettingsPage';

// Mock child components
jest.mock('../../components/Profile/SidebarNavigation', () => ({
  SidebarNavigation: ({ active }: any) => (
    <div data-testid="sidebar-navigation" data-active={active}>
      Sidebar
    </div>
  ),
}));

jest.mock('../../components/Profile/AvatarUpload', () => ({
  AvatarUpload: ({ avatarUrl, onChange }: any) => (
    <div data-testid="avatar-upload">
      <img src={avatarUrl} alt="avatar" />
      <button onClick={() => onChange(null, 'new-avatar-url')}>
        Change Avatar
      </button>
    </div>
  ),
}));

describe('UserSettingsPage', () => {
  beforeEach(() => {
    // Mock console.log to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should render page title', () => {
    render(<UserSettingsPage />);
    
    expect(screen.getByText('User Settings')).toBeInTheDocument();
  });

  test('should render page description', () => {
    render(<UserSettingsPage />);
    
    expect(screen.getByText(/Manage your profile, security, and contact preferences/)).toBeInTheDocument();
  });

  test('should render sidebar navigation with settings active', () => {
    render(<UserSettingsPage />);
    
    const sidebar = screen.getByTestId('sidebar-navigation');
    expect(sidebar).toHaveAttribute('data-active', 'settings');
  });

  test('should render avatar upload component', () => {
    render(<UserSettingsPage />);
    
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
  });

  test('should render username field with initial value', () => {
    render(<UserSettingsPage />);
    
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    expect(usernameInput).toBeInTheDocument();
    expect(usernameInput.value).toBe('john_doe');
  });

  test('should render email field with initial value', () => {
    render(<UserSettingsPage />);
    
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
    expect(emailInput.value).toBe('john.doe@example.com');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should render phone field with initial value', () => {
    render(<UserSettingsPage />);
    
    const phoneInput = screen.getByLabelText('Phone') as HTMLInputElement;
    expect(phoneInput).toBeInTheDocument();
    expect(phoneInput.value).toBe('+1 234 567 3900');
  });

  test('should render password field with initial value', () => {
    render(<UserSettingsPage />);
    
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput.value).toBe('password123');
  });

  test('should render Save Changes button', () => {
    render(<UserSettingsPage />);
    
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toHaveAttribute('type', 'submit');
  });

  test('should update username when input changes', () => {
    render(<UserSettingsPage />);
    
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { value: 'new_username' } });
    
    expect(usernameInput.value).toBe('new_username');
  });

  test('should update email when input changes', () => {
    render(<UserSettingsPage />);
    
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'new.email@example.com' } });
    
    expect(emailInput.value).toBe('new.email@example.com');
  });

  test('should update phone when input changes', () => {
    render(<UserSettingsPage />);
    
    const phoneInput = screen.getByLabelText('Phone') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '+1 999 888 7777' } });
    
    expect(phoneInput.value).toBe('+1 999 888 7777');
  });

  test('should update password when input changes', () => {
    render(<UserSettingsPage />);
    
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'newpassword456' } });
    
    expect(passwordInput.value).toBe('newpassword456');
  });

  test('should handle avatar change', () => {
    render(<UserSettingsPage />);
    
    const changeAvatarButton = screen.getByText('Change Avatar');
    fireEvent.click(changeAvatarButton);
    
    const avatar = screen.getByAltText('avatar');
    expect(avatar).toHaveAttribute('src', 'new-avatar-url');
  });

  test('should prevent default form submission', () => {
    render(<UserSettingsPage />);
    
    const form = screen.getByRole('button', { name: 'Save Changes' }).closest('form');
    const mockSubmit = jest.fn((e) => e.preventDefault());
    
    if (form) {
      form.onsubmit = mockSubmit;
      fireEvent.submit(form);
    }
    
    expect(mockSubmit).toHaveBeenCalled();
  });

  test('should log updated profile on save', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    render(<UserSettingsPage />);
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'updated_user' } });
    
    const form = screen.getByRole('button', { name: 'Save Changes' }).closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Updated user profile',
      expect.objectContaining({
        username: 'updated_user'
      })
    );
  });

  test('should have proper form structure', () => {
    const { container } = render(<UserSettingsPage />);
    
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveClass('grid', 'gap-6');
  });

  test('should have proper input styling', () => {
    render(<UserSettingsPage />);
    
    const usernameInput = screen.getByLabelText('Username');
    expect(usernameInput).toHaveClass('rounded-2xl', 'border', 'border-slate-200');
  });

  test('should have proper label styling', () => {
    const { container } = render(<UserSettingsPage />);
    
    const labels = container.querySelectorAll('label');
    labels.forEach(label => {
      expect(label).toHaveClass('text-sm', 'font-medium');
    });
  });

  test('should render all input fields with correct ids', () => {
    render(<UserSettingsPage />);
    
    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'username');
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('id', 'phone');
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'password');
  });

  test('should render all input fields with correct names', () => {
    render(<UserSettingsPage />);
    
    expect(screen.getByLabelText('Username')).toHaveAttribute('name', 'username');
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('name', 'phone');
    expect(screen.getByLabelText('Password')).toHaveAttribute('name', 'password');
  });

  test('should have proper page background', () => {
    const { container } = render(<UserSettingsPage />);
    
    const pageContainer = container.firstChild;
    expect(pageContainer).toHaveClass('min-h-screen', 'bg-[#F4F6FB]');
  });

  test('should have proper main content width', () => {
    const { container } = render(<UserSettingsPage />);
    
    const contentContainer = container.querySelector('.max-w-3xl');
    expect(contentContainer).toBeInTheDocument();
  });

  test('should render form in grid layout with avatar', () => {
    const { container } = render(<UserSettingsPage />);
    
    const gridSection = container.querySelector('section.grid');
    expect(gridSection).toBeInTheDocument();
  });

  test('should update multiple fields independently', () => {
    render(<UserSettingsPage />);
    
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    
    fireEvent.change(usernameInput, { target: { value: 'user1' } });
    fireEvent.change(emailInput, { target: { value: 'user1@test.com' } });
    
    expect(usernameInput.value).toBe('user1');
    expect(emailInput.value).toBe('user1@test.com');
  });

  test('should have proper button styling', () => {
    render(<UserSettingsPage />);
    
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toHaveClass('rounded-2xl', 'bg-[#3B82F6]', 'text-white');
  });

  test('should render password field with placeholder', () => {
    render(<UserSettingsPage />);
    
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('placeholder');
  });
});