import React from "react";
import "./HomePage.css";
import HeroSection from "./hero/hero";
import HomeRecommendations from "./Recommendations/HomeRecommendations";

export default function HomePage({ savedIds, handleToggleSave }) { 
  return (
    <div className="home-container">
      <HeroSection />

      {/* Title riêng */}
      <h2 className="recommendations-title">Recommended Destinations</h2>

      {/* Container card */}
      <div className="home-recommendations-container">
        <HomeRecommendations 
          savedIds={savedIds} 
          handleToggleSave={handleToggleSave} 
        />
      </div>
    </div>
  );
}
