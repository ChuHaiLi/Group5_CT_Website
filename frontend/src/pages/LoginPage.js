import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaPlane, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import API from "../untils/axios";
import GoogleLoginButton from "../components/GoogleLoginButton";
import "../styles/AuthForm.css";

export default function LoginPage({ setIsAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // Validate email format
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsEmailValid(emailRegex.test(email));
  }, [email]);

  // Validate password (min 6 characters)
  useEffect(() => {
    setIsPasswordValid(password.length >= 6);
  }, [password]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched on submit
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isEmailValid) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password must be at least 6 characters");
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

        window.dispatchEvent(new Event('authChange'));

        toast.success(res.data.message || "Welcome back! 🎉");
        navigate("/home");
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
        <div className="icon-wrapper" style={{ 
          background: 'linear-gradient(135deg, #0074D9, #39CCCC)',
          marginBottom: '20px'
        }}>
          <FaPlane style={{ 
            fontSize: '40px', 
            color: '#ffffff',
            transform: 'rotate(-45deg)'
          }} />
        </div>

        <h2>Welcome Back!</h2>
        <p style={{ 
          color: '#7f8c8d', 
          marginBottom: '30px',
          fontSize: '15px'
        }}>
          Continue your journey through Vietnam 🇻🇳
        </p>

        <form onSubmit={handleLogin}>
          {/* Email Input with Validation */}
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Email"
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
          {emailTouched && !isEmailValid && email.length > 0 && (
            <div className="validation-message">
              <FaTimesCircle />
              Please enter a valid email address
            </div>
          )}

          {/* Password Input with Validation */}
          <div className="input-group">
            <FaLock className="icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              required
              autoComplete="current-password"
              style={{
                borderColor: passwordTouched 
                  ? (isPasswordValid ? '#4CAF50' : password.length > 0 ? '#f44336' : 'rgba(0, 116, 217, 0.2)')
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

          {/* Password Error Message */}
          {passwordTouched && !isPasswordValid && password.length > 0 && (
            <div className="validation-message">
              <FaTimesCircle />
              Password must be at least 6 characters
            </div>
          )}

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="password-strength-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isPasswordValid ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                )}
                <span style={{ color: isPasswordValid ? '#4CAF50' : '#666' }}>
                  At least 6 characters
                </span>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !isEmailValid || !isPasswordValid}
            style={{
              opacity: (loading || !isEmailValid || !isPasswordValid) ? 0.6 : 1,
              cursor: (loading || !isEmailValid || !isPasswordValid) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? "Logging in..." : "Start Exploring"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <GoogleLoginButton setIsAuthenticated={setIsAuthenticated} />

        <p>
          New to Vietnam Travel? <Link to="/register">Create Account</Link>
        </p>
        <p>
          <Link to="/forgot-password">Forgot Password?</Link>
        </p>
      </div>
    </div>
  );
}