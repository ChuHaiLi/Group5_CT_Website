// src/components/GoogleLoginButton.js
import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import API from "../untils/axios";

export default function GoogleLoginButton({ setIsAuthenticated }) {
  const navigate = useNavigate();

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
    <div style={{ marginTop: "20px", width: "100%", display: "flex", justifyContent: "center" }}>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap={false}
        text="Sign up or Login with"
        shape="rectangular"
        theme="filled_blue"
        size="large"
        width="350"
        locale="en"
      />
    </div>
  );
}