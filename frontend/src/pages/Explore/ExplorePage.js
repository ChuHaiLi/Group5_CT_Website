import React, { useEffect, useState, useRef } from "react";
import API from "../../untils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

import {
  FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
  FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
  FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
  FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
  FaMapMarkedAlt, FaFireAlt, FaPaw, FaSearch, FaChevronUp, FaChevronDown,
  FaMusic, FaSpa, FaChild, FaCrown, FaTimes
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

// --- FAMOUS LOCATIONS (Tách phần 2) ---
const FAMOUS_LOCATIONS = [
  "vinh ha long", "ha long bay", "pho co hoi an", "hoi an", "ba na hills", "golden bridge",
  "fansipan", "sapa", "trang an", "ninh binh", "cu chi tunnels", "phong nha",
  "dragon bridge", "hoan kiem lake", "hue imperial city", "phu quoc", "da lat",
  "nha tho duc ba", "cho ben thanh", "dinh doc lap", "landmark 81", "vinwonders", "hoi an ancient town"
];

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

// CẤU HÌNH PHÂN TRANG
const REGULAR_ITEMS_PER_PAGE = 15; // Phần 1: 15 địa điểm
const POPULAR_ITEMS_PER_PAGE = 9;  // Phần 2: 9 địa điểm

// Utils
const normalizeString = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
};

// Sanitize search string: remove zero-width chars, punctuation, collapse spaces
const sanitizeSearch = (str) => {
  if (!str) return "";
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, "")           // remove zero-width
    .replace(/[^\p{L}\p{N}\s]/gu, " ")               // remove punctuation (unicode-safe)
    .replace(/\s+/g, " ")                            // collapse spaces
    .trim();
};

