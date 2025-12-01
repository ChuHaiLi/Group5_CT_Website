import React, { useState, useEffect } from "react";
import "../styles/ProfilePage.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    phone: "",
    avatar: "",
  });
  const [editing, setEditing] = useState(false);
  const [newAvatar, setNewAvatar] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) setProfile(JSON.parse(userData));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setNewAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setProfile((prev) => ({ ...prev, avatar: newAvatar || prev.avatar }));
    localStorage.setItem("user", JSON.stringify({ ...profile, avatar: newAvatar || profile.avatar }));
    setEditing(false);
    alert("✅ Hồ sơ đã được cập nhật!");
  };

  return (
    <div className="profile-wrapper">
      <div className="profile-card">
        <div className="avatar-section">
          <img
            src={newAvatar || profile.avatar || "/default-avatar.png"}
            alt="Avatar"
            className="avatar"
          />
          {editing && (
            <label className="change-avatar">
              ✏️
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>
          )}
        </div>

        <div className="info-section">
          {!editing ? (
            <>
              <h2>{profile.username || "Tên người dùng"}</h2>
              <p>Email: {profile.email || "-"}</p>
              <p>Phone: {profile.phone || "-"}</p>
              <button className="edit-btn" onClick={() => setEditing(true)}>✏️ Chỉnh sửa</button>
            </>
          ) : (
            <>
              <input name="username" value={profile.username} onChange={handleChange} placeholder="Tên người dùng"/>
              <input name="email" type="email" value={profile.email} onChange={handleChange} placeholder="Email"/>
              <input name="phone" value={profile.phone} onChange={handleChange} placeholder="Số điện thoại"/>
              <button className="save-btn" onClick={handleSave}>💾 Lưu thay đổi</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
