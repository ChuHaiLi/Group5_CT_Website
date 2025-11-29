import React from "react";
import {
  FaHeart,
  FaRegHeart,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
} from "react-icons/fa";
import "./RecommendCard.css";

export default function RecommendCard({
  destination,
  isSaved,
  onToggleSave,
  onViewDetails,
  onCreateTrip,
}) {
  const handleToggle = (e) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(destination.id);
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    for (let i = 0; i < fullStars; i++)
      stars.push(<FaStar key={`full-${i}`} color="#FFD700" />);
    if (hasHalf) stars.push(<FaStarHalfAlt key="half" color="#FFD700" />);
    for (let i = 0; i < emptyStars; i++)
      stars.push(<FaRegStar key={`empty-${i}`} color="#ccc" />);

    return stars;
  };

  return (
    <div
      className="recommend-card"
      style={{ backgroundImage: `url(${destination.image_url})` }}
      onClick={() => onViewDetails?.(destination.id)}
    >
      <div className="card-overlay" />

      {/* SAVE ICON */}
      <div className="card-header">
        <div className="save-icon" onClick={handleToggle}>
          {isSaved ? <FaHeart color="red" /> : <FaRegHeart color="white" />}
        </div>
      </div>

      {/* CONTENT */}
      <div className="card-content">
        <h3>{destination.name}</h3>
        <p>{destination.description}</p>

        <div className="weather">
          <strong>Weather:</strong> {destination.weather || "Sunny 25°C"}
        </div>

        <div className="rating">
          <strong>Rating:</strong> {renderStars(destination.rating)}
        </div>

        {/* BUTTON */}
        <button
          className="create-trip-btn"
          onClick={(e) => {
            e.stopPropagation();
            onCreateTrip?.(destination); // gửi object ra ngoài
          }}
        >
          Create a Trip
        </button>
      </div>
    </div>
  );
}
