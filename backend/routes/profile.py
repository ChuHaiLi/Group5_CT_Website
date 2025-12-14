from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User
from datetime import datetime, timedelta
import re
import json
from utils.email_utils import send_email, generate_otp

profile_bp = Blueprint("profile", __name__)

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# -------- PROFILE MANAGEMENT --------
@profile_bp.route("", methods=["GET"])
@jwt_required()
def get_profile():
    """Lấy thông tin profile của user hiện tại"""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    avatar = user.avatar_url or user.picture or ""
    
    return jsonify({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone or "",
        "name": user.name or "",
        "tagline": user.tagline or "#VN",
        "avatar": avatar,
    }), 200

@profile_bp.route("", methods=["PUT"])
@jwt_required()
def update_profile():
    """Cập nhật thông tin profile - CHỈ VALIDATE FIELDS ĐƯỢC GỬI LÊN"""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    data = request.get_json() or {}
    
    errors = {}
    profile_changed = False
    
    fields_to_update = set(data.keys())
    
    # 1. Cập nhật Username
    if "username" in fields_to_update:
        new_username = data.get("username", "").strip()
        if new_username != user.username:
            if len(new_username) < 3:
                errors["username"] = "Username must be at least 3 characters"
            else:
                user.username = new_username
                profile_changed = True
    
    # 2. Cập nhật Tagline
    if "tagline" in fields_to_update:
        new_tagline = data.get("tagline", "").strip()
        
        if new_tagline and not new_tagline.startswith("#VN"):
            new_tagline = f"#VN{new_tagline}"
        
        suffix = new_tagline.replace("#VN", "")
        
        if suffix and (len(suffix) < 3 or len(suffix) > 5):
            errors["tagline"] = "Tagline must be between 3 and 5 characters (excluding #VN)"
        elif not suffix:
            new_tagline = user.tagline or "#VN"
        elif new_tagline != user.tagline:
            user.tagline = new_tagline
            profile_changed = True

    # 3. Cập nhật Email
    if "email" in fields_to_update:
        new_email = data.get("email", "").strip().lower()
        if new_email != user.email.lower():
            if not is_valid_email(new_email):
                errors["email"] = "Invalid email format"
            elif User.query.filter(db.func.lower(User.email) == new_email, User.id != user_id).first():
                errors["email"] = "Email already exists"
            else:
                user.email = new_email
                profile_changed = True
    
    # 4. Cập nhật Phone
    if "phone" in fields_to_update:
        new_phone = data.get("phone", "").strip()
        if new_phone != (user.phone or ""):
            user.phone = new_phone if new_phone else None
            profile_changed = True
    
    # 5. Cập nhật Password
    if "currentPassword" in fields_to_update and "newPassword" in fields_to_update:
        current_password = data.get("currentPassword", "").strip()
        new_password = data.get("newPassword", "").strip()
        
        if new_password:
            is_google_user = bool(user.google_id)
            is_github_user = bool(user.github_id)
            
            if is_google_user or is_github_user:
                # Google/GitHub user - cho phép đặt mật khẩu mới
                if len(new_password) < 6:
                    errors["newPassword"] = "New password must be at least 6 characters"
                else:
                    user.password = generate_password_hash(new_password)
                    profile_changed = True
            else:
                if not check_password_hash(user.password, current_password):
                    errors["currentPassword"] = "Current password is incorrect"
                else:
                    if len(new_password) < 6:
                        errors["newPassword"] = "New password must be at least 6 characters"
                    else:
                        user.password = generate_password_hash(new_password)
                        profile_changed = True
    
    # 6. Cập nhật Avatar URL
    if "avatarUrl" in fields_to_update or "avatar" in fields_to_update:
        new_avatar = data.get("avatarUrl") or data.get("avatar")
        if new_avatar:
            current_avatar = user.avatar_url or user.picture or ""
            if new_avatar != current_avatar:
                user.avatar_url = new_avatar
                
                if user.google_id:
                    user.picture = new_avatar
                
                profile_changed = True
    
    # Nếu có lỗi validation
    if errors:
        return jsonify({"errors": errors}), 400
    
    # Nếu không có gì thay đổi
    if not profile_changed:
        return jsonify({"message": "No changes detected"}), 200
    
    # Lưu thay đổi
    try:
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        final_avatar = user.avatar_url or user.picture or ""
        
        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "phone": user.phone or "",
                "name": user.name or "",
                "tagline": user.tagline or "#VN",
                "avatar": final_avatar,
                "google_id": user.google_id,
                "github_id": user.github_id,
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating profile: {e}")
        return jsonify({"message": "Failed to update profile"}), 500

# -------- EMAIL CHANGE VERIFY --------
@profile_bp.route("/request-email-change", methods=["POST"])
@jwt_required()
def request_email_change():
    """
    Gửi OTP đến email mới khi user muốn thay đổi email trong profile
    """
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    new_email = (data.get("new_email") or "").strip().lower()
    
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Validate email format
    if not is_valid_email(new_email):
        return jsonify({"message": "Invalid email format"}), 400
    
    # Kiểm tra email đã tồn tại chưa
    if User.query.filter(db.func.lower(User.email) == new_email, User.id != user_id).first():
        return jsonify({"message": "Email already exists"}), 400
    
    # Kiểm tra cooldown (60 giây)
    if user.reset_token_expiry:
        time_since_last = datetime.utcnow() - (user.reset_token_expiry - timedelta(minutes=10))
        if time_since_last.total_seconds() < 60:
            return jsonify({
                "message": "Please wait before requesting a new code.",
                "wait_seconds": 60 - int(time_since_last.total_seconds())
            }), 429
    
    # Tạo OTP
    otp_code = generate_otp(6)
    
    # Lưu OTP và email mới tạm thời
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    user.pending_email = new_email
    
    db.session.commit()
    
    # Gửi email OTP
    email_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #2196F3; text-align: center;">Verify Your New Email</h2>
                
                <p>Hi <strong>{user.username}</strong>,</p>
                
                <p>You've requested to change your email address to <strong>{new_email}</strong>. Please verify this email using the code below:</p>
                
                <div style="background-color: #e3f2fd; border: 2px dashed #2196F3; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px;">Your verification code:</p>
                    <h1 style="margin: 10px 0; color: #2196F3; font-size: 48px; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        {otp_code}
                    </h1>
                </div>
                
                <p style="color: #f44336; font-weight: bold;">⏰ This code will expire in 10 minutes.</p>
            </div>
        </body>
    </html>
    """
    
    send_email(new_email, "Verify Your New Email Address", email_html)
    
    return jsonify({
        "message": "A verification code has been sent to your new email address.",
        "new_email": new_email,
        "requires_verification": True
    }), 200

@profile_bp.route("/verify-email-change", methods=["POST"])
@jwt_required()
def verify_email_change():
    """
    Xác nhận OTP và thay đổi email chính thức
    """
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    otp_code = data.get("otp_code", "").strip()
    
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    if not user.pending_email:
        return jsonify({"message": "No pending email change request"}), 400
    
    # Kiểm tra OTP
    if user.verification_token != otp_code:
        return jsonify({
            "message": "Invalid verification code",
            "error_type": "invalid_otp"
        }), 400
    
    # Kiểm tra hết hạn
    if not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify({
            "message": "Verification code has expired",
            "error_type": "otp_expired"
        }), 400
    
    # Xác minh thành công - Cập nhật email
    old_email = user.email
    user.email = user.pending_email
    user.pending_email = None
    user.verification_token = None
    user.reset_token_expiry = None
    user.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        "message": "Email changed successfully!",
        "new_email": user.email,
        "old_email": old_email
    }), 200