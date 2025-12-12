// EditTripPage.jsx - FINAL COMPLETE VERSION (FIXED JSX/DND SYNTAX)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { FaArrowLeft, FaSave, FaPlus, FaRedo, FaCalendarPlus, FaUser, FaMoneyBillWave } from 'react-icons/fa';
import { reorder, rebuildDay, sortByTime } from './dndLogic';
import ItemCard from './ItemCard';
import './EditTripPage.css';

const getAuthToken = () => localStorage.getItem('access_token');

const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
const budgetOptions = [
     "< 5 triệu",
     "5-10 triệu",
     "10-20 triệu",
     "> 20 triệu",
];

export default function EditTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();

    const [tripData, setTripData] = useState(null);
    const [itinerary, setItinerary] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // ⭐ STATE DỮ LIỆU CƠ BẢN
    const [editableData, setEditableData] = useState({
        name: '',
        startDate: '',
        duration: 1, 
        people: '',
        budget: '',
        provinceId: null,
        usedPlaceIds: [],
    });

    let uniqueIdCounter = 0;

    const flattenItinerary = (apiItinerary) => apiItinerary.map(dayPlan => ({
        ...dayPlan,
        places: (dayPlan.places || []).map(item => ({ 
            ...item, 
            uniqueId: `item-${item.id || item.name}-${uniqueIdCounter++}`, 
            day: dayPlan.day 
        }))
    }));

    const restoreItinerary = (flatItinerary) => flatItinerary.map(dayPlan => ({ day: dayPlan.day, places: dayPlan.places.map(({ uniqueId, day, ...rest }) => rest) }));
    
    // Hàm này giúp cập nhật itinerary sau khi tái tạo/mở rộng
    const updateItineraryFromBackend = (newItinerary) => {
        const flat = flattenItinerary(newItinerary || []);
        // Rebuild/Sort time slots for correct display after drag/drop logic (if dndLogic is complex)
        const rebuiltDays = flat.map(day => ({ 
            ...day, 
            places: sortByTime(day.places || []) 
        }));
        setItinerary(rebuiltDays);
    };


    useEffect(() => {
        const fetchTripDetails = async () => {
            if (!tripId) return;
            setIsLoading(true);
            try {
                const res = await axios.get(`/api/trips/${tripId}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
                const data = res.data;
                setTripData(data);
                
                const currentlyUsedIds = new Set();
                data.itinerary.forEach(day => {
                    (day.places || []).forEach(item => {
                        // Chỉ tính các địa điểm thực (có ID là số)
                        if (item.id && typeof item.id === 'number' && item.id !== 'LUNCH' && item.id !== 'TRAVEL') {
                            currentlyUsedIds.add(item.id);
                        }
                    });
                });

                // ÁNH XẠ DỮ LIỆU VÀO EDITABLE STATE
                setEditableData(prev => ({
                    name: data.name || '',
                    startDate: data.start_date || '', // YYYY-MM-DD
                    duration: data.duration || 1,
                    people: data.metadata?.people || '',
                    budget: data.metadata?.budget || '',
                    provinceId: data.province_id, // Lấy province_id trực tiếp
                    usedPlaceIds: Array.from(currentlyUsedIds),
                }));

                updateItineraryFromBackend(data.itinerary || []);

            } catch (e) {
                setError('Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTripDetails();
    }, [tripId]);

    const validateDailyLimits = (places) => {
        const destinationCount = (places || []).filter(p => p.category === 'Địa điểm').length;
        const foodCount = (places || []).filter(p => p.category === 'Ăn uống').length;
        return { canAddDestination: destinationCount < 4, canAddFood: foodCount < 3 };
    };

    const clampDuration = (item, duration) => {
        let d = parseInt(duration, 10);
        if (Number.isNaN(d)) d = item.duration || 60;
        if (item.category === 'Địa điểm') {
            if (d < 30) d = 30;
            if (d > 240) d = 240;
        }
        return d;
    };

    const getList = useCallback(id => {
        const dayIndex = itinerary.findIndex(d => `day-${d.day}` === id);
        return dayIndex !== -1 ? itinerary[dayIndex].places : [];
    }, [itinerary]);

    const onDragEnd = useCallback(async (result) => {
        const { source, destination } = result;
        if (!destination) return;
        const sId = source.droppableId;
        const dId = destination.droppableId;

        const nextItinerary = [...itinerary];

        if (sId === dId) {
            const dayIndex = nextItinerary.findIndex(d => `day-${d.day}` === sId);
            if (dayIndex === -1) return;
            const items = reorder(nextItinerary[dayIndex].places, source.index, destination.index);
            nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: items };
            const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
            nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };
        } else {
            const sourceIndex = nextItinerary.findIndex(d => `day-${d.day}` === sId);
            const destIndex = nextItinerary.findIndex(d => `day-${d.day}` === dId);
            if (sourceIndex === -1 || destIndex === -1) return;

            const sourcePlaces = Array.from(nextItinerary[sourceIndex].places || []);
            const destPlaces = Array.from(nextItinerary[destIndex].places || []);
            const [moved] = sourcePlaces.splice(source.index, 1);
            destPlaces.splice(destination.index, 0, moved);

            nextItinerary[sourceIndex] = { ...nextItinerary[sourceIndex], places: sourcePlaces };
            nextItinerary[destIndex] = { ...nextItinerary[destIndex], places: destPlaces };

            const rebuiltSource = await rebuildDay(nextItinerary[sourceIndex].places || []);
            const rebuiltDest = await rebuildDay(nextItinerary[destIndex].places || []);
            nextItinerary[sourceIndex] = { ...nextItinerary[sourceIndex], places: rebuiltSource };
            nextItinerary[destIndex] = { ...nextItinerary[destIndex], places: rebuiltDest };
        }

        setItinerary(nextItinerary);
    }, [itinerary]);

    const handleUpdateItem = useCallback(async (dayId, uniqueIdToUpdate, changes) => {
        const nextItinerary = itinerary.map(dayPlan => {
            if (`day-${dayPlan.day}` !== dayId) return dayPlan;
            const updatedPlaces = dayPlan.places.map(item => {
                if (item.uniqueId !== uniqueIdToUpdate) return item;
                const patched = { ...item, ...changes };
                if ('duration' in changes) patched.duration = clampDuration(item, changes.duration);
                if ('time_slot' in changes && typeof changes.time_slot === 'string' && changes.time_slot.length === 5) {
                    patched.time_slot = `${changes.time_slot}:00`;
                }
                return patched;
            });
            return { ...dayPlan, places: updatedPlaces };
        });

        const dayIndex = nextItinerary.findIndex(d => `day-${d.day}` === dayId);
        if (dayIndex === -1) {
            setItinerary(nextItinerary);
            return;
        }

        const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
        nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };
        setItinerary(nextItinerary);
    }, [itinerary]);

    const handleRemoveItem = useCallback(async (uniqueIdToRemove) => {
        const nextItinerary = itinerary.map(dayPlan => ({ ...dayPlan, places: (dayPlan.places || []).filter(item => item.uniqueId !== uniqueIdToRemove) }));
        const rebuiltDays = await Promise.all(nextItinerary.map(async d => ({ ...d, places: await rebuildDay(d.places || []) })));
        setItinerary(rebuiltDays);
    }, [itinerary]);

    const handleAddItem = useCallback(async (day, type) => {
        const nextItinerary = [...itinerary];
        const dayIndex = nextItinerary.findIndex(d => d.day === day);
        if (dayIndex === -1) return;

        const limits = validateDailyLimits(nextItinerary[dayIndex].places || []);
        if (type === 'DESTINATION' && !limits.canAddDestination) {
            alert('Mỗi ngày chỉ tối đa 4 địa điểm.');
            return;
        }
        if (type === 'LUNCH' && !limits.canAddFood) {
            alert('Mỗi ngày chỉ tối đa 3 điểm ăn uống.');
        }

        const newUniqueId = `new-item-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        const base = { id: null, uniqueId: newUniqueId, day, time_slot: null };
        let newItem = { ...base, name: 'Địa điểm mới', category: 'Địa điểm', duration: 60 };
        if (type === 'LUNCH') newItem = { ...base, id: 'LUNCH', name: 'Ăn trưa', category: 'Ăn uống', duration: 45 };

        nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: [...(nextItinerary[dayIndex].places || []), newItem] };
        const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
        nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };
        setItinerary(nextItinerary);
    }, [itinerary]);
    
    // --- LOGIC CẬP NHẬT METADATA ---
    const handleMetadataChange = useCallback((field, value) => {
        setEditableData(prev => ({ ...prev, [field]: value }));
    }, []);


    // --- LOGIC LƯU LỊCH TRÌNH HIỆN TẠI VÀ METADATA (Nút Lưu Thay Đổi) ---
    const handleSave = async () => {
        const { name, startDate, duration, provinceId } = editableData;
        const durationNum = parseInt(duration);
        
        // DEBUG LOG: Hiển thị các giá trị trước khi kiểm tra
        console.log("VALIDATION CHECK: handleSave");
        console.log({
            name: name?.trim(),
            startDate: startDate,
            duration: duration,
            durationNum: durationNum,
            provinceId: provinceId,
            nameValid: !!name?.trim(),
            startDateValid: !!startDate,
            durationValid: durationNum > 0 && !isNaN(durationNum),
            provinceIdValid: typeof provinceId === 'number' && provinceId > 0, // KIỂM TRA MỚI: phải là số và lớn hơn 0
        });

        // Cập nhật điều kiện kiểm tra: provinceId phải là số dương hợp lệ
        if (!name?.trim() || !startDate || durationNum <= 0 || isNaN(durationNum) || !(typeof provinceId === 'number' && provinceId > 0)) {
            alert('Lỗi: Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng và ID Tỉnh đã được tải/điền hợp lệ.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            // 1. Lưu Metadata (Tên, Ngày, Người, Ngân sách)
            const metadataPayload = {
                name: editableData.name,
                // duration lấy từ state (đã được update bởi extend/regenerate)
                duration: durationNum, 
                start_date: editableData.startDate,
                metadata: {
                    people: editableData.people,
                    budget: editableData.budget,
                },
            };
            await axios.put(`/api/trips/${tripId}`, metadataPayload, { 
                headers: { Authorization: `Bearer ${getAuthToken()}` } 
            });
            
            // 2. Lưu Itinerary (Lịch trình kéo thả)
            const itineraryPayload = { itinerary: restoreItinerary(itinerary) };
            await axios.put(`/api/trips/${tripId}/itinerary`, itineraryPayload, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
            
            alert('Đã lưu TẤT CẢ thay đổi thành công!');
            navigate(`/trips/${tripId}`); 
        } catch (err) {
            setError('Lỗi khi lưu dữ liệu chuyến đi.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };


    // --- LOGIC TÁI TẠO HOÀN TOÀN (REGENERATE) ---
    const handleRegenerateFull = async () => {
        const { name, startDate, duration, provinceId } = editableData;
        const durationNum = parseInt(duration);

        // DEBUG LOG: Hiển thị các giá trị trước khi kiểm tra
        console.log("VALIDATION CHECK: handleRegenerateFull");
        console.log({
            name: name?.trim(),
            startDate: startDate,
            duration: duration,
            durationNum: durationNum,
            provinceId: provinceId,
            nameValid: !!name?.trim(),
            startDateValid: !!startDate,
            durationValid: durationNum > 0 && !isNaN(durationNum),
            provinceIdValid: typeof provinceId === 'number' && provinceId > 0, // KIỂM TRA MỚI: phải là số và lớn hơn 0
        });
        
        // Cập nhật điều kiện kiểm tra: provinceId phải là số dương hợp lệ
        if (!name?.trim() || !startDate || durationNum <= 0 || isNaN(durationNum) || !(typeof provinceId === 'number' && provinceId > 0)) {
            alert('Lỗi: Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng và ID Tỉnh đã được tải/điền hợp lệ.');
            return;
        }
        
        if (!window.confirm('CẢNH BÁO: Hành động này sẽ xóa lịch trình chi tiết hiện tại và tạo một lịch trình mới hoàn toàn dựa trên cấu hình mới. Bạn có chắc chắn muốn tiếp tục không?')) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // 1. Cập nhật Metadata (PUT)
            const updateMetadataPayload = {
                name: editableData.name,
                duration: durationNum,
                start_date: editableData.startDate,
                metadata: {
                    people: editableData.people,
                    budget: editableData.budget,
                },
            };
            await axios.put(`/api/trips/${tripId}`, updateMetadataPayload, { 
                headers: { Authorization: `Bearer ${getAuthToken()}` } 
            });

            // 2. Yêu cầu API TÁI TẠO LỊCH TRÌNH MỚI (POST /api/trips/{id}/regenerate)
            const regeneratePayload = {
                province_id: editableData.provinceId,
                duration: durationNum,
                must_include_place_ids: tripData.must_include_place_ids || [], 
            };
            
            const regenRes = await axios.post(`/api/trips/${tripId}/regenerate`, regeneratePayload, { 
                 headers: { Authorization: `Bearer ${getAuthToken()}` } 
            });

            alert('Đã cập nhật thông tin và TÁI TẠO lịch trình thành công!');
            
            // Cập nhật giao diện với lịch trình mới
            // Cập nhật duration trong state dựa trên response mới
            setEditableData(prev => ({ ...prev, duration: regenRes.data.trip?.duration || prev.duration }));
            updateItineraryFromBackend(regenRes.data.trip?.itinerary); 
            navigate(`/trips/${tripId}`); 

        } catch (err) {
            setError('Lỗi khi tái tạo lịch trình. Vui lòng kiểm tra API backend.');
            console.error("Regenerate Error:", err);
        } finally {
            setIsSaving(false);
        }
    };


    // --- LOGIC MỞ RỘNG CHUYẾN ĐI (THÊM 1 NGÀY) ---
    const handleExtendTrip = async () => {
    const { startDate, duration, provinceId } = editableData;
    const currentDuration = parseInt(duration);

    // DEBUG LOG: Hiển thị các giá trị trước khi kiểm tra
    console.log("VALIDATION CHECK: handleExtendTrip");
    console.log({
        startDate: startDate,
        currentDuration: currentDuration,
        provinceId: provinceId,
        startDateValid: !!startDate,
        durationValid: currentDuration > 0 && !isNaN(currentDuration),
        provinceIdValid: typeof provinceId === 'number' && provinceId > 0, // KIỂM TRA MỚI: phải là số và lớn hơn 0
    });
    
    if (currentDuration >= 30 || isNaN(currentDuration) || currentDuration < 1) {
        alert('Thời lượng chuyến đi không hợp lệ hoặc đã đạt giới hạn (30 ngày).');
        return;
    }

    // Cập nhật điều kiện kiểm tra: startDate và provinceId phải hợp lệ
    if (!startDate || !(typeof provinceId === 'number' && provinceId > 0)) {
            alert('Lỗi: Cần có Ngày xuất phát và ID Tỉnh để mở rộng. Vui lòng kiểm tra dữ liệu load.');
            return;
        }
    
    const newDuration = currentDuration + 1;
    const newDayNumber = newDuration;

    setIsSaving(true);
    setError(null);
    
    try {
        // 1. Cập nhật duration lên backend
        const updateDurationPayload = {
            duration: newDuration,
            start_date: editableData.startDate, 
        };
        await axios.put(`/api/trips/${tripId}`, updateDurationPayload, { 
            headers: { Authorization: `Bearer ${getAuthToken()}` } 
        });

        // 2. Yêu cầu API mở rộng lịch trình
        const extendPayload = {
            province_id: editableData.provinceId,
            duration: newDuration, 
            new_day: newDayNumber,
            used_place_ids: itinerary.flatMap(day => 
                    day.places.filter(p => p.id && p.id !== 'LUNCH' && p.id !== 'TRAVEL').map(p => p.id)
                ),
        };

        const extendRes = await axios.post(`/api/trips/${tripId}/extend`, extendPayload, { 
             headers: { Authorization: `Bearer ${getAuthToken()}` } 
        });
        
        if (extendRes.data.message.includes("No suitable destinations")) {
                alert("Không còn địa điểm mới nào để thêm vào chuyến đi này. Vui lòng chỉnh sửa các ngày khác.");
                // Rollback duration trên UI và PUT duration cũ về lại backend
                setEditableData(prev => ({ ...prev, duration: currentDuration }));
                const rollbackPayload = { duration: currentDuration, start_date: editableData.startDate };
                await axios.put(`/api/trips/${tripId}`, rollbackPayload, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
                return;
            }
            
        // 3. Cập nhật UI ngay lập tức
        setEditableData(prev => ({ ...prev, duration: newDuration }));
        alert(`Đã mở rộng thành công lên ${newDuration} ngày!`);

        // Tải lại toàn bộ trang để UI cập nhật cả end_date mới và lịch trình mới
        navigate(0); 
        

    } catch (err) {
        setError('Lỗi khi mở rộng chuyến đi. Vui lòng kiểm tra API /extend.');
        console.error("Extend Error:", err);
    } finally {
        setIsSaving(false);
    }
};
    
    // --- JSX Render ---
    if (isLoading && !tripData) return (<div className="edit-trip-loading"><div className="loading-spinner"></div><p>Đang tải dữ liệu chuyến đi...</p></div>);
    if (error) return <div className="edit-trip-error">Lỗi: {error}</div>;

    return (
        <div className="edit-trip-container single-column-layout">
            <div className="edit-trip-header">
                <button onClick={() => navigate(-1)} className="back-btn"><FaArrowLeft /> Quay lại</button>
                <h1 className="trip-title">✏️ Chỉnh sửa: **{tripData?.name || 'Loading'}**</h1>
                {/* Nút lưu thủ công (Lưu cả Metadata và Itinerary) */}
                <button onClick={handleSave} className="save-btn" disabled={isSaving}><FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</button>
            </div>

            {/* ------------------------------------- */}
            {/* ⭐ FORM CHỈNH SỬA METADATA ⭐ */}
            {/* ------------------------------------- */}
            <div className="edit-trip-metadata-form">
                <h2>⚙️ Cấu hình chuyến đi</h2>
                <div className="metadata-grid">
                    
                    {/* 1. Tên chuyến đi */}
                    <div className="input-group">
                        <label>Tên chuyến đi</label>
                        <input
                            type="text"
                            value={editableData.name}
                            onChange={(e) => handleMetadataChange('name', e.target.value)}
                            placeholder="Tên chuyến đi"
                        />
                    </div>

                    {/* 2. Ngày đi */}
                    <div className="input-group">
                        <label>Ngày xuất phát</label>
                        <input
                            type="date"
                            value={editableData.startDate}
                            onChange={(e) => handleMetadataChange('startDate', e.target.value)}
                            placeholder="YYYY-MM-DD"
                        />
                    </div>

                    {/* 3. Thời lượng (Số ngày) - CHỈ HIỂN THỊ, KHÔNG CHO CHỈNH SỬA TRỰC TIẾP */}
                    <div className="input-group">
                        <label>Thời lượng (Ngày)</label>
                        <input
                            type="text" 
                            value={editableData.duration}
                            disabled={true} 
                            className="disabled-input" 
                            title="Thời lượng được điều chỉnh bằng nút 'Tăng thêm 1 Ngày' hoặc 'TÁI TẠO'"
                        />
                    </div>
                    
                    {/* 4. Số người (Metadata) */}
                    <div className="input-group">
                        <label>Số người</label>
                        <select
                            value={editableData.people}
                            onChange={(e) => handleMetadataChange('people', e.target.value)}
                        >
                            <option value="">Chọn số lượng</option>
                            {peopleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    
                    {/* 5. Ngân sách (Metadata) */}
                    <div className="input-group">
                        <label>Ngân sách</label>
                        <select
                            value={editableData.budget}
                            onChange={(e) => handleMetadataChange('budget', e.target.value)}
                        >
                            <option value="">Chọn ngân sách</option>
                            {budgetOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    
                    {/* 6. Nút Tái tạo hoàn toàn */}
                    <div className="input-group full-regenerate-btn">
                         <label>&nbsp;</label>
                        <button onClick={handleRegenerateFull} className="regenerate-btn" disabled={isSaving}>
                            <FaRedo /> TÁI TẠO LỊCH TRÌNH MỚI
                        </button>
                    </div>
                    
                     {/* 7. Nút Tăng ngày/Mở rộng */}
                     <div className="input-group extend-btn-group">
                        <label>&nbsp;</label>
                        <button onClick={handleExtendTrip} className="extend-btn" disabled={isSaving}>
                            <FaCalendarPlus /> Tăng thêm 1 Ngày
                        </button>
                    </div>

                </div>
            </div>
            <hr className="separator"/>
            {/* ------------------------------------- */}


            <div className="main-itinerary-area">
                <div className="column-header"><h2>🗓️ Kéo thả & Chỉnh sửa trực tiếp</h2><p className="subtitle">Chỉnh sửa giờ sẽ <strong>tự động sắp xếp</strong> lại thứ tự và tính toán lại các mục phía sau.</p></div>
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="days-list">
                        {itinerary.map(dayPlan => (
                            <div key={`edit-${dayPlan.day}`} className="day-section editable">
                                
                                {/* FIX CÚ PHÁP DROPPABLE */}
                                <Droppable droppableId={`day-${dayPlan.day}`}>
                                    {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps}>
                                            <h3 className="day-title">Ngày {dayPlan.day}</h3> 
                                            
                                            <div className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}>
                                                
                                                {(dayPlan.places || []).map((item, index) => (
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
                                                {(!dayPlan.places || dayPlan.places.length === 0) && <p className="empty-message">Kéo thả mục vào đây hoặc thêm mục mới</p>}
                                            </div>

                                            <div className="action-buttons">
                                                <button onClick={() => handleAddItem(dayPlan.day, 'DESTINATION')} className="add-btn destination"><FaPlus /> Địa điểm</button>
                                                <button onClick={() => handleAddItem(dayPlan.day, 'LUNCH')} className="add-btn lunch"><FaPlus /> Ăn uống</button>
                                            </div>
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </DragDropContext>
                {/* ⭐ BỔ SUNG NÚT THÊM NGÀY Ở FOOTER MỚI ⭐ */}
                <div className="add-day-footer">
                    <button onClick={handleExtendTrip} className="extend-btn extend-footer" disabled={isSaving}>
                        <FaCalendarPlus /> Thêm Ngày Mới
                    </button>
                </div>
            </div> 
        </div>
    );
}