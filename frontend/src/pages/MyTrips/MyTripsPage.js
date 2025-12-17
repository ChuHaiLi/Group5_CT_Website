import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CreateTripForm from '../../components/CreateTripForm';
import AuthRequiredModal from "../../components/AuthRequiredModal/AuthRequired.js";
import { FaEdit, FaTrash, FaEye, FaPlus} from 'react-icons/fa';
import "./MyTripsPage.css";

const getAuthToken = () => localStorage.getItem("access_token");

// --- CONFIRMATION MODAL COMPONENT ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, tripName }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay confirm-modal-overlay">
            <div className="confirm-modal">
                <div className="confirm-modal-icon">⚠️</div>
                <h3>Xác nhận xóa chuyến đi</h3>
                <p>Bạn có chắc chắn muốn xóa chuyến đi <strong>"{tripName}"</strong>?</p>
                <p className="warning-text">Hành động này không thể hoàn tác!</p>

                <div className="confirm-modal-actions">
                    <button onClick={onClose} className="btn-cancel">
                        Hủy
                    </button>
                    <button onClick={onConfirm} className="btn-confirm-delete">
                        Xóa chuyến đi
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- TOAST NOTIFICATION COMPONENT ---
const Toast = ({ message, type, isVisible, onClose }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    if (!isVisible) return null;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    return (
        <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
            <span className="toast-icon">{icons[type]}</span>
            <span className="toast-message">{message}</span>
            <button onClick={onClose} className="toast-close">×</button>
        </div>
    );
};

