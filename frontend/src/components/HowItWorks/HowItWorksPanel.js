import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import "./HowItWorksPanel.css";

export default function HowItWorksPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const previewRef = useRef(null);
  const shellRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const imageCollections = useMemo(() => {
    const importAll = (r) => {
      try {
        return r.keys().map(r);
      } catch (error) {
        return [];
      }
    };

    return {
      step1: importAll(
        require.context(
          "../../assets/howitworks/step1",
          false,
          /\.(png|jpe?g|webp|avif)$/i
        )
      ),
      step2: importAll(
        require.context(
          "../../assets/howitworks/step2",
          false,
          /\.(png|jpe?g|webp|avif)$/i
        )
      ),
      step3: importAll(
        require.context(
          "../../assets/howitworks/step3",
          false,
          /\.(png|jpe?g|webp|avif)$/i
        )
      ),
      step4: importAll(
        require.context(
          "../../assets/howitworks/step4",
          false,
          /\.(png|jpe?g|webp|avif)$/i
        )
      ),
    };
  }, []);

  const steps = [
    {
      icon: "⚡",
      title: "1. Capture your vibe",
      lines: [
        "Tell us what you dream of — a feeling, a place, or simply drop in a reference photo.",
        "WonderAI reads the atmosphere, the colors, and the mood to instantly understand the style of trip you want.",
      ],
      images: imageCollections.step1,
      route: "/home",
      assetHint: "src/assets/howitworks/step1",
    },
    {
      icon: "🧭",
      title: "2. Blend AI with real local insight",
      lines: [
        "Our engine pairs OpenAI intelligence with curated Vietnam travel knowledge.",
        "Every suggestion is cross-checked to stay realistic, seasonal, and aligned with what locals truly recommend.",
      ],
      images: imageCollections.step2,
      route: "/explore",
      assetHint: "src/assets/howitworks/step2",
    },
    {
      icon: "✨",
      title: "3. Get a smart trip plan",
      lines: [
        "Receive personalized ideas, destinations, and routes crafted around your vibe.",
        "Clear, friendly, and ready to explore.",
      ],
      images: imageCollections.step3,
      route: "/mytrips",
      assetHint: "src/assets/howitworks/step3",
    },
    {
      icon: "❤️",
      title: "4. Save, refine, and perfect",
      lines: [
        "Add suggestions to your trip, save your favorites, and keep chatting with WonderAI.",
        "Your itinerary updates in real time as your inspiration grows.",
      ],
      images: imageCollections.step4,
      route: "/saved",
      assetHint: "src/assets/howitworks/step4",
    },
  ];

  const scrollToImage = useCallback((index) => {
    const viewport = previewRef.current;
    if (!viewport) return;
    const imageNodes = viewport.querySelectorAll("img");
    const target = imageNodes[index];

    if (!target) {
      viewport.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    viewport.scrollTo({
      left: target.offsetLeft - viewport.offsetLeft,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    setActiveImageIndex(0);
    scrollToImage(0);
  }, [activeStep, scrollToImage]);

  const handleImageNav = (direction) => {
    const imagesCount = steps[activeStep].images.length;
    if (!imagesCount) return;

    setActiveImageIndex((prev) => {
      const nextIndex = Math.min(
        Math.max(prev + direction, 0),
        imagesCount - 1
      );
      if (nextIndex !== prev) {
        scrollToImage(nextIndex);
      }
      return nextIndex;
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!shellRef.current) return;
      if (!shellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const imagesCount = steps[activeStep].images.length;
  const canGoPrev = imagesCount > 0 && activeImageIndex > 0;
  const canGoNext = imagesCount > 0 && activeImageIndex < imagesCount - 1;

  return (
    <div className={`howitworks-shell ${isOpen ? "open" : ""}`} ref={shellRef}>
      <button
        className="howitworks-toggle"
        aria-label={isOpen ? "Hide how it works" : "Show how it works"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
      </button>

      <aside className="howitworks-panel" aria-hidden={!isOpen}>
        <p className="howitworks-title">🌟 How WonderAI Works</p>
        <div className="howitworks-grid">
          <ul className="howitworks-list">
            {steps.map((step, index) => (
              <li key={step.title}>
                <button
                  type="button"
                  className={`howitworks-step ${
                    activeStep === index ? "active" : ""
                  }`}
                  onMouseEnter={() => setActiveStep(index)}
                  onFocus={() => setActiveStep(index)}
                  onClick={() => navigate(step.route)}
                >
                  <span className="howitworks-step-icon" aria-hidden="true">
                    <span className="howitworks-step-icon-glyph">
                      {step.icon}
                    </span>
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    {step.lines.map((line, idx) => (
                      <span key={`${step.title}-${idx}`}>{line}</span>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="howitworks-preview">
            <div className="howitworks-preview-header">
              <span>{steps[activeStep].title}</span>
            </div>
            <div className="howitworks-preview-viewport" ref={previewRef}>
              {steps[activeStep].images.length > 0 ? (
                steps[activeStep].images.map((src, idx) => (
                  <img
                    src={src}
                    alt={`${steps[activeStep].title} ${idx + 1}`}
                    key={src}
                  />
                ))
              ) : (
                <p className="howitworks-preview-empty">
                  Drop images into {steps[activeStep].assetHint} to showcase
                  this step.
                </p>
              )}
            </div>
            {steps[activeStep].images.length > 0 && (
              <>
                <button
                  type="button"
                  className="howitworks-preview-nav howitworks-preview-nav--left"
                  onClick={() => handleImageNav(-1)}
                  disabled={!canGoPrev}
                  aria-label="Show previous preview"
                >
                  <FaChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="howitworks-preview-nav howitworks-preview-nav--right"
                  onClick={() => handleImageNav(1)}
                  disabled={!canGoNext}
                  aria-label="Show next preview"
                >
                  <FaChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
