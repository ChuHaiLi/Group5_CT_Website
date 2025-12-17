import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import { usePageContext } from "../../context/PageContext";
import { resizeImageTo128 } from "../../untils/imageResizer";

import HeroSection from "./hero/hero";
import CreateTripForm from "../../components/CreateTripForm";
import HomeIntro from "./Intro/HomeIntro";
import HowItWorks from "./HowItWorks/HowItWorksPanel";
import RelaxationSection from "./Relaxation/RelaxationSection";
import TrendingSection from "./Trending/TrendingSection";
import VacationCarousel from "./VacationCarousel/VacationCarousel";
import WildlifeSection from "./Wildlife/WildlifeSection";

import {
  sendVisionRequestToWidget,
  sendVisionResultToWidget,
  refreshChatWidgetHistory,
} from "../../untils/chatWidgetEvents";
import "./HomePage.css";

// Mapping từ tags tiếng Anh sang tiếng Việt để hiển thị trong search bar
const TAG_VIETNAMESE_MAP = {
  "Beach": "biển",
  "Mountain": "núi",
  "Historical Site": "di tích lịch sử",
  "Cultural Site": "di tích văn hóa",
  "Gastronomy": "ẩm thực",
  "Adventure": "phiêu lưu",
  "Nature Park": "công viên thiên nhiên",
  "Urban Area": "đô thị",
  "Island": "đảo",
  "Lake/River": "hồ/sông",
  "Trekking/Hiking": "leo núi",
  "Photography": "chụp ảnh",
  "Camping": "cắm trại",
  "Relaxation/Resort": "nghỉ dưỡng",
  "Shopping": "mua sắm",
  "Water Sports": "thể thao dưới nước",
  "Cycling": "đạp xe",
  "Sightseeing": "tham quan",
  "Wildlife Watching": "xem động vật hoang dã",
  "Local Workshop": "workshop địa phương",
  "Family": "gia đình",
  "Couples": "cặp đôi",
  "Friends": "bạn bè",
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
  "Overnight": "qua đêm",
  "Multi-day Adventure": "phiêu lưu nhiều ngày",
  "Spring": "mùa xuân",
  "Summer": "mùa hè",
  "Autumn": "mùa thu",
  "Winter": "mùa đông",
  "Morning": "buổi sáng",
  "Afternoon": "buổi chiều",
  "Evening": "buổi tối",
  "Night": "ban đêm",
  "Free": "miễn phí",
  "Scenic Views": "cảnh đẹp",
  "Instagrammable Spots": "điểm sống ảo",
  "Local Cuisine": "ẩm thực địa phương",
  "Festivals & Events": "lễ hội và sự kiện",
  "Adventure Sports": "thể thao mạo hiểm",
  "Relaxing Spots": "điểm nghỉ ngơi",
  "Cultural Immersion": "trải nghiệm văn hóa",
  "Hidden Gems": "địa điểm ẩn"
};

// Convert English tag to Vietnamese for display in search bar
const getVietnameseTag = (tag) => {
  return TAG_VIETNAMESE_MAP[tag] || tag;
};

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
      toast.info("Please enter a travel query before searching.");
      return;
    }
    setTextLoading(true);

    // First try to extract destination tags and location name from the user's query.
    try {
      const tagRes = await API.post("/chat/extract_tags", {
        message: query,
        page_context: undefined,
      });
      if (tagRes.data && tagRes.data.ok) {
        const result = tagRes.data.result || {};
        const tags = result.tags || [];
        const locationName = result.location_name || null;
        const navigate = result.navigate || (Array.isArray(tags) && tags.length > 0) || !!locationName;
        
        if (navigate) {
          // Build navigation URL
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
            return;
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("Tag extraction failed:", err);
      }
    }

    // Fallback: call existing text search endpoint for suggestions (no chat forwarding)
    try {
      const res = await API.post("/search/text", { query });
      const friendly =
        res.data?.message || res.data?.summary || res.data?.analysis;
      if (friendly) {
        toast.info(friendly);
      }
    } catch (error) {
      console.error(error);
      const fallback =
        error.response?.data?.message || "Unable to search right now.";
      toast.error(fallback);
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

      <HowItWorks />

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
