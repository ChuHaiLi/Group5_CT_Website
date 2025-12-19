// src/untils/__tests__/chatWidgetEvents.test.js
import {
  openChatWidget,
  closeChatWidget,
  toggleChatWidget,
  sendVisionRequestToWidget,
  sendVisionResultToWidget,
  sendHeroTextRequestToWidget,
  sendHeroTextResultToWidget,
  refreshChatWidgetHistory,
  navigateToExplore,
  subscribeToChatWidget,
} from '@/untils/chatWidgetEvents';

describe('Chat Widget Events', () => {
  let eventListener;

  beforeEach(() => {
    eventListener = jest.fn();
    window.dispatchEvent = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Dispatchers', () => {
    test('openChatWidget should dispatch open action', () => {
      openChatWidget();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'open' }
        })
      );
    });

    test('closeChatWidget should dispatch close action', () => {
      closeChatWidget();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'close' }
        })
      );
    });

    test('toggleChatWidget should dispatch toggle action', () => {
      toggleChatWidget();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'toggle' }
        })
      );
    });

    test('sendVisionRequestToWidget should dispatch with payload', () => {
      const payload = { image: 'base64data', text: 'Test' };
      sendVisionRequestToWidget(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'vision-request', payload }
        })
      );
    });

    test('sendVisionResultToWidget should dispatch with payload', () => {
      const payload = { result: 'Success' };
      sendVisionResultToWidget(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'vision-result', payload }
        })
      );
    });

    test('sendHeroTextRequestToWidget should dispatch with payload', () => {
      const payload = { text: 'Hero text' };
      sendHeroTextRequestToWidget(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'hero-text-request', payload }
        })
      );
    });

    test('sendHeroTextResultToWidget should dispatch with payload', () => {
      const payload = { result: 'Hero result' };
      sendHeroTextResultToWidget(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'hero-text-result', payload }
        })
      );
    });

    test('refreshChatWidgetHistory should dispatch with payload', () => {
      const payload = { conversationId: '123' };
      refreshChatWidgetHistory(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'history-refresh', payload }
        })
      );
    });

    test('navigateToExplore should dispatch with payload', () => {
      const payload = { destination: 'Paris' };
      navigateToExplore(payload);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'travel-planner-widget',
          detail: { action: 'navigate-explore', payload }
        })
      );
    });
  });

  describe('Event Subscription', () => {
    test('subscribeToChatWidget should add event listener', () => {
      const listener = jest.fn();
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      subscribeToChatWidget(listener);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'travel-planner-widget',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    test('subscribeToChatWidget should return unsubscribe function', () => {
      const listener = jest.fn();
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const unsubscribe = subscribeToChatWidget(listener);
      unsubscribe();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'travel-planner-widget',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    test('subscriber should receive event detail', () => {
      const listener = jest.fn();
      const mockDetail = { action: 'open', data: 'test' };

      subscribeToChatWidget(listener);

      // Simulate event dispatch
      const event = new CustomEvent('travel-planner-widget', {
        detail: mockDetail
      });
      window.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(mockDetail);
    });

    test('subscriber should handle events without detail', () => {
      const listener = jest.fn();

      subscribeToChatWidget(listener);

      // Simulate event without detail
      const event = new CustomEvent('travel-planner-widget');
      window.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith({ action: 'toggle' });
    });
  });
});