// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navbar from "./components/Navbar/Navbar";
import HomePage from "./pages/Home/HomePage";
import ExplorePage from "./pages/Explore/ExplorePage";
import MyTripsPage from "./pages/MyTrips/MyTripsPage";
import ProfilePage from "./pages/ProfilePage";
import SavedPage from "./pages/Saved/Saved";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import API from "./untils/axios"; // Axios instance with baseURL + interceptors

// ------------------- PrivateRoute -------------------
function PrivateRoute({ isAuthenticated, children }) {
  if (isAuthenticated === null) return <div>Checking authentication...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ------------------- AppContent -------------------
function AppContent() {
  const location = useLocation();
  const hideNavbar = ["/login", "/register", "/reset-password", "/forgot-password"].includes(location.pathname);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = not checked yet
  const [savedIds, setSavedIds] = useState(new Set());

  // ---------------- Check authentication on app load ----------------
  useEffect(() => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      setIsAuthenticated(false);
      setCheckingAuth(false);
      return;
    }

    API.get("/auth/me") // backend returns user info if token valid
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setIsAuthenticated(false);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  // ---------------- Fetch saved destinations ----------------
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      return;
    }

    API.get("/saved/list")
      .then(res => setSavedIds(new Set(res.data.map(d => d.id))))
      .catch(() => toast.error("Failed to fetch saved list"));
  }, [isAuthenticated]);

  // ---------------- Toggle save/unsave ----------------
  const handleToggleSave = async (id) => {
    if (!isAuthenticated) {
      toast.info("Please log in to save destinations");
      return;
    }

    const isSaved = savedIds.has(id);

    try {
      if (isSaved) {
        await API.delete("/saved/remove", { data: { destination_id: id } });
        setSavedIds(prev => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      } else {
        await API.post("/saved/add", { destination_id: id });
        setSavedIds(prev => {
          const s = new Set(prev);
          s.add(id);
          return s;
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error saving/unsaving destination");
    }
  };

  if (checkingAuth) return <div>Checking authentication...</div>;

  return (
    <>
      {!hideNavbar && <Navbar />}

      <div className={`page-wrapper ${!hideNavbar ? "with-navbar" : ""}`}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Protected routes */}
          <Route
            path="/home"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <HomePage savedIds={savedIds} handleToggleSave={handleToggleSave} />
              </PrivateRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <ExplorePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/mytrips"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <MyTripsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/saved"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <SavedPage savedIds={savedIds} handleToggleSave={handleToggleSave} />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>

      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

// ------------------- App -------------------
export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
