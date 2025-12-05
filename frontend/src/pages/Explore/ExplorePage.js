import React, { useEffect, useState, useRef, useCallback } from "react";
import API from "../../untils/axios";
import { TAG_CATEGORIES } from "../../data/tags.js";
import { toast } from "react-toastify";

import {
    FaUmbrellaBeach, FaMountain, FaLandmark, FaUtensils, FaHiking, FaTree, FaCity,
    FaWater, FaCamera, FaCampground, FaShoppingCart, FaSwimmer, FaBicycle, FaBinoculars,
    FaUsers, FaUser, FaClock, FaCalendarAlt, FaSun, FaCloudSun, FaLeaf, FaSnowflake,
    FaMoon, FaStar, FaMoneyBillWave, FaDollarSign, FaGem, FaGift, FaEye, FaImage,
    FaMapMarkedAlt, FaFireAlt, FaPaw, FaSearch, FaChevronUp, FaChevronDown,
    FaChevronLeft, FaChevronRight, FaMusic, FaSpa, FaChild, FaCrown
} from "react-icons/fa";

import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";

import "./ExplorePage.css";

/* ICON MAP */
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

/* CATEGORY ICONS */
const CATEGORY_ICON_MAP = {
    "Destination Type": <FaMapMarkedAlt />, Activities: <FaHiking />,
    "Target Audience": <FaUsers />, Duration: <FaClock />, "Season/Time": <FaCalendarAlt />,
    Budget: <FaDollarSign />, "Special Features": <FaStar />
};

