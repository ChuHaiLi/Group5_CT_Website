import React, { useState } from "react";
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import "./HowItWorksPanel.css";

export default function HowItWorksPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const steps = [
    {
      icon: "⚡",
      title: "1. Capture your vibe",
      lines: [
        "Tell us what you dream of — a feeling, a place, or simply drop in a reference photo.",
        "WonderAI reads the atmosphere, the colors, and the mood to instantly understand the style of trip you want.",
      ],
    },
    {
      icon: "🧭",
      title: "2. Blend AI with real local insight",
      lines: [
        "Our engine pairs OpenAI intelligence with curated Vietnam travel knowledge.",
        "Every suggestion is cross-checked to stay realistic, seasonal, and aligned with what locals truly recommend.",
      ],
    },
    {
      icon: "✨",
      title: "3. Get a smart trip plan",
      lines: [
        "Receive personalized ideas, destinations, and routes crafted around your vibe.",
        "Clear, friendly, and ready to explore.",
      ],
    },
    {
      icon: "❤️",
      title: "4. Save, refine, and perfect",
      lines: [
        "Add suggestions to your trip, save your favorites, and keep chatting with WonderAI.",
        "Your itinerary updates in real time as your inspiration grows.",
      ],
    },
  ];

  return (
    <div className={`howitworks-shell ${isOpen ? "open" : ""}`}>
      <button
        className="howitworks-toggle"
        aria-label={isOpen ? "Hide how it works" : "Show how it works"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
      </button>

      <aside className="howitworks-panel" aria-hidden={!isOpen}>
        <p className="howitworks-title">🌟 How WonderAI Works</p>
        <ul>
          {steps.map((step) => (
            <li key={step.title}>
              <span className="howitworks-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <div>
                <strong>{step.title}</strong>
                {step.lines.map((line, idx) => (
                  <span key={`${step.title}-${idx}`}>{line}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
