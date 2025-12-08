import React, { useEffect, useState, useRef } from "react";
import API from "../../utils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

// Import các icon cần thiết
import {
  FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
  FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
  FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
  FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
  FaMapMarkedAlt, FaFireAlt, FaPaw, FaSearch, FaChevronUp, FaChevronDown,
  FaMusic, FaSpa, FaChild, FaCrown, FaTimes
} from "react-icons/fa";

// Import các component con
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import DestinationModal from "../../components/DestinationModal"; // Import Modal mới tạo

import "./ExplorePage.css";

/* --- CẤU HÌNH ICON VÀ DANH MỤC --- */
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

// Số lượng địa điểm hiển thị trên một trang
const ITEMS_PER_PAGE = 30; 

export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
  // --- KHAI BÁO STATE ---
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  
  // State cho Form tạo chuyến đi
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  
  // State cho Modal xem chi tiết địa điểm (MỚI)
  const [viewingDestination, setViewingDestination] = useState(null);

  // State cho Dropdown Categories
  const [openCategory, setOpenCategory] = useState(null);
  const categoryRefs = useRef({});
  
  // State cho Phân trang
  const [currentPage, setCurrentPage] = useState(1);

  // --- CALL API ---
  useEffect(() => {
    API.get("/destinations")
      .then((res) => setDestinations(res.data))
      .catch(() => toast.error("Failed to fetch destinations"));
  }, []);

  // --- CÁC HÀM XỬ LÝ LOGIC ---

  // Đóng mở dropdown
  const toggleCategory = (title) => {
    setOpenCategory((prev) => (prev === title ? null : title));
  };

  // Kiểm tra xem Category có đang chứa tag nào được chọn không (để highlight nút)
  const isCategoryActive = (categoryTags) => {
    return categoryTags.some(tag => selectedTags.includes(tag));
  };

  // Xử lý click ra ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openCategory && categoryRefs.current[openCategory] && !categoryRefs.current[openCategory].contains(event.target)) {
        setOpenCategory(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCategory]);

  // Chọn/Bỏ chọn Tag
  const handleTagClick = (tag, e) => {
    if (e) e.stopPropagation(); 
    toggleTag(tag);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1); // Reset về trang 1 khi lọc
  };

  const removeTag = (tag) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
    setCurrentPage(1);
  };

  // Xử lý tìm kiếm
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  // Xử lý xem chi tiết (Mở Modal)
  const handleViewDetails = (dest) => {
    setViewingDestination(dest);
  };

  // --- LOGIC LỌC DỮ LIỆU ---
  const filteredDestinations = destinations.filter((dest) => {
    const destName = dest.name ? dest.name.toLowerCase() : "";
    const matchesSearch = destName.includes(search.toLowerCase());

    // --- FIX LỖI NULL Ở ĐÂY ---
    const destTags = Array.isArray(dest.tags) ? dest.tags : [];

    const matchesTags =
      selectedTags.length === 0 || 
      selectedTags.every((tag) => destTags.includes(tag));

    return matchesSearch && matchesTags;
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

  // --- RENDER GIAO DIỆN ---
  return (
    <div className="explore-container">
      {/* Tiêu đề chính */}
      <h1 className="explore-header">Explore Destinations</h1>

      {/* Thanh tìm kiếm */}
      <div className="search-bar">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={handleSearchChange}
        />
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
                  {/* Hiển thị số lượng tag đã chọn (chỉ hiện số, không ngoặc) */}
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

              {/* Dropdown Menu */}
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

      {/* Danh sách Tags đã chọn */}
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

      {/* Tiêu đề Grid Kết quả */}
      <h2 className="recommend-header">
        {search || selectedTags.length > 0 
          ? `Showing ${filteredDestinations.length} results` 
          : "Recommended for you"}
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
                  
                  // Truyền hàm xem chi tiết (Mở Modal)
                  onViewDetails={() => handleViewDetails(dest)}
                  
                  // Mở form tạo chuyến đi
                  onCreateTrip={() => {
                    setSelectedDestination(dest);
                    setShowForm(true);
                  }}
                />
              </div>
            ))}
          </div>

          {/* Thanh Phân Trang */}
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
        /* Trạng thái trống (Empty State) */
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
              setSelectedTags([]); // Xóa tags
              setSearch("");       // Xóa tìm kiếm
              setCurrentPage(1);   // Về trang đầu
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* --- CÁC MODAL & POPUP --- */}

      {/* 1. Modal xem chi tiết địa điểm */}
      {viewingDestination && (
        <DestinationModal 
          destination={viewingDestination} 
          onClose={() => setViewingDestination(null)}
          onCreateTrip={(dest) => {
             setViewingDestination(null); // Đóng modal xem chi tiết
             setSelectedDestination(dest); // Mở form tạo chuyến đi
             setShowForm(true);
          }}
        />
      )}

      {/* 2. Form tạo chuyến đi */}
      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}