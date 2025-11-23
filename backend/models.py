from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Người dùng
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(200), nullable=True)
    
    # Relationship
    saved_destinations = db.relationship("SavedDestination", backref="user", lazy=True)
    itineraries = db.relationship("Itinerary", backref="user", lazy=True)
    reviews = db.relationship("Review", backref="user", lazy=True)

# Địa điểm
class Destination(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(200))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    rating = db.Column(db.Float, default=0)  # đánh giá trung bình
    tags = db.Column(db.Text)  # JSON hoặc danh sách tag
    category = db.Column(db.String(50))  # ví dụ: beach, city, mountain

    # Relationship
    reviews = db.relationship("Review", backref="destination", lazy=True)
    saved_by_users = db.relationship("SavedDestination", backref="destination", lazy=True)

# Lịch trình cá nhân của user
class Itinerary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100))
    data = db.Column(db.Text)  # JSON lưu các địa điểm và ngày
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Nơi lưu địa điểm yêu thích
class SavedDestination(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    destination_id = db.Column(db.Integer, db.ForeignKey('destination.id'), nullable=False)
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)

# Đánh giá địa điểm
class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    destination_id = db.Column(db.Integer, db.ForeignKey('destination.id'), nullable=False)
    rating = db.Column(db.Float, nullable=False)  # 1-5 sao
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
