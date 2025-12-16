import React, { useEffect, useRef, useState } from "react";
import {
  FaClock,
  FaUser,
  FaMoneyBillWave,
  FaMapMarkerAlt,
  FaSearch,
  FaGlobe,
  FaTimes,
  FaHotel, // Icon Hotel
  FaBed, // Icon cho Nơi ở
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

  // --- Must-include places (Destinations) ---
  const [mustIncludeDetails, setMustIncludeDetails] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);

  // --- Search logic (now only used for filtering preview) ---
  const [searchTerm, setSearchTerm] = useState("");

  // --- Preview locations (right column) ---
  const [isViewingHotels, setIsViewingHotels] = useState(false);

  // [NEW] Central store for ALL destinations in the province
  const [allDestinationsInProvince, setAllDestinationsInProvince] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // [NEW] Filtered lists derived from allDestinationsInProvince
  const [previewDestinations, setPreviewDestinations] = useState([]);
  const [hotelPreviewList, setHotelPreviewList] = useState([]);


  // --- Modal details ---
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [placeToView, setPlaceToView] = useState(null);
  const [startDate, setStartDate] = useState("");

  // --- Init guard ---
  const initialLoaded = useRef(false);


  // Options (Giữ nguyên)
  const durationOptions = ["1-3 days", "4-7 days", "8-14 days", "15+ days"];
  const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
  const budgetOptions = [
    "< 500k VND",
    "500K - 1 milions VND",
    "1 - 2 milions VND",
    "> 2 milions VND",
  ];

  // =============================================
  // Scroll Logic (Giữ nguyên)
  // =============================================
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const container = document.querySelector(".create-trip-container");
    const left = document.querySelector(".create-trip-form");
    const right = document.querySelector(".destinations-preview");
    const handleWheel = (e) => {
      if (!container || !left || !right) return;
      const containerRect = container.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      if (
        e.clientY > containerRect.top &&
        e.clientY < containerRect.bottom &&
        e.clientX > containerRect.left &&
        e.clientX < containerRect.right
      ) {
        e.preventDefault();
        if (
          e.clientX > rightRect.left &&
          e.clientX < rightRect.right &&
          e.clientY > rightRect.top &&
          e.clientY < rightRect.bottom
        ) {
          right.scrollTop += e.deltaY;
        } else {
          left.scrollTop += e.deltaY;
        }
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // ---------------------------------------------------------
  // Close form when clicking outside (Giữ nguyên)
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
  // Fetch provinces on mount (Giữ nguyên)
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
  // Initialize from initialDestination (Giữ nguyên)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!initialDestination || vietnamLocations.length === 0) return;
    if (initialLoaded.current) return;

    const { id: destId, name: destName, province_id, province_name } = initialDestination;

    const matchAndSet = (matchProv, isHotel = false) => {
      setSelectedProvince({ id: matchProv.id, name: matchProv.name });
      const placeDetail = {
        id: destId,
        name: destName,
        province_id: initialDestination.province_id || matchProv.id,
        province_name: matchProv.name,
        type: initialDestination.type || "Destination",
      };

      if (isHotel || placeDetail.type === "Hotel") {
        setSelectedHotel(placeDetail);
      } else {
        setMustIncludeDetails([placeDetail]);
      }

      if (!tripName && destName) setTripName(`Khám phá ${destName}`);
      initialLoaded.current = true;
    };

    // ... (Logic matching province by ID or name) ...
    
    // Try match by id
    if (province_id != null) {
      const provIdStr = String(province_id);
      const match = vietnamLocations.find((p) => String(p.id) === provIdStr);
      if (match) {
        matchAndSet(match, initialDestination.type === "Hotel");
        return;
      }
    }

    // Try match by numeric id
    const numericTry = Number(province_id);
    if (Number.isFinite(numericTry)) {
      const matchNum = vietnamLocations.find((p) => {
        const pid = Number(p.id);
        return Number.isFinite(pid) && pid === numericTry;
      });
      if (matchNum) {
        matchAndSet(matchNum, initialDestination.type === "Hotel");
        return;
      }
    }

    // Try match by province_name
    if (province_name) {
      const matchByName = normalizeProvince(province_name, vietnamLocations);
      if (matchByName) {
        matchAndSet(matchByName, initialDestination.type === "Hotel");
        return;
      }
    }

    if (!tripName && destName) setTripName(`Khám phá ${destName}`);
    initialLoaded.current = true;
  }, [initialDestination, vietnamLocations, tripName]);

  // ---------------------------------------------------------
  // [CẬP NHẬT] Load ALL destinations when province changes
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedProvince) {
      setAllDestinationsInProvince([]);
      return;
    }

    setIsLoadingPreview(true);

    const provinceName = selectedProvince.name.trim();
    // GỌI API ĐỂ LẤY TẤT CẢ DESTINATIONS, KỂ CẢ HOTEL
    const queryUrl = `/destinations?search=${encodeURIComponent(
      provinceName
    )}&top=100`; // Tăng top để đảm bảo lấy đủ

    console.log(">>> Fetching ALL destinations with:", queryUrl);

    API.get(queryUrl)
      .then((res) => {
        if (Array.isArray(res.data)) {
          const onlySameProvince = res.data
            .filter(
              (p) =>
                normalize(p.province_name) === normalize(selectedProvince.name)
            )
            .map((p) => ({
              ...p,
              type: p.type || "Destination", // Đảm bảo có type
            }));

          setAllDestinationsInProvince(onlySameProvince);
        } else {
          setAllDestinationsInProvince([]);
        }
      })
      .catch(() => {
        setAllDestinationsInProvince([]);
      })
      .finally(() => setIsLoadingPreview(false));
  }, [selectedProvince]);

  // ---------------------------------------------------------
  // [NEW] Client-side filtering effect
  // ---------------------------------------------------------
  useEffect(() => {
    const hotels = allDestinationsInProvince.filter(
      (p) => p.type === "Hotel"
    );
    const regularDestinations = allDestinationsInProvince.filter(
      (p) => p.type !== "Hotel"
    );

    setHotelPreviewList(hotels);
    setPreviewDestinations(regularDestinations);
  }, [allDestinationsInProvince]);

  // ---------------------------------------------------------
  // Clear search when province changes (Giữ nguyên)
  // ---------------------------------------------------------
  useEffect(() => {
    setSearchTerm("");
    setIsViewingHotels(false);
  }, [selectedProvince]);

  // ---------------------------------------------------------
  // Handlers (Tối ưu hóa)
  // ---------------------------------------------------------
  const handleToggleHotels = () => {
    // Không cần fetch Hotels nữa, chỉ cần chuyển đổi view state
    setIsViewingHotels((prev) => !prev);
    setSearchTerm("");
  };

  const handleProvinceChange = (e) => {
    // ... (Logic province change giữ nguyên) ...
    const val = e.target.value;
    if (!val) {
      setSelectedProvince(null);
      setMustIncludeDetails([]);
      setSelectedHotel(null);
      return;
    }
    const found = vietnamLocations.find((p) => p.id === val);
    if (!found) {
      toast.error("Tỉnh/Thành không hợp lệ.");
      return;
    }

    const filterMustInclude = (list) =>
      list.filter((d) => {
        const dPid = d.province_id != null ? String(d.province_id) : "";
        const foundId = String(found.id);
        const pnameMatch = d.province_name
          ? normalize(d.province_name) === normalize(found.name)
          : false;
        return dPid === foundId || pnameMatch;
      });

    setMustIncludeDetails((prev) => filterMustInclude(prev));

    if (selectedHotel) {
      const hotelPid =
        selectedHotel.province_id != null ? String(selectedHotel.province_id) : "";
      const selectedPid = String(found.id);
      const nameMatch = selectedHotel.province_name
        ? normalize(selectedHotel.province_name) === normalize(found.name)
        : false;

      if (!(hotelPid === selectedPid || nameMatch)) {
        setSelectedHotel(null);
        toast.info("Nơi ở đã chọn bị xóa vì không thuộc tỉnh/thành mới.");
      }
    }

    setSelectedProvince({ id: found.id, name: found.name });
  };
  
  // Logic addPlaceToMustInclude, removePlace, handleViewDetails, handleSelectFromDetails (Giữ nguyên)
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

    const isHotel = place.type === "Hotel";

    if (isHotel) {
      if (selectedHotel && String(selectedHotel.id) === String(place.id)) {
        toast.info(`${place.name} đã được chọn làm Nơi ở.`);
        return;
      }

      setSelectedHotel({
        id: place.id,
        name: place.name,
        province_id: place.province_id,
        province_name: place.province_name,
        type: "Hotel",
      });
      toast.success(`Đã chọn ${place.name} làm Nơi ở chính.`);
      return;
    }

    if (mustIncludeDetails.some((d) => String(d.id) === String(place.id))) {
      toast.info(`${place.name} đã tồn tại trong danh sách Địa điểm.`);
      return;
    }

    setMustIncludeDetails((prev) => [
      ...prev,
      {
        id: place.id,
        name: place.name,
        province_id: place.province_id,
        province_name: place.province_name,
        type: place.type || "Destination",
      },
    ]);
    toast.success(`Đã thêm ${place.name} vào danh sách Địa điểm.`);
  };

  const removePlace = (placeId, isHotel = false) => {
    if (isHotel) {
      if (selectedHotel && String(selectedHotel.id) === String(placeId)) {
        setSelectedHotel(null);
        toast.info("Đã xóa Nơi ở đã chọn.");
      }
    } else {
      setMustIncludeDetails((prev) => {
        const list = prev.filter((d) => String(d.id) !== String(placeId));
        toast.info("Đã xóa địa điểm.");
        return list;
      });
    }
  };

  const handleViewDetails = (place) => {
    setPlaceToView(place);
    setIsDetailsModalOpen(true);
  };

  const handleSelectFromDetails = (place) => {
    addPlaceToMustInclude(place);
    setIsDetailsModalOpen(false);
  };
  
  // handleSubmit (Giữ nguyên)
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!tripName?.trim() || !selectedProvince || !duration || !startDate) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc.");
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

    const mustIncludeDestinationIds = mustIncludeDetails.map((d) => d.id);
    const mustIncludeHotelId = selectedHotel ? [selectedHotel.id] : [];
    
    const allMustIncludePlaceIds = [
      ...mustIncludeDestinationIds,
      ...mustIncludeHotelId,
    ];

    const payload = {
      name: tripName.trim(),
      ...provinceData,
      duration: durationDays,
      start_date: startDate,
      must_include_place_ids: allMustIncludePlaceIds,
      metadata: {
        people: peopleCount || null,
        budget: budget || null,
        primary_accommodation_id: selectedHotel?.id || null, 
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
        {/* LEFT COLUMN: FORM (Giữ nguyên) */}
        <div className="create-trip-form">
          <h2 className="form-header">Create a Trip</h2>

          <form onSubmit={handleSubmit}>
            {/* Trip name */}
            <div className="create-trip-form-input-group">
              <input
                type="text"
                placeholder="Trip Name"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="trip-name-input"
                required
              />
            </div>

            <div className="create-trip-form-input-group date-select-group">
              <label>
                <FaClock /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="start-date-input"
                required
              />
              <p className="hint-text">Chọn ngày bạn dự định bắt đầu chuyến đi.</p>
            </div>

            {/* Province select */}
            <div className="province-select-group create-trip-form-input-group">
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

            {/* Must-Include Places Summary */}
            <div className="destination-summary-group create-trip-form-input-group">
              <label>
                <FaMapMarkerAlt /> Must-Include Places ({mustIncludeDetails.length})
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
                    Priority Destinations:
                  </span>
                  <div className="destination-list">
                    {mustIncludeDetails.map((dest) => (
                      <span key={dest.id} className="destination-item">
                        {dest.name}
                        <button
                          type="button"
                          onClick={() => removePlace(dest.id, false)}
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
              {/* Duration */}
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

              {/* People */}
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

              {/* Budget */}
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
            
            {/* Hotel Selection Input/Summary (Dưới cùng của form) */}
            <div className="hotel-selection-group create-trip-form-input-group">
                <label>
                    <FaBed /> Primary Accommodation
                </label>
                <div className="summary-box hotel-summary-box">
                    {selectedHotel ? (
                        <div className="selected-hotel-info">
                            <span className="hotel-name-tag">
                                <FaHotel style={{ marginRight: '5px', color: '#107c10' }} />
                                {selectedHotel.name}
                            </span>
                            <p className="hint-text">
                                Selected in {selectedHotel.province_name}
                            </p>
                            <button
                                type="button"
                                className="remove-hotel-btn"
                                onClick={() => removePlace(selectedHotel.id, true)}
                            >
                                <FaTimes /> Remove
                            </button>
                        </div>
                    ) : (
                        <div className="empty-preview hotel-empty">
                            <p className="hint-text">
                                No hotel selected. Use the "Hotels" tab on the right to choose your primary stay.
                            </p>
                        </div>
                    )}
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
              ? isViewingHotels
                ? `Accommodation in ${selectedProvince.name}`
                : `Destinations in ${selectedProvince.name}`
              : "Select a Province"}
          </h3>

          {/* Search box and Hotel Toggle in right column */}
          {selectedProvince && (
            <div className="preview-controls-group">
              <div className="preview-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder={`Search ${
                    isViewingHotels ? "hotels" : "places"
                  } in ${selectedProvince.name}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="preview-search-input"
                />
              </div>

              {/* Hotel Toggle Button */}
              <button
                type="button"
                className={`hotel-toggle-btn ${isViewingHotels ? "selected" : ""}`}
                onClick={handleToggleHotels}
                // [CẬP NHẬT] Disabled chỉ dựa trên isLoadingPreview
                disabled={!selectedProvince || isLoadingPreview}
              >
                <FaHotel style={{ marginRight: '5px' }} />
                {isViewingHotels ? 'Back to Places' : 'Hotels'}
              </button>
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
              <p>Loading all destinations...</p>
            </div>
          )}

          {selectedProvince &&
            !isLoadingPreview &&
            (() => {
              // 1. CHỌN DANH SÁCH GỐC DỰA TRÊN TAB
              const listToFilter = isViewingHotels
                ? hotelPreviewList // Chứa tất cả Hotels
                : previewDestinations; // Chứa tất cả Destinations (không phải Hotel)

              if (!Array.isArray(listToFilter) || listToFilter.length === 0) {
                 return (
                    <div className="empty-preview">
                        <p>
                            No {isViewingHotels ? 'hotels' : 'destinations'} found in{" "}
                            {selectedProvince.name}
                        </p>
                    </div>
                 );
             }

              // 2. LỌC THEO SEARCH TERM (Áp dụng cho cả 2 danh sách)
              const filteredList =
                searchTerm.trim().length > 0
                  ? listToFilter.filter((item) =>
                      normalize(item.name).includes(
                        normalize(searchTerm.trim())
                      )
                    )
                  : listToFilter;

              return filteredList.length > 0 ? (
                <div className="preview-grid">
                  {filteredList.map((item) => (
                    <RecommendCard
                      key={item.id}
                      destination={item}
                      mode="select"
                      onSelectPlace={() => addPlaceToMustInclude(item)}
                      onViewDetails={() => handleViewDetails(item)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-preview">
                  <p>
                    No {isViewingHotels ? 'hotels' : 'destinations'} match "
                    {searchTerm}"
                  </p>
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