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
  FaTimes,
  FaMicrophone,
} from "react-icons/fa";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import {
  subscribeToChatWidget,
  refreshChatWidgetHistory,
  navigateToExplore,
} from "../../untils/chatWidgetEvents";
import { resizeImageTo128 } from "../../untils/imageResizer";
import "./ChatWidget.css";

const BOT_NAME = "WonderAI BOT";
const MAX_VISION_IMAGES = 4;

// Mapping từ tags tiếng Anh sang tiếng Việt để hiển thị trong search bar
const TAG_VIETNAMESE_MAP = {
  Beach: "biển",
  Mountain: "núi",
  "Historical Site": "di tích lịch sử",
  "Cultural Site": "di tích văn hóa",
  Gastronomy: "ẩm thực",
  Adventure: "phiêu lưu",
  "Nature Park": "công viên thiên nhiên",
  "Urban Area": "đô thị",
  Island: "đảo",
  "Lake/River": "hồ/sông",
  "Trekking/Hiking": "leo núi",
  Photography: "chụp ảnh",
  Camping: "cắm trại",
  "Relaxation/Resort": "nghỉ dưỡng",
  Shopping: "mua sắm",
  "Water Sports": "thể thao dưới nước",
  Cycling: "đạp xe",
  Sightseeing: "tham quan",
  "Wildlife Watching": "xem động vật hoang dã",
  "Local Workshop": "workshop địa phương",
  Family: "gia đình",
  Couples: "cặp đôi",
  Friends: "bạn bè",
  "Solo Traveler": "du lịch một mình",
  "Kids Friendly": "thân thiện trẻ em",
  "Elderly Friendly": "thân thiện người già",
  "Pet Friendly": "thân thiện thú cưng",
  "Adventure Seekers": "người tìm kiếm phiêu lưu",
  "Half Day": "nửa ngày",
  "Full Day": "cả ngày",
  "2 Days": "2 ngày",
  "3+ Days": "3+ ngày",
  "Weekend Trip": "chuyến cuối tuần",
  Overnight: "qua đêm",
  "Multi-day Adventure": "phiêu lưu nhiều ngày",
  Spring: "mùa xuân",
  Summer: "mùa hè",
  Autumn: "mùa thu",
  Winter: "mùa đông",
  Morning: "buổi sáng",
  Afternoon: "buổi chiều",
  Evening: "buổi tối",
  Night: "ban đêm",
  Free: "miễn phí",
  "Scenic Views": "cảnh đẹp",
  "Instagrammable Spots": "điểm sống ảo",
  "Local Cuisine": "ẩm thực địa phương",
  "Festivals & Events": "lễ hội và sự kiện",
  "Adventure Sports": "thể thao mạo hiểm",
  "Relaxing Spots": "điểm nghỉ ngơi",
  "Cultural Immersion": "trải nghiệm văn hóa",
  "Hidden Gems": "địa điểm ẩn",
};

