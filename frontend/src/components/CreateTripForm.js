// CreateTripForm.js - With 2-column layout and preview destinations
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

export default function CreateTripForm({
  initialDestination = null,
  onClose,
  onTripCreated,
}) {
  // --- Form state ---
  const [tripName, setTripName] = useState("");
  const [duration, setDuration] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [budget, setBudget] = useState("");

  // --- Form ref ---
  const formRef = useRef(null);

  // --- Provinces / locations ---
  const [vietnamLocations, setVietnamLocations] = useState([]);
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(null);

  // --- Must-include places ---
  const [mustIncludeDetails, setMustIncludeDetails] = useState([]);

  // --- Search logic (now only used for filtering preview) ---
  const [searchTerm, setSearchTerm] = useState("");

  // --- Preview destinations (right column) ---
  const [previewDestinations, setPreviewDestinations] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // --- Modal details ---
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [placeToView, setPlaceToView] = useState(null);

  // --- Init guard ---
  const initialLoaded = useRef(false);

  // Options
  const durationOptions = ["1-3 days", "4-7 days", "8-14 days", "15+ days"];
  const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
  const budgetOptions = [
    "< 5 triệu",
    "5-10 triệu",
    "10-20 triệu",
    "> 20 triệu",
  ];

  // =============================================
  // Disable body scroll + custom scroll routing
  // =============================================
  useEffect(() => {
    // Khi mở form → khóa scroll nền
    document.body.style.overflow = "hidden";

    const container = document.querySelector(".create-trip-container");
    const left = document.querySelector(".create-trip-form");
    const right = document.querySelector(".destinations-preview");

    // Xử lý scroll theo vị trí chuột
    const handleWheel = (e) => {
      if (!container || !left || !right) return;

      const containerRect = container.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      // Nếu chuột nằm trong modal -> chặn scroll trang
      if (
        e.clientY > containerRect.top &&
        e.clientY < containerRect.bottom &&
        e.clientX > containerRect.left &&
        e.clientX < containerRect.right
      ) {
        e.preventDefault();

        // Nếu chuột đang nằm trong vùng right preview
        if (
          e.clientX > rightRect.left &&
          e.clientX < rightRect.right && // BỔ SUNG QUAN TRỌNG
          e.clientY > rightRect.top &&
          e.clientY < rightRect.bottom
        ) {
          right.scrollTop += e.deltaY;
        } else {
          left.scrollTop += e.deltaY;
        }
      }
    };

    // Lắng nghe wheel
    window.addEventListener("wheel", handleWheel, { passive: false });

    // Cleanup khi đóng form
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // ---------------------------------------------------------
  // Close form when clicking outside
  // ---------------------------------------------------------
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ---------------------------------------------------------
  // Fetch provinces on mount
  // ---------------------------------------------------------
  useEffect(() => {
    setIsProvinceLoading(true);
    API.get("/locations/vietnam")
      .then((res) => {
        const provinces = [];
        if (Array.isArray(res.data)) {
          res.data.forEach((region, regionIdx) => {
            if (Array.isArray(region.provinces)) {
              region.provinces.forEach((p, idx) => {
                const idStr = String(
                  p.id ??
                    p.province_id ??
                    p.province_name ??
                    `prov-${regionIdx}-${idx}`
                );
                provinces.push({
                  id: idStr,
                  name: p.province_name || p.name || "Unknown",
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
  // Initialize from initialDestination
  // ---------------------------------------------------------
  useEffect(() => {
    if (!initialDestination || vietnamLocations.length === 0) return;
    if (initialLoaded.current) return;

    const {
      id: destId,
      name: destName,
      province_id,
      province_name,
    } = initialDestination;

    // Try match by id
    if (province_id != null) {
      const provIdStr = String(province_id);
      const match = vietnamLocations.find((p) => String(p.id) === provIdStr);
      if (match) {
        setSelectedProvince({ id: match.id, name: match.name });
        setMustIncludeDetails([
          {
            id: destId,
            name: destName,
            province_id: province_id,
            province_name: match.name,
          },
        ]);
        if (!tripName) setTripName(`Khám phá ${destName}`);
        initialLoaded.current = true;
        return;
      }
    }

    // Try match by numeric id
    const numericTry = Number(province_id);
    if (Number.isFinite(numericTry)) {
      // <-- fix: numericTry, not numericId
      const matchNum = vietnamLocations.find((p) => {
        const pid = Number(p.id);
        return Number.isFinite(pid) && pid === numericTry;
      });
      if (matchNum) {
        setSelectedProvince({ id: matchNum.id, name: matchNum.name });
        setMustIncludeDetails([
          {
            id: destId,
            name: destName,
            province_id: numericTry,
            province_name: matchNum.name,
          },
        ]);
        if (!tripName) setTripName(`Khám phá ${destName}`);
        initialLoaded.current = true;
        return;
      }
    }

    // Try match by province_name
    if (province_name) {
      const matchByName = normalizeProvince(province_name, vietnamLocations);
      if (matchByName) {
        setSelectedProvince({ id: matchByName.id, name: matchByName.name });
        const pid = Number(matchByName.id);
        setMustIncludeDetails([
          {
            id: destId,
            name: destName,
            province_id: Number.isFinite(pid) ? pid : matchByName.id,
            province_name: matchByName.name,
          },
        ]);
        if (!tripName) setTripName(`Khám phá ${destName}`);
        initialLoaded.current = true;
        return;
      }
    }

    if (!tripName && destName) setTripName(`Khám phá ${destName}`);
    initialLoaded.current = true;
  }, [initialDestination, vietnamLocations, tripName]);

  // ---------------------------------------------------------
  // Load preview destinations when province changes
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedProvince) {
      setPreviewDestinations([]);
      return;
    }

    setIsLoadingPreview(true);

    // ⭐ Sử dụng thuật toán search của ExplorePage
    const provinceName = selectedProvince.name.trim();
    const queryUrl = `/destinations?search=${encodeURIComponent(
      provinceName
    )}&top=20`;

    console.log(">>> Fetching destinations with:", queryUrl);

    API.get(queryUrl)
      .then((res) => {
        if (Array.isArray(res.data)) {
          const onlySameProvince = res.data.filter(
            (p) =>
              normalize(p.province_name) === normalize(selectedProvince.name)
          );

          setPreviewDestinations(onlySameProvince);
        } else {
          setPreviewDestinations([]);
        }
      })
      .catch(() => {
        setPreviewDestinations([]);
      })
      .finally(() => setIsLoadingPreview(false));
  }, [selectedProvince]);

  // ---------------------------------------------------------
  // When selectedProvince changes: load preview destinations
  // (Removed auto-suggest search results logic as search is now in preview)
  // ---------------------------------------------------------

  // ---------------------------------------------------------
  // Clear search when province changes
  // ---------------------------------------------------------
  useEffect(() => {
    setSearchTerm("");
  }, [selectedProvince]);

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
    const found = vietnamLocations.find((p) => p.id === val);
    if (!found) {
      toast.error("Tỉnh/Thành không hợp lệ.");
      return;
    }

    setMustIncludeDetails((prev) =>
      prev.filter((d) => {
        const dPid = d.province_id != null ? String(d.province_id) : "";
        const foundId = String(found.id);
        const pnameMatch = d.province_name
          ? normalize(d.province_name) === normalize(found.name)
          : false;
        return dPid === foundId || pnameMatch;
      })
    );

    setSelectedProvince({ id: found.id, name: found.name });
  };

  const addPlaceToMustInclude = (place) => {
    if (!selectedProvince) {
      toast.error("Chọn tỉnh chính trước.");
      return;
    }

    const placePid = place.province_id != null ? String(place.province_id) : "";
    const selectedPid = String(selectedProvince.id);
    const nameMatch = place.province_name
      ? normalize(place.province_name) === normalize(selectedProvince.name)
      : false;
    const placeBelongs = placePid === selectedPid || nameMatch;

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
      {
        id: place.id,
        name: place.name,
        province_id: place.province_id,
        province_name: place.province_name,
      },
    ]);
    toast.success(`Đã thêm ${place.name}`);
    // setSearchTerm("");
    // setSearchResults([]);
  };

  const removePlace = (placeId) => {
    setMustIncludeDetails((prev) =>
      prev.filter((d) => String(d.id) !== String(placeId))
    );
  };

  const handleViewDetails = (place) => {
    setPlaceToView(place);
    setIsDetailsModalOpen(true);
  };

  const handleSelectFromDetails = (place) => {
    addPlaceToMustInclude(place);
    setIsDetailsModalOpen(false);
  };

  // ---------------------------------------------------------
  // Submit trip (FIXED - always send province_id or province_name)
  // ---------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!tripName?.trim()) {
      toast.error("Vui lòng nhập tên chuyến đi.");
      return;
    }
    if (!selectedProvince) {
      toast.error("Vui lòng chọn tỉnh/thành chính cho chuyến đi.");
      return;
    }
    if (!duration) {
      toast.error("Vui lòng chọn thời lượng chuyến đi.");
      return;
    }

    const durationDays = extractDurationDays(duration);
    if (durationDays === 0) {
      toast.error("Thời lượng không hợp lệ.");
      return;
    }

    const loadingToast = toast.info("Đang tạo lộ trình...", {
      autoClose: false,
    });

    // FIXED: Always send province_id or province_name
    let provinceData = {};
    const provinceIdNum = Number(selectedProvince.id);
    if (
      selectedProvince.id &&
      Number.isFinite(provinceIdNum) &&
      provinceIdNum > 0
    ) {
      provinceData.province_id = provinceIdNum;
    } else if (selectedProvince.name) {
      provinceData.province_name = selectedProvince.name.trim();
    } else {
      toast.dismiss(loadingToast);
      toast.error("Không xác định được tỉnh/thành!");
      return;
    }

    const payload = {
      name: tripName.trim(),
      ...provinceData,
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
        toast.dismiss(loadingToast);
        toast.success(
          `Chuyến đi "${created?.name ?? payload.name}" đã tạo thành công!`,
          {
            autoClose: 3000,
          }
        );
        if (onTripCreated) onTripCreated(created);
        if (onClose) onClose();
      })
      .catch((err) => {
        console.error("Create trip error", err);
        toast.dismiss(loadingToast);
        const msg = err?.response?.data?.message || "Tạo chuyến đi thất bại.";
        toast.error(msg, { autoClose: 5000 });
      });
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  return (
    <div className="modal-overlay">
      <div className="create-trip-container" ref={formRef}>
        {/* LEFT COLUMN: FORM */}
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
              <label>
                <FaGlobe /> Select Main Province (Trip Focus)
              </label>
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
              <p className="hint-text">
                Chọn tỉnh/thành chính để hệ thống gợi ý lịch trình tự động.
              </p>
            </div>

            {/* Summary */}
            <div className="destination-summary-group input-group">
              <label>
                <FaMapMarkerAlt /> Trip Summary
              </label>
              <div className="summary-box">
                <div className="main-province-info">
                  <strong>Main Destination:</strong>{" "}
                  {selectedProvince ? (
                    <span className="main-province-tag">
                      {selectedProvince.name}
                    </span>
                  ) : (
                    <span className="warning-text">Province not yet set.</span>
                  )}
                </div>

                <div className="must-include-list">
                  <span className="must-include-label">
                    Must-Include Places ({mustIncludeDetails.length}):
                  </span>
                  <div className="destination-list">
                    {mustIncludeDetails.map((dest) => (
                      <span key={dest.id} className="destination-item">
                        {dest.name}
                        <button
                          type="button"
                          onClick={() => removePlace(dest.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {mustIncludeDetails.length === 0 && (
                      <p className="hint-text">No priority places selected.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="options-group">
              <div className="option-card">
                <label>
                  <FaClock /> Duration (Sets Trip Days)
                </label>
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
                <label>
                  <FaUser /> People
                </label>
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
                <label>
                  <FaMoneyBillWave /> Budget
                </label>
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
              <button type="submit" disabled={!selectedProvince || !duration}>
                Generate & Create Trip
              </button>
              <button
                type="button"
                onClick={() => onClose && onClose()}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: DESTINATIONS PREVIEW */}
        <div className="destinations-preview">
          <h3 className="dark">
            <FaMapMarkerAlt />
            {selectedProvince
              ? `Destinations in ${selectedProvince.name}`
              : "Select a Province"}
          </h3>

          {/* Search box in right column */}
          {selectedProvince && (
            <div className="preview-search-group">
              <div className="preview-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder={`Search places in ${selectedProvince.name}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="preview-search-input"
                />
              </div>
            </div>
          )}

          {!selectedProvince && (
            <div className="empty-preview">
              <div className="empty-preview-icon">
                <FaMapMarkerAlt />
              </div>
              <p>Select a province to see available destinations</p>
            </div>
          )}

          {selectedProvince && isLoadingPreview && (
            <div className="empty-preview">
              <p>Loading destinations...</p>
            </div>
          )}

          {selectedProvince &&
            !isLoadingPreview &&
            previewDestinations.length === 0 && (
              <div className="empty-preview">
                <p>No destinations found in {selectedProvince.name}</p>
              </div>
            )}

          {selectedProvince &&
            !isLoadingPreview &&
            previewDestinations.length > 0 &&
            (() => {
              // Filter destinations based on search term
              const filteredDestinations =
                searchTerm.trim().length > 0
                  ? previewDestinations.filter((dest) =>
                      normalize(dest.name).includes(
                        normalize(searchTerm.trim())
                      )
                    )
                  : previewDestinations;

              return filteredDestinations.length > 0 ? (
                <div className="preview-grid">
                  {filteredDestinations.map((dest) => (
                    <RecommendCard
                      key={dest.id}
                      destination={dest}
                      mode="select"
                      onSelectPlace={() => addPlaceToMustInclude(dest)}
                      onViewDetails={() => handleViewDetails(dest)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-preview">
                  <p>No destinations match "{searchTerm}"</p>
                </div>
              );
            })()}
        </div>
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
            <button
              className="close-details-btn"
              onClick={() => setIsDetailsModalOpen(false)}
            >
              <FaTimes /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
