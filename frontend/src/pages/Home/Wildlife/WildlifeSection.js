import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import RecommendCard from "../Recommendations/RecommendCard";
import API from "../../../untils/axios";
import "./WildlifeSection.css";

export default function WildlifeSection({ savedIds, handleToggleSave, onCreateTrip }) {
  const [wildlifePlaces, setWildlifePlaces] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWildlifePlaces = async () => {
      try {
        const response = await API.get("/destinations");
        const allDestinations = response.data || [];
        const filtered = allDestinations.filter((dest) => {
          if (!dest.tags || !Array.isArray(dest.tags)) return false;
          return dest.tags.includes("Wildlife Watching");
        });
        setWildlifePlaces(filtered.slice(0, 10));
      } catch (error) {
        console.error("Không thể tải dữ liệu Wildlife Watching:", error);
      }
    };
    fetchWildlifePlaces();
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
      state: { preSelectedTags: ["Wildlife Watching"] },
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
  }, [wildlifePlaces]);

  if (wildlifePlaces.length === 0) return null;

  return (
    <section className="wildlife-section">
      <div className="wildlife-header">
        <h2 className="wildlife-title">Wildlife & Nature</h2>
        <p className="wildlife-subtitle">
          Encounter Vietnam's incredible wildlife and pristine ecosystems
        </p>
      </div>

      <div className="wildlife-slider-wrapper">
        {canScrollLeft && (
          <button
            className="slider-nav-btn slider-nav-left"
            onClick={() => handleScroll("left")}
            aria-label="Scroll left"
          >
            <FaChevronLeft />
          </button>
        )}

        <div className="wildlife-slider" ref={scrollContainerRef}>
          {wildlifePlaces.map((place) => (
            <div key={place.id} className="wildlife-card-wrapper">
              <RecommendCard
                destination={place}
                isSaved={savedIds.has(place.id)}
                onToggleSave={() => handleToggleSave(place.id)}
                onCreateTrip={onCreateTrip}
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

      <div className="wildlife-view-more">
        <button className="view-more-btn" onClick={handleViewMore}>
          Discover More!
        </button>
      </div>
    </section>
  );
}