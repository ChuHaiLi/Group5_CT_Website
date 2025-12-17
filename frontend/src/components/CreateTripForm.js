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

/** Helper: map budget label -> max VND amount */
const extractMaxBudget = (budgetStr) => {
  if (!budgetStr) return 0;
  if (budgetStr.includes("500k VND")) return 500000;
  if (budgetStr.includes("1 milions VND")) return 1000000;
  if (budgetStr.includes("2 milions VND")) return 2000000;
  if (budgetStr.includes(">")) return 1000000000; // 1 tỷ VND cho trường hợp lớn hơn
  return 0;
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

/** * [UPDATED] Central Cost Calculation Function 
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

export default function CreateTripForm({
  initialDestination = null,
  onClose,
  onTripCreated,
}) {
  // --- Form state ---
  const [tripName, setTripName] = useState("");
  const [duration, setDuration] = useState("");
  const [peopleCount, setPeopleCount] = useState("1 person"); // Set default
  const [budget, setBudget] = useState("");

  // --- Form ref ---
  const formRef = useRef(null);

  // --- Provinces / locations ---
  const [vietnamLocations, setVietnamLocations] = useState([]);
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(null);

  // --- Must-include places (Destinations) ---
  const [mustIncludeDetails, setMustIncludeDetails] = useState([]);
  // [UPDATED] selectedHotel now stores entry_fee as cost field
  const [selectedHotel, setSelectedHotel] = useState(null); 
  const [currentTotalCost, setCurrentTotalCost] = useState(0);

  // --- Search logic (now only used for filtering preview) ---
  const [searchTerm, setSearchTerm] = useState("");

  // --- Preview locations (right column) ---
  const [isViewingHotels, setIsViewingHotels] = useState(false);

  // Central store for ALL destinations in the province
  const [allDestinationsInProvince, setAllDestinationsInProvince] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Filtered lists derived from allDestinationsInProvince
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
  // Initialize from initialDestination (Cập nhật để lấy entry_fee)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!initialDestination || vietnamLocations.length === 0) return;
    if (initialLoaded.current) return;

    const {
      id: destId,
      name: destName,
      province_id,
      province_name,
      entry_fee, // [CHANGE] Lấy entry_fee
    } = initialDestination;

    const matchAndSet = (matchProv, isHotel = false) => {
      setSelectedProvince({ id: matchProv.id, name: matchProv.name });
      const placeDetail = {
        id: destId,
        name: destName,
        province_id: initialDestination.province_id || matchProv.id,
        province_name: matchProv.name,
        type: initialDestination.type || "Destination",
        entry_fee: entry_fee || 0, // [CHANGE] Lưu entry_fee
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
  // [NEW] Check Budget compatibility when Budget/People change (Kiểm tra ngược)
  // ---------------------------------------------------------
  useEffect(() => {
    const maxBudget = extractMaxBudget(budget);
    const people = peopleCount;
    const dur = duration;
    
    // Chỉ kiểm tra khi có budget được chọn và đã có địa điểm/khách sạn
    if (maxBudget > 0 && (mustIncludeDetails.length > 0 || selectedHotel)) {
      const calculatedCost = calculateTotalCost(
        mustIncludeDetails,
        selectedHotel,
        dur,
        people
      );

      if (calculatedCost > maxBudget) {
        toast.warn(
          `CẢNH BÁO: Ngân sách "${budget}" đã chọn (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND) không đủ cho các địa điểm/nơi ở bắt buộc đã chọn (${new Intl.NumberFormat('vi-VN').format(calculatedCost)} VND). Vui lòng điều chỉnh ngân sách hoặc xóa bớt địa điểm.`,
          {
            toastId: "budget-mismatch-warning",
            autoClose: 8000,
          }
        );
      }
    }
  }, [budget, peopleCount, mustIncludeDetails, selectedHotel, duration]);

  // ---------------------------------------------------------
  // [NEW] Calculate Total Cost
  // ---------------------------------------------------------
  useEffect(() => {
    const totalCost = calculateTotalCost(
      mustIncludeDetails,
      selectedHotel,
      duration,
      peopleCount
    );
    setCurrentTotalCost(totalCost);
  }, [mustIncludeDetails, selectedHotel, peopleCount, duration]);

  // ---------------------------------------------------------
  // Load ALL destinations when province changes (Cập nhật để lấy entry_fee)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedProvince) {
      setAllDestinationsInProvince([]);
      return;
    }

    setIsLoadingPreview(true);

    const provinceName = selectedProvince.name.trim();
    const queryUrl = `/destinations?search=${encodeURIComponent(
      provinceName
    )}&top=100`;

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
              type: p.type || "Destination",
              entry_fee: p.entry_fee || 0, // [CHANGE] Ensure entry_fee is saved
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
  // Client-side filtering effect (Giữ nguyên)
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
  // Handlers
  // ---------------------------------------------------------
  const handleToggleHotels = () => {
    setIsViewingHotels((prev) => !prev);
    setSearchTerm("");
  };

  // [NEW] Check required fields before Province Change is allowed
  const isPrerequisiteMet = duration && peopleCount && budget;

  const handleProvinceChange = (e) => {
    if (!isPrerequisiteMet) {
      toast.error("Vui lòng chọn Thời lượng, Số người và Ngân sách trước.");
      return;
    }
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

    // Logic filter must-include (giữ nguyên, nhưng không cần check budget ở đây)
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

  // [UPDATED] Add place with Budget Check (using entry_fee)
  const addPlaceToMustInclude = (place) => {
    if (!selectedProvince) {
      toast.error("Chọn tỉnh chính trước.");
      return;
    }
    if (!isPrerequisiteMet) {
      toast.error("Vui lòng chọn đầy đủ Thời lượng, Số người và Ngân sách.");
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
    // [CHANGE] Use entry_fee
    const placeCost = Number(place.entry_fee) || 0; 
    const maxBudget = extractMaxBudget(budget);
    
    // --- TÍNH TOÁN CHI PHÍ TIỀM NĂNG ---
    let tempMustIncludeDetails = isHotel 
      ? mustIncludeDetails 
      : mustIncludeDetails.some((d) => String(d.id) === String(place.id)) 
        ? mustIncludeDetails // Duplicate check
        // [CHANGE] Add entry_fee to temp object
        : [...mustIncludeDetails, { ...place, entry_fee: placeCost }];
    
    let tempSelectedHotel = isHotel
      // [CHANGE] Add entry_fee to temp object
      ? { ...place, entry_fee: placeCost }
      : selectedHotel;
      
    if (!isHotel && selectedHotel) {
      // Nếu là Destination mới, không làm thay đổi selectedHotel, chỉ kiểm tra trùng lặp trước
      if (mustIncludeDetails.some((d) => String(d.id) === String(place.id))) {
        toast.info(`${place.name} đã tồn tại trong danh sách Địa điểm.`);
        return; // Early exit if duplicate
      }
    }

    const potentialCost = calculateTotalCost(
      tempMustIncludeDetails,
      tempSelectedHotel,
      duration,
      peopleCount
    );

    // --- KIỂM TRA NGÂN SÁCH ---
    if (maxBudget > 0 && potentialCost > maxBudget) {
      toast.error(
        `Không thể thêm "${place.name}". Tổng chi phí ước tính mới (${new Intl.NumberFormat('vi-VN').format(potentialCost)} VND) vượt quá Ngân sách tối đa (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND).`
      );
      return;
    }

    // --- THÊM THỰC TẾ (Nếu vượt qua kiểm tra) ---
    if (isHotel) {
      setSelectedHotel({
        id: place.id,
        name: place.name,
        province_id: place.province_id,
        province_name: place.province_name,
        type: "Hotel",
        entry_fee: placeCost, // [CHANGE] LƯU entry_fee
      });
      toast.success(`Đã chọn ${place.name} làm Nơi ở chính.`);
      return;
    }

    // Nếu là Destination (đã kiểm tra trùng lặp ở trên)
    setMustIncludeDetails((prev) => [
      ...prev,
      {
        id: place.id,
        name: place.name,
        province_id: place.province_id,
        province_name: place.province_name,
        type: place.type || "Destination",
        entry_fee: placeCost, // [CHANGE] LƯU entry_fee
      },
    ]);
    toast.success(`Đã thêm ${place.name} vào danh sách Địa điểm.`);
  };

  // [UPDATED] Remove place (still need to update cost state via useEffect)
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

  // handleSubmit (Giữ nguyên logic API)
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!tripName?.trim() || !selectedProvince || !duration || !startDate || !peopleCount || !budget) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    const durationDays = extractDurationDays(duration);
    if (durationDays === 0) {
      toast.error("Thời lượng không hợp lệ.");
      return;
    }
    
    // Kiểm tra budget lần cuối trước khi submit
    const maxBudget = extractMaxBudget(budget);
    if (maxBudget > 0 && currentTotalCost > maxBudget) {
        toast.error(`Tổng chi phí ước tính (${new Intl.NumberFormat('vi-VN').format(currentTotalCost)} VND) vượt quá Ngân sách tối đa (${new Intl.NumberFormat('vi-VN').format(maxBudget)} VND). Vui lòng điều chỉnh trước khi tạo chuyến đi.`);
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
      max_budget: maxBudget,
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
        {/* LEFT COLUMN: FORM */}
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

            {/* Start Date (Moved Up) */}
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
            
            {/* Options Group (Duration, People, Budget - Moved Up) */}
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
                  <FaMoneyBillWave /> Budget / Person
                </label>
                <div className="option-pills">
                  {budgetOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={budget === opt ? "pill selected" : "pill"}
                      onClick={() => setBudget(opt)}
                      required // Mark as required for validation
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Province select (Conditional Render) */}
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
                  disabled={!isPrerequisiteMet} // [NEW] Disable until prerequisites are met
                >
                  <option value="">--- Select a Province/City ---</option>
                  {vietnamLocations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.regionName ? `(${p.regionName})` : ""}
                    </option>
                  ))}
                </select>
              )}
              {!isPrerequisiteMet && (
                <p className="warning-text">
                  **Vui lòng chọn Thời lượng, Số người & Ngân sách trước.**
                </p>
              )}
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
                
                {/* [NEW] Total Cost Display */}
                {isPrerequisiteMet && (
                    <div className="total-cost-info">
                        <strong>Estimated Total Cost:</strong>
                        <span className={
                            extractMaxBudget(budget) > 0 && currentTotalCost > extractMaxBudget(budget) 
                            ? "cost-warning" 
                            : "cost-normal"
                        }>
                            {new Intl.NumberFormat('vi-VN').format(currentTotalCost)} VND
                            {extractMaxBudget(budget) > 0 && ` (Max Budget: ${new Intl.NumberFormat('vi-VN').format(extractMaxBudget(budget))} VND)`}
                        </span>
                    </div>
                )}
                
                <div className="must-include-list">
                  <span className="must-include-label">
                    Priority Destinations:
                  </span>
                  <div className="destination-list">
                    {mustIncludeDetails.map((dest) => (
                      <span key={dest.id} className="destination-item">
                        {dest.name}
                        {/* [NEW] Show fee if available */}
                        {dest.entry_fee > 0 && (
                            <span className="destination-fee">
                                ({new Intl.NumberFormat('vi-VN').format(dest.entry_fee)} VND)
                            </span>
                        )}
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
                      {/* [NEW] Show hotel nightly fee if available */}
                      {selectedHotel.entry_fee > 0 && (
                          ` (${new Intl.NumberFormat('vi-VN').format(selectedHotel.entry_fee)} VND/night)`
                      )}
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
              <button 
                type="submit" 
                disabled={!selectedProvince || !duration || !peopleCount || !budget || (extractMaxBudget(budget) > 0 && currentTotalCost > extractMaxBudget(budget))} // Disable if budget exceeded
              >
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

          {/* Search box and Hotel Toggle in right column (Conditional Render) */}
          {selectedProvince && isPrerequisiteMet && (
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
                disabled={!selectedProvince || isLoadingPreview}
              >
                <FaHotel style={{ marginRight: '5px' }} />
                {isViewingHotels ? 'Back to Places' : 'Hotels'}
              </button>
            </div>
          )}

          {!isPrerequisiteMet && (
            <div className="empty-preview">
                <div className="empty-preview-icon">
                    <FaMoneyBillWave /> <FaUser /> <FaClock />
                </div>
                <p>Complete the Duration, People, and Budget fields first.</p>
            </div>
          )}
          
          {selectedProvince && !isPrerequisiteMet && (
              <div className="empty-preview">
                <p>Now select the main province/city above.</p>
              </div>
          )}

          {selectedProvince && isPrerequisiteMet && isLoadingPreview && (
            <div className="empty-preview">
              <p>Loading all destinations...</p>
            </div>
          )}

          {selectedProvince &&
            isPrerequisiteMet &&
            !isLoadingPreview &&
            (() => {
              // 1. CHỌN DANH SÁCH GỐC DỰA TRÊN TAB
              const listToFilter = isViewingHotels
                ? hotelPreviewList 
                : previewDestinations;

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

              // 2. LỌC THEO SEARCH TERM
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