# backend/seed.py
import json
import os
import random 
from app import app
from models import db, Region, Province, Destination, DestinationImage
from datetime import datetime
from sqlalchemy.exc import IntegrityError

# Danh sách các file JSON cần đọc
JSON_FILES = ["data/mienbac.json", "data/mientrung.json", "data/miennam.json"]

# CẤU HÌNH RANDOM THEO VÙNG
REGION_CONFIG = {
    "Miền Bắc": {"temp_min": 15, "temp_max": 35, "weather_types": ["Sunny", "Cloudy", "Rainy"]},
    "Miền Trung": {"temp_min": 27, "temp_max": 39, "weather_types": ["Sunny", "Hot", "Clear"]},
    "Miền Nam": {"temp_min": 25, "temp_max": 36, "weather_types": ["Sunny", "Hot", "Cloudy", "Rainy"]},
}
RATING_MIN = 3.8
RATING_MAX = 5.0
DEFAULT_CATEGORY = ["Nature", "City", "Cultural"] 

def load_data_from_json(file_paths):
    """Đọc và hợp nhất dữ liệu từ danh sách các file JSON."""
    all_regions_data = []
    for file_path in file_paths:
        # Đường dẫn tương đối từ vị trí seed.py
        full_path = os.path.join(os.path.dirname(__file__), file_path)
        
        if os.path.exists(full_path):
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Đảm bảo data là list (nếu file JSON chứa một region duy nhất, nó sẽ là dict)
                if isinstance(data, dict):
                    all_regions_data.append(data)
                elif isinstance(data, list):
                    all_regions_data.extend(data)
                
            except json.JSONDecodeError:
                print(f"Lỗi: File {file_path} không phải là JSON hợp lệ.")
            except Exception as e:
                print(f"Lỗi đọc file {file_path}: {e}")
        else:
            print(f"Cảnh báo: Không tìm thấy file {file_path} tại {full_path}. Bỏ qua.")
    return all_regions_data

def normalize_entry_fee(fee_value):
    """
    Chuyển đổi giá trị phí vào cửa thành Float. Nếu là chuỗi chữ cái hoặc không thể chuyển đổi, sẽ set là 0.0.
    """
    if fee_value is None:
        return 0.0
    
    fee_str = str(fee_value).lower().strip()
    
    if 'miễn phí' in fee_str or fee_str == 'none' or fee_str == '0' or fee_str == 'free':
        return 0.0
    
    try:
        # Loại bỏ các ký tự không phải số (trừ dấu chấm thập phân nếu cần)
        numeric_str = fee_str.replace('vnđ', '').replace('vnd', '').replace('.', '').replace(',', '').replace(' ', '')
        
        if numeric_str and numeric_str.isdigit():
            return float(numeric_str)
        else:
            return 0.0
    except ValueError:
        return 0.0

def normalize_opening_hours(hours_value):
    """
    Chuẩn hóa giá trị giờ mở cửa. Nếu là List hoặc None/chuỗi rỗng, trả về "Cả ngày".
    """
    if not hours_value or isinstance(hours_value, list):
        return "Cả ngày"
    
    return str(hours_value).strip()

def generate_random_metrics(region_name):
    """Tạo Rating và Category ngẫu nhiên dựa trên Vùng."""
    config = REGION_CONFIG.get(region_name, REGION_CONFIG["Miền Nam"]) 

    # 1. Random Rating (làm tròn 1 chữ số thập phân)
    rating = round(random.uniform(RATING_MIN, RATING_MAX), 1)

    # 2. Random Category
    category = random.choice(DEFAULT_CATEGORY)
    
    # 3. Random Weather (chỉ để hiển thị)
    temp = random.randint(config["temp_min"], config["temp_max"])
    weather_type = random.choice(config["weather_types"])
    weather = f"{weather_type} {temp}°C"
    
    return rating, weather, category


