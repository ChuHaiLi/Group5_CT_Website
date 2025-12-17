import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import API from "../untils/axios"; 

export default function VerifyEmailChangePage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const newEmail = location.state?.newEmail || "";
  const oldEmail = location.state?.oldEmail || "";

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-focus vào ô đầu tiên
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Redirect nếu không có email
  useEffect(() => {
    if (!newEmail) {
      toast.error("Invalid request. Please try again from profile settings.");
      navigate("/profile?tab=settings");
    }
  }, [newEmail, navigate]);

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
      const res = await API.post("/auth/verify-email-change", {
        otp_code: otpCode
      });

      toast.success(res.data.message || "Email changed successfully!");
      
      // 🔥 CẬP NHẬT PROFILE TRONG LOCALSTORAGE
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      storedUser.email = res.data.new_email || newEmail;
      localStorage.setItem("user", JSON.stringify(storedUser));
      
      // Dispatch event để cập nhật header
      window.dispatchEvent(new CustomEvent('wonder-profile-updated', { 
        detail: storedUser 
      }));
      
      // Chuyển hướng về profile sau 1.5s
      setTimeout(() => {
        navigate("/profile?tab=settings", { replace: true });
      }, 1500);
      
    } catch (err) {
      console.error("Verification error:", err);
      
      const errorData = err.response?.data;
      
      if (errorData?.error_type === "invalid_otp") {
        toast.error("Invalid verification code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else if (errorData?.error_type === "otp_expired") {
        toast.error("Verification code expired. Please request a new one.");
      } else if (errorData?.message) {
        toast.error(errorData.message);
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const res = await API.post("/auth/request-email-change", { 
        new_email: newEmail 
      });
      
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
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      position: 'relative',
      fontFamily: "'Poppins', 'Segoe UI', sans-serif",
      overflow: 'hidden',
      background: '#ffffff'
    }}>
      {/* Subtle gradient overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at top, rgba(255, 255, 255, 0.05) 0%, transparent 60%)',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      {/* Main Content Box */}
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '50px 45px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        animation: 'fadeInAuth 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        zIndex: 10
      }}>
        
        {/* Icon Wrapper */}
        <div style={{
          width: '90px',
          height: '90px',
          margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          animation: 'iconPulse 2s ease-in-out infinite'
        }}>
          <FaEnvelope style={{ fontSize: '45px', color: '#fff' }} />
        </div>
        
        {/* Title */}
        <h2 style={{
          marginBottom: '20px',
          fontSize: '32px',
          fontWeight: '800',
          color: '#1a1a1a',
          letterSpacing: '-0.5px'
        }}>
          Verify Your New Email
        </h2>
        
        {/* Subtitle */}
        <p style={{
          color: '#666',
          fontSize: '15px',
          margin: '12px 0 5px'
        }}>
          We've sent a 6-digit code to
        </p>
        
        {/* New Email Display */}
        <div style={{
          color: '#1a1a1a',
          fontWeight: '700',
          fontSize: '16px',
          margin: '5px 0 15px',
          padding: '12px 24px',
          background: '#f5f5f5',
          borderRadius: '12px',
          display: 'inline-block',
          border: '1px solid #e0e0e0'
        }}>
          {newEmail}
        </div>

        {/* Old Email Info Badge */}
        {oldEmail && (
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#666',
            marginBottom: '25px'
          }}>
            <FaCheckCircle style={{ color: '#28a745', fontSize: '16px' }} />
            <span>
              Changing from: <strong style={{ color: '#1a1a1a' }}>{oldEmail}</strong>
            </span>
          </div>
        )}

        {/* OTP Input Form */}
        <form onSubmit={handleVerify}>
          {/* OTP Input Boxes */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginBottom: '25px',
            marginTop: '25px'
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
                  width: '60px',
                  height: '70px',
                  textAlign: 'center',
                  fontSize: '28px',
                  fontWeight: '700',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: '#fff',
                  color: '#1a1a1a',
                  padding: 0
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1a1a1a';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 0, 0, 0.1)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e0e0e0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.transform = 'scale(1)';
                }}
              />
            ))}
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            style={{
              width: '100%',
              padding: '17px',
              marginTop: '15px',
              background: loading || otp.join("").length !== 6 
                ? '#999'
                : '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading || otp.join("").length !== 6 ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading || otp.join("").length !== 6 ? 0.5 : 1,
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (!loading && otp.join("").length === 6) {
                e.target.style.background = '#000';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1a1a1a';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {loading ? "Verifying..." : "Verify & Change Email"}
          </button>
        </form>

        {/* Resend Code Section */}
        <div style={{
          textAlign: 'center',
          marginTop: '25px'
        }}>
          {countdown > 0 ? (
            <p style={{
              color: '#999',
              fontSize: '14px',
              margin: 0
            }}>
              Resend code in <strong style={{ color: '#1a1a1a' }}>{countdown}s</strong>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{
                background: 'none',
                border: 'none',
                color: '#1a1a1a',
                textDecoration: 'underline',
                cursor: resending ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                padding: 0,
                fontWeight: '600',
                opacity: resending ? 0.5 : 1
              }}
            >
              {resending ? "Sending..." : "Didn't receive code? Resend"}
            </button>
          )}
        </div>

        {/* Back to Profile Link */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <a
            href="/profile?tab=settings"
            style={{
              color: '#666',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.color = '#1a1a1a';
              e.target.style.transform = 'translateX(-3px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#666';
              e.target.style.transform = 'translateX(0)';
            }}
          >
            ← Back to Profile Settings
          </a>
        </div>

        {/* Security Notice */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '12px',
          fontSize: '13px',
          color: '#856404',
          lineHeight: '1.6',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          textAlign: 'left'
        }}>
          <FaExclamationTriangle style={{ 
            fontSize: '18px', 
            marginTop: '2px',
            flexShrink: 0,
            color: '#ffc107'
          }} />
          <div>
            <strong>🔒 Security Notice:</strong> For your protection, verifying this code will permanently change your email address. Make sure you have access to this new email.
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInAuth {
          from { 
            opacity: 0; 
            transform: translateY(40px) scale(0.9);
            filter: blur(10px);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes iconPulse {
          0%, 100% { 
            transform: scale(1); 
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          }
          50% { 
            transform: scale(1.05); 
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
          }
        }

        @media (max-width: 600px) {
          input[type="text"] {
            width: 48px !important;
            height: 60px !important;
            font-size: 24px !important;
          }
        }

        @media (max-width: 400px) {
          input[type="text"] {
            width: 42px !important;
            height: 55px !important;
            font-size: 22px !important;
          }
        }
      `}</style>
    </div>
  );
}