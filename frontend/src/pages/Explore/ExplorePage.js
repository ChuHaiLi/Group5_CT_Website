import React, { useEffect, useState, useRef, useMemo } from "react";
import API from "../../untils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

import {
  FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
  FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
  FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
  FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
  FaMapMarkedAlt, FaFireAlt, FaPaw, FaSearch, FaChevronUp, FaChevronDown,
  FaMusic, FaSpa, FaChild, FaCrown, FaTimes, FaArrowUp
} from "react-icons/fa";

import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import DestinationModal from "../../components/DestinationModal";

import { useLocation } from "react-router-dom";

import "./ExplorePage.css";

// --- QUICK QUESTIONS ---
const QUICK_CATEGORIES = [
  { id: "Beach", label: "🌊 Craving Vitamin Sea?", icon: null },
  { id: "Mountain", label: "🏔️ Into majestic mountains?", icon: null },
  { id: "Relaxation", label: "💆 Need a healing retreat?", icon: null },
  { id: "Urban Area", label: "🏙️ Love the city vibe?", icon: null },
  { id: "Gastronomy", label: "🍜 Are you a foodie?", icon: null },
  { id: "Historical Site", label: "🏛️ Are you a history buff?", icon: null },
  { id: "Nature Park", label: "🌲 Want to immerse in nature?", icon: null },
  { id: "Adventure", label: "🧗 Seeking adventure?", icon: null },
  { id: "Camping", label: "⛺ Up for a camping trip?", icon: null },
  { id: "Photography", label: "📸 Hunting for photo spots?", icon: null },
  { id: "Shopping", label: "🛍️ Ready to shop till you drop?", icon: null },
];

// --- FAMOUS LOCATIONS ---
const FAMOUS_LOCATIONS = [
  "vinh ha long", "ha long bay", "pho co hoi an", "hoi an", "ba na hills", "golden bridge",
  "fansipan", "sapa", "trang an", "ninh binh", "cu chi tunnels", "phong nha",
  "dragon bridge", "hoan kiem lake", "hue imperial city", "phu quoc", "da lat",
  "nha tho duc ba", "cho ben thanh", "dinh doc lap", "landmark 81", "vinwonders", "hoi an ancient town"
];

// --- BUDGET MAPPING (Bảng quy đổi giá) ---
const BUDGET_MAPPING = {
  "Free": { min: 0, max: 1 },
  "< 50.000 VND": { min: 1, max: 50000 },
  "50.000 - 100.000 VND": { min: 50000, max: 100000 },
  "100.000 - 200.000 VND": { min: 100000, max: 200000 },
  "200.000 - 500.000 VND": { min: 200000, max: 500000 },
  "500.000 - 1.000.000 VND": { min: 500000, max: 1000000 },
  "> 1.000.000 VND": { min: 1000000, max: Infinity }
};

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
  Evening: <FaCalendarAlt />, Night: <FaMoon />, 
  "Free": <FaGift />, "< 50.000 VND": <FaMoneyBillWave />, "50.000 - 100.000 VND": <FaMoneyBillWave />,
  "100.000 - 200.000 VND": <FaDollarSign />, "200.000 - 500.000 VND": <FaDollarSign />,
  "500.000 - 1.000.000 VND": <FaGem />, "> 1.000.000 VND": <FaCrown />,
  "Scenic Views": <FaEye />, "Instagrammable Spots": <FaImage />,
  "Local Cuisine": <FaUtensils />, "Festivals & Events": <FaFireAlt />, "Adventure Sports": <FaHiking />,
  "Relaxing Spots": <FaSpa />, "Cultural Immersion": <FaLandmark />, "Hidden Gems": <FaMapMarkedAlt />
};

const CATEGORY_ICON_MAP = {
  "Destination Type": <FaMapMarkedAlt />, Activities: <FaHiking />,
  "Target Audience": <FaUsers />, Duration: <FaClock />, "Season/Time": <FaCalendarAlt />,
  Price: <FaDollarSign />, "Special Features": <FaStar />
};

const REGULAR_ITEMS_PER_PAGE = 15;
const POPULAR_ITEMS_PER_PAGE = 9;

// --- UTILS ---

const normalizeString = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
};

