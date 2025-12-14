// dndLogic.js - MERGED VERSION

// --- SORT BY TIME (NEW FEATURE) ---
export const sortByTime = (items) => {
    return [...items].sort((a, b) => {
        const t1 = a.time_slot ? a.time_slot.substring(0, 5) : "23:59";
        const t2 = b.time_slot ? b.time_slot.substring(0, 5) : "23:59";
        return t1.localeCompare(t2);
    });
};

// --- REORDER (Original) ---
export const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

// --- MOVE (Original - giữ lại cho tương thích) ---
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

// --- TIME HELPERS (NEW) ---
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

// --- REBUILD DAY (NEW ADVANCED FEATURE) ---
export const rebuildDay = async (places, opts = {}) => {
    if (!places) return places;

    const defaultStartMs =
        parseTimeToMs(opts.defaultStart || "08:00:00") ??
        8 * 60 * 60 * 1000;

    // Lọc travel
    const validPlaces = places.filter(
        (p) => p.category !== "Di chuyển" && p.category !== "TRAVEL"
    );

    const sortedPlaces = sortByTime(validPlaces);

    let currentMs = null;
    const result = [];

    for (let i = 0; i < sortedPlaces.length; i++) {
        const item = { ...sortedPlaces[i] };

        const rawDur = item.duration || 60;
        const durMin = Math.max(5, Math.round(rawDur / 5) * 5);
        const durMs = durMin * 60 * 1000;

        if (i === 0) {
            const parsed = parseTimeToMs(item.time_slot);
            currentMs = parsed !== null ? parsed : defaultStartMs;
            item.time_slot = msToHHMMSS(currentMs);
            item.duration = durMin;
            result.push({ ...item });
            currentMs += durMs;
            continue;
        }

        const parsed = parseTimeToMs(item.time_slot);

        if (parsed !== null && parsed >= currentMs) {
            item.time_slot = msToHHMMSS(parsed);
            item.duration = durMin;
            result.push({ ...item });
            currentMs = parsed + durMs;
        } else {
            item.time_slot = msToHHMMSS(currentMs);
            item.duration = durMin;
            result.push({ ...item });
            currentMs += durMs;
        }
    }

    return result;
};

// --- RECALCULATE TIME SLOTS (Giữ lại phiên bản cũ đơn giản) ---
const getDuration = (item) => {
    if (item.id === 'LUNCH' || item.category === 'Ăn uống') return 60;
    if (item.id === 'TRAVEL' || item.category === 'Di chuyển') return 45;
    return 90;
};

const formatTime = (ms) => {
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const recalculateTimeSlots = (itinerary) => {
    const START_TIME_MS = 9 * 60 * 60 * 1000;

    return itinerary.map(dayPlan => {
        let currentTimeMs = START_TIME_MS;
        
        const newPlaces = dayPlan.places.map(item => {
            const durationMinutes = getDuration(item);
            const durationMs = durationMinutes * 60 * 1000;

            const endTimeMs = currentTimeMs + durationMs;
            const newTimeSlot = `${formatTime(currentTimeMs)}-${formatTime(endTimeMs)}`;
            
            currentTimeMs = endTimeMs;

            return {
                ...item,
                time_slot: newTimeSlot,
            };
        });

        return { ...dayPlan, places: newPlaces };
    });
};