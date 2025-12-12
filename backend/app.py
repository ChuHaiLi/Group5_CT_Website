from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
from datetime import timedelta
import re
import secrets
import os
from models import db, User, Destination, SavedDestination, Review, Itinerary, Region, Province, DestinationImage
from routes.chat import chat_bp
from routes.search import search_bp
from utils.env_loader import load_backend_env
import json
from sqlalchemy.orm import joinedload
from flask_migrate import Migrate
import random
from flask import request, jsonify
from unidecode import unidecode
from routes.auth import auth_bp

from dotenv import load_dotenv
import smtplib  
import random
import string
from datetime import datetime, timedelta
from email.mime.text import MIMEText  
from email.mime.multipart import MIMEMultipart  
import math
load_backend_env()
load_dotenv()

# CẤU HÌNH RANDOM THEO VÙNG (Copy từ seed.py)
REGION_CONFIG = {
    "Miền Bắc": {"temp_min": 15, "temp_max": 35, "weather_types": ["Sunny", "Cloudy", "Rainy"]},
    "Miền Trung": {"temp_min": 27, "temp_max": 39, "weather_types": ["Sunny", "Hot", "Clear"]},
    "Miền Nam": {"temp_min": 25, "temp_max": 36, "weather_types": ["Sunny", "Hot", "Cloudy", "Rainy"]},
}

# ----------------- App & Config -----------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_super_secret_key'

# Cấu hình để hiển thị tiếng Việt chính xác
app.config['JSON_AS_ASCII'] = False 
app.config['JSON_SORT_KEYS'] = False

# Token expiration
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['JWT_HEADER_NAME'] = "Authorization"
app.config['JWT_HEADER_TYPE'] = "Bearer"

db.init_app(app)
jwt = JWTManager(app)
migrate = Migrate(app, db)

# Register blueprints
app.register_blueprint(chat_bp, url_prefix="/api/chat")
app.register_blueprint(search_bp, url_prefix="/api/search")

# ----------------- JWT Error Handler -----------------
@jwt.unauthorized_loader
def unauthorized_callback(reason):
    print("Unauthorized:", reason, request.headers)
    return jsonify({"message": "Token is missing or invalid. Please log in."}), 401

@jwt.invalid_token_loader
def invalid_token_callback(reason):
    print("Invalid token:", reason)
    return jsonify({"message": f"Invalid token: {reason}"}), 401

# ----------------- Utils -----------------
def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

def generate_random_weather(region_name):
    config = REGION_CONFIG.get(region_name, REGION_CONFIG["Miền Nam"])
    temp = random.randint(config["temp_min"], config["temp_max"])
    weather_type = random.choice(config["weather_types"])
    return f"{weather_type} {temp}°C"


# Hàm tiện ích để giải mã JSON string từ DB thành List Python
def decode_db_json_string(data_string, default_type='list'):
    if not data_string:
        return [] if default_type == 'list' else None
    try:
        return json.loads(data_string)
    except (json.JSONDecodeError, TypeError):
        return [data_string] if default_type == 'list' else data_string

def get_province_name_by_id(province_id):
    province = db.session.get(Province, province_id)
    return province.name if province else "Can't find..."

# HÀM MỚI: Xử lý ưu tiên URL ảnh cho RecommendCard
def get_card_image_url(destination):
    """
    Ưu tiên lấy URL ảnh: 
    1. image_url chính (cột đơn). 
    2. DUYỆT qua danh sách DestinationImage cho đến khi tìm thấy URL hợp lệ.
    """
    # 1. Kiểm tra cột image_url chính
    if destination.image_url:
        source_url = destination.image_url
        if source_url and (source_url.startswith('http://') or source_url.startswith('https://')):
            return source_url # URL mạng
        else:
            # Đường dẫn cục bộ (ví dụ: halong.png)
            image_filename = source_url.split("/")[-1]
            return request.host_url.rstrip('/') + url_for('static', filename=f'images/{image_filename}')

    # 2. Duyệt qua danh sách DestinationImage (ảnh mạng)
    # Nếu ảnh chính NULL, ta duyệt qua các ảnh chi tiết
    elif destination.images: 
        for image_obj in destination.images:
            url = image_obj.image_url
            if url and (url.startswith('http://') or url.startswith('https://')):
                # Trả về URL mạng đầu tiên hợp lệ tìm thấy
                return url
        
    return None # Trả về None nếu không có ảnh nào hợp lệ tìm thấy

# ----------------- Routes -----------------

# -------- EMAIL FUNCTION --------
def send_email(to_email, subject, html_content):
    """
    Gửi email qua Gmail SMTP
    Cần cấu hình trong .env:
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASSWORD=your-app-password
    """
    try:
        email_user = os.getenv("EMAIL_USER")
        email_password = os.getenv("EMAIL_PASSWORD")
        
        if not email_user or not email_password:
            print("⚠️  WARNING: EMAIL_USER or EMAIL_PASSWORD not configured")
            print(f"📧 Email would be sent to: {to_email}")
            print(f"📧 Subject: {subject}")
            print(f"📧 Content preview: {html_content[:200]}...")
            return True
        
        msg = MIMEMultipart('alternative')
        msg['From'] = email_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_user, email_password)
            server.send_message(msg)
        
        print(f"✅ Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        return False

def generate_otp(length=6):
    """Tạo mã OTP ngẫu nhiên gồm 6 chữ số"""
    return ''.join(random.choices(string.digits, k=length))

# -------- REGISTER --------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    errors = {}
    if len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    if not is_valid_email(email):
        errors["email"] = "Invalid email"
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    if User.query.filter(db.func.lower(User.email) == email.lower()).first():
        errors["email"] = "Email already exists"
    if User.query.filter_by(username=username).first():
        errors["username"] = "Username already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    # Tạo OTP 6 chữ số
    otp_code = generate_otp(6)
    
    hashed_pw = generate_password_hash(password)
    new_user = User(
        username=username, 
        email=email, 
        password=hashed_pw, 
        is_email_verified=False,  # Chưa verify
        verification_token=otp_code,  # Lưu OTP vào verification_token
        reset_token_expiry=datetime.utcnow() + timedelta(minutes=10)  # OTP hết hạn sau 10 phút
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
        "requires_verification": True
    }), 201

