import React from "react";
import { useNavigate } from "react-router-dom";
import "./hero.css";
import heroImg from "./hero.png";
import bg from "../assets/home-bg.png";

export default function Hero() {
  const navigate = useNavigate();

  const handleStartChat = () => {
    navigate("/chat");
  };

  return (
    <section className="hero" style={{ backgroundImage: `url(${bg})` }}>
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <img src={heroImg} alt="AI Smart Travel" className="hero-image" />
        <button className="hero-btn" onClick={handleStartChat}>
          Start Chatting
        </button>
      </div>
    </section>
  );
}
