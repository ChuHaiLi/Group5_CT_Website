import React, { useState } from "react";
import API from "../utils/axios";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import "../styles/AuthForm.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await API.post("/auth/forgot-password", { email });
      toast.success(res.data.message || "Verification code sent to your email");
      
      // 🔥 CHUYỂN SANG TRANG RESET PASSWORD VỚI EMAIL
      setTimeout(() => {
        navigate("/reset-password", { 
          state: { email } 
        });
      }, 1500);
      
    } catch (err) {
      toast.error(err.response?.data?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h2>Forgot Password</h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: "14px", marginBottom: "20px" }}>
          Enter your email address and we'll send you a verification code
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>

        <p>
          Remember your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}