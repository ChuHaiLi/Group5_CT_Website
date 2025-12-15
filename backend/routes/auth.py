from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    jwt_required, get_jwt_identity
)
from models import db, User
from sqlalchemy.exc import IntegrityError
from datetime import timedelta, datetime
import secrets
import re
from utils.email_utils import send_email, generate_otp

auth_bp = Blueprint("auth", __name__)

DEFAULT_AVATAR = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# -------- REGISTER --------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    username_regex = re.compile(r'^[a-zA-Z0-9._-]{3,}$')

    errors = {}
    if not username_regex.match(username):
        errors["username"] = "Username can only contain letters, numbers, dots, underscores, and hyphens"
    if not is_valid_email(email):
        errors["email"] = "Invalid email"
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    if User.query.filter(db.func.lower(User.email) == email.lower()).first():
        errors["email"] = "Email already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    # Tạo OTP 6 chữ số
    otp_code = generate_otp(6)
    
    hashed_pw = generate_password_hash(password)
    new_user = User(
        username=username, 
        email=email, 
        password=hashed_pw, 
        avatar_url=DEFAULT_AVATAR,
        is_email_verified=False,
        verification_token=otp_code,
        reset_token_expiry=datetime.utcnow() + timedelta(minutes=10)
    )
    
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Database error"}), 500

    # Gửi email OTP
    email_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #4CAF50; text-align: center;">Welcome to Our App!</h2>
                
                <p>Hi <strong>{username}</strong>,</p>
                
                <p>Thank you for registering! Please verify your email using the code below:</p>
                
                <div style="background-color: #f0f8ff; border: 2px dashed #4CAF50; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px;">Your verification code:</p>
                    <h1 style="margin: 10px 0; color: #4CAF50; font-size: 48px; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        {otp_code}
                    </h1>
                </div>
                
                <p style="color: #f44336; font-weight: bold;">⏰ This code will expire in 10 minutes.</p>
                
                <p style="color: #666; font-size: 14px;">If you didn't register, please ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message, please do not reply.
                </p>
            </div>
        </body>
    </html>
    """
    
    send_email(email, "Email Verification Code", email_html)
    
    return jsonify({
        "message": "Registration successful! Please check your email for verification code.",
        "email": email,
        "requires_verification": True,
        "user": {  
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "avatar": new_user.avatar_url,
            "phone": "",
        }
    }), 201

# -------- VERIFY EMAIL --------
@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    otp_code = data.get("otp_code", "").strip()

    if not email or not otp_code:
        return jsonify({"message": "Email and verification code are required"}), 400

    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    if not user:
        return jsonify({"message": "Invalid request"}), 400
    
    if user.is_email_verified:
        return jsonify({"message": "Email already verified"}), 200
    
    # Kiểm tra OTP
    if user.verification_token != otp_code:
        return jsonify({
            "message": "Invalid verification code",
            "error_type": "invalid_otp"
        }), 400
    
    # Kiểm tra hết hạn
    if not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify({
            "message": "Verification code has expired. Please request a new one.",
            "error_type": "otp_expired"
        }), 400

    # Xác minh thành công
    user.is_email_verified = True
    user.verification_token = None
    user.reset_token_expiry = None
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    avatar = user.avatar_url or user.picture or ""
    
    return jsonify({
        "message": "Email verified successfully! Logging you in...",
        "success": True,
        "access_token": access_token,      
        "refresh_token": refresh_token,    
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone or "",
            "avatar": avatar,
        }
    }), 200

# -------- RESEND VERIFICATION --------
@auth_bp.route("/resend-verification", methods=["POST"])
def resend_verification():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    
    if not email:
        return jsonify({"message": "Email is required"}), 400
    
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    if not user:
        return jsonify({"message": "Email not found"}), 404
    
    if user.is_email_verified:
        return jsonify({"message": "Email already verified"}), 200
    
    # Kiểm tra cooldown (60 giây)
    if user.reset_token_expiry:
        time_since_last = datetime.utcnow() - (user.reset_token_expiry - timedelta(minutes=10))
        if time_since_last.total_seconds() < 60:
            return jsonify({
                "message": "Please wait before requesting a new code.",
                "wait_seconds": 60 - int(time_since_last.total_seconds())
            }), 429

    # Tạo OTP mới
    otp_code = generate_otp(6)
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    # Gửi email
    email_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #4CAF50; text-align: center;">New Verification Code</h2>
                
                <p>Hi <strong>{user.username}</strong>,</p>
                
                <p>Here is your new verification code:</p>
                
                <div style="background-color: #f0f8ff; border: 2px dashed #4CAF50; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px;">Your verification code:</p>
                    <h1 style="margin: 10px 0; color: #4CAF50; font-size: 48px; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        {otp_code}
                    </h1>
                </div>
                
                <p style="color: #f44336; font-weight: bold;">⏰ This code will expire in 10 minutes.</p>
            </div>
        </body>
    </html>
    """
    
    send_email(user.email, "New Verification Code", email_html)
    
    return jsonify({
        "message": "A new verification code has been sent to your email.",
        "success": True
    }), 200

