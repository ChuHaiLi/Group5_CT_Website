from flask import Flask, request, jsonify, url_for, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
import re
import secrets
import os
import random
import json
import string
import math
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from models import db, User, Destination, SavedDestination, Review, Itinerary, Region, Province, DestinationImage
from routes.chat import chat_bp
from routes.search import search_bp
from routes.auth import auth_bp
from routes.oauth import oauth_bp
from routes.profile import profile_bp
from routes.saved import saved_bp
from utils.env_loader import load_backend_env
from utils.openai_client import OpenAIChatClient
from sqlalchemy.orm import joinedload
from flask_migrate import Migrate
import flask_migrate
from pathlib import Path
import click
from flask.cli import with_appcontext
from unidecode import unidecode
from dotenv import load_dotenv

load_backend_env()
load_dotenv()

# CẤU HÌNH RANDOM THEO VÙNG
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


@app.cli.command("db-migrate")
@click.option("-m", "--message", default="Auto migration", help="Migration message")
@with_appcontext
def db_migrate_safe(message):
    """Ensure migrations/versions exists and run flask-migrate migrate safely."""
    p = Path(current_app.root_path) / "migrations" / "versions"
    p.mkdir(parents=True, exist_ok=True)
    (p / "__init__.py").touch(exist_ok=True)
    try:
        flask_migrate.migrate(message=message)
        click.echo("Done: ensured versions folder and ran migrate (if any changes).")
    except Exception as e:
        click.echo(f"Error running migrate: {e}")
        raise


@app.cli.command("db-upgrade")
@with_appcontext
def db_upgrade_safe():
    """Run flask-migrate upgrade."""
    try:
        flask_migrate.upgrade()
        click.echo("Done: database upgraded.")
    except Exception as e:
        click.echo(f"Error running upgrade: {e}")
        raise

# Register blueprints
app.register_blueprint(chat_bp, url_prefix="/api/chat")
app.register_blueprint(search_bp, url_prefix="/api/search")
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(oauth_bp, url_prefix="/api/auth")
app.register_blueprint(profile_bp, url_prefix="/api/profile")
app.register_blueprint(saved_bp, url_prefix="/api/saved")

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

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Tính khoảng cách thực tế (km) giữa hai điểm GPS sử dụng Haversine formula.
    Chính xác hơn simple_distance cho tính toán địa lý thực tế.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    
    # Bán kính Trái Đất (km)
    R = 6371.0
    
    # Chuyển đổi độ sang radian
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Chênh lệch
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return round(distance, 2)

def estimate_travel_time_km(distance_km, transport_mode="car"):
    """
    Ước tính thời gian di chuyển (phút) dựa trên khoảng cách và phương tiện.
    transport_mode: "car" (50 km/h), "walk" (5 km/h), "bike" (15 km/h)
    """
    if distance_km is None or distance_km <= 0:
        return 0
    
    speeds = {
        "car": 50,  # km/h
        "walk": 5,  # km/h
        "bike": 15  # km/h
    }
    speed = speeds.get(transport_mode, 50)
    time_hours = distance_km / speed
    return int(time_hours * 60)  # trả về phút

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

# Helper for AI reply parsing and heuristic fallback
def try_parse_json_from_text(text):
    """Try to parse JSON from text. Return Python object or None."""
    if not text or not isinstance(text, str):
        return None
    # 1) Direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2) Extract first JSON-like {...} or [...] and attempt parse
    patterns = [r"\{(?:.|\n)*\}", r"\[(?:.|\n)*\]"]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            snippet = m.group(0)
            try:
                return json.loads(snippet)
            except Exception:
                # cleanup common trailing commas
                cleaned = re.sub(r",\s*\}", "}", snippet)
                cleaned = re.sub(r",\s*\]", "]", cleaned)
                try:
                    return json.loads(cleaned)
                except Exception:
                    continue
    return None


