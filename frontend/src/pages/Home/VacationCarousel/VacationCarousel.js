import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./VacationCarousel.css";

// Import ảnh
import adventureImg from "./adventure.png";
import coupleImg from "./couple.png";
import elderImg from "./elder.png";
import familyImg from "./family.png";
import friendsImg from "./friends.png";
import kidsImg from "./kids.png";
import petImg from "./pet.png";
import soloImg from "./solo.png";

const vacationData = [
  { id: 0, image: familyImg, tag: "Family", label: "Family Journey" },
  { id: 1, image: coupleImg, tag: "Couples", label: "Love Vacation 💕" },
  { id: 2, image: friendsImg, tag: "Friends", label: "Squad Adventure" },
  { id: 3, image: soloImg, tag: "Solo Traveler", label: "Solo Traveler" },
  { id: 4, image: kidsImg, tag: "Kids Friendly", label: "Kids Trip" },
  { id: 5, image: elderImg, tag: "Elderly Friendly", label: "Senior Travel" },
  { id: 6, image: petImg, tag: "Pet Friendly", label: "Paw Holiday 🐾" },
  { id: 7, image: adventureImg, tag: "Adventure Seekers", label: "Risk Taker ⚡" },
];

export default function VacationCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const autoPlayRef = useRef(null);
  const pauseTimeoutRef = useRef(null);

  // Hàm bắt đầu auto-play
  const startAutoPlay = () => {
    stopAutoPlay();
    autoPlayRef.current = setInterval(() => {
      handleNext();
    }, 2500);
  };

  // Hàm dừng auto-play
  const stopAutoPlay = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  // Hàm pause auto-play 1.5s khi user tương tác
  const pauseAutoPlay = () => {
    stopAutoPlay();
    
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    
    pauseTimeoutRef.current = setTimeout(() => {
      startAutoPlay();
    }, 1500);
  };

  // Start auto-play khi mount
  useEffect(() => {
    startAutoPlay();
    return () => {
      stopAutoPlay();
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % vacationData.length);
    setTimeout(() => setIsTransitioning(false), 1000);
  };

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + vacationData.length) % vacationData.length);
    setTimeout(() => setIsTransitioning(false), 1000);
  };

  // Navigate sang Explore với tag
  const handleClick = (tag) => {
    navigate('/explore', {
        state: { preSelectedTags: [tag] }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSlideClick = (position) => {
    if (isTransitioning) return;
    pauseAutoPlay();
    
    if (position === "prev") {
      handlePrev();
    } else if (position === "next") {
      handleNext();
    }
  };

  const handleDotClick = (index) => {
    if (isTransitioning || index === currentIndex) return;
    pauseAutoPlay();
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 1000);
  };

  // Tính position của mỗi item
  const getItemPosition = (itemIndex) => {
    const diff = (itemIndex - currentIndex + vacationData.length) % vacationData.length;
    
    if (diff === 0) return "center";
    if (diff === 1) return "right";
    if (diff === vacationData.length - 1) return "left";
    return "hidden";
  };

  return (
    <section className="vacation-carousel-section">
      <div className="vacation-header">
        <h2 className="vacation-title">Find Your Perfect Escape</h2>
        <p className="vacation-subtitle">Destinations designed for everyone you love – Kids, Seniors, and Pets</p>
      </div>

      <div className={`carousel-track ${isTransitioning ? "no-hover" : ""}`}>
        {vacationData.map((item, index) => {
          const position = getItemPosition(index);
          
          return (
            <div
              key={item.id}
              className={`carousel-item position-${position} ${isTransitioning ? "transitioning" : ""}`}
              onClick={() => {
                if (position === "center") {
                  handleClick(item.tag); // Navigate sang Explore với tag
                } else if (position === "left") {
                  handleSlideClick("prev");
                } else if (position === "right") {
                  handleSlideClick("next");
                }
              }}
            >
              <img src={item.image} alt={item.label} />
              <div className="carousel-overlay">
                <h3 className="carousel-label">{item.label}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dots indicator */}
      <div className="carousel-dots">
        {vacationData.map((_, index) => (
          <span
            key={index}
            className={`dot ${index === currentIndex ? "active" : ""}`}
            onClick={() => handleDotClick(index)}
          />
        ))}
      </div>
    </section>
  );
}