@app.route("/api/auth/verify-email", methods=["POST"])
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
    
    # Lấy avatar
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

@app.route("/api/auth/resend-verification", methods=["POST"])
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


# -------- LOGIN --------
@app.route("/api/auth/google-login", methods=["POST"])
def google_login():
    """
    Xử lý đăng nhập/đăng ký qua Google OAuth
    Frontend sẽ gửi thông tin user từ Google
    """
    try:
        data = request.get_json()
        
        google_id = data.get('google_id')
        email = data.get('email')
        name = data.get('name')
        picture = data.get('picture')
        
        # Validate dữ liệu
        if not google_id or not email:
            return jsonify({
                'error': 'Missing required fields',
                'message': 'Google ID and email are required'
            }), 400
        
        # Kiểm tra xem user đã tồn tại chưa (theo email hoặc google_id)
        user = User.query.filter(
            db.or_(
                User.email == email.lower(),
                User.google_id == google_id
            )
        ).first()
        
        if user:
            # ✅ User đã tồn tại - Cập nhật thông tin Google nếu chưa có
            if not user.google_id:
                user.google_id = google_id
                user.name = name
                user.picture = picture
                user.avatar_url = picture  # 🔥 SỬA: Đồng bộ avatar_url với picture
                user.is_email_verified = True
                db.session.commit()
            elif picture and picture != user.picture:
                # 🔥 THÊM: Cập nhật cả 2 field nếu ảnh Google thay đổi
                user.picture = picture
                user.avatar_url = picture
                db.session.commit()
            
            # Lấy avatar (ưu tiên avatar_url, fallback sang picture)
            avatar = user.avatar_url or user.picture or ""
            
            # Tạo token
            access_token = create_access_token(identity=str(user.id))
            refresh_token = create_refresh_token(identity=str(user.id))
            
            return jsonify({
                'message': 'Login successful',
                'access_token': access_token,
                'refresh_token': refresh_token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'name': user.name,
                    'phone': user.phone or "",
                    'picture': user.picture,
                    'avatar': avatar,  # 🔥 SỬA: Trả về avatar đúng
                    'is_verified': True
                }
            }), 200
        
        else:
            # ✅ User chưa tồn tại - Tạo tài khoản mới
            
            # Tạo username từ email hoặc name
            base_username = email.split('@')[0]
            username = base_username
            
            # Đảm bảo username unique
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{base_username}{counter}"
                counter += 1
            
            # Tạo user mới
            new_user = User(
                username=username,
                email=email.lower(),
                name=name,
                google_id=google_id,
                picture=picture,
                avatar_url=picture,  # 🔥 SỬA: Lưu cả avatar_url
                password=generate_password_hash(secrets.token_urlsafe(32)),
                is_email_verified=True,
            )
            
            db.session.add(new_user)
            db.session.commit()
            
            # Tạo token
            access_token = create_access_token(identity=str(new_user.id))
            refresh_token = create_refresh_token(identity=str(new_user.id))
            
            return jsonify({
                'message': 'Account created successfully',
                'access_token': access_token,
                'refresh_token': refresh_token,
                'user': {
                    'id': new_user.id,
                    'username': new_user.username,
                    'email': new_user.email,
                    'name': new_user.name,
                    'phone': new_user.phone or "",
                    'picture': new_user.picture,
                    'avatar': picture,  
                    'is_verified': True
                }
            }), 201
    
    except Exception as e:
        print(f"Google login error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500
    
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    # QUAN TRỌNG: Kiểm tra email đã verify chưa
    if not user.is_email_verified:
        return jsonify({
            "message": "Please verify your email before logging in.",
            "error_type": "email_not_verified",
            "email": user.email
        }), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
    "message": "Login successful",
    "access_token": access_token,
    "refresh_token": refresh_token,
    "user": {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone or "",
        "avatar": user.avatar_url or user.picture or "", 
    }
}), 200

# -------- REFRESH TOKEN --------
@app.route("/api/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))
    return jsonify({"access_token": access_token}), 200

# -------- GET CURRENT USER --------
@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id) 
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Ưu tiên avatar_url, fallback sang picture
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

# -------- FORGOT PASSWORD --------
@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()  # Convert to lowercase
    
    # Case-insensitive email search
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    
    # Security: Không tiết lộ email có tồn tại hay không
    if not user:
        return jsonify({"message": "If your email exists, an OTP has been sent"}), 200

    # Tạo OTP 6 số
    otp_code = generate_otp(6)
    user.verification_token = otp_code
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    # Gửi email OTP
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
            
            <p>If you <strong>did not request</strong> a password reset, please ignore this email — your password will remain unchanged.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 40px 0 20px;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
                This is an automated message, please do not reply to this email.
            </p>
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

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_reset_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    otp_code = data.get("otp_code", "").strip()

    if not email or not otp_code:
        return jsonify({"message": "Email and OTP are required"}), 400

    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    if not user:
        return jsonify({"message": "Invalid request"}), 400

    # Kiểm tra OTP
    if user.verification_token != otp_code:
        return jsonify({"message": "Invalid OTP code", "error_type": "invalid_otp"}), 400

    # Kiểm tra hết hạn
    if user.reset_token_expiry <= datetime.utcnow():
        return jsonify({"message": "OTP has expired", "error_type": "otp_expired"}), 400

    # OTP đúng → Tạo reset token thật sự
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    user.verification_token = None  # Xóa OTP
    db.session.commit()

    return jsonify({
        "message": "OTP verified successfully",
        "reset_token": reset_token
    }), 200

