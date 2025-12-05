import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { FaClock, FaArrowLeft, FaTimes, FaSave, FaPlusCircle } from 'react-icons/fa';

const getAuthToken = () => localStorage.getItem("access_token"); 

// Định nghĩa các hằng số
const START_HOUR_DEFAULT = 8.0; // Giờ bắt đầu cố định (8:00 sáng)
const TRAVEL_BUFFER = 0.5; // 30 phút

// --- HÀM HỖ TRỢ: TÍNH TOÁN LẠI KHUNG GIỜ (Cốt lõi) ---
const recalculateTimeSlots = (itinerary, START_HOUR = START_HOUR_DEFAULT, TRAVEL_BUFFER = TRAVEL_BUFFER) => {
    const newItinerary = JSON.parse(JSON.stringify(itinerary));
    
    newItinerary.forEach(dayPlan => {
        let currentTimeHour = START_HOUR; 
        
        dayPlan.places.forEach((item, index) => {
            let duration = parseFloat(item.duration) || 0; 
            
            if (item.id === 'LUNCH') { duration = 1.0; } 
            
            const start_time_hour = Math.floor(currentTimeHour);
            const start_time_minutes = Math.round((currentTimeHour % 1) * 60);

            const end_time_float = currentTimeHour + duration;
            const end_time_hour = Math.floor(end_time_float);
            const end_time_minutes = Math.round((end_time_float % 1) * 60);

            item.time_slot = `${start_time_hour.toString().padStart(2, '0')}:${start_time_minutes.toString().padStart(2, '0')} - ${end_time_hour.toString().padStart(2, '0')}:${end_time_minutes.toString().padStart(2, '0')}`;
            
            currentTimeHour = end_time_float;
            
            if (item.id !== 'TRAVEL' && item.id !== 'LUNCH' && index < dayPlan.places.length - 1) {
                 currentTimeHour += TRAVEL_BUFFER;
            }
        });
    });
    return newItinerary;
};


