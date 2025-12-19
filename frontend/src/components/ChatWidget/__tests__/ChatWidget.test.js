/**
 * Unit tests for ChatWidget component
 * Tests rendering, opening/closing, and message sending
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatWidget from '../ChatWidget';

// Mock API - define mocks inside factory to avoid hoisting issues
jest.mock('../../../untils/axios', () => {
  const mockGet = jest.fn(() => Promise.resolve({ data: [] }));
  const mockPost = jest.fn(() => Promise.resolve({ data: { reply: 'Mock response' } }));
  
  // Store for test access
  global.__mockChatWidgetGet = mockGet;
  global.__mockChatWidgetPost = mockPost;
  
  return {
    __esModule: true,
    default: {
      get: mockGet,
      post: mockPost,
    },
  };
});

// Mock chatWidgetEvents
jest.mock('../../../untils/chatWidgetEvents', () => ({
  subscribeToChatWidget: jest.fn(() => () => {}), // Returns unsubscribe function
  refreshChatWidgetHistory: jest.fn(),
  navigateToExplore: jest.fn(),
}));

// Mock toast
jest.mock('react-toastify', () => {
  const React = require('react');
  return {
    toast: {
      error: jest.fn(),
      success: jest.fn(),
    },
    ToastContainer: () => React.createElement('div', { 'data-testid': 'toast-container' }),
  };
});

describe('ChatWidget', () => {
  const mockPageContext = 'Test page context';
  let mockGet, mockPost;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = global.__mockChatWidgetGet;
    mockPost = global.__mockChatWidgetPost;
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: { reply: 'Mock response' } });
  });

  test('renders chat widget button when authenticated', () => {
    render(<ChatWidget isAuthenticated={true} pageContext={mockPageContext} />);

    const chatButton = screen.getByLabelText(/open chat widget/i);
    expect(chatButton).toBeInTheDocument();
  });

  test('renders chat widget button even when not authenticated', () => {
    // Component always renders button, isAuthenticated controls functionality
    render(<ChatWidget isAuthenticated={false} pageContext={mockPageContext} />);

    const chatButton = screen.getByLabelText(/open chat widget/i);
    expect(chatButton).toBeInTheDocument();
  });

  test('opens chat widget when button is clicked', async () => {
    render(<ChatWidget isAuthenticated={true} pageContext={mockPageContext} />);

    const chatButton = screen.getByLabelText(/open chat widget/i);
    fireEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a travel question/i)).toBeInTheDocument();
    });
  });

  test('sends message when form is submitted', async () => {
    const mockResponse = {
      data: {
        reply: 'Mock AI response',
      },
    };

    mockPost.mockResolvedValueOnce(mockResponse);

    render(<ChatWidget isAuthenticated={true} pageContext={mockPageContext} />);

    // Open chat widget
    const chatButton = screen.getByLabelText(/open chat widget/i);
    fireEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a travel question/i)).toBeInTheDocument();
    });

    // Type message
    const input = screen.getByPlaceholderText(/type a travel question/i);
    fireEvent.change(input, { target: { value: 'Hello' } });

    // Submit
    const sendButton = screen.getByLabelText(/send message/i);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });
  });

  test('closes chat widget when close button is clicked', async () => {
    render(<ChatWidget isAuthenticated={true} pageContext={mockPageContext} />);

    // Open chat widget
    const chatButton = screen.getByLabelText(/open chat widget/i);
    fireEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a travel question/i)).toBeInTheDocument();
    });

    // Find and click close button
    const closeButton = screen.getByLabelText(/close/i);
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/type a travel question/i)).not.toBeInTheDocument();
    });
  });
});
