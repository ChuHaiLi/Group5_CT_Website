// src/components/GoogleLoginButton.js
import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import API from "../untils/axios";
import { FaGoogle } from "react-icons/fa";

export default function GoogleLoginButton({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
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
        // Lưu token vào localStorage
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        if (typeof setIsAuthenticated === "function") {
          setIsAuthenticated(true);
        }

        toast.success(res.data.message || "Login successful");
        navigate("/home");
      }
    } catch (err) {
      console.error("Google login error:", err);
      const errorMessage = err.response?.data?.message || "Google login failed";
      toast.error(errorMessage);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google login failed. Please try again.");
  };

  return (
    <button
      onClick={() => {
        // Trigger Google Login programmatically
        document.querySelector('[aria-labelledby="button-label"]')?.click();
      }}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        padding: "14px 20px",
        background: "#ffffff",
        color: "#2d3748",
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
      <FaGoogle style={{ fontSize: "20px", color: "#DB4437" }} />
      {loading ? "Signing in..." : "Continue with Google"}

      {/* Hidden Google Login - triggered programmatically */}
      <div style={{ display: "none" }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false}
        />
      </div>
    </button>
  );
}