// --- COMPONENT CHÍNH ---
export default function TripEditPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();
    
    const [workingCopy, setWorkingCopy] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const TRAVEL_BUFFER_CONST = 0.5; 

    // --- A. LOAD DỮ LIỆU VÀ TẠO BẢN SAO ---
    useEffect(() => {
        const fetchTripDetails = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(`/api/trips/${tripId}`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                
                const initialItinerary = response.data.itinerary || [];
                
                const enrichedItinerary = initialItinerary.map(dayPlan => ({
                    ...dayPlan,
                    places: dayPlan.places.map(item => ({
                        ...item,
                        duration: item.duration || item.duration_hours || (item.id === 'LUNCH' ? 1.0 : item.id === 'TRAVEL' ? TRAVEL_BUFFER : 2.0) 
                    }))
                }));
                
                const recalculatedCopy = recalculateTimeSlots(enrichedItinerary, START_HOUR_DEFAULT, TRAVEL_BUFFER);
                setWorkingCopy(recalculatedCopy);
            } catch (err) {
                setError("Không thể tải lịch trình để chỉnh sửa.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchTripDetails();
    }, [tripId]);


    // --- B. HÀM THAO TÁC CƠ BẢN (SỬ DỤNG useCallback) ---
    
    // Hàm tính lại khung giờ sau mọi thao tác thay đổi duration/thứ tự
    const updateItineraryAndRecalculate = useCallback((newCopy) => {
        setWorkingCopy(recalculateTimeSlots(newCopy, START_HOUR_DEFAULT, TRAVEL_BUFFER));
    }, [workingCopy]);

    // 1. XỬ LÝ KÉO THẢ (Drag & Drop) - LOGIC ĐÃ FIX
    const onDragEnd = useCallback((result) => {
        const { source, destination } = result;
        if (!destination) return;
        
        const sourceDayIndex = parseInt(source.droppableId.split('-')[1]) - 1;
        const destinationDayIndex = parseInt(destination.droppableId.split('-')[1]) - 1;
        
        const newCopy = JSON.parse(JSON.stringify(workingCopy));
        
        const draggedItem = newCopy[sourceDayIndex].places[source.index];
        if (draggedItem.id === 'TRAVEL' || draggedItem.id === 'LUNCH') {
            return;
        }

        // 1. Cắt mục khỏi vị trí cũ
        const [removed] = newCopy[sourceDayIndex].places.splice(source.index, 1);
        
        // 2. Chèn vào vị trí mới
        newCopy[destinationDayIndex].places.splice(destination.index, 0, removed);
        
        // 3. TÍNH TOÁN LẠI KHUNG GIỜ
        updateItineraryAndRecalculate(newCopy);

    }, [workingCopy, updateItineraryAndRecalculate]);

    // 2. XÓA MỤC
    const handleDelete = useCallback((dayIndex, itemIndex) => {
        const itemToDelete = workingCopy[dayIndex].places[itemIndex];
        if (itemToDelete.id === 'TRAVEL' || itemToDelete.id === 'LUNCH') {
            alert('Không thể xóa mục cố định.');
            return;
        }
        
        if (!window.confirm(`Xóa "${itemToDelete.name}" khỏi lịch trình?`)) return;
        
        const newCopy = JSON.parse(JSON.stringify(workingCopy));
        newCopy[dayIndex].places.splice(itemIndex, 1);
        updateItineraryAndRecalculate(newCopy);
    }, [workingCopy, updateItineraryAndRecalculate]);
    
    // 3. THAY ĐỔI THỜI LƯỢNG (DURATION)
    const handleDurationChange = useCallback((dayIndex, itemIndex, newDuration) => {
        const durationValue = parseFloat(newDuration);
        
        const itemToModify = workingCopy[dayIndex].places[itemIndex];
        if (itemToModify.id === 'TRAVEL' || (itemToModify.id === 'LUNCH' && durationValue !== 1.0)) {
            alert("Mục này có thời lượng cố định.");
            return;
        }

        if (isNaN(durationValue) || durationValue < 0.5) return; 

        const newCopy = JSON.parse(JSON.stringify(workingCopy));
        newCopy[dayIndex].places[itemIndex].duration = durationValue;
        
        updateItineraryAndRecalculate(newCopy);
    }, [workingCopy, updateItineraryAndRecalculate]);
    
    // 4. THÊM ĐỊA ĐIỂM MỚI (Tùy chỉnh)
    const handleAddDestination = useCallback((dayIndex) => {
        const newCopy = JSON.parse(JSON.stringify(workingCopy));
        const newItem = {
            id: `CUSTOM-${Date.now()}`,
            name: "Địa điểm Tùy chỉnh (2h)",
            category: "Custom",
            duration: 2.0, 
            time_slot: ''
        };
        
        newCopy[dayIndex].places.push(newItem);
        
        updateItineraryAndRecalculate(newCopy);
    }, [workingCopy, updateItineraryAndRecalculate]);


    // --- C. LƯU BẢN SAO VÀO BACKEND ---
    const handleSaveItinerary = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn lưu các thay đổi này không? Lộ trình gốc sẽ bị ghi đè.")) return;
        
        try {
            // Chuẩn bị data: Chỉ giữ lại các trường mà Backend cần
            const cleanItinerary = workingCopy.map(dayPlan => ({
                ...dayPlan,
                places: dayPlan.places.filter(item => item.id !== 'TRAVEL' && item.id !== 'LUNCH').map(item => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    time_slot: item.time_slot,
                    duration: item.duration 
                }))
            }));
            
            await axios.patch(`/api/trips/${tripId}/itinerary`, {
                itinerary_draft: cleanItinerary,
            }, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            alert("Đã lưu lịch trình thành công!");
            navigate(`/trips/${tripId}`); 
        } catch (err) {
            alert("Lỗi khi lưu lịch trình.");
            console.error("Save error:", err);
        }
    };
    
    // --- RENDER ---
    if (isLoading) return <div className="itinerary-container">Đang tải công cụ chỉnh sửa...</div>;

    if (error) {
        return (
            <div className="details-container error-message">
                <h2>Lỗi tải dữ liệu</h2>
                <p>{error}</p>
                <button onClick={() => navigate(-1)} className="back-button">Quay lại</button>
            </div>
        );
    }

    return (
        <div className="details-container">
            <h2>Chỉnh sửa Lộ trình 🛠️</h2>
            <button onClick={() => navigate(-1)} className="back-button"><FaArrowLeft /> Hủy và Quay lại</button>

            <div className="controls-bar">
                 <p>Kéo thả các mục để sắp xếp lại. Thay đổi thời lượng (giờ) sẽ tự động tính toán lại khung giờ.</p>
                 
                 {/* Khung hiển thị giờ bắt đầu (Không chỉnh sửa) */}
                 <span style={{ fontWeight: 'bold' }}>Giờ bắt đầu Ngày: {START_HOUR_DEFAULT}:00</span>
            </div>
            
            {/* 🔑 DRAG AND DROP CONTEXT */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="itinerary-schedule">
                    {workingCopy.map((dayPlan, dayIndex) => (
                        <Droppable droppableId={`day-${dayPlan.day}`} key={dayPlan.day}>
                            {(provided) => (
                                <div 
                                    className="day-card"
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    <h4 className="day-header">Ngày {dayPlan.day}</h4>
                                    <ul className="place-list">
                                        {dayPlan.places.map((item, itemIndex) => (
                                            <Draggable 
                                                // 🔑 FIX ID: Dùng itemIndex làm key duy nhất trong ngày
                                                key={item.id + '-' + itemIndex} 
                                                draggableId={`item-${dayIndex}-${itemIndex}`} 
                                                index={itemIndex}
                                                isDragDisabled={item.id === 'TRAVEL' || item.id === 'LUNCH'} 
                                            >
                                                {(provided) => (
                                                    <li
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`item-${item.id === 'LUNCH' ? 'lunch' : item.id === 'TRAVEL' ? 'travel' : 'destination'}`}
                                                    >
                                                        {/* 🔑 HIỂN THỊ VÀ THAO TÁC */}
                                                        <div className="time-info">
                                                            <span className="time-slot-display"><FaClock /> {item.time_slot}</span>
                                                            <strong>{item.name}</strong>
                                                        </div>
                                                        
                                                        <div className="duration-controls">
                                                        {/* Input thay đổi Duration */}
                                                        {item.id !== 'TRAVEL' && (
                                                            <>
                                                                <input 
                                                                    type="number" 
                                                                    step="0.5" 
                                                                    min="0.5"
                                                                    max={item.id === 'LUNCH' ? 1.0 : 10.0} 
                                                                    value={item.duration} 
                                                                    onChange={(e) => handleDurationChange(dayIndex, itemIndex, e.target.value)}
                                                                    style={{ width: '45px', textAlign: 'center' }}
                                                                    disabled={item.id === 'LUNCH'} 
                                                                />
                                                                <span style={{ marginLeft: '5px' }}>giờ</span>
                                                            </>
                                                        )}
                                                        {item.id === 'TRAVEL' && (
                                                            <span style={{ fontStyle: 'italic', color: '#666' }}>{TRAVEL_BUFFER * 60} phút</span>
                                                        )}
                                                        
                                                        {/* Nút Xóa */}
                                                        {(item.id !== 'TRAVEL' && item.id !== 'LUNCH') && (
                                                            <button 
                                                                onClick={() => handleDelete(dayIndex, itemIndex)}
                                                                style={{ marginLeft: '10px', color: 'red', border: 'none', background: 'none' }}
                                                            >
                                                                <FaTimes />
                                                            </button>
                                                        )}
                                                        </div>
                                                    </li>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </ul>
                                    {/* Nút Thêm Địa điểm mới */}
                                    <button 
                                        onClick={() => handleAddDestination(dayIndex)} 
                                        className="add-destination-button"
                                        style={{ marginTop: '10px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', background: '#f0f0f0' }}
                                    >
                                        <FaPlusCircle style={{marginRight: '5px'}}/> Thêm Địa điểm Tùy chỉnh
                                    </button>
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>

            {/* Nút Lưu */}
            <div className="action-footer">
                <button onClick={handleSaveItinerary} className="action-edit-full">
                    <FaSave /> Lưu Lịch trình (Ghi đè bản gốc)
                </button>
            </div>
        </div>
    );
}