// DestinationModal.js - MERGED: Giữ tính năng AI từ remote + UI improvements từ local

import React, { useEffect, useState } from "react";
import { FaTimes, FaMapMarkerAlt, FaClock, FaMoneyBillWave, FaTag, FaExternalLinkAlt, FaMapPin, FaChevronLeft, FaChevronRight, FaImages } from "react-icons/fa";
import "./DestinationModal.css";

// ✅ THÊM PROP từ local: hideCreateButton (default = false)
export default function DestinationModal({ 
  destination, 
  onClose, 
  onCreateTrip,
  hideCreateButton = false  // 🔥 PROP MỚI từ local
}) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ✅ FIX từ remote: ESC key chỉ đóng image viewer, KHÔNG đóng modal chính
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (showImageViewer) {
          // ✅ Chỉ đóng image viewer
          setShowImageViewer(false);
        } else {
          // ✅ Đóng modal chính
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, showImageViewer]);

  // Chặn scroll khi modal mở
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!destination) return null;

  // --- HÀM TÌM DỮ LIỆU THÔNG MINH (từ remote) ---
  const findValue = (obj, keywords) => {
    if (!obj) return null;
    for (const key of keywords) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
    }
    const lowerKeys = Object.keys(obj).map(k => k.toLowerCase());
    for (const keyword of keywords) {
      const index = lowerKeys.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        const realKey = Object.keys(obj)[index];
        if (obj[realKey] !== undefined && obj[realKey] !== null && obj[realKey] !== "") return obj[realKey];
      }
    }
    return null;
  };

  const rawPrice = findValue(destination, ['entry_fee', 'entryFee', 'price', 'cost', 'fee']);
  const rawHours = findValue(destination, ['opening_hours', 'openingHours', 'open_time', 'time']);
  const rawAddress = findValue(destination, ['address', 'location', 'province_name', 'province']);
  
  // Lấy tất cả ảnh
  const allImages = Array.isArray(destination.images) && destination.images.length > 0
    ? destination.images
    : destination.image_url 
    ? [destination.image_url]
    : [];

  const coverImage = allImages.length > 0 ? allImages[0] : null;

  // --- XỬ LÝ MÔ TẢ (từ remote) ---
  const processDescription = (desc) => {
    if (!desc) return null;
    
    let finalDesc = desc;

    if (typeof desc === 'string') {
      const trimmed = desc.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          finalDesc = JSON.parse(trimmed);
        } catch (e) {
          try {
            const validJson = trimmed.replace(/'/g, '"');
            finalDesc = JSON.parse(validJson);
          } catch (err) {
            finalDesc = trimmed.slice(1, -1).split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
          }
        }
      } else {
        return [desc];
      }
    }

    return Array.isArray(finalDesc) ? finalDesc : [finalDesc];
  };

  const descriptionList = processDescription(destination.description);

  // --- ĐỊNH DẠNG (từ remote) ---
  const formatPrice = (value) => {
    if (value === null || value === undefined) return "Đang cập nhật";
    const stringVal = String(value).toLowerCase();
    if (stringVal === "0" || stringVal.includes("free") || stringVal.includes("miễn phí")) {
      return "Miễn phí";
    }
    if (typeof value === 'number') {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    }
    if (!isNaN(Number(value))) {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
    }
    return value;
  };

  const renderOpeningHours = (hours) => {
    if (!hours) return "Đang cập nhật";
    if (Array.isArray(hours)) {
      return hours.map((h, index) => <div key={index}>{h}</div>);
    }
    if (typeof hours === 'string' && hours.startsWith('[')) {
      try {
        const parsed = JSON.parse(hours.replace(/'/g, '"'));
        if(Array.isArray(parsed)) return parsed.map((h, index) => <div key={index}>{h}</div>);
      } catch(e) {}
    }
    return <span>{hours}</span>;
  };

  const processedTags = processDescription(destination.tags);

  // --- XỬ LÝ IMAGE VIEWER (từ remote) ---
  const openImageViewer = (index) => {
    setCurrentImageIndex(index);
    setShowImageViewer(true);
  };

  // ✅ FIX từ remote: Đóng image viewer KHÔNG đóng modal chính
  const closeImageViewer = () => {
    setShowImageViewer(false);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <>
      {/* MAIN MODAL */}
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={onClose}>
            <FaTimes />
          </button>

          {/* HEADER */}
          <div 
            className="modal-hero-image" 
            style={{ 
              backgroundImage: coverImage ? `url(${coverImage})` : 'none',
              backgroundColor: coverImage ? 'transparent' : '#2d3748',
              height: coverImage ? '250px' : '120px'
            }}
          >
            <div className="modal-hero-overlay"></div>
            <div className="modal-title-container">
              <span className="modal-type-badge">{destination.type || "Địa điểm"}</span>
              <h2 className="modal-title">{destination.name}</h2>
            </div>
          </div>

          <div className="modal-body">
            {/* THÔNG TIN NHANH */}
            <div className="modal-info-grid">
              <div className="info-item">
                <FaClock className="info-icon" />
                <div>
                  <strong>Giờ mở cửa</strong>
                  <div className="info-text">{renderOpeningHours(rawHours)}</div>
                </div>
              </div>

              <div className="info-item">
                <FaMoneyBillWave className="info-icon" />
                <div>
                  <strong>Giá vé / Chi phí</strong>
                  <div className="info-text">{formatPrice(rawPrice)}</div>
                </div>
              </div>

              {rawAddress && (
                <div className="info-item">
                  <FaMapPin className="info-icon" />
                  <div>
                    <strong>Tỉnh Thành</strong>
                    <div className="info-text">{rawAddress}</div>
                  </div>
                </div>
              )}

              {destination.gps && (
                <div className="info-item">
                  <FaMapMarkerAlt className="info-icon" />
                  <div>
                    <strong>Bản đồ</strong>
                    <div className="info-text">
                      <a 
                        href={`https://www.google.com/maps?q=${destination.gps.lat || destination.gps.latitude},${destination.gps.lng || destination.gps.longitude}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="map-link"
                      >
                        Xem trên Google Maps
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MÔ TẢ */}
            <div className="modal-section">
              <h3>Giới thiệu</h3>
              <div className="modal-description-text">
                {descriptionList && descriptionList.length > 0 ? (
                  <ul className="description-list">
                    {descriptionList.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Chưa có mô tả chi tiết.</p>
                )}
              </div>
            </div>

            {/* GALLERY HÌNH ẢNH */}
            {allImages.length > 0 && (
              <div className="modal-section">
                <h3><FaImages style={{marginRight: '8px'}} />Hình ảnh ({allImages.length})</h3>
                <div className="modal-gallery">
                  {allImages.map((img, idx) => (
                    <div key={idx} className="gallery-item" onClick={() => openImageViewer(idx)}>
                      <img src={img} alt={`${destination.name} - ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAGS */}
            {processedTags && processedTags.length > 0 && (
              <div className="modal-section">
                <h3>Tags</h3>
                <div className="modal-tags-list">
                  {processedTags.map((tag, idx) => (
                    <span key={idx} className="modal-tag">
                      <FaTag className="tag-icon-small" /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {destination.source && (
              <div className="modal-source">
                <a href={destination.source} target="_blank" rel="noreferrer">
                  <FaExternalLinkAlt /> Nguồn tham khảo
                </a>
              </div>
            )}
          </div>

          {/* 🔥 FOOTER - ẨN NÚT "Tạo chuyến đi" KHI hideCreateButton = true (từ local) */}
          <div className="modal-footer">
            <button className="modal-btn secondary" onClick={onClose}>Đóng</button>
            
            {/* 🔥 CHỈ HIỂN THỊ KHI hideCreateButton = false */}
            {!hideCreateButton && (
              <button 
                className="modal-btn primary"
                onClick={() => {
                  if(onCreateTrip) onCreateTrip(destination);
                }}
              >
                Tạo chuyến đi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ IMAGE VIEWER OVERLAY - RIÊNG BIỆT, KHÔNG ĐÓNG MODAL CHÍNH (từ remote) */}
      {showImageViewer && allImages.length > 0 && (
        <div 
          className="image-viewer-overlay" 
          onClick={closeImageViewer} // ✅ CHỈ ĐÓI IMAGE VIEWER
        >
          {/* ✅ NÚT X ĐỂ ĐÓNG IMAGE VIEWER */}
          <button className="image-viewer-close" onClick={closeImageViewer}>
            <FaTimes />
          </button>

          <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-nav-btn prev" onClick={goToPrevImage}>
              <FaChevronLeft />
            </button>

            <div className="image-viewer-main">
              <img 
                src={allImages[currentImageIndex]} 
                alt={`${destination.name} - ${currentImageIndex + 1}`}
              />
              <div className="image-counter">
                {currentImageIndex + 1} / {allImages.length}
              </div>
            </div>

            <button className="image-nav-btn next" onClick={goToNextImage}>
              <FaChevronRight />
            </button>
          </div>
        </div>
      )}
    </>
  );
}