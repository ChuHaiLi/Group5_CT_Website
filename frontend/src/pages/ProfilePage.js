import { toast } from "react-toastify";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../untils/axios";
import "../styles/ProfilePage.css";

import { 
  FaTag,
  FaCheckCircle, 
  FaTimesCircle,
  FaUser,       
  FaEnvelope,    
  FaPhone,       
  FaLock,
  FaEye,        
  FaEyeSlash 
} from "react-icons/fa";

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80";

const defaultProfile = {
  username: "",
  taglineSuffix: "",
  email: "",
  phone: "",
  currentPassword: "",  
  newPassword: "",        
  confirmPassword: "",
  avatarUrl: FALLBACK_AVATAR,
};

export default function ProfilePage() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "dashboard" || tabParam === "settings" ? tabParam : "settings";
  const [activeSection, setActiveSection] = useState(initialTab);

  // ← NEW: Scroll sections
  const [activeScrollSection, setActiveScrollSection] = useState("account");
  const accountSectionRef = useRef(null);
  const personalInfoSectionRef = useRef(null);
  const passwordSectionRef = useRef(null);

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

  // Validation states
  const [touched, setTouched] = useState({
    email: false,
    currentPassword: false,  
    newPassword: false,       
    confirmPassword: false,
  });

   const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [modified, setModified] = useState({
    accountId: false,
    personalInfo: false,
    password: false,
  });

  const [validation, setValidation] = useState({
    emailValid: true,
    newPasswordValid: true,   
    passwordsMatch: true,
  });

  // Store original values for cancel functionality
  const [originalData, setOriginalData] = useState(defaultProfile);

  // Validate fields
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValid = profileData.email.length === 0 || emailRegex.test(profileData.email);
    const newPasswordValid = profileData.newPassword.length === 0 || profileData.newPassword.length >= 6;
    const passwordsMatch = profileData.newPassword.length === 0 || profileData.newPassword === profileData.confirmPassword;

    setValidation({
      emailValid,
      newPasswordValid,
      passwordsMatch,
    });
  }, [profileData.email, profileData.newPassword, profileData.confirmPassword]);

  // ← NEW: Scroll spy effect
 useEffect(() => {
  if (activeSection !== "settings") return;

  const handleScroll = () => {
    const scrollY = window.scrollY + 150;

    const sections = [
      { ref: accountSectionRef, name: 'account' },
      { ref: personalInfoSectionRef, name: 'personal' },
      { ref: passwordSectionRef, name: 'password' }
    ];

    // Tìm section hiện tại dựa trên scroll position
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section.ref.current) {
        const sectionTop = section.ref.current.offsetTop;
        if (scrollY >= sectionTop - 50) {
          setActiveScrollSection(section.name);
          break;
        }
      }
    }
  };

  window.addEventListener("scroll", handleScroll);
  handleScroll();
  return () => window.removeEventListener("scroll", handleScroll);
}, [activeSection]);

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
      let taglineSuffix = "";
      if (data.tagline) {
      taglineSuffix = data.tagline.replace(/^#VN/, "");
    }
      const nextProfile = {
        username: data.username || data.name || "",
        taglineSuffix: taglineSuffix,
        email: data.email || "",
        phone: data.phone || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        avatarUrl: data.avatar || FALLBACK_AVATAR,
      };
      setUserId(data.id ?? null);
      setProfileData((prev) => ({ ...prev, ...nextProfile }));
      setOriginalData(nextProfile); 
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
        
        setProfileData((prev) => ({
          ...prev,
          avatarUrl: avatarDataUrl,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));

        setAvatarPreview(avatarDataUrl);

        const updatedProfile = {
          ...profileData,
          avatarUrl: avatarDataUrl,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        };
        localStorage.setItem("wonder-profile", JSON.stringify(updatedProfile));

        broadcastProfile(
          {
            id: userId,
            username: profileData.username,
            email: profileData.email,
            phone: profileData.phone,
            avatar: avatarDataUrl,
          },
          true
        );

        alert("✅ Avatar has been updated!");
      } catch (error) {
        console.error("Avatar upload failed", error);
        alert("⚠️ Unable to upload avatar. Please try again.");
      } finally {
        setUploadingAvatar(false);
      }
    },
    [broadcastProfile, userId, profileData]
  );

   const handleInputChange = (event) => {
    const { name, value } = event.target;
    
    if (name === 'taglineSuffix') {
    const limitedValue = value.slice(0, 5);
    setProfileData((prev) => ({ ...prev, taglineSuffix: limitedValue }));
    setModified(prev => ({ ...prev, accountId: true }));
    return;
  }

    setProfileData((prev) => ({ ...prev, [name]: value }));
    
    // Track modifications
    if (name === 'username') {
      setModified(prev => ({ ...prev, accountId: true }));
    } else if (name === 'email' || name === 'phone') {
      setModified(prev => ({ ...prev, personalInfo: true }));
    } else if (name === 'currentPassword' || name === 'newPassword' || name === 'confirmPassword') {
      setModified(prev => ({ ...prev, password: true }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleCancelAccountId = () => {
    setProfileData(prev => ({ 
    ...prev, 
    username: originalData.username,
    taglineSuffix: originalData.taglineSuffix
  }));
    setModified(prev => ({ ...prev, accountId: false }));
  };

  const handleCancelPersonalInfo = () => {
    setProfileData(prev => ({ 
      ...prev, 
      email: originalData.email,
      phone: originalData.phone 
    }));
    setTouched(prev => ({ ...prev, email: false }));
    setModified(prev => ({ ...prev, personalInfo: false }));
  };

  const handleCancelPassword = () => {
    setProfileData(prev => ({ 
      ...prev, 
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
    setTouched(prev => ({ 
      ...prev, 
      currentPassword: false,
      newPassword: false,
      confirmPassword: false 
    }));
    setModified(prev => ({ ...prev, password: false }));
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

  const handleSaveProfile = async (event, section = 'all') => {
    event.preventDefault();

    // Validate based on section
    if (section === 'accountId') {  
      if (!profileData.username || !profileData.username.trim()) {
        alert("❌ Username is required.");
        return;
      }
      if (profileData.taglineSuffix.length < 3 || profileData.taglineSuffix.length > 5) {
        alert("❌ Tagline must be between 3 and 5 characters.");
        return;
      }
    } else if (section === 'personalInfo') {
      setTouched(prev => ({ ...prev, email: true }));
      
      if (!validation.emailValid) {
        alert("❌ Please enter a valid email address.");
        return;
      }

      const emailChanged = profileData.email.toLowerCase() !== originalData.email.toLowerCase();
  
  if (emailChanged) {
    // Gửi yêu cầu OTP thay vì cập nhật trực tiếp
    setSavingProfile(true);
    
    try {
      const res = await API.post("/auth/request-email-change", {
        new_email: profileData.email
      });
      
      toast.success(res.data.message || "Verification code sent to your new email!");
      
      // Redirect đến trang verify
      navigate("/verify-email-change", {
        state: {
          newEmail: profileData.email,
          oldEmail: originalData.email
        }
      });
      
      return; // 🔥 QUAN TRỌNG: Dừng tại đây, không chạy phần save bên dưới
      
    } catch (error) {
      console.error("Request email change error:", error);
      const errorResponse = error.response?.data;
      
      if (errorResponse?.message) {
        toast.error(errorResponse.message);
      } else {
        toast.error("Unable to send verification code. Please try again.");
      }
    } finally {
      setSavingProfile(false);
    }
    
    return; // Dừng tại đây
  }
    } else if (section === 'password') {
      setTouched({
        email: touched.email,
        currentPassword: true,
        newPassword: true,
        confirmPassword: true,
      });

      const wantsPasswordChange = profileData.newPassword && profileData.newPassword.trim();
      
      if (wantsPasswordChange) {
        if (!profileData.currentPassword || !profileData.currentPassword.trim()) {
          alert("❌ Please enter your current password to change password.");
          return;
        }
        
        if (!validation.newPasswordValid) {
          alert("❌ New password must be at least 6 characters.");
          return;
        }
        
        if (!validation.passwordsMatch) {
          alert("❌ New passwords do not match.");
          return;
        }
      } else {
        alert("❌ Please enter a new password to change your password.");
        return;
      }
    }

    setSavingProfile(true);
    try {
      // 🔥 QUAN TRỌNG: CHỈ GỬI FIELDS CẦN THIẾT
      let payload = {};
      
      if (section === 'accountId') {
        // Chỉ gửi username và tagline
        const fullTagline = `#VN${profileData.taglineSuffix}`;
        payload = {
          username: profileData.username,
          tagline: fullTagline,
        };
      } else if (section === 'personalInfo') {
        // Chỉ gửi email và phone
        payload = {
          email: profileData.email,
          phone: profileData.phone,
        };
      } else if (section === 'password') {
        // Chỉ gửi password fields
        payload = {
          currentPassword: profileData.currentPassword.trim(),
          newPassword: profileData.newPassword.trim(),
        };
      }

      const { data } = await API.put("/profile", payload);

      // 🔥 QUAN TRỌNG: CHỈ CẬP NHẬT FIELDS ĐÃ SAVE, GIỮ NGUYÊN CÁC FIELDS KHÁC
      setProfileData(prev => {
        const updated = { ...prev };
        
        if (section === 'accountId') {
          // Chỉ cập nhật username và tagline
          updated.username = data.user?.username || data.username || prev.username;
          
          if (data.user?.tagline || data.tagline) {
            const fullTag = data.user?.tagline || data.tagline;
            updated.taglineSuffix = fullTag.replace(/^#VN/, "");
          }
        } else if (section === 'personalInfo') {
          // Chỉ cập nhật email và phone
          updated.email = data.user?.email || data.email || prev.email;
          updated.phone = data.user?.phone || data.phone || prev.phone;
        } else if (section === 'password') {
          // Reset password fields sau khi đổi thành công
          updated.currentPassword = "";
          updated.newPassword = "";
          updated.confirmPassword = "";
        }
        
        return updated;
      });
      
      // Cập nhật originalData chỉ cho fields đã save
      setOriginalData(prev => {
        const updated = { ...prev };
        
        if (section === 'accountId') {
          updated.username = data.user?.username || data.username || prev.username;
          if (data.user?.tagline || data.tagline) {
            const fullTag = data.user?.tagline || data.tagline;
            updated.taglineSuffix = fullTag.replace(/^#VN/, "");
          }
        } else if (section === 'personalInfo') {
          updated.email = data.user?.email || data.email || prev.email;
          updated.phone = data.user?.phone || data.phone || prev.phone;
        }
        
        return updated;
      });
      
      localStorage.setItem("wonder-profile", JSON.stringify(profileData));
      
      // Broadcast chỉ khi có thay đổi avatar hoặc username
      if (section === 'accountId' || section === 'personalInfo') {
        broadcastProfile(
          {
            id: userId,
            username: profileData.username,
            email: profileData.email,
            phone: profileData.phone,
            avatar: profileData.avatarUrl,
          },
          true
        );
      }

      // Reset states based on section
      if (section === 'accountId') {
        setModified(prev => ({ ...prev, accountId: false }));
        alert("✅ Account ID updated successfully!");
      } else if (section === 'personalInfo') {
        setTouched(prev => ({ ...prev, email: false }));
        setModified(prev => ({ ...prev, personalInfo: false }));
        alert("✅ Personal information updated successfully!");
      } else if (section === 'password') {
        setTouched({
          email: false,
          currentPassword: false,
          newPassword: false,
          confirmPassword: false,
        });
        setModified(prev => ({ ...prev, password: false }));
        alert("✅ Password updated successfully!");
      }
      
    } catch (error) {
      console.error("Update profile error:", error);
      
      const errorResponse = error.response?.data;
      
      if (errorResponse?.errors) {
        const errorMessages = Object.entries(errorResponse.errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join("\n");
        alert(`❌ Update failed:\n${errorMessages}`);
      } else if (errorResponse?.message) {
        if (errorResponse.message.includes("current password")) {
          alert("❌ Current password is incorrect. Please try again.");
        } else if (errorResponse.message.includes("password")) {
          alert(`❌ Password update failed: ${errorResponse.message}`);
        } else {
          alert(`❌ ${errorResponse.message}`);
        }
      } else {
        alert("❌ Unable to update profile. Please check your connection and try again.");
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

  // ← NEW: Scroll to section
  const scrollToSection = (section) => {
    setActiveScrollSection(section);
    let ref;
    
    if (section === "account") {
      ref = accountSectionRef;
    } else if (section === "personal") {
      ref = personalInfoSectionRef;
    } else if (section === "password") {
      ref = passwordSectionRef;
    }
    
    if (ref?.current) {
      const yOffset = -100;
      const y = ref.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

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
        <div className="settings-form-wrapper">
          {/* ACCOUNT ID SECTION */}
          <form className="settings-form" onSubmit={(e) => handleSaveProfile(e, 'accountId')}>
            <div ref={accountSectionRef} className="form-section" id="section-account-id">
              <div className="section-header">
                <h2 className="form-section__title">
                  <span className="section-icon">👤</span>
                  Account ID
                </h2>
                <p className="form-section__description">
                  Your unique identifier and display name
                </p>
              </div>
              
              {/* Username */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaUser className="field-icon" /> 
                  <span>Username</span>
                  <span className="field-badge">Required</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="username"
                    name="username"
                    value={profileData.username}
                    onChange={handleInputChange}
                    placeholder="Enter your username"
                    className="form-input"
                  />
                </div>
              </label>

              {/* Tagline */}
              <label className="form-field">
                <span className="form-field__label">
                    <FaTag className="field-icon" />
                    <span>Tagline</span>
                  <span className="field-badge">Required</span>
                </span>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    <span style={{
                      color: '#1a1a1a',
                      fontWeight: '600',
                      fontSize: '15px',
                      paddingLeft: '18px',
                      paddingRight: '2px',
                      position: 'absolute',
                      zIndex: 1,
                      pointerEvents: 'none',
                      lineHeight: '54px'
                    }}>
                      #VN
                    </span>
                    <input
                      id="taglineSuffix"
                      name="taglineSuffix"
                      value={profileData.taglineSuffix}
                      onChange={handleInputChange}
                      placeholder=""
                      className="form-input"
                      type="text"
                      maxLength={5}
                      minLength={3}
                      style={{
                        paddingLeft: '52px',
                        width: '100%'
                      }}
                    />
                  </div>
                  <span className="input-hint">
                    🎯 Your unique travel identifier (3-5 characters: letters, numbers, special chars)
                  </span>
                </div>
              </label>
              {/* Action buttons for RIOT ID */}
              <div className="button-group">
                {modified.accountId && (
                  <button
                    type="button"
                    onClick={handleCancelAccountId}
                    className="secondary-button"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingProfile || !modified.accountId}
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>

          {/* PERSONAL INFORMATION SECTION */}
          <form className="settings-form" onSubmit={(e) => handleSaveProfile(e, 'personalInfo')}>
            <div ref={personalInfoSectionRef} className="form-section" id="section-personal-info">
              <div className="section-header">
                <h2 className="form-section__title">
                  <span className="section-icon">📧</span>
                  PERSONAL INFORMATION
                </h2>
                <p className="form-section__description">
                  Contact details and account recovery options
                </p>
              </div>

              {/* Email */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaEnvelope className="field-icon" /> 
                  <span>Email Address</span>
                  <span className="field-badge">Required</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={profileData.email}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('email')}
                    placeholder="hellowonderai@gmail.com"
                    className="form-input"
                  />
                </div>
                {!validation.emailValid && profileData.email.length > 0 && (
                  <div className="validation-message error">
                    <FaTimesCircle />
                    <span>Please enter a valid email address</span>
                  </div>
                )}
              </label>

              {/* Phone */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaPhone className="field-icon" /> 
                  <span>Phone Number</span>
                  <span className="field-badge optional">Optional</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={handleInputChange}
                    placeholder="+1 555 987 6543"
                    className="form-input"
                  />
                  <span className="input-hint">
                    📱 Used for account recovery and notifications
                  </span>
                </div>
              </label>

              {/* Action buttons for Personal Info */}
              <div className="button-group">
                {modified.personalInfo && (
                  <button
                    type="button"
                    onClick={handleCancelPersonalInfo}
                    className="secondary-button"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingProfile || !validation.emailValid || !modified.personalInfo}
                >
                  {savingProfile 
                    ? "Processing..." 
                    : (profileData.email.toLowerCase() !== originalData.email.toLowerCase()
                        ? "Send Verification Code" 
                        : "Save Changes"
                      )
                  }
                </button>
              </div>
            </div>
          </form>

          {/* ACCOUNT SIGN-IN (PASSWORD) SECTION */}
          <form className="settings-form" onSubmit={(e) => handleSaveProfile(e, 'password')}>
            <div ref={passwordSectionRef} className="form-section" id="section-password">
              <div className="section-header">
                <h2 className="form-section__title">
                  <span className="section-icon">🔐</span>
                    ACCOUNT SIGN-IN
                </h2>
                <p className="form-section__subtitle">
                      Leave blank if you don't want to change your password
                </p>
              </div>

              {/* Current Password */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaLock className="field-icon" /> 
                  <span>Current Password</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showPassword.current ? "text" : "password"}
                    value={profileData.currentPassword}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('currentPassword')}
                    placeholder="Enter current password"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="show-hide"
                    onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                    aria-label={showPassword.current ? "Hide password" : "Show password"}
                  >
                    {showPassword.current ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </label>

              {/* New Password */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaLock className="field-icon" /> 
                  <span>New Password</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword.new ? "text" : "password"}
                    value={profileData.newPassword}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('newPassword')}
                    placeholder="Enter new password (min 6 characters)"
                    className="form-input"
                    style={{
                      borderColor: touched.newPassword && profileData.newPassword.length > 0
                        ? (validation.newPasswordValid ? '#4CAF50' : '#f44336')
                        : '#d0d0d0'
                    }}
                  />
                  <button
                    type="button"
                    className="show-hide"
                    onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                    aria-label={showPassword.new ? "Hide password" : "Show password"}
                  >
                    {showPassword.new ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {touched.newPassword && !validation.newPasswordValid && profileData.newPassword.length > 0 && (
                  <div className="validation-message error">
                    <FaTimesCircle />
                    <span>Password must be at least 6 characters</span>
                  </div>
                )}
              </label>

              {/* Confirm New Password */}
              <label className="form-field">
                <span className="form-field__label">
                  <FaLock className="field-icon" /> 
                  <span>Confirm New Password</span>
                </span>
                <div className="input-wrapper">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword.confirm ? "text" : "password"}
                    value={profileData.confirmPassword}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="Confirm new password"
                    className="form-input"
                    style={{
                      borderColor: touched.confirmPassword && profileData.confirmPassword.length > 0
                        ? (validation.passwordsMatch ? '#4CAF50' : '#f44336')
                        : '#d0d0d0'
                    }}
                  />
                  <button
                    type="button"
                    className="show-hide"
                    onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                    aria-label={showPassword.confirm ? "Hide password" : "Show password"}
                  >
                    {showPassword.confirm ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {touched.confirmPassword && !validation.passwordsMatch && profileData.confirmPassword.length > 0 && (
                  <div className="validation-message error">
                    <FaTimesCircle />
                    <span>Passwords do not match</span>
                  </div>
                )}
              </label>

              {/* Password Strength */}
              {profileData.newPassword.length > 0 && (
                <div className="password-strength-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    {validation.newPasswordValid ? (
                      <FaCheckCircle style={{ color: '#4CAF50' }} />
                    ) : (
                      <FaTimesCircle style={{ color: '#f44336' }} />
                    )}
                    <span style={{ color: validation.newPasswordValid ? '#4CAF50' : '#666' }}>
                      At least 6 characters
                    </span>
                  </div>
                  
                  {profileData.confirmPassword.length > 0 && (
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

              {/* Action buttons for Password */}
              <div className="button-group">
                {modified.password && (
                  <button
                    type="button"
                    onClick={handleCancelPassword}
                    className="secondary-button"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    savingProfile || 
                    !modified.password ||
                    (profileData.newPassword.length > 0 && (!validation.newPasswordValid || !validation.passwordsMatch))
                  }
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
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

  const handleSectionChange = useCallback(
    (section) => {
      setActiveSection(section);
      setSearchParams({ tab: section }, { replace: true });
    },
    [setSearchParams]
  );

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header__content">
          <span className="profile-header__icon">✈️</span>
          <div>
            <h1 className="profile-header__title">
              Vietnam Travel Account
            </h1>
            <p className="profile-header__subtitle">
              Manage your travel profile and journey statistics
            </p>
          </div>
        </div>
      </div>

      <div className="profile-layout">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <div className="sidebar-avatar">
            <div className="sidebar-avatar__wrapper">
              <img
                src={avatarPreview}
                alt="User avatar"
                className="sidebar-avatar__image"
              />
              <button
                className="sidebar-avatar__upload"
                title="Upload a new avatar"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="avatar-upload-input"
              />
            </div>
            <h3 className="sidebar-avatar__username">
              {profileData.username || 'Traveler'}
            </h3>
            <p className="sidebar-avatar__tag">
              #VN{profileData.taglineSuffix || ''}
            </p>
          </div>

          <nav className="profile-sidebar__tabs">
            <button
              className={`control-tab ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => handleSectionChange('settings')}
            >
              <span className="control-tab__icon">👤</span>
              <span className="control-tab__label">Account Info</span>
            </button>
            <button
              className={`control-tab ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleSectionChange('dashboard')}
            >
              <span className="control-tab__icon">📊</span>
              <span className="control-tab__label">Dashboard</span>
            </button>
          </nav>

          {/* ← NEW: Sticky section nav (only show in settings) */}
           {activeSection === "settings" && (
            <div className="section-nav">
              <p className="section-nav__title">SECTIONS</p>
              <button
                className={`section-nav__item ${activeScrollSection === 'account' ? 'active' : ''}`}
                onClick={() => scrollToSection('account')}
              >
                Account ID
              </button>
              <button
                className={`section-nav__item ${activeScrollSection === 'personal' ? 'active' : ''}`}
                onClick={() => scrollToSection('personal')}
              >
                Personal Info
              </button>
              <button
                className={`section-nav__item ${activeScrollSection === 'password' ? 'active' : ''}`}
                onClick={() => scrollToSection('password')}
              >
                Account Sign-in
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="profile-main">
          <div className="profile-main__header">
            <div>
              <p className="eyebrow">Profile</p>
              <h1>
                {activeSection === "settings" ? "Account Information" : "Travel Dashboard"}
              </h1>
              <span>
                {activeSection === "settings"
                  ? "Update your personal details and travel preferences"
                  : "Your journey statistics and travel highlights"}
              </span>
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
