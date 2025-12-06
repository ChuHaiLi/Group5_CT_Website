import React from "react";
import {
  FaHeart,
  FaRegHeart,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
  FaMapMarkerAlt,
} from "react-icons/fa";
import "./RecommendCard.css";

// mode có thể là: 'explore', 'select', 'select-search'
export default function RecommendCard({
  destination,
  isSaved,
  onToggleSave,
  onViewDetails,
  onCreateTrip,
  onSelectPlace, // Dùng để chọn/mở modal trong form
  mode = "explore",
}) {
  const handleToggle = (e) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(destination.id);
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0 && rating % 1 >= 0.3;
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

  // --- LOGIC CHỌN HÀNH ĐỘNG KHI CLICK CARD CHUNG ---
  const handleCardClick = () => {
      // Khi ở chế độ tìm kiếm nhỏ, click để MỞ MODAL chi tiết (dùng onSelectPlace)
      if (mode === "select-search" && onSelectPlace) {
          onSelectPlace(destination);
          return;
      }
      // Chế độ xem chi tiết mặc định
      onViewDetails?.(destination.id);
  };

  // Logic nút hành động
  const showActionButton = mode === "explore" || mode === "select";
  const buttonText = mode === "explore" ? "Create a Trip" : "Select Place";

  const buttonAction = (e) => {
    e.stopPropagation();
    if (mode === "select" && onSelectPlace) {
        // Trong Modal chi tiết, bấm nút là Select/Add
        onSelectPlace(destination); 
    } else if (mode === "explore" && onCreateTrip) {
      onCreateTrip(destination);
    }
  };
  
  // RENDER DẠNG THẺ TÌM KIẾM NGẮN (select-search mode)
  if (mode === "select-search") {
    return (
        <div className="search-result-item" onClick={handleCardClick}>
            <div 
                className="search-item-image" 
                style={{ backgroundImage: `url(${cardImageUrl})` }}
            />
            <div className="search-item-content">
                <strong>{destination.name}</strong>
                <small>
                    <FaMapMarkerAlt /> {destination.province_name}
                </small>
                <div className="search-item-rating">
                    {renderStars(destination.rating)} ({destination.rating})
                </div>
            </div>
        </div>
    );
  }

  // RENDER DẠNG THẺ LỚN (explore, select mode)
  return (
    <div
      className="recommend-card"
      style={{ backgroundImage: `url(${cardImageUrl})` }}
      onClick={handleCardClick}
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
          <strong>Weather:</strong> {destination.weather || "N/A"}
        </div>

        <div className="rating">
          <strong>Rating:</strong> {renderStars(destination.rating)}
        </div>

        {showActionButton && (
            <button
              className="create-trip-btn"
              onClick={buttonAction} 
            >
              {buttonText} 
            </button>
        )}
      </div>
    </div>
  );
}