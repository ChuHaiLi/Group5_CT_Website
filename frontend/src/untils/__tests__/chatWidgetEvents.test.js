/**
 * Unit tests for chatWidgetEvents utility
 * Tests event emission and subscription
 */

import {
  openChatWidget,
  closeChatWidget,
  toggleChatWidget,
  sendVisionRequestToWidget,
  refreshChatWidgetHistory,
  navigateToExplore,
  subscribeToChatWidget,
} from '../chatWidgetEvents';

describe('chatWidgetEvents', () => {
  let eventListener;
  let lastEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    lastEvent = null;
    
    // Set up event listener
    eventListener = jest.fn((event) => {
      lastEvent = event.detail;
    });
    
    window.addEventListener('travel-planner-widget', eventListener);
  });

  afterEach(() => {
    window.removeEventListener('travel-planner-widget', eventListener);
  });

  test('openChatWidget emits open event', () => {
    openChatWidget();
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'open' });
  });

  test('closeChatWidget emits close event', () => {
    closeChatWidget();
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'close' });
  });

  test('toggleChatWidget emits toggle event', () => {
    toggleChatWidget();
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'toggle' });
  });

  test('sendVisionRequestToWidget emits vision-request event with payload', () => {
    const payload = { imageUrl: 'https://example.com/image.jpg' };
    sendVisionRequestToWidget(payload);
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'vision-request', payload });
  });

  test('refreshChatWidgetHistory emits history-refresh event', () => {
    const payload = { tripId: 1 };
    refreshChatWidgetHistory(payload);
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'history-refresh', payload });
  });

  test('navigateToExplore emits navigate-explore event', () => {
    const payload = { destination: 'Hanoi' };
    navigateToExplore(payload);
    
    expect(eventListener).toHaveBeenCalled();
    expect(lastEvent).toEqual({ action: 'navigate-explore', payload });
  });

  test('subscribeToChatWidget returns unsubscribe function', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToChatWidget(listener);
    
    expect(typeof unsubscribe).toBe('function');
    
    // Trigger event
    openChatWidget();
    
    expect(listener).toHaveBeenCalled();
    
    // Unsubscribe
    unsubscribe();
    
    // Clear previous calls
    listener.mockClear();
    
    // Trigger event again
    openChatWidget();
    
    // Listener should not be called after unsubscribe
    expect(listener).not.toHaveBeenCalled();
  });

  test('subscribeToChatWidget calls listener with event detail', () => {
    const listener = jest.fn();
    subscribeToChatWidget(listener);
    
    const payload = { test: 'data' };
    sendVisionRequestToWidget(payload);
    
    expect(listener).toHaveBeenCalledWith({ action: 'vision-request', payload });
  });
});

