from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import db, User
from sqlalchemy.exc import IntegrityError
import re
from datetime import timedelta, datetime
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

auth_bp = Blueprint("auth", __name__)

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# -------- EMAIL FUNCTION --------
def send_email(to_email, subject, html_content):
    """
    Gửi email qua Gmail SMTP
    Cần cấu hình trong .env:
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASSWORD=your-app-password
    """
    try:
        # Lấy thông tin từ environment variables
        email_user = os.getenv("EMAIL_USER")
        email_password = os.getenv("EMAIL_PASSWORD")
        
        if not email_user or not email_password:
            print("⚠️ WARNING: EMAIL_USER or EMAIL_PASSWORD not configured")
            print(f"📧 Email would be sent to: {to_email}")
            print(f"📧 Subject: {subject}")
            print(f"📧 Content: {html_content}")
            return True  # Trong dev mode, return True để không block
        
        # Tạo message
        msg = MIMEMultipart('alternative')
        msg['From'] = email_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Gửi email qua Gmail SMTP
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_user, email_password)
            server.send_message(msg)
        
        print(f"✅ Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        # Trong production nên raise error, nhưng trong dev có thể return True
        return False

# -------- REGISTER --------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()  # Convert to lowercase
    password = data.get("password") or ""

    errors = {}
    if len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    if not is_valid_email(email):
        errors["email"] = "Invalid email"
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    # Check case-insensitive email
    if User.query.filter(db.func.lower(User.email) == email.lower()).first():
        errors["email"] = "Email already exists"
    if User.query.filter_by(username=username).first():
        errors["username"] = "Username already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    hashed_pw = generate_password_hash(password)
    
    # Tạo verification token
    verification_token = secrets.token_urlsafe(32)
    
    # TẠM THỜI: Set is_email_verified=True để dev dễ hơn
    # Trong production nên set False và require verify
    new_user = User(
        username=username, 
        email=email, 
        password=hashed_pw, 
        is_email_verified=True,  # ← Đổi thành True tạm thời cho dev
        verification_token=verification_token
    )
    
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Database error"}), 500

    # Gửi verification email (optional trong dev)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    verify_url = f"{frontend_url}/verify-email?token={verification_token}"
    
    email_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Welcome to Our App!</h2>
            <p>Hi {username},</p>
            <p>Thank you for registering. Please verify your email by clicking the link below:</p>
            <p><a href="{verify_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
            <p>Or copy this link: {verify_url}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't register, please ignore this email.</p>
        </body>
    </html>
    """
    
    # Gửi email (không block nếu fail)
    send_email(email, "Verify Your Email", email_html)
    
    return jsonify({"message": "User registered successfully. You can now login."}), 201

# -------- LOGIN --------
@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data required"}), 400

        google_id = data.get("google_id")
        email = data.get("email")
        name = data.get("name")
        picture = data.get("picture")

        if not google_id or not email:
            return jsonify({"message": "google_id and email are required"}), 400

        # Tìm user theo email (Google user có thể đã đăng ký bằng email thường trước đó)
        user = User.query.filter_by(email=email).first()

        if user:
            # Đã có tài khoản → chỉ cần cập nhật google_id nếu chưa có
            if not user.google_id:
                user.google_id = google_id
                user.picture = picture or user.picture
                if name and not user.name:
                    user.name = name
                db.session.commit()

            # Tạo token như bình thường
            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)

            return jsonify({
                "message": "Login with Google successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": user.to_dict()
            }), 200

        else:
            # Chưa có tài khoản → Tạo mới tự động
            username = email.split("@")[0] + str(secrets.token_hex(3))  # tránh trùng username
            while User.query.filter_by(username=username).first():
                username = email.split("@")[0] + str(secrets.token_hex(4))

            new_user = User(
                username=username,
                email=email,
                google_id=google_id,
                name=name,
                picture=picture,
                password=generate_password_hash(secrets.token_hex(16)),  # password ngẫu nhiên
                is_email_verified=True  # Google đã verify email rồi
            )

            db.session.add(new_user)
            db.session.commit()

            access_token = create_access_token(identity=new_user.id)
            refresh_token = create_refresh_token(identity=new_user.id)

            return jsonify({
                "message": "Registered and logged in with Google",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": new_user.to_dict()
            }), 201

    except Exception as e:
        db.session.rollback()
        print("Google login error:", str(e))
        return jsonify({"message": "Google login failed", "error": str(e)}), 500
    
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()  # Convert to lowercase
    password = data.get("password") or ""

    # Case-insensitive email search
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    # TẠM THỜI: Comment out email verification check cho dev
    # if not user.is_email_verified:
    #     return jsonify({"message": "Email not verified"}), 403

    access_token = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(identity=user.id, expires_delta=timedelta(days=7))

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
    }), 200

# -------- REFRESH TOKEN --------
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    new_token = create_access_token(identity=user_id, expires_delta=timedelta(hours=1))
    return jsonify({"access_token": new_token})

# -------- GET CURRENT USER --------
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email}), 200

# -------- FORGOT PASSWORD --------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()  # Convert to lowercase
    
    # Case-insensitive email search
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    # Security: Không tiết lộ email có tồn tại hay không
    # Luôn trả về success message
    if not user:
        print(f"⚠️ Forgot password: Email not found - {email}")
        # Vẫn trả về success để tránh user enumeration
        return jsonify({"message": "If your email exists, a reset link has been sent"}), 200

    # Tạo reset token và expiry time
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)  # Token hết hạn sau 1 giờ
    db.session.commit()

    # Tạo reset URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_url = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Tạo email HTML
    email_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hi {user.username},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <p><a href="{reset_url}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
            <p>Or copy this link: {reset_url}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        </body>
    </html>
    """
    
    # Gửi email
    send_email(user.email, "Password Reset Request", email_html)
    
    return jsonify({"message": "If your email exists, a reset link has been sent"}), 200

# -------- RESET PASSWORD --------
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        return jsonify({"message": "Token and password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    # Tìm user với token và check expiry
    user = User.query.filter_by(reset_token=token).first()
    
    if not user:
        return jsonify({"message": "Invalid or expired token"}), 400
    
    # Check token expiry nếu có field reset_token_expiry
    if hasattr(user, 'reset_token_expiry') and user.reset_token_expiry:
        if user.reset_token_expiry < datetime.utcnow():
            return jsonify({"message": "Token has expired. Please request a new one."}), 400

    # Update password
    user.password = generate_password_hash(new_password)
    user.reset_token = None
    if hasattr(user, 'reset_token_expiry'):
        user.reset_token_expiry = None
    
    db.session.commit()
    
    return jsonify({"message": "Password reset successful. You can now login with your new password."}), 200

# -------- VERIFY EMAIL (Optional) --------
@auth_bp.route("/verify-email", methods=["GET"])
def verify_email():
    token = request.args.get("token")
    
    if not token:
        return jsonify({"message": "Token is required"}), 400
    
    user = User.query.filter_by(verification_token=token).first()
    
    if not user:
        return jsonify({"message": "Invalid verification token"}), 400
    
    if user.is_email_verified:
        return jsonify({"message": "Email already verified"}), 200
    
    user.is_email_verified = True
    user.verification_token = None
    db.session.commit()
    
    return jsonify({"message": "Email verified successfully! You can now login."}), 200