def apply_heuristic_fallback(existing_result, compact_edited, raw_reply=None):
    """Return a normalized evaluation object using AI result when possible,
    otherwise compute a simple heuristic evaluation.
    """
    # detect empty days in edited itinerary
    empty_days = []
    for day in compact_edited:
        places = day.get("places") or []
        if not places:
            empty_days.append(day.get("day"))

    # base heuristic
    if existing_result and isinstance(existing_result, dict):
        res = existing_result.copy()
    else:
        res = {}

    # compute score if missing
    if res.get("score") is None:
        score = 100 - (25 * len(empty_days))
        score = max(0, min(100, score))
        res["score"] = score

    # decision
    if res.get("decision") is None:
        res["decision"] = "revise" if res["score"] < 70 else "accept"

    # summary
    if not res.get("summary"):
        if empty_days:
            res["summary"] = f"Phát hiện {len(empty_days)} ngày trống: {empty_days}. Cần thêm hoạt động hoặc điều chỉnh lịch." 
        else:
            res["summary"] = "Không phát hiện vấn đề lớn; hành trình trông hợp lý." 

    # suggestions
    if not res.get("suggestions"):
        suggestions = []
        if empty_days:
            suggestions.append("Thêm ít nhất 1 địa điểm cho mỗi ngày trống hoặc gộp ngày để tối ưu.")
        suggestions.append("Kiểm tra thời lượng mỗi ngày để đảm bảo không quá tải.")
        res["suggestions"] = suggestions

    # details
    if not res.get("details"):
        details = {}
        for day in compact_edited:
            dkey = f"day-{day.get('day')}"
            if not (day.get("places") or []):
                details[dkey] = [{"note": "Ngày trống - không có địa điểm nào được lên kế hoạch."}]
            else:
                details[dkey] = []
        res["details"] = details

    # include raw for debugging
    if raw_reply:
        res.setdefault("_raw", raw_reply)

    # Try to fill missing days using DB if available
    try:
        # find top-rated destinations for filling (per category)
        def find_top_destinations(limit=3, category_hint=None):
            q = db.session.query(Destination)
            if category_hint:
                like_term = f"%{category_hint}%"
                q = q.filter(db.or_(Destination.category.ilike(like_term), Destination.place_type.ilike(like_term), Destination.name_unaccented.ilike(unidecode(category_hint))))
            q = q.order_by(Destination.rating.desc().nullslast()).limit(limit)
            return q.all()

        optimized = []
        added_from_db = False
        for day in compact_edited:
            daynum = day.get("day")
            items = []
            places = day.get("places") or []
            if not places:
                # attempt to add 2 places (food + sightseeing) from DB
                picks = find_top_destinations(limit=2)
                for p in picks:
                    items.append({
                        "id": f"db-{p.id}",
                        "name": p.name,
                        "type": (p.place_type or p.category or "sightseeing"),
                        "lat": p.latitude,
                        "lng": p.longitude,
                        "start_time": None,
                        "end_time": None,
                        "duration_min": int((p.estimated_duration_hours or 2) * 60),
                        "distance_from_prev_km": 0,
                        "needs_data": False,
                        "why_this_here": "Filled from places_db: top-rated nearby option",
                    })
                if picks:
                    added_from_db = True
            else:
                for p in places:
                    items.append({
                        "id": p.get("id") or None,
                        "name": p.get("name") or "",
                        "type": p.get("category") or "sightseeing",
                        "lat": p.get("lat"),
                        "lng": p.get("lon"),
                        "start_time": p.get("time_slot") or None,
                        "end_time": None,
                        "duration_min": int((p.get("duration_hours") or 0) * 60),
                        "distance_from_prev_km": 0,
                        "needs_data": False,
                        "why_this_here": "kept from edited itinerary",
                    })
            optimized.append({"day": daynum, "items": items})

        # if we added from db, set patch preview flag
        res.setdefault("patch_preview", {})
        res["patch_preview"]["will_add_places_from_db"] = added_from_db
        res.setdefault("optimized_itinerary", optimized)
        # Assign sequential start_time/end_time and reasonable defaults
        try:
            def minutes_to_hhmm(m):
                h = int(m // 60)
                mm = int(m % 60)
                return f"{h:02d}:{mm:02d}"

            for day_obj in res.get("optimized_itinerary", []):
                items = day_obj.get("items", [])
                current = 9 * 60  # start at 09:00
                lunch_present = any((it.get("type") or "").lower() == "food" or ((it.get("name") or "") and ("ăn" in (it.get("name") or "").lower())) for it in items)
                new_items = []
                for it in items:
                    dur = int(it.get("duration_min") or 90)
                    # if we're crossing 12:00 and lunch not present, insert lunch before this item
                    if (not lunch_present) and current < 12*60 and (current + dur) > 12*60:
                        lunch_start = 12 * 60
                        lunch_dur = 60
                        lunch_item = {
                            "id": "LUNCH",
                            "name": "Ăn trưa",
                            "type": "food",
                            "lat": None,
                            "lng": None,
                            "start_time": minutes_to_hhmm(lunch_start),
                            "end_time": minutes_to_hhmm(lunch_start + lunch_dur),
                            "duration_min": lunch_dur,
                            "distance_from_prev_km": 0,
                            "needs_data": True,
                            "why_this_here": "Inserted lunch break",
                        }
                        new_items.append(lunch_item)
                        current = lunch_start + lunch_dur
                        lunch_present = True

                    start = current
                    end = start + dur
                    it["start_time"] = minutes_to_hhmm(start)
                    it["end_time"] = minutes_to_hhmm(end)
                    it["duration_min"] = dur
                    new_items.append(it)
                    current = end

                # if lunch still missing and day spans over 12:00, insert at 12:00
                if (not lunch_present) and any(True for _ in new_items):
                    # insert lunch at 12:00 and shift later items
                    lunch_start = 12 * 60
                    lunch_dur = 60
                    inserted = False
                    for idx, it in enumerate(new_items):
                        try:
                            st = new_items[idx].get("start_time", "00:00")
                            hh, mm = map(int, st.split(":"))
                            s = hh*60 + mm
                        except Exception:
                            s = 9999
                        if s >= lunch_start:
                            lunch_item = {
                                "id": "LUNCH",
                                "name": "Ăn trưa",
                                "type": "food",
                                "lat": None,
                                "lng": None,
                                "start_time": minutes_to_hhmm(lunch_start),
                                "end_time": minutes_to_hhmm(lunch_start + lunch_dur),
                                "duration_min": lunch_dur,
                                "distance_from_prev_km": 0,
                                "needs_data": True,
                                "why_this_here": "Inserted lunch break",
                            }
                            new_items.insert(idx, lunch_item)
                            # shift subsequent items by lunch_dur
                            for j in range(idx+1, len(new_items)):
                                try:
                                    st = new_items[j].get("start_time")
                                    if st:
                                        hh, mm = map(int, st.split(":"))
                                        tmin = hh*60 + mm + lunch_dur
                                        new_items[j]["start_time"] = minutes_to_hhmm(tmin)
                                        new_items[j]["end_time"] = minutes_to_hhmm(tmin + int(new_items[j].get("duration_min",90)))
                                except Exception:
                                    pass
                            inserted = True
                            break
                    if not inserted:
                        # append lunch at end (if nothing to shift)
                        new_items.append({
                            "id": "LUNCH",
                            "name": "Ăn trưa",
                            "type": "food",
                            "lat": None,
                            "lng": None,
                            "start_time": minutes_to_hhmm(lunch_start),
                            "end_time": minutes_to_hhmm(lunch_start + lunch_dur),
                            "duration_min": lunch_dur,
                            "distance_from_prev_km": 0,
                            "needs_data": True,
                            "why_this_here": "Inserted lunch break",
                        })

                day_obj["items"] = new_items
        except Exception as e:
            print("Scheduling fill error:", e)

    except Exception as e:
        # DB lookup failed silently — continue
        print("DB fill error:", e)

    return res


# ----------------- AI Evaluation Route -----------------
@app.route("/api/ai/evaluate_itinerary", methods=["POST"])
def evaluate_itinerary():
    """
    Accepts JSON: { edited_itinerary: [...], original_itinerary?: [...], context?: {...} }
    Returns AI evaluation as structured JSON or a text summary.
    Note: Only edited_itinerary is required. original_itinerary is optional.
    """
    payload = request.get_json() or {}
    edited = payload.get("edited_itinerary")
    original = payload.get("original_itinerary")  # Optional - only used for comparison if provided
    context = payload.get("context") or {}

    # ✅ CHỈ YÊU CẦU edited_itinerary (phần chỉnh sửa)
    if edited is None:
        return jsonify({"error": "edited_itinerary is required"}), 400
    
    # If original_itinerary is not provided, use edited_itinerary as both (for backward compatibility)
    if original is None:
        original = edited

    # If frontend provided specific evaluation instructions, use them (token-efficient)
    eval_instructions = payload.get("evaluation_instructions")

    # Helper: compact itinerary to only necessary fields (minimize tokens)
    def compact_itinerary(itin):
        compact = []
        for day in itin:
            day_obj = {"day": day.get("day")}
            places = []
            for p in day.get("places", []):
                place = {
                    "id": p.get("id"),
                    "name": p.get("name"),
                }
                # include lat/lon if available (useful for grouping)
                if p.get("lat") is not None:
                    place["lat"] = float(p.get("lat"))
                if p.get("lon") is not None:
                    place["lon"] = float(p.get("lon"))
                # include duration and category/time slot if present
                if p.get("duration_hours") is not None:
                    place["duration_hours"] = float(p.get("duration_hours"))
                if p.get("time_slot"):
                    place["time_slot"] = p.get("time_slot")
                if p.get("category"):
                    place["category"] = p.get("category")
                places.append(place)
            day_obj["places"] = places
            compact.append(day_obj)
        return compact

    compact_original = compact_itinerary(original)
    compact_edited = compact_itinerary(edited)

    # Build strict system prompt (use provided eval_instructions when available)
    if eval_instructions:
        system_prompt = eval_instructions.strip()
        if "Return ONLY a single, valid JSON object" not in system_prompt:
            system_prompt += "\nIMPORTANT: Return ONLY a single, valid JSON object following the schema provided by the user. Do NOT include any extra text."
    else:
        # Use the strict English schema described by product requirements
        system_prompt = (
            "You are a Professional Travel Guide with 30 years of experience in creating perfect itineraries.\n"
            "Your expertise includes: route optimization, time management, local insights, and ensuring maximum traveler satisfaction.\n"
            "\n"
            "TASK: (1) Evaluate the edited itinerary vs original. (2) Provide detailed day-by-day suggestions. (3) If requested, produce an optimized itinerary.\n"
            "\n"
            "OPTIMIZATION PRIORITIES (in order of importance):\n"
            "1. GEOGRAPHIC PROXIMITY: Group nearby places together in the same day to minimize travel time and maximize sightseeing time.\n"
            "   - Use lat/lng coordinates to calculate distances between places.\n"
            "   - Places within 5km should be visited on the same day if possible.\n"
            "   - Arrange places in a logical route (minimize backtracking).\n"
            "2. TIME MANAGEMENT: Ensure realistic time allocation.\n"
            "   - Add 'move' type items between places with travel time (estimate: 1km ≈ 1-2 minutes by car, 5km ≈ 1 hour walking).\n"
            "   - Add 'food' type items for meals (breakfast 7-9 AM, lunch 12-2 PM, dinner 6-8 PM).\n"
            "   - Add 'rest' type items for breaks (15-30 min breaks every 2-3 hours of activities).\n"
            "   - Ensure total daily activities fit within reasonable hours (e.g., 8 AM - 8 PM).\n"
            "3. REALISTIC SCHEDULING: Make the itinerary practical and enjoyable.\n"
            "   - Don't overpack days - allow time for travel, meals, and rest.\n"
            "   - Balance activities across days to avoid exhaustion.\n"
            "   - Consider opening hours and typical visit durations.\n"
            "\n"
            "SUMMARY FORMAT (CRITICAL - 3-5 lines, like an experienced tour guide):\n"
            "Write 3-5 sentences (3-5 lines) that:\n"
            "- Assess feasibility based on time and distance\n"
            "- Evaluate pace balance (morning/afternoon/evening)\n"
            "- Mention rest breaks, meals, and travel optimization\n"
            "- Note risks (traffic/weather/opening hours) and light solutions\n"
            "- Use the tone of a 30-year experienced tour guide: professional, insightful, practical\n"
            "\n"
            "Example summary:\n"
            "\"Lịch trình này khả thi về mặt thời gian, với các địa điểm được nhóm hợp lý theo cụm địa lý giúp giảm thiểu thời gian di chuyển.\"\n"
            "\"Nhịp độ được cân bằng tốt giữa các hoạt động buổi sáng và chiều, tuy nhiên Ngày 6 còn trống và nên bổ sung thêm điểm đến.\"\n"
            "\"Các khoảng nghỉ và bữa ăn đã được sắp xếp hợp lý, nhưng cần lưu ý giờ mở cửa của một số địa điểm vào buổi sáng sớm.\"\n"
            "\"Để tối ưu hơn, nên thêm các điểm tham quan gần Khu di tích Tràng Kênh vào Ngày 6 để tận dụng thời gian.\"\n"
            "\n"
            "SUGGESTIONS FORMAT (CRITICAL - Detailed day-by-day timeline 8:00-17:00):\n"
            "The 'suggestions' array MUST contain a COMPLETE day-by-day schedule for EACH day in the itinerary.\n"
            "\n"
            "REQUIREMENTS:\n"
            "- Travel time range: 8:00 AM to 5:00 PM (08:00-17:00) for each day\n"
            "- Default durations: Meals = 30 minutes, Rest breaks = 30 minutes, Travel time = AI estimated based on distance\n"
            "- Balance: Mix sightseeing (prioritize more time for strenuous activities), meals, rest, and travel\n"
            "- Format: \"Day X: HH:MM-HH:MM - [Activity/Place Name] - [Description/Tips]\"\n"
            "- MUST provide suggestions for ALL days in the itinerary\n"
            "- Each day should have a complete timeline from 08:00 to 17:00\n"
            "\n"
            "Example format (complete day schedule):\n"
            "[\n"
            "  \"Day 1: 08:00-10:30 - Tham quan [Place Name] - Địa điểm này tốn sức, nên dành nhiều thời gian. Tip: Đến sớm để tránh đông và chụp ảnh với ánh sáng đẹp.\",\n"
            "  \"Day 1: 10:30-11:00 - Di chuyển đến [Next Place] - Khoảng cách 5km, mất khoảng 30 phút.\",\n"
            "  \"Day 1: 11:00-12:30 - Khám phá [Place Name] - Địa điểm văn hóa, cần thời gian để tham quan kỹ.\",\n"
            "  \"Day 1: 12:30-13:00 - Ăn trưa - Nghỉ ngơi và thưởng thức món địa phương. Thời gian: 30 phút.\",\n"
            "  \"Day 1: 13:00-13:30 - Nghỉ ngơi - Nghỉ giải lao sau bữa trưa. Thời gian: 30 phút.\",\n"
            "  \"Day 1: 13:30-15:30 - Tham quan [Place Name] - Hoạt động nhẹ nhàng, phù hợp buổi chiều.\",\n"
            "  \"Day 1: 15:30-16:00 - Di chuyển - Quay về khách sạn hoặc điểm tiếp theo.\",\n"
            "  \"Day 1: 16:00-17:00 - Nghỉ ngơi hoặc tự do - Thời gian tự do để nghỉ ngơi hoặc khám phá thêm.\",\n"
            "  \"Day 2: 08:00-10:00 - [Activity] tại [Location] - Buổi sáng lý tưởng để tránh nắng nóng.\",\n"
            "  \"Day 2: 10:00-10:30 - Di chuyển - Khoảng cách ngắn, mất 30 phút.\",\n"
            "  ... (continue for ALL days)\n"
            "]\n"
            "\n"
            "IMPORTANT:\n"
            "- Provide suggestions for EVERY day in the itinerary\n"
            "- Each day must have activities from 08:00 to 17:00\n"
            "- Balance strenuous activities (more time) with light activities\n"
            "- Include meals (30 min), rest breaks (30 min), and travel time (AI estimated)\n"
            "- Be specific with place names and times\n"
            "\n"
            "REQUIREMENTS: Return ONLY one single JSON object (no explanations, no markdown, no extra text). Follow this exact top-level schema keys:"
            "score (0-100), severity_color (red|orange|yellow|green), decision (add_days|reorder|fill_missing|balance|ok),"
            "summary (3-5 sentence string, 3-5 lines), suggestions (array of detailed day-by-day strings with times), details_per_day (array), patch_preview (object), optimized_itinerary (array), quality_checks (object).\n"
            "\n"
            "optimized_itinerary format: [ { \"day\": number (1-based), \"items\": [ { \"id\": string|null, \"name\": string, \"type\": \"sightseeing|food|rest|hotel|move\", \"lat\": number|null, \"lng\": number|null, \"start_time\": \"HH:MM\", \"end_time\": \"HH:MM\", \"duration_min\": number, \"distance_from_prev_km\": number, \"needs_data\": boolean, \"why_this_here\": string } ] } ]\n"
            "\n"
            "CRITICAL RULES FOR optimized_itinerary:\n"
            "- Day numbers MUST be 1-based (Day 1, Day 2, etc.)\n"
            "- MUST include ALL days from the original itinerary (do not skip or remove days)\n"
            "- Each day MUST have an 'items' array (can be empty but must exist)\n"
            "- Do NOT return empty itinerary or missing days\n"
            "\n"
            "STRICT RULES - DO NOT VIOLATE:\n"
            "1. NO DUPLICATE PLACES: Each sightseeing place (type='sightseeing') MUST appear only ONCE in the entire itinerary.\n"
            "   - If a place appears in multiple days, you MUST remove duplicates and keep only one instance.\n"
            "   - Reorder days to group nearby places together, but never visit the same place twice.\n"
            "2. NO NEW PLACES: DO NOT add new sightseeing places that are not in the original itinerary.\n"
            "   - You can ONLY add: 'food' (meals), 'rest' (rest breaks), 'move' (travel time)\n"
            "   - You CANNOT add new 'sightseeing' places - only use places from the original itinerary\n"
            "3. IF TOO FEW PLACES: If a day has very few places, INCREASE the duration_min of existing places instead of adding new ones.\n"
            "   - Example: If Day 1 only has 1 place, increase its duration from 90min to 180min or more\n"
            "   - Fill remaining time with meals, rest breaks, and travel time\n"
            "4. REORDERING ALLOWED: You can reorder places across days to optimize travel distance, but:\n"
            "   - Each place still appears only once\n"
            "   - Maintain all original places (no additions, no deletions of sightseeing places)\n"
            "\n"
            "IMPORTANT:\n"
            "- For 'move' items: name should be like \"Travel from [Place A] to [Place B]\" and include distance_from_prev_km.\n"
            "- For 'food' items: name should be like \"Breakfast\", \"Lunch\", or \"Dinner\" and place at appropriate meal times (7-9 AM, 12-2 PM, 6-8 PM).\n"
            "- For 'rest' items: name should be like \"Rest break\" and duration_min should be 30 minutes.\n"
            "- Always calculate and include distance_from_prev_km for each item (0 for first item of day).\n"
            "- If a place has no 'id', use 'name' to identify it and ensure no duplicates.\n"
            "- PRIORITY: Make suggestions array the most detailed and helpful part of your response. Think like a 30-year experienced tour guide."
        )

    user_payload = {
        "original_compact": compact_original,
        "edited_compact": compact_edited,
        "context": context,
    }

    user_content = json.dumps(user_payload, ensure_ascii=False)

    ai = OpenAIChatClient()
    try:
        reply = ai.generate_reply([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])

        parsed = try_parse_json_from_text(reply)

        # Helper to compute severity color
        def severity_from_score(s):
            try:
                s = int(round(float(s)))
            except Exception:
                return "red"
            if s <= 39:
                return "red"
            if s <= 59:
                return "orange"
            if s <= 79:
                return "yellow"
            return "green"

        # Build a normalized strict response from parsed or heuristics
        result = None
        if parsed is not None and isinstance(parsed, dict):
            result = parsed

        if not result:
            # fallback: heuristic evaluator
            heuristic = apply_heuristic_fallback(None, compact_edited, raw_reply=reply)
            # adapt heuristic keys into new strict schema
            score = heuristic.get("score", 50)
            decision = heuristic.get("decision", "balance")
            summary = heuristic.get("summary", "Heuristic evaluation applied.")
            suggestions = heuristic.get("suggestions", [])
            # build details_per_day
            details = []
            for day in compact_edited:
                dkey = f"day-{day.get('day')}"
                notes = heuristic.get("details", {}).get(dkey, [])
                details.append({"day": day.get("day"), "issues": [], "notes": ", ".join([n.get('note') if isinstance(n, dict) else str(n) for n in notes]) if notes else "", "recommended_actions": []})

            # optimized_itinerary: as simple copy of edited (frontend will refine)
            optimized = []
            for day in compact_edited:
                items = []
                for p in day.get("places", []):
                    items.append({
                        "id": p.get("id") or None,
                        "name": p.get("name") or "",
                        "type": p.get("category") or "sightseeing",
                        "lat": p.get("lat"),
                        "lng": p.get("lon"),
                        "start_time": p.get("time_slot") or None,
                        "end_time": None,
                        "duration_min": int((p.get("duration_hours") or 0) * 60),
                        "distance_from_prev_km": 0,
                        "needs_data": False,
                        "why_this_here": "kept from edited itinerary",
                    })
                optimized.append({"day": day.get("day"), "items": items})

            # Ensure summary is 2-3 sentences max
            summary_text = summary
            if summary_text:
                sentences = summary_text.split('. ')
                if len(sentences) > 3:
                    summary_text = '. '.join(sentences[:3]) + '.'
            
            # Ensure suggestions are detailed and day-by-day
            enhanced_suggestions = suggestions
            if not enhanced_suggestions or len(enhanced_suggestions) == 0:
                # Generate basic suggestions from days
                enhanced_suggestions = []
                for day in compact_edited:
                    day_num = day.get("day", 1)
                    places = day.get("places", [])
                    if len(places) == 0:
                        enhanced_suggestions.append(f"Day {day_num}: This day is empty. Consider adding activities or places to visit.")
                    else:
                        for idx, place in enumerate(places[:3]):  # Limit to first 3 places per day
                            place_name = place.get("name", "Place")
                            time_slot = place.get("time_slot", "morning")
                            enhanced_suggestions.append(f"Day {day_num}: {time_slot} - Visit {place_name}. Allow adequate time for travel and rest.")
            
            result = {
                "score": heuristic.get("score", 50),
                "severity_color": severity_from_score(heuristic.get("score", 50)),
                "decision": heuristic.get("decision", "balance"),
                "summary": summary_text,
                "suggestions": enhanced_suggestions,
                "details_per_day": details,
                "patch_preview": {"will_reorder": True, "will_fill_missing": True, "will_add_places_from_db": False, "days_affected": [d.get("day") for d in compact_edited]},
                "optimized_itinerary": optimized,
                "quality_checks": {"has_meals_each_day": False, "has_rest_blocks": True, "total_moves_reasonable": True, "overlaps_found": False, "missing_geo_count": sum(1 for d in compact_edited for p in d.get("places", []) if not p.get("lat") and not p.get("lon"))}
            }

        else:
            # parsed from AI — normalize to required keys, apply heuristics for missing pieces
            score = result.get("score", 0)
            severity = severity_from_score(score)
            # decision mapping: ensure it's one of allowed
            decision = result.get("decision") or "balance"
            if decision not in ["add_days", "reorder", "fill_missing", "balance", "ok"]:
                # map some common synonyms
                mapping = {"accept": "ok", "revise": "balance", "add_days": "add_days", "reorder": "reorder", "fill_missing": "fill_missing"}
                decision = mapping.get(decision, "balance")

            # details_per_day: try to construct from result.details or result.details_per_day
            details_per_day = []
            raw_details = result.get("details_per_day") or result.get("details") or {}
            if isinstance(raw_details, dict):
                for k, v in raw_details.items():
                    # extract day number
                    m = re.search(r"(\d+)$", str(k))
                    daynum = int(m.group(1)) if m else None
                    notes = []
                    if isinstance(v, list):
                        for it in v:
                            if isinstance(it, dict) and it.get("note"):
                                notes.append(str(it.get("note")))
                            else:
                                notes.append(str(it))
                    else:
                        notes.append(str(v))
                    details_per_day.append({"day": daynum, "issues": [], "notes": ", ".join(notes), "recommended_actions": []})
            elif isinstance(raw_details, list):
                for entry in raw_details:
                    details_per_day.append(entry)

            optimized = result.get("optimized_itinerary") or result.get("suggested_itinerary") or []

            # Ensure summary is 3-5 sentences (3-5 lines) like an experienced tour guide
            summary_text = result.get("summary", "")
            if not summary_text or len(summary_text.strip()) < 20:
                # Generate fallback summary if missing or too short
                total_days = len(compact_edited)
                empty_days = sum(1 for d in compact_edited if not d.get("places") or len(d.get("places", [])) == 0)
                total_places = sum(len(d.get("places", [])) for d in compact_edited)
                
                summary_parts = []
                summary_parts.append(f"Lịch trình có {total_days} ngày với tổng cộng {total_places} địa điểm tham quan.")
                if empty_days > 0:
                    summary_parts.append(f"Có {empty_days} ngày còn trống, nên bổ sung thêm địa điểm để tận dụng thời gian.")
                summary_parts.append("Cần cân bằng giữa các hoạt động tham quan, ăn uống và nghỉ ngơi để có trải nghiệm tốt nhất.")
                if total_places > 0:
                    avg_per_day = total_places / total_days
                    if avg_per_day > 4:
                        summary_parts.append("Một số ngày có quá nhiều địa điểm, nên giảm bớt hoặc tăng thời gian tham quan.")
                    elif avg_per_day < 1:
                        summary_parts.append("Nên thêm nhiều địa điểm hơn để làm phong phú lịch trình.")
                summary_text = " ".join(summary_parts)
            elif summary_text:
                sentences = summary_text.split('. ')
                if len(sentences) > 5:
                    summary_text = '. '.join(sentences[:5]) + '.'
            
            # Enhance suggestions if they're not detailed enough - generate complete timeline (8:00-17:00)
            suggestions_list = result.get("suggestions", [])
            if not suggestions_list or len(suggestions_list) == 0:
                # Generate detailed day-by-day suggestions with complete timeline
                suggestions_list = []
                for day in compact_edited:
                    day_num = day.get("day", 1)
                    places = day.get("places", [])
                    
                    if len(places) == 0:
                        # Empty day - suggest full schedule
                        suggestions_list.extend([
                            f"Day {day_num}: 08:00-10:00 - Tham quan địa điểm - Nên thêm địa điểm tham quan vào buổi sáng.",
                            f"Day {day_num}: 10:00-10:30 - Di chuyển - Thời gian di chuyển giữa các địa điểm.",
                            f"Day {day_num}: 10:30-12:30 - Tham quan địa điểm - Tiếp tục khám phá.",
                            f"Day {day_num}: 12:30-13:00 - Ăn trưa - Nghỉ ngơi và thưởng thức bữa trưa (30 phút).",
                            f"Day {day_num}: 13:00-13:30 - Nghỉ ngơi - Nghỉ giải lao sau bữa trưa (30 phút).",
                            f"Day {day_num}: 13:30-15:30 - Tham quan địa điểm - Hoạt động buổi chiều.",
                            f"Day {day_num}: 15:30-16:00 - Di chuyển - Quay về hoặc di chuyển đến điểm tiếp theo.",
                            f"Day {day_num}: 16:00-17:00 - Nghỉ ngơi hoặc tự do - Thời gian tự do để nghỉ ngơi.",
                        ])
                    else:
                        # Generate suggestions based on existing places with timeline
                        current_time = 8 * 60  # Start at 8:00 AM (in minutes)
                        for idx, place in enumerate(places):
                            place_name = place.get("name", "Địa điểm")
                            duration = place.get("duration_hours", 2) * 60  # Convert to minutes
                            
                            start_hour = current_time // 60
                            start_min = current_time % 60
                            end_time = current_time + duration
                            end_hour = end_time // 60
                            end_min = end_time % 60
                            
                            start_str = f"{start_hour:02d}:{start_min:02d}"
                            end_str = f"{end_hour:02d}:{end_min:02d}"
                            
                            suggestions_list.append(
                                f"Day {day_num}: {start_str}-{end_str} - {place_name} - Tham quan địa điểm này."
                            )
                            
                            current_time = end_time
                            
                            # Add travel time if not last place
                            if idx < len(places) - 1:
                                current_time += 30  # 30 min travel
                                travel_hour = current_time // 60
                                travel_min = current_time % 60
                                travel_str = f"{travel_hour:02d}:{travel_min:02d}"
                                suggestions_list.append(
                                    f"Day {day_num}: {end_str}-{travel_str} - Di chuyển - Khoảng cách giữa các địa điểm."
                                )
                            
                            # Add lunch break around 12:30
                            if 12 * 60 <= current_time < 13 * 60 and idx < len(places) - 1:
                                lunch_start = current_time
                                lunch_end = lunch_start + 30
                                lunch_start_str = f"{lunch_start // 60:02d}:{lunch_start % 60:02d}"
                                lunch_end_str = f"{lunch_end // 60:02d}:{lunch_end % 60:02d}"
                                suggestions_list.append(
                                    f"Day {day_num}: {lunch_start_str}-{lunch_end_str} - Ăn trưa - Nghỉ ngơi và thưởng thức bữa trưa (30 phút)."
                                )
                                current_time = lunch_end
            
            result = {
                "score": score,
                "severity_color": severity,
                "decision": decision,
                "summary": summary_text,
                "suggestions": suggestions_list,
                "details_per_day": details_per_day,
                "patch_preview": result.get("patch_preview", {"will_reorder": decision in ["reorder", "add_days"], "will_fill_missing": decision == "fill_missing", "will_add_places_from_db": False, "days_affected": [d.get("day") for d in compact_edited]}),
                "optimized_itinerary": optimized,
                "quality_checks": result.get("quality_checks", {"has_meals_each_day": True, "has_rest_blocks": True, "total_moves_reasonable": True, "overlaps_found": False, "missing_geo_count": 0})
            }

        return jsonify({"ok": True, "result": result})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# @app.route('/api/locations', methods=['GET'])
# def api_locations():
#     """Return deduplicated list of locations discovered in backend data files.

#     Useful for client-side classifier or autocomplete to prioritize database lookup
#     before falling back to AI.
#     """
#     try:
#         locs = load_locations()
#         return jsonify({"ok": True, "locations": locs})
#     except Exception as e:
#         return jsonify({"ok": False, "error": str(e)}), 500


# ----------------- AI Reorder Route -----------------
@app.route("/api/ai/reorder_itinerary", methods=["POST"])
def reorder_itinerary():
    """
    Accepts JSON: { edited_itinerary: [...], original_itinerary?: [...], context?: {...} }
    Returns suggested_itinerary as structured JSON where only ordering of places may be changed.
    Note: Only edited_itinerary is required. original_itinerary is optional.
    """
    payload = request.get_json() or {}
    edited = payload.get("edited_itinerary")
    original = payload.get("original_itinerary")  # Optional - only used for comparison if provided
    context = payload.get("context") or {}

    # ✅ CHỈ YÊU CẦU edited_itinerary (phần chỉnh sửa)
    if edited is None:
        return jsonify({"error": "edited_itinerary is required"}), 400
    
    # If original_itinerary is not provided, use edited_itinerary as both (for backward compatibility)
    if original is None:
        original = edited

    system_prompt = (
        "You are a Professional Travel Guide with 30 years of experience optimizing travel itineraries.\n"
        "\n"
        "PRIMARY OPTIMIZATION GOALS:\n"
        "1. GEOGRAPHIC CLUSTERING: Group nearby places together in the same day.\n"
        "   - Calculate distances using lat/lng coordinates (Haversine formula).\n"
        "   - Places within 5km should be grouped together when possible.\n"
        "   - Arrange places in a logical route to minimize backtracking.\n"
        "   - Priority: minimize total travel distance and time.\n"
        "\n"
        "2. AUTOMATIC MEAL & REST INSERTION:\n"
        "   - Add 'food' type items for meals at appropriate times:\n"
        "     * Breakfast: 7:00-9:00 AM\n"
        "     * Lunch: 12:00-14:00 PM\n"
        "     * Dinner: 18:00-20:00 PM\n"
        "   - Add 'rest' type items (30 min) every 2-3 hours of continuous activities.\n"
        "   - Add 'move' type items between places with realistic travel time:\n"
        "     * Calculate distance_from_prev_km using coordinates.\n"
        "     * Estimate travel time: ~1-2 min/km by car, ~12 min/km walking.\n"
        "     * Set duration_min based on estimated travel time.\n"
        "\n"
        "3. REALISTIC TIME ALLOCATION:\n"
        "   - Ensure daily schedule fits within 8:00 AM - 5:00 PM (08:00-17:00).\n"
        "   - Don't overpack - allow buffer time for unexpected delays.\n"
        "   - Balance activities across days to avoid exhaustion.\n"
        "\n"
        "STRICT RULES - DO NOT VIOLATE:\n"
        "1. NO DUPLICATE PLACES: Each sightseeing place (type='sightseeing') MUST appear only ONCE in the entire itinerary.\n"
        "   - Check by 'id' first, then by 'name' if 'id' is missing\n"
        "   - If a place appears in multiple days, remove duplicates and keep only one instance\n"
        "   - Reorder days to group nearby places, but never visit the same place twice\n"
        "2. NO NEW PLACES: DO NOT add new sightseeing places that are not in the original/edited itinerary.\n"
        "   - You can ONLY add: 'food' (meals), 'rest' (rest breaks), 'move' (travel time)\n"
        "   - You CANNOT add new 'sightseeing' places - only use places from the input itinerary\n"
        "3. IF TOO FEW PLACES: If a day has very few places, INCREASE the duration_min of existing places instead of adding new ones.\n"
        "   - Example: If Day 1 only has 1 place, increase its duration from 90min to 180min, 240min, or more\n"
        "   - Fill remaining time (8:00-17:00) with meals, rest breaks, and travel time\n"
        "   - Default: Meals = 30 min, Rest = 30 min, Travel = AI estimated\n"
        "4. REORDERING ALLOWED: You can reorder places across days to optimize travel distance, but:\n"
        "   - Each place still appears only once\n"
        "   - Maintain all original places (no additions, no deletions of sightseeing places)\n"
        "\n"
        "OUTPUT FORMAT:\n"
        "RETURN A SINGLE JSON object with key 'optimized_itinerary' (preferred) or 'suggested_itinerary' (fallback).\n"
        "Format: [ { \"day\": number (1-based), \"items\": [ { \"id\": string|null, \"name\": string, \"type\": \"sightseeing|food|rest|hotel|move\", \"lat\": number|null, \"lng\": number|null, \"start_time\": \"HH:MM\", \"end_time\": \"HH:MM\", \"duration_min\": number, \"distance_from_prev_km\": number, \"needs_data\": boolean, \"why_this_here\": string } ] } ]\n"
        "\n"
        "CRITICAL RULES:\n"
        "- Day numbers MUST be 1-based (Day 1, Day 2, etc.)\n"
        "- MUST include ALL days from the original itinerary (do not skip or remove days)\n"
        "- Each day MUST have an 'items' array (can be empty but must exist)\n"
        "- For 'move' items: name = \"Travel from [Place A] to [Place B]\", include accurate distance_from_prev_km and duration_min.\n"
        "- For 'food' items: name = \"Breakfast\" / \"Lunch\" / \"Dinner\", set appropriate start_time (7-9 AM, 12-2 PM, 6-8 PM), duration_min = 30.\n"
        "- For 'rest' items: name = \"Rest break\", duration_min = 30.\n"
        "- Always calculate distance_from_prev_km for each item (0 for first item of day).\n"
        "- Do NOT invent real places. If data is missing, mark with \"needs_data\": true.\n"
        "- Prefer places from places_db when available.\n"
        "\n"
        "Return only valid JSON, no extra explanation. If you cannot produce the structure, return { \"raw\": <text> }"
    )

    user_content = (
        f"Original itinerary:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n\n"
        f"Edited itinerary:\n{json.dumps(edited, ensure_ascii=False, indent=2)}\n\n"
        f"Context:\n{json.dumps(context, ensure_ascii=False)}"
    )

    ai = OpenAIChatClient()
    try:
        reply = ai.generate_reply([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])

        try:
            parsed = try_parse_json_from_text(reply) or None
            if isinstance(parsed, dict):
                if "optimized_itinerary" in parsed:
                    return jsonify({"ok": True, "result": parsed})
                if "suggested_itinerary" in parsed:
                    return jsonify({"ok": True, "result": parsed})
                # maybe the AI returned optimized_itinerary at top-level under different name
                # if it contains an array at top level, wrap it
                for k, v in parsed.items():
                    if isinstance(v, list) and all(isinstance(x, dict) for x in v):
                        return jsonify({"ok": True, "result": {"suggested_itinerary": v}})
                return jsonify({"ok": True, "result": {"raw": reply}})
            elif isinstance(parsed, list):
                return jsonify({"ok": True, "result": {"suggested_itinerary": parsed}})
            else:
                return jsonify({"ok": True, "result": {"raw": reply}})
        except Exception:
            return jsonify({"ok": True, "result": {"raw": reply}})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ----------------- DEV: Inspect AI Output -----------------
@app.route("/api/dev/inspect_ai_output", methods=["POST"])
def inspect_ai_output():
    """Developer endpoint: accept AI output (or optimized_itinerary) and return:
    - mapped frontend-friendly itinerary structure
    - validation issues per day/item
    This helps trace where AI-produced places would flow and what needs fixing.
    """
    payload = request.get_json() or {}
    ai_result = payload.get("ai_result") or payload.get("result") or payload.get("optimized_itinerary") or payload

    # normalize to list of day objects
    optimized = None
    if isinstance(ai_result, dict) and "optimized_itinerary" in ai_result:
        optimized = ai_result.get("optimized_itinerary")
    elif isinstance(ai_result, list):
        optimized = ai_result
    elif isinstance(ai_result, dict) and all(isinstance(v, list) for v in ai_result.values()):
        # maybe keyed by day
        optimized = []
        for k, v in ai_result.items():
            try:
                daynum = int(re.search(r"(\d+)", str(k)).group(1))
            except Exception:
                daynum = None
            optimized.append({"day": daynum, "items": v})
    else:
        # fallback: try to extract optimized_itinerary key
        optimized = []

    mapped_days = []
    issues = {"total": 0, "per_day": {}}

    time_re = re.compile(r"^\d{1,2}:\d{2}$")

    for day_obj in optimized:
        daynum = day_obj.get("day")
        raw_items = day_obj.get("items") or day_obj.get("places") or []
        mapped = []
        day_issues = []
        for idx, it in enumerate(raw_items):
            # robustly pull fields
            name = (it.get("name") if isinstance(it, dict) else str(it)) or ""
            item_id = None
            try:
                item_id = it.get("id")
            except Exception:
                item_id = None

            lat = None
            lon = None
            for k in ("lat", "latitude", "lng", "lon"):
                if isinstance(it, dict) and it.get(k) is not None:
                    try:
                        val = float(it.get(k))
                        if k in ("lon", "lng"):
                            lon = val
                        else:
                            lat = val
                    except Exception:
                        pass

            start_time = None
            for k in ("start_time", "time_slot", "time"):
                if isinstance(it, dict) and it.get(k):
                    start_time = str(it.get(k))
                    break

            duration_min = None
            for k in ("duration_min", "duration_minutes", "duration"):
                if isinstance(it, dict) and it.get(k) is not None:
                    try:
                        duration_min = int(it.get(k))
                        break
                    except Exception:
                        pass
            if duration_min is None:
                # try hours
                if isinstance(it, dict) and it.get("duration_hours") is not None:
                    try:
                        duration_min = int(float(it.get("duration_hours")) * 60)
                    except Exception:
                        duration_min = None

            needs_data = bool(isinstance(it, dict) and it.get("needs_data"))
            category = None
            if isinstance(it, dict):
                category = it.get("type") or it.get("category") or it.get("place_type")

            mapped_item = {
                "uniqueId": f"ai-{daynum}-{idx}",
                "id": item_id,
                "name": name,
                "category": category or "sightseeing",
                "lat": lat,
                "lon": lon,
                "time_slot": start_time,
                "duration_hours": round(duration_min / 60, 2) if isinstance(duration_min, (int, float)) else None,
                "needs_data": needs_data,
                "raw": it,
            }

            # validation
            if not name:
                day_issues.append({"idx": idx, "issue": "missing_name"})
            if mapped_item["lat"] is None or mapped_item["lon"] is None:
                day_issues.append({"idx": idx, "issue": "missing_geo"})
            if mapped_item["duration_hours"] is None or mapped_item["duration_hours"] == 0:
                day_issues.append({"idx": idx, "issue": "missing_duration"})
            if mapped_item["time_slot"] and not time_re.match(mapped_item["time_slot"]):
                day_issues.append({"idx": idx, "issue": "invalid_time_format", "value": mapped_item["time_slot"]})
            if mapped_item["needs_data"]:
                day_issues.append({"idx": idx, "issue": "marked_needs_data"})

            issues["total"] += len(day_issues)
            mapped.append(mapped_item)

        mapped_days.append({"day": daynum, "items": mapped})
        issues["per_day"][str(daynum)] = day_issues

    return jsonify({"ok": True, "mapped": mapped_days, "issues": issues})

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

# ----------------- Test Route -----------------
from flask_jwt_extended import jwt_required, get_jwt_identity

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

import math
from sqlalchemy import or_, func
from models import db, Destination 
import random 

# --- HÀM HỖ TRỢ (Giữ nguyên hoặc cập nhật để phù hợp) ---

def simple_distance(lat1, lon1, lat2, lon2):
    """Tính khoảng cách đơn giản (Euclidean) giữa hai điểm tọa độ."""
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2)

