import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import { usePageContext } from "../../context/PageContext";
import { resizeImageTo128 } from "../../untils/imageResizer";
import "./HomePage.css";
import HeroSection from "./hero/hero";
import CreateTripForm from "../../components/CreateTripForm";

import HomeIntro from "./HomeIntro";
import RelaxationSection from "./Relaxation/RelaxationSection";
import TrendingSection from "./Trending/TrendingSection";
import VacationCarousel from "./VacationCarousel/VacationCarousel";
import WildlifeSection from "./Wildlife/WildlifeSection";

import {
  sendHeroTextRequestToWidget,
  sendHeroTextResultToWidget,
  sendVisionRequestToWidget,
  sendVisionResultToWidget,
  refreshChatWidgetHistory,
} from "../../untils/chatWidgetEvents";

const MAX_VISION_IMAGES = 4;

export default function HomePage({ savedIds, handleToggleSave }) {
  const [allDestinations, setAllDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visionImages, setVisionImages] = useState([]);
  const [visionLoading, setVisionLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const { setPageContext } = usePageContext();

  // Thêm state cho Relaxation Section
  const [relaxationShowForm, setRelaxationShowForm] = useState(false);
  const [relaxationSelectedDest, setRelaxationSelectedDest] = useState(null);

  const handleRelaxationCreateTrip = (dest) => {
    setRelaxationSelectedDest(dest);
    setRelaxationShowForm(true);
  };

  const handleRelaxationCloseForm = () => {
    setRelaxationSelectedDest(null);
    setRelaxationShowForm(false);
  };

  const handleSearchTermChange = useCallback((value) => {
    setSearchTerm((prev) => (prev === value ? prev : value));
  }, []);

  useEffect(() => {
    API.get("/destinations")
      .then((res) => setAllDestinations(res.data))
      .catch(console.error);
  }, []);

  const filteredDestinations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return allDestinations;
    return allDestinations.filter((dest) => {
      const haystack = `${dest.name} ${dest.description || ""} ${
        dest.tags || ""
      }`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [allDestinations, searchTerm]);

  useEffect(() => {
    const highlightNames = filteredDestinations
      .slice(0, 3)
      .map((dest) => dest.name)
      .join(", ");
    let summary =
      `Home page shows ${filteredDestinations.length} destinations ` +
      `matching "${searchTerm || "all"}".`;
    if (highlightNames) {
      summary += ` Top cards: ${highlightNames}.`;
    }
    if (visionImages.length) {
      summary += ` ${visionImages.length} reference photo${
        visionImages.length > 1 ? "s are" : " is"
      } queued for AI search.`;
    }
    summary +=
      " Hero supports natural-language search, AI photo upload, and quick trip creation links.";
    setPageContext(summary);
  }, [
    filteredDestinations.length,
    searchTerm,
    visionImages.length,
    setPageContext,
    filteredDestinations,
  ]);

  const persistHeroConversation = async ({
    userContent,
    assistantContent,
    attachments = [],
  }) => {
    if (!userContent && !assistantContent) return false;
    const entries = [];
    if (userContent) {
      entries.push({
        role: "user",
        content: userContent,
        attachments: attachments
          .map((img) => ({
            name: img?.name,
            data_url: img?.thumbnailUrl || img?.previewUrl,
          }))
          .filter((img) => Boolean(img.data_url)),
      });
    }

    if (assistantContent) {
      entries.push({ role: "assistant", content: assistantContent });
    }

    try {
      await API.post("/chat/widget/log", { messages: entries });
      return true;
    } catch (error) {
      console.warn("Unable to persist hero conversation", error);
      return false;
    }
  };

  const handleTextSearch = async () => {
    const query = (searchTerm || "").trim();
    if (!query) {
      toast.info("Nhập câu hỏi du lịch trước khi tìm kiếm nhé.");
      return;
    }
    setTextLoading(true);
    const requestId = `hero-text-${Date.now()}`;
    sendHeroTextRequestToWidget({ requestId, content: query });
    try {
      const res = await API.post("/search/text", { query });
      const friendly =
        res.data?.message || res.data?.summary || res.data?.analysis;
      sendHeroTextResultToWidget({ requestId, response: friendly });
      const persisted = await persistHeroConversation({
        userContent: query,
        assistantContent: friendly,
      });
      if (persisted) {
        refreshChatWidgetHistory({ dropClientRequestId: requestId });
      }
    } catch (error) {
      console.error(error);
      const fallback =
        error.response?.data?.message ||
        "Không thể tìm kiếm gợi ý từ văn bản lúc này.";
      toast.error(fallback);
      sendHeroTextResultToWidget({ requestId, response: fallback });
      const persisted = await persistHeroConversation({
        userContent: query,
        assistantContent: fallback,
      });
      if (persisted) {
        refreshChatWidgetHistory({ dropClientRequestId: requestId });
      }
    } finally {
      setTextLoading(false);
      setSearchTerm("");
    }
  };

  const handleVisionImagesAdd = async (newFiles) => {
    if (!newFiles?.length) return;
    const availableSlots = MAX_VISION_IMAGES - visionImages.length;
    if (availableSlots <= 0) {
      toast.info(`Bạn chỉ có thể chọn tối đa ${MAX_VISION_IMAGES} ảnh.`);
      return;
    }

    const files = Array.from(newFiles).slice(0, availableSlots);
    try {
      const processed = await Promise.all(
        files.map(async (file, idx) => {
          const resized = await resizeImageTo128(file);
          return {
            id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: resized.dataUrl,
            base64: resized.base64,
            thumbnailUrl: resized.dataUrl,
            previewUrl: resized.originalDataUrl,
          };
        })
      );
      setVisionImages((prev) => [...prev, ...processed]);
    } catch (error) {
      console.error(error);
      toast.error("Không thể xử lý một số ảnh, vui lòng thử lại.");
    }
  };

  const handleVisionImageRemove = (id) => {
    setVisionImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleVisionImagePreview = (image) => {
    if (!image) return;
    setActivePreview({
      src: image.previewUrl || image.originalDataUrl || image.dataUrl,
      name: image.name,
    });
  };

  const handleVisionSearch = async () => {
    if (!visionImages.length) {
      toast.info("Hãy thêm ít nhất một ảnh trước khi tìm kiếm.");
      return;
    }
    const queuedImages = visionImages.map((img) => ({ ...img }));
    const requestId = `hero-vision-${Date.now()}`;
    const question = (searchTerm || "").trim();
    sendVisionRequestToWidget({
      requestId,
      question: question || "Tìm kiếm bằng ảnh",
      attachments: queuedImages.map((img, index) => ({
        id: img.id || `${requestId}-${index}`,
        previewUrl: img.previewUrl || img.thumbnailUrl,
        thumbnailUrl: img.thumbnailUrl || img.previewUrl,
        name: img.name,
      })),
    });

    setVisionLoading(true);
    setVisionImages([]);
    setSearchTerm("");
    try {
      const payload = {
        images: queuedImages.map((img) => img.dataUrl),
        question: question || undefined,
      };
      const res = await API.post("/search/vision", payload);
      sendVisionResultToWidget({
        requestId,
        response: res.data?.message || res.data?.summary,
      });
      const persisted = await persistHeroConversation({
        userContent: question || "Tìm kiếm bằng ảnh",
        assistantContent:
          res.data?.message ||
          res.data?.summary ||
          "AI đã trả lời ảnh của bạn.",
        attachments: queuedImages,
      });
      if (persisted) {
        refreshChatWidgetHistory({ dropClientRequestId: requestId });
      }
    } catch (error) {
      console.error(error);
      const fallback =
        error.response?.data?.message ||
        "Không thể phân tích ảnh lúc này, vui lòng thử lại.";
      toast.error(fallback);
      sendVisionResultToWidget({ requestId, response: fallback });
      const persisted = await persistHeroConversation({
        userContent: question || "Tìm kiếm bằng ảnh",
        assistantContent: fallback,
        attachments: queuedImages,
      });
      if (persisted) {
        refreshChatWidgetHistory({ dropClientRequestId: requestId });
      }
    } finally {
      setVisionLoading(false);
    }
  };

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  return (
    <div className="home-container">
      <HeroSection
        searchTerm={searchTerm}
        onSearchChange={handleSearchTermChange}
        visionImages={visionImages}
        onVisionImagesAdd={handleVisionImagesAdd}
        onVisionImageRemove={handleVisionImageRemove}
        onVisionImagePreview={handleVisionImagePreview}
        onVisionSearch={handleVisionSearch}
        onTextSearch={handleTextSearch}
        searching={visionLoading || textLoading}
      />

      <HomeIntro />

      <VacationCarousel />

      <TrendingSection />

      <RelaxationSection
        savedIds={savedIds}
        handleToggleSave={handleToggleSave}
        onCreateTrip={handleRelaxationCreateTrip} // Truyền handler xuống
      />

      <WildlifeSection 
        savedIds={savedIds} 
        handleToggleSave={handleToggleSave}
        onCreateTrip={handleCreateTrip}
      />

      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}

      {/* Modal riêng cho Relaxation Section */}
      {relaxationShowForm && relaxationSelectedDest && (
        <CreateTripForm
          initialDestination={relaxationSelectedDest}
          onClose={handleRelaxationCloseForm}
        />
      )}

      {activePreview && (
        <div
          className="home-image-preview"
          onClick={() => setActivePreview(null)}
          role="button"
          tabIndex={-1}
        >
          <div
            className="home-image-preview-body"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="home-image-preview-close"
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
              <p className="home-image-preview-caption">{activePreview.name}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
