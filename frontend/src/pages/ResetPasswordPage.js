import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FaLock, FaEye, FaEyeSlash, FaShieldAlt, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import API from "../untils/axios";
import "../styles/AuthForm.css";

export default function ResetPasswordPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState(1); // 1 = Verify OTP, 2 = Set New Password
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  // Validation states
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  // Validate password
  useEffect(() => {
    setIsPasswordValid(newPassword.length >= 6);
    setPasswordsMatch(newPassword.length > 0 && newPassword === confirmPassword);
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    if (!email) {
      toast.error("Please request password reset first");
      navigate("/forgot-password");
    }
  }, [email, navigate]);

  useEffect(() => {
    if (inputRefs.current[0] && step === 1) {
      inputRefs.current[0].focus();
    }
  }, [step]);

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const otpCode = otp.join("");
    
    if (otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/verify-otp", {
        email,
        otp_code: otpCode
      });

      setResetToken(res.data.reset_token);
      toast.success("OTP verified! Now set your new password.");
      setStep(2);
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.error_type === "invalid_otp") {
        toast.error("Invalid OTP code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else if (errorData?.error_type === "otp_expired") {
        toast.error("OTP expired. Please request a new one.");
      } else {
        toast.error(errorData?.message || "OTP verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/auth/reset-password", {
        reset_token: resetToken,
        new_password: newPassword
      });

      toast.success(res.data.message || "Password reset successful! 🎉");
      
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to reset password";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box verify-box">
        <div className="icon-wrapper" style={{ 
          background: step === 1 
            ? 'linear-gradient(135deg, #FF6B6B, #DC143C)'
            : 'linear-gradient(135deg, #4CAF50, #66BB6A)'
        }}>
          <FaShieldAlt style={{ 
            fontSize: '42px', 
            color: '#ffffff'
          }} />
        </div>

        {step === 1 ? (
          <>
            <h2>Verify OTP</h2>
            <p className="verify-subtitle">
              We've sent a 6-digit code to
            </p>
            <p className="verify-email">{email}</p>

            <form onSubmit={handleVerifyOtp}>
              <div className="otp-container">
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
                    className="otp-input"
                  />
                ))}
              </div>

              <button 
                type="submit" 
                disabled={loading || otp.join("").length !== 6}
                style={{
                  background: 'linear-gradient(135deg, #FF6B6B, #DC143C)',
                  opacity: (loading || otp.join("").length !== 6) ? 0.6 : 1
                }}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>New Password</h2>
            <p className="verify-subtitle" style={{ marginBottom: '25px' }}>
              Create a strong password for your account 🔒
            </p>

            <form onSubmit={handleResetPassword}>
              {/* New Password Input */}
              <div className="input-group">
                <FaLock className="icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  required
                  autoComplete="new-password"
                  style={{
                    borderColor: passwordTouched 
                      ? (isPasswordValid ? '#4CAF50' : newPassword.length > 0 ? '#f44336' : 'rgba(0, 116, 217, 0.2)')
                      : 'rgba(0, 116, 217, 0.2)'
                  }}
                />
                <span
                  className="show-hide"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              {/* Confirm Password Input */}
              <div className="input-group">
                <FaLock className="icon" />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setConfirmTouched(true)}
                  required
                  autoComplete="new-password"
                  style={{
                    borderColor: confirmTouched 
                      ? (passwordsMatch ? '#4CAF50' : confirmPassword.length > 0 ? '#f44336' : 'rgba(0, 116, 217, 0.2)')
                      : 'rgba(0, 116, 217, 0.2)'
                  }}
                />
                <span
                  className="show-hide"
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  {showConfirm ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>

              {/* Password Strength Summary */}
              {(newPassword.length > 0 || confirmPassword.length > 0) && (
                <div className="password-strength-box">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginBottom: '4px' 
                  }}>
                    {isPasswordValid ? (
                      <FaCheckCircle style={{ color: '#4CAF50' }} />
                    ) : (
                      <FaTimesCircle style={{ color: '#f44336' }} />
                    )}
                    <span style={{ color: isPasswordValid ? '#4CAF50' : '#666' }}>
                      At least 6 characters
                    </span>
                  </div>
                  
                  {confirmPassword.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {passwordsMatch ? (
                        <FaCheckCircle style={{ color: '#4CAF50' }} />
                      ) : (
                        <FaTimesCircle style={{ color: '#f44336' }} />
                      )}
                      <span style={{ color: passwordsMatch ? '#4CAF50' : '#666' }}>
                        Passwords match
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className="verify-button"
                style={{
                  opacity: (loading || !isPasswordValid || !passwordsMatch) ? 0.6 : 1,
                  cursor: (loading || !isPasswordValid || !passwordsMatch) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <p className="footer-links">
          <Link to="/login">Back to Login</Link>
          {step === 1 && (
            <>
              {" | "}
              <Link to="/forgot-password">Request New Code</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}