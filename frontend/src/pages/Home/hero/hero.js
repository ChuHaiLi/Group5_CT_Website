import React, { useEffect, useRef, useState } from "react";
import { FiPaperclip, FiMic, FiSend } from "react-icons/fi";
import "./hero.css";
import heroImg from "./hero.png";
import bg from "../assets/home-bg.png";

export default function Hero({
  searchTerm,
  onSearchChange,
  visionImages = [],
  onVisionImagesAdd,
  onVisionImageRemove,
  onVisionImagePreview,
  onVisionSearch,
  onTextSearch,
  searching,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const searchValueRef = useRef("");

  useEffect(() => {
    searchValueRef.current = searchTerm ?? "";
  }, [searchTerm]);

  const handleChange = (event) => {
    onSearchChange?.(event.target.value);
  };

  const handleFiles = (event) => {
    const files = event.target.files;
    if (files && files.length) {
      onVisionImagesAdd?.(files);
      event.target.value = "";
    }
  };

  const handleSubmit = () => {
    if (visionImages.length > 0) {
      onVisionSearch?.();
      return;
    }
    const query = (searchTerm || "").trim();
    if (!query) {
      return;
    }
    onTextSearch?.(query);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  const ensureRecognition = () => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "vi-VN";
    }
    return recognitionRef.current;
  };

  const toggleVoice = () => {
    const recognition = ensureRecognition();
    if (!recognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      return;
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      const base = searchValueRef.current;
      const needsSpace = base && !base.endsWith(" ");
      onSearchChange?.(`${base}${needsSpace ? " " : ""}${transcript}`);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    setIsRecording(true);
    recognition.start();
  };

  return (
    <section className="hero" style={{ backgroundImage: `url(${bg})` }}>
      <div className="hero-overlay" />
      <div className="hero-content">
        <img src={heroImg} alt="AI Smart Travel" className="hero-image" />
        <p className="hero-caption">
          Plan trips faster with instant AI-powered recommendations.
        </p>

        <div className="hero-command-bar">
          <div className="hero-input-stack">
            {visionImages.length > 0 && (
              <div className="hero-inline-attachments">
                {visionImages.map((img) => (
                  <div
                    key={img.id || img.name}
                    className="hero-inline-attachment"
                    title={img.name}
                    onClick={() => onVisionImagePreview?.(img)}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      src={img.thumbnailUrl || img.previewUrl || img.dataUrl}
                      alt={img.name || "reference"}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onVisionImageRemove?.(img.id || img.name);
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              value={searchTerm ?? ""}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about a destination or drop a reference photo..."
            />
          </div>
          <div className="hero-command-actions">
            <button
              type="button"
              className={`hero-icon-button ${isRecording ? "recording" : ""}`}
              onClick={toggleVoice}
              aria-label="Dictate with voice"
            >
              <FiMic size={18} />
            </button>
            <button
              type="button"
              className="hero-icon-button primary"
              onClick={handleSubmit}
              disabled={
                searching ||
                (!visionImages.length && !(searchTerm || "").trim())
              }
            >
              {searching ? "..." : <FiSend size={18} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}