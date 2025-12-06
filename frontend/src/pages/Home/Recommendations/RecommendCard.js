import React from "react";
import { FaHeart, FaRegHeart, FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";
import "./RecommendCard.css";

export default function RecommendCard({
  destination,
  isSaved,
  onToggleSave,
  onCardClick,   // <--- Dùng cái này cho Modal (trả về Object)
  onViewDetails, // <--- Dữ phòng cho code cũ (trả về ID)
  onCreateTrip,
}) {
  const handleToggle = (e) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(destination.id);
  };

  // Xử lý click vào card
  const handleCardClick = () => {
    // Ưu tiên onCardClick (cho Modal)
    if (onCardClick) {
      onCardClick(destination);
    } 
    // Fallback sang onViewDetails (nếu Explore cũ vẫn dùng cái này)
    else if (onViewDetails) {
      onViewDetails(destination.id);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalf = (rating || 0) % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    for (let i = 0; i < fullStars; i++)
      stars.push(<FaStar key={`full-${i}`} color="#FFD700" />);
    if (hasHalf) stars.push(<FaStarHalfAlt key="half" color="#FFD700" />);
    for (let i = 0; i < emptyStars; i++)
      stars.push(<FaRegStar key={`empty-${i}`} color="#ccc" />);
    
    return stars;
  };
  
  const cardImageUrl = Array.isArray(destination.image_url) 
    ? destination.image_url[0] 
    : destination.image_url;

  return (
    <div
      className="recommend-card"
      style={{ backgroundImage: `url(${cardImageUrl})` }}
      onClick={handleCardClick} // <--- Gắn hàm xử lý mới vào đây
    >
      <div className="card-overlay" />

      <div className="card-header">
        <div className="save-icon" onClick={handleToggle}>
          {isSaved ? <FaHeart color="red" /> : <FaRegHeart color="white" />}
        </div>
      </div>

      <div className="card-content">
        <h3>{destination.name}</h3>
        <div className="rating">
          <strong>Rating:</strong> {renderStars(destination.rating)}
        </div>

        <button
          className="create-trip-btn"
          onClick={(e) => {
            e.stopPropagation();
            if(onCreateTrip) onCreateTrip(destination); 
          }}
        >
          Create a Trip
        </button>
      </div>
    </div>
  );
}