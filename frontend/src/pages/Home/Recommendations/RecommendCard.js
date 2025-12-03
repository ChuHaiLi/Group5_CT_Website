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
  onSelectPlace,
  mode = "explore"
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
  
  const descriptionText = Array.isArray(destination.description)
    ? destination.description.join(' ')
    : destination.description || '';

  const cardImageUrl = Array.isArray(destination.image_url) 
    ? destination.image_url[0] 
    : destination.image_url;

// --- LOGIC NÚT TÙY CHỈNH DỰA TRÊN MODE ---
  const buttonText = mode === "select" ? "Select Place" : "Create a Trip";
  
  const buttonAction = (e) => {
    e.stopPropagation();
    if (mode === "select" && onSelectPlace) {
      onSelectPlace(destination); // Chế độ select: gửi toàn bộ object destination
    } else if (mode === "explore" && onCreateTrip) {
      onCreateTrip(destination); // Chế độ explore: gửi object để mở form
    }
  };

return (
    <div
      className="recommend-card"
      style={{ backgroundImage: `url(${cardImageUrl})` }}
      onClick={() => onViewDetails?.(destination.id)}
    >
      <div className="card-overlay" />

      {/* SAVE ICON: Chỉ hiển thị ở chế độ explore */}
      {mode === "explore" && (
        <div className="card-header">
          <div className="save-icon" onClick={handleToggle}>
            {isSaved ? <FaHeart color="red" /> : <FaRegHeart color="white" />}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="card-content">
        <h3>{destination.name}</h3>
        
        <p className="card-description-text">{descriptionText}</p>

        <div className="weather">
          <strong>Weather:</strong> {destination.weather || "Sunny 25°C"}
        </div>

        <div className="rating">
          <strong>Rating:</strong> {renderStars(destination.rating)}
        </div>

        <button
          className="create-trip-btn"
          onClick={buttonAction} 
        >
          {buttonText} 
        </button>
      </div>
    </div>
  );
}