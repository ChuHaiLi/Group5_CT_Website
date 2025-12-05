const EVENT_NAME = "travel-planner-widget";

const emitWidgetEvent = (detail) => {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
};

export const openChatWidget = () => emitWidgetEvent({ action: "open" });

export const closeChatWidget = () => emitWidgetEvent({ action: "close" });

export const toggleChatWidget = () => emitWidgetEvent({ action: "toggle" });

export const sendVisionRequestToWidget = (payload) =>
  emitWidgetEvent({ action: "vision-request", payload });

export const sendVisionResultToWidget = (payload) =>
  emitWidgetEvent({ action: "vision-result", payload });

export const sendHeroTextRequestToWidget = (payload) =>
  emitWidgetEvent({ action: "hero-text-request", payload });

export const sendHeroTextResultToWidget = (payload) =>
  emitWidgetEvent({ action: "hero-text-result", payload });

export const refreshChatWidgetHistory = (payload) =>
  emitWidgetEvent({ action: "history-refresh", payload });

export const subscribeToChatWidget = (listener) => {
  const handler = (event) => {
    listener(event.detail || { action: "toggle" });
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
