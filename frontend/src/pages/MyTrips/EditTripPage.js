// EditTripPage.jsx - With Toast notifications
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { FaArrowLeft, FaSave, FaClock, FaMapMarkerAlt, FaPlus, FaRedo, FaCalendarPlus, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

import { reorder, rebuildDay, recalculateTimeSlots } from './dndLogic';
import ItemCard from './ItemCard';
import './EditTripPage.css';

const getAuthToken = () => localStorage.getItem("access_token");

const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
const budgetOptions = ["< 5 triệu", "5-10 triệu", "10-20 triệu", "> 20 triệu"];

// Add this CSS dynamically or add to your EditTripPage.css
const styleSheet = document.createElement("style");
styleSheet.textContent = `
.delete-day-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.delete-day-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
}

.delete-day-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #9ca3af;
}
`;
if (!document.getElementById("delete-day-styles")) {
    styleSheet.id = "delete-day-styles";
    document.head.appendChild(styleSheet);
}

export default function EditTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();

    const [tripData, setTripData] = useState(null);
    const [originalItinerary, setOriginalItinerary] = useState([]);
    const [itinerary, setItinerary] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
    const [dayToDelete, setDayToDelete] = useState(null);

    const [editableData, setEditableData] = useState({
        name: '',
        startDate: '',
        duration: 1,
        people: '',
        budget: '',
        provinceId: null,
    });

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

    // FETCH DATA
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

                const flattened = flattenItinerary(fetchedTrip.itinerary || []);
                setOriginalItinerary(flattened);
                setItinerary(flattened);

                const currentlyUsedIds = new Set();
                fetchedTrip.itinerary.forEach(day => {
                    (day.places || []).forEach(item => {
                        if (item.id && typeof item.id === 'number') {
                            currentlyUsedIds.add(item.id);
                        }
                    });
                });

                setEditableData({
                    name: fetchedTrip.name || '',
                    startDate: fetchedTrip.start_date || '',
                    duration: fetchedTrip.duration || 1,
                    people: fetchedTrip.metadata?.people || '',
                    budget: fetchedTrip.metadata?.budget || '',
                    provinceId: fetchedTrip.province_id,
                    usedPlaceIds: Array.from(currentlyUsedIds),
                });

            } catch (err) {
                setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
                toast.error("Không thể tải dữ liệu chuyến đi!");
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

        let newItinerary = [...itinerary];

        if (sId === dId) {
            const dayIndex = newItinerary.findIndex(d => `day-${d.day}` === sId);
            if (dayIndex === -1) return;

            const items = reorder(newItinerary[dayIndex].places, source.index, destination.index);
            newItinerary[dayIndex] = { ...newItinerary[dayIndex], places: items };

            const rebuilt = await rebuildDay(newItinerary[dayIndex].places || []);
            newItinerary[dayIndex] = { ...newItinerary[dayIndex], places: rebuilt };

        } else {
            const sourceIndex = newItinerary.findIndex(d => `day-${d.day}` === sId);
            const destIndex = newItinerary.findIndex(d => `day-${d.day}` === dId);
            if (sourceIndex === -1 || destIndex === -1) return;

            const sourcePlaces = Array.from(newItinerary[sourceIndex].places || []);
            const destPlaces = Array.from(newItinerary[destIndex].places || []);
            const [moved] = sourcePlaces.splice(source.index, 1);
            destPlaces.splice(destination.index, 0, moved);

            newItinerary[sourceIndex] = { ...newItinerary[sourceIndex], places: sourcePlaces };
            newItinerary[destIndex] = { ...newItinerary[destIndex], places: destPlaces };

            const rebuiltSource = await rebuildDay(newItinerary[sourceIndex].places || []);
            const rebuiltDest = await rebuildDay(newItinerary[destIndex].places || []);
            newItinerary[sourceIndex] = { ...newItinerary[sourceIndex], places: rebuiltSource };
            newItinerary[destIndex] = { ...newItinerary[destIndex], places: rebuiltDest };
        }

        setItinerary(newItinerary);
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
        if (dayIndex !== -1) {
            const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
            nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };
        }

        setItinerary(nextItinerary);
    }, [itinerary]);

    const handleRemoveItem = useCallback(async (uniqueIdToRemove) => {
        const nextItinerary = itinerary.map(dayPlan => ({
            ...dayPlan,
            places: (dayPlan.places || []).filter(item => item.uniqueId !== uniqueIdToRemove)
        }));

        const rebuiltDays = await Promise.all(
            nextItinerary.map(async d => ({
                ...d,
                places: await rebuildDay(d.places || [])
            }))
        );

        setItinerary(rebuiltDays);
        toast.success("Đã xóa địa điểm khỏi lịch trình");
    }, [itinerary]);

    const handleAddItem = useCallback(async (day, type) => {
        const nextItinerary = [...itinerary];
        const dayIndex = nextItinerary.findIndex(d => d.day === day);
        if (dayIndex === -1) return;

        const limits = validateDailyLimits(nextItinerary[dayIndex].places || []);
        if (type === 'DESTINATION' && !limits.canAddDestination) {
            toast.warning('Mỗi ngày chỉ tối đa 4 địa điểm.');
            return;
        }
        if (type === 'LUNCH' && !limits.canAddFood) {
            toast.warning('Mỗi ngày chỉ tối đa 3 điểm ăn uống.');
            return;
        }

        const newUniqueId = `new-item-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        const base = { id: null, uniqueId: newUniqueId, day, time_slot: null };

        let newItem = { ...base, name: 'Địa điểm mới', category: 'Địa điểm', duration: 60 };
        if (type === 'LUNCH') newItem = { ...base, id: 'LUNCH', name: 'Ăn trưa', category: 'Ăn uống', duration: 45 };
        if (type === 'TRAVEL') newItem = { ...base, id: 'TRAVEL', name: 'Di chuyển/Nghỉ ngơi', category: 'Di chuyển', duration: 30 };

        nextItinerary[dayIndex] = {
            ...nextItinerary[dayIndex],
            places: [...(nextItinerary[dayIndex].places || []), newItem]
        };

        const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
        nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };

        setItinerary(nextItinerary);
        toast.success(`Đã thêm ${newItem.name} vào Ngày ${day}`);
    }, [itinerary]);

    const handleMetadataChange = useCallback((field, value) => {
        setEditableData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSave = async () => {
        if (!tripData) return;

        const { name, startDate, people, budget } = editableData;

        // 🔥 QUAN TRỌNG: Lấy duration từ số ngày THỰC TẾ trong itinerary
        const actualDuration = itinerary.length;

        console.log('💾 [EditTripPage] Saving with:');
        console.log('   - Actual Duration:', actualDuration);
        console.log('   - Itinerary days:', itinerary.length);

        if (!name?.trim() || !startDate || actualDuration <= 0) {
            toast.error('Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng hợp lệ.');
            return;
        }

        setIsSaving(true);
        setError(null);

        const loadingToast = toast.info('Đang lưu thay đổi...', { autoClose: false });

        try {
            // 1. ✅ Lưu Metadata với ACTUAL duration từ itinerary
            const metadataPayload = {
                name: name,
                duration: actualDuration, // 🔥 DÙNG actualDuration thay vì editableData.duration
                start_date: startDate,
                metadata: {
                    people: people,
                    budget: budget,
                },
            };

            console.log('📤 Sending metadata payload:', metadataPayload);

            await axios.put(`/api/trips/${tripId}`, metadataPayload, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });

            // 2. Lưu Itinerary
            const updatedItinerary = restoreItinerary(itinerary);
            const itineraryPayload = { itinerary: updatedItinerary };

            await axios.put(`/api/trips/${tripId}/itinerary`, itineraryPayload, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });

            toast.dismiss(loadingToast);
            toast.success("Đã lưu TẤT CẢ thay đổi thành công!", { autoClose: 3000 });

            // ✅ Cập nhật editableData.duration để UI hiển thị đúng
            setEditableData(prev => ({ ...prev, duration: actualDuration }));

            // ✅ Navigate về TripDetailsPage với force reload
            setTimeout(() => {
                // Force full page reload để fetch lại data mới
                window.location.href = `/trips/${tripId}`;
            }, 1000);

        } catch (err) {
            toast.dismiss(loadingToast);
            setError("Lỗi khi lưu dữ liệu chuyến đi.");
            toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
            console.error("Error saving:", err.response?.data || err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRegenerateFull = async () => {
        const { name, startDate, duration, provinceId } = editableData;
        const durationNum = parseInt(duration);

        if (!name?.trim() || !startDate || durationNum <= 0 || isNaN(durationNum) || !(typeof provinceId === 'number' && provinceId > 0)) {
            toast.error('Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng và ID Tỉnh hợp lệ.');
            return;
        }

        // Custom confirmation toast
        const confirmToast = toast.warning(
            <div>
                <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>⚠️ CẢNH BÁO</p>
                <p style={{ marginBottom: '15px' }}>
                    Hành động này sẽ xóa lịch trình chi tiết hiện tại và tạo một lịch trình mới hoàn toàn.
                    Bạn có chắc chắn muốn tiếp tục không?
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={() => {
                            toast.dismiss(confirmToast);
                            executeRegenerate();
                        }}
                        style={{
                            padding: '8px 16px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Xác nhận
                    </button>
                    <button
                        onClick={() => toast.dismiss(confirmToast)}
                        style={{
                            padding: '8px 16px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Hủy
                    </button>
                </div>
            </div>,
            {
                autoClose: false,
                closeButton: false,
                closeOnClick: false,
                draggable: false
            }
        );

        const executeRegenerate = async () => {
            setIsSaving(true);
            setError(null);

            const loadingToast = toast.info('Đang tái tạo lịch trình...', { autoClose: false });

            try {
                // 1. Update Metadata
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

                // 2. Regenerate Itinerary
                const regeneratePayload = {
                    province_id: editableData.provinceId,
                    duration: durationNum,
                    must_include_place_ids: tripData.must_include_place_ids || [],
                };

                const regenRes = await axios.post(`/api/trips/${tripId}/regenerate`, regeneratePayload, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` }
                });

                toast.dismiss(loadingToast);
                toast.success('Đã cập nhật thông tin và TÁI TẠO lịch trình thành công!', { autoClose: 3000 });

                setEditableData(prev => ({ ...prev, duration: regenRes.data.trip?.duration || prev.duration }));

                const flattened = flattenItinerary(regenRes.data.trip?.itinerary || []);
                setOriginalItinerary(flattened);
                setItinerary(flattened);

                navigate(`/trips/${tripId}`);

            } catch (err) {
                toast.dismiss(loadingToast);
                setError('Lỗi khi tái tạo lịch trình. Vui lòng kiểm tra API backend.');
                toast.error('Không thể tái tạo lịch trình. Vui lòng thử lại.');
                console.error("Regenerate Error:", err);
            } finally {
                setIsSaving(false);
            }
        };
    };

    const handleExtendTrip = async () => {
        const { startDate } = editableData;
        const currentDuration = itinerary.length; // ✅ Đếm từ itinerary thực tế

        if (currentDuration >= 30 || currentDuration < 1) {
            toast.error('Thời lượng chuyến đi không hợp lệ hoặc đã đạt giới hạn (30 ngày).');
            return;
        }

        if (!startDate) {
            toast.error('Cần có Ngày xuất phát để mở rộng.');
            return;
        }

        const newDuration = currentDuration + 1;

        // Add new day locally (not saved to API yet)
        const newDay = {
            day: newDuration,
            places: []
        };

        const updatedItinerary = [...itinerary, newDay];

        setItinerary(updatedItinerary);

        toast.success(`Đã thêm Ngày ${newDuration}! Nhớ nhấn "Lưu Thay Đổi" để lưu vĩnh viễn.`, {
            autoClose: 4000
        });
    };

    // NEW: Delete day
    const handleDeleteDay = async (dayNumber) => {
        if (itinerary.length <= 1) {
            toast.error('Không thể xóa ngày cuối cùng! Chuyến đi phải có ít nhất 1 ngày.');
            return;
        }

        setDayToDelete(dayNumber);
        setShowDeleteDayConfirm(true);
    };

    const confirmDeleteDay = async () => {
        if (!dayToDelete) return;

        setShowDeleteDayConfirm(false);

        // Remove day from EDITABLE itinerary only (local state, not saved yet)
        let newItinerary = itinerary.filter(d => d.day !== dayToDelete);

        // Re-index remaining days
        newItinerary = newItinerary.map((day, index) => ({
            ...day,
            day: index + 1,
            places: day.places.map(place => ({
                ...place,
                day: index + 1
            }))
        }));

        // Update ONLY local state - do NOT save to API yet
        setItinerary(newItinerary);
        setDayToDelete(null);

        toast.success(`Đã xóa Ngày ${dayToDelete}! Nhớ nhấn "Lưu Thay Đổi" để lưu vĩnh viễn.`, {
            autoClose: 4000
        });
    };

    // RENDER
    if (isLoading && !tripData) {
        return (
            <div className="edit-trip-loading">
                <div className="loading-spinner"></div>
                <p>Đang tải dữ liệu chuyến đi...</p>
            </div>
        );
    }

    if (error) {
        return <div className="edit-trip-error">Lỗi: {error}</div>;
    }

    return (
        <div className="edit-trip-container">
            {/* Header */}
            <div className="edit-trip-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Quay lại
                </button>
                <h1 className="trip-title">
                    ✏️ {tripData?.name || 'Loading'}
                </h1>
                <button
                    onClick={handleSave}
                    className="save-btn"
                    disabled={isSaving}
                >
                    <FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>

            {/* Metadata Form */}
            <div className="edit-trip-metadata-form">
                <h2>⚙️ Thiết lập kế hoạch chuyến đi</h2>
                <div className="metadata-grid">
                    <div className="input-group">
                        <label>Tên chuyến đi</label>
                        <input
                            type="text"
                            value={editableData.name}
                            onChange={(e) => handleMetadataChange('name', e.target.value)}
                            placeholder="Tên chuyến đi"
                        />
                    </div>

                    <div className="input-group">
                        <label>Ngày xuất phát</label>
                        <input
                            type="date"
                            value={editableData.startDate}
                            onChange={(e) => handleMetadataChange('startDate', e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label>Thời lượng (Ngày)</label>
                        <input
                            type="text"
                            value={itinerary.length}
                            disabled={true}
                            className="disabled-input"
                            title="Thời lượng được điều chỉnh bằng nút 'Tăng thêm 1 Ngày' hoặc 'Xóa ngày'"
                        />
                    </div>

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

                    <div className="input-group">
                        <label>&nbsp;</label>
                        <button onClick={handleRegenerateFull} className="regenerate-btn" disabled={isSaving}>
                            <FaRedo /> TÁI TẠO LỊCH TRÌNH MỚI
                        </button>
                    </div>

                    <div className="input-group">
                        <label>&nbsp;</label>
                        <button onClick={handleExtendTrip} className="extend-btn" disabled={isSaving}>
                            <FaCalendarPlus /> Tăng thêm 1 Ngày
                        </button>
                    </div>
                </div>
            </div>

            <hr className="separator" />

            {/* Main Content: 2 COLUMNS */}
            <div className="edit-trip-content">
                {/* LEFT COLUMN: Original Itinerary */}
                <div className="original-column">
                    <div className="column-header">
                        <h2>Lịch trình gốc</h2>
                        <p className="subtitle">Bản tham khảo ban đầu</p>
                    </div>

                    <div className="days-list">
                        {originalItinerary.map((dayPlan) => (
                            <div key={`original-${dayPlan.day}`} className="day-section original">
                                <h3 className="day-title">Ngày {dayPlan.day}</h3>
                                <div className="places-list">
                                    {dayPlan.places.map((item, index) => (
                                        <div key={index} className="place-item-readonly">
                                            <div className="time-badge">
                                                <FaClock /> {item.time_slot || 'N/A'}
                                            </div>
                                            <div className="place-info">
                                                <span className="place-icon">
                                                    {item.category === 'Ăn uống' || item.id === 'LUNCH' ? '🍽️' :
                                                        item.category === 'Di chuyển' || item.id === 'TRAVEL' ? '✈️' : '📍'}
                                                </span>
                                                <span className="place-name">{item.name}</span>
                                                <span className="place-category">({item.category || item.id})</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT COLUMN: Editable Itinerary */}
                <div className="editable-column">
                    <div className="column-header">
                        <h2>Chỉnh sửa lịch trình</h2>
                        <p className="subtitle">Kéo thả để sắp xếp lại</p>
                    </div>

                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="days-list">
                            {itinerary.map((dayPlan) => (
                                <div key={`edit-${dayPlan.day}`} className="day-section editable">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 className="day-title" style={{ margin: 0 }}>Ngày {dayPlan.day}</h3>
                                        <button
                                            onClick={() => handleDeleteDay(dayPlan.day)}
                                            className="delete-day-btn"
                                            disabled={isSaving || itinerary.length <= 1}
                                            title={itinerary.length <= 1 ? "Không thể xóa ngày cuối cùng" : "Xóa ngày này"}
                                        >
                                            <FaTrash /> Xóa ngày
                                        </button>
                                    </div>

                                    <Droppable droppableId={`day-${dayPlan.day}`}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
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
                                                    <p className="empty-message">
                                                        Kéo thả mục vào đây hoặc thêm mục mới
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>

                                    <div className="action-buttons">
                                        <button
                                            onClick={() => handleAddItem(dayPlan.day, 'DESTINATION')}
                                            className="add-btn destination"
                                        >
                                            <FaPlus /> Địa điểm
                                        </button>
                                        <button
                                            onClick={() => handleAddItem(dayPlan.day, 'LUNCH')}
                                            className="add-btn lunch"
                                        >
                                            <FaPlus /> Ăn uống
                                        </button>
                                        <button
                                            onClick={() => handleAddItem(dayPlan.day, 'TRAVEL')}
                                            className="add-btn travel"
                                        >
                                            <FaPlus /> Di chuyển
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                </div>
            </div>

            {/* Confirm Delete Day Modal */}
            {showDeleteDayConfirm && (
                <div className="modal-overlay confirm-modal-overlay" onClick={() => setShowDeleteDayConfirm(false)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-modal-icon">🗑️</div>
                        <h3>Xác nhận xóa ngày</h3>
                        <p>Bạn có chắc chắn muốn xóa <strong>Ngày {dayToDelete}</strong> khỏi lịch trình?</p>
                        <p className="warning-text">Tất cả địa điểm trong ngày này sẽ bị xóa vĩnh viễn!</p>
                        <p className="warning-text">Hành động này không thể hoàn tác!</p>

                        <div className="confirm-modal-actions">
                            <button onClick={() => setShowDeleteDayConfirm(false)} className="btn-cancel">
                                Hủy
                            </button>
                            <button onClick={confirmDeleteDay} className="btn-confirm-delete">
                                Xóa ngày
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}