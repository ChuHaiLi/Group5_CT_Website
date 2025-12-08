// dndLogic.js

// --- HÀM HỖ TRỢ DND CƠ BẢN ---
export const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

export const move = (source, destination, droppableSource, droppableDestination) => {
    const sourceClone = Array.from(source);
    const destClone = Array.from(destination);
    const [removed] = sourceClone.splice(droppableSource.index, 1);

    const moved = { ...removed, day: parseInt(droppableDestination.droppableId.split('-')[1], 10) };
    destClone.splice(droppableDestination.index, 0, moved);

    const result = {};
    result[droppableSource.droppableId] = sourceClone;
    result[droppableDestination.droppableId] = destClone;

    return result;
};

// --- HÀM TỰ ĐỘNG TÍNH TOÁN GIỜ (AUTO-TIME) ---
const getDuration = (item) => {
    // Thời lượng mặc định cho các loại hoạt động
    if (item.id === 'LUNCH' || item.category === 'Ăn uống') return 60; // 60 phút
    if (item.id === 'TRAVEL' || item.category === 'Di chuyển') return 45; // 45 phút
    return 90; // Địa điểm (DEFAULT): 90 phút (1.5 giờ)
};

const formatTime = (ms) => {
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Tái tính toán khung giờ cho toàn bộ lịch trình.
 * @param {Array} itinerary - Dữ liệu lịch trình (mảng các dayPlan)
 * @returns {Array} Lịch trình đã cập nhật khung giờ
 */
export const recalculateTimeSlots = (itinerary) => {
    const START_TIME_MS = 9 * 60 * 60 * 1000; // Bắt đầu lúc 9:00 AM (9 giờ * 60 phút * 60 giây * 1000 ms)

    return itinerary.map(dayPlan => {
        let currentTimeMs = START_TIME_MS; // Reset giờ cho mỗi ngày
        
        const newPlaces = dayPlan.places.map(item => {
            const durationMinutes = getDuration(item);
            const durationMs = durationMinutes * 60 * 1000;

            const endTimeMs = currentTimeMs + durationMs;
            
            // Định dạng slot giờ: "HH:MM-HH:MM"
            const newTimeSlot = `${formatTime(currentTimeMs)}-${formatTime(endTimeMs)}`;
            
            // Cập nhật thời gian bắt đầu cho hoạt động tiếp theo
            currentTimeMs = endTimeMs;

            return {
                ...item,
                time_slot: newTimeSlot,
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};