const sanitizeSearch = (str) => {
  if (!str) return "";
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// --- PARSE PRICE FUNCTION ---
// Hàm này giúp làm sạch dữ liệu giá từ DB (vd: "<= 500.000", "Free", "1.200.000 đ") thành số
const parsePrice = (rawPrice) => {
  if (!rawPrice) return 0;
  
  // Chuyển về string chữ thường
  const str = String(rawPrice).toLowerCase().trim();

  // Nếu là Free/Miễn phí -> 0
  if (str.includes("free") || str.includes("miễn phí")) return 0;

  // Xóa hết ký tự lạ, chỉ giữ lại số (0-9)
  // Ví dụ: "<= 500.000 đ" -> "500000"
  const numberStr = str.replace(/[^0-9]/g, "");

  // Chuyển thành số
  const val = Number(numberStr);
  return isNaN(val) ? 0 : val;
};

const parseTags = (tagsRaw) => {
  if (Array.isArray(tagsRaw)) return tagsRaw;
  if (typeof tagsRaw === 'string') {
    try {
      return JSON.parse(tagsRaw.replace(/'/g, '"'));
    } catch (e) {
      return tagsRaw.replace(/[\[\]']/g, "").split(",").map(t => t.trim());
    }
  }
  return [];
};

const ALL_VALID_TAGS = new Set(TAG_CATEGORIES.flatMap(c => c.tags));

const isValidTag = (tag) => ALL_VALID_TAGS.has(tag);

const separateTagsAndLocations = (items) => {
  const validTags = [];
  const locations = [];
  items.forEach(item => {
    if (isValidTag(item)) {
      validTags.push(item);
    } else {
      locations.push(item);
    }
  });
  return { validTags, locations };
};

// ========================================
// 🎯 SCROLL TO TOP BUTTON COMPONENT
// ========================================
const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <button
      className={`scroll-to-top-btn ${isVisible ? "visible" : ""}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <FaArrowUp />
    </button>
  );
};

// ========================================
// 🔍 SEARCH AUTOCOMPLETE COMPONENT
// ========================================
const SearchAutocomplete = ({ 
  suggestions, 
  onSelect, 
  visible, 
  searchValue,
  highlightedIndex,
  onMouseEnter,
  onMouseLeave 
}) => {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="search-autocomplete-dropdown">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className={`autocomplete-item ${idx === highlightedIndex ? 'highlighted' : ''}`}
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => onMouseEnter(idx)}
          onMouseLeave={onMouseLeave}
        >
          <FaSearch className="autocomplete-icon" />
          <div className="autocomplete-content">
            <span className="autocomplete-name">{suggestion.name}</span>
            {suggestion.province && (
              <span className="autocomplete-location">{suggestion.province}</span>
            )}
          </div>
          {suggestion.type && (
            <span className="autocomplete-badge">{suggestion.type}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ========================================
// 🚀 MAIN COMPONENT: EXPLORE PAGE
// ========================================
export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
  // State Data
  const [regularDestinations, setRegularDestinations] = useState([]); 
  const [popularDestinations, setPopularDestinations] = useState([]); 
  
  // State Filter
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // State Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  
  // State UI
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [viewingDestination, setViewingDestination] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  const categoryRefs = useRef({});
  
  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [popularPage, setPopularPage] = useState(1);

  // Locations
  const [vietnamLocations, setVietnamLocations] = useState([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");

  const location = useLocation();

  // Click outside to close autocomplete and category dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close autocomplete if click outside search bar
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowAutocomplete(false);
        setHighlightedIndex(-1);
      }

      // Close category dropdown if click outside all categories
      if (openCategory) {
        const clickedInsideCategory = Object.values(categoryRefs.current).some(
          ref => ref && ref.contains(e.target)
        );
        
        if (!clickedInsideCategory) {
          setOpenCategory(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openCategory]);

  // Xử lý preSelectedTags từ navigation và URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tagsParam = urlParams.get("tags");
    const qParam = urlParams.get("q");
    const state = location.state || {};
    const preSearch = state.preSearch || state.q || "";
    const preTagsRaw = state.preSelectedTags || state.tags || [];

    if (qParam) {
      const decodedQ = decodeURIComponent(qParam);
      setSearch(decodedQ);
    } else if (preSearch) {
      setSearch(preSearch);
    }

    if (tagsParam) {
      const parts = decodeURIComponent(tagsParam).split(",").map(t => t.trim()).filter(Boolean);
      const { validTags, locations } = separateTagsAndLocations(parts);
      
      if (validTags.length > 0) {
        setSelectedTags((prev) => {
          const newTags = [...prev];
          validTags.forEach((tag) => {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
          });
          return newTags;
        });
      }
      
      if (locations.length > 0 && !qParam && !preSearch) {
        const locationSearch = locations.join(" ");
        setSearch(locationSearch);
      }
    }

    if (preTagsRaw && preTagsRaw.length > 0 && !qParam && !preSearch) {
      const tagsToSelect = Array.isArray(preTagsRaw) ? preTagsRaw : [preTagsRaw];
      const { validTags, locations } = separateTagsAndLocations(tagsToSelect);
      
      if (validTags.length > 0) {
        setSelectedTags((prev) => {
          const newTags = [...prev];
          validTags.forEach((tag) => {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
          });
          return newTags;
        });
      }
      
      if (locations.length > 0) {
        const locationSearch = locations.join(" ");
        setSearch(locationSearch);
      }
    }
    
    if (location.state || tagsParam || qParam) {
      window.history.replaceState({}, document.title);
      if (tagsParam || qParam) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [location.state, location.search]);

  // --- CALL API ---
  useEffect(() => {
    API.get("/destinations")
      .then((res) => {
        const allData = res.data;
        const popular = [];
        const regular = [];

        allData.forEach(dest => {
            const normName = normalizeString(dest.name);
            const isFamous = FAMOUS_LOCATIONS.some(f => normName.includes(f));
            if (isFamous) popular.push(dest);
            else regular.push(dest);
        });

        setPopularDestinations(popular);
        setRegularDestinations(regular);
      })
      .catch(() => toast.error("Failed to fetch destinations"));

    API.get("/locations/vietnam")
      .then((res) => {
        const provinces = [];
        if (Array.isArray(res.data)) {
          res.data.forEach((region) => {
            if (Array.isArray(region.provinces)) {
              region.provinces.forEach((p) => {
                const idStr = String(p.id ?? p.province_id ?? p.province_name);
                provinces.push({ id: idStr, name: p.province_name || p.name, region: region.region_name });
              });
            }
          });
        }
        setVietnamLocations(provinces);
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error fetching Vietnam locations:", err);
        }
      });
  }, []);

  // --- AUTOCOMPLETE LOGIC ---
  useEffect(() => {
    if (search.trim().length >= 2) {
      const searchNorm = normalizeString(search);
      const allDestinations = [...regularDestinations, ...popularDestinations];
      
      const matches = allDestinations
        .filter(dest => {
          const nameMatch = normalizeString(dest.name).includes(searchNorm);
          const provinceMatch = dest.province_name && normalizeString(dest.province_name).includes(searchNorm);
          return nameMatch || provinceMatch;
        })
        .slice(0, 8)
        .map(dest => ({
          name: dest.name,
          province: dest.province_name,
          type: dest.type,
          fullData: dest
        }));

      setAutocompleteSuggestions(matches);
      setShowAutocomplete(matches.length > 0);
    } else {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
    }
  }, [search, regularDestinations, popularDestinations]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showAutocomplete) return;

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && autocompleteSuggestions[highlightedIndex]) {
            handleSelectSuggestion(autocompleteSuggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowAutocomplete(false);
          setHighlightedIndex(-1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAutocomplete, autocompleteSuggestions, highlightedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowAutocomplete(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    setSearch(suggestion.name);
    setShowAutocomplete(false);
    setHighlightedIndex(-1);
    setCurrentPage(1);
    
    setTimeout(() => {
      const resultsSection = document.querySelector('.explore-grid-container');
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // --- HANDLERS ---
  const handleSearchChange = (e) => { 
    setSearch(e.target.value); 
    setCurrentPage(1); 
    setHighlightedIndex(-1);
  };
  
  const handleProvinceChange = (e) => { 
    setSelectedProvinceId(e.target.value); 
    setCurrentPage(1); 
  };
  
  const handleCategoryClick = (catId) => {
    setSelectedCategory(selectedCategory === catId ? null : catId);
    setCurrentPage(1);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setCurrentPage(1);
  };
  
  const removeTag = (tag) => setSelectedTags(prev => prev.filter(t => t !== tag));
  const toggleCategory = (title) => setOpenCategory(prev => prev === title ? null : title);
  const isCategoryActive = (tags) => tags.some(tag => selectedTags.includes(tag));

  // --- FILTER LOGIC (UPDATED WITH PRICE PARSING) ---
  const filteredRegularItems = useMemo(() => {
    return regularDestinations.filter((dest) => {
      const destNameNorm = normalizeString(dest.name);
      const destProvinceNorm = normalizeString(dest.province_name);
      const destRegionNorm = dest.region_name ? normalizeString(dest.region_name) : "";
      
      const sanitizedSearch = sanitizeSearch(search);
      const searchNorm = normalizeString(sanitizedSearch);
      
      const searchTokens = searchNorm.split(" ").filter(Boolean);
      const destTags = parseTags(dest.tags);

      // 1. Check Search text
      const matchesSearch = searchTokens.length === 0 || 
        searchTokens.every((token) =>
          destNameNorm.includes(token) ||
          destProvinceNorm.includes(token) ||
          destRegionNorm.includes(token)
        );

      // 2. Check Tags (Price + Regular Tags)
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every((tag) => {
          // Kiểm tra xem tag này có phải là tag giá tiền không
          if (BUDGET_MAPPING[tag]) {
            const { min, max } = BUDGET_MAPPING[tag];
            
            // Lấy giá từ entry_fee (priority cao nhất) hoặc các trường khác
            const priceVal = dest.entry_fee ?? dest.price ?? dest.cost ?? dest.budget;
            
            // Xử lý giá tiền
            let realPrice = 0;
            
            if (priceVal === null || priceVal === undefined || priceVal === "" || priceVal === "Miễn Phí" || priceVal === "Free") {
              // Nếu là miễn phí
              realPrice = 0;
            } else if (typeof priceVal === 'number') {
              // Nếu đã là số (như entry_fee: 20000)
              realPrice = priceVal;
            } else {
              // Nếu là string, dùng parsePrice để xử lý
              realPrice = parsePrice(priceVal);
            }
            
            // So sánh với khoảng giá
            return realPrice >= min && realPrice < max;
          }
          
          // Nếu không phải tag giá tiền, kiểm tra mảng tags như thường
          return destTags.includes(tag);
        });
      
      // 3. Check Province
      let matchesProvince = true;
      if (selectedProvinceId) {
        if (dest.province_id) {
          matchesProvince = String(dest.province_id) === String(selectedProvinceId);
        } else if (dest.province_name) {
          const selectedProvObj = vietnamLocations.find(p => String(p.id) === String(selectedProvinceId));
          if (selectedProvObj) {
            matchesProvince = normalizeString(dest.province_name).includes(normalizeString(selectedProvObj.name));
          }
        }
      }

      // 4. Check Category (Quick Questions)
      let matchesCategory = true;
      if (selectedCategory) {
        matchesCategory = destTags.some(tag => 
          normalizeString(tag).includes(normalizeString(selectedCategory)) || 
          normalizeString(selectedCategory).includes(normalizeString(tag))
        );
      }

      return matchesSearch && matchesTags && matchesProvince && matchesCategory;
    });
  }, [regularDestinations, search, selectedTags, selectedCategory, selectedProvinceId, vietnamLocations]);

  // --- PAGINATION 1 (SECTION 1) ---
  const indexOfLastItem = currentPage * REGULAR_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - REGULAR_ITEMS_PER_PAGE;
  const currentRegularItems = filteredRegularItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRegularItems.length / REGULAR_ITEMS_PER_PAGE);

  // --- PAGINATION 2 (SECTION 2 - POPULAR) ---
  const indexOfLastPop = popularPage * POPULAR_ITEMS_PER_PAGE;
  const indexOfFirstPop = indexOfLastPop - POPULAR_ITEMS_PER_PAGE;
  const currentPopularItems = popularDestinations.slice(indexOfFirstPop, indexOfLastPop);
  const totalPopularPages = Math.ceil(popularDestinations.length / POPULAR_ITEMS_PER_PAGE);

  // --- SCROLL UTILS ---
  const handleRegionClick = (regionName) => {
    setSearch(regionName);
    setSelectedProvinceId(""); 
    setSelectedCategory(null); 
    setSelectedTags([]);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePopularPageChange = (pageNum) => {
    setPopularPage(pageNum);
    const section = document.getElementById('popular-section');
    if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="explore-container">
      
      {/* ================= SECTION 1: SEARCH & FILTER ================= */}
      <div className="section-block">
        <h1 className="explore-header">Find Your Dream Trip ✈️</h1>

        <div className="search-bar-container" ref={searchInputRef}>
          <div className="search-bar">
              <div className="search-input-wrapper">
                  <FaSearch className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by place name, province, or region..." 
                    value={search} 
                    onChange={handleSearchChange}
                    onFocus={() => {
                      if (autocompleteSuggestions.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                  />
              </div>
              <div className="search-divider"></div>
              <div className="search-location-wrapper">
                  <div className="select-container">
                    <select className="location-select" value={selectedProvinceId} onChange={handleProvinceChange}>
                        <option value="">All Provinces</option>
                        {vietnamLocations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <FaChevronDown className="select-arrow-icon" />
                  </div>
              </div>
          </div>
          
          {/* AUTOCOMPLETE DROPDOWN */}
          <SearchAutocomplete
            suggestions={autocompleteSuggestions}
            onSelect={handleSelectSuggestion}
            visible={showAutocomplete}
            searchValue={search}
            highlightedIndex={highlightedIndex}
            onMouseEnter={(idx) => setHighlightedIndex(idx)}
            onMouseLeave={() => setHighlightedIndex(-1)}
          />
        </div>

        <div className="categories-row">
          {TAG_CATEGORIES.map((cat) => {
            const hasActiveTags = isCategoryActive(cat.tags);
            const isOpen = openCategory === cat.title;
            return (
              <div key={cat.title} className={`category-item ${isOpen ? "open" : ""}`} ref={(el) => (categoryRefs.current[cat.title] = el)}>
                <button className={`category-btn ${isOpen ? "active" : ""} ${hasActiveTags ? "active" : ""}`} onClick={() => toggleCategory(cat.title)}>
                  <span className="category-left">
                    {CATEGORY_ICON_MAP[cat.title] || <FaLandmark />} {cat.title}
                    {hasActiveTags && <span className="active-count">{cat.tags.filter(t => selectedTags.includes(t)).length}</span>}
                  </span>
                  <span className="category-arrow">{isOpen ? <FaChevronUp /> : <FaChevronDown />}</span>
                </button>
                <div className={`tag-list-vertical ${isOpen ? "open" : ""}`}>
                  {cat.tags.map((tag) => (
                    <button key={tag} className={`tag-btn ${selectedTags.includes(tag) ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); toggleTag(tag); }}>
                      <div className={`checkbox-circle ${selectedTags.includes(tag) ? "checked" : ""}`}></div>{tag}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="quick-categories-container">
          <div className="quick-categories-scroll">
            {QUICK_CATEGORIES.map((cat) => (
              <button key={cat.id} className={`question-pill ${selectedCategory === cat.id ? "active" : ""}`} onClick={() => handleCategoryClick(cat.id)}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {selectedTags.length > 0 && (
          <div className="selected-tags-container">
            <span className="selected-label">Filters:</span>
            <div className="selected-tags-list">
              {selectedTags.map((tag) => (
                <div key={tag} className="selected-tag-chip">
                  {ICON_MAP[tag]} <span className="tag-text">{tag}</span>
                  <button className="remove-tag-btn" onClick={() => removeTag(tag)}><FaTimes /></button>
                </div>
              ))}
              <button className="clear-all-btn" onClick={() => setSelectedTags([])}>Clear All</button>
            </div>
          </div>
        )}

        {/* RESULTS GRID - SECTION 1 */}
        <h2 className="recommend-header">
          {search || selectedCategory || selectedTags.length > 0 || selectedProvinceId
            ? `Found ${filteredRegularItems.length} results` 
            : "Hidden Gems For You ✨"}
        </h2>

        {currentRegularItems.length > 0 ? (
          <>
            <div className="explore-grid-container">
              {currentRegularItems.map((dest) => (
                <div key={dest.id} className="explore-grid-item">
                  <RecommendCard
                    destination={dest}
                    isSaved={savedIds.has(dest.id)}
                    onToggleSave={() => handleToggleSave(dest.id)}
                    onViewDetails={() => setViewingDestination(dest)}
                    onCreateTrip={() => { setSelectedDestination(dest); setShowForm(true); }}
                  />
                </div>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="pagination-wrapper">
                <button className="pagination-btn" disabled={currentPage === 1} onClick={() => {setCurrentPage(currentPage - 1); window.scrollTo(0,0)}}>Prev</button>
                <div className="pagination-scroll">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                    <button key={number} className={`pagination-number ${number === currentPage ? "active" : ""}`} onClick={() => {setCurrentPage(number); window.scrollTo(0,0)}}>
                      {number}
                    </button>
                  ))}
                </div>
                <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => {setCurrentPage(currentPage + 1); window.scrollTo(0,0)}}>Next</button>
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
                setSelectedTags([]); // Xóa tags
                setSearch("");       // Xóa tìm kiếm
                setCurrentPage(1);   // Về trang đầu
              }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="section-divider-line"></div>

      {/* ================= SECTION 2: POPULAR DESTINATIONS ================= */}
      {popularDestinations.length > 0 && (
        <div id="popular-section" className="section-block section-popular">
          <div className="section-header-center">
            <h2>🔥 Vietnam's Most Famous Spots</h2>
            <p>Must-visit destinations rated by travelers worldwide</p>
          </div>
          
          <div className="explore-grid-container">
            {currentPopularItems.map((dest) => (
              <div key={dest.id} className="explore-grid-item">
                 <RecommendCard
                    destination={dest}
                    isSaved={savedIds.has(dest.id)}
                    onToggleSave={() => handleToggleSave(dest.id)}
                    onViewDetails={() => setViewingDestination(dest)}
                    onCreateTrip={() => { setSelectedDestination(dest); setShowForm(true); }}
                  />
              </div>
            ))}
          </div>

          {totalPopularPages > 1 && (
            <div className="pagination-wrapper">
              <button className="pagination-btn" disabled={popularPage === 1} onClick={() => handlePopularPageChange(popularPage - 1)}>Prev</button>
              <div className="pagination-scroll">
                {Array.from({ length: totalPopularPages }, (_, i) => i + 1).map((number) => (
                  <button key={number} className={`pagination-number ${number === popularPage ? "active" : ""}`} onClick={() => handlePopularPageChange(number)}>
                    {number}
                  </button>
                ))}
              </div>
              <button className="pagination-btn" disabled={popularPage === totalPopularPages} onClick={() => handlePopularPageChange(popularPage + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      <div className="section-divider-line"></div>

      {/* ================= SECTION 3: EXPLORE BY REGION ================= */}
      <div className="section-block section-regions">
        <div className="section-header-center">
          <h2>🌏 Explore by Region</h2>
          <p>Discover the diverse beauty of Vietnam from North to South</p>
        </div>
        
        <div className="region-cards-grid">
          <div className="region-card card-north" onClick={() => handleRegionClick("Miền Bắc")}>
            <div className="region-overlay"></div>
            <div className="region-content">
              <h3>Northern Vietnam</h3>
              <span>Mountains & History</span>
            </div>
          </div>
          <div className="region-card card-central" onClick={() => handleRegionClick("Miền Trung")}>
            <div className="region-overlay"></div>
            <div className="region-content">
              <h3>Central Coast</h3>
              <span>Heritage & Beaches</span>
            </div>
          </div>
          <div className="region-card card-south" onClick={() => handleRegionClick("Miền Nam")}>
            <div className="region-overlay"></div>
            <div className="region-content">
              <h3>Southern Vietnam</h3>
              <span>Rivers & Modernity</span>
            </div>
          </div>
        </div>
      </div>

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

      {/* SCROLL TO TOP BUTTON */}
      <ScrollToTopButton />
    </div>
  );
}