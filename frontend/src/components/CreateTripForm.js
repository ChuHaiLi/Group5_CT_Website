// CreateTripFormOptimized.jsx (patched: robust province id handling + initialDestination by name)
import React, { useEffect, useRef, useState } from "react";
import {
  FaClock,
  FaUser,
  FaMoneyBillWave,
  FaMapMarkerAlt,
  FaSearch,
  FaGlobe,
  FaTimes,
} from "react-icons/fa";
import RecommendCard from "../pages/Home/Recommendations/RecommendCard";
import API from "../untils/axios";
import { toast } from "react-toastify";
import "./CreateTripForm.css";

/** Helper: map duration label -> days */
const extractDurationDays = (durationStr) => {
  switch (durationStr) {
    case "1-3 days":
      return 3;
    case "4-7 days":
      return 7;
    case "8-14 days":
      return 14;
    case "15+ days":
      return 15;
    default:
      return 0;
  }
};

/** Normalize utility for fuzzy matching (strip accents, lower, trim) */
const normalize = (str) =>
  String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const normalizeProvince = (input, provinceList) => {
  if (!input) return null;
  const normalizedInput = normalize(input);
  for (const p of provinceList) {
    if (normalize(p.name) === normalizedInput) return p;
  }
  for (const p of provinceList) {
    if (normalize(p.name).includes(normalizedInput)) return p;
  }
  return null;
};

