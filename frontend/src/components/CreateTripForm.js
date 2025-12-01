import React, { useState, useEffect } from "react";
import { FaClock, FaUser, FaMoneyBillWave, FaPlus, FaMapMarkerAlt } from "react-icons/fa";
import "./CreateTripForm.css";

export default function CreateTripForm({ initialDestination, onClose }) {
  const [tripName, setTripName] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [newDestination, setNewDestination] = useState("");
  const [duration, setDuration] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [budget, setBudget] = useState("");

  // Hiện sẵn địa điểm từ card
  useEffect(() => {
    if (initialDestination) {
      setDestinations([initialDestination.name]);
    }
  }, [initialDestination]);

  const durationOptions = ["1-3 days", "4-7 days", "8-14 days", "15+ days"];
  const peopleOptions = ["1 person", "2-4 people", "5-10 people", "10+ people"];
  const budgetOptions = ["< 5 triệu", "5-10 triệu", "10-20 triệu", "> 20 triệu"];
  const handleAddDestination = () => {
    if (newDestination && !destinations.includes(newDestination)) {
      setDestinations(prev => [...prev, newDestination]);
      setNewDestination("");
    }
  };

  const handleRemoveDestination = (dest) => {
    setDestinations(prev => prev.filter(d => d !== dest));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tripName || destinations.length === 0 || !duration || !peopleCount || !budget) {
      alert("Please fill all fields!");
      return;
    }

    console.log({ tripName, destinations, duration, peopleCount, budget });
    alert(`Trip "${tripName}" created!`);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="create-trip-form">
        <h2>Create a Trip</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Trip Name"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="trip-name-input"
          />

          <div className="destinations-group">
            <label><FaMapMarkerAlt /> Destinations</label>
            <div className="destination-list">
              {destinations.map(dest => (
                <span key={dest} className="destination-item">
                  {dest} <button type="button" onClick={() => handleRemoveDestination(dest)}>x</button>
                </span>
              ))}
            </div>
            <div className="destination-add">
              <input
                type="text"
                placeholder="Add destination"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddDestination(); } }}
              />
              <button type="button" onClick={handleAddDestination}><FaPlus /></button>
            </div>
          </div>

          <div className="options-group">
            <div className="option-card">
              <label><FaClock /> Duration</label>
              <div className="option-pills">
                {durationOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={duration === opt ? "pill selected" : "pill"}
                    onClick={() => setDuration(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaUser /> People</label>
              <div className="option-pills">
                {peopleOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={peopleCount === opt ? "pill selected" : "pill"}
                    onClick={() => setPeopleCount(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-card">
              <label><FaMoneyBillWave /> Budget</label>
              <div className="option-pills">
                {budgetOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={budget === opt ? "pill selected" : "pill"}
                    onClick={() => setBudget(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-buttons">
            <button type="submit">Create Trip</button>
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
