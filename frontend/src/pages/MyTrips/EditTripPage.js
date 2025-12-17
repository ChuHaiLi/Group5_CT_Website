// EditTripPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { FaArrowLeft, FaSave, FaClock, FaMapMarkerAlt, FaPlus, FaRedo, FaCalendarPlus, FaTrash, FaCog, FaHotel, FaUtensils, FaChevronLeft, FaChevronRight, FaMoneyBillWave } from 'react-icons/fa'; // Import FaMoneyBillWave
import { toast } from 'react-toastify';
import DestinationPickerModal from './DestinationPickerModal';

// 🔑 IMPORT LOGIC VÀ AUTO-TIME TỪ FILE RIÊNG
import { reorder, move, rebuildDay, recalculateTimeSlots } from "./dndLogic";
import ItemCard from "./ItemCard";
import "./EditTripPage.css";

// --- HÀM GIẢ ĐỊNH: Lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token");
const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
const budgetOptions = [
    "< 500k VND",
    "500K - 1 milions VND",
    "1 - 2 milions VND",
    "> 2 milions VND",
];

const hotelOptions = [
    { id: 101, name: "Khách Sạn Mường Thanh Luxury", address: "123 Đường XYZ, TP. Đà Lạt", rating: 4.5, type: 'hotel', entry_fee: 1500000 }, // Thêm entry_fee (nightly rate)
    { id: 102, name: "Homestay View Đồi", address: "456 Hẻm ABC, TP. Đà Lạt", rating: 4.2, type: 'hotel', entry_fee: 500000 },
    { id: 103, name: "Resort Làng Thảo Nguyên", address: "789 Thôn DEF, TP. Đà Lạt", rating: 4.8, type: 'hotel', entry_fee: 2000000 },
];

// Helper: Only log in development mode
const devLog = {
    warn: (...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.warn(...args);
        }
    },
    error: (...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.error(...args);
        }
    },
    log: (...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(...args);
        }
    }
};

// --- HÀM HELPER VỀ CHI PHÍ (COPIED TỪ CreateTripForm.jsx) ---

/** Helper: map duration label -> days */
const extractDurationDays = (durationStr) => {
    switch (durationStr) {
        case "1-3 days":
            return 3;
        case "4-7 days":
        case "5 days": // Handle case where API might send 7 days
            return 7;
        case "8-14 days":
            return 10;
        case "15+ days":
            return 15;
        default:
            return 0;
    }
};

/** Helper: map duration length -> duration label (cho tính toán chi phí) */
const getDurationStringFromLength = (length) => {
    if (length <= 3) return '1-3 days';
    if (length <= 7) return '4-7 days';
    if (length <= 14) return '8-14 days';
    return '15+ days';
};

/** Helper: map budget label -> max VND amount */
const extractMaxBudget = (budgetStr) => {
    if (!budgetStr) return 0;
    if (budgetStr.includes("500k VND")) return 500000;
    if (budgetStr.includes("1 milions VND")) return 1000000;
    if (budgetStr.includes("2 milions VND")) return 2000000;
    if (budgetStr.includes(">")) return 1000000000; // 1 tỷ VND cho trường hợp lớn hơn
    return 0;
};

/**
 * Central Cost Calculation Function
 * Uses 'entry_fee' for destinations and assumes 'entry_fee' for hotels is the nightly rate.
 */
const calculateTotalCost = (
    mustIncludeDetails,
    selectedHotel,
    durationStr,
    peopleCount
) => {
    const durationDays = extractDurationDays(durationStr);
    const numPeople = peopleCount.includes("1 person")
        ? 1
        : peopleCount.includes("2-4 people")
            ? 4
            : peopleCount.includes("5-10 people")
                ? 10
                : peopleCount.includes("10+ people")
                    ? 10
                    : 1; // Ước tính số người tối đa cho tính toán chi phí

    let destinationsCost = 0;
    // Cost của các địa điểm tham quan (Entry fees)
    mustIncludeDetails.forEach((d) => {
        // [CHANGE] Use d.entry_fee. The entry_fee for destinations is assumed to be per-person.
        const cost = Number(d.entry_fee) || 0;
        destinationsCost += cost;
    });

    let hotelCost = 0;
    if (selectedHotel && durationDays > 0) {
        const numNights = Math.max(1, durationDays - 1); // Số đêm = Số ngày - 1
        // [CHANGE] Use selectedHotel.entry_fee. Assumed to be the nightly rate (per room/group).
        const costPerNight = Number(selectedHotel.entry_fee) || 0;
        hotelCost = costPerNight * numNights;
    }

    // Tổng chi phí (Địa điểm * số người) + Chi phí khách sạn
    // NOTE: Chỉ nhân cost địa điểm với số người, giữ nguyên cost khách sạn.
    const totalCost = destinationsCost * numPeople + hotelCost;
    return totalCost;
};


// --- HÀM HELPER MỚI: Trích xuất địa điểm có phí từ itinerary ---
const extractPlacesForCostCalculation = (itinerary, currentHotel) => {
    const places = [];
    const seenIds = new Set();
    const seenNames = new Set(); 

    // Duyệt qua tất cả các ngày và địa điểm
    itinerary.forEach(dayPlan => {
        (dayPlan.places || []).forEach(item => {
            const isSightseeing = item.category === 'Địa điểm' || item.type === 'sightseeing';
            const hasFee = (item.entry_fee || 0) > 0;
            const hasId = item.id && typeof item.id === 'number' && item.id > 0;

            // Điều kiện: Phải là địa điểm tham quan/hoạt động VÀ có phí VÀ chưa được tính (theo ID hoặc Tên)
            if (isSightseeing && hasFee) {
                if (hasId && seenIds.has(item.id)) return;
                if (!hasId && seenNames.has(item.name)) return;
                
                places.push(item);
                if (hasId) seenIds.add(item.id);
                if (!hasId) seenNames.add(item.name);
            }
        });
    });

    // Thêm khách sạn (nếu có và có phí)
    // NOTE: Khách sạn được tính riêng trong calculateTotalCost, không cần thêm vào places này
    // if (currentHotel && (currentHotel.entry_fee || 0) > 0) {
    //     // places.push(currentHotel);
    // }

    return places;
};


