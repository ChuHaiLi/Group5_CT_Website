import React, { useState, useMemo } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import { FaSortAmountUp, FaSortAmountDown, FaLayerGroup } from "react-icons/fa";

export default function CollectionsTab({ 
  destinations, 
  handleUnsave, 
  handleCreateTrip,
  handleOpenModal
}) {
  
  // HOOKS DECLARATION
  const [groupBy, setGroupBy] = useState("city"); 
  const [sortOrder, setSortOrder] = useState("asc");

  const filterOptions = [
    { id: "region", label: "Region" },
    { id: "city", label: "City" },
    { id: "rating", label: "Rating" },
    { id: "budget", label: "Budget" },
    { id: "tags", label: "Tags" },
  ];

  // Logic: Grouping and Sorting
  const groupedDestinations = useMemo(() => {
    // Return empty if no data
    if (!destinations || destinations.length === 0) return [];

    const groups = {};

    destinations.forEach((dest) => {
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
        case "tags":
          if (dest.tags) {
            const tagList = Array.isArray(dest.tags) 
              ? dest.tags 
              : (typeof dest.tags === 'string' ? dest.tags.split(",").map(t => t.trim()) : []);
            
            if (tagList.length > 0) tagList.forEach(t => keys.push(t));
            else keys.push("No Tags");
          } else {
            keys.push("No Tags");
          }
          break;
        case "rating":
          const star = Math.floor(dest.rating || 0);
          keys.push(`${star} Star${star > 1 ? "s" : ""}`);
          break;
        default:
          keys.push("All Items");
      }

      keys.forEach((k) => {
        if (!groups[k]) groups[k] = [];
        if (!groups[k].find(d => d.id === dest.id)) {
          groups[k].push(dest);
        }
      });
    });

    // Sorting Keys (A-Z)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a.includes("Unknown") || a.includes("No ")) return 1;
      if (b.includes("Unknown") || b.includes("No ")) return -1;
      
      if (sortOrder === "asc") return a.localeCompare(b, 'vi');
      return b.localeCompare(a, 'vi');
    });

    return sortedKeys.map(key => ({
      title: key,
      items: groups[key]
    }));

  }, [destinations, groupBy, sortOrder]);

  // CHECK EMPTY STATE
  if (!destinations || destinations.length === 0) {
    return (
      <div className="saved-empty">
        <img 
            src="https://cdn-icons-png.flaticon.com/512/4076/4076432.png" 
            alt="empty" 
            style={{ width: "120px", opacity: 0.5, marginBottom: "1rem" }}
            onError={(e) => e.target.style.display = 'none'} 
        />
        <h3>No saved destinations yet</h3>
        <p>Explore amazing places and save them here to organize your next adventure!</p>
      </div>
    );
  }

  // RENDER UI
  return (
    <div className="collections-container">
      {/* FILTER BAR */}
      <div className="filter-container">
        <div className="filter-left">
          <span className="filter-title"><FaLayerGroup /> Group By:</span>
          <div className="filter-options">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                className={`filter-btn ${groupBy === opt.id ? "active" : ""}`}
                onClick={() => setGroupBy(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-right">
          <button
            className={`sort-direction-btn ${sortOrder === 'asc' ? 'active' : ''}`}
            onClick={() => setSortOrder('asc')}
            title="A-Z"
          >
            <FaSortAmountUp /> A-Z
          </button>
          <button
            className={`sort-direction-btn ${sortOrder === 'desc' ? 'active' : ''}`}
            onClick={() => setSortOrder('desc')}
            title="Z-A"
          >
            <FaSortAmountDown /> Z-A
          </button>
        </div>
      </div>

      {/* GROUPED LIST */}
      <div className="grouped-list">
        {groupedDestinations.map((group) => (
          <div key={group.title} className="group-section">
            <div className="group-header">
              <span className="header-text">{group.title}</span>
              <span className="header-count">{group.items.length}</span>
              <div className="header-line"></div>
            </div>
            <div className="saved-grid">
              {group.items.map((dest) => (
                <RecommendCard
                  key={`${group.title}-${dest.id}`}
                  destination={dest}
                  isSaved={true}
                  onToggleSave={() => handleUnsave(dest.id)}
                  onCreateTrip={() => handleCreateTrip(dest)}
                  onCardClick={() => handleOpenModal(dest)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}