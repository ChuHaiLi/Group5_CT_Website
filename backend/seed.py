# backend/seed.py
from app import app
from models import db, Tour, TourItinerary, TourInclusion, TourExclusion, TourNote
import json
import os

def load_tours_from_json(file_path, region):
    """Load tours from JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f), region
    except FileNotFoundError:
        print(f"Warning: {file_path} not found")
        return [], region
    except json.JSONDecodeError as e:
        print(f"Error decoding {file_path}: {e}")
        return [], region

def seed_tours():
    """Import tours from JSON files"""
    # Đường dẫn đến các file JSON
    json_files = [
        ('tours_mienbac.json', 'Miền Bắc'),
        ('tours_mientrung.json', 'Miền Trung'),
        ('tours_miennam.json', 'Miền Nam'),
    ]
    
    total_imported = 0
    
    for file_name, region in json_files:
        file_path = os.path.join('data', file_name)
        tours_data, region_name = load_tours_from_json(file_path, region)
        
        for tour_data in tours_data:
            # Kiểm tra tour đã tồn tại chưa
            exists = Tour.query.filter_by(ma_tour=tour_data.get('ma_tour')).first()
            if exists:
                print(f"Tour {tour_data.get('ma_tour')} already exists, skipping...")
                continue
            
            # Tạo tour mới
            tour = Tour(
                ma_tour=tour_data.get('ma_tour'),
                title=tour_data.get('title'),
                tour_name=tour_data.get('tour_name'),
                region=region_name,
                description=tour_data.get('description'),
                image_url=tour_data.get('hinh_anh_chinh'),  # Lấy từ field hinh_anh_chinh
                thoi_gian=tour_data.get('thoi_gian'),
                khoi_hanh=tour_data.get('khoi_hanh'),
                van_chuyen=tour_data.get('van_chuyen'),
                xuat_phat=tour_data.get('xuat_phat'),
                gia_tu=tour_data.get('gia_tu'),
                rating=tour_data.get('rating', 4.5),  # Default rating
                review_count=tour_data.get('review_count', 0),
                trai_nghiem=json.dumps(tour_data.get('trai_nghiem', []), ensure_ascii=False),
                tags=json.dumps(tour_data.get('tags', []), ensure_ascii=False),
                category=tour_data.get('category', 'general'),
                url=tour_data.get('url')
            )
            
            db.session.add(tour)
            db.session.flush()  # Để lấy tour.id
            
            # Thêm lịch trình từng ngày
            for idx, day in enumerate(tour_data.get('lich_trinh', []), 1):
                itinerary = TourItinerary(
                    tour_id=tour.id,
                    ngay=day.get('ngay'),
                    hoat_dong=json.dumps(day.get('hoat_dong', []), ensure_ascii=False),
                    day_number=idx
                )
                db.session.add(itinerary)
            
            # Thêm dịch vụ bao gồm
            for inclusion in tour_data.get('bao_gom', []):
                incl = TourInclusion(
                    tour_id=tour.id,
                    content=inclusion
                )
                db.session.add(incl)
            
            # Thêm dịch vụ không bao gồm
            for exclusion in tour_data.get('khong_bao_gom', []):
                excl = TourExclusion(
                    tour_id=tour.id,
                    content=exclusion
                )
                db.session.add(excl)
            
            # Thêm ghi chú
            for note in tour_data.get('ghi_chu', []):
                note_obj = TourNote(
                    tour_id=tour.id,
                    content=note
                )
                db.session.add(note_obj)
            
            total_imported += 1
            print(f"Imported tour: {tour.tour_name} ({region_name})")
    
    db.session.commit()
    print(f"\n✅ Total tours imported: {total_imported}")

if __name__ == "__main__":
    with app.app_context():
        print("🗄️  Creating database tables...")
        db.create_all()
        print("✅ Database tables created!\n")
        
        print("🌱 Starting database seeding...")
        
        # Seed tours from JSON files
        seed_tours()
        
        print("\n🎉 Database seeding completed!")