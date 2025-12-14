# backend/seed.py
import json
import os
import random 
from app import app
from models import db, Region, Province, Destination, DestinationImage
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from unidecode import unidecode # Thư viện cần thiết

# Danh sách các file JSON cần đọc
JSON_FILES = ["data/mienbac.json", "data/mientrung.json", "data/miennam.json"]

# CẤU HÌNH RANDOM CHUNG
REGION_CONFIG = {
    "Miền Bắc": {"temp_min": 15, "temp_max": 35, "weather_types": ["Sunny", "Cloudy", "Rainy"]},
    "Miền Trung": {"temp_min": 27, "temp_max": 39, "weather_types": ["Sunny", "Hot", "Clear"]},
    "Miền Nam": {"temp_min": 25, "temp_max": 36, "weather_types": ["Sunny", "Hot", "Cloudy", "Rainy"]},
}
RATING_MIN = 3.8
RATING_MAX = 5.0
DEFAULT_CATEGORY = ["Nature", "City", "Cultural"] 

# --- LOGIC ƯỚC TÍNH THỜI LƯỢNG NÂNG CAO (ĐÃ GIẢM GIỚI HẠN) ---

# 1. Tags ưu tiên thời lượng (Override giá trị cơ bản)
DURATION_TAGS_MAP = {
    "Full Day": 5.0,        # Giảm từ 6.0 xuống 5.0
    "Half Day": 2.5,        # Giảm từ 3.0 xuống 2.5
    "2 Days": 4.0,          # Giảm từ 5.0 xuống 4.0 (Điểm neo quan trọng)
    "3+ Days": 4.0,
    "Weekend Trip": 5.0,
    "Overnight": 5.0,
    "Multi-day Adventure": 5.0,
}

# 2. Loại Địa điểm (Place Type) cung cấp bonus thời gian
LONG_STAY_TYPES = ["Mountain", "Island", "Nature Park", "Adventure"] # +1.5 giờ
MEDIUM_STAY_TYPES = ["Historical Site", "Cultural Site", "Urban Area", "Lake/River"] # +0.5 giờ

# 3. Tags Hoạt động/Tính năng
ACTIVITY_BONUS_TAGS = [
    "Trekking/Hiking",
    "Camping",
    "Relaxation/Resort",
    "Water Sports",
    "Wildlife Watching",
    "Cultural Immersion",
    "Adventure Sports",
    "Local Workshop",
]

def estimate_duration_from_all_metrics(place_type, tags_json, entry_fee, description):
    """
    Ước tính thời lượng tham quan (tính bằng giờ) dựa trên Tags, Type, Phí vào cửa và Mô tả.
    """
    
    # Base Duration: 1.5 giờ (Giảm từ 2.0 giờ)
    duration = 1.5 
    
    tags_list = []
    if tags_json:
        try:
            tags_list = json.loads(tags_json)
        except (json.JSONDecodeError, TypeError):
            pass

    # 1. 🥇 Ưu tiên Cao nhất: DURATION TAGS (Nếu có, ghi đè tất cả)
    for tag in tags_list:
        if tag in DURATION_TAGS_MAP:
            return DURATION_TAGS_MAP[tag] 

    # 2. Modifier: PLACE TYPE
    if place_type in LONG_STAY_TYPES:
        duration += 1.5  
    elif place_type in MEDIUM_STAY_TYPES:
        duration += 0.5  

    # 3. Modifier: ACTIVITY/FEATURE TAGS (Max +1.5 giờ)
    activity_bonus = 0.0
    for tag in tags_list:
        if tag in ACTIVITY_BONUS_TAGS:
            activity_bonus += 0.5
    
    # Giới hạn bonus từ tags hoạt động
    duration += min(activity_bonus, 1.5) 

    # 4. Modifier: ENTRY FEE & DESCRIPTION LENGTH (Max +1.0 giờ)

    # Entry Fee Bonus (> 500k VNĐ)
    if entry_fee and entry_fee > 500000: 
        duration += 0.5

    # Description Length Bonus (Mô tả dài > 500 ký tự)
    if description and len(description) > 500:
        duration += 0.5

    # 5. Final Check & Cap: Giới hạn tối đa 6.0 giờ
    return max(1.0, min(duration, 6.0)) 


