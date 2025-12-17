/**
 * Unit test for App component
 * Tests basic rendering without errors
 */

import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import API from './untils/axios';

// Mock firebase/config - use manual mock
jest.mock('./firebase/config');
jest.mock('../src/firebase/config', () => ({}), { virtual: true });

// Mock ChatWidget
jest.mock('./components/ChatWidget/ChatWidget', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'chat-widget' });
});

// react-router-dom is mocked via __mocks__/react-router-dom.js

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Mock API.get to return successful response
    API.get.mockResolvedValue({ data: { id: 1, username: 'testuser' } });
  });

  test('renders app without crashing', async () => {
    render(<App />);
    
    // Wait for async operations to complete
    await waitFor(() => {
      // App should render without errors
      // Check for a common element that should always be present
      expect(screen.getByTestId('chat-widget')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
