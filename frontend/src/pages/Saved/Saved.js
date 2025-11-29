import React, { useEffect, useState } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import API from "../../untils/axios";
import { FaSearch } from "react-icons/fa";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const token = localStorage.getItem("access_token");

  const [activeTab, setActiveTab] = useState("saved");
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  useEffect(() => {
    if (!token) {
      setDestinations([]);
      return;
    }

    API.get("/saved/list", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setDestinations(res.data))
      .catch(console.error);
  }, [token, savedIds]);

  const handleUnsave = async (id) => {
    await handleToggleSave(id);
    setDestinations(prev => prev.filter(d => d.id !== id));
  };

  // Filtered by search
  const filteredDestinations = destinations.filter(dest =>
    dest.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="saved-wrapper">

      {/* Header */}
      <div className="saved-header">
        <h1>Collections</h1>
        <p>All your saved destinations and places you love.</p>

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
            Collections
          </button>
        </div>

        {/* Search bar */}
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

      {/* Content */}
      <div className="saved-content">
        {activeTab === "saved" && (
          <div className="saved-list">
            {filteredDestinations.length === 0 ? (
              <div className="saved-empty">
                <img src="/empty-state.svg" alt="empty" />
                <h3>No saved destinations found</h3>
                <p>Browse destinations and save the ones you love to build your travel wishlist.</p>
              </div>
            ) : (
              <div className="saved-grid">
                {filteredDestinations.map(dest => (
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

        {activeTab === "collections" && (
          <div className="coming-soon">
            <h3>Collections will be added soon.</h3>
            <p>Group destinations into custom folders for better planning.</p>
          </div>
        )}
      </div>

      {/* Trip Form */}
      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