# -------- Email change verify --------
@auth_bp.route("/request-email-change", methods=["POST"])
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
    
    # Lưu OTP và email mới tạm thời (dùng field pending_email)
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    
    # Lưu email mới vào field tạm (cần thêm column này vào DB)
    # Hoặc dùng metadata_json để lưu
    user.pending_email = new_email  # 🔥 CẦN THÊM COLUMN NÀY VÀO MODEL User
    
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
                
                <p style="color: #666; font-size: 14px;">If you didn't request this change, please ignore this email or contact support immediately.</p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message, please do not reply.
                </p>
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

    """
    Gá»­i OTP Ä‘áº¿n email má»›i khi user muá»‘n thay Ä‘á»•i email trong profile
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
    
    # Kiá»ƒm tra email Ä‘Ã£ tá»“n táº¡i chÆ°a
    if User.query.filter(db.func.lower(User.email) == new_email, User.id != user_id).first():
        return jsonify({"message": "Email already exists"}), 400
    
    # Kiá»ƒm tra cooldown (60 giÃ¢y)
    if user.reset_token_expiry:
        time_since_last = datetime.utcnow() - (user.reset_token_expiry - timedelta(minutes=10))
        if time_since_last.total_seconds() < 60:
            return jsonify({
                "message": "Please wait before requesting a new code.",
                "wait_seconds": 60 - int(time_since_last.total_seconds())
            }), 429
    
    # Táº¡o OTP
    otp_code = generate_otp(6)
    
    # LÆ°u OTP vÃ  email má»›i táº¡m thá»i (dÃ¹ng field pending_email)
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    
    # LÆ°u email má»›i vÃ o field táº¡m (cáº§n thÃªm column nÃ y vÃ o DB)
    # Hoáº·c dÃ¹ng metadata_json Ä‘á»ƒ lÆ°u
    user.pending_email = new_email  # ðŸ”¥ Cáº¦N THÃŠM COLUMN NÃ€Y VÃ€O MODEL User
    
    db.session.commit()
    
    # Gá»­i email OTP
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
                
                <p style="color: #f44336; font-weight: bold;">â° This code will expire in 10 minutes.</p>
                
                <p style="color: #666; font-size: 14px;">If you didn't request this change, please ignore this email or contact support immediately.</p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message, please do not reply.
                </p>
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


@auth_bp.route("/verify-email-change", methods=["POST"])
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
    """
    XÃ¡c nháº­n OTP vÃ  thay Ä‘á»•i email chÃ­nh thá»©c
    """
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    otp_code = data.get("otp_code", "").strip()
    
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    if not user.pending_email:
        return jsonify({"message": "No pending email change request"}), 400
    
    # Kiá»ƒm tra OTP
    if user.verification_token != otp_code:
        return jsonify({
            "message": "Invalid verification code",
            "error_type": "invalid_otp"
        }), 400
    
    # Kiá»ƒm tra háº¿t háº¡n
    if not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify({
            "message": "Verification code has expired",
            "error_type": "otp_expired"
        }), 400
    
    # XÃ¡c minh thÃ nh cÃ´ng - Cáº­p nháº­t email
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

# -------- LOGIN --------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email_or_username = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter(
        db.or_(
            db.func.lower(User.email) == email_or_username,
            db.func.lower(User.username) == email_or_username
        )
    ).first()
    
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    # Kiểm tra email đã verify chưa
    if not user.is_email_verified:
        # Tạo OTP mới và gửi email ngay
        otp_code = generate_otp(6)
        user.verification_token = otp_code
        user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
        db.session.commit()
        
        email_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #4CAF50; text-align: center;">Email Verification Required</h2>
                    
                    <p>Hi <strong>{user.username}</strong>,</p>
                    
                    <p>You need to verify your email before logging in. Here is your verification code:</p>
                    
                    <div style="background-color: #f0f8ff; border: 2px dashed #4CAF50; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <p style="margin: 0; color: #666; font-size: 14px;">Your verification code:</p>
                        <h1 style="margin: 10px 0; color: #4CAF50; font-size: 48px; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            {otp_code}
                        </h1>
                    </div>
                    
                    <p style="color: #f44336; font-weight: bold;">⏰ This code will expire in 10 minutes.</p>
                </div>
            </body>
        </html>
        """
        
        send_email(user.email, "Email Verification Code", email_html)
        
        return jsonify({
            "message": "Please verify your email before logging in. A verification code has been sent to your email.",
            "error_type": "email_not_verified",
            "email": user.email,
            "otp_sent": True
        }), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    avatar = user.avatar_url or user.picture or DEFAULT_AVATAR

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone or "",
            "avatar": avatar,
        }
    }), 200