export default function CreateTripForm({ initialDestination = null, onClose, onTripCreated }) {
  // --- Form state ---
  const [tripName, setTripName] = useState("");
  const [duration, setDuration] = useState(""); // label
  const [peopleCount, setPeopleCount] = useState("");
  const [budget, setBudget] = useState("");

  // --- Provinces / locations ---
  const [vietnamLocations, setVietnamLocations] = useState([]); // { id: string, name, regionName }
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(null); // { id: string, name }

  // --- Must-include places ---
  const [mustIncludeDetails, setMustIncludeDetails] = useState([]); // [{id, name, province_id, province_name}]

  // --- Search logic ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  // --- Modal details ---
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [placeToView, setPlaceToView] = useState(null);

  // --- Init guard ---
  const initialLoaded = useRef(false);

  // Options
  const durationOptions = ["1-3 days", "4-7 days", "8-14 days", "15+ days"];
  const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
  const budgetOptions = ["< 5 triệu", "5-10 triệu", "10-20 triệu", "> 20 triệu"];

  // ---------------------------------------------------------
  // Fetch provinces on mount - robust: handle missing province.id
  // ---------------------------------------------------------
  useEffect(() => {
    setIsProvinceLoading(true);
    API.get("/locations/vietnam")
      .then((res) => {
        const provinces = [];
        if (Array.isArray(res.data)) {
          res.data.forEach((region) => {
            if (Array.isArray(region.provinces)) {
              region.provinces.forEach((p, idx) => {
                // if backend doesn't provide an id for province, use province_name as stable id string
                const idStr = String(p.id ?? p.province_id ?? p.province_name ?? `prov-${idx}`);
                provinces.push({
                  id: idStr,
                  name: p.province_name,
                  regionName: region.region_name || "",
                });
              });
            }
          });
        }
        setVietnamLocations(provinces);
      })
      .catch((err) => {
        console.error("Load provinces failed", err);
        toast.error("Không thể tải danh sách tỉnh/thành. Vui lòng thử lại.");
      })
      .finally(() => setIsProvinceLoading(false));
  }, []);

  // ---------------------------------------------------------
  // Initialize from initialDestination (support both province_id and province_name)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!initialDestination || vietnamLocations.length === 0) return;
    if (initialLoaded.current) return;

    const { id, name, province_id, province_name } = initialDestination;

    // 1) try match by numeric province_id (if provided)
    if (province_id) {
      const match = vietnamLocations.find((p) => String(p.id) === String(province_id) || String(p.id) === String(province_id));
      if (match) {
        setSelectedProvince({ id: match.id, name: match.name });
        setMustIncludeDetails([{ id, name, province_id, province_name }]);
        if (!tripName) setTripName(`Khám phá ${name}`);
        initialLoaded.current = true;
        return;
      }
    }

    // 2) try match by province_name (fuzzy)
    if (province_name) {
      const matchByName = normalizeProvince(province_name, vietnamLocations);
      if (matchByName) {
        setSelectedProvince({ id: matchByName.id, name: matchByName.name });
        setMustIncludeDetails([{ id, name, province_id: matchByName.id, province_name: matchByName.name }]);
        if (!tripName) setTripName(`Khám phá ${name}`);
        initialLoaded.current = true;
        return;
      }
    }

    // 3) fallback: try find any province whose name includes the destination name (rare)
    if (name) {
      const matchFallback = vietnamLocations.find((p) => normalize(p.name).includes(normalize(name)) || normalize(name).includes(normalize(p.name)));
      if (matchFallback) {
        setSelectedProvince({ id: matchFallback.id, name: matchFallback.name });
        setMustIncludeDetails([{ id, name, province_id: matchFallback.id, province_name: matchFallback.name }]);
        if (!tripName) setTripName(`Khám phá ${name}`);
        initialLoaded.current = true;
        return;
      }
    }

    // else: at least set trip name
    if (!tripName && name) setTripName(`Khám phá ${name}`);
    initialLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDestination, vietnamLocations]);

  // ---------------------------------------------------------
  // When selectedProvince changes: auto-suggest top places
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedProvince) {
      setSearchResults([]);
      setSearchTerm("");
      return;
    }

    const alreadyFromProvince = mustIncludeDetails.some((d) => String(d.province_id) === String(selectedProvince.id) || normalize(d.province_name) === normalize(selectedProvince.name));
    if (alreadyFromProvince) {
      setSearchResults([]);
      setSearchTerm("");
      return;
    }

    setSearchLoading(true);
    // try call with province_id if the province id is numeric-like; otherwise backend may accept province_name param — try both
    const numericId = Number(selectedProvince.id);
    const param = Number.isFinite(numericId) && numericId > 0 ? `province_id=${numericId}` : `province_name=${encodeURIComponent(selectedProvince.name)}`;

    API.get(`/destinations?${param}&top=6`)
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const top = res.data.slice(0, 5).map((p) => ({
            id: p.id,
            name: p.name,
            province_id: p.province_id,
            province_name: p.province_name || selectedProvince.name,
            ...p,
          }));
          setSearchResults(top);
        } else {
          setSearchResults([]);
        }
      })
      .catch((err) => {
        console.warn("Top destinations fetch failed", err);
        setSearchResults([]);
      })
      .finally(() => setSearchLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvince]);

  // ---------------------------------------------------------
  // Search behavior (debounced)
  // ---------------------------------------------------------
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!selectedProvince || (searchTerm || "").trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      const q = encodeURIComponent(searchTerm.trim());
      const numericId = Number(selectedProvince.id);
      const param = Number.isFinite(numericId) && numericId > 0 ? `province_id=${numericId}` : `province_name=${encodeURIComponent(selectedProvince.name)}`;

      API.get(`/destinations?search=${q}&${param}`)
        .then((res) => {
          const filtered = Array.isArray(res.data)
            ? res.data.filter((p) => {
                // accept if place.province_id matches or province_name matches (normalized)
                const pidMatch = p.province_id ? String(p.province_id) === String(selectedProvince.id) : false;
                const pnameMatch = p.province_name ? normalize(p.province_name) === normalize(selectedProvince.name) : false;
                return pidMatch || pnameMatch;
              })
            : [];
          setSearchResults(filtered.slice(0, 8));
        })
        .catch((err) => {
          console.error("Search failed", err);
          toast.error("Tìm kiếm thất bại, thử lại sau.");
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }, 400);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedProvince]);

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------
  const handleProvinceChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setSelectedProvince(null);
      setMustIncludeDetails([]);
      return;
    }
    // val will be our idStr (string)
    const found = vietnamLocations.find((p) => String(p.id) === String(val));
    if (!found) {
      toast.error("Tỉnh/Thành không hợp lệ.");
      return;
    }

    // remove mustInclude items not from this province (based on either id or name)
    setMustIncludeDetails((prev) => prev.filter((d) => {
      const pidMatch = d.province_id ? String(d.province_id) === String(found.id) : false;
      const pnameMatch = d.province_name ? normalize(d.province_name) === normalize(found.name) : false;
      return pidMatch || pnameMatch;
    }));

    setSelectedProvince({ id: String(found.id), name: found.name });
  };

  const addPlaceToMustInclude = (place) => {
    if (!selectedProvince) {
      toast.error("Chọn tỉnh chính trước.");
      return;
    }

    // check belonging by ID OR by province_name fuzzy-match
    const placeBelongs =
      (place.province_id && String(place.province_id) === String(selectedProvince.id)) ||
      (place.province_name && normalize(place.province_name) === normalize(selectedProvince.name));

    if (!placeBelongs) {
      toast.error(`"${place.name}" không thuộc ${selectedProvince.name}.`);
      return;
    }

    if (mustIncludeDetails.some((d) => String(d.id) === String(place.id))) {
      toast.info(`${place.name} đã tồn tại trong danh sách.`);
      return;
    }

    setMustIncludeDetails((prev) => [
      ...prev,
      { id: place.id, name: place.name, province_id: place.province_id, province_name: place.province_name },
    ]);
    toast.success(`Đã thêm ${place.name}`);
    setSearchTerm("");
    setSearchResults([]);
  };

  const removePlace = (placeId) => {
    const updated = mustIncludeDetails.filter((d) => String(d.id) !== String(placeId));
    setMustIncludeDetails(updated);
  };

  const handleViewDetails = (place) => {
    setPlaceToView(place);
    setIsDetailsModalOpen(true);
  };

  const handleSelectFromDetails = (place) => {
    addPlaceToMustInclude(place);
    setIsDetailsModalOpen(false);
  };

  // Submit trip
  const handleSubmit = (e) => {
    e.preventDefault();
    const durationDays = extractDurationDays(duration);

    if (!tripName?.trim()) {
      toast.error("Vui lòng nhập tên chuyến đi.");
      return;
    }
    if (!selectedProvince) {
      toast.error("Vui lòng chọn tỉnh/thành chính cho chuyến đi.");
      return;
    }
    if (durationDays === 0) {
      toast.error("Vui lòng chọn thời lượng chuyến đi.");
      return;
    }

    // Try to send numeric id if possible (if selectedProvince.id looks numeric), otherwise send null and backend should accept province_name
    const maybeNumeric = Number(selectedProvince.id);
    const provincePayload = Number.isFinite(maybeNumeric) && maybeNumeric > 0 ? maybeNumeric : undefined;

    const payload = {
      name: tripName.trim(),
      // If backend requires province_id and we have it, send it. If not, send province_name in metadata.
      ...(provincePayload ? { province_id: provincePayload } : { province_name: selectedProvince.name }),
      duration: durationDays,
      must_include_place_ids: mustIncludeDetails.map((d) => d.id),
      metadata: {
        people: peopleCount || null,
        budget: budget || null,
      },
    };

    API.post("/trips", payload)
      .then((res) => {
        const created = res.data?.trip || res.data;
        toast.success(`Chuyến đi "${created?.name ?? payload.name}" đã tạo thành công.`);
        if (onTripCreated) onTripCreated(created);
        if (onClose) onClose();
      })
      .catch((err) => {
        console.error("Create trip error", err);
        const msg = err?.response?.data?.message || "Tạo chuyến đi thất bại.";
        toast.error(msg);
      });
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  return (
    <div className="modal-overlay">
      <div className="create-trip-form">
        <h2 className="form-header">Create a Trip</h2>

        <form onSubmit={handleSubmit}>
          {/* Trip name */}
          <div className="input-group">
            <input
              type="text"
              placeholder="Trip Name"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="trip-name-input"
              required
            />
          </div>

          {/* Province select */}
          <div className="province-select-group input-group">
            <label><FaGlobe /> 1. Select Main Province (Trip Focus)</label>
            {isProvinceLoading ? (
              <p className="loading-text">Loading provinces...</p>
            ) : (
              <select
                className="province-select"
                value={selectedProvince ? String(selectedProvince.id) : ""}
                onChange={handleProvinceChange}
                required
              >
                <option value="">--- Select a Province/City ---</option>
                {vietnamLocations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.regionName ? `(${p.regionName})` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="hint-text">Chọn tỉnh/thành chính để hệ thống gợi ý lịch trình tự động.</p>
          </div>

          {/* Search / Suggestions */}
          <div className="destinations-search-group input-group">
            <label><FaSearch /> 2. Select Must-Include Places (Optional)</label>
            <input
              type="text"
              placeholder={selectedProvince ? `Search places in ${selectedProvince.name}` : "Select main province first..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              disabled={!selectedProvince}
            />

            {selectedProvince && (searchLoading || (searchResults && searchResults.length > 0) || searchTerm.length >= 2) && (
              <div className="search-results-box">
                {searchLoading && <p className="loading-text">Searching...</p>}

                {!searchLoading && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
                  <p className="no-results">No destinations found in {selectedProvince.name} for "{searchTerm}".</p>
                )}

                {!searchLoading && searchResults.slice(0, 6).map((place) => (
                  <RecommendCard
                    key={place.id}
                    destination={place}
                    mode="select-search"
                    onSelectPlace={() => handleViewDetails(place)}
                  />
                ))}
              </div>
            )}
            {!selectedProvince && <p className="warning-text">Vui lòng chọn tỉnh/thành phố trước khi tìm địa điểm.</p>}
          </div>

          {/* Summary */}
          <div className="destination-summary-group input-group">
            <label><FaMapMarkerAlt /> Trip Summary</label>
            <div className="summary-box">
              <div className="main-province-info">
                <strong>Main Destination:</strong>{" "}
                {selectedProvince ? (
                  <span className="main-province-tag">{selectedProvince.name}</span>
                ) : (
                  <span className="warning-text">Province not yet set.</span>
                )}
              </div>

              <div className="must-include-list">
                <span className="must-include-label">Must-Include Places ({mustIncludeDetails.length}):</span>
                <div className="destination-list">
                  {mustIncludeDetails.map((dest) => (
                    <span key={dest.id} className="destination-item">
                      {dest.name}
                      <button type="button" onClick={() => removePlace(dest.id)}>x</button>
                    </span>
                  ))}
                  {mustIncludeDetails.length === 0 && <p className="hint-text">No priority places selected.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="options-group">
            <div className="option-card">
              <label><FaClock /> Duration (Sets Trip Days)</label>
              <div className="option-pills">
                {durationOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={duration === opt ? "pill selected" : "pill"}
                    onClick={() => setDuration(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaUser /> People</label>
              <div className="option-pills">
                {peopleOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={peopleCount === opt ? "pill selected" : "pill"}
                    onClick={() => setPeopleCount(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaMoneyBillWave /> Budget</label>
              <div className="option-pills">
                {budgetOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={budget === opt ? "pill selected" : "pill"}
                    onClick={() => setBudget(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="form-buttons">
            <button type="submit" disabled={!selectedProvince || !duration}>Generate & Create Trip</button>
            <button type="button" onClick={() => onClose && onClose()} className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && placeToView && (
        <div className="details-modal-overlay">
          <div className="details-modal">
            <RecommendCard
              destination={placeToView}
              mode="select"
              onSelectPlace={() => handleSelectFromDetails(placeToView)}
              onViewDetails={() => {}}
            />
            <button className="close-details-btn" onClick={() => setIsDetailsModalOpen(false)}>
              <FaTimes /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
