// EditTripPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

// 🔑 IMPORT LOGIC VÀ AUTO-TIME TỪ FILE RIÊNG
import { reorder, move, recalculateTimeSlots } from './dndLogic'; 
import ItemCard from './ItemCard'; 
// import './styles.css'; // Đảm bảo bạn import file CSS này vào dự án


// --- HÀM GIẢ ĐỊNH: Lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token"); 


// --- Component Chính ---
export default function EditTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();

    const [tripData, setTripData] = useState(null);
    const [itinerary, setItinerary] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const flattenItinerary = (apiItinerary) => {
        let uniqueIdCounter = 0;
        return apiItinerary.map(dayPlan => ({
            ...dayPlan,
            places: dayPlan.places.map(item => ({
                ...item,
                uniqueId: `item-${item.id || item.name}-${uniqueIdCounter++}`, 
                day: dayPlan.day, 
            }))
        }));
    };

    const restoreItinerary = (flatItinerary) => {
        return flatItinerary.map(dayPlan => ({
            day: dayPlan.day,
            places: dayPlan.places.map(item => {
                const { uniqueId, day, ...apiItem } = item; 
                return apiItem;
            }),
        }));
    };


    // --- FETCH DATA (Giữ nguyên) ---
    useEffect(() => {
        const fetchTripDetails = async () => {
            if (!tripId) return;
            setIsLoading(true);
            try {
                const response = await axios.get(`/api/trips/${tripId}`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                const fetchedTrip = response.data;
                setTripData(fetchedTrip);
                setItinerary(flattenItinerary(fetchedTrip.itinerary || []));
            } catch (err) {
                setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTripDetails();
    }, [tripId]);
    
    // --- DND LOGIC (TÍCH HỢP AUTO-TIME) ---
    const getList = useCallback(id => {
        const dayIndex = itinerary.findIndex(d => `day-${d.day}` === id);
        return dayIndex !== -1 ? itinerary[dayIndex].places : [];
    }, [itinerary]);

    const onDragEnd = useCallback((result) => {
        const { source, destination } = result;
        if (!destination) return;

        const sId = source.droppableId;
        const dId = destination.droppableId;

        let newItinerary;

        if (sId === dId) {
            const items = reorder(getList(sId), source.index, destination.index);
            
            newItinerary = itinerary.map(dayPlan => {
                if (`day-${dayPlan.day}` === sId) return { ...dayPlan, places: items };
                return dayPlan;
            });

        } else {
            const resultMove = move(getList(sId), getList(dId), source, destination);
            
            newItinerary = itinerary.map(dayPlan => {
                if (`day-${dayPlan.day}` === sId) return { ...dayPlan, places: resultMove[sId] };
                if (`day-${dayPlan.day}` === dId) return { ...dayPlan, places: resultMove[dId] };
                return dayPlan;
            });
        }
        
        // 🔑 BƯỚC QUAN TRỌNG: TÁI TÍNH TOÁN GIỜ SAU KÉO THẢ
        const recalculatedItinerary = recalculateTimeSlots(newItinerary);
        setItinerary(recalculatedItinerary);
        
    }, [itinerary, getList]);


    // --- CRUD ITEM LOGIC (TÍCH HỢP AUTO-TIME) ---
    
    // Tái tính toán giờ sau khi người dùng thay đổi dữ liệu (tên, hoặc cập nhật thủ công nếu có)
    const handleUpdateItem = useCallback((dayId, uniqueIdToUpdate, changes) => {
        setItinerary(currentItinerary => {
            const newItinerary = currentItinerary.map(dayPlan => {
                if (`day-${dayPlan.day}` === dayId) {
                    return {
                        ...dayPlan,
                        places: dayPlan.places.map(item => {
                            if (item.uniqueId === uniqueIdToUpdate) return { ...item, ...changes };
                            return item;
                        }),
                    };
                }
                return dayPlan;
            });
            // 💡 Nếu bạn muốn giờ chỉ thay đổi khi kéo thả, bạn có thể bỏ qua bước này.
            // Nhưng để đảm bảo giờ luôn logic khi chỉnh sửa, ta sẽ tái tính:
            return recalculateTimeSlots(newItinerary);
        });
    }, []);

    // Tái tính toán giờ sau khi xóa một mục
    const handleRemoveItem = useCallback((uniqueIdToRemove) => {
        setItinerary(currentItinerary => {
            const newItinerary = currentItinerary.map(dayPlan => ({
                ...dayPlan,
                places: dayPlan.places.filter(item => item.uniqueId !== uniqueIdToRemove),
            }));
            
            // 🔑 TÁI TÍNH TOÁN GIỜ SAU KHI XÓA
            return recalculateTimeSlots(newItinerary);
        });
    }, []);

    // Tái tính toán giờ sau khi thêm một mục mới
    const handleAddItem = useCallback((day, type) => {
        const newUniqueId = `new-item-${Date.now()}-${Math.floor(Math.random() * 100)}`; 
        let newItem = { 
            id: newUniqueId, 
            uniqueId: newUniqueId, 
            day: day, 
            // Giờ sẽ được recalculateTimeSlots gán lại
            name: 'Địa điểm mới', 
            category: 'Địa điểm' 
        };

        if (type === 'LUNCH') newItem = { ...newItem, id: 'LUNCH', name: 'Ăn trưa', category: 'Ăn uống' };
        if (type === 'TRAVEL') newItem = { ...newItem, id: 'TRAVEL', name: 'Di chuyển/Nghỉ ngơi', category: 'Di chuyển' };

        setItinerary(currentItinerary => {
            const newItinerary = currentItinerary.map(dayPlan => {
                if (dayPlan.day === day) {
                    return {
                        ...dayPlan,
                        places: [...dayPlan.places, newItem]
                    };
                }
                return dayPlan;
            });
            
            // 🔑 TÁI TÍNH TOÁN GIỜ SAU KHI THÊM
            return recalculateTimeSlots(newItinerary);
        });
    }, []);


    // --- HÀM LƯU DỮ LIỆU CHÍNH (Giữ nguyên) ---
    const handleSave = async () => {
        if (!tripData) return;
        setIsSaving(true);
        setError(null);
        
        const updatedItinerary = restoreItinerary(itinerary); 
        const itineraryPayload = { itinerary: updatedItinerary };
        
        try {
            await axios.put(`/api/trips/${tripId}/itinerary`, itineraryPayload, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            alert("Đã lưu chỉnh sửa thành công!");
            navigate(`/trips/${tripId}`); 
        } catch (err) {
            setError("Lỗi khi lưu lịch trình.");
            console.error("Error saving itinerary:", err.response?.data || err);
        } finally {
            setIsSaving(false);
        }
    };


    // --- RENDER (CSS Thuần) ---
    if (isLoading && !tripData) {
        return <div style={{ padding: '24px', textAlign: 'center', fontSize: '1.25rem', color: '#4f46e5' }}>Đang tải dữ liệu chuyến đi...</div>;
    }

    if (error) {
        return <div style={{ padding: '24px', textAlign: 'center', fontSize: '1.25rem', color: '#ef4444' }}>Lỗi: {error}</div>;
    }

    return (
        <div className="page-container">
            {/* Header và nút */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '2px solid #e0e7ff', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--color-text-dark)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    ✍️ Chỉnh sửa Lịch trình: **{tripData?.name || 'Loading'}**
                </h2>
                <button onClick={handleSave} style={{ backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '8px', fontWeight: '600', padding: '10px 20px', transition: 'background-color 0.2s' }} disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : '💾 Lưu Thay Đổi'}
                </button>
            </div>
            
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid-container">
                    {itinerary.map((dayPlan) => (
                        <div key={dayPlan.day} className="day-card">
                            <h4 className="day-header">Ngày {dayPlan.day}</h4>
                            
                            <Droppable droppableId={`day-${dayPlan.day}`}>
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`droppable-area ${snapshot.isDraggingOver ? 'droppable-area-over' : ''}`}
                                    >
                                        {dayPlan.places.map((item, index) => (
                                            <ItemCard 
                                                key={item.uniqueId} 
                                                item={item} 
                                                index={index} 
                                                onRemove={handleRemoveItem}
                                                onUpdate={handleUpdateItem}
                                                dayId={`day-${dayPlan.day}`}
                                            />
                                        ))}
                                        {provided.placeholder} 
                                        {dayPlan.places.length === 0 && (
                                            <p style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', padding: '16px' }}>Kéo thả mục vào đây hoặc thêm mục mới.</p>
                                        )}
                                    </div>
                                )}
                            </Droppable>

                            <div className="btn-add-group">
                                <button onClick={() => handleAddItem(dayPlan.day, 'DESTINATION')} className="btn-add btn-add-destination">➕ Địa điểm</button>
                                <button onClick={() => handleAddItem(dayPlan.day, 'LUNCH')} className="btn-add btn-add-lunch">➕ Ăn uống</button>
                                <button onClick={() => handleAddItem(dayPlan.day, 'TRAVEL')} className="btn-add btn-add-travel">➕ Di chuyển</button>
                            </div>
                        </div>
                    ))}
                </div>
            </DragDropContext>
            
            <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <button onClick={handleSave} style={{ width: '100%', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '8px', fontWeight: '600', padding: '12px 20px', transition: 'background-color 0.2s' }} disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : '💾 Lưu Thay Đổi'}
                </button>
            </div>
        </div>
    );
}