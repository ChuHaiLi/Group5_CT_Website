// ItemCard.jsx - FIXED: Buttons ở dưới + Modal xác nhận xóa + DestinationModal
import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaTrash, FaGripVertical, FaInfoCircle } from 'react-icons/fa';
import axios from 'axios';
import DestinationModal from '../../components/DestinationModal';
import './ItemCard.css';

const getAuthToken = () => localStorage.getItem("access_token");

const DURATION_OPTIONS = [
    { value: 15, label: '15 phút' },
    { value: 30, label: '30 phút' },
    { value: 45, label: '45 phút' },
    { value: 60, label: '1 giờ' },
    { value: 75, label: '1 giờ 15 phút' },
    { value: 90, label: '1.5 giờ' },
    { value: 120, label: '2 giờ' },
    { value: 150, label: '2.5 giờ' },
    { value: 180, label: '3 giờ' },
    { value: 240, label: '4 giờ' },
    { value: 300, label: '5 giờ' },
];

const formatDuration = (minutes) => {
    if (typeof minutes !== 'number' || minutes <= 0) return '0 Minutes';

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h > 0 && m > 0) return `${h} Hours ${m} Minutes`;
    if (h > 0) return `${h} Hours`;
    return `${m} Minutes`;
};

const ItemCard = React.memo(({ item, index, onRemove, onUpdate, dayId }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDestinationModal, setShowDestinationModal] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [isLoadingDestination, setIsLoadingDestination] = useState(false);

    let Icon = '📍';
    let themeClass = 'theme-default';

    if (item.category === 'Ăn uống' || item.id === 'LUNCH') {
        Icon = '🍽️';
        themeClass = 'theme-lunch';
    }
    if (item.category === 'Di chuyển' || item.id === 'TRAVEL') {
        Icon = '✈️';
        themeClass = 'theme-travel';
    }

    const handleFieldChange = (field, value) => {
        let finalValue = value;

        if (field === 'time_slot' && value.length === 5) {
            finalValue = `${value}:00`;
        }

        if (field === 'duration') {
            finalValue = parseInt(value, 10);
        }

        onUpdate(dayId, item.uniqueId, { [field]: finalValue });
    };

    const handleViewDetails = async (e) => {
        e.stopPropagation();

        // Skip nếu là LUNCH hoặc TRAVEL
        if (!item.id || item.id === 'LUNCH' || item.id === 'TRAVEL' || item.id === item.uniqueId) {
            return;
        }

        setIsLoadingDestination(true);
        setSelectedDestination(null);
        setShowDestinationModal(true);

        try {
            const response = await axios.get(`/api/destinations/${item.id}`, {
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

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        onRemove(item.uniqueId);
        setShowDeleteConfirm(false);
    };

    const timeValue = item.time_slot ? item.time_slot.substring(0, 5) : '';
    const durationValue = item.duration || 60;

    return (
        <Draggable draggableId={item.uniqueId} index={index}>
            {(provided, snapshot) => (
                <>
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`item-card ${themeClass} ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                        <div className="item-card-main">
                            <div {...provided.dragHandleProps} className="drag-handle">
                                <FaGripVertical />
                            </div>

                            <div className="item-icon">{Icon}</div>

                            <div className="item-content">
                                <input
                                    type="text"
                                    value={item.name}
                                    placeholder="Tên hoạt động/Địa điểm"
                                    className="name-input"
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                />

                                <div className="time-duration-group">
                                    <div className="input-group">
                                        <h3>Time:</h3>
                                        <input
                                            type="time"
                                            value={timeValue}
                                            step="300"
                                            lang="en-GB"
                                            className="time-input"
                                            onChange={(e) => handleFieldChange('time_slot', e.target.value)}
                                            onClick={(e) => {
                                                if (e.target.showPicker) {
                                                    e.target.showPicker();
                                                }
                                            }}
                                            title="Chọn giờ bắt đầu"
                                        />
                                    </div>

                                    <div className="input-group">
                                        <h3>Duration:</h3>
                                        <select
                                            value={durationValue}
                                            className="duration-select"
                                            onChange={(e) => handleFieldChange('duration', e.target.value)}
                                            title="Chọn thời lượng hoạt động"
                                        >
                                            {DURATION_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {formatDuration(opt.value)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <span className="category-badge">
                                    {item.category || item.id}
                                </span>
                            </div>
                        </div>

                        <div className="action-group">
                            {item.id && item.id !== item.uniqueId && item.id !== 'LUNCH' && item.id !== 'TRAVEL' && (
                                <button
                                    onClick={handleViewDetails}
                                    className="view-link-btn"
                                    title="Xem thông tin chi tiết địa điểm"
                                >
                                    <FaInfoCircle /> Xem chi tiết
                                </button>
                            )}
                            <button
                                onClick={handleDeleteClick}
                                className="delete-btn"
                                title="Xóa địa điểm khỏi lịch trình"
                            >
                                <FaTrash /> Xóa địa điểm
                            </button>
                        </div>
                    </div>

                    {/* Confirm Delete Modal */}
                    {showDeleteConfirm && (
                        <div className="modal-overlay confirm-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="confirm-modal-icon">⚠️</div>
                                <h3>Xác nhận xóa địa điểm</h3>
                                <p>Bạn có chắc chắn muốn xóa <strong>"{item.name}"</strong> khỏi lịch trình?</p>
                                <p className="warning-text">Hành động này không thể hoàn tác!</p>

                                <div className="confirm-modal-actions">
                                    <button onClick={() => setShowDeleteConfirm(false)} className="btn-cancel">
                                        Hủy
                                    </button>
                                    <button onClick={confirmDelete} className="btn-confirm-delete">
                                        Xóa địa điểm
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Destination Detail Modal - Giống TripDetailsPage.js */}
                    {showDestinationModal && (
                        <DestinationModal
                            destination={selectedDestination}
                            onClose={() => {
                                setShowDestinationModal(false);
                                setSelectedDestination(null);
                            }}
                        />
                    )}
                </>
            )}
        </Draggable>
    );
});

export default ItemCard;