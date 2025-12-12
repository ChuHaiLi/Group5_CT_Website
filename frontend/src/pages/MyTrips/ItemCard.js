// ItemCard.jsx - Redesigned for New Layout
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaClock, FaTrash, FaGripVertical } from 'react-icons/fa';
import './ItemCard.css';

const ItemCard = React.memo(({ item, index, onRemove, onUpdate, dayId }) => {
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
        onUpdate(dayId, item.uniqueId, { [field]: value });
    };

    return (
        <Draggable draggableId={item.uniqueId} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`item-card ${themeClass} ${snapshot.isDragging ? 'dragging' : ''}`}
                >
                    {/* Drag Handle */}
                    <div {...provided.dragHandleProps} className="drag-handle">
                        <FaGripVertical />
                    </div>

                    {/* Icon */}
                    <div className="item-icon">{Icon}</div>
                    
                    {/* Content */}
                    <div className="item-content">
                        <div className="time-input-wrapper">
                            <FaClock className="time-icon" />
                            <input 
                                type="text" 
                                value={item.time_slot || ''} 
                                placeholder="00:00-00:00" 
                                className="time-input" 
                                onChange={(e) => handleFieldChange('time_slot', e.target.value)}
                            />
                        </div>
                        
                        <input 
                            type="text" 
                            value={item.name} 
                            placeholder="Tên hoạt động/Địa điểm" 
                            className="name-input"
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                        />

                        <span className="category-badge">
                            {item.category || item.id}
                        </span>
                    </div>

                    {/* Delete Button */}
                    <button 
                        onClick={() => onRemove(item.uniqueId)} 
                        className="delete-btn" 
                        title="Xóa mục này"
                    >
                        <FaTrash />
                    </button>
                </div>
            )}
        </Draggable>
    );
});

export default ItemCard;