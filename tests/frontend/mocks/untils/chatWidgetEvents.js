// Mock that mirrors the real chatWidgetEvents behavior (dispatch CustomEvent)
const EVENT_NAME = 'travel-planner-widget';

// Registry of handlers so we can invoke them even when tests replace window.dispatchEvent
const handlers = new Set();

function ensureDispatchWrapper() {
  if (typeof window === 'undefined') return;
  // Always attempt to ensure current dispatchEvent will invoke our handlers.
  // Do not early-return — tests may replace window.dispatchEvent between calls.

  const originalDispatch = window.dispatchEvent;

  // If the existing dispatchEvent is a jest mock, install a mockImplementation
  // that also invokes our registered handlers. This preserves the mock identity
  // so tests can assert on it.
  if (originalDispatch && originalDispatch._isMockFunction) {
    try {
      originalDispatch.mockImplementation((event) => {
        // call any previous implementation if present (unlikely)
        // then invoke handlers
        handlers.forEach((h) => {
          try { h(event); } catch (err) { /* ignore */ }
        });
        return true;
      });
    } catch (e) {
      // If mockImplementation fails, fall back to wrapper below
    }
    window.____chatWidgetEvents_wrapped = true;
    return;
  }

  // Fallback: create a wrapper function when dispatchEvent is not a mock
  const wrapper = function(event) {
    try {
      if (typeof originalDispatch === 'function') {
        originalDispatch.call(window, event);
      }
    } catch (e) {
      // ignore
    }
    handlers.forEach((h) => {
      try { h(event); } catch (err) { /* ignore handler errors in tests */ }
    });
    return true;
  };

  window.dispatchEvent = wrapper;
  window.____chatWidgetEvents_wrapped = true;
  window.____chatWidgetEvents_wrapped = true;
}

const emitWidgetEvent = (detail) => {
  if (typeof window !== 'undefined') {
    ensureDispatchWrapper();
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  }
};

module.exports = {
  openChatWidget: () => emitWidgetEvent({ action: 'open' }),
  closeChatWidget: () => emitWidgetEvent({ action: 'close' }),
  toggleChatWidget: () => emitWidgetEvent({ action: 'toggle' }),
  sendVisionRequestToWidget: (payload) => emitWidgetEvent({ action: 'vision-request', payload }),
  sendVisionResultToWidget: (payload) => emitWidgetEvent({ action: 'vision-result', payload }),
  sendHeroTextRequestToWidget: (payload) => emitWidgetEvent({ action: 'hero-text-request', payload }),
  sendHeroTextResultToWidget: (payload) => emitWidgetEvent({ action: 'hero-text-result', payload }),
  refreshChatWidgetHistory: (payload) => emitWidgetEvent({ action: 'history-refresh', payload }),
  navigateToExplore: (payload) => emitWidgetEvent({ action: 'navigate-explore', payload }),
  subscribeToChatWidget: (listener) => {
    const handler = (event) => listener(event.detail || { action: 'toggle' });
    handlers.add(handler);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(EVENT_NAME, handler);
    }
    ensureDispatchWrapper();
    return () => {
      handlers.delete(handler);
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(EVENT_NAME, handler);
      }
    };
  }
};
