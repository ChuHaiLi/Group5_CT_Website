import React, { useState } from "react";
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import "./HowItWorksPanel.css";
import { openChatWidget } from "../../utils/chatWidgetEvents";
import { useNavigate } from "react-router-dom";

import step1Img from "./step1.jpg";
import step2Img from "./step2.jpg";
import step3Img from "./step3.jpg";
import step4Img from "./step4.jpg";

export default function HowItWorksPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  const steps = [
    {
      icon: "⚡",
      img: step1Img,
      title: "1. Capture your vibe",
      lines: [
        "Tell us what you dream of — a feeling, a place, or simply drop in a reference photo.",
        "WonderAI reads the atmosphere, the colors, and the mood to instantly understand the style of trip you want.",
      ],
    },
    {
      icon: "🧭",
      img: step2Img,
      title: "2. Blend AI with real local insight",
      lines: [
        "Our engine pairs OpenAI intelligence with curated Vietnam travel knowledge.",
        "Every suggestion is cross-checked to stay realistic, seasonal, and aligned with what locals truly recommend.",
      ],
    },
    {
      icon: "✨",
      img: step3Img,
      title: "3. Get a smart trip plan",
      lines: [
        "Receive personalized ideas, destinations, and routes crafted around your vibe.",
        "Clear, friendly, and ready to explore.",
      ],
    },
    {
      icon: "❤️",
      img: step4Img,
      title: "4. Save, refine, and perfect",
      lines: [
        "Add suggestions to your trip, save your favorites, and keep chatting with WonderAI.",
        "Your itinerary updates in real time as your inspiration grows.",
      ],
    },
  ];

  const navigate = useNavigate();

const handleStepClick = (step, idx) => {
  if (idx === 0) {
    openChatWidget();
    return;
  }

  if (idx === 1) {
    navigate("/explore");
    return;
  }

  if (idx === 2) {
    navigate("/MyTrips");
    return;
  }
  if (idx === 3) {
    navigate("/Saved");
    return;
  }
};

  return (
    <div className={`howitworks-shell ${isOpen ? "open" : ""}`}>
      <button
        className="howitworks-toggle"
        aria-label={isOpen ? "Hide how it works" : "Show how it works"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <FaChevronLeft size={100} /> : <FaChevronRight size={100} />}
      </button>

      <aside className="howitworks-panel" aria-hidden={!isOpen}>
        <p className="howitworks-title">🌟 How WonderAI Works</p>

        <ul>
          {steps.map((step, idx) => (
            <li
              key={step.title}
              data-icon={step.icon}
              className="howitworks-step-item"
              onClick={() => handleStepClick(step, idx)}
              onMouseEnter={() => setPreviewImg(step.img)}
              onMouseLeave={() => setPreviewImg(null)}
            >
              <div className="howitworks-step-content">
                <strong>{step.title}</strong>
                {step.lines.map((line, i) => (
                  <span key={`${step.title}-${i}`}>{line}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Khung preview ảnh */}
      {previewImg && (
        <div className="howitworks-preview">
          <img src={previewImg} alt="preview" />
        </div>
        )}
    </div>
  );
}