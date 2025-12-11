import React, { useEffect, useState, useMemo } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import API from "../../untils/axios";
import CollectionsTab from "./CollectionsTab";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access_token");

  const [activeTab, setActiveTab] = useState("saved");

  // --- FOLDER STATE ---
  // Khởi tạo từ Local Storage
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem("my_user_folders");
    return saved ? JSON.parse(saved) : [];
  });
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // Mỗi khi biến 'folders' thay đổi, nó sẽ tự lưu vào máy
  useEffect(() => {
    localStorage.setItem("my_user_folders", JSON.stringify(folders));
  }, [folders]);

  // --- FOLDER HANDLERS ---
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: newFolderName,
        items: [],
      };
      setFolders([...folders, newFolder]);
      setNewFolderName("");
      setShowCreateFolderModal(false);
    }
  };

  const handleDeleteFolder = (folderId) => {
    if (window.confirm("Are you sure you want to delete this folder?")) {
      setFolders(folders.filter((f) => f.id !== folderId));
    }
  };

  const handleAddToFolder = (folderId, itemIds) => {
    setFolders(
      folders.map((f) => {
        if (f.id === folderId) {
          const uniqueItems = [...new Set([...f.items, ...itemIds])];
          return { ...f, items: uniqueItems };
        }
        return f;
      })
    );
  };

  const handleRemoveFromFolder = (folderId, itemId) => {
    setFolders(
      folders.map((f) => {
        if (f.id === folderId) {
          return { ...f, items: f.items.filter((id) => id !== itemId) };
        }
        return f;
      })
    );
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

  const filteredDestinations = useMemo(() => {
    return destinations.filter((dest) =>
      dest.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [destinations, search]);

  return (
    <div className="saved-wrapper">
      <div className="saved-header">
        <h1>Places You’re Keeping</h1>
        <p>
          Keep all your dream destinations in one place — a personalized space
          where every spot you save becomes a trip waiting to happen. ✨
        </p>

        <div className="saved-tabs">
          <button
            className={activeTab === "saved" ? "active" : ""}
            onClick={() => setActiveTab("saved")}
          >
            Saved ({destinations.length})
          </button>

          {/* FIX: Hiển thị số lượng folder */}
          <button
            className={activeTab === "collections" ? "active" : ""}
            onClick={() => setActiveTab("collections")}
          >
            Collections ({folders.length})
          </button>
        </div>

        {activeTab === "saved" && (
          <div className="saved-search">
            <input
              type="text"
              placeholder="Search saved destinations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="saved-content">
        {loading ? (
          <div className="saved-empty">
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* TAB SAVED */}
            {activeTab === "saved" && (
              <div className="saved-list">
                {filteredDestinations.length === 0 ? (
                  <div className="saved-empty">
                    <img
                      src="/empty-state.svg"
                      alt=""
                      onError={(e) => (e.target.style.display = "none")}
                      style={{ width: 150, opacity: 0.5, marginBottom: 20 }}
                    />
                    <h3>No saved destinations found</h3>
                    <p>Browse destinations and save the ones you love.</p>
                  </div>
                ) : (
                  <div className="saved-grid">
                    {filteredDestinations.map((dest) => (
                      <RecommendCard
                        key={dest.id}
                        destination={dest}
                        isSaved={true}
                        onToggleSave={() => handleUnsave(dest.id)}
                        onCreateTrip={() => handleCreateTrip(dest)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB COLLECTIONS */}
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
              <button
                className="btn-cancel"
                onClick={() => setShowCreateFolderModal(false)}
              >
                Cancel
              </button>
              <button className="btn-create" onClick={handleCreateFolder}>
                Create
              </button>
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
