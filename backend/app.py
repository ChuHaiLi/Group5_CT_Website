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
import random
from datetime import datetime
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
import math
load_backend_env()

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
    # Sửa cú pháp SQLAlchemy 2.0
    user = db.session.get(User, user_id) 
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
        destination = db.session.get(
            Destination, 
            item.destination_id, 
            options=[
                db.joinedload(Destination.images), 
                db.joinedload(Destination.province).joinedload(Province.region)
            ]
        )
        
        if destination:
            province = destination.province
            region = province.region if province else None
            region_name = region.name if region else "Miền Nam" # Default cho weather
            
            image_full_url = get_card_image_url(destination)

            # 🔥 QUAN TRỌNG: Trả về ĐẦY ĐỦ thông tin giống endpoint /api/destinations
            result.append({
                "id": destination.id,
                "name": destination.name,
                "province_name": province.name if province else None,
                "region_name": region_name,
                "description": decode_db_json_string(destination.description),
                "image_url": image_full_url,
                
                # 🔥 THÊM: Thông tin chi tiết cho Modal
                "images": [img.image_url for img in destination.images],  # Danh sách ảnh
                "type": destination.place_type,                           # Loại địa điểm
                "place_type": destination.place_type,                     # Alias cho type
                "opening_hours": destination.opening_hours,               # Giờ mở cửa
                "entry_fee": destination.entry_fee,                       # Giá vé
                "source": destination.source,                             # Nguồn tham khảo
                
                # Thông tin GPS
                "gps": {
                    "lat": destination.latitude,
                    "lng": destination.longitude
                } if destination.latitude and destination.longitude else None,
                
                # Thông tin cơ bản (giữ nguyên cho RecommendCard)
                "latitude": destination.latitude,
                "longitude": destination.longitude,
                "rating": destination.rating or 0,
                "category": destination.category,
                "tags": decode_db_json_string(destination.tags, default_type='text'),
                "weather": generate_random_weather(region_name),
            })
    return jsonify(result), 200

