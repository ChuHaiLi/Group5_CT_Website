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
        // DO NOT SORT - preserve the exact order from AI
        // Just use places as-is to maintain AI's intended order
        const places = dayPlan.places || [];
        
        let currentTimeMs = DEFAULT_START_TIME_MS; // Reset giờ cho mỗi ngày
        
        const newPlaces = places.map((item, index) => {
            // PRESERVE TIME FROM AI - if time_slot is already complete, keep it as-is
            if (item.time_slot && typeof item.time_slot === 'string') {
                // Check if time_slot is complete (format: "HH:MM-HH:MM")
                const timeSlotMatch = item.time_slot.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
                if (timeSlotMatch) {
                    // Time slot is complete, keep it as-is
                    const startTimeStr = `${timeSlotMatch[1].padStart(2, '0')}:${timeSlotMatch[2]}`;
                    return {
                        ...item,
                        time_slot: item.time_slot, // Keep original time_slot
                        start_time: startTimeStr, // Keep or set start_time
                    };
                }
            }
            
            // If time_slot is not complete, check for start_time and end_time from AI
            let startTimeMs = currentTimeMs;
            let endTimeMs = null;
            let hasExplicitTime = false;
            
            if (item.start_time && typeof item.start_time === 'string') {
                // Parse AI's start_time (format: "HH:MM")
                const timeMatch = item.start_time.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    startTimeMs = (hours * 60 + minutes) * 60 * 1000;
                    hasExplicitTime = true;
                }
            }
            
            // Check if AI provided end_time
            if (item.end_time && typeof item.end_time === 'string') {
                const endTimeMatch = item.end_time.match(/(\d{1,2}):(\d{2})/);
                if (endTimeMatch) {
                    const hours = parseInt(endTimeMatch[1], 10);
                    const minutes = parseInt(endTimeMatch[2], 10);
                    endTimeMs = (hours * 60 + minutes) * 60 * 1000;
                }
            }
            
            // If both start_time and end_time are provided, use them directly
            if (hasExplicitTime && endTimeMs !== null) {
                const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
                currentTimeMs = Math.max(currentTimeMs, endTimeMs);
                return {
                    ...item,
                    time_slot: newTimeSlot,
                    start_time: formatTime(startTimeMs),
                    end_time: formatTime(endTimeMs),
                };
            }
            
            // If time_slot is already complete but we have end_time from AI, use it
            if (item.end_time && typeof item.end_time === 'string' && hasExplicitTime) {
                const endTimeMatch = item.end_time.match(/(\d{1,2}):(\d{2})/);
                if (endTimeMatch) {
                    const hours = parseInt(endTimeMatch[1], 10);
                    const minutes = parseInt(endTimeMatch[2], 10);
                    endTimeMs = (hours * 60 + minutes) * 60 * 1000;
                    const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
                    currentTimeMs = Math.max(currentTimeMs, endTimeMs);
                    return {
                        ...item,
                        time_slot: newTimeSlot,
                        start_time: formatTime(startTimeMs),
                        end_time: formatTime(endTimeMs),
                    };
                }
            }
            
            // If only start_time is provided, calculate end_time from duration
            if (hasExplicitTime) {
                let durationMinutes;
                if (item.duration_hours) {
                    durationMinutes = item.duration_hours * 60;
                } else if (item.duration_min) {
                    durationMinutes = item.duration_min;
                } else {
                    durationMinutes = getDuration(item);
                }
                
                const durationMs = durationMinutes * 60 * 1000;
                endTimeMs = startTimeMs + durationMs;
                currentTimeMs = Math.max(currentTimeMs, endTimeMs);
            } else {
                // No explicit time, calculate sequentially
                let durationMinutes;
                if (item.duration_hours) {
                    durationMinutes = item.duration_hours * 60;
                } else if (item.duration_min) {
                    durationMinutes = item.duration_min;
                } else {
                    durationMinutes = getDuration(item);
                }
                
                const durationMs = durationMinutes * 60 * 1000;
                endTimeMs = startTimeMs + durationMs;
                currentTimeMs = endTimeMs;
            }
            
            const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
            
            return {
                ...item,
                time_slot: newTimeSlot,
                start_time: formatTime(startTimeMs),
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};