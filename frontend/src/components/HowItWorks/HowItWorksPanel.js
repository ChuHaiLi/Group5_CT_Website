import React, { useState } from "react";
import { FaChevronRight, FaChevronLeft, FaBolt, FaRobot, FaMapMarkedAlt } from "react-icons/fa";
import "./HowItWorksPanel.css";

export default function HowItWorksPanel() {
  const [isOpen, setIsOpen] = useState(false);

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
        <p className="howitworks-title">How WonderAI Works</p>
        <ul>
          <li>
            <FaBolt />
            <div>
              <strong>Capture your vibe</strong>
              <span>
                Ask anything in your own words or upload a reference photo to let the assistant understand your travel mood instantly.
              </span>
            </div>
          </li>
          <li>
            <FaRobot />
            <div>
              <strong>Blend AI + local knowledge</strong>
              <span>
                We cross-check OpenAI recommendations with our curated Vietnam destination graph so every idea stays realistic.
              </span>
            </div>
          </li>
          <li>
            <FaMapMarkedAlt />
            <div>
              <strong>Plan, save, repeat</strong>
              <span>
                Send the ideas to your trips, save favorites, and keep chatting to refine the itinerary in real time.
              </span>
            </div>
          </li>
        </ul>
      </aside>
    </div>
  );
}
