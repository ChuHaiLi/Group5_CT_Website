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
import { subscribeToChatWidget } from "../../untils/chatWidgetEvents";
import { resizeImageTo128 } from "../../untils/imageResizer";
import "./ChatWidget.css";

const BOT_NAME = "Travel Planner";
const MAX_VISION_IMAGES = 4;

const formatVisionResponse = (vision) => {
  if (!vision) return "";
  if (typeof vision === "string") {
    return vision;
  }
  if (vision.plain_text) {
    return vision.plain_text;
  }
  const lines = [];
  if (vision.guess) {
    lines.push(`Gợi ý địa điểm: ${vision.guess}`);
  }
  if (vision.summary) {
    lines.push(vision.summary);
  }
  if (Array.isArray(vision.recommendations) && vision.recommendations.length) {
    const recLines = vision.recommendations.map((rec, idx) => {
      const title = rec.name || `Gợi ý ${idx + 1}`;
      return `• ${title}${rec.reason ? `: ${rec.reason}` : ""}`;
    });
    lines.push(recLines.join("\n"));
  }
  return lines.join("\n\n").trim();
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

      if (!entries.length) return;
      try {
        await API.post("/chat/widget/log", { messages: entries });
      } catch (error) {
        console.warn("Unable to persist logged vision conversation", error);
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
          fetchHistory();
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
        const updated = prev.map((msg) =>
          msg.id === optimistic.id ? { ...msg, persisted: true } : msg
        );
        return [...updated, res.data];
      });
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error(error.response?.data?.message || "Failed to send message");
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

    const optimistic = {
      id: `vision-${Date.now()}`,
      role: "user",
      content: question || "Tìm kiếm bằng ảnh",
      attachments: queuedImages.map((img) => ({
        id: img.id,
        previewUrl: img.previewUrl,
        name: img.name,
      })),
      _isExternal: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setVisionLoading(true);
    setVisionImages([]);

    const userText = question || "Tìm kiếm bằng ảnh";
    let assistantText = "";

    try {
      const res = await API.post(
        "/search/vision",
        {
          images: queuedImages.map((img) => img.base64),
          question,
        },
        { responseType: "text" }
      );
      const responsePayload = { plain_text: res.data };
      const formatted = formatVisionResponse(responsePayload);
      assistantText = responsePayload.plain_text;

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
          },
        ];
      });
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      const fallback =
        error.response?.data?.message ||
        "Không thể phân tích ảnh vào lúc này. Thử lại sau.";
      toast.error(fallback);
      assistantText = fallback;
    } finally {
      setSending(false);
      setVisionLoading(false);
      persistVisionConversation(userText, queuedImages, assistantText);
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
                      {message.attachments.map((attachment) => (
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
                              attachment.thumbnailUrl || attachment.previewUrl
                            }
                            alt={attachment.name || "reference"}
                          />
                        </button>
                      ))}
                    </div>
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
                placeholder="Nhập câu hỏi du lịch hoặc mô tả cho ảnh…"
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
