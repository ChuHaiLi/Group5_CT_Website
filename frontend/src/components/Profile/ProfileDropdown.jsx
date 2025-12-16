import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import "./ProfileDropdown.css";

const ProfileDropdown = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localUser, setLocalUser] = useState(user); 
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Listen cho profile updates
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const updatedUser = event.detail;
      setLocalUser(prevUser => ({
        ...prevUser,
        ...updatedUser
      }));
    };

    window.addEventListener('wonder-profile-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('wonder-profile-updated', handleProfileUpdate);
    };
  }, []);

  // Sync với prop user khi thay đổi
  useEffect(() => {
    if (user) {
      setLocalUser(user);
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

   const getUserInitials = () => {
    if (!localUser?.username) return 'U';
    return localUser.username.charAt(0).toUpperCase();
  };
  
  // Get user initials for fallback avatar
  const getUserTagline = () => {
    // Ưu tiên tagline từ localUser
    if (localUser?.tagline) {
      return localUser.tagline;
    }
    // Fallback về #VN
    return '#VN';
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`profile-dropdown-backdrop ${isOpen ? 'show' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      <div className="profile-dropdown-wrapper" ref={dropdownRef}>
        {/* Avatar Button */}
        <button
          className={`profile-avatar-button ${!user?.avatar ? 'no-image' : ''}`}
          onClick={toggleDropdown}
          aria-label="Profile menu"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.username || 'User'} 
            />
          ) : (
            <span>{getUserInitials()}</span>
          )}
        </button>

        {/* Dropdown Menu */}
        <div className={`profile-dropdown-menu ${isOpen ? 'show' : ''}`}>
          {/* User Info Header */}
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-user">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.username || 'User'}
                  className="profile-dropdown-avatar"
                />
              ) : (
                <div className="profile-dropdown-avatar">
                  {getUserInitials()}
                </div>
              )}
              <div className="profile-dropdown-info">
                <h3 className="profile-dropdown-name">
                  {user?.username || 'User'}
                </h3>
                <p className="profile-dropdown-tagline">
                  {getUserTagline()}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="profile-dropdown-items">
            {/* Profile Link */}
            <button 
              className="profile-dropdown-item profile-item"
              onClick={handleProfileClick}
              aria-label="Go to profile"
            >
              <div className="profile-dropdown-item-icon">
                👤
              </div>
              <span className="profile-dropdown-item-text">Profile</span>
            </button>

            {/* Logout Link */}
            <button 
              className="profile-dropdown-item logout-item"
              onClick={handleLogoutClick}
              aria-label="Logout"
            >
              <div className="profile-dropdown-item-icon">
                🚪
              </div>
              <span className="profile-dropdown-item-text">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileDropdown;