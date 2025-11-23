import React from "react";
import "./hero.css";
import heroImg from "./hero.png";
import bg from "../assets/home-bg.png";

export default function Hero(){
    return (
        <section 
            className = "hero"
            style={{ backgroundImage: `url(${bg})` }}
        >
            <div className = "hero-overlay"></div>
            <div className = "hero-content">
                <img src={heroImg} alt="AI Smart Travel" className="hero-image"/>
                <button className="hero-btn">Start Chatting</button>
            </div>
        </section>
    );
}