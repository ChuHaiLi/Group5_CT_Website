/**
 * Unit tests for Navbar component
 * Tests navigation rendering and authentication state
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar';
import API from '../../../untils/axios';

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// Mock useClickOutside hook
jest.mock('../../../hooks/useClickOutside', () => ({
  useClickOutside: jest.fn(),
}));

// Mock ProfileDropdown
jest.mock('../../Profile/ProfileDropdown', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'profile-dropdown' });
});

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    API.get.mockClear();
  });

  test('renders navbar with navigation links', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    // Check for navigation links
    expect(screen.getByTestId('navlink-/home')).toBeInTheDocument();
    expect(screen.getByTestId('navlink-/explore')).toBeInTheDocument();
    expect(screen.getByTestId('navlink-/mytrips')).toBeInTheDocument();
    expect(screen.getByTestId('navlink-/saved')).toBeInTheDocument();
  });

  test('shows login button when user is not authenticated', () => {
    localStorage.getItem = jest.fn(() => null);

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getByText(/login/i)).toBeInTheDocument();
  });

  test('fetches user data when token exists', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      avatar: 'https://example.com/avatar.jpg',
    };

    localStorage.getItem = jest.fn((key) => {
      if (key === 'access_token') return 'mock-token';
      return null;
    });

    API.get.mockResolvedValueOnce({ data: mockUser });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  test('loads user from localStorage on mount', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
    };

    localStorage.getItem = jest.fn((key) => {
      if (key === 'access_token') return 'mock-token';
      if (key === 'user') return JSON.stringify(mockUser);
      return null;
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(localStorage.getItem).toHaveBeenCalledWith('user');
  });
});
