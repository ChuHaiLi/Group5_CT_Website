from flask import Flask, request, jsonify, url_for, send_from_directory
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
import requests
from datetime import datetime
from difflib import get_close_matches
import unicodedata
import os
from models import db, User, Destination, Tour, SavedTour, Review, Itinerary, Booking, TourItinerary, TourInclusion, TourExclusion, TourNote

# ----------------- App & Config -----------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_super_secret_key'

# Token expiration
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['JWT_HEADER_NAME'] = "Authorization"
app.config['JWT_HEADER_TYPE'] = "Bearer"

db.init_app(app)
jwt = JWTManager(app)

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

# ----------------- Routes -----------------

# -------- REGISTER --------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    errors = {}
    if len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    if not is_valid_email(email):
        errors["email"] = "Invalid email"
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    if User.query.filter_by(username=username).first():
        errors["username"] = "Username already exists"
    if User.query.filter_by(email=email).first():
        errors["email"] = "Email already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    hashed_pw = generate_password_hash(password)
    new_user = User(username=username, email=email, password=hashed_pw)
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Database error"}), 500

    return jsonify({"message": "User registered successfully"}), 201

# -------- LOGIN --------
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    #if not getattr(user, "is_email_verified", True):
    #   return jsonify({"message": "Email not verified"}), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
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
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email})

# -------- FORGOT PASSWORD --------
@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Email not found"}), 404

    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    db.session.commit()
    return jsonify({"message": "Password reset email sent (simulate)"}), 200

