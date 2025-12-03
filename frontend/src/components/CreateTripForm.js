import React, { useState, useEffect, useRef } from "react";
import { FaClock, FaUser, FaMoneyBillWave, FaMapMarkerAlt, FaSearch } from "react-icons/fa";
import RecommendCard from "../pages/Home/Recommendations/RecommendCard"; 
import API from "../untils/axios"; 
import { toast } from "react-toastify"; 
import "./CreateTripForm.css";

// Hàm tiện ích để trích xuất số ngày từ chuỗi Duration
const extractDurationDays = (durationStr) => {
  if (durationStr === "1-3 days") return 3;
  if (durationStr === "4-7 days") return 7;
  if (durationStr === "8-14 days") return 14;
  if (durationStr === "15+ days") return 15;
  return 0;
};

export default function CreateTripForm({ initialDestination = null, onClose, onTripCreated }) {
  // State Form Chính
  const [tripName, setTripName] = useState("");
  const [duration, setDuration] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [budget, setBudget] = useState("");
  
  // State cho Tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // State lưu trữ Địa điểm theo ID
  const [selectedMainProvinceId, setSelectedMainProvinceId] = useState(null);
  const [selectedMainProvinceName, setSelectedMainProvinceName] = useState("");
  const [mustIncludePlaceIds, setMustIncludePlaceIds] = useState([]);
  const [mustIncludePlaceDetails, setMustIncludePlaceDetails] = useState([]); 
  
  const searchTimeoutRef = useRef(null);

  // --- Hằng số/Tùy chọn ---
  const durationOptions = ["1-3 days", "4-7 days", "8-14 days", "15+ days"];
  const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
  const budgetOptions = ["< 5 triệu", "5-10 triệu", "10-20 triệu", "> 20 triệu"];
  
  // --- A. Logic Khởi tạo và Tìm kiếm Địa điểm ---
  
  useEffect(() => {
    if (initialDestination) {
      const { id, name, province_id, province_name } = initialDestination;

      setSelectedMainProvinceId(province_id);
      setSelectedMainProvinceName(province_name);
      
      if (!mustIncludePlaceIds.includes(id)) {
        setMustIncludePlaceIds([id]);
        setMustIncludePlaceDetails([{id, name, province_id, province_name}]);
      }
    }
  }, [initialDestination, mustIncludePlaceIds]); // Đã thêm mustIncludePlaceIds

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchTerm.length < 3) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      API.get(`/destinations?search=${searchTerm}`) 
        .then(res => {
          setSearchResults(res.data);
          setSearchLoading(false);
        })
        .catch(() => {
          toast.error("Tìm kiếm địa điểm thất bại.");
          setSearchResults([]);
          setSearchLoading(false);
        });
    }, 500);
    
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm]);


  // --- B. Logic Chọn/Bỏ chọn Địa điểm ---
  
  const handleSelectPlace = (place) => {
    const { id, name, province_id, province_name } = place;
    const isCurrentlyMain = selectedMainProvinceId === province_id;

    if (!isCurrentlyMain && selectedMainProvinceId !== null) {
        // Hỏi người dùng nếu tỉnh mới khác tỉnh hiện tại
        if (!window.confirm(`Bạn muốn đặt "${province_name}" làm điểm đến chính mới không? Việc này sẽ xóa hết các địa điểm ưu tiên đã chọn trước đó.`)) {
            return;
        }
        setMustIncludePlaceIds([]);
        setMustIncludePlaceDetails([]);
    }

    setSelectedMainProvinceId(province_id);
    setSelectedMainProvinceName(province_name);

    if (!mustIncludePlaceIds.includes(id)) {
        setMustIncludePlaceIds(prev => [...prev, id]);
        setMustIncludePlaceDetails(prev => [...prev, {id, name, province_id, province_name}]);
    }
    
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleRemovePlace = (placeId) => {
    const updatedIds = mustIncludePlaceIds.filter(id => id !== placeId);
    const updatedDetails = mustIncludePlaceDetails.filter(d => d.id !== placeId);
    
    setMustIncludePlaceIds(updatedIds);
    setMustIncludePlaceDetails(updatedDetails);

    if (updatedIds.length === 0) {
        setSelectedMainProvinceId(null);
        setSelectedMainProvinceName("");
    }
  };

  // --- C. Logic Submit Form ---
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const durationInDays = extractDurationDays(duration);
    
    if (!tripName || !selectedMainProvinceId || durationInDays === 0) {
      toast.error("Vui lòng điền Tên chuyến đi, chọn Điểm đến chính và Thời lượng.");
      return;
    }
    
    // Gửi data theo định dạng API POST /api/trips đã thống nhất
    const tripData = {
      name: tripName,
      province_id: selectedMainProvinceId, // ID của tỉnh/thành phố
      duration: durationInDays,          // Số ngày (đã chuyển đổi)
      must_include_place_ids: mustIncludePlaceIds, // Mảng các ID ưu tiên
    };

    API.post("/api/trips", tripData)
      .then(res => {
        toast.success(`Chuyến đi "${res.data.trip.name}" đã được tạo thành công!`);
        if(onTripCreated) onTripCreated(res.data.trip); 
        onClose();
      })
      .catch(err => {
        const errorMsg = err.response?.data?.message || "Có lỗi xảy ra khi tạo chuyến đi.";
        toast.error(errorMsg);
      });
  };
    
  return (
    <div className="modal-overlay">
      <div className="create-trip-form">
        <h2>Create a Trip</h2>
        <form onSubmit={handleSubmit}>
          {/* 1. Trip Name */}
          <input
            type="text"
            placeholder="Trip Name"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="trip-name-input"
          />

          {/* 2. Search Destinations */}
          <div className="destinations-search-group">
            <label><FaSearch /> Find Destinations & Select Main Province</label>
            <input
              type="text"
              placeholder="Search by name (e.g., 'Da Lat', 'Ho Xuan Huong')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            
            {/* Vùng hiển thị kết quả search */}
            {(searchLoading || searchResults.length > 0) && (
                <div className="search-results-overlay">
                    {searchLoading && <p className="loading-text">Searching...</p>}
                    {!searchLoading && searchResults.length === 0 && searchTerm.length >= 3 && (
                      <p className="no-results">No destinations found.</p>
                    )}
                    
                    {!searchLoading && searchResults.slice(0, 5).map(place => (
                        <RecommendCard
                            key={place.id}
                            destination={place}
                            mode="select"
                            onSelectPlace={handleSelectPlace}
                        />
                    ))}
                </div>
            )}
            
          </div>
          
          {/* 3. Selected Destinations Summary */}
          <div className="destination-summary-group">
            <label><FaMapMarkerAlt /> Summary</label>
            <div className="main-province-info">
              <strong>Main Destination:</strong> 
              {selectedMainProvinceId ? (
                <span className="main-province-tag">{selectedMainProvinceName} (ID: {selectedMainProvinceId})</span>
              ) : (
                <span className="warning-text">Please select a place to set the main province.</span>
              )}
            </div>
            
            <div className="must-include-list">
              <span className="must-include-label">Must-Include Places ({mustIncludePlaceIds.length}):</span>
              <div className="destination-list">
                {mustIncludePlaceDetails.map(dest => (
                  <span key={dest.id} className="destination-item">
                    {dest.name} 
                    <button type="button" onClick={() => handleRemovePlace(dest.id)}>x</button>
                  </span>
                ))}
                {mustIncludePlaceIds.length === 0 && <p className="hint-text">No priority places selected.</p>}
              </div>
            </div>
          </div>


          {/* 4. Options Group (Duration, People, Budget) */}
          <div className="options-group">
            <div className="option-card">
              <label><FaClock /> Duration (Sets Trip Days)</label>
              <div className="option-pills">
                {durationOptions.map(opt => (
                  <button
                    key={opt} type="button"
                    className={duration === opt ? "pill selected" : "pill"}
                    onClick={() => setDuration(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaUser /> People</label>
              <div className="option-pills">
                {peopleOptions.map(opt => (
                  <button
                    key={opt} type="button"
                    className={peopleCount === opt ? "pill selected" : "pill"}
                    onClick={() => setPeopleCount(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaMoneyBillWave /> Budget</label>
              <div className="option-pills">
                {budgetOptions.map(opt => (
                  <button
                    key={opt} type="button"
                    className={budget === opt ? "pill selected" : "pill"}
                    onClick={() => setBudget(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Submit */}
          <div className="form-buttons">
            <button type="submit">Generate & Create Trip</button>
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}