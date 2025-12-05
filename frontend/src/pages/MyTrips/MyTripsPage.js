import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; 
import CreateTripForm from '../../components/CreateTripForm';
import "./MyTripsPage.css";

// Giả định hàm này tồn tại để lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token"); 

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

const getMetadataDisplay = (metadata) => {
    const people = metadata?.people || '—';
    const budget = metadata?.budget || '—';
    return { people, budget };
};

// --- Component Card cho mỗi chuyến đi ---
const TripCard = ({ trip, handleDelete, handleView }) => {
    const statusTag = getStatusTag(trip.status);
    const meta = getMetadataDisplay(trip.metadata);
    
    // Ngày hiển thị (Ưu tiên Start Date)
    const dateDisplay = trip.start_date 
        ? `${trip.start_date}${trip.end_date ? ' - ' + trip.end_date : ''}` 
        : `Ngày tạo: ${trip.created_at}`;

    return (
        <div className={`trip-card ${statusTag.className}`}>
            <div className="trip-info">
                <span className={`status-tag ${statusTag.className}`}>{statusTag.label}</span>
                <h3>{trip.name}</h3>
                <p>📍 <strong>Địa điểm:</strong> {trip.province_name}</p>
                <p>🗓️ <strong>Thời gian:</strong> {dateDisplay} ({trip.duration} ngày)</p>
                
                {/* HIỂN THỊ METADATA */}
                <div className="trip-metadata">
                    <p>🧑‍🤝‍🧑 <strong>Số người:</strong> {meta.people}</p>
                    <p>💰 <strong>Ngân sách:</strong> {meta.budget}</p>
                </div>
            </div>
            
            <div className="trip-actions">
                <button onClick={() => handleView(trip.id)} className="action-view">
                    Xem Chi tiết
                </button>
                <button 
                    onClick={() => console.log(`Mở trang chỉnh sửa ${trip.id}`)} 
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
    const [showCreateForm, setShowCreateForm] = useState(false);
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
            setError("Không thể tải danh sách chuyến đi. Vui lòng kiểm tra kết nối.");
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

    // Hàm xử lý khi tạo trip thành công
    const handleTripCreated = (newTrip) => {
        // Refresh danh sách trips
        fetchTrips();
        setShowCreateForm(false);
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
                return dateB - dateA; // Mới nhất trước
            }
            return dateA - dateB; // Gần nhất trước
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
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Đang tải dữ liệu chuyến đi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="itinerary-container">
            <div className="trips-header">
                <h2>My Itineraries</h2>
                <button 
                    onClick={() => setShowCreateForm(true)} 
                    className="add-trip-btn"
                >
                    Create a Trip
                </button>
            </div>
            
            {error && <p className="error-message">{error}</p>}

            {!error && (
                <div className="trip-groups-wrapper">
                    {/* Hiển thị theo thứ tự ưu tiên */}
                    {renderTripGroup('ONGOING', groupedTrips['ONGOING'])}
                    {renderTripGroup('UPCOMING', groupedTrips['UPCOMING'])}
                    {renderTripGroup('DRAFT', groupedTrips['DRAFT'])}
                    {renderTripGroup('COMPLETED', groupedTrips['COMPLETED'])}

                    {trips.length === 0 && (
                        <div className="empty-state">
                            <p>Bạn chưa có chuyến đi nào. Hãy tạo một chuyến ngay!</p>
                        </div>
                    )}
                </div>
            )}

            {/* CREATE TRIP FORM MODAL */}
            {showCreateForm && (
                <CreateTripForm
                    initialDestination={null}
                    onClose={() => setShowCreateForm(false)}
                    onTripCreated={handleTripCreated}
                />
            )}
        </div>
    );
}