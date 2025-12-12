import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import RecommendCard from "../Recommendations/RecommendCard";
import API from "../../../untils/axios";
import "./RelaxationSection.css";

export default function RelaxationSection({ savedIds, handleToggleSave, onCreateTrip }) {
  const [relaxationPlaces, setRelaxationPlaces] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRelaxationPlaces = async () => {
      try {
        const response = await API.get("/destinations");
        const allDestinations = response.data || [];
        
        const filtered = allDestinations.filter((dest) => {
          if (!dest.tags || !Array.isArray(dest.tags)) return false;
          return dest.tags.includes("Relaxation/Resort");
        });

        setRelaxationPlaces(filtered.slice(0, 10));
      } catch (error) {
        console.error("Không thể tải dữ liệu Relaxation/Resort:", error);
      }
    };

    fetchRelaxationPlaces();
  }, []);

  const handleScroll = (direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const cardWidth = 340 + 30;
    const scrollAmount = direction === "left" ? -cardWidth : cardWidth;

    container.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const handleViewMore = () => {
    navigate("/explore", {
      state: { preSelectedTags: ["Relaxation/Resort"] },
    });
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canScrollLeft = scrollPosition > 5;
  const canScrollRight =
    scrollContainerRef.current &&
    scrollPosition <
      scrollContainerRef.current.scrollWidth -
        scrollContainerRef.current.clientWidth - 5;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScrollEvent = () => {
      setScrollPosition(container.scrollLeft);
    };

    container.addEventListener("scroll", handleScrollEvent);
    handleScrollEvent();
    
    return () => container.removeEventListener("scroll", handleScrollEvent);
  }, [relaxationPlaces]);

  if (relaxationPlaces.length === 0) return null;

  return (
    <section className="relaxation-section">
      <div className="relaxation-header">
        <h2 className="relaxation-title">Relax & Rejuvenate</h2>
        <p className="relaxation-subtitle">
          Unwind and rejuvenate at Vietnam's finest retreats
        </p>
      </div>

      <div className="relaxation-slider-container">
        <div className="relaxation-slider-wrapper">
          {canScrollLeft && (
            <button
              className="slider-nav-btn slider-nav-left"
              onClick={() => handleScroll("left")}
              aria-label="Scroll left"
            >
              <FaChevronLeft />
            </button>
          )}

          <div className="relaxation-slider" ref={scrollContainerRef}>
            {relaxationPlaces.map((place) => (
              <div key={place.id} className="relaxation-card-wrapper">
                <RecommendCard
                  destination={place}
                  isSaved={Array.isArray(savedIds) && savedIds.includes(place.id)}
                  onToggleSave={handleToggleSave} // Truyền handler để save/unsave
                  onCreateTrip={onCreateTrip} // Truyền handler để mở form
                  mode="explore"
                />
              </div>
            ))}
          </div>

          {canScrollRight && (
            <button
              className="slider-nav-btn slider-nav-right"
              onClick={() => handleScroll("right")}
              aria-label="Scroll right"
            >
              <FaChevronRight />
            </button>
          )}
        </div>
      </div>

      <div className="relaxation-view-more">
        <button className="view-more-btn" onClick={handleViewMore}>
          Discover More!
        </button>
      </div>
    </section>
  );
}
