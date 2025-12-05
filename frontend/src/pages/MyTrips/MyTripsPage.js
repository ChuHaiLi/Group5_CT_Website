import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; 
import "./MyTripsPage.css";

// Giả định hàm này tồn tại để lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token"); 

// --- HÀM HỖ TRỢ HIỂN THỊ (Cần thiết cho cả 2 component) ---
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

const getMetadataDisplay = (metadata) => {
    const people = metadata?.people || '—';
    const budget = metadata?.budget || '—';
    return { people, budget };
};

// --- Component Card cho mỗi chuyến đi ---
const TripCard = ({ trip, handleDelete, handleView }) => {
    const statusTag = getStatusTag(trip.status);
    const meta = getMetadataDisplay(trip.metadata);
    const navigate = useNavigate(); 
    
    // Ngày hiển thị (Ưu tiên Start Date)
    const dateDisplay = trip.start_date 
        ? `${trip.start_date}${trip.end_date ? ' - ' + trip.end_date : ''}` 
        : `Ngày tạo: ${trip.created_at}`;

    return (
        <div className={`trip-card ${statusTag.className}`}>
            <div className="trip-info">
                <span className={`status-tag ${statusTag.className}`}>{statusTag.label}</span>
                <h3>{trip.name}</h3>
                <p>📍 **Địa điểm:** {trip.province_name}</p>
                <p>🗓️ **Thời gian:** {dateDisplay} ({trip.duration} ngày)</p>
                
                {/* HIỂN THỊ METADATA */}
                <div className="trip-metadata">
                    <p>🧑‍🤝‍🧑 **Số người:** {meta.people}</p>
                    <p>💰 **Ngân sách:** {meta.budget}</p>
                </div>
            </div>
            
            <div className="trip-actions">
                <button onClick={() => handleView(trip.id)} className="action-view">
                    Xem Chi tiết
                </button>
                {/* Chuyển hướng đến trang chỉnh sửa bản sao */}
                <button 
                    onClick={() => navigate(`/trips/${trip.id}/edit`)} 
                    className="action-edit"
                >
                    Chỉnh sửa
                </button>
                <button onClick={() => handleDelete(trip.id)} className="action-delete">
                    Xóa
                </button>
            </div>
        </div>
    );
};

// --- Component chính ---
export default function MyTripsPage() {
    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // Hàm gọi API lấy danh sách chuyến đi (GET /api/trips)
    const fetchTrips = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get("/api/trips", {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            setTrips(response.data);
        } catch (err) {
            setError("Không thể tải danh sách chuyến đi.");
            console.error("Error fetching trips:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Hàm chuyển hướng đến trang chi tiết
    const handleViewTrip = (tripId) => {
        navigate(`/trips/${tripId}`); 
    };

    // Hàm xử lý Xóa chuyến đi
    const handleDeleteTrip = async (tripId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa chuyến đi này không?")) return;
        
        try {
            await axios.delete(`/api/trips/${tripId}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            setTrips(prevTrips => prevTrips.filter(trip => trip.id !== tripId));
            alert("Đã xóa chuyến đi thành công!");
        } catch (err) {
            alert("Lỗi khi xóa chuyến đi.");
            console.error("Error deleting trip:", err);
        }
    };

    // Load dữ liệu khi component được mount
    useEffect(() => {
        fetchTrips();
    }, []); 
    
    // LOGIC NHÓM DỮ LIỆU: Phân nhóm theo Status
    const groupedTrips = trips.reduce((acc, trip) => {
        const status = trip.status || 'DRAFT';
        if (!acc[status]) {
            acc[status] = [];
        }
        acc[status].push(trip);
        return acc;
    }, {});

    const renderTripGroup = (status, list) => {
        if (!list || list.length === 0) return null;

        const { label } = getStatusTag(status);
        
        // Sắp xếp theo ngày (gần nhất trước)
        const sortedList = list.sort((a, b) => {
            const dateA = new Date(a.start_date || a.created_at);
            const dateB = new Date(b.start_date || b.created_at);
            
            if (status === 'COMPLETED') {
                return dateB - dateA; 
            }
            return dateA - dateB; 
        });

        return (
            <div key={status} className="trip-group">
                <h3>{label} ({list.length})</h3>
                <div className="trip-list">
                    {sortedList.map(trip => (
                        <TripCard 
                            key={trip.id} 
                            trip={trip} 
                            handleDelete={handleDeleteTrip} 
                            handleView={handleViewTrip}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // Xử lý loading và lỗi
    if (isLoading) {
        return (
            <div className="itinerary-container">
                <h2>My Itineraries 🧭</h2>
                <p>Đang tải dữ liệu chuyến đi...</p>
            </div>
        );
    }

    return (
        <div className="itinerary-container">
            <h2>My Itineraries 🧭</h2>

            <button 
                onClick={() => navigate('/create-trip')} 
                className="add-trip-btn"
            >
                + Tạo Chuyến đi Mới
            </button>
            
            {error && <p className="error-message">Lỗi: {error}</p>}

            {!error && (
                <div className="trip-groups-wrapper">
                    {/* Hiển thị theo thứ tự ưu tiên */}
                    {renderTripGroup('ONGOING', groupedTrips['ONGOING'])}
                    {renderTripGroup('UPCOMING', groupedTrips['UPCOMING'])}
                    {renderTripGroup('DRAFT', groupedTrips['DRAFT'])}
                    {renderTripGroup('COMPLETED', groupedTrips['COMPLETED'])}

                    {trips.length === 0 && <p>Bạn chưa có chuyến đi nào. Hãy tạo một chuyến ngay!</p>}
                </div>
            )}
        </div>
    );
}