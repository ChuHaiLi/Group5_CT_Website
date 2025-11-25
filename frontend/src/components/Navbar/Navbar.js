import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaHome, FaComments, FaCompass, FaSuitcase, FaBookmark, FaUserCircle } from "react-icons/fa";
import "./Navbar.css";
import logo from "./assets/logo.png";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
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
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            <FaHome /> Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/chat" className={({ isActive }) => (isActive ? "active" : "")}>
            <FaComments /> Chat
          </NavLink>
        </li>
        <li>
          <NavLink to="/explore" className={({ isActive }) => (isActive ? "active" : "")}>
            <FaCompass /> Explore
          </NavLink>
        </li>
        <li>
          <NavLink to="/mytrips" className={({ isActive }) => (isActive ? "active" : "")}>
            <FaSuitcase /> MyTrips
          </NavLink>
        </li>
        <li>
          <NavLink to="/saved" className={({ isActive }) => (isActive ? "active" : "")}>
            <FaBookmark /> Saved
          </NavLink>
        </li>
      </ul>

      {/* Right user avatar / login */}
      <div className="navbar-right">
        {token ? (
          <div className="profile-dropdown-wrapper">
            {/* Avatar trigger */}
            <div
              className="profile-trigger"
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="navbar-avatar" />
              ) : (
                <FaUserCircle className="navbar-avatar-icon" />
              )}
            </div>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="dropdown-menu">
                <button onClick={() => navigate("/profile")}>👤 Profile</button>
                <button onClick={handleLogout}>🚪 Logout</button>
              </div>
            )}
          </div>
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