// --- TRIP CARD COMPONENT ---
const TripCard = ({ trip, handleDelete, handleView, handleEdit }) => {
    const meta = trip.metadata || {};

    const dateDisplay = trip.start_date
        ? `${trip.start_date}${trip.end_date ? ' - ' + trip.end_date : ''}`
        : `Ngày tạo: ${trip.created_at}`;

    return (
        <div className="trip-card">
            <div className="trip-card-image">
                <div className="trip-card-overlay"></div>
                <h3 className="trip-card-title">{trip.name}</h3>
            </div>

            <div className="trip-card-content">
                <div className="trip-info-row">
                    <span className="info-icon">📍</span>
                    <span className="info-text">{trip.province_name}</span>
                </div>

                <div className="trip-info-row">
                    <span className="info-icon">🗓️</span>
                    <span className="info-text">{dateDisplay}</span>
                </div>

                <div className="trip-info-row">
                    <span className="info-icon">⏱️</span>
                    <span className="info-text">{trip.duration} ngày</span>
                </div>

                <div className="trip-metadata-grid">
                    <div className="metadata-item">
                        <span className="metadata-icon">👥</span>
                        <span className="metadata-value">{meta.people || '—'}</span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-icon">💰</span>
                        <span className="metadata-value">{meta.budget || '—'}</span>
                    </div>
                </div>
            </div>

            <div className="trip-card-actions">
                <button
                    onClick={() => handleView(trip.id)}
                    className="action-btn action-view"
                    title="View details"
                >
                    <FaEye /> Details
                </button>
                <button
                    onClick={() => handleEdit(trip.id)}
                    className="action-btn action-edit"
                    title="Edit"
                >
                    <FaEdit /> Edit
                </button>
                <button
                    onClick={() => handleDelete(trip.id, trip.name)}
                    className="action-btn action-delete"
                    title="Delete"
                >
                    <FaTrash />
                </button>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function MyTripsPage() {
     const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return !!localStorage.getItem("access_token");
    });

    const [trips, setTrips] = useState([]);
    const [filteredTrips, setFilteredTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAuthModal, setShowAuthModal] = useState(false); 

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        tripId: null,
        tripName: ''
    });

    // Toast state
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'info'
    });

    const navigate = useNavigate();

    // Toast helper
    const showToast = (message, type = 'info') => {
        setToast({ isVisible: true, message, type });
    };

    const hideToast = () => {
        setToast({ ...toast, isVisible: false });
    };
    
    // Check authentication status và monitor changes
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem("access_token");
            const isAuth = !!token;
            
            // Cập nhật state nếu có thay đổi
            setIsAuthenticated(isAuth);
            
            if (!isAuth) {
                setShowAuthModal(true);
                setIsLoading(false);
                setTrips([]);
                setFilteredTrips([]);
            } else {
                setShowAuthModal(false);
            }
        };

        // Check immediately on mount
        checkAuth();

        // Listen for storage changes (từ các tabs khác)
        const handleStorageChange = (e) => {
            if (e.key === 'access_token' || e.key === null) {
                checkAuth();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        
        // Listen for focus events (khi user quay lại tab)
        window.addEventListener('focus', checkAuth);
        
        // Custom event cho logout trong cùng tab
        window.addEventListener('authChange', checkAuth);
        
        // Polling backup (check mỗi 1 giây)
        const interval = setInterval(checkAuth, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', checkAuth);
            window.removeEventListener('authChange', checkAuth);
            clearInterval(interval);
        };
    }, []);


    // Fetch trips when authenticated
    useEffect(() => {
        const fetchTrips = async () => {
            if (!isAuthenticated) {
                setTrips([]);
                setFilteredTrips([]);
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get("/api/trips", {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                setTrips(response.data);
                setFilteredTrips(response.data);
            } catch (err) {
                setError("Không thể tải danh sách chuyến đi. Vui lòng kiểm tra kết nối.");
                console.error("Error fetching trips:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrips();
    }, [isAuthenticated]);

    // Filter and search logic
    useEffect(() => {
        let result = [...trips];

        // Search by trip name only
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(trip =>
                trip.name.toLowerCase().includes(term)
            );
        }

        // Sort by date: nearest first
        result.sort((a, b) => {
            const dateA = new Date(a.start_date || a.created_at);
            const dateB = new Date(b.start_date || b.created_at);
            return dateA - dateB;
        });

        setFilteredTrips(result);
    }, [searchTerm, trips]);

    // Handlers
    const handleViewTrip = (tripId) => {
        navigate(`/trips/${tripId}`);
    };

    const handleEditTrip = (tripId) => {
        navigate(`/trips/${tripId}/edit`);
    };

    const handleDeleteTrip = (tripId, tripName) => {
        setConfirmModal({
            isOpen: true,
            tripId,
            tripName
        });
    };

    const confirmDelete = async () => {
        const { tripId } = confirmModal;
        try {
            await axios.delete(`/api/trips/${tripId}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            setTrips(prevTrips => prevTrips.filter(trip => trip.id !== tripId));
            showToast("Đã xóa chuyến đi thành công!", "success");
        } catch (err) {
            showToast("Lỗi khi xóa chuyến đi.", "error");
            console.error("Error deleting trip:", err);
        } finally {
            setConfirmModal({ isOpen: false, tripId: null, tripName: '' });
        }
    };

    const handleTripCreated = (newTrip) => {
        // Refresh trips after creating new one
        const fetchTrips = async () => {
            try {
                const response = await axios.get("/api/trips", {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                setTrips(response.data);
                setFilteredTrips(response.data);
            } catch (err) {
                console.error("Error fetching trips:", err);
            }
        };
        fetchTrips();
        setShowCreateForm(false);
        showToast(`Chuyến đi "${newTrip?.name}" đã được tạo thành công!`, "success");
    };

    // ✅ SAU KHI ĐẶT TẤT CẢ HOOKS, MỚI CHECK ĐIỀU KIỆN
    
    if (!isAuthenticated) {
        return (
            <div className="itinerary-container">
                <div className="trips-header">
                    <div className="header-left">
                        <h2>My Itineraries</h2>
                        <p className="header-subtitle">Manage all your trips</p>
                    </div>
                </div>

                <div className="empty-state">
                    <div style={{ fontSize: '80px', marginBottom: '20px' }}>🔒</div>
                    <h3>Login Required</h3>
                    <p>Please login to view and manage your trips</p>
                </div>

                {showAuthModal && (
                    <AuthRequiredModal 
                        onClose={() => {
                            setShowAuthModal(false);
                            navigate('/');
                        }}
                        message="You need to be logged in to view your trips. Please login or register to continue! ✈️"
                    />
                )}
            </div>
        );
    }
    
    // Loading state
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
            {/* Header */}
            <div className="trips-header">
                <div className="header-left">
                    <h2>My Itineraries</h2>
                    <p className="header-subtitle">Manage all your trips</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="add-trip-btn"
                >
                    <FaPlus /> Create a Trip
                </button>
            </div>

            {/* Search Bar Only (No Filter) */}
            <div className="filter-bar">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search trips by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="clear-search"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            {!error && (
                <div className="trip-groups-wrapper">
                    {/* Single list - no grouping */}
                    {filteredTrips.length > 0 ? (
                        <div className="trip-list">
                            {filteredTrips.map(trip => (
                                <TripCard
                                    key={trip.id}
                                    trip={trip}
                                    handleDelete={handleDeleteTrip}
                                    handleView={handleViewTrip}
                                    handleEdit={handleEditTrip}
                                />
                            ))}
                        </div>
                    ) : trips.length > 0 ? (
                        <div className="empty-state">
                            <p>No trips found matching your search.</p>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>You don't have any trips yet. Create one now!</p>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="empty-state-btn"
                            >
                                <FaPlus /> Create your first trip
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showCreateForm && (
                <CreateTripForm
                    initialDestination={null}
                    onClose={() => setShowCreateForm(false)}
                    onTripCreated={handleTripCreated}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, tripId: null, tripName: '' })}
                onConfirm={confirmDelete}
                tripName={confirmModal.tripName}
            />

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
            />
        </div>
    );
}