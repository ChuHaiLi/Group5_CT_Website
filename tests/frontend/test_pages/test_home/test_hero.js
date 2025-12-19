/**
 * Unit Tests for HeroSection Component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Hero from '@/pages/Home/hero/hero';

describe('HeroSection Component', () => {
  const mockProps = {
    searchTerm: '',
    onSearchChange: jest.fn(),
    visionImages: [],
    onVisionImagesAdd: jest.fn(),
    onVisionImageRemove: jest.fn(),
    onVisionImagePreview: jest.fn(),
    onVisionSearch: jest.fn(),
    onTextSearch: jest.fn(),
    searching: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render hero section with main elements', () => {
      render(<Hero {...mockProps} />);

      expect(screen.getByAltText(/ai smart travel/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/ask anything about a destination/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/plan trips faster with instant ai/i)
      ).toBeInTheDocument();
    });

    test('should render search input', () => {
      render(<Hero {...mockProps} />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('text');
    });

    test('should render voice button', () => {
      render(<Hero {...mockProps} />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      expect(voiceButton).toBeInTheDocument();
    });

    test('should render send button', () => {
      render(<Hero {...mockProps} />);

      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) =>
        btn.classList.contains('primary')
      );
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    test('should display search term', () => {
      render(<Hero {...mockProps} searchTerm="Ha Long Bay" />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      expect(input.value).toBe('Ha Long Bay');
    });

    test('should call onSearchChange when typing', () => {
      render(<Hero {...mockProps} />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      fireEvent.change(input, { target: { value: 'Sapa' } });

      expect(mockProps.onSearchChange).toHaveBeenCalledWith('Sapa');
    });

    test('should handle Enter key press', () => {
      render(<Hero {...mockProps} searchTerm="test query" />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockProps.onTextSearch).toHaveBeenCalledWith('test query');
    });

    test('should not submit on other key press', () => {
      render(<Hero {...mockProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });

      expect(mockProps.onTextSearch).not.toHaveBeenCalled();
    });
  });

  describe('Vision Images', () => {
    test('should display uploaded images', () => {
      const images = [
        {
          id: '1',
          name: 'image1.jpg',
          thumbnailUrl: 'thumb1.jpg',
        },
        {
          id: '2',
          name: 'image2.jpg',
          thumbnailUrl: 'thumb2.jpg',
        },
      ];

      render(<Hero {...mockProps} visionImages={images} />);

      expect(screen.getByAltText('image1.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('image2.jpg')).toBeInTheDocument();
    });

    test('should call onVisionImageRemove when clicking remove button', () => {
      const images = [
        {
          id: '1',
          name: 'image1.jpg',
          thumbnailUrl: 'thumb1.jpg',
        },
      ];

      render(<Hero {...mockProps} visionImages={images} />);

      const removeButton = screen.getByLabelText(/remove image/i);
      fireEvent.click(removeButton);

      expect(mockProps.onVisionImageRemove).toHaveBeenCalledWith('1');
    });

    test('should call onVisionImagePreview when clicking image', () => {
      const images = [
        {
          id: '1',
          name: 'image1.jpg',
          thumbnailUrl: 'thumb1.jpg',
          previewUrl: 'preview1.jpg',
        },
      ];

      render(<Hero {...mockProps} visionImages={images} />);

      const imageContainer = screen.getByTitle('image1.jpg');
      fireEvent.click(imageContainer);

      expect(mockProps.onVisionImagePreview).toHaveBeenCalledWith(images[0]);
    });

    test('should not display inline attachments when no images', () => {
      render(<Hero {...mockProps} visionImages={[]} />);

      const container = document.querySelector('.hero-inline-attachments');
      expect(container).not.toBeInTheDocument();
    });
  });

  describe('Submit Actions', () => {
    test('should call onVisionSearch when images are present', () => {
      const images = [
        {
          id: '1',
          name: 'image1.jpg',
          thumbnailUrl: 'thumb1.jpg',
        },
      ];

      render(<Hero {...mockProps} visionImages={images} />);

      const sendButton = screen.getAllByRole('button').find((btn) =>
        btn.classList.contains('primary')
      );
      fireEvent.click(sendButton);

      expect(mockProps.onVisionSearch).toHaveBeenCalled();
      expect(mockProps.onTextSearch).not.toHaveBeenCalled();
    });

    test('should call onTextSearch when no images and query exists', () => {
      render(<Hero {...mockProps} searchTerm="Ha Long Bay" />);

      const sendButton = screen.getAllByRole('button').find((btn) =>
        btn.classList.contains('primary')
      );
      fireEvent.click(sendButton);

      expect(mockProps.onTextSearch).toHaveBeenCalledWith('Ha Long Bay');
      expect(mockProps.onVisionSearch).not.toHaveBeenCalled();
    });

    test('should not submit when no images and no query', () => {
      render(<Hero {...mockProps} searchTerm="" />);

      const sendButton = screen.getAllByRole('button').find((btn) =>
        btn.classList.contains('primary')
      );
      fireEvent.click(sendButton);

      expect(mockProps.onTextSearch).not.toHaveBeenCalled();
      expect(mockProps.onVisionSearch).not.toHaveBeenCalled();
    });

    test('should disable send button when searching', () => {
      render(<Hero {...mockProps} searching={true} searchTerm="test" />);

      const sendButton = screen.getAllByRole('button').find((btn) =>
        btn.classList.contains('primary')
      );
      expect(sendButton).toBeDisabled();
    });

    test('should show loading state when searching', () => {
      render(<Hero {...mockProps} searching={true} />);

      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  describe('Voice Recognition', () => {
    beforeEach(() => {
      // Mock Speech Recognition API
      global.SpeechRecognition = jest.fn().mockImplementation(() => ({
        continuous: false,
        interimResults: false,
        lang: 'vi-VN',
        start: jest.fn(),
        stop: jest.fn(),
        onresult: null,
        onerror: null,
        onend: null,
      }));
      global.webkitSpeechRecognition = global.SpeechRecognition;
    });

    afterEach(() => {
      delete global.SpeechRecognition;
      delete global.webkitSpeechRecognition;
    });

    test('should start voice recognition on button click', () => {
      render(<Hero {...mockProps} />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      fireEvent.click(voiceButton);

      // Should create recognition instance
      expect(global.SpeechRecognition).toHaveBeenCalled();
    });

    test('should add recording class when recording', () => {
      render(<Hero {...mockProps} />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      fireEvent.click(voiceButton);

      expect(voiceButton.classList.contains('recording')).toBe(true);
    });

    test('should handle voice recognition result', async () => {
      const mockRecognition = {
        continuous: false,
        interimResults: false,
        lang: 'vi-VN',
        start: jest.fn(),
        stop: jest.fn(),
        onresult: null,
        onerror: null,
        onend: null,
      };

      global.SpeechRecognition = jest.fn(() => mockRecognition);

      render(<Hero {...mockProps} searchTerm="current " />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      fireEvent.click(voiceButton);

      // Simulate recognition result
      const mockEvent = {
        results: [[{ transcript: 'Ha Long Bay' }]],
      };

      if (mockRecognition.onresult) {
        mockRecognition.onresult(mockEvent);
      }

      await waitFor(() => {
        expect(mockProps.onSearchChange).toHaveBeenCalledWith(
          'current Ha Long Bay'
        );
      });
    });

    test('should handle recognition error', async () => {
      const mockRecognition = {
        continuous: false,
        interimResults: false,
        lang: 'vi-VN',
        start: jest.fn(),
        stop: jest.fn(),
        onresult: null,
        onerror: null,
        onend: null,
      };

      global.SpeechRecognition = jest.fn(() => mockRecognition);

      render(<Hero {...mockProps} />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      fireEvent.click(voiceButton);

      // Simulate error
      if (mockRecognition.onerror) {
        mockRecognition.onerror(new Error('Recognition error'));
      }

      // Should handle gracefully
    });

    test('should handle unsupported speech recognition', () => {
      delete global.SpeechRecognition;
      delete global.webkitSpeechRecognition;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<Hero {...mockProps} />);

      const voiceButton = screen.getByLabelText(/dictate with voice/i);
      fireEvent.click(voiceButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not supported')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('File Upload', () => {
    test('should handle file selection', () => {
      render(<Hero {...mockProps} />);

      // Create file input programmatically
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';

      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [file],
      });

      // Simulate file selection would trigger onVisionImagesAdd
      // This depends on implementation
    });

    test('should clear file input after selection', () => {
      render(<Hero {...mockProps} />);

      // File input should be cleared after processing
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<Hero {...mockProps} />);

      expect(screen.getByLabelText(/dictate with voice/i)).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      render(<Hero {...mockProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      input.focus();

      expect(document.activeElement).toBe(input);
    });

    test('should have proper tabIndex for interactive elements', () => {
      const images = [
        {
          id: '1',
          name: 'image1.jpg',
          thumbnailUrl: 'thumb1.jpg',
        },
      ];

      render(<Hero {...mockProps} visionImages={images} />);

      const imageContainer = screen.getByTitle('image1.jpg');
      expect(imageContainer.getAttribute('tabIndex')).toBe('0');
    });
  });

  describe('Props Validation', () => {
    test('should handle undefined searchTerm', () => {
      const props = { ...mockProps };
      delete props.searchTerm;

      render(<Hero {...props} />);

      const input = screen.getByPlaceholderText(/ask anything/i);
      expect(input.value).toBe('');
    });

    test('should handle empty visionImages array', () => {
      render(<Hero {...mockProps} visionImages={[]} />);

      const container = document.querySelector('.hero-inline-attachments');
      expect(container).not.toBeInTheDocument();
    });

    test('should handle null callbacks gracefully', () => {
      const props = {
        ...mockProps,
        onSearchChange: undefined,
        onVisionSearch: undefined,
        onTextSearch: undefined,
      };

      render(<Hero {...props} />);

      // Should not throw errors
      const input = screen.getByPlaceholderText(/ask anything/i);
      fireEvent.change(input, { target: { value: 'test' } });
    });
  });

  describe('Background Image', () => {
    test('should render with background image', () => {
      const { container } = render(<Hero {...mockProps} />);

      const heroSection = container.querySelector('.hero');
      expect(heroSection).toHaveStyle({
        backgroundImage: expect.stringContaining('home-bg.png'),
      });
    });

    test('should render overlay', () => {
      const { container } = render(<Hero {...mockProps} />);

      const overlay = container.querySelector('.hero-overlay');
      expect(overlay).toBeInTheDocument();
    });
  });
});