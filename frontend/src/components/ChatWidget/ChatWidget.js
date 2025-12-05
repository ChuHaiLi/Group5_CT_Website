import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FaComments,
  FaPaperPlane,
  FaPaperclip,
  FaTimes,
  FaMicrophone,
} from "react-icons/fa";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import {
  subscribeToChatWidget,
  refreshChatWidgetHistory,
} from "../../untils/chatWidgetEvents";
import { resizeImageTo128 } from "../../untils/imageResizer";
import "./ChatWidget.css";

const BOT_NAME = "Travel Planner";
const MAX_VISION_IMAGES = 4;

const formatVisionResponse = (vision) => {
  if (!vision) return "";
  if (typeof vision === "string") {
    return vision;
  }
  if (vision.message) {
    return vision.message;
  }
  if (vision.summary) {
    return vision.summary;
  }
  if (vision.plain_text) {
    return vision.plain_text;
  }
  return "";
};

export default function ChatWidget({ isAuthenticated, pageContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [visionImages, setVisionImages] = useState([]);
  const [visionLoading, setVisionLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const fetchHistory = useCallback(() => {
    if (!isAuthenticated) return;
    setLoadingHistory(true);
    API.get("/chat/widget/history")
      .then((res) => setMessages(res.data || []))
      .catch(() => toast.error("Unable to load conversation history"))
      .finally(() => setLoadingHistory(false));
  }, [isAuthenticated]);

  const persistVisionConversation = useCallback(
    async (userMessage, attachmentImages, assistantMessage) => {
      const entries = [];
      if (userMessage) {
        const attachments = (attachmentImages || [])
          .map((img) => ({
            name: img?.name,
            data_url: img?.previewUrl,
          }))
          .filter((img) => img.data_url);
        entries.push({
          role: "user",
          content: userMessage,
          attachments,
        });
      }
      if (assistantMessage) {
        entries.push({ role: "assistant", content: assistantMessage });
      }

      if (!entries.length) return false;
      try {
        await API.post("/chat/widget/log", { messages: entries });
        return true;
      } catch (error) {
        console.warn("Unable to persist logged vision conversation", error);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setMessages([]);
      setVisionImages([]);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = subscribeToChatWidget(
      ({ action = "toggle", payload }) => {
        if (action === "history-refresh") {
          const dropId = payload?.dropClientRequestId;
          if (dropId) {
            setMessages((prev) =>
              prev.filter((msg) => msg._requestId !== dropId)
            );
          }
          fetchHistory();
          return;
        }

        if (action === "hero-text-request" && payload) {
          setIsOpen(true);
          const userMessage = {
            id: payload.requestId || `hero-user-${Date.now()}`,
            role: "user",
            content: payload.content || payload.question || "",
            attachments: (payload.attachments || []).map((item, index) => ({
              id: item.id || `${payload.requestId || Date.now()}-${index}`,
              previewUrl: item.previewUrl || item.thumbnailUrl,
              thumbnailUrl: item.thumbnailUrl || item.previewUrl,
              name: item.name,
            })),
            _isExternal: true,
            _requestId: payload.requestId,
          };
          setMessages((prev) => [...prev, userMessage]);
          return;
        }

        if (action === "hero-text-result" && payload) {
          setIsOpen(true);
          if (payload.response) {
            setMessages((prev) => [
              ...prev,
              {
                id: `hero-bot-${payload.requestId || Date.now()}`,
                role: "bot",
                content: payload.response,
                _isExternal: true,
                _requestId: payload.requestId,
              },
            ]);
          }
          return;
        }

        if (action === "vision-request" && payload) {
          setIsOpen(true);
          const normalized = (payload.attachments || []).map((item, index) => ({
            id: item.id || `${payload.requestId || Date.now()}-${index}`,
            previewUrl: item.previewUrl,
            thumbnailUrl: item.thumbnailUrl || item.previewUrl,
            name: item.name,
          }));
          const userMessage = {
            id: payload.requestId || `external-user-${Date.now()}`,
            role: "user",
            content: payload.question || "Tìm kiếm bằng ảnh",
            attachments: normalized,
            _isExternal: true,
            _requestId: payload.requestId,
          };
          setMessages((prev) => [...prev, userMessage]);
          return;
        }

        if (action === "vision-result" && payload) {
          setIsOpen(true);
          if (payload.response) {
            const responsePayload =
              typeof payload.response === "string"
                ? { plain_text: payload.response }
                : payload.response;
            const formatted = formatVisionResponse(responsePayload);
            const botMessage = {
              id: `external-bot-${payload.requestId || Date.now()}`,
              role: "bot",
              type: "vision-result",
              vision: responsePayload,
              content: formatted,
              _isExternal: true,
              _requestId: payload.requestId,
            };
            setMessages((prev) => [...prev, botMessage]);
          }
          return;
        }

        setIsOpen((prev) => {
          if (action === "open") return true;
          if (action === "close") return false;
          return !prev;
        });
      }
    );
    return unsubscribe;
  }, [fetchHistory]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) {
      if (!isOpen) {
        setVisionImages([]);
      }
      return;
    }
    fetchHistory();
  }, [isOpen, isAuthenticated, fetchHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const userDisplayName = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user")) || {};
      return stored.username || stored.email || "Traveler";
    } catch (error) {
      return "Traveler";
    }
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (sending || visionLoading) return;

    if (visionImages.length > 0) {
      await handleVisionSend(trimmed);
      return;
    }

    if (!trimmed) return;

    const optimistic = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
      _requestId: `direct-${Date.now()}`,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);

    try {
      const res = await API.post("/chat/widget/message", {
        message: trimmed,
        page_context: pageContext,
        display_name: userDisplayName,
      });
      setMessages((prev) => {
        const updated = prev
          .filter((msg) => msg.id !== optimistic.id)
          .concat(res.data || []);
        return updated;
      });
    } catch (error) {
      const fallback =
        error.response?.data?.message || "Failed to send message";
      toast.error(fallback);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimistic.id
            ? {
                ...msg,
                error:
                  "Tin nhắn chưa được gửi tới máy chủ. Vui lòng thử lại sau.",
                error_detail: fallback,
              }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  };

  const ensureRecognition = () => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "vi-VN";
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    }
    return recognitionRef.current;
  };

  const handleVisionImageRemove = (id) => {
    setVisionImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleVisionImagesAdd = async (event) => {
    const fileList = Array.from(event?.target?.files || []);
    if (event?.target) {
      event.target.value = "";
    }
    if (!fileList.length) return;

    const remainingSlots = MAX_VISION_IMAGES - visionImages.length;
    if (remainingSlots <= 0) {
      toast.info(`Bạn chỉ có thể thêm tối đa ${MAX_VISION_IMAGES} ảnh.`);
      return;
    }

    const usableFiles = fileList.slice(0, remainingSlots);
    try {
      const resizedResults = await Promise.all(
        usableFiles.map((file) => resizeImageTo128(file))
      );
      setVisionImages((prev) => [
        ...prev,
        ...resizedResults.map((result, index) => ({
          id: `${Date.now()}-${index}`,
          name: usableFiles[index]?.name || `Ảnh ${index + 1}`,
          previewUrl: result.originalDataUrl || result.dataUrl,
          thumbnailUrl: result.dataUrl,
          base64: result.base64,
        })),
      ]);
    } catch (error) {
      console.error("Unable to process images", error);
      toast.error("Không thể xử lý các ảnh vừa chọn.");
    }
  };

  const toggleVoice = () => {
    const recognition = ensureRecognition();
    if (!recognition) {
      toast.info("Trình duyệt chưa hỗ trợ nhập bằng giọng nói.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      return;
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) {
        setInput((prev) =>
          prev ? `${prev.trim()} ${transcript}` : transcript
        );
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event);
      toast.error("Không thể ghi âm. Vui lòng thử lại.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Unable to start speech recognition", error);
      toast.error("Không thể bắt đầu ghi âm.");
      setIsRecording(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleVisionSend = async (question) => {
    const queuedImages = visionImages.map((img) => ({ ...img }));
    if (!queuedImages.length && !question) {
      toast.info("Thêm ảnh hoặc nhập câu hỏi trước khi gửi.");
      return;
    }

    const optimisticId = `vision-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      role: "user",
      content: question || "Tìm kiếm bằng ảnh",
      attachments: queuedImages.map((img) => ({
        id: img.id,
        previewUrl: img.previewUrl,
        name: img.name,
      })),
      _isExternal: true,
      _requestId: optimisticId,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setVisionLoading(true);
    setVisionImages([]);

    const userText = question || "Tìm kiếm bằng ảnh";
    let assistantText = "";

    try {
      const res = await API.post("/search/vision", {
        images: queuedImages.map((img) => img.base64),
        question,
      });
      const responsePayload = res.data || {};
      const formatted =
        formatVisionResponse(responsePayload) ||
        "Mình đã nhận ảnh của bạn nhưng chưa thể diễn giải rõ hơn.";
      assistantText = formatted;

      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === optimistic.id ? { ...optimistic, content: userText } : msg
        );
        return [
          ...updated,
          {
            id: `vision-response-${Date.now()}`,
            role: "bot",
            type: "vision-result",
            vision: responsePayload,
            content: formatted,
            _isExternal: true,
            _requestId: optimisticId,
          },
        ];
      });
    } catch (error) {
      const fallback =
        error.response?.data?.message ||
        "Không thể phân tích ảnh vào lúc này. Thử lại sau.";
      toast.error(fallback);
      assistantText = fallback;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimistic.id
            ? {
                ...msg,
                error:
                  "Hệ thống chưa thể phân tích ảnh. Bạn có thể thử gửi lại.",
                error_detail: fallback,
              }
            : msg
        )
      );
    } finally {
      setSending(false);
      setVisionLoading(false);
      const persisted = await persistVisionConversation(
        userText,
        queuedImages,
        assistantText
      );
      if (persisted) {
        refreshChatWidgetHistory({ dropClientRequestId: optimisticId });
      }
    }
  };

  const getDisplayContent = useCallback((message) => {
    if (!message?.content) return "";
    if (!message.attachments || !message.attachments.length) {
      return message.content;
    }
    return message.content.replace(/\s*\(kèm\s+\d+\s+ảnh:.*?\)$/i, "").trim();
  }, []);

  return (
    <>
      <button
        className="chat-widget-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open chat widget"
      >
        <FaComments size={22} />
      </button>

      {isOpen && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <div>
              <p className="chat-widget-title">{BOT_NAME}</p>
              <span className="chat-widget-subtitle">
                Ask me anything about planning your next adventure.
              </span>
            </div>
            <button
              className="chat-widget-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat widget"
            >
              <FaTimes size={14} />
            </button>
          </div>

          <div className="chat-widget-context">
            Viewing:{" "}
            {pageContext || "This screen summary updates as you browse."}
          </div>

          <div className="chat-widget-body" ref={scrollRef}>
            {loadingHistory && (
              <p className="chat-widget-status">Loading conversation…</p>
            )}
            {!loadingHistory && messages.length === 0 && (
              <p className="chat-widget-status">
                No messages yet. Ask {BOT_NAME} about places to go, food to try,
                or anything travel related!
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-widget-row ${
                  message.role === "user" ? "user" : "bot"
                }`}
              >
                <div className="chat-widget-bubble">
                  <span className="chat-widget-author">
                    {message.role === "user" ? userDisplayName : BOT_NAME}
                  </span>
                  {getDisplayContent(message) && (
                    <p className="chat-widget-text-block">
                      {getDisplayContent(message)}
                    </p>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="chat-widget-bubble-attachments">
                      {message.attachments.map(
                        (attachment) =>
                          attachment &&
                          (attachment.thumbnailUrl ||
                            attachment.previewUrl) && (
                            <button
                              type="button"
                              key={attachment.id}
                              className="chat-widget-bubble-attachment"
                              onClick={() =>
                                setActivePreview({
                                  src:
                                    attachment.previewUrl ||
                                    attachment.thumbnailUrl,
                                  name: attachment.name,
                                })
                              }
                              aria-label="Xem ảnh đính kèm"
                            >
                              <img
                                src={
                                  attachment.thumbnailUrl ||
                                  attachment.previewUrl
                                }
                                alt={attachment.name || "reference"}
                              />
                            </button>
                          )
                      )}
                    </div>
                  )}
                  {message.error && (
                    <p className="chat-widget-error-note">{message.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-widget-composer">
            {visionImages.length > 0 && (
              <div className="chat-widget-attachments">
                {visionImages.map((img) => (
                  <div key={img.id} className="chat-widget-attachment">
                    <img
                      src={img.thumbnailUrl || img.previewUrl}
                      alt={img.name || "reference"}
                    />
                    <button
                      type="button"
                      onClick={() => handleVisionImageRemove(img.id)}
                      aria-label="Xóa ảnh tham chiếu"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-widget-composer-controls">
              <label className="chat-widget-attach" aria-label="Tải ảnh">
                <FaPaperclip size={14} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleVisionImagesAdd}
                />
              </label>
              <button
                type="button"
                className={`chat-widget-mic ${isRecording ? "recording" : ""}`}
                onClick={toggleVoice}
                disabled={sending || visionLoading}
                aria-label="Nhập bằng giọng nói"
              >
                <FaMicrophone size={14} />
              </button>
              <textarea
                placeholder="Type a travel question or describe your photo…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={sending || visionLoading}
              />
              <button
                className="chat-widget-send"
                onClick={handleSend}
                disabled={
                  sending ||
                  visionLoading ||
                  (!input.trim() && visionImages.length === 0)
                }
                aria-label="Send message"
              >
                {visionLoading || sending ? "..." : <FaPaperPlane size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePreview && (
        <div
          className="chat-widget-image-preview"
          onClick={() => setActivePreview(null)}
          role="button"
          tabIndex={-1}
        >
          <div
            className="chat-widget-image-preview-body"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="chat-widget-image-preview-close"
              onClick={() => setActivePreview(null)}
              aria-label="Đóng hình ảnh"
            >
              ×
            </button>
            <img
              src={activePreview.src}
              alt={activePreview.name || "preview"}
            />
            {activePreview.name && (
              <p className="chat-widget-image-preview-caption">
                {activePreview.name}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