# -------- RESET PASSWORD --------
@app.route("/api/auth/reset-password", methods=["POST"])
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

    # Cập nhật mật khẩu
    user.password = generate_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully. You can now log in."}), 200

# -------- PROFILE MANAGEMENT --------
@app.route("/api/profile", methods=["GET"])
@jwt_required()
def get_profile():
    """Lấy thông tin profile của user hiện tại"""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Ưu tiên avatar_url, fallback sang picture (Google)
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

@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Cập nhật thông tin profile - CHỈ VALIDATE FIELDS ĐƯỢC GỬI LÊN"""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    data = request.get_json() or {}
    
    # Validation errors
    errors = {}
    profile_changed = False
    
    # 🔥 QUAN TRỌNG: Chỉ validate field NÀO được gửi lên
    fields_to_update = set(data.keys())
    
    # 1. Cập nhật Username (chỉ validate nếu có trong request)
    if "username" in fields_to_update:
        new_username = data.get("username", "").strip()
        if new_username != user.username:
            if len(new_username) < 3:
                errors["username"] = "Username must be at least 3 characters"
            elif User.query.filter(User.username == new_username, User.id != user_id).first():
                errors["username"] = "Username already exists"
            else:
                user.username = new_username
                profile_changed = True
    
    # 2. Cập nhật Tagline (chỉ validate nếu có trong request)
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

    # 3. Cập nhật Email (CHỈ validate nếu có trong request)
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
    
    # 4. Cập nhật Phone (chỉ nếu có trong request)
    if "phone" in fields_to_update:
        new_phone = data.get("phone", "").strip()
        if new_phone != (user.phone or ""):
            user.phone = new_phone if new_phone else None
            profile_changed = True
    
    # 5. CẬP NHẬT PASSWORD (chỉ nếu có currentPassword và newPassword)
    if "currentPassword" in fields_to_update and "newPassword" in fields_to_update:
        current_password = data.get("currentPassword", "").strip()
        new_password = data.get("newPassword", "").strip()
        
        if new_password:
            if not current_password:
                errors["currentPassword"] = "Current password is required to change password"
            else:
                if not check_password_hash(user.password, current_password):
                    errors["currentPassword"] = "Current password is incorrect"
                else:
                    if len(new_password) < 6:
                        errors["newPassword"] = "New password must be at least 6 characters"
                    else:
                        user.password = generate_password_hash(new_password)
                        profile_changed = True
    
    # 6. Cập nhật Avatar URL (chỉ nếu có trong request)
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
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating profile: {e}")
        return jsonify({"message": "Failed to update profile"}), 500

# -------- Email change verify --------
@app.route("/api/auth/request-email-change", methods=["POST"])
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


@app.route("/api/auth/verify-email-change", methods=["POST"])
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

# -------- SAVED DESTINATIONS --------
@app.route("/api/saved/add", methods=["POST"])
@jwt_required()
def save_destination():
    data = request.get_json() or {}
    destination_id = data.get("destination_id")
    user_id = int(get_jwt_identity())

    if not destination_id:
        return jsonify({"message": "Destination ID required"}), 400

    exists = SavedDestination.query.filter_by(
        user_id=user_id,
        destination_id=destination_id
    ).first()

    if exists:
        return jsonify({"message": "Already saved"}), 200

    new_save = SavedDestination(user_id=user_id, destination_id=destination_id)
    db.session.add(new_save)
    db.session.commit()
    return jsonify({"message": "Saved successfully"}), 201

@app.route("/api/saved/remove", methods=["DELETE"])
@jwt_required()
def remove_saved():
    data = request.get_json() or {}
    destination_id = data.get("destination_id")
    user_id = int(get_jwt_identity())

    saved = SavedDestination.query.filter_by(
        user_id=user_id,
        destination_id=destination_id
    ).first()

    if not saved:
        return jsonify({"message": "Not in saved list"}), 404

    db.session.delete(saved)
    db.session.commit()
    return jsonify({"message": "Removed from saved list"}), 200

@app.route("/api/saved/list", methods=["GET"])
@jwt_required()
def get_saved_list():
    user_id = int(get_jwt_identity())
    saved_items = SavedDestination.query.filter_by(user_id=user_id).all()
    result = []

    for item in saved_items:
        # Eager load ảnh và sửa cú pháp SQLAlchemy 2.0
        destination = db.session.get(Destination, item.destination_id, options=[db.joinedload(Destination.images), db.joinedload(Destination.province).joinedload(Province.region)])
        
        if destination:
            province = destination.province
            region = province.region if province else None
            region_name = region.name if region else "Miền Nam" # Default cho weather
            
            image_full_url = get_card_image_url(destination)

            result.append({
                "id": destination.id,
                "name": destination.name,
                "province_name": province.name if province else None,
                "region_name": region_name,
                "image_url": image_full_url, 
                "description": decode_db_json_string(destination.description),
                "latitude": destination.latitude,
                "longitude": destination.longitude,
                # SỬA LỖI: Lấy Rating từ DB
                "rating": destination.rating or 0,
                "category": destination.category,
                "tags": decode_db_json_string(destination.tags, default_type='text'),
                # SỬA LỖI: Tạo Weather ngẫu nhiên
                "weather": generate_random_weather(region_name),
                
                # 🔥 THÊM: Thông tin chi tiết cho Modal
                "images": [img.image_url for img in destination.images],  # Danh sách ảnh
                "type": destination.place_type,                           # Loại địa điểm
                "place_type": destination.place_type,                     # Alias cho type
                "opening_hours": destination.opening_hours,               # Giờ mở cửa
                "entry_fee": destination.entry_fee,                       # Giá vé
                "source": destination.source,   
            })
    return jsonify(result), 200

# -------- GET ALL DESTINATIONS --------
@app.route("/api/destinations", methods=["GET"])
def get_destinations():
    # Lấy các tham số từ query string
    search_term = request.args.get("search", "").strip()
    tags_string = request.args.get("tags")

    # Bắt đầu truy vấn
    query = Destination.query.options(
        db.joinedload(Destination.images), 
        db.joinedload(Destination.province).joinedload(Province.region)
    )

    # 1. Lọc theo Search Term (Tên địa điểm HOẶC Tên tỉnh)
    if search_term:
        # BƯỚC 1: Chuẩn hóa chuỗi tìm kiếm từ client trong Python
        # Ví dụ: "Ha Noi" -> unidecode('Ha Noi').lower() -> "ha noi"
        normalized_search = unidecode(search_term).lower()
        search_pattern = f"%{normalized_search}%"
        
        query = query.filter(
            db.or_(
                # 1. So sánh với cột tên Địa điểm không dấu (name_unaccented)
                Destination.name_unaccented.ilike(search_pattern),
                
                # 2. So sánh tên Tỉnh không dấu (Province.name_unaccented)
                Destination.province.has(
                    Province.name_unaccented.ilike(search_pattern)
                )
            )
        )
    
    # 2. Lọc theo Tags (Filter - Giữ nguyên logic cũ)
    if tags_string:
        required_tags = tags_string.split(',')
        
        # Áp dụng bộ lọc cho TẤT CẢ các tag yêu cầu
        for tag in required_tags:
            # Giả định cột 'tags' là chuỗi JSON hoặc có thể dùng LIKE để tìm kiếm chuỗi con
            query = query.filter(Destination.tags.ilike(f'%"{tag.strip()}"%')) 
    
    # Thực thi truy vấn đã được lọc
    destinations = query.all()
    
    result = []
    for dest in destinations:
        province = dest.province
        region = province.region if province else None
        region_name = region.name if region else "Miền Nam" 
        
        image_full_url = get_card_image_url(dest)
            
        result.append({
            "id": dest.id,
            "name": dest.name,
            "province_name": province.name if province else None,
            "region_name": region_name, 
            "description": decode_db_json_string(dest.description),
            "image_url": image_full_url, 
            "latitude": dest.latitude,
            "longitude": dest.longitude,
            "rating": dest.rating or 0,
            "category": dest.category,
            "tags": decode_db_json_string(dest.tags, default_type='text'),
            "weather": generate_random_weather(region_name),
            
            #TAO CẤM THẰNG NÀO XOÁ CỦA TAOOOOOO!!!!!!!!
            "gps": {
                "lat": dest.latitude,
                "lng": dest.longitude
            } if dest.latitude and dest.longitude else None,    
            "images": [img.image_url for img in dest.images],
            "type": dest.place_type,
            "place_type": dest.place_type,
            "opening_hours": dest.opening_hours,
            "entry_fee": dest.entry_fee,
            "source": dest.source
            
        })
    return jsonify(result), 200

# -------- TEST JWT --------
@app.route("/api/test", methods=["GET"])
@jwt_required()
def test_jwt():
    user_id = int(get_jwt_identity())
    return jsonify({"message": "JWT valid!", "user_id": user_id})

# -------- GET HIERARCHICAL DESTINATIONS --------
@app.route("/api/locations/vietnam", methods=["GET"])
def get_vietnam_locations():
    regions = Region.query.options(
        joinedload(Region.provinces)
          .joinedload(Province.destinations)
          .joinedload(Destination.images)
    ).all()
    
    result = []
    
    for region in regions:
        region_data = {
            "region_name": region.name,
            "provinces": []
        }
        
        for province in region.provinces:
            province_data = {
                "id": province.id,
                "province_name": province.name,
                "overview": province.overview,
                "image_url": province.image_url, 
                "places": []
            }
            
            for destination in province.destinations:
                
                place_data = {
                    "id": destination.id,
                    "name": destination.name,
                    "type": destination.place_type,
                    "description": decode_db_json_string(destination.description),
                    
                    "images": [img.image_url for img in destination.images],
                    "gps": {
                        "lat": destination.latitude,
                        "lng": destination.longitude
                    },
                    "opening_hours": destination.opening_hours,
                    "entry_fee": destination.entry_fee,
                    "tags": decode_db_json_string(destination.tags, default_type='text'),
                    "source": destination.source
                }
                province_data["places"].append(place_data)
                
            region_data["provinces"].append(province_data)
        
        result.append(region_data)
        
    return jsonify(result), 200

def simple_distance(lat1, lon1, lat2, lon2):
    """Tính khoảng cách đơn giản (Euclidean) giữa hai điểm tọa độ."""
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2)
def get_place_duration(destination_obj):
    """
    Lấy thời lượng tham quan từ trường DB estimated_duration_hours, nếu NULL/0 thì dùng fallback logic.
    """
    db_duration = getattr(destination_obj, 'estimated_duration_hours', None)
    
    if db_duration is not None:
        try:
            duration = float(db_duration)
            if duration > 0:
                return duration 
        except (ValueError, TypeError):
            pass 

    category = getattr(destination_obj, 'category', 'City')
    
    if category in ['Nature', 'Cultural']:
        return 3.0
    if category in ['City', 'Entertainment']:
        return 2.0
    
    return 2.0 
# -------------------------------------------------------------
# LOGIC LỘ TRÌNH TỰ ĐỘNG (TỐI ƯU HÓA DỰA TRÊN THỜI LƯỢNG MỚI)
# -------------------------------------------------------------

def generate_itinerary_optimized(province_id, duration_days, must_include_place_ids=None):
    if must_include_place_ids is None:
        must_include_place_ids = []
        
    excluded_ids = set(must_include_place_ids)
    
    MAX_HOURS_PER_DAY = 9.0        
    TRAVEL_BUFFER_HOURS = 0.5    
    MAX_PLACES_LIMIT = 4    
    MAX_TOTAL_PLACES_SELECTION = duration_days * MAX_PLACES_LIMIT
    
    # -----------------------------------------------------------------
    # BƯỚC 1: TRUY VẤN VÀ CHỌN LỌC ĐỊA ĐIỂM 
    # -----------------------------------------------------------------
    
    # Lấy các điểm bắt buộc (Priority 1)
    must_include_places = []
    for place_id in must_include_place_ids:
        place = db.session.get(Destination, place_id)
        if place:
            must_include_places.append(place)
            
    # Lấy các điểm còn lại (Priority 2)
    places_in_province = Destination.query.filter(
        Destination.province_id == province_id,
        Destination.id.notin_(excluded_ids)
    ).all()
        
    remaining_places_sorted = sorted(
        places_in_province, 
        key=lambda p: p.rating or 0, 
        reverse=True
    )
    
    # Chọn lọc số lượng điểm còn lại cần thiết
    num_to_select = MAX_TOTAL_PLACES_SELECTION - len(must_include_places)
    selected_remaining_places = remaining_places_sorted[:max(0, num_to_select)]

    # CHUYỂN ĐỔI sang định dạng DICT (giữ nguyên logic ban đầu)
    
    places_to_assign = []
    must_include_dicts = []
    
    for p in must_include_places + selected_remaining_places: 
        raw_lat = getattr(p, 'latitude', None)
        raw_lon = getattr(p, 'longitude', None)
        
        lat = float(raw_lat) if raw_lat is not None else 0.0
        lon = float(raw_lon) if raw_lon is not None else 0.0
        
        place_dict = {
            "id": p.id, 
            "name": p.name, 
            "category": p.category, 
            "lat": lat,
            "lon": lon, 
            "assigned": False,
            "duration_hours": get_place_duration(p) 
        }
        
        if p.id in excluded_ids:
            must_include_dicts.append(place_dict)
        else:
            places_to_assign.append(place_dict)
            
    # Xáo trộn các điểm tự chọn để tăng tính đa dạng (giữ nguyên)
    random.shuffle(places_to_assign) 
    
    # -----------------------------------------------------------------
    # BƯỚC 2: PHÂN BỔ ĐIỂM VÀ TỐI ƯU HÓA VỊ TRÍ 
    # -----------------------------------------------------------------
    itinerary_draft = [{"day": day, "places": []} for day in range(1, duration_days + 1)]
    
    # Danh sách kết hợp: BẮT BUỘC (ưu tiên) + TỰ CHỌN (sau)
    unassigned_places = must_include_dicts + places_to_assign
    
    # Sắp xếp các điểm bắt buộc theo một thứ tự cố định (ví dụ: ID) để đảm bảo tính nhất quán
    # Không cần sắp xếp lại nếu muốn giữ thứ tự ban đầu của must_include_place_ids, 
    # nhưng việc ưu tiên gán là quan trọng hơn.
    
    # Lặp qua các ngày
    for day_index in range(duration_days):
        
        current_daily_hours = 0.0
        current_time_slot_hour = 8.0 
        
        # Tạo bản sao của danh sách để tránh sửa đổi trong khi lặp (không cần thiết với logic mới)
        
        while current_daily_hours < MAX_HOURS_PER_DAY and unassigned_places:
            
            is_first_place = not itinerary_draft[day_index]["places"]
            
            # --- TÌM ĐIỂM TIẾP THEO (Ưu tiên Điểm BẮT BUỘC) ---
            
            next_place_to_add = None
            candidates = []
            
            must_include_still_unassigned = [p for p in unassigned_places if p['id'] in excluded_ids]
            
            if must_include_still_unassigned:
                # Ưu tiên chọn địa điểm bắt buộc đầu tiên trong danh sách 
                next_place_to_add = must_include_still_unassigned[0] 
                # Cần tìm 'anchor' để tính thời gian di chuyển nếu không phải điểm đầu tiên
                if not is_first_place:
                    last_place_info = itinerary_draft[day_index]["places"][-1]
                    last_place_db = db.session.get(Destination, last_place_info['id'])
                    
                    anchor_lat = float(getattr(last_place_db, 'latitude', 0) or 0.0) 
                    anchor_lon = float(getattr(last_place_db, 'longitude', 0) or 0.0)
                else:
                    # Nếu là điểm đầu tiên, không cần tối ưu hóa vị trí
                    anchor_lat = next_place_to_add['lat']
                    anchor_lon = next_place_to_add['lon']
                    
            elif unassigned_places:
                # Nếu không còn điểm bắt buộc, áp dụng TỐI ƯU HÓA VỊ TRÍ cho các điểm còn lại
                if is_first_place:
                    # Chọn điểm tự chọn đầu tiên trong danh sách (đã được xáo trộn)
                    next_place_to_add = unassigned_places[0]
                    anchor_lat = next_place_to_add['lat']
                    anchor_lon = next_place_to_add['lon']
                else:
                    last_place_info = itinerary_draft[day_index]["places"][-1]
                    last_place_db = db.session.get(Destination, last_place_info['id'])
                    
                    if not last_place_db: break
                    
                    anchor_lat = float(getattr(last_place_db, 'latitude', 0) or 0.0) 
                    anchor_lon = float(getattr(last_place_db, 'longitude', 0) or 0.0)

                    # Sắp xếp các điểm chưa gán theo khoảng cách từ điểm neo
                    candidates = sorted(
                        [p for p in unassigned_places], 
                        key=lambda p: simple_distance(anchor_lat, anchor_lon, p['lat'], p['lon'])
                    )
                    next_place_to_add = candidates[0] if candidates else None

            if not next_place_to_add: break
            
            duration = next_place_to_add['duration_hours']
            
            time_spent = duration
            if not is_first_place:
                # Bằng 0 nếu là điểm đầu tiên trong ngày, ngược lại là 0.5
                time_spent += TRAVEL_BUFFER_HOURS 
            
            # 2.3. Kiểm tra Giới hạn Giờ
            if current_daily_hours + time_spent <= MAX_HOURS_PER_DAY:
                
                # Cần tìm và loại bỏ điểm đã được gán khỏi unassigned_places
                unassigned_places.remove(next_place_to_add)

                start_time_hour = int(current_time_slot_hour)
                start_time_minutes = int((current_time_slot_hour % 1) * 60)

                end_time_float = current_time_slot_hour + duration
                end_time_hour = int(end_time_float)
                end_time_minutes = int((end_time_float % 1) * 60)
                
                time_slot = f"{start_time_hour:02d}:{start_time_minutes:02d} - {end_time_hour:02d}:{end_time_minutes:02d}"

                itinerary_draft[day_index]["places"].append({
                    "id": next_place_to_add['id'], 
                    "name": next_place_to_add['name'], 
                    "category": next_place_to_add['category'],
                    "time_slot": time_slot,
                    "duration_hours": duration 
                })
                
                current_daily_hours += time_spent 
                current_time_slot_hour = end_time_float
                if not is_first_place:
                    current_time_slot_hour += TRAVEL_BUFFER_HOURS
                
            else:
                # Nếu không đủ thời gian, chuyển sang ngày tiếp theo (cho dù điểm đó là bắt buộc)
                break
        
        # Nếu còn điểm chưa gán, chúng sẽ được xử lý trong ngày tiếp theo.
        # Danh sách unassigned_places đã được cập nhật trực tiếp.

    # -----------------------------------------------------------------
    # BƯỚC CUỐI: 
    # -----------------------------------------------------------------
    final_itinerary = []
    for day_plan in itinerary_draft:
        clean_places = []
        for place in day_plan["places"]:
            clean_place = place.copy()
            if 'duration_hours' in clean_place:
                del clean_place['duration_hours'] 
            clean_places.append(clean_place)
            
        if clean_places:
            final_itinerary.append({
                "day": day_plan["day"],
                "places": clean_places
            })

    # 🚨 BƯỚC MỚI: Kiểm tra các điểm bắt buộc CÓ được gán hết hay không
    # (Nếu không đủ ngày/giờ, một số điểm bắt buộc có thể bị bỏ sót)
    must_include_assigned_ids = set()
    for day_plan in final_itinerary:
        for place in day_plan['places']:
            if place['id'] in excluded_ids:
                must_include_assigned_ids.add(place['id'])

    if len(must_include_assigned_ids) < len(must_include_place_ids):
        # Nếu ít hơn số điểm bắt buộc, hàm gọi cần phải xử lý lỗi này
        # hoặc ít nhất là gửi cảnh báo. Ở đây, ta vẫn trả về hành trình tốt nhất có thể.
        print(f"Warning: Only {len(must_include_assigned_ids)}/{len(must_include_place_ids)} required places were assigned due to time constraints.")


    return final_itinerary

# -------------------------------------------------------------
# ENDPOINT /api/trips (POST) 
# -------------------------------------------------------------

@app.route("/api/trips", methods=["POST"])
@jwt_required()
def create_trip():
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    
    name = data.get("name")
    start_date_str = data.get("start_date") # Nhận start_date từ Front-end (nếu có)
    
    # 🔑 NHẬN METADATA (people, budget) TỪ FRONT-END
    metadata = data.get("metadata", {})      
    
    try:
        province_id = data.get("province_id")
        duration_days = data.get("duration")
    except:
        return jsonify({"message": "Province ID hoặc số ngày không hợp lệ."}), 400
    
    must_include_place_ids = data.get("must_include_place_ids", []) 

    if not all([name, province_id, duration_days]):
        return jsonify({"message": "Trip name, province, and duration are required."}), 400
        
    # Xử lý Ngày tháng và Trạng thái
    calculated_start_date = None
    calculated_end_date = None
    status = 'DRAFT'
    
    if start_date_str:
        try:
            calculated_start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            calculated_end_date = calculated_start_date + timedelta(days=duration_days - 1)
            
            # Xác định trạng thái ban đầu
            current_date = datetime.now().date()
            if calculated_start_date > current_date:
                status = 'UPCOMING'
            elif calculated_end_date >= current_date:
                 status = 'ONGOING'
            else:
                 status = 'COMPLETED'
        except ValueError:
            return jsonify({"message": "Invalid start_date format. Use YYYY-MM-DD."}), 400
            
    try:
        itinerary_draft = generate_itinerary_optimized(province_id, duration_days, must_include_place_ids)
        
        if not itinerary_draft and not must_include_place_ids:
            return jsonify({"message": "No suitable destinations found in this region to create an itinerary."}), 400
            
        itinerary_json = json.dumps(itinerary_draft, ensure_ascii=False)
        metadata_json = json.dumps(metadata, ensure_ascii=False) # 🔑 LƯU METADATA VÀO DB
        
        new_trip = Itinerary(
            user_id=user_id,
            name=name,
            province_id=province_id,
            duration=duration_days,
            itinerary_json=itinerary_json,
            metadata_json=metadata_json,          # 🔑 TRƯỜNG MỚI
            start_date=calculated_start_date,     # 🔑 TRƯỜNG MỚI
            end_date=calculated_end_date,         # 🔑 TRƯỜNG MỚI
            status=status,                        # 🔑 TRƯỜNG MỚI
            created_at=datetime.now()
        )
        db.session.add(new_trip)
        db.session.commit()
        
        province_name = get_province_name_by_id(province_id)
        
        # Trả về metadata cho Front-end
        return jsonify({
            "message": "Trip created successfully.",
            "trip": {
                "id": new_trip.id,
                "name": new_trip.name,
                "province_name": province_name,
                "duration": new_trip.duration,
                "start_date": new_trip.start_date.strftime("%Y-%m-%d") if new_trip.start_date else None,
                "status": new_trip.status,
                "metadata": metadata, 
                "itinerary": itinerary_draft
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating trip: {e}")
        return jsonify({"message": "An error occurred while creating the trip."}), 500
    
@app.route("/api/trips", methods=["GET"])
@jwt_required()
def get_user_trips():
    user_id = int(get_jwt_identity())
    
    user_trips = Itinerary.query.options(db.joinedload(Itinerary.province)).filter_by(user_id=user_id).all()
    
    result = []
    for trip in user_trips:
        province_name = trip.province.name if trip.province else "Unknown Province"
        
        metadata = json.loads(trip.metadata_json) if trip.metadata_json else {}
        
        result.append({
            "id": trip.id,
            "name": trip.name,
            "province_name": province_name,
            "duration": trip.duration,
            "start_date": trip.start_date.strftime("%Y-%m-%d") if trip.start_date else None, # 🔑 TRƯỜNG MỚI
            "end_date": trip.end_date.strftime("%Y-%m-%d") if trip.end_date else None,       # 🔑 TRƯỜNG MỚI
            "status": trip.status,                                                          # 🔑 TRƯỜNG MỚI
            "metadata": metadata,                                                           # 🔑 TRƯỜNG MỚI
            "created_at": trip.created_at.strftime("%Y-%m-%d"),
        })
        
    return jsonify(result), 200
## Trip Details

@app.route("/api/trips/<int:trip_id>", methods=["GET"])
@jwt_required()
def get_trip_details(trip_id):
    user_id = int(get_jwt_identity())
    
    trip = db.session.get(Itinerary, trip_id, options=[db.joinedload(Itinerary.province)])
    
    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found or unauthorized access."}), 404
    
    itinerary_data = json.loads(trip.itinerary_json) if trip.itinerary_json else []
    metadata = json.loads(trip.metadata_json) if trip.metadata_json else {}
    province_name = trip.province.name if trip.province else "Unknown Province"

    return jsonify({
        "id": trip.id,
        "name": trip.name,
        "province_name": province_name,
        "duration": trip.duration,
        "start_date": trip.start_date.strftime("%Y-%m-%d") if trip.start_date else None, 
        "end_date": trip.end_date.strftime("%Y-%m-%d") if trip.end_date else None,       
        "status": trip.status,                                                          
        "metadata": metadata,                                                           
        "itinerary": itinerary_data, 
        "last_updated": trip.updated_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(trip, 'updated_at') and trip.updated_at else None
    }), 200

@app.route("/api/trips/<int:trip_id>/add-place", methods=["POST"])
@jwt_required()
def add_place_to_trip(trip_id):
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    place_id = data.get("place_id")
    target_day = data.get("day", 1) # Day to add the place to (default: Day 1)

    if not place_id:
        return jsonify({"message": "Place ID is required."}), 400

    trip = db.session.get(Itinerary, trip_id)
    place = db.session.get(Destination, place_id) 

    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found."}), 404
    if not place:
        return jsonify({"message": "Destination place not found."}), 404
        
    # --- Validation ---
    if place.province_id != trip.province_id:
        return jsonify({"message": "This destination does not belong to the trip's province."}), 400

    itinerary = json.loads(trip.itinerary_json) if trip.itinerary_json else []
    
    added = False
    for day_plan in itinerary:
        if day_plan.get("day") == target_day:
            new_place_data = {
                "id": place.id,
                "name": place.name,
                "category": place.category
            }
            # Prevent duplication
            if not any(p['id'] == place.id for p in day_plan["places"]):
                 day_plan["places"].append(new_place_data)
                 added = True
            else:
                 return jsonify({"message": "This place is already in the itinerary for that day."}), 400
            break
            
    if not added and target_day <= trip.duration:
        itinerary.append({
            "day": target_day,
            "places": [{"id": place.id, "name": place.name, "category": place.category}]
        })
        itinerary.sort(key=lambda x: x["day"])
        added = True
        
    if not added:
        return jsonify({"message": f"Could not add destination. Day {target_day} is invalid or outside the trip duration ({trip.duration} days)."}), 400
        
    trip.itinerary_json = json.dumps(itinerary, ensure_ascii=False)
    # Assuming 'updated_at' field exists and is updated on save
    trip.updated_at = datetime.now() 
    db.session.commit()
    
    return jsonify({"message": f"Successfully added {place.name} to Day {target_day}."}), 200

@app.route("/api/trips/<int:trip_id>", methods=["DELETE"])
@jwt_required()
def delete_trip(trip_id):
    user_id = int(get_jwt_identity())
    
    trip = db.session.get(Itinerary, trip_id)
    
    if not trip:
        return jsonify({"message": "Trip not found."}), 404
        
    if trip.user_id != user_id:
        # 403 Forbidden nếu không phải chủ sở hữu
        return jsonify({"message": "Unauthorized access to delete this trip."}), 403 
    
    try:
        db.session.delete(trip)
        db.session.commit()
        
        return jsonify({"message": f"Trip {trip_id} deleted successfully."}), 200 # 200 OK
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting trip: {e}")
        return jsonify({"message": "An error occurred while deleting the trip."}), 500

# -------------------------------------------------------------
# ENDPOINT /api/trips/<int:trip_id> (PUT) 
# -------------------------------------------------------------

@app.route("/api/trips/<int:trip_id>", methods=["PUT"])
@jwt_required()
def update_trip(trip_id):
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    
    # 1. Tìm chuyến đi
    trip = db.session.get(Itinerary, trip_id)

    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found or unauthorized access."}), 404

    trip_changed = False
    
    # 2. Cập nhật Tên
    if "name" in data and data["name"] != trip.name:
        trip.name = data["name"]
        trip_changed = True

    # 3. Cập nhật Metadata (ví dụ: people, budget)
    if "metadata" in data:
        new_metadata = data["metadata"]
        try:
            metadata_json = json.dumps(new_metadata, ensure_ascii=False)
            if metadata_json != trip.metadata_json:
                trip.metadata_json = metadata_json
                trip_changed = True
        except TypeError:
            return jsonify({"message": "Invalid metadata format."}), 400

    # 4. Xử lý Ngày bắt đầu và Trạng thái
    start_date_str = data.get("start_date")
    
    # Chỉ cập nhật nếu start_date được gửi lên và khác với giá trị hiện tại
    if start_date_str:
        try:
            new_start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            if new_start_date != trip.start_date:
                
                # Tính lại ngày kết thúc dựa trên duration hiện tại
                new_end_date = new_start_date + timedelta(days=trip.duration - 1)
                
                # Xác định trạng thái mới (UPCOMING, ONGOING, COMPLETED)
                current_date = datetime.now().date()
                if new_start_date > current_date:
                    new_status = 'UPCOMING'
                elif new_end_date >= current_date:
                    new_status = 'ONGOING'
                else:
                    new_status = 'COMPLETED'
                    
                trip.start_date = new_start_date
                trip.end_date = new_end_date
                trip.status = new_status
                trip_changed = True
                
        except ValueError:
            return jsonify({"message": "Invalid start_date format. Use YYYY-MM-DD."}), 400

    # 5. Lưu thay đổi
    if not trip_changed:
        return jsonify({"message": "No changes detected."}), 200

    try:
        trip.updated_at = datetime.now() # Cập nhật thời gian sửa đổi
        db.session.commit()

        # Tải lại metadata từ JSON để trả về (đảm bảo nó là dict Python)
        metadata = json.loads(trip.metadata_json) if trip.metadata_json else {}
        province_name = trip.province.name if trip.province else "Unknown Province"
        
        return jsonify({
            "message": "Trip updated successfully.",
            "trip": {
                "id": trip.id,
                "name": trip.name,
                "province_name": province_name,
                "duration": trip.duration,
                "start_date": trip.start_date.strftime("%Y-%m-%d") if trip.start_date else None,
                "status": trip.status,
                "metadata": metadata,
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating trip: {e}")
        return jsonify({"message": "An error occurred while updating the trip."}), 500

# -------------------------------------------------------------
# ENDPOINT MỚI: CẬP NHẬT LỊCH TRÌNH (ITINERARY) RIÊNG BIỆT
# -------------------------------------------------------------

@app.route("/api/trips/<int:trip_id>/itinerary", methods=["PUT"])
@jwt_required()
def update_itinerary(trip_id):
    """
    Cập nhật toàn bộ lịch trình (itinerary_json) cho một chuyến đi cụ thể.
    Yêu cầu dữ liệu JSON chứa trường 'itinerary'.
    """
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    
    # 1. Tìm chuyến đi
    trip = db.session.get(Itinerary, trip_id)

    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found or unauthorized access."}), 404

    # 2. Lấy dữ liệu lịch trình mới
    new_itinerary = data.get("itinerary")
    
    if not isinstance(new_itinerary, list):
        return jsonify({"message": "Invalid itinerary data format."}), 400

    try:
        # 3. Chuyển lịch trình mới sang chuỗi JSON
        new_itinerary_json = json.dumps(new_itinerary, ensure_ascii=False)
        
        # 4. Kiểm tra xem dữ liệu có thay đổi không
        if new_itinerary_json == trip.itinerary_json:
            return jsonify({"message": "No changes detected in the itinerary."}), 200

        # 5. Cập nhật trường itinerary_json và updated_at
        trip.itinerary_json = new_itinerary_json
        trip.updated_at = datetime.now() # Cập nhật thời gian sửa đổi
        
        db.session.commit()
        
        # Trả về phản hồi thành công (không cần trả về toàn bộ dữ liệu trip)
        return jsonify({
            "message": "Itinerary updated successfully.",
            "trip_id": trip.id,
            "updated_at": trip.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        }), 200

    except TypeError:
        db.session.rollback()
        return jsonify({"message": "Invalid itinerary structure (cannot be converted to JSON)."}), 400
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating itinerary: {e}")
        return jsonify({"message": "An error occurred while updating the itinerary."}), 500
    
@app.route("/api/destinations/<int:destination_id>", methods=["GET"])
@jwt_required()
def get_destination_details(destination_id):
    
    destination = db.session.get(
        Destination, 
        destination_id, 
        options=[
            db.joinedload(Destination.images),
            db.joinedload(Destination.province)
        ]
    )
    
    if not destination:
        return jsonify({"message": "Destination not found."}), 404

    result = {
        "id": destination.id,
        "name": destination.name,
        "type": destination.place_type, # Sử dụng 'place_type'
        
        "description": decode_db_json_string(destination.description), 
        
        "images": [img.image_url for img in destination.images],
        "gps": {
            "lat": destination.latitude,
            "lng": destination.longitude
        },
        "opening_hours": destination.opening_hours,
        "entry_fee": destination.entry_fee,
        "tags": decode_db_json_string(destination.tags, default_type='text'),
        "source": destination.source,
        
        "province_id": destination.province_id,
        "province_name": destination.province.name if destination.province else None,
    }
    
    return jsonify(result), 200

@app.route("/api/destinations/by-province/<int:province_id>", methods=["GET"])
@jwt_required()
def get_destinations_by_province(province_id):
    destinations = Destination.query.filter_by(province_id=province_id).options(
        db.joinedload(Destination.images)
    ).all()
    
    if not destinations:
        return jsonify({"message": "No destinations found for this province."}), 404

    result = []
    for destination in destinations:
        result.append({
            "id": destination.id,
            "name": destination.name,
            "type": destination.place_type,
            "description_snippet": (destination.description[:100] + '...') if destination.description else None,
            "images": [img.image_url for img in destination.images][:1], # Chỉ lấy 1 ảnh đại diện
            "gps": {
                "lat": destination.latitude,
                "lng": destination.longitude
            },
            "entry_fee": destination.entry_fee,
            "tags": decode_db_json_string(destination.tags, default_type='text'),
        })
        
    return jsonify(result), 200

# ----------------- Main -----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    print("Server running at http://127.0.0.1:5000")
    app.run(debug=True)
    