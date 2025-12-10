import React, { useEffect, useState, useMemo } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import API from "../../untils/axios";
import { FaSearch, FaFilter, FaSortAmountDown, FaSortAmountUp, FaLayerGroup } from "react-icons/fa"; // Đã thêm icon
import CollectionsTab from "./CollectionsTab";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access_token");

  const [activeTab, setActiveTab] = useState("saved");
  
  // --- FOLDER STATE ---
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem("my_user_folders");
    return saved ? JSON.parse(saved) : [];
  });
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // --- STATE CHO FILTER & SORT (TAB SAVED) ---
  const [groupBy, setGroupBy] = useState("all");
  const [sortOrder, setSortOrder] = useState("asc");

  // Danh sách các tiêu chí phân loại
  const filterOptions = [
    { id: "all", label: "All Places" },
    { id: "region", label: "Region" },
    { id: "city", label: "City" },
    { id: "rating", label: "Rating" },
    { id: "budget", label: "Budget" },
    { id: "tags", label: "Tags" },
  ];

  // --- EFFECT: LƯU FOLDER ---
  useEffect(() => {
    localStorage.setItem("my_user_folders", JSON.stringify(folders));
  }, [folders]);

  // --- FOLDER HANDLERS ---
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: newFolderName,
        items: []
      };
      setFolders([...folders, newFolder]);
      setNewFolderName("");
      setShowCreateFolderModal(false);
    }
  };

  const handleDeleteFolder = (folderId) => {
    if (window.confirm("Are you sure you want to delete this folder?")) {
      setFolders(folders.filter(f => f.id !== folderId));
    }
  };

  const handleAddToFolder = (folderId, itemIds) => {
    setFolders(folders.map(f => {
      if (f.id === folderId) {
        const uniqueItems = [...new Set([...f.items, ...itemIds])];
        return { ...f, items: uniqueItems };
      }
      return f;
    }));
  };

  const handleRemoveFromFolder = (folderId, itemId) => {
    setFolders(folders.map(f => {
      if (f.id === folderId) {
        // Hỗ trợ xóa 1 ID hoặc mảng ID
        const idsToRemove = Array.isArray(itemId) ? itemId : [itemId];
        return { ...f, items: f.items.filter(id => !idsToRemove.includes(id)) };
      }
      return f;
    }));
  };

  // --- API HANDLERS ---
  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  useEffect(() => {
    const fetchData = async () => {
        if (!token) {
            setDestinations([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await API.get("/saved/list");
            setDestinations(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch saved list:", error);
            setDestinations([]);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [token, savedIds]);

  const handleUnsave = async (id) => {
    await handleToggleSave(id);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  // --- LOGIC GROUPING & SORTING (TAB SAVED) ---
  const savedContentData = useMemo(() => {
    // 1. Lọc theo thanh tìm kiếm trước
    const filtered = destinations.filter(dest =>
      dest.name.toLowerCase().includes(search.toLowerCase())
    );

    // Nếu không có dữ liệu sau khi search
    if (filtered.length === 0) return [];

    // 2. Nếu chọn "All" -> Trả về danh sách phẳng (đã sort)
    if (groupBy === 'all') {
        const sorted = [...filtered].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        // Trả về dạng đặc biệt để render Grid
        return [{ type: 'flat', items: sorted }];
    }

    // 3. Nếu chọn Group -> Gom nhóm
    const groups = {};

    filtered.forEach((dest) => {
      let keys = [];
      switch (groupBy) {
        case "region":
          keys.push(dest.region_name || "Unknown Region");
          break;
        case "city":
          keys.push(dest.province_name || "Unknown City");
          break;
        case "budget":
          const fee = dest.entry_fee || 0;
          if (fee === 0) keys.push("A. Free");
          else if (fee < 200000) keys.push("B. Economy (< 200k)");
          else if (fee < 500000) keys.push("C. Standard (200k - 500k)");
          else if (fee < 2000000) keys.push("D. Premium (500k - 2M)");
          else keys.push("E. Luxury (> 2M)");
          break;
        case "rating":
          const star = Math.floor(dest.rating || 0);
          keys.push(`${star} Star${star !== 1 ? 's' : ''}`);
          break;
        case "tags":
          if (dest.tags) {
            const tagList = Array.isArray(dest.tags) 
                ? dest.tags 
                : (typeof dest.tags === 'string' ? dest.tags.split(",").map(t => t.trim()) : []);
            
            if (tagList.length > 0) {
                tagList.forEach(t => {
                    // Thay thế <= thành ≤ nếu ở đầu chuỗi
                    keys.push(t.replace(/^<=/, "≤"));
                });
            } else {
                keys.push("No Tags");
            }
          } else {
            keys.push("No Tags");
          }
          break;
        default:
          keys.push("All");
      }

      // Đẩy item vào từng nhóm
      keys.forEach(k => {
        if (!groups[k]) groups[k] = [];
        // Tránh trùng lặp trong cùng 1 nhóm (nếu logic tag có vấn đề)
        if (!groups[k].find(d => d.id === dest.id)) {
            groups[k].push(dest);
        }
      });
    });

    // 4. Sắp xếp thứ tự các NHÓM (Group Headers)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (sortOrder === 'asc') return a.localeCompare(b, 'vi');
        return b.localeCompare(a, 'vi');
    });

    return sortedKeys.map(key => ({
        type: 'group',
        title: key,
        items: groups[key]
    }));

  }, [destinations, search, groupBy, sortOrder]);

  return (
    <div className="saved-wrapper">
      <div className="saved-header">
        <h1>Places You’re Keeping</h1>
        <p>Keep all your dream destinations in one place — a personalized space where every spot you save becomes a trip waiting to happen. ✨</p>

        <div className="saved-tabs">
          <button 
            className={activeTab === "saved" ? "active" : ""}
            onClick={() => setActiveTab("saved")}
          >
            Saved ({destinations.length})
          </button>

          <button 
            className={activeTab === "collections" ? "active" : ""}
            onClick={() => setActiveTab("collections")}
          >
            Collections ({folders.length})
          </button>
        </div>

        {activeTab === "saved" && (
          <>
            {/* 1. THANH TÌM KIẾM CŨ */}
            <div className="saved-search">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search saved destinations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* 2. THANH CÔNG CỤ MỚI: GROUP & SORT */}
            <div className="saved-controls">
              <div className="group-filters">
                <span className="control-label"><FaLayerGroup /> Group by:</span>
                <div className="group-options">
                  {filterOptions.map(opt => (
                    <button 
                      key={opt.id} 
                      className={`filter-chip ${groupBy === opt.id ? 'active' : ''}`}
                      onClick={() => setGroupBy(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="sort-controls">
                <button 
                  className="sort-btn" 
                  onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  title={sortOrder === "asc" ? "Sort A to Z" : "Sort Z to A"}
                >
                  {sortOrder === "asc" ? (
                    <> A - Z <FaSortAmountDown /></>
                  ) : (
                    <> Z - A <FaSortAmountUp /></>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="saved-content">
        {loading ? (
            <div className="saved-empty"><p>Loading...</p></div>
        ) : (
            <>
                {/* TAB SAVED - HIỂN THỊ MỚI (CÓ GROUPING) */}
                {activeTab === "saved" && (
                    <div className="saved-list">
                        {savedContentData.length === 0 ? (
                            <div className="saved-empty">
                                <img src="/empty-state.svg" alt="" onError={(e)=>e.target.style.display='none'} style={{width: 150, opacity: 0.5, marginBottom: 20}}/>
                                <h3>No saved destinations found</h3>
                                <p>Try adjusting your search or filters.</p>
                            </div>
                        ) : (
                            <div className="grouped-container">
                                {savedContentData.map(dataItem => (
                                    dataItem.type === 'flat' ? (
                                        // Dạng 1: Lưới phẳng (Khi chọn All)
                                        <div key="flat-list" className="saved-grid">
                                            {dataItem.items.map(dest => (
                                                <RecommendCard
                                                    key={dest.id}
                                                    destination={dest}
                                                    isSaved={true}
                                                    onToggleSave={() => handleUnsave(dest.id)}
                                                    onCreateTrip={() => handleCreateTrip(dest)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        // Dạng 2: Phân nhóm (Khi chọn Group)
                                        <div key={dataItem.title} className="group-section">
                                            <div className="group-header">
                                                <span className="header-text">{dataItem.title}</span>
                                                <span className="header-count">{dataItem.items.length}</span>
                                                <div className="header-line"></div>
                                            </div>
                                            <div className="saved-grid">
                                                {dataItem.items.map(dest => (
                                                    <RecommendCard
                                                        key={`${dataItem.title}-${dest.id}`}
                                                        destination={dest}
                                                        isSaved={true}
                                                        onToggleSave={() => handleUnsave(dest.id)}
                                                        onCreateTrip={() => handleCreateTrip(dest)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB COLLECTIONS (GIỮ NGUYÊN) */}
                {activeTab === "collections" && (
                    <CollectionsTab 
                        allDestinations={destinations}
                        folders={folders}
                        onCreateFolder={() => setShowCreateFolderModal(true)}
                        onDeleteFolder={handleDeleteFolder}
                        onAddToFolder={handleAddToFolder}
                        onRemoveFromFolder={handleRemoveFromFolder}
                    />
                )}
            </>
        )}
      </div>

      {/* MODAL TẠO FOLDER */}
      {showCreateFolderModal && (
        <div className="modal-overlay">
          <div className="create-folder-modal">
            <h3>New Folder</h3>
            <input 
              type="text" 
              placeholder="Name your folder (e.g. Summer Trip)" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCreateFolderModal(false)}>Cancel</button>
              <button className="btn-create" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}