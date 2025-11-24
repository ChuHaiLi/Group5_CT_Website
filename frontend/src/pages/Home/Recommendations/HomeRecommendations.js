import React from "react";
import RecommendCard from "./RecommendCard";

export default function HomeRecommendations({ savedIds, handleToggleSave, onCreateTrip, destinations }) {
  return (
    <>
      {destinations.map(dest => (
        <RecommendCard
          key={dest.id}
          destination={dest}
          isSaved={savedIds ? savedIds.has(dest.id) : false}
          onToggleSave={handleToggleSave}
          onViewDetails={(id) => console.log("view", id)}
          onCreateTrip={onCreateTrip} // gửi luôn object
        />
      ))}
    </>
  );
}
