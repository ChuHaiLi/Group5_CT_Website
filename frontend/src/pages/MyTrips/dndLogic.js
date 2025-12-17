// dndLogic.js - MERGED: Giữ tính năng AI từ remote + Advanced features từ local

// --- SORT BY TIME (NEW FEATURE từ local) ---
export const sortByTime = (items) => {
    return [...items].sort((a, b) => {
        // Chỉ sắp xếp theo thời gian nếu cả hai đều có time_slot hợp lệ
        const t1 = a.time_slot ? a.time_slot.substring(0, 5) : "23:59";
        const t2 = b.time_slot ? b.time_slot.substring(0, 5) : "23:59";
        return t1.localeCompare(t2);
    });
};

// --- REORDER (ĐÃ SỬA: Thêm logic SWAP TIME) ---
export const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    
    // Tạo bản sao của hai mục bị hoán đổi để giữ lại giá trị giờ
    const itemA = { ...result[startIndex] };
    const itemB = { ...result[endIndex] };

    // 1. Thực hiện kéo thả (di chuyển mục)
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // 2. Lấy lại các mục ở vị trí mới sau khi di chuyển
    const movedItem = result[endIndex]; // Mục ban đầu ở startIndex, giờ ở endIndex
    const pushedItem = result[startIndex]; // Mục ban đầu ở endIndex, giờ ở startIndex
    
    // 3. SWAP TIME giữa vị trí cũ và vị trí mới
    // Chỉ swap nếu cả hai mục đều có dữ liệu giờ
    if (itemA.time_slot && itemB.time_slot) {
        
        // Hoán đổi time_slot (ví dụ: "09:00-11:00")
        movedItem.time_slot = itemB.time_slot;
        pushedItem.time_slot = itemA.time_slot;
        
        // Hoán đổi start_time (ví dụ: "09:00")
        if (itemA.start_time && itemB.start_time) {
            movedItem.start_time = itemB.start_time;
            pushedItem.start_time = itemA.start_time;
        }
    }
    
    return result;
};

// --- MOVE (Original từ remote - giữ lại cho tương thích) ---
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

// --- TIME HELPERS (NEW từ local) ---
const parseTimeToMs = (timeString) => {
    if (!timeString) return null;
    const clean = timeString.substring(0, 8);
    const parts = clean.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return (h * 60 + m) * 60 * 1000;
};

