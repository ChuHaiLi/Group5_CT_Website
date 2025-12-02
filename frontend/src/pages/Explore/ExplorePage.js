import React, { useEffect, useState, useRef } from "react";
import API from "../../untils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

import {
  FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
  FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
  FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
  FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
  FaMapMarkedAlt, FaFireAlt, FaPaw, FaSearch, FaChevronUp, FaChevronDown,
  FaChevronLeft, FaChevronRight, FaMusic, FaSpa, FaChild, FaCrown
} from "react-icons/fa";

import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";

import "./ExplorePage.css";

/* ICON MAP */
const ICON_MAP = {
  Beach: <FaUmbrellaBeach />, Mountain: <FaMountain />, "Historical Site": <FaLandmark />,
  "Cultural Site": <FaMusic />, Gastronomy: <FaUtensils />, Adventure: <FaHiking />,
  "Nature Park": <FaTree />, "Urban Area": <FaCity />, Island: <FaWater />, "Lake/River": <FaWater />,
  "Trekking/Hiking": <FaHiking />, Photography: <FaCamera />, Camping: <FaCampground />,
  Relaxation: <FaSpa />, Shopping: <FaShoppingCart />, "Water Sports": <FaSwimmer />,
  Cycling: <FaBicycle />, Sightseeing: <FaBinoculars />, "Wildlife Watching": <FaBinoculars />,
  "Local Workshop": <FaGift />, Family: <FaUsers />, Couples: <FaUsers />, Friends: <FaUsers />,
  "Solo Traveler": <FaUser />, "Kids Friendly": <FaChild />, "Elderly Friendly": <FaUsers />,
  "Pet Friendly": <FaPaw />, "Adventure Seekers": <FaHiking />, "Half Day": <FaClock />,
  "Full Day": <FaClock />, "2 Days": <FaClock />, "3+ Days": <FaClock />, "Weekend Trip": <FaClock />,
  Overnight: <FaClock />, "Multi-day Adventure": <FaClock />, Spring: <FaLeaf />, Summer: <FaSun />,
  Autumn: <FaCloudSun />, Winter: <FaSnowflake />, Morning: <FaSun />, Afternoon: <FaCloudSun />,
  Evening: <FaCalendarAlt />, Night: <FaMoon />, "Free": <FaGift />, "< 5 Triệu": <FaMoneyBillWave />,
  "5 - 10 Triệu": <FaDollarSign />, "10 - 20 Triệu": <FaGem />,
  "> 20 Triệu": <FaCrown />, "Scenic Views": <FaEye />, "Instagrammable Spots": <FaImage />,
  "Local Cuisine": <FaUtensils />, "Festivals & Events": <FaFireAlt />, "Adventure Sports": <FaHiking />,
  "Relaxing Spots": <FaSpa />, "Cultural Immersion": <FaLandmark />, "Hidden Gems": <FaMapMarkedAlt />
};

/* CATEGORY ICONS */
const CATEGORY_ICON_MAP = {
  "Destination Type": <FaMapMarkedAlt />, Activities: <FaHiking />,
  "Target Audience": <FaUsers />, Duration: <FaClock />, "Season/Time": <FaCalendarAlt />,
  Budget: <FaDollarSign />, "Special Features": <FaStar />
};

export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  const categoryRefs = useRef({});

  // Slider state
  const [recommendIndex, setRecommendIndex] = useState(0);
  const CARDS_PER_VIEW = 3;

  useEffect(() => {
    API.get("/destinations")
      .then((res) => setDestinations(res.data))
      .catch(() => toast.error("Failed to fetch destinations"));
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setRecommendIndex(0); // Reset slider khi filter
  };

  const toggleCategory = (title) => {
    setOpenCategory((prev) => (prev === title ? null : title));
  };

  useEffect(() => {
  if (openCategory) {
    const categoryElement = categoryRefs.current[openCategory];
    const dropdown = categoryElement?.querySelector('.tag-list-vertical');
    
    if (categoryElement && dropdown) {
      const rect = categoryElement.getBoundingClientRect();
      const dropdownWidth = dropdown.offsetWidth; // Lấy width của dropdown
      
      dropdown.style.top = `${rect.bottom + 8}px`; // Xuống dưới
      dropdown.style.left = `${rect.left + (rect.width - dropdownWidth) / 2}px`; // Căn giữa
    }
  }
}, [openCategory]);

  // Hoặc nếu muốn đóng dropdown khi scroll (đơn giản hơn):
  useEffect(() => {
    const handleScroll = () => {
      if (openCategory) {
        setOpenCategory(null);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [openCategory]);

  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch = dest.name.toLowerCase().includes(search.toLowerCase());
    const matchesTags =
      selectedTags.length === 0 || selectedTags.every((tag) => dest.tags.includes(tag));
    return matchesSearch && matchesTags;
  });

  const maxRecommendIndex = Math.max(0, filteredDestinations.length - CARDS_PER_VIEW);
  const handlePrevRecommend = () => setRecommendIndex((prev) => Math.max(prev - 1, 0));
  const handleNextRecommend = () => setRecommendIndex((prev) => Math.min(prev + 1, maxRecommendIndex));

  return (
    <div className="explore-container">
      <h1 className="explore-header">Explore</h1>

      {/* Search */}
      <div className="search-bar enhanced">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tag Categories */}
      <div className="categories-row">
        {TAG_CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            className={`category-item ${openCategory === cat.title ? "open" : ""}`}
            ref={(el) => (categoryRefs.current[cat.title] = el)}
          >
            <button
              className={`category-btn ${openCategory === cat.title ? "active" : ""}`}
              onClick={() => toggleCategory(cat.title)}
            >
              <span className="category-left">
                <span className="category-icon-bubble">
                  {CATEGORY_ICON_MAP[cat.title] || <FaLandmark />}
                </span>
                {cat.title}
              </span>
              <span className="category-arrow">
                {openCategory === cat.title ? <FaChevronUp /> : <FaChevronDown />}
              </span>
            </button>

            <div className={`tag-list-vertical ${openCategory === cat.title ? "open" : ""}`}>
              {cat.tags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-btn ${selectedTags.includes(tag) ? "active" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  <span className="tag-icon">{ICON_MAP[tag]}</span>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recommended */}
      <h2 className="recommend-header">Recommended for you</h2>

      <div className="recommend-container">
        <button
          className="arrow-btn left"
          onClick={handlePrevRecommend}
          disabled={recommendIndex === 0}
        >
          <FaChevronLeft />
        </button>

        <div className="recommend-grid">
          {filteredDestinations
            .slice(recommendIndex, recommendIndex + CARDS_PER_VIEW)
            .map((dest) => (
              <div key={dest.id} className="recommend-item">
                <RecommendCard
                  destination={dest}
                  isSaved={savedIds.has(dest.id)}
                  onToggleSave={() => handleToggleSave(dest.id)}
                  onCreateTrip={() => {
                    setSelectedDestination(dest);
                    setShowForm(true);
                  }}
                />
              </div>
            ))}
        </div>

        <button
          className="arrow-btn right"
          onClick={handleNextRecommend}
          disabled={recommendIndex === maxRecommendIndex}
        >
          <FaChevronRight />
        </button>
      </div>

      {/* Create Trip Form */}
      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
