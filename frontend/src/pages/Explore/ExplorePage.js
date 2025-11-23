import React, { useState } from "react";
import "./ExplorePage.css";

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();
    setResults(data);
  };

  return (
    <div className="search-container">
      <h2>Search Destinations 🔍</h2>
      <div className="search-bar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter destination..."
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      <div className="search-results">
        {results.length > 0 ? (
          results.map((r) => (
            <div key={r.id} className="search-card">
              <h4>{r.name}</h4>
              <p>{r.description}</p>
            </div>
          ))
        ) : (
          <p>No results yet.</p>
        )}
      </div>
    </div>
  );
}