# --- CÁC HÀM HỖ TRỢ KHÁC ---

def load_data_from_json(file_paths):
    """Đọc và hợp nhất dữ liệu từ danh sách các file JSON."""
    all_regions_data = []
    for file_path in file_paths:
        full_path = os.path.join(os.path.dirname(__file__), file_path)
        if os.path.exists(full_path):
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    all_regions_data.append(data)
                elif isinstance(data, list):
                    all_regions_data.extend(data)
            except (json.JSONDecodeError, Exception) as e:
                print(f"Lỗi đọc file {file_path}: {e}")
        else:
            print(f"Cảnh báo: Không tìm thấy file {file_path}. Bỏ qua.")
    return all_regions_data

def normalize_entry_fee(fee_value):
    """Chuẩn hóa giá trị phí vào cửa thành Float."""
    if fee_value is None:
        return 0.0
    
    fee_str = str(fee_value).lower().strip()
    
    if 'miễn phí' in fee_str or fee_str == 'none' or fee_str == '0' or fee_str == 'free':
        return 0.0
    
    try:
        numeric_str = fee_str.replace('vnđ', '').replace('vnd', '').replace('.', '').replace(',', '').replace(' ', '')
        
        if numeric_str and numeric_str.isdigit():
            fee_num = float(numeric_str)
            if fee_num > 10000000 and len(numeric_str) > 7: 
                pass
            return fee_num
        else:
            return 0.0
    except ValueError:
        return 0.0

def normalize_opening_hours(hours_value):
    """Chuẩn hóa giá trị giờ mở cửa."""
    if not hours_value or isinstance(hours_value, list):
        return "Cả ngày"
    return str(hours_value).strip()

def generate_random_metrics(region_name):
    """Tạo Rating và Category ngẫu nhiên dựa trên Vùng."""
    config = REGION_CONFIG.get(region_name, REGION_CONFIG["Miền Nam"]) 
    rating = round(random.uniform(RATING_MIN, RATING_MAX), 1)
    category = random.choice(DEFAULT_CATEGORY)
    temp = random.randint(config["temp_min"], config["temp_max"])
    weather_type = random.choice(config["weather_types"])
    weather = f"{weather_type} {temp}°C"
    return rating, weather, category


# --- HÀM SEED DATABASE (CẬP NHẬT) ---

