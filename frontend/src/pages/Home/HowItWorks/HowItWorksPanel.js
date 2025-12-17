import React, { useState } from "react";
import "./HowItWorksPanel.css";
import { openChatWidget } from "../../../untils/chatWidgetEvents";
import { useNavigate } from "react-router-dom";
import step1Img from "../assets/step1.jpg";
import step2Img from "../assets/step2.jpg";
import step3Img from "../assets/step3.jpg";
import step4Img from "../assets/step4.jpg";
import sampleImg from "../assets/sample.png";

export default function HowItWorksPanel() {
  const navigate = useNavigate();
  const [activeImg, setActiveImg] = useState(sampleImg);

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

  const handleStepClick = (_, idx) => {
    if (idx === 0) {
      openChatWidget();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (idx === 1) {
      navigate("/explore");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (idx === 2) {
      navigate("/MyTrips");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (idx === 3) {
      navigate("/Saved");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  };

  return (
    <section className="howitworks-section">
      <div className="howitworks-inner">
        <div className="howitworks-text">
          <h2 className="howitworks-title">How WonderAI Works</h2>
          <ul>
            {steps.map((step, idx) => (
              <li
                key={step.title}
                data-icon={step.icon}
                className="howitworks-step-item"
                onMouseEnter={() => setActiveImg(step.img)}
                onMouseLeave={() => setActiveImg(sampleImg)}
                onClick={() => handleStepClick(step, idx)}
              >
                <div className="howitworks-step-content">
                  <strong>{step.title}</strong>
                  {step.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="howitworks-preview">
          {activeImg && <img src={activeImg} alt="Step preview" />}
        </div>
      </div>
    </section>
  );
}