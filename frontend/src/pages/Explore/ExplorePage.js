import React, { useEffect, useState, useRef } from "react";
import API from "../../untils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

import {
  FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
  FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
  FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
  FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
  FaMapMarkedAlt, FaFireAlt, FaPaw, FaChevronUp, FaChevronDown,
  FaMusic, FaSpa, FaChild, FaCrown, FaTimes
} from "react-icons/fa";

import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import DestinationModal from "../../components/DestinationModal";

import { useLocation } from "react-router-dom";

import "./ExplorePage.css";

/* ICON MAP & CATEGORY ICONS (Giữ nguyên) */
const ICON_MAP = {
  Beach: <FaUmbrellaBeach />, Mountain: <FaMountain />, "Historical Site": <FaLandmark />,
  "Cultural Site": <FaMusic />, Gastronomy: <FaUtensils />, Adventure: <FaHiking />,
  "Nature Park": <FaTree />, "Urban Area": <FaCity />, Island: <FaWater />, "Lake/River": <FaWater />,
  "Trekking/Hiking": <FaHiking />, Photography: <FaCamera />, Camping: <FaCampground />,
  Relaxation: <FaSpa />, Shopping: <FaShoppingCart />, "Water Sports": <FaSwimmer />,
  Cycling: <FaBicycle />, Sightseeing: <FaBinoculars />, "Wildlife Watching": <FaBinoculars />,
  "Local Workshop": <FaGift />, Family: <FaUsers />, Couples: <FaUsers />, Friends: <FaUsers />,
  "Solo Traveler": <FaUser />, "Kids Friendly": <FaChild />, "Elderly Friendly": <FaUsers />,
  "Pet Friendly": <FaPaw />, "Adventure Seekers": <FaHiking />, "Half Day": <FaClock />,
  "Full Day": <FaClock />, "2 Days": <FaClock />, "3+ Days": <FaClock />, "Weekend Trip": <FaClock />,
  Overnight: <FaClock />, "Multi-day Adventure": <FaClock />, Spring: <FaLeaf />, Summer: <FaSun />,
  Autumn: <FaCloudSun />, Winter: <FaSnowflake />, Morning: <FaSun />, Afternoon: <FaCloudSun />,
  Evening: <FaCalendarAlt />, Night: <FaMoon />, "Free": <FaGift />, "< 5 Triệu": <FaMoneyBillWave />,
  "5 - 10 Triệu": <FaDollarSign />, "10 - 20 Triệu": <FaGem />,
  "> 20 Triệu": <FaCrown />, "Scenic Views": <FaEye />, "Instagrammable Spots": <FaImage />,
  "Local Cuisine": <FaUtensils />, "Festivals & Events": <FaFireAlt />, "Adventure Sports": <FaHiking />,
  "Relaxing Spots": <FaSpa />, "Cultural Immersion": <FaLandmark />, "Hidden Gems": <FaMapMarkedAlt />
};

const CATEGORY_ICON_MAP = {
  "Destination Type": <FaMapMarkedAlt />, Activities: <FaHiking />,
  "Target Audience": <FaUsers />, Duration: <FaClock />, "Season/Time": <FaCalendarAlt />,
  Budget: <FaDollarSign />, "Special Features": <FaStar />
};

const ITEMS_PER_PAGE = 30; 

