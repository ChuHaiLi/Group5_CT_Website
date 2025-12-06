import React, { useEffect, useState, useMemo } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import DestinationModal from "../../components/DestinationModal";
import API from "../../untils/axios";
import { FaSearch } from "react-icons/fa";
import CollectionsTab from "./CollectionsTab";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access_token");

  const [activeTab, setActiveTab] = useState("saved");
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // State cho Modal
  const [showModal, setShowModal] = useState(false);
  const [modalDestination, setModalDestination] = useState(null);

  // Handler để mở Modal
  const handleOpenModal = (destinationObj) => {
    setModalDestination(destinationObj);
    setShowModal(true);
  };

  // Handler để đóng Modal
  const handleCloseModal = () => {
    setModalDestination(null);
    setShowModal(false);
  };

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  // Handler để tạo trip từ Modal
  const handleCreateTripFromModal = (destinationObj) => {
    handleCloseModal();
    handleCreateTrip(destinationObj);
  };

  // --- GỌI API ---
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

  // Logic tìm kiếm (Cho tab Saved)
  const filteredDestinations = useMemo(() => {
    return destinations.filter((dest) =>
      dest.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [destinations, search]);

  return (
    <div className="saved-wrapper">
      {/* HEADER */}
      <div className="saved-header">
        <h1>Collections</h1>
        <p>All your saved destinations organized your way.</p>

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
            Collections (Group & Sort)
          </button>
        </div>

        {/* Thanh tìm kiếm (Chỉ hiện ở tab Saved) */}
        {activeTab === "saved" && (
          <div className="saved-search">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search saved destinations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="saved-content">
        {/* Trường hợp: Đang tải */}
        {loading ? (
          <div className="saved-empty">
            <p>Loading your collections...</p>
          </div>
        ) : destinations.length === 0 ? (
          /* Trường hợp: Danh sách rỗng */
          <div className="saved-empty">
            <img
              src="https://cdn-icons-png.flaticon.com/512/4076/4076432.png"
              alt="empty"
              style={{ width: "120px", opacity: 0.5, marginBottom: "1rem" }}
              onError={(e) => (e.target.style.display = "none")}
            />
            <h3>No saved destinations yet</h3>
            <p>Go to Explore page and save some amazing places!</p>
          </div>
        ) : (
          /* Trường hợp: Có dữ liệu -> Hiển thị Tab */
          <>
            {activeTab === "saved" && (
              <div className="saved-list">
                {filteredDestinations.length === 0 ? (
                  <div className="saved-empty">
                    <p>No results found for "{search}"</p>
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
                        onCardClick={() => handleOpenModal(dest)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "collections" && (
              <CollectionsTab
                destinations={destinations}
                handleUnsave={handleUnsave}
                handleCreateTrip={handleCreateTrip}
                handleOpenModal={handleOpenModal}
              />
            )}
          </>
        )}
      </div>

      {/* Modal hiển thị chi tiết địa điểm */}
      {showModal && modalDestination && (
        <DestinationModal
          destination={modalDestination}
          onClose={handleCloseModal}
          onCreateTrip={handleCreateTripFromModal}
        />
      )}

      {/* Form Tạo Chuyến Đi */}
      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}