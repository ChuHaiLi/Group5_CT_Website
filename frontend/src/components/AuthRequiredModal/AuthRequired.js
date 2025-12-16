import React from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaLock, FaUserPlus, FaSignInAlt } from "react-icons/fa";
import "./AuthRequired.css";

export default function AuthRequiredModal({ onClose, message }) {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    navigate("/login");
  };

  const handleRegister = () => {
    onClose();
    navigate("/register");
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          <FaTimes />
        </button>

        <div className="auth-modal-icon">
          <FaLock />
        </div>

        <h2 className="auth-modal-title">Login Required</h2>
        
        <p className="auth-modal-message">
          {message || "You need to be logged in to create a trip. Please login or register to continue."}
        </p>

        <div className="auth-modal-actions">
          <button className="auth-modal-btn login-btn" onClick={handleLogin}>
            <FaSignInAlt />
            <span>Login</span>
          </button>
          
          <button className="auth-modal-btn register-btn" onClick={handleRegister}>
            <FaUserPlus />
            <span>Register</span>
          </button>
        </div>

        <p className="auth-modal-footer">
          Don't have an account? <span onClick={handleRegister}>Sign up now</span>
        </p>
      </div>
    </div>
  );
}