// Convert English tag to Vietnamese for display in search bar
const getVietnameseTag = (tag) => {
  return TAG_VIETNAMESE_MAP[tag] || tag;
};

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

  const fetchHistory = useCallback(
    (mergeMode = false) => {
      if (!isAuthenticated) return;
      setLoadingHistory(true);
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "ChatWidget.js:68",
            message: "fetchHistory called",
            data: { isAuthenticated, mergeMode },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "B",
          }),
        }
      ).catch(() => {});
      // #endregion
      API.get("/chat/widget/history")
        .then((res) => {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "ChatWidget.js:72",
                message: "fetchHistory response received",
                data: {
                  historyCount: (res.data || []).length,
                  history: (res.data || []).map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content?.substring(0, 50),
                  })),
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion
          if (mergeMode) {
            // Merge mode: replace optimistic messages with server messages, keep assistant messages that aren't in server yet
            const serverMessages = res.data || [];
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "ChatWidget.js:79",
                  message: "Merge mode: before setMessages",
                  data: {
                    serverCount: serverMessages.length,
                    serverMessages: serverMessages.map((m) => ({
                      id: m.id,
                      role: m.role,
                      content: m.content?.substring(0, 50),
                    })),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
            setMessages((prev) => {
              const serverMessageIds = new Set(serverMessages.map((m) => m.id));
              // Find optimistic messages to replace (safely check if id is a string)
              const optimisticMessages = prev.filter((msg) => {
                const id = msg?.id;
                return id && typeof id === "string" && id.startsWith("temp-");
              });
              // Keep non-optimistic messages that are not in server response (e.g., newly added assistant messages)
              const keptMessages = prev.filter((msg) => {
                const id = msg?.id;
                const isOptimistic =
                  id && typeof id === "string" && id.startsWith("temp-");
                return !isOptimistic && !serverMessageIds.has(id);
              });
              // Replace optimistic messages with server messages (matching by content)
              // For each optimistic message, find matching server message with same content
              const usedServerIds = new Set();
              const replacedMessages = optimisticMessages.map((optMsg) => {
                // Find server message with same content and role
                const matchingServerMsg = serverMessages.find(
                  (sMsg) =>
                    sMsg.role === optMsg.role &&
                    sMsg.content === optMsg.content &&
                    !usedServerIds.has(sMsg.id)
                );
                if (matchingServerMsg) {
                  usedServerIds.add(matchingServerMsg.id);
                  return matchingServerMsg;
                }
                return optMsg; // Keep optimistic if no match found
              });

              // Add remaining server messages that weren't used for replacement
              const remainingServerMessages = serverMessages.filter(
                (sMsg) => !usedServerIds.has(sMsg.id)
              );
              const combined = [
                ...keptMessages,
                ...replacedMessages,
                ...remainingServerMessages,
              ];
              const sorted = combined.sort((a, b) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                return aTime - bTime;
              });
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "ChatWidget.js:105",
                    message: "Merge mode: messages after merge",
                    data: {
                      prevCount: prev.length,
                      optimisticCount: optimisticMessages.length,
                      keptCount: keptMessages.length,
                      replacedCount: replacedMessages.filter((m) => {
                        const mid = m?.id;
                        return (
                          mid &&
                          typeof mid === "string" &&
                          !mid.startsWith("temp-")
                        );
                      }).length,
                      serverCount: serverMessages.length,
                      remainingServerCount: remainingServerMessages.length,
                      combinedCount: combined.length,
                      sortedCount: sorted.length,
                      sorted: sorted.map((m) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content?.substring(0, 50),
                      })),
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "run1",
                    hypothesisId: "B",
                  }),
                }
              ).catch(() => {});
              // #endregion
              return sorted;
            });
          } else {
            setMessages(res.data || []);
          }
        })
        .catch(() => toast.error("Unable to load conversation history"))
        .finally(() => setLoadingHistory(false));
    },
    [isAuthenticated]
  );

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
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "ChatWidget.js:131",
                message: "history-refresh event received",
                data: { dropId: payload?.dropClientRequestId },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion
          const dropId = payload?.dropClientRequestId;
          if (dropId) {
            setMessages((prev) => {
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "ChatWidget.js:134",
                    message: "Filtering messages by dropId",
                    data: {
                      prevCount: prev.length,
                      dropId,
                      prevMessages: prev.map((m) => ({
                        id: m.id,
                        role: m.role,
                        _requestId: m._requestId,
                      })),
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "run1",
                    hypothesisId: "B",
                  }),
                }
              ).catch(() => {});
              // #endregion
              return prev.filter((msg) => msg._requestId !== dropId);
            });
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
    if (!scrollRef.current) return;
    // Ensure we scroll to bottom after DOM updates (images/async content may change height)
    const el = scrollRef.current;
    // Use requestAnimationFrame then a small timeout as a robust fallback
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 120);

    return () => {
      window.cancelAnimationFrame(raf);
      clearTimeout(t);
    };
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

    setMessages((prev) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "ChatWidget.js:278",
            message: "Added optimistic user message",
            data: {
              optimisticId: optimistic.id,
              prevCount: prev.length,
              newCount: prev.length + 1,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          }),
        }
      ).catch(() => {});
      // #endregion
      return [...prev, optimistic];
    });
    setInput("");
    setSending(true);

    try {
      const res = await API.post("/chat/widget/message", {
        message: trimmed,
        page_context: pageContext,
        display_name: userDisplayName,
      });

      // Normalize API result: backend returns a single message object for widget
      const payload = res?.data;
      const assistantMessages = Array.isArray(payload)
        ? payload
        : payload
        ? [payload]
        : [];

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "ChatWidget.js:297",
            message: "Before updating messages with AI response",
            data: {
              assistantMessagesCount: assistantMessages.length,
              assistantMessages: assistantMessages.map((m) => ({
                id: m.id,
                role: m.role,
              })),
              optimisticId: optimistic.id,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          }),
        }
      ).catch(() => {});
      // #endregion

      // Keep optimistic user message and append assistant messages
      // Backend only returns assistant message, so we must keep the optimistic user message
      setMessages((prev) => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "ChatWidget.js:299",
              message: "Inside setMessages - before update",
              data: {
                prevCount: prev.length,
                prevMessages: prev.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content?.substring(0, 50),
                })),
                optimisticId: optimistic.id,
                assistantMessagesCount: assistantMessages.length,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          }
        ).catch(() => {});
        // #endregion
        const result = [...prev, ...assistantMessages];
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "ChatWidget.js:303",
              message: "Final messages after update - keeping optimistic",
              data: {
                resultCount: result.length,
                result: result.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content?.substring(0, 50),
                })),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          }
        ).catch(() => {});
        // #endregion
        return result;
      });

      // After updating messages, fetch history to sync with server (merge mode)
      // This will replace optimistic message with actual user message from server
      setTimeout(() => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "ChatWidget.js:330",
              message: "Calling fetchHistory to sync with server (merge mode)",
              data: { optimisticId: optimistic.id },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          }
        ).catch(() => {});
        // #endregion
        fetchHistory(true); // Use merge mode to preserve assistant message
      }, 1000); // Increase delay to ensure server has committed user message

      // After updating messages, ensure scroll happens (extra guard)
      if (scrollRef.current) {
        setTimeout(() => {
          try {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          } catch (e) {}
        }, 120);
      }
      // Ask backend to extract explore tags and location name, then navigate if applicable
      try {
        const tagRes = await API.post("/chat/extract_tags", {
          message: trimmed,
          page_context: pageContext,
        });
        if (tagRes.data && tagRes.data.ok) {
          const result = tagRes.data.result || {};
          const tags = result.tags || [];
          const locationName = result.location_name || null;
          const navigate =
            result.navigate ||
            (Array.isArray(tags) && tags.length > 0) ||
            !!locationName;

          if (navigate) {
            // emit event for other components
            if (tags.length > 0) {
              navigateToExplore({ tags });
            }

            // Build navigation URL
            try {
              const params = new URLSearchParams();

              // Priority 1: If location_name exists, use ?q= to fill search bar
              if (locationName) {
                params.set("q", locationName);
                // If there are also valid tags, add them too
                if (tags.length > 0) {
                  params.set("tags", tags.join(","));
                }
              }
              // Priority 2: If only tags exist, use first tag (or all tags) for ?q= to fill search bar
              else if (tags.length > 0) {
                // Use Vietnamese translation of first tag as search query to display in search bar
                const vietnameseTag = getVietnameseTag(tags[0]);
                params.set("q", vietnameseTag);
                // Add all tags for filtering
                if (tags.length > 1) {
                  params.set("tags", tags.join(","));
                } else {
                  // If only one tag, still add it to tags param for filtering
                  params.set("tags", tags[0]);
                }
              }

              if (params.toString()) {
                window.location.href = `/explore?${params.toString()}`;
              }
            } catch (e) {
              if (process.env.NODE_ENV === "development") {
                console.warn("Navigation failed", e);
              }
            }
          } else {
            // Inform user that no clear destination was detected
            toast.info(
              "Couldn't detect a travel destination from your message. Try specifying a place (e.g., 'Da Lat', 'beach', 'Sapa')."
            );
          }
        } else {
          toast.info(
            "Couldn't detect a travel destination from your message. Try specifying a place (e.g., 'Da Lat', 'beach', 'Sapa')."
          );
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Tag extraction failed", err);
        }
        toast.info(
          "Couldn't detect a travel destination from your message. Try specifying a place (e.g., 'Da Lat', 'beach', 'Sapa')."
        );
      }
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

  // eslint-disable-next-line no-unused-vars
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
              {/* attachment control removed per design */}
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
