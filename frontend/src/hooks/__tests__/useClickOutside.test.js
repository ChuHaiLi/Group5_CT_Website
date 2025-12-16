/**
 * Unit tests for useClickOutside hook
 * Tests click outside detection logic
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useClickOutside } from '../useClickOutside';

describe('useClickOutside', () => {
  let mockCallback;
  let containerRef;

  beforeEach(() => {
    mockCallback = jest.fn();
    containerRef = { current: document.createElement('div') };
    document.body.innerHTML = ''; // Clear body
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('calls callback when clicking outside element', async () => {
    renderHook(() => useClickOutside(containerRef, mockCallback, true));

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    document.body.appendChild(containerRef.current);

    // Wait for the 100ms delay in the hook
    await new Promise(resolve => setTimeout(resolve, 150));

    const clickEvent = new MouseEvent('mousedown', { bubbles: true });
    outsideElement.dispatchEvent(clickEvent);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  test('does not call callback when clicking inside element', async () => {
    renderHook(() => useClickOutside(containerRef, mockCallback, true));

    document.body.appendChild(containerRef.current);

    // Wait for the 100ms delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const clickEvent = new MouseEvent('mousedown', { bubbles: true });
    containerRef.current.dispatchEvent(clickEvent);

    // Callback should not be called for inside clicks
    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('does not call callback when isActive is false', async () => {
    renderHook(() => useClickOutside(containerRef, mockCallback, false));

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    document.body.appendChild(containerRef.current);

    await new Promise(resolve => setTimeout(resolve, 150));

    const clickEvent = new MouseEvent('mousedown', { bubbles: true });
    outsideElement.dispatchEvent(clickEvent);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('handles null ref gracefully', async () => {
    const nullRef = { current: null };
    
    renderHook(() => useClickOutside(nullRef, mockCallback, true));

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    await new Promise(resolve => setTimeout(resolve, 150));

    const clickEvent = new MouseEvent('mousedown', { bubbles: true });
    outsideElement.dispatchEvent(clickEvent);

    // Should not throw error
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
