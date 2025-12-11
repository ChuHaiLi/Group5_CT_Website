// EditTripPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { FaArrowLeft, FaSave, FaClock } from "react-icons/fa";

// 🔑 IMPORT LOGIC VÀ AUTO-TIME TỪ FILE RIÊNG
import { reorder, move, recalculateTimeSlots } from "./dndLogic";
import ItemCard from "./ItemCard";
import "./EditTripPage.css";

// --- HÀM GIẢ ĐỊNH: Lấy token JWT
const getAuthToken = () => localStorage.getItem("access_token");

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

  const flattenItinerary = (apiItinerary) => {
    let uniqueIdCounter = 0;
    return apiItinerary.map((dayPlan) => ({
      ...dayPlan,
      places: dayPlan.places.map((item) => ({
        ...item,
        uniqueId: `item-${item.id || item.name}-${uniqueIdCounter++}`,
        day: dayPlan.day,
      })),
    }));
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
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        const fetchedTrip = response.data;
        setTripData(fetchedTrip);

        const flattened = flattenItinerary(fetchedTrip.itinerary || []);
        setOriginalItinerary(flattened); // Lưu bản gốc
        setItinerary(flattened); // Bản để chỉnh sửa
      } catch (err) {
        setError("Không tìm thấy chuyến đi hoặc bạn không có quyền truy cập.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTripDetails();
  }, [tripId]);

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
      console.error("Error saving itinerary:", err.response?.data || err);
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
      const payload = {
        original_itinerary: restoreItinerary(originalItinerary),
        edited_itinerary: restoreItinerary(itinerary),
        context: { tripId: tripId, tripName: tripData?.name || null },
      };
      const res = await axios.post("/api/ai/evaluate_itinerary", payload, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.data && res.data.ok) {
        setAiResult(res.data.result);
      } else if (res.data && res.data.result) {
        setAiResult(res.data.result);
      } else {
        const raw =
          res.data && res.data.error ? res.data.error : "No response from AI";
        setAiResult({
          raw: typeof raw === "string" ? raw : JSON.stringify(raw, null, 2),
        });
      }
      setShowAIModal(true);
    } catch (err) {
      console.error("AI evaluate error", err);
      const respData = err?.response?.data;
      const rawErr = respData
        ? typeof respData === "string"
          ? respData
          : JSON.stringify(respData, null, 2)
        : err.message || String(err);
      setAiResult({ raw: rawErr });
      setShowAIModal(true);
    } finally {
      setAiLoading(false);
    }
  };

  // --- AI reorder handler: ask backend to produce a suggested ordering and apply it to UI
  const handleAIReorder = async () => {
    if (!tripData) return;
    setAiLoading(true);
    try {
      const payload = {
        original_itinerary: restoreItinerary(originalItinerary),
        edited_itinerary: restoreItinerary(itinerary),
        context: { tripId: tripId, tripName: tripData?.name || null },
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
      console.error("AI reorder error", err);
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err.message || String(err);
      alert("AI reorder failed: " + (msg || "Unknown error"));
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
        </div>
      </div>

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
                            }}
                          >
                            {aiResult.score ?? "-"}
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
                            {Array.isArray(aiResult.suggestions) ? (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {aiResult.suggestions.map((s, i) => (
                                  <li key={i} style={{ marginBottom: 6 }}>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              aiResult.suggestions ?? "-"
                            )}
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
                                                {notes.map((n, idx) => (
                                                  <li key={idx}>{n}</li>
                                                ))}
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
                onClick={handleAIReorder}
                className="apply-btn"
                disabled={aiLoading}
                style={{
                  padding: "8px 14px",
                  cursor: "pointer",
                  marginRight: 8,
                }}
              >
                {aiLoading ? "Applying..." : "Apply AI Reorder"}
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
    </div>
  );
}