// --- Component Chính ---
export default function EditTripPage() {
    const { tripId } = useParams();
    const navigate = useNavigate();
    const [showOriginalOverlay, setShowOriginalOverlay] = useState(false);
    const [showDestinationPicker, setShowDestinationPicker] = useState(null); // { dayNumber, type: 'destination' | 'food' }
    const [allProvincePlaces, setAllProvincePlaces] = useState([]); // Danh sách địa điểm trong tỉnh
    const [tripData, setTripData] = useState(null);
    const [currentTotalCost, setCurrentTotalCost] = useState(0); // [NEW] Chi phí ước tính
    const [originalItinerary, setOriginalItinerary] = useState([]); // Lịch trình gốc
    const [itinerary, setItinerary] = useState([]); // Lịch trình đang chỉnh sửa
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [showAIModal, setShowAIModal] = useState(false);
    const [pendingAiChanges, setPendingAiChanges] = useState(false);
    const [preAiItinerary, setPreAiItinerary] = useState(null);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
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
    // Use ref to avoid stale closure in useEffect
    const pendingAiChangesRef = useRef(false);
    const [currentHotel, setCurrentHotel] = useState(null);
    const [hotelIndex, setHotelIndex] = useState(-1); // -1: chưa chọn hoặc không tìm thấy

    const [openDays, setOpenDays] = useState(new Set([1])); // Mặc định mở Ngày 1

    const toggleDayOpen = useCallback((dayNumber) => {
        setOpenDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayNumber)) {
                newSet.delete(dayNumber); // Đóng lại
            } else {
                newSet.add(dayNumber); // Mở ra
            }
            return newSet;
        });
    }, []);

    const handleSelectNewHotel = useCallback(() => {
        if (hotelOptions.length === 0) return;

        let newIndex = (hotelIndex + 1) % hotelOptions.length;

        setHotelIndex(newIndex);
        setCurrentHotel(hotelOptions[newIndex]);
        toast.success(`Đã chọn Khách sạn mới: ${hotelOptions[newIndex].name}`, { autoClose: 2000 });

    }, [hotelIndex]);


    // [NEW] Xử lý việc xem chi tiết khách sạn (Đã dùng useCallback)
    const handleViewHotelDetails = useCallback(async () => {
        if (!currentHotel) return;

        const placeId = currentHotel.id;
        setIsLoading(true); // Dùng loading state chung (sửa từ setAiLoading)

        try {
            const response = await axios.get(`/api/destinations/${placeId}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });

            const detailedResult = response.data;

            setAiResult({
                score: currentHotel.rating ? currentHotel.rating * 20 : 0,
                summary: `Chi tiết cho Khách sạn ${currentHotel.name}. Địa chỉ: ${detailedResult.address || currentHotel.address}.`,
                suggestions: [],
                raw: JSON.stringify(detailedResult, null, 2)
            });
            setShowAIModal(true);

        } catch (err) {
            toast.error("Không thể tải chi tiết khách sạn.");
            setAiResult({
                raw: `Lỗi tải chi tiết cho ID ${placeId}`,
                suggestions: []
            });
            setShowAIModal(true);

        } finally {
            setIsLoading(false);
        }
    }, [currentHotel]);

    // 🔑 LOGIC CHUYỂN ĐỔI KHÁCH SẠN
    const handleHotelChange = useCallback((direction) => {
        if (hotelOptions.length === 0) return;

        let newIndex = hotelIndex;

        // Nếu chưa chọn (hoặc -1), bắt đầu từ 0
        if (newIndex === -1) {
            newIndex = 0;
        } else if (direction === 'next') {
            newIndex = (hotelIndex + 1) % hotelOptions.length;
        } else if (direction === 'prev') {
            newIndex = (hotelIndex - 1 + hotelOptions.length) % hotelOptions.length;
        }

        if (newIndex !== hotelIndex) {
            setHotelIndex(newIndex);
            setCurrentHotel(hotelOptions[newIndex]);
            toast.info(`Đã đổi khách sạn sang: ${hotelOptions[newIndex].name}`, { autoClose: 2000 });
        }
    }, [hotelIndex]);

    // Summarize raw AI response for user-friendly display (English)
    const summarizeRaw = (raw) => {
        if (!raw) return "No response from AI.";
        try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === "object") {
                if (parsed.message) return String(parsed.message);
                if (parsed.error) return String(parsed.error);
                // If object has keys, return a short fixed message
                return "AI returned an error. Please try again or check logs.";
            }
        } catch (e) {
            // Not JSON — fall through
        }
        const text = String(raw);
        return text.length > 300 ? text.slice(0, 300) + "..." : text;
    };

    // Map numeric score to qualitative rating badge
    const getRatingLabel = (score) => {
        if (score === null || score === undefined || isNaN(score)) return "-";
        const s = Number(score);
        if (s <= 30) return "Bad";
        if (s <= 50) return "Poor";
        if (s <= 70) return "Average";
        if (s <= 80) return "Good";
        if (s <= 90) return "Very Good";
        return "Excellent";
    };

    // Map numeric score to background color for warning/quality
    const getRatingColor = (score) => {
        if (score === null || score === undefined || isNaN(score)) return "#f3f4f6";
        const s = Number(score);
        if (s <= 30) return "#fee2e2"; // red
        if (s <= 50) return "#fff7ed"; // orange
        if (s <= 70) return "#fef3c7"; // yellow
        if (s <= 80) return "#e0f2fe"; // light blue
        if (s <= 90) return "#d1fae5"; // light green
        return "#dcfce7"; // very light green
    };

    // Ensure suggested itinerary items have required fields and fill missing slots (lunch/travel)
    const normalizeAndFillSuggested = (suggested) => {
        if (!Array.isArray(suggested)) return suggested;

        // clone
        const copy = suggested.map((day) => ({
            ...day,
            places: (day.places || []).map((p) => ({ ...(p || {}) })),
        }));

        const ensureUniqueIds = () => {
            let counter = 0;
            copy.forEach((d) => {
                d.places = d.places.map((p) => {
                    if (!p.uniqueId) p.uniqueId = `ai-${Date.now()}-${counter++}`;
                    if (!p.name) p.name = p.place || p.name || "Địa điểm";
                    if (!p.category)
                        p.category =
                            p.category ||
                            (p.id === "LUNCH"
                                ? "Ăn uống"
                                : p.id === "TRAVEL"
                                    ? "Di chuyển"
                                    : "Địa điểm");
                    return p;
                });
            });
        };

        const addDefaults = () => {
            copy.forEach((d) => {
                const cats = (d.places || []).map((p) =>
                    (p.category || p.id || "").toString()
                );
                // add a lunch entry if missing
                // Check for food-related categories more precisely
                if (
                    !cats.some(
                        (c) => {
                            const cLower = c.toLowerCase();
                            return (
                                c === "LUNCH" ||
                                cLower === "ăn uống" ||
                                cLower.includes("lunch") ||
                                cLower.includes("dinner") ||
                                cLower.includes("breakfast") ||
                                cLower.includes("meal") ||
                                /\băn\s+(trưa|tối|sáng|chiều|vặt|nhẹ|buffet|tiệc)\b/i.test(c) ||
                                /\băn\s+uống\b/i.test(c)
                            );
                        }
                    )
                ) {
                    d.places.push({
                        id: "LUNCH",
                        uniqueId: `LUNCH-${d.day || Math.random()}`,
                        name: "Ăn trưa",
                        category: "Ăn uống",
                    });
                }
                // add a travel/rest entry if missing
                if (
                    !cats.some(
                        (c) =>
                            c.toLowerCase().includes("di chuyển") ||
                            c.toLowerCase().includes("travel") ||
                            c === "TRAVEL"
                    )
                ) {
                    d.places.push({
                        id: "TRAVEL",
                        uniqueId: `TRAVEL-${d.day || Math.random()}`,
                        name: "Di chuyển/Nghỉ ngơi",
                        category: "Di chuyển",
                    });
                }
            });
        };

        const sortByTimeSlot = () => {
            const parseStart = (ts) => {
                if (!ts || typeof ts !== "string") return 9999;
                const m = ts.match(/(\d{1,2}):(\d{2})/);
                if (!m) return 9999;
                return Number(m[1]) * 60 + Number(m[2]);
            };
            copy.forEach((d) => {
                d.places.sort(
                    (a, b) =>
                        (parseStart(a.time_slot) || 9999) -
                        (parseStart(b.time_slot) || 9999)
                );
            });
        };

        ensureUniqueIds();
        addDefaults();
        sortByTimeSlot();
        return copy;
    };

    // Calculate Haversine distance between two GPS coordinates (km)
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 100) / 100; // Round to 2 decimals
    };

    // Estimate travel time in minutes based on distance (km)
    const estimateTravelTime = (distanceKm, transportMode = "car") => {
        if (!distanceKm || distanceKm <= 0) return 0;
        const speeds = { car: 50, walk: 5, bike: 15 }; // km/h
        const speed = speeds[transportMode] || 50;
        return Math.ceil((distanceKm / speed) * 60); // minutes
    };

    // Enhance itinerary with calculated distances and travel times
    const enhanceItineraryWithDistances = (itinerary) => {
        return itinerary.map((dayObj) => {
            const enhancedPlaces = [];
            let prevLat = null;
            let prevLon = null;

            (dayObj.items || dayObj.places || []).forEach((item, index) => {
                const currentLat = item.lat || item.latitude || null;
                const currentLon = item.lon || item.longitude || item.lng || null;

                // Calculate distance from previous place
                let distanceKm = item.distance_from_prev_km || 0;
                if (prevLat != null && prevLon != null && currentLat != null && currentLon != null) {
                    distanceKm = haversineDistance(prevLat, prevLon, currentLat, currentLon) || 0;
                }

                // If this is a move item and distance > 0, ensure it has proper duration
                const isMove = item.type === "move" || item.category === "Di chuyển";
                if (isMove && distanceKm > 0 && (!item.duration_min || item.duration_min === 0)) {
                    item.duration_min = estimateTravelTime(distanceKm, "car");
                }

                enhancedPlaces.push({
                    ...item,
                    distance_from_prev_km: distanceKm,
                });

                // Update previous coordinates (only for sightseeing places, not move/rest/food)
                if (currentLat != null && currentLon != null && !isMove) {
                    prevLat = currentLat;
                    prevLon = currentLon;
                }
            });

            return {
                ...dayObj,
                places: enhancedPlaces,
            };
        });
    };

    // Validate itinerary structure before applying
    const validateItinerary = (itinerary) => {
        if (!Array.isArray(itinerary)) {
            devLog.error("Invalid itinerary: not an array", itinerary);
            return false;
        }
        if (itinerary.length === 0) {
            devLog.error("Invalid itinerary: empty array");
            return false;
        }
        for (const day of itinerary) {
            if (!day || typeof day !== "object") {
                devLog.error("Invalid itinerary: day is not an object", day);
                return false;
            }
            if (!Array.isArray(day.places)) {
                devLog.error("Invalid itinerary: day.places is not an array", day);
                return false;
            }
        }
        return true;
    };

    // Deep clone itinerary for safe mutation
    const deepCloneItinerary = (itinerary) => {
        return JSON.parse(JSON.stringify(itinerary));
    };

    // Safe merge: merge AI suggestions into existing itinerary without losing data
    // eslint-disable-next-line no-unused-vars
    const safeMergeItinerary = (currentItinerary, aiItinerary) => {
        if (!validateItinerary(aiItinerary)) {
            return null; // Invalid AI response
        }

        const current = deepCloneItinerary(currentItinerary);
        const ai = deepCloneItinerary(aiItinerary);

        // Create a map of current days by day number
        const currentDaysMap = new Map();
        current.forEach((day) => {
            const dayNum = day.day || 0;
            currentDaysMap.set(dayNum, day);
        });

        // Merge AI days into current
        const merged = [];
        const maxDay = Math.max(
            ...current.map((d) => d.day || 0),
            ...ai.map((d) => d.day || 0)
        );

        for (let dayNum = 1; dayNum <= maxDay; dayNum++) {
            const currentDay = currentDaysMap.get(dayNum);
            const aiDay = ai.find((d) => (d.day || 0) === dayNum);

            if (aiDay && aiDay.places && aiDay.places.length > 0) {
                // Use AI suggestion for this day (but preserve structure)
                merged.push({
                    ...aiDay,
                    day: dayNum,
                    places: Array.isArray(aiDay.places) ? aiDay.places : [],
                });
            } else if (currentDay) {
                // Keep current day if no AI suggestion
                merged.push({
                    ...currentDay,
                    day: dayNum,
                    places: Array.isArray(currentDay.places) ? currentDay.places : [],
                });
            }
        }

        return merged.length > 0 ? merged : null;
    };

    // Convert optimized_itinerary from backend into frontend flattened structure
    const mapOptimizedToFrontend = (optimized, sourceItineraryForMatching = null) => {

        if (!Array.isArray(optimized)) {
            devLog.error("mapOptimizedToFrontend: optimized is not an array", optimized);
            return [];
        }

        let uniqueIdCounter = 0;
        const mapped = optimized.map((dayObj) => {
            if (!dayObj || typeof dayObj !== "object") {
                devLog.error("mapOptimizedToFrontend: invalid dayObj", dayObj);
                return { day: 0, places: [] };
            }

            const dayNum = dayObj.day || 0;
            let items = dayObj.items || [];

            // Build a lookup map of all places from source itinerary for matching
            const allPlacesMap = new Map();
            const sourceForMatching = sourceItineraryForMatching || itinerary || [];
            sourceForMatching.forEach((d) => {
                (d.places || []).forEach((p) => {
                    const nameKey = (p.name || "").toLowerCase().trim();
                    if (nameKey && !allPlacesMap.has(nameKey)) {
                        allPlacesMap.set(nameKey, p);
                    }
                });
            });

            // Handle case where AI returns 'schedule' or 'activities' array instead of 'items' array
            if (!Array.isArray(items) || items.length === 0) {
                // Try 'schedule' first (has time info)
                const schedule = dayObj.schedule || [];
                if (Array.isArray(schedule) && schedule.length > 0) {

                    // Parse schedule strings into items
                    // Format: "HH:MM-HH:MM - Activity Name - Description"
                    items = schedule.map((scheduleStr, idx) => {
                        if (typeof scheduleStr !== "string") return null;

                        // Parse time range and activity name
                        // Try multiple formats:
                        // 1. "HH:MM-HH:MM - Activity Name - Description"
                        // 2. "HH:MM-HH:MM - Activity Name"
                        // 3. "HH:MM-HH:MM Activity Name"
                        let timeMatch = scheduleStr.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+?)(?:\s*-\s*(.+))?$/);
                        let startTime, endTime, activityName;

                        if (timeMatch) {
                            [, startTime, endTime, activityName] = timeMatch;
                        } else {
                            // Try format without description: "HH:MM-HH:MM - Activity Name"
                            const altMatch1 = scheduleStr.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+)$/);
                            if (altMatch1) {
                                [, startTime, endTime, activityName] = altMatch1;
                            } else {
                                // Try format without dash separator: "HH:MM-HH:MM Activity Name"
                                const altMatch2 = scheduleStr.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/);
                                if (altMatch2) {
                                    [, startTime, endTime, activityName] = altMatch2;
                                } else {
                                    return null;
                                }
                            }
                        }

                        const duration = calculateDurationMinutes(startTime, endTime);
                        const activityNameTrimmed = activityName.trim();
                        const activityNameLower = activityNameTrimmed.toLowerCase();

                        // Try to match with existing place from itinerary
                        let matchedPlace = null;
                        for (const [key, place] of allPlacesMap.entries()) {
                            if (activityNameLower.includes(key) || key.includes(activityNameLower)) {
                                matchedPlace = place;
                                break;
                            }
                        }

                        return {
                            id: matchedPlace?.id || null,
                            name: activityNameTrimmed,
                            type: inferTypeFromName(activityNameTrimmed),
                            lat: matchedPlace?.lat || matchedPlace?.latitude || null,
                            lng: matchedPlace?.lon || matchedPlace?.lng || matchedPlace?.longitude || null,
                            start_time: startTime,
                            end_time: endTime,
                            duration_min: duration,
                            distance_from_prev_km: 0,
                            needs_data: !!matchedPlace?.needs_data,
                            // [NEW] Thêm entry_fee từ matchedPlace (để tính cost)
                            entry_fee: matchedPlace?.entry_fee || 0, 
                        };
                    }).filter(Boolean);
                } else {
                    // Try 'activities' array (can be strings or objects with activity/time)
                    const activities = dayObj.activities || [];
                    if (Array.isArray(activities) && activities.length > 0) {

                        // Generate default times starting from 8:00 AM
                        let currentTimeMinutes = 8 * 60; // 8:00 AM
                        const defaultDuration = 90; // 90 minutes default

                        items = activities.map((activityItem, idx) => {
                            // Handle both string and object formats
                            let activityName, timeRange = null;

                            if (typeof activityItem === "string") {
                                // Check if string contains time prefix like "08:00-10:30 - Activity Name"
                                const timePrefixMatch = activityItem.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+)$/);
                                if (timePrefixMatch) {
                                    // Extract time and activity name separately
                                    [, , , activityName] = timePrefixMatch;
                                    timeRange = `${timePrefixMatch[1]}-${timePrefixMatch[2]}`;
                                } else {
                                    // Try format without description: "08:00-10:30 Activity Name"
                                    const altMatch = activityItem.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/);
                                    if (altMatch) {
                                        [, , , activityName] = altMatch;
                                        timeRange = `${altMatch[1]}-${altMatch[2]}`;
                                    } else {
                                        // No time prefix, use whole string as activity name
                                        activityName = activityItem;
                                    }
                                }
                            } else if (typeof activityItem === "object" && activityItem !== null) {
                                activityName = activityItem.activity || activityItem.name || "";
                                timeRange = activityItem.time || activityItem.time_slot || null;
                            } else {
                                return null;
                            }

                            const activityNameTrimmed = activityName.trim();
                            if (!activityNameTrimmed) {
                                return null;
                            }

                            const activityNameLower = activityNameTrimmed.toLowerCase();

                            // Try to match with existing place from itinerary
                            let matchedPlace = null;
                            for (const [key, place] of allPlacesMap.entries()) {
                                if (activityNameLower.includes(key) || key.includes(activityNameLower)) {
                                    matchedPlace = place;
                                    break;
                                }
                            }

                            // Parse time range if provided, otherwise calculate
                            let startTime, endTime, duration;

                            if (timeRange) {
                                // Parse "HH:MM-HH:MM" format
                                const timeMatch = timeRange.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
                                if (timeMatch) {
                                    [, startTime, endTime] = timeMatch;
                                    duration = calculateDurationMinutes(startTime, endTime);
                                    // Update currentTimeMinutes to endTime for next item
                                    const [endH, endM] = endTime.split(':').map(Number);
                                    currentTimeMinutes = endH * 60 + endM;
                                } else {
                                    // Fallback to default calculation
                                    startTime = minutesToTimeString(currentTimeMinutes);
                                    const itemType = inferTypeFromName(activityNameTrimmed);
                                    duration = itemType === "food" ? 60 : itemType === "move" ? 45 : itemType === "rest" ? 30 : defaultDuration;
                                    endTime = minutesToTimeString(currentTimeMinutes + duration);
                                    currentTimeMinutes += duration;
                                }
                            } else {
                                // Calculate duration based on type
                                const itemType = inferTypeFromName(activityNameTrimmed);
                                duration = itemType === "food" ? 60 : itemType === "move" ? 45 : itemType === "rest" ? 30 : defaultDuration;

                                startTime = minutesToTimeString(currentTimeMinutes);
                                endTime = minutesToTimeString(currentTimeMinutes + duration);

                                currentTimeMinutes += duration;
                                // Add travel time between activities (except for last one)
                                if (idx < activities.length - 1 && itemType !== "move") {
                                    currentTimeMinutes += 30; // 30 min travel
                                }
                            }

                            const result = {
                                id: matchedPlace?.id || null,
                                name: activityNameTrimmed,
                                type: inferTypeFromName(activityNameTrimmed),
                                lat: matchedPlace?.lat || matchedPlace?.latitude || null,
                                lng: matchedPlace?.lon || matchedPlace?.lng || matchedPlace?.longitude || null,
                                start_time: startTime,
                                end_time: endTime,
                                duration_min: duration,
                                distance_from_prev_km: 0,
                                needs_data: !!matchedPlace?.needs_data,
                                // [NEW] Thêm entry_fee từ matchedPlace (để tính cost)
                                entry_fee: matchedPlace?.entry_fee || 0,
                            };


                            return result;
                        }).filter((item) => {
                            const isValid = item !== null && item !== undefined;
                            if (!isValid) {
                            }
                            return isValid;
                        });
                    }
                }
            }


            if (!Array.isArray(items)) {
                devLog.error("mapOptimizedToFrontend: items is not an array", items);
                return { day: dayNum, places: [] };
            }

            const places = items.map((it) => {
                if (!it || typeof it !== "object") {
                    return null;
                }
                const uid = `ai-${Date.now()}-${uniqueIdCounter++}`;
                return {
                    uniqueId: uid,
                    id: it.id || null,
                    name: it.name || "Địa điểm",
                    category:
                        it.type === "food"
                            ? "Ăn uống"
                            : it.type === "move"
                                ? "Di chuyển"
                                : it.type === "rest"
                                    ? "Nghỉ ngơi"
                                    : it.type === "hotel"
                                        ? "Khách sạn"
                                        : it.type === "sightseeing"
                                            ? "Địa điểm"
                                            : it.type || "Địa điểm",
                    lat: it.lat || it.latitude || null,
                    lon: it.lng || it.longitude || null,
                    time_slot: it.start_time || it.time_slot || null,
                    duration_hours: it.duration_min
                        ? Number(it.duration_min) / 60
                        : it.duration_hours || null,
                    distance_from_prev_km: it.distance_from_prev_km || 0,
                    needs_data: !!it.needs_data,
                    // [NEW] Thêm entry_fee
                    entry_fee: it.entry_fee || 0, 
                };
            }).filter(Boolean); // Remove null entries

            return {
                day: dayNum,
                places: places,
            };
        }).filter((day) => day.day > 0); // Remove invalid days


        // Enhance with calculated distances
        const enhanced = enhanceItineraryWithDistances(mapped);


        return enhanced;
    };

    // Helper: Calculate duration in minutes from time strings
    const calculateDurationMinutes = (startTime, endTime) => {
        try {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            return Math.max(30, endMinutes - startMinutes); // Minimum 30 minutes
        } catch (e) {
            return 90; // Default 90 minutes
        }
    };

    // Helper: Convert minutes to HH:MM string
    const minutesToTimeString = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    // Helper: Infer item type from activity name
    const inferTypeFromName = (name) => {
        const nameLower = (name || "").toLowerCase();

        // Check for food-related keywords (only as whole words or in food context)
        // Match "ăn" only when it's a separate word or in food context (ăn trưa, ăn tối, ăn sáng, etc.)
        const foodPatterns = [
            /\băn\s+(trưa|tối|sáng|chiều|vặt|nhẹ|buffet|tiệc)\b/i,
            /\băn\s+uống\b/i,
            /\băn\s+ở\b/i,
            /\blunch\b/i,
            /\bdinner\b/i,
            /\bbreakfast\b/i,
            /\bmeal\b/i,
            /\băn\s+nhà\s+hàng\b/i,
            /\bnhà\s+hàng\b/i,
            /\brestaurant\b/i,
            /\bcafé\b/i,
            /\bcafe\b/i,
            /\bquán\s+ăn\b/i,
            /\bquán\s+nước\b/i,
        ];

        if (foodPatterns.some(pattern => pattern.test(nameLower))) {
            return "food";
        }

        // Check for travel/move keywords
        if (nameLower.includes("travel") || nameLower.includes("di chuyển") || nameLower.includes("move") || nameLower.includes("đi đến") || nameLower.includes("travel to")) {
            return "move";
        }

        // Check for rest keywords
        if (nameLower.includes("rest") || nameLower.includes("nghỉ") || nameLower.includes("break")) {
            return "rest";
        }

        // Check for hotel keywords
        if (nameLower.includes("hotel") || nameLower.includes("khách sạn")) {
            return "hotel";
        }

        // Default to sightseeing
        return "sightseeing";
    };

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

    // 1. Regenerate Full
    const handleRegenerateFull = async () => {
        const { name, startDate, provinceId } = editableData;
        const durationNum = itinerary.length;

        if (!name?.trim() || !startDate || durationNum <= 0 || isNaN(durationNum) || !(typeof provinceId === 'number' && provinceId > 0)) {
            toast.error('Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng và ID Tỉnh hợp lệ.');
            return;
        }
        const maxBudget = extractMaxBudget(editableData.budget);
        if (maxBudget > 0 && currentTotalCost > maxBudget) {
            toast.error(`Không thể TÁI TẠO: Tổng chi phí ước tính (${new Intl.NumberFormat('vi-VN').format(currentTotalCost)} VND) vượt quá Ngân sách tối đa (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND). Vui lòng điều chỉnh Ngân sách hoặc xóa bớt địa điểm trong lộ trình.`, { autoClose: 8000 });
            return; // NGĂN CHẶN TÁI TẠO
        }
        // ✅ Hiển thị modal xác nhận thay vì toast
        setShowRegenerateConfirm(true);
    };

    // ✅ Hàm thực thi tái tạo (tách riêng)
    const executeRegenerate = async () => {
        setShowRegenerateConfirm(false);
        setIsSaving(true);
        setError(null);

        const durationNum = itinerary.length;
        const loadingToast = toast.info('Đang tái tạo lịch trình...', { autoClose: false });

        try {
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

    // 2. Extend Trip
    const handleExtendTrip = async () => {
        const { startDate } = editableData;
        const currentDuration = itinerary.length;

        if (currentDuration >= 30 || currentDuration < 1) {
            toast.error('Thời lượng chuyến đi không hợp lệ hoặc đã đạt giới hạn (30 ngày).');
            return;
        }

        if (!startDate) {
            toast.error('Cần có Ngày xuất phát để mở rộng.');
            return;
        }

        const newDuration = currentDuration + 1;

        const newDay = {
            day: newDuration,
            places: []
        };

        const updatedItinerary = [...itinerary, newDay];

        setItinerary(updatedItinerary);
        setOpenDays(prev => new Set([...prev, newDuration])); // ✅ Mở ngày mới

        toast.success(`Đã thêm Ngày ${newDuration}! Nhớ nhấn "Lưu Thay Đổi" để lưu vĩnh viễn.`, {
            autoClose: 4000
        });
    };

    // 3. Delete Day
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

        let newItinerary = itinerary.filter(d => d.day !== dayToDelete);

        newItinerary = newItinerary.map((day, index) => ({
            ...day,
            day: index + 1,
            places: day.places.map(place => ({
                ...place,
                day: index + 1
            }))
        }));

        setItinerary(newItinerary);
        setDayToDelete(null);
        setOpenDays(prev => {
            const newSet = new Set(prev);
            newSet.delete(dayToDelete);
            return newSet;
        });
        toast.success(`Đã xóa Ngày ${dayToDelete}! Nhớ nhấn "Lưu Thay Đổi" để lưu vĩnh viễn.`, {
            autoClose: 4000
        });
    };

    const handleRevertAIChanges = () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:662', message: 'handleRevertAIChanges called', data: { hasPreAiItinerary: !!preAiItinerary }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion
        if (preAiItinerary) {
            setItinerary(preAiItinerary);
        }
        setPreAiItinerary(null);
        pendingAiChangesRef.current = false;
        setPendingAiChanges(false);
        setShowAIModal(false);
    };

    // eslint-disable-next-line no-unused-vars
    const handleConfirmAISave = async () => {
        // call existing save handler to persist current (AI-applied) itinerary
        await handleSave();
        setPreAiItinerary(null);
        setPendingAiChanges(false);
    };

    const flattenItinerary = (apiItinerary) => {

        let uniqueIdCounter = 0;
        let extractedHotel = null; // Biến tạm để lưu khách sạn

        const flattened = apiItinerary.map((dayPlan) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:685', message: 'flattenItinerary processing day', data: { day: dayPlan.day, placesCount: dayPlan.places?.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H5' }) }).catch(() => { });
            // #endregion
            const placesWithoutHotel = [];

            (dayPlan.places || []).forEach((item) => {
                const isHotel = (item.category === 'Khách sạn' || item.type === 'hotel');

                if (isHotel && !extractedHotel) {
                    // Nếu chưa trích xuất khách sạn, lấy cái này
                    extractedHotel = {
                        id: item.id || -1,
                        name: item.name || 'Khách sạn đã chọn',
                        address: item.address || item.place || 'Địa chỉ không rõ',
                        rating: item.rating || 0,
                        type: 'hotel',
                        // Thêm các thuộc tính khác cần thiết
                        lat: item.lat || item.latitude || null,
                        lon: item.lon || item.longitude || null,
                        // [NEW] Thêm entry_fee
                        entry_fee: item.entry_fee || 0,
                    };
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:705', message: 'Extracted hotel from itinerary', data: { hotelName: extractedHotel.name, day: dayPlan.day }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H5' }) }).catch(() => { });
                    // #endregion
                } else if (isHotel && extractedHotel) {
                    // Nếu đã trích xuất, bỏ qua các mục khách sạn tiếp theo
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:712', message: 'Skipping duplicate hotel in itinerary', data: { hotelName: item.name, day: dayPlan.day }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H5' }) }).catch(() => { });
                    // #endregion
                    return;
                } else {
                    // Nếu không phải khách sạn, thêm vào danh sách
                    placesWithoutHotel.push({
                        ...item,
                        uniqueId: `item-${item.id || item.name}-${uniqueIdCounter++}`,
                        day: dayPlan.day,
                        // [NEW] Đảm bảo entry_fee được giữ lại
                        entry_fee: item.entry_fee || 0,
                    });
                }
            });

            return {
                ...dayPlan,
                places: placesWithoutHotel,
            };
        });

        // Gắn khách sạn đã trích xuất vào đối tượng trả về (để sử dụng trong fetchTripDetails)
        flattened.extractedHotel = extractedHotel;

        return flattened;
    };

    const restoreItinerary = (flatItinerary) => {
        return flatItinerary.map((dayPlan) => ({
            day: dayPlan.day,
            places: dayPlan.places.map((item) => {
                const { uniqueId, day, ...apiItem } = item;
                return apiItem;
            }),
        }));
    };

    // --- [NEW] Calculate Total Cost Effect ---
    useEffect(() => {
        if (!editableData.people || !editableData.budget || itinerary.length === 0) {
            setCurrentTotalCost(0);
            return;
        }

        // 1. Trích xuất destinations có phí từ itinerary đang chỉnh sửa
        const placesWithCost = extractPlacesForCostCalculation(itinerary, currentHotel);

        // 2. Chuẩn bị duration string (cần re-map từ length sang string nếu cần)
        const currentDurationLength = itinerary.length;
        const durationString = getDurationStringFromLength(currentDurationLength);

        const totalCost = calculateTotalCost(
            placesWithCost, // Địa điểm/hoạt động có phí
            currentHotel,    // Khách sạn (giả sử có entry_fee = nightly rate)
            durationString,  // Thời lượng
            editableData.people // Số người
        );

        setCurrentTotalCost(totalCost);

        // Hiển thị cảnh báo nếu chi phí mới vượt quá ngân sách
        const maxBudget = extractMaxBudget(editableData.budget);
        if (maxBudget > 0 && totalCost > maxBudget) {
            toast.warn(
                `CẢNH BÁO: Chi phí ước tính (${new Intl.NumberFormat('vi-VN').format(totalCost)} VND) đã vượt quá ngân sách đã chọn (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND).`,
                { toastId: "edit-budget-warning", autoClose: 8000 }
            );
        }

    }, [itinerary, currentHotel, editableData.people, editableData.budget]);

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchTripDetails = async () => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:707', message: 'fetchTripDetails called', data: { tripId, pendingAiChanges, pendingAiChangesRef: pendingAiChangesRef.current }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
            // #endregion
            if (!tripId) return;
            // Don't reset itinerary if we have pending AI changes - use ref to avoid stale closure
            if (pendingAiChangesRef.current) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:712', message: 'fetchTripDetails skipped - pendingAiChangesRef is true', data: { pendingAiChangesRef: pendingAiChangesRef.current }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
                // #endregion
                return;
            }
            setIsLoading(true);
            try {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:718', message: 'fetchTripDetails fetching data', data: { tripId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
                // #endregion
                const response = await axios.get(`/api/trips/${tripId}`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });
                const fetchedTrip = response.data;
                setTripData(fetchedTrip);

                const flattened = flattenItinerary(fetchedTrip.itinerary || []);
                setOriginalItinerary(flattened); // Lưu bản gốc
                // Only set itinerary if we don't have pending AI changes - use ref to avoid stale closure
                if (!pendingAiChangesRef.current) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:729', message: 'fetchTripDetails setting itinerary', data: { flattenedLength: flattened.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
                    // #endregion
                    setItinerary(flattened); // Bản để chỉnh sửa
                    // ✅ THÊM ĐOẠN NÀY để set editableData
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

                    const savedHotelInMetadata = fetchedTrip.metadata?.hotel;
                    const extractedHotelFromItinerary = flattened.extractedHotel;

                    // Ưu tiên khách sạn đã được lưu trong metadata, nếu không có thì dùng cái đã trích xuất
                    const hotelToUse = savedHotelInMetadata || extractedHotelFromItinerary;

                    if (hotelToUse && hotelToUse.name) {
                        // Tìm index của hotel đã lưu trong danh sách options
                        const index = hotelOptions.findIndex(h => h.id === hotelToUse.id);
                        if (index !== -1) {
                            setCurrentHotel(hotelOptions[index]);
                            setHotelIndex(index);
                        } else {
                            // Nếu hotel đã lưu không có trong options (ví dụ: hotel do người dùng tự nhập), 
                            // hiển thị nó và đặt index = -1
                            setCurrentHotel(hotelToUse);
                            setHotelIndex(-1);
                        }
                    } else {
                        setCurrentHotel(null);
                        setHotelIndex(-1);
                    }
                } else {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:733', message: 'fetchTripDetails NOT setting itinerary - pendingAiChangesRef is true', data: { pendingAiChangesRef: pendingAiChangesRef.current }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
                    // #endregion
                }
            } catch (err) {
                setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
                toast.error("Không thể tải dữ liệu chuyến đi!");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTripDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId]); // pendingAiChanges is intentionally excluded - we use pendingAiChangesRef to avoid race conditions

    // Fetch all destinations in province when provinceId changes
    useEffect(() => {
        const fetchProvincePlaces = async () => {
            if (!editableData.provinceId) return;

            try {
                const response = await axios.get(`/api/destinations?province_id=${editableData.provinceId}&top=100`, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` }
                });

                if (Array.isArray(response.data)) {
                    setAllProvincePlaces(response.data.map(p => ({
                        ...p,
                        // [NEW] Đảm bảo entry_fee có giá trị số
                        entry_fee: p.entry_fee || 0,
                    })));
                }
            } catch (err) {
                devLog.error("Failed to fetch province places:", err);
            }
        };

        fetchProvincePlaces();
    }, [editableData.provinceId]);

    // Track itinerary state changes for debugging
    useEffect(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:740', message: 'itinerary state changed', data: { itineraryLength: itinerary.length, itineraryDays: itinerary.map(d => d.day), firstDayPlacesCount: itinerary[0]?.places?.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H4' }) }).catch(() => { });
        // #endregion
    }, [itinerary]);

    // --- DND LOGIC ---
    const getList = useCallback(
        (id) => {
            const dayIndex = itinerary.findIndex((d) => `day-${d.day}` === id);
            return dayIndex !== -1 ? itinerary[dayIndex].places : [];
        },
        [itinerary]
    );

    const onDragEnd = useCallback(
        async (result) => {
            const { source, destination } = result;
            if (!destination) return;

            const sId = source.droppableId;
            const dId = destination.droppableId;

            let newItinerary = [...itinerary];

            if (sId === dId) {
                const dayIndex = newItinerary.findIndex(
                    d => `day-${d.day}` === sId
                );
                if (dayIndex === -1) return;

                const items = reorder(
                    newItinerary[dayIndex].places,
                    source.index,
                    destination.index
                );

                newItinerary[dayIndex] = {
                    ...newItinerary[dayIndex],
                    places: items
                };

                const rebuilt = await rebuildDay(items);
                newItinerary[dayIndex] = {
                    ...newItinerary[dayIndex],
                    places: rebuilt
                };
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

                // ✅ Sử dụng rebuildDay
                const rebuiltSource = await rebuildDay(newItinerary[sourceIndex].places || []);
                const rebuiltDest = await rebuildDay(newItinerary[destIndex].places || []);
                newItinerary[sourceIndex] = { ...newItinerary[sourceIndex], places: rebuiltSource };
                newItinerary[destIndex] = { ...newItinerary[destIndex], places: rebuiltDest };
            }

            setItinerary(newItinerary);
        },
        [itinerary, getList]
    );


    // --- CRUD ITEM LOGIC ---
    const handleUpdateItem = useCallback(async (dayId, uniqueIdToUpdate, changes) => {
        const nextItinerary = itinerary.map(dayPlan => {
            if (`day-${dayPlan.day}` !== dayId) return dayPlan;
            const updatedPlaces = dayPlan.places.map(item => {
                if (item.uniqueId !== uniqueIdToUpdate) return item;
                const patched = { ...item, ...changes };
                // ✅ Clamp duration
                if ('duration' in changes) patched.duration = clampDuration(item, changes.duration);
                // ✅ Auto-format time_slot
                if ('time_slot' in changes && typeof changes.time_slot === 'string' && changes.time_slot.length === 5) {
                    patched.time_slot = `${changes.time_slot}:00`;
                }
                return patched;
            });
            return { ...dayPlan, places: updatedPlaces };
        });

        const dayIndex = nextItinerary.findIndex(d => `day-${d.day}` === dayId);
        if (dayIndex !== -1) {
            // ✅ Sử dụng rebuildDay
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

        // ✅ Rebuild tất cả các ngày
        const rebuiltDays = await Promise.all(
            nextItinerary.map(async d => ({
                ...d,
                places: await rebuildDay(d.places || [])
            }))
        );

        setItinerary(rebuiltDays);
        toast.success("Đã xóa địa điểm khỏi lịch trình"); // ✅ Toast
    }, [itinerary]);

    const handleAddItem = useCallback((day, type) => {
        // Mở form chọn địa điểm thay vì thêm trống
        setShowDestinationPicker({ dayNumber: day, type: type });
    }, []);

    // Hàm mới để xử lý khi user chọn địa điểm từ form
    const handleSelectDestination = useCallback(async (selectedPlace) => {
        console.log('✅ Selected place:', selectedPlace);
        console.log('📝 Category:', selectedPlace.category); // ✅ LOG NÀY
        if (!showDestinationPicker) return;

        const { dayNumber, type } = showDestinationPicker;
        const nextItinerary = [...itinerary];
        const dayIndex = nextItinerary.findIndex(d => d.day === dayNumber);

        if (dayIndex === -1) {
            setShowDestinationPicker(null);
            return;
        }

        // Validation
        const limits = validateDailyLimits(nextItinerary[dayIndex].places || []);
        if (type === 'destination' && !limits.canAddDestination) {
            toast.warning('Mỗi ngày chỉ tối đa 4 địa điểm.');
            setShowDestinationPicker(null);
            return;
        }
        if (type === 'food' && !limits.canAddFood) {
            toast.warning('Mỗi ngày chỉ tối đa 3 điểm ăn uống.');
            setShowDestinationPicker(null);
            return;
        }

        // --- BỔ SUNG LOGIC KIỂM TRA TRÙNG LẶP ĐỊA ĐIỂM (MỚI) ---
        const isSightseeing = type === 'destination' || (selectedPlace.category && selectedPlace.category !== 'Ăn uống');
        const placeIdToCheck = selectedPlace.id;

        if (isSightseeing && placeIdToCheck) {
            // Kiểm tra trong TOÀN BỘ lịch trình (tất cả các ngày)
            const isDuplicate = itinerary.some(dayPlan =>
                (dayPlan.places || []).some(item =>
                    item.id === placeIdToCheck &&
                    item.category !== 'Ăn uống' &&
                    item.category !== 'Di chuyển'
                )
            );

            if (isDuplicate) {
                toast.error(`❌ Địa điểm "${selectedPlace.name}" đã có trong lịch trình! Vui lòng chọn địa điểm khác.`, { autoClose: 5000 });
                setShowDestinationPicker(null);
                return; // DỪNG LẠI, KHÔNG THÊM ĐỊA ĐIỂM
            }
        }

        const newUniqueId = `new-item-${Date.now()}-${Math.floor(Math.random() * 100)}`;

        const newItem = {
            uniqueId: newUniqueId,
            id: selectedPlace.id,
            name: selectedPlace.name,
            // ✅ LẤY CATEGORY TỪ PLACE ĐÃ CHỌN
            category: type === 'food'
                ? 'Ăn uống'
                : (selectedPlace.category || 'Địa điểm'), // Mặc định là 'Địa điểm' nếu không có
            duration: type === 'food' ? 45 : 60,
            day: dayNumber,
            time_slot: null,
            lat: selectedPlace.lat || selectedPlace.latitude,
            lon: selectedPlace.lon || selectedPlace.longitude,
            // [NEW] Thêm entry_fee
            entry_fee: selectedPlace.entry_fee || 0,
        };

        // --- BỔ SUNG LOGIC KIỂM TRA CHI PHÍ NGAY TẠI ĐÂY ---
        const maxBudget = extractMaxBudget(editableData.budget);

        if (maxBudget > 0 && editableData.people && editableData.budget) {

            // Tạo một itinerary TẠM THỜI với item mới được thêm vào
            const tempItinerary = deepCloneItinerary(itinerary); // Sử dụng deepCloneItinerary an toàn
            tempItinerary[dayIndex].places.push(newItem);

            // Lấy danh sách places có phí từ itinerary TẠM THỜI
            const placesWithCostTemp = extractPlacesForCostCalculation(tempItinerary, currentHotel);

            const currentDurationLength = tempItinerary.length;
            const durationString = getDurationStringFromLength(currentDurationLength);

            const totalCostAfterAdd = calculateTotalCost(
                placesWithCostTemp,
                currentHotel,
                durationString,
                editableData.people
            );

            if (totalCostAfterAdd > maxBudget) {
                // ❌ NGĂN CHẶN THÊM VÀ HIỂN THỊ CẢNH BÁO
                const budgetMsg = new Intl.NumberFormat('vi-VN').format(maxBudget);
                const costMsg = new Intl.NumberFormat('vi-VN').format(totalCostAfterAdd);

                toast.error(
                    `❌ ĐỊA ĐIỂM NÀY VƯỢT QUÁ NGÂN SÁCH! Chi phí ước tính sau khi thêm (${costMsg} VND) vượt quá ngân sách (${budgetMsg} VND). Vui lòng điều chỉnh ngân sách hoặc chọn địa điểm khác.`,
                    { autoClose: 10000, toastId: "add-place-over-budget" }
                );
                setShowDestinationPicker(null);
                return; // DỪNG LẠI, KHÔNG THÊM ĐỊA ĐIỂM VÀO ITINERARY
            }
        }
        // --- KẾT THÚC LOGIC KIỂM TRA CHI PHÍ TỨC THỜI ---

        nextItinerary[dayIndex] = {
            ...nextItinerary[dayIndex],
            places: [...(nextItinerary[dayIndex].places || []), newItem]
        };

        nextItinerary[dayIndex] = {
            ...nextItinerary[dayIndex],
            places: [...(nextItinerary[dayIndex].places || []), newItem]
        };

        // Rebuild
        const rebuilt = await rebuildDay(nextItinerary[dayIndex].places || []);
        nextItinerary[dayIndex] = { ...nextItinerary[dayIndex], places: rebuilt };

        setItinerary(nextItinerary);
        setShowDestinationPicker(null);
        toast.success(`Đã thêm ${newItem.name} vào Ngày ${dayNumber}`);
    }, [showDestinationPicker, itinerary, editableData, currentHotel]);

    const handleMetadataChange = useCallback((field, value) => {
        setEditableData(prev => ({ ...prev, [field]: value }));
    }, []);

    // --- HÀM LƯU DỮ LIỆU CHÍNH ---
    const handleSave = async () => {
        if (!tripData) return;
        const maxBudget = extractMaxBudget(editableData.budget);
        if (maxBudget > 0 && currentTotalCost > maxBudget) {
            toast.error(`Không thể LƯU: Tổng chi phí ước tính (${new Intl.NumberFormat('vi-VN').format(currentTotalCost)} VND) vượt quá Ngân sách tối đa (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND). Vui lòng điều chỉnh Ngân sách hoặc xóa bớt địa điểm.`, { autoClose: 8000 });
            setIsSaving(false);
            return; // NGĂN CHẶN LƯU
        }
        const { name, startDate, people, budget } = editableData;
        // ✅ Lấy duration từ itinerary.length thực tế
        const actualDuration = itinerary.length;

        console.log('💾 [EditTripPage] Saving with:');
        console.log('   - Actual Duration:', actualDuration);
        console.log('   - Itinerary days:', itinerary.length);

        if (!name?.trim() || !startDate || actualDuration <= 0) {
            toast.error('Vui lòng đảm bảo các trường Tên, Ngày, Thời lượng hợp lệ.');
            return;
        }

        setIsSaving(true);
        setError(null);

        const loadingToast = toast.info('Đang lưu thay đổi...', { autoClose: false });

        try {
            // 1. ✅ Lưu Metadata với ACTUAL duration
            const metadataPayload = {
                name: name,
                duration: actualDuration, // ✅ Dùng actualDuration
                start_date: startDate,
                metadata: {
                    people: people,
                    budget: budget,
                    hotel: currentHotel,
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

            // ✅ Cập nhật editableData.duration
            setEditableData(prev => ({ ...prev, duration: actualDuration }));

            // ✅ Navigate với force reload
            setTimeout(() => {
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

    // --- AI evaluate handler ---
    const handleAIEvaluate = async () => {
        if (!tripData) return;
        setAiLoading(true);
        setAiResult(null);
        setShowAIModal(false);
        try {

            const evaluationInstructions = `You are a Professional Travel Guide with 30 years of experience. Evaluate the itinerary and provide detailed day-by-day suggestions with complete timeline (8:00-17:00). Return ONLY a single, valid JSON object with this structure:\n{ "score": 0-100, "decision": "accept|adjust|reorder|add_days|balance", "summary": "3-5 sentences like an experienced tour guide", "suggestions": ["Day 1: 08:00-10:00 - [Activity] - [Tips]", "Day 1: 12:30-13:00 - Ăn trưa - 30 phút", ...], "details_per_day": [...], "optimized_itinerary": [...] }\n- suggestions MUST be detailed day-by-day with time ranges (8:00-17:00)\n- Each suggestion format: "Day X: HH:MM-HH:MM - [Activity Name] - [Description/Tips]"\n- Provide suggestions for ALL days in the itinerary\n- Respond in English and avoid adding extra text outside the JSON.`;

            const payload = {
                original_itinerary: restoreItinerary(originalItinerary),
                edited_itinerary: restoreItinerary(itinerary),
                context: { tripId: tripId, tripName: tripData?.name || null },
                evaluation_instructions: evaluationInstructions,
            };


            const res = await axios.post("/api/ai/evaluate_itinerary", payload, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });


            if (res.data && res.data.ok && res.data.result) {
                const result = res.data.result;

                // Ensure suggestions exist and is an array
                if (!Array.isArray(result.suggestions)) {
                    devLog.warn("AI result missing suggestions array, initializing empty array");
                    result.suggestions = [];
                }


                setAiResult(result);
            } else if (res.data && res.data.result) {
                const result = res.data.result;
                if (!Array.isArray(result.suggestions)) {
                    result.suggestions = [];
                }
                setAiResult(result);
            } else {
                const raw =
                    res.data && res.data.error ? res.data.error : "No response from AI";
                setAiResult({
                    raw: typeof raw === "string" ? raw : JSON.stringify(raw, null, 2),
                    suggestions: [], // Ensure suggestions exists even for error case
                });
            }
            setShowAIModal(true);
        } catch (err) {
            devLog.error("AI evaluate error", err);
            const respData = err?.response?.data;
            const rawErr = respData
                ? typeof respData === "string"
                    ? respData
                    : JSON.stringify(respData, null, 2)
                : err.message || String(err);
            setAiResult({
                raw: rawErr,
                suggestions: [], // Ensure suggestions exists even for error case
            });
            setShowAIModal(true);
        } finally {
            setAiLoading(false);
        }
    };

    // --- AI reorder handler: ask backend to produce a suggested ordering and apply it to UI
    // eslint-disable-next-line no-unused-vars
    const handleAIReorder = async () => {
        if (!tripData) return;
        setAiLoading(true);
        try {
            const evaluationInstructions = `You are a professional travel assistant. Analyze and return a re-ordered itinerary optimized to reduce travel time, balance activities across days, and avoid empty days. If you cannot, provide an explanation. Return either a JSON object with the key 'suggested_itinerary' containing the array of day objects, or return the array directly. Respond in English and return ONLY valid JSON.`;

            const payload = {
                original_itinerary: restoreItinerary(originalItinerary),
                edited_itinerary: restoreItinerary(itinerary),
                context: { tripId: tripId, tripName: tripData?.name || null },
                evaluation_instructions: evaluationInstructions,
            };

            const res = await axios.post("/api/ai/reorder_itinerary", payload, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });

            if (res.data && res.data.ok && res.data.result) {
                const suggested =
                    res.data.result.suggested_itinerary || res.data.result;
                if (Array.isArray(suggested) && suggested.length > 0) {
                    const flattened = flattenItinerary(suggested);
                    setItinerary(flattened);
                    setShowAIModal(false);
                    alert("AI suggested reorder has been applied to the itinerary.");
                } else if (res.data.result && res.data.result.raw) {
                    alert(summarizeRaw(res.data.result.raw));
                } else {
                    alert("AI did not return a valid suggested itinerary.");
                }
            } else if (res.data && res.data.result && res.data.result.raw) {
                alert(summarizeRaw(res.data.result.raw));
            } else {
                alert("Error: unable to get AI suggestion.");
            }
        } catch (err) {
            devLog.error("AI reorder error", err);
            const msg = err?.response?.data
                ? JSON.stringify(err.response.data)
                : err.message || String(err);
            alert("AI reorder failed: " + (msg || "Unknown error"));
        } finally {
            setAiLoading(false);
        }
    };

    // Apply AI suggestions (if evaluation returned a suggested itinerary) or request reorder then apply
    const handleApplyAISuggestions = async () => {
        if (!tripData || !itinerary || itinerary.length === 0) {
            alert("Không thể áp dụng: Lịch trình hiện tại không hợp lệ.");
            return;
        }

        setAiLoading(true);
        const backupItinerary = deepCloneItinerary(itinerary); // Backup for rollback


        try {
            // Snapshot current itinerary so user can revert if needed
            setPreAiItinerary(backupItinerary);

            let aiItineraryToApply = null;

            // If AI evaluation already provided an optimized_itinerary, use it
            if (
                aiResult &&
                aiResult.optimized_itinerary &&
                Array.isArray(aiResult.optimized_itinerary) &&
                aiResult.optimized_itinerary.length > 0
            ) {

                const mapped = mapOptimizedToFrontend(aiResult.optimized_itinerary, backupItinerary);


                if (validateItinerary(mapped)) {
                    aiItineraryToApply = mapped;
                }
            }
            // If AI evaluation provided suggested_itinerary (older format), normalize then use
            else if (
                aiResult &&
                aiResult.suggested_itinerary &&
                Array.isArray(aiResult.suggested_itinerary) &&
                aiResult.suggested_itinerary.length > 0
            ) {
                const normalized = normalizeAndFillSuggested(aiResult.suggested_itinerary);
                if (validateItinerary(normalized)) {
                    aiItineraryToApply = normalized;
                }
            }
            // Otherwise ask the reorder endpoint
            else {

                const evaluationInstructions = `You are a professional travel assistant. Analyze and return a re-ordered itinerary optimized to reduce travel time, balance activities across days, and avoid empty days. Return a JSON object with the key 'optimized_itinerary' containing the array of day objects. Each day object must have: { "day": number, "items": [ { "id": string|null, "name": string, "type": "sightseeing|food|rest|hotel|move", "lat": number|null, "lng": number|null, "start_time": "HH:MM", "duration_min": number } ] }. Respond in English and return ONLY valid JSON.`;

                const payload = {
                    original_itinerary: restoreItinerary(originalItinerary),
                    edited_itinerary: restoreItinerary(itinerary),
                    context: { tripId: tripId, tripName: tripData?.name || null },
                    evaluation_instructions: evaluationInstructions,
                };

                const res = await axios.post("/api/ai/reorder_itinerary", payload, {
                    headers: { Authorization: `Bearer ${getAuthToken()}` },
                });


                if (res.data && res.data.ok && res.data.result) {
                    setAiResult(res.data.result);
                    const optimized =
                        res.data.result.optimized_itinerary ||
                        res.data.result.suggested_itinerary ||
                        res.data.result;


                    if (Array.isArray(optimized) && optimized.length > 0) {
                        if (res.data.result.optimized_itinerary) {
                            const mapped = mapOptimizedToFrontend(res.data.result.optimized_itinerary, backupItinerary);


                            if (validateItinerary(mapped)) {
                                aiItineraryToApply = mapped;
                            }
                        } else {
                            const normalized = normalizeAndFillSuggested(optimized);


                            if (validateItinerary(normalized)) {
                                aiItineraryToApply = normalized;
                            }
                        }
                    }
                }
            }

            // Validate and apply AI itinerary

            if (!aiItineraryToApply || !validateItinerary(aiItineraryToApply)) {

                // Rollback: restore backup
                setItinerary(backupItinerary);
                setPreAiItinerary(null);
                alert("Không thể áp dụng: Dữ liệu AI không hợp lệ. Lịch trình đã được khôi phục.");
                return;
            }


            // REPLACE entire itinerary with AI optimized itinerary (not merge)
            // This ensures the AI suggestions are applied exactly as suggested, in the correct time order
            let replacedItinerary = deepCloneItinerary(aiItineraryToApply);

            // Remove duplicate places: each sightseeing place should appear only once
            const seenPlaceIds = new Set();
            const seenPlaceNames = new Set();

            replacedItinerary = replacedItinerary.map((dayPlan) => {
                const uniquePlaces = [];
                const places = dayPlan.places || [];

                places.forEach((place) => {
                    const placeId = place.id || null;
                    const placeName = (place.name || "").toLowerCase().trim();
                    const isSightseeing = place.category !== "Ăn uống" &&
                        place.category !== "Di chuyển" &&
                        place.category !== "Nghỉ ngơi" &&
                        place.type !== "food" &&
                        place.type !== "move" &&
                        place.type !== "rest";

                    if (isSightseeing) {
                        // Check for duplicates by id or name
                        const isDuplicate = (placeId && seenPlaceIds.has(placeId)) ||
                            (placeName && seenPlaceNames.has(placeName));

                        if (!isDuplicate) {
                            if (placeId) seenPlaceIds.add(placeId);
                            if (placeName) seenPlaceNames.add(placeName);
                            uniquePlaces.push(place);
                        } else {
                            devLog.warn(`Removing duplicate place: ${place.name} (id: ${placeId})`);
                        }
                    } else {
                        // Non-sightseeing items (food/rest/move) can appear multiple times
                        uniquePlaces.push(place);
                    }
                });

                return {
                    ...dayPlan,
                    places: uniquePlaces,
                };
            });

            // Ensure we have all days from original (fill missing days if any)
            if (replacedItinerary.length < itinerary.length) {
                devLog.warn("AI itinerary has fewer days than original. Filling missing days.");
                const aiDaysSet = new Set(replacedItinerary.map(d => d.day || 0));
                const missingDays = itinerary.filter(d => !aiDaysSet.has(d.day || 0));
                missingDays.forEach(day => {
                    replacedItinerary.push({
                        day: day.day || 0,
                        places: [], // Empty day
                    });
                });
                replacedItinerary.sort((a, b) => (a.day || 0) - (b.day || 0));
            }

            // Final validation before applying
            if (!validateItinerary(replacedItinerary)) {
                setItinerary(backupItinerary);
                setPreAiItinerary(null);
                alert("Không thể áp dụng: Lịch trình từ AI không hợp lệ. Lịch trình đã được khôi phục.");
                return;
            }


            // Apply: flatten, recalculate time slots, then set state
            // Note: recalculateTimeSlots will apply time slots in order, so AI's start_time will be respected
            const flattened = flattenItinerary(replacedItinerary);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1174', message: 'Before recalculateTimeSlots', data: { flattenedLength: flattened.length, firstDayPlaces: flattened[0]?.places?.map(p => ({ name: p.name, start_time: p.start_time, time_slot: p.time_slot })) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
            // #endregion

            const enhanced = recalculateTimeSlots(flattened);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1180', message: 'After recalculateTimeSlots', data: { enhancedLength: enhanced.length, firstDayPlaces: enhanced[0]?.places?.map(p => ({ name: p.name, start_time: p.start_time, time_slot: p.time_slot })) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
            // #endregion


            // Final check: ensure enhanced is valid
            if (!validateItinerary(enhanced)) {

                setItinerary(backupItinerary);
                setPreAiItinerary(null);
                alert("Không thể áp dụng: Lỗi khi tính toán thời gian. Lịch trình đã được khôi phục.");
                return;
            }

            // Success: apply the changes
            // Set pendingAiChanges FIRST to prevent fetchTripDetails from resetting
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1190', message: 'About to apply AI suggestions', data: { enhancedLength: enhanced.length, enhancedDays: enhanced.map(d => d.day) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
            // #endregion

            // Update ref FIRST (synchronous) to prevent race condition
            pendingAiChangesRef.current = true;
            setPendingAiChanges(true);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1196', message: 'pendingAiChangesRef set to true, about to setItinerary', data: { pendingAiChangesRef: pendingAiChangesRef.current }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
            // #endregion

            setItinerary(enhanced);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1201', message: 'setItinerary called with enhanced', data: { enhancedLength: enhanced.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H4' }) }).catch(() => { });
            // #endregion

            setShowAIModal(false);

            // Force UI update
            setTimeout(() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'EditTripPage.js:1208', message: 'Force UI update - resize event dispatched', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H4' }) }).catch(() => { });
                // #endregion
                window.dispatchEvent(new Event('resize'));
            }, 100);

        } catch (err) {
            devLog.error("Apply AI suggestions error", err);
            // Rollback on error
            setItinerary(backupItinerary);
            setPreAiItinerary(null);
            const msg = err?.response?.data
                ? JSON.stringify(err.response.data)
                : err.message || String(err);
            alert("Lỗi khi áp dụng gợi ý AI: " + (msg || "Unknown error") + "\nLịch trình đã được khôi phục.");
        } finally {
            setAiLoading(false);
        }
    };

    // --- RENDER ---
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

    const HotelCard = () => {

        // Nút chung để kích hoạt việc chọn/thay đổi
        const ChangeButton = ({ currentHotel }) => (
            <button
                // Gọi hàm chọn khách sạn mới
                onClick={handleSelectNewHotel}
                className="hotel-change-btn"
                title={currentHotel ? "Chọn khách sạn khác" : "Chọn Khách sạn"}
                style={{
                    padding: '8px 12px',
                    backgroundColor: currentHotel ? '#10b981' : '#f97316',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    flexShrink: 0
                }}
            >
                {/* Sử dụng FaRedo (reload) */}
                <FaRedo style={{ marginRight: currentHotel ? 6 : 0 }} />
                {currentHotel ? 'Thay đổi' : 'Chọn ngay'}
            </button>
        );

        // Trường hợp 1: Chưa chọn khách sạn
        if (!currentHotel) {
            return (
                <div className="hotel-selection-container" style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                        <FaHotel style={{ marginRight: 8, color: '#6366f1' }} />
                        Khách sạn/Lưu trú
                    </label>
                    <div className="hotel-info-card empty-card" style={{ justifyContent: 'space-between', background: '#fef3f3' }}>
                        <span style={{ color: '#ef4444', fontWeight: 500 }}>
                            Chưa chọn nơi ở chính.
                        </span>
                        <ChangeButton currentHotel={null} />
                    </div>
                </div>
            );
        }

        // Trường hợp 2: Đã chọn khách sạn (Dạng thẻ nhỏ gọn)
        return (
            <div className="hotel-selection-container" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                    <FaHotel style={{ marginRight: 8, color: '#6366f1' }} />
                    Khách sạn/Lưu trú
                </label>
                <div
                    className="hotel-info-card selected-card"
                    // Thêm onClick để xem chi tiết
                    onClick={handleViewHotelDetails}
                    style={{
                        justifyContent: 'space-between',
                        padding: '12px',
                        border: '1px solid #10b981',
                        borderRadius: 8,
                        cursor: 'pointer',
                        backgroundColor: '#ecfdf5',
                    }}
                >
                    <div className="hotel-details" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FaHotel size={24} style={{ color: '#059669', flexShrink: 0 }} />
                        <div className="hotel-text">
                            <span className="hotel-name" style={{ fontWeight: 600, fontSize: '1rem', color: '#047857' }}>
                                {currentHotel.name}
                            </span>
                            {/* Chỉ hiện rating/thông báo click, loại bỏ địa chỉ */}
                            <span style={{ fontSize: '0.75rem', color: '#065f46', display: 'block' }}>
                                {currentHotel.rating ? `⭐ ${currentHotel.rating} / 5.0 | ` : ''}
                                {currentHotel.entry_fee ? `Giá/Đêm: ${new Intl.NumberFormat('vi-VN').format(currentHotel.entry_fee)} VND | ` : ''}
                                Click để xem chi tiết
                            </span>
                        </div>
                    </div>

                    {/* Nút Thay đổi độc lập, ngăn chặn sự kiện click lan truyền */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <ChangeButton currentHotel={currentHotel} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="edit-trip-container">
            {/* AI evaluating overlay */}
            {aiLoading && !showAIModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9998,
                    }}
                >
                    <div
                        style={{
                            background: "#fff",
                            padding: 24,
                            borderRadius: 8,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                            textAlign: "center",
                            minWidth: 300,
                        }}
                    >
                        <div
                            className="loading-spinner"
                            style={{ margin: "8px auto 12px" }}
                        />
                        <div style={{ fontSize: 16, fontWeight: 600 }}>
                            AI is evaluating...
                        </div>
                        <div style={{ marginTop: 8, color: "#666" }}>
                            Please wait — this may take a few seconds.
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="edit-trip-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Quay lại
                </button>
                <h1 className="trip-title">
                    ✏️ {tripData?.name || "Loading"}
                </h1>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button onClick={() => setShowOriginalOverlay(true)} className="save-btn">
                        <FaSave /> Xác nhận & So sánh
                    </button>
                    <button
                        type="button"
                        className="ai-evaluate-btn"
                        onClick={handleAIEvaluate}
                        disabled={aiLoading}
                    >
                        {aiLoading ? "Reviewing..." : "AI Review"}
                    </button>

                    {/* Gear button to view the last AI evaluation (clickable even if no result) */}
                    <button
                        type="button"
                        className="ai-view-last-btn"
                        onClick={() => setShowAIModal(true)}
                        disabled={aiLoading}
                        title={
                            aiResult ? "Xem đánh giá AI gần nhất" : "Chưa có đánh giá AI"
                        }
                        style={{
                            padding: 8,
                            width: 36,
                            height: 36,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 18,
                            border: "1px solid #ddd",
                            background: "#fff",
                        }}
                    >
                        <FaCog />
                    </button>
                </div>
            </div>

            {/* Pending AI changes banner */}
            {pendingAiChanges && (
                <div
                    style={{
                        background: "#fff8e6",
                        border: "1px solid #ffd66b",
                        padding: 12,
                        borderRadius: 8,
                        margin: "12px 0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ fontSize: 14 }}>
                        AI changes have been applied to the editable itinerary. Review them
                        on the right, then Save to persist or Revert to undo.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={handleRevertAIChanges}
                            style={{ padding: "8px 12px" }}
                        >
                            Revert
                        </button>
                    </div>
                </div>
            )}

            {/* ========== METADATA FORM ========== */}
            <div className="edit-trip-metadata-form">
                <h2>⚙️ Thiết lập kế hoạch chuyến đi</h2>
                <div className="metadata-grid">
                    <div className="edit-trip-input-group">
                        <label>Tên chuyến đi</label>
                        <input
                            type="text"
                            value={editableData.name}
                            onChange={(e) => handleMetadataChange('name', e.target.value)}
                            placeholder="Tên chuyến đi"
                        />
                    </div>

                    <div className="edit-trip-input-group">
                        <label>Ngày xuất phát</label>
                        <input
                            type="date"
                            value={editableData.startDate}
                            onChange={(e) => handleMetadataChange('startDate', e.target.value)}
                        />
                    </div>

                    <div className="edit-trip-input-group">
                        <label>Thời lượng (Ngày)</label>
                        <input
                            type="text"
                            value={itinerary.length}
                            disabled={true}
                            className="disabled-input"
                            title="Thời lượng được điều chỉnh bằng nút 'Tăng thêm 1 Ngày' hoặc 'Xóa ngày'"
                        />
                    </div>

                    <div className="edit-trip-input-group">
                        <label>Số người</label>
                        <select
                            value={editableData.people}
                            onChange={(e) => handleMetadataChange('people', e.target.value)}
                        >
                            <option value="">Chọn số lượng</option>
                            {peopleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <div className="edit-trip-input-group">
                        <label>Ngân sách</label>
                        <select
                            value={editableData.budget}
                            onChange={(e) => handleMetadataChange('budget', e.target.value)}
                        >
                            <option value="">Chọn ngân sách</option>
                            {budgetOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <div className="edit-trip-input-group">
                        <label>&nbsp;</label>
                        <button onClick={handleRegenerateFull} className="regenerate-btn" disabled={isSaving || (extractMaxBudget(editableData.budget) > 0 && currentTotalCost > extractMaxBudget(editableData.budget))}>
                            <FaRedo /> TÁI TẠO LỊCH TRÌNH MỚI
                        </button>
                    </div>

                    <div className="edit-trip-input-group">
                        <label>&nbsp;</label>
                        <button onClick={handleExtendTrip} className="extend-btn" disabled={isSaving}>
                            <FaCalendarPlus /> Tăng thêm 1 Ngày
                        </button>
                    </div>
                </div>
            </div>

            {/* [NEW] Ngân sách & Chi phí ước tính */}
            <div className="edit-trip-metadata-form" style={{ marginTop: '1rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>💰 Ngân sách & Chi phí ước tính</h2>
                {editableData.people && editableData.budget && currentTotalCost >= 0 ? (
                    <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#fcfcfc' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: '#333' }}>
                            Chi phí ước tính:
                            <span
                                style={{ marginLeft: '10px', fontSize: '1.1rem' }}
                                className={
                                    extractMaxBudget(editableData.budget) > 0 && currentTotalCost > extractMaxBudget(editableData.budget)
                                        ? "cost-warning-text" // Cần tạo class này trong CSS
                                        : "cost-normal-text"
                                }
                            >
                                {new Intl.NumberFormat('vi-VN').format(currentTotalCost)} VND
                            </span>
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#666' }}>
                            (Ngân sách tối đa: {new Intl.NumberFormat('vi-VN').format(extractMaxBudget(editableData.budget))} VND)
                        </p>
                        {extractMaxBudget(editableData.budget) > 0 && currentTotalCost > extractMaxBudget(editableData.budget) && (
                            <p style={{ margin: '8px 0 0', color: '#dc2626', fontWeight: 600 }}>
                                ⚠️ Chi phí đang vượt quá Ngân sách đã đặt.
                            </p>
                        )}
                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#999' }}>
                            * Chi phí này bao gồm phí tham quan/hoạt động ($/người) và phí khách sạn ($/phòng/tổng số đêm).
                        </p>
                    </div>
                ) : (
                    <p style={{ color: '#999' }}>Vui lòng chọn Số người và Ngân sách để xem ước tính chi phí.</p>
                )}
            </div>

            <hr className="separator" />


            <HotelCard />

            {/* Main Content: Single Column - Editable Only */}
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="editable-column" style={{ maxHeight: 'none' }}>
                    <div className="column-header">
                        <h2>✏️ Chỉnh sửa lịch trình</h2>
                        <p className="subtitle">Kéo thả để sắp xếp lại, thêm/xóa địa điểm</p>
                    </div>

                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="days-list">
                            {itinerary.map((dayPlan) => {
                                const isOpen = openDays.has(dayPlan.day); // ✅ Kiểm tra ngày có đang mở không

                                return (
                                    <div key={`edit-${dayPlan.day}`} className="day-section editable">
                                        {/* HEADER - Luôn hiển thị */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: isOpen ? '1rem' : 0, // ✅ Bỏ margin khi đóng
                                                cursor: 'pointer',
                                                padding: '0.75rem',
                                                background: isOpen ? 'transparent' : '#f9fafb',
                                                borderRadius: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => toggleDayOpen(dayPlan.day)} // ✅ Click để toggle
                                        >
                                            <h3 className="day-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {/* ✅ Icon dropdown */}
                                                <span style={{
                                                    transition: 'transform 0.2s',
                                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                                                }}>
                                                    ❯
                                                </span>
                                                Ngày {dayPlan.day}
                                                {/* ✅ Hiển thị số lượng địa điểm */}
                                                <span style={{
                                                    fontSize: '0.875rem',
                                                    color: '#64748b',
                                                    fontWeight: 400
                                                }}>
                                                    ({dayPlan.places.length} địa điểm)
                                                </span>
                                            </h3>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // ✅ Không trigger toggle khi xóa
                                                    handleDeleteDay(dayPlan.day);
                                                }}
                                                className="delete-day-btn"
                                                disabled={isSaving || itinerary.length <= 1}
                                                title={itinerary.length <= 1 ? "Không thể xóa ngày cuối cùng" : "Xóa ngày này"}
                                            >
                                                <FaTrash /> Xóa ngày
                                            </button>
                                        </div>

                                        {/* CONTENT - Chỉ hiển thị khi mở */}
                                        {isOpen && (
                                            <>
                                                <Droppable droppableId={`day-${dayPlan.day}`}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={`droppable-area ${snapshot.isDraggingOver ? "dragging-over" : ""}`}
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
                                                        onClick={() => handleAddItem(dayPlan.day, "destination")}
                                                        className="add-btn destination"
                                                    >
                                                        <FaPlus /> Địa điểm
                                                    </button>
                                                    <button
                                                        onClick={() => handleAddItem(dayPlan.day, "food")}
                                                        className="add-btn lunch"
                                                    >
                                                        <FaPlus /> Ăn uống
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </DragDropContext>
                </div>
            </div>

            {/* Compare Original & Edited Overlay */}
            {showOriginalOverlay && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div
                        className="compare-modal"
                        style={{
                            background: 'white',
                            borderRadius: '20px',
                            maxWidth: '1400px',
                            width: '95%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '2rem',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2>🔍 Lịch trình: Bản Gốc vs Bản Chỉnh sửa</h2>
                            <button onClick={() => setShowOriginalOverlay(false)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* LEFT: Original */}
                            <div className="original-column" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                                <div className="column-header">
                                    <h2>📋 Lịch trình gốc</h2>
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
                                                            <FaClock /> {item.time_slot || "N/A"}
                                                        </div>
                                                        <div className="place-info">
                                                            <span className="place-icon">
                                                                {item.category === "Ăn uống" || item.id === "LUNCH" ? "🍽️" :
                                                                    item.category === "Di chuyển" || item.id === "TRAVEL" ? "✈️" : "📍"}
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

                            {/* RIGHT: Edited */}
                            <div className="editable-column" style={{ maxHeight: '70vh', overflow: 'auto', background: '#f0fdf4' }}>
                                <div className="column-header">
                                    <h2>✅ Lịch trình đã chỉnh sửa</h2>
                                    <p className="subtitle">Phiên bản mới của bạn</p>
                                </div>
                                <div className="days-list">
                                    {itinerary.map((dayPlan) => (
                                        <div key={`compare-${dayPlan.day}`} className="day-section editable">
                                            <h3 className="day-title">Ngày {dayPlan.day}</h3>
                                            <div className="places-list">
                                                {dayPlan.places.map((item, index) => (
                                                    <div key={index} className="place-item-readonly">
                                                        <div className="time-badge">
                                                            <FaClock /> {item.time_slot || "N/A"}
                                                        </div>
                                                        <div className="place-info">
                                                            <span className="place-icon">
                                                                {item.category === "Ăn uống" ? "🍽️" :
                                                                    item.category === "Di chuyển" ? "✈️" : "📍"}
                                                            </span>
                                                            <span className="place-name">{item.name}</span>
                                                            <span className="place-category">({item.category})</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                onClick={() => {
                                    setItinerary(originalItinerary);
                                    setShowOriginalOverlay(false);
                                    toast.info('Đã hoàn tác tất cả thay đổi');
                                }}
                                className="btn-cancel"
                                style={{ padding: '12px 24px', fontSize: '1rem' }}
                            >
                                ❌ Hủy thay đổi
                            </button>
                            <button
                                onClick={async () => {
                                    await handleSave();
                                    setShowOriginalOverlay(false);
                                }}
                                className="save-btn"
                                disabled={isSaving || (extractMaxBudget(editableData.budget) > 0 && currentTotalCost > extractMaxBudget(editableData.budget))}
                                style={{ padding: '12px 24px', fontSize: '1rem' }}
                            >
                                <FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Result Modal */}
            {showAIModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 16,
                    }}
                    className="ai-modal-backdrop"
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 8,
                            maxWidth: 940,
                            width: "100%",
                            maxHeight: "85vh",
                            overflow: "auto",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        }}
                        className="ai-modal"
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "12px 16px",
                                borderBottom: "1px solid #eee",
                            }}
                        >
                            <h3 style={{ margin: 0 }}>AI Evaluation</h3>
                        </div>

                        <div style={{ padding: 16 }} className="ai-modal-body">
                            {aiResult ? (
                                aiResult.raw || typeof aiResult === "string" ? (
                                    <div
                                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                                    >
                                        <strong>Message:</strong>
                                        <div style={{ marginTop: 8 }}>
                                            {summarizeRaw(aiResult.raw || aiResult)}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: "auto" }}>
                                        <table
                                            style={{ width: "100%", borderCollapse: "collapse" }}
                                        >
                                            <tbody>
                                                <tr>
                                                    <th
                                                        style={{
                                                            textAlign: "left",
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                            width: 180,
                                                        }}
                                                    >
                                                        Score
                                                    </th>
                                                    <td
                                                        style={{
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 12,
                                                        }}
                                                    >
                                                        <strong style={{ fontSize: 18 }}>
                                                            {aiResult.score ?? "-"}
                                                        </strong>
                                                        <span
                                                            style={{
                                                                padding: "4px 8px",
                                                                borderRadius: 12,
                                                                background: getRatingColor(aiResult.score),
                                                                fontSize: 12,
                                                                color: "#111",
                                                                border: "1px solid rgba(0,0,0,0.06)",
                                                            }}
                                                        >
                                                            {getRatingLabel(aiResult.score)}
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th
                                                        style={{
                                                            textAlign: "left",
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                        }}
                                                    >
                                                        Decision
                                                    </th>
                                                    <td
                                                        style={{
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                        }}
                                                    >
                                                        {aiResult.decision ?? "-"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th
                                                        style={{
                                                            textAlign: "left",
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                            verticalAlign: "top",
                                                        }}
                                                    >
                                                        Summary
                                                    </th>
                                                    <td
                                                        style={{
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                        }}
                                                    >
                                                        {aiResult.summary ?? "-"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th
                                                        style={{
                                                            textAlign: "left",
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                            verticalAlign: "top",
                                                        }}
                                                    >
                                                        Suggestions
                                                    </th>
                                                    <td
                                                        style={{
                                                            padding: 8,
                                                            borderBottom: "1px solid #eee",
                                                        }}
                                                    >
                                                        {(() => {

                                                            let suggestions = aiResult?.suggestions;

                                                            // Ensure suggestions is an array
                                                            if (!Array.isArray(suggestions) || suggestions.length === 0) {
                                                                // Generate fallback suggestions from itinerary if AI didn't provide
                                                                const fallbackSuggestions = [];
                                                                if (itinerary && itinerary.length > 0) {
                                                                    itinerary.forEach((dayPlan) => {
                                                                        const dayNum = dayPlan.day || 0;
                                                                        const places = dayPlan.places || [];

                                                                        if (places.length === 0) {
                                                                            fallbackSuggestions.push(
                                                                                `Day ${dayNum}: 08:00-10:00 - Tham quan địa điểm - Ngày này còn trống, nên thêm địa điểm tham quan.`,
                                                                                `Day ${dayNum}: 12:30-13:00 - Ăn trưa - Nghỉ ngơi và thưởng thức bữa trưa (30 phút).`,
                                                                                `Day ${dayNum}: 13:30-15:30 - Tham quan địa điểm - Tiếp tục khám phá.`
                                                                            );
                                                                        } else {
                                                                            let currentTime = 8 * 60; // Start at 8:00
                                                                            places.forEach((place, idx) => {
                                                                                const duration = (place.duration_hours || 2) * 60;
                                                                                const startHour = Math.floor(currentTime / 60);
                                                                                const startMin = currentTime % 60;
                                                                                const endTime = currentTime + duration;
                                                                                const endHour = Math.floor(endTime / 60);
                                                                                const endMin = endTime % 60;

                                                                                const startStr = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
                                                                                const endStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

                                                                                fallbackSuggestions.push(
                                                                                    `Day ${dayNum}: ${startStr}-${endStr} - ${place.name || 'Địa điểm'} - Tham quan địa điểm này.`
                                                                                );

                                                                                currentTime = endTime;
                                                                                if (idx < places.length - 1) {
                                                                                    currentTime += 30; // Travel time
                                                                                }

                                                                                // Add lunch around 12:30
                                                                                if (12 * 60 <= currentTime && currentTime < 13 * 60 && idx < places.length - 1) {
                                                                                    fallbackSuggestions.push(
                                                                                        `Day ${dayNum}: 12:30-13:00 - Ăn trưa - Nghỉ ngơi và thưởng thức bữa trưa (30 phút).`
                                                                                    );
                                                                                    currentTime = 13 * 60;
                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                }

                                                                const displaySuggestions = fallbackSuggestions.length > 0 ? fallbackSuggestions : suggestions || [];

                                                                if (displaySuggestions.length === 0) {
                                                                    return (
                                                                        <div style={{ color: "#9ca3af", fontStyle: "italic", padding: "12px" }}>
                                                                            Chưa có gợi ý. Vui lòng thử lại sau.
                                                                        </div>
                                                                    );
                                                                }

                                                                // Use fallback suggestions for display
                                                                suggestions = displaySuggestions;
                                                            }

                                                            // Group suggestions by day
                                                            const suggestionsByDay = {};
                                                            suggestions.forEach((s) => {
                                                                if (typeof s !== 'string') {
                                                                    devLog.warn("Invalid suggestion format:", s);
                                                                    return;
                                                                }
                                                                const dayMatch = s.match(/^Day\s+(\d+):\s*(.+)/i);
                                                                if (dayMatch) {
                                                                    const dayNum = parseInt(dayMatch[1]);
                                                                    const suggestionText = dayMatch[2];
                                                                    if (!suggestionsByDay[dayNum]) {
                                                                        suggestionsByDay[dayNum] = [];
                                                                    }
                                                                    suggestionsByDay[dayNum].push(suggestionText);
                                                                } else {
                                                                    // If no day match, try to extract day from context or assign to day 1
                                                                    devLog.warn("Suggestion doesn't match Day X format:", s);
                                                                    if (!suggestionsByDay[1]) {
                                                                        suggestionsByDay[1] = [];
                                                                    }
                                                                    suggestionsByDay[1].push(s);
                                                                }
                                                            });

                                                            const sortedDays = Object.keys(suggestionsByDay)
                                                                .map(Number)
                                                                .sort((a, b) => a - b);

                                                            if (sortedDays.length === 0) {
                                                                return (
                                                                    <div style={{ color: "#9ca3af", fontStyle: "italic", padding: "12px" }}>
                                                                        Không thể phân tích gợi ý. Vui lòng thử lại.
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                                                    {sortedDays.map((dayNum) => {
                                                                        const daySuggestions = suggestionsByDay[dayNum];
                                                                        return (
                                                                            <div
                                                                                key={dayNum}
                                                                                style={{
                                                                                    border: "1px solid #e5e7eb",
                                                                                    borderRadius: 8,
                                                                                    overflow: "hidden",
                                                                                    backgroundColor: "#f9fafb",
                                                                                }}
                                                                            >
                                                                                <div
                                                                                    style={{
                                                                                        backgroundColor: "#6366f1",
                                                                                        color: "white",
                                                                                        padding: "12px 16px",
                                                                                        fontWeight: "bold",
                                                                                        fontSize: 15,
                                                                                        display: "flex",
                                                                                        alignItems: "center",
                                                                                        gap: 8,
                                                                                    }}
                                                                                >
                                                                                    📅 Ngày {dayNum} - Lịch trình 08:00-17:00
                                                                                </div>
                                                                                <div style={{ padding: 12 }}>
                                                                                    <div
                                                                                        style={{
                                                                                            display: "flex",
                                                                                            flexDirection: "column",
                                                                                            gap: 10,
                                                                                        }}
                                                                                    >
                                                                                        {daySuggestions.map((suggestion, idx) => {
                                                                                            // Parse time range and activity - try multiple formats
                                                                                            let timeMatch = suggestion.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+)/);
                                                                                            if (!timeMatch) {
                                                                                                timeMatch = suggestion.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s+(.+)/);
                                                                                            }
                                                                                            if (!timeMatch) {
                                                                                                timeMatch = suggestion.match(/^(\d{1,2}:\d{2})\s+đến\s+(\d{1,2}:\d{2})\s*[-:]\s*(.+)/i);
                                                                                            }

                                                                                            if (timeMatch) {
                                                                                                const [, startTime, endTime, activity] = timeMatch;
                                                                                                // Normalize time format
                                                                                                const normalizeTime = (t) => {
                                                                                                    const parts = t.split(':');
                                                                                                    if (parts.length === 2) {
                                                                                                        return `${parts[0].padStart(2, '0')}:${parts[1]}`;
                                                                                                    }
                                                                                                    return t;
                                                                                                };
                                                                                                const normalizedStart = normalizeTime(startTime);
                                                                                                const normalizedEnd = normalizeTime(endTime);

                                                                                                // Extract description/tips if exists (after second dash)
                                                                                                const parts = activity.split(" - ");
                                                                                                const activityName = parts[0].trim();
                                                                                                const tips = parts.slice(1).join(" - ").trim();

                                                                                                return (
                                                                                                    <div
                                                                                                        key={idx}
                                                                                                        style={{
                                                                                                            display: "flex",
                                                                                                            gap: 12,
                                                                                                            padding: "10px 12px",
                                                                                                            backgroundColor: "white",
                                                                                                            borderRadius: 6,
                                                                                                            borderLeft: "3px solid #6366f1",
                                                                                                            alignItems: "flex-start",
                                                                                                        }}
                                                                                                    >
                                                                                                        <div
                                                                                                            style={{
                                                                                                                minWidth: 100,
                                                                                                                fontWeight: "600",
                                                                                                                color: "#6366f1",
                                                                                                                fontSize: 12,
                                                                                                                paddingTop: 2,
                                                                                                            }}
                                                                                                        >
                                                                                                            {normalizedStart} - {normalizedEnd}
                                                                                                        </div>
                                                                                                        <div style={{ flex: 1 }}>
                                                                                                            <div
                                                                                                                style={{
                                                                                                                    fontWeight: "600",
                                                                                                                    color: "#111827",
                                                                                                                    marginBottom: tips ? 4 : 0,
                                                                                                                    fontSize: 13,
                                                                                                                }}
                                                                                                            >
                                                                                                                {activityName}
                                                                                                            </div>
                                                                                                            {tips && (
                                                                                                                <div
                                                                                                                    style={{
                                                                                                                        color: "#6b7280",
                                                                                                                        fontSize: 12,
                                                                                                                        lineHeight: 1.5,
                                                                                                                        fontStyle: "italic",
                                                                                                                    }}
                                                                                                                >
                                                                                                                    💡 {tips}
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            } else {
                                                                                                // Fallback for suggestions without time format
                                                                                                return (
                                                                                                    <div
                                                                                                        key={idx}
                                                                                                        style={{
                                                                                                            padding: "8px 12px",
                                                                                                            backgroundColor: "white",
                                                                                                            borderRadius: 6,
                                                                                                            fontSize: 13,
                                                                                                            color: "#374151",
                                                                                                            borderLeft: "3px solid #e5e7eb",
                                                                                                        }}
                                                                                                    >
                                                                                                        {suggestion}
                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                                {aiResult.details &&
                                                    typeof aiResult.details === "object" && (
                                                        <tr>
                                                            <th
                                                                style={{
                                                                    textAlign: "left",
                                                                    padding: 8,
                                                                    verticalAlign: "top",
                                                                }}
                                                            >
                                                                Details (per-day)
                                                            </th>
                                                            <td style={{ padding: 8 }}>
                                                                {Object.keys(aiResult.details).length === 0 ? (
                                                                    "-"
                                                                ) : (
                                                                    <div style={{ display: "grid", gap: 8 }}>
                                                                        {Object.entries(aiResult.details).map(
                                                                            ([dayKey, notes]) => (
                                                                                <div
                                                                                    key={dayKey}
                                                                                    style={{
                                                                                        border: "1px solid #f0f0f0",
                                                                                        padding: 8,
                                                                                        borderRadius: 6,
                                                                                    }}
                                                                                >
                                                                                    <strong>{dayKey}</strong>
                                                                                    <div style={{ marginTop: 6 }}>
                                                                                        {Array.isArray(notes) ? (
                                                                                            <ul
                                                                                                style={{
                                                                                                    margin: 0,
                                                                                                    paddingLeft: 18,
                                                                                                }}
                                                                                            >
                                                                                                {notes.map((n, idx) => {
                                                                                                    let text = "";
                                                                                                    if (
                                                                                                        typeof n === "object" &&
                                                                                                        n
                                                                                                    ) {
                                                                                                        text =
                                                                                                            n.place ||
                                                                                                            n.name ||
                                                                                                            n.note ||
                                                                                                            JSON.stringify(n);
                                                                                                    } else {
                                                                                                        text = String(n);
                                                                                                    }
                                                                                                    return (
                                                                                                        <li
                                                                                                            key={idx}
                                                                                                            style={{
                                                                                                                marginBottom: 6,
                                                                                                            }}
                                                                                                        >
                                                                                                            {text}
                                                                                                        </li>
                                                                                                    );
                                                                                                })}
                                                                                            </ul>
                                                                                        ) : (
                                                                                            <div>{String(notes)}</div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <p>No result.</p>
                            )}
                        </div>

                        <div
                            style={{
                                padding: 12,
                                borderTop: "1px solid #eee",
                                textAlign: "right",
                            }}
                            className="ai-modal-footer"
                        >
                            <button
                                onClick={handleApplyAISuggestions}
                                className="apply-btn"
                                disabled={aiLoading}
                                style={{
                                    padding: "8px 14px",
                                    cursor: "pointer",
                                    marginRight: 8,
                                }}
                            >
                                {aiLoading ? "Applying..." : "Apply AI Suggestions"}
                            </button>

                            <button
                                onClick={() => setShowAIModal(false)}
                                className="close-btn"
                                style={{ padding: "8px 14px", cursor: "pointer" }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ========== CONFIRM DELETE DAY MODAL ========== */}
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

            {/* ========== CONFIRM REGENERATE MODAL (MỚI) ========== */}
            {showRegenerateConfirm && (
                <div className="modal-overlay confirm-modal-overlay" onClick={() => setShowRegenerateConfirm(false)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-modal-icon">🔄</div>
                        <h3>Xác nhận tái tạo lịch trình</h3>
                        <p>Bạn có chắc chắn muốn <strong>TÁI TẠO LỊCH TRÌNH MỚI</strong> không?</p>
                        <p className="warning-text">Lịch trình hiện tại sẽ bị ghi đè!</p>
                        <p className="warning-text">Hành động này không thể hoàn tác!</p>

                        <div className="confirm-modal-actions">
                            <button onClick={() => setShowRegenerateConfirm(false)} className="btn-cancel">
                                Hủy
                            </button>
                            <button onClick={executeRegenerate} className="btn-confirm-delete">
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Destination Picker Modal */}
            {showDestinationPicker && (
                <DestinationPickerModal
                    places={allProvincePlaces}
                    type={showDestinationPicker.type}
                    onSelect={handleSelectDestination}
                    onClose={() => {
                        console.log('❌ Modal closed');
                        setShowDestinationPicker(null);
                    }}
                />
            )}
        </div>
    );
}