const parseTags = (tagsRaw) => {
  if (Array.isArray(tagsRaw)) return tagsRaw;
  if (typeof tagsRaw === 'string') {
    try {
      return JSON.parse(tagsRaw.replace(/'/g, '"'));
    } catch (e) {
      return tagsRaw.replace(/[\]']/g, "").split(",").map(t => t.trim());
    }
  }
  return [];
};

// Get all valid tags from TAG_CATEGORIES
const ALL_VALID_TAGS = new Set(TAG_CATEGORIES.flatMap(c => c.tags));

// Check if a string is a valid tag (not a location name)
const isValidTag = (tag) => ALL_VALID_TAGS.has(tag);

// Filter valid tags from array, return invalid ones as location names
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

export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
  // State Data
  const [regularDestinations, setRegularDestinations] = useState([]); 
  const [popularDestinations, setPopularDestinations] = useState([]); 
  
  // State Filter
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // State UI
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [viewingDestination, setViewingDestination] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  const categoryRefs = useRef({});
  
  // State Pagination
  const [currentPage, setCurrentPage] = useState(1); // Page cho phần 1
  const [popularPage, setPopularPage] = useState(1); // Page cho phần 2 (MỚI)

  // Locations
  const [vietnamLocations, setVietnamLocations] = useState([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");

  const location = useLocation();

  // #region agent log
  // Debug: Log navigation state and URL params on mount and when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tagsParam = urlParams.get("tags");
    const qParam = urlParams.get("q");
    
    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:119',message:'Navigation state received',data:{locationState:location.state,urlTags:tagsParam,urlQ:qParam,fullUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,D,E'})}).catch(()=>{});
  }, [location.state, location.search]);
  // #endregion

  // Thêm useEffect để xử lý preSelectedTags từ navigation và URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tagsParam = urlParams.get("tags");
    const qParam = urlParams.get("q");
    const state = location.state || {};
    const preSearch = state.preSearch || state.q || "";
    const preTagsRaw = state.preSelectedTags || state.tags || [];

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:122',message:'Processing navigation inputs',data:{urlTags:tagsParam,urlQ:qParam,statePreSearch:preSearch,statePreTags:preTagsRaw,fullState:state},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C,D,E'})}).catch(()=>{});
    // #endregion

    // Handle URL ?tags= param - separate valid tags from location names
    if (tagsParam) {
      const parts = decodeURIComponent(tagsParam).split(",").map(t => t.trim()).filter(Boolean);
      const { validTags, locations } = separateTagsAndLocations(parts);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:150',message:'Parsed URL tags param - separated',data:{parts:parts,validTags:validTags,locations:locations},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Set valid tags to selectedTags
      if (validTags.length > 0) {
        setSelectedTags((prev) => {
          const newTags = [...prev];
          validTags.forEach((tag) => {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:163',message:'Set valid tags from URL param',data:{newTags:newTags},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return newTags;
        });
      }
      
      // Set location names to search (join with space if multiple)
      if (locations.length > 0) {
        const locationSearch = locations.join(" ");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:172',message:'Set search from URL param (location names)',data:{locationSearch:locationSearch},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setSearch(locationSearch);
      }
    }

    // Handle URL ?q= param (search query)
    if (qParam) {
      const decodedQ = decodeURIComponent(qParam);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:149',message:'Setting search from URL q param',data:{qParam:decodedQ},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setSearch(decodedQ);
    }

    // Handle location.state.preSearch
    if (preSearch) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:156',message:'Setting search from state.preSearch',data:{preSearch:preSearch},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setSearch(preSearch);
    }

    // Handle location.state.preSelectedTags - separate valid tags from location names
    if (preTagsRaw && preTagsRaw.length > 0) {
      const tagsToSelect = Array.isArray(preTagsRaw) ? preTagsRaw : [preTagsRaw];
      const { validTags, locations } = separateTagsAndLocations(tagsToSelect);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:195',message:'Processing preSelectedTags from state - separated',data:{tagsToSelect:tagsToSelect,validTags:validTags,locations:locations},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Set valid tags to selectedTags
      if (validTags.length > 0) {
        setSelectedTags((prev) => {
          const newTags = [...prev];
          validTags.forEach((tag) => {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:207',message:'Set valid tags from state',data:{newTags:newTags,prevTags:prev},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return newTags;
        });
      }
      
      // Set location names to search
      if (locations.length > 0) {
        const locationSearch = locations.join(" ");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:216',message:'Set search from state (location names)',data:{locationSearch:locationSearch},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setSearch(locationSearch);
      }
    }
    
    // Clear state và URL params sau khi đã xử lý để tránh re-trigger
    if (location.state || tagsParam || qParam) {
      window.history.replaceState({}, document.title);
      // Clear URL params
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
      .catch((err) => console.error(err));
  }, []);

  // --- HANDLERS ---
  const handleSearchChange = (e) => { setSearch(e.target.value); setCurrentPage(1); };
  const handleProvinceChange = (e) => { setSelectedProvinceId(e.target.value); setCurrentPage(1); };
  
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

  // #region agent log
  // Debug: Log filter state before filtering
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:196',message:'Filter state before filtering',data:{search:search,searchRaw:JSON.stringify(search),selectedTags:selectedTags,selectedCategory:selectedCategory,selectedProvinceId:selectedProvinceId,totalDestinations:regularDestinations.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
  }, [search, selectedTags, selectedCategory, selectedProvinceId, regularDestinations.length]);
  // #endregion

  // --- FILTER LOGIC (SECTION 1) ---
  const filteredRegularItems = regularDestinations.filter((dest) => {
    const destNameNorm = normalizeString(dest.name);
    const destProvinceNorm = normalizeString(dest.province_name);
    const destRegionNorm = dest.region_name ? normalizeString(dest.region_name) : "";
    // Sanitize search before normalizing to handle dirty characters
    const sanitizedSearch = sanitizeSearch(search);
    const searchNorm = normalizeString(sanitizedSearch);
    // Use token-based matching for better flexibility
    const searchTokens = searchNorm.split(" ").filter(Boolean);
    const destTags = parseTags(dest.tags);

    // Token-based search: all tokens must match (more flexible than exact string match)
    const matchesSearch = searchTokens.length === 0 || 
      searchTokens.every((token) =>
        destNameNorm.includes(token) ||
        destProvinceNorm.includes(token) ||
        destRegionNorm.includes(token)
      );

    const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => destTags.includes(tag));
    
    let matchesProvince = true;
    if (selectedProvinceId) {
        if (dest.province_id) matchesProvince = String(dest.province_id) === String(selectedProvinceId);
        else if (dest.province_name) {
             const selectedProvObj = vietnamLocations.find(p => String(p.id) === String(selectedProvinceId));
             if (selectedProvObj) matchesProvince = normalizeString(dest.province_name).includes(normalizeString(selectedProvObj.name));
        }
    }

    let matchesCategory = true;
    if (selectedCategory) {
        matchesCategory = destTags.some(tag => 
          normalizeString(tag).includes(normalizeString(selectedCategory)) || 
          normalizeString(selectedCategory).includes(normalizeString(tag))
        );
    }

    const finalMatch = matchesSearch && matchesTags && matchesProvince && matchesCategory;
    
    // #region agent log
    // Log first few destinations to understand filter behavior
    if (regularDestinations.indexOf(dest) < 3) {
      fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:227',message:'Filter evaluation for destination',data:{destName:dest.name,destNameNorm:destNameNorm,search:search,searchNorm:searchNorm,matchesSearch:matchesSearch,selectedTags:selectedTags,destTags:destTags,matchesTags:matchesTags,matchesProvince:matchesProvince,matchesCategory:matchesCategory,finalMatch:finalMatch},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B'})}).catch(()=>{});
    }
    // #endregion

    return finalMatch;
  });

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
    setSelectedProvinceId(""); setSelectedCategory(null); setSelectedTags([]);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePopularPageChange = (pageNum) => {
    setPopularPage(pageNum);
    // Scroll nhẹ đến đầu section Popular nếu cần (tuỳ chọn)
    const section = document.getElementById('popular-section');
    if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="explore-container">
      
      {/* ================= SECTION 1: SEARCH & FILTER ================= */}
      <div className="section-block">
        <h1 className="explore-header">Find Your Dream Trip ✈️</h1>

        <div className="search-bar-container">
          <div className="search-bar">
              <div className="search-input-wrapper">
                  <FaSearch className="search-icon" />
                  <input type="text" placeholder="Tìm theo tên địa điểm, tỉnh thành hoặc vùng miền..." value={search} onChange={handleSearchChange} />
              </div>
              <div className="search-divider"></div>
              <div className="search-location-wrapper">
                  <div className="select-container">
                    <select className="location-select" value={selectedProvinceId} onChange={handleProvinceChange}>
                        <option value="">Tất cả địa điểm</option>
                        {vietnamLocations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <FaChevronDown className="select-arrow-icon" />
                  </div>
              </div>
          </div>
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
        {/* #region agent log */}
        {(() => {
          fetch('http://127.0.0.1:7242/ingest/b6d4146b-fa7c-455f-bcf9-38806ee96596',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ExplorePage.js:336',message:'Final filter results',data:{filteredCount:filteredRegularItems.length,search:search,selectedTags:selectedTags,selectedCategory:selectedCategory,selectedProvinceId:selectedProvinceId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
          return null;
        })()}
        {/* #endregion */}

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
            
            {/* Pagination 1 */}
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
            <img src="https://cdn-icons-png.flaticon.com/512/7486/7486831.png" alt="Thinking" className="empty-state-img" />
            <h3 className="empty-state-title">Hmm, chưa tìm thấy kết quả nào...</h3>
            <button className="empty-state-btn" onClick={() => { setSearch(""); setSelectedCategory(null); setSelectedTags([]); setSelectedProvinceId(""); setCurrentPage(1); }}>Làm mới bộ lọc</button>
          </div>
        )}
      </div>

      {/* ĐƯỜNG KẺ PHÂN CÁCH */}
      <div className="section-divider-line"></div>

      {/* ================= SECTION 2: POPULAR DESTINATIONS (PAGINATED GRID) ================= */}
      {popularDestinations.length > 0 && (
        <div id="popular-section" className="section-block section-popular">
          <div className="section-header-center">
            <h2>🔥 Vietnam's Most Famous Spots</h2>
            <p>Must-visit destinations rated by travelers worldwide</p>
          </div>
          
          {/* Grid hiển thị 9 địa điểm */}
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

          {/* Pagination 2 */}
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

      {/* ================= SECTION 3: EXPLORE BY REGION (3 BANNER 1 HÀNG) ================= */}
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
        <DestinationModal destination={viewingDestination} onClose={() => setViewingDestination(null)} onCreateTrip={(dest) => { setViewingDestination(null); setSelectedDestination(dest); setShowForm(true); }} />
      )}
      {showForm && selectedDestination && (
        <CreateTripForm initialDestination={selectedDestination} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}