# -------- GET ALL DESTINATIONS --------
# Thay thế endpoint /api/destinations hiện tại bằng code này:

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
        normalized_search = unidecode(search_term).lower()
        search_pattern = f"%{normalized_search}%"
        
        query = query.filter(
            db.or_(
                Destination.name_unaccented.ilike(search_pattern),
                Destination.province.has(
                    Province.name_unaccented.ilike(search_pattern)
                )
            )
        )
    
    # 2. Lọc theo Tags
    if tags_string:
        required_tags = tags_string.split(',')
        for tag in required_tags:
            query = query.filter(Destination.tags.ilike(f'%"{tag.strip()}"%')) 
    
    destinations = query.all()
    
    result = []
    for dest in destinations:
        province = dest.province
        region = province.region if province else None
        region_name = region.name if region else "Miền Nam" 
        
        image_full_url = get_card_image_url(dest)
        
        # 🔥 QUAN TRỌNG: Trả về đầy đủ thông tin cho Modal
        result.append({
            "id": dest.id,
            "name": dest.name,
            "province_name": province.name if province else None,
            "region_name": region_name, 
            "description": decode_db_json_string(dest.description),
            "image_url": image_full_url,
            
            # 🔥 THÊM: Thông tin chi tiết cho Modal
            "images": [img.image_url for img in dest.images],  # Danh sách ảnh
            "type": dest.place_type,                           # Loại địa điểm
            "opening_hours": dest.opening_hours,               # Giờ mở cửa
            "entry_fee": dest.entry_fee,                       # Giá vé
            "source": dest.source,                             # Nguồn tham khảo
            
            # Thông tin GPS
            "gps": {
                "lat": dest.latitude,
                "lng": dest.longitude
            } if dest.latitude and dest.longitude else None,
            
            # Thông tin cơ bản (giữ nguyên cho RecommendCard)
            "latitude": dest.latitude,
            "longitude": dest.longitude,
            "rating": dest.rating or 0,
            "category": dest.category,
            "tags": decode_db_json_string(dest.tags, default_type='text'),
            "weather": generate_random_weather(region_name),
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
    
    places_in_province = Destination.query.filter(
        Destination.province_id == province_id,
        Destination.id.notin_(excluded_ids)
    ).all()
    
    # LƯU Ý: all_places_details chứa ĐỐI TƯỢNG MODEL Destination
    all_places_details = []
    must_include_places = []
    for place_id in must_include_place_ids:
        place = db.session.get(Destination, place_id)
        if place:
            must_include_places.append(place)
            
    all_places_details.extend(must_include_places)
    
    remaining_places_sorted = sorted(
        places_in_province, 
        key=lambda p: p.rating or 0, 
        reverse=True
    )
    
    num_to_select = MAX_TOTAL_PLACES_SELECTION - len(must_include_places)
    selected_remaining_places = remaining_places_sorted[:max(0, num_to_select)]
    all_places_details.extend(selected_remaining_places)
    
    places_to_assign = []
    for p in all_places_details: 
        raw_lat = getattr(p, 'latitude', None)
        raw_lon = getattr(p, 'longitude', None)
        
        lat = float(raw_lat) if raw_lat is not None else 0.0
        lon = float(raw_lon) if raw_lon is not None else 0.0
        
        places_to_assign.append({
            "id": p.id, 
            "name": p.name, 
            "category": p.category, 
            "lat": lat,
            "lon": lon, 
            "assigned": False,
            "duration_hours": get_place_duration(p) 
        })
    
    random.shuffle(places_to_assign) 
    
    # -----------------------------------------------------------------
    # BƯỚC 2: PHÂN BỔ ĐIỂM VÀ TỐI ƯU HÓA VỊ TRÍ 
    # -----------------------------------------------------------------
    itinerary_draft = [{"day": day, "places": []} for day in range(1, duration_days + 1)]
    
    for day_index in range(duration_days):
        
        current_daily_hours = 0.0
        current_time_slot_hour = 8.0 
        
        while current_daily_hours < MAX_HOURS_PER_DAY:
            
            is_first_place = not itinerary_draft[day_index]["places"]
            
            # --- TÌM ĐIỂM TIẾP THEO (Tối ưu hóa vị trí) ---
            
            if is_first_place:
                anchor_place_dict = next((p for p in places_to_assign if not p['assigned']), None)
                if not anchor_place_dict: break 
                
                anchor_lat = anchor_place_dict['lat']
                anchor_lon = anchor_place_dict['lon']
                next_place_to_add = anchor_place_dict
                
            else:
                last_place_info = itinerary_draft[day_index]["places"][-1]
                last_place_db = db.session.get(Destination, last_place_info['id'])
                if not last_place_db: break
                
                # Truy cập thuộc tính bằng DẤU CHẤM
                anchor_lat = float(getattr(last_place_db, 'latitude', 0) or 0.0) 
                anchor_lon = float(getattr(last_place_db, 'longitude', 0) or 0.0)

                # Sắp xếp các điểm chưa gán theo khoảng cách từ điểm neo
                candidates = sorted(
                    [p for p in places_to_assign if not p['assigned']], 
                    key=lambda p: simple_distance(anchor_lat, anchor_lon, p['lat'], p['lon'])
                )
                next_place_to_add = candidates[0] if candidates else None

            if not next_place_to_add: break
            
            duration = next_place_to_add['duration_hours']
            
            time_spent = duration 
            if not is_first_place:
                time_spent += TRAVEL_BUFFER_HOURS 
            
            # 2.3. Kiểm tra Giới hạn Giờ
            if current_daily_hours + time_spent <= MAX_HOURS_PER_DAY:
                
                next_place_to_add['assigned'] = True
                
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
                break
        
        # Cập nhật danh sách places_to_assign (chỉ giữ lại những điểm chưa được gán)
        places_to_assign = [p for p in places_to_assign if not p['assigned']] 


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