export default function ExplorePage({ savedIds = new Set(), handleToggleSave }) {
    const [destinations, setDestinations] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [openCategory, setOpenCategory] = useState(null);
    const [loading, setLoading] = useState(false); // Thêm state loading
    const categoryRefs = useRef({});
    const debounceTimer = useRef(null); // Ref cho Debounce

    // Slider state
    const [recommendIndex, setRecommendIndex] = useState(0);
    const CARDS_PER_VIEW = 3;

    // ---------------------------------------------------------
    // HÀM GỌI API (SERVER-SIDE FILTERING)
    // ---------------------------------------------------------
    const fetchDestinations = useCallback((currentSearch, currentTags) => {
        setLoading(true);
        
        // 1. Chuẩn bị tham số Query
        const searchParam = currentSearch.trim();
        const tagsParam = currentTags.join(',');
        
        let apiUrl = "/destinations";
        const params = [];
        
        // Chỉ thêm tham số nếu có giá trị
        if (searchParam.length > 0) {
            params.push(`search=${encodeURIComponent(searchParam)}`);
        }
        if (tagsParam.length > 0) {
            params.push(`tags=${encodeURIComponent(tagsParam)}`);
        }

        if (params.length > 0) {
            apiUrl += `?${params.join('&')}`;
        }
        
        // 2. Gọi API
        API.get(apiUrl)
            .then((res) => {
                setDestinations(res.data);
                setRecommendIndex(0); // Reset slider khi kết quả mới về
            })
            .catch(() => toast.error("Failed to fetch destinations"))
            .finally(() => setLoading(false));
    }, []);

    // ---------------------------------------------------------
    // Debounce Logic (Chạy Search khi search/tags thay đổi)
    // ---------------------------------------------------------
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        
        // Logic tìm kiếm chỉ cần có search hoặc tags
        if (search === "" && selectedTags.length === 0) {
            // Tải toàn bộ data mặc định nếu không có bộ lọc nào
            fetchDestinations("", []);
        } else {
            // Thiết lập timer cho hành vi tìm kiếm và lọc
            debounceTimer.current = setTimeout(() => {
                fetchDestinations(search, selectedTags); 
            }, 400); // Độ trễ 400ms

            return () => {
                // Cleanup timer cũ khi effect chạy lại
                if (debounceTimer.current) clearTimeout(debounceTimer.current);
            };
        }
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, selectedTags]); // Re-run effect khi search hoặc selectedTags thay đổi

    // ---------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------
    const toggleTag = (tag) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
        // KHÔNG CẦN gọi setRecommendIndex(0); ở đây vì useEffect đã làm điều đó
    };

    const toggleCategory = (title) => {
        setOpenCategory((prev) => (prev === title ? null : title));
    };

    // Vị trí dropdown (Giữ nguyên)
    useEffect(() => {
        if (openCategory) {
            const categoryElement = categoryRefs.current[openCategory];
            const dropdown = categoryElement?.querySelector('.tag-list-vertical');
            
            if (categoryElement && dropdown) {
                const rect = categoryElement.getBoundingClientRect();
                const dropdownWidth = dropdown.offsetWidth;
                
                dropdown.style.top = `${rect.bottom + 8}px`; 
                dropdown.style.left = `${rect.left + (rect.width - dropdownWidth) / 2}px`;
            }
        }
    }, [openCategory]);

    // Đóng dropdown khi scroll (Giữ nguyên)
    useEffect(() => {
        const handleScroll = () => {
            if (openCategory) {
                setOpenCategory(null);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [openCategory]);

    // LOẠI BỎ: filteredDestinations
    // Dữ liệu trong 'destinations' đã là kết quả lọc cuối cùng.

    const maxRecommendIndex = Math.max(0, destinations.length - CARDS_PER_VIEW);
    const handlePrevRecommend = () => setRecommendIndex((prev) => Math.max(prev - 1, 0));
    const handleNextRecommend = () => setRecommendIndex((prev) => Math.min(prev + 1, maxRecommendIndex));

    return (
        <div className="explore-container">
            <h1 className="explore-header">Explore</h1>

            {/* Search */}
            <div className="search-bar enhanced">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search destinations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Tag Categories */}
            <div className="categories-row">
                {TAG_CATEGORIES.map((cat) => (
                    <div
                        key={cat.title}
                        className={`category-item ${openCategory === cat.title ? "open" : ""}`}
                        ref={(el) => (categoryRefs.current[cat.title] = el)}
                    >
                        <button
                            className={`category-btn ${openCategory === cat.title ? "active" : ""}`}
                            onClick={() => toggleCategory(cat.title)}
                        >
                            <span className="category-left">
                                <span className="category-icon-bubble">
                                    {CATEGORY_ICON_MAP[cat.title] || <FaLandmark />}
                                </span>
                                {cat.title}
                            </span>
                            <span className="category-arrow">
                                {openCategory === cat.title ? <FaChevronUp /> : <FaChevronDown />}
                            </span>
                        </button>

                        <div className={`tag-list-vertical ${openCategory === cat.title ? "open" : ""}`}>
                            {cat.tags.map((tag) => (
                                <button
                                    key={tag}
                                    className={`tag-btn ${selectedTags.includes(tag) ? "active" : ""}`}
                                    onClick={() => toggleTag(tag)}
                                >
                                    <span className="tag-icon">{ICON_MAP[tag]}</span>
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Recommended */}
            <h2 className="recommend-header">
                {loading ? "Đang tìm kiếm..." : `Recommended for you (${destinations.length} kết quả)`}
            </h2>

            <div className="recommend-container">
                <button
                    className="arrow-btn left"
                    onClick={handlePrevRecommend}
                    disabled={recommendIndex === 0 || loading}
                >
                    <FaChevronLeft />
                </button>

                <div className="recommend-grid">
                    {/* Sử dụng state destinations đã được lọc từ server */}
                    {!loading && destinations
                        .slice(recommendIndex, recommendIndex + CARDS_PER_VIEW)
                        .map((dest) => (
                            <div key={dest.id} className="recommend-item">
                                <RecommendCard
                                    destination={dest}
                                    isSaved={savedIds.has(dest.id)}
                                    onToggleSave={() => handleToggleSave(dest.id)}
                                    onCreateTrip={() => {
                                        setSelectedDestination(dest);
                                        setShowForm(true);
                                    }}
                                />
                            </div>
                        ))}
                    
                    {/* Hiển thị khi không có kết quả */}
                    {!loading && destinations.length === 0 && (search !== "" || selectedTags.length > 0) && (
                        <p style={{textAlign: 'center', width: '100%', margin: '40px 0'}}>
                            Không tìm thấy địa điểm nào khớp với tiêu chí tìm kiếm/lọc của bạn.
                        </p>
                    )}
                     {/* Có thể thêm loading spinner hoặc skeleton UI ở đây */}
                </div>

                <button
                    className="arrow-btn right"
                    onClick={handleNextRecommend}
                    disabled={recommendIndex === maxRecommendIndex || loading}
                >
                    <FaChevronRight />
                </button>
            </div>

            {/* Create Trip Form */}
            {showForm && selectedDestination && (
                <CreateTripForm
                    initialDestination={selectedDestination}
                    onClose={() => setShowForm(false)}
                />
            )}
        </div>
    );
}