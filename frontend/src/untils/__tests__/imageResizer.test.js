/**
 * Unit tests for image resizing utility
 * Tests image processing logic with mocked Canvas API
 * Canvas, FileReader, and Image mocking is done globally in setupTests.js
 */

import { resizeImageTo128 } from '../imageResizer';

describe('imageResizer', () => {
  let mockFileReader;
  let mockImage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh mocks for each test
    mockFileReader = {
      readAsDataURL: jest.fn(function () {
        this.result = 'data:image/jpeg;base64,originalData';
        setTimeout(() => {
          if (this.onload) this.onload({ target: this });
        }, 0);
      }),
      onload: null,
      onerror: null,
    };

    mockImage = {
      onload: null,
      onerror: null,
      width: 200,
      height: 200,
      src: '',
    };

    // Override global mocks for this test
    global.FileReader = jest.fn(() => mockFileReader);
    global.Image = jest.fn(() => mockImage);
  });

  test('resizes image to 96x96 and returns base64', async () => {
    const mockFile = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
    const mockDataUrl = 'data:image/jpeg;base64,originalData';

    mockFileReader.result = mockDataUrl;

    const promise = resizeImageTo128(mockFile);

    // Wait for FileReader to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Trigger image load
    if (mockImage.onload) {
      mockImage.onload();
    }

    const result = await promise;

    expect(result).toHaveProperty('dataUrl');
    expect(result).toHaveProperty('base64');
    expect(result).toHaveProperty('originalDataUrl');
    expect(result.originalDataUrl).toBe(mockDataUrl);
  });

  test('handles image load error', async () => {
    const mockFile = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
    const mockDataUrl = 'data:image/jpeg;base64,originalData';

    mockFileReader.result = mockDataUrl;

    const promise = resizeImageTo128(mockFile);

    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (mockImage.onerror) {
      mockImage.onerror(new Error('Image load failed'));
    }

    await expect(promise).rejects.toThrow();
  });

  test('handles FileReader error', async () => {
    const mockFile = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });

    mockFileReader.readAsDataURL = jest.fn(function () {
      if (this.onerror) {
        this.onerror(new Error('File read failed'));
      }
    });

    const promise = resizeImageTo128(mockFile);

    await expect(promise).rejects.toThrow();
  });
});
