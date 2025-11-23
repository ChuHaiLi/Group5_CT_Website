import React, { useEffect, useState } from "react";
import RecommendCard from "./RecommendCard";
import axios from "axios";

export default function HomeRecommendations({ savedIds, handleToggleSave }) {
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    axios.get("/api/destinations")
      .then(res => setDestinations(res.data))
      .catch(console.error);
  }, []);

  return (
    <>
      {destinations.map(dest => (
        <RecommendCard
          key={dest.id}
          destination={dest}
          isSaved={savedIds ? savedIds.has(dest.id) : false}
          onToggleSave={handleToggleSave}
          onViewDetails={(id) => console.log("view", id)}
          onCreateTrip={(id) => console.log("trip", id)}
        />
      ))}
    </>
  );
}
