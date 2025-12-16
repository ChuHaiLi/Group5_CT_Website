// src/components/GoogleLoginButton.js
import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "../config";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import API from "../untils/axios";
import { FaGoogle } from "react-icons/fa";

export default function GoogleLoginButton({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Kiểm tra xem Google OAuth có được cấu hình không
  const isGoogleLoginAvailable = Boolean(GOOGLE_CLIENT_ID);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    
    try {
      // Decode JWT token từ Google
      const decoded = jwtDecode(credentialResponse.credential);

      console.log("Google User Info:", decoded);

      // Gửi thông tin đến backend
      const res = await API.post("/auth/google-login", {
        google_id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      });

      if (res.data && res.data.access_token) {
        // Đảm bảo avatar được set đúng
        const userData = {
          ...res.data.user,
          avatar: res.data.user.avatar || res.data.user.picture || decoded.picture || ""
        };
        
        // Lưu token vào localStorage
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(userData));

        if (typeof setIsAuthenticated === "function") {
          setIsAuthenticated(true);
        }

        window.dispatchEvent(new Event("authChange"));

        toast.success(res.data.message || "Welcome! 🎉");
        navigate("/home");
      }
    } catch (err) {
      console.error("Google login error:", err);
      const errorMessage = err.response?.data?.message || "Google login failed";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google login failed. Please try again.");
    setLoading(false);
  };

  const handleClick = () => {
    if (!isGoogleLoginAvailable) {
      return; // Không làm gì cả, để handleUnavailableClick xử lý
    }
    
    // Trigger Google Login programmatically
    const googleButton = document.querySelector('[aria-labelledby="button-label"]');
    if (googleButton) {
      googleButton.click();
    }
  };

  // Xử lý click khi Google login không available
  const handleUnavailableClick = () => {
    if (!isGoogleLoginAvailable) {
      toast.error("Google login is not configured. Please contact the administrator.", {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  return (
    <>
      <button
        onClick={isGoogleLoginAvailable ? handleClick : handleUnavailableClick}
        disabled={loading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          width: "100%",
          padding: "14px 20px",
          background: "#ffffff",
          color: isGoogleLoginAvailable ? "#2d3748" : "#a0aec0",
          border: "1.5px solid #e2e8f0",
          borderRadius: "8px",
          fontSize: "15px",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "all 0.3s ease",
          boxShadow:
            isHovered && !loading
              ? "0 4px 12px rgba(0, 0, 0, 0.1)"
              : "0 2px 4px rgba(0, 0, 0, 0.05)",
          transform: isHovered && !loading ? "translateY(-2px)" : "translateY(0)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <FaGoogle style={{ fontSize: "20px", color: isGoogleLoginAvailable ? "#DB4437" : "#cbd5e0" }} />
        {loading ? "Signing in..." : isGoogleLoginAvailable ? "Continue with Google" : "Google Login Unavailable"}
      </button>

      {/* Hidden Google Login - triggered programmatically */}
      {isGoogleLoginAvailable && (
        <div style={{ display: "none" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
          />
        </div>
      )}
    </>
  );
}