import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import API from "../utils/axios";
import "../styles/AuthForm.css";

export default function ResetPasswordPage() {
  const [step, setStep] = useState(1); // 1: Verify OTP, 2: Reset Password
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resetToken, setResetToken] = useState(""); // Lưu reset_token từ API
  const inputRefs = useRef([]);

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  // Password validation state
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    match: false,
  });

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      toast.error("Please start from forgot password page");
      navigate("/forgot-password");
    }
  }, [email, navigate]);

  // Auto-focus first input when on step 1
  useEffect(() => {
    if (step === 1 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Update password strength indicators
  useEffect(() => {
    setPasswordStrength({
      length: password.length >= 6,
      match: password.length > 0 && password === confirm,
    });
  }, [password, confirm]);

  // OTP input handlers
  const handleOtpChange = (index, value) => {
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

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const res = await API.post("/auth/resend-otp", { email });
      
      toast.success(res.data.message || "New code sent to your email");
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      
    } catch (err) {
      const errorData = err.response?.data;
      
      if (err.response?.status === 429) {
        const waitSeconds = errorData?.wait_seconds || 60;
        setCountdown(waitSeconds);
        toast.warning(`Please wait ${waitSeconds} seconds`);
      } else {
        toast.error(errorData?.message || "Failed to resend code");
      }
    } finally {
      setResending(false);
    }
  };

  // STEP 1: Verify OTP - Gọi API để verify và nhận reset_token
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    try {
      // Gọi API verify-otp
      const res = await API.post("/auth/verify-otp", {
        email,
        otp_code: otpCode,
      });

      // Nhận reset_token từ response
      const token = res.data.reset_token;
      
      if (!token) {
        throw new Error("Reset token not received from server");
      }

      toast.success(res.data.message || "Code verified! Please create your new password.");
      setResetToken(token); // Lưu reset_token
      setStep(2); // Chuyển sang bước 2
      
    } catch (err) {
      console.error("Verify OTP error:", err);
      const errorData = err.response?.data;
      
      if (errorData?.error_type === "invalid_otp") {
        toast.error("Invalid verification code");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else if (errorData?.error_type === "otp_expired") {
        toast.error("Code expired. Please request a new one.");
      } else {
        toast.error(errorData?.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Reset Password - Gọi API với reset_token
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      // Gọi API reset-password với reset_token
      const res = await API.post("/auth/reset-password", {
        reset_token: resetToken,
        new_password: password,
      });

      toast.success(res.data.message || "Password reset successfully!");
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
      
    } catch (err) {
      console.error("Reset password error:", err);
      const errorData = err.response?.data;
      
      if (errorData?.message?.includes("token") || errorData?.message?.includes("expired")) {
        toast.error("Your session has expired. Please verify code again.");
        // Quay lại bước 1 nếu token không hợp lệ
        setStep(1);
        setOtp(["", "", "", "", "", ""]);
        setResetToken("");
        inputRefs.current[0]?.focus();
      } else {
        toast.error(errorData?.message || "Reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Quay lại Step 1
  const handleBackToStep1 = () => {
    setStep(1);
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        {/* Progress Indicator */}
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          gap: "10px", 
          marginBottom: "20px" 
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: step >= 1 ? "#4CAF50" : "#ddd",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "16px"
          }}>
            1
          </div>
          <div style={{
            width: "60px",
            height: "2px",
            background: step >= 2 ? "#4CAF50" : "#ddd",
            alignSelf: "center"
          }}></div>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: step >= 2 ? "#4CAF50" : "#ddd",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "16px"
          }}>
            2
          </div>
        </div>

        {/* STEP 1: Verify Code */}
        {step === 1 && (
          <>
            <h2>Verify Code</h2>
            <p style={{ textAlign: "center", color: "#666", fontSize: "14px", marginBottom: "10px" }}>
              Enter the 6-digit code sent to
            </p>
            <p style={{ textAlign: "center", color: "#2196F3", fontWeight: "bold", marginBottom: "20px" }}>
              {email}
            </p>

            <form onSubmit={handleVerifyOtp}>
              {/* OTP Input */}
              <div style={{ 
                display: "flex", 
                gap: "8px", 
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
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    style={{
                      width: "45px",
                      height: "55px",
                      textAlign: "center",
                      fontSize: "20px",
                      fontWeight: "bold",
                      border: "2px solid #ddd",
                      borderRadius: "8px",
                      outline: "none",
                      transition: "border-color 0.3s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#2196F3"}
                    onBlur={(e) => e.target.style.borderColor = "#ddd"}
                  />
                ))}
              </div>

              {/* Resend Code */}
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                {countdown > 0 ? (
                  <p style={{ color: "#999", fontSize: "13px" }}>
                    Resend code in {countdown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2196F3",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontSize: "13px",
                      padding: "0"
                    }}
                  >
                    {resending ? "Sending..." : "Didn't receive code? Resend"}
                  </button>
                )}
              </div>

              <button 
                type="submit" 
                disabled={loading || otp.join("").length !== 6}
                style={{
                  opacity: (loading || otp.join("").length !== 6) ? 0.6 : 1,
                  cursor: (loading || otp.join("").length !== 6) ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          </>
        )}

        {/* STEP 2: Reset Password */}
        {step === 2 && (
          <>
            <h2>Create New Password</h2>
            <p style={{ textAlign: "center", color: "#666", fontSize: "14px", marginBottom: "20px" }}>
              Your code has been verified. Please create a new password.
            </p>

            <form onSubmit={handleResetPassword}>
              {/* Password Fields */}
              <div className="input-group">
                <FaLock className="icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  placeholder="Confirm New Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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

              {/* Password Strength Indicators */}
              {password.length > 0 && (
                <div style={{ marginBottom: "15px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    {passwordStrength.length ? (
                      <FaCheckCircle style={{ color: "#4CAF50" }} />
                    ) : (
                      <FaTimesCircle style={{ color: "#f44336" }} />
                    )}
                    <span style={{ color: passwordStrength.length ? "#4CAF50" : "#666" }}>
                      At least 6 characters
                    </span>
                  </div>
                  
                  {confirm.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {passwordStrength.match ? (
                        <FaCheckCircle style={{ color: "#4CAF50" }} />
                      ) : (
                        <FaTimesCircle style={{ color: "#f44336" }} />
                      )}
                      <span style={{ color: passwordStrength.match ? "#4CAF50" : "#666" }}>
                        Passwords match
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || !passwordStrength.length || !passwordStrength.match}
                style={{
                  opacity: (loading || !passwordStrength.length || !passwordStrength.match) ? 0.6 : 1,
                  cursor: (loading || !passwordStrength.length || !passwordStrength.match) ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={handleBackToStep1}
                style={{
                  marginTop: "10px",
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #ddd"
                }}
              >
                Back to Verification
              </button>
            </form>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px" }}>
          Remember your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}