import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "./components/Navbar/Navbar";
import HomePage from "./pages/Home/HomePage";
import ExplorePage from "./pages/Explore/ExplorePage";
import MyTripsPage from "./pages/MyTrips/MyTripsPage";
import ProfilePage from "./pages/ProfilePage";
import PrivateRoute from "./components/PrivateRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SavedPage from "./pages/Saved/Saved";
import Chat from "./pages/Chat/Chat";
import "./App.css";
import axios from "axios";

function AppContent() {
  const location = useLocation();
  const hideNavbar = ["/login", "/register"].includes(location.pathname);

  const [savedIds, setSavedIds] = useState(new Set());

  // Lấy saved list từ backend
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setSavedIds(new Set());
      return;
    }

    axios.get("/api/saved/list", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setSavedIds(new Set(res.data.map(d => d.id))))
      .catch(err => console.error("Saved list error:", err.response?.status, err.response?.data));
  }, []);

  // Xử lý save/unsave
  const handleToggleSave = async (id) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Please log in to save destinations.");
      return;
    }

    const isSaved = savedIds.has(id);

    try {
      if (isSaved) {
        await axios.delete("/api/saved/remove", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          data: { destination_id: id },
        });
        setSavedIds(prev => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      } else {
        await axios.post("/api/saved/add", { destination_id: id }, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        setSavedIds(prev => {
          const s = new Set(prev);
          s.add(id);
          return s;
        });
      }
    } catch (err) {
      console.error("Save toggle error:", err.response?.status, err.response?.data);
    }
  };

  return (
    <>
      {!hideNavbar && <Navbar />}

      {/* Wrapper chung cho content, chỉ page có navbar mới thêm class */}
      <div className={`page-wrapper ${!hideNavbar ? "with-navbar" : ""}`}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Trang chính */}
          <Route path="/" element={
            <PrivateRoute>
              <HomePage savedIds={savedIds} handleToggleSave={handleToggleSave} />
            </PrivateRoute>
          } />

          <Route path="/explore" element={<PrivateRoute><ExplorePage /></PrivateRoute>} />
          <Route path="/mytrips" element={<PrivateRoute><MyTripsPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

          <Route path="/saved" element={
            <PrivateRoute>
              <SavedPage savedIds={savedIds} handleToggleSave={handleToggleSave} />
            </PrivateRoute>
          } />
          <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        </Routes>
      </div>

      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