def seed_database():
    """Seed dữ liệu phân cấp từ JSON vào database."""
    print("--- Bắt đầu Seeding/Cập nhật Dữ liệu Địa điểm ---")
    
    data = load_data_from_json(JSON_FILES)
    
    if not data:
        print("Không có dữ liệu để seed. Kiểm tra các file JSON.")
        return

    with app.app_context():
        
        for region_data in data:
            region_name = region_data.get("region_name")
            if not region_name:
                continue

            # 2. Tạo/Lấy Region
            # Tách riêng commit cho Region/Province để tránh rollback lớn
            region = Region.query.filter_by(name=region_name).first()
            if not region:
                try:
                    region = Region(name=region_name)
                    db.session.add(region)
                    db.session.commit() 
                except IntegrityError:
                    db.session.rollback()
                    # Lấy lại nếu bị lỗi do Race Condition (rất hiếm trong seed.py)
                    region = Region.query.filter_by(name=region_name).first() 

            print(f"Đang xử lý Vùng: {region_name}")
            
            for province_data in region_data.get("provinces", []):
                province_name = province_data.get("province_name")
                if not province_name:
                    continue

                # 3. Tạo/Lấy Province
                province = Province.query.filter_by(name=province_name).first()
                if not province:
                    try:
                        province = Province(
                            name=province_name,
                            overview=province_data.get("overview"),
                            image_url=province_data.get("image_url"),
                            region_id=region.id 
                        )
                        db.session.add(province)
                        db.session.commit() 
                    except IntegrityError:
                        db.session.rollback()
                        province = Province.query.filter_by(name=province_name).first() 

                print(f"  Đang xử lý Tỉnh: {province_name}")

                # --- DÀN PHẲNG PLACES ---
                places_raw = province_data.get("places", [])
                places_list = []
                for item in places_raw:
                    if isinstance(item, list):
                        places_list.extend(item)
                    elif isinstance(item, dict):
                        places_list.append(item)
                
                # SỬ DỤNG NO_AUTOFLUSH ĐỂ TRÁNH LỖI INTEGRITY ERROR VÌ DESTINATION.query
                # Nếu không dùng no_autoflush, cần phải flush sau khi thêm Destination mới.
                with db.session.no_autoflush:
                    # Lặp qua từng Địa điểm (Destination)
                    for dest_data in places_list:
                        
                        if not isinstance(dest_data, dict):
                            continue

                        dest_name = dest_data.get("name")
                        if not dest_name:
                            continue
                            
                        # RANDOM METRICS CHO DESTINATION
                        rating, weather_str, category_str = generate_random_metrics(region_name)

                        # 4. Chuẩn hóa dữ liệu
                        entry_fee_normalized = normalize_entry_fee(dest_data.get("entry_fee"))
                        opening_hours_normalized = normalize_opening_hours(dest_data.get("opening_hours"))
                        description_json = json.dumps(dest_data.get("description"), ensure_ascii=False) if dest_data.get("description") else None
                        tags_json = json.dumps(dest_data.get("tags"), ensure_ascii=False) if dest_data.get("tags") else None
                        
                        # Lấy/Tạo Destination
                        destination = Destination.query.filter_by(name=dest_name).first()
                        
                        if not destination:
                            # TRƯỜNG HỢP 1: TẠO MỚI (Áp dụng tất cả các trường)
                            try:
                                d = Destination(
                                    name=dest_name,
                                    province_id=province.id,
                                    place_type=dest_data.get("type"),
                                    description=description_json,
                                    latitude=dest_data.get("gps", {}).get("lat"),
                                    longitude=dest_data.get("gps", {}).get("lng"),
                                    opening_hours=opening_hours_normalized, 
                                    entry_fee=entry_fee_normalized, 
                                    source=dest_data.get("source"),
                                    tags=tags_json,
                                    image_url=dest_data.get("image_url"), # Cập nhật cột ảnh chính
                                    # THÊM RANDOM VALUES
                                    rating=rating,
                                    category=category_str 
                                )
                                db.session.add(d)

                                # ✨ KHẮC PHỤC LỖI: FLUSH để gán ID cho 'd' trước khi tạo ảnh liên quan ✨
                                # Nếu không có dòng này, d.id là None, gây lỗi IntegrityError
                                db.session.flush()

                                # 5. Tạo DestinationImage cho bản ghi mới
                                for image_url in dest_data.get("images", []):
                                    if image_url:
                                        # destination_id=d.id lúc này đã có giá trị hợp lệ
                                        img = DestinationImage(image_url=image_url, destination_id=d.id)
                                        db.session.add(img)

                            except IntegrityError as e:
                                # Lỗi này hiếm xảy ra nếu dùng filter_by(name) ở trên
                                print(f"Lỗi Integrity khi tạo Destination {dest_name}: {e}")
                                db.session.rollback()
                        else:
                            # TRƯỜNG HỢP 2: CẬP NHẬT (Chỉ cập nhật rating và category)
                            destination.rating = rating
                            destination.category = category_str
                            destination.description = description_json
                            destination.tags = tags_json
                            # Cập nhật ảnh chính (nếu có)
                            destination.image_url = dest_data.get("image_url")


                # Commit tất cả thay đổi sau khi đã duyệt qua hết Destination trong Province
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    print(f"Lỗi commit sau khi xử lý tỉnh {province_name}: {e}")


        # Commit cuối cùng cho bất kỳ thay đổi nào còn sót lại
        db.session.commit()
        print("\n--- Seeding/Cập nhật Dữ liệu Địa điểm HOÀN TẤT! ---")


if __name__ == "__main__":
    seed_database()