def get_place_duration(destination_obj):
    """
    Lấy thời lượng tham quan từ trường DB estimated_duration_hours, nếu NULL/0 thì dùng fallback logic.
    (Giữ nguyên logic của bạn)
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

# --- HÀM HỖ TRỢ MỚI: Lấy chi phí từ entry_fee ---
def get_cost_from_entry_fee(destination_obj):
    """Lấy chi phí từ thuộc tính entry_fee. Mặc định là 0.0 nếu không có."""
    cost = getattr(destination_obj, 'entry_fee', 0.0)
    try:
        return float(cost) if cost is not None else 0.0
    except (ValueError, TypeError):
        return 0.0

def generate_itinerary_optimized(
    province_id, 
    duration_days, 
    max_budget,
    must_include_place_ids=None, 
    excluded_ids=None, 
    primary_accommodation_id=None
):
    if must_include_place_ids is None: must_include_place_ids = []
    if excluded_ids is None: excluded_ids = []

    # --- BƯỚC 0: LẤY ĐỐI TƯỢNG KHÁCH SẠN ---
    hotel_obj_final = None
    TOTAL_HOTEL_COST = 0.0
    
    # Ưu tiên lấy từ primary_accommodation_id
    target_hotel_id = primary_accommodation_id
    if not target_hotel_id:
        for pid in must_include_place_ids:
            p = db.session.get(Destination, pid)
            if p and any(kw in (p.place_type or '').lower() for kw in ['hotel', 'resort', 'accommodation']):
                target_hotel_id = pid
                break

    if target_hotel_id:
        hotel_obj = db.session.get(Destination, target_hotel_id)
        if hotel_obj:
            hotel_unit_price = get_cost_from_entry_fee(hotel_obj)
            nights = max(0, duration_days - 1)
            TOTAL_HOTEL_COST = hotel_unit_price * nights
            
            # Chỉ giữ nếu đủ ngân sách
            if max_budget == 0 or TOTAL_HOTEL_COST <= max_budget:
                hotel_obj_final = hotel_obj

    # --- BƯỚC 1: GOM ĐỊA ĐIỂM THAM QUAN (KHÔNG CHỨA HOTEL) ---
    current_activities_cost = 0.0
    # Loại bỏ ID khách sạn khỏi danh sách tham quan để tránh trùng lặp
    activity_must_ids = [pid for pid in must_include_place_ids if pid != (hotel_obj_final.id if hotel_obj_final else None)]
    
    selected_activities = []
    EXCLUDED_TYPES = ['hotel', 'accommodation', 'resort', 'motel', 'homestay']

    # 1.1 Thêm các điểm bắt buộc
    for pid in activity_must_ids:
        p = db.session.get(Destination, pid)
        if not p or p.id in excluded_ids: continue
        cost = get_cost_from_entry_fee(p)
        if max_budget == 0 or (TOTAL_HOTEL_COST + current_activities_cost + cost <= max_budget):
            selected_activities.append(p)
            current_activities_cost += cost

    # 1.2 Lấy thêm điểm từ database (Sửa lỗi mất địa điểm: Lấy rộng hơn)
    remaining_budget = max_budget - (TOTAL_HOTEL_COST + current_activities_cost) if max_budget > 0 else 999999999
    all_excluded = set(must_include_place_ids) | set(excluded_ids)
    if hotel_obj_final: all_excluded.add(hotel_obj_final.id)

    potential_places = Destination.query.filter(
        Destination.province_id == province_id,
        Destination.id.notin_(all_excluded),
        ~or_(*[func.lower(Destination.place_type).contains(t) for t in EXCLUDED_TYPES])
    ).order_by(Destination.rating.desc()).all()

    for p in potential_places:
        if len(selected_activities) >= (duration_days * 4): break # Giới hạn 4 điểm/ngày
        cost = get_cost_from_entry_fee(p)
        if remaining_budget - cost >= 0:
            selected_activities.append(p)
            remaining_budget -= cost
            current_activities_cost += cost

    # --- BƯỚC 2: XÂY DỰNG LỊCH TRÌNH ---
    # Hàm tạo dict chuẩn cho 1 địa điểm
    def create_node(p, time_slot, est_cost=None):
        return {
            "id": p.id,
            "name": p.name,
            "category": getattr(p, 'category', 'General'),
            "type": getattr(p, 'place_type', 'point_of_interest'),
            "time_slot": time_slot,
            "estimated_cost": est_cost if est_cost is not None else get_cost_from_entry_fee(p)
        }

    # Chuyển đổi danh sách tham quan sang dict và trộn ngẫu nhiên
    unassigned_acts = []
    for p in selected_activities:
        unassigned_acts.append({
            "obj": p,
            "duration": get_place_duration(p)
        })
    random.shuffle(unassigned_acts)

    final_itinerary = []
    for day in range(1, duration_days + 1):
        day_places = []
        curr_time = 8.0

        # A. KHÁCH SẠN ĐẦU NGÀY
        if hotel_obj_final:
            day_places.append(create_node(hotel_obj_final, "08:00 - 08:30", est_cost=0.0))
            curr_time = 8.5

        # B. CÁC ĐỊA ĐIỂM THAM QUAN
        while unassigned_acts:
            item = unassigned_acts.pop(0)
            dur = item['duration']
            if curr_time + dur <= 18.0:
                start_str = f"{int(curr_time):02d}:{int((curr_time%1)*60):02d}"
                end_t = curr_time + dur
                end_str = f"{int(end_t):02d}:{int((end_t%1)*60):02d}"
                
                day_places.append(create_node(item['obj'], f"{start_str} - {end_str}"))
                curr_time = end_t + 0.5 # 30p di chuyển
            else:
                unassigned_acts.insert(0, item)
                break

        # C. KHÁCH SẠN CUỐI NGÀY
        if hotel_obj_final:
            day_places.append(create_node(hotel_obj_final, "19:00 - 22:00", est_cost=0.0))

        final_itinerary.append({"day": day, "places": day_places})

    # Dữ liệu khách sạn để lưu vào metadata
    hotel_info = None
    if hotel_obj_final:
        hotel_info = {
            "id": hotel_obj_final.id,
            "name": hotel_obj_final.name,
            "price_per_night": get_cost_from_entry_fee(hotel_obj_final),
            "total_hotel_cost": TOTAL_HOTEL_COST
        }

    return {
        "itinerary": final_itinerary, 
        "total_estimated_cost": TOTAL_HOTEL_COST + current_activities_cost,
        "hotel_info": hotel_info
    }

# -------------------------------------------------------------
# ENDPOINT /api/trips (POST) 
# -------------------------------------------------------------

@app.route("/api/trips", methods=["POST"])
@jwt_required()
def create_trip():
    data = request.get_json() or {}
    print("Dữ liệu nhận được từ Frontend:", data)
    user_id = int(get_jwt_identity())
    
    name = data.get("name")
    start_date_str = data.get("start_date") 
    
    # 🔑 NHẬN METADATA VÀ NGÂN SÁCH (Lấy trực tiếp từ data)
    metadata = data.get("metadata", {}) 
    max_budget = data.get("max_budget", 0) # ⭐ Lấy từ payload chính của Frontend
    
    primary_accommodation_id = metadata.get("primary_accommodation_id") 
    
    if primary_accommodation_id is not None:
        try:
            primary_accommodation_id = int(primary_accommodation_id)
        except (ValueError, TypeError):
            primary_accommodation_id = None

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
        itinerary_result = generate_itinerary_optimized(
            province_id, 
            duration_days, 
            max_budget=max_budget,
            must_include_place_ids=must_include_place_ids, 
            primary_accommodation_id=primary_accommodation_id
        )
        
        itinerary_draft = itinerary_result.get("itinerary", [])
        total_cost = itinerary_result.get("total_estimated_cost", 0)
        hotel_info = itinerary_result.get("hotel_info") # Lấy thông tin hotel riêng
        
        # 🔑 LƯU VÀO METADATA
        new_metadata = metadata.copy()
        new_metadata['total_estimated_cost'] = total_cost
        new_metadata['hotel'] = hotel_info
        
        # Serialize để lưu DB
        itinerary_json = json.dumps(itinerary_draft, ensure_ascii=False)
        metadata_json = json.dumps(metadata, ensure_ascii=False) 
        
        new_trip = Itinerary(
            user_id=user_id,
            name=name,
            province_id=province_id,
            duration=duration_days,
            itinerary_json=itinerary_json,
            metadata_json=metadata_json,
            start_date=calculated_start_date,
            end_date=calculated_end_date,
            status=status,
            created_at=datetime.now()
        )
        db.session.add(new_trip)
        db.session.commit()
        
        return jsonify({
            "message": "Trip created successfully.",
            "trip": {
                "id": new_trip.id,
                "name": new_trip.name,
                "itinerary": itinerary_draft, # Trong này sẽ không có khách sạn
                "metadata": metadata         # Trong này có key 'hotel' chứa thông tin khách sạn
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Error: {str(e)}"}), 500
    
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
        "province_id": trip.province_id,
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
    
@app.route("/api/trips/<int:trip_id>/regenerate", methods=["POST"])
@jwt_required()
def regenerate_trip_itinerary(trip_id):
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    
    trip = db.session.get(Itinerary, trip_id)

    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found or unauthorized access."}), 404
    
    old_metadata = json.loads(trip.metadata_json) if trip.metadata_json else {}

    province_id = data.get("province_id", trip.province_id)
    duration_days = data.get("duration", trip.duration)
    must_include_place_ids = data.get("must_include_place_ids", [])

    # ✅ FIX 1: Luôn resolve max_budget rõ ràng
    max_budget = data.get("max_budget")
    if max_budget is None:
        max_budget = old_metadata.get("max_budget", 0)

    if not all([province_id, duration_days]):
        return jsonify({"message": "Province ID and duration are required for regeneration."}), 400

    try:
        itinerary_result = generate_itinerary_optimized(
            province_id=province_id,
            duration_days=duration_days,
            max_budget=max_budget,
            must_include_place_ids=must_include_place_ids,
            primary_accommodation_id=old_metadata.get("primary_accommodation_id")
        )

        itinerary_draft = itinerary_result.get("itinerary", [])
        total_estimated_cost = itinerary_result.get("total_estimated_cost", 0)
        has_hotel = itinerary_result.get("has_hotel", False)

        if not itinerary_draft and not must_include_place_ids:
            return jsonify({"message": "No suitable destinations found to create an itinerary."}), 400

        # ✅ FIX 2: Lưu itinerary
        trip.itinerary_json = json.dumps(itinerary_draft, ensure_ascii=False)

        # ✅ FIX 3: Update metadata ĐẦY ĐỦ & ĐỒNG BỘ
        new_metadata = old_metadata.copy()
        new_metadata.update({
            "max_budget": max_budget,
            "total_estimated_cost": total_estimated_cost,
            "primary_accommodation_id": (
                old_metadata.get("primary_accommodation_id") if has_hotel else None
            )
        })

        trip.metadata_json = json.dumps(new_metadata, ensure_ascii=False)
        trip.updated_at = datetime.now()

        db.session.commit()

        province_name = trip.province.name if trip.province else "Unknown Province"

        return jsonify({
            "message": "Itinerary successfully regenerated.",
            "trip": {
                "id": trip.id,
                "name": trip.name,
                "province_name": province_name,
                "itinerary": itinerary_draft,
                "duration": trip.duration,
                "metadata": new_metadata
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({
            "message": f"An error occurred during itinerary regeneration: {str(e)}"
        }), 500

# API: MỞ RỘNG CHUYẾN ĐI (THÊM 1 NGÀY VÀO LỊCH TRÌNH)
@app.route("/api/trips/<int:trip_id>/extend", methods=["POST"])
@jwt_required()
def extend_trip_itinerary(trip_id):
    data = request.get_json() or {}
    user_id = int(get_jwt_identity())
    
    trip = db.session.get(Itinerary, trip_id)

    if not trip or trip.user_id != user_id:
        return jsonify({"message": "Trip not found or unauthorized access."}), 404
        
    duration_new = data.get("duration") 
    new_day_number = data.get("new_day")
    province_id = data.get("province_id", trip.province_id)
    # ⭐ NHẬN THAM SỐ MỚI
    used_place_ids = data.get("used_place_ids", []) 

    if duration_new is None or new_day_number is None or new_day_number != duration_new:
        return jsonify({"message": "Invalid extension data (new duration and new day must match)."}), 400
    
    # Cập nhật Duration và Status/Dates trước
    trip.duration = duration_new 
    if trip.start_date:
        trip.end_date = trip.start_date + timedelta(days=duration_new - 1)
        current_date = datetime.now().date()
        if trip.start_date > current_date:
            trip.status = 'UPCOMING'
        elif trip.end_date >= current_date:
            trip.status = 'ONGOING'
        else:
            trip.status = 'COMPLETED'

    try:
        # 1. Tái tạo lịch trình chỉ cho 1 ngày mới, loại trừ các địa điểm đã dùng
        itinerary_draft_for_new_day = generate_itinerary_optimized(
            province_id, 
            1, 
            must_include_place_ids=[], 
            excluded_ids=used_place_ids # ⭐ TRUYỀN DANH SÁCH ĐÃ DÙNG VÀO HÀM LOGIC
        ) 
        
        # 2. Kiểm tra nếu không có địa điểm mới nào được tạo
        if not itinerary_draft_for_new_day or not itinerary_draft_for_new_day[0]['places']:
            db.session.commit() # Commit cập nhật duration/status
            # ⭐ TRẢ VỀ THÔNG BÁO CHO FRONTEND
            return jsonify({
                "message": "No suitable destinations found to create an itinerary for the new day.",
                "new_day_itinerary": json.loads(trip.itinerary_json) if trip.itinerary_json else []
            }), 200
            
        current_itinerary = json.loads(trip.itinerary_json) if trip.itinerary_json else []
        
        # 3. Nối lịch trình mới vào lịch trình cũ
        day_content = itinerary_draft_for_new_day[0]
        day_content['day'] = new_day_number
        current_itinerary.append(day_content)
        current_itinerary.sort(key=lambda x: x['day'])
            
        # 4. Lưu lịch trình mới
        trip.itinerary_json = json.dumps(current_itinerary, ensure_ascii=False)
        trip.updated_at = datetime.now()
        db.session.commit()
        
        return jsonify({
            "message": f"Trip successfully extended to Day {new_day_number}.",
            "new_day_itinerary": current_itinerary 
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error extending trip itinerary: {e}")
        return jsonify({"message": "An error occurred during trip extension."}), 500
    
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
    