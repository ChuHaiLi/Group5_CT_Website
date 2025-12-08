import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../utils/axios";
import "../styles/ProfilePage.css";

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80";

const defaultProfile = {
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  avatarUrl: FALLBACK_AVATAR,
};

export default function ProfilePage() {
  const navigate = useNavigate();

  // ------ TAB LOGIC: derive từ URL + state sync ------
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "dashboard" || tabParam === "settings" ? tabParam : "settings";
  const [activeSection, setActiveSection] = useState(initialTab);

  const [userId, setUserId] = useState(null);
  const [profileData, setProfileData] = useState(defaultProfile);
  const [avatarPreview, setAvatarPreview] = useState(FALLBACK_AVATAR);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [trips, setTrips] = useState([]);
  const [savedDestinations, setSavedDestinations] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const fileInputRef = useRef(null);

  const broadcastProfile = useCallback((payload = {}, persist = false) => {
    const normalized = {
      id: payload.id ?? null,
      username: payload.username ?? "",
      email: payload.email ?? "",
      phone: payload.phone ?? "",
      avatar: payload.avatar ?? payload.avatarUrl ?? FALLBACK_AVATAR,
    };
    window.dispatchEvent(
      new CustomEvent("wonder-profile-updated", { detail: normalized })
    );
    if (persist) {
      localStorage.setItem("user", JSON.stringify(normalized));
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await API.get("/auth/me");
      const nextProfile = {
        username: data.username || data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        password: "",
        confirmPassword: "",
        avatarUrl: data.avatar || FALLBACK_AVATAR,
      };
      setUserId(data.id ?? null);
      setProfileData((prev) => ({ ...prev, ...nextProfile }));
      setAvatarPreview(nextProfile.avatarUrl);
      localStorage.setItem("wonder-profile", JSON.stringify(nextProfile));
      broadcastProfile(
        {
          id: data.id ?? null,
          username: nextProfile.username,
          email: nextProfile.email,
          phone: nextProfile.phone,
          avatar: nextProfile.avatarUrl,
        },
        true
      );
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  }, [broadcastProfile]);

  const fetchDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const [tripsRes, savedRes] = await Promise.all([
        API.get("/trips"),
        API.get("/saved/list"),
      ]);
      setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : []);
      setSavedDestinations(Array.isArray(savedRes.data) ? savedRes.data : []);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
      setStatsError("Không thể tải dữ liệu thống kê. Vui lòng thử lại sau.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedProfile = localStorage.getItem("wonder-profile");
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile);
        setProfileData((prev) => ({ ...prev, ...parsed }));
        if (parsed.avatarUrl) setAvatarPreview(parsed.avatarUrl);
      } catch (error) {
        console.warn("Invalid cached profile", error);
      }
    }
    fetchProfile();
    fetchDashboardStats();
  }, [fetchProfile, fetchDashboardStats]);

  useEffect(() => {
    setActiveSection(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeSection === "dashboard") {
      fetchDashboardStats();
    }
  }, [activeSection, fetchDashboardStats]);

  const uploadAvatarInstantly = useCallback(
    async (avatarDataUrl) => {
      if (!avatarDataUrl) return;
      setUploadingAvatar(true);
      try {
        await API.put("/profile", { avatarUrl: avatarDataUrl });
        setProfileData((prev) => {
          const next = { ...prev, avatarUrl: avatarDataUrl, password: "" };
          localStorage.setItem("wonder-profile", JSON.stringify(next));
          broadcastProfile(
            {
              id: userId,
              username: next.username,
              email: next.email,
              phone: next.phone,
              avatar: avatarDataUrl,
            },
            true
          );
          return next;
        });
      } catch (error) {
        console.error("Avatar upload failed", error);
        alert("❌ Không thể tải ảnh đại diện. Vui lòng thử lại.");
      } finally {
        setUploadingAvatar(false);
      }
    },
    [broadcastProfile, userId]
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAvatarPreview(reader.result);
        setProfileData((prev) => ({ ...prev, avatarUrl: reader.result }));
        broadcastProfile(
          {
            id: userId,
            username: profileData.username,
            email: profileData.email,
            phone: profileData.phone,
            avatar: reader.result,
          },
          false
        );
        uploadAvatarInstantly(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (
      profileData.password &&
      profileData.password.trim() &&
      profileData.password.trim() !== profileData.confirmPassword.trim()
    ) {
      alert("Mật khẩu và xác nhận mật khẩu không khớp.");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        username: profileData.username,
        email: profileData.email,
        phone: profileData.phone,
        avatarUrl: profileData.avatarUrl,
      };

      if (profileData.password && profileData.password.trim()) {
        payload.password = profileData.password.trim();
      }

      const { data } = await API.put("/profile", payload);

      const updatedProfile = {
        username: data.user.username || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        password: "",
        confirmPassword: "",
        avatarUrl: data.user.avatar || FALLBACK_AVATAR,
      };

      setUserId(data.user.id ?? userId);
      setProfileData(updatedProfile);
      setAvatarPreview(updatedProfile.avatarUrl);
      localStorage.setItem("wonder-profile", JSON.stringify(updatedProfile));
      broadcastProfile(
        {
          id: data.user.id ?? userId,
          username: updatedProfile.username,
          email: updatedProfile.email,
          phone: updatedProfile.phone,
          avatar: updatedProfile.avatarUrl,
        },
        true
      );
      alert("✅ Hồ sơ đã được cập nhật trên hệ thống!");
    } catch (error) {
      const apiErrors = error.response?.data?.errors;
      if (apiErrors) {
        alert(Object.values(apiErrors).join("\n"));
      } else {
        alert(error.response?.data?.message || "Không thể cập nhật hồ sơ.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const totalTrips = trips.length;
  const completedTrips = trips.filter(
    (trip) => trip.status === "COMPLETED"
  ).length;
  const savedCount = savedDestinations.length;

  const chartData = useMemo(() => {
    const now = new Date().getTime();
    const msPerDay = 1000 * 60 * 60 * 24;
    const countWithin = (days) =>
      trips.filter((trip) => {
        const dateRef = trip.start_date || trip.created_at || trip.updated_at;
        if (!dateRef) return false;
        const parsed = new Date(dateRef).getTime();
        if (Number.isNaN(parsed)) return false;
        const diffDays = Math.abs(now - parsed) / msPerDay;
        return diffDays <= days;
      }).length;

    return [
      { label: "Week", value: countWithin(7) },
      { label: "Month", value: countWithin(30) },
      { label: "Year", value: countWithin(365) },
    ];
  }, [trips]);

  const maxChartValue = useMemo(() => {
    if (!chartData.length) return 1;
    const highest = Math.max(...chartData.map((item) => item.value));
    return highest > 0 ? highest : 1;
  }, [chartData]);

  const renderUserSettings = () => {
    const isActive = activeSection === "settings";
    return (
      <div
        className="settings-panel"
        id="profile-section-settings"
        role="tabpanel"
        aria-labelledby="control-tab-settings"
        aria-hidden={!isActive}
      >
        <div className="settings-avatar">
          <img
            src={avatarPreview}
            alt="User avatar"
            className="avatar-preview"
          />
          <button
            type="button"
            className="avatar-upload-btn"
            title="Upload a new avatar"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? "Uploading..." : "Upload new avatar"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="avatar-upload-input"
          />
        </div>

        <form className="settings-form" onSubmit={handleSaveProfile}>
          <label className="form-field">
            <span className="form-field__label">Username</span>
            <input
              id="username"
              name="username"
              value={profileData.username}
              onChange={handleInputChange}
              placeholder="john_doe"
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Email</span>
            <input
              id="email"
              name="email"
              type="email"
              value={profileData.email}
              onChange={handleInputChange}
              placeholder="john.doe@example.com"
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Phone</span>
            <input
              id="phone"
              name="phone"
              value={profileData.phone}
              onChange={handleInputChange}
              placeholder="+1 234 567 3900"
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Password</span>
            <input
              id="password"
              name="password"
              type="password"
              value={profileData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Confirm Password</span>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={profileData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={savingProfile}
          >
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    );
  };

  const handleCardNavigation = useCallback(
    (path) => navigate(path),
    [navigate]
  );

  const handleCardKeyDown = useCallback(
    (event, path) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigate(path);
      }
    },
    [navigate]
  );

  const renderDashboard = () => {
    const isActive = activeSection === "dashboard";
    return (
      <div
        className="dashboard-panel"
        id="profile-section-dashboard"
        role="tabpanel"
        aria-labelledby="control-tab-dashboard"
        aria-hidden={!isActive}
      >
        <div className="stats-grid">
          <div
            className="stats-card stats-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => handleCardNavigation("/mytrips")}
            onKeyDown={(event) => handleCardKeyDown(event, "/mytrips")}
          >
            <p className="stats-label">Trips</p>
            <p className="stats-value">{totalTrips}</p>
            <span className="stats-helper">All itineraries you've planned</span>
            <button
              type="button"
              className="stats-card__cta"
              onClick={(event) => {
                event.stopPropagation();
                handleCardNavigation("/mytrips");
              }}
            >
              Go to My Trips
            </button>
          </div>
          <div
            className="stats-card stats-card--clickable"
            role="button"
            tabIndex={0}
            onClick={() => handleCardNavigation("/saved")}
            onKeyDown={(event) => handleCardKeyDown(event, "/saved")}
          >
            <p className="stats-label">Trips Saved</p>
            <p className="stats-value">{savedCount}</p>
            <span className="stats-helper">Destinations pinned for later</span>
            <button
              type="button"
              className="stats-card__cta"
              onClick={(event) => {
                event.stopPropagation();
                handleCardNavigation("/saved");
              }}
            >
              Go to Saved
            </button>
          </div>
          <div className="stats-card">
            <p className="stats-label">Trips Completed</p>
            <p className="stats-value">{completedTrips}</p>
            <span className="stats-helper">Marked as COMPLETED</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <div>
              <h3>Trips Over Time</h3>
              <p>Snapshot of activity over the last week, month, and year.</p>
            </div>
            <button
              type="button"
              className="badge-button"
              onClick={fetchDashboardStats}
            >
              Refresh data
            </button>
          </div>

          {statsLoading ? (
            <div className="chart-loading">Đang tải biểu đồ...</div>
          ) : statsError ? (
            <div className="chart-error">{statsError}</div>
          ) : (
            <div className="chart-wrapper">
              <div className="chart-bars">
                {chartData.map((item) => {
                  const heightPercent = Math.round(
                    (item.value / maxChartValue) * 100
                  );
                  const barHeight =
                    item.value === 0 ? 4 : Math.max(heightPercent, 12);
                  return (
                    <div key={item.label} className="chart-bar">
                      <div className="chart-bar__column">
                        <div
                          className="chart-bar__fill"
                          style={{ height: `${barHeight}%` }}
                        >
                          {item.value > 0 && (
                            <span className="chart-bar__value">
                              {item.value}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="chart-bar__label">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ------ CLICK TAB: cập nhật state + URL query ------
  const handleSectionChange = useCallback(
    (section) => {
      setActiveSection(section);
      setSearchParams({ tab: section }, { replace: true });
    },
    [setSearchParams]
  );

  return (
    <div className="profile-page">
      <div className="profile-layout">
        <main className="profile-main">
          <div className="profile-main__header">
            <div>
              <p className="eyebrow">Profile</p>
              <h1>
                {activeSection === "settings" ? "User Settings" : "Dashboard"}
              </h1>
              <span>
                {activeSection === "settings"
                  ? "Manage your personal info and security preferences."
                  : "Track how your travel plans evolve in real time."}
              </span>
            </div>
            <div className="profile-main__toggle">
              <button
                type="button"
                className="profile-toggle-button"
                onClick={() =>
                  handleSectionChange(
                    activeSection === "settings" ? "dashboard" : "settings"
                  )
                }
              >
                {activeSection === "settings"
                  ? "Go to Dashboard"
                  : "Back to User Settings"}
              </button>
            </div>
          </div>

          {activeSection === "settings"
            ? renderUserSettings()
            : renderDashboard()}
        </main>
      </div>
    </div>
  );
}
