// -------------------------
//  SORT BY TIME (HH:MM)
// -------------------------
export const sortByTime = (items) => {
    return [...items].sort((a, b) => {
        const t1 = a.time_slot ? a.time_slot.substring(0, 5) : "23:59";
        const t2 = b.time_slot ? b.time_slot.substring(0, 5) : "23:59";
        return t1.localeCompare(t2);
    });
};

// -------------------------
//  REORDER (KÉO TRONG CÙNG NGÀY)
// -------------------------
export const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

// -------------------------
//  TIME HELPERS
// -------------------------
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

// -------------------------
//  REBUILD DAY (CHỈNH GIỜ TỰ ĐỘNG)
// -------------------------
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

// -------------------------
//  ALIAS
// -------------------------
export const recalculateTimeSlots = async (places, opts = {}) => {
    return await rebuildDay(places, opts);
};
