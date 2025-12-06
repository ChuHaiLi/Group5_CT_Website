import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import { usePageContext } from "../../context/PageContext";
import { resizeImageTo128 } from "../../untils/imageResizer";
import "./HomePage.css";
import HeroSection from "./hero/hero";
import HomeRecommendations from "./Recommendations/HomeRecommendations";
import CreateTripForm from "../../components/CreateTripForm";
import {
  sendHeroTextRequestToWidget,
  sendHeroTextResultToWidget,
  sendVisionRequestToWidget,
  sendVisionResultToWidget,
} from "../../untils/chatWidgetEvents";

const MAX_VISION_IMAGES = 4;

export default function HomePage({ savedIds, handleToggleSave }) {
  const [allDestinations, setAllDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visionImages, setVisionImages] = useState([]);
  const [visionResult, setVisionResult] = useState(null);
  const [textResults, setTextResults] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const { setPageContext } = usePageContext();

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
    if (!userContent && !assistantContent) return;
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
    } catch (error) {
      console.warn("Unable to persist hero conversation", error);
    }
  };

  const handleTextSearch = async () => {
    const query = (searchTerm || "").trim();
    if (!query) {
      toast.info("Nhập câu hỏi du lịch trước khi tìm kiếm nhé.");
      return;
    }
    setTextLoading(true);
    setVisionResult(null);
    const requestId = `hero-text-${Date.now()}`;
    sendHeroTextRequestToWidget({ requestId, content: query });
    try {
      const res = await API.post("/search/text", { query });
      setTextResults(res.data);
      const friendly =
        res.data?.message || res.data?.summary || res.data?.analysis;
      sendHeroTextResultToWidget({ requestId, response: friendly });
      persistHeroConversation({
        userContent: query,
        assistantContent: friendly,
      });
    } catch (error) {
      console.error(error);
      const fallback =
        error.response?.data?.message ||
        "Không thể tìm kiếm gợi ý từ văn bản lúc này.";
      toast.error(fallback);
      setTextResults(null);
      sendHeroTextResultToWidget({ requestId, response: fallback });
      persistHeroConversation({
        userContent: query,
        assistantContent: fallback,
      });
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
    setTextResults(null);
    setVisionImages([]);
    setSearchTerm("");
    try {
      const payload = {
        images: queuedImages.map((img) => img.dataUrl),
        question: question || undefined,
      };
      const res = await API.post("/search/vision", payload);
      setVisionResult(res.data);
      sendVisionResultToWidget({
        requestId,
        response: res.data?.message || res.data?.summary,
      });
      persistHeroConversation({
        userContent: question || "Tìm kiếm bằng ảnh",
        assistantContent:
          res.data?.message ||
          res.data?.summary ||
          "AI đã trả lời ảnh của bạn.",
        attachments: queuedImages,
      });
    } catch (error) {
      console.error(error);
      const fallback =
        error.response?.data?.message ||
        "Không thể phân tích ảnh lúc này, vui lòng thử lại.";
      toast.error(fallback);
      setVisionResult(null);
      sendVisionResultToWidget({ requestId, response: fallback });
      persistHeroConversation({
        userContent: question || "Tìm kiếm bằng ảnh",
        assistantContent: fallback,
        attachments: queuedImages,
      });
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
        onSearchChange={(value) => setSearchTerm(value)}
        visionImages={visionImages}
        onVisionImagesAdd={handleVisionImagesAdd}
        onVisionImageRemove={handleVisionImageRemove}
        onVisionImagePreview={handleVisionImagePreview}
        onVisionSearch={handleVisionSearch}
        onTextSearch={handleTextSearch}
        searching={visionLoading || textLoading}
      />

      {textResults && (
        <SearchResultsPanel
          type="text"
          result={textResults}
          onClear={() => setTextResults(null)}
        />
      )}

      {visionResult && (
        <SearchResultsPanel
          type="vision"
          result={visionResult}
          onClear={() => setVisionResult(null)}
        />
      )}

      <h2 className="recommendations-title">Recommended Destinations</h2>

      <div className="home-recommendations-container">
        {filteredDestinations.length === 0 ? (
          <div className="home-empty">
            No destinations matched that search. Try a different keyword.
          </div>
        ) : (
          <HomeRecommendations
            savedIds={savedIds}
            handleToggleSave={handleToggleSave}
            onCreateTrip={handleCreateTrip}
            destinations={filteredDestinations}
          />
        )}
      </div>

      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
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

const confidenceLabel = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}% match`;
};

function SearchResultsPanel({ type, result, onClear }) {
  if (!result) return null;
  const isVision = type === "vision";
  const title = isVision
    ? "Photo-based suggestions"
    : "Smart text search results";
  const summary = isVision ? result.summary : result.analysis || result.summary;
  const friendlyMessage = result.message;
  const suggestions = result.suggestions || [];
  const predictions = isVision ? result.predictions || [] : [];

  return (
    <section className="vision-results">
      <div className="vision-results-header">
        <div>
          <p className="vision-results-title">{title}</p>
          {isVision && predictions.length > 0 && (
            <span className="vision-results-guess">Top predictions</span>
          )}
        </div>
        <button
          type="button"
          className="vision-results-clear"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      {friendlyMessage && (
        <p className="vision-results-message">{friendlyMessage}</p>
      )}

      {summary && summary !== friendlyMessage && (
        <p className="vision-results-summary">{summary}</p>
      )}

      {predictions.length > 0 && (
        <ul className="vision-results-list predictions">
          {predictions.map((prediction, index) => (
            <li key={`prediction-${index}`}>
              {prediction.image_url && (
                <img
                  src={prediction.image_url}
                  alt={prediction.place}
                  className="vision-results-prediction-image"
                />
              )}
              <div className="vision-results-prediction-text">
                <strong>{prediction.place}</strong>
                {confidenceLabel(prediction.confidence) && (
                  <span>{confidenceLabel(prediction.confidence)}</span>
                )}
                {prediction.reason && <span>{prediction.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="vision-results-grid">
          {suggestions.map((item, index) => (
            <article
              key={`suggestion-${index}`}
              className="vision-results-card"
            >
              <div className="vision-results-card-header">
                <div>
                  <p className="vision-results-card-title">{item.name}</p>
                  {item.category && (
                    <span className="vision-results-card-tag">
                      {item.category}
                    </span>
                  )}
                </div>
                {confidenceLabel(item.confidence) && (
                  <span className="vision-results-card-conf">
                    {confidenceLabel(item.confidence)}
                  </span>
                )}
              </div>
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="vision-results-card-image"
                />
              )}
              {item.reason && (
                <p className="vision-results-card-reason">{item.reason}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
