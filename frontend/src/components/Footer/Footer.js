import React, { useState } from "react";
import {
  FaFacebookF,
  FaWhatsapp,
  FaTelegramPlane,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import "./Footer.css";

const quickLinks = [
  { label: "Home", to: "/home" },
  { label: "Explore", to: "/explore" },
  { label: "My Trips", to: "/mytrips" },
  { label: "Saved", to: "/saved" },
  { label: "Profile", to: "/profile" },
];

export default function Footer() {
  const [showMap, setShowMap] = useState(false);

  return (
    <footer className="wonderai-footer">
      <div className="footer-grid">
        <div>
          <p className="footer-brand">WonderAI Journeys</p>
          <p className="footer-tagline">
            Plan smarter, travel better. We combine real traveler wisdom with
            AI-curated ideas to keep every journey effortless.
          </p>
          <div className="footer-social">
            <a
              href="https://www.facebook.com/profile.php?id=61585391516813"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>
            <a
              href="https://wa.me/15551234567"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp />
            </a>
            <a
              href="https://t.me/wonderai_travel"
              target="_blank"
              rel="noreferrer"
              aria-label="Telegram"
            >
              <FaTelegramPlane />
            </a>
          </div>
        </div>

        <div>
          <p className="footer-heading">Quick Links</p>
          <ul>
            {quickLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
            <li>
              <a
                href="https://www.facebook.com/profile.php?id=61585391516813"
                target="_blank"
                rel="noreferrer"
              >
                Facebook Page
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-heading">Contact Us</p>
          <ul className="footer-contact">
            <li>
              <FaEnvelope />
              <a href="mailto:hellowonderai@gmail.com">hellowonderai@gmail.com</a>
            </li>
            <li>
              <FaPhoneAlt />
              <a href="tel:+84 99999 99999">+84 99999 9999</a>
            </li>
            <li className="address-with-map">
              <div className="address-text">
                <FaMapMarkerAlt />
                <span>136 Nguyen Van Cu, District 1, Ho Chi Minh City</span>
              </div>
              <button 
                className="view-map-btn"
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? 'Hide Map' : 'View on Map'}
              </button>
              {showMap && (
                <div className="map-container">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d664.5534752786523!2d106.68418487165826!3d10.758948543842083!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f1b22828983%3A0xe10f03f5cccc28ef!2zMTM2IE5ndXnhu4VuIFbEg24gQ-G7qywgUGjGsOG7nW5nIE5ndXnhu4VuIEPGsCBUcmluaCwgUXXhuq1uIDEsIFRow6BuaCBwaOG7kSBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e1!3m2!1svi!2s!4v1765993346579!5m2!1svi!2s"
                    width="600"
                    height="450"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              )}
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-heading">Need Support?</p>
          <p className="footer-support">
            Reach our concierge team 24/7 on WhatsApp or Telegram for
            last-minute changes, bespoke itineraries, and AI-powered ideas
            tailored to your mood.
          </p>
          <a
            className="footer-support-link"
            href="mailto:support@wonderai.travel"
          >
            support@wonderai.travel
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} WonderAI Travel Collective. All rights
          reserved.
        </p>
        <div>
          <a href="/terms" title="Terms of Service">
            Terms
          </a>
          <span>•</span>
          <a href="/privacy" title="Privacy Policy">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}