import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FaClock, FaCalendarAlt, FaRoute, FaUtensils, FaArrowLeft, FaGlobe, FaEdit, FaUsers, FaMoneyBillWave, FaHotel, FaBed } from 'react-icons/fa';
import DestinationModal from '../../components/DestinationModal';
import './TripDetailsPage.css';

const getAuthToken = () => localStorage.getItem("access_token");

// formatPrice helper (Giữ nguyên)
const formatPrice = (value) => {
    if (value === null || value === undefined) {
        return "Đang cập nhật";
    }

    const stringVal = String(value).toLowerCase().trim();

    if (
        stringVal === "0" ||
        stringVal === "free" ||
        stringVal.includes("miễn phí") ||
        stringVal.includes("mien phi") ||
        Number(value) === 0
    ) {
        return "Miễn phí";
    }

    if (typeof value === 'number' && value > 0) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(value);
    }

    const numValue = Number(value);
    if (!isNaN(numValue) && numValue > 0) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(numValue);
    }

    return value;
};

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

    // State cho Khách sạn
    const [primaryAccommodation, setPrimaryAccommodation] = useState(null);

    // Force re-fetch mỗi khi component mount
    useEffect(() => {
        const fetchTripDetails = async () => {
            setIsLoading(true);
            setError(null);
            setPrimaryAccommodation(null);
            try {
                const timestamp = new Date().getTime();
                const response = await axios.get(`/api/trips/${tripId}?_t=${timestamp}`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });

                const fetchedTrip = response.data;
                // Thêm vào sau dòng: const fetchedTrip = response.data;
                console.log('📊 Trip Status:', fetchedTrip.status);
                console.log('📊 Full Trip Data:', fetchedTrip);
                const actualDays = fetchedTrip.itinerary?.length || 0;

                if (fetchedTrip.duration !== actualDays && actualDays > 0) {
                    fetchedTrip.duration = actualDays;
                }

                // --- [LOGIC TÁCH KHÁCH SẠN] ---
                let hotelFound = null;
                const processedItinerary = fetchedTrip.itinerary ? fetchedTrip.itinerary.map(dayPlan => {
                    const nonHotelPlaces = [];

                    dayPlan.places.forEach(item => {

                        const isHotel =
                            item.is_accommodation === true ||
                            (item.type && item.type.toLowerCase() === 'hotel') ||
                            (item.category && item.category.toLowerCase() === 'hotel');

                        if (isHotel) {
                            if (!hotelFound) {
                                hotelFound = item;
                            }
                        } else {
                            nonHotelPlaces.push(item);
                        }
                    });

                    return {
                        ...dayPlan,
                        places: nonHotelPlaces, // Lịch trình đã lọc
                    };
                }) : [];

                fetchedTrip.itinerary = processedItinerary;

                if (hotelFound) {
                    setPrimaryAccommodation(hotelFound);
                }
                // ---------------------------------------------------

                setTrip(fetchedTrip);
            } catch (err) {
                console.error('❌ [TripDetailsPage] Error:', err);
                setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
            } finally {
                setIsLoading(false);
            }
        };

        if (tripId) {
            fetchTripDetails();
        }
    }, [tripId]);

    // Fetch destination details when clicking on a place (Cho cả địa điểm và Khách sạn)
    const handleViewDestinationDetails = async (destinationId) => {
        // Skip for special items (LUNCH/TRAVEL)
        if (destinationId === 'LUNCH' || destinationId === 'TRAVEL') {
            setSelectedDestination(null); // Đảm bảo preview trống
            return;
        }

        setIsLoadingDestination(true);
        setSelectedDestination(null);
        
        try {
            // ✅ Fetch thông tin chi tiết
            const response = await axios.get(`/api/destinations/${destinationId}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            const fetchedDetails = response.data;
            
            // ✅ CHỈ cập nhật preview, KHÔNG mở modal
            setSelectedDestination(fetchedDetails);

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

    // Hàm gọi khi click vào khách sạn ở khu vực nổi bật
    const handleViewHotelDetails = async () => {
        if (primaryAccommodation) {
            // ✅ Bắt đầu quá trình tải chi tiết và mở Modal
            await handleViewDestinationDetails(primaryAccommodation.id);
            // Modal sẽ tự mở trong handleViewDestinationDetails
        }
    }


    if (isLoading) {
        return (
            <div className="details-container">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading trip details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="details-container error-message">Lỗi: {error}</div>;
    }

    if (!trip) {
        return <div className="details-container">No trip data available.</div>;
    }

    const metadata = trip.metadata || {};

    return (
        <div className="details-container">
            {/* Back Button */}
            <button onClick={handleBackToMyTrips} className="back-button">
                <FaArrowLeft /> Return to My Trips
            </button>

            {/* Trip Header with Title */}
            <div className="trip-header-new">
                <h2>{trip.name}
                    {/* Status badge */}
                    {trip.status && (
                        <span className={`status-badge status-${trip.status}`}>
                            {trip.status}
                        </span>
                    )}
                </h2>
                <button onClick={handleEditTrip} className="edit-btn-header">
                    <FaEdit /> Edit Trip
                </button>
            </div>

            {/* Info Bar - Prominent */}
            <div className="trip-info-bar">
                <div className="info-bar-item">
                    <FaGlobe className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Location</span>
                        <span className="info-bar-value">{trip.province_name}</span>
                    </div>
                </div>

                <div className="info-bar-item">
                    <FaCalendarAlt className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Start Date</span>
                        <span className="info-bar-value">
                            {trip.start_date || 'Not specified'}
                        </span>
                    </div>
                </div>

                {/* End date */}
                <div className="info-bar-item date-info">
                    <FaCalendarAlt className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">End Date</span>
                        <span className="info-bar-value">
                            {trip.end_date || 'Not specified'}
                        </span>
                    </div>
                </div>

                <div className="info-bar-item">
                    <FaClock className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Duration</span>
                        <span className="info-bar-value">
                            {trip.duration} days
                        </span>
                    </div>
                </div>

                <div className="info-bar-item">
                    <FaUsers className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Number of People</span>
                        <span className="info-bar-value">{metadata.people || '—'}</span>
                    </div>
                </div>

                <div className="info-bar-item">
                    <FaMoneyBillWave className="info-bar-icon" />
                    <div className="info-bar-content">
                        <span className="info-bar-label">Budget</span>
                        <span className="info-bar-value">{metadata.budget || '—'}</span>
                    </div>
                </div>
            </div>

            {/* [NEW] Khu vực hiển thị Nơi ở Chính (Primary Accommodation) */}
            <div className="primary-accommodation-section">
                <h3 className="section-title"><FaBed />Primary Residence</h3>
                {primaryAccommodation ? (
                    // Thêm class 'loading-pulse' nếu đang tải chi tiết
                    <div className="accommodation-card" onClick={handleViewHotelDetails}>
                        <FaHotel className="hotel-icon-large" />
                        <div className="accommodation-details">
                            <span className="accommodation-name">{primaryAccommodation.name}</span>
                            <span className="accommodation-category">
                                ({primaryAccommodation.category || primaryAccommodation.type || 'Chỗ ở'})
                            </span>
                        </div>
                        <button
                            className="view-details-btn"
                            disabled={isLoadingDestination}
                        >
                            {isLoadingDestination ? 'Loading...' : 'View Details'}
                        </button>
                    </div>
                ) : (
                    <div className="no-accommodation-info">
                        <p>No primary residence has been selected for this trip.</p>
                    </div>
                )}
            </div>

            {/* 2-Column Layout */}
            <div className="trip-content-layout">
                {/* LEFT: Itinerary */}
                <div className="trip-itinerary-column">
                    <h3 className="column-title">📅 Details schedule</h3>

                    <div className="itinerary-schedule-vertical">
                        {trip.itinerary.map((dayPlan) => (
                            <div key={dayPlan.day} className="day-card-vertical">
                                <h4 className="day-header-vertical">Day {dayPlan.day}</h4>
                                {/* Chỉ render các địa điểm đã lọc (không có khách sạn) */}
                                <ul className="place-list-vertical">
                                    {dayPlan.places.map((item, index) => {
                                        // LUNCH & TRAVEL (Giữ nguyên)
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

                                        // DESTINATION (Đã lọc Hotel)
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

                {/* RIGHT: Destination Preview (Giữ nguyên) */}
                <div className="trip-preview-column">
                    <h3 className="column-title">🔍 Location Information</h3>

                    {!selectedDestination && !isLoadingDestination && (
                        <div className="preview-placeholder">
                            <div className="placeholder-icon">🗺️</div>
                            <p>Click on the location name on the left or Location to see detailed information
</p>
                        </div>
                    )}

                    {isLoadingDestination && (
                        <div className="preview-loading">
                            <div className="loading-spinner-small"></div>
                            <p>Loading information...</p>
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

                                    {/* Improved price formatting */}
                                    {(selectedDestination.entry_fee !== null &&
                                        selectedDestination.entry_fee !== undefined) && (
                                            <div className="preview-info-item">
                                                <FaMoneyBillWave />
                                                <div>
                                                    <strong>Giá vé</strong>
                                                    <p>{formatPrice(selectedDestination.entry_fee)}</p>
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
                                    See full details
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
                    onClose={() => {
                        setShowDestinationModal(false);
                        setSelectedDestination(null);
                    }}
                    hideCreateButton={true}
                />
            )}
        </div>
    );
}