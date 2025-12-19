import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Navbar from '@/components/Navbar/Navbar';
import API from '@/untils/axios';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('../../untils/axios');
jest.mock('../../hooks/useClickOutside', () => ({
  useClickOutside: jest.fn()
}));

describe('Navbar', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    phone: '1234567890',
    avatar: 'https://example.com/avatar.jpg',
    tagline: '#Explorer'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );
  };

  test('should render logo', () => {
    renderComponent();
    
    const logo = screen.getByAltText('Logo');
    expect(logo).toBeInTheDocument();
  });

  test('should render all navigation links', () => {
    renderComponent();
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('MyTrips')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  test('should show Login and Register when not authenticated', () => {
    renderComponent();
    
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  test('should show ProfileDropdown when authenticated', () => {
    localStorage.setItem('access_token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    // ProfileDropdown should be rendered (check for avatar or username)
    const profileButton = screen.getByRole('button', { name: 'Profile menu' });
    expect(profileButton).toBeInTheDocument();
  });

  test('should fetch user data on mount when token exists', async () => {
    localStorage.setItem('access_token', 'fake-token');
    API.get.mockResolvedValue({ data: mockUser });
    
    renderComponent();
    
    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  test('should not fetch user data when no token', () => {
    renderComponent();
    
    expect(API.get).not.toHaveBeenCalled();
  });

  test('should handle API error gracefully', async () => {
    localStorage.setItem('access_token', 'fake-token');
    API.get.mockRejectedValue(new Error('API Error'));
    
    renderComponent();
    
    await waitFor(() => {
      expect(API.get).toHaveBeenCalled();
    });
    
    // Should not crash, should show login/register
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  test('should load user from localStorage on mount', () => {
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    // User should be loaded without API call
    expect(API.get).not.toHaveBeenCalled();
  });

  test('should handle corrupt localStorage data', () => {
    localStorage.setItem('user', 'invalid json');
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderComponent();
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should handle logout correctly', () => {
    localStorage.setItem('access_token', 'fake-token');
    localStorage.setItem('refresh_token', 'fake-refresh');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    const profileButton = screen.getByRole('button', { name: 'Profile menu' });
    fireEvent.click(profileButton);
    
    const logoutButton = screen.getByRole('button', { name: 'Logout' });
    fireEvent.click(logoutButton);
    
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('should update user on profile-updated event', async () => {
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    const updatedUser = { ...mockUser, username: 'newusername' };
    
    const event = new CustomEvent('wonder-profile-updated', { 
      detail: updatedUser 
    });
    window.dispatchEvent(event);
    
    await waitFor(() => {
      const profileButton = screen.getByRole('button', { name: 'Profile menu' });
      fireEvent.click(profileButton);
      expect(screen.getByText('newusername')).toBeInTheDocument();
    });
  });

  test('should preserve tagline from user data', () => {
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    const profileButton = screen.getByRole('button', { name: 'Profile menu' });
    fireEvent.click(profileButton);
    
    expect(screen.getByText('#Explorer')).toBeInTheDocument();
  });

  test('should default to #VN tagline when not provided', async () => {
    const userWithoutTagline = { ...mockUser, tagline: undefined };
    localStorage.setItem('access_token', 'fake-token');
    API.get.mockResolvedValue({ data: userWithoutTagline });
    
    renderComponent();
    
    await waitFor(() => {
      const profileButton = screen.getByRole('button', { name: 'Profile menu' });
      fireEvent.click(profileButton);
      expect(screen.getByText('#VN')).toBeInTheDocument();
    });
  });

  test('should cleanup API call on unmount', async () => {
    localStorage.setItem('access_token', 'fake-token');
    API.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const { unmount } = renderComponent();
    
    unmount();
    
    // Component should unmount without errors
    expect(API.get).toHaveBeenCalled();
  });

  test('should have correct navigation link structure', () => {
    renderComponent();
    
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
    
    const exploreLink = screen.getByText('Explore').closest('a');
    expect(exploreLink).toHaveAttribute('href', '/explore');
    
    const tripsLink = screen.getByText('MyTrips').closest('a');
    expect(tripsLink).toHaveAttribute('href', '/mytrips');
    
    const savedLink = screen.getByText('Saved').closest('a');
    expect(savedLink).toHaveAttribute('href', '/saved');
  });

  test('should render navigation icons', () => {
    const { container } = renderComponent();
    
    // Check for SVG icons (from react-icons)
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  test('should handle profile update with partial data', () => {
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    renderComponent();
    
    const partialUpdate = { username: 'updated' };
    
    const event = new CustomEvent('wonder-profile-updated', { 
      detail: partialUpdate 
    });
    window.dispatchEvent(event);
    
    // Should merge with existing user data
    const profileButton = screen.getByRole('button', { name: 'Profile menu' });
    fireEvent.click(profileButton);
    
    expect(screen.getByText('updated')).toBeInTheDocument();
  });

  test('should normalize user data from API', async () => {
    localStorage.setItem('access_token', 'fake-token');
    API.get.mockResolvedValue({ data: mockUser });
    
    renderComponent();
    
    await waitFor(() => {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect(storedUser).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        phone: mockUser.phone,
        avatar: mockUser.avatar,
        tagline: mockUser.tagline || '#VN'
      });
    });
  });
});