def seed_database():
    """Seed dữ liệu phân cấp từ JSON vào database."""
    print("--- Bắt đầu Seeding/Cập nhật Dữ liệu Địa điểm ---")
    
    data = load_data_from_json(JSON_FILES)
    
    if not data:
        print("Không có dữ liệu để seed. Kiểm tra các file JSON.")
        return

    with app.app_context():
        db.create_all()
        for region_data in data:
            region_name = region_data.get("region_name")
            if not region_name:
                continue

            region = Region.query.filter_by(name=region_name).first()
            if not region:
                 try:
                    region = Region(name=region_name)
                    db.session.add(region)
                    db.session.commit() 
                 except IntegrityError:
                    db.session.rollback()
                    region = Region.query.filter_by(name=region_name).first() 

            print(f"Đang xử lý Vùng: {region_name}")
            
            for province_data in region_data.get("provinces", []):
                province_name = province_data.get("province_name")
                if not province_name:
                    continue

                province_name_unaccented = unidecode(province_name).lower()

                province = Province.query.filter_by(name=province_name).first()
                if not province:
                    try:
                        province = Province(
                            name=province_name,
                            name_unaccented=province_name_unaccented, 
                            overview=province_data.get("overview"),
                            image_url=province_data.get("image_url"),
                            region_id=region.id 
                        )
                        db.session.add(province)
                        db.session.commit() 
                    except IntegrityError:
                        db.session.rollback()
                        province = Province.query.filter_by(name=province_name).first()
                else:
                    province.name_unaccented = province_name_unaccented

                print(f"  Đang xử lý Tỉnh: {province_name}")

                places_raw = province_data.get("places", [])
                places_list = []
                for item in places_raw:
                    if isinstance(item, list):
                        places_list.extend(item)
                    elif isinstance(item, dict):
                        places_list.append(item)
                
                with db.session.no_autoflush:
                    # Lặp qua từng Địa điểm (Destination)
                    for dest_data in places_list:
                        
                        if not isinstance(dest_data, dict):
                            continue

                        dest_name = dest_data.get("name")
                        if not dest_name:
                            continue
                            
                        dest_name_unaccented = unidecode(dest_name).lower()
                            
                        # RANDOM METRICS CHO DESTINATION
                        rating, weather_str, category_str = generate_random_metrics(region_name)

                        # 4. Chuẩn hóa dữ liệu
                        entry_fee_normalized = normalize_entry_fee(dest_data.get("entry_fee"))
                        opening_hours_normalized = normalize_opening_hours(dest_data.get("opening_hours"))
                        
                        # Lấy mô tả thô và JSON để sử dụng cho các mục đích khác nhau
                        description_raw = dest_data.get("description")
                        description_json = json.dumps(description_raw, ensure_ascii=False) if description_raw else None
                        tags_json = json.dumps(dest_data.get("tags"), ensure_ascii=False) if dest_data.get("tags") else None
                        
                        # 🔑 ƯỚC TÍNH THỜI LƯỢNG NÂNG CAO
                        duration_estimated = estimate_duration_from_all_metrics(
                            dest_data.get("type"), 
                            tags_json, 
                            entry_fee_normalized, 
                            description_raw
                        )
                            
                        # Lấy/Tạo Destination
                        destination = Destination.query.filter_by(name=dest_name).first()
                        
                        if not destination:
                            # TRƯỜNG HỢP 1: TẠO MỚI 
                            try:
                                d = Destination(
                                    name=dest_name,
                                    name_unaccented=dest_name_unaccented, 
                                    province_id=province.id,
                                    place_type=dest_data.get("type"),
                                    description=description_json,
                                    estimated_duration_hours=duration_estimated, # <--- GÁN GIÁ TRỊ ƯỚC TÍNH MỚI
                                    latitude=dest_data.get("gps", {}).get("lat"),
                                    longitude=dest_data.get("gps", {}).get("lng"),
                                    opening_hours=opening_hours_normalized, 
                                    entry_fee=entry_fee_normalized, 
                                    source=dest_data.get("source"),
                                    tags=tags_json,
                                    image_url=dest_data.get("image_url"), 
                                    rating=rating,
                                    category=category_str 
                                )
                                db.session.add(d)
                                db.session.flush()

                                # 5. Tạo DestinationImage cho bản ghi mới
                                for image_url in dest_data.get("images", []):
                                    if image_url:
                                        img = DestinationImage(image_url=image_url, destination_id=d.id)
                                        db.session.add(img)

                            except IntegrityError as e:
                                print(f"Lỗi Integrity khi tạo Destination {dest_name}: {e}")
                                db.session.rollback()
                        else:
                            # TRƯỜNG HỢP 2: CẬP NHẬT 
                            destination.rating = rating
                            destination.category = category_str
                            destination.description = description_json
                            destination.tags = tags_json
                            destination.image_url = dest_data.get("image_url")
                            destination.name_unaccented = dest_name_unaccented
                            destination.estimated_duration_hours = duration_estimated # <--- CẬP NHẬT GIÁ TRỊ MỚI

                # Commit tất cả thay đổi sau khi đã duyệt qua hết Destination trong Province
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    print(f"Lỗi commit sau khi xử lý tỉnh {province_name}: {e}")

        # Commit cuối cùng cho bất kỳ thay đổi nào còn sót lại
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            
        print("\n--- Seeding/Cập nhật Dữ liệu Địa điểm HOÀN TẤT! ---")


if __name__ == "__main__":
    seed_database()