# -------- REFRESH TOKEN --------
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))
    return jsonify({"access_token": access_token}), 200

# -------- GET CURRENT USER --------
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    avatar = user.avatar_url or user.picture or DEFAULT_AVATAR
    
    return jsonify({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone or "",
        "name": user.name or "",
        "tagline": user.tagline or "#VN",
        "avatar": avatar,
        "google_id": user.google_id,
        "github_id": user.github_id,
    }), 200

# -------- FORGOT PASSWORD --------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    if not user:
        return jsonify({"message": "If your email exists, an OTP has been sent"}), 200

    # Tạo OTP 6 số
    otp_code = generate_otp(6)
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    email_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #FF5722; text-align: center;">Password Reset Code</h2>
            
            <p>Hello <strong>{user.username}</strong>,</p>
            
            <p>We received a request to reset the password for your account. Here is your verification code:</p>
            
            <div style="background-color: #fff3e0; border: 2px dashed #FF5722; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0; color: #666; font-size: 14px;">Your verification code:</p>
                <h1 style="margin: 10px 0; color: #FF5722; font-size: 48px; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                    {otp_code}
                </h1>
            </div>
            
            <p style="color: #d32f2f; font-weight: bold;">This code will expire in <strong>10 minutes</strong>.</p>
            
            <p>If you <strong>did not request</strong> a password reset, please ignore this email.</p>
        </div>
    </body>
    </html>
    """

    send_email(user.email, "Password Reset Code", email_html)

    return jsonify({
        "message": "An OTP has been sent to your email.",
        "email": email,
        "requires_verification": True
    }), 200

# -------- VERIFY OTP --------
@auth_bp.route("/verify-otp", methods=["POST"])
def verify_reset_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    otp_code = data.get("otp_code", "").strip()

    if not email or not otp_code:
        return jsonify({"message": "Email and OTP are required"}), 400

    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    if not user:
        return jsonify({"message": "Invalid request"}), 400

    if user.verification_token != otp_code:
        return jsonify({"message": "Invalid OTP code", "error_type": "invalid_otp"}), 400

    if user.reset_token_expiry <= datetime.utcnow():
        return jsonify({"message": "OTP has expired", "error_type": "otp_expired"}), 400

    # Tạo reset token
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    user.verification_token = None
    db.session.commit()

    return jsonify({
        "message": "OTP verified successfully",
        "reset_token": reset_token
    }), 200

# -------- RESET PASSWORD --------
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    reset_token = data.get("reset_token")
    new_password = data.get("new_password") or data.get("password")

    if not reset_token or not new_password:
        return jsonify({"message": "Token and new password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    user = User.query.filter_by(reset_token=reset_token).first()
    if not user:
        return jsonify({"message": "Invalid or expired token"}), 400

    if user.reset_token_expiry <= datetime.utcnow():
        return jsonify({"message": "Token has expired"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully. You can now log in."}), 200