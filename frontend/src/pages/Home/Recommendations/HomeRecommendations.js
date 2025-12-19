import React, { useEffect, useState } from "react";
import RecommendCard from "./RecommendCard";
import axios from "axios";

export default function HomeRecommendations({
  savedIds,
  handleToggleSave,
  onCreateTrip, // có thể truyền từ ngoài
  destinations, // nếu không truyền, sẽ tự fetch
}) {
  const [fetchedDestinations, setFetchedDestinations] = useState([]);

  // Nếu không có destinations props thì mới fetch từ API
  useEffect(() => {
    if (!destinations) {
      axios
        .get("/api/destinations")
        .then((res) => setFetchedDestinations(res.data))
        .catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.error("Error fetching destinations:", err);
          }
        });
    }
  }, [destinations]);

  // Ưu tiên dùng destinations truyền từ props, nếu không có thì dùng cái đã fetch
  const list = destinations || fetchedDestinations;

  // Fallback cho onCreateTrip
  const handleCreateTrip = (dest) => {
    if (onCreateTrip) {
      onCreateTrip(dest); // gửi luôn object
    }
  };

  const handleViewDetails = (id) => {
    // Placeholder for view details functionality
    // Can be implemented later if needed
  };

  return (
    <>
      {list.map((dest) => (
        <RecommendCard
          key={dest.id}
          destination={dest}
          isSaved={savedIds ? savedIds.has(dest.id) : false}
          onToggleSave={handleToggleSave}
          onViewDetails={handleViewDetails}
          onCreateTrip={() => handleCreateTrip(dest)} // gửi luôn object
        />
      ))}
    </>
  );
}
