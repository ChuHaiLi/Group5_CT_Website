import React, { useState, useMemo } from 'react';
import { FaSearch, FaTimes, FaMapMarkerAlt, FaUtensils, FaHotel } from 'react-icons/fa';
import RecommendCard from '../Home/Recommendations/RecommendCard';

/**
 * Modal để chọn địa điểm khi thêm vào lịch trình
 * Props:
 * - places: Array of destination objects
 * - type: 'destination' | 'food' | 'hotel'
 * - onSelect: (place) => void
 * - onClose: () => void
 */
export default function DestinationPickerModal({ places = [], type = 'destination', onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPlace, setViewingPlace] = useState(null); // For detail modal

  // Normalize utility for search
  const normalize = (str) =>
    String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .trim();

  // Filter places based on type and search term
  const filteredPlaces = useMemo(() => {
    let filtered = places;

    // ✅ FILTER BY TYPE (from JSON)
    if (type === 'hotel') {
      // Lọc khách sạn theo type === "Hotel"
      filtered = filtered.filter(p => {
        const placeType = (p.type || '').toLowerCase();
        const placeTypeFull = (p.place_type || '').toLowerCase();
        return placeType === 'hotel' || placeTypeFull === 'hotel';
      });
    } else if (type === 'food') {
      // Lọc ăn uống theo type === "Restaurant"
      filtered = filtered.filter(p => {
        const placeType = (p.type || '').toLowerCase();
        const placeTypeFull = (p.place_type || '').toLowerCase();
        return placeType === 'restaurant' || placeTypeFull === 'restaurant';
      });
    } else {
      // Lọc địa điểm: Loại trừ Hotel và Restaurant
      filtered = filtered.filter(p => {
        const placeType = (p.type || '').toLowerCase();
        const placeTypeFull = (p.place_type || '').toLowerCase();
        return placeType !== 'hotel' && 
               placeType !== 'restaurant' && 
               placeTypeFull !== 'hotel' && 
               placeTypeFull !== 'restaurant';
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const normalized = normalize(searchTerm);
      filtered = filtered.filter(p => 
        normalize(p.name).includes(normalized) ||
        normalize(p.province_name || '').includes(normalized)
      );
    }

    return filtered;
  }, [places, type, searchTerm]);

  const handleSelectFromCard = (place) => {
    if (onSelect) {
      onSelect(place);
    }
  };

  const handleViewDetails = (place) => {
    setViewingPlace(place);
  };

  // Get icon and title based on type
  const getModalIcon = () => {
    if (type === 'hotel') return <FaHotel />;
    if (type === 'food') return <FaUtensils />;
    return <FaMapMarkerAlt />;
  };

  const getModalTitle = () => {
    if (type === 'hotel') return 'Chọn Khách sạn';
    if (type === 'food') return 'Chọn điểm Ăn uống';
    return 'Chọn Địa điểm';
  };

  const getPlaceholder = () => {
    if (type === 'hotel') return 'Tìm khách sạn, resort...';
    if (type === 'food') return 'Tìm nhà hàng, quán ăn...';
    return 'Tìm địa điểm, điểm tham quan...';
  };

  const getEmptyIcon = () => {
    if (type === 'hotel') return '🏨';
    if (type === 'food') return '🍽️';
    return '📍';
  };

  return (
    <>
      <div 
        className="modal-overlay" 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.6)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10001,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div 
          className="destination-picker-modal"
          style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ 
            padding: '24px', 
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {getModalIcon()}
              {getModalTitle()}
            </h2>
            <button 
              onClick={onClose}
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '1.5rem', 
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ position: 'relative' }}>
              <FaSearch 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} 
              />
              <input
                type="text"
                placeholder={getPlaceholder()}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 48px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <p style={{ 
              marginTop: '8px', 
              fontSize: '0.875rem', 
              color: '#64748b',
              textAlign: 'center'
            }}>
              Tìm thấy {filteredPlaces.length} kết quả
            </p>
          </div>

          {/* Results Grid */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '24px',
            background: '#f9fafb'
          }}>
            {filteredPlaces.length > 0 ? (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                gap: '24px',
                justifyItems: 'center'
              }}>
                {filteredPlaces.map((place) => (
                  <RecommendCard
                    key={place.id}
                    destination={place}
                    mode="select"
                    onSelectPlace={handleSelectFromCard}
                    onViewDetails={() => handleViewDetails(place)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px', opacity: 0.3 }}>
                  {getEmptyIcon()}
                </div>
                <h3>Không tìm thấy kết quả</h3>
                <p>Thử thay đổi từ khóa tìm kiếm hoặc chọn tỉnh/thành khác</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ 
            padding: '16px 24px', 
            borderTop: '2px solid #e5e7eb',
            textAlign: 'center',
            background: '#f9fafb'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: '#f3f4f6',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal - Show when clicking on a card */}
      {viewingPlace && (
        <div 
          className="modal-overlay"
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.75)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10002,
            padding: '20px'
          }}
          onClick={() => setViewingPlace(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '30px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Place details */}
            <div style={{ marginBottom: '20px' }}>
              <img 
                src={Array.isArray(viewingPlace.image_url) ? viewingPlace.image_url[0] : viewingPlace.image_url}
                alt={viewingPlace.name}
                style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px' }}
              />
            </div>
            
            <h2 style={{ marginBottom: '12px' }}>{viewingPlace.name}</h2>
            
            <div style={{ marginBottom: '16px', color: '#64748b' }}>
              <FaMapMarkerAlt style={{ marginRight: '8px' }} />
              {viewingPlace.province_name}
            </div>

            {viewingPlace.description && (
              <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>
                {Array.isArray(viewingPlace.description) 
                  ? viewingPlace.description.join(' ')
                  : viewingPlace.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  handleSelectFromCard(viewingPlace);
                  setViewingPlace(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem'
                }}
              >
                ✓ Chọn địa điểm này
              </button>
              <button
                onClick={() => setViewingPlace(null)}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}