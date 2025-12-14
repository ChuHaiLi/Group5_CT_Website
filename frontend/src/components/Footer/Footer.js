import React from "react";
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
              href="https://facebook.com/wonderai.travel"
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
                href="https://facebook.com/wonderai.travel.page"
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
              <a href="tel:+15559876543">+1 555 987 6543</a>
            </li>
            <li>
              <FaMapMarkerAlt />
              <span>18F Skyline Tower, 12 Le Duan, Ho Chi Minh City</span>
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
