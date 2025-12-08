import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FaClock, FaCalendarAlt, FaRoute, FaUtensils, FaInfoCircle, FaArrowLeft, FaGlobe, FaEdit } from 'react-icons/fa';
import './TripDetailsPage.css';

const getAuthToken = () => localStorage.getItem("access_token");

export default function TripDetailsPage() {
    const { tripId } = useParams(); 
    const navigate = useNavigate();
    
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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
    
    // Hàm chuyển hướng đến trang chi tiết địa điểm
    const handleViewDestinationDetails = (destinationId) => {
        navigate(`/destinations/${destinationId}`); 
    };

    // Hàm chuyển đến trang chỉnh sửa
    const handleEditTrip = () => {
        navigate(`/trips/${tripId}/edit`);
    };

    // 🔥 HÀM MỚI: Quay về My Trips (không dùng navigate(-1))
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
            {/* 🔥 SỬA: Button quay về My Trips - navigate trực tiếp */}
            <button onClick={handleBackToMyTrips} className="back-button">
                <FaArrowLeft /> Quay lại My Trips
            </button>
            
            {/* Trip Header */}
            <div className="trip-header">
                <h2>{trip.name}</h2>
            </div>
            
            {/* Trip Summary */}
            <div className="trip-summary">
                <p><FaGlobe /> <strong>Địa điểm:</strong> {trip.province_name}</p>
                <p><FaCalendarAlt /> <strong>Ngày đi:</strong> {trip.start_date || 'Chưa xác định'}</p>
                <p><FaClock /> <strong>Thời lượng:</strong> {trip.duration} ngày</p>
                <p><FaInfoCircle /> <strong>Ghi chú:</strong> Người: {metadata.people || '—'} | Ngân sách: {metadata.budget || '—'}</p>
            </div>
            
            <hr />

            <h3>📅 Lịch trình Chi tiết</h3>
            
            {/* Itinerary Schedule */}
            <div className="itinerary-schedule">
                {trip.itinerary.map((dayPlan) => (
                    <div key={dayPlan.day} className="day-card">
                        <h4 className="day-header">Ngày {dayPlan.day}</h4>
                        <ul className="place-list">
                            {dayPlan.places.map((item, index) => {
                                // LUNCH
                                if (item.id === 'LUNCH') {
                                    return (
                                        <li key={index} className="item-lunch">
                                            <span className="time-slot-display">
                                                <FaUtensils /> {item.time_slot}
                                            </span> 
                                            <strong>{item.name}</strong>
                                        </li>
                                    );
                                }
                                
                                // TRAVEL
                                if (item.id === 'TRAVEL') {
                                    return (
                                        <li key={index} className="item-travel">
                                            <span className="time-slot-display">
                                                <FaRoute /> {item.time_slot}
                                            </span> 
                                            <em>{item.name}</em>
                                        </li>
                                    );
                                }
                                
                                // DESTINATION
                                return (
                                    <li key={index} className="item-destination">
                                        <span className="time-slot-display">
                                            <FaClock /> {item.time_slot}
                                        </span>
                                        <button 
                                            onClick={() => handleViewDestinationDetails(item.id)}
                                            className="destination-link"
                                            title="Click để xem chi tiết địa điểm"
                                        >
                                            {item.name}
                                        </button>
                                        <span className="place-category"> ({item.category})</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
            
            {/* Action Footer */}
            <div className="action-footer">
                <button 
                    onClick={handleEditTrip}
                    className="action-edit-full"
                >
                Chỉnh sửa Lịch trình
                </button>
                {/* Future: Compare button can be added here */}
            </div>
        </div>
    );
}