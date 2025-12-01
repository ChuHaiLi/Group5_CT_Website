import React from "react";

export default function LocationCard({ location }) {
  return (
    <div>
      <h3>{location.name}</h3>
      <p>{location.description}</p>
      {location.image_url && <img src={location.image_url} alt={location.name} width={200} />}
    </div>
  );
}
