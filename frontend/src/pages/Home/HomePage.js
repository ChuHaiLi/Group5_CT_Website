import React, { useState, useEffect } from "react";
import API from "../../untils/axios";
import "./HomePage.css";
import HeroSection from "./hero/hero";
import HomeRecommendations from "./Recommendations/HomeRecommendations";
import CreateTripForm from "../../components/CreateTripForm";

export default function HomePage({ savedIds, handleToggleSave }) {
  const [allDestinations, setAllDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // Load all destinations
  useEffect(() => {
    API.get("/destinations")
      .then(res => setAllDestinations(res.data))
      .catch(console.error);
  }, []);

  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj); // lưu trực tiếp object
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  return (
    <div className="home-container">
      <HeroSection />

      <h2 className="recommendations-title">Recommended Destinations</h2>

      <div className="home-recommendations-container">
        <HomeRecommendations
          savedIds={savedIds}
          handleToggleSave={handleToggleSave}
          onCreateTrip={handleCreateTrip}
          destinations={allDestinations}
        />

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
