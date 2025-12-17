import React from "react";
import { useNavigate } from "react-router-dom";
import "./TrendingSection.css";

// Import ảnh
import beachImg from "../assets/beach.png";
import natureParkImg from "../assets/naturepark.png";
import gastronomyImg from "../assets/gastronomy.png";
import culturalSiteImg from "../assets/culturalsite.png";
import mountainImg from "../assets/mountain.png";

export default function TrendingSection() {
  const navigate = useNavigate();

  const trendingCategories = {
    row1: [
      {
        id: 1,
        name: "Beach",
        tag: "Beach",
        image: beachImg,
        description: "Explore stunning coastal destinations",
      },
      {
        id: 2,
        name: "Nature Park",
        tag: "Nature Park",
        image: natureParkImg,
        description: "Discover lush green landscapes",
      },
    ],
    row2: [
      {
        id: 3,
        name: "Gastronomy",
        tag: "Gastronomy",
        image: gastronomyImg,
        description: "Taste authentic Vietnamese cuisine",
      },
      {
        id: 4,
        name: "Cultural Site",
        tag: "Cultural Site",
        image: culturalSiteImg,
        description: "Experience rich heritage & history",
      },
      {
        id: 5,
        name: "Mountain",
        tag: "Mountain",
        image: mountainImg,
        description: "Adventure in majestic highlands",
      },
    ],
  };

  const handleCategoryClick = (tag) => {
    navigate("/explore", {
      state: { preSelectedTags: [tag] },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="trending-section">
      <div className="trending-header">
        <h2 className="trending-title">Trending Destinations</h2>
        <p className="trending-subtitle">
          Most popular choices for travelers from Vietnam
        </p>
      </div>

      <div className="trending-grid">
        {/* Dòng 1: 2 ảnh */}
        <div className="trending-row-1">
          {trendingCategories.row1.map((category) => (
            <div
              key={category.id}
              className={`trending-card trending-card-${category.id}`}
              onClick={() => handleCategoryClick(category.tag)}
              style={{ backgroundImage: `url(${category.image})` }}
            >
              <div className="trending-card-overlay"></div>
              <div className="trending-card-content">
                <h3 className="trending-card-title">{category.name}</h3>
                <p className="trending-card-description">
                  {category.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Dòng 2: 3 ảnh */}
        <div className="trending-row-2">
          {trendingCategories.row2.map((category) => (
            <div
              key={category.id}
              className={`trending-card trending-card-${category.id}`}
              onClick={() => handleCategoryClick(category.tag)}
              style={{ backgroundImage: `url(${category.image})` }}
            >
              <div className="trending-card-overlay"></div>
              <div className="trending-card-content">
                <h3 className="trending-card-title">{category.name}</h3>
                <p className="trending-card-description">
                  {category.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}