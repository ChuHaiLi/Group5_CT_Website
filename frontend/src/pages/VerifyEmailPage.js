import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope } from "react-icons/fa";
import API from "../untils/axios";
import "../styles/AuthForm.css";

export default function VerifyEmailPage({ setIsAuthenticated }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Redirect nếu không có email
  useEffect(() => {
    if (!email) {
      toast.error("Please register first");
      navigate("/register");
    }
  }, [email, navigate]);

  // Auto-focus vào ô đầu tiên
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) {
      toast.error("Please paste numbers only");
      return;
    }

    const newOtp = pastedData.split("");
    setOtp([...newOtp, ...Array(6 - newOtp.length).fill("")]);
    
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    const otpCode = otp.join("");
    
    if (otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/verify-email", {
        email,
        otp_code: otpCode
      });

      // ✅ LƯU TOKEN VÀ THÔNG TIN USER
      if (res.data.access_token) {
        // 1️⃣ Lưu vào localStorage
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        // 2️⃣ Dispatch event để App.js biết có sự thay đổi
        window.dispatchEvent(new Event('authChange'));

        // 3️⃣ Cập nhật state authentication
        if (typeof setIsAuthenticated === "function") {
          setIsAuthenticated(true);
        }

        // 4️⃣ Hiển thị thông báo thành công
        toast.success(res.data.message || "Email verified successfully!");
        
        // 5️⃣ Chuyển hướng đến Home (với replace để không back được)
        setTimeout(() => {
          navigate("/home", { replace: true });
        }, 800);
        
      } else {
        // Fallback: nếu không có token, chuyển về login
        toast.success("Email verified! Please login.");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 1500);
      }
      
    } catch (err) {
      console.error("Verification error:", err);
      
      const errorData = err.response?.data;
      
      if (errorData?.error_type === "invalid_otp") {
        toast.error("Invalid verification code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else if (errorData?.error_type === "otp_expired") {
        toast.error("Verification code expired. Please request a new one.");
      } else {
        toast.error(errorData?.message || "Verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const res = await API.post("/auth/resend-verification", { email });
      
      toast.success(res.data.message || "New code sent to your email");
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      
    } catch (err) {
      const errorData = err.response?.data;
      
      if (err.response?.status === 429) {
        const waitSeconds = errorData?.wait_seconds || 60;
        setCountdown(waitSeconds);
        toast.warning(`Please wait ${waitSeconds} seconds before resending`);
      } else {
        toast.error(errorData?.message || "Failed to resend code");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <FaEnvelope style={{ fontSize: "64px", color: "#4CAF50", marginBottom: "10px" }} />
          <h2>Verify Your Email</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            We've sent a 6-digit code to
          </p>
          <p style={{ color: "#2196F3", fontWeight: "bold", marginTop: "5px" }}>
            {email}
          </p>
        </div>

        <form onSubmit={handleVerify}>
          {/* OTP Input Boxes */}
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            justifyContent: "center", 
            marginBottom: "20px" 
          }}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                style={{
                  width: "50px",
                  height: "60px",
                  textAlign: "center",
                  fontSize: "24px",
                  fontWeight: "bold",
                  border: "2px solid #ddd",
                  borderRadius: "8px",
                  outline: "none",
                  transition: "border-color 0.3s"
                }}
                onFocus={(e) => e.target.style.borderColor = "#4CAF50"}
                onBlur={(e) => e.target.style.borderColor = "#ddd"}
              />
            ))}
          </div>

          <button 
            type="submit" 
            disabled={loading || otp.join("").length !== 6}
            style={{
              opacity: (loading || otp.join("").length !== 6) ? 0.6 : 1,
              cursor: (loading || otp.join("").length !== 6) ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        {/* Resend Code Section */}
       <div className="resend-section">
          {countdown > 0 ? (
            <p className="countdown-text">
              Resend code in {countdown}s
            </p>
          ) : (
            <p className="countdown-text">
              Didn't receive code?{" "}
              <button
                type="button"
                className="resend-button"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? "Sending..." : "Resend"}
              </button>
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px" }}>
          <Link to="/login" style={{ color: "#2196F3" }}>
            Back to Login
          </Link>
          {" | "}
          <Link to="/register" style={{ color: "#2196F3" }}>
            Register Again
          </Link>
        </p>
      </div>
    </div>
  );
}