// ItemCard.jsx - ĐÃ CẬP NHẬT: Fix lỗi hiển thị SA/CH và Thêm Step 5 phút
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaClock, FaTrash, FaGripVertical, FaLink, FaHourglassHalf } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

// Tùy chọn thời lượng (phút) - ĐÃ MỞ RỘNG
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

// Hàm chuyển đổi phút sang HH:MM
const formatDuration = (minutes) => {
    if (typeof minutes !== 'number' || minutes < 0) return '00:00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const ItemCard = React.memo(({ item, index, onRemove, onUpdate, dayId }) => {
    const navigate = useNavigate(); 
    
    let Icon = '📍';
    let themeClass = 'theme-default';
    if (item.category === 'Ăn uống' || item.id === 'LUNCH') { Icon = '🍽️'; themeClass = 'theme-lunch'; }
    if (item.category === 'Di chuyển' || item.id === 'TRAVEL') { Icon = '✈️'; themeClass = 'theme-travel'; }
    
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

    const handleViewDetails = (e) => {
        e.stopPropagation();
        if (item.id && item.id !== item.uniqueId) { 
            navigate(`/locations/${item.id}`); 
        } else {
            alert("Địa điểm này chưa có ID chi tiết.");
        }
    };

    const timeValue = item.time_slot ? item.time_slot.substring(0, 5) : '';
    const durationValue = item.duration || 60; 

    return (
        <Draggable draggableId={item.uniqueId} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`item-card ${themeClass} ${snapshot.isDragging ? 'dragging' : ''}`}
                >
                    <div {...provided.dragHandleProps} className="drag-handle">
                        <FaGripVertical />
                    </div>
                    
                    <div className="item-icon">{Icon}</div>
                    
                    <div className="item-content">
                        {/* Tên */}
                        <input 
                            type="text" 
                            value={item.name} 
                            placeholder="Tên hoạt động/Địa điểm" 
                            className="name-input"
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                        />
                        
                        {/* Giờ + Duration */}
                        <div className="time-duration-group">
                            {/* TIME PICKER (24H + 5MIN STEP) */}
                            <div className="input-group time">
                                <FaClock className="icon" />
                                <input 
                                    type="time" 
                                    value={timeValue} 
                                    step="300" // 5 phút
                                    lang="en-GB" // 👈 BẮT BUỘC ĐỊNH DẠNG 24H
                                    className="time-input" 
                                    onChange={(e) => handleFieldChange('time_slot', e.target.value)}
                                    title="Chọn giờ bắt đầu (bước 5 phút)"
                                />
                            </div>
                            
                            {/* DURATION (Hiển thị HH:MM) */}
                            <div className="input-group duration">
                                <FaHourglassHalf className="icon" />
                                <select
                                    value={durationValue}
                                    className="duration-select"
                                    onChange={(e) => handleFieldChange('duration', e.target.value)}
                                    title="Chọn thời lượng hoạt động"
                                >
                                    {DURATION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {formatDuration(opt.value)} ({opt.label.split(' ')[0]})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <span className="category-badge">{item.category || item.id}</span>
                    </div>

                    <div className="action-group">
                        {item.id && item.id !== item.uniqueId && (
                            <button onClick={handleViewDetails} className="view-link-btn" title="Xem thông tin chi tiết địa điểm">
                                <FaLink />
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onRemove(item.uniqueId); }} className="delete-btn" title="Xóa mục này">
                            <FaTrash />
                        </button>
                    </div>
                </div>
            )}
        </Draggable>
    );
});

export default ItemCard;