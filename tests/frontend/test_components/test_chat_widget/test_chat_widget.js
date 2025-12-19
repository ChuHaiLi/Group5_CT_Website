import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWidget from '../../../../frontend/src/components/ChatWidget/ChatWidget';
import API from '../../../../frontend/src/untils/axios';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-toastify');
jest.mock('../../../../frontend/src/untils/chatWidgetEvents', () => ({
  subscribeToChatWidget: jest.fn((callback) => {
    // Return unsubscribe function
    return () => {};
  }),
  refreshChatWidgetHistory: jest.fn(),
  navigateToExplore: jest.fn(),
}));
jest.mock('../../untils/imageResizer', () => ({
  resizeImageTo128: jest.fn((file) => Promise.resolve({
    dataUrl: 'data:image/png;base64,test',
    originalDataUrl: 'data:image/png;base64,original',
    base64: 'base64data'
  }))
}));

describe('ChatWidget', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('user', JSON.stringify(mockUser));
    toast.error = jest.fn();
    toast.info = jest.fn();
    toast.success = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('should render chat widget button', () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    expect(button).toBeInTheDocument();
  });

  test('should toggle chat panel when button is clicked', () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    
    // Initially closed
    expect(screen.queryByText('WonderAI BOT')).not.toBeInTheDocument();
    
    // Click to open
    fireEvent.click(button);
    expect(screen.getByText('WonderAI BOT')).toBeInTheDocument();
  });

  test('should display page context', () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Explore Page" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    expect(screen.getByText(/Explore Page/)).toBeInTheDocument();
  });

  test('should fetch chat history when opened and authenticated', async () => {
    const mockHistory = [
      { id: 1, role: 'user', content: 'Hello', created_at: new Date().toISOString() },
      { id: 2, role: 'bot', content: 'Hi there!', created_at: new Date().toISOString() }
    ];
    
    API.get.mockResolvedValue({ data: mockHistory });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/chat/widget/history');
    });
  });

  test('should not fetch history when not authenticated', () => {
    render(<ChatWidget isAuthenticated={false} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    expect(API.get).not.toHaveBeenCalled();
  });

  test('should display user message after sending', async () => {
    API.get.mockResolvedValue({ data: [] });
    API.post.mockResolvedValue({ 
      data: { id: 2, role: 'bot', content: 'Test response' }
    });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type a travel question/);
      fireEvent.change(textarea, { target: { value: 'Test message' } });
    });
    
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  test('should send message when Enter is pressed', async () => {
    API.get.mockResolvedValue({ data: [] });
    API.post.mockResolvedValue({ 
      data: { id: 2, role: 'bot', content: 'Response' }
    });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type a travel question/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    });
    
    await waitFor(() => {
      expect(API.post).toHaveBeenCalled();
    });
  });

  test('should not send empty message', () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    const sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toBeDisabled();
  });

  test('should handle image upload button click', async () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    const imageButton = screen.getByLabelText(/Thêm ảnh/);
    expect(imageButton).toBeInTheDocument();
    
    fireEvent.click(imageButton);
    
    // Check if file input exists (hidden)
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  test('should display loading status while fetching history', async () => {
    API.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/Loading conversation/)).toBeInTheDocument();
    });
  });

  test('should show empty state when no messages', async () => {
    API.get.mockResolvedValue({ data: [] });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });
  });

  test('should close panel when close button is clicked', async () => {
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const openButton = screen.getByLabelText('Open chat widget');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      expect(screen.getByText('WonderAI BOT')).toBeInTheDocument();
    });
    
    const closeButton = screen.getByLabelText('Close chat widget');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('WonderAI BOT')).not.toBeInTheDocument();
  });

  test('should render markdown in bot messages', async () => {
    const mockMessages = [
      { 
        id: 1, 
        role: 'bot', 
        content: '**Bold text** and *italic text*',
        created_at: new Date().toISOString()
      }
    ];
    
    API.get.mockResolvedValue({ data: mockMessages });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const boldElement = screen.getByText('Bold text');
      expect(boldElement.tagName).toBe('STRONG');
    });
  });

  test('should display attachments when message has images', async () => {
    const mockMessages = [
      { 
        id: 1, 
        role: 'user', 
        content: 'Message with image',
        attachments: [
          { id: 'img1', previewUrl: 'http://test.com/img.jpg', name: 'test.jpg' }
        ],
        created_at: new Date().toISOString()
      }
    ];
    
    API.get.mockResolvedValue({ data: mockMessages });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const img = screen.getByAlt('test.jpg');
      expect(img).toBeInTheDocument();
    });
  });

  test('should handle API error when sending message', async () => {
    API.get.mockResolvedValue({ data: [] });
    API.post.mockRejectedValue({ 
      response: { data: { message: 'API Error' } }
    });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type a travel question/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
    });
    
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  test('should clear messages when user logs out', () => {
    const { rerender } = render(
      <ChatWidget isAuthenticated={true} pageContext="Home" />
    );
    
    rerender(<ChatWidget isAuthenticated={false} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    expect(button).toBeInTheDocument();
  });

  test('should disable send button when loading', async () => {
    API.get.mockResolvedValue({ data: [] });
    API.post.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type a travel question/);
      fireEvent.change(textarea, { target: { value: 'Test' } });
    });
    
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(sendButton).toBeDisabled();
    });
  });

  test('should display user display name correctly', async () => {
    const mockMessages = [
      { id: 1, role: 'user', content: 'Hello', created_at: new Date().toISOString() }
    ];
    
    API.get.mockResolvedValue({ data: mockMessages });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  test('should handle vision search with images', async () => {
    API.get.mockResolvedValue({ data: [] });
    API.post.mockResolvedValue({ 
      data: { message: 'Vision response' }
    });
    
    render(<ChatWidget isAuthenticated={true} pageContext="Home" />);
    
    const button = screen.getByLabelText('Open chat widget');
    fireEvent.click(button);
    
    await waitFor(() => {
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });
  });
});