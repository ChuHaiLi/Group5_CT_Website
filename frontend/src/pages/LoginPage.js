import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import API from "../utils/axios";
import GoogleLoginButton from "../components/GoogleLoginButton";
import "../styles/AuthForm.css";

export default function LoginPage({ setIsAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/login", { email, password });

      if (res.data && res.data.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        if (typeof setIsAuthenticated === "function") {
          setIsAuthenticated(true);
        }

        toast.success(res.data.message || "Login successful");
        navigate("/");
      } else {
        toast.error("Invalid response from server");
      }
    } catch (err) {
      console.error("Login error:", err);
      
      if (err.response) {
        const errorData = err.response.data;
        
        if (err.response.status === 403 && errorData?.error_type === "email_not_verified") {
          toast.warning(errorData.message || "Please verify your email first");
          
          setTimeout(() => {
            navigate("/verify-email", { 
              state: { email: errorData.email || email } 
            });
          }, 1500);
          
          return;
        }
        
        const errorMessage = errorData?.message || 
                           errorData?.error ||
                           "Invalid email or password";
        toast.error(errorMessage);
      } else if (err.request) {
        toast.error("Cannot connect to server. Please try again.");
      } else {
        toast.error("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h2>Login</h2>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <span
              className="show-hide"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* 🔥 DIVIDER */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* 🔥 GOOGLE LOGIN BUTTON */}
        <GoogleLoginButton setIsAuthenticated={setIsAuthenticated} />

        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <p>
          Forgot password? <Link to="/forgot-password">Reset here</Link>
        </p>
      </div>
    </div>
  );
}