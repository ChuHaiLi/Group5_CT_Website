// EditTripPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { FaArrowLeft, FaSave, FaClock, FaCog } from "react-icons/fa";

// 🔑 IMPORT LOGIC VÀ AUTO-TIME TỪ FILE RIÊNG
import { reorder, move, recalculateTimeSlots } from "./dndLogic";
import ItemCard from "./ItemCard";
import "./EditTripPage.css";

// --- HÀM GIẢ ĐỊNH: Lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token");

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

// --- Component Chính ---
export default function EditTripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [tripData, setTripData] = useState(null);
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
  const [userFeedback, setUserFeedback] = useState(""); // User feedback for AI suggestions
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  
  // Use ref to avoid stale closure in useEffect
  const pendingAiChangesRef = useRef(false);

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

  // Parse AI suggestions (string array) into itinerary format
  const parseSuggestionsToItinerary = (suggestions, sourceItineraryForMatching = null) => {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return null;
    }

    // Build map of existing places from source itinerary for matching
    const allPlacesMap = new Map();
    if (sourceItineraryForMatching && Array.isArray(sourceItineraryForMatching)) {
      sourceItineraryForMatching.forEach((dayPlan) => {
        (dayPlan.places || []).forEach((p) => {
          if (p && p.name) {
            const nameKey = (p.name || "").toLowerCase().trim();
            if (nameKey) {
              allPlacesMap.set(nameKey, p);
            }
          }
        });
      });
    }

    // Group suggestions by day
    const suggestionsByDay = {};
    suggestions.forEach((s) => {
      if (typeof s !== 'string') return;
      
      // Parse format: "Day X: HH:MM-HH:MM - Activity Name - Description"
      const dayMatch = s.match(/^Day\s+(\d+):\s*(.+)/i);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        const suggestionText = dayMatch[2].trim();
        
        // Parse time and activity: "HH:MM-HH:MM - Activity Name - Description"
        // Try multiple formats to handle variations
        let timeMatch = suggestionText.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+?)(?:\s*-\s*(.+))?$/);
        if (!timeMatch) {
          // Try format without description: "HH:MM-HH:MM - Activity Name"
          timeMatch = suggestionText.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(.+)$/);
        }
        if (!timeMatch) {
          // Try format without dash separator: "HH:MM-HH:MM Activity Name"
          timeMatch = suggestionText.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/);
        }
        
        if (timeMatch) {
          const [, startTime, endTime, activityName] = timeMatch;
          
          if (!suggestionsByDay[dayNum]) {
            suggestionsByDay[dayNum] = [];
          }
          
          suggestionsByDay[dayNum].push({
            startTime,
            endTime,
            activityName: activityName.trim(),
          });
        }
      }
    });

    // Convert to itinerary format
    const itinerary = [];
    Object.keys(suggestionsByDay).forEach((dayKey) => {
      const dayNum = parseInt(dayKey, 10);
      const daySuggestions = suggestionsByDay[dayNum];
      
      const places = daySuggestions.map((suggestion) => {
        const activityNameLower = suggestion.activityName.toLowerCase();
        
        // Try to match with existing place
        let matchedPlace = null;
        for (const [key, place] of allPlacesMap.entries()) {
          if (activityNameLower.includes(key) || key.includes(activityNameLower)) {
            matchedPlace = place;
            break;
          }
        }

        // Infer type from name
        const inferType = (name) => {
          const nameLower = name.toLowerCase();
          if (nameLower.includes('ăn') || nameLower.includes('lunch') || nameLower.includes('dinner') || nameLower.includes('breakfast') || nameLower.includes('meal')) {
            return 'food';
          }
          if (nameLower.includes('di chuyển') || nameLower.includes('travel') || nameLower.includes('move') || nameLower.includes('về') || nameLower.includes('return') || nameLower.includes('chuyển về')) {
            return 'move';
          }
          if (nameLower.includes('nghỉ') || nameLower.includes('rest') || nameLower.includes('break')) {
            return 'rest';
          }
          return 'sightseeing';
        };

        const duration = calculateDurationMinutes(suggestion.startTime, suggestion.endTime);
        const itemType = inferType(suggestion.activityName);

        return {
          id: matchedPlace?.id || null,
          name: suggestion.activityName,
          type: itemType,
          lat: matchedPlace?.lat || matchedPlace?.latitude || null,
          lng: matchedPlace?.lon || matchedPlace?.lng || matchedPlace?.longitude || null,
          start_time: suggestion.startTime,
          end_time: suggestion.endTime,
          duration_min: duration,
          distance_from_prev_km: 0,
          needs_data: !!matchedPlace?.needs_data,
        };
      });

      itinerary.push({
        day: dayNum,
        items: places,
      });
    });

    if (itinerary.length === 0) {
      return null;
    }

    // Use mapOptimizedToFrontend to convert to frontend format
    return mapOptimizedToFrontend(itinerary, sourceItineraryForMatching);
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
        // Create time_slot from start_time and end_time if both are available
        let timeSlot = it.time_slot || null;
        if (!timeSlot && it.start_time && it.end_time) {
          // Both start_time and end_time are available, create time_slot
          timeSlot = `${it.start_time}-${it.end_time}`;
        } else if (!timeSlot && it.start_time) {
          // Only start_time is available, use it as time_slot (will be completed later)
          timeSlot = it.start_time;
        }
        
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
          time_slot: timeSlot,
          start_time: it.start_time || null,
          end_time: it.end_time || null,
          duration_hours: it.duration_min
            ? Number(it.duration_min) / 60
            : it.duration_hours || null,
          distance_from_prev_km: it.distance_from_prev_km || 0,
          needs_data: !!it.needs_data,
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

  const handleRevertAIChanges = () => {
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
    const flattened = apiItinerary.map((dayPlan) => ({
      ...dayPlan,
      places: dayPlan.places.map((item) => ({
        ...item,
        uniqueId: `item-${item.id || item.name}-${uniqueIdCounter++}`,
        day: dayPlan.day,
      })),
    }));
    
    
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

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!tripId) return;
      // Don't reset itinerary if we have pending AI changes - use ref to avoid stale closure
      if (pendingAiChangesRef.current) {
        return;
      }
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        const fetchedTrip = response.data;
        setTripData(fetchedTrip);

        const flattened = flattenItinerary(fetchedTrip.itinerary || []);
        setOriginalItinerary(flattened); // Lưu bản gốc
        // Only set itinerary if we don't have pending AI changes - use ref to avoid stale closure
        if (!pendingAiChangesRef.current) {
          setItinerary(flattened); // Bản để chỉnh sửa
        }
      } catch (err) {
        setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTripDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]); // pendingAiChanges is intentionally excluded - we use pendingAiChangesRef to avoid race conditions


  // --- DND LOGIC ---
  const getList = useCallback(
    (id) => {
      const dayIndex = itinerary.findIndex((d) => `day-${d.day}` === id);
      return dayIndex !== -1 ? itinerary[dayIndex].places : [];
    },
    [itinerary]
  );

  const onDragEnd = useCallback(
    (result) => {
      const { source, destination } = result;
      if (!destination) return;

      const sId = source.droppableId;
      const dId = destination.droppableId;

      let newItinerary;

      if (sId === dId) {
        const items = reorder(getList(sId), source.index, destination.index);

        newItinerary = itinerary.map((dayPlan) => {
          if (`day-${dayPlan.day}` === sId)
            return { ...dayPlan, places: items };
          return dayPlan;
        });
      } else {
        const resultMove = move(
          getList(sId),
          getList(dId),
          source,
          destination
        );

        newItinerary = itinerary.map((dayPlan) => {
          if (`day-${dayPlan.day}` === sId)
            return { ...dayPlan, places: resultMove[sId] };
          if (`day-${dayPlan.day}` === dId)
            return { ...dayPlan, places: resultMove[dId] };
          return dayPlan;
        });
      }

      const recalculatedItinerary = recalculateTimeSlots(newItinerary);
      setItinerary(recalculatedItinerary);
    },
    [itinerary, getList]
  );

  // --- CRUD ITEM LOGIC ---
  const handleUpdateItem = useCallback((dayId, uniqueIdToUpdate, changes) => {
    setItinerary((currentItinerary) => {
      const newItinerary = currentItinerary.map((dayPlan) => {
        if (`day-${dayPlan.day}` === dayId) {
          return {
            ...dayPlan,
            places: dayPlan.places.map((item) => {
              if (item.uniqueId === uniqueIdToUpdate)
                return { ...item, ...changes };
              return item;
            }),
          };
        }
        return dayPlan;
      });
      return recalculateTimeSlots(newItinerary);
    });
  }, []);

  const handleRemoveItem = useCallback((uniqueIdToRemove) => {
    setItinerary((currentItinerary) => {
      const newItinerary = currentItinerary.map((dayPlan) => ({
        ...dayPlan,
        places: dayPlan.places.filter(
          (item) => item.uniqueId !== uniqueIdToRemove
        ),
      }));

      return recalculateTimeSlots(newItinerary);
    });
  }, []);

  const handleAddItem = useCallback((day, type) => {
    const newUniqueId = `new-item-${Date.now()}-${Math.floor(
      Math.random() * 100
    )}`;
    let newItem = {
      id: newUniqueId,
      uniqueId: newUniqueId,
      day: day,
      name: "Địa điểm mới",
      category: "Địa điểm",
    };

    if (type === "LUNCH")
      newItem = {
        ...newItem,
        id: "LUNCH",
        name: "Ăn trưa",
        category: "Ăn uống",
      };
    if (type === "TRAVEL")
      newItem = {
        ...newItem,
        id: "TRAVEL",
        name: "Di chuyển/Nghỉ ngơi",
        category: "Di chuyển",
      };

    setItinerary((currentItinerary) => {
      const newItinerary = currentItinerary.map((dayPlan) => {
        if (dayPlan.day === day) {
          return {
            ...dayPlan,
            places: [...dayPlan.places, newItem],
          };
        }
        return dayPlan;
      });

      return recalculateTimeSlots(newItinerary);
    });
  }, []);

  // --- HÀM LƯU DỮ LIỆU CHÍNH ---
  const handleSave = async () => {
    if (!tripData) return;
    setIsSaving(true);
    setError(null);

    const updatedItinerary = restoreItinerary(itinerary);
    const itineraryPayload = { itinerary: updatedItinerary };

    try {
      await axios.put(`/api/trips/${tripId}/itinerary`, itineraryPayload, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      alert("Đã lưu chỉnh sửa thành công!");
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError("Lỗi khi lưu lịch trình.");
      devLog.error("Error saving itinerary:", err.response?.data || err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Regenerate AI suggestions with user feedback ---
  const handleAddFeedback = async () => {
    if (!tripData || !userFeedback.trim()) return;
    setFeedbackLoading(true);
    try {
      const baseInstructions = `You are a Professional Travel Guide with 30 years of experience. Evaluate the itinerary and provide detailed day-by-day suggestions with complete timeline (8:00-17:00). Return ONLY a single, valid JSON object with this structure:\n{ "score": 0-100, "decision": "accept|adjust|reorder|add_days|balance", "summary": "3-5 sentences like an experienced tour guide", "suggestions": ["Day 1: 08:00-10:00 - [Activity] - [Tips]", "Day 1: 12:30-13:00 - Ăn trưa - 30 phút", ...], "details_per_day": [...], "optimized_itinerary": [...] }\n- suggestions MUST be detailed day-by-day with time ranges (8:00-17:00)\n- Each suggestion format: "Day X: HH:MM-HH:MM - [Activity Name] - [Description/Tips]"\n- Provide suggestions for ALL days in the itinerary\n- Respond in English and avoid adding extra text outside the JSON.`;

      const evaluationInstructions = `${baseInstructions}\n\nIMPORTANT: The user has provided additional feedback and requirements:\n"${userFeedback.trim()}"\n\nPlease incorporate these requirements into your suggestions. Adjust the itinerary based on the user's specific needs, preferences, and requests.`;

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
        
        if (!Array.isArray(result.suggestions)) {
          devLog.warn("AI result missing suggestions array, initializing empty array");
          result.suggestions = [];
        }
        
        setAiResult(result);
        setUserFeedback(""); // Clear feedback after successful regeneration
      } else if (res.data && res.data.result) {
        const result = res.data.result;
        if (!Array.isArray(result.suggestions)) {
          result.suggestions = [];
        }
        setAiResult(result);
        setUserFeedback("");
      } else {
        const raw =
          res.data && res.data.error ? res.data.error : "No response from AI";
        setAiResult({
          raw: typeof raw === "string" ? raw : JSON.stringify(raw, null, 2),
          suggestions: [],
        });
      }
    } catch (err) {
      devLog.error("AI feedback error", err);
      const respData = err?.response?.data;
      const rawErr = respData
        ? typeof respData === "string"
          ? respData
          : JSON.stringify(respData, null, 2)
        : err.message || String(err);
      setAiResult({ 
        raw: rawErr,
        suggestions: [],
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  // --- AI evaluate handler ---
  const handleAIEvaluate = async () => {
    if (!tripData) return;
    setAiLoading(true);
    setAiResult(null);
    setShowAIModal(false);
    setUserFeedback(""); // Clear feedback when starting new evaluation
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
      // If AI evaluation provided suggestions (string array), parse them into itinerary
      else if (
        aiResult &&
        aiResult.suggestions &&
        Array.isArray(aiResult.suggestions) &&
        aiResult.suggestions.length > 0
      ) {
        const parsed = parseSuggestionsToItinerary(aiResult.suggestions, backupItinerary);
        
        if (parsed && validateItinerary(parsed)) {
          aiItineraryToApply = parsed;
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


      // Apply AI suggestions directly - NO MERGE, NO SORTING, NO REMOVE DUPLICATES
      // Just use AI suggestions as-is, preserving the exact order from AI
      let replacedItinerary = deepCloneItinerary(aiItineraryToApply);
      
      // Ensure we have all days from original (fill missing days if any)
      // But don't change the order of AI suggestions
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
      // Note: recalculateTimeSlots will preserve AI's time if provided
      const flattened = flattenItinerary(replacedItinerary);
      const enhanced = recalculateTimeSlots(flattened);
      
      // Final check: ensure enhanced is valid
      if (!validateItinerary(enhanced)) {
        
        setItinerary(backupItinerary);
        setPreAiItinerary(null);
        alert("Không thể áp dụng: Lỗi khi tính toán thời gian. Lịch trình đã được khôi phục.");
        return;
      }

      // Success: apply the changes
      // Set pendingAiChanges FIRST to prevent fetchTripDetails from resetting
      // Update ref FIRST (synchronous) to prevent race condition
      pendingAiChangesRef.current = true;
      setPendingAiChanges(true);
      
      setItinerary(enhanced);
      setShowAIModal(false);
      
      // Force UI update
      setTimeout(() => {
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
          ✏️ Chỉnh sửa: {tripData?.name || "Loading"}
        </h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={handleSave} className="save-btn" disabled={isSaving}>
            <FaSave /> {isSaving ? "Đang lưu..." : "Lưu Thay Đổi"}
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

      {/* Main Content: 2 Columns */}
      <div className="edit-trip-content">
        {/* LEFT: Original Itinerary */}
        <div className="original-column">
          <div className="column-header">
            <h2>📋 Lịch trình gốc</h2>
            <p className="subtitle">Bản tham khảo ban đầu</p>
          </div>

          <div className="days-list">
            {originalItinerary.map((dayPlan) => (
              <div
                key={`original-${dayPlan.day}`}
                className="day-section original"
              >
                <h3 className="day-title">Ngày {dayPlan.day}</h3>
                <div className="places-list">
                  {dayPlan.places.map((item, index) => (
                    <div key={index} className="place-item-readonly">
                      <div className="time-badge">
                        <FaClock /> {item.time_slot || "N/A"}
                      </div>
                      <div className="place-info">
                        <span className="place-icon">
                          {item.category === "Ăn uống" || item.id === "LUNCH"
                            ? "🍽️"
                            : item.category === "Di chuyển" ||
                              item.id === "TRAVEL"
                            ? "✈️"
                            : "📍"}
                        </span>
                        <span className="place-name">{item.name}</span>
                        <span className="place-category">
                          ({item.category || item.id})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Editable Itinerary */}
        <div className="editable-column">
          <div className="column-header">
            <h2>✏️ Chỉnh sửa lịch trình</h2>
            <p className="subtitle">Kéo thả để sắp xếp lại</p>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="days-list">
              {itinerary.map((dayPlan) => (
                <div
                  key={`edit-${dayPlan.day}`}
                  className="day-section editable"
                >
                  <h3 className="day-title">Ngày {dayPlan.day}</h3>

                  <Droppable droppableId={`day-${dayPlan.day}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`droppable-area ${
                          snapshot.isDraggingOver ? "dragging-over" : ""
                        }`}
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
                      onClick={() => handleAddItem(dayPlan.day, "DESTINATION")}
                      className="add-btn destination"
                    >
                      + Địa điểm
                    </button>
                    <button
                      onClick={() => handleAddItem(dayPlan.day, "LUNCH")}
                      className="add-btn lunch"
                    >
                      + Ăn uống
                    </button>
                    <button
                      onClick={() => handleAddItem(dayPlan.day, "TRAVEL")}
                      className="add-btn travel"
                    >
                      + Di chuyển
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>
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
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            className="ai-modal"
          >
            {/* Fixed Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #eee",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 10,
                borderRadius: "8px 8px 0 0",
              }}
            >
              <h3 style={{ margin: 0 }}>AI Evaluation</h3>
              <button
                onClick={() => {
                  setShowAIModal(false);
                  setUserFeedback("");
                }}
                style={{
                  background: "rgba(239, 68, 68, 0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: "18px",
                  fontWeight: "bold",
                  lineHeight: 1,
                  transition: "all 0.2s ease",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(239, 68, 68, 0.9)";
                  e.target.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(239, 68, 68, 0.7)";
                  e.target.style.transform = "scale(1)";
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Scrollable Body */}
            <div 
              style={{ 
                padding: 16, 
                overflowY: "auto",
                flex: 1,
                minHeight: 0, // Important for flex scrolling
              }} 
              className="ai-modal-body"
            >
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

              {/* Add informations chat section */}
              <div
                style={{
                  padding: "14px 16px",
                  marginTop: 16,
                  borderTop: "1px solid #eee",
                  backgroundColor: "#f9fafb",
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#374151",
                    marginBottom: 10,
                  }}
                >
                  Add informations
                </div>
                <textarea
                  value={userFeedback}
                  onChange={(e) => setUserFeedback(e.target.value)}
                  placeholder="Enter your request, adjustments, or additional details so the AI can create a more suitable itinerary..."
                  style={{
                    width: "100%",
                    minHeight: 70,
                    maxHeight: 120,
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                  disabled={feedbackLoading || aiLoading}
                />
              </div>

              {/* Footer with buttons */}
              <div
                style={{
                  padding: "14px 16px",
                  marginTop: 16,
                  borderTop: "1px solid #eee",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                }}
                className="ai-modal-footer"
              >
              <button
                onClick={handleApplyAISuggestions}
                className="apply-btn"
                disabled={aiLoading || feedbackLoading}
                style={{
                  padding: "10px 20px",
                  minWidth: "160px",
                  cursor: aiLoading || feedbackLoading ? "not-allowed" : "pointer",
                  opacity: aiLoading || feedbackLoading ? 0.6 : 1,
                }}
              >
                {aiLoading ? "Applying..." : "Apply AI Suggestions"}
              </button>

              <button
                onClick={handleAddFeedback}
                className="add-btn"
                disabled={feedbackLoading || aiLoading || !userFeedback.trim()}
                style={{
                  padding: "10px 16px",
                  minWidth: "80px",
                  cursor: feedbackLoading || aiLoading || !userFeedback.trim() ? "not-allowed" : "pointer",
                  background: feedbackLoading || aiLoading || !userFeedback.trim() 
                    ? "#9ca3af" 
                    : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontWeight: 600,
                  fontSize: 14,
                  transition: "all 0.3s ease",
                }}
              >
                {feedbackLoading ? "Processing..." : "Add"}
              </button>

              <button
                onClick={() => {
                  setShowAIModal(false);
                  setUserFeedback("");
                }}
                className="close-btn"
                style={{ 
                  padding: "10px 20px",
                  minWidth: "100px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}