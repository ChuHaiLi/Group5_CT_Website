import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { 
  FaEnvelope, 
  FaLock, 
  FaUser, 
  FaEye, 
  FaEyeSlash,
  FaMapMarkedAlt,
  FaCheckCircle,
  FaTimesCircle
} from "react-icons/fa";
import API from "../untils/axios";
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

  // Validation states
  const [touched, setTouched] = useState({
  email: false,
  password: false,
  confirm: false,
});

  const [validation, setValidation] = useState({
    usernameValid: false,
    emailValid: false,
    passwordValid: false,
    passwordsMatch: false,
  });

  // Validate fields
    useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    setValidation({
      usernameValid: form.username.length >= 3,
      emailValid: emailRegex.test(form.email),
      passwordValid: form.password.length >= 6,
      passwordsMatch: form.password.length > 0 && form.password === form.confirm,
    });
  }, [form]);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleRegister = async (e) => {
  e.preventDefault();

  // Mark all fields as touched - BỎ username
  setTouched({
    username: true,
    email: true,
    password: true,
    confirm: true,
  });

  if (!form.username || !form.email || !form.password || !form.confirm) {
    toast.error("Please fill in all fields");
    return;
  }

  if (!validation.usernameValid) {
    toast.error("Username must be at least 3 characters");
    return;
  }

  if (!validation.emailValid) {
    toast.error("Please enter a valid email address");
    return;
  }

  if (!validation.passwordValid) {
    toast.error("Password must be at least 6 characters");
    return;
  }

  if (!validation.passwordsMatch) {
    toast.error("Passwords do not match");
    return;
  }

  setLoading(true);

  try {
    const res = await API.post("/auth/register", {
      username: form.username,
      email: form.email,
      password: form.password,
    });

    toast.success(res.data.message || "Registration successful! Check your email. 📧");
    
    setTimeout(() => {
      navigate("/verify-email", { 
        state: { email: form.email } 
      });
    }, 1500);
    
  } catch (err) {
    console.error("Register error:", err);
    
    const errorData = err.response?.data;
    
    // THÊM: Xử lý lỗi email đã tồn tại
    if (err.response?.status === 409 || errorData?.error_type === "email_exists") {
      toast.error("This email is already registered. Please login or use another email.");
      return;
    }
    
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
        <div className="icon-wrapper" style={{ 
          background: 'linear-gradient(135deg, #FF6B6B, #FFB347)',
          marginBottom: '20px'
        }}>
          <FaMapMarkedAlt style={{ 
            fontSize: '42px', 
            color: '#ffffff'
          }} />
        </div>

        <h2>Start Your Journey</h2>
        <p style={{ 
          color: '#7f8c8d', 
          marginBottom: '30px',
          fontSize: '15px'
        }}>
          Discover the beauty of Vietnam 🌏
        </p>
        
        <form onSubmit={handleRegister}>
          {/* Username */}
          <div className="input-group">
            <FaUser className="icon" />
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              onBlur={() => handleBlur('username')} 
              required
              autoComplete="username"
              style={{
                borderColor: touched.username 
                  ? (validation.usernameValid ? '#4CAF50' : '#f44336')
                  : '#ddd'
              }}
            />
            {touched.username && form.username.length > 0 && (  // ← THÊM
              <span style={{ 
                position: 'absolute', 
                right: '15px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: '18px'
              }}>
                {validation.usernameValid ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                )}
              </span>
            )}
          </div>

          {/* Error message cho username */}
            {touched.username && !validation.usernameValid && form.username.length > 0 && (
              <p style={{ 
                color: '#f44336', 
                fontSize: '12px', 
                marginTop: '-10px', 
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <FaTimesCircle />
                Username must be at least 3 characters
              </p>
            )}


          {/* Email */}
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => handleBlur('email')}
              required
              autoComplete="email"
              style={{
                borderColor: touched.email 
                  ? (validation.emailValid ? '#4CAF50' : '#f44336')
                  : '#ddd'
              }}
            />
            {touched.email && form.email.length > 0 && (
              <span style={{ 
                position: 'absolute', 
                right: '15px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: '18px'
              }}>
                {validation.emailValid ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                )}
              </span>
            )}
          </div>

          {touched.email && !validation.emailValid && form.email.length > 0 && (
            <p style={{ 
              color: '#f44336', 
              fontSize: '12px', 
              marginTop: '-10px', 
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <FaTimesCircle />
              Please enter a valid email address
            </p>
          )}

          {/* Password */}
          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 6 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={() => handleBlur('password')}
              required
              autoComplete="new-password"
              style={{
                borderColor: touched.password 
                  ? (validation.passwordValid ? '#4CAF50' : '#f44336')
                  : '#ddd'
              }}
            />
            <span
              className="show-hide"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {touched.password && !validation.passwordValid && form.password.length > 0 && (
            <p style={{ 
              color: '#f44336', 
              fontSize: '12px', 
              marginTop: '-10px', 
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <FaTimesCircle />
              Password must be at least 6 characters
            </p>
          )}

          {/* Confirm Password */}
          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              onBlur={() => handleBlur('confirm')}
              required
              autoComplete="new-password"
              style={{
                borderColor: touched.confirm 
                  ? (validation.passwordsMatch ? '#4CAF50' : '#f44336')
                  : '#ddd'
              }}
            />
            <span
              className="show-hide"
              onClick={() => setShowConfirm((prev) => !prev)}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {touched.confirm && !validation.passwordsMatch && form.confirm.length > 0 && (
            <p style={{ 
              color: '#f44336', 
              fontSize: '12px', 
              marginTop: '-10px', 
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <FaTimesCircle />
              Passwords do not match
            </p>
          )}

          {/* Password Strength Summary */}
          {form.password.length > 0 && (
            <div style={{ 
              marginBottom: '15px', 
              fontSize: '12px',
              padding: '10px',
              background: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                marginBottom: '4px' 
              }}>
                {validation.passwordValid ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                )}
                <span style={{ color: validation.passwordValid ? '#4CAF50' : '#666' }}>
                  At least 6 characters
                </span>
              </div>
              
              {form.confirm.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {validation.passwordsMatch ? (
                    <FaCheckCircle style={{ color: '#4CAF50' }} />
                  ) : (
                    <FaTimesCircle style={{ color: '#f44336' }} />
                  )}
                  <span style={{ color: validation.passwordsMatch ? '#4CAF50' : '#666' }}>
                    Passwords match
                  </span>
                </div>
              )}
            </div>
          )}

            <button 
            type="submit" 
            disabled={loading || !validation.usernameValid || !validation.emailValid || !validation.passwordValid || !validation.passwordsMatch}
            style={{
              opacity: (loading || !validation.usernameValid || !validation.emailValid || !validation.passwordValid || !validation.passwordsMatch) ? 0.6 : 1,
              cursor: (loading || !validation.usernameValid || !validation.emailValid || !validation.passwordValid || !validation.passwordsMatch) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Creating account..." : "Begin Adventure"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <GoogleLoginButton setIsAuthenticated={setIsAuthenticated} />

        <p>
          Already exploring? <Link to="/login">Login Here</Link>
        </p>
      </div>
    </div>
  );
}