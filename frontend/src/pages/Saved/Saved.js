// SavedPage.js
import React, { useEffect, useState } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import CreateTripForm from "../../components/CreateTripForm";
import API from "../../untils/axios";
import "./Saved.css";

export default function SavedPage({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  const token = localStorage.getItem("access_token");

  const handleCreateTrip = (destinationObj) => {
    console.log("Create trip for:", destinationObj.id); // giữ lại log từ bản 1
    setSelectedDestination(destinationObj); // lưu luôn object
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
      // nếu backend dùng /api/saved/list thì đổi path ở đây
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setDestinations(res.data))
      .catch(console.error);
  }, [token, savedIds]);

  const handleUnsave = async (id) => {
    await handleToggleSave(id);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="saved-page-wrapper">
      <div className="saved-page-container">
        <h2 className="saved-page-title">Your Saved Destinations</h2>

        {destinations.length === 0 && (
          <p className="no-saved-text">
            You haven't saved any destinations yet.
          </p>
        )}

        <div className="saved-cards-container">
          {destinations.map((dest) => (
            <RecommendCard
              key={dest.id}
              destination={dest}
              isSaved={true}
              onToggleSave={() => handleUnsave(dest.id)}
              onViewDetails={(id) => console.log("View details for:", id)}
              onCreateTrip={handleCreateTrip} // RecommendCard sẽ gửi object lên
            />
          ))}
        </div>

        {showForm && selectedDestination && (
          <CreateTripForm
            initialDestination={selectedDestination}
            onClose={handleCloseForm}
          />
        )}
      </div>
    </div>
  );
}
