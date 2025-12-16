import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaKey, FaCheckCircle, FaTimesCircle, FaHome } from "react-icons/fa";
import API from "../untils/axios";
import "../styles/AuthForm.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const navigate = useNavigate();

  // Validate email format
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsEmailValid(emailRegex.test(email));
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setEmailTouched(true);

    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    if (!isEmailValid) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/forgot-password", { email });
      toast.success(res.data.message || "OTP sent to your email! 📧");
      
      setTimeout(() => {
        navigate("/reset-password", { state: { email } });
      }, 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to send OTP";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
    <button 
      onClick={() => navigate("/")}
      className="back-to-home-btn"
      data-page="forgot-password"
    >
      <FaHome size={16} />
      <span>Back to Home</span>
    </button>
      <div className="auth-box">
        <div className="icon-wrapper" style={{ 
          background: 'linear-gradient(135deg, #FF6B6B, #DC143C)',
          marginBottom: '20px'
        }}>
          <FaKey style={{ 
            fontSize: '40px', 
            color: '#ffffff'
          }} />
        </div>

        <h2>Forgot Password?</h2>
        <p style={{ 
          color: '#7f8c8d', 
          marginBottom: '30px',
          fontSize: '15px'
        }}>
          Don't worry! Enter your email to reset 🔐
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              required
              autoComplete="email"
              style={{
                borderColor: emailTouched 
                  ? (isEmailValid ? '#4CAF50' : email.length > 0 ? '#f44336' : 'rgba(0, 116, 217, 0.2)')
                  : 'rgba(0, 116, 217, 0.2)',
                paddingRight: emailTouched && email.length > 0 ? '50px' : '55px'
              }}
            />
            {emailTouched && email.length > 0 && (
              <span style={{ 
                position: 'absolute', 
                right: '18px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: '18px',
                zIndex: 2
              }}>
                {isEmailValid ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                )}
              </span>
            )}
          </div>

          {/* Email Error Message */}
          {!isEmailValid && email.length > 0 && (
            <div className="validation-message">
              <FaTimesCircle />
              Please enter a valid email address
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !isEmailValid}
            style={{
              opacity: (loading || !isEmailValid) ? 0.6 : 1,
              cursor: (loading || !isEmailValid) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Sending OTP..." : "Send Reset Code"}
          </button>
        </form>

        <p style={{ marginTop: '25px' }}>
          Remember your password? <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}