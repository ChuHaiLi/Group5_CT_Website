import React, { useEffect, useState } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import axios from "axios";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const token = localStorage.getItem("access_token");

  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj); // lưu luôn object
    setShowForm(true);
  };

  // Đóng form
  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  useEffect(() => {
    if (!token) {
      setDestinations([]);
      return;
    }

    axios
      .get("/api/saved/list", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDestinations(res.data))
      .catch(console.error);
  }, [token, savedIds]);

  const handleUnsave = async (id) => {
    await handleToggleSave(id);
    setDestinations(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="saved-page-wrapper">
      <div className="saved-page-container">
        <h2 className="saved-page-title">Your Saved Destinations</h2>

        {destinations.length === 0 && (
          <p className="no-saved-text">You haven't saved any destinations yet.</p>
        )}

        <div className="saved-cards-container">
          {destinations.map(dest => (
            <RecommendCard
              key={dest.id}
              destination={dest}
              isSaved={true}
              onToggleSave={() => handleUnsave(dest.id)}
              onViewDetails={(id) => console.log("View details for:", id)}
              onCreateTrip={handleCreateTrip} // truyền object xuống card
            />
          ))}
        </div>

        {/* Form tạo chuyến đi */}
        {showForm && selectedDestination && (
          <CreateTripForm
            initialDestination={selectedDestination} // dùng object để tự fill
            onClose={handleCloseForm}
          />
        )}
      </div>
    </div>
  );
}
