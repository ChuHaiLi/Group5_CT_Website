import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/AuthForm.css";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/register", {
        username: form.username,
        email: form.email,
        password: form.password
      });
      toast.success(res.data.message);
      navigate("/login");
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) Object.values(data.errors).forEach(msg => toast.error(msg));
      else toast.error(data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <FaUser className="icon" />
            <input 
              placeholder="Username" 
              value={form.username} 
              onChange={e => setForm({ ...form, username: e.target.value })} 
              required
            />
          </div>
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input 
              type="email" 
              placeholder="Email" 
              value={form.email} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
              required
            />
          </div>
          <div className="input-group">
            <FaLock className="icon" />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              required
            />
            <span className="show-hide" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <div className="input-group">
            <FaLock className="icon" />
            <input 
              type={showConfirm ? "text" : "password"} 
              placeholder="Confirm Password" 
              value={form.confirm} 
              onChange={e => setForm({ ...form, confirm: e.target.value })} 
              required
            />
            <span className="show-hide" onClick={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
        <p>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
