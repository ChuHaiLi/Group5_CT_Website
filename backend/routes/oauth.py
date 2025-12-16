from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token
from models import db, User
import secrets

oauth_bp = Blueprint("oauth", __name__)

# -------- GOOGLE LOGIN --------
@oauth_bp.route("/google-login", methods=["POST"])
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
            # User đã tồn tại - Cập nhật thông tin Google nếu chưa có
            if not user.google_id:
                user.google_id = google_id
                user.name = name
                user.picture = picture
                user.avatar_url = picture
                user.is_email_verified = True
                db.session.commit()
            elif picture and picture != user.picture:
                # Cập nhật cả 2 field nếu ảnh Google thay đổi
                user.picture = picture
                user.avatar_url = picture
                db.session.commit()
            elif picture and not user.avatar_url:
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
                    'avatar': avatar,
                    'is_verified': True
                }
            }), 200
        
        else:
            # User chưa tồn tại - Tạo tài khoản mới
            
            # Tạo username từ email hoặc name
            base_username = email.split('@')[0]
            username = base_username
            
            # Tạo user mới
            new_user = User(
                username=username,
                email=email.lower(),
                name=name,
                google_id=google_id,
                picture=picture,
                avatar_url=picture,
                password=None,
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

# -------- GITHUB LOGIN --------
@oauth_bp.route("/github-login", methods=["POST"])
def github_login():
    """
    Xử lý đăng nhập/đăng ký qua GitHub (Firebase)
    Frontend sẽ gửi thông tin user từ Firebase
    """
    try:
        data = request.get_json()
        
        github_id = data.get('github_id')
        email = data.get('email')
        name = data.get('name')
        username = data.get('username')
        picture = data.get('picture')
        
        # Validate dữ liệu
        if not github_id:
            return jsonify({
                'error': 'Missing required fields',
                'message': 'GitHub ID is required'
            }), 400
        
        # Kiểm tra xem user đã tồn tại chưa (theo github_id hoặc email)
        user = User.query.filter(
            db.or_(
                User.github_id == github_id,
                User.email == email.lower() if email else None
            )
        ).first()
        
        if user:
            # User đã tồn tại - Cập nhật thông tin GitHub nếu chưa có
            if not user.github_id:
                user.github_id = github_id
                user.name = name
                user.picture = picture
                user.avatar_url = picture
                user.is_email_verified = True
                db.session.commit()
            elif picture and picture != user.picture:
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
                    'avatar': avatar,
                    'is_verified': True,
                    'github_id': user.github_id
                }
            }), 200
        
        else:
            # User chưa tồn tại - Tạo tài khoản mới
            
            # Tạo username unique
            base_username = username or f"github_{github_id[:8]}"
            final_username = base_username
            counter = 1
            
            # Đảm bảo username không trùng
            while User.query.filter_by(username=final_username).first():
                final_username = f"{base_username}{counter}"
                counter += 1
            
            # Tạo user mới (KHÔNG CÓ PASSWORD cho GitHub user)
            new_user = User(
                username=final_username,
                email=email.lower() if email else f"{github_id}@github.temp",
                name=name,
                github_id=github_id,
                picture=picture,
                avatar_url=picture,
                password=None,  # KHÔNG TẠO PASSWORD CHO GITHUB USER
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
                    'is_verified': True,
                    'github_id': new_user.github_id
                }
            }), 201
    
    except Exception as e:
        print(f"GitHub login error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500