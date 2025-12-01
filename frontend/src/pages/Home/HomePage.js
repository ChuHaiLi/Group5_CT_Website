import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API from "../../untils/axios";
import { usePageContext } from "../../context/PageContext";
import { resizeImageTo128 } from "../../untils/imageResizer";
import {
  sendVisionRequestToWidget,
  sendVisionResultToWidget,
  refreshChatWidgetHistory,
} from "../../untils/chatWidgetEvents";
import "./HomePage.css";
import HeroSection from "./hero/hero";
import HomeRecommendations from "./Recommendations/HomeRecommendations";
import CreateTripForm from "../../components/CreateTripForm";

const MAX_VISION_IMAGES = 4;

export default function HomePage({ savedIds, handleToggleSave }) {
  const [allDestinations, setAllDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visionImages, setVisionImages] = useState([]);
  const [visionResult, setVisionResult] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const { setPageContext } = usePageContext();

  // Load all destinations
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

  const renderVisionResult = (result) => {
    if (!result) return null;
    const text =
      typeof result === "string"
        ? result
        : result?.plain_text || result?.summary || "";
    const segments = text
      .split(/\n\s*\n/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.map((segment, index) => {
      const lines = segment
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const isList =
        lines.length > 1 && lines.every((line) => line.startsWith("- "));

      if (isList) {
        return (
          <div
            key={`vision-chip-${index}`}
            className="vision-results-chip-list"
          >
            {lines.map((line, chipIndex) => (
              <span key={chipIndex} className="vision-results-chip">
                {line.replace(/^[-–]\s*/, "")}
              </span>
            ))}
          </div>
        );
      }

      return (
        <p
          key={`vision-paragraph-${index}`}
          className={`vision-results-paragraph ${index === 0 ? "lead" : ""}`}
        >
          {segment.replace(/\s+/g, " ")}
        </p>
      );
    });
  };

  const logWidgetConversation = async (entries) => {
    const prepared = (entries || []).filter(
      (entry) => entry && entry.role && entry.content
    );
    if (!prepared.length) return;
    try {
      const payload = prepared.map((entry) => ({
        role: entry.role,
        content: entry.content,
        attachments: Array.isArray(entry.attachments)
          ? entry.attachments
              .map((att) => ({
                name: att?.name,
                data_url:
                  att?.data_url || att?.dataUrl || att?.previewUrl || "",
              }))
              .filter((att) => att.data_url)
          : undefined,
      }));
      await API.post("/chat/widget/log", { messages: payload });
      refreshChatWidgetHistory();
    } catch (error) {
      console.warn("Unable to persist widget log", error);
    }
  };

  const handleVisionImagesAdd = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const availableSlots = MAX_VISION_IMAGES - visionImages.length;
    if (availableSlots <= 0) {
      toast.info(`You can add up to ${MAX_VISION_IMAGES} reference photos.`);
      return;
    }
    const usableFiles = files.slice(0, availableSlots);
    try {
      const resized = await Promise.all(usableFiles.map(resizeImageTo128));
      setVisionImages((prev) => [
        ...prev,
        ...resized.map((item, index) => ({
          id: `${Date.now()}-${index}`,
          name: usableFiles[index].name,
          previewUrl: item.originalDataUrl || item.dataUrl,
          thumbnailUrl: item.dataUrl,
          base64: item.base64,
        })),
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Could not process one of the selected photos.");
    }
  };

  const handleVisionImageRemove = (id) => {
    setVisionImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleVisionSearch = async () => {
    const question = (searchTerm || "").trim();
    const queuedImages = visionImages.map((img) => ({ ...img }));
    if (!queuedImages.length) {
      toast.info("Please add at least one reference photo first.");
      return;
    }
    const requestId = `vision-${Date.now()}`;
    const widgetAttachments = queuedImages.map((img) => ({
      id: img.id,
      previewUrl: img.previewUrl,
      thumbnailUrl: img.thumbnailUrl,
      name: img.name,
    }));
    const apiImages = queuedImages.map((img) => img.base64);
    const userNarrative = question || "Tìm kiếm bằng ảnh";

    setVisionLoading(true);
    setVisionImages([]);
    setSearchTerm("");

    sendVisionRequestToWidget({
      requestId,
      question: question || "Tìm kiếm bằng ảnh",
      attachments: widgetAttachments,
    });

    let assistantLogContent = "";
    try {
      const res = await API.post(
        "/search/vision",
        {
          images: apiImages,
          question,
        },
        { responseType: "text" }
      );
      const textResult = res.data || "";
      setVisionResult(textResult);
      assistantLogContent = textResult;
      sendVisionResultToWidget({
        requestId,
        response: { plain_text: textResult },
      });
    } catch (error) {
      console.error(error);
      const fallbackMessage =
        error.response?.data?.message ||
        "Unable to analyze these photos right now. Please try again shortly.";
      toast.error(fallbackMessage);
      assistantLogContent = fallbackMessage;
      sendVisionResultToWidget({
        requestId,
        response: {
          guess: "",
          plain_text: fallbackMessage,
        },
      });
    } finally {
      setVisionLoading(false);
      logWidgetConversation(
        [
          {
            role: "user",
            content: userNarrative,
            attachments: widgetAttachments.map((attachment) => ({
              name: attachment.name,
              data_url: attachment.previewUrl,
              previewUrl: attachment.previewUrl,
            })),
          },
          assistantLogContent
            ? { role: "assistant", content: assistantLogContent }
            : null,
        ].filter(Boolean)
      );
    }
  };

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj); // lưu trực tiếp object
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
        onVisionSearch={handleVisionSearch}
        visionSearching={visionLoading}
      />

      {visionResult && (
        <section className="vision-results">
          <div className="vision-results-header">
            <div>
              <p className="vision-results-title">Photo-based suggestions</p>
            </div>
            <button
              type="button"
              className="vision-results-clear"
              onClick={() => setVisionResult(null)}
            >
              Clear
            </button>
          </div>
          <div className="vision-results-body">
            {renderVisionResult(visionResult)}
          </div>
        </section>
      )}

      <h2 className="recommendations-title">Recommended Destinations</h2>

      {/* Container card */}
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

      {/* Form tạo trip */}
      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
