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
 * Nếu item có start_time từ AI, sử dụng nó; nếu không, tính tự động từ 8:00.
 * @param {Array} itinerary - Dữ liệu lịch trình (mảng các dayPlan)
 * @returns {Array} Lịch trình đã cập nhật khung giờ
 */
export const recalculateTimeSlots = (itinerary) => {
    const DEFAULT_START_TIME_MS = 8 * 60 * 60 * 1000; // Bắt đầu lúc 8:00 AM (8 giờ * 60 phút * 60 giây * 1000 ms)

    return itinerary.map(dayPlan => {
        let currentTimeMs = DEFAULT_START_TIME_MS; // Reset giờ cho mỗi ngày
        
        const newPlaces = dayPlan.places.map((item, index) => {
            // If AI provided start_time, use it; otherwise use calculated time
            let startTimeMs = currentTimeMs;
            
            if (item.time_slot && typeof item.time_slot === 'string') {
                // Try to parse existing time_slot (format: "HH:MM-HH:MM" or "HH:MM")
                const timeMatch = item.time_slot.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    startTimeMs = (hours * 60 + minutes) * 60 * 1000;
                }
            } else if (item.start_time && typeof item.start_time === 'string') {
                // Parse AI's start_time (format: "HH:MM")
                const timeMatch = item.start_time.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    startTimeMs = (hours * 60 + minutes) * 60 * 1000;
                }
            }
            
            // Get duration from item or calculate default
            let durationMinutes;
            if (item.duration_hours) {
                durationMinutes = item.duration_hours * 60;
            } else if (item.duration_min) {
                durationMinutes = item.duration_min;
            } else {
                durationMinutes = getDuration(item);
            }
            
            const durationMs = durationMinutes * 60 * 1000;
            const endTimeMs = startTimeMs + durationMs;
            
            // Định dạng slot giờ: "HH:MM-HH:MM"
            const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
            
            // Update currentTimeMs for next item (use endTimeMs, not startTimeMs)
            currentTimeMs = endTimeMs;

            return {
                ...item,
                time_slot: newTimeSlot,
                start_time: formatTime(startTimeMs), // Store normalized start_time
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};