# -------- RESET PASSWORD --------
@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("password") or ""

    if len(new_password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({"message": "Invalid or expired token"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"}), 200

# -------- SAVED TOURS --------
@app.route("/api/saved/add", methods=["POST"])
@jwt_required()
def save_tour():
    data = request.get_json() or {}
    tour_id = data.get("tour_id")
    user_id = int(get_jwt_identity())

    if not tour_id:
        return jsonify({"message": "Tour ID required"}), 400

    # Kiểm tra tour có tồn tại không
    tour = Tour.query.get(tour_id)
    if not tour:
        return jsonify({"message": "Tour not found"}), 404

    # Kiểm tra đã save chưa
    exists = SavedTour.query.filter_by(
        user_id=user_id,
        tour_id=tour_id
    ).first()

    if exists:
        return jsonify({"message": "Already saved"}), 200

    new_save = SavedTour(user_id=user_id, tour_id=tour_id)
    db.session.add(new_save)
    db.session.commit()
    return jsonify({"message": "Saved successfully"}), 201

@app.route("/api/saved/remove", methods=["DELETE"])
@jwt_required()
def remove_saved():
    data = request.get_json() or {}
    tour_id = data.get("tour_id")
    user_id = int(get_jwt_identity())

    saved = SavedTour.query.filter_by(
        user_id=user_id,
        tour_id=tour_id
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
    saved_items = SavedTour.query.filter_by(user_id=user_id).all()
    result = []

    for item in saved_items:
        tour = item.tour
        if tour:
            result.append({
                "id": tour.id,
                "ma_tour": tour.ma_tour,
                "title": tour.title,
                "tour_name": tour.tour_name,
                "image_url": tour.image_url,
                "gia_tu": tour.gia_tu,
                "rating": tour.rating or 0,
                "thoi_gian": tour.thoi_gian,
                "region": tour.region,
                "saved_at": item.saved_at.isoformat()
            })
    return jsonify(result), 200

# -------- GET ALL DESTINATIONS --------
@app.route("/api/destinations", methods=["GET"])
def get_destinations():
    destinations = Destination.query.all()
    result = []
    for dest in destinations:
        image_filename = dest.image_url.split("/")[-1]
        image_full_url = request.host_url.rstrip('/') + url_for('static', filename=f'images/{image_filename}')
        result.append({
            "id": dest.id,
            "name": dest.name,
            "description": dest.description,
            "image_url": image_full_url,
            "latitude": dest.latitude,
            "longitude": dest.longitude,
            "rating": dest.rating or 0,
            "category": dest.category,
            "tags": dest.tags,
        })
    return jsonify(result), 200

# -------- GET ALL TOURS --------
@app.route("/api/tours", methods=["GET"])
def get_tours():
    # Lấy query params
    region = request.args.get('region')  # Miền Bắc, Miền Trung, Miền Nam
    category = request.args.get('category')
    
    query = Tour.query
    
    if region:
        query = query.filter_by(region=region)
    if category:
        query = query.filter_by(category=category)
    
    tours = query.all()
    result = []
    
    for tour in tours:
        # Prefer serving images via the server endpoint that resolves by title
        image_api = request.host_url.rstrip('/') + url_for('get_tour_image', tour_id=tour.id)
        result.append({
            "id": tour.id,
            "ma_tour": tour.ma_tour,
            "title": tour.title,
            "tour_name": tour.tour_name,
            "region": tour.region,
            "image_url": image_api,
            "thoi_gian": tour.thoi_gian,
            "gia_tu": tour.gia_tu,
            "rating": tour.rating or 0,
            "review_count": tour.review_count or 0,
            "description": tour.description,
            "category": tour.category
        })
    
    return jsonify(result), 200

# -------- GET TOUR DETAIL --------
@app.route("/api/tours/<int:tour_id>", methods=["GET"])
def get_tour_detail(tour_id):
    tour = Tour.query.get(tour_id)
    if not tour:
        return jsonify({"message": "Tour not found"}), 404
    
    # Lấy lịch trình
    itineraries = TourItinerary.query.filter_by(tour_id=tour_id).order_by(TourItinerary.day_number).all()
    lich_trinh = []
    for it in itineraries:
        lich_trinh.append({
            "day_number": it.day_number,
            "ngay": it.ngay,
            "hoat_dong": it.hoat_dong
        })
    
    # Lấy dịch vụ bao gồm
    inclusions = TourInclusion.query.filter_by(tour_id=tour_id).all()
    bao_gom = [inc.content for inc in inclusions]
    
    # Lấy dịch vụ không bao gồm
    exclusions = TourExclusion.query.filter_by(tour_id=tour_id).all()
    khong_bao_gom = [exc.content for exc in exclusions]
    
    # Lấy ghi chú
    notes = TourNote.query.filter_by(tour_id=tour_id).all()
    ghi_chu = [note.content for note in notes]
    
    result = {
        "id": tour.id,
        "ma_tour": tour.ma_tour,
        "title": tour.title,
        "tour_name": tour.tour_name,
        "region": tour.region,
        "description": tour.description,
        # Provide an API URL that serves the image resolved by title
        "image_url": request.host_url.rstrip('/') + url_for('get_tour_image', tour_id=tour.id),
        "thoi_gian": tour.thoi_gian,
        "khoi_hanh": tour.khoi_hanh,
        "van_chuyen": tour.van_chuyen,
        "xuat_phat": tour.xuat_phat,
        "gia_tu": tour.gia_tu,
        "rating": tour.rating or 0,
        "review_count": tour.review_count or 0,
        "trai_nghiem": tour.trai_nghiem,
        "tags": tour.tags,
        "category": tour.category,
        "url": tour.url,
        "lich_trinh": lich_trinh,
        "bao_gom": bao_gom,
        "khong_bao_gom": khong_bao_gom,
        "ghi_chu": ghi_chu
    }
    
    return jsonify(result), 200

# -------- TEST JWT --------
@app.route("/api/test", methods=["GET"])
@jwt_required()
def test_jwt():
    user_id = int(get_jwt_identity())
    return jsonify({"message": "JWT valid!", "user_id": user_id})

# -------- PROXY IMAGE (để tránh CORS issues) --------
@app.route("/api/proxy-image", methods=["GET"])
def proxy_image():
    """Proxy image từ external URLs để tránh CORS issue"""
    image_url = request.args.get('url')
    
    if not image_url:
        return jsonify({"message": "URL parameter required"}), 400
    
    try:
        # Fetch image từ external URL
        response = requests.get(image_url, timeout=10, verify=False)
        response.raise_for_status()
        
        # Return image với correct content type + CORS headers
        headers = {
            'Content-Type': response.headers.get('Content-Type', 'image/jpeg'),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
        }
        return response.content, 200, headers
    except requests.exceptions.RequestException as e:
        # Fallback: redirect to original image URL (tuy có CORS nhưng ít nhất URL hoạt động)
        return jsonify({"error": str(e), "url": image_url}), 400


# -------- SERVE IMAGE BY TITLE --------
def normalize_for_matching(s):
    if not s:
        return ''
    s = s.lower()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r'[^0-9a-z\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


@app.route('/api/tours/<int:tour_id>/image', methods=['GET'])
def get_tour_image(tour_id):
    """Resolve an image file for a tour by matching the tour title to filenames
    in `static/images/tours`, and serve it. This ensures the frontend can request
    images via tour id/title without depending on stored external URLs."""
    tour = Tour.query.get(tour_id)
    if not tour:
        return jsonify({"message": "Tour not found"}), 404

    images_dir = os.path.join(os.path.dirname(__file__), 'static', 'images', 'tours')
    if not os.path.isdir(images_dir):
        return jsonify({"message": "Images folder not found"}), 500

    files = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    title_norm = normalize_for_matching(tour.title)

    # Build normalized map
    norm_map = {}
    for f in files:
        base, _ = os.path.splitext(f)
        norm = normalize_for_matching(base)
        norm_map.setdefault(norm, []).append(f)

    # Exact normalized match
    if title_norm in norm_map:
        chosen = norm_map[title_norm][0]
        return send_from_directory(images_dir, chosen)

    # Fuzzy match against normalized keys
    keys = list(norm_map.keys())
    close = get_close_matches(title_norm, keys, n=1, cutoff=0.6)
    if close:
        chosen = norm_map[close[0]][0]
        return send_from_directory(images_dir, chosen)

    # As a last resort, if tour.image_url points to a local file, serve it
    if tour.image_url and tour.image_url.startswith('/static'):
        fname = tour.image_url.split('/')[-1]
        fpath = os.path.join(images_dir, fname)
        if os.path.exists(fpath):
            return send_from_directory(images_dir, fname)

    return jsonify({"message": "Image not found for this tour"}), 404

# ----------------- Main -----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    print("Server running at http://127.0.0.1:5000")
    app.run(debug=True)