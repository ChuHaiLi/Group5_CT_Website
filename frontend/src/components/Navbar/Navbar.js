import React, { useEffect, useState, useRef } from "react"; 
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCompass,
  FaSuitcase,
  FaBookmark,
  FaUserCircle,
} from "react-icons/fa";
import API from "../../untils/axios";
import { useClickOutside } from "../../hooks/useClickOutside"; 
import "./Navbar.css";
import ProfileDropdown from "../Profile/ProfileDropdown"

import logo from "./assets/logo.png";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useClickOutside(
    dropdownRef,
    () => setDropdownOpen(false),
    dropdownOpen
  );

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser({
          ...parsed,
          tagline: parsed.tagline || "#VN" 
        });
      } catch (error) {
        console.error("Error parsing stored user:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    API.get("/auth/me")
      .then(({ data }) => {
        if (!isMounted) return;
        const normalized = {
          id: data.id,
          username: data.username,
          email: data.email,
          phone: data.phone,
          avatar: data.avatar,
          tagline: data.tagline || "#VN", 
        };
        setUser(normalized);
        localStorage.setItem("user", JSON.stringify(normalized));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      if (!event.detail) return;
      setUser((prev) => ({ 
        ...prev, 
        ...event.detail,
        tagline: event.detail.tagline || prev?.tagline || "#VN" 
      }));
    };
    window.addEventListener("wonder-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("wonder-profile-updated", handleProfileUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    setDropdownOpen(false);
    navigate("/login");
  };

  return (
    <nav className="navbar">
      {/* Left logo */}
      <div className="navbar-left">
        <img src={logo} alt="Logo" className="navbar-logo" />
      </div>

      {/* Middle menu */}
      <ul className="navbar-menu">
        <li>
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <FaHome /> Home
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/explore"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <FaCompass /> Explore
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/mytrips"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <FaSuitcase /> MyTrips
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/saved"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <FaBookmark /> Saved
          </NavLink>
        </li>
      </ul>

      {/* Right user avatar / login */}
      <div className="navbar-right">
        {token ? (
          // Sử dụng component ProfileDropdown mới
          <ProfileDropdown 
            user={user}
            onLogout={handleLogout}
          />
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}