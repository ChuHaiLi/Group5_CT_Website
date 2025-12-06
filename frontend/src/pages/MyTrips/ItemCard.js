// ItemCard.jsx
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

// 🔑 Component này không cần imports logic từ dndLogic.js, nó chỉ cần chạy Draggable

const ItemCard = React.memo(({ item, index, onRemove, onUpdate, dayId }) => {
    let Icon = '📍';
    let themeClass = 'theme-default'; 

    if (item.category === 'Ăn uống' || item.id === 'LUNCH') { Icon = '🍽️'; themeClass = 'theme-lunch'; }
    if (item.category === 'Di chuyển' || item.id === 'TRAVEL') { Icon = '✈️'; themeClass = 'theme-travel'; } 
    
    const handleFieldChange = (field, value) => {
        // Lưu ý: Nếu người dùng thay đổi time_slot thủ công, logic auto-time sẽ ghi đè
        // trừ khi bạn thêm logic kiểm tra xem người dùng có thay đổi thủ công không.
        onUpdate(dayId, item.uniqueId, { [field]: value });
    };

    return (
        <Draggable draggableId={item.uniqueId} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps} 
                    className={`item-card-base ${themeClass} 
                        ${snapshot.isDragging ? 'item-card-dragging' : ''}`
                    }
                >
                    <span className="icon-xl">{Icon}</span>
                    
                    <div className="item-input-group">
                        <input 
                            type="text" 
                            value={item.time_slot || ''} 
                            placeholder="Giờ" 
                            className="input-field-base input-time" 
                            onChange={(e) => handleFieldChange('time_slot', e.target.value)}
                        />
                        
                        <input 
                            type="text" 
                            value={item.name} 
                            placeholder="Tên hoạt động/Địa điểm" 
                            className="input-field-base"
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                        />
                    </div>

                    <div className="btn-remove-group">
                        <span className="text-xs text-gray-500 mr-3 hidden sm:inline">({item.category || item.id})</span>

                        <button 
                            onClick={() => onRemove(item.uniqueId)} 
                            className="btn-remove" 
                            title="Xóa mục này"
                        >
                            ❌
                        </button>
                    </div>
                </div>
            )}
        </Draggable>
    );
});

export default ItemCard;