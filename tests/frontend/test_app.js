// src/__tests__/App.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import API from '@/untils/axios';

// Mock Firebase config
jest.mock('../../frontend/src/firebase/config', () => ({}));

// Mock components
jest.mock('../../frontend/src/components/Navbar/Navbar', () => {
  return function Navbar() {
    return <div data-testid="navbar">Navbar</div>;
  };
});

jest.mock('@/components/Footer/Footer', () => {
  return function Footer() {
    return <div data-testid="footer">Footer</div>;
  };
});

jest.mock('@/components/ChatWidget/ChatWidget', () => {
  return function ChatWidget() {
    return <div data-testid="chat-widget">ChatWidget</div>;
  };
});

jest.mock('@/pages/Home/HomePage', () => {
  return function HomePage() {
    return <div data-testid="home-page">Home Page</div>;
  };
});

jest.mock('@/pages/LoginPage', () => {
  return function LoginPage() {
    return <div data-testid="login-page">Login Page</div>;
  };
});

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Authentication Check', () => {
    test('should show checking authentication message initially', () => {
      API.get = jest.fn(() => new Promise(() => {})); // Never resolves
      
      render(<App />);
      
      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });

    test('should set authenticated when token is valid', async () => {
      localStorage.setItem('access_token', 'valid-token');
      API.get = jest.fn().mockResolvedValue({ data: { user: 'test' } });

      render(<App />);

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledWith('/auth/me');
      });
    });

    test('should clear tokens when authentication fails', async () => {
      localStorage.setItem('access_token', 'invalid-token');
      localStorage.setItem('refresh_token', 'refresh-token');
      localStorage.setItem('user', JSON.stringify({ id: 1 }));
      
      API.get = jest.fn().mockRejectedValue(new Error('Unauthorized'));

      render(<App />);

      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
      });
    });

    test('should not authenticate when no token exists', async () => {
      render(<App />);

      await waitFor(() => {
        expect(API.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Route Rendering', () => {
    test('should render HomePage on root path', async () => {
      API.get = jest.fn().mockResolvedValue({ data: { user: 'test' } });

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    test('should render LoginPage on /login path', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    test('should not show navbar on login page', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
      });
    });

    test('should show navbar on home page', async () => {
      API.get = jest.fn().mockResolvedValue({ data: { user: 'test' } });

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
      });
    });
  });

  describe('Saved Destinations Management', () => {
    test('should fetch saved destinations when authenticated', async () => {
      localStorage.setItem('access_token', 'valid-token');
      API.get = jest.fn()
        .mockResolvedValueOnce({ data: { user: 'test' } })
        .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] });

      render(<App />);

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledWith('/saved/list');
      });
    });

    test('should not fetch saved destinations when not authenticated', async () => {
      render(<App />);

      await waitFor(() => {
        const savedListCall = API.get.mock.calls.find(
          call => call[0] === '/saved/list'
        );
        expect(savedListCall).toBeUndefined();
      });
    });
  });

  describe('Page Context', () => {
    test('should provide page context to children', async () => {
      API.get = jest.fn().mockResolvedValue({ data: { user: 'test' } });

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });
  });

  describe('Auth Change Event Listener', () => {
    test('should re-authenticate on authChange event', async () => {
      API.get = jest.fn().mockResolvedValue({ data: { user: 'test' } });

      render(<App />);

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledTimes(0);
      });

      // Simulate auth change
      localStorage.setItem('access_token', 'new-token');
      window.dispatchEvent(new Event('authChange'));

      await waitFor(() => {
        expect(API.get).toHaveBeenCalledWith('/auth/me');
      });
    });
  });
});