const msToHHMMSS = (ms) => {
    const totalMinutes = Math.floor(ms / 60000) % 1440;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

// --- REBUILD DAY (NEW ADVANCED FEATURE từ local) ---
export const rebuildDay = async (places, opts = {}) => {
    if (!places) return places;

    const defaultStartMs =
        parseTimeToMs(opts.defaultStart || "08:00:00") ??
        8 * 60 * 60 * 1000;

    // Lọc travel
    const validPlaces = places.filter(
        (p) => p.category !== "Di chuyển" && p.category !== "TRAVEL"
    );

    // *QUAN TRỌNG*: Không sắp xếp lại theo giờ ở đây, vì logic reorder đã swap giờ.
    // Nếu sắp xếp lại, logic swap giờ sẽ bị hủy bỏ.
    // const sortedPlaces = sortByTime(validPlaces); 
    const sortedPlaces = validPlaces;

    let currentMs = null;
    const result = [];

    for (let i = 0; i < sortedPlaces.length; i++) {
        const item = { ...sortedPlaces[i] };

        const rawDur = item.duration || 60;
        const durMin = Math.max(5, Math.round(rawDur / 5) * 5);
        const durMs = durMin * 60 * 1000;

        // Nếu là mục đầu tiên, sử dụng thời gian đã có (đã được swap) hoặc default
        if (i === 0) {
            const parsed = parseTimeToMs(item.time_slot);
            currentMs = parsed !== null ? parsed : defaultStartMs;
            
            // Cập nhật lại time_slot và duration để đảm bảo format đúng
            item.time_slot = `${msToHHMMSS(currentMs).substring(0, 5)}-${msToHHMMSS(currentMs + durMs).substring(0, 5)}`;
            item.duration = durMin;
            result.push({ ...item });
            currentMs += durMs;
            continue;
        }

        // Với các mục tiếp theo, nếu thời gian hiện tại (currentMs) lớn hơn thời gian 
        // trong time_slot đã được swap của item, ta phải điều chỉnh giờ
        const parsed = parseTimeToMs(item.time_slot);

        if (parsed !== null && parsed >= currentMs) {
            // Giữ thời gian đã được swap nếu nó lớn hơn hoặc bằng thời gian kết thúc của item trước
            // Cập nhật lại time_slot và duration để đảm bảo format đúng
            item.time_slot = `${msToHHMMSS(parsed).substring(0, 5)}-${msToHHMMSS(parsed + durMs).substring(0, 5)}`;
            item.duration = durMin;
            result.push({ ...item });
            currentMs = parsed + durMs;
        } else {
            // Nếu không, tính toán giờ mới dựa trên currentMs
            item.time_slot = `${msToHHMMSS(currentMs).substring(0, 5)}-${msToHHMMSS(currentMs + durMs).substring(0, 5)}`;
            item.duration = durMin;
            result.push({ ...item });
            currentMs += durMs;
        }
    }

    return result;
};

// --- HÀM TỰ ĐỘNG TÍNH TOÁN GIỜ (AUTO-TIME) ---
const getDuration = (item) => {
    // Thời lượng mặc định cho các loại hoạt động
    if (item.id === 'LUNCH' || item.category === 'Ăn uống') return 60; // 60 phút
    if (item.id === 'TRAVEL' || item.category === 'Di chuyển') return 45; // 45 phút
    // Chuyển duration_hours sang phút nếu tồn tại
    if (item.duration_hours) return item.duration_hours * 60;
    return 90; // Địa điểm (DEFAULT): 90 phút (1.5 giờ)
};

const formatTime = (ms) => {
    // ✅ Hỗ trợ thời gian > 24h (không wrap về 0-23h)
    // Ví dụ: 25:30, 26:00, 30:15 (cho phép lịch trình kéo dài qua đêm)
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Không giới hạn hours - có thể > 24 để hỗ trợ lịch trình dài
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Tái tính toán khung giờ cho toàn bộ lịch trình.
 * ✅ CRITICAL: Preserve EXACT order and time from AI - no sorting, no time limits.
 * Nếu item có start_time/end_time từ AI, sử dụng chúng trực tiếp.
 * @param {Array} itinerary - Dữ liệu lịch trình (mảng các dayPlan)
 * @returns {Array} Lịch trình đã cập nhật khung giờ
 */
export const recalculateTimeSlots = (itinerary) => {
    const DEFAULT_START_TIME_MS = 8 * 60 * 60 * 1000; // Bắt đầu lúc 8:00 AM (chỉ dùng khi không có thời gian từ AI)

    return itinerary.map(dayPlan => {
        // ✅ CRITICAL: DO NOT SORT - preserve the EXACT order from AI
        // Just use places as-is to maintain AI's intended order
        const places = dayPlan.places || [];
        
        // ✅ Initialize currentTimeMs - if first item has start_time from AI, use it
        let currentTimeMs = DEFAULT_START_TIME_MS;
        if (places.length > 0 && places[0].start_time) {
            const firstTimeMatch = places[0].start_time.match(/(\d{1,2}):(\d{2})/);
            if (firstTimeMatch) {
                const hours = parseInt(firstTimeMatch[1], 10);
                const minutes = parseInt(firstTimeMatch[2], 10);
                currentTimeMs = (hours * 60 + minutes) * 60 * 1000;
            }
        }
        
        const newPlaces = places.map((item, index) => {
            // ✅ PRIORITY 1: PRESERVE COMPLETE time_slot from AI if exists
            if (item.time_slot && typeof item.time_slot === 'string') {
                // Check if time_slot is complete (format: "HH:MM-HH:MM" or "H:MM-H:MM")
                const timeSlotMatch = item.time_slot.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
                if (timeSlotMatch) {
                    // Time slot is complete, keep it EXACTLY as-is
                    const startTimeStr = `${timeSlotMatch[1].padStart(2, '0')}:${timeSlotMatch[2]}`;
                    const endTimeStr = `${timeSlotMatch[3].padStart(2, '0')}:${timeSlotMatch[4]}`;
                    
                    // Update currentTimeMs to the end time (for next items without explicit time)
                    const endHours = parseInt(timeSlotMatch[3], 10);
                    const endMinutes = parseInt(timeSlotMatch[4], 10);
                    const endTimeMs = (endHours * 60 + endMinutes) * 60 * 1000;
                    currentTimeMs = Math.max(currentTimeMs, endTimeMs);
                    
                    return {
                        ...item,
                        time_slot: item.time_slot, // Keep original time_slot EXACTLY
                        start_time: startTimeStr, // Preserve start_time
                        end_time: endTimeStr, // Preserve end_time
                    };
                }
            }
            
            // ✅ PRIORITY 2: If time_slot is not complete, check for start_time and end_time from AI
            let startTimeMs = currentTimeMs;
            let endTimeMs = null;
            let hasExplicitTime = false;
            
            if (item.start_time && typeof item.start_time === 'string') {
                // ✅ Parse AI's start_time (format: "HH:MM" or "H:MM")
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
            
            // ✅ If both start_time and end_time are provided by AI, use them DIRECTLY (no limits)
            if (hasExplicitTime && endTimeMs !== null) {
                const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
                // Update currentTimeMs for next items (no time limit - can exceed 24:00)
                currentTimeMs = Math.max(currentTimeMs, endTimeMs);
                return {
                    ...item,
                    time_slot: newTimeSlot,
                    start_time: formatTime(startTimeMs), // Preserve AI's start_time
                    end_time: formatTime(endTimeMs), // Preserve AI's end_time
                };
            }
            
            // ✅ Get duration from item or calculate default
            let durationMinutes;
            if (item.duration_hours) {
                durationMinutes = item.duration_hours * 60;
            } else if (item.duration_min) {
                durationMinutes = item.duration_min;
            } else {
                durationMinutes = getDuration(item);
            }
            
            // If only start_time is provided by AI, calculate end_time from duration
            if (hasExplicitTime) {
                const durationMs = durationMinutes * 60 * 1000;
                endTimeMs = startTimeMs + durationMs;
                // Update currentTimeMs (no time limit - can exceed 24:00)
                currentTimeMs = Math.max(currentTimeMs, endTimeMs);
            } else {
                // No explicit time from AI, calculate sequentially from currentTimeMs
                const durationMs = durationMinutes * 60 * 1000;
                endTimeMs = startTimeMs + durationMs;
                currentTimeMs = endTimeMs; // Continue from end time (no limit)
            }
            
            const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
            
            return {
                ...item,
                time_slot: newTimeSlot,
                start_time: formatTime(startTimeMs),
                end_time: formatTime(endTimeMs),
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};