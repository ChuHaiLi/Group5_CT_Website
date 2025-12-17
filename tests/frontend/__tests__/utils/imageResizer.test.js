/**
 * Tests for imageResizer.js
 */
import { resizeImageTo128 } from '../../../frontend/src/untils/imageResizer';

// Mock FileReader and Image
global.FileReader = class {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }

  readAsDataURL(file) {
    // Simulate successful read
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      if (this.onload) this.onload();
    }, 10);
  }
};

global.Image = class {
  constructor() {
    this.width = 200;
    this.height = 200;
    this.onload = null;
    this.onerror = null;
    this.src = null;
  }

  set src(value) {
    // Simulate image load
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 10);
  }
};

describe('imageResizer', () => {
  describe('resizeImageTo128', () => {
    test('should resize image successfully', async () => {
      const file = new File(['image data'], 'test.jpg', { type: 'image/jpeg' });

      const result = await resizeImageTo128(file);

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('base64');
      expect(result).toHaveProperty('originalDataUrl');
      expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    });

    test('should handle different image formats', async () => {
      const files = [
        new File(['data'], 'test.jpg', { type: 'image/jpeg' }),
        new File(['data'], 'test.png', { type: 'image/png' }),
        new File(['data'], 'test.webp', { type: 'image/webp' })
      ];

      for (const file of files) {
        const result = await resizeImageTo128(file);
        // All should be converted to JPEG
        expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      }
    });

    test('should handle large images', async () => {
      // Mock large image
      global.Image = class {
        constructor() {
          this.width = 2000;
          this.height = 2000;
          this.onload = null;
        }
        set src(value) {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 10);
        }
      };

      const file = new File(['large image'], 'large.jpg', { type: 'image/jpeg' });
      const result = await resizeImageTo128(file);

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('base64');
    });

    test('should reject on file read error', async () => {
      // Mock FileReader error
      global.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Read error'));
          }, 10);
        }
      };

      const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

      await expect(resizeImageTo128(file)).rejects.toThrow();
    });
  });
});

