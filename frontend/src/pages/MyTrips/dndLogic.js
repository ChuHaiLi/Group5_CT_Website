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

// --- RECALCULATE TIME SLOTS (Giữ lại từ remote - hỗ trợ AI time calculation) ---
const getDuration = (item) => {
    if (item.id === 'LUNCH' || item.category === 'Ăn uống') return 60;
    if (item.id === 'TRAVEL' || item.category === 'Di chuyển') return 45;
    // Chuyển duration_hours sang phút nếu tồn tại
    if (item.duration_hours) return item.duration_hours * 60;
    return 90;
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
    const DEFAULT_START_TIME_MS = 8 * 60 * 60 * 1000; // Bắt đầu lúc 8:00 AM

    return itinerary.map(dayPlan => {
        let currentTimeMs = DEFAULT_START_TIME_MS; // Reset giờ cho mỗi ngày
        
        const newPlaces = dayPlan.places.map((item, index) => {
            
            let startTimeMs = currentTimeMs;
            
            // Cố gắng sử dụng thời gian đã có trong time_slot hoặc start_time (từ AI/swap)
            if (item.time_slot && typeof item.time_slot === 'string') {
                const timeMatch = item.time_slot.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    const parsedTimeMs = (hours * 60 + minutes) * 60 * 1000;
                    
                    // Nếu thời gian đã có lớn hơn thời gian hiện tại, sử dụng nó
                    if (parsedTimeMs > currentTimeMs) {
                        startTimeMs = parsedTimeMs;
                    }
                }
            } else if (item.start_time && typeof item.start_time === 'string') {
                 // Parse AI's start_time (format: "HH:MM")
                const timeMatch = item.start_time.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    const parsedTimeMs = (hours * 60 + minutes) * 60 * 1000;

                    if (parsedTimeMs > currentTimeMs) {
                        startTimeMs = parsedTimeMs;
                    }
                }
            }
            
            // Lấy duration (ưu tiên duration_hours/duration_min, sau đó là default)
            let durationMinutes = getDuration(item);
            const durationMs = durationMinutes * 60 * 1000;
            const endTimeMs = startTimeMs + durationMs;
            
            // Định dạng slot giờ: "HH:MM-HH:MM"
            const newTimeSlot = `${formatTime(startTimeMs)}-${formatTime(endTimeMs)}`;
            
            // Update currentTimeMs cho item tiếp theo
            currentTimeMs = endTimeMs;

            return {
                ...item,
                time_slot: newTimeSlot,
                start_time: formatTime(startTimeMs), // Store normalized start_time
                duration_hours: durationMinutes / 60, // Cập nhật duration_hours
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};