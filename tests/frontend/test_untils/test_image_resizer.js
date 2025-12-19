// src/untils/__tests__/imageResizer.test.js
import { resizeImageTo128 } from '@/untils/imageResizer';

describe('Image Resizer Utility', () => {
  let mockFile;
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Mock File
    mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Mock Canvas and Context
    mockContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/jpeg;base64,mockBase64Data'),
    };

    document.createElement = jest.fn((tag) => {
      if (tag === 'canvas') return mockCanvas;
      if (tag === 'img') {
        const img = {
          onload: null,
          onerror: null,
          src: '',
          width: 200,
          height: 200,
        };
        // Simulate image load after setting src
        Object.defineProperty(img, 'src', {
          set: function(value) {
            this._src = value;
            setTimeout(() => this.onload && this.onload(), 0);
          },
          get: function() {
            return this._src;
          }
        });
        return img;
      }
      return {};
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should resize image to 96x96 target size', async () => {
    const result = await resizeImageTo128(mockFile);

    expect(result).toHaveProperty('dataUrl');
    expect(result).toHaveProperty('base64');
    expect(result).toHaveProperty('originalDataUrl');
    expect(mockCanvas.width).toBe(96);
    expect(mockCanvas.height).toBe(96);
  });

  test('should return base64 string without data URL prefix', async () => {
    const result = await resizeImageTo128(mockFile);

    expect(result.base64).toBe('mockBase64Data');
    expect(result.base64).not.toContain('data:image/jpeg;base64,');
  });

  test('should fill canvas with black background', async () => {
    await resizeImageTo128(mockFile);

    expect(mockContext.fillStyle).toBe('#000');
    expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 96, 96);
  });

  test('should draw image centered on canvas', async () => {
    await resizeImageTo128(mockFile);

    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  test('should handle FileReader error', async () => {
    // Mock FileReader to trigger error
    const originalFileReader = global.FileReader;
    global.FileReader = jest.fn(() => ({
      readAsDataURL: function() {
        setTimeout(() => this.onerror(new Error('Read failed')), 0);
      },
      onerror: null,
      onload: null,
    }));

    await expect(resizeImageTo128(mockFile)).rejects.toThrow();

    global.FileReader = originalFileReader;
  });

  test('should use JPEG quality of 0.72', async () => {
    await resizeImageTo128(mockFile);

    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.72);
  });
});