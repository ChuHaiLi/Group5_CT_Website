import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FaClock, FaCalendarAlt, FaRoute, FaUtensils, FaArrowLeft, FaGlobe, FaEdit, FaUsers, FaMoneyBillWave } from 'react-icons/fa';
import DestinationModal from '../../components/DestinationModal';
import './TripDetailsPage.css';

const getAuthToken = () => localStorage.getItem("access_token");

export default function TripDetailsPage() {
    const { tripId } = useParams(); 
    const navigate = useNavigate();
    
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State cho destination preview
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [isLoadingDestination, setIsLoadingDestination] = useState(false);
    const [showDestinationModal, setShowDestinationModal] = useState(false);

    useEffect(() => {
        const fetchTripDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get(`/api/trips/${tripId}`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                setTrip(response.data);
            } catch (err) {
                setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
                console.error("Error fetching trip details:", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (tripId) {
            fetchTripDetails();
        }
    }, [tripId]); 
    
    // Fetch destination details when clicking on a place
    const handleViewDestinationDetails = async (destinationId) => {
        // Skip for special items
        if (destinationId === 'LUNCH' || destinationId === 'TRAVEL') return;
        
        setIsLoadingDestination(true);
        setSelectedDestination(null);
        
        try {
            const response = await axios.get(`/api/destinations/${destinationId}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            setSelectedDestination(response.data);
        } catch (err) {
            console.error("Error fetching destination:", err);
            setSelectedDestination({
                error: true,
                message: "Không thể tải thông tin địa điểm"
            });
        } finally {
            setIsLoadingDestination(false);
        }
    };

    const handleEditTrip = () => {
        navigate(`/trips/${tripId}/edit`);
    };

    const handleBackToMyTrips = () => {
        navigate('/mytrips');
    };

    if (isLoading) {
        return (
            <div className="details-container">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Đang tải chi tiết chuyến đi...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="details-container error-message">Lỗi: {error}</div>;
    }

    if (!trip) {
        return <div className="details-container">Không có dữ liệu chuyến đi.</div>;
    }
    
    const metadata = trip.metadata || {};

    return (
        <div className="details-container">
            {/* Back Button */}
            <button onClick={handleBackToMyTrips} className="back-button">
                <FaArrowLeft /> Quay lại My Trips
            </button>
            
            {/* Trip Header with Title */}
            <div className="trip-header-new">
                <h2>{trip.name}</h2>
                <button onClick={handleEditTrip} className="edit-btn-header">
                    <FaEdit /> Chỉnh sửa
                </button>
            </div>
            
            {/* Info Bar - Prominent */}
            <div className="trip-info-bar">
                <div className="info-bar-item">
                    <FaGlobe className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Địa điểm</span>
                        <span className="info-bar-value">{trip.province_name}</span>
                    </div>
                </div>
                
                <div className="info-bar-item">
                    <FaCalendarAlt className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Ngày đi</span>
                        <span className="info-bar-value">
                            {trip.start_date || 'Chưa xác định'}
                        </span>
                    </div>
                </div>
                
                <div className="info-bar-item">
                    <FaClock className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Thời lượng</span>
                        <span className="info-bar-value">{trip.duration} ngày</span>
                    </div>
                </div>
                
                <div className="info-bar-item">
                    <FaUsers className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Số người</span>
                        <span className="info-bar-value">{metadata.people || '—'}</span>
                    </div>
                </div>
                
                <div className="info-bar-item">
                    <FaMoneyBillWave className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Ngân sách</span>
                        <span className="info-bar-value">{metadata.budget || '—'}</span>
                    </div>
                </div>
            </div>

            {/* 2-Column Layout */}
            <div className="trip-content-layout">
                {/* LEFT: Itinerary */}
                <div className="trip-itinerary-column">
                    <h3 className="column-title">📅 Lịch trình Chi tiết</h3>
                    
                    <div className="itinerary-schedule-vertical">
                        {trip.itinerary.map((dayPlan) => (
                            <div key={dayPlan.day} className="day-card-vertical">
                                <h4 className="day-header-vertical">Ngày {dayPlan.day}</h4>
                                <ul className="place-list-vertical">
                                    {dayPlan.places.map((item, index) => {
                                        // LUNCH
                                        if (item.id === 'LUNCH') {
                                            return (
                                                <li key={index} className="item-lunch-vertical">
                                                    <span className="time-slot-vertical">
                                                        <FaUtensils /> {item.time_slot}
                                                    </span> 
                                                    <strong className="item-name-vertical">{item.name}</strong>
                                                </li>
                                            );
                                        }
                                        
                                        // TRAVEL
                                        if (item.id === 'TRAVEL') {
                                            return (
                                                <li key={index} className="item-travel-vertical">
                                                    <span className="time-slot-vertical">
                                                        <FaRoute /> {item.time_slot}
                                                    </span> 
                                                    <em className="item-name-vertical">{item.name}</em>
                                                </li>
                                            );
                                        }
                                        
                                        // DESTINATION
                                        return (
                                            <li 
                                                key={index} 
                                                className={`item-destination-vertical ${selectedDestination?.id === item.id ? 'active' : ''}`}
                                                onClick={() => handleViewDestinationDetails(item.id)}
                                            >
                                                <span className="time-slot-vertical">
                                                    <FaClock /> {item.time_slot}
                                                </span>
                                                <div className="destination-info-vertical">
                                                    <span className="destination-name-vertical">{item.name}</span>
                                                    <span className="destination-category-vertical">({item.category})</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Destination Preview */}
                <div className="trip-preview-column">
                    <h3 className="column-title">📍 Thông tin Địa điểm</h3>
                    
                    {!selectedDestination && !isLoadingDestination && (
                        <div className="preview-placeholder">
                            <div className="placeholder-icon">🗺️</div>
                            <p>Click vào tên địa điểm bên trái để xem thông tin chi tiết</p>
                        </div>
                    )}

                    {isLoadingDestination && (
                        <div className="preview-loading">
                            <div className="loading-spinner-small"></div>
                            <p>Đang tải thông tin...</p>
                        </div>
                    )}

                    {selectedDestination && !selectedDestination.error && (
                        <div className="destination-preview-card">
                            {/* Image */}
                            {selectedDestination.images && selectedDestination.images.length > 0 && (
                                <div 
                                    className="preview-image"
                                    style={{ backgroundImage: `url(${selectedDestination.images[0]})` }}
                                />
                            )}

                            {/* Content */}
                            <div className="preview-content">
                                <h4>{selectedDestination.name}</h4>
                                
                                {selectedDestination.type && (
                                    <span className="preview-badge">{selectedDestination.type}</span>
                                )}

                                {/* Info Grid */}
                                <div className="preview-info-grid">
                                    {selectedDestination.opening_hours && (
                                        <div className="preview-info-item">
                                            <FaClock />
                                            <div>
                                                <strong>Giờ mở cửa</strong>
                                                <p>{selectedDestination.opening_hours}</p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDestination.entry_fee && (
                                        <div className="preview-info-item">
                                            <FaMoneyBillWave />
                                            <div>
                                                <strong>Giá vé</strong>
                                                <p>{selectedDestination.entry_fee}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                {selectedDestination.description && (
                                    <div className="preview-description">
                                        <strong>Mô tả:</strong>
                                        {Array.isArray(selectedDestination.description) ? (
                                            <ul>
                                                {selectedDestination.description.slice(0, 3).map((desc, idx) => (
                                                    <li key={idx}>{desc}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>{selectedDestination.description}</p>
                                        )}
                                    </div>
                                )}

                                {/* View Full Details Button */}
                                <button 
                                    className="preview-view-full-btn"
                                    onClick={() => setShowDestinationModal(true)}
                                >
                                    Xem chi tiết đầy đủ
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedDestination?.error && (
                        <div className="preview-error">
                            <p>{selectedDestination.message}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Destination Modal */}
            {showDestinationModal && selectedDestination && (
                <DestinationModal
                    destination={selectedDestination}
                    onClose={() => setShowDestinationModal(false)}
                />
            )}
        </div>
    );
}