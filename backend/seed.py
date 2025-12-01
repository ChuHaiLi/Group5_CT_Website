# backend/seed.py
import json
import os
from app import app
from models import db, Region, Province, Destination, DestinationImage
from datetime import datetime

# Danh sách các file JSON cần đọc
JSON_FILES = ["data/mienbac.json", "data/mientrung.json", "data/miennam.json"]

def load_data_from_json(file_paths):
    """Đọc và hợp nhất dữ liệu từ danh sách các file JSON."""
    all_regions_data = []
    for file_path in file_paths:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    all_regions_data.extend(data)
            except json.JSONDecodeError:
                print(f"Lỗi: File {file_path} không phải là JSON hợp lệ.")
        else:
            print(f"Cảnh báo: Không tìm thấy file {file_path}. Bỏ qua.")
    return all_regions_data

def normalize_entry_fee(fee_value):
    """
    Chuyển đổi giá trị phí vào cửa thành Float. Nếu là chuỗi chữ cái (ví dụ: "Miễn phí") 
    hoặc không thể chuyển đổi thành số, sẽ được set là 0.0.
    """
    if fee_value is None:
        return 0.0
    
    fee_str = str(fee_value).lower().strip()
    
    # 1. Kiểm tra các giá trị chuỗi phổ biến (Miễn phí, None, 0, Free)
    if 'miễn phí' in fee_str or fee_str == 'none' or fee_str == '0' or fee_str == 'free':
        return 0.0
    
    # 2. Xử lý trường hợp là số
    try:
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
    Nếu là chuỗi, trả về chuỗi đó.
    """
    # Nếu là List (gây lỗi SQL), hoặc None, hoặc chuỗi rỗng
    if not hours_value or isinstance(hours_value, list):
        return "Cả ngày"
    
    return str(hours_value).strip()


def seed_database():
    """Seed dữ liệu phân cấp từ JSON vào database."""
    print("--- Bắt đầu Seeding Dữ liệu Địa điểm ---")
    
    # 1. Đọc và hợp nhất dữ liệu từ các file
    data = load_data_from_json(JSON_FILES)
    
    if not data:
        print("Không có dữ liệu để seed. Kiểm tra các file JSON.")
        return

    with app.app_context():
        # Lặp qua từng Vùng (Region)
        for region_data in data:
            region_name = region_data.get("region_name")
            if not region_name:
                continue

            # 2. Tạo/Lấy Region
            region = Region.query.filter_by(name=region_name).first()
            if not region:
                region = Region(name=region_name)
                db.session.add(region)
                db.session.commit() 

            print(f"Đang xử lý Vùng: {region_name}")

            # Lặp qua từng Tỉnh (Province)
            for province_data in region_data.get("provinces", []):
                province_name = province_data.get("province_name")
                if not province_name:
                    continue

                # 3. Tạo/Lấy Province
                province = Province.query.filter_by(name=province_name).first()
                if not province:
                    province = Province(
                        name=province_name,
                        overview=province_data.get("overview"),
                        image_url=province_data.get("image_url"),
                        region_id=region.id 
                    )
                    db.session.add(province)
                    db.session.commit() 

                print(f"  Đang xử lý Tỉnh: {province_name}")

                # --- BƯỚC SỬA LỖI LIST LỒNG LIST (DÀN PHẲNG) ---
                places_raw = province_data.get("places", [])
                places_list = []
                for item in places_raw:
                    if isinstance(item, list):
                        # Nếu gặp list lồng list, dàn phẳng nó ra
                        places_list.extend(item)
                    elif isinstance(item, dict):
                        # Nếu là dict hợp lệ, thêm vào
                        places_list.append(item)
                
                # Lặp qua từng Địa điểm (Destination) từ danh sách đã chuẩn hóa
                for dest_data in places_list:
                    
                    # Cần đảm bảo đây là dict (phòng trường hợp list có phần tử lạ)
                    if not isinstance(dest_data, dict):
                        continue

                    dest_name = dest_data.get("name")
                    if not dest_name:
                        continue

                    # 4. Chuẩn hóa dữ liệu
                    entry_fee_normalized = normalize_entry_fee(dest_data.get("entry_fee"))
                    opening_hours_normalized = normalize_opening_hours(dest_data.get("opening_hours"))
                    
                    # CHÚ Ý: Chuyển đổi list description và tags thành JSON string
                    description_json = json.dumps(dest_data.get("description")) if dest_data.get("description") else None
                    tags_json = json.dumps(dest_data.get("tags")) if dest_data.get("tags") else None
                    
                    # Lấy/Tạo Destination
                    destination = Destination.query.filter_by(name=dest_name).first()
                    
                    if not destination:
                        d = Destination(
                            name=dest_name,
                            province_id=province.id,
                            place_type=dest_data.get("type"),
                            description=description_json,
                            
                            # Xử lý GPS (Giả định GPS là số, nếu không sẽ lưu NULL)
                            latitude=dest_data.get("gps", {}).get("lat"),
                            longitude=dest_data.get("gps", {}).get("lng"),
                            
                            opening_hours=opening_hours_normalized, 
                            entry_fee=entry_fee_normalized, 
                            source=dest_data.get("source"),
                            tags=tags_json
                        )
                        db.session.add(d)
                        db.session.commit() 

                        # 5. Tạo DestinationImage
                        for image_url in dest_data.get("images", []):
                            img = DestinationImage(
                                image_url=image_url,
                                destination_id=d.id
                            )
                            db.session.add(img)

        db.session.commit()
        print("\n--- Seeding Dữ liệu Địa điểm HOÀN TẤT! ---")


if __name__ == "__main__":
    seed_database()