export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  
  // State cho Form & Modal
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [viewingDestination, setViewingDestination] = useState(null);

  // State cho Dropdown Categories
  const [openCategory, setOpenCategory] = useState(null);
  const categoryRefs = useRef({});
  
  // State cho Phân trang
  const [currentPage, setCurrentPage] = useState(1);

  // --- State cho danh sách Tỉnh/Thành ---
  const [vietnamLocations, setVietnamLocations] = useState([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");

  const location = useLocation();

  // Thêm useEffect để xử lý preSelectedTags từ navigation
  useEffect(() => {
    if (location.state?.preSelectedTags) {
      const tagsToSelect = location.state.preSelectedTags;
      setSelectedTags((prev) => {
        const newTags = [...prev];
        tagsToSelect.forEach((tag) => {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        });
        return newTags;
      });
      
      // Clear state sau khi đã xử lý để tránh re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // --- CALL API ---
  useEffect(() => {
    // 1. Lấy danh sách địa điểm
    API.get("/destinations")
      .then((res) => setDestinations(res.data))
      .catch(() => toast.error("Failed to fetch destinations"));

    // 2. Lấy danh sách Tỉnh/Thành (Logic chuẩn từ CreateTripForm)
    API.get("/locations/vietnam")
      .then((res) => {
        console.log("Locations loaded:", res.data); // Debug dữ liệu
        const provinces = [];
        if (Array.isArray(res.data)) {
          res.data.forEach((region, regionIdx) => {
            if (Array.isArray(region.provinces)) {
              region.provinces.forEach((p, idx) => {
                // Đảm bảo lấy đúng ID và Name
                const idStr = String(p.id ?? p.province_id ?? p.province_name ?? `prov-${regionIdx}-${idx}`);
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
      .catch((err) => console.error("Failed to fetch locations", err));
  }, []);

  // --- HANDLERS ---
  const toggleCategory = (title) => {
    setOpenCategory((prev) => (prev === title ? null : title));
  };

  const isCategoryActive = (categoryTags) => {
    return categoryTags.some(tag => selectedTags.includes(tag));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openCategory && categoryRefs.current[openCategory] && !categoryRefs.current[openCategory].contains(event.target)) {
        setOpenCategory(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCategory]);

  const handleTagClick = (tag, e) => {
    if (e) e.stopPropagation(); 
    toggleTag(tag);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1); 
  };

  const removeTag = (tag) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  // --- Xử lý chọn tỉnh ---
  const handleProvinceChange = (e) => {
    console.log("Selected Province ID:", e.target.value);
    setSelectedProvinceId(e.target.value);
    setCurrentPage(1);
  };

  // --- LOGIC LỌC DỮ LIỆU ---
  const filteredDestinations = destinations.filter((dest) => {
    // 1. Lọc theo tên (Search)
    const destName = dest.name ? dest.name.toLowerCase() : "";
    const matchesSearch = destName.includes(search.toLowerCase());

    // 2. Lọc theo Tags
    const destTags = Array.isArray(dest.tags) ? dest.tags : [];
    const matchesTags =
      selectedTags.length === 0 || 
      selectedTags.every((tag) => destTags.includes(tag));

    // 3. Lọc theo Tỉnh/Thành
    let matchesProvince = true;
    if (selectedProvinceId) {
        // So sánh ID (chuyển về string để an toàn)
        if (dest.province_id) {
            matchesProvince = String(dest.province_id) === String(selectedProvinceId);
        } else if (dest.province_name) {
             // Fallback: Tìm theo tên
             const selectedProvObj = vietnamLocations.find(p => String(p.id) === String(selectedProvinceId));
             if (selectedProvObj) {
                 matchesProvince = dest.province_name.toLowerCase().includes(selectedProvObj.name.toLowerCase());
             }
        }
    }

    return matchesSearch && matchesTags && matchesProvince;
  });

  // --- LOGIC PHÂN TRANG ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredDestinations.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDestinations.length / ITEMS_PER_PAGE);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="explore-container">
      <h1 className="explore-header">Find Your Dream Trip ✈️</h1>

      {/* --- CẬP NHẬT: THANH TÌM KIẾM ĐÔI --- */}
      <div className="search-bar-container">
        <div className="search-bar">
            {/* Input tìm kiếm */}
            <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Tìm theo tên địa điểm..."
                  value={search}
                  onChange={handleSearchChange}
                />
            </div>
            
            <div className="search-divider"></div>

            {/* Select Tỉnh/Thành (Đã sửa icon) */}
            <div className="search-location-wrapper">
                <div className="select-container">
                  <select 
                      className="location-select"
                      value={selectedProvinceId} 
                      onChange={handleProvinceChange}
                  >
                      <option value="">Tất cả địa điểm</option>
                      {vietnamLocations.map((p) => (
                          <option key={p.id} value={p.id}>
                              {p.name}
                          </option>
                      ))}
                  </select>
                  {/* Icon mũi tên thủ công để đảm bảo luôn hiện */}
                  <FaChevronDown className="select-arrow-icon" />
                </div>
            </div>
        </div>
      </div>

      {/* Bộ lọc Categories */}
      <div className="categories-row">
        {TAG_CATEGORIES.map((cat) => {
          const hasActiveTags = isCategoryActive(cat.tags);
          const isOpen = openCategory === cat.title;

          return (
            <div
              key={cat.title}
              className={`category-item ${isOpen ? "open" : ""}`}
              ref={(el) => (categoryRefs.current[cat.title] = el)}
            >
              <button
                className={`category-btn ${isOpen ? "active" : ""} ${hasActiveTags ? "active" : ""}`}
                onClick={() => toggleCategory(cat.title)}
              >
                <span className="category-left">
                  {CATEGORY_ICON_MAP[cat.title] || <FaLandmark />}
                  {cat.title}
                  {hasActiveTags && (
                     <span className="active-count">
                       {cat.tags.filter(t => selectedTags.includes(t)).length}
                     </span>
                  )}
                </span>
                <span className="category-arrow">
                  {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                </span>
              </button>

              <div className={`tag-list-vertical ${isOpen ? "open" : ""}`}>
                {cat.tags.map((tag) => {
                  const isActive = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={`tag-btn ${isActive ? "active" : ""}`}
                      onClick={(e) => handleTagClick(tag, e)} 
                    >
                      <div className={`checkbox-circle ${isActive ? "checked" : ""}`}></div>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tags đã chọn */}
      {selectedTags.length > 0 && (
        <div className="selected-tags-container">
          <span className="selected-label">Filters:</span>
          <div className="selected-tags-list">
            {selectedTags.map((tag) => (
              <div key={tag} className="selected-tag-chip">
                {ICON_MAP[tag]}
                <span className="tag-text">{tag}</span>
                <button className="remove-tag-btn" onClick={() => removeTag(tag)}>
                  <FaTimes />
                </button>
              </div>
            ))}
            <button className="clear-all-btn" onClick={() => setSelectedTags([])}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Tiêu đề Grid */}
      <h2 className="recommend-header">
        {search || selectedTags.length > 0 || selectedProvinceId
          ? `Showing ${filteredDestinations.length} results` 
          : "Handpicked For You ✨"}
      </h2>

      {/* Lưới kết quả */}
      {currentItems.length > 0 ? (
        <>
          <div className="explore-grid-container">
            {currentItems.map((dest) => (
              <div key={dest.id} className="explore-grid-item">
                <RecommendCard
                  destination={dest}
                  isSaved={savedIds.has(dest.id)}
                  onToggleSave={() => handleToggleSave(dest.id)}
                  onViewDetails={() => setViewingDestination(dest)}
                  onCreateTrip={() => {
                    setSelectedDestination(dest);
                    setShowForm(true);
                  }}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-wrapper">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Prev
              </button>
              
              <div className="pagination-scroll">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                  <button
                    key={number}
                    className={`pagination-number ${number === currentPage ? "active" : ""}`}
                    onClick={() => handlePageChange(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>

              <button 
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state-container">
          <img 
            src="https://cdn-icons-png.flaticon.com/512/7486/7486744.png" 
            alt="No destinations found" 
            className="empty-state-img"
          />
          <h3 className="empty-state-title">No destinations found</h3>
          <p className="empty-state-desc">
            We couldn't find any trips that match your current filters. <br/>
            Try adjusting your search or clear filters to see more.
          </p>
          <button 
            className="empty-state-btn"
            onClick={() => {
              setSelectedTags([]);
              setSearch("");
              setSelectedProvinceId(""); // Reset tỉnh
              setCurrentPage(1);
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Modal & Form */}
      {viewingDestination && (
        <DestinationModal 
          destination={viewingDestination} 
          onClose={() => setViewingDestination(null)}
          onCreateTrip={(dest) => {
             setViewingDestination(null);
             setSelectedDestination(dest);
             setShowForm(true);
          }}
        />
      )}

      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}