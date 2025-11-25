from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# Người dùng
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(200), nullable=True)
    
    # Relationships
    saved_tours = db.relationship("SavedTour", backref="user", lazy=True, cascade="all, delete-orphan")
    itineraries = db.relationship("Itinerary", backref="user", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="user", lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship("Booking", backref="user", lazy=True, cascade="all, delete-orphan")

# Tour du lịch
class Tour(db.Model):
    __tablename__ = 'tours'
    
    id = db.Column(db.Integer, primary_key=True)
    ma_tour = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    tour_name = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(50))  # Miền Bắc, Miền Trung, Miền Nam, Đông Bắc
    
    # Thông tin cơ bản
    description = db.Column(db.Text)
    image_url = db.Column(db.String(300))
    thoi_gian = db.Column(db.String(50))  # "5 ngày 4 đêm"
    khoi_hanh = db.Column(db.String(200))  # "28,29,30/04; 01/05"
    van_chuyen = db.Column(db.String(100))  # "Xe du lịch, Máy bay"
    xuat_phat = db.Column(db.String(100))  # "Từ Hồ Chí Minh"
    
    # Giá và đánh giá
    gia_tu = db.Column(db.String(50))
    rating = db.Column(db.Float, default=0)
    review_count = db.Column(db.Integer, default=0)
    
    # Trải nghiệm
    trai_nghiem = db.Column(db.Text)  # JSON string
    
    # Tags và category
    tags = db.Column(db.Text)  # JSON string: ["beach", "mountain", "culture"]
    category = db.Column(db.String(50))  # adventure, relaxation, culture, etc.
    
    # URL gốc
    url = db.Column(db.String(500))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    itinerary_days = db.relationship("TourItinerary", backref="tour", lazy=True, cascade="all, delete-orphan")
    inclusions = db.relationship("TourInclusion", backref="tour", lazy=True, cascade="all, delete-orphan")
    exclusions = db.relationship("TourExclusion", backref="tour", lazy=True, cascade="all, delete-orphan")
    notes = db.relationship("TourNote", backref="tour", lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship("Review", backref="tour", lazy=True, cascade="all, delete-orphan")
    saved_by = db.relationship("SavedTour", backref="tour", lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship("Booking", backref="tour", lazy=True, cascade="all, delete-orphan")

# Lịch trình từng ngày của tour
class TourItinerary(db.Model):
    __tablename__ = 'tour_itineraries'
    
    id = db.Column(db.Integer, primary_key=True)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    ngay = db.Column(db.String(200), nullable=False)  # "NGÀY 1 | TP.HCM – HÀ NỘI"
    hoat_dong = db.Column(db.Text)  # JSON string của list hoạt động
    day_number = db.Column(db.Integer)  # 1, 2, 3, 4, 5

# Dịch vụ bao gồm
class TourInclusion(db.Model):
    __tablename__ = 'tour_inclusions'
    
    id = db.Column(db.Integer, primary_key=True)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)

# Dịch vụ không bao gồm
class TourExclusion(db.Model):
    __tablename__ = 'tour_exclusions'
    
    id = db.Column(db.Integer, primary_key=True)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)

# Ghi chú tour
class TourNote(db.Model):
    __tablename__ = 'tour_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)

# Tour đã lưu
class SavedTour(db.Model):
    __tablename__ = 'saved_tours'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint
    __table_args__ = (db.UniqueConstraint('user_id', 'tour_id', name='unique_user_tour'),)

# Lịch trình cá nhân
class Itinerary(db.Model):
    __tablename__ = 'itineraries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    data = db.Column(db.Text)  # JSON: [{tour_id, day, notes}, ...]
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Đánh giá tour
class Review(db.Model):
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    rating = db.Column(db.Float, nullable=False)  # 1-5 sao
    title = db.Column(db.String(200))
    comment = db.Column(db.Text)
    images = db.Column(db.Text)  # JSON string của list URL ảnh
    helpful_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Đặt tour
class Booking(db.Model):
    __tablename__ = 'bookings'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=False)
    
    # Thông tin đặt tour
    booking_code = db.Column(db.String(50), unique=True, nullable=False)
    departure_date = db.Column(db.Date, nullable=False)
    adults = db.Column(db.Integer, default=1)
    children = db.Column(db.Integer, default=0)
    infants = db.Column(db.Integer, default=0)
    
    # Thông tin liên hệ
    contact_name = db.Column(db.String(100), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    contact_email = db.Column(db.String(120), nullable=False)
    
    # Giá và thanh toán
    total_price = db.Column(db.Float, nullable=False)
    payment_status = db.Column(db.String(20), default='pending')  # pending, paid, cancelled
    payment_method = db.Column(db.String(50))
    
    # Ghi chú
    notes = db.Column(db.Text)
    
    # Trạng thái
    status = db.Column(db.String(20), default='confirmed')  # confirmed, cancelled, completed
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Điểm đến phổ biến
class Destination(db.Model):
    __tablename__ = 'destinations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(50))
    description = db.Column(db.Text)
    image_url = db.Column(db.String(300))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    rating = db.Column(db.Float, default=0)
    tags = db.Column(db.Text)  # JSON string
    category = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)