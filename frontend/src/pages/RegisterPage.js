import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { 
  FaEnvelope, 
  FaLock, 
  FaUser, 
  FaEye, 
  FaEyeSlash 
} from "react-icons/fa";
import API from "../utils/axios";
import GoogleLoginButton from "../components/GoogleLoginButton";
import "../styles/AuthForm.css";

export default function RegisterPage({ setIsAuthenticated }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.username || !form.email || !form.password || !form.confirm) {
      toast.error("Please fill in all fields");
      return;
    }

    if (form.username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/register", {
        username: form.username,
        email: form.email,
        password: form.password,
      });

      toast.success(res.data.message || "Registration successful! Please verify your email.");
      
      setTimeout(() => {
        navigate("/verify-email", { 
          state: { email: form.email } 
        });
      }, 1500);
      
    } catch (err) {
      console.error("Register error:", err);
      
      const errorData = err.response?.data;
      
      if (errorData?.errors) {
        Object.values(errorData.errors).forEach((msg) => toast.error(msg));
      } else {
        const errorMessage = errorData?.message || 
                            errorData?.error || 
                            "Registration failed";
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h2>Create Account</h2>
        
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <FaUser className="icon" />
            <input
              type="text"
              placeholder="Username (min 3 characters)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 6 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="new-password"
            />
            <span
              className="show-hide"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
            <span
              className="show-hide"
              onClick={() => setShowConfirm((prev) => !prev)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        {/* 🔥 DIVIDER */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* 🔥 GOOGLE LOGIN BUTTON */}
        <GoogleLoginButton setIsAuthenticated={setIsAuthenticated} />

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}