import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, githubProvider } from "../firebase/config";
import { toast } from "react-toastify";
import { FaGithub } from "react-icons/fa";
import API from "../untils/axios";
import { useNavigate } from "react-router-dom";

export default function GitHubLoginButton({ setIsAuthenticated }) {
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleGitHubLogin = async () => {
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;

      console.log("GitHub User:", user);

      const userData = {
        github_id: user.uid,
        email: user.email || `${user.uid}@github.temp`,
        name: user.displayName || "GitHub User",
        username: user.reloadUserInfo?.screenName || user.displayName?.replace(/\s+/g, '_').toLowerCase() || `github_${user.uid.slice(0, 8)}`,
        picture: user.photoURL || "",
      };

      console.log("Sending to backend:", userData);

      const res = await API.post("/auth/github-login", userData);

      if (res.data && res.data.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        if (typeof setIsAuthenticated === "function") {
          setIsAuthenticated(true);
        }

        window.dispatchEvent(new Event("authChange"));

        toast.success(res.data.message || "Welcome! 🎉");
        navigate("/home");
      }
    } catch (error) {
      console.error("GitHub login error:", error);

      if (error.code === "auth/popup-closed-by-user") {
        toast.info("Login popup was closed");
      } else if (error.code === "auth/cancelled-popup-request") {
        toast.info("Login cancelled");
      } else if (error.code === "auth/account-exists-with-different-credential") {
        toast.error("An account already exists with this email using a different sign-in method");
      } else if (error.response) {
        const errorMessage = error.response.data?.message || "GitHub login failed";
        toast.error(errorMessage);
      } else {
        toast.error("Unable to sign in with GitHub. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGitHubLogin}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        padding: "14px 20px",
        background: "#ffffff",
        color: "#2d3748",
        border: "1.5px solid #e2e8f0",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: "600",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.3s ease",
        boxShadow: isHovered && !loading ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 2px 4px rgba(0, 0, 0, 0.05)",
        transform: isHovered && !loading ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <FaGithub style={{ fontSize: "20px", color: "#333333" }} />
      {loading ? "Signing in..." : "Continue with GitHub"}
    </button>
  );
}