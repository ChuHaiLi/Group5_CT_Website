import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FaClock, FaCalendarAlt, FaRoute, FaUtensils, FaInfoCircle, FaArrowLeft, FaGlobe } from 'react-icons/fa';
import './TripDetailsPage.css';

const getAuthToken = () => localStorage.getItem('access_token'); 

// --- HÀM HỖ TRỢ HIỂN THỊ ---
const getStatusTag = (status) => {
    switch (status) {
        case 'UPCOMING':
            return { label: 'Sắp tới', className: 'status-upcoming' };
        case 'ONGOING':
            return { label: 'Đang diễn ra', className: 'status-ongoing' };
        case 'COMPLETED':
            return { label: 'Đã hoàn thành', className: 'status-completed' };
        default:
            return { label: 'Bản nháp', className: 'status-draft' };
    }
};

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
    
    // Hàm chuyển hướng đến trang chi tiết địa điểm (Destination Card)
    const handleViewDestinationDetails = (destinationId) => {
        navigate(`/destinations/${destinationId}`); 
    };


    if (isLoading) {
        return <div className="details-container">Đang tải chi tiết chuyến đi...</div>;
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
            {/* Nút Quay lại My Trips (navigate(-1) để quay lại trạng thái trước đó) */}
            <button onClick={() => navigate(-1)} className="back-button"><FaArrowLeft /> Quay lại My Trips</button>
            
            <div className="trip-header">
                <h2>{trip.name}</h2>
                <span className={`status-tag ${getStatusTag(trip.status).className}`}>
                    {getStatusTag(trip.status).label}
                </span>
            </div>
            
            {/* Thông tin Tổng quan và Metadata */}
            <div className="trip-summary">
                <p><FaGlobe /> **Địa điểm:** {trip.province_name}</p>
                <p><FaCalendarAlt /> **Ngày đi:** {trip.start_date || 'Chưa xác định'}</p>
                <p><FaClock /> **Thời lượng:** {trip.duration} ngày</p>
                <p><FaInfoCircle /> **Ghi chú:** Người: {metadata.people || '—'} | Ngân sách: {metadata.budget || '—'}</p>
            </div>
            
            <hr />

            <h3>📅 Lịch trình Chi tiết (Phân bổ theo giờ)</h3>
            
            <div className="itinerary-schedule">
                {trip.itinerary.map((dayPlan) => (
                    <div key={dayPlan.day} className="day-card">
                        <h4 className="day-header">Ngày {dayPlan.day}</h4>
                        <ul className="place-list">
                            {/* Duyệt qua từng mục (Địa điểm, Lunch, Travel) */}
                            {dayPlan.places.map((item, index) => {
                                // 🔑 HIỂN THỊ MỤC ĐẶC BIỆT
                                if (item.id === 'LUNCH' || item.id === 'DINNER') {
                                    return (
                                        <li key={index} className="item-lunch">
                                            <span className="time-slot-display"><FaUtensils /> {item.time_slot}</span> 
                                            <strong>{item.name}</strong>
                                        </li>
                                    );
                                }
                                if (item.id === 'TRAVEL') {
                                    return (
                                        <li key={index} className="item-travel">
                                            <span className="time-slot-display"><FaRoute /> {item.time_slot}</span> 
                                            <em>{item.name}</em>
                                        </li>
                                    );
                                }
                                
                                // MỤC LÀ ĐỊA ĐIỂM (Destination)
                                return (
                                    <li key={index} className="item-destination">
                                        <span className="time-slot-display"><FaClock /> {item.time_slot}</span>
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
            
            <div className="action-footer">
                {/* Nút chuyển hướng sang trang chỉnh sửa bản sao */}
                <button 
                    onClick={() => navigate(`/trips/${tripId}/edit`)} 
                    className="action-edit-full"
                >
                    Chỉnh sửa Lịch trình
                </button>
            </div>
        </div>
    );
}